import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import orderRoutes from './routes/order.routes';
import { errorHandler } from './middleware/error.middleware';
import { defaultLogger } from './utils/logger';

const app = express();

// Create a logger instance for this file
const logger = defaultLogger;

// Get absolute path for Swagger file resolution
const swaggerDirname = process.cwd();

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Order Service API',
      version: '1.0.0',
      description: 'Order management and tracking microservice with knapsack optimization',
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
        // Request Schemas
        OrderRequest: {
          type: 'object',
          properties: {
            orderId: { type: 'string' },
            customerInfo: { 
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
                phone: { type: 'string' },
                userType: { type: 'string' }
              }
            },
            driverInfo: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                driverId: { type: 'string' },
                name: { type: 'string' },
                phone: { type: 'string' },
                email: { type: 'string' },
                rating: { type: 'number' }
              }
            },
            locations: {
              type: 'object',
              properties: {
                pickup: {
                  type: 'object',
                  properties: {
                    address: { type: 'string' },
                    coordinates: {
                      type: 'object',
                      properties: {
                        lat: { type: 'number' },
                        lng: { type: 'number' }
                      }
                    }
                  }
                },
                delivery: {
                  type: 'object',
                  properties: {
                    address: { type: 'string' },
                    coordinates: {
                      type: 'object',
                      properties: {
                        lat: { type: 'number' },
                        lng: { type: 'number' }
                      }
                    }
                  }
                },
                distance: {
                  type: 'object',
                  properties: {
                    km: { type: 'number' }
                  }
                }
              }
            },
            packageDetails: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                weight: {
                  type: 'object',
                  properties: {
                    value: { type: 'number' },
                    unit: { type: 'string' }
                  }
                },
                volume: {
                  type: 'object',
                  properties: {
                    value: { type: 'number' },
                    unit: { type: 'string' }
                  }
                },
                urgency: { type: 'string' }
              }
            },
            vehicleInfo: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                capacity: {
                  type: 'object',
                  properties: {
                    maxWeight: { type: 'number' },
                    maxVolume: { type: 'number' }
                  }
                }
              }
            },
            pricing: {
              type: 'object',
              properties: {
                estimatedPrice: {
                  type: 'object',
                  properties: {
                    usd: { type: 'number' }
                  }
                }
              }
            },
            timing: {
              type: 'object',
              properties: {
                estimatedDuration: {
                  type: 'object',
                  properties: {
                    minutes: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: [
    path.join(swaggerDirname, 'src', 'routes', '*.ts'),
    path.join(swaggerDirname, 'src', 'controllers', '*.ts')
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
    'http://localhost:3003',
    'http://localhost:3004'
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
    write: (message: string) => logger.info(message.trim())
  }
}));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Order Service API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: 'list',
    filter: true,
    deepLinking: true
  }
}));

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    service: 'order-service',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    websocket: 'enabled',
    api: 'running'
  });
});

// API Documentation redirect
app.get('/api/docs', (req: express.Request, res: express.Response) => {
  res.redirect('/api-docs');
});

// API Routes
app.use('/api', orderRoutes);

// 404 handler
app.use('*', (req: express.Request, res: express.Response) => {
  res.status(404).json({
    success: false,
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