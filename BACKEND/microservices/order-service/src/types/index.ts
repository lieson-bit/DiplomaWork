export interface OrderReceiveRequest {
  orderId?: string;
  status: string;
  createdAt: string;
  lastUpdated: string;
  customerInfo: CustomerInfo;
  locations: Locations;
  packageDetails: PackageDetails;
  specialRequirements: SpecialRequirements;
  driverInfo: DriverInfo;
  vehicleInfo: VehicleInfo;
  pricing: Pricing;
  timing: Timing;
  systemInfo: SystemInfo;
  metadata: Metadata;
}

// Make sure all these interfaces are also exported:
export interface CustomerInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
  userType: string;
}

export interface Locations {
  pickup: LocationPoint;
  delivery: LocationPoint;
  distance: Distance;
}

export interface LocationPoint {
  address: string;
  coordinates: Coordinates;
  geocoded?: boolean;
  geocodingMethod?: string;
  accuracy?: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Distance {
  km: number;
  miles?: number;
}

export interface PackageDetails {
  category: string;
  categoryLabel?: string;
  weight: Weight;
  volume: Volume;
  urgency: string;
  urgencyLabel?: string;
}

export interface Weight {
  value: number;
  unit: string;
}

export interface Volume {
  value: number;
  unit: string;
}

export interface SpecialRequirements {
  fragile: boolean;
  refrigerated: boolean;
  oversized: boolean;
  hazardous: boolean;
  requirementsList?: string[];
}

export interface DriverInfo {
  id: string;
  driverId: string;
  userId?: string;
  name: string;
  phone: string;
  email: string;
  rating: number;
  matchScore: number;
  suitability?: string;
  estimatedArrival?: string;
}

export interface VehicleInfo {
  type: string;
  typeFormatted?: string;
  make: string;
  model: string;
  licensePlate: string;
  capacity: VehicleCapacity;
  imageUrl?: string;
  imageError?: boolean;
}

export interface VehicleCapacity {
  maxWeight: number;
  maxVolume: number;
  unit?: {
    weight: string;
    volume: string;
  };
}

export interface Pricing {
  estimatedPrice: EstimatedPrice;
  confidenceInterval?: ConfidenceInterval;
  currency: string;
  baseCurrency: string;
}

export interface EstimatedPrice {
  usd: number;
  rub: number;
  formatted?: {
    usd: string;
    rub: string;
  };
}

export interface ConfidenceInterval {
  low: number;
  high: number;
  formatted?: string;
}

export interface Timing {
  estimatedDuration: EstimatedDuration;
  pickupTime: PickupTime;
  deliveryTime: DeliveryTime;
  urgencyLevel?: string;
  serviceHours?: string;
}

export interface EstimatedDuration {
  minutes: number;
  text?: string;
  formatted?: string;
}

export interface PickupTime {
  estimated: string;
  driverArrival?: string;
}

export interface DeliveryTime {
  estimated: string;
  scheduled?: string;
}

export interface SystemInfo {
  geocodingStatus: {
    pickup: string;
    delivery: string;
  };
  calculationTimestamp: string;
  apiVersion: string;
  source: string;
}

export interface Metadata {
  geocodingAttempts: number;
  driverSelectionTime: string;
  userAgent: string;
  platform: string;
}

















export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  driver_id: string | null;
  
  // Status tracking
  status: 'pending' | 'driver_assigned' | 'route_to_pickup' | 'in_transit' | 'delivered' | 'cancelled' | 'completed';
  
  // Customer Info
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  
  // Locations
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  
  delivery_address: string;
  delivery_latitude: number;
  delivery_longitude: number;
  
  distance_km: number;
  
  // Package Details
  package_category: string;
  weight_kg: number;
  volume_m3: number;
  urgency: 'normal' | 'high' | 'urgent';
  
  // Special Requirements
  fragile: boolean;
  refrigerated: boolean;
  oversized: boolean;
  hazardous: boolean;
  
  // Driver Info
  driver_name: string | null;
  driver_phone: string | null;
  driver_email: string | null;
  driver_rating: number | null;
  driver_match_score: number | null;
  
  // Vehicle Info
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_license_plate: string | null;
  vehicle_image_url: string | null;
  vehicle_max_weight: number | null;
  vehicle_max_volume: number | null;
  
  // Pricing
  estimated_price_usd: number;
  estimated_price_local: number;
  currency: string;
  base_currency: string;
  
  // Timing
  estimated_duration_minutes: number;
  pickup_time_estimated: Date | null;
  delivery_time_estimated: Date | null;
  
  // Route Optimization
  route_polyline: string | null;
  route_order_index: number;
  
  // Payment
  amount_paid: number;
  payment_status: 'pending' | 'processing' | 'completed' | 'refunded';
  
  // Driver acceptance
  driver_accepted: boolean;
  driver_accepted_at: Date | null;
  
  // Delivery tracking
  delivery_started_at: Date | null;
  delivery_completed_at: Date | null;
  
  // Rating
  customer_rating: number | null;
  customer_review: string | null;
  rating_given_at: Date | null;
  
  // Communication
  unread_customer_messages: number;
  unread_driver_messages: number;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
}



// Order Progress Interface
export interface OrderProgress {
  steps: Array<{
    status: Order['status'];
    label: string;
    completed: boolean;
    timestamp?: Date;
  }>;
  currentStatus: Order['status'];
  progressPercentage: number;
  nextStep?: Order['status'];
}

