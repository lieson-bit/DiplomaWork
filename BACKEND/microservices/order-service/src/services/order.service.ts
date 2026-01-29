import { logger } from '../utils/logger';
import { orderRepository, Order, CreateOrderData } from '../repositories/order.repository';
import { orderItemRepository } from '../repositories/orderItem.repository';
import { trackingRepository } from '../repositories/tracking.repository';
import { MatchingService } from './matching.service';
import { PricingService } from './pricing.service';
import { KnapsackService } from './knapsack.service';
import { RoutingService } from './routing.service';
import { TrackingService } from './tracking.service';
import { PaymentService } from './payment.service';
import { NotificationService } from './notification.service';
import { BulkService } from './bulk.service';
import { HttpClient } from '../utils/httpClient';

export class OrderService {
  private matchingService = new MatchingService();
  private pricingService = new PricingService();
  private knapsackService = new KnapsackService();
  private routingService = new RoutingService();
  private trackingService = new TrackingService();
  private paymentService = new PaymentService();
  private notificationService = new NotificationService();
  private bulkService = new BulkService();
  private httpClient = new HttpClient();
  
  async createOrder(customerId: string, orderData: any): Promise<Order> {
    try {
      logger.info(`Creating order for customer: ${customerId}`);
      
      // 1. Validate customer exists (call user-service)
      const customer = await this.httpClient.getCustomer(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }
      
      // 2. Calculate route and distance
      const route = await this.routingService.calculateOptimalRoute(
        orderData.pickup_latitude,
        orderData.pickup_longitude,
        orderData.delivery_latitude,
        orderData.delivery_longitude
      );
      
      // 3. Calculate pricing
      const pricing = await this.pricingService.calculateOrderPrice({
        ...orderData,
        distance_km: route.distance,
        customer_type: customer.accountType || 'personal'
      });
      
      // 4. Create order in database
      const orderPayload: CreateOrderData = {
        customer_id: customerId,
        ...orderData,
        ...pricing,
        estimated_distance_km: route.distance,
        estimated_duration_minutes: route.duration,
        route_polyline: route.polyline,
        status: 'pending' as const
      };
      
      const order = await orderRepository.create(orderPayload);
      logger.info(`Order created: ${order.order_number}`);
      
      // 5. Create order items if provided
      if (orderData.order_items && Array.isArray(orderData.order_items)) {
        const itemsWithOrderId = orderData.order_items.map((item: any) => ({
          ...item,
          order_id: order.id
        }));
        await orderItemRepository.createBatch(itemsWithOrderId);
      }
      
      // 6. Queue for driver matching
      await this.matchingService.queueOrderForMatching(order.id);
      
      // 7. Send notification to customer
      await this.notificationService.sendOrderCreatedNotification(customerId, order);
      
      return order;
      
    } catch (error: any) {
      logger.error('Failed to create order:', error);
      throw new Error(`Order creation failed: ${error.message}`);
    }
  }
  
  async getOrder(orderId: string, includeOptimization: boolean = false): Promise<any> {
    try {
      const order = await orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      const orderItems = await orderItemRepository.findByOrderId(orderId);
      const tracking = await trackingRepository.findByOrderId(orderId, { limit: 50 });
      
      const response: any = {
        ...order,
        items: orderItems,
        tracking_points: tracking
      };
      
      // Include knapsack optimization if requested
      if (includeOptimization && order.driver_id) {
        const driver = await this.httpClient.getDriver(order.driver_id);
        if (driver && driver.vehicle) {
          const optimization = await this.knapsackService.optimizeLoading(
            orderItems,
            driver.vehicle.capacity
          );
          response.packing_optimization = optimization;
        }
      }
      
      return response;
    } catch (error: any) {
      logger.error('Failed to get order:', error);
      throw error;
    }
  }
  
  async getCustomerOrders(customerId: string, status?: string, page: number = 1, limit: number = 20): Promise<any> {
    try {
      const result = await orderRepository.findByCustomerId(customerId, {
        status,
        limit,
        offset: (page - 1) * limit
      });
      
      const total = await orderRepository.getOrderStatistics(customerId);
      
      return {
        orders: result,
        pagination: {
          page,
          limit,
          total: total.totalOrders,
          totalPages: Math.ceil(total.totalOrders / limit)
        }
      };
    } catch (error: any) {
      logger.error('Failed to get customer orders:', error);
      throw error;
    }
  }
  
