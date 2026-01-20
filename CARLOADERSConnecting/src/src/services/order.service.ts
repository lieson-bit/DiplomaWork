// Order Service API - Port 3004

import { apiClient } from '../lib/api-client';
import { MICROSERVICES_CONFIG, ENABLE_MOCK_API } from '../config/environment';
import type { Order, ApiResponse, PaginatedResponse } from '../types';

//const BASE_URL = MICROSERVICES_CONFIG.ORDER_SERVICE.baseUrl;

export const orderService = {
  async createOrder(data: Partial<Order>): Promise<ApiResponse<Order>> {
    if (ENABLE_MOCK_API) {
      const mockOrder: Order = {
        id: Math.random().toString(),
        customerId: data.customerId || '1',
        pickupAddress: data.pickupAddress || '',
        pickupLat: data.pickupLat || 0,
        pickupLng: data.pickupLng || 0,
        deliveryAddress: data.deliveryAddress || '',
        deliveryLat: data.deliveryLat || 0,
        deliveryLng: data.deliveryLng || 0,
        goodsType: data.goodsType || '',
        weightKg: data.weightKg || 0,
        volumeM3: data.volumeM3 || 0,
        distance: data.distance || 0,
        price: data.price || 0,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { success: true, data: mockOrder };
    }
    return apiClient.post(`${BASE_URL}/api/orders`, data);
  },

  async createBulkOrders(orders: Partial<Order>[]): Promise<ApiResponse<Order[]>> {
    if (ENABLE_MOCK_API) {
      const mockOrders = orders.map((data, index) => ({
        id: `bulk-${index}-${Math.random()}`,
        customerId: data.customerId || '1',
        pickupAddress: data.pickupAddress || '',
        pickupLat: data.pickupLat || 0,
        pickupLng: data.pickupLng || 0,
        deliveryAddress: data.deliveryAddress || '',
        deliveryLat: data.deliveryLat || 0,
        deliveryLng: data.deliveryLng || 0,
        goodsType: data.goodsType || '',
        weightKg: data.weightKg || 0,
        volumeM3: data.volumeM3 || 0,
        distance: data.distance || 0,
        price: data.price || 0,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      return { success: true, data: mockOrders };
    }
    return apiClient.post(`${BASE_URL}/api/orders/bulk`, { orders });
  },

  async getOrder(orderId: string): Promise<ApiResponse<Order>> {
    if (ENABLE_MOCK_API) {
      const mockOrder: Order = {
        id: orderId,
        customerId: '1',
        driverId: '1',
        pickupAddress: '123 Pickup St',
        pickupLat: 40.7128,
        pickupLng: -74.0060,
        deliveryAddress: '456 Delivery Ave',
        deliveryLat: 40.7580,
        deliveryLng: -73.9855,
        goodsType: 'Electronics',
        weightKg: 25,
        volumeM3: 0.5,
        distance: 15.5,
        price: 45.00,
        status: 'in_progress',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { success: true, data: mockOrder };
    }
    return apiClient.get(`${BASE_URL}/api/orders/${orderId}`);
  },

  async updateOrder(orderId: string, data: Partial<Order>): Promise<ApiResponse<Order>> {
    if (ENABLE_MOCK_API) {
      return { success: true, data: { ...data, id: orderId } as Order };
    }
    return apiClient.put(`${BASE_URL}/api/orders/${orderId}`, data);
  },

  async cancelOrder(orderId: string, reason?: string): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true, message: 'Order cancelled successfully' };
    }
    return apiClient.post(`${BASE_URL}/api/orders/${orderId}/cancel`, { reason });
  },

  async getCustomerOrders(
    customerId: string,
    page = 1,
    pageSize = 20
  ): Promise<ApiResponse<PaginatedResponse<Order>>> {
    if (ENABLE_MOCK_API) {
      return {
        success: true,
        data: {
          data: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0,
        },
      };
    }
    return apiClient.get(`${BASE_URL}/api/orders/customer/${customerId}?page=${page}&pageSize=${pageSize}`);
  },

  async getDriverOrders(
    driverId: string,
    page = 1,
    pageSize = 20
  ): Promise<ApiResponse<PaginatedResponse<Order>>> {
    if (ENABLE_MOCK_API) {
      return {
        success: true,
        data: {
          data: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0,
        },
      };
    }
    return apiClient.get(`${BASE_URL}/api/orders/driver/${driverId}?page=${page}&pageSize=${pageSize}`);
  },

  async calculatePrice(data: {
    pickupLat: number;
    pickupLng: number;
    deliveryLat: number;
    deliveryLng: number;
    weightKg: number;
    volumeM3: number;
    vehicleType: string;
  }): Promise<ApiResponse<{ price: number; distance: number }>> {
    if (ENABLE_MOCK_API) {
      const distance = Math.random() * 50 + 5;
      const price = distance * 2.5 + data.weightKg * 0.5;
      return { success: true, data: { price: parseFloat(price.toFixed(2)), distance } };
    }
    return apiClient.post(`${BASE_URL}/api/orders/calculate-price`, data);
  },
};
