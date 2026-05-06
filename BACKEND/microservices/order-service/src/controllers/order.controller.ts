// src/controllers/order.controller.ts
import { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { ResponseUtil } from '../utils/response.util';
import { Logger } from '../utils/logger';
import { OrderReceiveRequest } from '../types/index';
import { NotificationService } from '../services/NotificationService';

export class OrderController {
  private orderService: OrderService;
  private notificationService: NotificationService;
  private logger: Logger;
  
  constructor(orderService: OrderService) {
    this.logger = new Logger('OrderController');
    this.orderService = orderService;
    this.notificationService = new NotificationService();
  }
  
  // Receive order from UI
  async receiveOrder(req: Request, res: Response) {
    try {
      this.logger.info('Receiving order from UI');
      const orderRequest = req.body as OrderReceiveRequest;
      
      const result = await this.orderService.createOrderFromExternalRequest(orderRequest);
      
      if (!result.success) {
        return ResponseUtil.error(res, result.message, 400, {
          reason: result.reason,
          recommendations: result.recommendations,
          capacityDetails: result.capacityDetails
        });
      }
      
      return ResponseUtil.success(res, result.order, result.message, 201);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Receive order error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to process order', 500, errorMessage);
    }
  }

  // Driver accepts order
  async acceptOrder(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const driverId = req.user!.userId;
      
      const result = await this.orderService.acceptOrder(orderId, driverId);
      
      return ResponseUtil.success(res, result.order, result.message);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Accept order error:', errorMessage);
      return ResponseUtil.error(res, errorMessage, 400);
    }
  }
  
  // Driver rejects order
  async rejectOrder(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const driverId = req.user!.userId;
      const { reason } = req.body;
      
      const result = await this.orderService.rejectOrder(orderId, driverId, reason);
      
      return ResponseUtil.success(res, result.order, result.message);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Reject order error:', errorMessage);
      return ResponseUtil.error(res, errorMessage, 400);
    }
  }
  
  // Get order with progress
  async getOrderWithProgress(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const userId = req.user!.userId;
      const userType = req.user!.userType;
      
      const order = await this.orderService.getOrderWithProgress(orderId, userId, userType);
      
      return ResponseUtil.success(res, order, 'Order retrieved successfully');
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get order error:', errorMessage);
      return ResponseUtil.error(res, errorMessage, 404);
    }
  }

  // Update order status (driver)
  async updateOrderStatus(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const driverId = req.user!.userId;
      const { status, location } = req.body;
      
      if (!status) {
        return ResponseUtil.error(res, 'Status is required', 400);
      }
      
      // Get the order before update to know the old status
      const oldOrder = await this.orderService.getOrder(orderId);
      
      // Check if order exists
      if (!oldOrder) {
        return ResponseUtil.error(res, 'Order not found', 404);
      }
      
      const oldStatus = oldOrder.status;
      
      const result = await this.orderService.updateOrderStatus(orderId, driverId, status, location);
      
      // Auto-create notifications when status changes
      if (oldStatus !== status && result.order) {
        await this.createStatusChangeNotification(result.order, oldStatus, status);
      }
      
      return ResponseUtil.success(res, result.order, result.message);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Update status error:', errorMessage);
      return ResponseUtil.error(res, errorMessage, 400);
    }
  }

  // Helper method to create notifications
  // Helper method to create notifications
