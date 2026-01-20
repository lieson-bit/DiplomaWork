import { Request, Response, NextFunction } from 'express';
import { JWTUtils } from '../utils/jwt';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    userType: string;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = JWTUtils.verifyToken(token);
      
      if (decoded.type !== 'access') {
        res.status(401).json({ error: 'Invalid token type' });
        return;
      }

      req.user = {
        userId: decoded.userId,
        userType: decoded.userType,
      };

      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const optionalAuthMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      try {
        const decoded = JWTUtils.verifyToken(token);
        
        if (decoded.type === 'access') {
          req.user = {
            userId: decoded.userId,
            userType: decoded.userType,
          };
        }
      } catch (error) {
        // Token is invalid, but we don't fail since auth is optional
        console.warn('Optional auth token invalid:', error);
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
};