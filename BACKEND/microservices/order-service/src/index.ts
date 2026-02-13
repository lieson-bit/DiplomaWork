// index.ts
import 'dotenv/config';
import app from './app';
import { createServer } from 'http';
import { Logger } from './utils/logger';
import { db } from './config/database';
import { webSocketManager } from './utils/websocket.manager';

const logger = new Logger('Server');

const PORT = process.env.PORT || 3004;

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket server through the manager
export const wss = webSocketManager.initialize(server);

// 3. NOW initialize services that depend on WebSocket
import { OrderRepository } from './repositories/order.repository';
import { TrackingRepository } from './repositories/tracking.repository';
import { NotificationService } from './services/notification.service';
import { OrderService } from './services/order.service';

const orderRepository = new OrderRepository();
const trackingRepository = new TrackingRepository();
const notificationService = new NotificationService(wss);
const orderService = new OrderService(
  wss, notificationService, orderRepository, trackingRepository
);

export { server, orderService };

// Test database connection on startup
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

// Test external service connections
async function testServiceConnections(): Promise<void> {
  const services = [
    { name: 'User Service', url: process.env.USER_SERVICE_URL },
    { name: 'Driver Service', url: process.env.DRIVER_SERVICE_URL },
    { name: 'Customer Service', url: process.env.CUSTOMER_SERVICE_URL },
  ];

  for (const service of services) {
    if (service.url) {
      logger.info(`✅ ${service.name} configured at ${service.url}`);
    } else {
      logger.warn(`⚠️  ${service.name} URL not configured`);
    }
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
      // Close WebSocket server
      if (wss) {
        await wss.close();
        logger.info('✅ WebSocket server closed');
      }
      
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
  process.on('SIGQUIT', () => shutdown('SIGQUIT'));
  
  process.on('uncaughtException', (error) => {
    logger.error('❌ Uncaught Exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Unhandled Rejection at:', { promise, reason });
    shutdown('UNHANDLED_REJECTION');
  });
}

// Start server
async function startServer(): Promise<void> {
  try {
    // Test database connection
    const isDbConnected = await testDatabaseConnection();
    if (!isDbConnected) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('❌ Cannot start server without database connection');
        process.exit(1);
      } else {
        logger.warn('⚠️ Starting server without database connection (development mode)');
      }
    }
    
    // Check if tables exist
    try {
      await db.query('SELECT 1 FROM orders LIMIT 1');
      logger.info('✅ Database tables are ready');
    } catch (error) {
      logger.warn('⚠️ Database tables may not exist. Please run schema.sql manually.');
    }
    
    // Test service connections
    await testServiceConnections();
    
    // Setup graceful shutdown
    setupGracefulShutdown();
    
    // Start HTTP server
    server.listen(PORT, () => {
      logger.info(`🚀 Order Service is running`);
      logger.info(`📡 HTTP: http://localhost:${PORT}`);
      logger.info(`🔌 WebSocket: ws://localhost:${PORT}/ws (via HTTP server)`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
      logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Log WebSocket status after server is fully started
      logger.info(`🔌 WebSocket initialized: ${webSocketManager.isInitialized() ? '✅' : '❌'}`);
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

// Start the server
startServer();

// Export the server instance for testing

// Export the wss instance for use in routes (will be available after initialization)
export default wss;