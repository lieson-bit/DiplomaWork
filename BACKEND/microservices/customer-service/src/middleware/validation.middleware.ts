import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ResponseUtil } from '../utils/response.util';

// Validation schemas
export const validationSchemas = {
  customer: {
    create: Joi.object({
      userId: Joi.string().required(),
      accountType: Joi.string().valid('personal', 'business').default('personal'),
      dateOfBirth: Joi.date().iso(),
      businessName: Joi.string().when('accountType', {
        is: 'business',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      businessType: Joi.string(),
      businessPhone: Joi.string(),
      taxId: Joi.string()
    }),

    update: Joi.object({
      accountType: Joi.string().valid('personal', 'business'),
      dateOfBirth: Joi.date().iso(),
      businessName: Joi.string(),
      businessType: Joi.string(),
      businessPhone: Joi.string(),
      taxId: Joi.string(),
      profilePictureUrl: Joi.string().uri()
    })
  },

  address: {
    create: Joi.object({
      label: Joi.string().required().max(50),
      address: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      country: Joi.string().default('US'),
      postalCode: Joi.string().required(),
      latitude: Joi.number().min(-90).max(90),
      longitude: Joi.number().min(-180).max(180),
      isDefault: Joi.boolean().default(false),
      notes: Joi.string()
    }),

    update: Joi.object({
      label: Joi.string().max(50),
      address: Joi.string(),
      city: Joi.string(),
      state: Joi.string(),
      country: Joi.string(),
      postalCode: Joi.string(),
      latitude: Joi.number().min(-90).max(90),
      longitude: Joi.number().min(-180).max(180),
      isDefault: Joi.boolean(),
      isActive: Joi.boolean(),
      notes: Joi.string()
    })
  },

  paymentMethod: {
    create: Joi.object({
      type: Joi.string().valid('card', 'paypal', 'apple_pay', 'google_pay', 'bank_transfer').required(),
      provider: Joi.string().required(),
      last4: Joi.string().length(4),
      expiryMonth: Joi.number().min(1).max(12),
      expiryYear: Joi.number().min(new Date().getFullYear()),
      nameOnCard: Joi.string(),
      paypalEmail: Joi.string().email(),
      bankName: Joi.string(),
      accountNumberMasked: Joi.string(),
      isDefault: Joi.boolean().default(false),
      token: Joi.string()
    }),

    update: Joi.object({
      isDefault: Joi.boolean(),
      isActive: Joi.boolean(),
      expiryMonth: Joi.number().min(1).max(12),
      expiryYear: Joi.number().min(new Date().getFullYear()),
      nameOnCard: Joi.string()
    })
  },

  preferences: Joi.object({
    defaultPickupType: Joi.string().valid('home', 'business', 'other'),
    defaultPaymentId: Joi.string(),
    notificationEmail: Joi.boolean(),
    notificationSMS: Joi.boolean(),
    notificationPush: Joi.boolean(),
    shareLocationData: Joi.boolean(),
    shareUsageAnalytics: Joi.boolean(),
    marketingEmails: Joi.boolean(),
    language: Joi.string(),
    timezone: Joi.string()
  }),

  timeSlots: Joi.array().items(
    Joi.object({
      dayOfWeek: Joi.number().min(0).max(6).required(),
      startTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required(),
      endTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required(),
      isActive: Joi.boolean().default(true)
    })
  ),

  feedback: Joi.object({
    orderId: Joi.string(),
    rating: Joi.number().min(1).max(5).required(),
    comment: Joi.string(),
    category: Joi.string().valid('delivery', 'driver', 'packaging', 'app', 'other')
  }),

  orderStats: Joi.object({
    orderAmount: Joi.number().min(0).required()
  })
};

// Middleware factory
export const validate = (schema: Joi.ObjectSchema | Joi.ArraySchema) => {
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
      
      ResponseUtil.badRequest(res, 'Validation failed', errors);
      return;
    }

    req.body = value;
    next();
  };
};

// Params validation
export const validateId = (
  req: Request,
  res: Response,
  next: NextFunction,
  id: string,
  name: string
): void => {
  const schema = Joi.string().uuid().required();
  const { error } = schema.validate(req.params[id]);

  if (error) {
    ResponseUtil.badRequest(res, `Invalid ${name} ID`);
    return;
  }

  next();
};

// File validation middleware
export const validateFile = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.file) {
    ResponseUtil.badRequest(res, 'No file uploaded');
    return;
  }

  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
    'image/jpeg',
    'image/png',
    'image/jpg'
  ];
  
  const maxSize = parseInt(process.env.MAX_FILE_SIZE || '5242880'); // 5MB default

  if (!allowedTypes.includes(req.file.mimetype)) {
    ResponseUtil.badRequest(
      res,
      `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
    );
    return;
  }

  if (req.file.size > maxSize) {
    ResponseUtil.badRequest(
      res,
      `File too large. Maximum size: ${maxSize / 1024 / 1024}MB`
    );
    return;
  }

  next();
};