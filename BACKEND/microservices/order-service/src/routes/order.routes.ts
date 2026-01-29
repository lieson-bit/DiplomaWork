import express from 'express';
import { OrderController } from '../controllers/order.controller';
import { authenticate, authorizeCustomer, authorizeDriver } from '../middleware/auth.middleware';
import { validate, validationSchemas } from '../middleware/validation.middleware';
import { validateOrderCapacity } from '../middleware/capacity.middleware';
import multer from 'multer';

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

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create a new order
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pickup_address
 *               - delivery_address
 *               - total_weight_kg
 *               - total_volume_m3
 *             properties:
 *               pickup_address:
 *                 type: string
 *               pickup_latitude:
 *                 type: number
 *                 format: float
 *               pickup_longitude:
 *                 type: number
 *                 format: float
 *               delivery_address:
 *                 type: string
 *               delivery_latitude:
 *                 type: number
 *                 format: float
 *               delivery_longitude:
 *                 type: number
 *                 format: float
 *               total_weight_kg:
 *                 type: number
 *                 format: float
 *               total_volume_m3:
 *                 type: number
 *                 format: float
 *               package_description:
 *                 type: string
 *               fragile_items:
 *                 type: boolean
 *               temperature_controlled:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/orders',
  authenticate,
  authorizeCustomer,
  validateOrderCapacity,
  validate(validationSchemas.order.create),
  orderController.createOrder
);

/**
 * @swagger
 * /orders/bulk:
 *   post:
 *     summary: Create multiple orders in bulk
 *     tags: [Bulk]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orders
 *             properties:
 *               orders:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Order'
 *     responses:
 *       200:
 *         description: Bulk orders processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: number
 *                 failed:
 *                   type: number
 *                 orders:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 */
router.post('/orders/bulk',
  authenticate,
  authorizeCustomer,
  validate(validationSchemas.order.bulk),
  orderController.createBulkOrder
);

/**
 * @swagger
 * /orders/upload:
 *   post:
 *     summary: Upload Excel file for bulk orders
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
 *     responses:
 *       200:
 *         description: Excel file processed successfully
 */
router.post('/orders/upload',
  authenticate,
  authorizeCustomer,
  upload.single('file'),
  orderController.uploadExcel
);

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get orders with filters
 *     tags: [Orders]
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
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orders:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get('/orders',
  authenticate,
  orderController.getOrders
);

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Get order details by ID
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *       - in: query
 *         name: optimize
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include knapsack optimization data
 *     responses:
 *       200:
 *         description: Order details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/orders/:id',
  authenticate,
  orderController.getOrder
);

/**
 * @swagger
 * /orders/{id}/accept:
 *   post:
 *     summary: Driver accepts an order
 *     tags: [Driver]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Order accepted successfully
 */
router.post('/orders/:id/accept',
  authenticate,
  authorizeDriver,
  orderController.acceptOrder
);

/**
 * @swagger
 * /orders/{id}/start:
 *   post:
 *     summary: Start order pickup
 *     tags: [Driver]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *     responses:
 *       200:
 *         description: Pickup started successfully
 */
router.post('/orders/:id/start',
  authenticate,
  authorizeDriver,
  orderController.startPickup
);

/**
 * @swagger
 * /orders/{id}/location:
 *   post:
 *     summary: Update driver location (real-time tracking)
 *     tags: [Tracking]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - latitude
 *               - longitude
 *             properties:
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               speed:
 *                 type: number
 *               bearing:
 *                 type: number
 *               accuracy:
 *                 type: number
 *     responses:
 *       200:
 *         description: Location updated
 */
router.post('/orders/:id/location',
  authenticate,
  authorizeDriver,
  orderController.updateLocation
);

/**
 * @swagger
 * /orders/{id}/complete:
 *   post:
 *     summary: Mark order as delivered and process payment
 *     tags: [Driver]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               proof_image:
 *                 type: string
 *               delivery_notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order completed and payment processed
 */
router.post('/orders/:id/complete',
  authenticate,
  authorizeDriver,
  orderController.completeOrder
);

/**
 * @swagger
 * /orders/{id}/cancel:
 *   post:
 *     summary: Cancel an order
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *               detailed_reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 */
router.post('/orders/:id/cancel',
  authenticate,
  orderController.cancelOrder
);

/**
 * @swagger
 * /driver/orders:
 *   get:
 *     summary: Get driver's orders
 *     tags: [Driver]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of driver's orders
 */
router.get('/driver/orders',
  authenticate,
  authorizeDriver,
  orderController.getDriverOrders
);

/**
 * @swagger
 * /customer/orders:
 *   get:
 *     summary: Get customer's orders
 *     tags: [Customer]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of customer's orders
 */
router.get('/customer/orders',
  authenticate,
  authorizeCustomer,
  orderController.getCustomerOrders
);

/**
 * @swagger
 * /tracking/{id}:
 *   get:
 *     summary: Get real-time order tracking
 *     tags: [Tracking]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Tracking information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 order_id:
 *                   type: string
 *                 driver_location:
 *                   type: object
 *                   properties:
 *                     latitude:
 *                       type: number
 *                     longitude:
 *                       type: number
 *                 eta_minutes:
 *                   type: number
 *                 route_polyline:
 *                   type: string
 *                 tracking_points:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/tracking/:id',
  authenticate,
  orderController.getTracking
);

/**
 * @swagger
 * /internal/match/{id}:
 *   post:
 *     summary: Match order with driver (internal use)
 *     tags: [Internal]
 *     security:
 *       - ServiceSecret: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Order matched successfully
 */
router.post('/internal/match/:id',
  (req, res, next) => {
    const secret = req.headers['x-service-secret'];
    if (secret !== process.env.SERVICE_SECRET) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  },
  orderController.matchOrder
);

export default router;