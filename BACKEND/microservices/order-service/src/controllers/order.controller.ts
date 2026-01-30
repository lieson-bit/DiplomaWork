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
  
  /**
   * @swagger
   * /orders:
   *   post:
   *     summary: Create a new order
   *     tags: [Orders]
   *     security:
   *       - BearerAuth: []
   */
  async createOrder(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const order = await this.orderService.createOrder(userId, req.body);
      
      return ResponseUtil.success(
        res,
        order,
        'Order created successfully',
        201
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Create order error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to create order', 400, errorMessage);
    }
  }
  
  /**
   * @swagger
   * /orders/bulk:
   *   post:
   *     summary: Create bulk orders
   */
  async createBulkOrder(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const result = await this.orderService.createBulkOrder(userId, req.body.orders);
      
      return ResponseUtil.success(
        res,
        result,
        `Bulk orders processed: ${result.successful?.length || 0} successful, ${result.failed?.length || 0} failed`
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Create bulk order error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to process bulk orders', 400, errorMessage);
    }
  }
  
  /**
   * @swagger
   * /orders/upload:
   *   post:
   *     summary: Upload Excel file for bulk orders
   */
  async uploadExcel(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      
      if (!req.file) {
        return ResponseUtil.error(res, 'No file uploaded', 400);
      }
      
      const result = await this.orderService.processExcelUpload(userId, req.file.buffer);
      
      return ResponseUtil.success(
        res,
        result,
        'Excel file processed successfully'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Upload Excel error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to process Excel file', 400, errorMessage);
    }
  }
  
  /**
   * @swagger
   * /orders:
   *   get:
   *     summary: Get orders with filters
   */
  async getOrders(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const userType = req.user!.userType;
      const { status, page, limit } = req.query;
      
      let result;
      if (userType === 'driver') {
        result = await this.orderService.getDriverOrders(
          userId,
          status as string,
          parseInt(page as string) || 1,
          parseInt(limit as string) || 20
        );
      } else if (userType === 'customer') {
        result = await this.orderService.getCustomerOrders(
          userId,
          status as string,
          parseInt(page as string) || 1,
          parseInt(limit as string) || 20
        );
      } else {
        // Admin or other user types
        result = await this.orderService.getAllOrders(
          status as string,
          parseInt(page as string) || 1,
          parseInt(limit as string) || 20
        );
      }
      
      return ResponseUtil.success(
        res,
        result,
        'Orders retrieved successfully'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get orders error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to get orders', 500, errorMessage);
    }
  }

  /**
   * @swagger
   * /orders/{id}:
   *   get:
   *     summary: Get order details by ID
   */
  async getOrder(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const includeOptimization = req.query.optimize === 'true';
      
      const order = await this.orderService.getOrder(orderId, includeOptimization);
      
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

  /**
   * @swagger
   * /orders/{id}/accept:
   *   post:
   *     summary: Driver accepts an order
   */
  async acceptOrder(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const driverId = req.user!.userId;
      
      const order = await this.orderService.acceptOrder(orderId, driverId);
      
      return ResponseUtil.success(
        res,
        order,
        'Order accepted successfully'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Accept order error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to accept order', 400, errorMessage);
    }
  }

  /**
   * @swagger
   * /orders/{id}/start:
   *   post:
   *     summary: Start order pickup
   */
  async startPickup(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const driverId = req.user!.userId;
      const { latitude, longitude } = req.body;
      
      const order = await this.orderService.startPickup(orderId, driverId, { latitude, longitude });
      
      return ResponseUtil.success(
        res,
        order,
        'Pickup started successfully'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Start pickup error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to start pickup', 400, errorMessage);
    }
  }

  /**
   * @swagger
   * /orders/{id}/location:
   *   post:
   *     summary: Update driver location
   */
  async updateLocation(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const driverId = req.user!.userId;
      const location = req.body;
      
      const result = await this.orderService.updateLocation(orderId, driverId, location);
      
      return ResponseUtil.success(
        res,
        result,
        'Location updated successfully'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Update location error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to update location', 400, errorMessage);
    }
  }

  /**
   * @swagger
   * /orders/{id}/complete:
   *   post:
   *     summary: Complete order
   */
  async completeOrder(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const driverId = req.user!.userId;
      const { paymentMethod, proof } = req.body;
      
      const result = await this.orderService.completeOrder(orderId, driverId, paymentMethod, proof);
      
      return ResponseUtil.success(
        res,
        result,
        'Order completed successfully'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Complete order error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to complete order', 400, errorMessage);
    }
  }

  /**
   * @swagger
   * /orders/{id}/cancel:
   *   post:
   *     summary: Cancel an order
   */
  async cancelOrder(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const userId = req.user!.userId;
      const userType = req.user!.userType;
      const { reason } = req.body;
      
      const order = await this.orderService.cancelOrder(orderId, userId, userType, reason);
      
      return ResponseUtil.success(
        res,
        order,
        'Order cancelled successfully'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Cancel order error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to cancel order', 400, errorMessage);
    }
  }

  /**
   * @swagger
   * /driver/orders:
   *   get:
   *     summary: Get driver's orders
   */
  async getDriverOrders(req: Request, res: Response) {
    try {
      const driverId = req.user!.userId;
      const { status, page, limit } = req.query;
      
      const result = await (this.orderService as any).getDriverOrders(
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

  /**
   * @swagger
   * /customer/orders:
   *   get:
   *     summary: Get customer's orders
   */
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

  /**
   * @swagger
   * /tracking/{id}:
   *   get:
   *     summary: Get order tracking
   */
  async getTracking(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      const userId = req.user!.userId;
      const userType = req.user!.userType;
      
      // Check if user has access to this order
      const order = await this.orderService.getOrder(orderId, false);
      
      if (userType === 'customer' && order.customer_id !== userId) {
        return ResponseUtil.forbidden(res, 'Access denied');
      }
      
      if (userType === 'driver' && order.driver_id !== userId) {
        return ResponseUtil.forbidden(res, 'Access denied');
      }
      
      const trackingData = await this.orderService.getOrderTracking(orderId);
      
      return ResponseUtil.success(
        res,
        trackingData,
        'Tracking data retrieved'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Get tracking error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to get tracking data', 400, errorMessage);
    }
  }

  /**
   * @swagger
   * /internal/match/{id}:
   *   post:
   *     summary: Match order (internal)
   */
  async matchOrder(req: Request, res: Response) {
    try {
      const orderId = req.params.id;
      
      const result = await this.orderService.matchOrder(orderId);
      
      return ResponseUtil.success(
        res,
        result,
        'Order matching initiated'
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Match order error:', errorMessage);
      return ResponseUtil.error(res, 'Failed to match order', 500, errorMessage);
    }
  }
}

export const orderController = new OrderController();