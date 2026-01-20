import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Create connection pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3307'),
  user: process.env.MYSQL_USER || 'app_user',
  password: process.env.MYSQL_PASSWORD || 'app_password',
  database: process.env.MYSQL_DATABASE || 'user_service_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

export async function query(sql: string, params?: any[]): Promise<any> {
  const connection = await pool.getConnection();
  try {
    console.log('📝 Executing query:', sql);
    if (params) console.log('📝 Query params:', params);
    const [rows] = await connection.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  } finally {
    connection.release();
  }
}

export async function connectDB(): Promise<void> {
  try {
    await query('SELECT 1');
    console.log('✅ Connected to MySQL database');
  } catch (error: any) {
    console.error('❌ Failed to connect to MySQL:', error.message);
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  await pool.end();
  console.log('📦 Disconnected from MySQL database');
}

export async function initializeDatabase(): Promise<void> {
  try {
    console.log('🔄 Initializing database tables...');
    
    // Read SQL script file
    const sqlPath = path.join(__dirname, '..', 'mysql-init', '01-init.sql');
    let sqlScript: string;
    
    if (fs.existsSync(sqlPath)) {
      // Use external SQL file if exists
      sqlScript = fs.readFileSync(sqlPath, 'utf8');
    } else {
      // Use hardcoded SQL
      sqlScript = `
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(255) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          phone VARCHAR(20),
          user_type VARCHAR(20) NOT NULL,
          email_verified BOOLEAN DEFAULT false,
          phone_verified BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT true,
          profile_completed BOOLEAN DEFAULT false,
          last_login DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_email (email),
          INDEX idx_user_type (user_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS user_sessions (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          token TEXT NOT NULL,
          refresh_token TEXT NOT NULL,
          device_info TEXT,
          ip_address TEXT,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_token (token(255)),
          UNIQUE KEY uk_refresh_token (refresh_token(255)),
          INDEX idx_user_id (user_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
    }
    
    // Split SQL script into individual statements
    const statements = sqlScript
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.toLowerCase().startsWith('create database')) {
        // Skip database creation if it's already handled by environment
        console.log('Skipping database creation (handled by env vars)');
        continue;
      }
      await query(statement + ';');
    }
    
    console.log('✅ Database tables created/verified');
  } catch (error: any) {
    console.error('❌ Failed to initialize database:', error.message);
    throw error;
  }
}

export { pool };