// User Service API - Port 3001

import { apiClient } from '../lib/api-client';
import { MICROSERVICES_CONFIG, ENABLE_MOCK_API } from '../config/environment';
import type { User, ApiResponse } from '../types';

const BASE_URL = MICROSERVICES_CONFIG.USER_SERVICE.baseUrl;

// Mock data for development
const mockUser: User = {
  id: '1',
  email: 'demo@example.com',
  phone: '+1234567890',
  firstName: 'John',
  lastName: 'Doe',
  role: 'customer',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const userService = {
  async register(data: {
    email: string;
    password: string;
    phone: string;
    firstName: string;
    lastName: string;
    role: 'driver' | 'customer';
  }): Promise<ApiResponse<User>> {
    if (ENABLE_MOCK_API) {
      return {
        success: true,
        data: { ...mockUser, ...data, id: Math.random().toString() },
      };
    }
    return apiClient.post(`${BASE_URL}/api/users/register`, data);
  },

  async login(email: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> {
    if (ENABLE_MOCK_API) {
      const token = 'mock-jwt-token-' + Math.random();
      localStorage.setItem('authToken', token);
      return {
        success: true,
        data: { user: mockUser, token },
      };
    }
    return apiClient.post(`${BASE_URL}/api/users/login`, { email, password });
  },

  async logout(): Promise<ApiResponse> {
    localStorage.removeItem('authToken');
    if (ENABLE_MOCK_API) {
      return { success: true };
    }
    return apiClient.post(`${BASE_URL}/api/users/logout`);
  },

  async getProfile(): Promise<ApiResponse<User>> {
    if (ENABLE_MOCK_API) {
      return { success: true, data: mockUser };
    }
    return apiClient.get(`${BASE_URL}/api/users/profile`);
  },

  async updateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
    if (ENABLE_MOCK_API) {
      return { success: true, data: { ...mockUser, ...data } };
    }
    return apiClient.put(`${BASE_URL}/api/users/profile`, data);
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true, message: 'Password changed successfully' };
    }
    return apiClient.post(`${BASE_URL}/api/users/change-password`, {
      oldPassword,
      newPassword,
    });
  },

  async requestPasswordReset(email: string): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true, message: 'Password reset email sent' };
    }
    return apiClient.post(`${BASE_URL}/api/users/reset-password`, { email });
  },

  async resetPassword(token: string, newPassword: string): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true, message: 'Password reset successfully' };
    }
    return apiClient.post(`${BASE_URL}/api/users/reset-password/${token}`, { newPassword });
  },
};
