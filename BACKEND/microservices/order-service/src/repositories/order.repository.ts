import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { Logger } from '../utils/logger';

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
  delivery_instructions?: string;
  
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
  route_order_index: number;
  
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
  driver_enroute_at: Date | null;
  pickup_started_at: Date | null;
  in_transit_at: Date | null;
  delivered_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  driver_route_at: Date | null;
  
  // Driver Location Tracking
  driver_current_lat: number | null;
  driver_current_lng: number | null;
  driver_last_updated: Date | null;
  
  // Balance Updates
  customer_balance_updated: boolean;
  driver_balance_updated: boolean;
  balance_update_attempts: number;

  // Communication 
  unread_customer_messages: number;
  unread_driver_messages: number;
  
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
  order_number?: string;
  customer_id: string;
  driver_id?: string;
  
  // Location info
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_contact_name?: string;
  pickup_contact_phone?: string;
  pickup_instructions?: string;
  
  delivery_address: string;
  delivery_latitude: number;
  delivery_longitude: number;
  delivery_contact_name?: string;
  delivery_contact_phone?: string;
  delivery_instructions?: string;
  
  // Package info
  total_weight_kg: number;
  total_volume_m3: number;
  package_description?: string;
  fragile_items?: boolean;
  temperature_controlled?: boolean;
  
  // Pricing (all optional with defaults)
  base_price?: number;
  distance_fee?: number;
  weight_fee?: number;
  volume_fee?: number;
  rush_fee?: number;
  fuel_surcharge?: number;
  tip_amount?: number;
  tax_amount?: number;
  platform_fee?: number;
  platform_fee_percent?: number;
  subtotal_price?: number;
  total_price?: number;
  driver_earnings?: number;
  
  // Communication fields (NEW - these are in the database)
  unread_customer_messages?: number;
  unread_driver_messages?: number;
  route_order_index?: number;
  
  // Route info
  estimated_distance_km?: number;
  estimated_duration_minutes?: number;
  route_polyline?: string;
  
  // Status
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  
  // Additional info
  customer_notes?: string;
  is_bulk_order?: boolean;
  bulk_order_id?: string;
  internal_notes?: string;
  driver_notes?: string;
}

export interface UpdateOrderData {
  driver_id?: string;
  status?: Order['status'];
  payment_status?: Order['payment_status'];
  payment_method?: string;
  payment_transaction_id?: string;
  payment_processed_at?: Date;

  driver_enroute_at?: Date;
  route_order_index?: number;
  unread_customer_messages?: number;
  unread_driver_messages?: number;
  
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
  private logger: Logger;

  constructor() {
    this.logger = new Logger('OrderRepository');
  }

