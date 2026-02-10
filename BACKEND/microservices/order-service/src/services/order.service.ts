import { Logger } from '../utils/logger';
import { Order, CreateOrderData, OrderRepository } from '../repositories/order.repository';
import { TrackingRepository } from '../repositories/tracking.repository';
import { NotificationService } from './notification.service';
import { MessagingService } from './messaging.service';
import { BalanceService } from './balance.service';
import { CapacityOptimizationService } from './capacity-optimization.service';
import { WebSocketUtil } from '../utils/websocket.util';

export class OrderService {
  private logger: Logger;
  private notificationService: NotificationService;
  private messagingService: MessagingService;
  private balanceService: BalanceService;
  private websocketUtil: WebSocketUtil;
  private capacityOptimizationService: CapacityOptimizationService;
  private orderRepository: OrderRepository;
  private trackingRepository: TrackingRepository; 

  constructor(websocketUtil: WebSocketUtil, notificationService?: NotificationService) {
    this.logger = new Logger('OrderService');
    this.websocketUtil = websocketUtil;
    this.notificationService = notificationService || new NotificationService(websocketUtil);
    this.messagingService = new MessagingService();
    this.balanceService = new BalanceService();
    this.capacityOptimizationService = new CapacityOptimizationService();
    this.orderRepository = new OrderRepository();
    this.trackingRepository = new TrackingRepository(); // Initialize tracking repository
  }
  
