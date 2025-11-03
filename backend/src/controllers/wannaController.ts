import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { wannaService } from '../services/wannaService';
import { authService } from '../services/authService';
import { aiService } from '../services/aiService';
import { matchingWorker } from '../workers/matchingWorker';
import { logger } from '../utils/logger';
import { AuthRequest, AppError } from '../types';

/**
 * Validation schemas
 */
const createWannaSchema = z.object({
  text: z
    .string()
    .min(3, 'Tell us a bit more about what you wanna do')
    .max(200, 'Keep it short and sweet (under 200 characters)'),
  moodEmoji: z.string().optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().positive(),
  }),
});

/**
 * Wanna Controller
 */
export class WannaController {
  /**
   * Create a new wanna
   * POST /api/v1/wannas
   */
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId || !req.user) {
        throw new AppError('Authentication required', 401);
      }

      // Validate input
      const data = createWannaSchema.parse(req.body);

      // Check rate limit
      const rateLimit = await authService.checkRateLimit(req.userId);

      if (!rateLimit.allowed) {
        res.status(429).json({
          success: false,
          error: 'Rate limit reached',
          message:
            req.user.accountTier === 'anonymous'
              ? 'You\'ve reached your daily limit. Upgrade your account to create more wannas!'
              : 'Try again tomorrow!',
          remaining: 0,
          accountTier: req.user.accountTier,
        });
        return;
      }

      // Create wanna
      const result = await wannaService.createWanna({
        userId: req.userId,
        rawInput: data.text,
        moodEmoji: data.moodEmoji,
        location: data.location,
      });

      // Increment rate limit counter
      await authService.incrementWannaCount(req.userId);

      // Trigger immediate matching (non-blocking)
      matchingWorker.triggerImmediateMatch(result.wannaId).catch(err => {
        logger.error('Error in immediate matching', { wannaId: result.wannaId, error: err });
      });

      res.status(201).json({
        success: true,
        wanna: {
          id: result.wannaId,
          intent: result.intent,
          locationName: result.locationName,
          expiresAt: result.expiresAt,
          remaining: rateLimit.remaining - 1,
        },
        message: `Finding your vibe in ${result.locationName}...`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's active wannas
   * GET /api/v1/wannas/active
   */
  async getActive(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Authentication required', 401);
      }

      const wannas = await wannaService.getUserActiveWannas(req.userId);

      res.json({
        success: true,
        wannas: wannas.map(w => ({
          id: w.id,
          text: w.raw_input,
          moodEmoji: w.mood_emoji,
          intent: w.intent,
          locationName: w.location_name,
          status: w.status,
          createdAt: w.created_at,
          expiresAt: w.expires_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel a wanna
   * DELETE /api/v1/wannas/:id
   */
  async cancel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Authentication required', 401);
      }

      const wannaId = req.params['id'];
      if (!wannaId) {
        throw new AppError('Wanna ID is required', 400);
      }

      await wannaService.cancelWanna(wannaId, req.userId);

      res.json({
        success: true,
        message: 'Wanna cancelled',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get autocomplete suggestions
   * GET /api/v1/wannas/suggestions
   */
  async getSuggestions(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = req.query['query'] as string | undefined;

      if (!query || typeof query !== 'string') {
        res.json({ success: true, suggestions: [] });
        return;
      }

      const suggestions = await aiService.getSuggestions(query);

      res.json({
        success: true,
        suggestions,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const wannaController = new WannaController();
