import { logger } from '../utils/logger';
import { orderRepository } from '../repositories/order.repository';
import { orderItemRepository } from '../repositories/orderItem.repository';
import { KnapsackService } from './knapsack.service';
import { HttpClient } from '../utils/httpClient';

export class MatchingService {
  private knapsackService = new KnapsackService();
  private httpClient = new HttpClient();
  
  async queueOrderForMatching(orderId: string): Promise<boolean> {
    try {
      logger.info(`Queuing order ${orderId} for matching`);
      
      // Calculate priority score based on order characteristics
      const order = await orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      let priorityScore = 100; // Base score
      
      // Adjust priority based on order characteristics
      if (order.priority === 'urgent') priorityScore += 50;
      if (order.priority === 'high') priorityScore += 30;
      if (order.fragile_items) priorityScore -= 10;
      if (order.temperature_controlled) priorityScore -= 15;
      
      // Add to assignment queue
      await orderRepository.addToAssignmentQueue(orderId, priorityScore);
      
      // Start matching process
      setTimeout(() => this.findDriverForOrder(orderId), 1000);
      
      return true;
    } catch (error: any) {
      logger.error('Failed to queue order for matching:', error);
      throw error;
    }
  }
  
  async findDriverForOrder(orderId: string): Promise<any> {
    try {
      logger.info(`Finding driver for order: ${orderId}`);
      
      const order = await orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Get available drivers near pickup location
      const availableDrivers = await this.httpClient.getAvailableDrivers(
        order.pickup_latitude,
        order.pickup_longitude,
        10 // 10km radius
      );
      
      if (availableDrivers.length === 0) {
        logger.warn(`No available drivers found for order ${orderId}`);
        
        // Update order status and retry later
        await orderRepository.update(orderId, {
          status: 'pending',
          internal_notes: 'No drivers available, will retry'
        });
        
        return {
          success: false,
          message: 'No available drivers found',
          retry_in: 300 // 5 minutes
        };
      }
      
      // Get order items for capacity check
      const orderItems = await orderItemRepository.findByOrderId(orderId);
      
      // Find suitable driver with optimal capacity
      const matchedDriver = await this.findOptimalDriver(
        availableDrivers,
        order,
        orderItems
      );
      
      if (!matchedDriver) {
        logger.warn(`No suitable driver found for order ${orderId}`);
        return {
          success: false,
          message: 'No suitable driver found',
          retry_in: 300
        };
      }
      
      // Assign driver to order
      await orderRepository.update(orderId, {
        driver_id: matchedDriver.driverId,
        status: 'matched',
        matched_at: new Date()
      });
      
      // Notify driver
      await this.httpClient.notifyDriverAssignment(
        matchedDriver.driverId,
        orderId,
        order
      );
      
      logger.info(`Order ${orderId} matched with driver ${matchedDriver.driverId}`);
      
      return {
        success: true,
        order_id: orderId,
        driver_id: matchedDriver.driverId,
        vehicle_id: matchedDriver.vehicleId,
        packing_efficiency: matchedDriver.packingEfficiency,
        estimated_arrival: matchedDriver.estimatedArrival
      };
    } catch (error: any) {
      logger.error('Failed to find driver for order:', error);
      throw error;
    }
  }
  
  private async findOptimalDriver(
    drivers: any[],
    order: any,
    orderItems: any[]
  ): Promise<any> {
    let bestDriver = null;
    let bestScore = -1;
    
    for (const driver of drivers) {
      try {
        // Get driver's vehicles
        const driverVehicles = await this.httpClient.getDriverVehicles(driver.id);
        
        for (const vehicle of driverVehicles) {
          // Check if vehicle is available and suitable
          if (!this.isVehicleSuitable(vehicle, order)) {
            continue;
          }
          
          // Calculate packing efficiency using knapsack algorithm
          const packingResult = await this.knapsackService.optimizeLoading(
            orderItems,
            {
              maxWeight: vehicle.maxWeight,
              maxVolume: vehicle.maxVolume,
              hasRefrigeration: vehicle.hasRefrigeration || false
            }
          );
          
          // Check if all items can be loaded
          if (packingResult.selectedItems.length !== orderItems.length) {
            continue; // Not all items can fit
          }
          
          // Calculate driver score
          const distance = this.calculateDistance(
            vehicle.currentLocation,
            { lat: order.pickup_latitude, lng: order.pickup_longitude }
          );
          
          const score = this.calculateDriverScore(
            driver,
            vehicle,
            distance,
            packingResult.utilization
          );
          
          if (score > bestScore) {
            bestScore = score;
            bestDriver = {
              driverId: driver.id,
              vehicleId: vehicle.id,
              packingEfficiency: packingResult.utilization,
              estimatedArrival: this.calculateETA(distance, vehicle.avgSpeed),
              score
            };
          }
        }
      } catch (error) {
        logger.warn(`Error evaluating driver ${driver.id}:`, error);
        continue;
      }
    }
    
    return bestDriver;
  }
  
  private isVehicleSuitable(vehicle: any, order: any): boolean {
    // Check basic requirements
    if (vehicle.currentStatus !== 'available') return false;
    if (order.temperature_controlled && !vehicle.hasRefrigeration) return false;
    
    // Check capacity (basic check, detailed check done by knapsack)
    if (vehicle.maxWeight < order.total_weight_kg) return false;
    if (vehicle.maxVolume < order.total_volume_m3) return false;
    
    return true;
  }
  
  private calculateDistance(point1: any, point2: any): number {
    // Haversine formula implementation
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(point2.lat - point1.lat);
    const dLon = this.toRad(point2.lng - point1.lng);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(point1.lat)) * Math.cos(this.toRad(point2.lat)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  private calculateDriverScore(
    driver: any,
    vehicle: any,
    distance: number,
    utilization: any
  ): number {
    // Normalize factors
    const maxDistance = 20; // 20km max for scoring
    const normalizedDistance = Math.max(0, 1 - (distance / maxDistance));
    
    const driverRating = driver.rating / 5; // Normalize to 0-1
    
    const utilizationScore = (utilization.weight + utilization.volume) / 200; // Convert percentage to 0-1
    
    // Weight factors
    const weights = {
      distance: 0.4,
      rating: 0.3,
      utilization: 0.2,
      vehicleSuitability: 0.1
    };
    
    // Calculate vehicle suitability score
    const vehicleSuitability = this.calculateVehicleSuitability(vehicle);
    
    return (
      normalizedDistance * weights.distance +
      driverRating * weights.rating +
      utilizationScore * weights.utilization +
      vehicleSuitability * weights.vehicleSuitability
    );
  }
  
  private calculateVehicleSuitability(vehicle: any): number {
    let score = 0.5; // Base score
    
    if (vehicle.hasRefrigeration) score += 0.2;
    if (vehicle.fuelEfficiency > 15) score += 0.1;
    if (vehicle.maintenanceStatus === 'excellent') score += 0.2;
    
    return Math.min(score, 1);
  }
  
  private calculateETA(distance: number, avgSpeed: number = 30): number {
    // Calculate estimated time of arrival in minutes
    const speed = avgSpeed || 30; // Default 30 km/h
    return (distance / speed) * 60;
  }
  
  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}