  // Generates a unique order number (customize as needed)
  private generateOrderNumber(): string {
    // Example: ORD-YYYYMMDD-HHMMSS-<random>
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ORD-${datePart}-${timePart}-${randomPart}`;
  }

  async create(data: CreateOrderData): Promise<Order> {
  try {
    const orderNumber = data.order_number || this.generateOrderNumber();

    // EXACT column list from your database (66 columns)
    const sql = `
      INSERT INTO orders (
        id,
        customer_id,
        driver_id,
        pickup_address,
        pickup_latitude,
        pickup_longitude,
        pickup_contact_name,
        pickup_contact_phone,
        pickup_instructions,
        delivery_address,
        delivery_latitude,
        delivery_longitude,
        delivery_contact_name,
        delivery_contact_phone,
        delivery_instructions,
        total_weight_kg,
        total_volume_m3,
        package_description,
        fragile_items,
        temperature_controlled,
        base_price,
        distance_fee,
        weight_fee,
        volume_fee,
        rush_fee,
        fuel_surcharge,
        tip_amount,
        tax_amount,
        platform_fee,
        platform_fee_percent,
        subtotal_price,
        total_price,
        driver_earnings,
        payment_status,
        payment_method,
        payment_transaction_id,
        payment_processed_at,
        estimated_distance_km,
        estimated_duration_minutes,
        actual_distance_km,
        actual_duration_minutes,
        route_polyline,
        status,
        priority,
        created_at,
        scheduled_pickup_at,
        matched_at,
        accepted_at,
        pickup_started_at,
        in_transit_at,
        delivered_at,
        completed_at,
        cancelled_at,
        driver_current_lat,
        driver_current_lng,
        driver_last_updated,
        customer_balance_updated,
        driver_balance_updated,
        balance_update_attempts,
        is_bulk_order,
        bulk_order_id,
        internal_notes,
        customer_notes,
        driver_notes,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Calculate values from JSON
    const totalPrice = data.total_price || 0;
    const driverEarnings = data.driver_earnings || totalPrice * 0.8;

    // EXACT parameter list (66 values) matching the columns above
    const params = [
      // id (1)
      uuidv4(),
      // customer_id (3)
      data.customer_id,
      // driver_id (4)
      data.driver_id || null,
      // pickup_address (5)
      data.pickup_address,
      // pickup_latitude (6)
      data.pickup_latitude,
      // pickup_longitude (7)
      data.pickup_longitude,
      // pickup_contact_name (8)
      data.pickup_contact_name || 'Unknown',
      // pickup_contact_phone (9)
      data.pickup_contact_phone || '',
      // pickup_instructions (10)
      data.pickup_instructions || null,
      // delivery_address (11)
      data.delivery_address,
      // delivery_latitude (12)
      data.delivery_latitude,
      // delivery_longitude (13)
      data.delivery_longitude,
      // delivery_contact_name (14)
      data.delivery_contact_name || 'Unknown',
      // delivery_contact_phone (15)
      data.delivery_contact_phone || '',
      // delivery_instructions (16)
      data.delivery_instructions || null,
      // total_weight_kg (17)
      data.total_weight_kg || 0,
      // total_volume_m3 (18)
      data.total_volume_m3 || 0,
      // package_description (19)
      data.package_description || 'Package',
      // fragile_items (20)
      data.fragile_items || false,
      // temperature_controlled (21)
      data.temperature_controlled || false,
      // base_price (22)
      data.base_price || (totalPrice * 0.3),
      // distance_fee (23)
      data.distance_fee || (totalPrice * 0.5),
      // weight_fee (24)
      data.weight_fee || (totalPrice * 0.1),
      // volume_fee (25)
      data.volume_fee || (totalPrice * 0.1),
      // rush_fee (26)
      data.rush_fee || 0,
      // fuel_surcharge (27)
      data.fuel_surcharge || 0,
      // tip_amount (28)
      data.tip_amount || 0,
      // tax_amount (29)
      data.tax_amount || 0,
      // platform_fee (30)
      data.platform_fee || (totalPrice * 0.15),
      // platform_fee_percent (31)
      data.platform_fee_percent || 15.00,
      // subtotal_price (32)
      data.subtotal_price || totalPrice,
      // total_price (33)
      totalPrice,
      // driver_earnings (34)
      driverEarnings,
      // payment_status (35)
      'pending',
      // payment_method (36)
      null,
      // payment_transaction_id (37)
      null,
      // payment_processed_at (38)
      null,
      // estimated_distance_km (39)
      data.estimated_distance_km || 0,
      // estimated_duration_minutes (40)
      data.estimated_duration_minutes || 0,
      // actual_distance_km (41)
      0,
      // actual_duration_minutes (42)
      0,
      // route_polyline (43)
      data.route_polyline || null,
      // status (44)
      'pending',
      // priority (45)
      data.priority || 'normal',
      // created_at (46)
      new Date(),
      // scheduled_pickup_at (47)
      null,
      // matched_at (48)
      new Date(),
      // accepted_at (49)
      null,
      // pickup_started_at (50)
      null,
      // in_transit_at (51)
      null,
      // delivered_at (52)
      null,
      // completed_at (53)
      null,
      // cancelled_at (54)
      null,
      // driver_current_lat (55)
      null,
      // driver_current_lng (56)
      null,
      // driver_last_updated (57)
      null,
      // customer_balance_updated (58)
      false,
      // driver_balance_updated (59)
      false,
      // balance_update_attempts (60)
      0,
      // is_bulk_order (61)
      data.is_bulk_order || false,
      // bulk_order_id (62)
      data.bulk_order_id || null,
      // internal_notes (63)
      data.internal_notes || null,
      // customer_notes (64)
      data.customer_notes || null,
      // driver_notes (65)
      data.driver_notes || null,
      // updated_at (66)
      new Date()
    ];

    // Verify count
    this.logger.debug(`Column count: 66, Param count: ${params.length}`);
    
    if (params.length !== 66) {
      throw new Error(`Parameter count mismatch: expected 66, got ${params.length}`);
    }

    await db.execute(sql, params);
    return await this.findByOrderNumber(orderNumber) as Order;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error('Failed to create order:', errorMessage);
    this.logger.error('SQL:', { sql: (error as any)?.sql });
    throw new Error(`Order creation failed: ${errorMessage}`);
  }
}

