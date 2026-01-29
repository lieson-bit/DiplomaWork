import { Request, Response, NextFunction } from 'express';
import { ResponseUtil } from '../utils/response.util';
import { logger } from '../utils/logger';
import { servicesConfig } from '../config/services.config';

export const verifyCustomerBalance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const orderData = req.body;
    const customerId = req.user?.userId;
    
    if (!customerId) {
      return ResponseUtil.unauthorized(res, 'Customer not authenticated');
    }
    
    // Get estimated total price
    const estimatedPrice = orderData.total_price || orderData.estimated_price;
    
    if (!estimatedPrice) {
      // Price will be calculated later, skip balance check
      return next();
    }
    
    // In a real implementation, you would call customer-service to check balance
    // For now, we'll simulate it
    const hasSufficientBalance = true; // TODO: Implement actual balance check
    
    if (!hasSufficientBalance) {
      return ResponseUtil.badRequest(
        res,
        'Insufficient balance. Please top up your account.'
      );
    }
    
    next();
  } catch (error: any) {
    logger.error('Balance verification error:', error);
    ResponseUtil.error(res, 'Balance verification failed', 500, error.message);
  }
};

export const validatePaymentMethod = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { payment_method } = req.body;
    
    const validMethods = ['wallet', 'card', 'paypal', 'bank_transfer', 'cash_on_delivery'];
    
    if (payment_method && !validMethods.includes(payment_method)) {
      return ResponseUtil.badRequest(
        res,
        `Invalid payment method. Allowed methods: ${validMethods.join(', ')}`
      );
    }
    
    next();
  } catch (error: any) {
    logger.error('Payment method validation error:', error);
    ResponseUtil.error(res, 'Payment validation failed', 500, error.message);
  }
};

export const requirePaymentForUrgentOrders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const orderData = req.body;
    
    if (orderData.priority === 'urgent' && orderData.payment_method === 'cash_on_delivery') {
      return ResponseUtil.badRequest(
        res,
        'Urgent orders require prepayment. Cash on delivery is not available for urgent orders.'
      );
    }
    
    next();
  } catch (error: any) {
    logger.error('Urgent order payment validation error:', error);
    ResponseUtil.error(res, 'Payment validation failed', 500, error.message);
  }
};

export const verifyServiceSecret = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const secret = req.headers['x-service-secret'];
    const requiredSecret = process.env.SERVICE_SECRET;
    
    if (!secret || secret !== requiredSecret) {
      logger.warn('Invalid service secret attempt:', {
        path: req.path,
        ip: req.ip
      });
      return ResponseUtil.forbidden(res, 'Invalid service secret');
    }
    
    next();
  } catch (error: any) {
    logger.error('Service secret verification error:', error);
    ResponseUtil.error(res, 'Service verification failed', 500, error.message);
  }
};