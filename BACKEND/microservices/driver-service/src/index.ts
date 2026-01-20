import dotenv from 'dotenv';
dotenv.config(); // Load .env file
import app from './app';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 3002;

async function startServer() {
  try {
    console.log('🚀 Starting Driver Service...');
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🗄️ Database URL: ${process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@')}`);
    
    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected successfully');

    // Start server
    app.listen(PORT, () => {
      console.log(`🚗 Driver Service running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 API Docs: http://localhost:${PORT}/api/docs`);
    });
  } catch (error: any) {
    console.error('❌ Failed to start server:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  console.error('Error stack:', error.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();