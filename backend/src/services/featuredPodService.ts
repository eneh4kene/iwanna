/**
 * Featured Pod Service
 * Business logic for sponsored/public pods
 */

import { query } from './database';
import { logger } from '../utils/logger';
import {
  FeaturedPod,
  FeaturedPodWithVenue,
  FeaturedPodWithMembers,
  FeaturedPodMember,
  FeaturedPodRow,
  FeaturedPodNearbyRow,
  FeaturedPodMemberRow,
  parsePostGISPoint,
  CreateFeaturedPodRequest,
  UpdateFeaturedPodRequest,
} from '../types/featuredPods';

class FeaturedPodService {
  /**
   * Get featured pods near a location
   */
  async getFeaturedPodsNearby(
    latitude: number,
    longitude: number,
    maxDistanceMiles: number = 10,
    limitCount: number = 10
  ): Promise<FeaturedPodWithVenue[]> {
    try {
      const result = await query<FeaturedPodNearbyRow>(
        `SELECT * FROM get_featured_pods_nearby($1, $2, $3, $4)`,
        [latitude, longitude, maxDistanceMiles, limitCount]
      );

      return result.rows.map(row => this.mapRowToFeaturedPodWithVenue(row));
    } catch (error) {
      logger.error('Error getting featured pods nearby:', error);
      throw error;
    }
  }

