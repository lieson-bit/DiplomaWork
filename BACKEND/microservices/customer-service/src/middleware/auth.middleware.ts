import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ResponseUtil } from '../utils/response.util';
import logger from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        userType: string;
        email: string;
      };
    }
  }
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      ResponseUtil.unauthorized(res, 'No token provided');
      return;
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      logger.error('JWT_SECRET not configured');
      ResponseUtil.error(res, 'Server configuration error', 500);
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    // Set user in request
    req.user = {
      userId: decoded.userId,
      userType: decoded.userType,
      email: decoded.email || ''
    };

    next();
  } catch (error: any) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      ResponseUtil.unauthorized(res, 'Invalid token');
      return;
    }
    
    if (error.name === 'TokenExpiredError') {
      ResponseUtil.unauthorized(res, 'Token expired');
      return;
    }
    
    ResponseUtil.unauthorized(res, 'Authentication failed');
  }
};

export const authorizeCustomer = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    ResponseUtil.unauthorized(res, 'No user found');
    return;
  }

  if (req.user.userType !== 'customer') {
    ResponseUtil.forbidden(res, 'Access denied. Customer access required');
    return;
  }

  next();
};

export const optionalAuthenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

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
    // If token is invalid, just continue without user
    next();
  }
};