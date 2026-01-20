// src/utils/validation.ts
import Joi from 'joi';
// Remove import from '../models' since models don't exist anymore
// We'll import from types instead
import { Driver, Vehicle, Document } from '../types';

export const validationSchemas = {
  // Driver validation
  driver: {
    create: Joi.object<Partial<Driver>>({
      licenseNumber: Joi.string().max(50).optional(),
      licenseExpiry: Joi.date().optional(),
      insuranceNumber: Joi.string().max(50).optional(),
      insuranceExpiry: Joi.date().optional(),
    }),

    update: Joi.object<Partial<Driver>>({
      licenseNumber: Joi.string().max(50).optional(),
      licenseExpiry: Joi.date().optional(),
      insuranceNumber: Joi.string().max(50).optional(),
      insuranceExpiry: Joi.date().optional(),
      currentLocation: Joi.string().max(255).optional(),
    }),
  },

  // Vehicle validation
  vehicle: {
    create: Joi.object({
      type: Joi.string()
        .valid('motorbike', 'small_van', 'medium_truck', 'large_truck')
        .required(),
      make: Joi.string().max(50).required(),
      model: Joi.string().max(50).required(),
      year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).required(),
      color: Joi.string().max(30).required(),
      licensePlate: Joi.string().max(20).required(),
      maxWeight: Joi.number().positive().required(),
      maxVolume: Joi.number().positive().required(),
      insuranceInfo: Joi.string().max(500).optional(),
    }).required(),

    update: Joi.object({
      type: Joi.string()
        .valid('motorbike', 'small_van', 'medium_truck', 'large_truck')
        .optional(),
      make: Joi.string().max(50).optional(),
      model: Joi.string().max(50).optional(),
      year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
      color: Joi.string().max(30).optional(),
      licensePlate: Joi.string().max(20).optional(),
      maxWeight: Joi.number().positive().optional(),
      maxVolume: Joi.number().positive().optional(),
      insuranceInfo: Joi.string().max(500).optional(),
      currentStatus: Joi.string()
        .valid('available', 'in_use', 'maintenance')
        .optional(),
      isActive: Joi.boolean().optional(),
    }),
  },

  // Document validation
  document: {
    create: Joi.object<Partial<Document>>({
      type: Joi.string()
        .valid('license', 'insurance', 'registration', 'inspection', 'background_check')
        .required(),
      name: Joi.string().max(100).required(),
      expiryDate: Joi.date().optional(),
    }),

    update: Joi.object<Partial<Document>>({
      status: Joi.string()
        .valid('pending', 'approved', 'rejected', 'expired')
        .optional(),
      expiryDate: Joi.date().optional(),
      rejectionReason: Joi.string().max(500).optional(),
    }),
  },

  // Availability validation
  availability: Joi.array().items(
    Joi.object({
      dayOfWeek: Joi.number().integer().min(0).max(6).required(),
      startTime: Joi.string()
        .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .required()
        .messages({
          'string.pattern.base': 'Start time must be in HH:MM format (24-hour)',
        }),
      endTime: Joi.string()
        .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .required()
        .messages({
          'string.pattern.base': 'End time must be in HH:MM format (24-hour)',
        }),
      isActive: Joi.boolean().default(true),
    })
  ).min(0).max(7),

  // Status validation
  status: Joi.object({
    isOnline: Joi.boolean().required(),
    location: Joi.string().max(255).optional(),
  }),

  // Pagination validation
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),

  // File upload validation
  fileUpload: Joi.object({
    fieldname: Joi.string().required(),
    originalname: Joi.string().required(),
    encoding: Joi.string().required(),
    mimetype: Joi.string().required(),
    size: Joi.number().integer().max(5 * 1024 * 1024).required(), // 5MB max
    destination: Joi.string().required(),
    filename: Joi.string().required(),
    path: Joi.string().required(),
  }),
};

export const validate = (schema: Joi.Schema, data: any) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
      type: detail.type,
    }));

    throw {
      name: 'ValidationError',
      message: 'Validation failed',
      details: errors,
    };
  }

  return value;
};

export const validateQuery = (schema: Joi.Schema, req: any, res: any, next: any) => {
  try {
    req.query = validate(schema, req.query);
    next();
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        message: error.message,
        details: error.details,
      },
    });
  }
};

export const validateBody = (schema: Joi.Schema, req: any, res: any, next: any) => {
  try {
    req.body = validate(schema, req.body);
    next();
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        message: error.message,
        details: error.details,
      },
    });
  }
};

export const validateParams = (schema: Joi.Schema, req: any, res: any, next: any) => {
  try {
    req.params = validate(schema, req.params);
    next();
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        message: error.message,
        details: error.details,
      },
    });
  }
};

// Helper validation functions
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
};

export const isValidDate = (date: string): boolean => {
  const dateObj = new Date(date);
  return !isNaN(dateObj.getTime());
};

export const isValidTime = (time: string): boolean => {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

export const isValidLicensePlate = (plate: string): boolean => {
  // Basic license plate validation (adjust based on your country)
  const plateRegex = /^[A-Z0-9\s\-]{3,10}$/i;
  return plateRegex.test(plate);
};

export const isValidDocumentType = (type: string): boolean => {
  const validTypes = ['license', 'insurance', 'registration', 'inspection', 'background_check'];
  return validTypes.includes(type);
};

export const isValidVehicleType = (type: string): boolean => {
  const validTypes = ['motorbike', 'small_van', 'medium_truck', 'large_truck'];
  return validTypes.includes(type);
};