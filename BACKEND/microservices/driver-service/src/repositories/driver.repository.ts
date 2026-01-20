import mysql from 'mysql2/promise';
import { ensurePool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { Driver, DriverAvailability } from '../types';

export interface DriverRecord {
  id: string;
  user_id: string;
  license_number?: string;
  license_expiry?: Date;
  insurance_number?: string;
  insurance_expiry?: Date;
  rating: number;
  total_deliveries: number;
  total_earnings: number;
  completion_rate: number;
  status: 'pending' | 'active' | 'suspended' | 'inactive';
  verification_level: 'none' | 'basic' | 'verified' | 'premium';
  onboarded_at?: Date;
  is_online: boolean;
  current_location?: string;
  profile_completed: boolean;
  created_at: Date;
  updated_at: Date;
}

export class DriverRepository {
  private pool: mysql.Pool | null = null;

  private async getPool(): Promise<mysql.Pool> {
    if (!this.pool) {
      this.pool = await ensurePool();
    }
    return this.pool;
  }

  private toDriver(record: DriverRecord): Driver {
    return {
      id: record.id,
      userId: record.user_id,
      licenseNumber: record.license_number,
      licenseExpiry: record.license_expiry,
      insuranceNumber: record.insurance_number,
      insuranceExpiry: record.insurance_expiry,
      rating: record.rating,
      totalDeliveries: record.total_deliveries,
      totalEarnings: parseFloat(record.total_earnings.toString()),
      completionRate: record.completion_rate,
      status: record.status,
      verificationLevel: record.verification_level,
      onboardedAt: record.onboarded_at,
      isOnline: Boolean(record.is_online),
      currentLocation: record.current_location,
      profileCompleted: Boolean(record.profile_completed),
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }

  async create(userId: string, data?: Partial<Driver>): Promise<Driver> {
    const pool = await this.getPool();
    const id = uuidv4();
    const query = `
      INSERT INTO drivers (
        id, user_id, license_number, license_expiry, insurance_number, insurance_expiry,
        rating, total_deliveries, total_earnings, completion_rate, status, verification_level,
        onboarded_at, is_online, current_location, profile_completed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      id,
      userId,
      data?.licenseNumber || null,
      data?.licenseExpiry || null,
      data?.insuranceNumber || null,
      data?.insuranceExpiry || null,
      data?.rating || 0.0,
      data?.totalDeliveries || 0,
      data?.totalEarnings || 0,
      data?.completionRate || 0.0,
      data?.status || 'pending',
      data?.verificationLevel || 'none',
      data?.onboardedAt || new Date(),
      data?.isOnline || false,
      data?.currentLocation || null,
      data?.profileCompleted || false
    ];

    await pool.execute(query, values);
    return this.findByUserId(userId) as Promise<Driver>;
  }

  async findByUserId(userId: string): Promise<Driver | null> {
    const pool = await this.getPool();
    const query = 'SELECT * FROM drivers WHERE user_id = ? LIMIT 1';
    const [rows] = await pool.execute(query, [userId]);
    const drivers = rows as DriverRecord[];

    return drivers.length > 0 ? this.toDriver(drivers[0]) : null;
  }

  async findById(id: string): Promise<Driver | null> {
    const pool = await this.getPool();
    const query = 'SELECT * FROM drivers WHERE id = ? LIMIT 1';
    const [rows] = await pool.execute(query, [id]);
    const drivers = rows as DriverRecord[];

    return drivers.length > 0 ? this.toDriver(drivers[0]) : null;
  }

  async update(userId: string, data: Partial<Omit<Driver, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<Driver | null> {
    const pool = await this.getPool();
    const updates: string[] = [];
    const values: any[] = [];

    const fieldMap: Record<string, string> = {
      licenseNumber: 'license_number',
      licenseExpiry: 'license_expiry',
      insuranceNumber: 'insurance_number',
      insuranceExpiry: 'insurance_expiry',
      rating: 'rating',
      totalDeliveries: 'total_deliveries',
      totalEarnings: 'total_earnings',
      completionRate: 'completion_rate',
      status: 'status',
      verificationLevel: 'verification_level',
      onboardedAt: 'onboarded_at',
      isOnline: 'is_online',
      currentLocation: 'current_location',
      profileCompleted: 'profile_completed'
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbKey = fieldMap[key] || key;
        updates.push(`${dbKey} = ?`);
        values.push(value);
      }
    });

    if (updates.length === 0) {
      return this.findByUserId(userId);
    }

    updates.push('updated_at = NOW()');
    values.push(userId);
    
    const query = `UPDATE drivers SET ${updates.join(', ')} WHERE user_id = ?`;
    await pool.execute(query, values);
    
    return this.findByUserId(userId);
  }

  async updateStatus(userId: string, isOnline: boolean, location?: string): Promise<Driver | null> {
    const pool = await this.getPool();
    const query = `
      UPDATE drivers 
      SET is_online = ?, current_location = ?, updated_at = NOW() 
      WHERE user_id = ?
    `;
    
    await pool.execute(query, [isOnline, location, userId]);
    return this.findByUserId(userId);
  }

  async deleteByUserId(userId: string): Promise<boolean> {
    const pool = await this.getPool();
    const query = 'DELETE FROM drivers WHERE user_id = ?';
    const [result] = await pool.execute(query, [userId]);
    return (result as any).affectedRows > 0;
  }

  async getAvailability(driverId: string): Promise<DriverAvailability[]> {
    const pool = await this.getPool();
    const query = 'SELECT * FROM driver_availabilities WHERE driver_id = ? AND is_active = TRUE ORDER BY day_of_week ASC';
    const [rows] = await pool.execute(query, [driverId]);
    const availabilities = rows as any[];

    return availabilities.map(row => ({
      id: row.id,
      driverId: row.driver_id,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async updateAvailability(driverId: string, availabilities: any[]): Promise<void> {
    const pool = await this.getPool();
    
    // Delete existing availabilities
    await pool.execute('DELETE FROM driver_availabilities WHERE driver_id = ?', [driverId]);

    // Create new availabilities
    for (const avail of availabilities) {
      const query = `
        INSERT INTO driver_availabilities (
          id, driver_id, day_of_week, start_time, end_time, is_active
        ) VALUES (UUID(), ?, ?, ?, ?, ?)
      `;
      
      await pool.execute(query, [
        driverId,
        avail.dayOfWeek,
        avail.startTime,
        avail.endTime,
        avail.isActive !== undefined ? avail.isActive : true
      ]);
    }
  }
}

let driverRepositoryInstance: DriverRepository | null = null;

export function getDriverRepository(): DriverRepository {
  if (!driverRepositoryInstance) {
    driverRepositoryInstance = new DriverRepository();
  }
  return driverRepositoryInstance;
}

export const driverRepository = getDriverRepository();