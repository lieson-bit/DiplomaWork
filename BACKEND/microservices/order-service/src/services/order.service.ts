import { Logger } from '../utils/logger';
import { Order, CreateOrderData, UpdateOrderData } from '../repositories/order.repository';
import { orderRepository, OrderRepository } from '../repositories/order.repository';
import { trackingRepository, TrackingRepository } from '../repositories/tracking.repository';
import { NotificationService } from './notification.service';
import { MessagingService } from './messaging.service';
import { BalanceService } from './balance.service';
import { CapacityOptimizationService } from './capacity-optimization.service';
import { WebSocketUtil } from '../utils/websocket.util';
import { db } from '../config/database';

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

  // Transform external order data to match your database schema
  async createOrderFromExternalRequest(externalData: any): Promise<any> {
    try {
      this.logger.info(`Creating order from external request: ${externalData.orderId}`);

      // Transform to your database schema
      const dbOrderData: CreateOrderData = {
        order_number: externalData.orderId || undefined, // Use provided orderId or generate
        customer_id: externalData.customerInfo?.id,
        customer_name: externalData.customerInfo?.name,
        customer_email: externalData.customerInfo?.email,
        customer_phone: externalData.customerInfo?.phone,
        
        // Pickup location
        pickup_address: externalData.locations?.pickup?.address,
        pickup_latitude: externalData.locations?.pickup?.coordinates?.lat,
        pickup_longitude: externalData.locations?.pickup?.coordinates?.lng,
        
        // Delivery location
        delivery_address: externalData.locations?.delivery?.address,
        delivery_latitude: externalData.locations?.delivery?.coordinates?.lat,
        delivery_longitude: externalData.locations?.delivery?.coordinates?.lng,
        distance_km: externalData.locations?.distance?.km,
        
        // Package details
        package_category: externalData.packageDetails?.categoryLabel || 'General',
        weight_kg: externalData.packageDetails?.weight?.value,
        volume_m3: externalData.packageDetails?.volume?.value,
        urgency: this.mapUrgency(externalData.packageDetails?.urgency),
        
        // Special requirements
        fragile: externalData.specialRequirements?.fragile || false,
        refrigerated: externalData.specialRequirements?.refrigerated || false,
        oversized: externalData.specialRequirements?.oversized || false,
        hazardous: externalData.specialRequirements?.hazardous || false,
        
        // Driver info (if provided)
        driver_id: externalData.driverInfo?.driverId,
        driver_name: externalData.driverInfo?.name,
        driver_phone: externalData.driverInfo?.phone,
        driver_email: externalData.driverInfo?.email,
        driver_rating: externalData.driverInfo?.rating,
        driver_match_score: externalData.driverInfo?.matchScore,
        
        // Vehicle info (if provided)
        vehicle_type: externalData.vehicleInfo?.typeFormatted,
        vehicle_make: externalData.vehicleInfo?.make,
        vehicle_model: externalData.vehicleInfo?.model,
        vehicle_license_plate: externalData.vehicleInfo?.licensePlate,
        vehicle_image_url: externalData.vehicleInfo?.imageUrl,
        vehicle_max_weight: externalData.vehicleInfo?.capacity?.maxWeight,
        vehicle_max_volume: externalData.vehicleInfo?.capacity?.maxVolume,
        
        // Pricing
        estimated_price_usd: externalData.pricing?.estimatedPrice?.usd || 0,
        estimated_price_local: externalData.pricing?.estimatedPrice?.rub || 0,
        currency: 'USD',
        base_currency: 'RUB',
        
        // Timing
        estimated_duration_minutes: externalData.timing?.estimatedDuration?.minutes,
        pickup_time_estimated: externalData.timing?.pickupTime?.estimated 
          ? new Date(externalData.timing.pickupTime.estimated) 
          : null,
        delivery_time_estimated: externalData.timing?.deliveryTime?.estimated 
          ? new Date(externalData.timing.deliveryTime.estimated) 
          : null,
        
        // Status - always start as pending
        status: 'pending' as any
      };

      // Check driver capacity if driver is assigned
      if (externalData.driverInfo?.driverId) {
        const capacityCheck = await this.checkDriverCapacity(
          externalData.driverInfo.driverId,
          dbOrderData
        );
        
        if (!capacityCheck.canAccept) {
          return {
            success: false,
            message: 'Driver capacity exceeded',
            reason: capacityCheck.reason,
            recommendations: capacityCheck.recommendations
          };
        }
      }

      // Create order in database
      const order = await this.orderRepository.create(dbOrderData);
      
      // If driver is assigned, notify them
      if (order.driver_id) {
        await this.notifyDriverAssignment(order);
      }
      
      // Notify customer
      await this.notifyCustomerOrderCreated(order);
      
      // Send WebSocket updates
      await this.sendOrderCreationUpdates(order, externalData.customerInfo?.id);
      
      return {
        success: true,
        order: this.formatOrderResponse(order),
        message: 'Order created successfully'
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to create order:', errorMessage);
      throw new Error(`Order creation failed: ${errorMessage}`);
    }
  }

  // Check driver capacity
  private async checkDriverCapacity(driverId: string, orderData: CreateOrderData): Promise<any> {
    try {
      const orderCapacity = {
        orderId: orderData.order_number || 'temp',
        weight: orderData.weight_kg,
        volume: orderData.volume_m3,
        priority: orderData.urgency || 'normal',
        pickupLocation: {
          lat: orderData.pickup_latitude,
          lng: orderData.pickup_longitude
        },
        deliveryLocation: {
          lat: orderData.delivery_latitude,
          lng: orderData.delivery_longitude
        }
      };
      
      const capacityResult = await this.capacityOptimizationService.canDriverAcceptOrder(
        driverId,
        orderCapacity
      );
      
      return capacityResult;
      
    } catch (error: unknown) {
      this.logger.warn('Capacity check failed, defaulting to allow:', error);
      return {
        canAccept: true,
        reason: 'Capacity check unavailable',
        recommendations: []
      };
    }
  }

  // Driver accepts/rejects order
  async acceptOrder(orderId: string, driverId: string): Promise<any> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (order.driver_id !== driverId) {
        throw new Error('Driver not assigned to this order');
      }
      
      // Update driver acceptance
      await this.orderRepository.updateDriverAcceptance(orderId, true);
      
      // Update status to driver_assigned
      await this.orderRepository.updateStatus(orderId, 'driver_assigned');
      
      // Notify customer
      await this.notifyCustomerDriverAccepted(order);
      
      // Send WebSocket update
      await this.websocketUtil.sendToUser(
        order.customer_id,
        'driver_accepted',
        {
          orderId: order.order_number,
          driverName: order.driver_name,
          driverRating: order.driver_rating,
          vehicleType: order.vehicle_type,
          message: 'Driver has accepted your order'
        }
      );
      
      // Start route simulation if this is driver's first active order
      const activeOrders = await this.orderRepository.findByDriverId(driverId, {
        status: ['driver_assigned', 'route_to_pickup', 'in_transit']
      });
      
      if (activeOrders.length === 1) {
        // Start simulation for this order
        await this.startRouteSimulation(orderId, driverId);
      }
      
      return {
        success: true,
        message: 'Order accepted successfully',
        order: this.formatOrderResponse(order)
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to accept order:', errorMessage);
      throw error;
    }
  }

  async rejectOrder(orderId: string, driverId: string, reason?: string): Promise<any> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (order.driver_id !== driverId) {
        throw new Error('Driver not assigned to this order');
      }
      
      // Update driver acceptance (rejected)
      await this.orderRepository.updateDriverAcceptance(orderId, false);
      
      // Update status to cancelled
      await this.orderRepository.updateStatus(orderId, 'cancelled');
      
      // Notify customer
      await this.notifyCustomerDriverRejected(order, reason);
      
      return {
        success: true,
        message: 'Order rejected successfully'
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to reject order:', errorMessage);
      throw error;
    }
  }

  // Update order status through workflow
  async updateOrderStatus(
    orderId: string,
    driverId: string,
    status: Order['status'],
    location?: { latitude: number; longitude: number }
  ): Promise<any> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (order.driver_id !== driverId) {
        throw new Error('Driver not authorized to update this order');
      }
      
      // Validate status transition
      if (!this.isValidStatusTransition(order.status, status)) {
        throw new Error(`Invalid status transition from ${order.status} to ${status}`);
      }
      
      // Update status
      await this.orderRepository.updateStatus(orderId, status);
      
      // Update specific timestamps based on status
      switch (status) {
        case 'route_to_pickup':
          // No specific timestamp in your schema
          break;
        case 'in_transit':
          await this.orderRepository.updateDeliveryTiming(orderId, true);
          break;
        case 'delivered':
          await this.orderRepository.updateDeliveryTiming(orderId, false);
          break;
        case 'completed':
          // Process payment when order is completed
          await this.processOrderPayment(orderId);
          break;
      }
      
      // Update location if provided
      if (location && order.driver_id) {
        await this.trackingRepository.create({
          order_id: orderId,
          driver_id: order.driver_id,
          latitude: location.latitude,
          longitude: location.longitude
        });
      }
      
      // Notify customer about status change
      await this.notifyCustomerStatusChange(order, status);
      
      return {
        success: true,
        message: `Order status updated to ${status}`,
        order: this.formatOrderResponse(await this.orderRepository.findById(orderId) as Order)
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to update order status:', errorMessage);
      throw error;
    }
  }

  // Get order details
  async getOrder(orderId: string): Promise<any> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        // Try by order number
        const orderByNumber = await this.orderRepository.findByOrderNumber(orderId);
        if (!orderByNumber) {
          throw new Error('Order not found');
        }
        return await this.getOrder(orderByNumber.id);
      }
      
      // Get tracking data
      const tracking = await this.trackingRepository.findByOrderId(orderId, { limit: 50 });
      
      // Get messages
      const messages = await this.messagingService.getOrderMessages(orderId, order.customer_id);
      
      // Calculate progress
      const progress = this.calculateOrderProgress(order);
      
      return {
        ...this.formatOrderResponse(order),
        progress,
        tracking: tracking.map(t => ({
          latitude: t.latitude,
          longitude: t.longitude,
          timestamp: t.timestamp,
          speed: t.speed
        })),
        messages: messages.map(msg => ({
          id: msg.id,
          senderType: msg.sender_type,
          senderName: msg.senderName,
          content: msg.content,
          createdAt: msg.created_at,
          readStatus: msg.read_status
        }))
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get order:', errorMessage);
      throw error;
    }
  }

  // Get customer orders
  async getCustomerOrders(
    customerId: string, 
    status?: string, 
    page: number = 1, 
    limit: number = 20
  ): Promise<any> {
    try {
      const offset = (page - 1) * limit;
      const orders = await this.orderRepository.findByCustomerId(customerId, {
        status,
        limit,
        offset
      });
      
      const ordersWithProgress = orders.map(order => ({
        ...this.formatOrderResponse(order),
        progress: this.calculateOrderProgress(order)
      }));
      
      // Get total count for pagination
      const totalOrders = await this.getOrderCount(customerId, undefined, status);
      
      return {
        success: true,
        orders: ordersWithProgress,
        pagination: {
          page,
          limit,
          total: totalOrders,
          totalPages: Math.ceil(totalOrders / limit),
          hasNext: page < Math.ceil(totalOrders / limit),
          hasPrev: page > 1
        }
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get customer orders:', errorMessage);
      throw error;
    }
  }

  // Get driver orders
  async getDriverOrders(
    driverId: string, 
    status?: string, 
    page: number = 1, 
    limit: number = 20
  ): Promise<any> {
    try {
      const offset = (page - 1) * limit;
      const orders = await this.orderRepository.findByDriverId(driverId, {
        status: status as any,
        limit,
        offset
      });
      
      const ordersWithProgress = orders.map(order => ({
        ...this.formatOrderResponse(order),
        progress: this.calculateOrderProgress(order),
        routeOrderIndex: order.route_order_index
      }));
      
      // Get total count for pagination
      const totalOrders = await this.getOrderCount(undefined, driverId, status);
      
      // Get optimization for active orders
      let optimization = null;
      const activeOrders = orders.filter(o => 
        ['driver_assigned', 'route_to_pickup', 'in_transit'].includes(o.status)
      );
      
      if (activeOrders.length > 1) {
        optimization = await this.getOptimizedRouteForDriver(driverId, activeOrders);
      }
      
      return {
        success: true,
        orders: ordersWithProgress,
        optimization,
        pagination: {
          page,
          limit,
          total: totalOrders,
          totalPages: Math.ceil(totalOrders / limit),
          hasNext: page < Math.ceil(totalOrders / limit),
          hasPrev: page > 1
        }
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get driver orders:', errorMessage);
      throw error;
    }
  }

  // Rate driver
  async rateDriver(
    orderId: string, 
    customerId: string, 
    rating: number, 
    review?: string
  ): Promise<any> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (order.customer_id !== customerId) {
        throw new Error('Only customer can rate this order');
      }
      
      if (!['delivered', 'completed'].includes(order.status)) {
        throw new Error('Can only rate delivered or completed orders');
      }
      
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }
      
      // Update customer rating in order
      await this.orderRepository.updateCustomerRating(orderId, rating, review);
      
      // Also save to driver_ratings table if it exists
      if (order.driver_id) {
        await this.messagingService.saveDriverRating(
          orderId,
          customerId,
          order.driver_id,
          rating,
          review
        );
      }
      
      // Calculate new driver average rating
      const newAverage = await this.calculateNewDriverRating(order.driver_id, rating);
      
      return {
        success: true,
        newAverageRating: newAverage,
        message: 'Rating submitted successfully'
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to rate driver:', errorMessage);
      throw error;
    }
  }

  // Send message
  async sendMessage(
    orderId: string,
    senderId: string,
    senderType: 'customer' | 'driver',
    content: string,
    messageType: 'text' | 'location' | 'image' | 'status_update' = 'text',
    metadata?: any
  ): Promise<any> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Verify sender access
      if (senderType === 'customer' && order.customer_id !== senderId) {
        throw new Error('Customer not authorized');
      }
      
      if (senderType === 'driver' && order.driver_id !== senderId) {
        throw new Error('Driver not assigned to this order');
      }
      
      const receiverId = senderType === 'customer' ? order.driver_id : order.customer_id;
      const receiverType = senderType === 'customer' ? 'driver' : 'customer';
      
      if (!receiverId) {
        throw new Error('No receiver available');
      }
      
      const message = await this.messagingService.sendMessage(
        orderId,
        senderId,
        senderType,
        receiverId,
        receiverType,
        content,
        messageType,
        metadata
      );
      
      // Update unread count
      if (receiverType === 'customer') {
        await this.orderRepository.updateUnreadMessages(
          orderId,
          order.unread_customer_messages + 1,
          order.unread_driver_messages
        );
      } else {
        await this.orderRepository.updateUnreadMessages(
          orderId,
          order.unread_customer_messages,
          order.unread_driver_messages + 1
        );
      }
      
      // Send real-time notification
      await this.websocketUtil.sendToUser(
        receiverId,
        'new_message',
        {
          orderId: order.order_number,
          senderId,
          senderType,
          preview: content.length > 100 ? content.substring(0, 100) + '...' : content,
          timestamp: new Date().toISOString()
        }
      );
      
      return {
        success: true,
        message: {
          id: message.id,
          senderId,
          senderType,
          content,
          messageType,
          createdAt: new Date()
        }
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to send message:', errorMessage);
      throw error;
    }
  }

  // Get user balance
  async getUserBalance(userId: string, userType: 'customer' | 'driver'): Promise<any> {
    try {
      const balance = await this.balanceService.getUserBalance(userId, userType);
      const recentTransactions = await this.balanceService.getRecentTransactions(userId, 10);
      
      // Get this week's totals from orders
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      let thisWeekTotal = 0;
      if (userType === 'customer') {
        const thisWeekOrders = await this.orderRepository.findByCustomerId(userId, {
          status: 'completed',
          limit: 100
        });
        
        thisWeekTotal = thisWeekOrders
          .filter(order => order.delivery_completed_at && new Date(order.delivery_completed_at) >= startOfWeek)
          .reduce((sum, order) => sum + order.amount_paid, 0);
      } else {
        const thisWeekOrders = await this.orderRepository.findByDriverId(userId, {
          status: 'completed',
          limit: 100
        });
        
        thisWeekTotal = thisWeekOrders
          .filter(order => order.delivery_completed_at && new Date(order.delivery_completed_at) >= startOfWeek)
          .reduce((sum, order) => sum + (order.estimated_price_usd * 0.8), 0); // Assuming 80% to driver
      }
      
      return {
        success: true,
        balance: {
          ...balance,
          thisWeekTotal: parseFloat(thisWeekTotal.toFixed(2))
        },
        recentTransactions
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get user balance:', errorMessage);
      throw error;
    }
  }

  // Get optimized route for driver
  async getDriverOptimizedRoute(driverId: string): Promise<any> {
    try {
      const activeOrders = await this.orderRepository.findByDriverIdWithStatus(
        driverId,
        ['driver_assigned', 'route_to_pickup', 'in_transit']
      );
      
      if (activeOrders.length === 0) {
        return {
          success: true,
          message: 'No active orders',
          route: null
        };
      }
      
      const optimization = await this.getOptimizedRouteForDriver(driverId, activeOrders);
      
      return {
        success: true,
        route: optimization,
        orders: activeOrders.map(order => this.formatOrderResponse(order))
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get optimized route:', errorMessage);
      throw error;
    }
  }

  // Helper methods
  private mapUrgency(urgency: string): 'normal' | 'high' | 'urgent' {
    switch (urgency?.toLowerCase()) {
      case 'urgent':
      case 'express':
        return 'urgent';
      case 'high':
        return 'high';
      default:
        return 'normal';
    }
  }

  private async notifyDriverAssignment(order: Order): Promise<void> {
    if (!order.driver_id) return;
    
    await this.notificationService.sendOrderNotification(
      order.driver_id,
      order.order_number,
      'order_assigned',
      {
        orderNumber: order.order_number,
        customerName: order.customer_name,
        pickupAddress: order.pickup_address,
        deliveryAddress: order.delivery_address,
        estimatedPrice: order.estimated_price_usd,
        packageWeight: order.weight_kg,
        packageVolume: order.volume_m3
      }
    );
  }

  private async notifyCustomerOrderCreated(order: Order): Promise<void> {
    await this.notificationService.sendOrderNotification(
      order.customer_id,
      order.order_number,
      'order_created',
      {
        orderNumber: order.order_number,
        message: 'Your order has been created successfully',
        estimatedDelivery: order.delivery_time_estimated
      }
    );
  }

  private async sendOrderCreationUpdates(order: Order, customerId: string): Promise<void> {
    if (!customerId) return;
    
    await this.websocketUtil.sendToUser(
      customerId,
      'order_created',
      {
        orderId: order.order_number,
        status: order.status,
        estimatedDelivery: order.delivery_time_estimated,
        driverAssigned: !!order.driver_id
      }
    );
  }

  private async notifyCustomerDriverAccepted(order: Order): Promise<void> {
    await this.notificationService.sendOrderNotification(
      order.customer_id,
      order.order_number,
      'driver_accepted',
      {
        driverName: order.driver_name,
        driverRating: order.driver_rating,
        vehicleType: order.vehicle_type,
        message: 'Driver has accepted your order'
      }
    );
  }

  private async notifyCustomerDriverRejected(order: Order, reason?: string): Promise<void> {
    await this.notificationService.sendOrderNotification(
      order.customer_id,
      order.order_number,
      'driver_rejected',
      {
        reason: reason || 'Driver unavailable',
        message: 'We are looking for another driver for your order'
      }
    );
  }

  private async notifyCustomerStatusChange(order: Order, newStatus: Order['status']): Promise<void> {
    const statusMessages: Record<Order['status'], string> = {
      'pending': 'Order is pending',
      'driver_assigned': 'Driver has been assigned',
      'route_to_pickup': 'Driver is on the way to pickup location',
      'in_transit': 'Order is in transit to delivery location',
      'delivered': 'Order has been delivered',
      'cancelled': 'Order has been cancelled',
      'completed': 'Order completed successfully'
    };
    
    await this.notificationService.sendOrderNotification(
      order.customer_id,
      order.order_number,
      'status_change',
      {
        status: newStatus,
        message: statusMessages[newStatus] || 'Order status updated'
      }
    );
  }

  private async startRouteSimulation(orderId: string, driverId: string): Promise<void> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order || !order.driver_id) return;
      
      // Simulate driver moving to pickup
      await this.simulateMovement(
        orderId,
        driverId,
        { lat: 59.925209, lng: 30.341745 }, // Default start
        { lat: order.pickup_latitude, lng: order.pickup_longitude },
        'to_pickup'
      );
      
      // Update status
      await this.orderRepository.updateStatus(orderId, 'route_to_pickup');
      
      // Simulate pickup to delivery
      setTimeout(async () => {
        await this.simulateMovement(
          orderId,
          driverId,
          { lat: order.pickup_latitude, lng: order.pickup_longitude },
          { lat: order.delivery_latitude, lng: order.delivery_longitude },
          'to_delivery'
        );
        
        await this.orderRepository.updateStatus(orderId, 'delivered');
        
        // Process payment
        await this.processOrderPayment(orderId);
        
      }, 30000); // 30 seconds delay
      
    } catch (error) {
      this.logger.error('Route simulation failed:', error);
    }
  }

  private async simulateMovement(
    orderId: string,
    driverId: string,
    startPoint: { lat: number; lng: number },
    endPoint: { lat: number; lng: number },
    phase: 'to_pickup' | 'to_delivery'
  ): Promise<void> {
    const steps = 10;
    const interval = 5000;
    
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const currentLat = startPoint.lat + (endPoint.lat - startPoint.lat) * progress;
      const currentLng = startPoint.lng + (endPoint.lng - startPoint.lng) * progress;
      
      await this.trackingRepository.create({
        order_id: orderId,
        driver_id: driverId,
        latitude: currentLat,
        longitude: currentLng,
        speed: 30 + Math.random() * 20
      });
      
      await this.delay(interval);
    }
  }

  private async processOrderPayment(orderId: string): Promise<void> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order || !order.driver_id) return;
      
      // Update payment status
      await this.orderRepository.updatePaymentStatus(
        orderId,
        'completed',
        order.estimated_price_usd
      );
      
      // Update order status to completed
      await this.orderRepository.updateStatus(orderId, 'completed');
      
      // Process balance transactions
      await this.balanceService.processOrderPayment(
        order.customer_id,
        order.driver_id,
        order.estimated_price_usd,
        orderId
      );
      
      this.logger.info(`Payment processed for order ${orderId}`);
      
    } catch (error) {
      this.logger.error('Payment processing failed:', error);
    }
  }

  private isValidStatusTransition(currentStatus: Order['status'], newStatus: Order['status']): boolean {
    const validTransitions: Record<Order['status'], Order['status'][]> = {
      'pending': ['driver_assigned', 'cancelled'],
      'driver_assigned': ['route_to_pickup', 'cancelled'],
      'route_to_pickup': ['in_transit', 'cancelled'],
      'in_transit': ['delivered', 'cancelled'],
      'delivered': ['completed'],
      'completed': [],
      'cancelled': []
    };
    
    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  private calculateOrderProgress(order: Order): any {
    const steps = [
      { status: 'pending', label: 'Order Placed', completed: true },
      { status: 'driver_assigned', label: 'Driver Assigned', completed: ['driver_assigned', 'route_to_pickup', 'in_transit', 'delivered', 'completed'].includes(order.status) },
      { status: 'route_to_pickup', label: 'Enroute to Pickup', completed: ['route_to_pickup', 'in_transit', 'delivered', 'completed'].includes(order.status) },
      { status: 'in_transit', label: 'In Transit', completed: ['in_transit', 'delivered', 'completed'].includes(order.status) },
      { status: 'delivered', label: 'Delivered', completed: ['delivered', 'completed'].includes(order.status) },
      { status: 'completed', label: 'Completed', completed: order.status === 'completed' }
    ];
    
    let currentStepIndex = steps.findIndex(step => step.status === order.status);
    if (currentStepIndex === -1) currentStepIndex = 0;
    
    const progressPercentage = Math.round((currentStepIndex / (steps.length - 1)) * 100);
    
    return {
      steps,
      currentStatus: order.status,
      progressPercentage,
      nextStep: currentStepIndex < steps.length - 1 ? steps[currentStepIndex + 1].status : null
    };
  }

  private formatOrderResponse(order: Order): any {
    return {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      
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
        rating: order.driver_rating
      } : null,
      
      pickup_location: {
        address: order.pickup_address,
        latitude: order.pickup_latitude,
        longitude: order.pickup_longitude
      },
      
      delivery_location: {
        address: order.delivery_address,
        latitude: order.delivery_latitude,
        longitude: order.delivery_longitude
      },
      
      package_details: {
        category: order.package_category,
        weight_kg: order.weight_kg,
        volume_m3: order.volume_m3,
        urgency: order.urgency,
        fragile: order.fragile,
        refrigerated: order.refrigerated,
        oversized: order.oversized,
        hazardous: order.hazardous
      },
      
      vehicle_info: order.vehicle_type ? {
        type: order.vehicle_type,
        make: order.vehicle_make,
        model: order.vehicle_model,
        license_plate: order.vehicle_license_plate,
        max_weight: order.vehicle_max_weight,
        max_volume: order.vehicle_max_volume
      } : null,
      
      pricing: {
        estimated_usd: order.estimated_price_usd,
        estimated_local: order.estimated_price_local,
        currency: order.currency,
        base_currency: order.base_currency,
        amount_paid: order.amount_paid,
        payment_status: order.payment_status
      },
      
      timing: {
        estimated_duration_minutes: order.estimated_duration_minutes,
        pickup_time_estimated: order.pickup_time_estimated,
        delivery_time_estimated: order.delivery_time_estimated,
        created_at: order.created_at,
        updated_at: order.updated_at,
        driver_accepted_at: order.driver_accepted_at,
        delivery_started_at: order.delivery_started_at,
        delivery_completed_at: order.delivery_completed_at
      },
      
      route_info: {
        polyline: order.route_polyline,
        order_index: order.route_order_index
      },
      
      rating: order.customer_rating ? {
        rating: order.customer_rating,
        review: order.customer_review,
        given_at: order.rating_given_at
      } : null,
      
      communication: {
        unread_customer_messages: order.unread_customer_messages,
        unread_driver_messages: order.unread_driver_messages
      }
    };
  }

  private async getOrderCount(customerId?: string, driverId?: string, status?: string): Promise<number> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      
      if (customerId) {
        whereClause += ' AND customer_id = ?';
        params.push(customerId);
      }
      
      if (driverId) {
        whereClause += ' AND driver_id = ?';
        params.push(driverId);
      }
      
      if (status) {
        whereClause += ' AND status = ?';
        params.push(status);
      }
      
      const sql = `SELECT COUNT(*) as total FROM orders ${whereClause}`;
      const result = await db.queryOne<{ total: number }>(sql, params);
      return result?.total || 0;
      
    } catch (error) {
      this.logger.error('Failed to get order count:', error);
      return 0;
    }
  }

  private async getOptimizedRouteForDriver(driverId: string, orders: Order[]): Promise<any> {
    // Convert to route optimization format
    const orderPoints = orders.flatMap(order => [
      {
        orderId: order.id,
        orderNumber: order.order_number,
        type: 'pickup',
        address: order.pickup_address,
        coordinates: {
          lat: order.pickup_latitude,
          lng: order.pickup_longitude
        }
      },
      {
        orderId: order.id,
        orderNumber: order.order_number,
        type: 'delivery',
        address: order.delivery_address,
        coordinates: {
          lat: order.delivery_latitude,
          lng: order.delivery_longitude
        }
      }
    ]);
    
    // Get driver's current location
    const driverLocation = await this.getDriverCurrentLocation(driverId);
    
    // Optimize route
    const optimizedRoute = this.optimizeRoute(driverLocation, orderPoints);
    
    // Calculate metrics
    const routeMetrics = this.calculateRouteMetrics(optimizedRoute);
    
    return {
      driverId,
      optimizedSequence: optimizedRoute,
      totalDistance: routeMetrics.distance,
      totalDuration: routeMetrics.duration,
      polyline: this.generateRoutePolyline(optimizedRoute),
      orders: orders.map(order => ({
        id: order.id,
        order_number: order.order_number,
        pickup_address: order.pickup_address,
        delivery_address: order.delivery_address,
        route_order_index: order.route_order_index
      }))
    };
  }

  private async getDriverCurrentLocation(driverId: string): Promise<any> {
    const latestTracking = await this.trackingRepository.getDriverLatestLocation(driverId);
    if (latestTracking) {
      return { lat: latestTracking.latitude, lng: latestTracking.longitude };
    }
    
    const activeOrders = await this.orderRepository.findByDriverIdWithStatus(
      driverId,
      ['driver_assigned', 'route_to_pickup', 'in_transit']
    );
    
    if (activeOrders.length > 0) {
      return { 
        lat: activeOrders[0].pickup_latitude, 
        lng: activeOrders[0].pickup_longitude 
      };
    }
    
    return { lat: 59.925209, lng: 30.341745 };
  }

  private optimizeRoute(startPoint: any, points: any[]): any[] {
    if (points.length === 0) return [];
    
    const result: any[] = [];
    const visited = new Set<string>();
    let currentPoint = startPoint;
    
    const pendingDeliveries = new Map<string, boolean>();
    
    while (result.length < points.length) {
      let nearestIndex = -1;
      let nearestDistance = Infinity;
      
      for (let i = 0; i < points.length; i++) {
        if (!visited.has(points[i].orderId + '_' + points[i].type)) {
          if (points[i].type === 'delivery') {
            const pickupVisited = pendingDeliveries.get(points[i].orderId);
            if (!pickupVisited) continue;
          }
          
          const distance = this.calculateHaversineDistance(
            currentPoint,
            points[i].coordinates
          );
          
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = i;
          }
        }
      }
      
      if (nearestIndex !== -1) {
        const selectedPoint = points[nearestIndex];
        visited.add(selectedPoint.orderId + '_' + selectedPoint.type);
        result.push(selectedPoint);
        currentPoint = selectedPoint.coordinates;
        
        if (selectedPoint.type === 'pickup') {
          pendingDeliveries.set(selectedPoint.orderId, true);
        }
      }
    }
    
    return result;
  }

  private calculateRouteMetrics(route: any[]): { distance: number; duration: number } {
    let totalDistance = 0;
    
    for (let i = 0; i < route.length - 1; i++) {
      totalDistance += this.calculateHaversineDistance(
        route[i].coordinates,
        route[i + 1].coordinates
      );
    }
    
    const duration = (totalDistance / 30) * 60;
    
    return {
      distance: parseFloat(totalDistance.toFixed(2)),
      duration: Math.ceil(duration)
    };
  }

  private calculateHaversineDistance(point1: any, point2: any): number {
    const R = 6371;
    const dLat = this.toRad(point2.lat - point1.lat);
    const dLon = this.toRad(point2.lng - point1.lng);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(point1.lat)) * Math.cos(this.toRad(point2.lat)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private generateRoutePolyline(route: any[]): string {
    const coordinates = route.map(point => [point.coordinates.lat, point.coordinates.lng]);
    return JSON.stringify(coordinates);
  }

  private async calculateNewDriverRating(driverId: string | null, newRating: number): Promise<number> {
    if (!driverId) return newRating;
    
    try {
      const ratings = await this.messagingService.getDriverRatings(driverId);
      if (ratings.length === 0) return newRating;
      
      const total = ratings.reduce((sum, r) => sum + r.rating, 0);
      const average = (total + newRating) / (ratings.length + 1);
      return parseFloat(average.toFixed(2));
      
    } catch (error) {
      this.logger.error('Failed to calculate new driver rating:', error);
      return newRating;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}