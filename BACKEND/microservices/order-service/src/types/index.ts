// Order Types
export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  driverId?: string;
  
  // Pickup Information
  pickupAddress: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  pickupContactName?: string;
  pickupContactPhone?: string;
  pickupInstructions?: string;
  
  // Delivery Information  
  deliveryAddress: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  deliveryInstructions?: string;
  
  // Package Information
  totalWeightKg?: number;
  totalVolumeM3?: number;
  packageDescription?: string;
  fragileItems: boolean;
  temperatureControlled: boolean;
  
  // Pricing & Payment
  basePrice: number;
  distanceFee: number;
  weightFee: number;
  volumeFee: number;
  rushFee: number;
  fuelSurcharge: number;
  tipAmount: number;
  taxAmount: number;
  
  // Platform Fees
  platformFee: number;
  platformFeePercent: number;
  
  // Final Prices
  subtotalPrice: number;
  totalPrice: number;
  driverEarnings: number;
  
  // Payment Status
  paymentStatus: 'pending' | 'authorized' | 'completed' | 'refunded' | 'failed';
  paymentMethod?: string;
  paymentTransactionId?: string;
  paymentProcessedAt?: Date;
  
  // Route Information
  estimatedDistanceKm?: number;
  estimatedDurationMinutes?: number;
  actualDistanceKm?: number;
  actualDurationMinutes?: number;
  routePolyline?: string;
  
  // Status & Timing
  status: 'pending' | 'matched' | 'driver_accepted' | 'driver_enroute' | 
          'pickup_started' | 'in_transit' | 'arrived' | 'delivered' | 
          'completed' | 'cancelled' | 'failed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  
  // Timestamps
  createdAt: Date;
  scheduledPickupAt?: Date;
  matchedAt?: Date;
  acceptedAt?: Date;
  pickupStartedAt?: Date;
  inTransitAt?: Date;
  deliveredAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  
  // Driver Location Tracking
  driverCurrentLat?: number;
  driverCurrentLng?: number;
  driverLastUpdated?: Date;
  
  // Customer & Driver Balance Updates
  customerBalanceUpdated: boolean;
  driverBalanceUpdated: boolean;
  balanceUpdateAttempts: number;
  
  // Additional metadata
  isBulkOrder: boolean;
  bulkOrderId?: string;
  
  // Internal notes
  internalNotes?: string;
  customerNotes?: string;
  driverNotes?: string;
  
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  itemName: string;
  itemDescription?: string;
  quantity: number;
  weightPerItemKg?: number;
  dimensionsLengthCm?: number;
  dimensionsWidthCm?: number;
  dimensionsHeightCm?: number;
  valuePerItem?: number;
  fragile: boolean;
  liquid: boolean;
  temperatureSensitive: boolean;
  specialHandling?: string;
  barcode?: string;
  sku?: string;
  createdAt: Date;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  previousStatus?: string;
  newStatus: string;
  changedBy?: string;
  changeReason?: string;
  notes?: string;
  timestamp: Date;
}

export interface OrderPayment {
  id: string;
  orderId: string;
  transactionId?: string;
  amount: number;
  feeAmount: number;
  netAmount: number;
  paymentMethod?: string;
  status: 'pending' | 'completed' | 'refunded' | 'failed';
  customerBalanceBefore?: number;
  customerBalanceAfter?: number;
  driverBalanceBefore?: number;
  driverBalanceAfter?: number;
  processedAt: Date;
}

