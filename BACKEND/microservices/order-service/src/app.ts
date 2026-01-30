import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
const morgan = require('morgan');
import path from 'path';
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
import orderRoutes from './routes/order.routes';
import { errorHandler } from './middleware/error.middleware';
import { Logger } from './utils/logger';

const app = express();

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Order Service API',
      version: '1.0.0',
      description: 'Order management and tracking microservice',
      contact: {
        name: 'API Support',
        email: 'support@orderservice.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.APP_URL || 'http://localhost:3004',
        description: 'Development server'
      },
      {
        url: 'https://api.orderservice.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        ServiceSecret: {
          type: 'apiKey',
          in: 'header',
          name: 'x-service-secret'
        }
      },
      schemas: {
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            order_number: { type: 'string' },
            customer_id: { type: 'string', format: 'uuid' },
            driver_id: { type: 'string', format: 'uuid' },
            status: { 
              type: 'string', 
              enum: ['pending', 'matched', 'driver_accepted', 'driver_enroute', 
                     'pickup_started', 'in_transit', 'arrived', 'delivered', 
                     'completed', 'cancelled', 'failed'] 
            },
            total_price: { type: 'number', format: 'float' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      responses: {
        Unauthorized: {
          description: 'Access token is missing or invalid'
        },
        NotFound: {
          description: 'The specified resource was not found'
        },
        ValidationError: {
          description: 'Validation failed for the request'
        }
      }
    },
    tags: [
      { name: 'Orders', description: 'Order management endpoints' },
      { name: 'Tracking', description: 'Real-time order tracking' },
      { name: 'Driver', description: 'Driver-specific operations' },
      { name: 'Customer', description: 'Customer-specific operations' },
      { name: 'Bulk', description: 'Bulk order operations' }
    ]
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
    './src/types/*.ts'
  ]
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-service-secret']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: {
    write: (message) => logger.http(message.trim())
  }
}));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Order Service API Documentation'
}));

// Health check endpoint
app.get('/health', (req, res) => {
  // ... existing health check code ...
});

// API Documentation redirect
app.get('/api/docs', (req, res) => {
  res.redirect('/api-docs');
});

// API Routes
app.use('/api', orderRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
    availableEndpoints: {
      health: 'GET /health',
      docs: 'GET /api-docs',
      orders: '/api/orders/*',
      tracking: '/api/tracking/*'
    }
  });
});

// Error handling middleware
app.use(errorHandler);

export default app;