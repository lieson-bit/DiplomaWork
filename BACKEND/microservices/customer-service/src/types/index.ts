// Customer types
export interface Customer {
  id: string;
  userId: string;
  accountType: 'personal' | 'business';
  dateOfBirth?: Date;
  businessName?: string;
  businessType?: string;
  businessPhone?: string;
  taxId?: string;
  joinDate: Date;
  totalOrders: number;
  totalSpent: number;
  averageRating: number;
  loyaltyPoints: number;
  status: 'active' | 'inactive' | 'suspended';
  membershipLevel: 'standard' | 'premium' | 'business';
  profilePictureUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  label: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerPreference {
  id: string;
  customerId: string;
  defaultPickupType: 'home' | 'business' | 'other';
  defaultPaymentId?: string;
  notificationEmail: boolean;
  notificationSMS: boolean;
  notificationPush: boolean;
  shareLocationData: boolean;
  shareUsageAnalytics: boolean;
  marketingEmails: boolean;
  language: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerPaymentMethod {
  id: string;
  customerId: string;
  type: 'card' | 'paypal' | 'apple_pay' | 'google_pay' | 'bank_transfer';
  provider: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  nameOnCard?: string;
  paypalEmail?: string;
  bankName?: string;
  accountNumberMasked?: string;
  isDefault: boolean;
  isActive: boolean;
  token?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryTimeSlot {
  id: string;
  customerId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerFeedback {
  id: string;
  customerId: string;
  orderId?: string;
  rating: number;
  comment?: string;
  category: 'delivery' | 'driver' | 'packaging' | 'app' | 'other';
  status: 'pending' | 'reviewed' | 'resolved';
  response?: string;
  respondedBy?: string;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerFavorite {
  id: string;
  customerId: string;
  favoriteType: 'driver' | 'delivery_address' | 'pickup_location';
  referenceId: string;
  notes?: string;
  createdAt: Date;
}

// Database query result types (arrays from MySQL)
export interface DBCustomer extends Customer {}
export interface DBCustomerAddress extends CustomerAddress {}
export interface DBCustomerPreference extends CustomerPreference {}
export interface DBCustomerPaymentMethod extends CustomerPaymentMethod {}
export interface DBDeliveryTimeSlot extends DeliveryTimeSlot {}
export interface DBCustomerFeedback extends CustomerFeedback {}

// Count result type
export interface CountResult {
  count: number;
}

// Aggregation result types
export interface AvgRatingResult {
  avg_rating: number;
}

export interface TotalCountResult {
  total: number;
}

// Request/Response types
export interface CreateCustomerDto {
  userId: string;
  accountType?: 'personal' | 'business';
  dateOfBirth?: string;
  businessName?: string;
  businessType?: string;
  businessPhone?: string;
  taxId?: string;
}

export interface UpdateCustomerDto {
  accountType?: 'personal' | 'business';
  dateOfBirth?: string;
  businessName?: string;
  businessType?: string;
  businessPhone?: string;
  taxId?: string;
  profilePictureUrl?: string;
}

export interface AddressDto {
  label: string;
  address: string;
  city: string;
  state: string;
  country?: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
  notes?: string;
}

export interface PaymentMethodDto {
  type: 'card' | 'paypal' | 'apple_pay' | 'google_pay' | 'bank_transfer';
  provider: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  nameOnCard?: string;
  paypalEmail?: string;
  bankName?: string;
  accountNumberMasked?: string;
  isDefault?: boolean;
  token?: string;
}

export interface PreferencesDto {
  defaultPickupType?: 'home' | 'business' | 'other';
  defaultPaymentId?: string;
  notificationEmail?: boolean;
  notificationSMS?: boolean;
  notificationPush?: boolean;
  shareLocationData?: boolean;
  shareUsageAnalytics?: boolean;
  marketingEmails?: boolean;
  language?: string;
  timezone?: string;
}

export interface TimeSlotDto {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}

export interface FeedbackDto {
  orderId?: string;
  rating: number;
  comment?: string;
  category?: 'delivery' | 'driver' | 'packaging' | 'app' | 'other';
}

export interface CustomerStats {
  totalOrders: number;
  totalSpent: number;
  averageRating: number;
  loyaltyPoints: number;
  membershipLevel: string;
  addressesCount: number;
  paymentMethodsCount: number;
  feedbackCount: number;
  memberSince: Date;
  accountAgeDays: number;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface AuthUser {
  userId: string;
  userType: string;
  email: string;
}

// Database query generic type
export type QueryResult<T> = T[];