import { loggingConfig } from '../config';

/**
 * Log levels
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  green: '\x1b[32m',
};

/**
 * Get color for log level
 */
const getColor = (level: LogLevel): string => {
  switch (level) {
    case 'debug':
      return colors.gray;
    case 'info':
      return colors.blue;
    case 'warn':
      return colors.yellow;
    case 'error':
      return colors.red;
  }
};

/**
 * Format timestamp
 */
const getTimestamp = (): string => {
  return new Date().toISOString();
};

/**
 * Check if level should be logged
 */
const shouldLog = (level: LogLevel): boolean => {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  const configLevel = loggingConfig.level as LogLevel;
  const configIndex = levels.indexOf(configLevel);
  const currentIndex = levels.indexOf(level);
  return currentIndex >= configIndex;
};

/**
 * Format log message
 */
const formatMessage = (level: LogLevel, message: string, meta?: unknown): string => {
  const color = getColor(level);
  const timestamp = getTimestamp();
  const levelStr = level.toUpperCase().padEnd(5);

  let output = `${color}[${timestamp}] ${levelStr}${colors.reset} ${message}`;

  if (meta) {
    if (typeof meta === 'object') {
      output += `\n${colors.gray}${JSON.stringify(meta, null, 2)}${colors.reset}`;
    } else {
      output += ` ${colors.gray}${meta}${colors.reset}`;
    }
  }

  return output;
};

/**
 * Logger instance
 */
export const logger = {
  /**
   * Debug level - detailed information for diagnosing problems
   */
  debug: (message: string, meta?: unknown): void => {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message, meta));
    }
  },

  /**
   * Info level - general informational messages
   */
  info: (message: string, meta?: unknown): void => {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message, meta));
    }
  },

  /**
   * Warn level - warning messages for potentially harmful situations
   */
  warn: (message: string, meta?: unknown): void => {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, meta));
    }
  },

  /**
   * Error level - error messages for failures
   */
  error: (message: string, meta?: unknown): void => {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, meta));
    }
  },
};
