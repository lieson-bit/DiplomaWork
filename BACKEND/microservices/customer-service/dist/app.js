"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const customer_routes_1 = __importDefault(require("./routes/customer.routes"));
const response_util_1 = require("./utils/response.util");
const logger_1 = __importDefault(require("./utils/logger"));
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(express_1.default.json());
app.use((0, morgan_1.default)('combined', { stream: { write: (message) => logger_1.default.http(message.trim()) } }));
const uploadPath = process.env.UPLOAD_PATH || './src/uploads';
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
app.use('/api/customers', customer_routes_1.default);
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'customer-service',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});
app.use('*', (req, res) => {
    response_util_1.ResponseUtil.notFound(res, 'Route not found');
});
app.use((err, req, res, next) => {
    logger_1.default.error('Global error handler:', err);
    if (err instanceof multer_1.default.MulterError) {
        return response_util_1.ResponseUtil.badRequest(res, `File upload error: ${err.message}`);
    }
    if (err.status === 400 || err.name === 'ValidationError') {
        return response_util_1.ResponseUtil.badRequest(res, err.message);
    }
    if (err.status === 401) {
        return response_util_1.ResponseUtil.unauthorized(res, err.message);
    }
    if (err.status === 403) {
        return response_util_1.ResponseUtil.forbidden(res, err.message);
    }
    if (err.status === 404) {
        return response_util_1.ResponseUtil.notFound(res, err.message);
    }
    return response_util_1.ResponseUtil.error(res, 'Internal server error', 500, err.message);
});
exports.default = app;
//# sourceMappingURL=app.js.map