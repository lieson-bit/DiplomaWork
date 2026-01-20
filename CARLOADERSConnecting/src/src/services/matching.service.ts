// Matching Service API - Port 3005

import { apiClient } from '../lib/api-client';
import { MICROSERVICES_CONFIG, ENABLE_MOCK_API } from '../config/environment';
import type { MatchingResult, ApiResponse } from '../types';

const BASE_URL = MICROSERVICES_CONFIG.MATCHING_SERVICE.baseUrl;

export const matchingService = {
  async findDrivers(orderId: string): Promise<ApiResponse<MatchingResult[]>> {
    if (ENABLE_MOCK_API) {
      const mockResults: MatchingResult[] = [
        {
          orderId,
          driverId: '1',
          score: 95,
          estimatedPickupTime: new Date(Date.now() + 10 * 60000).toISOString(),
          sharedWith: [],
        },
        {
          orderId,
          driverId: '2',
          score: 87,
          estimatedPickupTime: new Date(Date.now() + 15 * 60000).toISOString(),
          sharedWith: [],
        },
      ];
      return { success: true, data: mockResults };
    }
    return apiClient.post(`${BASE_URL}/api/matching/find-drivers`, { orderId });
  },

  async assignDriver(orderId: string, driverId: string): Promise<ApiResponse> {
    if (ENABLE_MOCK_API) {
      return { success: true, message: 'Driver assigned successfully' };
    }
    return apiClient.post(`${BASE_URL}/api/matching/assign`, { orderId, driverId });
  },

  async autoMatch(orderId: string): Promise<ApiResponse<MatchingResult>> {
    if (ENABLE_MOCK_API) {
      const mockResult: MatchingResult = {
        orderId,
        driverId: '1',
        score: 95,
        estimatedPickupTime: new Date(Date.now() + 10 * 60000).toISOString(),
        sharedWith: [],
      };
      return { success: true, data: mockResult };
    }
    return apiClient.post(`${BASE_URL}/api/matching/auto`, { orderId });
  },

  async findSharedDeliveries(
    pickupLat: number,
    pickupLng: number,
    deliveryLat: number,
    deliveryLng: number
  ): Promise<ApiResponse<any[]>> {
    if (ENABLE_MOCK_API) {
      return { success: true, data: [] };
    }
    return apiClient.post(`${BASE_URL}/api/matching/shared-deliveries`, {
      pickupLat,
      pickupLng,
      deliveryLat,
      deliveryLng,
    });
  },

  async optimizeRoute(driverId: string, orderIds: string[]): Promise<ApiResponse<{
    optimizedSequence: string[];
    totalDistance: number;
    totalDuration: number;
  }>> {
    if (ENABLE_MOCK_API) {
      return {
        success: true,
        data: {
          optimizedSequence: orderIds,
          totalDistance: 45.5,
          totalDuration: 120,
        },
      };
    }
    return apiClient.post(`${BASE_URL}/api/matching/optimize-route`, { driverId, orderIds });
  },
};