private async createStatusChangeNotification(order: any, oldStatus: string, newStatus: string) {
  try {
    // Define the notification type union
    type NotificationType = 'order' | 'payment' | 'system' | 'message' | 'document';
    type Priority = 'low' | 'medium' | 'high';
    
    // Notify customer about order status changes
    if (order.customer_id) {
      let customerNotification: {
        type: NotificationType;
        title: string;
        message: string;
        priority: Priority;
        actionable: boolean;
        actionText: string;
        actionLink: string;
        orderId: string;
        orderNumber: string;
      } | null = null;
      
      switch (newStatus) {
        case 'driver_assigned':
          customerNotification = {
            type: 'order',
            title: 'Driver Assigned',
            message: `A driver has been assigned to your order ${order.order_number?.slice(-8)}. They will arrive shortly.`,
            priority: 'medium',
            actionable: true,
            actionText: 'Track Order',
            actionLink: '/order-tracking',
            orderId: order.id,
            orderNumber: order.order_number
          };
          break;
          
        case 'route_to_pickup':
          customerNotification = {
            type: 'order',
            title: 'Driver En Route to Pickup',
            message: `Your driver is on the way to pickup your order ${order.order_number?.slice(-8)}.`,
            priority: 'medium',
            actionable: true,
            actionText: 'Track Order',
            actionLink: '/order-tracking',
            orderId: order.id,
            orderNumber: order.order_number
          };
          break;
          
        case 'in_transit':
          customerNotification = {
            type: 'order',
            title: 'Order Out for Delivery',
            message: `Your order ${order.order_number?.slice(-8)} is out for delivery. Expected arrival soon.`,
            priority: 'medium',
            actionable: true,
            actionText: 'Track Order',
            actionLink: '/order-tracking',
            orderId: order.id,
            orderNumber: order.order_number
          };
          break;
          
        case 'delivered':
          customerNotification = {
            type: 'order',
            title: 'Order Delivered',
            message: `Your order ${order.order_number?.slice(-8)} has been delivered successfully. Please rate your experience.`,
            priority: 'low',
            actionable: true,
            actionText: 'Rate Driver',
            actionLink: '/order-tracking',
            orderId: order.id,
            orderNumber: order.order_number
          };
          break;
          
        case 'cancelled':
          customerNotification = {
            type: 'order',
            title: 'Order Cancelled',
            message: `Your order ${order.order_number?.slice(-8)} has been cancelled.`,
            priority: 'high',
            actionable: true,
            actionText: 'View Details',
            actionLink: '/order-tracking',
            orderId: order.id,
            orderNumber: order.order_number
          };
          break;
      }
      
      if (customerNotification) {
        await this.notificationService.createNotification(order.customer_id, {
          userId: order.customer_id,
          userType: 'customer',
          type: customerNotification.type,
          title: customerNotification.title,
          message: customerNotification.message,
          priority: customerNotification.priority,
          actionable: customerNotification.actionable,
          actionText: customerNotification.actionText,
          actionLink: customerNotification.actionLink,
          orderId: customerNotification.orderId,
          orderNumber: customerNotification.orderNumber
        });
      }
    }
    
    // Notify driver about order assignment
    if (order.driver_id && newStatus === 'driver_assigned' && oldStatus !== 'driver_assigned') {
      const driverNotification = {
        type: 'order' as const,
        title: 'New Order Assigned',
        message: `You have been assigned to order ${order.order_number?.slice(-8)}. Estimated earnings: $${order.pricing?.estimated_usd || '0'}`,
        priority: 'medium' as const,
        actionable: true,
        actionText: 'View Order',
        actionLink: '/order-tracking',
        orderId: order.id,
        orderNumber: order.order_number
      };
      
      await this.notificationService.createNotification(order.driver_id, {
        userId: order.driver_id,
        userType: 'driver',
        type: driverNotification.type,
        title: driverNotification.title,
        message: driverNotification.message,
        priority: driverNotification.priority,
        actionable: driverNotification.actionable,
        actionText: driverNotification.actionText,
        actionLink: driverNotification.actionLink,
        orderId: driverNotification.orderId,
        orderNumber: driverNotification.orderNumber
      });
    }
    
  } catch (error) {
    console.error('Error creating status change notification:', error);
    // Don't throw - notification failure shouldn't break the order update
  }
}

  // Get driver's optimized route
  async getOptimizedRoute(req: Request, res: Response) {
    try {
      const driverId = req.user!.userId;
      
      const route = await this.orderService.getDriverOptimizedRoute(driverId);
      
      return ResponseUtil.success(res, route, 'Optimized route retrieved');
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get optimized route error:', errorMessage);
      return ResponseUtil.error(res, errorMessage, 400);
    }
  }

  // Get order tracking data
  async getOrderTracking(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const userId = req.user!.userId;
      const userType = req.user!.userType;
      
      // Get order to verify access
      const order = await this.orderService.getOrder(orderId);
      
      if (!order) {
        return ResponseUtil.error(res, 'Order not found', 404);
      }
      
      if (userType === 'customer' && order.customer_id !== userId) {
        return ResponseUtil.forbidden(res, 'Access denied');
      }
      
      if (userType === 'driver' && order.driver_id !== userId) {
        return ResponseUtil.forbidden(res, 'Access denied');
      }
      
      // Get tracking data from order service
      const tracking = await this.orderService.getOrderTracking(orderId);
      
      return ResponseUtil.success(res, tracking, 'Tracking data retrieved');
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get tracking error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to get tracking data', 400, errorMessage);
    }
  }
  
  // Get order messages
  async getMessages(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const userId = req.user!.userId;
      const userType = req.user!.userType;
      
      // Get order to verify access
      const order = await this.orderService.getOrder(orderId);
      
      if (!order) {
        return ResponseUtil.error(res, 'Order not found', 404);
      }
      
      if (userType === 'customer' && order.customer_id !== userId) {
        return ResponseUtil.forbidden(res, 'Access denied');
      }
      
      if (userType === 'driver' && order.driver_id !== userId) {
        return ResponseUtil.forbidden(res, 'Access denied');
      }
      
      // Get messages from order service
      const messages = await this.orderService.getOrderMessages(orderId, userId);
      
      return ResponseUtil.success(res, messages, 'Messages retrieved');
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get messages error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to get messages', 400, errorMessage);
    }
  }

  async getOrder(req: Request, res: Response) {
  try {
    const orderId = req.params.id;
    const userId = req.user!.userId;
    const userType = req.user!.userType;
    
    const order = await this.orderService.getOrder(orderId);
    
    if (!order) {
      return ResponseUtil.error(res, 'Order not found', 404);
    }
    
    // Verify access
    if (userType === 'customer' && order.customer_id !== userId) {
      return ResponseUtil.forbidden(res, 'Access denied');
    }
    
    if (userType === 'driver' && order.driver_id !== userId) {
      return ResponseUtil.forbidden(res, 'Access denied');
    }
    
    return ResponseUtil.success(res, order, 'Order retrieved successfully');
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error('Get order error:', errorMessage);
    return ResponseUtil.error(res, errorMessage, 404);
  }
}


  // Send message
  async sendMessage(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const senderId = req.user!.userId;
      const senderType = req.user!.userType;
      const { content } = req.body;
      
      if (!content) {
        return ResponseUtil.error(res, 'Message content is required', 400);
      }
      
      const result = await this.orderService.sendMessage(orderId, senderId, senderType as 'customer' | 'driver', content);
      
      return ResponseUtil.success(res, result.message, 'Message sent');
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Send message error:', errorMessage);
      return ResponseUtil.error(res, errorMessage, 400);
    }
  }
  
  // Rate driver
  async rateDriver(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const customerId = req.user!.userId;
      const { rating, review } = req.body;
      
      if (!rating) {
        return ResponseUtil.error(res, 'Rating is required', 400);
      }
      
      const result = await this.orderService.rateDriver(orderId, customerId, rating, review);
      
      return ResponseUtil.success(res, result, result.message);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Rate driver error:', errorMessage);
      return ResponseUtil.error(res, errorMessage, 400);
    }
  }
  
  // Get user balance
  async getBalance(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const userType = req.user!.userType;
      
      const balance = await this.orderService.getUserBalance(userId, userType);
      
      return ResponseUtil.success(res, balance, 'Balance retrieved');
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get balance error:', errorMessage);
      return ResponseUtil.error(res, errorMessage, 500);
    }
  }
  
  // Get customer orders
  async getCustomerOrders(req: Request, res: Response) {
    try {
      const customerId = req.user!.userId;
      const { status, page, limit } = req.query;
      
      const result = await this.orderService.getCustomerOrders(
        customerId,
        status as string,
        parseInt(page as string) || 1,
        parseInt(limit as string) || 20
      );
      
      return ResponseUtil.success(res, result, 'Orders retrieved');
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get customer orders error:', errorMessage);
      return ResponseUtil.error(res, errorMessage, 500);
    }
  }
  
  // Get driver orders
  async getDriverOrders(req: Request, res: Response) {
    try {
      const driverId = req.user!.userId;
      const { status, page, limit } = req.query;
      
      const result = await this.orderService.getDriverOrders(
        driverId,
        status as string,
        parseInt(page as string) || 1,
        parseInt(limit as string) || 20
      );
      
      return ResponseUtil.success(res, result, 'Orders retrieved');
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get driver orders error:', errorMessage);
      return ResponseUtil.error(res, errorMessage, 500);
    }
  }

  // Get user notifications (polling endpoint)
  // In your OrderController

async getNotifications(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const markAsRead = req.query.markAsRead === 'true';
      
      const notifications = await this.notificationService.getUserNotifications(userId);
      
      if (markAsRead) {
        await this.notificationService.markAllAsRead(userId);
      }
      
      res.json({
        success: true,
        data: { 
          notifications, 
          unreadCount: notifications.filter(n => !n.read).length 
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({ success: false, error: 'Failed to get notifications' });
    }
  }
  
  async markNotificationRead(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { notificationId } = req.params;
      
      await this.notificationService.markAsRead(userId, notificationId);
      
      res.json({
        success: true,
        message: 'Notification marked as read',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
    }
  }
  
  async markAllNotificationsRead(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      
      await this.notificationService.markAllAsRead(userId);
      
      res.json({
        success: true,
        message: 'All notifications marked as read',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ success: false, error: 'Failed to mark notifications as read' });
    }
  }
  
  async deleteNotification(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { notificationId } = req.params;
      
      await this.notificationService.deleteNotification(userId, notificationId);
      
      res.json({
        success: true,
        message: 'Notification deleted',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ success: false, error: 'Failed to delete notification' });
    }
  }
}

