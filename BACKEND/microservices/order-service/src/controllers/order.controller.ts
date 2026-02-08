import { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { ResponseUtil } from '../utils/response.util';
import { Logger } from '../utils/logger';

export class OrderController {
  private orderService: OrderService;
  private logger: Logger;
  
  constructor() {
    this.logger = new Logger('OrderController');
    this.orderService = new OrderService();
  }
  
  // New endpoint to receive order from external service
  async receiveOrder(req: Request, res: Response) {
    try {
      this.logger.info('Receiving order from external service:', req.body.orderId);
      
      // Validate the incoming order structure
      if (!req.body.orderId || !req.body.customerInfo || !req.body.driverInfo) {
        return ResponseUtil.error(res, 'Invalid order structure', 400);
      }
      
      // Process the order
      const result = await this.orderService.createOrderFromRequest(req.body);
      
      if (!result.success) {
        return ResponseUtil.error(res, result.message, 400, {
          reason: result.reason,
          recommendations: result.recommendations
        });
      }
      
      return ResponseUtil.success(
        res,
        result,
        'Order received and processing started',
        202 // Accepted
      );
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
      
      return ResponseUtil.success(
        res,
        result,
        'Order accepted successfully'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Accept order error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to accept order', 400, errorMessage);
    }
  }
  
  // Driver rejects order
  async rejectOrder(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const driverId = req.user!.userId;
      const { reason } = req.body;
      
      const result = await this.orderService.rejectOrder(orderId, driverId, reason);
      
      return ResponseUtil.success(
        res,
        result,
        'Order rejected successfully'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Reject order error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to reject order', 400, errorMessage);
    }
  }
  
  // Get order details (for both customer and driver)
  async getOrder(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const includeOptimization = req.query.optimize === 'true';
      const userId = req.user!.userId;
      const userType = req.user!.userType;
      
      const order = await this.orderService.getOrder(orderId, includeOptimization);
      
      // Verify access
      if (userType === 'customer' && order.customerInfo.id !== userId) {
        return ResponseUtil.forbidden(res, 'Access denied');
      }
      
      if (userType === 'driver' && order.driverInfo?.id !== userId) {
        return ResponseUtil.forbidden(res, 'Access denied');
      }
      
      return ResponseUtil.success(
        res,
        order,
        'Order retrieved successfully'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get order error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to get order', 404, errorMessage);
    }
  }
  
  // Send message
  async sendMessage(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const senderId = req.user!.userId;
      const senderType = req.user!.userType;
      const { content, messageType, metadata } = req.body;
      
      const result = await this.orderService.sendMessage(
        orderId,
        senderId,
        senderType,
        content,
        messageType,
        metadata
      );
      
      return ResponseUtil.success(
        res,
        result,
        'Message sent successfully'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Send message error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to send message', 400, errorMessage);
    }
  }
  
  // Get order messages
  async getMessages(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const userId = req.user!.userId;
      const userType = req.user!.userType;
      
      // Get order to verify access
      const order = await this.orderService.getOrder(orderId, false);
      
      if (userType === 'customer' && order.customerInfo.id !== userId) {
        return ResponseUtil.forbidden(res, 'Access denied');
      }
      
      if (userType === 'driver' && order.driverInfo?.id !== userId) {
        return ResponseUtil.forbidden(res, 'Access denied');
      }
      
      return ResponseUtil.success(
        res,
        order.messages,
        'Messages retrieved successfully'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get messages error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to get messages', 400, errorMessage);
    }
  }
  
  // Rate driver
  async rateDriver(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const customerId = req.user!.userId;
      const { rating, review } = req.body;
      
      const result = await this.orderService.rateDriver(orderId, customerId, rating, review);
      
      return ResponseUtil.success(
        res,
        result,
        'Driver rated successfully'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Rate driver error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to rate driver', 400, errorMessage);
    }
  }
  
  // Get user balance
  async getBalance(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const userType = req.user!.userType;
      
      const result = await this.orderService.getUserBalance(userId, userType);
      
      return ResponseUtil.success(
        res,
        result,
        'Balance retrieved successfully'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get balance error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to get balance', 500, errorMessage);
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
      
      return ResponseUtil.success(
        res,
        result,
        'Customer orders retrieved successfully'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get customer orders error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to get customer orders', 500, errorMessage);
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
      
      return ResponseUtil.success(
        res,
        result,
        'Driver orders retrieved successfully'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get driver orders error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to get driver orders', 500, errorMessage);
    }
  }
  
  // Get order tracking
  async getTracking(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const userId = req.user!.userId;
      const userType = req.user!.userType;
      
      // Get order to verify access
      const order = await this.orderService.getOrder(orderId, false);
      
      if (userType === 'customer' && order.customerInfo.id !== userId) {
        return ResponseUtil.forbidden(res, 'Access denied');
      }
      
      if (userType === 'driver' && order.driverInfo?.id !== userId) {
        return ResponseUtil.forbidden(res, 'Access denied');
      }
      
      return ResponseUtil.success(
        res,
        order.tracking,
        'Tracking data retrieved'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get tracking error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to get tracking data', 400, errorMessage);
    }
  }
  
  // Optimize driver route
  async optimizeRoute(req: Request, res: Response) {
    try {
      const driverId = req.user!.userId;
      
      // This would trigger re-optimization
      // In practice, optimization happens automatically when driver accepts new orders
      return ResponseUtil.success(
        res,
        { message: 'Route optimization is automatic when accepting new orders' },
        'Route optimization info'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Optimize route error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to optimize route', 500, errorMessage);
    }
  }
}

export const orderController = new OrderController();