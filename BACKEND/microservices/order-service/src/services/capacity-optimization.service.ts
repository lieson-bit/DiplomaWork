// services/capacity-optimization.service.ts - Fixed version

import { Logger } from '../utils/logger';
import { db } from '../config/database';
import { HttpClient } from '../utils/httpClient';
import { orderRepository } from '@/repositories/order.repository';

export interface VehicleCapacity {
  maxWeight: number; // kg
  maxVolume: number; // m³
  maxOrders: number;
  currentWeight: number;
  currentVolume: number;
  currentOrders: number;
  remainingWeight: number;
  remainingVolume: number;
  remainingOrders: number;
  utilization: {
    weight: number; // percentage
    volume: number; // percentage
    orders: number; // percentage
  };
}

export interface OrderCapacity {
  orderId: string;
  weight: number; // kg
  volume: number; // m³
  priority: 'low' | 'normal' | 'high' | 'urgent';
  pickupLocation: {
    lat: number;
    lng: number;
  };
  deliveryLocation: {
    lat: number;
    lng: number;
  };
  estimatedValue?: number;
}

export interface CapacityOptimizationResult {
  canAccept: boolean;
  reason?: string;
  capacityCheck: {
    weight: {
      required: number;
      available: number;
      passes: boolean;
    };
    volume: {
      required: number;
      available: number;
      passes: boolean;
    };
    orders: {
      required: number;
      available: number;
      passes: boolean;
    };
  };
  estimatedUtilization: {
    weight: number;
    volume: number;
    orders: number;
  };
  recommendations: string[];
}

export class CapacityOptimizationService {
  private logger: Logger;
  private httpClient: HttpClient;

  constructor() {
    this.logger = new Logger('CapacityOptimizationService');
    this.httpClient = new HttpClient();
  }

