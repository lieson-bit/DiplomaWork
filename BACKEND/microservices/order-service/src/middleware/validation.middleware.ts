import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validationSchemas = {
  order: {
    create: Joi.object({
      pickup_address: Joi.string().required(),
      pickup_latitude: Joi.number().required(),
      pickup_longitude: Joi.number().required(),
      pickup_contact_name: Joi.string().required(),
      pickup_contact_phone: Joi.string().required(),
      pickup_instructions: Joi.string(),
      
      delivery_address: Joi.string().required(),
      delivery_latitude: Joi.number().required(),
      delivery_longitude: Joi.number().required(),
      delivery_contact_name: Joi.string().required(),
      delivery_contact_phone: Joi.string().required(),
      delivery_instructions: Joi.string(),
      
      total_weight_kg: Joi.number().positive().required(),
      total_volume_m3: Joi.number().positive().required(),
      package_description: Joi.string(),
      fragile_items: Joi.boolean(),
      temperature_controlled: Joi.boolean(),
      
      priority: Joi.string().valid('low', 'normal', 'high', 'urgent'),
      customer_notes: Joi.string(),
      
      order_items: Joi.array().items(Joi.object({
        item_name: Joi.string().required(),
        quantity: Joi.number().integer().min(1),
        weight_per_item_kg: Joi.number().positive(),
        dimensions_length_cm: Joi.number().positive(),
        dimensions_width_cm: Joi.number().positive(),
        dimensions_height_cm: Joi.number().positive(),
        fragile: Joi.boolean(),
        temperature_sensitive: Joi.boolean(),
        special_handling: Joi.string()
      }))
    }),
    
    bulk: Joi.object({
      orders: Joi.array().items(Joi.object({
        pickup_address: Joi.string().required(),
        pickup_latitude: Joi.number().required(),
        pickup_longitude: Joi.number().required(),
        delivery_address: Joi.string().required(),
        delivery_latitude: Joi.number().required(),
        delivery_longitude: Joi.number().required(),
        total_weight_kg: Joi.number().positive().required(),
        total_volume_m3: Joi.number().positive().required()
      })).min(1).max(100)
    }),
    
    location: Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
      speed: Joi.number().min(0).max(200),
      bearing: Joi.number().min(0).max(360),
      accuracy: Joi.number().min(0)
    }),
    
    cancel: Joi.object({
      reason: Joi.string().required(),
      detailed_reason: Joi.string()
    }),
    
    complete: Joi.object({
      proof_image: Joi.string().uri(),
      delivery_notes: Joi.string()
    })
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