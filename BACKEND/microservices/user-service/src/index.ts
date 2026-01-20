import dotenv from 'dotenv';
dotenv.config(); 
import app from './app';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Start server
app.listen(PORT, () => {
  console.log(`🚀 User Service started successfully!`);
  console.log(`📍 Environment: ${NODE_ENV}`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
  console.log(`👤 User endpoints: http://localhost:${PORT}/api/users`);
  console.log(`🩺 Health check: http://localhost:${PORT}/health`);
  console.log('');
  console.log(`📝 Test credentials:`);
  console.log(`   👨‍✈️ Driver: driver@test.com / Password123`);
  console.log(`   👩‍💼 Customer: customer@test.com / Password123`);
  console.log('');
  console.log(`⚠️  Note: Using in-memory database (data will be lost on restart)`);
});