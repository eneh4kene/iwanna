import { vibeTriggerService } from '../services/vibeTriggerService';
import { logger } from '../utils/logger';

/**
 * @vibe Background Worker
 * Processes @vibe triggers for all active pods every 30 seconds
 *
 * Checks for:
 * - Ice breaker messages (30s after pod formation, if no messages)
 * - Pre-meetup reminders (15 min before expiry)
 */

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

const INTERVAL_MS = 30 * 1000; // 30 seconds

/**
 * Start the @vibe worker
 */
export function startVibeWorker(): void {
  if (isRunning) {
    logger.warn('@vibe worker already running');
    return;
  }

  logger.info('@vibe worker starting...');
  isRunning = true;

  // Run immediately on start
  processVibeTriggers().catch(err => {
    logger.error('@vibe worker initial run failed:', err);
  });

  // Then run every 30 seconds
  intervalId = setInterval(() => {
    processVibeTriggers().catch(err => {
      logger.error('@vibe worker interval run failed:', err);
    });
  }, INTERVAL_MS);

  logger.info(`@vibe worker started (interval: ${INTERVAL_MS / 1000}s)`);
}

/**
 * Stop the @vibe worker
 */
export function stopVibeWorker(): void {
  if (!isRunning) {
    logger.warn('@vibe worker not running');
    return;
  }

  logger.info('@vibe worker stopping...');

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  isRunning = false;
  logger.info('@vibe worker stopped');
}

/**
 * Process @vibe triggers for all active pods
 */
async function processVibeTriggers(): Promise<void> {
  try {
    await vibeTriggerService.processAllActivePods();
  } catch (error) {
    logger.error('Error in @vibe worker:', error);
    // Don't throw - worker should continue running
  }
}

/**
 * Check if worker is running
 */
export function isVibeWorkerRunning(): boolean {
  return isRunning;
}
