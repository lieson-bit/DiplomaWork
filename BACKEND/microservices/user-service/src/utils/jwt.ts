import jwt from 'jsonwebtoken';
import { TokenPayload } from '../types';

export class JWTUtils {
  private static getSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }
    return secret;
  }

  static generateAccessToken(payload: { userId: string; userType: string }): string {
    const secret = this.getSecret();
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    
    return jwt.sign(
      { 
        ...payload, 
        type: 'access',
        iat: Math.floor(Date.now() / 1000)
      },
      secret,
      { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] }
    );
  }

  static generateRefreshToken(payload: { userId: string; userType: string }): string {
    const secret = this.getSecret();
    const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
    
    return jwt.sign(
      { 
        ...payload, 
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000)
      },
      secret,
      { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] }
    );
  }

  static verifyToken(token: string): TokenPayload {
    try {
      const secret = this.getSecret();
      return jwt.verify(token, secret) as TokenPayload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  static decodeToken(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch {
      return null;
    }
  }

  static generateTokens(userId: string, userType: string): {
    accessToken: string;
    refreshToken: string;
  } {
    const payload = { userId, userType };
    
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }
}