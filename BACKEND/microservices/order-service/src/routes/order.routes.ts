import express from 'express';
import { OrderController } from '../controllers/order.controller';
import { authenticate, authorizeCustomer, authorizeDriver, authorizeDriverOrCustomer } from '../middleware/auth.middleware';
import { validate, validationSchemas } from '../middleware/validation.middleware';
import { validateOrderCapacity } from '../middleware/capacity.middleware';
import { verifyCustomerBalance, validatePaymentMethod } from '../middleware/payment.middleware';
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
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
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
 *     tags: [Bulk]
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
 *     summary: Update driver location (real-time tracking)
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
 *     summary: Mark order as delivered and process payment
 */
router.post('/orders/:id/complete',
  authenticate,
  authorizeDriver,
  validatePaymentMethod,
  orderController.completeOrder.bind(orderController)
);

/**
 * @swagger
 * /orders/{id}/cancel:
 *   post:
 *     summary: Cancel an order
 */
router.post('/orders/:id/cancel',
  authenticate,
  orderController.cancelOrder.bind(orderController)
);

/**
 * @swagger
 * /driver/orders:
 *   get:
 *     summary: Get driver's orders
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
 *     summary: Get real-time order tracking
 */
router.get('/tracking/:id',
  authenticate,
  orderController.getTracking.bind(orderController)
);

/**
 * @swagger
 * /internal/match/{id}:
 *   post:
 *     summary: Match order with driver (internal use)
 */
router.post('/internal/match/:id',
  (req, res, next) => {
    const secret = req.headers['x-service-secret'];
    if (secret !== process.env.SERVICE_SECRET) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
    return;
  },
  orderController.matchOrder.bind(orderController)
);

// Add these routes (for future implementation)

/**
 * @swagger
 * /orders/{id}/messages:
 *   post:
 *     summary: Send message to driver/customer
 */
router.post('/orders/:id/messages',
  authenticate,
  authorizeDriverOrCustomer,
  validate(extendedValidationSchemas.message.send),
  (req, res) => {
    // Placeholder for messaging functionality
    res.status(501).json({ error: 'Messaging not yet implemented' });
  }
);

/**
 * @swagger
 * /orders/{id}/messages:
 *   get:
 *     summary: Get order messages
 */
router.get('/orders/:id/messages',
  authenticate,
  authorizeDriverOrCustomer,
  (req, res) => {
    // Placeholder for messaging functionality
    res.status(501).json({ error: 'Messaging not yet implemented' });
  }
);

/**
 * @swagger
 * /messages/unread:
 *   get:
 *     summary: Get unread message count
 */
router.get('/messages/unread',
  authenticate,
  (req, res) => {
    // Placeholder for messaging functionality
    res.status(501).json({ error: 'Messaging not yet implemented' });
  }
);

/**
 * @swagger
 * /messages/{id}/read:
 *   patch:
 *     summary: Mark message as read
 */
router.patch('/messages/:id/read',
  authenticate,
  (req, res) => {
    // Placeholder for messaging functionality
    res.status(501).json({ error: 'Messaging not yet implemented' });
  }
);

export default router;