// Message Interface for Communication
export interface OrderMessage {
  id: string;
  order_id: string;
  sender_id: string;
  sender_type: 'customer' | 'driver';
  sender_name?: string;
  sender_image?: string;
  message_type: 'text' | 'location' | 'image' | 'status_update';
  content: string;
  read_status: boolean;
  read_at?: Date;
  created_at: Date;
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
  id: string;
  driver_id: string;
  order_id: string;
  customer_id: string;
  rating: number;
  review: string | null;
  created_at: Date;
}

// API Request/Response Types
export interface CreateOrderRequest {
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  
  // Locations
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  delivery_address: string;
  delivery_latitude: number;
  delivery_longitude: number;
  distance_km: number;
  
  // Package Details
  package_category: string;
  weight_kg: number;
  volume_m3: number;
  urgency: 'normal' | 'high' | 'urgent';
  
  // Special Requirements
  fragile: boolean;
  refrigerated: boolean;
  oversized: boolean;
  hazardous: boolean;
  
  // Driver Info (optional on creation)
  driver_id?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  driver_email?: string | null;
  driver_rating?: number | null;
  driver_match_score?: number | null;
  
  // Vehicle Info (optional on creation)
  vehicle_type?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_license_plate?: string | null;
  vehicle_image_url?: string | null;
  vehicle_max_weight?: number | null;
  vehicle_max_volume?: number | null;
  
  // Pricing
  estimated_price_usd: number;
  estimated_price_local: number;
  currency?: string;
  base_currency?: string;
  
  // Timing
  estimated_duration_minutes: number;
  pickup_time_estimated?: Date | null;
  delivery_time_estimated?: Date | null;
  
  // Route Optimization
  route_polyline?: string | null;
  route_order_index?: number;
  
  // Payment (optional with defaults)
  amount_paid?: number;
  payment_status?: 'pending' | 'processing' | 'completed' | 'refunded';
}

export interface UpdateOrderRequest {
  driver_id?: string | null;
  status?: Order['status'];
  
  // Driver acceptance
  driver_accepted?: boolean;
  driver_accepted_at?: Date | null;
  
  // Delivery tracking
  delivery_started_at?: Date | null;
  delivery_completed_at?: Date | null;
  
  // Rating
  customer_rating?: number | null;
  customer_review?: string | null;
  rating_given_at?: Date | null;
  
  // Communication
  unread_customer_messages?: number;
  unread_driver_messages?: number;
  
  // Payment
  amount_paid?: number;
  payment_status?: Order['payment_status'];
  
  // Route Optimization
  route_order_index?: number;
  route_polyline?: string | null;
  
  // Timestamps will be auto-updated
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

export interface OrderResponse {
  id: string;
  order_number: string;
  status: Order['status'];
  customer_info: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  driver_info?: {
    id: string | null;
    name: string | null;
    phone: string | null;
    email: string | null;
    rating: number | null;
  };
  pickup_location: {
    address: string;
    latitude: number;
    longitude: number;
  };
  delivery_location: {
    address: string;
    latitude: number;
    longitude: number;
  };
  package_details: {
    category: string;
    weight_kg: number;
    volume_m3: number;
    urgency: string;
    fragile: boolean;
    refrigerated: boolean;
  };
  pricing: {
    estimated_usd: number;
    estimated_local: number;
    currency: string;
    amount_paid: number;
    payment_status: Order['payment_status'];
  };
  timing: {
    estimated_duration_minutes: number;
    pickup_time_estimated: Date | null;
    delivery_time_estimated: Date | null;
    created_at: Date;
  };
  progress: OrderProgress;
}

export interface ApiOrderRequest {
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  delivery_address: string;
  delivery_latitude: number;
  delivery_longitude: number;
  distance_km: number;
  package_category: string;
  weight_kg: number;
  volume_m3: number;
  urgency: 'normal' | 'high' | 'urgent';
  fragile: boolean;
  refrigerated: boolean;
  oversized: boolean;
  hazardous: boolean;
  estimated_price_usd: number;
  estimated_price_local: number;
  estimated_duration_minutes: number;
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
    status: 'pending' | 'driver_assigned' | 'route_to_pickup' | 'in_transit' | 'delivered' | 'cancelled' | 'completed';
    label: string;
    completed: boolean;
    timestamp?: Date;
  }>;
  currentStatus: 'pending' | 'driver_assigned' | 'route_to_pickup' | 'in_transit' | 'delivered' | 'cancelled' | 'completed';
  progressPercentage: number;
  nextStep?: 'pending' | 'driver_assigned' | 'route_to_pickup' | 'in_transit' | 'delivered' | 'cancelled' | 'completed';
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

export interface DriverVehicle {
  id: string;
  type: string;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  maxWeight: number;
  maxVolume: number;
  imageUrl: string;
  currentStatus: string;
  createdAt: string;
}

export interface DriverProfilePicture {
  originalUrl: string;
  thumbnailUrl: string;
  smallUrl: string;
  mediumUrl: string;
}

export interface DriverVehiclesResponse {
  success: boolean;
  data: {
    driverId: string;
    profilePicture: DriverProfilePicture;
    vehicles: DriverVehicle[];
  };
}




