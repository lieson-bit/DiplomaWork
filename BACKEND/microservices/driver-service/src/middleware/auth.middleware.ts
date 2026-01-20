import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'd6b1cc1128085078faf5a1f9500ca843f31b7574969a0dfae1aa976d509cea2bdd7e316ae765f8b3cfdb09062b3453e9d0533eeb9c28cecd4817b2ef3228d044';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    userType: string;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        userType: string;
        type?: string;
      };

      // Check if it's an access token
      if (decoded.type === 'refresh') {
        return res.status(401).json({ error: 'Invalid token type' });
      }

      req.user = {
        userId: decoded.userId,
        userType: decoded.userType,
      };

      next();
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      throw error;
    }
  } catch (error: any) {
    logger.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

export const authorizeDriver = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.userType !== 'driver') {
      return res.status(403).json({ error: 'Forbidden: Driver access only' });
    }

    next();
  } catch (error: any) {
    logger.error('Authorization error:', error);
    res.status(500).json({ error: 'Authorization failed' });
  }
};

export default { authenticate, authorizeDriver };