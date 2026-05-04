// src/index.ts
import 'dotenv/config';
import app from './app';
import { createServer } from 'http';
import { Logger } from './utils/logger';
import { db } from './config/database';

const logger = new Logger('Server');
const PORT = process.env.PORT || 3004;

// Create HTTP server (no WebSocket)
const server = createServer(app);

// Import services
import { OrderRepository } from './repositories/order.repository';
import { TrackingRepository } from './repositories/tracking.repository';
import { OrderService } from './services/order.service';
import { BalanceService } from './services/balance.service';
import { RouteOptimizationService } from './services/route-optimization.service';
import { MessagingService } from './services/messaging.service';

// Create repositories
const orderRepository = new OrderRepository();
const trackingRepository = new TrackingRepository();

// Create services
const balanceService = new BalanceService();
const routeOptimizationService = new RouteOptimizationService();
const messagingService = new MessagingService();

// Create order service (no WebSocket dependencies)
const orderService = new OrderService(
  orderRepository,
  trackingRepository,
  balanceService,
  routeOptimizationService,
  messagingService
);

// Export for use in routes
export { server, orderService, balanceService, routeOptimizationService, messagingService };

// Test database connection
async function testDatabaseConnection(): Promise<boolean> {
  try {
    const isConnected = await db.testConnection();
    if (isConnected) {
      logger.info('✅ Database connection established successfully');
      return true;
    } else {
      logger.error('❌ Database connection test failed');
      return false;
    }
  } catch (error) {
    logger.error('❌ Failed to connect to database:', error);
    return false;
  }
}

// Graceful shutdown
function setupGracefulShutdown(): void {
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    const forceShutdownTimer = setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
    
    try {
      // Close database connections
      if (db && typeof db.close === 'function') {
        await db.close();
        logger.info('✅ Database connections closed');
      }
      
      // Close HTTP server
      await new Promise<void>((resolve) => {
        server.close(() => {
          logger.info('✅ HTTP server closed');
          resolve();
        });
      });
      
      clearTimeout(forceShutdownTimer);
      logger.info('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (error) => {
    logger.error('❌ Uncaught Exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });
}

// Start server
async function startServer(): Promise<void> {
  try {
    await testDatabaseConnection();
    
    setupGracefulShutdown();
    
    server.listen(PORT, () => {
      logger.info('🚀 Order Service is running');
      logger.info(`📡 HTTP: http://localhost:${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
      logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📨 Notifications: HTTP Polling (GET /api/notifications)`);
    });
    
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        logger.error('❌ Server error:', error);
        process.exit(1);
      }
    });
    
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();