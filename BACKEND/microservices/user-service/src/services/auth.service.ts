import { RegisterDto, LoginDto, AuthResponse } from '../types';
import { PasswordUtils } from '../utils/password';
import { JWTUtils } from '../utils/jwt';
import { prisma } from '../config/database';

export class AuthService {
  async register(data: RegisterDto): Promise<AuthResponse> {
    try {
      console.log('Registering user:', data.email);

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email }
      });

      if (existingUser) {
        throw new Error('User already exists');
      }

      // Hash password
      const hashedPassword = await PasswordUtils.hash(data.password);
      console.log('Password hashed successfully');

      // Create user
      const user = await prisma.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          userType: data.userType,
          emailVerified: false,
          phoneVerified: false,
          isActive: true,
          profileCompleted: false,
        }
      });

      console.log('User created in database:', user.id);

      // Generate tokens
      const tokens = JWTUtils.generateTokens(user.id, user.userType);
      console.log('Tokens generated');

      // Create session
      await prisma.userSession.create({
        data: {
          userId: user.id,
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          deviceInfo: 'web',
          ipAddress: '127.0.0.1'
        }
      });

      console.log('Session created');

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
          profileCompleted: user.profileCompleted,
        },
        tokens
      };
    } catch (error: any) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async login(data: LoginDto): Promise<AuthResponse> {
    try {
      console.log('Login attempt for:', data.email);

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: data.email }
      });

      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check if account is active (user.isActive is already boolean from normalizeUser)
      if (!user.isActive) {
        throw new Error('Account is disabled');
      }

      // Verify password
      console.log('Comparing password for user:', user.email);
      const isValidPassword = await PasswordUtils.compare(
        data.password,
        user.password
      );

      console.log('Password comparison result:', isValidPassword);

      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      console.log('Password verified for user:', user.id);

      // Generate tokens
      const tokens = JWTUtils.generateTokens(user.id, user.userType);

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      // Create new session
      await prisma.userSession.create({
        data: {
          userId: user.id,
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          deviceInfo: 'web',
          ipAddress: '127.0.0.1'
        }
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
          profileCompleted: user.profileCompleted,
        },
        tokens
      };
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      // Verify refresh token
      const decoded = JWTUtils.verifyToken(refreshToken);
      
      // Check if session exists
      const session = await prisma.userSession.findFirst({
        where: {
          refreshToken,
          expiresAt: { gt: new Date() }
        }
      });

      if (!session) {
        throw new Error('Invalid refresh token');
      }

      // Get user for userType
      const user = await prisma.user.findUnique({
        where: { id: session.userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate new access token
      const accessToken = JWTUtils.generateAccessToken({
        userId: session.userId,
        userType: user.userType,
      });

      // Update session with new token
      await prisma.userSession.update({
        where: { id: session.id },
        data: { token: accessToken }
      });

      return { accessToken };
    } catch (error) {
      console.error('Refresh token error:', error);
      throw new Error('Invalid refresh token');
    }
  }

  async logout(token: string): Promise<void> {
    try {
      await prisma.userSession.deleteMany({
        where: { token }
      });
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  async validateUser(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId, isActive: true }
      });
      return !!user;
    } catch (error) {
      console.error('Validate user error:', error);
      return false;
    }
  }

  // Initialize test users - FIXED VERSION
  async initializeTestUsers(): Promise<void> {
    try {
      console.log('Initializing test users...');
      
      const testUsers = [
        {
          email: 'driver@test.com',
          password: 'Password123',
          firstName: 'John',
          lastName: 'Driver',
          userType: 'driver' as const,
          phone: '+1234567890'
        },
        {
          email: 'customer@test.com',
          password: 'Password123',
          firstName: 'Jane',
          lastName: 'Customer',
          userType: 'customer' as const,
          phone: '+0987654321'
        },
      ];

      for (const userData of testUsers) {
        const existing = await prisma.user.findUnique({
          where: { email: userData.email }
        });
        
        if (!existing) {
          console.log(`Creating test user: ${userData.email}`);
          try {
            // Direct create with hashed password instead of calling register
            const hashedPassword = await PasswordUtils.hash(userData.password);
            await prisma.user.create({
              data: {
                email: userData.email,
                password: hashedPassword,
                firstName: userData.firstName,
                lastName: userData.lastName,
                phone: userData.phone,
                userType: userData.userType,
                emailVerified: true,
                phoneVerified: true,
                isActive: true,
                profileCompleted: true,
              }
            });
            console.log(`✅ Created test user: ${userData.email}`);
          } catch (error: any) {
            console.error(`❌ Failed to create test user ${userData.email}:`, error.message);
          }
        } else {
          console.log(`✅ Test user already exists: ${userData.email}`);
        }
      }
      
      console.log('✅ Test users initialization completed');
    } catch (error) {
      console.error('Error initializing test users:', error);
    }
  }
}