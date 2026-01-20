import mysql from 'mysql2/promise';
import { ensurePool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { ProfilePicture } from '../types';

export interface ProfilePictureRecord {
  id: string;
  driver_id: string;
  original_url: string;
  thumbnail_url?: string;
  small_url?: string;
  medium_url?: string;
  mime_type: string;
  size: number;
  width?: number;
  height?: number;
  is_active: boolean;
  uploaded_at: Date;
  updated_at: Date;
}

export class ProfilePictureRepository {
  private pool: mysql.Pool | null = null;

  private async getPool(): Promise<mysql.Pool> {
    if (!this.pool) {
      this.pool = await ensurePool();
    }
    return this.pool;
  }

  private toProfilePicture(record: ProfilePictureRecord): ProfilePicture {
    return {
      id: record.id,
      driverId: record.driver_id,
      originalUrl: record.original_url,
      thumbnailUrl: record.thumbnail_url,
      smallUrl: record.small_url,
      mediumUrl: record.medium_url,
      mimeType: record.mime_type,
      size: record.size,
      width: record.width,
      height: record.height,
      isActive: Boolean(record.is_active),
      uploadedAt: record.uploaded_at,
      updatedAt: record.updated_at
    };
  }

  async create(data: Omit<ProfilePicture, 'id' | 'uploadedAt' | 'updatedAt'>): Promise<ProfilePicture> {
    const pool = await this.getPool();
    const id = uuidv4();
    const query = `
      INSERT INTO profile_pictures (
        id, driver_id, original_url, thumbnail_url, small_url, medium_url,
        mime_type, size, width, height, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      id,
      data.driverId,
      data.originalUrl,
      data.thumbnailUrl || null,
      data.smallUrl || null,
      data.mediumUrl || null,
      data.mimeType,
      data.size,
      data.width || null,
      data.height || null,
      data.isActive !== undefined ? data.isActive : true
    ];

    await pool.execute(query, values);
    return this.findByDriverId(data.driverId) as Promise<ProfilePicture>;
  }

  async findByDriverId(driverId: string): Promise<ProfilePicture | null> {
    const pool = await this.getPool();
    const query = 'SELECT * FROM profile_pictures WHERE driver_id = ? AND is_active = TRUE LIMIT 1';
    const [rows] = await pool.execute(query, [driverId]);
    const pictures = rows as ProfilePictureRecord[];

    return pictures.length > 0 ? this.toProfilePicture(pictures[0]) : null;
  }

  async findById(id: string): Promise<ProfilePicture | null> {
    const pool = await this.getPool();
    const query = 'SELECT * FROM profile_pictures WHERE id = ? LIMIT 1';
    const [rows] = await pool.execute(query, [id]);
    const pictures = rows as ProfilePictureRecord[];

    return pictures.length > 0 ? this.toProfilePicture(pictures[0]) : null;
  }

  async update(driverId: string, data: Partial<Omit<ProfilePicture, 'id' | 'driverId' | 'uploadedAt' | 'updatedAt'>>): Promise<ProfilePicture | null> {
    const pool = await this.getPool();
    const updates: string[] = [];
    const values: any[] = [];

    const fieldMap: Record<string, string> = {
      originalUrl: 'original_url',
      thumbnailUrl: 'thumbnail_url',
      smallUrl: 'small_url',
      mediumUrl: 'medium_url',
      mimeType: 'mime_type',
      size: 'size',
      width: 'width',
      height: 'height',
      isActive: 'is_active'
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbKey = fieldMap[key] || key;
        updates.push(`${dbKey} = ?`);
        values.push(value);
      }
    });

    if (updates.length === 0) {
      return this.findByDriverId(driverId);
    }

    updates.push('updated_at = NOW()');
    values.push(driverId);
    
    const query = `UPDATE profile_pictures SET ${updates.join(', ')} WHERE driver_id = ?`;
    await pool.execute(query, values);
    
    return this.findByDriverId(driverId);
  }

  async deleteByDriverId(driverId: string): Promise<boolean> {
    const pool = await this.getPool();
    const query = 'DELETE FROM profile_pictures WHERE driver_id = ?';
    const [result] = await pool.execute(query, [driverId]);
    return (result as any).affectedRows > 0;
  }

  async deactivateByDriverId(driverId: string): Promise<boolean> {
    const pool = await this.getPool();
    const query = 'UPDATE profile_pictures SET is_active = FALSE WHERE driver_id = ?';
    const [result] = await pool.execute(query, [driverId]);
    return (result as any).affectedRows > 0;
  }
}

let profilePictureRepositoryInstance: ProfilePictureRepository | null = null;

export function getProfilePictureRepository(): ProfilePictureRepository {
  if (!profilePictureRepositoryInstance) {
    profilePictureRepositoryInstance = new ProfilePictureRepository();
  }
  return profilePictureRepositoryInstance;
}

export const profilePictureRepository = getProfilePictureRepository();