export interface Order {
  id: string;
  orderId: string;
  orderNumber: string;
  status: 'pending' | 'driver_assigned' | 'route_to_pickup' | 'in_transit' | 'delivered' | 'cancelled' | 'completed';
  createdAt: Date;
  lastUpdated: Date;
  
  // Customer Info
  customerInfo: {
    id: string;
    name: string;
    email: string;
    phone: string;
    userType: 'customer';
  };
  
  // Locations
  locations: {
    pickup: {
      address: string;
      coordinates: {
        lat: number;
        lng: number;
      };
      geocoded: boolean;
      geocodingMethod: string;
      accuracy: string;
    };
    delivery: {
      address: string;
      coordinates: {
        lat: number;
        lng: number;
      };
      geocoded: boolean;
      geocodingMethod: string;
      accuracy: string;
    };
    distance: {
      km: number;
      miles: number;
    };
  };
  
  // Package Details
  packageDetails: {
    category: string;
    categoryLabel: string;
    weight: {
      value: number;
      unit: 'kg';
    };
    volume: {
      value: number;
      unit: 'm³';
    };
    urgency: 'normal' | 'urgent' | 'express';
    urgencyLabel: string;
  };
  
  // Special Requirements
  specialRequirements: {
    fragile: boolean;
    refrigerated: boolean;
    oversized: boolean;
    hazardous: boolean;
    requirementsList: string[];
  };
  
  // Driver Info
  driverInfo: {
    id: string;
    driverId: string;
    userId: string;
    name: string;
    phone: string;
    email: string;
    rating: number;
    matchScore: number;
    suitability: 'excellent' | 'good' | 'fair' | 'poor';
    estimatedArrival: string;
    profileImage?: string;
  };
  
  // Vehicle Info
  vehicleInfo: {
    type: string;
    typeFormatted: string;
    make: string;
    model: string;
    licensePlate: string;
    capacity: {
      maxWeight: number;
      maxVolume: number;
      unit: {
        weight: string;
        volume: string;
      };
    };
    imageUrl: string;
    imageError: boolean;
  };
  
  // Pricing
  pricing: {
    estimatedPrice: {
      usd: number;
      rub: number;
      formatted: {
        usd: string;
        rub: string;
      };
    };
    confidenceInterval: {
      low: number;
      high: number;
      formatted: string;
    };
    currency: string;
    baseCurrency: string;
  };
  
  // Timing
  timing: {
    estimatedDuration: {
      minutes: number;
      text: string;
      formatted: string;
    };
    pickupTime: {
      estimated: Date;
      driverArrival: string;
    };
    deliveryTime: {
      estimated: Date;
      scheduled: Date;
    };
    urgencyLevel: string;
    serviceHours: string;
  };
  
  
  // System Info
  systemInfo: {
    geocodingStatus: {
      pickup: string;
      delivery: string;
    };
    calculationTimestamp: string;
    apiVersion: string;
    source: string;
  };
  
  // Metadata
  metadata: {
    geocodingAttempts: number;
    driverSelectionTime: Date;
    userAgent: string;
    platform: string;
  };
  
  // Additional fields for our system
  driverAccepted: boolean;
  driverAcceptedAt?: Date;
  deliveryStartedAt?: Date;
  deliveryCompletedAt?: Date;
  customerRating?: number;
  customerReview?: string;
  routeOrderIndex: number;
  progressPercentage: number;
  
  // Balance info
  amountPaid: number;
  paymentStatus: 'pending' | 'processing' | 'completed' | 'refunded';
}

// Order Progress Interface
export interface OrderProgress {
  orderPlaced: Date;
  driverAssigned?: Date;
  routeToPickup?: Date;
  inTransit?: Date;
  delivered?: Date;
  progressPercentage: number;
  currentStep: string;
}

// Message Interface for Communication
export interface OrderMessage {
  id: string;
  orderId: string;
  senderId: string;
  senderType: 'customer' | 'driver';
  senderName: string;
  senderImage?: string;
  messageType: 'text' | 'location' | 'image' | 'status_update';
  content: string;
  readStatus: boolean;
  readAt?: Date;
  createdAt: Date;
  metadata?: any;
}

// Route Optimization Interface
export interface OptimizedRoute {
  driverId: string;
  routeDate: Date;
  orders: Array<{
    orderId: string;
    orderNumber: string;
    type: 'pickup' | 'delivery';
    address: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    sequence: number;
    estimatedArrival: Date;
    actualArrival?: Date;
  }>;
  polyline: string;
  totalDistance: number;
  totalDuration: number;
  optimizationScore: number;
  estimatedFuelCost: number;
}

