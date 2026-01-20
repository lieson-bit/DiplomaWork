// Tracking Service API - Port 3007

import { apiClient } from '../lib/api-client';
import { MICROSERVICES_CONFIG, ENABLE_MOCK_API } from '../config/environment';
import type { Location, Route, ApiResponse } from '../types';

const BASE_URL = MICROSERVICES_CONFIG.TRACKING_SERVICE.baseUrl;

export const trackingService = {
  async updateLocation(
    driverId: string,
    latitude: number,
    longitude: number
  ): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true };
    }
    return apiClient.post(`${BASE_URL}/api/tracking/location`, {
      driverId,
      latitude,
      longitude,
    });
  },

  async getDriverLocation(driverId: string): Promise<ApiResponse<Location>> {
    if (ENABLE_MOCK_API) {
      const mockLocation: Location = {
        latitude: 40.7128,
        longitude: -74.0060,
        timestamp: new Date().toISOString(),
      };
      return { success: true, data: mockLocation };
    }
    return apiClient.get(`${BASE_URL}/api/tracking/driver/${driverId}/location`);
  },

  async getOrderRoute(orderId: string): Promise<ApiResponse<Route>> {
    if (ENABLE_MOCK_API) {
      const mockRoute: Route = {
        orderId,
        currentLocation: {
          latitude: 40.7128,
          longitude: -74.0060,
          timestamp: new Date().toISOString(),
        },
        estimatedArrival: new Date(Date.now() + 30 * 60000).toISOString(),
        distance: 5.5,
        duration: 30,
      };
      return { success: true, data: mockRoute };
    }
    return apiClient.get(`${BASE_URL}/api/tracking/order/${orderId}/route`);
  },

  async getLocationHistory(
    driverId: string,
    startTime: string,
    endTime: string
  ): Promise<ApiResponse<Location[]>> {
    if (ENABLE_MOCK_API) {
      return { success: true, data: [] };
    }
    return apiClient.get(
      `${BASE_URL}/api/tracking/driver/${driverId}/history?startTime=${startTime}&endTime=${endTime}`
    );
  },

  async subscribeToTracking(orderId: string, callback: (location: Location) => void): () => void {
    if (ENABLE_MOCK_API) {
      // Simulate real-time updates
      const interval = setInterval(() => {
        callback({
          latitude: 40.7128 + Math.random() * 0.01,
          longitude: -74.0060 + Math.random() * 0.01,
          timestamp: new Date().toISOString(),
        });
      }, 5000);
      
      return () => clearInterval(interval);
    }

    // Real implementation would use WebSocket
    const ws = new WebSocket(`${BASE_URL.replace('http', 'ws')}/tracking/subscribe/${orderId}`);
    
    ws.onmessage = (event) => {
      const location = JSON.parse(event.data);
      callback(location);
    };

    return () => ws.close();
  },

  async estimateArrival(
    currentLat: number,
    currentLng: number,
    destLat: number,
    destLng: number
  ): Promise<ApiResponse<{ estimatedTime: string; distance: number }>> {
    if (ENABLE_MOCK_API) {
      return {
        success: true,
        data: {
          estimatedTime: new Date(Date.now() + 25 * 60000).toISOString(),
          distance: 8.5,
        },
      };
    }
    return apiClient.post(`${BASE_URL}/api/tracking/estimate-arrival`, {
      currentLat,
      currentLng,
      destLat,
      destLng,
    });
  },
};
