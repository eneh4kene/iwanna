import { Router, Request, Response } from 'express';
import { checkDatabaseHealth } from '../services/database';
import { checkRedisHealth } from '../services/redis';
import authRoutes from './auth';
import wannaRoutes from './wannas';
import podRoutes from './pods';
import featuredPodRoutes from './featuredPods';

const router = Router();

/**
 * Health check endpoint
 */
router.get('/health', async (_req: Request, res: Response) => {
  const dbHealthy = await checkDatabaseHealth();
  const redisHealthy = await checkRedisHealth();

  const healthy = dbHealthy && redisHealthy;

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? 'healthy' : 'unhealthy',
    services: {
      database: dbHealthy ? 'ok' : 'error',
      redis: redisHealthy ? 'ok' : 'error',
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * API version info
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    name: 'Iwanna API',
    version: 'v1',
    message: 'Connect through moments of impulse, curiosity, and shared energy ✨',
    endpoints: {
      auth: '/api/v1/auth',
      wannas: '/api/v1/wannas',
      pods: '/api/v1/pods',
      featuredPods: '/api/v1/featured-pods',
      health: '/api/v1/health',
    },
  });
});

/**
 * Register feature routes
 */
router.use('/auth', authRoutes);
router.use('/wannas', wannaRoutes);
router.use('/pods', podRoutes);
router.use('/featured-pods', featuredPodRoutes);

export default router;