  async getDriverOrders(driverId: string, status?: string, page: number = 1, limit: number = 20): Promise<any> {
    try {
      const result = await orderRepository.findByDriverId(driverId, {
        status,
        limit,
        offset: (page - 1) * limit
      });
      
      const total = await orderRepository.getOrderStatistics(undefined, driverId);
      
      return {
        orders: result,
        pagination: {
          page,
          limit,
          total: total.totalOrders,
          totalPages: Math.ceil(total.totalOrders / limit)
        }
      };
    } catch (error: any) {
      logger.error('Failed to get driver orders:', error);
      throw error;
    }
  }
  
  async getAllOrders(status?: string, page: number = 1, limit: number = 20): Promise<any> {
    try {
      const result = await orderRepository.searchOrders({ status }, { page, limit });
      return result;
    } catch (error: any) {
      logger.error('Failed to get all orders:', error);
      throw error;
    }
  }
  
  async acceptOrder(orderId: string, driverId: string): Promise<Order> {
    try {
      const order = await orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (order.driver_id !== driverId) {
        throw new Error('Driver not assigned to this order');
      }
      
      if (order.status !== 'matched') {
        throw new Error(`Order cannot be accepted in current status: ${order.status}`);
      }
      
      // Update order status
      const updatedOrder = await orderRepository.update(orderId, {
        status: 'driver_accepted',
        accepted_at: new Date()
      });
      
      if (!updatedOrder) {
        throw new Error('Failed to update order');
      }
      
      // Notify customer
      await this.notificationService.sendDriverAcceptedNotification(
        order.customer_id,
        driverId,
        orderId
      );
      
      return updatedOrder;
    } catch (error: any) {
      logger.error('Failed to accept order:', error);
      throw error;
    }
  }
  
  async startPickup(orderId: string, driverId: string, location: any): Promise<Order> {
    try {
      const order = await orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (order.driver_id !== driverId) {
        throw new Error('Driver not assigned to this order');
      }
      
      if (order.status !== 'driver_accepted') {
        throw new Error(`Order cannot be picked up in current status: ${order.status}`);
      }
      
      // Update order status and location
      const updatedOrder = await orderRepository.update(orderId, {
        status: 'pickup_started',
        pickup_started_at: new Date(),
        driver_current_lat: location.latitude,
        driver_current_lng: location.longitude,
        driver_last_updated: new Date()
      });
      
      // Start tracking
      await this.trackingService.startTracking(orderId, driverId, location);
      
      // Notify customer
      await this.notificationService.sendPickupStartedNotification(
        order.customer_id,
        orderId
      );
      
      return updatedOrder as Order;
    } catch (error: any) {
      logger.error('Failed to start pickup:', error);
      throw error;
    }
  }
  
  async updateLocation(orderId: string, driverId: string, location: any): Promise<any> {
    try {
      const order = await orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (order.driver_id !== driverId) {
        throw new Error('Driver not assigned to this order');
      }
      
      // Log location for tracking
      await trackingRepository.create({
        order_id: orderId,
        driver_id: driverId,
        ...location
      });
      
      // Update order with current location
      await orderRepository.update(orderId, {
        driver_current_lat: location.latitude,
        driver_current_lng: location.longitude,
        driver_last_updated: new Date()
      });
      
      // Calculate ETA
      const eta = await this.routingService.calculateETA(
        location.latitude,
        location.longitude,
        order.delivery_latitude,
        order.delivery_longitude
      );
      
      // Broadcast location update (for WebSocket/real-time)
      await this.trackingService.broadcastLocationUpdate(orderId, {
        location,
        eta,
        order_status: order.status
      });
      
      return {
        success: true,
        eta,
        order_id: orderId
      };
    } catch (error: any) {
      logger.error('Failed to update location:', error);
      throw error;
    }
  }
  
  async markInTransit(orderId: string, driverId: string): Promise<Order> {
    try {
      const order = await orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (order.driver_id !== driverId) {
        throw new Error('Driver not assigned to this order');
      }
      
      if (order.status !== 'pickup_started') {
        throw new Error(`Order cannot be marked in transit in current status: ${order.status}`);
      }
      
      const updatedOrder = await orderRepository.update(orderId, {
        status: 'in_transit',
        in_transit_at: new Date()
      });
      
      await this.notificationService.sendInTransitNotification(
        order.customer_id,
        orderId
      );
      
      return updatedOrder as Order;
    } catch (error: any) {
      logger.error('Failed to mark order in transit:', error);
      throw error;
    }
  }
  
