export interface User {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  userType: 'driver' | 'customer';
  emailVerified: boolean;
  phoneVerified: boolean;
  isActive: boolean;
  profileCompleted: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  userType: 'driver' | 'customer';
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    userType: 'driver' | 'customer';
    profileCompleted: boolean;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface TokenPayload {
  userId: string;
  userType: string;
  type?: 'access' | 'refresh';
  exp?: number; // Expiration timestamp
  iat?: number; // Issued at timestamp
}

export interface ValidationResult {
  error?: {
    details: Array<{ message: string }>;
  };
  value: any;
}

// Database User interface matching your schema
export interface DBUser {
  id: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  user_type: 'driver' | 'customer';
  email_verified: boolean;
  phone_verified: boolean;
  is_active: boolean;
  profile_completed: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}