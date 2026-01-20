import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { AuthRequest } from '../middleware/auth.middleware';

const userService = new UserService();

export class UserController {
  async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      console.log('📋 Fetching all users...');
      const users = await userService.getAllUsers();
      console.log(`✅ Found ${users.length} users`);
      
      // Format the response
      const userData = users.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        userType: user.userType,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        isActive: user.isActive,
        profileCompleted: user.profileCompleted,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }));
      
      // Send response once
      res.json(userData);
    } catch (error: any) {
      console.error('❌ Get all users error:', error);
      
      // Check if headers already sent
      if (!res.headersSent) {
        res.status(500).json({ 
          error: error.message || 'Failed to fetch users',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      } else {
        console.error('⚠️ Headers already sent, cannot send error response');
      }
    }
  }

  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      console.log(`📋 Fetching user by ID: ${id}`);
      
      const user = await userService.getUserById(id);
      
      if (!user) {
        if (!res.headersSent) {
          res.status(404).json({ error: 'User not found' });
        }
        return;
      }
      
      if (!res.headersSent) {
        res.json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          userType: user.userType,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          isActive: user.isActive,
          profileCompleted: user.profileCompleted,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        });
      }
    } catch (error: any) {
      console.error('❌ Get user by ID error:', error);
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: error.message || 'Failed to fetch user',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    }
  }

  async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        if (!res.headersSent) {
          res.status(401).json({ error: 'Not authenticated' });
        }
        return;
      }

      const { firstName, lastName, phone } = req.body;
      console.log(`📝 Updating profile for user: ${req.user.userId}`);
      
      const updatedUser = await userService.updateProfile(req.user.userId, {
        firstName,
        lastName,
        phone,
      });

      if (!updatedUser) {
        if (!res.headersSent) {
          res.status(404).json({ error: 'User not found' });
        }
        return;
      }

      if (!res.headersSent) {
        res.json({
          message: 'Profile updated successfully',
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            phone: updatedUser.phone,
            profileCompleted: updatedUser.profileCompleted,
          },
        });
      }
    } catch (error: any) {
      console.error('❌ Update profile error:', error);
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: error.message || 'Failed to update profile',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    }
  }

  async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== 'string') {
        if (!res.headersSent) {
          res.status(400).json({ error: 'Search query is required' });
        }
        return;
      }

      console.log(`🔍 Searching users with query: ${query}`);
      const users = await userService.searchUsers(query);
      
      if (!res.headersSent) {
        res.json(users.map(user => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          userType: user.userType,
          isActive: user.isActive,
          profileCompleted: user.profileCompleted,
        })));
      }
    } catch (error: any) {
      console.error('❌ Search users error:', error);
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: error.message || 'Failed to search users',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    }
  }

  async getUsersByType(req: Request, res: Response): Promise<void> {
    try {
      const { type } = req.params;
      
      if (type !== 'driver' && type !== 'customer') {
        if (!res.headersSent) {
          res.status(400).json({ error: 'Invalid user type' });
        }
        return;
      }

      console.log(`📊 Getting users by type: ${type}`);
      const users = await userService.getUsersByType(type);
      
      if (!res.headersSent) {
        res.json(users.map(user => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          userType: user.userType,
          isActive: user.isActive,
          profileCompleted: user.profileCompleted,
          createdAt: user.createdAt,
        })));
      }
    } catch (error: any) {
      console.error('❌ Get users by type error:', error);
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: error.message || 'Failed to fetch users by type',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    }
  }
}