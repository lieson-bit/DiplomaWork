import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import { connectDatabase } from './config/database';
import { AuthService } from './services/auth.service';
import { query } from './lib/mysql'; // Import query here

const app = express();

// Initialize application
const initializeApp = async () => {
  try {
    console.log('🚀 Initializing User Service...');
    
    try {
      // Connect to database
      await connectDatabase();
      console.log('✅ Database connected');
      
      // Initialize test users
      const authService = new AuthService();
      await authService.initializeTestUsers();
      console.log('✅ Test users initialized');
    } catch (dbError: any) {
      console.error('⚠️ Database initialization failed, but service will start anyway:', dbError.message);
      console.log('⚠️ Some features may be disabled');
    }
    
    console.log('✅ User Service initialized successfully');
  } catch (error: any) {
    console.error('❌ Failed to initialize application:', error.message);
    // Don't exit, let the server start anyway
  }
};

// Start initialization
initializeApp().catch(console.error);

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Debug endpoints (remove in production)
app.get('/api/debug/users', async (req, res) => {
  try {
    const users = await query('SELECT * FROM users ORDER BY created_at DESC');
    
    res.json({
      count: users.length,
      users: users.map((u: any) => ({
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        userType: u.user_type,
        isActive: u.is_active,
        profileCompleted: u.profile_completed,
        createdAt: u.created_at,
        // Raw values for debugging
        raw: {
          is_active: u.is_active,
          is_active_type: typeof u.is_active,
          profile_completed: u.profile_completed
        }
      }))
    });
  } catch (error: any) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debug/raw-users', async (req, res) => {
  try {
    const users = await query('SELECT * FROM users');
    
    res.json({
      count: users.length,
      users: users.map((u: any) => ({
        ...u,
        is_active_raw: u.is_active,
        is_active_type: typeof u.is_active,
        profile_completed_raw: u.profile_completed
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Health check with database connection test
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await query('SELECT 1');
    
    // Get stats
    const users = await query('SELECT COUNT(*) as count FROM users');
    const activeUsers = await query('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
    const sessions = await query('SELECT COUNT(*) as count FROM user_sessions');
    
    res.json({
      status: 'OK',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: 'connected',
        type: 'MySQL',
        stats: {
          totalUsers: users[0].count,
          activeUsers: activeUsers[0].count,
          sessions: sessions[0].count
        }
      }
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'ERROR',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      database: {
        status: 'disconnected',
        error: error.message
      }
    });
  }
});

// Welcome route
app.get('/', (req, res) => {
  res.json({
    message: 'User Service API',
    description: 'Authentication and user management microservice',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        refreshToken: 'POST /api/auth/refresh-token'
      },
      users: {
        getAll: 'GET /api/users',
        search: 'GET /api/users/search?query=...',
        byType: 'GET /api/users/type/:type'
      },
      health: 'GET /health',
      debug: {
        users: 'GET /api/debug/users',
        rawUsers: 'GET /api/debug/raw-users'
      }
    },
    status: 'running',
    documentation: 'See API docs for more details'
  });
});

// Test endpoint for checking user data
app.get('/api/test/user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const user = await query(
      `SELECT 
        id,
        email,
        first_name,
        last_name,
        user_type,
        is_active,
        is_active = 1 as isActiveBool,
        profile_completed,
        created_at
       FROM users WHERE email = ?`,
      [email]
    );
    
    if (!user[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      user: user[0],
      analysis: {
        is_active: user[0].is_active,
        isActiveBool: user[0].isActiveBool,
        types: {
          is_active_type: typeof user[0].is_active,
          isActiveBool_type: typeof user[0].isActiveBool
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  
  // Prevent sending headers twice
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
    availableEndpoints: {
      auth: '/api/auth/*',
      users: '/api/users/*',
      health: '/health',
      debug: '/api/debug/*',
      root: '/'
    }
  });
});

export default app;