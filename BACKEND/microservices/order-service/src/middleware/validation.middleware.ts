import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validationSchemas = {
  // Add to validationSchemas object
  order: {
    create: Joi.object({
      orderId: Joi.string().required(),
      status: Joi.string().required(),
      customerInfo: Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        email: Joi.string().email().required(),
        phone: Joi.string().required(),
        userType: Joi.string().valid('customer').required()
      }).required(),
      locations: Joi.object({
        pickup: Joi.object({
          address: Joi.string().required(),
          coordinates: Joi.object({
            lat: Joi.number().required(),
            lng: Joi.number().required()
          }).required()
        }).required(),
        delivery: Joi.object({
          address: Joi.string().required(),
          coordinates: Joi.object({
            lat: Joi.number().required(),
            lng: Joi.number().required()
          }).required()
        }).required(),
        distance: Joi.object({
          km: Joi.number().required(),
          miles: Joi.number().required()
        }).required()
      }).required(),
      packageDetails: Joi.object({
        category: Joi.string().required(),
        weight: Joi.object({
          value: Joi.number().required(),
          unit: Joi.string().valid('kg').required()
        }).required(),
        volume: Joi.object({
          value: Joi.number().required(),
          unit: Joi.string().valid('m³').required()
        }).required(),
        urgency: Joi.string().required()
      }).required(),
      driverInfo: Joi.object({
        id: Joi.string().required(),
        driverId: Joi.string().required(),
        userId: Joi.string().required(),
        name: Joi.string().required(),
        phone: Joi.string().required(),
        email: Joi.string().email().required(),
        rating: Joi.number().min(0).max(5).required(),
        matchScore: Joi.number().min(0).max(100).required()
      }).required(),
      vehicleInfo: Joi.object({
        type: Joi.string().required(),
        make: Joi.string().required(),
        model: Joi.string().required(),
        licensePlate: Joi.string().required(),
        capacity: Joi.object({
          maxWeight: Joi.number().required(),
          maxVolume: Joi.number().required()
        }).required()
      }).required(),
      pricing: Joi.object({
        estimatedPrice: Joi.object({
          usd: Joi.number().required(),
          rub: Joi.number().required()
        }).required(),
        currency: Joi.string().required(),
        baseCurrency: Joi.string().required()
      }).required(),
      timing: Joi.object({
        estimatedDuration: Joi.object({
          minutes: Joi.number().required()
        }).required()
      }).required()
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