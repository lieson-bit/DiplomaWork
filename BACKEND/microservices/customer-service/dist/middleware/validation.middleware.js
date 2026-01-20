"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFile = exports.validateId = exports.validate = exports.validationSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const response_util_1 = require("../utils/response.util");
exports.validationSchemas = {
    customer: {
        create: joi_1.default.object({
            userId: joi_1.default.string().required(),
            accountType: joi_1.default.string().valid('personal', 'business').default('personal'),
            dateOfBirth: joi_1.default.date().iso(),
            businessName: joi_1.default.string().when('accountType', {
                is: 'business',
                then: joi_1.default.required(),
                otherwise: joi_1.default.optional()
            }),
            businessType: joi_1.default.string(),
            businessPhone: joi_1.default.string(),
            taxId: joi_1.default.string()
        }),
        update: joi_1.default.object({
            accountType: joi_1.default.string().valid('personal', 'business'),
            dateOfBirth: joi_1.default.date().iso(),
            businessName: joi_1.default.string(),
            businessType: joi_1.default.string(),
            businessPhone: joi_1.default.string(),
            taxId: joi_1.default.string(),
            profilePictureUrl: joi_1.default.string().uri()
        })
    },
    address: {
        create: joi_1.default.object({
            label: joi_1.default.string().required().max(50),
            address: joi_1.default.string().required(),
            city: joi_1.default.string().required(),
            state: joi_1.default.string().required(),
            country: joi_1.default.string().default('US'),
            postalCode: joi_1.default.string().required(),
            latitude: joi_1.default.number().min(-90).max(90),
            longitude: joi_1.default.number().min(-180).max(180),
            isDefault: joi_1.default.boolean().default(false),
            notes: joi_1.default.string()
        }),
        update: joi_1.default.object({
            label: joi_1.default.string().max(50),
            address: joi_1.default.string(),
            city: joi_1.default.string(),
            state: joi_1.default.string(),
            country: joi_1.default.string(),
            postalCode: joi_1.default.string(),
            latitude: joi_1.default.number().min(-90).max(90),
            longitude: joi_1.default.number().min(-180).max(180),
            isDefault: joi_1.default.boolean(),
            isActive: joi_1.default.boolean(),
            notes: joi_1.default.string()
        })
    },
    paymentMethod: {
        create: joi_1.default.object({
            type: joi_1.default.string().valid('card', 'paypal', 'apple_pay', 'google_pay', 'bank_transfer').required(),
            provider: joi_1.default.string().required(),
            last4: joi_1.default.string().length(4),
            expiryMonth: joi_1.default.number().min(1).max(12),
            expiryYear: joi_1.default.number().min(new Date().getFullYear()),
            nameOnCard: joi_1.default.string(),
            paypalEmail: joi_1.default.string().email(),
            bankName: joi_1.default.string(),
            accountNumberMasked: joi_1.default.string(),
            isDefault: joi_1.default.boolean().default(false),
            token: joi_1.default.string()
        }),
        update: joi_1.default.object({
            isDefault: joi_1.default.boolean(),
            isActive: joi_1.default.boolean(),
            expiryMonth: joi_1.default.number().min(1).max(12),
            expiryYear: joi_1.default.number().min(new Date().getFullYear()),
            nameOnCard: joi_1.default.string()
        })
    },
    preferences: joi_1.default.object({
        defaultPickupType: joi_1.default.string().valid('home', 'business', 'other'),
        defaultPaymentId: joi_1.default.string(),
        notificationEmail: joi_1.default.boolean(),
        notificationSMS: joi_1.default.boolean(),
        notificationPush: joi_1.default.boolean(),
        shareLocationData: joi_1.default.boolean(),
        shareUsageAnalytics: joi_1.default.boolean(),
        marketingEmails: joi_1.default.boolean(),
        language: joi_1.default.string(),
        timezone: joi_1.default.string()
    }),
    timeSlots: joi_1.default.array().items(joi_1.default.object({
        dayOfWeek: joi_1.default.number().min(0).max(6).required(),
        startTime: joi_1.default.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required(),
        endTime: joi_1.default.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required(),
        isActive: joi_1.default.boolean().default(true)
    })),
    feedback: joi_1.default.object({
        orderId: joi_1.default.string(),
        rating: joi_1.default.number().min(1).max(5).required(),
        comment: joi_1.default.string(),
        category: joi_1.default.string().valid('delivery', 'driver', 'packaging', 'app', 'other')
    }),
    orderStats: joi_1.default.object({
        orderAmount: joi_1.default.number().min(0).required()
    })
};
const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });
        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));
            response_util_1.ResponseUtil.badRequest(res, 'Validation failed', errors);
            return;
        }
        req.body = value;
        next();
    };
};
exports.validate = validate;
const validateId = (req, res, next, id, name) => {
    const schema = joi_1.default.string().uuid().required();
    const { error } = schema.validate(req.params[id]);
    if (error) {
        response_util_1.ResponseUtil.badRequest(res, `Invalid ${name} ID`);
        return;
    }
    next();
};
exports.validateId = validateId;
const validateFile = (req, res, next) => {
    if (!req.file) {
        response_util_1.ResponseUtil.badRequest(res, 'No file uploaded');
        return;
    }
    const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
        'image/jpeg',
        'image/png',
        'image/jpg'
    ];
    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '5242880');
    if (!allowedTypes.includes(req.file.mimetype)) {
        response_util_1.ResponseUtil.badRequest(res, `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
        return;
    }
    if (req.file.size > maxSize) {
        response_util_1.ResponseUtil.badRequest(res, `File too large. Maximum size: ${maxSize / 1024 / 1024}MB`);
        return;
    }
    next();
};
exports.validateFile = validateFile;
//# sourceMappingURL=validation.middleware.js.map