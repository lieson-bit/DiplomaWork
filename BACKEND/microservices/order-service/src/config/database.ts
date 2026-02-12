import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../utils/logger';

class Database {
  private pool: mysql.Pool | null = null;
  private isConnected = false;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('Database');
    this.initialize();
  }

  private async initialize() {
    try {
      this.pool = mysql.createPool({
        host: process.env.MYSQL_HOST || 'localhost',
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        user: process.env.MYSQL_USER || 'order_user',
        password: process.env.MYSQL_PASSWORD || 'order_pass',
        database: process.env.MYSQL_DATABASE || 'order_service_db',
        waitForConnections: true,
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        charset: 'utf8mb4',
        timezone: 'local',
        dateStrings: true
      });

      // Test connection
      await this.testConnection();
      
      this.logger.info('Database pool initialized successfully');
      
    } catch (error: any) {
      this.logger.error('Failed to initialize database pool:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.pool) {
      this.logger.error('Database pool not initialized');
      return false;
    }

    try {
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      
      this.isConnected = true;
      this.logger.info('Database connection test successful');
      return true;
      
    } catch (error: any) {
      this.isConnected = false;
      this.logger.error('Database connection test failed:', error);
      return false;
    }
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    try {
      this.logger.debug('Executing query:', { sql, params });
      const [rows] = await this.pool.execute(sql, params || []);
      return rows as T[];
      
    } catch (error: any) {
      this.logger.error('Query execution failed:', {
        sql,
        params,
        error: error.message,
        code: error.code
      });
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async execute(sql: string, params?: any[]): Promise<mysql.OkPacket> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    try {
      this.logger.debug('Executing statement:', { sql, params });
      const [result] = await this.pool.execute(sql, params || []);
      return result as mysql.OkPacket;
      
    } catch (error: any) {
      this.logger.error('Statement execution failed:', {
        sql,
        params,
        error: error.message,
        code: error.code
      });
      throw new Error(`Database execution failed: ${error.message}`);
    }
  }

  async transaction<T = any>(
    callback: (connection: mysql.PoolConnection) => Promise<T>
  ): Promise<T> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      
      this.logger.debug('Transaction committed successfully');
      return result;
      
    } catch (error: any) {
      await connection.rollback();
      this.logger.error('Transaction rolled back:', error);
      throw error;
      
    } finally {
      connection.release();
    }
  }

  async initializeSchema(): Promise<void> {
    try {
      // Read schema file
      const schemaPath = path.join(__dirname, '../../sql/schema.sql');
      const schemaContent = await fs.readFile(schemaPath, 'utf-8');
      
      // Split into individual statements
      const statements = schemaContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      // Execute each statement
      for (const statement of statements) {
        try {
          await this.execute(statement + ';');
        } catch (error: any) {
          // Log but continue for some errors (like tables already exist)
          if (error.code === 'ER_TABLE_EXISTS_ERROR') {
            this.logger.warn(`Table already exists: ${statement.substring(0, 50)}...`);
          } else {
            throw error;
          }
        }
      }
      
      this.logger.info('Database schema initialized successfully');
      
    } catch (error: any) {
      this.logger.error('Failed to initialize database schema:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.logger.info('Database pool closed');
    }
  }

  getConnectionPool(): mysql.Pool {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    return this.pool;
  }

  isDatabaseConnected(): boolean {
    return this.isConnected;
  }

  // Helper method for pagination
  async paginate<T = any>(
    table: string,
    where: string = '1=1',
    params: any[] = [],
    page: number = 1,
    limit: number = 20,
    orderBy: string = 'created_at DESC'
  ): Promise<{
    data: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const offset = (page - 1) * limit;
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM ${table} WHERE ${where}`;
    const countResult = await this.queryOne<{ total: number }>(countQuery, params);
    const total = countResult?.total || 0;
    
    // Get paginated data
    const dataQuery = `
      SELECT * FROM ${table} 
      WHERE ${where} 
      ORDER BY ${orderBy} 
      LIMIT ? OFFSET ?
    `;
    const data = await this.query<T>(dataQuery, [...params, limit, offset]);
    
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }
}

// Create singleton instance
export const db = new Database();

// Export for direct use
export default db;