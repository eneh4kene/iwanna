/**
 * @vibe Tools System - Type Definitions
 *
 * Core interfaces and types for the modular tool architecture.
 * Each tool implements the VibeTool interface and can be dynamically
 * registered, discovered, and invoked by the orchestrator.
 */

/**
 * Pod Context
 * Information about the current pod making the tool request
 */
export interface PodContext {
  podId: string;
  userId: string; // User who invoked the tool
  members: PodMember[];
  activity: string;
  category: string;
  location: {
    latitude: number;
    longitude: number;
  };
  createdAt: Date;
  expiresAt: Date;
}

export interface PodMember {
  userId: string;
  username: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Parsed Intent from OpenAI Function Calling
 * OpenAI determines which tool to call based on user's natural language query
 */
export interface ParsedIntent {
  toolName: string;
  parameters: Record<string, any>;
  confidence: number; // 0.0 - 1.0
  rawQuery: string; // Original user message
}

/**
 * Tool Parameters
 * Standard parameters passed to every tool execution
 */
export interface ToolParams {
  parameters: Record<string, any>; // Tool-specific parameters from OpenAI
  context: PodContext;
  rawQuery: string; // Original @vibe mention text
}

/**
 * Tool Result
 * Standardized response from tool execution
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  message: string; // Human-readable response for the pod chat
  actionButtons?: ActionButton[];
  metadata?: {
    executionTimeMs: number;
    apiCallsMade: number;
    cacheHit: boolean;
    [key: string]: any;
  };
}

/**
 * Action Button
 * Interactive buttons attached to tool results (for mobile UI)
 */
export interface ActionButton {
  id: string;
  label: string;
  icon?: string; // Ionicons name
  action: 'open_map' | 'vote' | 'send_pin' | 'find_venue' | 'custom';
  payload?: Record<string, any>;
}

/**
 * Tool Registration Info
 * Metadata about a registered tool
 */
export interface ToolRegistration {
  tool: VibeTool;
  version: string;
  enabled: boolean;
  registeredAt: Date;
}

/**
 * OpenAI Function Definition
 * JSON schema for OpenAI function calling
 */
export interface OpenAIFunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Tool Execution Log Entry
 * For analytics database (vibe_tool_calls table)
 */
export interface ToolExecutionLog {
  podId: string;
  userId: string;
  toolName: string;
  intent: string;
  parameters: Record<string, any>;
  result: ToolResult;
  success: boolean;
  executionTimeMs: number;
}

/**
 * VibeTool Interface
 * Every tool must implement this interface
 */
export interface VibeTool {
  /**
   * Unique tool identifier (e.g., "place_finder", "meeting_point")
   */
  readonly name: string;

  /**
   * Human-readable description for OpenAI function calling
   * Should clearly explain what the tool does and when to use it
   */
  readonly description: string;

  /**
   * Tool version (semver format: "1.0.0")
   */
  readonly version: string;

  /**
   * OpenAI function definition for function calling
   * Defines the parameters the tool accepts
   */
  getFunctionDefinition(): OpenAIFunctionDefinition;

  /**
   * Check if this tool can handle the given intent
   * Used for routing when multiple tools might match
   *
   * @param intent - Parsed intent from OpenAI
   * @returns boolean - true if tool can handle this intent
   */
  canHandle(intent: ParsedIntent): boolean;

  /**
   * Execute the tool with given parameters
   * Main logic of the tool goes here
   *
   * @param params - Tool parameters and pod context
   * @returns ToolResult - Formatted result with message and optional actions
   */
  execute(params: ToolParams): Promise<ToolResult>;

  /**
   * Validate tool parameters before execution
   * Throws error if parameters are invalid
   *
   * @param parameters - Parameters to validate
   * @throws Error if validation fails
   */
  validateParameters(parameters: Record<string, any>): void;

  /**
   * Get rate limit for this tool
   * Format: { maxCalls: number, windowMs: number }
   * Example: { maxCalls: 5, windowMs: 600000 } = 5 calls per 10 minutes
   */
  getRateLimit(): { maxCalls: number; windowMs: number };

  /**
   * Check if tool is available (dependencies, API keys, etc.)
   * Called on tool registration and periodically for health checks
   *
   * @returns boolean - true if tool is ready to use
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Tool Registry Event
 * Events emitted by the tool registry for observability
 */
export type ToolRegistryEvent =
  | { type: 'tool_registered'; toolName: string; version: string }
  | { type: 'tool_unregistered'; toolName: string }
  | { type: 'tool_enabled'; toolName: string }
  | { type: 'tool_disabled'; toolName: string }
  | { type: 'tool_health_check_failed'; toolName: string; error: string };

/**
 * Orchestrator Event
 * Events emitted during tool orchestration for logging/analytics
 */
export type OrchestratorEvent =
  | { type: 'intent_parsed'; intent: ParsedIntent }
  | { type: 'tool_selected'; toolName: string }
  | { type: 'tool_execution_started'; toolName: string; params: ToolParams }
  | { type: 'tool_execution_completed'; toolName: string; result: ToolResult; durationMs: number }
  | { type: 'tool_execution_failed'; toolName: string; error: string; durationMs: number }
  | { type: 'rate_limit_exceeded'; toolName: string; userId: string }
  | { type: 'no_tool_matched'; intent: ParsedIntent };

/**
 * Tool Error Types
 * Standardized error types for tool failures
 */
export enum ToolErrorType {
  VALIDATION_ERROR = 'validation_error',
  API_ERROR = 'api_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  NOT_AVAILABLE = 'not_available',
  EXECUTION_ERROR = 'execution_error',
  TIMEOUT = 'timeout',
}

/**
 * Tool Error
 * Custom error class for tool failures
 */
export class ToolError extends Error {
  constructor(
    public readonly type: ToolErrorType,
    message: string,
    public readonly toolName: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ToolError';
    Object.setPrototypeOf(this, ToolError.prototype);
  }
}

/**
 * Cache Entry
 * For caching tool results (e.g., Google Places searches)
 */
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  expiresAt: Date;
  metadata?: {
    toolName: string;
    parameters: Record<string, any>;
    createdAt: Date;
  };
}
