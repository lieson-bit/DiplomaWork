// src/controllers/order.controller.ts
import { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { ResponseUtil } from '../utils/response.util';
import { Logger } from '../utils/logger';
import { OrderReceiveRequest } from '../types/index';

export class OrderController {
  private orderService: OrderService;
  private logger: Logger;
  
  constructor(orderService: OrderService) {
    this.logger = new Logger('OrderController');
    this.orderService = orderService;
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
      
      const result = await this.orderService.updateOrderStatus(orderId, driverId, status, location);
      
      return ResponseUtil.success(res, result.order, result.message);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Update status error:', errorMessage);
      return ResponseUtil.error(res, errorMessage, 400);
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
  async getNotifications(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { markAsRead } = req.query;
      
      const notifications = await this.orderService.getUserNotifications(
        userId, 
        markAsRead === 'true'
      );
      
      const unreadCount = await this.orderService.getUnreadNotificationCount(userId);
      
      return ResponseUtil.success(res, { notifications, unreadCount }, 'Notifications retrieved');
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get notifications error:', errorMessage);
      return ResponseUtil.error(res, errorMessage, 500);
    }
  }
}