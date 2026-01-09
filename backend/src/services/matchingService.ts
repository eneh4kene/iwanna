import { v4 as uuidv4 } from 'uuid';
import { query } from './database';
import { geo } from './redis';
import { logger } from '../utils/logger';
import { appConfig } from '../config';
import { Intent, AppError } from '../types';
import { podService } from './podService';
import { notificationService } from './notificationService';
import { geocodingService } from './geocodingService';
import { aiChatService } from './aiChatService';
import { chatService } from './chatService';

/**
 * Wanna with location for matching
 */
interface WannaForMatching {
  id: string;
  userId: string;
  rawInput: string;
  intent: Intent;
  embedding: number[] | null;
  location: {
    latitude: number;
    longitude: number;
  };
  locationName: string;
  createdAt: Date;
}

/**
 * Compatibility score between two wannas
 */
interface CompatibilityScore {
  wannaId1: string;
  wannaId2: string;
  totalScore: number;
  breakdown: {
    proximity: number; // 0-1
    semantic: number; // 0-1
    timing: number; // 0-1
    energy: number; // 0-1
    category: number; // 0-1
  };
}

/**
 * Potential pod candidate
 */
interface PodCandidate {
  wannaIds: string[];
  userIds: string[];
  avgCompatibility: number;
  centroid: {
    latitude: number;
    longitude: number;
  };
  sharedIntent: Partial<Intent>;
}

/**
 * Matching Service
 * Implements the core matching algorithm for Phase 1D
 */
class MatchingService {
  /**
   * Find potential matches for a wanna
   * Uses Redis geospatial index for proximity, then calculates compatibility
   */
  async findMatches(wannaId: string): Promise<string[]> {
    // Get the wanna details
    const wanna = await this.getWannaForMatching(wannaId);
    if (!wanna) {
      throw new AppError('Wanna not found', 404);
    }

    // Find nearby wannas using Redis GEORADIUS (try default radius first)
    let nearbyWannaIds = await this.findNearbyWannas(
      wanna.location.latitude,
      wanna.location.longitude,
      appConfig.matchingRadiusMiles
    );

    // Filter out the current wanna
    let candidateWannaIds = nearbyWannaIds.filter(id => id !== wannaId);

    // If no matches with default radius, try fallback radius (one-time expansion)
    if (candidateWannaIds.length === 0 && appConfig.fallbackRadiusMiles > appConfig.matchingRadiusMiles) {
      logger.info('No matches at default radius, trying fallback', {
        wannaId,
        defaultRadius: appConfig.matchingRadiusMiles,
        fallbackRadius: appConfig.fallbackRadiusMiles,
      });

      nearbyWannaIds = await this.findNearbyWannas(
        wanna.location.latitude,
        wanna.location.longitude,
        appConfig.fallbackRadiusMiles
      );

      candidateWannaIds = nearbyWannaIds.filter(id => id !== wannaId);
    }

    if (candidateWannaIds.length === 0) {
      logger.info('No nearby wannas found (even with fallback)', { wannaId });
      return [];
    }

    // Get details for all candidate wannas
    const candidateWannas = await this.getMultipleWannasForMatching(
      candidateWannaIds
    );

    // Calculate compatibility scores
    const compatibilityScores = candidateWannas.map(candidate =>
      this.calculateCompatibility(wanna, candidate)
    );

    // Sort by total score (highest first)
    compatibilityScores.sort((a, b) => b.totalScore - a.totalScore);

    // Return top matches (at least threshold score of 0.40) - Temporarily lowered for cross-location testing
    const matches = compatibilityScores
      .filter(score => score.totalScore >= 0.40)
      .map(score => score.wannaId2);

    logger.info('Matches found', {
      wannaId,
      nearbyCount: nearbyWannaIds.length,
      matchCount: matches.length,
      topScore: compatibilityScores[0]?.totalScore,
    });

    return matches;
  }

