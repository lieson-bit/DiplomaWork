import express from 'express';
import { authenticate, authorizeDriver, authorizeCustomer, authorizeDriverOrCustomer, verifyServiceSecret } from '../middleware/auth.middleware';
import { OrderController } from '../controllers/order.controller';
import { OrderService } from '../services/order.service';
import { OrderRepository } from '../repositories/order.repository';
import { TrackingRepository } from '../repositories/tracking.repository';
import { validateOrderReceive } from '../middleware/validation.middleware';
import { NotificationService } from '../services/notification.service';
import { wss } from '../index';

const router = express.Router();
const orderRepository = new OrderRepository();
const trackingRepository = new TrackingRepository();
const notificationService = new NotificationService(wss);
const orderService = new OrderService(wss, notificationService, orderRepository, trackingRepository);
const orderController = new OrderController(orderService);


/**
 * @swagger
 * /orders/receive:
 *   post:
 *     summary: Receive order from customer booking form
 *     description: Accepts complete order with all details from customer booking form
 *     tags: [Orders]
 *     security:
 *       - ServiceSecret: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *               createdAt:
 *                 type: string
 *               lastUpdated:
 *                 type: string
 *               customerInfo:
 *                 type: object
 *               locations:
 *                 type: object
 *               packageDetails:
 *                 type: object
 *               specialRequirements:
 *                 type: object
 *               driverInfo:
 *                 type: object
 *               vehicleInfo:
 *                 type: object
 *               pricing:
 *                 type: object
 *               timing:
 *                 type: object
 *               systemInfo:
 *                 type: object
 *               metadata:
 *                 type: object
 *     responses:
 *       202:
 *         description: Order received and processing started
 *       400:
 *         description: Validation failed or capacity exceeded
 *       403:
 *         description: Unauthorized - invalid service secret
 */
router.post('/orders/receive',
  verifyServiceSecret,
  validateOrderReceive,
  orderController.receiveOrder.bind(orderController)
);

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
 *         description: Order ID or order number
 *     responses:
 *       200:
 *         description: Order accepted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 order:
 *                   type: object
 *                 message:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *//*
router.post('/orders/:id/accept',
  authenticate,
  authorizeDriver,
  orderController.acceptOrder.bind(orderController)
);*/

