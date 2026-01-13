/**
 * Vibe Orchestrator
 *
 * Main coordinator for @vibe tool system:
 * - Parses user @vibe mentions
 * - Calls OpenAI to determine which tool to use
 * - Routes to appropriate tool
 * - Handles rate limiting
 * - Logs analytics
 * - Returns formatted results
 */

import { logger } from '../../utils/logger';
import { query } from '../database';
import { vibeToolRegistry } from './vibeToolRegistry';
import {
  ToolParams,
  ToolResult,
  ParsedIntent,
  PodContext,
  ToolError,
  ToolErrorType,
  OrchestratorEvent,
} from './types';
import { EventEmitter } from 'events';

// Will integrate with existing aiChatService
import { aiChatService } from '../aiChatService';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export class VibeOrchestrator extends EventEmitter {
  // Rate limiting: toolName:userId -> entry
  private rateLimitMap: Map<string, RateLimitEntry> = new Map();

  constructor() {
    super();

    // Listen to tool execution events for logging
    this.on('tool_execution_completed', (event: OrchestratorEvent) => {
      if (event.type === 'tool_execution_completed') {
        this.logToolExecution(event).catch((error) => {
          logger.error('[VibeOrchestrator] Failed to log tool execution', { error });
        });
      }
    });
  }

  /**
   * Process a @vibe mention
   * Main entry point for the orchestrator
   *
   * @param rawQuery - User's message (e.g., "@vibe find coffee nearby")
   * @param context - Pod context
   * @returns ToolResult with formatted message and optional actions
   */
  async processVibeQuery(rawQuery: string, context: PodContext): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Step 1: Parse intent using OpenAI function calling
      const intent = await this.parseIntent(rawQuery, context);

      this.emit('intent_parsed', {
        type: 'intent_parsed',
        intent,
      } as OrchestratorEvent);

      // Step 2: Find matching tool
      const tool = vibeToolRegistry.getToolByFunctionName(intent.toolName);

      if (!tool) {
        this.emit('no_tool_matched', {
          type: 'no_tool_matched',
          intent,
        } as OrchestratorEvent);

        logger.warn('[VibeOrchestrator] No tool found for intent', {
          toolName: intent.toolName,
          rawQuery,
        });

        return {
          success: false,
          message: "hmm, i'm not sure how to help with that yet. try asking differently?",
        };
      }

      this.emit('tool_selected', {
        type: 'tool_selected',
        toolName: tool.name,
      } as OrchestratorEvent);

      // Step 3: Check rate limit
      const rateLimitKey = `${tool.name}:${context.userId}`;
      const rateLimit = tool.getRateLimit();

      if (this.isRateLimited(rateLimitKey, rateLimit)) {
        this.emit('rate_limit_exceeded', {
          type: 'rate_limit_exceeded',
          toolName: tool.name,
          userId: context.userId,
        } as OrchestratorEvent);

        logger.warn('[VibeOrchestrator] Rate limit exceeded', {
          toolName: tool.name,
          userId: context.userId,
          rateLimit,
        });

        throw new ToolError(
          ToolErrorType.RATE_LIMIT_ERROR,
          'Too many requests',
          tool.name
        );
      }

      // Step 4: Execute tool
      const params: ToolParams = {
        parameters: intent.parameters,
        context,
        rawQuery,
      };

      this.emit('tool_execution_started', {
        type: 'tool_execution_started',
        toolName: tool.name,
        params,
      } as OrchestratorEvent);

      const result = await tool.execute(params);

      const durationMs = Date.now() - startTime;

      this.emit('tool_execution_completed', {
        type: 'tool_execution_completed',
        toolName: tool.name,
        result,
        durationMs,
      } as OrchestratorEvent);

      // Update rate limit counter
      this.incrementRateLimit(rateLimitKey);

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Handle ToolError
      if (error instanceof ToolError) {
        this.emit('tool_execution_failed', {
          type: 'tool_execution_failed',
          toolName: error.toolName,
          error: error.message,
          durationMs,
        } as OrchestratorEvent);

        return {
          success: false,
          message: this.formatToolError(error),
          metadata: {
            executionTimeMs: durationMs,
            apiCallsMade: 0,
            cacheHit: false,
            errorType: error.type,
          },
        };
      }

      // Handle unknown errors
      logger.error('[VibeOrchestrator] Unexpected error in processVibeQuery', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        rawQuery,
        podId: context.podId,
      });

      return {
        success: false,
        message: "oops, something went wrong. wanna try again?",
        metadata: {
          executionTimeMs: durationMs,
          apiCallsMade: 0,
          cacheHit: false,
        },
      };
    }
  }

  /**
   * Parse user intent using OpenAI function calling
   */
  private async parseIntent(rawQuery: string, _context: PodContext): Promise<ParsedIntent> {
    try {
      // Get all available function definitions from registry
      const functionDefinitions = vibeToolRegistry.getFunctionDefinitions();

      if (functionDefinitions.length === 0) {
        logger.warn('[VibeOrchestrator] No tools registered');
        throw new Error('No tools available');
      }

      // Call OpenAI with function calling
      const response = await aiChatService.parseToolIntent(rawQuery, functionDefinitions);

      return {
        toolName: response.functionName,
        parameters: response.parameters,
        confidence: response.confidence ?? 0.8,
        rawQuery,
      };
    } catch (error) {
      logger.error('[VibeOrchestrator] Failed to parse intent', {
        error: error instanceof Error ? error.message : String(error),
        rawQuery,
      });

      // Return a fallback intent - treat as general query
      return {
        toolName: 'unknown',
        parameters: {},
        confidence: 0.0,
        rawQuery,
      };
    }
  }

  /**
   * Check if user has exceeded rate limit for a tool
   */
  private isRateLimited(key: string, rateLimit: { maxCalls: number; windowMs: number }): boolean {
    const entry = this.rateLimitMap.get(key);

    if (!entry) {
      return false; // No history, not limited
    }

    const now = Date.now();
    const windowExpired = now - entry.windowStart > rateLimit.windowMs;

    if (windowExpired) {
      // Window expired, reset
      this.rateLimitMap.delete(key);
      return false;
    }

    // Check if exceeded
    return entry.count >= rateLimit.maxCalls;
  }

  /**
   * Increment rate limit counter
   */
  private incrementRateLimit(key: string): void {
    const entry = this.rateLimitMap.get(key);
    const now = Date.now();

    if (!entry) {
      this.rateLimitMap.set(key, {
        count: 1,
        windowStart: now,
      });
    } else {
      entry.count++;
    }
  }

  /**
   * Format tool error for user display
   */
  private formatToolError(error: ToolError): string {
    switch (error.type) {
      case ToolErrorType.RATE_LIMIT_ERROR:
        return "whoa, let's slow down! give it a minute before trying again.";

      case ToolErrorType.VALIDATION_ERROR:
        return `hmm, that didn't quite work. ${error.message}`;

      case ToolErrorType.API_ERROR:
        return "couldn't reach the service right now. wanna try again in a sec?";

      case ToolErrorType.NOT_AVAILABLE:
        return "this feature isn't available right now. sorry!";

      case ToolErrorType.TIMEOUT:
        return "that's taking too long. mind trying again?";

      default:
        return "something went wrong. wanna try again?";
    }
  }

  /**
   * Log tool execution to analytics database
   */
  private async logToolExecution(event: Extract<OrchestratorEvent, { type: 'tool_execution_completed' }>): Promise<void> {
    try {
      const { toolName, result, durationMs } = event;

      // Extract pod context from result metadata if available
      // This assumes the tool passes context info in metadata
      const podId = result.metadata?.['podId'];
      const userId = result.metadata?.['userId'];

      if (!podId || !userId) {
        logger.warn('[VibeOrchestrator] Missing pod/user context for tool execution log');
        return;
      }

      await query(
        `INSERT INTO vibe_tool_calls
         (pod_id, user_id, tool_name, intent, parameters, result, success, execution_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          podId,
          userId,
          toolName,
          result.metadata?.['rawQuery'] || '',
          JSON.stringify(result.metadata?.['parameters'] || {}),
          JSON.stringify(result),
          result.success,
          durationMs,
        ]
      );

      logger.debug('[VibeOrchestrator] Tool execution logged to database', {
        toolName,
        podId,
        success: result.success,
      });
    } catch (error) {
      logger.error('[VibeOrchestrator] Failed to log tool execution to database', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - logging failure shouldn't break the flow
    }
  }

  /**
   * Clear rate limits (for testing)
   */
  clearRateLimits(): void {
    this.rateLimitMap.clear();
  }

  /**
   * Get rate limit stats for a user/tool
   */
  getRateLimitStatus(toolName: string, userId: string): {
    limited: boolean;
    count: number;
    maxCalls: number;
    resetsInMs: number;
  } | null {
    const tool = vibeToolRegistry.getTool(toolName);
    if (!tool) {
      return null;
    }

    const rateLimit = tool.getRateLimit();
    const key = `${toolName}:${userId}`;
    const entry = this.rateLimitMap.get(key);

    if (!entry) {
      return {
        limited: false,
        count: 0,
        maxCalls: rateLimit.maxCalls,
        resetsInMs: 0,
      };
    }

    const now = Date.now();
    const elapsed = now - entry.windowStart;
    const resetsInMs = rateLimit.windowMs - elapsed;

    return {
      limited: entry.count >= rateLimit.maxCalls,
      count: entry.count,
      maxCalls: rateLimit.maxCalls,
      resetsInMs: Math.max(0, resetsInMs),
    };
  }
}

// Singleton instance
export const vibeOrchestrator = new VibeOrchestrator();
