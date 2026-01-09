/**
 * Featured Pod Controller
 * HTTP handlers for featured pods API
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { featuredPodService } from '../services/featuredPodService';
import { logger } from '../utils/logger';
import { AuthRequest } from '../types';

// Validation schemas
const getFeaturedPodsNearbySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  maxDistanceMiles: z.number().min(1).max(100).optional(),
  limit: z.number().min(1).max(50).optional(),
});

const createFeaturedPodSchema = z.object({
  venueId: z.string().uuid(),
  title: z.string().min(3).max(255),
  description: z.string().max(1000).optional(),
  category: z.string().min(2).max(50),
  imageUrl: z.string().url().optional(),
  maxCapacity: z.number().min(1).max(500).optional(),
  startsAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  sponsorTier: z.enum(['featured', 'premium', 'boost']).optional(),
});

const updateFeaturedPodSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
  maxCapacity: z.number().min(1).max(500).optional(),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

/**
 * GET /api/v1/featured-pods/nearby
 * Get featured pods near user's location
 */
export const getFeaturedPodsNearby = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { latitude, longitude, maxDistanceMiles, limit } = getFeaturedPodsNearbySchema.parse({
      latitude: parseFloat(req.query['latitude'] as string),
      longitude: parseFloat(req.query['longitude'] as string),
      maxDistanceMiles: req.query['maxDistanceMiles']
        ? parseInt(req.query['maxDistanceMiles'] as string)
        : undefined,
      limit: req.query['limit'] ? parseInt(req.query['limit'] as string) : undefined,
    });

    const featuredPods = await featuredPodService.getFeaturedPodsNearby(
      latitude,
      longitude,
      maxDistanceMiles || 10,
      limit || 10
    );

    res.json({
      success: true,
      data: featuredPods,
      count: featuredPods.length,
    });
  } catch (error) {
    logger.error('Error in getFeaturedPodsNearby:', error);
    next(error);
  }
};

/**
 * GET /api/v1/featured-pods/:id
 * Get featured pod details
 */
export const getFeaturedPodById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'Pod ID is required' });
      return;
    }
    const userId = req.user!.id;

    const featuredPod = await featuredPodService.getFeaturedPodWithMembers(id, userId);

    if (!featuredPod) {
      res.status(404).json({
        success: false,
        error: 'Featured pod not found',
      });
      return;
    }

    res.json({
      success: true,
      data: featuredPod,
    });
  } catch (error) {
    logger.error('Error in getFeaturedPodById:', error);
    next(error);
  }
};

/**
 * GET /api/v1/featured-pods/my-pods
 * Get user's joined featured pods
 */
export const getMyFeaturedPods = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;

    const featuredPods = await featuredPodService.getUserFeaturedPods(userId);

    res.json({
      success: true,
      data: featuredPods,
      count: featuredPods.length,
    });
  } catch (error) {
    logger.error('Error in getMyFeaturedPods:', error);
    next(error);
  }
};

/**
 * POST /api/v1/featured-pods/:id/join
 * Join a featured pod
 */
export const joinFeaturedPod = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'Pod ID is required' });
      return;
    }
    const userId = req.user!.id;

    const member = await featuredPodService.joinFeaturedPod(id, userId);
    const featuredPod = await featuredPodService.getFeaturedPodWithMembers(id, userId);

    res.status(201).json({
      success: true,
      data: {
        featuredPod,
        member,
      },
    });
  } catch (error: any) {
    if (error.message === 'Featured pod not found') {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    if (
      error.message === 'Already joined this featured pod' ||
      error.message === 'Featured pod is full' ||
      error.message === 'Featured pod is not active'
    ) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    logger.error('Error in joinFeaturedPod:', error);
    next(error);
  }
};

/**
 * POST /api/v1/featured-pods/:id/leave
 * Leave a featured pod
 */
export const leaveFeaturedPod = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'Pod ID is required' });
      return;
    }
    const userId = req.user!.id;

    await featuredPodService.leaveFeaturedPod(id, userId);

    res.json({
      success: true,
      message: 'Left featured pod successfully',
    });
  } catch (error: any) {
    if (error.message === 'Not a member of this featured pod') {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    logger.error('Error in leaveFeaturedPod:', error);
    next(error);
  }
};

/**
 * POST /api/v1/featured-pods/:id/confirm
 * Confirm arrival at featured pod
 */
export const confirmArrival = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'Pod ID is required' });
      return;
    }
    const userId = req.user!.id;

    await featuredPodService.confirmArrival(id, userId);

    res.json({
      success: true,
      message: 'Arrival confirmed successfully',
    });
  } catch (error: any) {
    if (error.message === 'Not a member of this featured pod') {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    logger.error('Error in confirmArrival:', error);
    next(error);
  }
};

/**
 * POST /api/v1/featured-pods (Admin/Venue only)
 * Create a new featured pod
 */
export const createFeaturedPod = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = createFeaturedPodSchema.parse(req.body);

    const featuredPod = await featuredPodService.createFeaturedPod({
      ...data,
      description: data.description ?? undefined,
      imageUrl: data.imageUrl ?? undefined,
      maxCapacity: data.maxCapacity ?? undefined,
      sponsorTier: data.sponsorTier ?? undefined,
    });

    res.status(201).json({
      success: true,
      data: featuredPod,
    });
  } catch (error) {
    logger.error('Error in createFeaturedPod:', error);
    next(error);
  }
};

/**
 * PATCH /api/v1/featured-pods/:id (Admin/Venue only)
 * Update featured pod
 */
export const updateFeaturedPod = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'Pod ID is required' });
      return;
    }
    const data = updateFeaturedPodSchema.parse(req.body);

    const featuredPod = await featuredPodService.updateFeaturedPod(id, {
      ...data,
      title: data.title ?? undefined,
      description: data.description ?? undefined,
      imageUrl: data.imageUrl ?? undefined,
      maxCapacity: data.maxCapacity ?? undefined,
      startsAt: data.startsAt ?? undefined,
      expiresAt: data.expiresAt ?? undefined,
    });

    res.json({
      success: true,
      data: featuredPod,
    });
  } catch (error: any) {
    if (error.message === 'Featured pod not found') {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    logger.error('Error in updateFeaturedPod:', error);
    next(error);
  }
};

/**
 * DELETE /api/v1/featured-pods/:id (Admin/Venue only)
 * Cancel featured pod
 */
export const cancelFeaturedPod = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'Pod ID is required' });
      return;
    }

    await featuredPodService.cancelFeaturedPod(id);

    res.json({
      success: true,
      message: 'Featured pod cancelled successfully',
    });
  } catch (error) {
    logger.error('Error in cancelFeaturedPod:', error);
    next(error);
  }
};
