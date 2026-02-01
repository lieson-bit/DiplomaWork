import express from 'express';
import { OrderController } from '../controllers/order.controller';
import { authenticate, authorizeCustomer, authorizeDriver, authorizeDriverOrCustomer } from '../middleware/auth.middleware';
import { validate, validationSchemas } from '../middleware/validation.middleware';
import { validateOrderCapacity } from '../middleware/capacity.middleware';
import { verifyCustomerBalance, validatePaymentMethod, verifyServiceSecret } from '../middleware/payment.middleware';
import multer from 'multer';
import Joi from 'joi';

const router = express.Router();
const orderController = new OrderController();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
  }
});

// Extended validation schemas
const extendedValidationSchemas = {
  ...validationSchemas,
  message: {
    send: Joi.object({
      content: Joi.string().required().max(1000),
      messageType: Joi.string().valid('text', 'location', 'image', 'status_update').default('text'),
      metadata: Joi.object()
    })
  },
  location: {
    update: Joi.object({
      latitude: Joi.number().required().min(-90).max(90),
      longitude: Joi.number().required().min(-180).max(180),
      speed: Joi.number().optional().min(0),
      bearing: Joi.number().optional().min(0).max(360),
      accuracy: Joi.number().optional().min(0)
    })
  }
};

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
router.post('/orders',
  authenticate,
  authorizeCustomer,
  validateOrderCapacity,
  verifyCustomerBalance,
  validate(validationSchemas.order.create),
  orderController.createOrder.bind(orderController)
);

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
router.post('/orders/bulk',
  authenticate,
  authorizeCustomer,
  validate(validationSchemas.order.bulk),
  orderController.createBulkOrder.bind(orderController)
);

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
router.post('/orders/upload',
  authenticate,
  authorizeCustomer,
  upload.single('file'),
  orderController.uploadExcel.bind(orderController)
);

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
router.get('/orders',
  authenticate,
  orderController.getOrders.bind(orderController)
);

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
router.get('/orders/:id',
  authenticate,
  orderController.getOrder.bind(orderController)
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
router.post('/orders/:id/accept',
  authenticate,
  authorizeDriver,
  orderController.acceptOrder.bind(orderController)
);

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
router.post('/orders/:id/start',
  authenticate,
  authorizeDriver,
  validate(extendedValidationSchemas.location.update),
  orderController.startPickup.bind(orderController)
);

/**
 * @swagger
 * /orders/{id}/location:
 *   post:
 *     summary: Update driver location during order delivery
 *     description: Update driver's current location during order delivery for real-time tracking
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
router.post('/orders/:id/location',
  authenticate,
  authorizeDriver,
  validate(extendedValidationSchemas.location.update),
  orderController.updateLocation.bind(orderController)
);

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
router.post('/orders/:id/complete',
  authenticate,
  authorizeDriver,
  validatePaymentMethod,
  validate(validationSchemas.order.complete),
  orderController.completeOrder.bind(orderController)
);

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
router.post('/orders/:id/cancel',
  authenticate,
  validate(validationSchemas.order.cancel),
  orderController.cancelOrder.bind(orderController)
);

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
router.get('/driver/orders',
  authenticate,
  authorizeDriver,
  orderController.getDriverOrders.bind(orderController)
);

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
router.get('/customer/orders',
  authenticate,
  authorizeCustomer,
  orderController.getCustomerOrders.bind(orderController)
);

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
router.get('/tracking/:id',
  authenticate,
  orderController.getTracking.bind(orderController)
);

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
router.post('/internal/match/:id',
  verifyServiceSecret,
  orderController.matchOrder.bind(orderController)
);

// Add these routes (for future implementation)

/**
 * @swagger
 * /orders/{id}/messages:
 *   post:
 *     summary: Send message to driver/customer
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MessageRequest'
 *     responses:
 *       200:
 *         description: Message sent successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied to this order
 */
router.post('/orders/:id/messages',
  authenticate,
  authorizeDriverOrCustomer,
  validate(extendedValidationSchemas.message.send),
  (req, res) => {
    res.status(501).json({ 
      success: false, 
      error: 'Messaging not yet implemented',
      message: 'This feature is currently under development'
    });
  }
);

/**
 * @swagger
 * /orders/{id}/messages:
 *   get:
 *     summary: Get order messages
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
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/orders/:id/messages',
  authenticate,
  authorizeDriverOrCustomer,
  (req, res) => {
    res.status(501).json({ 
      success: false, 
      error: 'Messaging not yet implemented',
      message: 'This feature is currently under development'
    });
  }
);

/**
 * @swagger
 * /messages/unread:
 *   get:
 *     summary: Get unread message count
 *     tags: [Messages]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved
 *       401:
 *         description: Unauthorized
 */
router.get('/messages/unread',
  authenticate,
  (req, res) => {
    res.status(501).json({ 
      success: false, 
      error: 'Messaging not yet implemented',
      message: 'This feature is currently under development'
    });
  }
);

/**
 * @swagger
 * /messages/{id}/read:
 *   patch:
 *     summary: Mark message as read
 *     tags: [Messages]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message marked as read
 *       401:
 *         description: Unauthorized
 */
router.patch('/messages/:id/read',
  authenticate,
  (req, res) => {
    res.status(501).json({ 
      success: false, 
      error: 'Messaging not yet implemented',
      message: 'This feature is currently under development'
    });
  }
);

export default router;