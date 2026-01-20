import mysql from 'mysql2/promise';
import logger from '../utils/logger';

class Database {
  private static instance: Database;
  private pool: mysql.Pool;
  private isConnected = false;

  private constructor() {
    this.pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'customer-db',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      user: process.env.MYSQL_USER || 'customer_user',
      password: process.env.MYSQL_PASSWORD || 'customer_pass',
      database: process.env.MYSQL_DATABASE || 'customer_service_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });

    this.initialize();
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  private async initialize() {
    try {
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      
      this.isConnected = true;
      logger.info('Database connected successfully');
      
      // Test query
      const [rows] = await this.pool.query('SELECT 1 + 1 AS result');
      logger.info('Database test query successful:', rows);
    } catch (error) {
      logger.error('Database connection failed:', error);
      this.isConnected = false;
      
      // Retry connection after 5 seconds
      setTimeout(() => this.initialize(), 5000);
    }
  }

  public getConnection(): mysql.Pool {
    return this.pool;
  }

  public async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    try {
      const [rows] = await this.pool.execute(sql, params);
      // mysql2 returns [rows, fields], and rows is already an array
      return rows as T[];
    } catch (error) {
      logger.error('Database query error:', error);
      throw error;
    }
  }

  public async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    try {
      const [rows] = await this.pool.execute(sql, params);
      const results = rows as T[];
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      logger.error('Database query error:', error);
      throw error;
    }
  }

  public async transaction<T = any>(
    callback: (connection: mysql.PoolConnection) => Promise<T>
  ): Promise<T> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const db = Database.getInstance();
export default db;