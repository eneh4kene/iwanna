import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Validate required environment variables
 */
const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

/**
 * Get environment variable with optional default
 */
const getEnv = (key: string, defaultValue: string): string => {
  return process.env[key] || defaultValue;
};

/**
 * Server configuration
 */
const env = getEnv('NODE_ENV', 'development');
export const serverConfig = {
  port: parseInt(getEnv('PORT', '3001'), 10),
  env,
  apiVersion: getEnv('API_VERSION', 'v1'),
  corsOrigins: env === 'development'
    ? ['*'] // Allow all origins in development for easier testing
    : getEnv('CORS_ORIGIN', 'http://localhost:8081,http://localhost:19006')
        .split(',')
        .map(origin => origin.trim()),
};

/**
 * Database configuration
 */
export const databaseConfig = {
  url: requireEnv('DATABASE_URL'),
  host: getEnv('DB_HOST', 'localhost'),
  port: parseInt(getEnv('DB_PORT', '5432'), 10),
  database: getEnv('DB_NAME', 'iwanna_db'),
  user: getEnv('DB_USER', 'iwanna'),
  password: getEnv('DB_PASSWORD', 'iwanna_password'),
  max: parseInt(getEnv('DB_POOL_SIZE', '20'), 10),
  idleTimeoutMillis: parseInt(getEnv('DB_IDLE_TIMEOUT', '30000'), 10),
  connectionTimeoutMillis: parseInt(getEnv('DB_CONNECT_TIMEOUT', '10000'), 10),
};

/**
 * Redis configuration
 */
export const redisConfig = {
  url: requireEnv('REDIS_URL'),
  host: getEnv('REDIS_HOST', 'localhost'),
  port: parseInt(getEnv('REDIS_PORT', '6379'), 10),
  password: getEnv('REDIS_PASSWORD', ''),
  db: parseInt(getEnv('REDIS_DB', '0'), 10),
};

/**
 * JWT configuration
 */
export const jwtConfig = {
  accessSecret: requireEnv('JWT_ACCESS_SECRET'),
  refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
  accessExpiresIn: getEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
  refreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '90d'),
};

/**
 * Security configuration
 */
export const securityConfig = {
  bcryptRounds: parseInt(getEnv('BCRYPT_ROUNDS', '12'), 10),
  maxRecoveryAttempts: parseInt(getEnv('MAX_RECOVERY_ATTEMPTS_PER_IP', '5'), 10),
  recoveryAttemptWindow: parseInt(getEnv('RECOVERY_ATTEMPT_WINDOW_HOURS', '1'), 10),
};

/**
 * Rate limiting configuration
 */
export const rateLimitConfig = {
  windowMs: parseInt(getEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10), // 15 minutes
  maxRequests: parseInt(getEnv('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
  tier1WannasPerDay: parseInt(getEnv('TIER1_WANNAS_PER_DAY', '5'), 10),
  tier2WannasPerDay: parseInt(getEnv('TIER2_WANNAS_PER_DAY', '10'), 10),
  tier3WannasPerDay: parseInt(getEnv('TIER3_WANNAS_PER_DAY', '999'), 10),
};

/**
 * OpenAI configuration
 */
export const openaiConfig = {
  apiKey: requireEnv('OPENAI_API_KEY'),
  model: getEnv('OPENAI_MODEL', 'gpt-4o-mini'),
  embeddingModel: getEnv('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small'),
  maxTokens: parseInt(getEnv('OPENAI_MAX_TOKENS', '1000'), 10),
  temperature: parseFloat(getEnv('OPENAI_TEMPERATURE', '0.3')),
};

/**
 * Google Places API configuration
 */
export const googlePlacesConfig = {
  apiKey: getEnv('GOOGLE_PLACES_API_KEY', ''),
};

/**
 * Logging configuration
 */
export const loggingConfig = {
  level: getEnv('LOG_LEVEL', serverConfig.env === 'production' ? 'info' : 'debug'),
  format: getEnv('LOG_FORMAT', 'combined'),
};

/**
 * Application configuration
 */
export const appConfig = {
  wannaExpiryHours: parseInt(getEnv('WANNA_EXPIRY_HOURS', '6'), 10),
  podExpiryHours: parseInt(getEnv('POD_EXPIRY_HOURS', '3'), 10),
  matchingRadiusMiles: parseFloat(getEnv('MATCHING_RADIUS_MILES', '3')),
  fallbackRadiusMiles: parseFloat(getEnv('FALLBACK_RADIUS_MILES', '10')),
  minPodSize: parseInt(getEnv('MIN_POD_SIZE', '2'), 10),
  maxPodSize: parseInt(getEnv('MAX_POD_SIZE', '5'), 10),
  vibeMinIntervalMinutes: parseInt(getEnv('VIBE_MIN_INTERVAL_MINUTES', '2'), 10),
};

/**
 * Validate all configurations on startup
 */
export const validateConfig = (): void => {
  // Validate JWT secrets are strong enough
  if (jwtConfig.accessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be at least 32 characters');
  }
  if (jwtConfig.refreshSecret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters');
  }

  // Validate OpenAI API key format
  if (!openaiConfig.apiKey.startsWith('sk-')) {
    throw new Error('OPENAI_API_KEY appears to be invalid (should start with sk-)');
  }

  // Configuration validated successfully
  // Logging is handled by logger utility
};
