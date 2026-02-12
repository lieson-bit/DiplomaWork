// services/order.service.ts
import { Logger } from '../utils/logger';
import { Order, CreateOrderData } from '../repositories/order.repository';
import { orderRepository, OrderRepository } from '../repositories/order.repository';
import { trackingRepository, TrackingRepository } from '../repositories/tracking.repository';
import { NotificationService } from './notification.service';
import { MessagingService } from './messaging.service';
import { BalanceService } from './balance.service';
import { CapacityOptimizationService } from './capacity-optimization.service';
import { WebSocketUtil } from '../utils/websocket.util';
import { OrderReceiveRequest } from '../types/index';
import { v4 as uuidv4 } from 'uuid';

export class OrderService {
  private logger: Logger;
  private notificationService: NotificationService;
  private messagingService: MessagingService;
  private balanceService: BalanceService;
  private websocketUtil: WebSocketUtil;
  private capacityOptimizationService: CapacityOptimizationService;
  private orderRepository: OrderRepository;
  private trackingRepository: TrackingRepository;

  constructor(
    websocketUtil: WebSocketUtil,
    notificationService?: NotificationService,
    customOrderRepository?: OrderRepository,
    customTrackingRepository?: TrackingRepository
  ) {
    this.logger = new Logger('OrderService');
    this.websocketUtil = websocketUtil;
    this.notificationService = notificationService || new NotificationService(websocketUtil);
    this.messagingService = new MessagingService();
    this.balanceService = new BalanceService();
    this.capacityOptimizationService = new CapacityOptimizationService();
    this.orderRepository = customOrderRepository || orderRepository;
    this.trackingRepository = customTrackingRepository || trackingRepository;
  }

