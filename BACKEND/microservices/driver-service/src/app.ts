import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import driverRoutes from './routes/driver.routes';
import { errorHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';
import { upload } from './services/upload.service';

const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Morgan logger configuration
const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  }
};

app.use(morgan('combined', { stream }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Add this line to serve vehicle images
app.use('/uploads/vehicles', express.static(path.join(__dirname, 'uploads', 'vehicles')));
// Routes


// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'driver-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

//app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/api', driverRoutes);
// API Documentation
app.get('/api/docs', (req, res) => {
  res.json({
    message: 'Driver Service API',
    version: '1.0.0',
    endpoints: {
      driver: {
        profile: {
          get: 'GET /api/drivers/profile',
          create: 'POST /api/drivers/profile',
          update: 'PUT /api/drivers/profile',
        },
        vehicles: {
          create: 'POST /api/drivers/vehicles',
          list: 'GET /api/drivers/vehicles',
          update: 'PUT /api/drivers/vehicles/:id',
          delete: 'DELETE /api/drivers/vehicles/:id',
        },
        documents: {
          upload: 'POST /api/drivers/documents',
          list: 'GET /api/drivers/documents',
          updateStatus: 'PATCH /api/drivers/documents/:id/status',
        },
        availability: {
          update: 'PUT /api/drivers/availability',
          get: 'GET /api/drivers/availability',
        },
        status: {
          update: 'PATCH /api/drivers/status',
        },
        profilePicture: {
          upload: 'POST /api/drivers/profile-picture',
          get: 'GET /api/drivers/profile-picture',
          delete: 'DELETE /api/drivers/profile-picture',
        },
        stats: {
          get: 'GET /api/drivers/stats',
          verification: 'GET /api/drivers/verification-status',
          recordMetrics: 'POST /api/drivers/metrics',
        },
      },
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Error handling middleware
app.use(errorHandler);

export default app;