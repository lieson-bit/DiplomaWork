// Driver Service API - Port 3002

import { apiClient } from '../lib/api-client';
import { MICROSERVICES_CONFIG, ENABLE_MOCK_API } from '../config/environment';
import type { Driver, ApiResponse, PaginatedResponse } from '../types';

const BASE_URL = MICROSERVICES_CONFIG.DRIVER_SERVICE.baseUrl;

const mockDriver: Driver = {
  id: '1',
  userId: '1',
  licenseNumber: 'DL123456',
  licenseExpiry: '2026-12-31',
  vehicleType: 'van',
  vehiclePlate: 'ABC-1234',
  vehicleCapacityKg: 1000,
  vehicleCapacityM3: 10,
  status: 'available',
  rating: 4.5,
  totalTrips: 150,
  verificationStatus: 'verified',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const driverService = {
  async createProfile(data: Partial<Driver>): Promise<ApiResponse<Driver>> {
    if (ENABLE_MOCK_API) {
      return { success: true, data: { ...mockDriver, ...data, id: Math.random().toString() } };
    }
    return apiClient.post(`${BASE_URL}/api/drivers`, data);
  },

  async getProfile(driverId: string): Promise<ApiResponse<Driver>> {
    if (ENABLE_MOCK_API) {
      return { success: true, data: mockDriver };
    }
    return apiClient.get(`${BASE_URL}/api/drivers/${driverId}`);
  },

  async updateProfile(driverId: string, data: Partial<Driver>): Promise<ApiResponse<Driver>> {
    if (ENABLE_MOCK_API) {
      return { success: true, data: { ...mockDriver, ...data } };
    }
    return apiClient.put(`${BASE_URL}/api/drivers/${driverId}`, data);
  },

  async updateStatus(driverId: string, status: 'available' | 'busy' | 'offline'): Promise<ApiResponse<Driver>> {
    if (ENABLE_MOCK_API) {
      return { success: true, data: { ...mockDriver, status } };
    }
    return apiClient.patch(`${BASE_URL}/api/drivers/${driverId}/status`, { status });
  },

  async updateLocation(driverId: string, latitude: number, longitude: number): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true };
    }
    return apiClient.post(`${BASE_URL}/api/drivers/${driverId}/location`, { latitude, longitude });
  },

  async getEarnings(driverId: string, startDate?: string, endDate?: string): Promise<ApiResponse<{
    total: number;
    byDate: Array<{ date: string; amount: number }>;
  }>> {
    if (ENABLE_MOCK_API) {
      return {
        success: true,
        data: {
          total: 5420.50,
          byDate: [
            { date: '2025-10-01', amount: 450 },
            { date: '2025-10-02', amount: 520 },
            { date: '2025-10-03', amount: 380 },
          ],
        },
      };
    }
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return apiClient.get(`${BASE_URL}/api/drivers/${driverId}/earnings?${params}`);
  },

  async getActiveOrders(driverId: string): Promise<ApiResponse<any[]>> {
    if (ENABLE_MOCK_API) {
      return { success: true, data: [] };
    }
    return apiClient.get(`${BASE_URL}/api/drivers/${driverId}/orders/active`);
  },

  async getOrderHistory(
    driverId: string,
    page = 1,
    pageSize = 20
  ): Promise<ApiResponse<PaginatedResponse<any>>> {
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
    return apiClient.get(`${BASE_URL}/api/drivers/${driverId}/orders/history?page=${page}&pageSize=${pageSize}`);
  },

  async uploadDocument(driverId: string, documentType: string, file: File): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true, message: 'Document uploaded successfully' };
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${BASE_URL}/api/drivers/${driverId}/documents`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    
    const data = await response.json();
    return { success: response.ok, data };
  },
};