  /**
   * Check if driver can accept a new order based on vehicle capacity
   * Fetches vehicle capacity from driver service and calculates current load from orders table
   */
  async canDriverAcceptOrder(
    driverId: string,
    order: OrderCapacity,
    excludeOrderId?: string // Optional - exclude this order ID from calculation (for updates)
  ): Promise<CapacityOptimizationResult> {
    try {
      this.logger.info(`Checking capacity for driver ${driverId} to accept order ${order.orderId}`);
      
      // 1. Get vehicle capacity from driver service
      const vehicleCapacity = await this.getDriverVehicleCapacity(driverId);
      
      if (!vehicleCapacity) {
        // Default to allowing if we can't get capacity info
        this.logger.warn(`No vehicle capacity found for driver ${driverId}, defaulting to allow`);
        return {
          canAccept: true,
          capacityCheck: {
            weight: { required: order.weight, available: 100, passes: true },
            volume: { required: order.volume, available: 10, passes: true },
            orders: { required: 1, available: 10, passes: true }
          },
          estimatedUtilization: {
            weight: (order.weight / 100) * 100,
            volume: (order.volume / 10) * 100,
            orders: (1 / 10) * 100
          },
          recommendations: []
        };
      }

      // 2. Calculate current load from existing active orders
      const activeOrders = await orderRepository.getDriverActiveOrders(driverId, excludeOrderId);
      
      const currentWeight = activeOrders.reduce((sum, order) => sum + order.weight_kg, 0);
      const currentVolume = activeOrders.reduce((sum, order) => sum + order.volume_m3, 0);
      const currentOrders = activeOrders.length;

      // 3. Calculate totals with new order
      const totalWeight = currentWeight + order.weight;
      const totalVolume = currentVolume + order.volume;
      const totalOrders = currentOrders + 1;

      // 4. Check capacity constraints
      const weightPasses = totalWeight <= vehicleCapacity.maxWeight;
      const volumePasses = totalVolume <= vehicleCapacity.maxVolume;
      const ordersPasses = totalOrders <= vehicleCapacity.maxOrders;

      const canAccept = weightPasses && volumePasses && ordersPasses;

      // 5. Calculate estimated utilization
      const estimatedUtilization = {
        weight: (totalWeight / vehicleCapacity.maxWeight) * 100,
        volume: (totalVolume / vehicleCapacity.maxVolume) * 100,
        orders: (totalOrders / vehicleCapacity.maxOrders) * 100
      };

      // 6. Generate recommendations
      const recommendations: string[] = [];
      if (!canAccept) {
        if (!weightPasses) {
          recommendations.push(`Reduce weight by ${(totalWeight - vehicleCapacity.maxWeight).toFixed(2)}kg or choose a larger vehicle`);
        }
        if (!volumePasses) {
          recommendations.push(`Reduce volume by ${(totalVolume - vehicleCapacity.maxVolume).toFixed(2)}m³ or choose a larger vehicle`);
        }
        if (!ordersPasses) {
          recommendations.push(`Complete existing orders before accepting new ones (max ${vehicleCapacity.maxOrders} orders)`);
        }
      } else {
        if (estimatedUtilization.weight > 80) {
          recommendations.push('Vehicle weight capacity approaching limit');
        }
        if (estimatedUtilization.volume > 80) {
          recommendations.push('Vehicle volume capacity approaching limit');
        }
        if (estimatedUtilization.orders > 80) {
          recommendations.push('Maximum order capacity approaching limit');
        }
      }

      return {
        canAccept,
        reason: canAccept ? undefined : 'Exceeds vehicle capacity limits',
        capacityCheck: {
          weight: {
            required: totalWeight,
            available: vehicleCapacity.maxWeight,
            passes: weightPasses
          },
          volume: {
            required: totalVolume,
            available: vehicleCapacity.maxVolume,
            passes: volumePasses
          },
          orders: {
            required: totalOrders,
            available: vehicleCapacity.maxOrders,
            passes: ordersPasses
          }
        },
        estimatedUtilization,
        recommendations
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Capacity check failed for driver ${driverId}:`, errorMessage);
      
      // Return allow by default on error to not block orders
      return {
        canAccept: true,
        reason: 'Capacity check temporarily unavailable',
        capacityCheck: {
          weight: { required: order.weight, available: 0, passes: true },
          volume: { required: order.volume, available: 0, passes: true },
          orders: { required: 1, available: 0, passes: true }
        },
        estimatedUtilization: { weight: 0, volume: 0, orders: 0 },
        recommendations: ['Capacity check failed, order accepted by default']
      };
    }
  }

  /**
   * Get driver's vehicle capacity from driver service API
   */
  private async getDriverVehicleCapacity(driverId: string): Promise<VehicleCapacity | null> {
    try {
      // Call driver service API to get vehicle information
      const driverServiceUrl = process.env.DRIVER_SERVICE_URL || 'http://localhost:3002';
      const url = `${driverServiceUrl}/api/drivers/${driverId}/vehicles-picture`;
      
      this.logger.debug(`Fetching vehicle capacity from: ${url}`);
      
      const response = await this.httpClient.get(url, {
        timeout: 5000
      });
      
      if (response.data?.success && response.data?.data?.vehicles?.length > 0) {
        // Use the first vehicle (primary vehicle)
        const vehicle = response.data.data.vehicles[0];
        
        // Get current active orders from database
        const activeOrders = await this.getDriverActiveOrders(driverId);
        
        const currentWeight = activeOrders.reduce((sum, order) => sum + order.weight_kg, 0);
        const currentVolume = activeOrders.reduce((sum, order) => sum + order.volume_m3, 0);
        const currentOrders = activeOrders.length;
        
        // Get vehicle capacity with defaults
        const maxWeight = parseFloat(vehicle.maxWeight) || 100;
        const maxVolume = parseFloat(vehicle.maxVolume) || 10;
        const maxOrders = 10; // Default max orders per driver
        
        return {
          maxWeight,
          maxVolume,
          maxOrders,
          currentWeight,
          currentVolume,
          currentOrders,
          remainingWeight: Math.max(0, maxWeight - currentWeight),
          remainingVolume: Math.max(0, maxVolume - currentVolume),
          remainingOrders: Math.max(0, maxOrders - currentOrders),
          utilization: {
            weight: maxWeight > 0 ? (currentWeight / maxWeight) * 100 : 0,
            volume: maxVolume > 0 ? (currentVolume / maxVolume) * 100 : 0,
            orders: (currentOrders / maxOrders) * 100
          }
        };
      }
      
      this.logger.warn(`No vehicle found for driver ${driverId}`);
      return null;
      
    } catch (error: any) {
      this.logger.warn(`Failed to fetch vehicle capacity from driver service: ${error.message}`);
      return null;
    }
  }

  private async getDriverActiveOrders(driverId: string, excludeOrderId?: string): Promise<any[]> {
  // DELEGATE to OrderRepository instead
  try {
    const { orderRepository } = require('../repositories/order.repository');
    return await orderRepository.getDriverActiveOrders(driverId, excludeOrderId);
  } catch (error) {
    this.logger.error('Failed to get driver active orders:', error);
    return [];
  }
}

  /**
   * Get driver's active orders from database with weight and volume
   *//*
  private async getDriverActiveOrders(
    driverId: string, 
    excludeOrderId?: string
  ): Promise<any[]> {
    try {
      // Active statuses that consume capacity
      const activeStatuses = [
        'driver_assigned', 
        'route_to_pickup', 
        'in_transit'
      ];
      
      let query = `
        SELECT id, weight_kg, volume_m3 
        FROM orders 
        WHERE driver_id = ? 
          AND status IN (${activeStatuses.map(() => '?').join(',')})
      `;
      
      const params: any[] = [driverId, ...activeStatuses];
      
      if (excludeOrderId) {
        query += ' AND id != ?';
        params.push(excludeOrderId);
      }
      
      const orders = await db.query<any>(query, params);
      return orders || [];
      
    } catch (error) {
      this.logger.error('Failed to get driver active orders:', error);
      return [];
    }
  }*/

  /**
   * Check if driver can accept multiple orders at once
   */
  async canDriverAcceptMultipleOrders(
    driverId: string,
    orders: OrderCapacity[]
  ): Promise<{
    canAccept: boolean;
    capacityCheck: any;
    recommendations: string[];
  }> {
    try {
      const vehicleCapacity = await this.getDriverVehicleCapacity(driverId);

      if (!vehicleCapacity) {
        return {
          canAccept: true,
          capacityCheck: null,
          recommendations: ['Vehicle capacity information not available, orders accepted by default']
        };
      }

      // Calculate total requirements
      const totalWeight = orders.reduce((sum, order) => sum + order.weight, 0);
      const totalVolume = orders.reduce((sum, order) => sum + order.volume, 0);
      const totalOrders = orders.length;

      // Check against capacity
      const weightPasses = (vehicleCapacity.currentWeight + totalWeight) <= vehicleCapacity.maxWeight;
      const volumePasses = (vehicleCapacity.currentVolume + totalVolume) <= vehicleCapacity.maxVolume;
      const ordersPasses = (vehicleCapacity.currentOrders + totalOrders) <= vehicleCapacity.maxOrders;

      const canAccept = weightPasses && volumePasses && ordersPasses;

      const recommendations: string[] = [];
      if (!canAccept) {
        if (!weightPasses) {
          recommendations.push(`Total weight ${totalWeight}kg exceeds available capacity of ${vehicleCapacity.remainingWeight}kg`);
        }
        if (!volumePasses) {
          recommendations.push(`Total volume ${totalVolume}m³ exceeds available capacity of ${vehicleCapacity.remainingVolume}m³`);
        }
        if (!ordersPasses) {
          recommendations.push(`Too many orders (${totalOrders}) for current capacity, max additional: ${vehicleCapacity.remainingOrders}`);
        }
      }

      return {
        canAccept,
        capacityCheck: {
          weight: {
            current: vehicleCapacity.currentWeight,
            additional: totalWeight,
            total: vehicleCapacity.currentWeight + totalWeight,
            max: vehicleCapacity.maxWeight,
            remaining: vehicleCapacity.remainingWeight,
            passes: weightPasses
          },
          volume: {
            current: vehicleCapacity.currentVolume,
            additional: totalVolume,
            total: vehicleCapacity.currentVolume + totalVolume,
            max: vehicleCapacity.maxVolume,
            remaining: vehicleCapacity.remainingVolume,
            passes: volumePasses
          },
          orders: {
            current: vehicleCapacity.currentOrders,
            additional: totalOrders,
            total: vehicleCapacity.currentOrders + totalOrders,
            max: vehicleCapacity.maxOrders,
            remaining: vehicleCapacity.remainingOrders,
            passes: ordersPasses
          }
        },
        recommendations
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Multiple orders capacity check failed:', errorMessage);
      return {
        canAccept: true,
        capacityCheck: null,
        recommendations: ['Capacity check failed, orders accepted by default']
      };
    }
  }

  // Helper method to convert priority to numeric value
  priorityToValue(priority: string): number {
    switch (priority) {
      case 'urgent': return 10;
      case 'high': return 7;
      case 'normal': return 5;
      case 'low': return 3;
      default: return 1;
    }
  }
}

// Export singleton instance
export const capacityOptimizationService = new CapacityOptimizationService();