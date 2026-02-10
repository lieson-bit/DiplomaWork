import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { Logger } from '../utils/logger';

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  driver_id: string | null;
  
  status: 'pending' | 'driver_assigned' | 'route_to_pickup' | 'in_transit' | 'delivered' | 'cancelled' | 'completed';
  
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  
  delivery_address: string;
  delivery_latitude: number;
  delivery_longitude: number;
  
  distance_km: number;
  
  package_category: string;
  weight_kg: number;
  volume_m3: number;
  urgency: 'normal' | 'high' | 'urgent';
  
  fragile: boolean;
  refrigerated: boolean;
  oversized: boolean;
  hazardous: boolean;
  
  driver_name: string | null;
  driver_phone: string | null;
  driver_email: string | null;
  driver_rating: number | null;
  driver_match_score: number | null;
  
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_license_plate: string | null;
  vehicle_image_url: string | null;
  vehicle_max_weight: number | null;
  vehicle_max_volume: number | null;
  
  estimated_price_usd: number;
  estimated_price_local: number;
  currency: string;
  base_currency: string;
  
  estimated_duration_minutes: number;
  pickup_time_estimated: Date | null;
  delivery_time_estimated: Date | null;
  
  route_polyline: string | null;
  route_order_index: number;
  
  amount_paid: number;
  payment_status: 'pending' | 'processing' | 'completed' | 'refunded';
  
  driver_accepted: boolean;
  driver_accepted_at: Date | null;
  
  delivery_started_at: Date | null;
  delivery_completed_at: Date | null;
  
  customer_rating: number | null;
  customer_review: string | null;
  rating_given_at: Date | null;
  
  unread_customer_messages: number;
  unread_driver_messages: number;
  
  created_at: Date;
  updated_at: Date;
}

export interface CreateOrderData {
  order_number?: string;
  customer_id: string;
  driver_id?: string | null;
  
  // Customer Info
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  
  // Locations
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  
  delivery_address: string;
  delivery_latitude: number;
  delivery_longitude: number;
  
  distance_km: number;
  
  // Package Details
  package_category: string;
  weight_kg: number;
  volume_m3: number;
  urgency?: 'normal' | 'high' | 'urgent';
  
  // Special Requirements
  fragile?: boolean;
  refrigerated?: boolean;
  oversized?: boolean;
  hazardous?: boolean;
  
  // Driver Info (optional on creation)
  driver_name?: string | null;
  driver_phone?: string | null;
  driver_email?: string | null;
  driver_rating?: number | null;
  driver_match_score?: number | null;
  
  // Vehicle Info (optional on creation)
  vehicle_type?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_license_plate?: string | null;
  vehicle_image_url?: string | null;
  vehicle_max_weight?: number | null;
  vehicle_max_volume?: number | null;
  
  // Pricing
  estimated_price_usd: number;
  estimated_price_local: number;
  currency?: string;
  base_currency?: string;
  
  // Timing
  estimated_duration_minutes: number;
  pickup_time_estimated?: Date | null;
  delivery_time_estimated?: Date | null;
  
  // Route Optimization
  route_polyline?: string | null;
  route_order_index?: number;
  status?: Order['status'];
  // Payment
  amount_paid?: number;
  payment_status?: 'pending' | 'processing' | 'completed' | 'refunded';
  
  // Driver acceptance
  driver_accepted?: boolean;
  
  // Communication
  unread_customer_messages?: number;
  unread_driver_messages?: number;
}

export interface UpdateOrderData {
  driver_id?: string | null;
  status?: Order['status'];
  
  // Driver Info
  driver_name?: string | null;
  driver_phone?: string | null;
  driver_email?: string | null;
  driver_rating?: number | null;
  driver_match_score?: number | null;
  
  // Vehicle Info
  vehicle_type?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_license_plate?: string | null;
  vehicle_image_url?: string | null;
  vehicle_max_weight?: number | null;
  vehicle_max_volume?: number | null;
  
  // Payment
  amount_paid?: number;
  payment_status?: Order['payment_status'];
  
  // Driver acceptance
  driver_accepted?: boolean;
  driver_accepted_at?: Date | null;
  
  // Delivery tracking
  delivery_started_at?: Date | null;
  delivery_completed_at?: Date | null;
  
  // Rating
  customer_rating?: number | null;
  customer_review?: string | null;
  rating_given_at?: Date | null;
  
  // Communication
  unread_customer_messages?: number;
  unread_driver_messages?: number;
  
  // Route Optimization
  route_order_index?: number;
  route_polyline?: string | null;
  
