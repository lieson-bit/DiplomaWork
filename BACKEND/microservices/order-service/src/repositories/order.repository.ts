import { db } from '../config/database';
import { logger } from '../utils/logger';

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  driver_id: string | null;
  
  // Pickup Information
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_contact_name: string;
  pickup_contact_phone: string;
  pickup_instructions: string;
  
  // Delivery Information  
  delivery_address: string;
  delivery_latitude: number;
  delivery_longitude: number;
  delivery_contact_name: string;
  delivery_contact_phone: string;
  delivery_instructions: string;
  
  // Package Information
  total_weight_kg: number;
  total_volume_m3: number;
  package_description: string;
  fragile_items: boolean;
  temperature_controlled: boolean;
  
  // Pricing
  base_price: number;
  distance_fee: number;
  weight_fee: number;
  volume_fee: number;
  rush_fee: number;
  fuel_surcharge: number;
  tip_amount: number;
  tax_amount: number;
  
  // Platform Fees
  platform_fee: number;
  platform_fee_percent: number;
  
  // Final Prices
  subtotal_price: number;
  total_price: number;
  driver_earnings: number;
  
  // Payment Status
  payment_status: 'pending' | 'authorized' | 'completed' | 'refunded' | 'failed';
  payment_method: string | null;
  payment_transaction_id: string | null;
  payment_processed_at: Date | null;
  
  // Route Information
  estimated_distance_km: number;
  estimated_duration_minutes: number;
  actual_distance_km: number;
  actual_duration_minutes: number;
  route_polyline: string | null;
  
  // Status & Timing
  status: 'pending' | 'matched' | 'driver_accepted' | 'driver_enroute' | 
          'pickup_started' | 'in_transit' | 'arrived' | 'delivered' | 
          'completed' | 'cancelled' | 'failed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  
  // Timestamps
  created_at: Date;
  scheduled_pickup_at: Date | null;
  matched_at: Date | null;
  accepted_at: Date | null;
  pickup_started_at: Date | null;
  in_transit_at: Date | null;
  delivered_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  
  // Driver Location Tracking
  driver_current_lat: number | null;
  driver_current_lng: number | null;
  driver_last_updated: Date | null;
  
  // Balance Updates
  customer_balance_updated: boolean;
  driver_balance_updated: boolean;
  balance_update_attempts: number;
  
  // Additional metadata
  is_bulk_order: boolean;
  bulk_order_id: string | null;
  
  // Internal notes
  internal_notes: string | null;
  customer_notes: string | null;
  driver_notes: string | null;
  
  updated_at: Date;
}

export interface CreateOrderData {
  customer_id: string;
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_contact_name: string;
  pickup_contact_phone: string;
  pickup_instructions?: string;
  
  delivery_address: string;
  delivery_latitude: number;
  delivery_longitude: number;
  delivery_contact_name: string;
  delivery_contact_phone: string;
  delivery_instructions?: string;
  
  total_weight_kg: number;
  total_volume_m3: number;
  package_description?: string;
  fragile_items?: boolean;
  temperature_controlled?: boolean;
  
  base_price: number;
  distance_fee?: number;
  weight_fee?: number;
  volume_fee?: number;
  rush_fee?: number;
  fuel_surcharge?: number;
  tip_amount?: number;
  tax_amount?: number;
  
  platform_fee?: number;
  platform_fee_percent?: number;
  
  subtotal_price: number;
  total_price: number;
  
  estimated_distance_km: number;
  estimated_duration_minutes: number;
  route_polyline?: string;
  
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  
  customer_notes?: string;
  is_bulk_order?: boolean;
  bulk_order_id?: string;
}

export interface UpdateOrderData {
  driver_id?: string;
  status?: Order['status'];
  payment_status?: Order['payment_status'];
  payment_method?: string;
  payment_transaction_id?: string;
  payment_processed_at?: Date;
  
  actual_distance_km?: number;
  actual_duration_minutes?: number;
  
  driver_current_lat?: number;
  driver_current_lng?: number;
  driver_last_updated?: Date;
  
  scheduled_pickup_at?: Date;
  matched_at?: Date;
  accepted_at?: Date;
  pickup_started_at?: Date;
  in_transit_at?: Date;
  delivered_at?: Date;
  completed_at?: Date;
  cancelled_at?: Date;
  
