import 'dotenv/config';
import app from './app';
import { db } from './config/database';
import logger from './utils/logger';

const PORT = process.env.PORT || 3003;

async function startServer() {
  try {
    // Test database connection
    const isDbHealthy = await db.checkHealth();
    
    if (!isDbHealthy) {
      throw new Error('Failed to connect to database');
    }

    logger.info('Database connection established');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Customer Service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`User Service URL: ${process.env.USER_SERVICE_URL}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received. Shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received. Shutting down gracefully...');
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();