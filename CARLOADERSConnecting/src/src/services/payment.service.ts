// Payment Service API - Port 3006

import { apiClient } from '../lib/api-client';
import { MICROSERVICES_CONFIG, ENABLE_MOCK_API } from '../config/environment';
import type { Payment, ApiResponse } from '../types';

const BASE_URL = MICROSERVICES_CONFIG.PAYMENT_SERVICE.baseUrl;

export const paymentService = {
  async createPayment(data: {
    orderId: string;
    amount: number;
    paymentMethod: 'card' | 'cash' | 'wallet';
  }): Promise<ApiResponse<Payment>> {
    if (ENABLE_MOCK_API) {
      const mockPayment: Payment = {
        id: Math.random().toString(),
        orderId: data.orderId,
        amount: data.amount,
        currency: 'USD',
        paymentMethod: data.paymentMethod,
        status: 'completed',
        transactionId: `TXN-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { success: true, data: mockPayment };
    }
    return apiClient.post(`${BASE_URL}/api/payments`, data);
  },

  async getPayment(paymentId: string): Promise<ApiResponse<Payment>> {
    if (ENABLE_MOCK_API) {
      const mockPayment: Payment = {
        id: paymentId,
        orderId: '1',
        amount: 45.00,
        currency: 'USD',
        paymentMethod: 'card',
        status: 'completed',
        transactionId: 'TXN-ABC123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { success: true, data: mockPayment };
    }
    return apiClient.get(`${BASE_URL}/api/payments/${paymentId}`);
  },

  async processPayment(paymentId: string, paymentDetails: any): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true, message: 'Payment processed successfully' };
    }
    return apiClient.post(`${BASE_URL}/api/payments/${paymentId}/process`, paymentDetails);
  },

  async refundPayment(paymentId: string, amount?: number): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true, message: 'Refund initiated successfully' };
    }
    return apiClient.post(`${BASE_URL}/api/payments/${paymentId}/refund`, { amount });
  },

  async getPaymentHistory(userId: string, page = 1, pageSize = 20): Promise<ApiResponse<any>> {
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
    return apiClient.get(`${BASE_URL}/api/payments/user/${userId}/history?page=${page}&pageSize=${pageSize}`);
  },

  async addPaymentMethod(userId: string, paymentMethod: any): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true, data: { id: Math.random().toString(), ...paymentMethod } };
    }
    return apiClient.post(`${BASE_URL}/api/payments/methods`, { userId, ...paymentMethod });
  },

  async getPaymentMethods(userId: string): Promise<ApiResponse<any[]>> {
    if (ENABLE_MOCK_API) {
      return {
        success: true,
        data: [
          {
            id: '1',
            type: 'card',
            last4: '4242',
            brand: 'visa',
            isDefault: true,
          },
        ],
      };
    }
    return apiClient.get(`${BASE_URL}/api/payments/methods/${userId}`);
  },

  async deletePaymentMethod(methodId: string): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true };
    }
    return apiClient.delete(`${BASE_URL}/api/payments/methods/${methodId}`);
  },
};
