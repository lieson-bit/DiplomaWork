import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    // Capture stack trace (works in V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal server error';
  let isOperational = false;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
    isOperational = true;
  } else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid or expired token';
    isOperational = true;
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    isOperational = true;
  } else if (err.name === 'PrismaClientKnownRequestError') {
    statusCode = 400;
    message = 'Database error';
    isOperational = true;
  }

  // Log error
  if (!isOperational) {
    logger.error('Non-operational error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query,
    });
  } else {
    logger.warn('Operational error:', {
      message: err.message,
      path: req.path,
      method: req.method,
    });
  }

  // Send response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};

// 404 handler middleware
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(`Cannot ${req.method} ${req.path}`, 404);
  next(error);
};

// Async error wrapper for controllers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}; 