  /**
   * Get featured pod by ID with venue info
   */
  async getFeaturedPodById(featuredPodId: string): Promise<FeaturedPodWithVenue | null> {
    try {
      const result = await query<FeaturedPodRow & { venue_name: string; venue_type: string | null; venue_logo_url: string | null }>(
        `SELECT
          fp.*,
          v.name as venue_name,
          v.venue_type,
          v.logo_url as venue_logo_url
         FROM featured_pods fp
         INNER JOIN venues v ON fp.venue_id = v.id
         WHERE fp.id = $1`,
        [featuredPodId]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      if (!row) return null;
      return this.mapRowToFeaturedPodWithVenue(row);
    } catch (error) {
      logger.error('Error getting featured pod by ID:', error);
      throw error;
    }
  }

  /**
   * Get featured pod with members
   */
  async getFeaturedPodWithMembers(
    featuredPodId: string,
    currentUserId?: string
  ): Promise<FeaturedPodWithMembers | null> {
    try {
      const pod = await this.getFeaturedPodById(featuredPodId);
      if (!pod) return null;

      // Get members
      const membersResult = await query<FeaturedPodMemberRow & { username: string }>(
        `SELECT fpm.*, u.username
         FROM featured_pod_members fpm
         INNER JOIN users u ON fpm.user_id = u.id
         WHERE fpm.featured_pod_id = $1 AND fpm.status = 'joined'
         ORDER BY fpm.joined_at ASC`,
        [featuredPodId]
      );

      const members = membersResult.rows.map(row => ({
        userId: row.user_id,
        username: row.username,
        joinedAt: row.joined_at,
        hasConfirmedArrival: row.has_confirmed_arrival,
      }));

      const isUserMember = currentUserId
        ? members.some(m => m.userId === currentUserId)
        : false;

      return {
        ...pod,
        members,
        isUserMember,
      };
    } catch (error) {
      logger.error('Error getting featured pod with members:', error);
      throw error;
    }
  }

  /**
   * Get user's joined featured pods
   */
  async getUserFeaturedPods(userId: string): Promise<FeaturedPodWithVenue[]> {
    try {
      const result = await query<FeaturedPodRow & { venue_name: string; venue_type: string | null }>(
        `SELECT
          fp.*,
          v.name as venue_name,
          v.venue_type
         FROM featured_pods fp
         INNER JOIN venues v ON fp.venue_id = v.id
         INNER JOIN featured_pod_members fpm ON fp.id = fpm.featured_pod_id
         WHERE fpm.user_id = $1
           AND fpm.status = 'joined'
           AND fp.status = 'active'
         ORDER BY fp.starts_at ASC`,
        [userId]
      );

      return result.rows.map(row => this.mapRowToFeaturedPodWithVenue(row));
    } catch (error) {
      logger.error('Error getting user featured pods:', error);
      throw error;
    }
  }

  /**
   * Join a featured pod
   */
  async joinFeaturedPod(featuredPodId: string, userId: string): Promise<FeaturedPodMember> {
    try {
      // Check if pod exists and is active
      const pod = await this.getFeaturedPodById(featuredPodId);
      if (!pod) {
        throw new Error('Featured pod not found');
      }

      if (pod.status !== 'active') {
        throw new Error('Featured pod is not active');
      }

      // Check if pod is full
      if (pod.currentCount >= pod.maxCapacity) {
        throw new Error('Featured pod is full');
      }

      // Check if user already joined
      const existingMember = await query<FeaturedPodMemberRow>(
        `SELECT * FROM featured_pod_members
         WHERE featured_pod_id = $1 AND user_id = $2`,
        [featuredPodId, userId]
      );

      if (existingMember.rows.length > 0) {
        const member = existingMember.rows[0];
        if (!member) {
          throw new Error('Unexpected error: member row is undefined');
        }
        if (member.status === 'joined') {
          throw new Error('Already joined this featured pod');
        }
        // If previously left, allow re-joining by updating status
        const updateResult = await query<FeaturedPodMemberRow>(
          `UPDATE featured_pod_members
           SET status = 'joined', joined_at = NOW(), left_at = NULL
           WHERE id = $1
           RETURNING *`,
          [member.id]
        );
        const updatedMember = updateResult.rows[0];
        if (!updatedMember) {
          throw new Error('Failed to update member status');
        }
        return this.mapRowToFeaturedPodMember(updatedMember);
      }

      // Insert new member
      const result = await query<FeaturedPodMemberRow>(
        `INSERT INTO featured_pod_members (featured_pod_id, user_id, status)
         VALUES ($1, $2, 'joined')
         RETURNING *`,
        [featuredPodId, userId]
      );

      const newMemberRow = result.rows[0];
      if (!newMemberRow) {
        throw new Error('Failed to create member');
      }
      const newMember = this.mapRowToFeaturedPodMember(newMemberRow);

      logger.info('User joined featured pod', {
        userId,
        featuredPodId,
        memberId: newMember.id,
      });

      return newMember;
    } catch (error) {
      logger.error('Error joining featured pod:', error);
      throw error;
    }
  }

  /**
   * Leave a featured pod
   */
  async leaveFeaturedPod(featuredPodId: string, userId: string): Promise<void> {
    try {
      const result = await query(
        `UPDATE featured_pod_members
         SET status = 'left', left_at = NOW()
         WHERE featured_pod_id = $1 AND user_id = $2 AND status = 'joined'
         RETURNING id`,
        [featuredPodId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Not a member of this featured pod');
      }

      logger.info('User left featured pod', { userId, featuredPodId });
    } catch (error) {
      logger.error('Error leaving featured pod:', error);
      throw error;
    }
  }

  /**
   * Confirm arrival at featured pod
   */
  async confirmArrival(featuredPodId: string, userId: string): Promise<void> {
    try {
      const result = await query(
        `UPDATE featured_pod_members
         SET has_confirmed_arrival = true, confirmed_at = NOW()
         WHERE featured_pod_id = $1 AND user_id = $2 AND status = 'joined'
         RETURNING id`,
        [featuredPodId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Not a member of this featured pod');
      }

      logger.info('User confirmed arrival at featured pod', { userId, featuredPodId });
    } catch (error) {
      logger.error('Error confirming arrival:', error);
      throw error;
    }
  }

  /**
   * Create featured pod (admin/venue only)
   */
  async createFeaturedPod(data: CreateFeaturedPodRequest): Promise<FeaturedPod> {
    try {
      // Get venue location
      const venueResult = await query<{ location: string; location_name: string; logo_url: string | null }>(
        `SELECT ST_AsText(location) as location, location_name, logo_url FROM venues WHERE id = $1`,
        [data.venueId]
      );

      if (venueResult.rows.length === 0) {
        throw new Error('Venue not found');
      }

      const venue = venueResult.rows[0];
      if (!venue) {
        throw new Error('Venue not found');
      }
      const locationPoint = parsePostGISPoint(venue.location);

      const result = await query<FeaturedPodRow>(
        `INSERT INTO featured_pods (
          venue_id, title, description, category, location, location_name,
          venue_logo_url, image_url, max_capacity, starts_at, expires_at, sponsor_tier
         )
         VALUES (
          $1, $2, $3, $4,
          ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
          $7, $8, $9, $10, $11, $12, $13
         )
         RETURNING *`,
        [
          data.venueId,
          data.title,
          data.description || null,
          data.category,
          locationPoint.longitude,
          locationPoint.latitude,
          venue.location_name,
          venue.logo_url,
          data.imageUrl || null,
          data.maxCapacity || 50,
          data.startsAt,
          data.expiresAt,
          data.sponsorTier || 'featured',
        ]
      );

      const featuredPodRow = result.rows[0];
      if (!featuredPodRow) {
        throw new Error('Failed to create featured pod');
      }
      const featuredPod = this.mapRowToFeaturedPod(featuredPodRow);

      logger.info('Created featured pod', {
        featuredPodId: featuredPod.id,
        venueId: data.venueId,
        title: data.title,
      });

      return featuredPod;
    } catch (error) {
      logger.error('Error creating featured pod:', error);
      throw error;
    }
  }

  /**
   * Update featured pod (admin/venue only)
   */
  async updateFeaturedPod(
    featuredPodId: string,
    data: UpdateFeaturedPodRequest
  ): Promise<FeaturedPod> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.title !== undefined) {
        updates.push(`title = $${paramIndex++}`);
        values.push(data.title);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(data.description);
      }
      if (data.imageUrl !== undefined) {
        updates.push(`image_url = $${paramIndex++}`);
        values.push(data.imageUrl);
      }
      if (data.maxCapacity !== undefined) {
        updates.push(`max_capacity = $${paramIndex++}`);
        values.push(data.maxCapacity);
      }
      if (data.startsAt !== undefined) {
        updates.push(`starts_at = $${paramIndex++}`);
        values.push(data.startsAt);
      }
      if (data.expiresAt !== undefined) {
        updates.push(`expires_at = $${paramIndex++}`);
        values.push(data.expiresAt);
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      updates.push(`updated_at = NOW()`);
      values.push(featuredPodId);

      const result = await query<FeaturedPodRow>(
        `UPDATE featured_pods
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Featured pod not found');
      }

      const updatedRow = result.rows[0];
      if (!updatedRow) {
        throw new Error('Featured pod not found');
      }
      return this.mapRowToFeaturedPod(updatedRow);
    } catch (error) {
      logger.error('Error updating featured pod:', error);
      throw error;
    }
  }

  /**
   * Cancel featured pod
   */
  async cancelFeaturedPod(featuredPodId: string): Promise<void> {
    try {
      await query(
        `UPDATE featured_pods
         SET status = 'cancelled', cancelled_at = NOW()
         WHERE id = $1`,
        [featuredPodId]
      );

      logger.info('Cancelled featured pod', { featuredPodId });
    } catch (error) {
      logger.error('Error cancelling featured pod:', error);
      throw error;
    }
  }

  /**
   * Expire old featured pods (cleanup worker)
   */
  async expireOldFeaturedPods(): Promise<number> {
    try {
      const result = await query(
        `UPDATE featured_pods
         SET status = 'expired'
         WHERE status = 'active' AND expires_at < NOW()
         RETURNING id`
      );

      const count = result.rows.length;
      if (count > 0) {
        logger.info(`Expired ${count} old featured pods`);
      }

      return count;
    } catch (error) {
      logger.error('Error expiring old featured pods:', error);
      throw error;
    }
  }

  // Helper mappers
  private mapRowToFeaturedPod(row: FeaturedPodRow): FeaturedPod {
    const location = parsePostGISPoint(row.location);
    return {
      id: row.id,
      venueId: row.venue_id,
      title: row.title,
      description: row.description || undefined,
      category: row.category,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
      },
      locationName: row.location_name,
      imageUrl: row.image_url || undefined,
      venueLogoUrl: row.venue_logo_url || undefined,
      maxCapacity: row.max_capacity,
      currentCount: row.current_count,
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
      status: row.status as 'active' | 'cancelled' | 'completed' | 'expired',
      isSponsored: row.is_sponsored,
      sponsorTier: row.sponsor_tier as 'featured' | 'premium' | 'boost',
      sharedIntent: row.shared_intent || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      cancelledAt: row.cancelled_at || undefined,
      completedAt: row.completed_at || undefined,
    };
  }

  private mapRowToFeaturedPodWithVenue(
    row: FeaturedPodNearbyRow | (FeaturedPodRow & { venue_name: string; venue_type: string | null })
  ): FeaturedPodWithVenue {
    const pod = this.mapRowToFeaturedPod(row);
    return {
      ...pod,
      venue: {
        name: row.venue_name,
        venueType: row.venue_type || undefined,
        logoUrl: row.venue_logo_url || undefined,
      },
      distanceMiles: 'distance_miles' in row ? row.distance_miles : undefined,
    };
  }

  private mapRowToFeaturedPodMember(row: FeaturedPodMemberRow): FeaturedPodMember {
    return {
      id: row.id,
      featuredPodId: row.featured_pod_id,
      userId: row.user_id,
      status: row.status as 'joined' | 'left' | 'removed',
      hasConfirmedArrival: row.has_confirmed_arrival,
      confirmedAt: row.confirmed_at || undefined,
      joinedAt: row.joined_at,
      leftAt: row.left_at || undefined,
    };
  }
}

export const featuredPodService = new FeaturedPodService();
