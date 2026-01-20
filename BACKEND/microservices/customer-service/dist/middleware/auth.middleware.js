"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuthenticate = exports.authorizeCustomer = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const response_util_1 = require("../utils/response.util");
const logger_1 = __importDefault(require("../utils/logger"));
const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            response_util_1.ResponseUtil.unauthorized(res, 'No token provided');
            return;
        }
        const token = authHeader.split(' ')[1];
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            logger_1.default.error('JWT_SECRET not configured');
            response_util_1.ResponseUtil.error(res, 'Server configuration error', 500);
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        req.user = {
            userId: decoded.userId,
            userType: decoded.userType,
            email: decoded.email || ''
        };
        next();
    }
    catch (error) {
        logger_1.default.error('Authentication error:', error);
        if (error.name === 'JsonWebTokenError') {
            response_util_1.ResponseUtil.unauthorized(res, 'Invalid token');
            return;
        }
        if (error.name === 'TokenExpiredError') {
            response_util_1.ResponseUtil.unauthorized(res, 'Token expired');
            return;
        }
        response_util_1.ResponseUtil.unauthorized(res, 'Authentication failed');
    }
};
exports.authenticate = authenticate;
const authorizeCustomer = (req, res, next) => {
    if (!req.user) {
        response_util_1.ResponseUtil.unauthorized(res, 'No user found');
        return;
    }
    if (req.user.userType !== 'customer') {
        response_util_1.ResponseUtil.forbidden(res, 'Access denied. Customer access required');
        return;
    }
    next();
};
exports.authorizeCustomer = authorizeCustomer;
const optionalAuthenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }
        const token = authHeader.split(' ')[1];
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            return next();
        }
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        req.user = {
            userId: decoded.userId,
            userType: decoded.userType,
            email: decoded.email || ''
        };
        next();
    }
    catch (error) {
        next();
    }
};
exports.optionalAuthenticate = optionalAuthenticate;
//# sourceMappingURL=auth.middleware.js.map