/**
 * @vibe Tools Bootstrap
 *
 * Initializes and registers all @vibe tools on server startup
 */

import { vibeToolRegistry } from './vibeToolRegistry';
import { PlaceFinderTool } from './tools/PlaceFinderTool';
import { MeetingPointTool } from './tools/MeetingPointTool';
import { logger } from '../../utils/logger';

/**
 * Initialize @vibe tools system
 * Registers all available tools and starts health checks
 */
export async function initializeVibeTools(): Promise<void> {
  try {
    logger.info('[VibeTools] Initializing @vibe tools system...');

    // Register tools
    const placeFinderTool = new PlaceFinderTool();
    const meetingPointTool = new MeetingPointTool();

    vibeToolRegistry.register(placeFinderTool);
    vibeToolRegistry.register(meetingPointTool);

    logger.info('[VibeTools] Registered tools', {
      tools: vibeToolRegistry.getAllTools().map(t => t.name),
    });

    // Run initial health checks
    await vibeToolRegistry.runHealthChecks();

    // Start periodic health checks (every 5 minutes)
    vibeToolRegistry.startHealthChecks(5 * 60 * 1000);

    logger.info('[VibeTools] ✅ @vibe tools system initialized successfully');
  } catch (error) {
    logger.error('[VibeTools] Failed to initialize @vibe tools system', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Don't throw - let server start even if tools fail to initialize
  }
}

/**
 * Shutdown @vibe tools system
 * Stops health checks and cleans up resources
 */
export function shutdownVibeTools(): void {
  try {
    logger.info('[VibeTools] Shutting down @vibe tools system...');
    vibeToolRegistry.stopHealthChecks();
    logger.info('[VibeTools] ✅ @vibe tools system shut down successfully');
  } catch (error) {
    logger.error('[VibeTools] Error shutting down @vibe tools system', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
