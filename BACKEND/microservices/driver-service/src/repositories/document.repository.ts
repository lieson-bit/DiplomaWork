import mysql from 'mysql2/promise';
import { ensurePool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { Document } from '../types';

export interface DocumentRecord {
  id: string;
  driver_id: string;
  type: 'license' | 'insurance' | 'registration' | 'inspection' | 'background_check';
  name: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  upload_date: Date;
  expiry_date?: Date;
  rejection_reason?: string;
  verified_by?: string;
  verified_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export class DocumentRepository {
  private pool: mysql.Pool | null = null;

  private async getPool(): Promise<mysql.Pool> {
    if (!this.pool) {
      this.pool = await ensurePool();
    }
    return this.pool;
  }

  private toDocument(record: DocumentRecord): Document {
    return {
      id: record.id,
      driverId: record.driver_id,
      type: record.type,
      name: record.name,
      fileName: record.file_name,
      fileUrl: record.file_url,
      fileSize: record.file_size,
      mimeType: record.mime_type,
      status: record.status,
      uploadDate: record.upload_date,
      expiryDate: record.expiry_date,
      rejectionReason: record.rejection_reason,
      verifiedBy: record.verified_by,
      verifiedAt: record.verified_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }

  async create(data: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Promise<Document> {
    const pool = await this.getPool();
    const id = uuidv4();
    const query = `
      INSERT INTO documents (
        id, driver_id, type, name, file_name, file_url, file_size,
        mime_type, status, upload_date, expiry_date, rejection_reason,
        verified_by, verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      id,
      data.driverId,
      data.type,
      data.name,
      data.fileName,
      data.fileUrl,
      data.fileSize,
      data.mimeType,
      data.status || 'pending',
      data.uploadDate || new Date(),
      data.expiryDate || null,
      data.rejectionReason || null,
      data.verifiedBy || null,
      data.verifiedAt || null
    ];

    await pool.execute(query, values);
    return this.findById(id) as Promise<Document>;
  }

  async findById(id: string): Promise<Document | null> {
    const pool = await this.getPool();
    const query = 'SELECT * FROM documents WHERE id = ? LIMIT 1';
    const [rows] = await pool.execute(query, [id]);
    const documents = rows as DocumentRecord[];

    return documents.length > 0 ? this.toDocument(documents[0]) : null;
  }

  async findByDriverId(driverId: string): Promise<Document[]> {
    const pool = await this.getPool();
    const query = 'SELECT * FROM documents WHERE driver_id = ? ORDER BY upload_date DESC';
    const [rows] = await pool.execute(query, [driverId]);
    const documents = rows as DocumentRecord[];

    return documents.map(d => this.toDocument(d));
  }

  async updateStatus(id: string, status: string, verifiedBy?: string, rejectionReason?: string): Promise<Document | null> {
    const pool = await this.getPool();
    const updates: string[] = ['status = ?'];
    const values: any[] = [status];

    if (status === 'approved') {
      updates.push('verified_by = ?', 'verified_at = NOW()');
      values.push(verifiedBy);
    } else if (status === 'rejected') {
      updates.push('rejection_reason = ?');
      values.push(rejectionReason);
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    const query = `UPDATE documents SET ${updates.join(', ')} WHERE id = ?`;
    await pool.execute(query, values);
    
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const pool = await this.getPool();
    const query = 'DELETE FROM documents WHERE id = ?';
    const [result] = await pool.execute(query, [id]);
    return (result as any).affectedRows > 0;
  }

  async getExpiringDocuments(daysBefore: number = 30): Promise<Document[]> {
    const pool = await this.getPool();
    const query = `
      SELECT * FROM documents 
      WHERE expiry_date <= DATE_ADD(NOW(), INTERVAL ? DAY) 
        AND expiry_date > NOW() 
        AND status = 'approved'
    `;
    const [rows] = await pool.execute(query, [daysBefore]);
    const documents = rows as DocumentRecord[];

    return documents.map(d => this.toDocument(d));
  }

  async getDocumentsByStatus(status: string): Promise<Document[]> {
    const pool = await this.getPool();
    const query = 'SELECT * FROM documents WHERE status = ? ORDER BY upload_date DESC';
    const [rows] = await pool.execute(query, [status]);
    const documents = rows as DocumentRecord[];

    return documents.map(d => this.toDocument(d));
  }
}

let documentRepositoryInstance: DocumentRepository | null = null;

export function getDocumentRepository(): DocumentRepository {
  if (!documentRepositoryInstance) {
    documentRepositoryInstance = new DocumentRepository();
  }
  return documentRepositoryInstance;
}

export const documentRepository = getDocumentRepository();