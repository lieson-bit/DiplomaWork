import mysql from 'mysql2/promise';
import { ensurePool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { Vehicle } from '../types';

export interface VehicleRecord {
  id: string;
  driver_id: string;
  type: 'motorbike' | 'small_van' | 'medium_truck' | 'large_truck';
  make: string;
  model: string;
  year: number;
  color: string;
  license_plate: string;
  max_weight: number;
  max_volume: number;
  image_url?: string;
  is_active: boolean;
  current_status: 'available' | 'in_use' | 'maintenance';
  insurance_info?: string;
  created_at: Date;
  updated_at: Date;
}

export class VehicleRepository {
  private pool: mysql.Pool | null = null;

  private async getPool(): Promise<mysql.Pool> {
    if (!this.pool) {
      this.pool = await ensurePool();
    }
    return this.pool;
  }

  private toVehicle(record: VehicleRecord): Vehicle {
    return {
      id: record.id,
      driverId: record.driver_id,
      type: record.type,
      make: record.make,
      model: record.model,
      year: record.year,
      color: record.color,
      licensePlate: record.license_plate,
      maxWeight: parseFloat(record.max_weight.toString()),
      maxVolume: parseFloat(record.max_volume.toString()),
      imageUrl: record.image_url,
      isActive: Boolean(record.is_active),
      currentStatus: record.current_status,
      insuranceInfo: record.insurance_info,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }

  async create(data: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>): Promise<Vehicle> {
    const pool = await this.getPool();
    const id = uuidv4();
    const query = `
      INSERT INTO vehicles (
        id, driver_id, type, make, model, year, color, license_plate,
        max_weight, max_volume, image_url, is_active, current_status, insurance_info
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      id,
      data.driverId,
      data.type,
      data.make,
      data.model,
      data.year,
      data.color,
      data.licensePlate,
      data.maxWeight,
      data.maxVolume,
      data.imageUrl || null,
      data.isActive !== undefined ? data.isActive : true,
      data.currentStatus || 'available',
      data.insuranceInfo || null
    ];

    await pool.execute(query, values);
    return this.findById(id) as Promise<Vehicle>;
  }

  async findById(id: string): Promise<Vehicle | null> {
    const pool = await this.getPool();
    const query = 'SELECT * FROM vehicles WHERE id = ? LIMIT 1';
    const [rows] = await pool.execute(query, [id]);
    const vehicles = rows as VehicleRecord[];

    return vehicles.length > 0 ? this.toVehicle(vehicles[0]) : null;
  }

  async findByDriverId(driverId: string): Promise<Vehicle[]> {
    const pool = await this.getPool();
    const query = 'SELECT * FROM vehicles WHERE driver_id = ? AND is_active = true ORDER BY created_at DESC';
    const [rows] = await pool.execute(query, [driverId]);
    const vehicles = rows as VehicleRecord[];

    return vehicles.map(v => this.toVehicle(v));
  }

  async update(id: string, data: Partial<Omit<Vehicle, 'id' | 'driverId' | 'createdAt' | 'updatedAt'>>): Promise<Vehicle | null> {
    const pool = await this.getPool();
    const updates: string[] = [];
    const values: any[] = [];

    const fieldMap: Record<string, string> = {
      type: 'type',
      make: 'make',
      model: 'model',
      year: 'year',
      color: 'color',
      licensePlate: 'license_plate',
      maxWeight: 'max_weight',
      maxVolume: 'max_volume',
      imageUrl: 'image_url', 
      isActive: 'is_active',
      currentStatus: 'current_status',
      insuranceInfo: 'insurance_info'
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

    updates.push('updated_at = NOW()');
    values.push(id);
    
    const query = `UPDATE vehicles SET ${updates.join(', ')} WHERE id = ?`;
    await pool.execute(query, values);
    
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const pool = await this.getPool();
    const query = 'DELETE FROM vehicles WHERE id = ?';
    const [result] = await pool.execute(query, [id]);
    return (result as any).affectedRows > 0;
  }
}

let vehicleRepositoryInstance: VehicleRepository | null = null;

export function getVehicleRepository(): VehicleRepository {
  if (!vehicleRepositoryInstance) {
    vehicleRepositoryInstance = new VehicleRepository();
  }
  return vehicleRepositoryInstance;
}

export const vehicleRepository = getVehicleRepository();