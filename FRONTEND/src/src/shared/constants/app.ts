// Application-wide constants

export const APP_NAME = 'DeliveryHub';

export const VEHICLE_TYPES = [
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'car', label: 'Car' },
  { value: 'van', label: 'Van' },
  { value: 'truck', label: 'Truck' },
] as const;

export const ORDER_STATUSES = {
  PENDING: 'pending',
  MATCHED: 'matched',
  ACCEPTED: 'accepted',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const PAYMENT_METHODS = {
  CARD: 'card',
  CASH: 'cash',
  WALLET: 'wallet',
} as const;

export const USER_ROLES = {
  DRIVER: 'driver',
  CUSTOMER: 'customer',
} as const;

export const VERIFICATION_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
} as const;

export const DRIVER_STATUS = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  OFFLINE: 'offline',
} as const;

export const NOTIFICATION_TYPES = {
  ORDER: 'order',
  PAYMENT: 'payment',
  SYSTEM: 'system',
  MESSAGE: 'message',
} as const;