  /**
   * Attempt to form a pod from a wanna and its matches
   * Creates pods of 2-4 people (configurable via appConfig)
   */
  async formPod(wannaId: string): Promise<string | null> {
    // Find matches
    const matchIds = await this.findMatches(wannaId);

    if (matchIds.length === 0) {
      logger.info('No matches found for pod formation', { wannaId });
      return null;
    }

    // Get wanna details
    const sourceWanna = await this.getWannaForMatching(wannaId);
    if (!sourceWanna) {
      throw new AppError('Wanna not found', 404);
    }

    // Take top matches (up to maxPodSize - 1, since source wanna is included)
    const topMatches = matchIds.slice(0, appConfig.maxPodSize - 1);
    const matchWannas = await this.getMultipleWannasForMatching(topMatches);

    // Build pod candidate - filter out duplicate users
    const allWannas = [sourceWanna, ...matchWannas];

    // Remove wannas from the same user (keep only the first wanna per user)
    const seenUserIds = new Set<string>();
    const uniqueWannas = allWannas.filter(wanna => {
      if (seenUserIds.has(wanna.userId)) {
        return false;
      }
      seenUserIds.add(wanna.userId);
      return true;
    });

    const wannaIds = uniqueWannas.map(w => w.id);
    const userIds = uniqueWannas.map(w => w.userId);

    // Check minimum pod size (after filtering duplicates)
    if (userIds.length < appConfig.minPodSize) {
      logger.info('Not enough unique users for pod', {
        wannaId,
        required: appConfig.minPodSize,
        found: userIds.length,
      });
      return null;
    }

    // Calculate centroid (geographic center)
    const centroid = this.calculateCentroid(
      uniqueWannas.map(w => w.location)
    );

    // Merge intents to create shared intent
    const sharedIntent = this.mergeIntents(uniqueWannas.map(w => w.intent));

    // Calculate average compatibility (use uniqueWannas without the source)
    const uniqueMatchWannas = uniqueWannas.slice(1);
    const avgCompatibility = uniqueMatchWannas.reduce((sum, matchWanna) => {
      const compat = this.calculateCompatibility(sourceWanna, matchWanna);
      return sum + compat.totalScore;
    }, 0) / uniqueMatchWannas.length;

    // Create pod in database
    const podId = await this.createPod({
      wannaIds,
      userIds,
      centroid,
      sharedIntent,
      avgCompatibility,
    });

    // Mark wannas as matched
    await this.markWannasAsMatched(wannaIds, podId);

    logger.info('Pod formed', {
      podId,
      wannaIds,
      userIds,
      memberCount: userIds.length,
    });

    // Get full pod and member details for notifications
    const pod = await podService.getPodById(podId);
    const members = await podService.getPodMembers(podId);

    // Notify all members via WebSocket
    if (pod && members.length > 0) {
      await notificationService.notifyPodFormed(pod, members).catch((err: unknown) => {
        logger.error('Failed to send pod formed notifications', {
          podId,
          error: err,
        });
      });
    }

    return podId;
  }

  /**
   * Calculate compatibility between two wannas
   * Multi-dimensional scoring: proximity, semantic, timing, energy, category
   */
  private calculateCompatibility(
    wanna1: WannaForMatching,
    wanna2: WannaForMatching
  ): CompatibilityScore {
    // 1. Proximity score (distance-based)
    const distance = this.calculateDistance(
      wanna1.location.latitude,
      wanna1.location.longitude,
      wanna2.location.latitude,
      wanna2.location.longitude
    );
    const proximityScore = this.distanceToScore(
      distance,
      appConfig.matchingRadiusMiles
    );

    // 2. Semantic similarity (embedding-based, if available)
    let semanticScore = 0.5; // Default neutral score
    if (wanna1.embedding && wanna2.embedding) {
      semanticScore = this.cosineSimilarity(wanna1.embedding, wanna2.embedding);
    }

    // 3. Timing score (how close in time they were created)
    const timeDiff = Math.abs(
      wanna1.createdAt.getTime() - wanna2.createdAt.getTime()
    );
    const timingScore = this.timeDiffToScore(timeDiff);

    // 4. Energy level match
    const energyScore = this.energyLevelMatch(
      wanna1.intent.energyLevel,
      wanna2.intent.energyLevel
    );

    // 5. Category match
    const categoryScore = wanna1.intent.category === wanna2.intent.category ? 1 : 0.3;

    // Weighted total score
    const weights = {
      proximity: 0.25,
      semantic: 0.30,
      timing: 0.15,
      energy: 0.15,
      category: 0.15,
    };

    const totalScore =
      proximityScore * weights.proximity +
      semanticScore * weights.semantic +
      timingScore * weights.timing +
      energyScore * weights.energy +
      categoryScore * weights.category;

    return {
      wannaId1: wanna1.id,
      wannaId2: wanna2.id,
      totalScore,
      breakdown: {
        proximity: proximityScore,
        semantic: semanticScore,
        timing: timingScore,
        energy: energyScore,
        category: categoryScore,
      },
    };
  }

