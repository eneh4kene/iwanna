import { matchingService } from '../services/matchingService';
import { podService } from '../services/podService';
import { logger } from '../utils/logger';

/**
 * Matching Worker
 * Processes wannas and attempts to form pods in the background
 *
 * For MVP (Phase 1D), this is a simple interval-based worker.
 * In production, this should use a proper queue (Bull/BullMQ).
 */
class MatchingWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly intervalMs = 10000; // Process every 10 seconds

  /**
   * Start the matching worker
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Matching worker is already running');
      return;
    }

    logger.info('Starting matching worker', {
      intervalMs: this.intervalMs,
    });

    // Run immediately
    this.processMatching().catch(err => {
      logger.error('Error in initial matching process', { error: err });
    });

    // Then run at intervals
    this.intervalId = setInterval(() => {
      if (!this.isProcessing) {
        this.processMatching().catch(err => {
          logger.error('Error in matching process', { error: err });
        });
      }
    }, this.intervalMs);
  }

  /**
   * Stop the matching worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Matching worker stopped');
    }
  }

  /**
   * Process matching for all active wannas
   * Attempts to form pods from compatible wannas
   */
  private async processMatching(): Promise<void> {
    if (this.isProcessing) {
      logger.debug('Matching already in progress, skipping this cycle');
      return;
    }

    this.isProcessing = true;

    try {
      // Get all active wannas that haven't been matched
      const wannas = await this.getUnmatchedWannas();

      if (wannas.length === 0) {
        logger.debug('No wannas to match');
        this.isProcessing = false;
        return;
      }

      logger.info('Processing matching', { wannaCount: wannas.length });

      let podsFormed = 0;
      const processedWannaIds = new Set<string>();

      // Try to form pods for each wanna
      for (const wanna of wannas) {
        // Skip if already processed in this cycle
        if (processedWannaIds.has(wanna.id)) {
          continue;
        }

        try {
          // Attempt to form a pod
          const podId = await matchingService.formPod(wanna.id);

          if (podId) {
            podsFormed++;

            // Get the pod to mark all wanna IDs as processed
            const pod = await podService.getPodById(podId);
            if (pod) {
              pod.wannaIds.forEach(id => processedWannaIds.add(id));
              logger.info('Pod formed', {
                podId,
                wannaIds: pod.wannaIds,
                userCount: pod.userIds.length,
              });
            }
          }
        } catch (error) {
          logger.error('Error forming pod for wanna', {
            wannaId: wanna.id,
            error,
          });
        }
      }

      if (podsFormed > 0) {
        logger.info('Matching cycle completed', {
          wannasProcessed: wannas.length,
          podsFormed,
        });
      }
    } catch (error) {
      logger.error('Error in matching worker', { error });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get all unmatched wannas
   */
  private async getUnmatchedWannas(): Promise<Array<{ id: string }>> {
    // This would typically come from a queue in production
    // For now, we'll query the database directly
    const { query } = await import('../services/database');

    const result = await query<{ id: string }>(
      `SELECT id
       FROM wannas
       WHERE status = 'active'
         AND created_at > NOW() - INTERVAL '6 hours'
       ORDER BY created_at ASC
       LIMIT 50`,
      []
    );

    return result.rows;
  }

  /**
   * Manually trigger matching for a specific wanna
   * Used when a wanna is first created
   */
  async triggerImmediateMatch(wannaId: string): Promise<string | null> {
    try {
      logger.info('Triggering immediate match', { wannaId });
      const podId = await matchingService.formPod(wannaId);

      if (podId) {
        logger.info('Immediate match successful', { wannaId, podId });
      } else {
        logger.info('No immediate match found', { wannaId });
      }

      return podId;
    } catch (error) {
      logger.error('Error in immediate match', { wannaId, error });
      return null;
    }
  }
}

export const matchingWorker = new MatchingWorker();
