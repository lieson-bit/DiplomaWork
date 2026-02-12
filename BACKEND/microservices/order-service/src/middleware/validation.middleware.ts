// middleware/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ResponseUtil } from '../utils/response.util';
import { Logger } from '../utils/logger';

const logger = new Logger('ValidationMiddleware');

export const validateOrderReceive = (req: Request, res: Response, next: NextFunction) => {
  const errors = [];
  
  // Check required fields from your exact JSON structure
  if (!req.body.customerInfo?.id) {
    errors.push('customerInfo.id is required');
  }
  
  if (!req.body.driverInfo?.id) {
    errors.push('driverInfo.id is required');
  }
  
  if (!req.body.locations?.pickup?.address) {
    errors.push('locations.pickup.address is required');
  }
  
  if (!req.body.locations?.delivery?.address) {
    errors.push('locations.delivery.address is required');
  }
  
  if (!req.body.locations?.pickup?.coordinates?.lat || !req.body.locations?.pickup?.coordinates?.lng) {
    errors.push('locations.pickup.coordinates are required');
  }
  
  if (!req.body.locations?.delivery?.coordinates?.lat || !req.body.locations?.delivery?.coordinates?.lng) {
    errors.push('locations.delivery.coordinates are required');
  }
  
  if (!req.body.packageDetails?.weight?.value) {
    errors.push('packageDetails.weight.value is required');
  }
  
  if (!req.body.packageDetails?.volume?.value) {
    errors.push('packageDetails.volume.value is required');
  }
  
  if (!req.body.pricing?.estimatedPrice?.usd) {
    errors.push('pricing.estimatedPrice.usd is required');
  }
  
  if (!req.body.timing?.estimatedDuration?.minutes) {
    errors.push('timing.estimatedDuration.minutes is required');
  }
  
  if (errors.length > 0) {
    logger.warn('Validation failed:', errors);
    return ResponseUtil.error(res, 'Validation failed', 400, errors.join(', '), errors);
  }
  
  next();
};