import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
export declare const validationSchemas: {
    customer: {
        create: Joi.ObjectSchema<any>;
        update: Joi.ObjectSchema<any>;
    };
    address: {
        create: Joi.ObjectSchema<any>;
        update: Joi.ObjectSchema<any>;
    };
    paymentMethod: {
        create: Joi.ObjectSchema<any>;
        update: Joi.ObjectSchema<any>;
    };
    preferences: Joi.ObjectSchema<any>;
    timeSlots: Joi.ArraySchema<any[]>;
    feedback: Joi.ObjectSchema<any>;
    orderStats: Joi.ObjectSchema<any>;
};
export declare const validate: (schema: Joi.ObjectSchema | Joi.ArraySchema) => (req: Request, res: Response, next: NextFunction) => void;
export declare const validateId: (req: Request, res: Response, next: NextFunction, id: string, name: string) => void;
export declare const validateFile: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validation.middleware.d.ts.map