  async completeOrder(orderId: string, driverId: string, proof?: any): Promise<any> {
    try {
      const order = await orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (order.driver_id !== driverId) {
        throw new Error('Driver not assigned to this order');
      }
      
      if (order.status !== 'in_transit' && order.status !== 'arrived') {
        throw new Error(`Order cannot be completed in current status: ${order.status}`);
      }
      
      // Update order status to delivered
      const updatedOrder = await orderRepository.update(orderId, {
        status: 'delivered',
        delivered_at: new Date(),
        driver_notes: proof?.delivery_notes
      });
      
      // Process payment
      const paymentResult = await this.paymentService.processOrderCompletion(orderId);
      
      // Update order with payment status
      await orderRepository.update(orderId, {
        status: 'completed',
        completed_at: new Date(),
        payment_status: paymentResult.success ? 'completed' : 'failed'
      });
      
      // Send notifications
      await this.notificationService.sendOrderCompletedNotification(
        order.customer_id,
        driverId,
        orderId,
        paymentResult
      );
      
      return {
        order: updatedOrder,
        payment: paymentResult
      };
    } catch (error: any) {
      logger.error('Failed to complete order:', error);
      throw error;
    }
  }
  
  async cancelOrder(orderId: string, userId: string, userType: string, reason: string): Promise<Order> {
    try {
      const order = await orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Validate cancellation permissions
      if (userType === 'customer' && order.customer_id !== userId) {
        throw new Error('Customer can only cancel their own orders');
      }
      
      if (userType === 'driver' && order.driver_id !== userId) {
        throw new Error('Driver can only cancel their assigned orders');
      }
      
      // Check if order can be cancelled
      const cancellableStatuses = ['pending', 'matched', 'driver_accepted'];
      if (!cancellableStatuses.includes(order.status)) {
        throw new Error(`Order cannot be cancelled in current status: ${order.status}`);
      }
      
      // Update order status
      const updatedOrder = await orderRepository.update(orderId, {
        status: 'cancelled',
        cancelled_at: new Date()
      });
      
      // Record cancellation reason
      // Note: You would need to create a cancellations repository
      
      // Send notifications
      if (userType === 'customer' && order.driver_id) {
        await this.notificationService.sendOrderCancelledNotification(
          order.driver_id,
          orderId,
          'customer_cancelled'
        );
      } else if (userType === 'driver' && order.customer_id) {
        await this.notificationService.sendOrderCancelledNotification(
          order.customer_id,
          orderId,
          'driver_cancelled'
        );
      }
      
      // Process refund if payment was made
      if (order.payment_status === 'completed') {
        await this.paymentService.refundOrder(orderId, reason);
      }
      
      return updatedOrder as Order;
    } catch (error: any) {
      logger.error('Failed to cancel order:', error);
      throw error;
    }
  }
  
  async getTracking(orderId: string): Promise<any> {
    try {
      const order = await orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      const tracking = await trackingRepository.findByOrderId(orderId, { limit: 100, orderBy: 'DESC' });
      const summary = await trackingRepository.getTrackingSummary(orderId);
      
      // Calculate ETA if driver is enroute
      let eta;
      if (order.driver_current_lat && order.driver_current_lng) {
        eta = await this.routingService.calculateETA(
          order.driver_current_lat,
          order.driver_current_lng,
          order.delivery_latitude,
          order.delivery_longitude
        );
      }
      
      return {
        order_id: orderId,
        status: order.status,
        driver_location: order.driver_current_lat && order.driver_current_lng ? {
          latitude: order.driver_current_lat,
          longitude: order.driver_current_lng,
          last_updated: order.driver_last_updated
        } : null,
        tracking_summary: summary,
        recent_tracking: tracking.slice(0, 20),
        eta,
        route_polyline: order.route_polyline
      };
    } catch (error: any) {
      logger.error('Failed to get tracking:', error);
      throw error;
    }
  }
  
  async matchOrder(orderId: string): Promise<any> {
    try {
      return await this.matchingService.findDriverForOrder(orderId);
    } catch (error: any) {
      logger.error('Failed to match order:', error);
      throw error;
    }
  }
  
  async processExcelUpload(customerId: string, fileBuffer: Buffer): Promise<any> {
    try {
      return await this.bulkService.processExcelUpload(customerId, fileBuffer);
    } catch (error: any) {
      logger.error('Failed to process Excel upload:', error);
      throw error;
    }
  }
}