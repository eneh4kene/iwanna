import rateLimit from 'express-rate-limit';
import { rateLimitConfig } from '../config';
import { logger } from '../utils/logger';

/**
 * Global rate limiter for all API endpoints
 */
export const globalRateLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.maxRequests,
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Please slow down and try again in a few minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: 'Please slow down and try again in a few minutes',
    });
  },
});

/**
 * Strict rate limiter for sensitive endpoints (auth, etc.)
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: {
    success: false,
    error: 'Too many attempts',
    message: 'Please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed requests
});
