import { db } from '../config/database';
import { logger } from '../utils/logger';

export interface LocationTracking {
  id: string;
  order_id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  bearing: number | null;
  accuracy: number | null;
  battery_level: number | null;
  timestamp: Date;
}

export interface CreateTrackingData {
  order_id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  speed?: number;
  bearing?: number;
  accuracy?: number;
  battery_level?: number;
}

export interface TrackingSummary {
  orderId: string;
  driverId: string;
  totalPoints: number;
  firstPoint: Date | null;
  lastPoint: Date | null;
  totalDistance: number;
  averageSpeed: number;
  durationMinutes: number;
}

export class TrackingRepository {
  async create(data: CreateTrackingData): Promise<LocationTracking> {
    try {
      const sql = `
        INSERT INTO location_tracking (
          order_id, driver_id, latitude, longitude,
          speed, bearing, accuracy, battery_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        data.order_id,
        data.driver_id,
        data.latitude,
        data.longitude,
        data.speed || null,
        data.bearing || null,
        data.accuracy || null,
        data.battery_level || null
      ];
      
      const result = await db.execute(sql, params);
      return await this.findById(result.insertId.toString()) as LocationTracking;
      
    } catch (error: any) {
      logger.error('Failed to create tracking point:', error);
      throw new Error(`Tracking point creation failed: ${error.message}`);
    }
  }

  async createBatch(points: CreateTrackingData[]): Promise<number> {
    try {
      if (points.length === 0) return 0;
      
      // Prepare batch insert
      const values = points.map(point => [
        point.order_id,
        point.driver_id,
        point.latitude,
        point.longitude,
        point.speed || null,
        point.bearing || null,
        point.accuracy || null,
        point.battery_level || null
      ]);
      
      const sql = `
        INSERT INTO location_tracking 
        (order_id, driver_id, latitude, longitude, speed, bearing, accuracy, battery_level)
        VALUES ?
      `;
      
      const result = await db.execute(sql, [values]);
      return result.affectedRows;
      
    } catch (error: any) {
      logger.error('Failed to create tracking batch:', error);
      throw new Error(`Tracking batch creation failed: ${error.message}`);
    }
  }

  async findById(id: string): Promise<LocationTracking | null> {
    try {
      const sql = 'SELECT * FROM location_tracking WHERE id = ? LIMIT 1';
      const points = await db.query<LocationTracking>(sql, [id]);
      return points.length > 0 ? points[0] : null;
    } catch (error: any) {
      logger.error('Failed to find tracking point by ID:', error);
      throw error;
    }
  }

  async findByOrderId(orderId: string, options?: {
    limit?: number;
    startDate?: Date;
    endDate?: Date;
    orderBy?: 'ASC' | 'DESC';
  }): Promise<LocationTracking[]> {
    try {
      let sql = 'SELECT * FROM location_tracking WHERE order_id = ?';
      const params: any[] = [orderId];
      
      if (options?.startDate) {
        sql += ' AND timestamp >= ?';
        params.push(options.startDate);
      }
      
      if (options?.endDate) {
        sql += ' AND timestamp <= ?';
        params.push(options.endDate);
      }
      
      sql += ` ORDER BY timestamp ${options?.orderBy || 'ASC'}`;
      
      if (options?.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);
      }
      
      return await db.query<LocationTracking>(sql, params);
    } catch (error: any) {
      logger.error('Failed to find tracking points by order ID:', error);
      throw error;
    }
  }

  async findByDriverId(driverId: string, options?: {
    limit?: number;
    recentOnly?: boolean;
  }): Promise<LocationTracking[]> {
    try {
      let sql = 'SELECT * FROM location_tracking WHERE driver_id = ?';
      const params: any[] = [driverId];
      
      if (options?.recentOnly) {
        sql += ' AND timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)';
      }
      
      sql += ' ORDER BY timestamp DESC';
      
      if (options?.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);
      }
      
      return await db.query<LocationTracking>(sql, params);
    } catch (error: any) {
      logger.error('Failed to find tracking points by driver ID:', error);
      throw error;
    }
  }

  async getLatestLocation(orderId: string): Promise<LocationTracking | null> {
    try {
      const sql = `
        SELECT * FROM location_tracking 
        WHERE order_id = ? 
        ORDER BY timestamp DESC 
        LIMIT 1
      `;
      
      const points = await db.query<LocationTracking>(sql, [orderId]);
      return points.length > 0 ? points[0] : null;
    } catch (error: any) {
      logger.error('Failed to get latest location:', error);
      throw error;
    }
  }

  async getDriverLatestLocation(driverId: string): Promise<LocationTracking | null> {
    try {
      const sql = `
        SELECT * FROM location_tracking 
        WHERE driver_id = ? 
        ORDER BY timestamp DESC 
        LIMIT 1
      `;
      
      const points = await db.query<LocationTracking>(sql, [driverId]);
      return points.length > 0 ? points[0] : null;
    } catch (error: any) {
      logger.error('Failed to get driver latest location:', error);
      throw error;
    }
  }

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
      return true;
    } catch (error: any) {
      logger.error('Failed to update order driver location:', error);
      throw error;
    }
  }

  async getTrackingSummary(orderId: string): Promise<TrackingSummary> {
    try {
      const sql = `
        SELECT 
          order_id as orderId,
          driver_id as driverId,
          COUNT(*) as totalPoints,
          MIN(timestamp) as firstPoint,
          MAX(timestamp) as lastPoint,
          COALESCE(AVG(speed), 0) as averageSpeed
        FROM location_tracking 
        WHERE order_id = ?
        GROUP BY order_id, driver_id
      `;
      
      const result = await db.queryOne<{
        orderId: string;
        driverId: string;
        totalPoints: number;
        firstPoint: Date | null;
        lastPoint: Date | null;
        averageSpeed: number;
      }>(sql, [orderId]);
      
      // Calculate distance traveled (simplified)
      const points = await this.findByOrderId(orderId, { limit: 1000 });
      let totalDistance = 0;
      
      for (let i = 1; i < points.length; i++) {
        const distance = this.calculateDistance(
          points[i-1].latitude, points[i-1].longitude,
          points[i].latitude, points[i].longitude
        );
        totalDistance += distance;
      }
      
      // Calculate duration in minutes
      let durationMinutes = 0;
      if (result?.firstPoint && result?.lastPoint) {
        const start = new Date(result.firstPoint).getTime();
        const end = new Date(result.lastPoint).getTime();
        durationMinutes = Math.round((end - start) / (1000 * 60));
      }
      
      return {
        orderId: result?.orderId || orderId,
        driverId: result?.driverId || '',
        totalPoints: result?.totalPoints || 0,
        firstPoint: result?.firstPoint || null,
        lastPoint: result?.lastPoint || null,
        totalDistance: parseFloat(totalDistance.toFixed(2)),
        averageSpeed: parseFloat(result?.averageSpeed?.toString() || '0'),
        durationMinutes
      };
    } catch (error: any) {
      logger.error('Failed to get tracking summary:', error);
      throw error;
    }
  }

  async simulateRoute(
    orderId: string,
    driverId: string,
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    intervalSeconds: number = 30,
    totalPoints: number = 20
  ): Promise<LocationTracking[]> {
    try {
      const simulatedPoints: CreateTrackingData[] = [];
      
      // Calculate step increments
      const latStep = (endLat - startLat) / totalPoints;
      const lngStep = (endLng - startLng) / totalPoints;
      
      // Generate simulated points along the route
      for (let i = 0; i <= totalPoints; i++) {
        const progress = i / totalPoints;
        const lat = startLat + (latStep * i);
        const lng = startLng + (lngStep * i);
        
        // Simulate realistic speed (faster in middle, slower at ends)
        const speed = 30 + (Math.sin(progress * Math.PI) * 20); // 30-50 km/h
        
        simulatedPoints.push({
          order_id: orderId,
          driver_id: driverId,
          latitude: parseFloat(lat.toFixed(6)),
          longitude: parseFloat(lng.toFixed(6)),
          speed: parseFloat(speed.toFixed(2)),
          bearing: this.calculateBearing(lat, lng, endLat, endLng),
          accuracy: 10 + Math.random() * 20, // 10-30 meters
          battery_level: 80 - (i * 2) // Decreasing battery
        });
      }
      
      // Insert all points
      await this.createBatch(simulatedPoints);
      
      // Update order with final location
      await this.updateOrderDriverLocation(orderId, endLat, endLng);
      
      // Return the simulated points
      return await this.findByOrderId(orderId, { limit: totalPoints + 1 });
      
    } catch (error: any) {
      logger.error('Failed to simulate route:', error);
      throw error;
    }
  }

  async cleanupOldTracking(days: number = 30): Promise<number> {
    try {
      const sql = `
        DELETE FROM location_tracking 
        WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)
      `;
      
      const result = await db.execute(sql, [days]);
      logger.info(`Cleaned up ${result.affectedRows} old tracking records`);
      return result.affectedRows;
    } catch (error: any) {
      logger.error('Failed to cleanup old tracking:', error);
      throw error;
    }
  }

  // Helper methods for distance and bearing calculations
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = this.toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(this.toRad(lat2));
    const x = 
      Math.cos(this.toRad(lat1)) * Math.sin(this.toRad(lat2)) -
      Math.sin(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.cos(dLon);
    
    let bearing = Math.atan2(y, x);
    bearing = this.toDeg(bearing);
    bearing = (bearing + 360) % 360;
    
    return parseFloat(bearing.toFixed(1));
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private toDeg(radians: number): number {
    return radians * (180 / Math.PI);
  }
}

// Create singleton instance
export const trackingRepository = new TrackingRepository();

// Export for direct use
export default trackingRepository;