/**
 * @swagger
 * /orders/{id}/reject:
 *   post:
 *     summary: Driver rejects an order
 *     description: Driver rejects an assigned order
 *     tags: [Driver]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID or order number
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for rejection
 *                 example: "Too far from current location"
 *     responses:
 *       200:
 *         description: Order rejected successfully
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *//*
router.post('/orders/:id/reject',
  authenticate,
  authorizeDriver,
  orderController.rejectOrder.bind(orderController)
);

/**
 * @swagger
 * /orders/{id}/progress:
 *   get:
 *     summary: Get order with full progress tracking
 *     description: Get order details including progress bar, tracking, and messages
 *     tags: [Orders, Customer, Driver]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID or order number
 *     responses:
 *       200:
 *         description: Order details with progress retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 order:
 *                   type: object
 *                 progress:
 *                   type: object
 *                 messages:
 *                   type: array
 *                 tracking:
 *                   type: array
 *                 driverLocation:
 *                   type: object
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *//*
router.get('/orders/:id/progress',
  authenticate,
  authorizeDriverOrCustomer,
  orderController.getOrderWithProgress.bind(orderController)
);

/**
 * @swagger
 * /orders/{id}/status:
 *   patch:
 *     summary: Update order status (driver only)
 *     description: Driver updates order status through the workflow (driver_enroute, pickup_started, in_transit, delivered, completed)
 *     tags: [Driver]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID or order number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [driver_enroute, pickup_started, in_transit, delivered, completed]
 *                 example: "in_transit"
 *               location:
 *                 type: object
 *                 properties:
 *                   latitude:
 *                     type: number
 *                     example: 59.925209
 *                   longitude:
 *                     type: number
 *                     example: 30.341745
 *     responses:
 *       200:
 *         description: Order status updated successfully
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *//*
router.patch('/orders/:id/status',
  authenticate,
  authorizeDriver,
  orderController.updateOrderStatus.bind(orderController)
);

/**
 * @swagger
 * /driver/route/optimized:
 *   get:
 *     summary: Get driver's optimized route for multiple orders
 *     description: Returns optimized route using TSP algorithm for driver's active orders
 *     tags: [Driver]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Optimized route retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 route:
 *                   type: object
 *                   properties:
 *                     driverId:
 *                       type: string
 *                     optimizedSequence:
 *                       type: array
 *                     totalDistance:
 *                       type: number
 *                     totalDuration:
 *                       type: number
 *                     estimatedSavings:
 *                       type: object
 *                     polyline:
 *                       type: string
 *                     orders:
 *                       type: array
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *//*
router.get('/driver/route/optimized',
  authenticate,
  authorizeDriver,
  orderController.getOptimizedRoute.bind(orderController)
);

/**
 * @swagger
 * /orders/{id}/tracking:
 *   get:
 *     summary: Get order tracking data
 *     description: Get real-time tracking points for an order
 *     tags: [Orders, Customer, Driver]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID or order number
 *     responses:
 *       200:
 *         description: Tracking data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       latitude:
 *                         type: number
 *                       longitude:
 *                         type: number
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       speed:
 *                         type: number
 *                       bearing:
 *                         type: number
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *//*
router.get('/orders/:id/tracking',
  authenticate,
  authorizeDriverOrCustomer,
  orderController.getOrderTracking.bind(orderController)
);

/**
 * @swagger
 * /customer/orders:
 *   get:
 *     summary: Get customer orders with progress
 *     description: Get all orders for a customer with progress tracking
 *     tags: [Customer]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by order status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Customer orders retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 orders:
 *                   type: array
 *                 pagination:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *//*
router.get('/customer/orders',
  authenticate,
  authorizeCustomer,
  orderController.getCustomerOrders.bind(orderController)
);

/**
 * @swagger
 * /driver/orders:
 *   get:
 *     summary: Get driver orders
 *     description: Get all orders for a driver
 *     tags: [Driver]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by order status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Driver orders retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 orders:
 *                   type: array
 *                 optimization:
 *                   type: object
 *                 pagination:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *//*
router.get('/driver/orders',
  authenticate,
  authorizeDriver,
  orderController.getDriverOrders.bind(orderController)
);

/**
 * @swagger
 * /orders/{id}/messages:
 *   post:
 *     summary: Send message to driver/customer
 *     description: Send in-app message between customer and driver
 *     tags: [Messages]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID or order number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 1000
 *                 example: "Hello, where are you?"
 *               messageType:
 *                 type: string
 *                 enum: [text, location, image, status_update]
 *                 default: text
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Message sent successfully
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *//*
router.post('/orders/:id/messages',
  authenticate,
  authorizeDriverOrCustomer,
  orderController.sendMessage.bind(orderController)
);

/**
 * @swagger
 * /orders/{id}/messages:
 *   get:
 *     summary: Get order messages
 *     description: Get all messages for an order
 *     tags: [Messages]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID or order number
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       senderType:
 *                         type: string
 *                       senderName:
 *                         type: string
 *                       content:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       readStatus:
 *                         type: boolean
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *//*
router.get('/orders/:id/messages',
  authenticate,
  authorizeDriverOrCustomer,
  orderController.getMessages.bind(orderController)
);

/**
 * @swagger
 * /orders/{id}/rate:
 *   post:
 *     summary: Rate driver after order delivery
 *     description: Customer rates driver after delivery (rating = (current + new) / 2)
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID or order number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               review:
 *                 type: string
 *                 example: "Excellent service!"
 *     responses:
 *       200:
 *         description: Driver rated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 newAverageRating:
 *                   type: number
 *                 message:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *//*
router.post('/orders/:id/rate',
  authenticate,
  authorizeCustomer,
  orderController.rateDriver.bind(orderController)
);

/**
 * @swagger
 * /balance:
 *   get:
 *     summary: Get user balance
 *     description: Get customer or driver balance information
 *     tags: [Customer, Driver]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 balance:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     userType:
 *                       type: string
 *                     availableBalance:
 *                       type: number
 *                     pendingBalance:
 *                       type: number
 *                     thisWeekSpent:
 *                       type: number
 *                     thisWeekEarned:
 *                       type: number
 *                     totalEarned:
 *                       type: number
 *                     totalSpent:
 *                       type: number
 *                     currency:
 *                       type: string
 *                 recentTransactions:
 *                   type: array
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *//*
router.get('/balance',
  authenticate,
  orderController.getBalance.bind(orderController)
);

/**
 * @swagger
 * /driver/route/optimize:
 *   post:
 *     summary: Optimize driver route for multiple orders
 *     description: Trigger manual route optimization for driver's active orders
 *     tags: [Driver]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Route optimization triggered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *//*
router.post('/driver/route/optimize',
  authenticate,
  authorizeDriver,
  orderController.optimizeRoute.bind(orderController)
);

/**
 * @swagger
 * /driver/orders/optimized:
 *   get:
 *     summary: Get driver orders with optimization
 *     description: Get driver orders with route optimization data
 *     tags: [Driver]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by order status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Orders with optimization data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 orders:
 *                   type: array
 *                 optimization:
 *                   type: object
 *                 pagination:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *//*
router.get('/driver/orders/optimized',
  authenticate,
  authorizeDriver,
  orderController.getDriverOrders.bind(orderController)
);

/**
 * @swagger
 * /customer/orders/with-tracking:
 *   get:
 *     summary: Get customer orders with tracking data
 *     description: Get customer orders with real-time tracking information
 *     tags: [Customer]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by order status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Orders with tracking data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 orders:
 *                   type: array
 *                 pagination:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *//*
router.get('/customer/orders/with-tracking',
  authenticate,
  authorizeCustomer,
  orderController.getCustomerOrders.bind(orderController)
);*/

export default router;