  // Timing updates
  pickup_time_estimated?: Date | null;
  delivery_time_estimated?: Date | null;
}

export class OrderRepository {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('OrderRepository');
  }

  // Generate order number (ORD-YYYYMMDD-XXXXX)
  private generateOrderNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `ORD-${dateStr}-${randomStr}`;
  }

  async create(data: CreateOrderData): Promise<Order> {
    try {
      const orderNumber = data.order_number || this.generateOrderNumber();
      
      const sql = `
        INSERT INTO orders (
          id, order_number, customer_id, driver_id,
          status, customer_name, customer_email, customer_phone,
          pickup_address, pickup_latitude, pickup_longitude,
          delivery_address, delivery_latitude, delivery_longitude,
          distance_km, package_category, weight_kg, volume_m3,
          urgency, fragile, refrigerated, oversized, hazardous,
          driver_name, driver_phone, driver_email, driver_rating, driver_match_score,
          vehicle_type, vehicle_make, vehicle_model, vehicle_license_plate, vehicle_image_url,
          vehicle_max_weight, vehicle_max_volume,
          estimated_price_usd, estimated_price_local, currency, base_currency,
          estimated_duration_minutes, pickup_time_estimated, delivery_time_estimated,
          route_polyline, route_order_index,
          amount_paid, payment_status,
          driver_accepted, driver_accepted_at,
          delivery_started_at, delivery_completed_at,
          customer_rating, customer_review, rating_given_at,
          unread_customer_messages, unread_driver_messages,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `;
      
      const params = [
        uuidv4(), // id
        orderNumber, // order_number
        data.customer_id, // customer_id
        data.driver_id || null, // driver_id
        'pending', // status (default)
        data.customer_name, // customer_name
        data.customer_email, // customer_email
        data.customer_phone, // customer_phone
        data.pickup_address, // pickup_address
        data.pickup_latitude, // pickup_latitude
        data.pickup_longitude, // pickup_longitude
        data.delivery_address, // delivery_address
        data.delivery_latitude, // delivery_latitude
        data.delivery_longitude, // delivery_longitude
        data.distance_km, // distance_km
        data.package_category, // package_category
        data.weight_kg, // weight_kg
        data.volume_m3, // volume_m3
        data.urgency || 'normal', // urgency
        data.fragile || false, // fragile
        data.refrigerated || false, // refrigerated
        data.oversized || false, // oversized
        data.hazardous || false, // hazardous
        data.driver_name || null, // driver_name
        data.driver_phone || null, // driver_phone
        data.driver_email || null, // driver_email
        data.driver_rating || null, // driver_rating
        data.driver_match_score || null, // driver_match_score
        data.vehicle_type || null, // vehicle_type
        data.vehicle_make || null, // vehicle_make
        data.vehicle_model || null, // vehicle_model
        data.vehicle_license_plate || null, // vehicle_license_plate
        data.vehicle_image_url || null, // vehicle_image_url
        data.vehicle_max_weight || null, // vehicle_max_weight
        data.vehicle_max_volume || null, // vehicle_max_volume
        data.estimated_price_usd, // estimated_price_usd
        data.estimated_price_local, // estimated_price_local
        data.currency || 'USD', // currency
        data.base_currency || 'RUB', // base_currency
        data.estimated_duration_minutes, // estimated_duration_minutes
        data.pickup_time_estimated || null, // pickup_time_estimated
        data.delivery_time_estimated || null, // delivery_time_estimated
        data.route_polyline || null, // route_polyline
        data.route_order_index || 0, // route_order_index
        data.amount_paid || 0.00, // amount_paid
        data.payment_status || 'pending', // payment_status
        data.driver_accepted || false, // driver_accepted
        null, // driver_accepted_at
        null, // delivery_started_at
        null, // delivery_completed_at
        null, // customer_rating
        null, // customer_review
        null, // rating_given_at
        data.unread_customer_messages || 0, // unread_customer_messages
        data.unread_driver_messages || 0, // unread_driver_messages
        new Date(), // created_at
        new Date()  // updated_at
      ];
      
      await db.execute(sql, params);
      return await this.findByOrderNumber(orderNumber) as Order;
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to create order:', errorMessage);
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
    status?: string | string[];
    limit?: number;
    offset?: number;
  }): Promise<Order[]> {
    try {
      let sql = 'SELECT * FROM orders WHERE driver_id = ?';
      const params: any[] = [driverId];
      
      if (options?.status) {
        if (Array.isArray(options.status)) {
          const placeholders = options.status.map(() => '?').join(',');
          sql += ` AND status IN (${placeholders})`;
          params.push(...options.status);
        } else {
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

  async updateStatus(id: string, status: Order['status']): Promise<boolean> {
    try {
      const sql = 'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?';
      await db.execute(sql, [status, id]);
      
      // Record status change if you have status_history table
      // await this.recordStatusChange(id, status);
      
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
    amountPaid?: number
  ): Promise<boolean> {
    try {
      const updates: string[] = ['payment_status = ?'];
      const params: any[] = [paymentStatus];
      
      if (amountPaid !== undefined) {
        updates.push('amount_paid = ?');
        params.push(amountPaid);
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

  async updateDriverAcceptance(
    id: string,
    accepted: boolean
  ): Promise<boolean> {
    try {
      const sql = `
        UPDATE orders 
        SET driver_accepted = ?, 
            driver_accepted_at = ${accepted ? 'NOW()' : 'NULL'}, 
            updated_at = NOW() 
        WHERE id = ?
      `;
      await db.execute(sql, [accepted, id]);
      
      this.logger.info(`Order ${id} driver acceptance updated to ${accepted}`);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to update driver acceptance:', errorMessage);
      throw error;
    }
  }

  async updateCustomerRating(
    id: string,
    rating: number,
    review?: string
  ): Promise<boolean> {
    try {
      const sql = `
        UPDATE orders 
        SET customer_rating = ?, 
            customer_review = ?, 
            rating_given_at = NOW(), 
            updated_at = NOW() 
        WHERE id = ?
      `;
      await db.execute(sql, [rating, review || null, id]);
      
      this.logger.info(`Order ${id} customer rating updated to ${rating}`);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to update customer rating:', errorMessage);
      throw error;
    }
  }

  async updateDeliveryTiming(
    id: string,
    started: boolean
  ): Promise<boolean> {
    try {
      const sql = started
        ? `UPDATE orders SET delivery_started_at = NOW(), updated_at = NOW() WHERE id = ?`
        : `UPDATE orders SET delivery_completed_at = NOW(), updated_at = NOW() WHERE id = ?`;
      
      await db.execute(sql, [id]);
      
      this.logger.info(`Order ${id} delivery ${started ? 'started' : 'completed'}`);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to update delivery timing:', errorMessage);
      throw error;
    }
  }

  async updateRouteOrderIndex(id: string, index: number): Promise<boolean> {
    try {
      const sql = 'UPDATE orders SET route_order_index = ?, updated_at = NOW() WHERE id = ?';
      await db.execute(sql, [index, id]);
      
      this.logger.info(`Order ${id} route order index updated to ${index}`);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to update route order index:', errorMessage);
      throw error;
    }
  }

  async updateUnreadMessages(
    id: string,
    customerMessages: number,
    driverMessages: number
  ): Promise<boolean> {
    try {
      const sql = `
        UPDATE orders 
        SET unread_customer_messages = ?, 
            unread_driver_messages = ?, 
            updated_at = NOW() 
        WHERE id = ?
      `;
      await db.execute(sql, [customerMessages, driverMessages, id]);
      
      this.logger.info(`Order ${id} unread messages updated`);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to update unread messages:', errorMessage);
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
      
      sql += ' ORDER BY route_order_index ASC, created_at ASC';
      
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

  async getOrderStatistics(customerId?: string, driverId?: string): Promise<{
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    totalRevenue: number;
    averageRating: number;
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
          SUM(CASE WHEN status IN ('pending', 'driver_assigned') THEN 1 ELSE 0 END) as pending_orders,
          COALESCE(SUM(estimated_price_usd), 0) as total_revenue,
          COALESCE(AVG(customer_rating), 0) as average_rating
        FROM orders
        ${whereClause}
      `;
      
      const result = await db.queryOne<{
        total_orders: number;
        completed_orders: number;
        pending_orders: number;
        total_revenue: number;
        average_rating: number;
      }>(sql, params);
      
      return {
        totalOrders: result?.total_orders || 0,
        completedOrders: result?.completed_orders || 0,
        pendingOrders: result?.pending_orders || 0,
        totalRevenue: parseFloat(result?.total_revenue?.toString() || '0'),
        averageRating: parseFloat(result?.average_rating?.toString() || '0')
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get order statistics:', errorMessage);
      throw error;
    }
  }

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
        ORDER BY route_order_index ASC, created_at ASC
      `;
      
      const params = [driverId, ...statuses];
      return await db.query<Order>(sql, params);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to find orders by driver ID with statuses:', errorMessage);
      throw error;
    }
  }
}
