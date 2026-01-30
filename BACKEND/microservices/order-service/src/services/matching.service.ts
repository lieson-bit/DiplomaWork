import { Logger } from '../utils/logger';
import { orderRepository } from '../repositories/order.repository';
import { orderItemRepository } from '../repositories/orderItem.repository';
import { KnapsackService, OrderPackage } from './knapsack.service';
import { HttpClient } from '../utils/httpClient';
import { distanceUtil } from '../utils/distance.util';

export class MatchingService {
  private logger: Logger;
  private knapsackService: KnapsackService;
  private httpClient: HttpClient;
  
  constructor() {
    this.logger = new Logger('MatchingService');
    this.knapsackService = new KnapsackService();
    this.httpClient = new HttpClient();
  }
  
  async queueOrderForMatching(orderId: string): Promise<boolean> {
    try {
      this.logger.info(`Queuing order ${orderId} for matching`);
      
      const order = await orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      let priorityScore = 100;
      
      // Adjust priority based on order characteristics
      if (order.priority === 'urgent') priorityScore += 50;
      if (order.priority === 'high') priorityScore += 30;
      if (order.fragile_items) priorityScore -= 10;
      if (order.temperature_controlled) priorityScore -= 15;
      
      await orderRepository.addToAssignmentQueue(orderId, priorityScore);
      
      // Start matching process asynchronously
      setTimeout(() => this.findDriverForOrder(orderId), 1000);
      
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to queue order for matching:', errorMessage);
      throw error;
    }
  }
  
