/**
 * BaseTool - Abstract Base Class for @vibe Tools
 *
 * All tools extend this class to inherit standard functionality:
 * - Logging
 * - Error handling
 * - Parameter validation
 * - Rate limiting hooks
 * - Analytics tracking
 */

import { logger } from '../../../utils/logger';
import {
  VibeTool,
  ToolParams,
  ToolResult,
  OpenAIFunctionDefinition,
  ParsedIntent,
  ToolError,
  ToolErrorType,
} from '../types';

export abstract class BaseTool implements VibeTool {
  /**
   * Tool name (must be unique across all tools)
   * Example: "place_finder", "meeting_point"
   */
  abstract readonly name: string;

  /**
   * Human-readable description for OpenAI
   * Should clearly explain when to use this tool
   */
  abstract readonly description: string;

  /**
   * Tool version (semver: "1.0.0")
   */
  abstract readonly version: string;

  /**
   * Get OpenAI function definition
   * Subclasses must implement this to define their parameters
   */
  abstract getFunctionDefinition(): OpenAIFunctionDefinition;

  /**
   * Main execution logic
   * Subclasses must implement this
   */
  protected abstract executeInternal(params: ToolParams): Promise<ToolResult>;

  /**
   * Validate parameters (optional override)
   * Default implementation does nothing - override for custom validation
   */
  validateParameters(_parameters: Record<string, any>): void {
    // Default: no validation
    // Subclasses should override if they need parameter validation
  }

  /**
   * Check if tool can handle the intent
   * Default: match by tool name
   * Override for custom matching logic
   */
  canHandle(intent: ParsedIntent): boolean {
    return intent.toolName === this.name;
  }

  /**
   * Get rate limit for this tool
   * Default: 5 calls per 10 minutes
   * Override to customize per tool
   */
  getRateLimit(): { maxCalls: number; windowMs: number } {
    return {
      maxCalls: 5,
      windowMs: 10 * 60 * 1000, // 10 minutes
    };
  }

  /**
   * Check if tool is available
   * Default: always available
   * Override to check API keys, dependencies, etc.
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Execute tool with standard error handling and logging
   * This is the public interface - subclasses implement executeInternal()
   */
  async execute(params: ToolParams): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Log execution start
      logger.info(`[${this.name}] Tool execution started`, {
        podId: params.context.podId,
        userId: params.context.userId,
        parameters: params.parameters,
        rawQuery: params.rawQuery,
      });

      // Validate parameters
      try {
        this.validateParameters(params.parameters);
      } catch (error) {
        throw new ToolError(
          ToolErrorType.VALIDATION_ERROR,
          error instanceof Error ? error.message : 'Parameter validation failed',
          this.name,
          { parameters: params.parameters }
        );
      }

      // Check availability
      const available = await this.isAvailable();
      if (!available) {
        throw new ToolError(
          ToolErrorType.NOT_AVAILABLE,
          `Tool ${this.name} is currently unavailable`,
          this.name
        );
      }

      // Execute the tool
      const result = await this.executeInternal(params);

      // Add execution metadata
      const executionTime = Date.now() - startTime;
      result.metadata = {
        executionTimeMs: executionTime,
        apiCallsMade: result.metadata?.apiCallsMade || 0,
        cacheHit: result.metadata?.cacheHit || false,
        ...result.metadata,
      };

      // Log success
      logger.info(`[${this.name}] Tool execution completed`, {
        podId: params.context.podId,
        success: result.success,
        executionTimeMs: executionTime,
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Handle ToolError (already formatted)
      if (error instanceof ToolError) {
        logger.error(`[${this.name}] Tool execution failed`, {
          podId: params.context.podId,
          errorType: error.type,
          message: error.message,
          details: error.details,
          executionTimeMs: executionTime,
        });

        return {
          success: false,
          message: this.formatErrorMessage(error),
          metadata: {
            executionTimeMs: executionTime,
            apiCallsMade: 0,
            cacheHit: false,
            errorType: error.type,
            errorDetails: error.details,
          },
        };
      }

      // Handle unknown errors
      logger.error(`[${this.name}] Tool execution failed with unexpected error`, {
        podId: params.context.podId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        executionTimeMs: executionTime,
      });

      return {
        success: false,
        message: this.formatUnknownErrorMessage(),
        metadata: {
          executionTimeMs: executionTime,
          apiCallsMade: 0,
          cacheHit: false,
          errorType: ToolErrorType.EXECUTION_ERROR,
        },
      };
    }
  }

  /**
   * Format error message for user (override for custom error messages)
   */
  protected formatErrorMessage(error: ToolError): string {
    switch (error.type) {
      case ToolErrorType.VALIDATION_ERROR:
        return `hmm, something's not right with that request. ${error.message}`;

      case ToolErrorType.API_ERROR:
        return `couldn't reach the service right now. try again in a moment?`;

      case ToolErrorType.RATE_LIMIT_ERROR:
        return `whoa, slow down! let's give it a minute before trying again.`;

      case ToolErrorType.NOT_AVAILABLE:
        return `this feature isn't available right now. sorry about that!`;

      case ToolErrorType.TIMEOUT:
        return `that took too long. wanna try again?`;

      default:
        return `something went wrong. mind trying that again?`;
    }
  }

  /**
   * Format unknown error message
   */
  protected formatUnknownErrorMessage(): string {
    return `oops, hit a snag. wanna try again?`;
  }

  /**
   * Helper: Create success result
   */
  protected createSuccessResult(
    message: string,
    data?: any,
    actionButtons?: any[]
  ): ToolResult {
    return {
      success: true,
      message,
      data,
      actionButtons,
      metadata: {
        executionTimeMs: 0, // Will be overwritten by execute()
        apiCallsMade: 0,
        cacheHit: false,
      },
    };
  }

  /**
   * Helper: Create error result
   */
  protected createErrorResult(
    type: ToolErrorType,
    message: string,
    details?: Record<string, any>
  ): never {
    throw new ToolError(type, message, this.name, details);
  }

  /**
   * Helper: Log info message
   */
  protected log(message: string, meta?: Record<string, any>): void {
    logger.info(`[${this.name}] ${message}`, meta);
  }

  /**
   * Helper: Log warning
   */
  protected warn(message: string, meta?: Record<string, any>): void {
    logger.warn(`[${this.name}] ${message}`, meta);
  }

  /**
   * Helper: Log error
   */
  protected error(message: string, meta?: Record<string, any>): void {
    logger.error(`[${this.name}] ${message}`, meta);
  }
}
