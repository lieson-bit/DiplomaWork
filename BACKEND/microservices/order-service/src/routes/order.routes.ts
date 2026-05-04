// src/routes/order.routes.ts
import express from 'express';
import { authenticate, authorizeDriver, authorizeCustomer, authorizeDriverOrCustomer, verifyServiceSecret } from '../middleware/auth.middleware';
import { OrderController } from '../controllers/order.controller';
import { validateOrderReceive } from '../middleware/validation.middleware';

const router = express.Router();

// Import services AFTER they are created (from index.ts)
// Use require to avoid circular dependency issues
let orderController: OrderController;

// Initialize controller lazily
function getOrderController(): OrderController {
  if (!orderController) {
    // Dynamically import to ensure services are initialized
    const { orderService } = require('../index');
    orderController = new OrderController(orderService);
  }
  return orderController;
}

/**
 * @swagger
 * /orders/{id}/progress:
 *   get:
 *     summary: Get order with full progress tracking
 *     tags: [Orders, Customer, Driver]
 *     security:
 *       - BearerAuth: []
 */
router.get('/orders/:id/progress',
  authenticate,
  authorizeDriverOrCustomer,
  (req, res, next) => getOrderController().getOrderWithProgress(req, res).catch(next)
);

/**
 * @swagger
 * /orders/receive:
 *   post:
 *     summary: Receive order from customer booking form
 *     tags: [Orders]
 *     security:
 *       - ServiceSecret: []
 */
router.post('/orders/receive',
  verifyServiceSecret,
  validateOrderReceive,
  (req, res, next) => getOrderController().receiveOrder(req, res).catch(next)
);

/**
 * @swagger
 * /orders/{id}/accept:
 *   post:
 *     summary: Driver accepts an order
 *     tags: [Driver]
 *     security:
 *       - BearerAuth: []
 */
router.post('/orders/:id/accept',
  authenticate,
  authorizeDriver,
  (req, res, next) => getOrderController().acceptOrder(req, res).catch(next)
);

/**
 * @swagger
 * /orders/{id}/reject:
 *   post:
 *     summary: Driver rejects an order
 *     tags: [Driver]
 *     security:
 *       - BearerAuth: []
 */
router.post('/orders/:id/reject',
  authenticate,
  authorizeDriver,
  (req, res, next) => getOrderController().rejectOrder(req, res).catch(next)
);

router.get('/orders/:id',
  authenticate,
  authorizeDriverOrCustomer,
  (req, res, next) => getOrderController().getOrder(req, res).catch(next)
);

/**
 * @swagger
 * /orders/{id}/status:
 *   patch:
 *     summary: Update order status (driver only)
 *     tags: [Driver]
 *     security:
 *       - BearerAuth: []
 */
router.patch('/orders/:id/status',
  authenticate,
  authorizeDriver,
  (req, res, next) => getOrderController().updateOrderStatus(req, res).catch(next)
);

/**
 * @swagger
 * /driver/route/optimized:
 *   get:
 *     summary: Get driver's optimized route for multiple orders
 *     tags: [Driver]
 *     security:
 *       - BearerAuth: []
 */
router.get('/driver/route/optimized',
  authenticate,
  authorizeDriver,
  (req, res, next) => getOrderController().getOptimizedRoute(req, res).catch(next)
);

/**
 * @swagger
 * /orders/{id}/tracking:
 *   get:
 *     summary: Get order tracking data
 *     tags: [Orders, Customer, Driver]
 *     security:
 *       - BearerAuth: []
 */
router.get('/orders/:id/tracking',
  authenticate,
  authorizeDriverOrCustomer,
  (req, res, next) => getOrderController().getOrderTracking(req, res).catch(next)
);

/**
 * @swagger
 * /orders/{id}/messages:
 *   post:
 *     summary: Send message to driver/customer
 *     tags: [Messages]
 *     security:
 *       - BearerAuth: []
 */
router.post('/orders/:id/messages',
  authenticate,
  authorizeDriverOrCustomer,
  (req, res, next) => getOrderController().sendMessage(req, res).catch(next)
);

/**
 * @swagger
 * /orders/{id}/messages:
 *   get:
 *     summary: Get order messages
 *     tags: [Messages]
 *     security:
 *       - BearerAuth: []
 */
router.get('/orders/:id/messages',
  authenticate,
  authorizeDriverOrCustomer,
  (req, res, next) => getOrderController().getMessages(req, res).catch(next)
);

/**
 * @swagger
 * /orders/{id}/rate:
 *   post:
 *     summary: Rate driver after order delivery
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 */
router.post('/orders/:id/rate',
  authenticate,
  authorizeCustomer,
  (req, res, next) => getOrderController().rateDriver(req, res).catch(next)
);

/**
 * @swagger
 * /balance:
 *   get:
 *     summary: Get user balance
 *     tags: [Customer, Driver]
 *     security:
 *       - BearerAuth: []
 */
router.get('/balance',
  authenticate,
  (req, res, next) => getOrderController().getBalance(req, res).catch(next)
);

/**
 * @swagger
 * /customer/orders:
 *   get:
 *     summary: Get customer orders with progress
 *     tags: [Customer]
 *     security:
 *       - BearerAuth: []
 */
router.get('/customer/orders',
  authenticate,
  authorizeCustomer,
  (req, res, next) => getOrderController().getCustomerOrders(req, res).catch(next)
);

/**
 * @swagger
 * /driver/orders:
 *   get:
 *     summary: Get driver orders
 *     tags: [Driver]
 *     security:
 *       - BearerAuth: []
 */
router.get('/driver/orders',
  authenticate,
  authorizeDriver,
  (req, res, next) => getOrderController().getDriverOrders(req, res).catch(next)
);

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get user notifications (HTTP Polling)
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 */
router.get('/notifications',
  authenticate,
  (req, res, next) => getOrderController().getNotifications(req, res).catch(next)
);

export default router;