// src/services/order.service.ts
import { Logger } from '../utils/logger';
import { OrderRepository, Order, CreateOrderData } from '../repositories/order.repository';
import { TrackingRepository } from '../repositories/tracking.repository';
import { BalanceService } from './balance.service';
import { RouteOptimizationService, OptimizedRoute } from './route-optimization.service';
import { MessagingService } from './messaging.service';
import { OrderReceiveRequest } from '../types/index';
import { v4 as uuidv4 } from 'uuid';

// Simple notification queue (in-memory)
interface Notification {
  id: string;
  userId: string;
  userType: 'customer' | 'driver';
  type: string;
  title: string;
  message: string;
  orderId?: string;
  data?: any;
  read: boolean;
  createdAt: Date;
}

export class OrderService {
  private logger: Logger;
  private orderRepository: OrderRepository;
  private trackingRepository: TrackingRepository;
  private balanceService: BalanceService;
  private routeOptimizationService: RouteOptimizationService;
  private messagingService: MessagingService;
  private notifications: Map<string, Notification[]> = new Map(); // userId -> notifications

  constructor(
    orderRepository: OrderRepository,
    trackingRepository: TrackingRepository,
    balanceService: BalanceService,
    routeOptimizationService: RouteOptimizationService,
    messagingService: MessagingService
  ) {
    this.logger = new Logger('OrderService');
    this.orderRepository = orderRepository;
    this.trackingRepository = trackingRepository;
    this.balanceService = balanceService;
    this.routeOptimizationService = routeOptimizationService;
    this.messagingService = messagingService;
  }

  // Create order from external request
  async createOrderFromExternalRequest(requestData: OrderReceiveRequest): Promise<any> {
    try {
      this.logger.info('=== ORDER CREATION STARTED ===');

      const orderNumber = requestData.orderId || `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // Validate required fields
      if (!requestData.customerInfo?.id) {
        return this.createErrorResponse('Customer ID is required', 'MISSING_CUSTOMER_ID');
      }
      if (!requestData.driverInfo?.id) {
        return this.createErrorResponse('Driver ID is required', 'MISSING_DRIVER_ID');
      }

      // Map urgency
      const urgency = this.mapUrgency(requestData.packageDetails?.urgency || 'normal');

      // Get the driver ID for vehicle lookup (prefer driverId over id)
      const driverLookupId = requestData.driverInfo.driverId || requestData.driverInfo.id;

      this.logger.info(`Creating order: User ID=${requestData.driverInfo.id}, Driver Lookup ID=${driverLookupId}`);

      // Perform capacity check (integrates with Driver Service)
      // Pass the user ID first (for database lookup) and driver ID second (for Driver Service API)
      const capacityCheck = await this.performCapacityCheck(
        requestData.driverInfo.id,      // This is the USER ID (stored in driver_id column)
        requestData.packageDetails?.weight?.value || 1,
        requestData.packageDetails?.volume?.value || 0.1,
        driverLookupId                   // This is the actual DRIVER ID for vehicle lookup
      );

      if (!capacityCheck.passed) {
        // Add notification for customer (to be retrieved via API)
        this.addNotification(
          requestData.customerInfo.id,
          'customer',
          'booking_failed',
          'Booking Failed',
          `Driver at maximum capacity. ${capacityCheck.recommendations.join(' ')}`,
          undefined,
          { reason: capacityCheck.reason, recommendations: capacityCheck.recommendations }
        );

        return {
          success: false,
          message: 'Driver is at maximum capacity',
          reason: 'CAPACITY_EXCEEDED',
          recommendations: capacityCheck.recommendations,
          capacityDetails: capacityCheck.details,
          timestamp: new Date().toISOString()
        };
      }

      // Create order data
      const dbOrderData: CreateOrderData = {
        order_number: orderNumber,
        customer_id: requestData.customerInfo.id,
        driver_id: requestData.driverInfo.id,  // Store the USER ID here (matches JWT)
        status: 'pending',
        customer_name: requestData.customerInfo.name || 'Unknown',
        customer_email: requestData.customerInfo.email || '',
        customer_phone: requestData.customerInfo.phone || '',
        driver_accepted_at: null,
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
        pickup_time_estimated: requestData.timing?.pickupTime?.estimated ? new Date(requestData.timing.pickupTime.estimated) : null,
        delivery_time_estimated: requestData.timing?.deliveryTime?.estimated ? new Date(requestData.timing.deliveryTime.estimated) : null,
        route_polyline: null,
        route_order_index: 0,
        amount_paid: 0,
        payment_status: 'pending',
        driver_accepted: false,
        unread_customer_messages: 0,
        unread_driver_messages: 0,
        capacity_check_passed: capacityCheck.passed,
        capacity_check_data: capacityCheck.details
      };

      // Create order in database
      const order = await this.orderRepository.create(dbOrderData);

      // Add notification for driver about new order
      this.addNotification(
        requestData.driverInfo.id,
        'driver',
        'new_order',
        'New Order Available',
        `New order #${orderNumber} from ${requestData.customerInfo.name}`,
        order.id,
        { orderNumber, customerName: requestData.customerInfo.name, estimatedPrice: requestData.pricing?.estimatedPrice?.usd }
      );

      this.logger.info(`Order ${orderNumber} created successfully`);

      return {
        success: true,
        order: this.formatOrderResponse(order),
        message: 'Order created successfully',
        notifications: this.getUserNotifications(requestData.customerInfo.id),
        timestamp: new Date().toISOString()
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Order creation failed:', errorMessage);
      return this.createErrorResponse(errorMessage, 'INTERNAL_ERROR');
    }
  }

