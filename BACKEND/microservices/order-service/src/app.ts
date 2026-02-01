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

// Swagger configuration with comprehensive schemas
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
        // Request Schemas
        CreateOrderRequest: {
          type: 'object',
          required: ['pickup_address', 'delivery_address', 'total_weight_kg', 'total_volume_m3'],
          properties: {
            pickup_address: { type: 'string', example: '123 Main St, New York, NY' },
            pickup_latitude: { type: 'number', format: 'float', example: 40.7128 },
            pickup_longitude: { type: 'number', format: 'float', example: -74.0060 },
            pickup_contact_name: { type: 'string', example: 'John Doe' },
            pickup_contact_phone: { type: 'string', example: '+1234567890' },
            pickup_instructions: { type: 'string', example: 'Ring bell twice' },
            
            delivery_address: { type: 'string', example: '456 Park Ave, Brooklyn, NY' },
            delivery_latitude: { type: 'number', format: 'float', example: 40.6782 },
            delivery_longitude: { type: 'number', format: 'float', example: -73.9442 },
            delivery_contact_name: { type: 'string', example: 'Jane Smith' },
            delivery_contact_phone: { type: 'string', example: '+1234567891' },
            delivery_instructions: { type: 'string', example: 'Leave at front desk' },
            
            total_weight_kg: { type: 'number', format: 'float', minimum: 0.1, example: 5.5 },
            total_volume_m3: { type: 'number', format: 'float', minimum: 0.01, example: 0.2 },
            package_description: { type: 'string', example: 'Electronics package' },
            fragile_items: { type: 'boolean', default: false },
            temperature_controlled: { type: 'boolean', default: false },
            
            priority: { 
              type: 'string', 
              enum: ['low', 'normal', 'high', 'urgent'],
              default: 'normal'
            },
            
            order_items: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/OrderItem'
              }
            },
            
            customer_notes: { type: 'string', example: 'Handle with care' },
            scheduled_pickup_at: { type: 'string', format: 'date-time' }
          }
        },
        
        BulkOrderRequest: {
          type: 'object',
          required: ['orders'],
          properties: {
            orders: {
              type: 'array',
              minItems: 1,
              maxItems: 100,
              items: {
                type: 'object',
                properties: {
                  pickup_address: { type: 'string' },
                  pickup_latitude: { type: 'number' },
                  pickup_longitude: { type: 'number' },
                  delivery_address: { type: 'string' },
                  delivery_latitude: { type: 'number' },
                  delivery_longitude: { type: 'number' },
                  total_weight_kg: { type: 'number' },
                  total_volume_m3: { type: 'number' }
                }
              }
            }
          }
        },
        
        CancelOrderRequest: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: { type: 'string', example: 'Change of plans' },
            detailed_reason: { type: 'string', example: 'Need to reschedule delivery' }
          }
        },
        
        CompleteOrderRequest: {
          type: 'object',
          properties: {
            payment_method: { 
              type: 'string', 
              enum: ['wallet', 'card', 'cash', 'bank_transfer'],
              default: 'wallet'
            },
            proof_image: { type: 'string', format: 'uri' },
            delivery_notes: { type: 'string' }
          }
        },
        
        LocationUpdateRequest: {
          type: 'object',
          required: ['latitude', 'longitude'],
          properties: {
            latitude: { type: 'number', minimum: -90, maximum: 90, example: 40.7128 },
            longitude: { type: 'number', minimum: -180, maximum: 180, example: -74.0060 },
            speed: { type: 'number', minimum: 0, maximum: 200, example: 45.5 },
            bearing: { type: 'number', minimum: 0, maximum: 360, example: 90 },
            accuracy: { type: 'number', minimum: 0, example: 10.5 }
          }
        },

        MessageRequest: {
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string', maxLength: 1000, example: 'Hello, where are you?' },
            messageType: { 
              type: 'string', 
              enum: ['text', 'location', 'image', 'status_update'],
              default: 'text' 
            },
            metadata: { type: 'object' }
          }
        },
        
        // Data Models
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            order_number: { type: 'string', example: 'ORD-20240101-0001' },
            customer_id: { type: 'string', format: 'uuid' },
            driver_id: { type: 'string', format: 'uuid' },
            status: { 
              type: 'string', 
              enum: ['pending', 'matched', 'driver_accepted', 'driver_enroute', 
                     'pickup_started', 'in_transit', 'arrived', 'delivered', 
                     'completed', 'cancelled', 'failed'] 
            },
            total_price: { type: 'number', format: 'float' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        
        OrderItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            order_id: { type: 'string', format: 'uuid' },
            item_name: { type: 'string' },
            quantity: { type: 'integer', minimum: 1 },
            weight_per_item_kg: { type: 'number', minimum: 0.1 },
            dimensions_length_cm: { type: 'number', minimum: 1 },
            dimensions_width_cm: { type: 'number', minimum: 1 },
            dimensions_height_cm: { type: 'number', minimum: 1 },
            fragile: { type: 'boolean', default: false },
            temperature_sensitive: { type: 'boolean', default: false },
            special_handling: { type: 'string' }
          }
        },
        
        TrackingData: {
          type: 'object',
          properties: {
            order_id: { type: 'string', format: 'uuid' },
            driver_id: { type: 'string', format: 'uuid' },
            locations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                  timestamp: { type: 'string', format: 'date-time' },
                  speed: { type: 'number' },
                  bearing: { type: 'number' }
                }
              }
            },
            summary: {
              type: 'object',
              properties: {
                totalDistance: { type: 'number' },
                totalDuration: { type: 'number' },
                averageSpeed: { type: 'number' },
                startTime: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', default: false },
            error: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'array', items: { type: 'string' } },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Order'
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
                hasNext: { type: 'boolean' },
                hasPrev: { type: 'boolean' }
              }
            }
          }
        }
      },
      responses: {
        Unauthorized: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        NotFound: {
          description: 'The specified resource was not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation failed for the request',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        BadRequest: {
          description: 'Bad request',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        }
      }
    },
    tags: [
      { name: 'Orders', description: 'Order management endpoints' },
      { name: 'Tracking', description: 'Real-time order tracking' },
      { name: 'Driver', description: 'Driver-specific operations' },
      { name: 'Customer', description: 'Customer-specific operations' },
      { name: 'Bulk', description: 'Bulk order operations' },
      { name: 'Messages', description: 'Order messaging operations' }
    ]
  },
  apis: [
    path.join(swaggerDirname, 'dist', 'routes', '*.js'),
    path.join(swaggerDirname, 'dist', 'controllers', '*.js'),
    path.join(swaggerDirname, 'dist', 'types', '*.js')
  ]
};

console.log('Swagger scanning APIs from:', swaggerOptions.apis);

const swaggerSpec = swaggerJSDoc(swaggerOptions) as Record<string, any>;

// Log Swagger spec generation
console.log(`Swagger spec generated with ${Object.keys(swaggerSpec.paths || {}).length} paths`);

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
    deepLinking: true,
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2
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
    uptime: process.uptime()
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