  /** 
   * TRANSFORMATION PROCEDURE:
   * 
   * Step 1: Receive the exact JSON structure from the customer booking form
   * Step 2: Validate required fields are present
   * Step 3: Extract driver ID and perform capacity check by:
   *    a) Fetching vehicle capacity from driver service API
   *    b) Querying active orders for this driver from orders table
   *    c) Calculating current weight/volume load
   *    d) Checking if new order fits within remaining capacity
   * Step 4: If capacity check fails -> reject with recommendations
   * Step 5: If capacity check passes -> transform to database schema
   * Step 6: Map all fields from JSON to database columns:
   *    - customerInfo → customer_* fields
   *    - locations → pickup_/delivery_* fields
   *    - packageDetails → weight_kg/volume_m3/package_category
   *    - driverInfo → driver_* fields
   *    - vehicleInfo → vehicle_* fields
   *    - pricing → estimated_price_* fields
   *    - timing → estimated_duration_minutes and *_time_estimated
   * Step 7: Generate order number and set default values for missing fields
   * Step 8: Insert into database with capacity_check_passed and capacity_check_data
   * Step 9: Notify driver about new order assignment
   * Step 10: Return formatted response with order details
   */
  // services/order.service.ts
// Full fixed method:

async createOrderFromExternalRequest(requestData: OrderReceiveRequest): Promise<any> {
  try {
    this.logger.info('=== ORDER CREATION PROCESS STARTED ===');
    
    let order_number: string;

    // Check if orderId exists in the request
    if (requestData && 'orderId' in requestData && requestData.orderId) {
      order_number = requestData.orderId;
      this.logger.info(`Using provided order ID: ${order_number}`);
    } else {
      order_number = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      this.logger.info(`Generated new order number: ${order_number}`);
    }
    
    this.logger.info(`Processing order: ${order_number}`);
    this.logger.info(`Customer: ${requestData.customerInfo?.name} (${requestData.customerInfo?.id})`);
    this.logger.info(`Driver: ${requestData.driverInfo?.name} (${requestData.driverInfo?.id})`);
    this.logger.info(`Package: ${requestData.packageDetails?.weight?.value}kg, ${requestData.packageDetails?.volume?.value}m³`);

    // Validate required fields
    if (!requestData.customerInfo?.id) {
      this.logger.error('Missing customer ID');
      return this.createErrorResponse('Customer ID is required', 'MISSING_CUSTOMER_ID');
    }

    if (!requestData.driverInfo?.id) {
      this.logger.error('Missing driver ID');
      return this.createErrorResponse('Driver ID is required', 'MISSING_DRIVER_ID');
    }

    if (!requestData.locations?.pickup?.address || !requestData.locations?.delivery?.address) {
      this.logger.error('Missing pickup or delivery address');
      return this.createErrorResponse('Pickup and delivery addresses are required', 'MISSING_ADDRESS');
    }

    // Map urgency
    const urgency = this.mapUrgency(requestData.packageDetails?.urgency || 'normal');

    // Create order data
    const dbOrderData: CreateOrderData = {
      order_number: order_number,
      customer_id: requestData.customerInfo.id,
      driver_id: requestData.driverInfo.id,
      
      customer_name: requestData.customerInfo.name || 'Unknown Customer',
      customer_email: requestData.customerInfo.email || `${requestData.customerInfo.id}@example.com`,
      customer_phone: requestData.customerInfo.phone || '0000000000',
      
      pickup_address: requestData.locations.pickup.address,
      pickup_latitude: requestData.locations.pickup.coordinates?.lat || 0,
      pickup_longitude: requestData.locations.pickup.coordinates?.lng || 0,
      
      delivery_address: requestData.locations.delivery.address,
      delivery_latitude: requestData.locations.delivery.coordinates?.lat || 0,
      delivery_longitude: requestData.locations.delivery.coordinates?.lng || 0,
      distance_km: requestData.locations.distance?.km || 0,
      
      package_category: requestData.packageDetails?.category || 'General',
      weight_kg: requestData.packageDetails?.weight?.value || 1,
      volume_m3: requestData.packageDetails?.volume?.value || 0.1,
      urgency: urgency,
      
      fragile: requestData.specialRequirements?.fragile || false,
      refrigerated: requestData.specialRequirements?.refrigerated || false,
      oversized: requestData.specialRequirements?.oversized || false,
      hazardous: requestData.specialRequirements?.hazardous || false,
      
      driver_name: requestData.driverInfo?.name || null,
      driver_phone: requestData.driverInfo?.phone || null,
      driver_email: requestData.driverInfo?.email || null,
      driver_rating: requestData.driverInfo?.rating || null,
      driver_match_score: requestData.driverInfo?.matchScore || null,
      
      vehicle_type: requestData.vehicleInfo?.type || null,
      vehicle_make: requestData.vehicleInfo?.make || null,
      vehicle_model: requestData.vehicleInfo?.model || null,
      vehicle_license_plate: requestData.vehicleInfo?.licensePlate || null,
      vehicle_image_url: requestData.vehicleInfo?.imageUrl || null,
      vehicle_max_weight: requestData.vehicleInfo?.capacity?.maxWeight || null,
      vehicle_max_volume: requestData.vehicleInfo?.capacity?.maxVolume || null,
      
      estimated_price_usd: requestData.pricing?.estimatedPrice?.usd || 0,
      estimated_price_local: requestData.pricing?.estimatedPrice?.rub || 0,
      currency: requestData.pricing?.currency || 'USD',
      base_currency: requestData.pricing?.baseCurrency || 'RUB',
      
      estimated_duration_minutes: Math.ceil(requestData.timing?.estimatedDuration?.minutes || 30),
      pickup_time_estimated: requestData.timing?.pickupTime?.estimated 
        ? new Date(requestData.timing.pickupTime.estimated) 
        : null,
      delivery_time_estimated: requestData.timing?.deliveryTime?.estimated 
        ? new Date(requestData.timing.deliveryTime.estimated) 
        : null,
      
      route_polyline: null,
      route_order_index: 0,
      
      amount_paid: 0,
      payment_status: 'pending',
      
      driver_accepted: false,
      
      unread_customer_messages: 0,
      unread_driver_messages: 0
    };

    this.logger.info('Step 1: Basic order data created', {
      orderNumber: dbOrderData.order_number,
      customerId: dbOrderData.customer_id,
      driverId: dbOrderData.driver_id
    });

    // Perform capacity check
    if (dbOrderData.driver_id) {
      this.logger.info('Step 2: Performing capacity check for driver', { driverId: dbOrderData.driver_id });
      
      const capacityCheck = await this.performCapacityCheck(
        dbOrderData.driver_id,
        dbOrderData
      );

      (dbOrderData as any).capacity_check_passed = capacityCheck.passed;
      (dbOrderData as any).capacity_check_data = {
        timestamp: new Date().toISOString(),
        orderWeight: dbOrderData.weight_kg,
        orderVolume: dbOrderData.volume_m3,
        driverId: dbOrderData.driver_id,
        ...capacityCheck.capacityResult
      };

      this.logger.info('Step 3: Capacity check completed', {
        passed: capacityCheck.passed,
        canAccept: capacityCheck.capacityResult?.canAccept
      });

      if (!capacityCheck.passed) {
        this.logger.warn('Step 4: Capacity check FAILED - rejecting order');
        
        await this.notifyBookingFailure(
          dbOrderData.customer_id,
          requestData.driverInfo?.id || 'unknown',
          'Driver at maximum capacity',
          capacityCheck.capacityResult?.recommendations || []
        );

        return {
          success: false,
          message: 'Driver is at maximum capacity',
          reason: 'CAPACITY_EXCEEDED',
          recommendations: capacityCheck.capacityResult?.recommendations || [
            'Try again later',
            'Select a different driver'
          ],
          capacityDetails: capacityCheck.capacityResult?.capacityCheck || {},
          timestamp: new Date().toISOString()
        };
      }

      this.logger.info('Step 4: Capacity check PASSED');
    }

    // Create order in database
    this.logger.info('Step 5: Inserting order into database');
    
    let order;
    try {
      order = await this.orderRepository.create(dbOrderData);
      this.logger.info('Step 6: Order created successfully', {
        orderId: order.id,
        orderNumber: order.order_number,
        status: order.status
      });
    } catch (dbError: any) {
      this.logger.error('Step 5 ERROR: Database insertion failed', {
        message: dbError.message,
        code: dbError.code
      });
      
      return {
        success: false,
        message: 'Database error: ' + dbError.message,
        reason: dbError.code || 'DB_ERROR',
        recommendations: ['Check database logs for details'],
        timestamp: new Date().toISOString()
      };
    }

    // Notify driver
    if (order.driver_id) {
      this.logger.info('Step 7: Notifying driver about new order assignment');
      await this.notifyDriverAssignment(order);
    }

    // Send WebSocket update
    this.logger.info('Step 8: Sending WebSocket update to customer');
    await this.sendOrderCreationUpdates(order, order.customer_id);

    this.logger.info('=== ORDER CREATION PROCESS COMPLETED SUCCESSFULLY ===');
    
    return {
      success: true,
      order: this.formatOrderResponse(order),
      message: 'Order created successfully',
      capacityCheck: (dbOrderData as any).capacity_check_passed ? 'passed' : 'not_checked',
      timestamp: new Date().toISOString()
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error('=== ORDER CREATION PROCESS FAILED ===', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return {
      success: false,
      message: 'Failed to create order: ' + errorMessage,
      reason: 'INTERNAL_ERROR',
      recommendations: ['Check server logs for details'],
      timestamp: new Date().toISOString()
    };
  }
}

  /**
   * Perform capacity check by:
   * 1. Fetching vehicle capacity from driver service API
   * 2. Querying active orders for this driver from orders table
   * 3. Calculating current weight/volume load
   * 4. Checking if new order fits within remaining capacity
   */
  private async performCapacityCheck(
    driverId: string,
    orderData: CreateOrderData,
    excludeOrderId?: string
  ): Promise<{
    passed: boolean;
    capacityResult: any;
  }> {
    try {
      // Get driver's vehicle capacity from driver service
      const vehicleCapacity = await this.getDriverVehicleCapacity(driverId);

      if (!vehicleCapacity) {
        this.logger.warn(`No vehicle capacity found for driver ${driverId}, defaulting to allow`);
        return {
          passed: true,
          capacityResult: {
            canAccept: true,
            reason: 'Capacity check unavailable - no vehicle found',
            recommendations: []
          }
        };
      }

      // FIXED: Use the repository method with correct column names
      this.logger.debug(`Fetching active orders for driver ${driverId} from OrderRepository`);
      const activeOrders = await this.orderRepository.getDriverActiveOrders(driverId, excludeOrderId);
      this.logger.debug(`Found ${activeOrders.length} active orders for driver ${driverId}`);

      // Calculate current load
    const currentWeight = activeOrders.reduce((sum, order) => {
      const weight = parseFloat(order.weight_kg) || 0;
      this.logger.debug(`Order ${order.id}: weight_kg = ${weight}`);
      return sum + weight;
    }, 0);
    
    const currentVolume = activeOrders.reduce((sum, order) => {
      const volume = parseFloat(order.volume_m3) || 0;
      this.logger.debug(`Order ${order.id}: volume_m3 = ${volume}`);
      return sum + volume;
    }, 0);

      const currentOrders = activeOrders.length;

      const orderWeight = parseFloat(orderData.weight_kg.toString()) || 0;
      const orderVolume = parseFloat(orderData.volume_m3.toString()) || 0;

      const totalWeight = currentWeight + orderWeight;
      const totalVolume = currentVolume + orderVolume;
      const totalOrders = currentOrders + 1;

      const maxWeight = vehicleCapacity.maxWeight;
      const maxVolume = vehicleCapacity.maxVolume;
      const maxOrders = 10;

      const weightPasses = totalWeight <= maxWeight;
      const volumePasses = totalVolume <= maxVolume;
      const ordersPasses = totalOrders <= maxOrders;

      const canAccept = weightPasses && volumePasses && ordersPasses;

      const recommendations: string[] = [];
      if (!canAccept) {
        if (!weightPasses) {
          recommendations.push(`Reduce weight by ${(totalWeight - maxWeight).toFixed(2)}kg or choose a larger vehicle`);
        }
        if (!volumePasses) {
          recommendations.push(`Reduce volume by ${(totalVolume - maxVolume).toFixed(2)}m³ or choose a larger vehicle`);
        }
        if (!ordersPasses) {
          recommendations.push(`Complete existing orders before accepting new ones (max ${maxOrders} orders)`);
        }
      }

      const capacityResult = {
        canAccept,
        reason: canAccept ? undefined : 'Exceeds vehicle capacity limits',
        capacityCheck: {
          weight: {
            current: currentWeight,
            additional: orderWeight,
            total: totalWeight,
            max: maxWeight,
            remaining: Math.max(0, maxWeight - totalWeight),
            passes: weightPasses
          },
          volume: {
            current: currentVolume,
            additional: orderVolume,
            total: totalVolume,
            max: maxVolume,
            remaining: Math.max(0, maxVolume - totalVolume),
            passes: volumePasses
          },
          orders: {
            current: currentOrders,
            additional: 1,
            total: totalOrders,
            max: maxOrders,
            remaining: Math.max(0, maxOrders - totalOrders),
            passes: ordersPasses
          }
        },
        estimatedUtilization: {
          weight: maxWeight > 0 ? (totalWeight / maxWeight) * 100 : 0,
          volume: maxVolume > 0 ? (totalVolume / maxVolume) * 100 : 0,
          orders: (totalOrders / maxOrders) * 100
        },
        recommendations
      };

      return {
        passed: canAccept,
        capacityResult
      };

    } catch (error) {
      this.logger.error('Capacity check failed:', error);
      return {
        passed: true,
        capacityResult: {
          canAccept: true,
          reason: 'Capacity check failed - allowing by default',
          recommendations: []
        }
      };
    }
  }

  /**
   * Get driver's vehicle capacity from driver service API
   */
  private async getDriverVehicleCapacity(driverId: string): Promise<{
    maxWeight: number;
    maxVolume: number;
  } | null> {
    try {
      const HttpClient = require('../utils/httpClient').HttpClient;
      const httpClient = new HttpClient();
      
      const driverServiceUrl = process.env.DRIVER_SERVICE_URL || 'http://localhost:3002';
      const url = `${driverServiceUrl}/api/drivers/${driverId}/vehicles-picture`;
      
      this.logger.debug(`Fetching vehicle capacity from: ${url}`);
      
      const response = await httpClient.get(url, {
        timeout: 5000
      });
      
      if (response.data?.success && response.data?.data?.vehicles?.length > 0) {
        const vehicle = response.data.data.vehicles[0];
        return {
          maxWeight: parseFloat(vehicle.maxWeight) || 100,
          maxVolume: parseFloat(vehicle.maxVolume) || 10
        };
      }
      
      return null;
    } catch (error: any) {
      this.logger.warn(`Failed to fetch vehicle capacity: ${error.message}`);
      return null;
    }
  }

  /**
   * Map urgency string to database enum
   */
  private mapUrgency(urgency: string): 'normal' | 'high' | 'urgent' {
    if (!urgency) return 'normal';
    
    const urgencyLower = urgency.toLowerCase();
    if (urgencyLower === 'urgent' || urgencyLower === 'emergency' || urgencyLower === 'express') {
      return 'urgent';
    }
    if (urgencyLower === 'high') {
      return 'high';
    }
    return 'normal';
  }

  /**
   * Notify driver about new order assignment
   */
  private async notifyDriverAssignment(order: Order): Promise<void> {
    try {
      if (!order.driver_id) return;
      
      await this.notificationService.sendOrderNotification(
        order.driver_id,
        order.order_number,
        'order_assigned',
        {
          orderNumber: order.order_number,
          orderId: order.id,
          customerName: order.customer_name,
          pickupAddress: order.pickup_address,
          deliveryAddress: order.delivery_address,
          estimatedPrice: order.estimated_price_usd,
          packageWeight: order.weight_kg,
          packageVolume: order.volume_m3,
          estimatedDuration: order.estimated_duration_minutes,
          timestamp: new Date().toISOString()
        }
      );
      
      this.logger.info(`Driver ${order.driver_id} notified about order ${order.order_number}`);
    } catch (error) {
      this.logger.warn('Failed to notify driver:', error);
    }
  }

  /**
   * Notify customer about booking failure
   */
  private async notifyBookingFailure(
    customerId: string,
    driverId: string,
    reason: string,
    recommendations: string[]
  ): Promise<void> {
    try {
      await this.notificationService.sendBookingFailedNotification(
        customerId,
        driverId,
        reason,
        recommendations
      );
      
      this.logger.info(`Customer ${customerId} notified about booking failure: ${reason}`);
    } catch (error) {
      this.logger.warn('Failed to send booking failure notification:', error);
    }
  }

  /**
   * Send WebSocket update to customer
   */
  private async sendOrderCreationUpdates(order: Order, customerId: string): Promise<void> {
    try {
      if (!customerId) return;
      
      await this.websocketUtil.sendToUser(
        customerId,
        'order_created',
        {
          orderId: order.id,
          orderNumber: order.order_number,
          status: order.status,
          estimatedDelivery: order.delivery_time_estimated,
          driverAssigned: !!order.driver_id,
          driverName: order.driver_name,
          timestamp: new Date().toISOString()
        }
      );
      
      this.logger.info(`Customer ${customerId} notified via WebSocket about order creation`);
    } catch (error) {
      this.logger.warn('Failed to send WebSocket update:', error);
    }
  }

  /**
   * Format order response for API
   */
  private formatOrderResponse(order: Order): any {
    return {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      created_at: order.created_at,
      updated_at: order.updated_at,
      
      customer_info: {
        id: order.customer_id,
        name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone
      },
      
      driver_info: order.driver_id ? {
        id: order.driver_id,
        name: order.driver_name,
        phone: order.driver_phone,
        email: order.driver_email,
        rating: order.driver_rating,
        match_score: order.driver_match_score,
        accepted: order.driver_accepted,
        accepted_at: order.driver_accepted_at
      } : null,
      
      pickup_location: {
        address: order.pickup_address,
        latitude: parseFloat(order.pickup_latitude.toString()),
        longitude: parseFloat(order.pickup_longitude.toString())
      },
      
      delivery_location: {
        address: order.delivery_address,
        latitude: parseFloat(order.delivery_latitude.toString()),
        longitude: parseFloat(order.delivery_longitude.toString())
      },
      
      distance_km: parseFloat(order.distance_km.toString()),
      
      package_details: {
        category: order.package_category,
        weight_kg: parseFloat(order.weight_kg.toString()),
        volume_m3: parseFloat(order.volume_m3.toString()),
        urgency: order.urgency,
        fragile: order.fragile === true,
        refrigerated: order.refrigerated === true,
        oversized: order.oversized === true,
        hazardous: order.hazardous === true
      },
      
      vehicle_info: order.vehicle_type ? {
        type: order.vehicle_type,
        make: order.vehicle_make,
        model: order.vehicle_model,
        license_plate: order.vehicle_license_plate,
        image_url: order.vehicle_image_url,
        max_weight: order.vehicle_max_weight ? parseFloat(order.vehicle_max_weight.toString()) : null,
        max_volume: order.vehicle_max_volume ? parseFloat(order.vehicle_max_volume.toString()) : null
      } : null,
      
      pricing: {
        estimated_usd: parseFloat(order.estimated_price_usd.toString()),
        estimated_local: parseFloat(order.estimated_price_local.toString()),
        currency: order.currency,
        base_currency: order.base_currency,
        amount_paid: parseFloat(order.amount_paid.toString()),
        payment_status: order.payment_status
      },
      
      timing: {
        estimated_duration_minutes: order.estimated_duration_minutes,
        pickup_time_estimated: order.pickup_time_estimated,
        delivery_time_estimated: order.delivery_time_estimated,
        delivery_started_at: order.delivery_started_at,
        delivery_completed_at: order.delivery_completed_at
      },
      
      capacity_check: {
        passed: order.capacity_check_passed === true,
        data: order.capacity_check_data
      }
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(message: string, reason: string): any {
    return {
      success: false,
      message,
      reason,
      timestamp: new Date().toISOString()
    };
  }
}