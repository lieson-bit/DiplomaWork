import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { Logger } from '../utils/logger';
import { OrderReceiveRequest } from '../types/index';

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
  
  capacity_check_passed: boolean;
  capacity_check_data: any;
}

export interface CreateOrderData {
  order_number?: string;
  customer_id: string;
  driver_id: string | null;
  
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
  
  // Pricing
  estimated_price_usd: number;
  estimated_price_local: number;
  currency?: string;
  base_currency?: string;
  
  // Timing
  estimated_duration_minutes: number;
  pickup_time_estimated?: Date | null;
  delivery_time_estimated?: Date | null;
  
  // Route
  route_polyline?: string | null;
  route_order_index?: number;
  
  // Payment
  amount_paid?: number;
  payment_status?: 'pending' | 'processing' | 'completed' | 'refunded';
  
  // Driver acceptance
  driver_accepted?: boolean;
  
  // Communication
  unread_customer_messages?: number;
  unread_driver_messages?: number;
  
  // Capacity check
  capacity_check_passed?: boolean;
  capacity_check_data?: any;
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
          capacity_check_passed, capacity_check_data,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `;
      
      const now = new Date();
      
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
        data.capacity_check_passed !== undefined ? data.capacity_check_passed : 1, // capacity_check_passed
        data.capacity_check_data ? JSON.stringify(data.capacity_check_data) : null, // capacity_check_data
        now, // created_at
        now // updated_at
      ];
      
      await db.execute(sql, params);
      const order = await this.findByOrderNumber(orderNumber);
      
      if (!order) {
        throw new Error('Order created but could not be retrieved');
      }
      
      return order;
      
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

  async update(id: string, data: Partial<CreateOrderData>): Promise<Order | null> {
    try {
      const updates: string[] = [];
      const params: any[] = [];
      
      // Build dynamic update query
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === 'capacity_check_data') {
            updates.push(`${key} = ?`);
            params.push(JSON.stringify(value));
          } else {
            updates.push(`${key} = ?`);
            params.push(value);
          }
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

  async getDriverActiveOrders(driverId: string, excludeOrderId?: string): Promise<any[]> {
    try {
      const activeStatuses = [
        'driver_assigned',
        'route_to_pickup',
        'in_transit'
      ];
      
      let sql = `
        SELECT id, weight_kg, volume_m3 
        FROM orders 
        WHERE driver_id = ? 
          AND status IN (${activeStatuses.map(() => '?').join(',')})
      `;
      
      const params: any[] = [driverId, ...activeStatuses];
      
      if (excludeOrderId) {
        sql += ' AND id != ?';
        params.push(excludeOrderId);
      }
      
      return await db.query<any>(sql, params);
    } catch (error) {
      this.logger.error('Failed to get driver active orders:', error);
      return [];
    }
  }
}

export const orderRepository = new OrderRepository();
export default orderRepository;