// src/middleware/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError } from './error.middleware';
import { validationSchemas } from '../utils/validation'; // Import from utils

// Remove the duplicate validationSchemas object and just export the existing one
export { validationSchemas };

// Keep the validate middleware function
export const validate = (schema: Joi.ObjectSchema | Joi.ArraySchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors,
        },
      });
    }

    next();
  };
};

export default { validate, validationSchemas };