// src/lib/order-api.ts
import { MICROSERVICES_CONFIG } from '../config/environment';
import { getAuthToken } from './api';

// Order Service base URL (port 3004)
const ORDER_SERVICE_URL = 'http://localhost:3004';

async function makeOrderRequest<T = any>(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  includeServiceSecret: boolean = false
): Promise<{
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  status?: number;
}> {
  try {
    const token = getAuthToken();
    const url = `${ORDER_SERVICE_URL}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // For order creation, need service secret
    if (includeServiceSecret) {
      headers['x-service-secret'] = 'shared_service_secret_key_1234567890';
    }

    const config: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    console.log(`🌐 Order Service ${method} ${url}`);

    const response = await fetch(url, config);
    const data = await response.json();

    console.log(`📨 Order Service ${response.status}:`, data);

    if (response.status === 401) {
      return {
        success: false,
        error: 'Session expired. Please login again.',
        status: 401,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.message || `HTTP ${response.status}`,
        status: response.status,
      };
    }

    return {
      success: true,
      data: data.data || data,
      message: data.message,
      status: response.status,
    };
  } catch (error: any) {
    console.error('❌ Order Service Error:', error);
    return {
      success: false,
      error: error.message || 'Network error',
      status: 0,
    };
  }
}

export const orderApi = {
  // Create order from booking form
  createOrder: async (orderData: any) => {
    return makeOrderRequest('/api/orders/receive', 'POST', orderData, true);
  },

  // Get order with progress tracking
  getOrderProgress: async (orderId: string) => {
    return makeOrderRequest(`/api/orders/${orderId}/progress`, 'GET');
  },

  // Get order tracking data
  getOrderTracking: async (orderId: string) => {
    return makeOrderRequest(`/api/orders/${orderId}/tracking`, 'GET');
  },

  // Get order messages
  getOrderMessages: async (orderId: string) => {
    return makeOrderRequest(`/api/orders/${orderId}/messages`, 'GET');
  },

  // Send message
  sendMessage: async (orderId: string, content: string) => {
    return makeOrderRequest(`/api/orders/${orderId}/messages`, 'POST', { content });
  },

  // Rate driver
  rateDriver: async (orderId: string, rating: number, review?: string) => {
    return makeOrderRequest(`/api/orders/${orderId}/rate`, 'POST', { rating, review });
  },

  // Get user balance
  getBalance: async () => {
    return makeOrderRequest('/api/balance', 'GET');
  },

  // Get customer orders
  getCustomerOrders: async (status?: string, page: number = 1, limit: number = 20) => {
    let url = `/api/customer/orders?page=${page}&limit=${limit}`;
    if (status) url += `&status=${status}`;
    return makeOrderRequest(url, 'GET');
  },

  // Get driver orders
  getDriverOrders: async (status?: string, page: number = 1, limit: number = 20) => {
    let url = `/api/driver/orders?page=${page}&limit=${limit}`;
    if (status) url += `&status=${status}`;
    return makeOrderRequest(url, 'GET');
  },

  // Driver accepts order
  acceptOrder: async (orderId: string) => {
    return makeOrderRequest(`/api/orders/${orderId}/accept`, 'POST', {});
  },

  // Driver rejects order
  rejectOrder: async (orderId: string, reason?: string) => {
    return makeOrderRequest(`/api/orders/${orderId}/reject`, 'POST', { reason });
  },

  // Driver updates order status
  updateOrderStatus: async (orderId: string, status: string, location?: { lat: number; lng: number }) => {
    return makeOrderRequest(`/api/orders/${orderId}/status`, 'PATCH', { status, location });
  },

  // Get driver optimized route
  getOptimizedRoute: async () => {
    return makeOrderRequest('/api/driver/route/optimized', 'GET');
  },

  // Get notifications (polling)
  getNotifications: async (markAsRead: boolean = false) => {
    return makeOrderRequest(`/api/notifications?markAsRead=${markAsRead}`, 'GET');
  },
};

export default orderApi;