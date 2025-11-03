import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config';
import { query } from '../services/database';
import { logger } from '../utils/logger';
import { AuthRequest, AuthenticatedUser, AppError } from '../types';

/**
 * JWT payload interface
 */
interface JwtPayload {
  userId: string;
  accountTier: 'anonymous' | 'email' | 'authenticated';
  type: 'access' | 'refresh';
}

/**
 * Authenticate JWT token middleware
 */
export const authenticateToken = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      throw new AppError('Authentication required', 401);
    }

    // Verify token
    const decoded = jwt.verify(token, jwtConfig.accessSecret) as JwtPayload;

    if (decoded.type !== 'access') {
      throw new AppError('Invalid token type', 403);
    }

    // Load user from database
    const result = await query<{
      id: string;
      username: string;
      account_tier: 'anonymous' | 'email' | 'authenticated';
      trust_score: number;
      is_banned: boolean;
      ban_reason: string | null;
      wannas_today: number;
      last_active_at: Date;
    }>(
      `SELECT id, username, account_tier, trust_score, is_banned, ban_reason,
              wannas_today, last_active_at
       FROM users
       WHERE id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 401);
    }

    const user = result.rows[0];
    if (!user) {
      throw new AppError('User not found', 401);
    }

    if (user.is_banned) {
      throw new AppError(
        user.ban_reason || 'Your account has been suspended',
        403
      );
    }

    // Attach user to request
    req.user = {
      id: user.id,
      username: user.username,
      accountTier: user.account_tier,
      trustScore: user.trust_score,
      isBanned: user.is_banned,
      wannasToday: user.wannas_today,
      lastActiveAt: user.last_active_at,
    };
    req.userId = user.id;

    // Update last active timestamp (fire and forget)
    query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [user.id]).catch(
      (err) => logger.error('Failed to update last_active_at', err)
    );

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, jwtConfig.accessSecret) as JwtPayload;

    if (decoded.type === 'access') {
      const result = await query<AuthenticatedUser>(
        'SELECT id, username, account_tier, trust_score, is_banned FROM users WHERE id = $1',
        [decoded.userId]
      );

      const user = result.rows[0];
      if (user && !user.isBanned) {
        req.user = user;
        req.userId = user.id;
      }
    }

    next();
  } catch (error) {
    // Silent fail - just continue without auth
    next();
  }
};