  async findDriverForOrder(orderId: string): Promise<any> {
    try {
      this.logger.info(`Finding driver for order: ${orderId}`);
      
      const order = await orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Get available drivers from driver service - FIXED: Using httpClient.get instead of custom method
      const driversResponse = await this.httpClient.get<any>(
        `${process.env.DRIVER_SERVICE_URL}/api/drivers/available`,
        {
          params: {
            lat: order.pickup_latitude,
            lng: order.pickup_longitude,
            radius: 10, // 10km radius
            serviceSecret: process.env.SERVICE_SECRET
          },
          headers: {
            'x-service-secret': process.env.SERVICE_SECRET
          }
        }
      );
      
      const availableDrivers = driversResponse.data?.drivers || [];
      
      if (availableDrivers.length === 0) {
        this.logger.warn(`No available drivers found for order ${orderId}`);
        
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
        this.logger.warn(`No suitable driver found for order ${orderId}`);
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
      
      // Notify driver via driver service - FIXED: Using httpClient.post
      await this.httpClient.post(
        `${process.env.DRIVER_SERVICE_URL}/api/drivers/${matchedDriver.driverId}/assign`,
        {
          orderId: orderId,
          pickupAddress: order.pickup_address,
          deliveryAddress: order.delivery_address,
          estimatedEarnings: order.driver_earnings,
          distance: order.estimated_distance_km,
          pickupLat: order.pickup_latitude,
          pickupLng: order.pickup_longitude,
          deliveryLat: order.delivery_latitude,
          deliveryLng: order.delivery_longitude
        },
        {
          headers: {
            'x-service-secret': process.env.SERVICE_SECRET
          }
        }
      );
      
      this.logger.info(`Order ${orderId} matched with driver ${matchedDriver.driverId}`);
      
      return {
        success: true,
        order_id: orderId,
        driver_id: matchedDriver.driverId,
        vehicle_id: matchedDriver.vehicleId,
        packing_efficiency: matchedDriver.packingEfficiency,
        estimated_arrival: matchedDriver.estimatedArrival
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to find driver for order:', errorMessage);
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
        // Get driver's vehicle from driver service - FIXED: Using httpClient.get
        const vehicleResponse = await this.httpClient.get<any>(
          `${process.env.DRIVER_SERVICE_URL}/api/drivers/${driver.id}/vehicle`,
          {
            headers: {
              'x-service-secret': process.env.SERVICE_SECRET
            }
          }
        );
        
        const driverVehicle = vehicleResponse.data;
        
        if (!driverVehicle || !this.isVehicleSuitable(driverVehicle, order)) {
          continue;
        }
        
        // Calculate packing efficiency using knapsack algorithm - FIXED: Proper OrderPackage creation
        const itemsForPacking: OrderPackage[] = orderItems.map(item => ({
          id: item.id,
          weight: item.weight_per_item_kg || 0.1,
          volume: this.calculateItemVolume(item),
          pickupLocation: {
            lat: order.pickup_latitude,
            lng: order.pickup_longitude
          },
          deliveryLocation: {
            lat: order.delivery_latitude,
            lng: order.delivery_longitude
          },
          priority: order.priority === 'urgent' ? 10 : 
                   order.priority === 'high' ? 7 :
                   order.priority === 'normal' ? 5 : 3,
          value: 1 // Default value for optimization
        }));
        
        const packingResult = this.knapsackService.optimizeOrderAssignment(
          itemsForPacking,
          [{
            id: driverVehicle.id || `vehicle_${driver.id}`,
            capacity: {
              weight: driverVehicle.maxWeight || 100,
              volume: driverVehicle.maxVolume || 2,
              maxItems: 20
            },
            currentLoad: { weight: 0, volume: 0, itemCount: 0 },
            location: {
              lat: driver.currentLocation?.lat || order.pickup_latitude,
              lng: driver.currentLocation?.lng || order.pickup_longitude
            }
          }]
        );
        
        // Check if all items can be loaded
        if (packingResult.assignments.length === 0 || 
            packingResult.assignments[0].orders.length !== itemsForPacking.length) {
          continue;
        }
        
        // Calculate driver score
        const distance = distanceUtil.calculateHaversineDistance(
          { lat: driver.currentLocation?.lat || order.pickup_latitude, 
            lng: driver.currentLocation?.lng || order.pickup_longitude },
          { lat: order.pickup_latitude, lng: order.pickup_longitude }
        );
        
        const score = this.calculateDriverScore(
          driver,
          driverVehicle,
          distance,
          packingResult.assignments[0]
        );
        
        if (score > bestScore) {
          bestScore = score;
          bestDriver = {
            driverId: driver.id,
            vehicleId: driverVehicle.id || `vehicle_${driver.id}`,
            packingEfficiency: {
              weight: (packingResult.assignments[0].totalWeight / driverVehicle.maxWeight) * 100,
              volume: (packingResult.assignments[0].totalVolume / driverVehicle.maxVolume) * 100
            },
            estimatedArrival: this.calculateETA(distance),
            score
          };
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`Error evaluating driver ${driver.id}:`, errorMessage);
        continue;
      }
    }
    
    return bestDriver;
  }
  
  private isVehicleSuitable(vehicle: any, order: any): boolean {
    if (!vehicle.currentStatus || vehicle.currentStatus !== 'available') return false;
    if (order.temperature_controlled && !vehicle.hasRefrigeration) return false;
    if (vehicle.maxWeight < order.total_weight_kg) return false;
    if (vehicle.maxVolume < order.total_volume_m3) return false;
    
    return true;
  }
  
  private calculateDriverScore(
    driver: any,
    vehicle: any,
    distance: number,
    assignment: any
  ): number {
    const maxDistance = 20;
    const normalizedDistance = Math.max(0, 1 - (distance / maxDistance));
    const driverRating = (driver.rating || 3) / 5;
    const utilizationScore = (assignment.totalWeight / vehicle.maxWeight + 
                            assignment.totalVolume / vehicle.maxVolume) / 2;
    
    const weights = {
      distance: 0.4,
      rating: 0.3,
      utilization: 0.2,
      vehicleSuitability: 0.1
    };
    
    const vehicleSuitability = this.calculateVehicleSuitability(vehicle);
    
    return (
      normalizedDistance * weights.distance +
      driverRating * weights.rating +
      utilizationScore * weights.utilization +
      vehicleSuitability * weights.vehicleSuitability
    );
  }
  
  private calculateVehicleSuitability(vehicle: any): number {
    let score = 0.5;
    if (vehicle.hasRefrigeration) score += 0.2;
    if (vehicle.fuelEfficiency > 15) score += 0.1;
    if (vehicle.maintenanceStatus === 'excellent') score += 0.2;
    return Math.min(score, 1);
  }
  
  private calculateETA(distance: number, avgSpeed: number = 30): number {
    return Math.ceil((distance / avgSpeed) * 60);
  }
  
  private calculateItemVolume(item: any): number {
    if (item.dimensions_length_cm && item.dimensions_width_cm && item.dimensions_height_cm) {
      return (item.dimensions_length_cm * item.dimensions_width_cm * item.dimensions_height_cm) / 1000000;
    }
    return 0.01;
  }
}