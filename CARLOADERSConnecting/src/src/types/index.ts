// Shared types across the application

export interface User {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: 'driver' | 'customer';
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface Driver {
  id: string;
  userId: string;
  licenseNumber: string;
  licenseExpiry: string;
  vehicleType: string;
  vehiclePlate: string;
  vehicleCapacityKg: number;
  vehicleCapacityM3: number;
  status: 'available' | 'busy' | 'offline';
  rating: number;
  totalTrips: number;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  userId: string;
  businessName?: string;
  businessType?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  rating: number;
  totalOrders: number;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  customerId: string;
  driverId?: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  deliveryAddress: string;
  deliveryLat: number;
  deliveryLng: number;
  goodsType: string;
  weightKg: number;
  volumeM3: number;
  distance: number;
  price: number;
  status: 'pending' | 'matched' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  scheduledPickupTime?: string;
  actualPickupTime?: string;
  actualDeliveryTime?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  paymentMethod: 'card' | 'cash' | 'wallet';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'order' | 'payment' | 'system' | 'message';
  title: string;
  message: string;
  read: boolean;
  data?: Record<string, any>;
  createdAt: string;
}

export interface Location {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface Route {
  orderId: string;
  currentLocation: Location;
  estimatedArrival: string;
  distance: number;
  duration: number;
}

export interface MatchingResult {
  orderId: string;
  driverId: string;
  score: number;
  estimatedPickupTime: string;
  sharedWith?: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}


// Add proper TypeScript interfaces
export interface DriverProfile {
  id: string;
  userId: string;
  licenseNumber: string;
  licenseExpiry: string;
  insuranceNumber: string;
  insuranceExpiry: string;
  vehicleType: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  licensePlate?: string;
  vehicleColor?: string;
  maxWeight?: number;
  maxVolume?: number;
  rating: number;
  totalDeliveries: number;
  totalEarnings: number;
  completionRate: number;
  status: 'pending' | 'active' | 'suspended' | 'inactive';
  verificationLevel: 'none' | 'basic' | 'verified' | 'premium';
  isOnline: boolean;
  profileCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: string;
  driverId: string;
  type: string;
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
  expiryDate?: string;
  rejectionReason?: string;
}