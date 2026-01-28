import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import multer from 'multer';
import customerRoutes from './routes/customer.routes';
import { ResponseUtil } from './utils/response.util';
import logger from './utils/logger';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(morgan('combined', { stream: { write: (message) => logger.http(message.trim()) } }));

// Serve uploaded files
const uploadPath = process.env.UPLOAD_PATH || './src/uploads';
//app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  express.static(path.join(process.cwd(), 'uploads'))(req, res, next);
});

// Routes
app.use('/api/customers', customerRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'customer-service',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  ResponseUtil.notFound(res, 'Route not found');
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Global error handler:', err);

  if (err instanceof multer.MulterError) {
    return ResponseUtil.badRequest(res, `File upload error: ${err.message}`);
  }

  if (err.status === 400 || err.name === 'ValidationError') {
    return ResponseUtil.badRequest(res, err.message);
  }

  if (err.status === 401) {
    return ResponseUtil.unauthorized(res, err.message);
  }

  if (err.status === 403) {
    return ResponseUtil.forbidden(res, err.message);
  }

  if (err.status === 404) {
    return ResponseUtil.notFound(res, err.message);
  }

  // Default error
  return ResponseUtil.error(res, 'Internal server error', 500, err.message);
});

export default app;