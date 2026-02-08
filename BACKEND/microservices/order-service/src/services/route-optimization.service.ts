import { Logger } from '../utils/logger';
import { distanceUtil } from '../utils/distance.util';
import { Order } from '../types';

export interface OptimizedRoute {
  driverId: string;
  routeDate: Date;
  orders: Array<{
    orderId: string;
    orderNumber: string;
    type: 'pickup' | 'delivery';
    address: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    sequence: number;
    estimatedArrival: Date;
    actualArrival?: Date;
  }>;
  polyline: string;
  totalDistance: number;
  totalDuration: number;
  optimizationScore: number;
  estimatedFuelCost: number;
  estimatedSavings: {
    distance: number;
    time: number;
    fuel: number;
  };
}

export class RouteOptimizationService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('RouteOptimizationService');
  }

  // Optimize driver route using Traveling Salesman Problem (TSP) algorithm
  async optimizeDriverRoute(driverId: string, orders: Order[]): Promise<OptimizedRoute> {
    try {
      this.logger.info(`Optimizing route for driver ${driverId} with ${orders.length} orders`);
      
      if (orders.length === 0) {
        throw new Error('No orders to optimize');
      }
      
      // Extract all points (pickup and delivery for each order)
      const allPoints: Array<{
        orderId: string;
        orderNumber: string;
        type: 'pickup' | 'delivery';
        address: string;
        coordinates: { lat: number; lng: number };
        isPickup: boolean;
      }> = [];
      
      orders.forEach(order => {
        allPoints.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          type: 'pickup',
          address: order.locations.pickup.address,
          coordinates: order.locations.pickup.coordinates,
          isPickup: true
        });
        
        allPoints.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          type: 'delivery',
          address: order.locations.delivery.address,
          coordinates: order.locations.delivery.coordinates,
          isPickup: false
        });
      });
      
      // Get driver's current location (in real app, this would come from tracking)
      const driverLocation = await this.getDriverLocation(driverId);
      
      // Optimize route using nearest neighbor algorithm
      const optimizedSequence = this.nearestNeighborOptimization(
        driverLocation,
        allPoints
      );
      
      // Calculate route metrics
      const routeMetrics = this.calculateRouteMetrics(
        driverLocation,
        optimizedSequence
      );
      
      // Generate polyline for map display
      const polyline = this.generatePolyline([
        driverLocation,
        ...optimizedSequence.map(p => p.coordinates)
      ]);
      
      // Calculate estimated savings vs non-optimized route
      const estimatedSavings = this.calculateSavings(
        driverLocation,
        allPoints,
        optimizedSequence
      );
      
      // Create optimized route response
      const optimizedRoute: OptimizedRoute = {
        driverId,
        routeDate: new Date(),
        orders: optimizedSequence.map((point, index) => ({
          orderId: point.orderId,
          orderNumber: point.orderNumber,
          type: point.type,
          address: point.address,
          coordinates: point.coordinates,
          sequence: index + 1,
          estimatedArrival: this.calculateEstimatedArrival(
            driverLocation,
            optimizedSequence,
            index,
            routeMetrics.totalDuration
          )
        })),
        polyline,
        totalDistance: routeMetrics.totalDistance,
        totalDuration: routeMetrics.totalDuration,
        optimizationScore: this.calculateOptimizationScore(routeMetrics, orders.length),
        estimatedFuelCost: this.calculateFuelCost(routeMetrics.totalDistance),
        estimatedSavings
      };
      
      this.logger.info(`Route optimization complete. Score: ${optimizedRoute.optimizationScore}`);
      
      return optimizedRoute;
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Route optimization failed:', errorMessage);
      throw error;
    }
  }
  
  // Get driver's current location
  private async getDriverLocation(driverId: string): Promise<{ lat: number; lng: number }> {
    // In real implementation, get from tracking service
    // For now, return a default location
    return { lat: 59.925209, lng: 30.34174539999999 }; // Example location
  }
  
  // Nearest Neighbor algorithm for route optimization
  private nearestNeighborOptimization(
    startPoint: { lat: number; lng: number },
    points: Array<any>
  ): Array<any> {
    const visited = new Set<number>();
    const result: Array<any> = [];
    let currentPoint = startPoint;
    
    while (result.length < points.length) {
      let nearestIndex = -1;
      let nearestDistance = Infinity;
      
      for (let i = 0; i < points.length; i++) {
        if (!visited.has(i)) {
          const distance = distanceUtil.calculateHaversineDistance(
            currentPoint,
            points[i].coordinates
          );
          
          // Apply constraints: pickup must come before delivery
          if (this.isValidNextPoint(points[i], visited, points)) {
            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearestIndex = i;
            }
          }
        }
      }
      
      if (nearestIndex !== -1) {
        visited.add(nearestIndex);
        result.push(points[nearestIndex]);
        currentPoint = points[nearestIndex].coordinates;
      }
    }
    
    return result;
  }
  
  // Check if a point is valid as next point in sequence
  private isValidNextPoint(
    point: any,
    visited: Set<number>,
    allPoints: Array<any>
  ): boolean {
    // If it's a delivery point, check if corresponding pickup has been visited
    if (point.type === 'delivery') {
      const pickupIndex = allPoints.findIndex(
        p => p.orderId === point.orderId && p.type === 'pickup'
      );
      return visited.has(pickupIndex);
    }
    return true; // Pickup points are always valid
  }
  
  // Calculate route metrics
  private calculateRouteMetrics(
    startPoint: { lat: number; lng: number },
    sequence: Array<any>
  ): { totalDistance: number; totalDuration: number } {
    let totalDistance = 0;
    
    // Calculate distance from start to first point
    if (sequence.length > 0) {
      totalDistance += distanceUtil.calculateHaversineDistance(
        startPoint,
        sequence[0].coordinates
      );
    }
    
    // Calculate distances between sequence points
    for (let i = 0; i < sequence.length - 1; i++) {
      totalDistance += distanceUtil.calculateHaversineDistance(
        sequence[i].coordinates,
        sequence[i + 1].coordinates
      );
    }
    
    // Estimate duration (assuming 30 km/h average speed)
    const totalDuration = (totalDistance / 30) * 60; // Convert to minutes
    
    return {
      totalDistance: parseFloat(totalDistance.toFixed(2)),
      totalDuration: Math.ceil(totalDuration)
    };
  }
  
  // Generate polyline for map display
  private generatePolyline(points: Array<{ lat: number; lng: number }>): string {
    // Simple encoding for now - in production, use proper polyline encoding
    return points.map(p => `${p.lat},${p.lng}`).join('|');
  }
  
  // Calculate estimated arrival time for each point
  private calculateEstimatedArrival(
    startPoint: { lat: number; lng: number },
    sequence: Array<any>,
    pointIndex: number,
    totalDuration: number
  ): Date {
    // Simple linear estimation
    const now = new Date();
    const proportion = (pointIndex + 1) / sequence.length;
    const estimatedMinutes = totalDuration * proportion;
    
    const arrivalTime = new Date(now.getTime() + estimatedMinutes * 60000);
    return arrivalTime;
  }
  
  // Calculate optimization score (0-100)
  private calculateOptimizationScore(
    metrics: { totalDistance: number; totalDuration: number },
    orderCount: number
  ): number {
    // Higher score is better
    // Consider distance efficiency and order count
    const distanceScore = Math.max(0, 100 - (metrics.totalDistance * 2));
    const efficiencyScore = (orderCount / Math.max(1, metrics.totalDistance)) * 10;
    
    return parseFloat(Math.min(100, (distanceScore * 0.7 + efficiencyScore * 0.3)).toFixed(2));
  }
  
  // Calculate fuel cost
  private calculateFuelCost(distance: number): number {
    // Assume 10 km per liter, $1.2 per liter
    return parseFloat(((distance / 10) * 1.2).toFixed(2));
  }
  
  // Calculate estimated savings vs non-optimized route
  private calculateSavings(
    startPoint: { lat: number; lng: number },
    allPoints: Array<any>,
    optimizedSequence: Array<any>
  ): { distance: number; time: number; fuel: number } {
    // Calculate distance for non-optimized route (simple sequential)
    let nonOptimizedDistance = 0;
    let currentPoint = startPoint;
    
    for (const point of allPoints) {
      nonOptimizedDistance += distanceUtil.calculateHaversineDistance(
        currentPoint,
        point.coordinates
      );
      currentPoint = point.coordinates;
    }
    
    // Calculate optimized distance
    let optimizedDistance = 0;
    currentPoint = startPoint;
    
    for (const point of optimizedSequence) {
      optimizedDistance += distanceUtil.calculateHaversineDistance(
        currentPoint,
        point.coordinates
      );
      currentPoint = point.coordinates;
    }
    
    const distanceSaved = nonOptimizedDistance - optimizedDistance;
    const timeSaved = (distanceSaved / 30) * 60; // minutes
    const fuelSaved = this.calculateFuelCost(distanceSaved);
    
    return {
      distance: parseFloat(distanceSaved.toFixed(2)),
      time: Math.ceil(timeSaved),
      fuel: parseFloat(fuelSaved.toFixed(2))
    };
  }
  
  // Get optimized route for driver
  async getDriverRoute(driverId: string, date: Date): Promise<OptimizedRoute | null> {
    // In real implementation, fetch from database
    // This is a placeholder
    return null;
  }
  
  // Update route with actual progress
  async updateRouteProgress(
    driverId: string,
    orderId: string,
    pointType: 'pickup' | 'delivery',
    actualArrival: Date
  ): Promise<void> {
    // Update actual arrival time in route
    this.logger.info(`Route progress updated for driver ${driverId}, order ${orderId}`);
  }
}