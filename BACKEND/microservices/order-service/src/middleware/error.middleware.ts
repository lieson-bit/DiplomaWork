import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

// Create logger instance for this module
const logger = new Logger('ErrorMiddleware');

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Error occurred:', {
    path: req.path,
    method: req.method,
    error: error.message,
    stack: error.stack
  });
  
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};