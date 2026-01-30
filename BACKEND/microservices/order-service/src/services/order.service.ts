import { logger } from '../utils/logger';
import { orderRepository, Order, CreateOrderData } from '../repositories/order.repository';
import { orderItemRepository } from '../repositories/orderItem.repository';
import { trackingRepository } from '../repositories/tracking.repository';
import { MatchingService } from './matching.service';
import { PricingService } from './pricing.service';
import { KnapsackService } from './knapsack.service';
import { PaymentService } from './payment.service';
import { NotificationService } from './notification.service';
import { BulkService } from './bulk.service';
import { HttpClient } from '../utils/httpClient';
import { distanceUtil } from '../utils/distance.util';

export class OrderService {
  private matchingService = new MatchingService();
  private pricingService = new PricingService(distanceUtil);
  private knapsackService = new KnapsackService();
  private paymentService = new PaymentService();
  private notificationService = new NotificationService();
  private bulkService = new BulkService();
  private httpClient = new HttpClient();
  
  async createOrder(customerId: string, orderData: any): Promise<Order> {
    try {
      logger.info(`Creating order for customer: ${customerId}`);
      
      // 1. Verify customer exists
      await this.httpClient.get(`${process.env.USER_SERVICE_URL}/api/auth/validate/${customerId}`, {
        headers: { 'x-service-secret': process.env.SERVICE_SECRET }
      });
      
      // 2. Calculate distance using Haversine formula
      const distance = distanceUtil.calculateHaversineDistance(
        { lat: orderData.pickup_latitude, lng: orderData.pickup_longitude },
        { lat: orderData.delivery_latitude, lng: orderData.delivery_longitude }
      );
      
      // 3. Calculate pricing
      const pricing = await this.pricingService.calculatePrice({
        pickupAddress: orderData.pickup_address,
        deliveryAddress: orderData.delivery_address,
        pickupLatLng: { lat: orderData.pickup_latitude, lng: orderData.pickup_longitude },
        deliveryLatLng: { lat: orderData.delivery_latitude, lng: orderData.delivery_longitude },
        weight: orderData.total_weight_kg,
        volume: orderData.total_volume_m3,
        priority: orderData.priority || 'normal',
        isFragile: orderData.fragile_items || false,
        isTemperatureControlled: orderData.temperature_controlled || false
      });
      
      // 4. Verify customer can afford the order
      const canAfford = await this.paymentService.verifyCustomerBalance(
        customerId,
        pricing.totalPrice
      );
      
      if (!canAfford) {
        throw new Error(`Insufficient balance. Order total: $${pricing.totalPrice.toFixed(2)}`);
      }
      
      // 5. Create order in database
      const orderPayload: CreateOrderData = {
        customer_id: customerId,
        ...orderData,
        base_price: pricing.basePrice,
        distance_fee: pricing.distanceFee,
        weight_fee: pricing.weightFee,
        volume_fee: pricing.volumeFee,
        rush_fee: pricing.rushFee,
        fuel_surcharge: pricing.fuelSurcharge,
        special_handling_fee: pricing.specialHandlingFee,
        platform_fee: pricing.platformFee,
        platform_fee_percent: pricing.platformFeePercent,
        subtotal_price: pricing.subtotal,
        tax_amount: pricing.taxAmount,
        total_price: pricing.totalPrice,
        driver_earnings: pricing.driverEarnings,
        estimated_distance_km: pricing.estimatedDistance,
        estimated_duration_minutes: pricing.estimatedDuration,
        status: 'pending' as const,
        payment_status: 'pending' as const
      };
      
      const order = await orderRepository.create(orderPayload);
      logger.info(`Order created: ${order.order_number}`);
      
      // 6. Create order items if provided
      if (orderData.order_items && Array.isArray(orderData.order_items)) {
        const itemsWithOrderId = orderData.order_items.map((item: any) => ({
          order_id: order.id,
          item_name: item.item_name,
          quantity: item.quantity || 1,
          weight_per_item_kg: item.weight_per_item_kg,
          dimensions_length_cm: item.dimensions_length_cm,
          dimensions_width_cm: item.dimensions_width_cm,
          dimensions_height_cm: item.dimensions_height_cm,
          fragile: item.fragile || false,
          temperature_sensitive: item.temperature_sensitive || false,
          special_handling: item.special_handling
        }));
        await orderItemRepository.createBatch(itemsWithOrderId);
      }
      
      // 7. Queue for driver matching
      await this.matchingService.queueOrderForMatching(order.id);
      
      // 8. Send notification to customer
      await this.notificationService.sendOrderNotification(
        customerId,
        order.id,
        'order_created',
        { orderNumber: order.order_number, totalPrice: order.total_price }
      );
      
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
      const tracking = await trackingRepository.findByOrderId(orderId, { limit: 20 });
      
      const response: any = {
        ...order,
        items: orderItems,
        tracking_points: tracking
      };
      
      // Include knapsack optimization if requested and order has driver
      if (includeOptimization && order.driver_id) {
        // Get driver vehicle info from driver service
        try {
          const vehicleResponse = await this.httpClient.get(
            `${process.env.DRIVER_SERVICE_URL}/api/drivers/${order.driver_id}/vehicle`,
            {
              headers: { 'x-service-secret': process.env.SERVICE_SECRET }
            }
          );
          
          if (vehicleResponse.data) {
            const optimization = this.knapsackService.optimizeLoading(
              orderItems.map(item => ({
                id: item.id,
                weight: item.weight_per_item_kg || 0.1,
                volume: this.calculateVolume(item),
                fragile: item.fragile,
                temperatureSensitive: item.temperature_sensitive
              })),
              {
                maxWeight: vehicleResponse.data.maxWeight || 100,
                maxVolume: vehicleResponse.data.maxVolume || 2,
                hasRefrigeration: vehicleResponse.data.hasRefrigeration || false
              }
            );
            response.packing_optimization = optimization;
          }
        } catch (error) {
          logger.warn('Could not get vehicle info for optimization:', error);
        }
      }
      
      return response;
    } catch (error: any) {
      logger.error('Failed to get order:', error);
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
      await this.notificationService.sendOrderNotification(
        order.customer_id,
        orderId,
        'driver_accepted',
        { driverId }
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
      await trackingRepository.create({
        order_id: orderId,
        driver_id: driverId,
        latitude: location.latitude,
        longitude: location.longitude,
        speed: location.speed,
        bearing: location.bearing,
        accuracy: location.accuracy
      });
      
      // Notify customer
      await this.notificationService.sendOrderNotification(
        order.customer_id,
        orderId,
        'pickup_started',
        { location }
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
      
      // Calculate ETA using simple distance calculation
      const remainingDistance = distanceUtil.calculateHaversineDistance(
        { lat: location.latitude, lng: location.longitude },
        { lat: order.delivery_latitude, lng: order.delivery_longitude }
      );
      
      const etaMinutes = Math.ceil((remainingDistance / 30) * 60); // Assume 30 km/h average
      
      // Broadcast location update (for WebSocket/real-time)
      await this.notificationService.broadcastLocationUpdate(orderId, {
        location,
        eta: etaMinutes,
        remainingDistance
      });
      
      return {
        success: true,
        eta: etaMinutes,
        remaining_distance_km: remainingDistance,
        order_id: orderId
      };
    } catch (error: any) {
      logger.error('Failed to update location:', error);
      throw error;
    }
  }
  
  async completeOrder(orderId: string, driverId: string, paymentMethod: 'wallet' | 'cash' = 'wallet', proof?: any): Promise<any> {
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
      await orderRepository.update(orderId, {
        status: 'delivered',
        delivered_at: new Date(),
        driver_notes: proof?.delivery_notes,
        actual_distance_km: await this.calculateActualDistance(orderId),
        actual_duration_minutes: this.calculateActualDuration(order)
      });
      
      // Process payment
      const paymentResult = await this.paymentService.processPayment({
        orderId,
        customerId: order.customer_id,
        driverId,
        amount: order.total_price,
        paymentMethod
      });
      
      // Update order with payment status
      await orderRepository.update(orderId, {
        status: 'completed',
        completed_at: new Date(),
        payment_status: paymentResult.success ? 'completed' : 'failed',
        payment_method: paymentMethod,
        customer_balance_updated: paymentResult.customerBalanceUpdated,
        driver_balance_updated: paymentResult.driverBalanceUpdated
      });
      
      // Send notifications
      await this.notificationService.sendOrderNotification(
        order.customer_id,
        orderId,
        'order_delivered',
        { paymentMethod, amount: order.total_price }
      );
      
      await this.notificationService.sendOrderNotification(
        driverId,
        orderId,
        'payment_received',
        { amount: this.paymentService.calculateDriverEarnings(order.total_price) }
      );
      
      return {
        success: true,
        order: await orderRepository.findById(orderId),
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
      
      // Process refund if payment was made
      if (order.payment_status === 'completed') {
        await this.paymentService.refundPayment(
          order.customer_id,
          order.driver_id || '',
          order.total_price,
          orderId,
          'order_cancellation'
        );
      }
      
      // Update order status
      const updatedOrder = await orderRepository.update(orderId, {
        status: 'cancelled',
        cancelled_at: new Date()
      });
      
      // Send notifications
      if (userType === 'customer' && order.driver_id) {
        await this.notificationService.sendOrderNotification(
          order.driver_id,
          orderId,
          'order_cancelled',
          { cancelledBy: 'customer', reason }
        );
      } else if (userType === 'driver' && order.customer_id) {
        await this.notificationService.sendOrderNotification(
          order.customer_id,
          orderId,
          'order_cancelled',
          { cancelledBy: 'driver', reason }
        );
      }
      
      return updatedOrder as Order;
    } catch (error: any) {
      logger.error('Failed to cancel order:', error);
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
      // Parse Excel file using excel parser utility
      const excelParser = new (require('../utils/excel.parser')).ExcelParser();
      const parseResult = await excelParser.parseBulkOrderFile(fileBuffer);
      
      if (!parseResult.success) {
        throw new Error(`Failed to parse Excel file: ${parseResult.errors.map(e => e.message).join(', ')}`);
      }
      
      // Create orders from parsed data
      const results = {
        successful: [],
        failed: []
      };
      
      for (const orderData of parseResult.data) {
        try {
          const order = await this.createOrder(customerId, {
            ...orderData,
            customerId // Ensure customerId is set
          });
          results.successful.push(order);
        } catch (error: any) {
          results.failed.push({
            data: orderData,
            error: error.message
          });
        }
      }
      
      return {
        success: true,
        ...results,
        metadata: parseResult.metadata
      };
    } catch (error: any) {
      logger.error('Failed to process Excel upload:', error);
      throw error;
    }
  }
  
  private calculateVolume(item: any): number {
    if (item.dimensions_length_cm && item.dimensions_width_cm && item.dimensions_height_cm) {
      return (item.dimensions_length_cm * item.dimensions_width_cm * item.dimensions_height_cm) / 1000000;
    }
    return 0.01; // Default volume if dimensions not provided
  }
  
  private async calculateActualDistance(orderId: string): Promise<number> {
    const trackingPoints = await trackingRepository.findByOrderId(orderId);
    
    if (trackingPoints.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < trackingPoints.length; i++) {
      totalDistance += distanceUtil.calculateHaversineDistance(
        { lat: trackingPoints[i-1].latitude, lng: trackingPoints[i-1].longitude },
        { lat: trackingPoints[i].latitude, lng: trackingPoints[i].longitude }
      );
    }
    
    return parseFloat(totalDistance.toFixed(2));
  }
  
  private calculateActualDuration(order: Order): number {
    if (!order.pickup_started_at || !order.delivered_at) return 0;
    
    const start = new Date(order.pickup_started_at).getTime();
    const end = new Date(order.delivered_at).getTime();
    
    return Math.round((end - start) / (1000 * 60)); // minutes
  }
}