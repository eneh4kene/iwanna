import Redis from 'ioredis';
import { redisConfig } from '../config';
import { logger } from '../utils/logger';

/**
 * Redis client instance
 */
let redis: Redis | null = null;

/**
 * Initialize Redis connection
 */
export const connectRedis = async (): Promise<void> => {
  try {
    const options: {
      host: string;
      port: number;
      password?: string;
      db: number;
      retryStrategy: (times: number) => number;
      maxRetriesPerRequest: number;
    } = {
      host: redisConfig.host,
      port: redisConfig.port,
      db: redisConfig.db,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    };

    if (redisConfig.password) {
      options.password = redisConfig.password;
    }

    redis = new Redis(options);

    // Set up event handlers
    redis.on('connect', () => {
      logger.info('Redis connection established', {
        host: redisConfig.host,
        port: redisConfig.port,
      });
    });

    redis.on('error', (err) => {
      logger.error('Redis error', err);
    });

    redis.on('close', () => {
      logger.warn('Redis connection closed');
    });

    // Test the connection
    await redis.ping();
  } catch (error) {
    logger.error('Failed to connect to Redis', error);
    throw error;
  }
};

/**
 * Get Redis client
 */
export const getRedis = (): Redis => {
  if (!redis) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return redis;
};

/**
 * Close Redis connection
 */
export const closeRedis = async (): Promise<void> => {
  if (redis) {
    await redis.quit();
    redis = null;
    logger.info('Redis connection closed');
  }
};

/**
 * Check Redis health
 */
export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    const response = await getRedis().ping();
    return response === 'PONG';
  } catch (error) {
    logger.error('Redis health check failed', error);
    return false;
  }
};

/**
 * Cache helper functions
 */
export const cache = {
  /**
   * Get value from cache
   */
  get: async <T>(key: string): Promise<T | null> => {
    try {
      const value = await getRedis().get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get failed', { key, error });
      return null;
    }
  },

  /**
   * Set value in cache with optional TTL
   */
  set: async (key: string, value: unknown, ttlSeconds?: number): Promise<void> => {
    try {
      const stringValue = JSON.stringify(value);
      if (ttlSeconds) {
        await getRedis().setex(key, ttlSeconds, stringValue);
      } else {
        await getRedis().set(key, stringValue);
      }
    } catch (error) {
      logger.error('Cache set failed', { key, error });
    }
  },

  /**
   * Delete value from cache
   */
  del: async (key: string): Promise<void> => {
    try {
      await getRedis().del(key);
    } catch (error) {
      logger.error('Cache delete failed', { key, error });
    }
  },

  /**
   * Check if key exists
   */
  exists: async (key: string): Promise<boolean> => {
    try {
      const result = await getRedis().exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists check failed', { key, error });
      return false;
    }
  },

  /**
   * Increment counter
   */
  incr: async (key: string): Promise<number> => {
    try {
      return await getRedis().incr(key);
    } catch (error) {
      logger.error('Cache incr failed', { key, error });
      return 0;
    }
  },

  /**
   * Set expiry on key
   */
  expire: async (key: string, seconds: number): Promise<void> => {
    try {
      await getRedis().expire(key, seconds);
    } catch (error) {
      logger.error('Cache expire failed', { key, error });
    }
  },
};

/**
 * Geospatial helper functions
 */
export const geo = {
  /**
   * Add location to geospatial index
   */
  add: async (
    key: string,
    longitude: number,
    latitude: number,
    member: string
  ): Promise<void> => {
    try {
      await getRedis().geoadd(key, longitude, latitude, member);
    } catch (error) {
      logger.error('Geo add failed', { key, member, error });
    }
  },

  /**
   * Find members within radius
   */
  radius: async (
    key: string,
    longitude: number,
    latitude: number,
    radius: number,
    unit: 'km' | 'mi' = 'mi'
  ): Promise<string[]> => {
    try {
      const results = await getRedis().georadius(
        key,
        longitude,
        latitude,
        radius,
        unit,
        'WITHDIST',
        'ASC'
      );
      return results.map((r) => (Array.isArray(r) ? String(r[0]) : String(r)));
    } catch (error) {
      logger.error('Geo radius failed', { key, error });
      return [];
    }
  },

  /**
   * Remove member from geospatial index
   */
  remove: async (key: string, member: string): Promise<void> => {
    try {
      await getRedis().zrem(key, member);
    } catch (error) {
      logger.error('Geo remove failed', { key, member, error });
    }
  },
};
