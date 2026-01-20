import { User, DBUser } from '../types';
import { prisma } from '../config/database';

export class UserService {
  async getUserById(userId: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (!user) return null;
      
      return {
        id: user.id,
        email: user.email,
        password: user.password,
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
      };
    } catch (error) {
      console.error('Get user by ID error:', error);
      throw error;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      // Remove orderBy or fix it - the database.ts already handles ordering
      const users = await prisma.user.findMany();
      
      return users.map((user: any) => ({
        id: user.id,
        email: user.email,
        password: user.password,
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
    } catch (error) {
      console.error('Get all users error:', error);
      throw error;
    }
  }

  async searchUsers(query: string): Promise<User[]> {
    try {
      const users = await prisma.$queryRaw`
        SELECT * FROM users 
        WHERE email LIKE ${'%' + query + '%'} 
           OR first_name LIKE ${'%' + query + '%'} 
           OR last_name LIKE ${'%' + query + '%'} 
           OR phone LIKE ${'%' + query + '%'}
        ORDER BY created_at DESC
      `;
      
      return (users as any[]).map((user: any) => ({
        id: user.id,
        email: user.email,
        password: user.password,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        userType: user.user_type,
        emailVerified: Boolean(user.email_verified),
        phoneVerified: Boolean(user.phone_verified),
        isActive: Boolean(user.is_active),
        profileCompleted: Boolean(user.profile_completed),
        lastLogin: user.last_login,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }));
    } catch (error) {
      console.error('Search users error:', error);
      throw error;
    }
  }

  async getUsersByType(userType: 'driver' | 'customer'): Promise<User[]> {
    try {
      const users = await prisma.user.findMany({
        where: { userType }
      });
      
      return users.map((user: any) => ({
        id: user.id,
        email: user.email,
        password: user.password,
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
    } catch (error) {
      console.error('Get users by type error:', error);
      throw error;
    }
  }

  async updateProfile(userId: string, profileData: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Promise<User | null> {
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...profileData,
          profileCompleted: true
        }
      });
      
      return {
        id: updatedUser.id,
        email: updatedUser.email,
        password: updatedUser.password,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phone: updatedUser.phone,
        userType: updatedUser.userType,
        emailVerified: updatedUser.emailVerified,
        phoneVerified: updatedUser.phoneVerified,
        isActive: updatedUser.isActive,
        profileCompleted: updatedUser.profileCompleted,
        lastLogin: updatedUser.lastLogin,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      };
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }
}