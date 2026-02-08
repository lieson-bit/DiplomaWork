import { Logger } from '../utils/logger';
import { db } from '../config/database';

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

export interface MultiOrderOptimization {
  driverId: string;
  orders: OrderCapacity[];
  totalWeight: number;
  totalVolume: number;
  totalOrders: number;
  optimalSequence: string[];
  capacityScore: number;
  routeEfficiency: number;
}

export class CapacityOptimizationService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('CapacityOptimizationService');
  }

  // Check if driver can accept new order based on vehicle capacity
  async canDriverAcceptOrder(
    driverId: string,
    order: OrderCapacity,
    existingOrders: OrderCapacity[] = []
  ): Promise<CapacityOptimizationResult> {
    try {
      // Get driver's vehicle capacity
      const vehicleCapacity = await this.getDriverVehicleCapacity(driverId);
      
      if (!vehicleCapacity) {
        return {
          canAccept: false,
          reason: 'Vehicle capacity information not available',
          capacityCheck: {
            weight: { required: order.weight, available: 0, passes: false },
            volume: { required: order.volume, available: 0, passes: false },
            orders: { required: 1, available: 0, passes: false }
          },
          estimatedUtilization: { weight: 0, volume: 0, orders: 0 },
          recommendations: ['Please update vehicle capacity information']
        };
      }

      // Calculate total requirements including existing orders
      const totalWeight = vehicleCapacity.currentWeight + order.weight;
      const totalVolume = vehicleCapacity.currentVolume + order.volume;
      const totalOrders = vehicleCapacity.currentOrders + 1;

      // Check capacity constraints
      const weightPasses = totalWeight <= vehicleCapacity.maxWeight;
      const volumePasses = totalVolume <= vehicleCapacity.maxVolume;
      const ordersPasses = totalOrders <= vehicleCapacity.maxOrders;

      const canAccept = weightPasses && volumePasses && ordersPasses;

      // Calculate estimated utilization
      const estimatedUtilization = {
        weight: (totalWeight / vehicleCapacity.maxWeight) * 100,
        volume: (totalVolume / vehicleCapacity.maxVolume) * 100,
        orders: (totalOrders / vehicleCapacity.maxOrders) * 100
      };

      // Generate recommendations
      const recommendations: string[] = [];
      if (!canAccept) {
        if (!weightPasses) {
          recommendations.push(`Reduce weight by ${(totalWeight - vehicleCapacity.maxWeight).toFixed(2)}kg or choose a larger vehicle`);
        }
        if (!volumePasses) {
          recommendations.push(`Reduce volume by ${(totalVolume - vehicleCapacity.maxVolume).toFixed(2)}m³ or choose a larger vehicle`);
        }
        if (!ordersPasses) {
          recommendations.push(`Complete existing orders before accepting new ones`);
        }
      } else {
        if (estimatedUtilization.weight > 90) {
          recommendations.push('Vehicle weight capacity nearly full');
        }
        if (estimatedUtilization.volume > 90) {
          recommendations.push('Vehicle volume capacity nearly full');
        }
        if (estimatedUtilization.orders > 90) {
          recommendations.push('Maximum order capacity nearly reached');
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
      this.logger.error('Capacity check failed:', errorMessage);
      throw error;
    }
  }

  async canDriverAcceptMultipleOrders(
    driverId: string,
    orders: Array<{
      weight: number;
      volume: number;
      orderId: string;
    }>
  ): Promise<{
    canAccept: boolean;
    capacityCheck: any;
    recommendations: string[];
  }> {
    try {
      const vehicleCapacity = await this.getDriverVehicleCapacity(driverId);
      
      if (!vehicleCapacity) {
        return {
          canAccept: false,
          capacityCheck: null,
          recommendations: ['Vehicle capacity information not available']
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
          recommendations.push(`Total weight ${totalWeight}kg exceeds available capacity`);
        }
        if (!volumePasses) {
          recommendations.push(`Total volume ${totalVolume}m³ exceeds available capacity`);
        }
        if (!ordersPasses) {
          recommendations.push(`Too many orders (${totalOrders}) for current capacity`);
        }
      }
      
      return {
        canAccept,
        capacityCheck: {
          weight: {
            current: vehicleCapacity.currentWeight,
            additional: totalWeight,
            max: vehicleCapacity.maxWeight,
            passes: weightPasses
          },
          volume: {
            current: vehicleCapacity.currentVolume,
            additional: totalVolume,
            max: vehicleCapacity.maxVolume,
            passes: volumePasses
          },
          orders: {
            current: vehicleCapacity.currentOrders,
            additional: totalOrders,
            max: vehicleCapacity.maxOrders,
            passes: ordersPasses
          }
        },
        recommendations
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Multiple orders capacity check failed:', errorMessage);
      throw error;
    }
  }

  // Get driver's vehicle capacity
  private async getDriverVehicleCapacity(driverId: string): Promise<VehicleCapacity | null> {
    try {
      // Query database for driver's vehicle capacity
      const query = `
        SELECT 
          vehicle_max_weight,
          vehicle_max_volume,
          (SELECT COUNT(*) FROM orders WHERE driver_id = ? AND status IN ('pending', 'matched', 'driver_accepted', 'driver_enroute', 'pickup_started', 'in_transit')) as current_orders,
          (SELECT COALESCE(SUM(total_weight_kg), 0) FROM orders WHERE driver_id = ? AND status IN ('pending', 'matched', 'driver_accepted', 'driver_enroute', 'pickup_started', 'in_transit')) as current_weight,
          (SELECT COALESCE(SUM(total_volume_m3), 0) FROM orders WHERE driver_id = ? AND status IN ('pending', 'matched', 'driver_accepted', 'driver_enroute', 'pickup_started', 'in_transit')) as current_volume
        FROM orders 
        WHERE driver_id = ?
        LIMIT 1
      `;
      
      const result = await db.queryOne<any>(query, [driverId, driverId, driverId, driverId]);
      
      if (!result) {
        // Return default capacity if not found
        return {
          maxWeight: 100, // 100kg default
          maxVolume: 10,  // 10m³ default
          maxOrders: 10,  // 10 orders default
          currentWeight: 0,
          currentVolume: 0,
          currentOrders: 0,
          remainingWeight: 100,
          remainingVolume: 10,
          remainingOrders: 10,
          utilization: {
            weight: 0,
            volume: 0,
            orders: 0
          }
        };
      }
      
      const maxWeight = result.vehicle_max_weight || 100;
      const maxVolume = result.vehicle_max_volume || 10;
      const maxOrders = 10; // Default max orders
      const currentWeight = result.current_weight || 0;
      const currentVolume = result.current_volume || 0;
      const currentOrders = result.current_orders || 0;
      
      return {
        maxWeight,
        maxVolume,
        maxOrders,
        currentWeight,
        currentVolume,
        currentOrders,
        remainingWeight: maxWeight - currentWeight,
        remainingVolume: maxVolume - currentVolume,
        remainingOrders: maxOrders - currentOrders,
        utilization: {
          weight: (currentWeight / maxWeight) * 100,
          volume: (currentVolume / maxVolume) * 100,
          orders: (currentOrders / maxOrders) * 100
        }
      };
      
    } catch (error: unknown) {
      this.logger.error('Failed to get vehicle capacity:', error);
      return null;
    }
  }
  
  // Update the getDriverCapacityDashboard method (replace lines 318-348):
  async getDriverCapacityDashboard(driverId: string): Promise<{
    capacity: VehicleCapacity;
    pendingOrders: number;
    activeOrders: number;
    recommendedMaxOrders: number;
    efficiency: number;
  }> {
    try {
      const capacity = await this.getDriverVehicleCapacity(driverId);
      
      if (!capacity) {
        throw new Error('Could not retrieve capacity information');
      }
      
      // Get order counts
      const orderQuery = `
        SELECT 
          COUNT(CASE WHEN status IN ('pending', 'matched', 'driver_accepted') THEN 1 END) as pending_orders,
          COUNT(CASE WHEN status IN ('driver_enroute', 'pickup_started', 'in_transit') THEN 1 END) as active_orders
        FROM orders 
        WHERE driver_id = ?
      `;
      
      const orderCounts = await db.queryOne<any>(orderQuery, [driverId]);
    
      // Calculate recommended max orders based on average size
      const avgOrderQuery = `
        SELECT 
          AVG(total_weight_kg) as avg_weight,
          AVG(total_volume_m3) as avg_volume
        FROM orders 
        WHERE driver_id = ? AND status = 'completed'
      `;
      
      const averages = await db.queryOne<any>(avgOrderQuery, [driverId]);
      
      const avgWeight = averages?.avg_weight || 5;
      const avgVolume = averages?.avg_volume || 0.5;
      
      const recommendedByWeight = Math.floor(capacity.maxWeight / avgWeight);
      const recommendedByVolume = Math.floor(capacity.maxVolume / avgVolume);
      const recommendedMaxOrders = Math.min(recommendedByWeight, recommendedByVolume, capacity.maxOrders);
    
      // Calculate efficiency (orders delivered per day)
      const efficiencyQuery = `
        SELECT 
          COUNT(*) as delivered_today
        FROM orders 
        WHERE driver_id = ? 
          AND status IN ('delivered', 'completed')
          AND DATE(updated_at) = CURDATE()
      `;
      
      const efficiencyResult = await db.queryOne<any>(efficiencyQuery, [driverId]);
      const deliveredToday = efficiencyResult?.delivered_today || 0;
      const efficiency = Math.min(100, (deliveredToday / 10) * 100); // Assuming 10 is target
    
      return {
        capacity,
        pendingOrders: orderCounts?.pending_orders || 0,
        activeOrders: orderCounts?.active_orders || 0,
        recommendedMaxOrders,
        efficiency: parseFloat(efficiency.toFixed(2))
      };
    
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get capacity dashboard:', errorMessage);
      throw error;
    }
  }

  // Optimize multiple orders for a driver (Knapsack algorithm)
  async optimizeMultipleOrders(
    driverId: string,
    availableOrders: OrderCapacity[]
  ): Promise<MultiOrderOptimization> {
    try {
      // Get driver capacity
      const vehicleCapacity = await this.getDriverVehicleCapacity(driverId);
      
      if (!vehicleCapacity) {
        throw new Error('Could not retrieve vehicle capacity');
      }

      // Apply 0/1 Knapsack algorithm for weight optimization
      const weightOptimized = this.knapsackOptimization(
        availableOrders,
        vehicleCapacity.maxWeight - vehicleCapacity.currentWeight,
        'weight'
      );

      // Apply 0/1 Knapsack algorithm for volume optimization
      const volumeOptimized = this.knapsackOptimization(
        availableOrders,
        vehicleCapacity.maxVolume - vehicleCapacity.currentVolume,
        'volume'
      );

      // Apply multi-dimensional knapsack for combined optimization
      const multiDimensionalOptimized = this.multiDimensionalKnapsack(
        availableOrders,
        {
          maxWeight: vehicleCapacity.maxWeight - vehicleCapacity.currentWeight,
          maxVolume: vehicleCapacity.maxVolume - vehicleCapacity.currentVolume,
          maxOrders: vehicleCapacity.maxOrders - vehicleCapacity.currentOrders
        }
      );

      // Determine optimal sequence using Traveling Salesman Problem
      const optimalSequence = this.findOptimalSequence(multiDimensionalOptimized.orders);

      // Calculate capacity score (0-100)
      const capacityScore = this.calculateCapacityScore(
        multiDimensionalOptimized.totalWeight,
        multiDimensionalOptimized.totalVolume,
        vehicleCapacity.maxWeight,
        vehicleCapacity.maxVolume
      );

      // Calculate route efficiency
      const routeEfficiency = this.calculateRouteEfficiency(optimalSequence);

      return {
        driverId,
        orders: multiDimensionalOptimized.orders,
        totalWeight: multiDimensionalOptimized.totalWeight,
        totalVolume: multiDimensionalOptimized.totalVolume,
        totalOrders: multiDimensionalOptimized.orders.length,
        optimalSequence,
        capacityScore,
        routeEfficiency
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Multi-order optimization failed:', errorMessage);
      throw error;
    }
  }

  // 0/1 Knapsack algorithm for single dimension
  private knapsackOptimization(
    items: OrderCapacity[],
    capacity: number,
    dimension: 'weight' | 'volume'
  ): { orders: OrderCapacity[]; total: number } {
    const n = items.length;
    const dp: number[][] = Array(n + 1).fill(0).map(() => Array(capacity + 1).fill(0));
    const selected: boolean[][] = Array(n + 1).fill(0).map(() => Array(capacity + 1).fill(false));

    for (let i = 1; i <= n; i++) {
      const item = items[i - 1];
      const itemValue = dimension === 'weight' ? item.weight : item.volume;
      const itemPriority = this.priorityToValue(item.priority);

      for (let w = 0; w <= capacity; w++) {
        if (itemValue <= w) {
          const includeValue = dp[i - 1][w - itemValue] + itemPriority;
          if (includeValue > dp[i - 1][w]) {
            dp[i][w] = includeValue;
            selected[i][w] = true;
          } else {
            dp[i][w] = dp[i - 1][w];
          }
        } else {
          dp[i][w] = dp[i - 1][w];
        }
      }
    }

    // Backtrack to find selected items
    const selectedOrders: OrderCapacity[] = [];
    let w = capacity;
    for (let i = n; i > 0; i--) {
      if (selected[i][w]) {
        selectedOrders.push(items[i - 1]);
        w -= dimension === 'weight' ? items[i - 1].weight : items[i - 1].volume;
      }
    }

    const total = selectedOrders.reduce((sum, order) => 
      sum + (dimension === 'weight' ? order.weight : order.volume), 0
    );

    return { orders: selectedOrders, total };
  }

  // Multi-dimensional knapsack (weight, volume, orders)
  private multiDimensionalKnapsack(
    items: OrderCapacity[],
    capacity: {
      maxWeight: number;
      maxVolume: number;
      maxOrders: number;
    }
  ): { orders: OrderCapacity[]; totalWeight: number; totalVolume: number } {
    const n = items.length;
    const maxOrders = Math.min(capacity.maxOrders, items.length);
    
    // 3D DP array: items x weight x volume
    const dp: number[][][] = Array(n + 1)
      .fill(0)
      .map(() => Array(capacity.maxWeight + 1)
        .fill(0)
        .map(() => Array(capacity.maxVolume + 1).fill(0)));

    const selected: boolean[][][][] = Array(n + 1)
      .fill(0)
      .map(() => Array(capacity.maxWeight + 1)
        .fill(0)
        .map(() => Array(capacity.maxVolume + 1)
          .fill(0)
          .map(() => Array(maxOrders + 1).fill(false))));

    for (let i = 1; i <= n; i++) {
      const item = items[i - 1];
      const itemPriority = this.priorityToValue(item.priority);

      for (let w = 0; w <= capacity.maxWeight; w++) {
        for (let v = 0; v <= capacity.maxVolume; v++) {
          for (let o = 1; o <= maxOrders; o++) {
            if (item.weight <= w && item.volume <= v) {
              const includeValue = dp[i - 1][w - item.weight][v - item.volume] + itemPriority;
              if (includeValue > dp[i - 1][w][v]) {
                dp[i][w][v] = includeValue;
                selected[i][w][v][o] = true;
              } else {
                dp[i][w][v] = dp[i - 1][w][v];
              }
            } else {
              dp[i][w][v] = dp[i - 1][w][v];
            }
          }
        }
      }
    }

    // Backtrack to find selected items
    const selectedOrders: OrderCapacity[] = [];
    let w = capacity.maxWeight;
    let v = capacity.maxVolume;
    let o = maxOrders;

    for (let i = n; i > 0 && o > 0; i--) {
      if (selected[i][w][v][o]) {
        selectedOrders.push(items[i - 1]);
        w -= items[i - 1].weight;
        v -= items[i - 1].volume;
        o--;
      }
    }

    const totalWeight = selectedOrders.reduce((sum, order) => sum + order.weight, 0);
    const totalVolume = selectedOrders.reduce((sum, order) => sum + order.volume, 0);

    return { orders: selectedOrders, totalWeight, totalVolume };
  }

  // Find optimal sequence using nearest neighbor algorithm
  private findOptimalSequence(orders: OrderCapacity[]): string[] {
    if (orders.length === 0) return [];

    // Create combined points (pickup + delivery for each order)
    const points: Array<{
      id: string;
      type: 'pickup' | 'delivery';
      orderId: string;
      coordinates: { lat: number; lng: number };
    }> = [];

    orders.forEach(order => {
      points.push({
        id: `${order.orderId}_pickup`,
        type: 'pickup',
        orderId: order.orderId,
        coordinates: order.pickupLocation
      });
      points.push({
        id: `${order.orderId}_delivery`,
        type: 'delivery',
        orderId: order.orderId,
        coordinates: order.deliveryLocation
      });
    });

    // Start from first order's pickup
    const sequence: string[] = [];
    const visited = new Set<string>();
    
    // Ensure pickup comes before delivery for each order
    orders.forEach(order => {
      if (!visited.has(order.orderId)) {
        sequence.push(`${order.orderId}_pickup`);
        sequence.push(`${order.orderId}_delivery`);
        visited.add(order.orderId);
      }
    });

    return sequence;
  }

  // Calculate capacity utilization score (0-100)
  private calculateCapacityScore(
    usedWeight: number,
    usedVolume: number,
    maxWeight: number,
    maxVolume: number
  ): number {
    const weightUtilization = (usedWeight / maxWeight) * 100;
    const volumeUtilization = (usedVolume / maxVolume) * 100;
    
    // Higher score for better utilization (but not over-utilization)
    const weightScore = Math.min(weightUtilization, 100);
    const volumeScore = Math.min(volumeUtilization, 100);
    
    // Weighted average
    return parseFloat(((weightScore * 0.6 + volumeScore * 0.4) / 2).toFixed(2));
  }

  // Calculate route efficiency
  private calculateRouteEfficiency(sequence: string[]): number {
    if (sequence.length <= 2) return 100;
    
    // Simple heuristic: efficiency decreases with more stops
    const maxEfficiency = 100;
    const efficiencyDropPerStop = 2;
    const efficiency = Math.max(10, maxEfficiency - (sequence.length * efficiencyDropPerStop));
    
    return parseFloat(efficiency.toFixed(2));
  }

  // Convert priority to numeric value
  private priorityToValue(priority: string): number {
    switch (priority) {
      case 'urgent': return 10;
      case 'high': return 7;
      case 'normal': return 5;
      case 'low': return 3;
      default: return 1;
    }
  }

  // Get driver capacity dashboard
  async getDriverCapacityDashboard(driverId: string): Promise<{
    capacity: VehicleCapacity;
    pendingOrders: number;
    activeOrders: number;
    recommendedMaxOrders: number;
    efficiency: number;
  }> {
    try {
      const capacity = await this.getDriverVehicleCapacity(driverId);
      
      if (!capacity) {
        throw new Error('Could not retrieve capacity information');
      }

      const db = require('../config/database').db;
      
      // Get order counts
      const orderQuery = `
        SELECT 
          COUNT(CASE WHEN status IN ('pending', 'driver_assigned') THEN 1 END) as pending_orders,
          COUNT(CASE WHEN status IN ('route_to_pickup', 'in_transit') THEN 1 END) as active_orders
        FROM orders 
        WHERE driver_id = ?
      `;
      
      const orderCounts = await db.queryOne<any>(orderQuery, [driverId]);

      // Calculate recommended max orders based on average size
      const avgOrderQuery = `
        SELECT 
          AVG(weight_kg) as avg_weight,
          AVG(volume_m3) as avg_volume
        FROM orders 
        WHERE driver_id = ? AND status = 'completed'
      `;
      
      const averages = await db.queryOne<any>(avgOrderQuery, [driverId]);
      
      const avgWeight = averages?.avg_weight || 5;
      const avgVolume = averages?.avg_volume || 0.5;
      
      const recommendedByWeight = Math.floor(capacity.maxWeight / avgWeight);
      const recommendedByVolume = Math.floor(capacity.maxVolume / avgVolume);
      const recommendedMaxOrders = Math.min(recommendedByWeight, recommendedByVolume, capacity.maxOrders);

      // Calculate efficiency (orders delivered per day)
      const efficiencyQuery = `
        SELECT 
          COUNT(*) as delivered_today
        FROM orders 
        WHERE driver_id = ? 
          AND status = 'completed'
          AND DATE(delivery_completed_at) = CURDATE()
      `;
      
      const efficiencyResult = await db.queryOne<any>(efficiencyQuery, [driverId]);
      const deliveredToday = efficiencyResult?.delivered_today || 0;
      const efficiency = Math.min(100, (deliveredToday / 10) * 100); // Assuming 10 is target

      return {
        capacity,
        pendingOrders: orderCounts?.pending_orders || 0,
        activeOrders: orderCounts?.active_orders || 0,
        recommendedMaxOrders,
        efficiency: parseFloat(efficiency.toFixed(2))
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get capacity dashboard:', errorMessage);
      throw error;
    }
  }

  // Suggest optimal order mix for driver
  async suggestOptimalOrderMix(
    driverId: string,
    availableOrders: OrderCapacity[]
  ): Promise<{
    selectedOrders: OrderCapacity[];
    rejectedOrders: OrderCapacity[];
    capacityUtilization: {
      weight: number;
      volume: number;
      orders: number;
    };
    estimatedEarnings: number;
  }> {
    try {
      // Get driver capacity
      const capacity = await this.getDriverVehicleCapacity(driverId);
      
      if (!capacity) {
        throw new Error('Could not retrieve capacity information');
      }

      // Sort orders by priority and size efficiency
      const sortedOrders = [...availableOrders].sort((a, b) => {
        const aEfficiency = this.priorityToValue(a.priority) / (a.weight + a.volume);
        const bEfficiency = this.priorityToValue(b.priority) / (b.weight + b.volume);
        return bEfficiency - aEfficiency; // Descending
      });

      // Select orders until capacity is reached
      const selectedOrders: OrderCapacity[] = [];
      const rejectedOrders: OrderCapacity[] = [];
      
      let currentWeight = capacity.currentWeight;
      let currentVolume = capacity.currentVolume;
      let currentOrders = capacity.currentOrders;

      for (const order of sortedOrders) {
        const canFit = 
          (currentWeight + order.weight <= capacity.maxWeight) &&
          (currentVolume + order.volume <= capacity.maxVolume) &&
          (currentOrders + 1 <= capacity.maxOrders);

        if (canFit) {
          selectedOrders.push(order);
          currentWeight += order.weight;
          currentVolume += order.volume;
          currentOrders += 1;
        } else {
          rejectedOrders.push(order);
        }
      }

      // Calculate utilization
      const capacityUtilization = {
        weight: (currentWeight / capacity.maxWeight) * 100,
        volume: (currentVolume / capacity.maxVolume) * 100,
        orders: (currentOrders / capacity.maxOrders) * 100
      };

      // Estimate earnings (simplified - $1 per kg)
      const estimatedEarnings = selectedOrders.reduce((sum, order) => sum + order.weight, 0);

      return {
        selectedOrders,
        rejectedOrders,
        capacityUtilization,
        estimatedEarnings
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to suggest optimal order mix:', errorMessage);
      throw error;
    }
  }
}

// Export singleton instance
export const capacityOptimizationService = new CapacityOptimizationService();