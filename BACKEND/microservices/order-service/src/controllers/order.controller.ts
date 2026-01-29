import { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { ResponseUtil } from '../utils/response.util';
import { logger } from '../utils/logger';

export class OrderController {
  private orderService = new OrderService();
  
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
    } catch (error: any) {
      logger.error('Create order error:', error);
      return ResponseUtil.error(res, 'Failed to create order', 400, error.message);
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
        `Bulk orders processed: ${result.success} successful, ${result.failed} failed`
      );
    } catch (error: any) {
      logger.error('Create bulk order error:', error);
      return ResponseUtil.error(res, 'Failed to process bulk orders', 400, error.message);
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
    } catch (error: any) {
      logger.error('Upload Excel error:', error);
      return ResponseUtil.error(res, 'Failed to process Excel file', 400, error.message);
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
    } catch (error: any) {
      logger.error('Get orders error:', error);
      return ResponseUtil.error(res, 'Failed to get orders', 500, error.message);
    }
  }
  
  // ... add similar Swagger comments to all other methods ...
}

export const orderController = new OrderController();