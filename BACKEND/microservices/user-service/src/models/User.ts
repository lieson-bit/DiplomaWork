// This is a TypeScript interface for the User model
// In a real implementation with Prisma, this would be auto-generated

export interface UserModel {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  userType: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  isActive: boolean;
  profileCompleted: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}
