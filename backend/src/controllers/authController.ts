import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService';
import { AuthRequest } from '../types';

/**
 * Validation schemas
 */
const createAccountSchema = z.object({
  isOver18: z.boolean().refine(val => val === true, {
    message: 'Must be 18 or older to use Iwanna',
  }),
  deviceInfo: z.object({
    platform: z.enum(['ios', 'android']),
    osVersion: z.string(),
    appVersion: z.string(),
    deviceModel: z.string().optional(),
  }),
});

const recoverAccountSchema = z.object({
  recoveryPhrase: z
    .string()
    .min(10, 'Recovery phrase too short')
    .max(500, 'Recovery phrase too long'),
  deviceInfo: z.object({
    platform: z.enum(['ios', 'android']),
    osVersion: z.string(),
    appVersion: z.string(),
    deviceModel: z.string().optional(),
  }),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

/**
 * Auth Controller
 */
export class AuthController {
  /**
   * Create Tier 1 anonymous account
   * POST /api/v1/auth/create-anonymous
   */
  async createAnonymous(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = createAccountSchema.parse(req.body);

      const result = await authService.createAnonymousAccount(
        data.deviceInfo,
        data.isOver18
      );

      res.status(201).json({
        success: true,
        userId: result.userId,
        username: result.username,
        token: result.token,
        refreshToken: result.refreshToken,
        recoveryPhrase: result.recoveryPhrase, // SHOW ONCE!
        accountTier: 'anonymous',
        message: 'Account created! Save your recovery phrase safely.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Recover account using recovery phrase
   * POST /api/v1/auth/recover
   */
  async recover(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = recoverAccountSchema.parse(req.body);
      const ipAddress = (req.ip || req.socket.remoteAddress || 'unknown') as string;

      const result = await authService.recoverAccount(
        data.recoveryPhrase,
        ipAddress,
        data.deviceInfo
      );

      res.json({
        success: true,
        userId: result.userId,
        username: result.username,
        token: result.token,
        refreshToken: result.refreshToken,
        message: 'Welcome back! ✨',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   */
  async refresh(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = refreshTokenSchema.parse(req.body);

      const result = await authService.refreshAccessToken(data.refreshToken);

      res.json({
        success: true,
        token: result.token,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout and revoke refresh token
   * POST /api/v1/auth/logout
   */
  async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = refreshTokenSchema.parse(req.body);

      await authService.logout(data.refreshToken);

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user info
   * GET /api/v1/auth/me
   */
  async me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
        return;
      }

      res.json({
        success: true,
        user: {
          id: req.user.id,
          username: req.user.username,
          accountTier: req.user.accountTier,
          trustScore: req.user.trustScore,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check rate limit status
   * GET /api/v1/auth/rate-limit
   */
  async checkRateLimit(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
        return;
      }

      const result = await authService.checkRateLimit(req.userId);

      res.json({
        success: true,
        allowed: result.allowed,
        remaining: result.remaining,
        accountTier: req.user?.accountTier,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
