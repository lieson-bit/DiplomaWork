// Notification Service API - Port 3008

import { apiClient } from '../lib/api-client';
import { MICROSERVICES_CONFIG, ENABLE_MOCK_API } from '../config/environment';
import type { Notification, ApiResponse, PaginatedResponse } from '../types';

const BASE_URL = MICROSERVICES_CONFIG.NOTIFICATION_SERVICE.baseUrl;

export const notificationService = {
  async getNotifications(
    userId: string,
    page = 1,
    pageSize = 20
  ): Promise<ApiResponse<PaginatedResponse<Notification>>> {
    if (ENABLE_MOCK_API) {
      const mockNotifications: Notification[] = [
        {
          id: '1',
          userId,
          type: 'order',
          title: 'Order Confirmed',
          message: 'Your order #12345 has been confirmed',
          read: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          userId,
          type: 'payment',
          title: 'Payment Successful',
          message: 'Payment of $45.00 processed successfully',
          read: true,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
      ];
      return {
        success: true,
        data: {
          data: mockNotifications,
          total: mockNotifications.length,
          page,
          pageSize,
          totalPages: 1,
        },
      };
    }
    return apiClient.get(`${BASE_URL}/api/notifications/${userId}?page=${page}&pageSize=${pageSize}`);
  },

  async markAsRead(notificationId: string): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true };
    }
    return apiClient.patch(`${BASE_URL}/api/notifications/${notificationId}/read`);
  },

  async markAllAsRead(userId: string): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true };
    }
    return apiClient.patch(`${BASE_URL}/api/notifications/${userId}/read-all`);
  },

  async deleteNotification(notificationId: string): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true };
    }
    return apiClient.delete(`${BASE_URL}/api/notifications/${notificationId}`);
  },

  async getUnreadCount(userId: string): Promise<ApiResponse<{ count: number }>> {
    if (ENABLE_MOCK_API) {
      return { success: true, data: { count: 3 } };
    }
    return apiClient.get(`${BASE_URL}/api/notifications/${userId}/unread-count`);
  },

  async sendNotification(data: {
    userId: string;
    type: 'order' | 'payment' | 'system' | 'message';
    title: string;
    message: string;
    data?: Record<string, any>;
  }): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true };
    }
    return apiClient.post(`${BASE_URL}/api/notifications`, data);
  },

  async updateNotificationSettings(
    userId: string,
    settings: {
      emailNotifications?: boolean;
      pushNotifications?: boolean;
      smsNotifications?: boolean;
      orderUpdates?: boolean;
      paymentUpdates?: boolean;
      promotions?: boolean;
    }
  ): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true };
    }
    return apiClient.put(`${BASE_URL}/api/notifications/${userId}/settings`, settings);
  },

  async getNotificationSettings(userId: string): Promise<ApiResponse<any>> {
    if (ENABLE_MOCK_API) {
      return {
        success: true,
        data: {
          emailNotifications: true,
          pushNotifications: true,
          smsNotifications: false,
          orderUpdates: true,
          paymentUpdates: true,
          promotions: false,
        },
      };
    }
    return apiClient.get(`${BASE_URL}/api/notifications/${userId}/settings`);
  },

  subscribeToNotifications(userId: string, callback: (notification: Notification) => void): () => void {
    if (ENABLE_MOCK_API) {
      // Simulate real-time notifications
      const interval = setInterval(() => {
        if (Math.random() > 0.9) {
          callback({
            id: Math.random().toString(),
            userId,
            type: 'order',
            title: 'New Update',
            message: 'You have a new notification',
            read: false,
            createdAt: new Date().toISOString(),
          });
        }
      }, 10000);
      
      return () => clearInterval(interval);
    }

    // Real implementation would use WebSocket
    const ws = new WebSocket(`${BASE_URL.replace('http', 'ws')}/notifications/subscribe/${userId}`);
    
    ws.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      callback(notification);
    };

    return () => ws.close();
  },
};
