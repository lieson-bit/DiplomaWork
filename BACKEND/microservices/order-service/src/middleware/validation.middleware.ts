import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validationSchemas = {
  // Add to validationSchemas object
  order: {
  create: Joi.object({
    order_number: Joi.string().optional(),
    customer_id: Joi.string().required(),
    customer_name: Joi.string().required(),
    customer_email: Joi.string().email().required(),
    customer_phone: Joi.string().required(),
    
    pickup_address: Joi.string().required(),
    pickup_latitude: Joi.number().required(),
    pickup_longitude: Joi.number().required(),
    
    delivery_address: Joi.string().required(),
    delivery_latitude: Joi.number().required(),
    delivery_longitude: Joi.number().required(),
    distance_km: Joi.number().required(),
    
    package_category: Joi.string().required(),
    weight_kg: Joi.number().min(0.1).required(),
    volume_m3: Joi.number().min(0.01).required(),
    urgency: Joi.string().valid('normal', 'high', 'urgent').default('normal'),
    
    fragile: Joi.boolean().default(false),
    refrigerated: Joi.boolean().default(false),
    oversized: Joi.boolean().default(false),
    hazardous: Joi.boolean().default(false),
    
    estimated_price_usd: Joi.number().min(0).required(),
    estimated_price_local: Joi.number().min(0).required(),
    estimated_duration_minutes: Joi.number().min(1).required(),
    
    // Optional fields
    driver_id: Joi.string().optional().allow(null),
    driver_name: Joi.string().optional().allow(null),
    driver_phone: Joi.string().optional().allow(null),
    driver_email: Joi.string().email().optional().allow(null),
    driver_rating: Joi.number().min(0).max(5).optional().allow(null),
    driver_match_score: Joi.number().min(0).max(100).optional().allow(null),
    
    vehicle_type: Joi.string().optional().allow(null),
    vehicle_make: Joi.string().optional().allow(null),
    vehicle_model: Joi.string().optional().allow(null),
    vehicle_license_plate: Joi.string().optional().allow(null),
    vehicle_image_url: Joi.string().uri().optional().allow(null),
    vehicle_max_weight: Joi.number().optional().allow(null),
    vehicle_max_volume: Joi.number().optional().allow(null),
    
    route_polyline: Joi.string().optional().allow(null),
    route_order_index: Joi.number().default(0),
    
    pickup_time_estimated: Joi.date().optional().allow(null),
    delivery_time_estimated: Joi.date().optional().allow(null),
    
    currency: Joi.string().default('USD'),
    base_currency: Joi.string().default('RUB')
  }).options({ stripUnknown: true })
},
  
  query: {
    pagination: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      status: Joi.string()
    })
  }
};

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
      return;
    }

    req.body = value;
    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      res.status(400).json({
        error: 'Query validation failed',
        details: errors
      });
      return;
    }

    req.query = value;
    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      res.status(400).json({
        error: 'Parameter validation failed',
        details: errors
      });
      return;
    }

    req.params = value;
    next();
  };
};

// Route parameter validation
export const validateOrderId = validateParams(Joi.object({
  id: Joi.string().uuid().required()
}));

export const validatePagination = validateQuery(validationSchemas.query.pagination);