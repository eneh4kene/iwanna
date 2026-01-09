import { Response, NextFunction } from 'express';
import { podService } from '../services/podService';
import { matchingService } from '../services/matchingService';
import { chatService } from '../services/chatService';
import { notificationService } from '../services/notificationService';
import { query } from '../services/database';
import { AuthRequest } from '../types';
import { logger } from '../utils/logger';
import { z } from 'zod';

/**
 * Transform pod for API response (rename centroid to location and flatten sharedIntent for mobile app)
 */
function transformPodForAPI(pod: any): any {
  return {
    id: pod.id,
    members: [], // Will be populated separately via getPodMembers if needed
    memberCount: pod.userIds?.length || 0,
    activity: pod.sharedIntent?.activity || 'group activity',
    category: pod.sharedIntent?.category || 'social',
    location: {
      latitude: pod.centroid?.latitude || 0,
      longitude: pod.centroid?.longitude || 0,
    },
    meetingPlaceName: pod.meetingPlaceName || null,
    confirmedUserIds: pod.confirmedUserIds || [],
    showUpCount: pod.showUpCount || 0,
    expiresAt: pod.expiresAt,
    createdAt: pod.createdAt,
    status: pod.status,
  };
}

/**
 * Pod Controller
 * Handles pod-related HTTP requests
 */