// User Balance Interface
export interface UserBalance {
  userId: string;
  userType: 'customer' | 'driver';
  availableBalance: number;
  pendingBalance: number;
  thisWeekSpent: number;
  thisWeekEarned: number;
  totalEarned: number;
  totalSpent: number;
  currency: string;
}

// Notification Interface
export interface Notification {
  id: string;
  userId: string;
  userType: 'customer' | 'driver';
  notificationType: 'order_created' | 'driver_assigned' | 'order_accepted' | 
                   'order_picked_up' | 'order_delivered' | 'payment_processed' |
                   'message_received' | 'rating_received' | 'route_optimized';
  title: string;
  message: string;
  orderId?: string;
  readStatus: boolean;
  data?: any;
  createdAt: Date;
}

// Driver Rating Interface
export interface DriverRating {
  orderId: string;
  customerId: string;
  driverId: string;
  rating: number; // 1-5
  review?: string;
  createdAt: Date;
}

// API Request/Response Types
export interface CreateOrderRequest {
  // Your order structure
  orderId: string;
  status: string;
  customerInfo: {
    id: string;
    name: string;
    email: string;
    phone: string;
    userType: string;
  };
  locations: {
    pickup: {
      address: string;
      coordinates: {
        lat: number;
        lng: number;
      };
    };
    delivery: {
      address: string;
      coordinates: {
        lat: number;
        lng: number;
      };
    };
    distance: {
      km: number;
      miles: number;
    };
  };
  packageDetails: {
    category: string;
    weight: {
      value: number;
      unit: string;
    };
    volume: {
      value: number;
      unit: string;
    };
    urgency: string;
  };
  driverInfo: {
    id: string;
    driverId: string;
    userId: string;
    name: string;
    phone: string;
    email: string;
    rating: number;
    matchScore: number;
  };
  vehicleInfo: {
    type: string;
    make: string;
    model: string;
    licensePlate: string;
    capacity: {
      maxWeight: number;
      maxVolume: number;
    };
  };
  pricing: {
    estimatedPrice: {
      usd: number;
      rub: number;
    };
    currency: string;
    baseCurrency: string;
  };
  timing: {
    estimatedDuration: {
      minutes: number;
    };
  };
}

export interface AcceptOrderRequest {
  orderId: string;
  driverId: string;
}

export interface UpdateOrderStatusRequest {
  orderId: string;
  status: 'driver_assigned' | 'route_to_pickup' | 'in_transit' | 'delivered' | 'cancelled';
  location?: {
    lat: number;
    lng: number;
  };
  notes?: string;
}

export interface SendMessageRequest {
  orderId: string;
  senderId: string;
  senderType: 'customer' | 'driver';
  content: string;
  messageType?: 'text' | 'location' | 'image' | 'status_update';
  metadata?: any;
}

export interface RateDriverRequest {
  orderId: string;
  rating: number; // 1-5
  review?: string;
}

// Response Types
export interface OrderResponse {
  success: boolean;
  order: Order;
  progress?: OrderProgress;
  messages?: OrderMessage[];
  driverRoute?: OptimizedRoute;
}

export interface OrdersListResponse {
  success: boolean;
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BalanceResponse {
  success: boolean;
  balance: UserBalance;
  recentTransactions: Array<{
    id: string;
    amount: number;
    type: string;
    description: string;
    date: Date;
  }>;
}

export interface RouteOptimizationResponse {
  success: boolean;
  route: OptimizedRoute;
  orders: Order[];
  estimatedSavings: {
    distance: number;
    time: number;
    fuel: number;
  };
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  status?: string;
  driverId?: string;
  customerId?: string;
  startDate?: Date;
  endDate?: Date;
}

// Location tracking
export interface LocationUpdate {
  orderId: string;
  driverId: string;
  location: {
    lat: number;
    lng: number;
  };
  speed?: number;
  bearing?: number;
  batteryLevel?: number;
  timestamp?: Date;
}

// WebSocket Events
export interface WebSocketEvent {
  type: 'location_update' | 'status_change' | 'new_message' | 'order_update' | 'notification';
  data: any;
  timestamp: Date;
}

export interface OrderProgress {
  steps: Array<{
    key: string;
    label: string;
    date?: Date;
    completed: boolean;
  }>;
  currentStep: string;
  progressPercentage: number;
  currentStatus: string;
}

export interface OrderWithProgress extends Order {
  progress: OrderProgress;
  unreadMessages?: number;
  currentLocation?: {
    latitude: number;
    longitude: number;
    lastUpdated: Date;
  };
}
export interface WebSocketEvent {
  type: 'location_update' | 'status_change' | 'new_message' | 'order_update' | 
        'notification';
  data: any;
  timestamp: Date;
}