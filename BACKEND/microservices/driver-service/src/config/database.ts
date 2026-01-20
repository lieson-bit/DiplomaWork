import mysql from 'mysql2/promise';
import { logger } from '../utils/logger';

let pool: mysql.Pool | null = null;

export async function connectDatabase() {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const url = new URL(databaseUrl);
    
    pool = mysql.createPool({
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.substring(1),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });

    // Test connection
    const connection = await pool.getConnection();
    logger.info('Driver database connected successfully');
    connection.release();

    return pool;
  } catch (error) {
    logger.error('Failed to connect to driver database:', error);
    throw error;
  }
}

export function getPool(): mysql.Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call connectDatabase() first.');
  }
  return pool;
}

export async function ensurePool(): Promise<mysql.Pool> {
  if (!pool) {
    return await connectDatabase();
  }
  return pool;
}

// Handle graceful shutdown
process.on('beforeExit', async () => {
  if (pool) {
    await pool.end();
    logger.info('Database pool closed gracefully');
  }
});