  customer_balance_updated?: boolean;
  driver_balance_updated?: boolean;
  balance_update_attempts?: number;
  
  driver_notes?: string;
  internal_notes?: string;
  
  driver_earnings?: number;
  platform_fee?: number;
}

export class OrderRepository {
  async create(data: CreateOrderData): Promise<Order> {
    try {
      const sql = `
        INSERT INTO orders (
          customer_id, pickup_address, pickup_latitude, pickup_longitude,
          pickup_contact_name, pickup_contact_phone, pickup_instructions,
          delivery_address, delivery_latitude, delivery_longitude,
          delivery_contact_name, delivery_contact_phone, delivery_instructions,
          total_weight_kg, total_volume_m3, package_description,
          fragile_items, temperature_controlled,
          base_price, distance_fee, weight_fee, volume_fee, rush_fee,
          fuel_surcharge, tip_amount, tax_amount,
          platform_fee, platform_fee_percent,
          subtotal_price, total_price,
          estimated_distance_km, estimated_duration_minutes, route_polyline,
          priority, customer_notes, is_bulk_order, bulk_order_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        data.customer_id,
        data.pickup_address,
        data.pickup_latitude,
        data.pickup_longitude,
        data.pickup_contact_name,
        data.pickup_contact_phone,
        data.pickup_instructions || null,
        
        data.delivery_address,
        data.delivery_latitude,
        data.delivery_longitude,
        data.delivery_contact_name,
        data.delivery_contact_phone,
        data.delivery_instructions || null,
        
        data.total_weight_kg,
        data.total_volume_m3,
        data.package_description || null,
        data.fragile_items || false,
        data.temperature_controlled || false,
        
        data.base_price,
        data.distance_fee || 0,
        data.weight_fee || 0,
        data.volume_fee || 0,
        data.rush_fee || 0,
        data.fuel_surcharge || 0,
        data.tip_amount || 0,
        data.tax_amount || 0,
        
        data.platform_fee || (data.total_price * 0.15), // 15% default
        data.platform_fee_percent || 15.00,
        
        data.subtotal_price,
        data.total_price,
        
        data.estimated_distance_km,
        data.estimated_duration_minutes,
        data.route_polyline || null,
        
        data.priority || 'normal',
        data.customer_notes || null,
        data.is_bulk_order || false,
        data.bulk_order_id || null
      ];
      
      const result = await db.execute(sql, params);
      const orderId = result.insertId;
      
      return await this.findById(orderId.toString()) as Order;
      
    } catch (error: any) {
      logger.error('Failed to create order:', error);
      throw new Error(`Order creation failed: ${error.message}`);
    }
  }

  async findById(id: string): Promise<Order | null> {
    try {
      const sql = 'SELECT * FROM orders WHERE id = ? LIMIT 1';
      const orders = await db.query<Order>(sql, [id]);
      return orders.length > 0 ? orders[0] : null;
    } catch (error: any) {
      logger.error('Failed to find order by ID:', error);
      throw error;
    }
  }

  async findByOrderNumber(orderNumber: string): Promise<Order | null> {
    try {
      const sql = 'SELECT * FROM orders WHERE order_number = ? LIMIT 1';
      const orders = await db.query<Order>(sql, [orderNumber]);
      return orders.length > 0 ? orders[0] : null;
    } catch (error: any) {
      logger.error('Failed to find order by number:', error);
      throw error;
    }
  }

  async findByCustomerId(customerId: string, options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Order[]> {
    try {
      let sql = 'SELECT * FROM orders WHERE customer_id = ?';
      const params: any[] = [customerId];
      
      if (options?.status) {
        sql += ' AND status = ?';
        params.push(options.status);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      if (options?.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);
      }
      
      if (options?.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }
      
      return await db.query<Order>(sql, params);
    } catch (error: any) {
      logger.error('Failed to find orders by customer ID:', error);
      throw error;
    }
  }

  async findByDriverId(driverId: string, options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Order[]> {
    try {
      let sql = 'SELECT * FROM orders WHERE driver_id = ?';
      const params: any[] = [driverId];
      
      if (options?.status) {
        sql += ' AND status = ?';
        params.push(options.status);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      if (options?.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);
      }
      
      if (options?.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }
      
      return await db.query<Order>(sql, params);
    } catch (error: any) {
      logger.error('Failed to find orders by driver ID:', error);
      throw error;
    }
  }

  async update(id: string, data: UpdateOrderData): Promise<Order | null> {
    try {
      const updates: string[] = [];
      const params: any[] = [];
      
      // Build dynamic update query
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          updates.push(`${key} = ?`);
          params.push(value);
        }
      });
      
      if (updates.length === 0) {
        return await this.findById(id);
      }
      
      updates.push('updated_at = NOW()');
      params.push(id);
      
      const sql = `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`;
      await db.execute(sql, params);
      
      return await this.findById(id);
    } catch (error: any) {
      logger.error('Failed to update order:', error);
      throw new Error(`Order update failed: ${error.message}`);
    }
  }

  async updateStatus(id: string, status: Order['status'], notes?: string): Promise<boolean> {
    try {
      await db.transaction(async (connection) => {
        // Update order status
        await connection.execute(
          'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
          [status, id]
        );
        
        // Record status change in history
        const currentOrder = await this.findById(id);
        if (currentOrder) {
          await connection.execute(
            `INSERT INTO order_status_history 
            (order_id, previous_status, new_status, notes)
            VALUES (?, ?, ?, ?)`,
            [id, currentOrder.status, status, notes || null]
          );
        }
      });
      
      logger.info(`Order ${id} status updated to ${status}`);
      return true;
    } catch (error: any) {
      logger.error('Failed to update order status:', error);
      throw error;
    }
  }

  async updatePaymentStatus(
    id: string,
    paymentStatus: Order['payment_status'],
    transactionId?: string
  ): Promise<boolean> {
    try {
      const updates: string[] = ['payment_status = ?'];
      const params: any[] = [paymentStatus];
      
      if (transactionId) {
        updates.push('payment_transaction_id = ?');
        params.push(transactionId);
      }
      
      if (paymentStatus === 'completed') {
        updates.push('payment_processed_at = NOW()');
      }
      
      updates.push('updated_at = NOW()');
      params.push(id);
      
      const sql = `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`;
      await db.execute(sql, params);
      
      logger.info(`Order ${id} payment status updated to ${paymentStatus}`);
      return true;
    } catch (error: any) {
      logger.error('Failed to update payment status:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const sql = 'DELETE FROM orders WHERE id = ?';
      const result = await db.execute(sql, [id]);
      return result.affectedRows > 0;
    } catch (error: any) {
      logger.error('Failed to delete order:', error);
      throw error;
    }
  }

  async findActiveOrders(options?: {
    driverId?: string;
    customerId?: string;
    status?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Order[]> {
    try {
      let sql = 'SELECT * FROM orders WHERE 1=1';
      const params: any[] = [];
      
      if (options?.driverId) {
        sql += ' AND driver_id = ?';
        params.push(options.driverId);
      }
      
      if (options?.customerId) {
        sql += ' AND customer_id = ?';
        params.push(options.customerId);
      }
      
      if (options?.status && options.status.length > 0) {
        const placeholders = options.status.map(() => '?').join(',');
        sql += ` AND status IN (${placeholders})`;
        params.push(...options.status);
      }
      
      sql += ' ORDER BY priority DESC, created_at ASC';
      
      if (options?.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);
      }
      
      if (options?.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }
      
      return await db.query<Order>(sql, params);
    } catch (error: any) {
      logger.error('Failed to find active orders:', error);
      throw error;
    }
  }

  async searchOrders(filters: {
    customerId?: string;
    driverId?: string;
    status?: string;
    paymentStatus?: string;
    startDate?: Date;
    endDate?: Date;
    minAmount?: number;
    maxAmount?: number;
  }, pagination?: {
    page: number;
    limit: number;
  }): Promise<{
    orders: Order[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      const countParams: any[] = [];
      
      if (filters.customerId) {
        whereClause += ' AND customer_id = ?';
        params.push(filters.customerId);
        countParams.push(filters.customerId);
      }
      
      if (filters.driverId) {
        whereClause += ' AND driver_id = ?';
        params.push(filters.driverId);
        countParams.push(filters.driverId);
      }
      
      if (filters.status) {
        whereClause += ' AND status = ?';
        params.push(filters.status);
        countParams.push(filters.status);
      }
      
      if (filters.paymentStatus) {
        whereClause += ' AND payment_status = ?';
        params.push(filters.paymentStatus);
        countParams.push(filters.paymentStatus);
      }
      
      if (filters.startDate) {
        whereClause += ' AND created_at >= ?';
        params.push(filters.startDate);
        countParams.push(filters.startDate);
      }
      
      if (filters.endDate) {
        whereClause += ' AND created_at <= ?';
        params.push(filters.endDate);
        countParams.push(filters.endDate);
      }
      
      if (filters.minAmount !== undefined) {
        whereClause += ' AND total_price >= ?';
        params.push(filters.minAmount);
        countParams.push(filters.minAmount);
      }
      
      if (filters.maxAmount !== undefined) {
        whereClause += ' AND total_price <= ?';
        params.push(filters.maxAmount);
        countParams.push(filters.maxAmount);
      }
      
      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM orders ${whereClause}`;
      const countResult = await db.queryOne<{ total: number }>(countSql, countParams);
      const total = countResult?.total || 0;
      
      // Get paginated data
      let dataSql = `SELECT * FROM orders ${whereClause} ORDER BY created_at DESC`;
      
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        dataSql += ` LIMIT ? OFFSET ?`;
        params.push(pagination.limit, offset);
      }
      
      const orders = await db.query<Order>(dataSql, params);
      
      return {
        orders,
        total,
        page: pagination?.page || 1,
        limit: pagination?.limit || total,
        totalPages: pagination ? Math.ceil(total / pagination.limit) : 1
      };
    } catch (error: any) {
      logger.error('Failed to search orders:', error);
      throw error;
    }
  }

  async getOrderStatistics(customerId?: string, driverId?: string): Promise<{
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    totalRevenue: number;
    totalEarnings: number;
    avgOrderValue: number;
  }> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      
      if (customerId) {
        whereClause += ' AND customer_id = ?';
        params.push(customerId);
      }
      
      if (driverId) {
        whereClause += ' AND driver_id = ?';
        params.push(driverId);
      }
      
      const sql = `
        SELECT 
          COUNT(*) as total_orders,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
          SUM(CASE WHEN status IN ('pending', 'matched', 'driver_accepted') THEN 1 ELSE 0 END) as pending_orders,
          COALESCE(SUM(total_price), 0) as total_revenue,
          COALESCE(SUM(driver_earnings), 0) as total_earnings,
          COALESCE(AVG(total_price), 0) as avg_order_value
        FROM orders
        ${whereClause}
      `;
      
      const result = await db.queryOne<{
        total_orders: number;
        completed_orders: number;
        pending_orders: number;
        total_revenue: number;
        total_earnings: number;
        avg_order_value: number;
      }>(sql, params);
      
      return {
        totalOrders: result?.total_orders || 0,
        completedOrders: result?.completed_orders || 0,
        pendingOrders: result?.pending_orders || 0,
        totalRevenue: parseFloat(result?.total_revenue?.toString() || '0'),
        totalEarnings: parseFloat(result?.total_earnings?.toString() || '0'),
        avgOrderValue: parseFloat(result?.avg_order_value?.toString() || '0')
      };
    } catch (error: any) {
      logger.error('Failed to get order statistics:', error);
      throw error;
    }
  }

  async addToAssignmentQueue(orderId: string, priorityScore: number = 100): Promise<boolean> {
    try {
      const sql = `
        INSERT INTO order_assignment_queue (order_id, priority_score)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE 
          priority_score = VALUES(priority_score),
          updated_at = NOW()
      `;
      
      await db.execute(sql, [orderId, priorityScore]);
      return true;
    } catch (error: any) {
      logger.error('Failed to add order to assignment queue:', error);
      throw error;
    }
  }

  async incrementBalanceUpdateAttempts(orderId: string): Promise<number> {
    try {
      const sql = `
        UPDATE orders 
        SET balance_update_attempts = balance_update_attempts + 1,
            updated_at = NOW()
        WHERE id = ?
        RETURNING balance_update_attempts
      `;
      
      const result = await db.query<{ balance_update_attempts: number }>(sql, [orderId]);
      return result[0]?.balance_update_attempts || 0;
    } catch (error: any) {
      logger.error('Failed to increment balance update attempts:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const orderRepository = new OrderRepository();

// Export for direct use
export default orderRepository;