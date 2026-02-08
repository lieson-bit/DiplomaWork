import { Logger } from '../utils/logger';

export interface Vehicle {
  id: string;
  capacity: {
    weight: number; // in kg
    volume: number; // in m³
    maxItems: number;
  };
  currentLoad: {
    weight: number;
    volume: number;
    itemCount: number;
  };
  location: {
    lat: number;
    lng: number;
  };
}

export interface OrderPackage {
  id: string;
  weight: number; // in kg
  volume: number; // in m³
  pickupLocation: {
    lat: number;
    lng: number;
  };
  deliveryLocation: {
    lat: number;
    lng: number;
  };
  priority: number; // 1-10, higher is more urgent
  timeWindow?: {
    start: Date;
    end: Date;
  };
  value?: number; // for value-based optimization
}

export interface OptimizationResult {
  assignments: Array<{
    vehicleId: string;
    orders: OrderPackage[];
    totalWeight: number;
    totalVolume: number;
    routeDistance: number;
  }>;
  unassignedOrders: OrderPackage[];
  totalVehiclesUsed: number;
  totalDistance: number;
  totalWeight: number;
  totalVolume: number;
}

export class KnapsackService {
  private logger = new Logger('KnapsackService');

  /**
   * Optimize order assignment to vehicles using knapsack-like algorithms
   */
  optimizeOrderAssignment(
    orders: OrderPackage[],
    vehicles: Vehicle[],
    maxDistancePerVehicle: number = 50 // km
  ): OptimizationResult {
    this.logger.info(`Optimizing ${orders.length} orders for ${vehicles.length} vehicles`);

    // Sort orders by priority (highest first) then by volume/weight ratio
    const sortedOrders = this.sortOrdersByPriority(orders);
    
    // Sort vehicles by available capacity (most capacity first)
    const sortedVehicles = [...vehicles].sort((a, b) => {
      const aCapacity = this.calculateAvailableCapacity(a);
      const bCapacity = this.calculateAvailableCapacity(b);
      return bCapacity - aCapacity;
    });

    const assignments: OptimizationResult['assignments'] = [];
    const unassignedOrders: OrderPackage[] = [];
    
    // Initialize assignments
    for (const vehicle of sortedVehicles) {
      assignments.push({
        vehicleId: vehicle.id,
        orders: [],
        totalWeight: 0,
        totalVolume: 0,
        routeDistance: 0
      });
    }

    // Assign orders to vehicles using greedy algorithm
    for (const order of sortedOrders) {
      let assigned = false;
      
      for (let i = 0; i < sortedVehicles.length; i++) {
        const vehicle = sortedVehicles[i];
        const assignment = assignments[i];
        
        if (this.canAssignOrder(vehicle, assignment, order)) {
          // Check if adding this order would exceed distance constraints
          const newRouteDistance = this.estimateRouteDistance(
            vehicle.location,
            assignment.orders,
            order
          );
          
          if (newRouteDistance <= maxDistancePerVehicle) {
            assignment.orders.push(order);
            assignment.totalWeight += order.weight;
            assignment.totalVolume += order.volume;
            assignment.routeDistance = newRouteDistance;
            
            // Update vehicle current load
            vehicle.currentLoad.weight += order.weight;
            vehicle.currentLoad.volume += order.volume;
            vehicle.currentLoad.itemCount += 1;
            
            assigned = true;
            break;
          }
        }
      }
      
      if (!assigned) {
        unassignedOrders.push(order);
      }
    }

    // Filter out vehicles with no assignments
    const usedAssignments = assignments.filter(a => a.orders.length > 0);

    return {
      assignments: usedAssignments,
      unassignedOrders,
      totalVehiclesUsed: usedAssignments.length,
      totalDistance: usedAssignments.reduce((sum, a) => sum + a.routeDistance, 0),
      totalWeight: usedAssignments.reduce((sum, a) => sum + a.totalWeight, 0),
      totalVolume: usedAssignments.reduce((sum, a) => sum + a.totalVolume, 0)
    };
  }

