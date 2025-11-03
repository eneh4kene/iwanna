import { Pool, PoolClient } from 'pg';
import { databaseConfig } from '../config';
import { logger } from '../utils/logger';
import { QueryResult } from '../types';

/**
 * PostgreSQL connection pool
 */
let pool: Pool | null = null;

/**
 * Initialize database connection
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    pool = new Pool({
      host: databaseConfig.host,
      port: databaseConfig.port,
      database: databaseConfig.database,
      user: databaseConfig.user,
      password: databaseConfig.password,
      max: databaseConfig.max,
      idleTimeoutMillis: databaseConfig.idleTimeoutMillis,
      connectionTimeoutMillis: databaseConfig.connectionTimeoutMillis,
    });

    // Test the connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time, version()');
    client.release();

    logger.info('Database connection established', {
      time: result.rows[0].time,
      database: databaseConfig.database,
    });

    // Set up error handler for pool
    pool.on('error', (err) => {
      logger.error('Unexpected database error', err);
    });
  } catch (error) {
    logger.error('Failed to connect to database', error);
    throw error;
  }
};

/**
 * Get database connection pool
 */
export const getDatabase = (): Pool => {
  if (!pool) {
    throw new Error('Database not initialized. Call connectDatabase() first.');
  }
  return pool;
};

/**
 * Execute a database query
 */
export const query = async <T = unknown>(
  text: string,
  values?: unknown[]
): Promise<QueryResult<T>> => {
  const db = getDatabase();
  const start = Date.now();

  try {
    const result = await db.query(text, values);
    const duration = Date.now() - start;

    logger.debug('Query executed', {
      query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      rows: result.rowCount,
    });

    return {
      rows: result.rows as T[],
      rowCount: result.rowCount || 0,
    };
  } catch (error) {
    logger.error('Query execution failed', {
      query: text,
      error,
    });
    throw error;
  }
};

/**
 * Execute a transaction
 */
export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const db = getDatabase();
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Close database connection
 */
export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection closed');
  }
};

/**
 * Check database health
 */
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const result = await query('SELECT 1 as health');
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Database health check failed', error);
    return false;
  }
};