  // Main method to create order from your exact structure
  async createOrderFromRequest(orderData: any): Promise<any> {
    try {
      this.logger.info(`Processing order: ${orderData.orderId}`);

       const dbOrderData = this.transformOrderData(orderData);
      
      // 1. Check driver capacity
      const capacityCheck = await this.checkDriverCapacity(
        orderData.driverInfo.driverId,
        orderData
      );
      
      if (!capacityCheck.canAccept) {
        // Notify customer that booking failed
        await this.notificationService.sendOrderNotification(
          orderData.customerInfo.id,
          orderData.orderId,
          'booking_failed',
          {
            reason: capacityCheck.reason,
            recommendations: capacityCheck.recommendations
          }
        );
        
        return {
          success: false,
          orderId: orderData.orderId,
          reason: capacityCheck.reason,
          recommendations: capacityCheck.recommendations,
          message: 'Booking failed - driver capacity exceeded'
        };
      }
      
      // 2. Create order in database
      const order = await this.orderRepository.create(dbOrderData);
      
      // 3. Send notification to driver to accept/reject
      await this.notificationService.sendOrderNotification(
        orderData.driverInfo.driverId,
        orderData.orderId,
        'order_assigned',
        {
          orderId: orderData.orderId,
          orderNumber: order.order_number,
          customerName: orderData.customerInfo.name,
          pickupAddress: orderData.locations.pickup.address,
          deliveryAddress: orderData.locations.delivery.address,
          estimatedPrice: orderData.pricing.estimatedPrice.usd,
          estimatedDuration: orderData.timing.estimatedDuration.minutes,
          packageWeight: orderData.packageDetails.weight.value,
          packageVolume: orderData.packageDetails.volume.value
        }
      );
      
      // 4. Send real-time update to customer via WebSocket
      await this.websocketUtil.sendToUser(
        orderData.customerInfo.id,
        'order_pending_driver_acceptance',
        { 
          orderId: orderData.orderId,
          orderNumber: order.order_number,
          driverName: orderData.driverInfo.name,
          driverRating: orderData.driverInfo.rating,
          vehicleType: orderData.vehicleInfo.typeFormatted,
          message: 'Order created. Waiting for driver acceptance...'
        }
      );
      
      return {
        success: true,
        order: this.formatOrderForUI(order, orderData),
        capacityCheck,
        message: 'Order created successfully. Waiting for driver acceptance.'
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to create order:', errorMessage);
      throw new Error(`Order creation failed: ${errorMessage}`);
    }
  }
  
  // Check driver capacity before accepting order
  private async checkDriverCapacity(driverId: string, orderData: any): Promise<any> {
    try {
      // Convert order data to capacity format
      const orderCapacity = {
        orderId: orderData.orderId,
        weight: orderData.packageDetails.weight.value,
        volume: orderData.packageDetails.volume.value,
        priority: orderData.packageDetails.urgency || 'normal',
        pickupLocation: {
          lat: orderData.locations.pickup.coordinates.lat,
          lng: orderData.locations.pickup.coordinates.lng
        },
        deliveryLocation: {
          lat: orderData.locations.delivery.coordinates.lat,
          lng: orderData.locations.delivery.coordinates.lng
        },
        estimatedValue: orderData.pricing.estimatedPrice.usd
      };
      
      // Get driver's active orders
      const activeOrders = await this.orderRepository.findByDriverId(driverId, {
        status: ['driver_accepted', 'driver_enroute', 'pickup_started', 'in_transit']
      });
      
      // Convert active orders to capacity format
      const existingOrdersCapacity = activeOrders.map(order => ({
        orderId: order.id,
        weight: order.total_weight_kg,
        volume: order.total_volume_m3,
        priority: order.priority || 'normal',
        pickupLocation: {
          lat: order.pickup_latitude,
          lng: order.pickup_longitude
        },
        deliveryLocation: {
          lat: order.delivery_latitude,
          lng: order.delivery_longitude
        }
      }));
      
      // Check capacity with existing orders
      const capacityResult = await this.capacityOptimizationService.canDriverAcceptOrder(
        driverId,
        orderCapacity,
        existingOrdersCapacity
      );
      
      return capacityResult;
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Capacity check failed:', errorMessage);
      
      // Default to allowing order if capacity check fails
      return {
        canAccept: true,
        reason: 'Capacity check unavailable',
        capacityCheck: {
          weight: { required: 0, available: 100, passes: true },
          volume: { required: 0, available: 10, passes: true },
          orders: { required: 1, available: 10, passes: true }
        },
        estimatedUtilization: { weight: 0, volume: 0, orders: 0 },
        recommendations: []
      };
    }
  }

  private transformOrderData(jsonData: any): CreateOrderData {
  return {
    order_number: jsonData.orderId,
    customer_id: jsonData.customerInfo.id,
    driver_id: jsonData.driverInfo.driverId,
    
    // Pickup info
    pickup_address: jsonData.locations.pickup.address,
    pickup_latitude: jsonData.locations.pickup.coordinates.lat,
    pickup_longitude: jsonData.locations.pickup.coordinates.lng,
    pickup_contact_name: jsonData.customerInfo.name,
    pickup_contact_phone: jsonData.customerInfo.phone,
    pickup_instructions: jsonData.specialRequirements.requirementsList?.join(', ') || null,
    
    // Delivery info
    delivery_address: jsonData.locations.delivery.address,
    delivery_latitude: jsonData.locations.delivery.coordinates.lat,
    delivery_longitude: jsonData.locations.delivery.coordinates.lng,
    delivery_contact_name: jsonData.customerInfo.name,
    delivery_contact_phone: jsonData.customerInfo.phone,
    delivery_instructions: null,
    
    // Package info
    total_weight_kg: jsonData.packageDetails.weight.value,
    total_volume_m3: jsonData.packageDetails.volume.value,
    package_description: `${jsonData.packageDetails.categoryLabel} - ${jsonData.packageDetails.weight.value}kg, ${jsonData.packageDetails.volume.value}m³`,
    fragile_items: jsonData.specialRequirements.fragile,
    temperature_controlled: jsonData.specialRequirements.refrigerated,
    
    // Pricing
    total_price: jsonData.pricing.estimatedPrice.usd,
    
    // Route info
    estimated_distance_km: jsonData.locations.distance.km,
    estimated_duration_minutes: jsonData.timing.estimatedDuration.minutes,
    
    // Status
    priority: jsonData.packageDetails.urgency || 'normal',
    
    // Additional info
    customer_notes: `Urgency: ${jsonData.packageDetails.urgencyLabel}, Category: ${jsonData.packageDetails.categoryLabel}`,
    
    // Set default values for other required fields
    base_price: jsonData.pricing.estimatedPrice.usd * 0.3,
    subtotal_price: jsonData.pricing.estimatedPrice.usd,
    
    // Communication fields
    unread_customer_messages: 0,
    unread_driver_messages: 0,
    
    // Route optimization
    route_order_index: 0
  };
}
  
  // Convert your structure to database format
  private async createOrderRecord(data: any): Promise<Order> {
    const orderPayload: CreateOrderData = {
      order_number: data.orderId,
      customer_id: data.customerInfo.id,
      driver_id: data.driverInfo.driverId,
      
      // Pickup Information
      pickup_address: data.locations.pickup.address,
      pickup_latitude: data.locations.pickup.coordinates.lat,
      pickup_longitude: data.locations.pickup.coordinates.lng,
      pickup_contact_name: data.customerInfo.name,
      pickup_contact_phone: data.customerInfo.phone,
      pickup_instructions: data.specialRequirements.requirementsList?.join(', ') || '',
      
      // Delivery Information
      delivery_address: data.locations.delivery.address,
      delivery_latitude: data.locations.delivery.coordinates.lat,
      delivery_longitude: data.locations.delivery.coordinates.lng,
      delivery_contact_name: data.customerInfo.name,
      delivery_contact_phone: data.customerInfo.phone,
      delivery_instructions: '',
      
      // Package Information
      total_weight_kg: data.packageDetails.weight.value,
      total_volume_m3: data.packageDetails.volume.value,
      package_description: `${data.packageDetails.categoryLabel} - ${data.packageDetails.weight.value}kg, ${data.packageDetails.volume.value}m³`,
      fragile_items: data.specialRequirements.fragile,
      temperature_controlled: data.specialRequirements.refrigerated,
      
      // Pricing
      base_price: data.pricing.estimatedPrice.usd * 0.3, // 30% base
      distance_fee: data.pricing.estimatedPrice.usd * 0.5, // 50% distance
      weight_fee: data.pricing.estimatedPrice.usd * 0.1, // 10% weight
      volume_fee: data.pricing.estimatedPrice.usd * 0.1, // 10% volume
      total_price: data.pricing.estimatedPrice.usd,
      subtotal_price: data.pricing.estimatedPrice.usd,
      
      // Route Information
      estimated_distance_km: data.locations.distance.km,
      estimated_duration_minutes: data.timing.estimatedDuration.minutes,
      
      // Status
      priority: data.packageDetails.urgency || 'normal',
      
      // Additional
      customer_notes: `Urgency: ${data.packageDetails.urgencyLabel}, Category: ${data.packageDetails.categoryLabel}`,
      is_bulk_order: false,

      // Initialize communication fields
      unread_customer_messages: 0,
      unread_driver_messages: 0,

      // Initialize route order index
      route_order_index: 0
    };
    
    return await this.orderRepository.create(orderPayload);
  }
  
  // Driver accepts the order
  async acceptOrder(orderId: string, driverId: string): Promise<any> {
    try {
      const order = await this.orderRepository.findByOrderNumber(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (order.driver_id !== driverId) {
        throw new Error('Driver not assigned to this order');
      }
      
      // Update order status
      const updatedOrder = await this.orderRepository.update(order.id, {
        status: 'driver_accepted',
        accepted_at: new Date()
      });
      
      if (!updatedOrder) {
        throw new Error('Failed to update order');
      }
      
      // Send notification to customer
      await this.notificationService.sendOrderNotification(
        order.customer_id,
        orderId,
        'driver_accepted',
        {
          driverName: await this.getDriverName(driverId),
          driverRating: await this.getDriverRating(driverId),
          vehicleInfo: await this.getVehicleInfo(driverId),
          estimatedArrival: 'Calculating...'
        }
      );
      
      // Send real-time updates
      await this.websocketUtil.sendToUser(
        order.customer_id,
        'order_status_changed',
        {
          orderId: order.order_number,
          status: 'driver_accepted',
          message: 'Driver has accepted your order',
          driverId,
          timestamp: new Date().toISOString()
        }
      );
      
      // Start simulation if this is the first order for driver today
      const driverOrders = await this.orderRepository.findByDriverId(driverId, {
        status: ['driver_accepted', 'driver_enroute', 'pickup_started', 'in_transit']
      });
      
      if (driverOrders.length === 1) {
        // Start simulation for this order
        await this.startRouteSimulation(order.id, driverId);
      } else if (driverOrders.length > 1) {
        // Re-optimize route for multiple orders
        await this.optimizeAndSimulateDriverRoute(driverId);
      }
      
      return {
        success: true,
        order: this.formatOrderForUI(updatedOrder, null),
        message: 'Order accepted successfully'
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to accept order:', errorMessage);
      throw error;
    }
  }
  
  // Driver rejects the order
  async rejectOrder(orderId: string, driverId: string, reason?: string): Promise<any> {
    try {
      const order = await this.orderRepository.findByOrderNumber(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (order.driver_id !== driverId) {
        throw new Error('Driver not assigned to this order');
      }
      
      // Update order status to cancelled
      const updatedOrder = await this.orderRepository.update(order.id, {
        status: 'cancelled',
        cancelled_at: new Date(),
        driver_notes: reason || 'Driver rejected the order'
      });
      
      // Notify customer
      await this.notificationService.sendOrderNotification(
        order.customer_id,
        orderId,
        'order_cancelled',
        {
          reason: reason || 'Driver unavailable',
          message: 'We are looking for another driver for your order'
        }
      );
      
      // TODO: Implement logic to find another driver
      
      return {
        success: true,
        orderId,
        message: 'Order rejected successfully'
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to reject order:', errorMessage);
      throw error;
    }
  }
  
  // Start route simulation for an order
  private async startRouteSimulation(orderId: string, driverId: string): Promise<void> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Simulate driver moving from current location to pickup
      await this.simulateMovement(
        orderId,
        driverId,
        { lat: 59.925209, lng: 30.34174539999999 }, // Default starting point (St. Petersburg center)
        { lat: order.pickup_latitude, lng: order.pickup_longitude },
        'to_pickup'
      );
      
      // Update status to driver_enroute
      await this.orderRepository.update(orderId, {
        status: 'driver_enroute',
        driver_enroute_at: new Date()
      });
      
      // Notify customer
      await this.notificationService.sendOrderNotification(
        order.customer_id,
        order.order_number,
        'driver_enroute',
        {
          message: 'Driver is on the way to pickup location',
          estimatedArrival: '10-15 minutes'
        }
      );
      
      // After pickup simulation, simulate delivery
      setTimeout(async () => {
        await this.simulateMovement(
          orderId,
          driverId,
          { lat: order.pickup_latitude, lng: order.pickup_longitude },
          { lat: order.delivery_latitude, lng: order.delivery_longitude },
          'to_delivery'
        );
        
        // Update status to delivered
        await this.orderRepository.update(orderId, {
          status: 'delivered',
          delivered_at: new Date(),
          completed_at: new Date()
        });
        
        // Process payment
        await this.processPayment(orderId, order.customer_id, driverId, order.total_price);
        
        // Notify customer
        await this.notificationService.sendOrderNotification(
          order.customer_id,
          order.order_number,
          'order_delivered',
          {
            message: 'Your order has been delivered successfully',
            deliveryTime: new Date().toLocaleTimeString()
          }
        );
        
        // Ask for rating
        await this.websocketUtil.sendToUser(
          order.customer_id,
          'request_rating',
          {
            orderId: order.order_number,
            driverId,
            driverName: await this.getDriverName(driverId),
            message: 'How was your delivery experience?'
          }
        );
        
      }, 30000); // Wait 30 seconds for pickup simulation
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Route simulation failed:', errorMessage);
    }
  }
  
  // Simulate driver movement between points
  private async simulateMovement(
    orderId: string,
    driverId: string,
    startPoint: { lat: number; lng: number },
    endPoint: { lat: number; lng: number },
    phase: 'to_pickup' | 'to_delivery'
  ): Promise<void> {
    const steps = 10; // Number of simulation steps
    const interval = 5000; // 5 seconds between updates
    
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      
      // Calculate intermediate point
      const currentLat = startPoint.lat + (endPoint.lat - startPoint.lat) * progress;
      const currentLng = startPoint.lng + (endPoint.lng - startPoint.lng) * progress;
      
      // Create tracking point
      await this.trackingRepository.create({
        order_id: orderId,
        driver_id: driverId,
        latitude: currentLat,
        longitude: currentLng,
        speed: 30 + Math.random() * 20, // Random speed 30-50 km/h
        bearing: this.calculateBearing(startPoint.lat, startPoint.lng, endPoint.lat, endPoint.lng),
        accuracy: 10
      });
      
      // Update order with current location
      await this.orderRepository.updateOrderDriverLocation(orderId, currentLat, currentLng);
      
      // Get order for customer ID
      const order = await this.orderRepository.findById(orderId);
      if (order) {
        // Send real-time location update to customer
        await this.websocketUtil.sendToUser(
          order.customer_id,
          'location_update',
          {
            orderId: order.order_number,
            location: { lat: currentLat, lng: currentLng },
            phase,
            progress: Math.round(progress * 100),
            timestamp: new Date().toISOString()
          }
        );
      }
      
      // Update status based on progress
      if (phase === 'to_pickup' && progress >= 0.5 && i === Math.floor(steps / 2)) {
        await this.orderRepository.update(orderId, {
          status: 'pickup_started',
          pickup_started_at: new Date()
        });
        
        if (order) {
          await this.notificationService.sendOrderNotification(
            order.customer_id,
            order.order_number,
            'pickup_started',
            {
              message: 'Driver has started pickup',
              timestamp: new Date().toISOString()
            }
          );
        }
      }
      
      if (phase === 'to_delivery' && progress >= 0.5 && i === Math.floor(steps / 2)) {
        await this.orderRepository.update(orderId, {
          status: 'in_transit',
          in_transit_at: new Date()
        });
        
        if (order) {
          await this.notificationService.sendOrderNotification(
            order.customer_id,
            order.order_number,
            'in_transit',
            {
              message: 'Order is in transit to delivery location',
              timestamp: new Date().toISOString()
            }
          );
        }
      }
      
      // Wait before next update
      await this.delay(interval);
    }
  }
  
  // Optimize and simulate route for multiple orders
  private async optimizeAndSimulateDriverRoute(driverId: string): Promise<void> {
    try {
      const activeOrders = await this.orderRepository.findByDriverId(driverId, {
        status: ['driver_accepted', 'driver_enroute', 'pickup_started', 'in_transit']
      });
      
      if (activeOrders.length <= 1) return;
      
      // Convert to capacity format for optimization
      const orderCapacities = activeOrders.map(order => ({
        orderId: order.id,
        weight: order.total_weight_kg,
        volume: order.total_volume_m3,
        priority: order.priority || 'normal',
        pickupLocation: {
          lat: order.pickup_latitude,
          lng: order.pickup_longitude
        },
        deliveryLocation: {
          lat: order.delivery_latitude,
          lng: order.delivery_longitude
        }
      }));
      
      // Get optimized route
      const optimization = await this.capacityOptimizationService.optimizeMultipleOrders(
        driverId,
        orderCapacities
      );
      
      // Update orders with sequence
      for (const orderId of optimization.optimalSequence) {
        const order = activeOrders.find(o => o.id === orderId);
        if (order) {
          const sequenceIndex = optimization.optimalSequence.indexOf(orderId);
          await this.orderRepository.update(orderId, {
            route_order_index: sequenceIndex + 1
          });
        }
      } 
      
      // Send optimized route to driver
      await this.websocketUtil.sendToUser(
        driverId,
        'route_optimized',
        {
          optimization,
          message: `Optimized route for ${activeOrders.length} orders`,
          totalDistance: optimization.totalDistance || 0,
          totalDuration: optimization.totalDuration || 0,
          sequence: optimization.optimalSequence.map((id: string, index: number) => {
            const order = activeOrders.find(o => o.id === id);
            return {
              sequence: index + 1,
              orderNumber: order?.order_number,
              address: order?.delivery_address
            };
          })
        }
      );
      
      // Start simulation for optimized route
      await this.simulateOptimizedRoute(driverId, optimization, activeOrders);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Route optimization failed:', errorMessage);
    }
  }
  
  // Simulate optimized route
  private async simulateOptimizedRoute(
    driverId: string,
    optimization: any,
    orders: Order[]
  ): Promise<void> {
    // Get driver's current location (simulated)
    const startPoint = { lat: 59.925209, lng: 30.34174539999999 };
    
    // Follow the optimized sequence
    for (const orderId of optimization.optimalSequence) {
      const order = orders.find(o => o.id === orderId);
      if (!order) continue;
      
      // Simulate to pickup
      await this.simulateMovement(
        order.id,
        driverId,
        startPoint,
        { lat: order.pickup_latitude, lng: order.pickup_longitude },
        'to_pickup'
      );
      
      // Update start point to pickup location for next iteration
      startPoint.lat = order.pickup_latitude;
      startPoint.lng = order.pickup_longitude;
      
      // Simulate to delivery
      await this.simulateMovement(
        order.id,
        driverId,
        startPoint,
        { lat: order.delivery_latitude, lng: order.delivery_longitude },
        'to_delivery'
      );
      
      // Update start point to delivery location for next iteration
      startPoint.lat = order.delivery_latitude;
      startPoint.lng = order.delivery_longitude;
      
      // Mark order as delivered
      await this.orderRepository.update(order.id, {
        status: 'delivered',
        delivered_at: new Date(),
        completed_at: new Date()
      });
      
      // Process payment
      await this.processPayment(order.id, order.customer_id, driverId, order.total_price);
      
      // Notify customer
      await this.notificationService.sendOrderNotification(
        order.customer_id,
        order.order_number,
        'order_delivered',
        {
          message: 'Your order has been delivered successfully',
          deliveryTime: new Date().toLocaleTimeString()
        }
      );
    }
  }
  
  // Process payment
  private async processPayment(
    orderId: string,
    customerId: string,
    driverId: string,
    amount: number
  ): Promise<void> {
    try {
      await this.balanceService.processOrderPayment(
        customerId,
        driverId,
        amount,
        orderId
      );
      
      this.logger.info(`Payment processed: $${amount} from customer ${customerId} to driver ${driverId}`);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Payment processing failed:', errorMessage);
      // Retry logic could be implemented here
    }
  }
  
  // Get order with full details
  async getOrder(orderId: string, includeOptimization: boolean = false): Promise<any> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        const orderByNumber = await this.orderRepository.findByOrderNumber(orderId);
        if (!orderByNumber) {
          throw new Error('Order not found');
        }
        return await this.getOrder(orderByNumber.id, includeOptimization);
      }
      
      // Get tracking data
      const tracking = await this.trackingRepository.findByOrderId(orderId, { limit: 50 });
      
      // Get driver info
      const driverInfo = order.driver_id ? await this.getDriverInfo(order.driver_id) : null;
      
      // Get vehicle info
      const vehicleInfo = order.driver_id ? await this.getVehicleInfo(order.driver_id) : null;
      
      // Get messages
      const messages = await this.messagingService.getOrderMessages(orderId, order.customer_id);
      
      // Calculate progress
      const progress = this.calculateOrderProgress(order);
      
      // Get optimization if requested and driver has multiple orders
      let optimization = null;
      if (includeOptimization && order.driver_id) {
        const driverOrders = await this.orderRepository.findByDriverId(order.driver_id, {
          status: ['driver_accepted', 'driver_enroute', 'pickup_started', 'in_transit']
        });
        
        if (driverOrders.length > 1) {
          optimization = await this.getOptimizationForDriver(order.driver_id, driverOrders);
        }
      }
      
      // Format response
      return {
        id: order.id,
        orderId: order.order_number,
        status: order.status,
        createdAt: order.created_at,
        
        customerInfo: {
          id: order.customer_id,
          name: order.pickup_contact_name,
          phone: order.pickup_contact_phone
        },
        
        locations: {
          pickup: {
            address: order.pickup_address,
            coordinates: {
              lat: order.pickup_latitude,
              lng: order.pickup_longitude
            }
          },
          delivery: {
            address: order.delivery_address,
            coordinates: {
              lat: order.delivery_latitude,
              lng: order.delivery_longitude
            }
          },
          distance: {
            km: order.estimated_distance_km
          }
        },
        
        packageDetails: {
          weight: order.total_weight_kg,
          volume: order.total_volume_m3,
          description: order.package_description
        },
        
        driverInfo,
        vehicleInfo,
        
        pricing: {
          total: order.total_price,
          breakdown: {
            base: order.base_price,
            distance: order.distance_fee,
            weight: order.weight_fee,
            volume: order.volume_fee
          }
        },
        
        timing: {
          estimatedDuration: order.estimated_duration_minutes,
          actualDuration: order.actual_duration_minutes
        },
        
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
        })),
        
        optimization,
        
        currentLocation: order.driver_current_lat && order.driver_current_lng ? {
          latitude: order.driver_current_lat,
          longitude: order.driver_current_lng,
          lastUpdated: order.driver_last_updated
        } : null
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get order:', errorMessage);
      throw error;
    }
  }
  
  // Get customer orders
  async getCustomerOrders(customerId: string, status?: string, page: number = 1, limit: number = 20): Promise<any> {
    try {
      const orders = await this.orderRepository.findByCustomerId(customerId, {
        status,
        limit,
        offset: (page - 1) * limit
      });
      
      const ordersWithDetails = await Promise.all(
        orders.map(async (order) => {
          const progress = this.calculateOrderProgress(order);
          const driverInfo = order.driver_id ? await this.getDriverInfo(order.driver_id) : null;
          
          return {
            id: order.id,
            orderId: order.order_number,
            status: order.status,
            createdAt: order.created_at,
            pickupAddress: order.pickup_address,
            deliveryAddress: order.delivery_address,
            totalPrice: order.total_price,
            packageWeight: order.total_weight_kg,
            packageVolume: order.total_volume_m3,
            driverInfo,
            progress
          };
        })
      );
      
      return {
        success: true,
        orders: ordersWithDetails,
        pagination: {
          page,
          limit,
          total: orders.length,
          hasMore: orders.length === limit
        }
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get customer orders:', errorMessage);
      throw error;
    }
  }
  
  // Get driver orders with optimization
  async getDriverOrders(driverId: string, status?: string, page: number = 1, limit: number = 20): Promise<any> {
    try {
      const orders = await this.orderRepository.findByDriverId(driverId, {
        status: status as any,
        limit,
        offset: (page - 1) * limit
      });
      
      // Get optimization for active orders
      const activeOrders = orders.filter(o => 
        ['driver_accepted', 'driver_enroute', 'pickup_started', 'in_transit'].includes(o.status)
      );
      
      let optimization = null;
      if (activeOrders.length > 1) {
        optimization = await this.getOptimizationForDriver(driverId, activeOrders);
      }
      
      const ordersWithDetails = await Promise.all(
        orders.map(async (order) => {
          const progress = this.calculateOrderProgress(order);
          const customerInfo = {
            name: order.pickup_contact_name,
            phone: order.pickup_contact_phone
          };
          
          return {
            id: order.id,
            orderId: order.order_number,
            status: order.status,
            createdAt: order.created_at,
            pickupAddress: order.pickup_address,
            deliveryAddress: order.delivery_address,
            totalPrice: order.total_price,
            driverEarnings: order.driver_earnings,
            packageWeight: order.total_weight_kg,
            packageVolume: order.total_volume_m3,
            customerInfo,
            progress,
            routeOrderIndex: order.route_order_index
          };
        })
      );
      
      return {
        success: true,
        orders: ordersWithDetails,
        optimization,
        pagination: {
          page,
          limit,
          total: orders.length,
          hasMore: orders.length === limit
        }
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get driver orders:', errorMessage);
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
        await this.orderRepository.update(orderId, {
          unread_customer_messages: ((order as any).unread_customer_messages || 0) + 1
        });
      } else {
        await this.orderRepository.update(orderId, {
          unread_driver_messages: ((order as any).unread_driver_messages || 0) + 1
        });
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
  
  // Rate driver
  async rateDriver(orderId: string, customerId: string, rating: number, review?: string): Promise<any> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (order.customer_id !== customerId) {
        throw new Error('Only customer can rate this order');
      }
      
      if (order.status !== 'delivered' && order.status !== 'completed') {
        throw new Error('Can only rate delivered orders');
      }
      
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }
      
      // Save rating
      await this.messagingService.saveDriverRating(
        orderId,
        customerId,
        order.driver_id!,
        rating,
        review
      );
      
      // Calculate new average (your formula: (current + new) / 2)
      const currentRating = await this.getDriverRating(order.driver_id!);
      const newAverage = (currentRating + rating) / 2;
      
      // Update driver rating in database
      // This would typically update the driver service, but for now we'll log it
      this.logger.info(`Driver ${order.driver_id} rated ${rating}. Current: ${currentRating}, New average: ${newAverage}`);
      
      return {
        success: true,
        newAverageRating: parseFloat(newAverage.toFixed(2)),
        message: 'Rating submitted successfully'
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to rate driver:', errorMessage);
      throw error;
    }
  }
  
  // Get user balance
  async getUserBalance(userId: string, userType: 'customer' | 'driver'): Promise<any> {
    try {
      const balance = await this.balanceService.getUserBalance(userId, userType);
      
      // Get recent transactions
      const recentTransactions = await this.balanceService.getRecentTransactions(userId, 10);
      
      // Calculate this week's totals from orders
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
          .filter(order => order.completed_at && new Date(order.completed_at) >= startOfWeek)
          .reduce((sum, order) => sum + order.total_price, 0);
      } else {
        const thisWeekOrders = await this.orderRepository.findByDriverId(userId, {
          status: 'completed',
          limit: 100
        });
        
        thisWeekTotal = thisWeekOrders
          .filter(order => order.completed_at && new Date(order.completed_at) >= startOfWeek)
          .reduce((sum, order) => sum + (order.driver_earnings || 0), 0);
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
  
  // Helper methods
  private calculateOrderProgress(order: Order): any {
    const steps = [
      { key: 'order_placed', label: 'Order Placed', date: order.created_at },
      { key: 'driver_assigned', label: 'Driver Assigned', date: order.matched_at },
      { key: 'driver_accepted', label: 'Driver Accepted', date: order.accepted_at },
      { key: 'driver_enroute', label: 'Enroute to Pickup', date: order.driver_route_at },
      { key: 'pickup_started', label: 'Pickup Started', date: order.pickup_started_at },
      { key: 'in_transit', label: 'In Transit', date: order.in_transit_at },
      { key: 'delivered', label: 'Delivered', date: order.delivered_at }
    ];
    
    let currentStep = 0;
    let progressPercentage = 0;
    
    switch (order.status) {
      case 'pending':
        currentStep = 0;
        progressPercentage = 10;
        break;
      case 'matched':
        currentStep = 1;
        progressPercentage = 20;
        break;
      case 'driver_accepted':
        currentStep = 2;
        progressPercentage = 30;
        break;
      case 'driver_enroute':
        currentStep = 3;
        progressPercentage = 40;
        break;
      case 'pickup_started':
        currentStep = 4;
        progressPercentage = 50;
        break;
      case 'in_transit':
        currentStep = 5;
        progressPercentage = 70;
        break;
      case 'delivered':
      case 'completed':
        currentStep = 6;
        progressPercentage = 100;
        break;
      default:
        currentStep = 0;
        progressPercentage = 0;
    }
    
    return {
      steps: steps.slice(0, currentStep + 1),
      currentStep,
      progressPercentage,
      currentStatus: order.status
    };
  }
  
  private formatOrderForUI(order: Order, originalData: any | null): any {
    if (originalData) {
      // Use original data for rich formatting
      return {
        ...originalData,
        databaseId: order.id,
        status: order.status,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        
        // Add database fields
        driverEarnings: order.driver_earnings,
        paymentStatus: order.payment_status,
        
        // Add progress
        progress: this.calculateOrderProgress(order)
      };
    }
    
    // Fallback to database data
    return {
      id: order.id,
      orderId: order.order_number,
      status: order.status,
      createdAt: order.created_at,
      
      customerInfo: {
        id: order.customer_id,
        name: order.pickup_contact_name,
        phone: order.pickup_contact_phone
      },
      
      locations: {
        pickup: {
          address: order.pickup_address,
          coordinates: {
            lat: order.pickup_latitude,
            lng: order.pickup_longitude
          }
        },
        delivery: {
          address: order.delivery_address,
          coordinates: {
            lat: order.delivery_latitude,
            lng: order.delivery_longitude
          }
        },
        distance: {
          km: order.estimated_distance_km
        }
      },
      
      packageDetails: {
        weight: order.total_weight_kg,
        volume: order.total_volume_m3,
        description: order.package_description
      },
      
      pricing: {
        total: order.total_price
      },
      
      progress: this.calculateOrderProgress(order)
    };
  }
  
  private async getDriverInfo(driverId: string): Promise<any> {
    // In production, this would call your driver service
    // For simulation, return mock data
    return {
      id: driverId,
      name: `Driver ${driverId.substring(0, 8)}`,
      phone: '+1234567890',
      email: `driver${driverId.substring(0, 8)}@example.com`,
      rating: 4.5,
      profileImage: `https://ui-avatars.com/api/?name=Driver&background=random`,
      totalDeliveries: Math.floor(Math.random() * 100) + 10
    };
  }
  
  private async getDriverName(driverId: string): Promise<string> {
    const info = await this.getDriverInfo(driverId);
    return info.name;
  }
  
  private async getDriverRating(driverId: string): Promise<number> {
    const info = await this.getDriverInfo(driverId);
    return info.rating;
  }
  
  private async getVehicleInfo(driverId: string): Promise<any> {
    // In production, this would call your vehicle service
    return {
      type: 'Small Van',
      make: 'Ford',
      model: 'Transit',
      licensePlate: 'ABC-123',
      capacity: {
        maxWeight: 100,
        maxVolume: 10
      },
      imageUrl: 'https://example.com/van.jpg'
    };
  }
  
  private async getOptimizationForDriver(driverId: string, orders: Order[]): Promise<any> {
    const orderCapacities = orders.map(order => ({
      orderId: order.id,
      weight: order.total_weight_kg,
      volume: order.total_volume_m3,
      priority: order.priority || 'normal',
      pickupLocation: {
        lat: order.pickup_latitude,
        lng: order.pickup_longitude
      },
      deliveryLocation: {
        lat: order.delivery_latitude,
        lng: order.delivery_longitude
      }
    }));
    
    return await this.capacityOptimizationService.optimizeMultipleOrders(
      driverId,
      orderCapacities
    );
  }

  async getOrderWithProgress(orderId: string): Promise<{
    order: any;
    progress: any;
    messages: any[];
    tracking: any[];
    driverLocation?: any;
  }> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Calculate progress
      const progress = this.calculateOrderProgress(order);
      
      // Get messages
      const messages = await this.messagingService.getOrderMessages(orderId, order.customer_id);
      
      // Get tracking data
      const tracking = await this.trackingRepository.findByOrderId(orderId, { limit: 50 });
      
      // Get current driver location
      const driverLocation = order.driver_current_lat && order.driver_current_lng ? {
        latitude: order.driver_current_lat,
        longitude: order.driver_current_lng,
        lastUpdated: order.driver_last_updated
      } : undefined;
      
      // Format order response
      const formattedOrder = this.formatOrderForUI(order, null);
      
      return {
        order: formattedOrder,
        progress,
        messages,
        tracking,
        driverLocation
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get order with progress:', errorMessage);
      throw error;
    }
  }

  // Update order status (for driver)
  async updateOrderStatus(
    orderId: string,
    driverId: string,
    status: string,
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

      // Update order with status-specific timestamps
      const updateData: any = {
        status: status as any,
        updated_at: new Date()
      };

      // Set specific timestamps based on status
      switch (status) {
        case 'driver_enroute':
          updateData.driver_enroute_at = new Date();
          break;
        case 'pickup_started':
          updateData.pickup_started_at = new Date();
          break;
        case 'in_transit':
          updateData.in_transit_at = new Date();
          break;
        case 'delivered':
          updateData.delivered_at = new Date();
          // Complete payment when delivered
          await this.balanceService.completeOrderPayment(orderId);
          break;
        case 'completed':
          updateData.completed_at = new Date();
          break;
      }

      // Update driver location if provided
      if (location) {
        updateData.driver_current_lat = location.latitude;
        updateData.driver_current_lng = location.longitude;
        updateData.driver_last_updated = new Date();
      }

      const updatedOrder = await this.orderRepository.update(orderId, updateData);

      // Notify customer about status change
      await this.notifyCustomerStatusChange(order.customer_id, orderId, status, updatedOrder);

      // Send real-time update
      await this.websocketUtil.sendToUser(
        order.customer_id,
        'order_status_changed',
        {
          orderId: order.order_number,
          status,
          driverId,
          timestamp: new Date().toISOString(),
          ...(location && { location })
        }
      );

      // If driver has multiple active orders, re-optimize route
      if (status === 'driver_enroute' || status === 'in_transit') {
        const activeOrders = await this.orderRepository.findByDriverIdWithStatus(
          driverId,
          ['driver_accepted', 'driver_enroute', 'pickup_started', 'in_transit']
        );

        if (activeOrders.length > 1) {
          await this.optimizeAndSimulateDriverRoute(driverId);
        }
      }

      return {
        success: true,
        order: this.formatOrderForUI(updatedOrder!, null),
        message: `Order status updated to ${status}`
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to update order status:', errorMessage);
      throw error;
    }
  }

  // Validate status transition
  private isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
    const validTransitions: Record<string, string[]> = {
      'pending': ['matched'],
      'matched': ['driver_accepted', 'cancelled'],
      'driver_accepted': ['driver_enroute', 'cancelled'],
      'driver_enroute': ['pickup_started', 'cancelled'],
      'pickup_started': ['in_transit', 'cancelled'],
      'in_transit': ['delivered', 'cancelled'],
      'delivered': ['completed'],
      'completed': [],
      'cancelled': []
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  // Notify customer about status change
  private async notifyCustomerStatusChange(
    customerId: string,
    orderId: string,
    status: string,
    order: any
  ): Promise<void> {
    const statusMessages: Record<string, string> = {
      'driver_accepted': 'Driver has accepted your order',
      'driver_enroute': 'Driver is on the way to pickup location',
      'pickup_started': 'Driver has started pickup',
      'in_transit': 'Order is in transit to delivery location',
      'delivered': 'Your order has been delivered',
      'completed': 'Order completed successfully'
    };

    const message = statusMessages[status];
    if (message) {
      await this.notificationService.sendOrderNotification(
        customerId,
        orderId,
        'status_change',
        {
          status,
          message,
          orderNumber: order.order_number,
          timestamp: new Date().toISOString()
        }
      );
    }
  }

  // Get driver's optimized route
  async getDriverOptimizedRoute(driverId: string): Promise<any> {
    try {
      const activeOrders = await this.orderRepository.findByDriverIdWithStatus(
        driverId,
        ['driver_accepted', 'driver_enroute', 'pickup_started', 'in_transit']
      );

      if (activeOrders.length === 0) {
        return {
          success: true,
          message: 'No active orders',
          route: null
        };
      }

      // Convert to route optimization format
      const orderPoints = activeOrders.flatMap(order => [
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

      // Optimize route using TSP algorithm
      const optimizedRoute = this.optimizeRoute(driverLocation, orderPoints);

      // Calculate route metrics
      const routeMetrics = this.calculateRouteMetrics(optimizedRoute);

      // Generate polyline for map
      const polyline = this.generateRoutePolyline(optimizedRoute);

      return {
        success: true,
        route: {
          driverId,
          optimizedSequence: optimizedRoute,
          totalDistance: routeMetrics.distance,
          totalDuration: routeMetrics.duration,
          estimatedSavings: routeMetrics.savings,
          polyline,
          orders: activeOrders.map(order => ({
            id: order.id,
            orderNumber: order.order_number,
            pickupAddress: order.pickup_address,
            deliveryAddress: order.delivery_address,
            currentLocation: order.driver_current_lat && order.driver_current_lng ? {
              lat: order.driver_current_lat,
              lng: order.driver_current_lng
            } : null
          }))
        }
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get optimized route:', errorMessage);
      throw error;
    }
  }

  // Simple TSP optimization (nearest neighbor)
  private optimizeRoute(startPoint: any, points: any[]): any[] {
    if (points.length === 0) return [];

    const result: any[] = [];
    const visited = new Set<string>();
    let currentPoint = startPoint;

    // Ensure pickup comes before delivery
    const pendingDeliveries = new Map<string, boolean>(); // orderId -> pickupVisited

    while (result.length < points.length) {
      let nearestIndex = -1;
      let nearestDistance = Infinity;

      for (let i = 0; i < points.length; i++) {
        if (!visited.has(points[i].orderId + '_' + points[i].type)) {
          // Check constraints: delivery only after pickup
          if (points[i].type === 'delivery') {
            const pickupVisited = pendingDeliveries.get(points[i].orderId);
            if (!pickupVisited) continue; // Skip delivery if pickup not visited yet
          }

          const distance = this.calculateHaversineDistance(
            { lat: currentPoint.lat, lng: currentPoint.lng },
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

        // Mark pickup as visited
        if (selectedPoint.type === 'pickup') {
          pendingDeliveries.set(selectedPoint.orderId, true);
        }
      }
    }

    return result;
  }

  // Calculate route metrics
  private calculateRouteMetrics(route: any[]): { distance: number; duration: number; savings: any } {
    let totalDistance = 0;

    for (let i = 0; i < route.length - 1; i++) {
      totalDistance += this.calculateHaversineDistance(
        route[i].coordinates,
        route[i + 1].coordinates
      );
    }

    const duration = (totalDistance / 30) * 60; // Assuming 30 km/h average

    // Compare with simple sequential route (pickup1, delivery1, pickup2, delivery2...)
    const sequentialDistance = this.calculateSequentialDistance(route);
    const savings = {
      distance: sequentialDistance - totalDistance,
      time: ((sequentialDistance - totalDistance) / 30) * 60
    };

    return {
      distance: parseFloat(totalDistance.toFixed(2)),
      duration: Math.ceil(duration),
      savings
    };
  }

  // Calculate sequential distance for comparison
  private calculateSequentialDistance(points: any[]): number {
    let distance = 0;

    for (let i = 0; i < points.length - 1; i++) {
      distance += this.calculateHaversineDistance(
        points[i].coordinates,
        points[i + 1].coordinates
      );
    }

    return distance;
  }

  // Generate polyline for map
  private generateRoutePolyline(route: any[]): string {
    const coordinates = route.map(point => [point.coordinates.lat, point.coordinates.lng]);
    return JSON.stringify(coordinates); // Simple JSON array for now
  }

  // Get driver current location
  private async getDriverCurrentLocation(driverId: string): Promise<any> {
    const latestTracking = await this.trackingRepository.getDriverLatestLocation(driverId);
    if (latestTracking) {
      return { lat: latestTracking.latitude, lng: latestTracking.longitude };
    }

    // Fallback to first active order's pickup location
    const activeOrders = await this.orderRepository.findByDriverIdWithStatus(
      driverId,
      ['driver_accepted', 'driver_enroute', 'pickup_started', 'in_transit']
    );

    if (activeOrders.length > 0) {
      return { 
        lat: activeOrders[0].pickup_latitude, 
        lng: activeOrders[0].pickup_longitude 
      };
    }

    // Default location
    return { lat: 59.925209, lng: 30.34174539999999 };
  }

  // Haversine distance calculation
  private calculateHaversineDistance(point1: any, point2: any): number {
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

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
  
  private calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (degrees: number) => degrees * (Math.PI / 180);
    const toDeg = (radians: number) => radians * (180 / Math.PI);
    
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
              Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    
    let bearing = Math.atan2(y, x);
    bearing = toDeg(bearing);
    bearing = (bearing + 360) % 360;
    
    return Math.round(bearing);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}