import { Request, Response, NextFunction } from 'express';
import { ResponseUtil } from '../utils/response.util';
import { Logger } from '../utils/logger';

// Create logger instance for this module
const logger = new Logger('CapacityMiddleware');

export const validateOrderCapacity = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  try {
    const orderData = req.body;
    
    // Validate total weight (max 1000kg per order)
    if (orderData.total_weight_kg && orderData.total_weight_kg > 1000) {
      return ResponseUtil.badRequest(
        res,
        'Order weight exceeds maximum limit of 1000kg'
      );
    }
    
    // Validate total volume (max 10m³ per order)
    if (orderData.total_volume_m3 && orderData.total_volume_m3 > 10) {
      return ResponseUtil.badRequest(
        res,
        'Order volume exceeds maximum limit of 10m³'
      );
    }
    
    // Validate individual items if provided
    if (orderData.order_items && Array.isArray(orderData.order_items)) {
      for (const [index, item] of orderData.order_items.entries()) {
        // Max 50kg per item
        if (item.weight_per_item_kg && item.weight_per_item_kg > 50) {
          return ResponseUtil.badRequest(
            res,
            `Item ${index + 1} exceeds maximum weight of 50kg per item`
          );
        }
        
        // Max 1m³ per item
        if (item.dimensions_length_cm && item.dimensions_width_cm && item.dimensions_height_cm) {
          const volume = (item.dimensions_length_cm * item.dimensions_width_cm * item.dimensions_height_cm) / 1000000;
          if (volume > 1) {
            return ResponseUtil.badRequest(
              res,
              `Item ${index + 1} exceeds maximum volume of 1m³ per item`
            );
          }
        }
        
        // Validate dangerous goods
        if (item.dangerous_goods_type && !['none', 'flammable', 'corrosive', 'toxic', 'explosive'].includes(item.dangerous_goods_type)) {
          return ResponseUtil.badRequest(
            res,
            `Item ${index + 1} has invalid dangerous goods type`
          );
        }
      }
    }
    
    next();
  } catch (error: any) {
    logger.error('Capacity validation error:', error);
    return ResponseUtil.error(res, 'Capacity validation failed', 500, error.message);
  }
};

export const checkVehicleCapacity = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  try {
    // This would typically check against the selected vehicle's capacity
    // For now, we'll just pass through - actual capacity check happens in matching service
    next();
  } catch (error: any) {
    logger.error('Vehicle capacity check error:', error);
    return ResponseUtil.error(res, 'Vehicle capacity check failed', 500, error.message);
  }
};

export const validatePickupDeliveryTimes = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  try {
    const orderData = req.body;
    
    if (orderData.scheduled_pickup_at) {
      const pickupTime = new Date(orderData.scheduled_pickup_at);
      const now = new Date();
      const minPickupTime = new Date(now.getTime() + 30 * 60000); // 30 minutes from now
      
      if (pickupTime < minPickupTime) {
        return ResponseUtil.badRequest(
          res,
          'Pickup time must be at least 30 minutes from now'
        );
      }
    }
    
    next();
  } catch (error: any) {
    logger.error('Time validation error:', error);
    return ResponseUtil.error(res, 'Time validation failed', 500, error.message);
  }
};