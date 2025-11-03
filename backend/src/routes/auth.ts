import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticateToken } from '../middleware/authenticate';
import { strictRateLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * Authentication routes
 */

// Create anonymous account (Tier 1)
router.post('/create-anonymous', strictRateLimiter, authController.createAnonymous.bind(authController));

// Recover account with recovery phrase
router.post('/recover', strictRateLimiter, authController.recover.bind(authController));

// Refresh access token
router.post('/refresh', authController.refresh.bind(authController));

// Logout
router.post('/logout', authController.logout.bind(authController));

// Get current user (requires auth)
router.get('/me', authenticateToken, authController.me.bind(authController));

// Check rate limit status (requires auth)
router.get('/rate-limit', authenticateToken, authController.checkRateLimit.bind(authController));

export default router;