  async findById(id: string): Promise<Order | null> {
    try {
      const sql = 'SELECT * FROM orders WHERE id = ? LIMIT 1';
      const orders = await db.query<Order>(sql, [id]);
      return orders.length > 0 ? orders[0] : null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to find order by ID:', errorMessage);
      throw error;
    }
  }

  async findByOrderNumber(orderNumber: string): Promise<Order | null> {
    try {
      const sql = 'SELECT * FROM orders WHERE order_number = ? LIMIT 1';
      const orders = await db.query<Order>(sql, [orderNumber]);
      return orders.length > 0 ? orders[0] : null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to find order by number:', errorMessage);
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to find orders by customer ID:', errorMessage);
      throw error;
    }
  }

  async findByDriverId(driverId: string, options?: {
    status?: string | string[]; // CHANGE THIS LINE
    limit?: number;
    offset?: number;
  }): Promise<Order[]> {
    try {
      let sql = 'SELECT * FROM orders WHERE driver_id = ?';
      const params: any[] = [driverId];

      if (options?.status) {
        if (Array.isArray(options.status)) {
          // Handle array of statuses
          const placeholders = options.status.map(() => '?').join(',');
          sql += ` AND status IN (${placeholders})`;
          params.push(...options.status);
        } else {
          // Handle single status
          sql += ' AND status = ?';
          params.push(options.status);
        }
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to find orders by driver ID:', errorMessage);
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to update order:', errorMessage);
      throw new Error(`Order update failed: ${errorMessage}`);
    }
  }

  // ADDED: Method to update driver location (for tracking service)
  async updateOrderDriverLocation(
    orderId: string,
    latitude: number,
    longitude: number
  ): Promise<boolean> {
    try {
      const sql = `
        UPDATE orders 
        SET 
          driver_current_lat = ?,
          driver_current_lng = ?,
          driver_last_updated = NOW(),
          updated_at = NOW()
        WHERE id = ?
      `;
      
      await db.execute(sql, [latitude, longitude, orderId]);
      this.logger.info(`Updated driver location for order ${orderId}`);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to update order driver location:', errorMessage);
      throw error;
    }
  }

  // ADDED: Method to update ETA (for tracking service)
  async updateETA(orderId: string, etaMinutes: number): Promise<boolean> {
    try {
      // Assuming you have an eta_minutes column or you can store it differently
      // For now, we'll log it. You might want to add this to your Order interface
      this.logger.info(`ETA for order ${orderId}: ${etaMinutes} minutes`);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to update ETA for order:', errorMessage);
      return false;
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
      
      this.logger.info(`Order ${id} status updated to ${status}`);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to update order status:', errorMessage);
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
      
      this.logger.info(`Order ${id} payment status updated to ${paymentStatus}`);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to update payment status:', errorMessage);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const sql = 'DELETE FROM orders WHERE id = ?';
      const result = await db.execute(sql, [id]);
      return result.affectedRows > 0;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to delete order:', errorMessage);
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to find active orders:', errorMessage);
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to search orders:', errorMessage);
      throw error;
    }
  }

  // Add this method to your OrderRepository class in order.repository.ts:
async findByDriverIdWithStatus(
  driverId: string, 
  statuses: string[]
): Promise<Order[]> {
  try {
    if (statuses.length === 0) {
      return [];
    }
    
    const placeholders = statuses.map(() => '?').join(',');
    const sql = `
      SELECT * FROM orders 
      WHERE driver_id = ? 
        AND status IN (${placeholders})
      ORDER BY created_at ASC
    `;
    
    const params = [driverId, ...statuses];
    return await db.query<Order>(sql, params);
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error('Failed to find orders by driver ID with statuses:', errorMessage);
    throw error;
  }
}

// Add this method to check for column existence (for compatibility)
async columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const sql = `
      SELECT COUNT(*) as exists_flag
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ? 
        AND COLUMN_NAME = ?
    `;
    
    const result = await db.queryOne<{ exists_flag: number }>(sql, [tableName, columnName]);
    return result?.exists_flag === 1;
  } catch (error) {
    this.logger.warn(`Could not check if column ${columnName} exists in ${tableName}`);
    return false;
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get order statistics:', errorMessage);
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to add order to assignment queue:', errorMessage);
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to increment balance update attempts:', errorMessage);
      throw error;
    }
  }
}

// Create singleton instance
