import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { serverConfig, validateConfig } from './config';
import { connectDatabase, closeDatabase, checkDatabaseHealth } from './services/database';
import { connectRedis, closeRedis, checkRedisHealth } from './services/redis';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { globalRateLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';
import { matchingWorker } from './workers/matchingWorker';
import { initializeWebSocket, shutdownWebSocket } from './websocket/socketHandler';
import routes from './routes';

/**
 * Initialize and start the server
 */
async function startServer(): Promise<void> {
  try {
    // Validate configuration
    validateConfig();

    // Create Express app
    const app = express();

    // Trust proxy (for accurate IP addresses behind proxies)
    app.set('trust proxy', 1);

    // Security middleware
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
        crossOriginEmbedderPolicy: false,
      })
    );

    // CORS middleware
    app.use(
      cors({
        origin: serverConfig.corsOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      })
    );

    // Body parsing middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Compression middleware
    app.use(compression());

    // Request logging middleware
    app.use(requestLogger);

    // Global rate limiting
    app.use(globalRateLimiter);

    // Connect to databases
    logger.info('Connecting to databases...');
    await connectDatabase();
    await connectRedis();
    logger.info('Database connections established');

    // Start matching worker
    matchingWorker.start();

    // Register API routes
    app.use(`/api/${serverConfig.apiVersion}`, routes);

    // Health check endpoint (no /api prefix for load balancers)
    app.get('/health', async (_req, res) => {
      const dbHealthy = await checkDatabaseHealth();
      const redisHealthy = await checkRedisHealth();

      const healthy = dbHealthy && redisHealthy;

      res.status(healthy ? 200 : 503).json({
        success: healthy,
        status: healthy ? 'healthy' : 'unhealthy',
        services: {
          database: dbHealthy ? 'ok' : 'error',
          redis: redisHealthy ? 'ok' : 'error',
          websocket: 'ok',
        },
        timestamp: new Date().toISOString(),
      });
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Not found',
        message: 'The requested endpoint does not exist',
        path: req.path,
      });
    });

    // Global error handler (must be last)
    app.use(errorHandler);

    // Start HTTP server
    const server = app.listen(serverConfig.port, () => {
      logger.info('HTTP server started on port ' + serverConfig.port);
    });

    // Initialize WebSocket server (after HTTP server is started)
    const io = initializeWebSocket(server);

    // Server startup complete
    logger.info(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ✨ Iwanna API Server                                        ║
║                                                               ║
║   Environment:  ${serverConfig.env.padEnd(45)}║
║   Port:         ${String(serverConfig.port).padEnd(45)}║
║   API Version:  ${serverConfig.apiVersion.padEnd(45)}║
║                                                               ║
║   Endpoints:                                                  ║
║   → http://localhost:${serverConfig.port}/api/${serverConfig.apiVersion}/auth                  ║
║   → http://localhost:${serverConfig.port}/api/${serverConfig.apiVersion}/wannas                ║
║   → http://localhost:${serverConfig.port}/health                             ║
║                                                               ║
║   "Connect through moments of impulse, curiosity, and         ║
║    shared energy — not rigid plans."                          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
      `);

    // Graceful shutdown handlers
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received, shutting down gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        // Stop matching worker
        matchingWorker.stop();

        // Shutdown WebSocket server
        await shutdownWebSocket(io);

        // Close database connections
        await closeDatabase();
        await closeRedis();

        logger.info('All connections closed. Exiting...');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason, promise });
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Start the server
startServer();
