import { v4 as uuidv4 } from 'uuid';
import { query } from './database';
import { geo } from './redis';
import { aiService } from './aiService';
import { locationService } from './locationService';
import { logger } from '../utils/logger';
import { appConfig } from '../config';
import { Location, Intent, AppError } from '../types';

/**
 * Input for creating a wanna
 */
interface CreateWannaInput {
  userId: string;
  rawInput: string;
  moodEmoji?: string | undefined;
  location: Location;
}

/**
 * Result from creating a wanna
 */
interface CreateWannaResult {
  wannaId: string;
  intent: Intent;
  locationName: string;
  expiresAt: Date;
}

/**
 * Wanna from database
 */
interface WannaRecord {
  id: string;
  user_id: string;
  raw_input: string;
  mood_emoji: string | null;
  intent: Intent;
  location_name: string;
  status: string;
  created_at: Date;
  expires_at: Date;
}

/**
 * Wanna Service
 */
class WannaService {
  /**
   * Create a new wanna
   */
  async createWanna(input: CreateWannaInput): Promise<CreateWannaResult> {
    const { userId, rawInput, moodEmoji, location } = input;

    // Validate input
    if (!rawInput || rawInput.trim().length < 3) {
      throw new AppError('Tell us a bit more about what you wanna do', 400);
    }

    if (rawInput.length > 200) {
      throw new AppError('Keep it short and sweet (under 200 characters)', 400);
    }

    // Validate location
    if (!locationService.isValidLocation(location.latitude, location.longitude)) {
      throw new AppError('Invalid location coordinates', 400);
    }

    // Get location context
    const locationContext = await locationService.reverseGeocode(
      location.latitude,
      location.longitude
    );

    // Parse intent with AI (fallback if API key not configured)
    let intent, embedding;
    try {
      const result = await aiService.parseIntent(
        rawInput,
        moodEmoji,
        locationContext || undefined
      );
      intent = result.intent;
      embedding = result.embedding;
    } catch (error) {
      // Fallback intent if AI service fails
      logger.warn('AI service failed, using fallback intent', { error });
      intent = {
        activity: rawInput,
        category: 'conversation' as const,
        energyLevel: 'medium' as const,
        socialPreference: 'small_group' as const,
        timeSensitivity: 'flexible' as const,
        durationEstimate: 60,
        locationFlexibility: 'neighborhood' as const,
        keywords: rawInput.split(' ').slice(0, 3).filter(Boolean),
        emotionalTone: moodEmoji || 'neutral',
        confidence: 0.3,
      };
      embedding = null;
    }

    // Create wanna record
    const wannaId = uuidv4();
    const expiresAt = new Date(
      Date.now() + appConfig.wannaExpiryHours * 60 * 60 * 1000
    );

    // Store in PostgreSQL with PostGIS
    await query(
      `INSERT INTO wannas (
        id, user_id, raw_input, mood_emoji, intent, embedding,
        location, location_accuracy, location_name, status, expires_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography,
        $9, $10, 'active', $11
      )`,
      [
        wannaId,
        userId,
        rawInput,
        moodEmoji || null,
        JSON.stringify(intent),
        JSON.stringify(embedding), // Store as JSON for now (pgvector would be better)
        location.longitude,
        location.latitude,
        location.accuracy,
        locationContext?.formatted || 'Unknown location',
        expiresAt,
      ]
    );

    // Add to Redis geospatial index for fast proximity queries
    await geo.add(
      'active_wannas',
      location.longitude,
      location.latitude,
      wannaId
    );

    // TODO: Queue for matching (Phase 1D)
    // For now, just log it
    logger.info('Wanna created and queued for matching', {
      wannaId,
      userId,
      activity: intent.activity,
      category: intent.category,
    });

    return {
      wannaId,
      intent,
      locationName: locationContext?.city || 'your area',
      expiresAt,
    };
  }

  /**
   * Cancel a wanna
   */
  async cancelWanna(wannaId: string, userId: string): Promise<void> {
    const result = await query<{ status: string }>(
      'SELECT status FROM wannas WHERE id = $1 AND user_id = $2',
      [wannaId, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Wanna not found', 404);
    }

    const wanna = result.rows[0];
    if (!wanna) {
      throw new AppError('Wanna not found', 404);
    }

    if (wanna.status !== 'active') {
      throw new AppError('Wanna cannot be cancelled', 400);
    }

    // Update status
    await query(
      'UPDATE wannas SET status = $1, cancelled_at = NOW() WHERE id = $2',
      ['cancelled', wannaId]
    );

    // Remove from Redis geospatial index
    await geo.remove('active_wannas', wannaId);

    logger.info('Wanna cancelled', { wannaId, userId });
  }

  /**
   * Get user's active wannas
   */
  async getUserActiveWannas(userId: string): Promise<WannaRecord[]> {
    const result = await query<WannaRecord>(
      `SELECT id, user_id, raw_input, mood_emoji, intent, location_name,
              status, created_at, expires_at
       FROM wannas
       WHERE user_id = $1 AND status = 'active'
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Get wanna by ID
   */
  async getWannaById(wannaId: string): Promise<WannaRecord | null> {
    const result = await query<WannaRecord>(
      `SELECT id, user_id, raw_input, mood_emoji, intent, location_name,
              status, created_at, expires_at
       FROM wannas
       WHERE id = $1`,
      [wannaId]
    );

    return result.rows.length > 0 ? (result.rows[0] || null) : null;
  }

  /**
   * Find wannas near a location (for matching in Phase 1D)
   */
  async findNearbyWannas(
    latitude: number,
    longitude: number,
    radiusMiles: number = appConfig.matchingRadiusMiles
  ): Promise<string[]> {
    // Use Redis geospatial index for fast proximity search
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
   * Clean up expired wannas (should be run as cron job)
   */
  async cleanupExpiredWannas(): Promise<number> {
    const result = await query(
      `UPDATE wannas
       SET status = 'expired'
       WHERE status = 'active' AND expires_at < NOW()`
    );

    const count = result.rowCount;

    if (count > 0) {
      logger.info(`Cleaned up ${count} expired wannas`);
    }

    return count;
  }
}

export const wannaService = new WannaService();
