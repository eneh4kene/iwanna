import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { AppError } from '../types';

/**
 * Handle Zod validation errors
 */
const handleZodError = (error: ZodError): { message: string; statusCode: number } => {
  const errors = error.errors.map((err) => ({
    field: err.path ? err.path.join('.') : 'unknown',
    message: err.message,
  }));

  return {
    message: errors.length === 1 ? (errors[0]?.message || 'Validation failed') : 'Validation failed',
    statusCode: 400,
  };
};

/**
 * Global error handler middleware
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  // Handle known AppError
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      ...(process.env['NODE_ENV'] === 'development' && { stack: error.stack }),
    });
    return;
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const { message, statusCode } = handleZodError(error);
    res.status(statusCode).json({
      success: false,
      error: message,
      ...(process.env['NODE_ENV'] === 'development' && { details: error.errors }),
    });
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: 'Invalid authentication token',
    });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: 'Token expired',
      message: 'Please refresh your session',
    });
    return;
  }

  // Handle database errors
  if (error.name === 'QueryFailedError' || ('code' in error && (error as any).code)) {
    res.status(500).json({
      success: false,
      error: 'Database operation failed',
      ...(process.env['NODE_ENV'] === 'development' && { details: error.message }),
    });
    return;
  }

  // Default to 500 server error
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(process.env['NODE_ENV'] === 'development' && {
      message: error.message,
      stack: error.stack,
    }),
  });
};
