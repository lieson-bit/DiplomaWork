import { db } from '../config/database';
import { Logger } from '../utils/logger';

export interface BulkOrder {
  id: string;
  customer_id: string;
  bulk_order_name: string;
  file_url: string;
  total_orders: number;
  successful_orders: number;
  failed_orders: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'completed_with_errors' | 'failed';
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export interface CreateBulkOrderData {
  customer_id: string;
  bulk_order_name: string;
  file_url: string;
  total_orders: number;
}

export class BulkOrderRepository {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('BulkOrderRepository');
  }

  async create(data: CreateBulkOrderData): Promise<BulkOrder> {
    try {
      const sql = `
        INSERT INTO bulk_orders (
          customer_id, bulk_order_name, file_url, total_orders,
          processing_status
        ) VALUES (?, ?, ?, ?, 'pending')
      `;
      
      const params = [
        data.customer_id,
        data.bulk_order_name,
        data.file_url,
        data.total_orders
      ];
      
      const result = await db.execute(sql, params);
      return await this.findById(result.insertId.toString()) as BulkOrder;
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to create bulk order:', errorMessage);
      throw new Error(`Bulk order creation failed: ${errorMessage}`);
    }
  }

  async findById(id: string): Promise<BulkOrder | null> {
    try {
      const sql = 'SELECT * FROM bulk_orders WHERE id = ? LIMIT 1';
      const orders = await db.query<BulkOrder>(sql, [id]);
      return orders.length > 0 ? orders[0] : null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to find bulk order by ID:', errorMessage);
      throw error;
    }
  }

  async updateBulkOrderStatus(
    id: string, 
    status: BulkOrder['processing_status'], 
    errorMessage?: string
  ): Promise<boolean> {
    try {
      const sql = `
        UPDATE bulk_orders 
        SET processing_status = ?, 
            error_message = ?,
            updated_at = NOW()
        WHERE id = ?
      `;
      
      await db.execute(sql, [status, errorMessage || null, id]);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to update bulk order status:', errorMessage);
      throw error;
    }
  }

  async completeBulkOrderProcessing(
    id: string,
    successfulOrders: number,
    failedOrders: number
  ): Promise<BulkOrder> {
    try {
      const status = failedOrders > 0 ? 'completed_with_errors' : 'completed';
      
      const sql = `
        UPDATE bulk_orders 
        SET processing_status = ?,
            successful_orders = ?,
            failed_orders = ?,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = ?
      `;
      
      await db.execute(sql, [status, successfulOrders, failedOrders, id]);
      return await this.findById(id) as BulkOrder;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to complete bulk order processing:', errorMessage);
      throw error;
    }
  }
}

export const bulkOrderRepository = new BulkOrderRepository();
export default bulkOrderRepository;