export class PodController {
  /**
   * Get user's active pods
   * GET /api/v1/pods/active
   */
  async getActivePods(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const pods = await podService.getUserActivePods(userId);

      // Transform pods for API response
      const transformedPods = pods.map(transformPodForAPI);

      res.json({
        success: true,
        data: {
          pods: transformedPods,
          count: transformedPods.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pod by ID
   * GET /api/v1/pods/:id
   */
  async getPod(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ success: false, error: 'Pod ID required' });
        return;
      }

      const pod = await podService.getPodById(id);

      if (!pod) {
        res.status(404).json({ success: false, error: 'Pod not found' });
        return;
      }

      // Check if user is a member
      if (!pod.userIds.includes(userId)) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      // Get pod members
      const members = await podService.getPodMembers(id);

      // Transform pod for API response and populate members
      const transformedPod = {
        ...transformPodForAPI(pod),
        members: members,
      };

      res.json({
        success: true,
        data: {
          pod: transformedPod,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Leave a pod
   * POST /api/v1/pods/:id/leave
   */
  async leavePod(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ success: false, error: 'Pod ID required' });
        return;
      }

      await podService.leavePod(id, userId);

      logger.info('User left pod', { userId, podId: id });

      res.json({
        success: true,
        message: 'Left pod successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark pod as completed
   * POST /api/v1/pods/:id/complete
   */
  async completePod(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ success: false, error: 'Pod ID required' });
        return;
      }

      await podService.completePod(id, userId);

      logger.info('Pod marked as completed', { userId, podId: id });

      res.json({
        success: true,
        message: 'Pod completed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Trigger matching for a specific wanna (manual matching)
   * POST /api/v1/pods/match/:wannaId
   */
  async triggerMatch(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { wannaId } = req.params;
      if (!wannaId) {
        res.status(400).json({ success: false, error: 'Wanna ID required' });
        return;
      }

      // Form a pod
      const podId = await matchingService.formPod(wannaId);

      if (!podId) {
        res.json({
          success: true,
          message: 'No matches found yet. Keep waiting!',
          data: { matched: false },
        });
        return;
      }

      // Get the pod details
      const pod = await podService.getPodById(podId);
      const members = pod ? await podService.getPodMembers(podId) : [];

      logger.info('Match triggered successfully', {
        userId,
        wannaId,
        podId,
        memberCount: members.length,
      });

      // Transform pod for API response
      const transformedPod = pod ? transformPodForAPI(pod) : null;

      res.json({
        success: true,
        message: 'Matched! Your pod is ready',
        data: {
          matched: true,
          pod: transformedPod,
          members,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pod statistics (admin/debug)
   * GET /api/v1/pods/stats
   */
  async getStats(
    _req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await podService.getPodStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Confirm user arrival at meeting point
   * POST /api/v1/pods/:id/confirm
   */
  async confirmArrival(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ success: false, error: 'Pod ID required' });
        return;
      }

      // Get pod
      const pod = await podService.getPodById(id);
      if (!pod) {
        res.status(404).json({ success: false, error: 'Pod not found' });
        return;
      }

      // Check if user is a member
      if (!pod.userIds.includes(userId)) {
        res.status(403).json({ success: false, error: 'You are not a member of this pod' });
        return;
      }

      // Check if pod is still active
      if (pod.status !== 'forming' && pod.status !== 'active') {
        res.status(400).json({ success: false, error: 'Pod is no longer active' });
        return;
      }

      // Get current confirmed_user_ids
      const currentPodData = await query<{
        confirmed_user_ids: string[];
        show_up_count: number;
      }>(
        'SELECT confirmed_user_ids, show_up_count FROM pods WHERE id = $1',
        [id]
      );

      const currentConfirmed = currentPodData.rows[0]?.confirmed_user_ids || [];

      // Check if already confirmed
      if (currentConfirmed.includes(userId)) {
        res.json({
          success: true,
          message: 'Already confirmed',
          data: {
            confirmed: true,
            confirmedCount: currentConfirmed.length,
            totalCount: pod.userIds.length,
          },
        });
        return;
      }

      // Add user to confirmed list
      const newConfirmed = [...currentConfirmed, userId];
      await query(
        `UPDATE pods
         SET confirmed_user_ids = $1, show_up_count = $2
         WHERE id = $3`,
        [newConfirmed, newConfirmed.length, id]
      );

      // Get username
      const userResult = await query<{ username: string }>(
        'SELECT username FROM users WHERE id = $1',
        [userId]
      );
      const username = userResult.rows[0]?.username || 'Unknown';

      // Send system message
      await chatService.sendSystemMessage(id, `✅ ${username} is here!`);

      // Notify other members via WebSocket
      await notificationService.notifyMemberConfirmed(
        id,
        userId,
        username,
        pod.userIds,
        newConfirmed.length,
        pod.userIds.length
      );

      logger.info('User confirmed arrival', { userId, podId: id });

      res.json({
        success: true,
        message: 'Arrival confirmed',
        data: {
          confirmed: true,
          confirmedCount: newConfirmed.length,
          totalCount: pod.userIds.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Submit post-pod feedback
   * POST /api/v1/pods/:id/feedback
   */
  async submitFeedback(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ success: false, error: 'Pod ID required' });
        return;
      }

      // Validate request body
      const schema = z.object({
        showedUp: z.boolean(),
        rating: z.number().min(1).max(5).optional(),
        comment: z.string().max(200).optional(),
      });

      const { showedUp, rating, comment } = schema.parse(req.body);

      // Get pod
      const pod = await podService.getPodById(id);
      if (!pod) {
        res.status(404).json({ success: false, error: 'Pod not found' });
        return;
      }

      // Check if user was a member
      if (!pod.userIds.includes(userId)) {
        res.status(403).json({ success: false, error: 'You were not a member of this pod' });
        return;
      }

      // Insert or update feedback
      await query(
        `INSERT INTO pod_feedback (pod_id, user_id, showed_up, rating, comment)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (pod_id, user_id)
         DO UPDATE SET showed_up = $3, rating = $4, comment = $5`,
        [id, userId, showedUp, rating || null, comment || null]
      );

      // Update user trust score based on feedback
      if (showedUp) {
        // Reward for showing up
        await query(
          `UPDATE users
           SET trust_score = LEAST(trust_score + 10, 200),
               pods_joined_count = pods_joined_count + 1
           WHERE id = $1`,
          [userId]
        );
      } else {
        // Penalty for not showing up
        await query(
          `UPDATE users
           SET trust_score = GREATEST(trust_score - 15, 0)
           WHERE id = $1`,
          [userId]
        );
      }

      logger.info('Pod feedback submitted', { userId, podId: id, showedUp, rating });

      res.json({
        success: true,
        message: 'Feedback submitted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const podController = new PodController();
