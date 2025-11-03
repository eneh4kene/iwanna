import { Response, NextFunction } from 'express';
import { podService } from '../services/podService';
import { matchingService } from '../services/matchingService';
import { AuthRequest } from '../types';
import { logger } from '../utils/logger';

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

      res.json({
        success: true,
        data: {
          pods,
          count: pods.length,
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

      res.json({
        success: true,
        data: {
          pod,
          members,
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

      res.json({
        success: true,
        message: 'Matched! Your pod is ready',
        data: {
          matched: true,
          pod,
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
}

export const podController = new PodController();
