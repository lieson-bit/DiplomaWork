import 'dotenv/config';
import app from './app';
import { createServer } from 'http';
import { Logger } from './utils/logger';
import pool from './config/database';
import { WebSocketUtil } from './utils/websocket.util';

const logger = new Logger('Server');

const PORT = process.env.PORT || 3004;
const WEBSOCKET_PORT = parseInt(process.env.WEBSOCKET_PORT || '8080');

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket server
const wss = new WebSocketUtil(server);

// Test database connection on startup
async function testDatabaseConnection() {
  try {
    // Use the Database implementation's testConnection method instead of getConnection
    await pool.testConnection();
    logger.info('✅ Database connection established successfully');
  } catch (error) {
    logger.error('❌ Failed to connect to database:', error);
    process.exit(1);
  }
}

// Test external service connections
async function testServiceConnections() {
  const services = [
    { name: 'User Service', url: process.env.USER_SERVICE_URL },
    { name: 'Driver Service', url: process.env.DRIVER_SERVICE_URL },
    { name: 'Customer Service', url: process.env.CUSTOMER_SERVICE_URL },
  ];

  for (const service of services) {
    try {
      // We'll test connections later in the route handlers
      logger.info(`✅ ${service.name} configured at ${service.url}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`⚠️  ${service.name} may not be available: ${message}`);
    }
  }
}

// Graceful shutdown
function setupGracefulShutdown() {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    // Close WebSocket connections (guarded because WebSocketUtil may not expose .close)
    if (typeof (wss as any)?.close === 'function') {
      (wss as any).close();
      logger.info('WebSocket server closed');
    } else if ((wss as any)?.server && typeof (wss as any).server.close === 'function') {
      (wss as any).server.close();
      logger.info('Underlying WebSocket server closed');
    } else {
      logger.info('No WebSocket server to close');
    }
    
    // Close database connections
    if (typeof (pool as any)?.end === 'function') {
      await (pool as any).end();
      logger.info('Database connections closed');
    } else if (typeof (pool as any)?.close === 'function') {
      await (pool as any).close();
      logger.info('Database connections closed');
    } else if (typeof (pool as any)?.destroy === 'function') {
      await (pool as any).destroy();
      logger.info('Database connections destroyed');
    } else {
      logger.info('No database close method found on pool; skipping close');
    }
    
    // Close HTTP server
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'order-service',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    database: 'connected', // This should be dynamically checked
  });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    await testDatabaseConnection();
    
    // Test service connections
    await testServiceConnections();
    
    // Setup graceful shutdown
    setupGracefulShutdown();
    
    // Start HTTP server
    server.listen(PORT, () => {
      logger.info(`🚀 Order Service is running on port ${PORT}`);
      logger.info(`🔗 HTTP: http://localhost:${PORT}`);
      logger.info(`🔌 WebSocket: ws://localhost:${WEBSOCKET_PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`📁 Upload path: ${process.env.UPLOAD_PATH || '/app/uploads'}`);
      logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        logger.error('Server error:', error);
        process.exit(1);
      }
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at', { promise, reason });
  process.exit(1);
});

export { server, wss };