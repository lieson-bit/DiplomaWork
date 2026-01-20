"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = __importDefault(require("./app"));
const database_1 = require("./config/database");
const logger_1 = __importDefault(require("./utils/logger"));
const PORT = process.env.PORT || 3003;
async function startServer() {
    try {
        const isDbHealthy = await database_1.db.checkHealth();
        if (!isDbHealthy) {
            throw new Error('Failed to connect to database');
        }
        logger_1.default.info('Database connection established');
        app_1.default.listen(PORT, () => {
            logger_1.default.info(`Customer Service running on port ${PORT}`);
            logger_1.default.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
            logger_1.default.info(`User Service URL: ${process.env.USER_SERVICE_URL}`);
        });
        process.on('SIGTERM', () => {
            logger_1.default.info('SIGTERM received. Shutting down gracefully...');
            process.exit(0);
        });
        process.on('SIGINT', () => {
            logger_1.default.info('SIGINT received. Shutting down gracefully...');
            process.exit(0);
        });
        process.on('uncaughtException', (error) => {
            logger_1.default.error('Uncaught Exception:', error);
            process.exit(1);
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger_1.default.error('Unhandled Rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });
    }
    catch (error) {
        logger_1.default.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=index.js.map