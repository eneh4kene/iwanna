/**
 * Featured Pods Routes
 * API endpoints for featured/sponsored pods
 */

import express from 'express';
import { authenticateToken } from '../middleware/authenticate';
import {
  getFeaturedPodsNearby,
  getFeaturedPodById,
  getMyFeaturedPods,
  joinFeaturedPod,
  leaveFeaturedPod,
  confirmArrival,
  createFeaturedPod,
  updateFeaturedPod,
  cancelFeaturedPod,
} from '../controllers/featuredPodController';

const router = express.Router();

// Public routes (require authentication)
router.get('/nearby', authenticateToken, getFeaturedPodsNearby);
router.get('/my-pods', authenticateToken, getMyFeaturedPods);
router.get('/:id', authenticateToken, getFeaturedPodById);
router.post('/:id/join', authenticateToken, joinFeaturedPod);
router.post('/:id/leave', authenticateToken, leaveFeaturedPod);
router.post('/:id/confirm', authenticateToken, confirmArrival);

// Admin/Venue routes (TODO: Add admin/venue middleware)
router.post('/', authenticateToken, createFeaturedPod);
router.patch('/:id', authenticateToken, updateFeaturedPod);
router.delete('/:id', authenticateToken, cancelFeaturedPod);

export default router;
