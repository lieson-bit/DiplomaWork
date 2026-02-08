import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ResponseUtil } from '../utils/response.util';
import { Logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        userType: 'customer' | 'driver' | 'admin';
        email?: string;
      };
    }
  }
}

// Create logger instance for this module
const logger = new Logger('AuthMiddleware');

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ResponseUtil.unauthorized(res, 'No token provided');
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      logger.error('JWT_SECRET not configured');
      return ResponseUtil.error(res, 'Server configuration error', 500);
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    
    req.user = {
      userId: decoded.userId,
      userType: decoded.userType,
      email: decoded.email || ''
    };

    next();
  } catch (error: any) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return ResponseUtil.unauthorized(res, 'Invalid token');
    }
    
    if (error.name === 'TokenExpiredError') {
      return ResponseUtil.unauthorized(res, 'Token expired');
    }
    
    return ResponseUtil.unauthorized(res, 'Authentication failed');
  }
};

export const authorizeCustomer = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  if (!req.user) {
    return ResponseUtil.unauthorized(res, 'No user found');
  }

  if (req.user.userType !== 'customer') {
    return ResponseUtil.forbidden(res, 'Access denied. Customer access required');
  }

  next();
};

export const authorizeDriver = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  if (!req.user) {
    return ResponseUtil.unauthorized(res, 'No user found');
  }

  if (req.user.userType !== 'driver') {
    return ResponseUtil.forbidden(res, 'Access denied. Driver access required');
  }

  next();
};

export const authorizeDriverOrCustomer = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  if (!req.user) {
    return ResponseUtil.unauthorized(res, 'No user found');
  }

  if (req.user.userType !== 'driver' && req.user.userType !== 'customer') {
    return ResponseUtil.forbidden(res, 'Access denied. Driver or customer access required');
  }

  next();
};

export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return next();
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    
    req.user = {
      userId: decoded.userId,
      userType: decoded.userType,
      email: decoded.email || ''
    };

    next();
  } catch (error) {
    // If token is invalid, continue without user
    next();
  }
};

export const verifyServiceSecret = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const serviceSecret = req.headers['x-service-secret'];
  
  if (!serviceSecret) {
    return ResponseUtil.unauthorized(res, 'Service secret required');
  }
  
  const validSecret = process.env.SERVICE_SECRET;
  
  if (!validSecret) {
    logger.error('SERVICE_SECRET not configured');
    return ResponseUtil.error(res, 'Server configuration error', 500);
  }
  
  if (serviceSecret !== validSecret) {
    return ResponseUtil.unauthorized(res, 'Invalid service secret');
  }
  
  next();
};