import { Router } from 'express';
import { podController } from '../controllers/podController';
import { authenticateToken } from '../middleware/authenticate';

const router = Router();

/**
 * All routes require authentication
 */
router.use(authenticateToken);

/**
 * @route GET /api/v1/pods/active
 * @desc Get user's active pods
 * @access Private
 */
router.get('/active', podController.getActivePods.bind(podController));

/**
 * @route GET /api/v1/pods/stats
 * @desc Get pod statistics
 * @access Private
 */
router.get('/stats', podController.getStats.bind(podController));

/**
 * @route GET /api/v1/pods/:id
 * @desc Get pod details
 * @access Private (pod members only)
 */
router.get('/:id', podController.getPod.bind(podController));

/**
 * @route POST /api/v1/pods/:id/leave
 * @desc Leave a pod
 * @access Private (pod members only)
 */
router.post('/:id/leave', podController.leavePod.bind(podController));

/**
 * @route POST /api/v1/pods/:id/complete
 * @desc Mark pod as completed
 * @access Private (pod members only)
 */
router.post('/:id/complete', podController.completePod.bind(podController));

/**
 * @route POST /api/v1/pods/match/:wannaId
 * @desc Manually trigger matching for a wanna
 * @access Private
 */
router.post('/match/:wannaId', podController.triggerMatch.bind(podController));

export default router;