  /**
   * Multi-dimensional knapsack for capacity optimization
   */
  multiDimensionalKnapsack(
    items: OrderPackage[],
    capacity: { weight: number; volume: number; maxItems: number },
    maxValue: boolean = false
  ): OrderPackage[] {
    // Dynamic programming approach for multi-dimensional knapsack
    const weightLimit = Math.floor(capacity.weight);
    const volumeLimit = Math.floor(capacity.volume * 100); // Convert to cm³ for integer DP
    
    // Initialize DP table
    const dp: number[][][] = Array(items.length + 1)
      .fill(0)
      .map(() => Array(weightLimit + 1)
        .fill(0)
        .map(() => Array(volumeLimit + 1).fill(0)));
    
    // Fill DP table
    for (let i = 1; i <= items.length; i++) {
      const item = items[i - 1];
      const itemWeight = Math.floor(item.weight);
      const itemVolume = Math.floor(item.volume * 100);
      const itemValue = maxValue ? (item.value || 0) : item.priority;
      
      for (let w = 0; w <= weightLimit; w++) {
        for (let v = 0; v <= volumeLimit; v++) {
          if (itemWeight <= w && itemVolume <= v) {
            dp[i][w][v] = Math.max(
              dp[i - 1][w][v],
              dp[i - 1][w - itemWeight][v - itemVolume] + itemValue
            );
          } else {
            dp[i][w][v] = dp[i - 1][w][v];
          }
        }
      }
    }
    
    // Backtrack to find selected items
    const selectedItems: OrderPackage[] = [];
    let w = weightLimit;
    let v = volumeLimit;
    
    for (let i = items.length; i > 0; i--) {
      if (dp[i][w][v] !== dp[i - 1][w][v]) {
        const item = items[i - 1];
        selectedItems.push(item);
        w -= Math.floor(item.weight);
        v -= Math.floor(item.volume * 100);
      }
    }
    
    return selectedItems.reverse();
  }

  private sortOrdersByPriority(orders: OrderPackage[]): OrderPackage[] {
    return orders.sort((a, b) => {
      // First by priority
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // Then by density (volume/weight ratio)
      const aDensity = a.volume / a.weight;
      const bDensity = b.volume / b.weight;
      return bDensity - aDensity;
    });
  }

  private calculateAvailableCapacity(vehicle: Vehicle): number {
    const weightAvailable = vehicle.capacity.weight - vehicle.currentLoad.weight;
    const volumeAvailable = vehicle.capacity.volume - vehicle.currentLoad.volume;
    const itemsAvailable = vehicle.capacity.maxItems - vehicle.currentLoad.itemCount;
    
    // Return minimum of available capacities
    return Math.min(weightAvailable, volumeAvailable, itemsAvailable);
  }

  private canAssignOrder(vehicle: Vehicle, assignment: any, order: OrderPackage): boolean {
    const weightAfter = assignment.totalWeight + order.weight;
    const volumeAfter = assignment.totalVolume + order.volume;
    const itemsAfter = assignment.orders.length + 1;
    
    return (
      weightAfter <= vehicle.capacity.weight &&
      volumeAfter <= vehicle.capacity.volume &&
      itemsAfter <= vehicle.capacity.maxItems
    );
  }

  private estimateRouteDistance(
    startLocation: { lat: number; lng: number },
    existingOrders: OrderPackage[],
    newOrder: OrderPackage
  ): number {
    // Simplified distance estimation
    // In production, you would use a proper routing service
    const locations = [startLocation];
    
    // Add pickup locations
    for (const order of existingOrders) {
      locations.push(order.pickupLocation);
      locations.push(order.deliveryLocation);
    }
    
    // Add new order locations
    locations.push(newOrder.pickupLocation);
    locations.push(newOrder.deliveryLocation);
    
    // Calculate total distance (simplified)
    let totalDistance = 0;
    for (let i = 0; i < locations.length - 1; i++) {
      totalDistance += this.calculateHaversineDistance(locations[i], locations[i + 1]);
    }
    
    return totalDistance;
  }

  private calculateHaversineDistance(
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(point2.lat - point1.lat);
    const dLon = this.toRad(point2.lng - point1.lng);
    const lat1 = this.toRad(point1.lat);
    const lat2 = this.toRad(point2.lat);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}