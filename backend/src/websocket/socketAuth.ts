import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config';
import { logger } from '../utils/logger';

/**
 * Extended Socket interface with user information
 */
export interface AuthenticatedSocket extends Socket {
  userId: string;
  username?: string;
}

/**
 * JWT payload structure
 */
interface JWTPayload {
  userId: string;
  username: string;
  accountTier: string;
}

/**
 * WebSocket authentication middleware
 * Verifies JWT token and attaches user info to socket
 */
export const socketAuthMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> => {
  try {
    // Get token from handshake auth or query
    const token =
      socket.handshake.auth['token'] ||
      socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      logger.warn('WebSocket connection attempted without token', {
        socketId: socket.id,
      });
      return next(new Error('Authentication token required'));
    }

    // Verify JWT token
    const decoded = jwt.verify(token, jwtConfig.accessSecret) as JWTPayload;

    // Attach user info to socket
    (socket as AuthenticatedSocket).userId = decoded.userId;
    (socket as AuthenticatedSocket).username = decoded.username;

    logger.info('WebSocket authenticated', {
      socketId: socket.id,
      userId: decoded.userId,
      username: decoded.username,
    });

    next();
  } catch (error) {
    logger.error('WebSocket authentication failed', {
      socketId: socket.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (error instanceof jwt.JsonWebTokenError) {
      return next(new Error('Invalid authentication token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      return next(new Error('Authentication token expired'));
    }

    return next(new Error('Authentication failed'));
  }
};