  // Driver accepts order
  async acceptOrder(orderId: string, driverId: string): Promise<any> {
    try {
      this.logger.info(`Driver ${driverId} accepting order ${orderId}`);
      
      const order = await this.orderRepository.findById(orderId);
      
      if (!order) {
        throw new Error('Order not found');
      }
      if (order.driver_id !== driverId) {
        throw new Error('Order not assigned to you');
      }
      if (order.driver_accepted) {
        throw new Error('Order already accepted');
      }
      if (order.status !== 'pending') {
        throw new Error(`Cannot accept order with status: ${order.status}`);
      }
      
      // Update order
      const updatedOrder = await this.orderRepository.update(orderId, {
        status: 'driver_assigned',
        driver_accepted: true,
        driver_accepted_at: new Date()
      });
      
      // Process payment (deduct from customer, add to driver pending)
      await this.balanceService.processOrderPayment(
        order.customer_id,
        driverId,
        order.estimated_price_usd,
        orderId
      );
      
      // Add notification for customer
      this.addNotification(
        order.customer_id,
        'customer',
        'order_accepted',
        'Order Accepted',
        `Driver ${order.driver_name || 'assigned'} has accepted your order`,
        orderId,
        { driverName: order.driver_name, estimatedArrival: order.estimated_duration_minutes }
      );
      
      // Add notification for driver
      this.addNotification(
        driverId,
        'driver',
        'acceptance_success',
        'Order Accepted',
        `You have successfully accepted order #${order.order_number}`,
        orderId,
        { orderNumber: order.order_number }
      );
      
      return {
        success: true,
        order: this.formatOrderResponse(updatedOrder!),
        message: 'Order accepted successfully',
        notifications: this.getUserNotifications(driverId)
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Accept order failed:', errorMessage);
      throw error;
    }
  }

  // Driver rejects order
  async rejectOrder(orderId: string, driverId: string, reason?: string): Promise<any> {
    try {
      const order = await this.orderRepository.findById(orderId);
      
      if (!order) throw new Error('Order not found');
      if (order.driver_id !== driverId) throw new Error('Order not assigned to you');
      if (order.driver_accepted) throw new Error('Order already accepted');
      
      const updatedOrder = await this.orderRepository.update(orderId, {
        status: 'cancelled'
      });
      
      // Add notification for customer
      this.addNotification(
        order.customer_id,
        'customer',
        'order_rejected',
        'Order Rejected',
        `Driver could not accept your order. Reason: ${reason || 'Driver unavailable'}`,
        orderId,
        { reason }
      );
      
      return {
        success: true,
        order: this.formatOrderResponse(updatedOrder!),
        message: 'Order rejected successfully'
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Reject order failed:', errorMessage);
      throw error;
    }
  }

  // Update order status (driver)
  async updateOrderStatus(orderId: string, driverId: string, status: string, location?: { lat: number; lng: number }): Promise<any> {
    try {
      const order = await this.orderRepository.findById(orderId);
      
      if (!order) throw new Error('Order not found');
      if (order.driver_id !== driverId) throw new Error('Not authorized');
      
      const validStatuses = ['driver_assigned', 'route_to_pickup', 'in_transit', 'delivered'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Allowed: ${validStatuses.join(', ')}`);
      }
      
      const updateData: any = { status };
      
      if (status === 'route_to_pickup') {
        updateData.delivery_started_at = new Date();
      }
      if (status === 'delivered') {
        updateData.delivery_completed_at = new Date();
        updateData.payment_status = 'completed';
        await this.balanceService.completeOrderPayment(orderId);
      }
      
      if (location) {
        await this.trackingRepository.create({
          order_id: orderId,
          driver_id: driverId,
          latitude: location.lat,
          longitude: location.lng
        });
      }
      
      const updatedOrder = await this.orderRepository.update(orderId, updateData);
      
      // Add notification for customer
      const statusMessages: Record<string, string> = {
        'driver_assigned': 'Driver is on the way to pickup',
        'route_to_pickup': 'Driver is heading to pickup location',
        'in_transit': 'Your package is in transit',
        'delivered': 'Your package has been delivered!'
      };
      
      this.addNotification(
        order.customer_id,
        'customer',
        'status_update',
        'Order Status Updated',
        statusMessages[status] || `Order status changed to ${status}`,
        orderId,
        { status, location }
      );
      
      // If delivered, add rating notification
      if (status === 'delivered') {
        this.addNotification(
          order.customer_id,
          'customer',
          'rate_driver',
          'Rate Your Driver',
          'Please rate your driver for this delivery',
          orderId,
          { driverId, driverName: order.driver_name }
        );
      }
      
      return {
        success: true,
        order: this.formatOrderResponse(updatedOrder!),
        message: `Order status updated to ${status}`,
        notifications: this.getUserNotifications(order.customer_id)
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Update status failed:', errorMessage);
      throw error;
    }
  }

  // Get order with full details including progress
  async getOrderWithProgress(orderId: string, userId: string, userType: string): Promise<any> {
    try {
      const order = await this.orderRepository.findById(orderId);
      
      if (!order) throw new Error('Order not found');
      
      // Verify access
      if (userType === 'customer' && order.customer_id !== userId) {
        throw new Error('Access denied');
      }
      if (userType === 'driver' && order.driver_id !== userId) {
        throw new Error('Access denied');
      }
      
      // Get messages
      const messages = await this.messagingService.getOrderMessages(orderId, userId);
      
      // Get tracking locations
      const tracking = await this.trackingRepository.findByOrderId(orderId, { limit: 100 });
      const currentLocation = tracking.length > 0 ? {
        latitude: tracking[tracking.length - 1].latitude,
        longitude: tracking[tracking.length - 1].longitude,
        lastUpdated: tracking[tracking.length - 1].timestamp
      } : null;
      
      // Calculate progress
      const progress = this.calculateOrderProgress(order);
      
      // Get driver rating if delivered
      let driverRating = null;
      if (order.status === 'delivered' && order.driver_id) {
        const ratings = await this.messagingService.getDriverRatings(order.driver_id);
        if (ratings.length > 0) {
          driverRating = {
            average: ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length,
            count: ratings.length,
            userRating: order.customer_rating
          };
        }
      }
      
      // Get notifications for this user
      const notifications = this.getUserNotifications(userId);
      
      return {
        ...this.formatOrderResponse(order),
        progress,
        messages,
        currentLocation,
        driverRating,
        notifications,
        unreadCount: {
          customer: order.unread_customer_messages,
          driver: order.unread_driver_messages
        }
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get order failed:', errorMessage);
      throw error;
    }
  }

  // Get customer orders
  async getCustomerOrders(customerId: string, status?: string, page: number = 1, limit: number = 20): Promise<any> {
    try {
      const orders = await this.orderRepository.findByCustomerId(customerId, { status, limit, offset: (page - 1) * limit });
      const total = orders.length;
      
      const ordersWithProgress = orders.map(order => ({
        ...this.formatOrderResponse(order),
        progress: this.calculateOrderProgress(order)
      }));
      
      return {
        orders: ordersWithProgress,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get customer orders failed:', errorMessage);
      throw error;
    }
  }

  // Get driver orders
  async getDriverOrders(driverId: string, status?: string, page: number = 1, limit: number = 20): Promise<any> {
    try {
      const orders = await this.orderRepository.findByDriverId(driverId, { status, limit, offset: (page - 1) * limit });
      const total = orders.length;
      
      // Get optimized route for active orders
      let optimizedRoute = null;
      const activeOrders = orders.filter(o => ['pending', 'driver_assigned', 'route_to_pickup', 'in_transit'].includes(o.status));
      if (activeOrders.length > 1) {
        optimizedRoute = await this.routeOptimizationService.optimizeDriverRoute(driverId, activeOrders);
      }
      
      const ordersWithProgress = orders.map(order => ({
        ...this.formatOrderResponse(order),
        progress: this.calculateOrderProgress(order)
      }));
      
      return {
        orders: ordersWithProgress,
        optimizedRoute,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get driver orders failed:', errorMessage);
      throw error;
    }
  }

  // Get driver optimized route
  async getDriverOptimizedRoute(driverId: string): Promise<OptimizedRoute | null> {
    try {
      const activeOrders = await this.orderRepository.findByDriverId(driverId, {
        status: ['driver_assigned', 'route_to_pickup', 'in_transit']
      });
      
      if (activeOrders.length < 2) {
        return null;
      }
      
      return await this.routeOptimizationService.optimizeDriverRoute(driverId, activeOrders);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get optimized route failed:', errorMessage);
      return null;
    }
  }

  // Send message - FIXED: Explicitly type senderType
  async sendMessage(
    orderId: string, 
    senderId: string, 
    senderType: 'customer' | 'driver',  // Fixed: Explicit union type
    content: string
  ): Promise<any> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) throw new Error('Order not found');
      
      const receiverId = senderType === 'customer' ? order.driver_id! : order.customer_id;
      const receiverType = senderType === 'customer' ? 'driver' : 'customer';
      
      const message = await this.messagingService.sendMessage(
        orderId, senderId, senderType, receiverId, receiverType, content
      );
      
      // Add notification for receiver
      this.addNotification(
        receiverId,
        receiverType,
        'new_message',
        'New Message',
        `New message from ${senderType} regarding order #${order.order_number}`,
        orderId,
        { message: content.substring(0, 100) }
      );
      
      return {
        success: true,
        message,
        notifications: this.getUserNotifications(receiverId)
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Send message failed:', errorMessage);
      throw error;
    }
  }

  // Rate driver - FIXED: Use correct field names
  async rateDriver(orderId: string, customerId: string, rating: number, review?: string): Promise<any> {
    try {
      const order = await this.orderRepository.findById(orderId);
      
      if (!order) throw new Error('Order not found');
      if (order.customer_id !== customerId) throw new Error('Not authorized');
      if (order.status !== 'delivered') throw new Error('Can only rate after delivery');
      if (order.customer_rating) throw new Error('Already rated');
      
      if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5');
      
      // Save rating in driver_ratings table
      await this.messagingService.saveDriverRating(orderId, customerId, order.driver_id!, rating, review);
      
      // Update order with rating - FIXED: Use correct field names that exist in CreateOrderData
      // Note: The update method accepts Partial<CreateOrderData>, but these fields exist in the Order interface
      // We need to update using direct SQL via the repository's custom update method
      await this.orderRepository.update(orderId, {
        // @ts-ignore - These fields exist in the database but not in CreateOrderData type
        customer_rating: rating,
        // @ts-ignore
        customer_review: review || null,
        // @ts-ignore
        rating_given_at: new Date()
      } as any);
      
      // Calculate new average rating for driver
      const ratings = await this.messagingService.getDriverRatings(order.driver_id!);
      const newAverage = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
      
      // Update driver rating in orders table
      await this.orderRepository.update(orderId, { driver_rating: newAverage } as any);
      
      // Add notification for driver
      this.addNotification(
        order.driver_id!,
        'driver',
        'new_rating',
        'New Rating Received',
        `You received a ${rating} star rating for order #${order.order_number}`,
        orderId,
        { rating, review, newAverage }
      );
      
      return {
        success: true,
        newAverageRating: newAverage,
        message: 'Driver rated successfully'
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Rate driver failed:', errorMessage);
      throw error;
    }
  }

  // Get order tracking data
  async getOrderTracking(orderId: string): Promise<any> {
    const tracking = await this.trackingRepository.findByOrderId(orderId, { 
      limit: 100,
      orderBy: 'ASC'
    });
    
    return {
      orderId,
      tracking: tracking.map(t => ({
        latitude: t.latitude,
        longitude: t.longitude,
        timestamp: t.timestamp,
        speed: t.speed,
        bearing: t.bearing
      })),
      summary: tracking.length > 0 ? {
        startTime: tracking[0].timestamp,
        lastUpdate: tracking[tracking.length - 1].timestamp,
        totalPoints: tracking.length
      } : null
    };
  }

  // Get order messages
  async getOrderMessages(orderId: string, userId: string): Promise<any[]> {
    // Verify user has access to this order
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Get messages from messaging service
    const messages = await this.messagingService.getOrderMessages(orderId, userId);
    
    return messages;
  }

  // Get user balance
  async getUserBalance(userId: string, userType: string): Promise<any> {
    return await this.balanceService.getUserBalance(userId, userType as 'customer' | 'driver');
  }

  // Get order by ID (for verification)
  async getOrder(orderId: string): Promise<Order | null> {
    return await this.orderRepository.findById(orderId);
  }

  // Get user notifications (polling endpoint)
  async getUserNotifications(userId: string, markAsRead: boolean = false): Promise<Notification[]> {
    const userNotifications = this.notifications.get(userId) || [];
    
    if (markAsRead) {
      userNotifications.forEach(n => n.read = true);
      this.notifications.set(userId, userNotifications);
    }
    
    return userNotifications;
  }

  // Get unread notification count
  async getUnreadNotificationCount(userId: string): Promise<number> {
    const userNotifications = this.notifications.get(userId) || [];
    return userNotifications.filter(n => !n.read).length;
  }

  // Add notification to queue
  private addNotification(
    userId: string,
    userType: string,
    type: string,
    title: string,
    message: string,
    orderId?: string,
    data?: any
  ): void {
    const notification: Notification = {
      id: uuidv4(),
      userId,
      userType: userType as 'customer' | 'driver',
      type,
      title,
      message,
      orderId,
      data,
      read: false,
      createdAt: new Date()
    };
    
    if (!this.notifications.has(userId)) {
      this.notifications.set(userId, []);
    }
    
    this.notifications.get(userId)!.push(notification);
    
    // Keep only last 50 notifications per user
    const userNotifs = this.notifications.get(userId)!;
    if (userNotifs.length > 50) {
      this.notifications.set(userId, userNotifs.slice(-50));
    }
    
    this.logger.debug(`Notification added for user ${userId}: ${title}`);
  }

  // Perform capacity check - FIXED: Properly integrates with Driver Service
  private async performCapacityCheck(
    userIdOrDriverId: string, 
    weightKg: number, 
    volumeM3: number,
    driverIdForLookup?: string  // New optional parameter for the actual driver ID
  ): Promise<{
    passed: boolean;
    reason?: string;
    recommendations: string[];
    details: any;
  }> {
    try {
      // Use driverIdForLookup if provided, otherwise use userIdOrDriverId
      const vehicleLookupId = driverIdForLookup || userIdOrDriverId;

      this.logger.info(`Performing capacity check: userId/driverId=${userIdOrDriverId}, lookupId=${vehicleLookupId}, weight=${weightKg}kg, volume=${volumeM3}m³`);

      // 1. Get active orders for this driver from order-service database
      // Note: This uses the userIdOrDriverId which matches the driver_id in orders table
      const activeOrders = await this.orderRepository.getDriverActiveOrders(userIdOrDriverId);

      const currentWeight = activeOrders.reduce((sum, o) => sum + (o.weight_kg || 0), 0);
      const currentVolume = activeOrders.reduce((sum, o) => sum + (o.volume_m3 || 0), 0);
      const currentOrders = activeOrders.length;

      this.logger.debug(`Current load - Weight: ${currentWeight}kg, Volume: ${currentVolume}m³, Orders: ${currentOrders}`);

      // 2. Get vehicle capacity from Driver Service API using the vehicleLookupId
      let maxWeight = 100; // default kg
      let maxVolume = 10;  // default m³
      let maxOrders = 10;  // default max orders per driver

      try {
        const axios = require('axios');
        const driverServiceUrl = process.env.DRIVER_SERVICE_URL || 'http://localhost:3002';

        // Use vehicleLookupId (which is the actual driver ID) for the API call
        const response = await axios.get(`${driverServiceUrl}/api/drivers/${vehicleLookupId}/vehicles-picture`, {
          timeout: 5000,
          headers: {
            'x-service-secret': process.env.SERVICE_SECRET || 'shared_service_secret_key_1234567890'
          }
        });

        if (response.data?.success && response.data?.data?.vehicles?.[0]) {
          const vehicle = response.data.data.vehicles[0];
          maxWeight = parseFloat(vehicle.maxWeight) || 100;
          maxVolume = parseFloat(vehicle.maxVolume) || 10;
          this.logger.debug(`Vehicle capacity from Driver Service - Max Weight: ${maxWeight}kg, Max Volume: ${maxVolume}m³`);
        } else {
          this.logger.warn(`No vehicle found for driver ${vehicleLookupId}, using defaults`);
        }
      } catch (error: any) {
        this.logger.warn(`Could not fetch vehicle capacity from Driver Service for driver ${vehicleLookupId}: ${error.message}`);
        this.logger.warn('Using default capacity values: 100kg, 10m³');
      }

      // 3. Check against capacity constraints
      const totalWeight = currentWeight + weightKg;
      const totalVolume = currentVolume + volumeM3;
      const totalOrders = currentOrders + 1;

      const weightPasses = totalWeight <= maxWeight;
      const volumePasses = totalVolume <= maxVolume;
      const ordersPasses = totalOrders <= maxOrders;

      const passed = weightPasses && volumePasses && ordersPasses;

      // 4. Generate recommendations
      const recommendations: string[] = [];
      if (!weightPasses) {
        const excessWeight = totalWeight - maxWeight;
        recommendations.push(`This order would exceed vehicle weight capacity by ${excessWeight.toFixed(2)}kg. Current load: ${currentWeight.toFixed(2)}kg/${maxWeight}kg, Adding: ${weightKg}kg`);
      }
      if (!volumePasses) {
        const excessVolume = totalVolume - maxVolume;
        recommendations.push(`This order would exceed vehicle volume capacity by ${excessVolume.toFixed(2)}m³. Current load: ${currentVolume.toFixed(2)}m³/${maxVolume}m³, Adding: ${volumeM3}m³`);
      }
      if (!ordersPasses) {
        recommendations.push(`Driver already has ${currentOrders} active orders (max ${maxOrders}). Complete existing orders first.`);
      }

      if (passed && (totalWeight / maxWeight > 0.8 || totalVolume / maxVolume > 0.8)) {
        recommendations.push(`Warning: Capacity utilization will be high (${Math.round(totalWeight/maxWeight*100)}% weight, ${Math.round(totalVolume/maxVolume*100)}% volume)`);
      }

      return {
        passed,
        reason: passed ? undefined : 'Vehicle capacity would be exceeded',
        recommendations,
        details: {
          current: { 
            weight: parseFloat(currentWeight.toFixed(2)), 
            volume: parseFloat(currentVolume.toFixed(2)), 
            orders: currentOrders 
          },
          required: { 
            weight: weightKg, 
            volume: volumeM3,
            orders: 1
          },
          total: { 
            weight: parseFloat(totalWeight.toFixed(2)), 
            volume: parseFloat(totalVolume.toFixed(2)), 
            orders: totalOrders 
          },
          max: { 
            weight: maxWeight, 
            volume: maxVolume, 
            orders: maxOrders 
          },
          passes: { 
            weight: weightPasses, 
            volume: volumePasses, 
            orders: ordersPasses 
          },
          utilizationPercent: {
            weight: Math.round(totalWeight / maxWeight * 100),
            volume: Math.round(totalVolume / maxVolume * 100),
            orders: Math.round(totalOrders / maxOrders * 100)
          },
          lookupId: vehicleLookupId,  // Add this for debugging
          userIdOrDriverId: userIdOrDriverId  // Add this for debugging
        }
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Capacity check failed:', errorMessage);

      // On error, allow by default but log warning
      return {
        passed: true,
        recommendations: ['Capacity check temporarily unavailable - order accepted by default'],
        details: { error: errorMessage, fallback: true }
      };
    }
  }

  // Calculate order progress
  private calculateOrderProgress(order: Order): {
    steps: Array<{ status: string; label: string; completed: boolean; timestamp?: Date }>;
    currentStatus: string;
    progressPercentage: number;
    nextStep?: string;
  } {
    const statusFlow = [
      { status: 'pending', label: 'Order Placed' },
      { status: 'driver_assigned', label: 'Driver Assigned' },
      { status: 'route_to_pickup', label: 'Route to Pickup' },
      { status: 'in_transit', label: 'In Transit' },
      { status: 'delivered', label: 'Delivered' }
    ];
    
    const currentIndex = statusFlow.findIndex(s => s.status === order.status);
    
    const steps = statusFlow.map((step, index) => ({
      ...step,
      completed: index <= currentIndex,
      timestamp: this.getStatusTimestamp(order, step.status)
    }));
    
    const progressPercentage = currentIndex >= 0 
      ? Math.round((currentIndex / (statusFlow.length - 1)) * 100) 
      : 0;
    
    const nextStep = currentIndex >= 0 && currentIndex < statusFlow.length - 1
      ? statusFlow[currentIndex + 1].status
      : undefined;
    
    return { steps, currentStatus: order.status, progressPercentage, nextStep };
  }

  private getStatusTimestamp(order: Order, status: string): Date | undefined {
    switch (status) {
      case 'pending': return order.created_at;
      case 'driver_assigned': return order.driver_accepted_at || undefined;
      case 'route_to_pickup': return order.delivery_started_at || undefined;
      case 'in_transit': return order.delivery_started_at || undefined;
      case 'delivered': return order.delivery_completed_at || undefined;
      default: return undefined;
    }
  }

  private mapUrgency(urgency: string): 'normal' | 'high' | 'urgent' {
    const u = urgency?.toLowerCase();
    if (u === 'urgent') return 'urgent';
    if (u === 'high') return 'high';
    return 'normal';
  }

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
      rating: {
        customer_rating: order.customer_rating,
        customer_review: order.customer_review,
        rating_given_at: order.rating_given_at
      }
    };
  }

  private createErrorResponse(message: string, reason: string): any {
    return {
      success: false,
      message,
      reason,
      timestamp: new Date().toISOString()
    };
  }
}