// Customer Service API - Port 3003

import { apiClient } from '../lib/api-client';
import { MICROSERVICES_CONFIG, ENABLE_MOCK_API } from '../config/environment';
import type { Customer, ApiResponse } from '../types';

const BASE_URL = MICROSERVICES_CONFIG.CUSTOMER_SERVICE.baseUrl;

const mockCustomer: Customer = {
  id: '1',
  userId: '1',
  businessName: 'Test Business',
  businessType: 'retail',
  verificationStatus: 'verified',
  rating: 4.7,
  totalOrders: 45,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const customerService = {
  async createProfile(data: Partial<Customer>): Promise<ApiResponse<Customer>> {
    if (ENABLE_MOCK_API) {
      return { success: true, data: { ...mockCustomer, ...data, id: Math.random().toString() } };
    }
    return apiClient.post(`${BASE_URL}/api/customers`, data);
  },

  async getProfile(customerId: string): Promise<ApiResponse<Customer>> {
    if (ENABLE_MOCK_API) {
      return { success: true, data: mockCustomer };
    }
    return apiClient.get(`${BASE_URL}/api/customers/${customerId}`);
  },

  async updateProfile(customerId: string, data: Partial<Customer>): Promise<ApiResponse<Customer>> {
    if (ENABLE_MOCK_API) {
      return { success: true, data: { ...mockCustomer, ...data } };
    }
    return apiClient.put(`${BASE_URL}/api/customers/${customerId}`, data);
  },

  async uploadBusinessDocument(customerId: string, file: File): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true, message: 'Document uploaded successfully' };
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${BASE_URL}/api/customers/${customerId}/documents`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    
    const data = await response.json();
    return { success: response.ok, data };
  },

  async getSavedAddresses(customerId: string): Promise<ApiResponse<any[]>> {
    if (ENABLE_MOCK_API) {
      return {
        success: true,
        data: [
          {
            id: '1',
            label: 'Home',
            address: '123 Main St, City',
            latitude: 40.7128,
            longitude: -74.0060,
          },
        ],
      };
    }
    return apiClient.get(`${BASE_URL}/api/customers/${customerId}/addresses`);
  },

  async addAddress(customerId: string, address: any): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true, data: { ...address, id: Math.random().toString() } };
    }
    return apiClient.post(`${BASE_URL}/api/customers/${customerId}/addresses`, address);
  },

  async deleteAddress(customerId: string, addressId: string): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true };
    }
    return apiClient.delete(`${BASE_URL}/api/customers/${customerId}/addresses/${addressId}`);
  },
};