  /**
   * Find nearby wannas using Redis GEORADIUS
   */
  private async findNearbyWannas(
    latitude: number,
    longitude: number,
    radiusMiles: number
  ): Promise<string[]> {
    const wannaIds = await geo.radius(
      'active_wannas',
      longitude,
      latitude,
      radiusMiles,
      'mi'
    );
    return wannaIds;
  }

  /**
   * Get wanna details for matching
   */
  private async getWannaForMatching(
    wannaId: string
  ): Promise<WannaForMatching | null> {
    const result = await query<{
      id: string;
      user_id: string;
      raw_input: string;
      intent: Intent;
      embedding: string | null;
      latitude: number;
      longitude: number;
      location_name: string;
      created_at: Date;
    }>(
      `SELECT
        id, user_id, raw_input, intent, embedding, location_name, created_at,
        ST_Y(location::geometry) as latitude,
        ST_X(location::geometry) as longitude
      FROM wannas
      WHERE id = $1 AND status = 'active' AND expires_at > NOW()`,
      [wannaId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      rawInput: row.raw_input,
      intent: row.intent,
      embedding: row.embedding ? JSON.parse(row.embedding) : null,
      location: {
        latitude: row.latitude,
        longitude: row.longitude,
      },
      locationName: row.location_name,
      createdAt: row.created_at,
    };
  }

  /**
   * Get multiple wannas for matching
   */
  private async getMultipleWannasForMatching(
    wannaIds: string[]
  ): Promise<WannaForMatching[]> {
    if (wannaIds.length === 0) return [];

    const result = await query<{
      id: string;
      user_id: string;
      raw_input: string;
      intent: Intent;
      embedding: string | null;
      latitude: number;
      longitude: number;
      location_name: string;
      created_at: Date;
    }>(
      `SELECT
        id, user_id, raw_input, intent, embedding, location_name, created_at,
        ST_Y(location::geometry) as latitude,
        ST_X(location::geometry) as longitude
      FROM wannas
      WHERE id = ANY($1) AND status = 'active' AND expires_at > NOW()`,
      [wannaIds]
    );

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      rawInput: row.raw_input,
      intent: row.intent,
      embedding: row.embedding ? JSON.parse(row.embedding) : null,
      location: {
        latitude: row.latitude,
        longitude: row.longitude,
      },
      locationName: row.location_name,
      createdAt: row.created_at,
    }));
  }

  /**
   * Calculate distance between two points in miles (Haversine formula)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convert distance to score (closer = higher score)
   */
  private distanceToScore(distanceMiles: number, maxRadius: number): number {
    // Linear decay: 1.0 at 0 miles, 0.0 at maxRadius
    return Math.max(0, 1 - distanceMiles / maxRadius);
  }

  /**
   * Convert time difference to score (recent = higher score)
   */
  private timeDiffToScore(timeDiffMs: number): number {
    const tenMinutes = 10 * 60 * 1000;
    const oneHour = 60 * 60 * 1000;

    if (timeDiffMs < tenMinutes) return 1.0;
    if (timeDiffMs > oneHour) return 0.3;

    // Linear interpolation between 10min and 1hour
    return 1.0 - (timeDiffMs - tenMinutes) / (oneHour - tenMinutes) * 0.7;
  }

  /**
   * Energy level match score
   */
  private energyLevelMatch(
    energy1: string,
    energy2: string
  ): number {
    const energyLevels = ['low', 'medium', 'high'];
    const idx1 = energyLevels.indexOf(energy1);
    const idx2 = energyLevels.indexOf(energy2);

    if (idx1 === -1 || idx2 === -1) return 0.5;

    const diff = Math.abs(idx1 - idx2);
    if (diff === 0) return 1.0;
    if (diff === 1) return 0.6;
    return 0.3;
  }

  /**
   * Cosine similarity between two embeddings
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length || vec1.length === 0) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      const v1 = vec1[i];
      const v2 = vec2[i];
      if (v1 === undefined || v2 === undefined) continue;

      dotProduct += v1 * v2;
      norm1 += v1 * v1;
      norm2 += v2 * v2;
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  /**
   * Calculate geographic centroid of multiple locations
   */
  private calculateCentroid(
    locations: Array<{ latitude: number; longitude: number }>
  ): { latitude: number; longitude: number } {
    if (locations.length === 0) {
      throw new Error('Cannot calculate centroid of empty locations');
    }

    let sumLat = 0;
    let sumLon = 0;

    for (const loc of locations) {
      sumLat += loc.latitude;
      sumLon += loc.longitude;
    }

    return {
      latitude: sumLat / locations.length,
      longitude: sumLon / locations.length,
    };
  }

  /**
   * Merge intents from multiple wannas to create shared intent
   */
  private mergeIntents(intents: Intent[]): Partial<Intent> {
    if (intents.length === 0) {
      return {
        activity: 'hang out',
        category: 'conversation',
        socialPreference: 'small_group',
      };
    }

    // Use the first intent as base, find common elements
    const firstIntent = intents[0];
    if (!firstIntent) {
      return {
        activity: 'hang out',
        category: 'conversation',
        socialPreference: 'small_group',
      };
    }

    // Find most common category
    const categoryCount = new Map<string, number>();
    intents.forEach(intent => {
      categoryCount.set(
        intent.category,
        (categoryCount.get(intent.category) || 0) + 1
      );
    });

    let mostCommonCategory = firstIntent.category;
    let maxCount = 0;
    categoryCount.forEach((count, category) => {
      if (count > maxCount && firstIntent) {
        maxCount = count;
        mostCommonCategory = category as typeof firstIntent.category;
      }
    });

    // Collect all unique keywords
    const allKeywords = new Set<string>();
    intents.forEach(intent => {
      intent.keywords.forEach(kw => allKeywords.add(kw));
    });

    // Create a human-friendly activity name from keywords
    const topKeywords = Array.from(allKeywords).slice(0, 2);
    const activityName = topKeywords.length > 0
      ? topKeywords.join(' & ')
      : mostCommonCategory.replace('_', ' ');

    return {
      activity: activityName,
      category: mostCommonCategory,
      energyLevel: firstIntent.energyLevel,
      socialPreference: 'small_group',
      timeSensitivity: 'now',
      keywords: Array.from(allKeywords).slice(0, 5),
    };
  }

  /**
   * Create pod in database
   */
  private async createPod(candidate: PodCandidate): Promise<string> {
    const podId = uuidv4();
    const expiresAt = new Date(
      Date.now() + appConfig.podExpiryHours * 60 * 60 * 1000
    );

    // Reverse geocode the centroid to get a place name
    let meetingPlaceName: string | null = null;
    try {
      meetingPlaceName = await geocodingService.reverseGeocode(
        candidate.centroid.latitude,
        candidate.centroid.longitude
      );
    } catch (error) {
      logger.warn('Failed to reverse geocode pod location', {
        podId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    await query(
      `INSERT INTO pods (
        id, wanna_ids, user_ids, centroid_location, shared_intent,
        status, expires_at, meeting_place_name
      )
      VALUES (
        $1, $2, $3,
        ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
        $6, 'active', $7, $8
      )`,
      [
        podId,
        candidate.wannaIds,
        candidate.userIds,
        candidate.centroid.longitude,
        candidate.centroid.latitude,
        JSON.stringify(candidate.sharedIntent),
        expiresAt,
        meetingPlaceName,
      ]
    );

    // Send AI icebreaker message
    this.sendAiIcebreaker(
      podId,
      candidate.sharedIntent.activity || 'hang out',
      candidate.userIds.length,
      meetingPlaceName ?? undefined
    ).catch((error) => {
      logger.error('Failed to send AI icebreaker', { podId, error });
    });

    return podId;
  }

  /**
   * Send AI icebreaker message to pod
   */
  private async sendAiIcebreaker(
    podId: string,
    activity: string,
    memberCount: number,
    locationName?: string
  ): Promise<void> {
    try {
      // Check if AI service is available
      if (!aiChatService.isAvailable()) {
        logger.info('AI service not available, skipping icebreaker', { podId });
        return;
      }

      // Generate icebreaker message
      const icebreakerMessage = await aiChatService.generateIcebreaker(
        activity,
        memberCount,
        locationName
      );

      // Send as AI message
      await chatService.sendAiMessage(podId, icebreakerMessage);

      logger.info('AI icebreaker sent', { podId, activity });
    } catch (error) {
      logger.error('Error sending AI icebreaker', { podId, error });
      // Don't throw - icebreaker is nice-to-have, not critical
    }
  }

  /**
   * Mark wannas as matched and link to pod
   */
  private async markWannasAsMatched(
    wannaIds: string[],
    podId: string
  ): Promise<void> {
    await query(
      `UPDATE wannas
       SET status = 'matched', matched_at = NOW()
       WHERE id = ANY($1)`,
      [wannaIds]
    );

    // Remove from Redis geospatial index
    for (const wannaId of wannaIds) {
      await geo.remove('active_wannas', wannaId);
    }

    logger.info('Wannas marked as matched', { wannaIds, podId });
  }
}

export const matchingService = new MatchingService();