export interface BulkOrder {
  id: string;
  customerId: string;
  bulkOrderName: string;
  totalOrders: number;
  completedOrders: number;
  failedOrders: number;
  cancelledOrders: number;
  totalEstimatedCost: number;
  totalActualCost: number;
  uploadFileUrl?: string;
  processingStatus: string;
  processingErrorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface OrderCancellation {
  id: string;
  orderId: string;
  cancelledBy: string;
  cancellationReason: string;
  detailedReason?: string;
  refundAmount: number;
  refundProcessed: boolean;
  cancelledAt: Date;
}

// Service Types
export interface CreateOrderRequest {
  customerId: string;
  pickupAddress: string;
  deliveryAddress: string;
  pickupContactName?: string;
  pickupContactPhone?: string;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  packageDescription?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  fragileItems?: boolean;
  temperatureControlled?: boolean;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  scheduledPickupAt?: Date;
  customerNotes?: string;
  isBulkOrder?: boolean;
  bulkOrderId?: string;
}

export interface UpdateOrderRequest {
  pickupAddress?: string;
  deliveryAddress?: string;
  pickupContactName?: string;
  pickupContactPhone?: string;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  packageDescription?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  fragileItems?: boolean;
  temperatureControlled?: boolean;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  scheduledPickupAt?: Date;
  customerNotes?: string;
}

export interface OrderFilter {
  customerId?: string;
  driverId?: string;
  status?: string | string[];
  paymentStatus?: string | string[];
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  isBulkOrder?: boolean;
  bulkOrderId?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Driver Matching Types
export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  vehicleType: string;
  vehicleCapacity: {
    weight: number;
    volume: number;
    maxItems: number;
  };
  currentLocation: {
    lat: number;
    lng: number;
  };
  status: 'available' | 'busy' | 'offline';
  rating: number;
  totalDeliveries: number;
  isVerified: boolean;
}

export interface MatchingCriteria {
  maxDistance: number;
  minRating: number;
  vehicleType?: string;
  requiresVerification: boolean;
  prioritizeNearby: boolean;
}

// Payment Types
export interface PaymentCard {
  id: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export type PaymentMethod = 'card' | 'wallet' | 'cash' | 'bank_transfer';
export type PaymentStatus = 'pending' | 'authorized' | 'completed' | 'refunded' | 'failed';

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

export type NotificationType = 
  | 'order_created'
  | 'order_accepted'
  | 'order_picked_up'
  | 'order_delivered'
  | 'order_cancelled'
  | 'payment_received'
  | 'payment_failed'
  | 'driver_assigned'
  | 'driver_enroute'
  | 'driver_arrived'
  | 'rating_received'
  | 'bulk_order_complete'
  | 'promotional'
  | 'system_alert';

// Tracking Types
export interface LocationUpdate {
  orderId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  bearing?: number;
  accuracy?: number;
  batteryLevel?: number;
  timestamp?: Date;
}

export interface TrackingData {
  orderId: string;
  driverId: string;
  locations: Array<{
    latitude: number;
    longitude: number;
    timestamp: Date;
    speed?: number;
    bearing?: number;
  }>;
  summary: {
    totalDistance: number;
    totalDuration: number;
    averageSpeed: number;
    maxSpeed: number;
    startTime: Date;
    endTime?: Date;
  };
}

// Configuration Types
export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  pool: {
    min: number;
    max: number;
    idleTimeout: number;
  };
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  ttl?: number;
}

export interface ExternalServiceConfig {
  paymentGatewayUrl: string;
  paymentGatewayApiKey: string;
  geocodingApiUrl: string;
  geocodingApiKey: string;
  routingApiUrl: string;
  routingApiKey: string;
  smsServiceUrl: string;
  smsServiceApiKey: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  details?: any[];
  timestamp: string;
}

// WebSocket Types
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}

export interface WebSocketConnection {
  connectionId: string;
  userId: string;
  userType: 'customer' | 'driver' | 'admin';
  connectedAt: Date;
  lastActivity: Date;
}

// Utility Types
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DistanceMatrix {
  distances: number[][];
  durations: number[][];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Event Types
export interface OrderEvent {
  type: 'order_created' | 'order_updated' | 'order_status_changed' | 'order_cancelled';
  orderId: string;
  data: any;
  timestamp: Date;
}

export interface PaymentEvent {
  type: 'payment_processed' | 'payment_failed' | 'payment_refunded';
  orderId: string;
  data: any;
  timestamp: Date;
}

export interface DriverEvent {
  type: 'driver_assigned' | 'driver_location_updated' | 'driver_status_changed';
  orderId: string;
  driverId: string;
  data: any;
  timestamp: Date;
}

// Export all types
export type {
  Order,
  OrderItem,
  OrderStatusHistory,
  OrderPayment,
  BulkOrder,
  OrderCancellation,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderFilter,
  PaginationParams,
  PaginatedResponse,
  Driver,
  MatchingCriteria,
  PaymentCard,
  PaymentMethod,
  PaymentStatus,
  Notification,
  NotificationType,
  LocationUpdate,
  TrackingData,
  DatabaseConfig,
  RedisConfig,
  ExternalServiceConfig,
  ApiResponse,
  WebSocketMessage,
  WebSocketConnection,
  Coordinates,
  DistanceMatrix,
  ValidationError,
  OrderEvent,
  PaymentEvent,
  DriverEvent
};