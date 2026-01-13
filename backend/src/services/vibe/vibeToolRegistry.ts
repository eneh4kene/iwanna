/**
 * Vibe Tool Registry
 *
 * Central registry for managing all @vibe tools:
 * - Tool registration and discovery
 * - Health checks
 * - Enable/disable tools dynamically
 * - Generate OpenAI function definitions
 */

import { logger } from '../../utils/logger';
import {
  VibeTool,
  ToolRegistration,
  OpenAIFunctionDefinition,
  ToolRegistryEvent,
} from './types';
import { EventEmitter } from 'events';

export class VibeToolRegistry extends EventEmitter {
  private tools: Map<string, ToolRegistration> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  /**
   * Register a new tool
   */
  register(tool: VibeTool): void {
    // Check if tool already registered
    if (this.tools.has(tool.name)) {
      logger.warn(`[VibeToolRegistry] Tool ${tool.name} is already registered, replacing`, {
        oldVersion: this.tools.get(tool.name)?.version,
        newVersion: tool.version,
      });
    }

    // Create registration
    const registration: ToolRegistration = {
      tool,
      version: tool.version,
      enabled: true,
      registeredAt: new Date(),
    };

    this.tools.set(tool.name, registration);

    logger.info(`[VibeToolRegistry] Tool registered: ${tool.name}`, {
      version: tool.version,
      description: tool.description,
    });

    // Emit event
    this.emit('tool_registered', {
      type: 'tool_registered',
      toolName: tool.name,
      version: tool.version,
    } as ToolRegistryEvent);
  }

  /**
   * Unregister a tool
   */
  unregister(toolName: string): boolean {
    const registration = this.tools.get(toolName);
    if (!registration) {
      logger.warn(`[VibeToolRegistry] Attempted to unregister unknown tool: ${toolName}`);
      return false;
    }

    this.tools.delete(toolName);

    logger.info(`[VibeToolRegistry] Tool unregistered: ${toolName}`);

    // Emit event
    this.emit('tool_unregistered', {
      type: 'tool_unregistered',
      toolName,
    } as ToolRegistryEvent);

    return true;
  }

  /**
   * Get a registered tool by name
   */
  getTool(toolName: string): VibeTool | undefined {
    const registration = this.tools.get(toolName);
    return registration?.enabled ? registration.tool : undefined;
  }

  /**
   * Get all registered tools
   */
  getAllTools(): VibeTool[] {
    return Array.from(this.tools.values())
      .filter((reg) => reg.enabled)
      .map((reg) => reg.tool);
  }

  /**
   * Get all tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys()).filter((name) => this.tools.get(name)?.enabled);
  }

  /**
   * Enable a tool
   */
  enableTool(toolName: string): boolean {
    const registration = this.tools.get(toolName);
    if (!registration) {
      logger.warn(`[VibeToolRegistry] Attempted to enable unknown tool: ${toolName}`);
      return false;
    }

    registration.enabled = true;

    logger.info(`[VibeToolRegistry] Tool enabled: ${toolName}`);

    // Emit event
    this.emit('tool_enabled', {
      type: 'tool_enabled',
      toolName,
    } as ToolRegistryEvent);

    return true;
  }

  /**
   * Disable a tool
   */
  disableTool(toolName: string): boolean {
    const registration = this.tools.get(toolName);
    if (!registration) {
      logger.warn(`[VibeToolRegistry] Attempted to disable unknown tool: ${toolName}`);
      return false;
    }

    registration.enabled = false;

    logger.info(`[VibeToolRegistry] Tool disabled: ${toolName}`);

    // Emit event
    this.emit('tool_disabled', {
      type: 'tool_disabled',
      toolName,
    } as ToolRegistryEvent);

    return true;
  }

  /**
   * Check if a tool is enabled
   */
  isToolEnabled(toolName: string): boolean {
    return this.tools.get(toolName)?.enabled ?? false;
  }

  /**
   * Get OpenAI function definitions for all enabled tools
   * Used when calling OpenAI with function calling
   */
  getFunctionDefinitions(): OpenAIFunctionDefinition[] {
    return this.getAllTools().map((tool) => tool.getFunctionDefinition());
  }

  /**
   * Get tool by function name (for OpenAI function calling responses)
   */
  getToolByFunctionName(functionName: string): VibeTool | undefined {
    // Function name should match tool name
    return this.getTool(functionName);
  }

  /**
   * Run health checks on all tools
   * Disables tools that fail health checks
   */
  async runHealthChecks(): Promise<void> {
    logger.info('[VibeToolRegistry] Running health checks on all tools');

    const healthCheckPromises = Array.from(this.tools.entries()).map(
      async ([toolName, registration]) => {
        if (!registration.enabled) {
          return; // Skip disabled tools
        }

        try {
          const isAvailable = await registration.tool.isAvailable();

          if (!isAvailable) {
            logger.warn(`[VibeToolRegistry] Tool ${toolName} failed health check, disabling`, {
              version: registration.version,
            });

            registration.enabled = false;

            // Emit event
            this.emit('tool_health_check_failed', {
              type: 'tool_health_check_failed',
              toolName,
              error: 'Health check returned false',
            } as ToolRegistryEvent);
          }
        } catch (error) {
          logger.error(`[VibeToolRegistry] Tool ${toolName} health check threw error, disabling`, {
            version: registration.version,
            error: error instanceof Error ? error.message : String(error),
          });

          registration.enabled = false;

          // Emit event
          this.emit('tool_health_check_failed', {
            type: 'tool_health_check_failed',
            toolName,
            error: error instanceof Error ? error.message : 'Unknown error',
          } as ToolRegistryEvent);
        }
      }
    );

    await Promise.all(healthCheckPromises);

    logger.info('[VibeToolRegistry] Health checks completed', {
      totalTools: this.tools.size,
      enabledTools: this.getAllTools().length,
    });
  }

  /**
   * Start periodic health checks
   * Runs every 5 minutes
   */
  startHealthChecks(intervalMs: number = 5 * 60 * 1000): void {
    if (this.healthCheckInterval) {
      logger.warn('[VibeToolRegistry] Health checks already running');
      return;
    }

    logger.info('[VibeToolRegistry] Starting periodic health checks', {
      intervalMs,
    });

    // Run immediately
    this.runHealthChecks().catch((error) => {
      logger.error('[VibeToolRegistry] Initial health check failed', { error });
    });

    // Then run periodically
    this.healthCheckInterval = setInterval(() => {
      this.runHealthChecks().catch((error) => {
        logger.error('[VibeToolRegistry] Periodic health check failed', { error });
      });
    }, intervalMs);
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('[VibeToolRegistry] Stopped periodic health checks');
    }
  }

  /**
   * Get registry stats
   */
  getStats(): {
    totalTools: number;
    enabledTools: number;
    disabledTools: number;
    tools: Array<{
      name: string;
      version: string;
      enabled: boolean;
      registeredAt: Date;
    }>;
  } {
    const tools = Array.from(this.tools.entries()).map(([name, reg]) => ({
      name,
      version: reg.version,
      enabled: reg.enabled,
      registeredAt: reg.registeredAt,
    }));

    return {
      totalTools: this.tools.size,
      enabledTools: tools.filter((t) => t.enabled).length,
      disabledTools: tools.filter((t) => !t.enabled).length,
      tools,
    };
  }

  /**
   * Clear all tools (for testing)
   */
  clear(): void {
    this.stopHealthChecks();
    this.tools.clear();
    logger.info('[VibeToolRegistry] Registry cleared');
  }
}

// Singleton instance
export const vibeToolRegistry = new VibeToolRegistry();
