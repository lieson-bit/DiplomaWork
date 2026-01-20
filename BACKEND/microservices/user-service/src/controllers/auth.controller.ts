import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth.middleware';

const authService = new AuthService();

export class AuthController {
  constructor() {
    // Initialize test users on startup
    authService.initializeTestUsers().catch(console.error);
  }

  async register(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.login(req.body);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token is required' });
        return;
      }

      const result = await authService.refreshToken(refreshToken);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  async logout(req: AuthRequest, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (token) {
        await authService.logout(token);
      }
      
      res.json({ message: 'Logged out successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async validate(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const isValid = await authService.validateUser(userId);
      res.json({ valid: isValid });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      // In a real implementation, you would fetch user from database
      res.json({
        user: {
          userId: req.user.userId,
          userType: req.user.userType,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}