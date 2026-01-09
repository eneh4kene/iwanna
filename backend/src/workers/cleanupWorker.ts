import { query } from '../services/database';
import { geo } from '../services/redis';
import { logger } from '../utils/logger';

/**
 * Cleanup Worker
 * Periodically cleans up expired wannas and pods
 */
class CleanupWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly intervalMs = 60000; // Run every 1 minute

  /**
   * Start the cleanup worker
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Cleanup worker is already running');
      return;
    }

    logger.info('Starting cleanup worker', {
      intervalMs: this.intervalMs,
    });

    // Run immediately
    this.runCleanup().catch(err => {
      logger.error('Error in initial cleanup', { error: err });
    });

    // Then run at intervals
    this.intervalId = setInterval(() => {
      this.runCleanup().catch(err => {
        logger.error('Error in cleanup process', { error: err });
      });
    }, this.intervalMs);
  }

  /**
   * Stop the cleanup worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Cleanup worker stopped');
    }
  }

  /**
   * Run cleanup tasks
   */
  private async runCleanup(): Promise<void> {
    try {
      await this.expireOldWannas();
      await this.expireOldPods();
      await this.expireOldFeaturedPods();
    } catch (error) {
      logger.error('Error in cleanup worker', { error });
    }
  }

  /**
   * Expire old wannas
   */
  private async expireOldWannas(): Promise<void> {
    // Get all wannas that are past their expiry time
    const result = await query<{ id: string }>(
      `SELECT id
       FROM wannas
       WHERE status = 'active'
         AND expires_at <= NOW()`,
      []
    );

    if (result.rows.length === 0) {
      return;
    }

    const wannaIds = result.rows.map(row => row.id);

    // Mark as expired
    await query(
      `UPDATE wannas
       SET status = 'expired'
       WHERE id = ANY($1)`,
      [wannaIds]
    );

    // Remove from Redis geospatial index
    for (const wannaId of wannaIds) {
      try {
        await geo.remove('active_wannas', wannaId);
      } catch (error) {
        logger.error('Error removing wanna from Redis', {
          wannaId,
          error,
        });
      }
    }

    logger.info('Expired old wannas', {
      count: wannaIds.length,
      wannaIds: wannaIds.slice(0, 10), // Log first 10
    });
  }

  /**
   * Expire old pods
   */
  private async expireOldPods(): Promise<void> {
    // Get all pods that are past their expiry time
    const result = await query<{ id: string }>(
      `SELECT id
       FROM pods
       WHERE status IN ('forming', 'active')
         AND expires_at <= NOW()`,
      []
    );

    if (result.rows.length === 0) {
      return;
    }

    const podIds = result.rows.map(row => row.id);

    // Mark as expired
    await query(
      `UPDATE pods
       SET status = 'expired'
       WHERE id = ANY($1)`,
      [podIds]
    );

    logger.info('Expired old pods', {
      count: podIds.length,
      podIds: podIds.slice(0, 10), // Log first 10
    });
  }

  /**
   * Expire old featured pods
   */
  private async expireOldFeaturedPods(): Promise<void> {
    // Get all featured pods that are past their expiry time
    const result = await query<{ id: string }>(
      `SELECT id
       FROM featured_pods
       WHERE status = 'active'
         AND expires_at <= NOW()`,
      []
    );

    if (result.rows.length === 0) {
      return;
    }

    const featuredPodIds = result.rows.map(row => row.id);

    // Mark as expired
    await query(
      `UPDATE featured_pods
       SET status = 'expired'
       WHERE id = ANY($1)`,
      [featuredPodIds]
    );

    logger.info('Expired old featured pods', {
      count: featuredPodIds.length,
      featuredPodIds: featuredPodIds.slice(0, 10), // Log first 10
    });
  }
}

export const cleanupWorker = new CleanupWorker();
