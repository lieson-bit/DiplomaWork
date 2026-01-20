import mysql from 'mysql2/promise';
import { ensurePool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { DriverMetrics } from '../types';

export interface DriverMetricsRecord {
  id: string;
  driver_id: string;
  date: Date;
  deliveries_count: number;
  successful_deliveries: number;
  failed_deliveries: number;
  total_earnings: number;
  average_rating: number;
  online_hours: number;
  distance_traveled: number;
  created_at: Date;
}

export class DriverMetricsRepository {
  private pool: mysql.Pool | null = null;

  private async getPool(): Promise<mysql.Pool> {
    if (!this.pool) {
      this.pool = await ensurePool();
    }
    return this.pool;
  }

  private toDriverMetrics(record: DriverMetricsRecord): DriverMetrics {
    return {
      id: record.id,
      driverId: record.driver_id,
      date: record.date,
      deliveriesCount: record.deliveries_count,
      successfulDeliveries: record.successful_deliveries,
      failedDeliveries: record.failed_deliveries,
      totalEarnings: parseFloat(record.total_earnings.toString()),
      averageRating: record.average_rating,
      onlineHours: record.online_hours,
      distanceTraveled: record.distance_traveled,
      createdAt: record.created_at
    };
  }

  async create(data: Omit<DriverMetrics, 'id' | 'createdAt'>): Promise<DriverMetrics> {
    const pool = await this.getPool();
    const id = uuidv4();
    const query = `
      INSERT INTO driver_metrics (
        id, driver_id, date, deliveries_count, successful_deliveries, 
        failed_deliveries, total_earnings, average_rating, online_hours, distance_traveled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      id,
      data.driverId,
      data.date,
      data.deliveriesCount || 0,
      data.successfulDeliveries || 0,
      data.failedDeliveries || 0,
      data.totalEarnings || 0,
      data.averageRating || 0.0,
      data.onlineHours || 0.0,
      data.distanceTraveled || 0.0
    ];

    await pool.execute(query, values);
    return this.findById(id) as Promise<DriverMetrics>;
  }

  async findById(id: string): Promise<DriverMetrics | null> {
    const pool = await this.getPool();
    const query = 'SELECT * FROM driver_metrics WHERE id = ? LIMIT 1';
    const [rows] = await pool.execute(query, [id]);
    const metrics = rows as DriverMetricsRecord[];

    return metrics.length > 0 ? this.toDriverMetrics(metrics[0]) : null;
  }

  async findByDriverId(driverId: string, limit: number = 30): Promise<DriverMetrics[]> {
    const pool = await this.getPool();
    const query = 'SELECT * FROM driver_metrics WHERE driver_id = ? ORDER BY date DESC LIMIT ?';
    const [rows] = await pool.execute(query, [driverId, limit]);
    const metrics = rows as DriverMetricsRecord[];

    return metrics.map(m => this.toDriverMetrics(m));
  }

  async getDailyMetrics(driverId: string, date: Date): Promise<DriverMetrics | null> {
    const pool = await this.getPool();
    const query = 'SELECT * FROM driver_metrics WHERE driver_id = ? AND DATE(date) = DATE(?) LIMIT 1';
    const [rows] = await pool.execute(query, [driverId, date]);
    const metrics = rows as DriverMetricsRecord[];

    return metrics.length > 0 ? this.toDriverMetrics(metrics[0]) : null;
  }

  async updateMetrics(id: string, data: Partial<Omit<DriverMetrics, 'id' | 'driverId' | 'date' | 'createdAt'>>): Promise<DriverMetrics | null> {
    const pool = await this.getPool();
    const updates: string[] = [];
    const values: any[] = [];

    const fieldMap: Record<string, string> = {
      deliveriesCount: 'deliveries_count',
      successfulDeliveries: 'successful_deliveries',
      failedDeliveries: 'failed_deliveries',
      totalEarnings: 'total_earnings',
      averageRating: 'average_rating',
      onlineHours: 'online_hours',
      distanceTraveled: 'distance_traveled'
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbKey = fieldMap[key] || key;
        updates.push(`${dbKey} = ?`);
        values.push(value);
      }
    });

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const query = `UPDATE driver_metrics SET ${updates.join(', ')} WHERE id = ?`;
    await pool.execute(query, values);
    
    return this.findById(id);
  }

  async getStats(driverId: string): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    totalEarnings: number;
    averageRating: number;
    totalOnlineHours: number;
    totalDistance: number;
  }> {
    const pool = await this.getPool();
    const query = `
      SELECT 
        SUM(deliveries_count) as total_deliveries,
        SUM(successful_deliveries) as successful_deliveries,
        SUM(total_earnings) as total_earnings,
        AVG(average_rating) as average_rating,
        SUM(online_hours) as total_online_hours,
        SUM(distance_traveled) as total_distance
      FROM driver_metrics 
      WHERE driver_id = ?
    `;
    
    const [rows] = await pool.execute(query, [driverId]);
    const stats = rows as any[];
    
    return {
      totalDeliveries: stats[0]?.total_deliveries || 0,
      successfulDeliveries: stats[0]?.successful_deliveries || 0,
      totalEarnings: parseFloat(stats[0]?.total_earnings?.toString() || '0'),
      averageRating: parseFloat(stats[0]?.average_rating?.toString() || '0'),
      totalOnlineHours: parseFloat(stats[0]?.total_online_hours?.toString() || '0'),
      totalDistance: parseFloat(stats[0]?.total_distance?.toString() || '0')
    };
  }
}

let driverMetricsRepositoryInstance: DriverMetricsRepository | null = null;

export function getDriverMetricsRepository(): DriverMetricsRepository {
  if (!driverMetricsRepositoryInstance) {
    driverMetricsRepositoryInstance = new DriverMetricsRepository();
  }
  return driverMetricsRepositoryInstance;
}

export const driverMetricsRepository = getDriverMetricsRepository();