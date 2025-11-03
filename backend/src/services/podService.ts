import { query } from './database';
import { notificationService } from './notificationService';
import { logger } from '../utils/logger';
import { AppError, Intent } from '../types';

/**
 * Pod details
 */
export interface Pod {
  id: string;
  wannaIds: string[];
  userIds: string[];
  centroid: {
    latitude: number;
    longitude: number;
  };
  sharedIntent: Partial<Intent>;
  status: 'forming' | 'active' | 'completed' | 'expired';
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Pod member info
 */
export interface PodMember {
  userId: string;
  username: string;
  joinedAt: Date;
}

/**
 * Pod Service
 * Manages pod lifecycle and member operations
 */
class PodService {
  /**
   * Get pod by ID
   */
  async getPodById(podId: string): Promise<Pod | null> {
    const result = await query<{
      id: string;
      wanna_ids: string[];
      user_ids: string[];
      latitude: number;
      longitude: number;
      shared_intent: Partial<Intent>;
      status: 'forming' | 'active' | 'completed' | 'expired';
      expires_at: Date;
      created_at: Date;
    }>(
      `SELECT
        id, wanna_ids, user_ids, shared_intent, status, expires_at, created_at,
        ST_Y(centroid_location::geometry) as latitude,
        ST_X(centroid_location::geometry) as longitude
      FROM pods
      WHERE id = $1`,
      [podId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      wannaIds: row.wanna_ids,
      userIds: row.user_ids,
      centroid: {
        latitude: row.latitude,
        longitude: row.longitude,
      },
      sharedIntent: row.shared_intent,
      status: row.status,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }

  /**
   * Get user's active pods
   */
  async getUserActivePods(userId: string): Promise<Pod[]> {
    const result = await query<{
      id: string;
      wanna_ids: string[];
      user_ids: string[];
      latitude: number;
      longitude: number;
      shared_intent: Partial<Intent>;
      status: 'forming' | 'active' | 'completed' | 'expired';
      expires_at: Date;
      created_at: Date;
    }>(
      `SELECT
        id, wanna_ids, user_ids, shared_intent, status, expires_at, created_at,
        ST_Y(centroid_location::geometry) as latitude,
        ST_X(centroid_location::geometry) as longitude
      FROM pods
      WHERE $1 = ANY(user_ids)
        AND status IN ('forming', 'active')
      ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      id: row.id,
      wannaIds: row.wanna_ids,
      userIds: row.user_ids,
      centroid: {
        latitude: row.latitude,
        longitude: row.longitude,
      },
      sharedIntent: row.shared_intent,
      status: row.status,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get pod members with usernames
   */
  async getPodMembers(podId: string): Promise<PodMember[]> {
    const pod = await this.getPodById(podId);
    if (!pod) {
      throw new AppError('Pod not found', 404);
    }

    const result = await query<{
      id: string;
      username: string;
    }>(
      `SELECT id, username
       FROM users
       WHERE id = ANY($1)`,
      [pod.userIds]
    );

    return result.rows.map(row => ({
      userId: row.id,
      username: row.username,
      joinedAt: pod.createdAt, // All members join at pod creation
    }));
  }

  /**
   * Leave a pod
   */
  async leavePod(podId: string, userId: string): Promise<void> {
    const pod = await this.getPodById(podId);
    if (!pod) {
      throw new AppError('Pod not found', 404);
    }

    if (!pod.userIds.includes(userId)) {
      throw new AppError('You are not a member of this pod', 403);
    }

    if (pod.status === 'completed' || pod.status === 'expired') {
      throw new AppError('Pod has already ended', 400);
    }

    // Remove user from pod
    const updatedUserIds = pod.userIds.filter(id => id !== userId);

    // Get leaving user's username
    const userResult = await query<{ username: string }>(
      'SELECT username FROM users WHERE id = $1',
      [userId]
    );
    const username = userResult.rows[0]?.username || 'Unknown';

    // If pod becomes empty or too small, mark as expired
    if (updatedUserIds.length < 2) {
      await query(
        `UPDATE pods
         SET status = 'expired', user_ids = $1
         WHERE id = $2`,
        [updatedUserIds, podId]
      );

      logger.info('Pod expired after user left', { podId, userId, remainingUsers: updatedUserIds.length });

      // Notify remaining members that pod expired
      if (updatedUserIds.length > 0) {
        await notificationService.notifyPodExpired(podId, updatedUserIds).catch(err => {
          logger.error('Failed to send pod expired notification', { podId, error: err });
        });
      }
    } else {
      await query(
        `UPDATE pods
         SET user_ids = $1
         WHERE id = $2`,
        [updatedUserIds, podId]
      );

      logger.info('User left pod', { podId, userId, remainingUsers: updatedUserIds.length });

      // Notify remaining members
      await notificationService.notifyMemberLeft(podId, userId, username, updatedUserIds).catch(err => {
        logger.error('Failed to send member left notification', { podId, error: err });
      });
    }
  }

  /**
   * Mark pod as completed (successful meetup)
   */
  async completePod(podId: string, userId: string): Promise<void> {
    const pod = await this.getPodById(podId);
    if (!pod) {
      throw new AppError('Pod not found', 404);
    }

    if (!pod.userIds.includes(userId)) {
      throw new AppError('You are not a member of this pod', 403);
    }

    if (pod.status === 'completed') {
      throw new AppError('Pod is already completed', 400);
    }

    await query(
      `UPDATE pods
       SET status = 'completed'
       WHERE id = $1`,
      [podId]
    );

    logger.info('Pod marked as completed', { podId, userId });

    // Notify all members
    await notificationService.notifyPodCompleted(podId, pod.userIds, userId).catch(err => {
      logger.error('Failed to send pod completed notification', { podId, error: err });
    });
  }

  /**
   * Check if user is in any active pod
   */
  async isUserInActivePod(userId: string): Promise<boolean> {
    const result = await query<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM pods
       WHERE $1 = ANY(user_ids)
         AND status IN ('forming', 'active')`,
      [userId]
    );

    return (result.rows[0]?.count || 0) > 0;
  }

  /**
   * Clean up expired pods (should be run as cron job)
   */
  async cleanupExpiredPods(): Promise<number> {
    const result = await query(
      `UPDATE pods
       SET status = 'expired'
       WHERE status IN ('forming', 'active')
         AND expires_at < NOW()`
    );

    const count = result.rowCount;

    if (count > 0) {
      logger.info(`Cleaned up ${count} expired pods`);
    }

    return count;
  }

  /**
   * Get pod statistics (for debugging/admin)
   */
  async getPodStats(): Promise<{
    total: number;
    active: number;
    completed: number;
    expired: number;
  }> {
    const result = await query<{
      status: string;
      count: number;
    }>(
      `SELECT status, COUNT(*) as count
       FROM pods
       GROUP BY status`
    );

    const stats = {
      total: 0,
      active: 0,
      completed: 0,
      expired: 0,
    };

    result.rows.forEach(row => {
      const count = Number(row.count);
      stats.total += count;

      if (row.status === 'active' || row.status === 'forming') {
        stats.active += count;
      } else if (row.status === 'completed') {
        stats.completed += count;
      } else if (row.status === 'expired') {
        stats.expired += count;
      }
    });

    return stats;
  }
}

export const podService = new PodService();
