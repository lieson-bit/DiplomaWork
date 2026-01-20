export interface File {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer?: Buffer;
}

// User types
export interface User {
  id: string;
  email: string;
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

// Driver types
export interface Driver {
  id: string;
  userId: string;
  licenseNumber?: string;
  licenseExpiry?: Date;
  insuranceNumber?: string;
  insuranceExpiry?: Date;
  rating: number;
  totalDeliveries: number;
  totalEarnings: number;
  completionRate: number;
  status: 'pending' | 'active' | 'suspended' | 'inactive';
  verificationLevel: 'none' | 'basic' | 'verified' | 'premium';
  onboardedAt?: Date;
  isOnline: boolean;
  currentLocation?: string;
  profileCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfilePicture {
  id: string;
  driverId: string;
  originalUrl: string;
  thumbnailUrl?: string;
  smallUrl?: string;
  mediumUrl?: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  isActive: boolean;
  uploadedAt: Date;
  updatedAt: Date;
}

export interface Vehicle {
  id: string;
  driverId: string;
  type: 'motorbike' | 'small_van' | 'medium_truck' | 'large_truck';
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  maxWeight: number;
  maxVolume: number;
  imageUrl?: string;
  isActive: boolean;
  currentStatus: 'available' | 'in_use' | 'maintenance';
  insuranceInfo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  driverId: string;
  type: 'license' | 'insurance' | 'registration' | 'inspection' | 'background_check';
  name: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  uploadDate: Date;
  expiryDate?: Date;
  rejectionReason?: string;
  verifiedBy?: string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DriverAvailability {
  id: string;
  driverId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DriverMetrics {
  id: string;
  driverId: string;
  date: Date;
  deliveriesCount: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  totalEarnings: number;
  averageRating: number;
  onlineHours: number;
  distanceTraveled: number;
  createdAt: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    message: string;
    details?: any[];
    stack?: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Request types
export interface CreateDriverRequest {
  licenseNumber?: string;
  licenseExpiry?: string;
  insuranceNumber?: string;
  insuranceExpiry?: string;
}

export interface UpdateDriverRequest {
  licenseNumber?: string;
  licenseExpiry?: string;
  insuranceNumber?: string;
  insuranceExpiry?: string;
  currentLocation?: string;
}

export interface VehicleRequest {
  type: 'motorbike' | 'small_van' | 'medium_truck' | 'large_truck';
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  maxWeight: number;
  maxVolume: number;
  imageUrl?: string; 
  insuranceInfo?: string;
}

export interface DocumentRequest {
  type: 'license' | 'insurance' | 'registration' | 'inspection' | 'background_check';
  name: string;
  expiryDate?: string;
}

export interface AvailabilityRequest {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}

export interface StatusRequest {
  isOnline: boolean;
  location?: string;
}

// Auth types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: string;
  userType: string;
  type?: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

// Express Request extension
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        userType: string;
      };
    }
  }
}