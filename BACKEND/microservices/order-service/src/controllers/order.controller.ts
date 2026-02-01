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
   *     description: Create a new delivery order with pickup and delivery details
   *     tags: [Orders]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateOrderRequest'
   *     responses:
   *       201:
   *         description: Order created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Order'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
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
   *     summary: Create multiple orders in bulk
   *     description: Create multiple orders at once (max 100 orders per request)
   *     tags: [Bulk]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/BulkOrderRequest'
   *     responses:
   *       200:
   *         description: Bulk orders processed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   type: object
   *                   properties:
   *                     successful:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/Order'
   *                     failed:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           data:
   *                             type: object
   *                           error:
   *                             type: string
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
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
   *     description: Upload an Excel file containing multiple orders for batch processing
   *     tags: [Bulk]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: Excel file (.xlsx) with order data
   *     responses:
   *       200:
   *         description: Excel file processed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   type: object
   *                   properties:
   *                     successful:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/Order'
   *                     failed:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           data:
   *                             type: object
   *                           error:
   *                             type: string
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       413:
   *         description: File too large (max 10MB)
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
   *     description: Retrieve orders based on user role and filters
   *     tags: [Orders]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending, matched, driver_accepted, driver_enroute, pickup_started, in_transit, arrived, delivered, completed, cancelled, failed]
   *         description: Filter by order status
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Page number for pagination
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Number of items per page
   *     responses:
   *       200:
   *         description: Orders retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       500:
   *         description: Server error
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
   *     description: Retrieve detailed information about a specific order
   *     tags: [Orders]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Order ID
   *       - in: query
   *         name: optimize
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Include knapsack optimization data
   *     responses:
   *       200:
   *         description: Order retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Order'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
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
   *     description: Driver accepts an assigned order
   *     tags: [Driver]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Order ID
   *     responses:
   *       200:
   *         description: Order accepted successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Order'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         description: Driver not assigned to this order
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
   *     description: Driver starts the pickup process for an accepted order
   *     tags: [Driver]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Order ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/LocationUpdateRequest'
   *     responses:
   *       200:
   *         description: Pickup started successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Order'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
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
   *     description: Update driver's current location during order delivery
   *     tags: [Driver]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Order ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/LocationUpdateRequest'
   *     responses:
   *       200:
   *         description: Location updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 eta:
   *                   type: number
   *                   description: Estimated time of arrival in minutes
   *                 remaining_distance_km:
   *                   type: number
   *                 order_id:
   *                   type: string
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
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
   *     description: Mark order as delivered and process payment
   *     tags: [Driver]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Order ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CompleteOrderRequest'
   *     responses:
   *       200:
   *         description: Order completed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 order:
   *                   $ref: '#/components/schemas/Order'
   *                 payment:
   *                   type: object
   *                   properties:
   *                     success:
   *                       type: boolean
   *                     message:
   *                       type: string
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
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
   *     description: Cancel an order (customer or driver can cancel based on permissions)
   *     tags: [Orders]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Order ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CancelOrderRequest'
   *     responses:
   *       200:
   *         description: Order cancelled successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Order'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         description: Permission denied
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
   *     description: Retrieve orders assigned to the authenticated driver
   *     tags: [Driver]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending, matched, driver_accepted, driver_enroute, pickup_started, in_transit, arrived, delivered, completed, cancelled, failed]
   *         description: Filter by order status
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Page number for pagination
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Number of items per page
   *     responses:
   *       200:
   *         description: Driver orders retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       500:
   *         description: Server error
   */
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

  /**
   * @swagger
   * /customer/orders:
   *   get:
   *     summary: Get customer's orders
   *     description: Retrieve orders belonging to the authenticated customer
   *     tags: [Customer]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending, matched, driver_accepted, driver_enroute, pickup_started, in_transit, arrived, delivered, completed, cancelled, failed]
   *         description: Filter by order status
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Page number for pagination
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Number of items per page
   *     responses:
   *       200:
   *         description: Customer orders retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       500:
   *         description: Server error
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
   *     description: Get real-time tracking information for an order
   *     tags: [Tracking]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Order ID
   *     responses:
   *       200:
   *         description: Tracking data retrieved
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TrackingData'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         description: Access denied to this order
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
   *     summary: Match order (internal use)
   *     description: Internal endpoint to trigger order-driver matching
   *     tags: [Orders]
   *     security:
   *       - ServiceSecret: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Order ID
   *     responses:
   *       200:
   *         description: Order matching initiated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   type: object
   *                   properties:
   *                     order_id:
   *                       type: string
   *                     driver_id:
   *                       type: string
   *       403:
   *         description: Invalid service secret
   *       500:
   *         description: Failed to match order
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