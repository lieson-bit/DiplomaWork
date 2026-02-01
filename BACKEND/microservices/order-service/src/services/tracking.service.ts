import { Logger } from '../utils/logger';
import { WebSocketUtil } from '../utils/websocket.util';
import { TrackingRepository } from '../repositories/tracking.repository';
import { OrderRepository } from '../repositories/order.repository';
import { LocationTracking, CreateTrackingData } from '../repositories/tracking.repository';
import { Order } from '../repositories/order.repository';

export interface LocationUpdate {
  orderId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  bearing?: number;
  accuracy?: number;
  batteryLevel?: number;
  timestamp?: Date;
}

export interface TrackingData {
  orderId: string;
  driverId: string;
  locations: Array<{
    latitude: number;
    longitude: number;
    timestamp: Date;
    speed?: number;
    bearing?: number;
  }>;
  summary: {
    totalDistance: number;
    totalDuration: number;
    averageSpeed: number;
    maxSpeed: number;
    startTime: Date;
    endTime?: Date;
  };
}

export interface LiveTrackingEvent {
  type: 'location_update' | 'status_change' | 'eta_update';
  orderId: string;
  data: any;
  timestamp: Date;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export class TrackingService {
  private logger: Logger;
  private websocketUtil: WebSocketUtil;
  private trackingRepository: TrackingRepository;
  private orderRepository: OrderRepository;
  private liveConnections: Map<string, Set<string>> = new Map(); // orderId -> connectionIds

  constructor(
    websocketUtil: WebSocketUtil,
    trackingRepository: TrackingRepository,
    orderRepository: OrderRepository
  ) {
    this.logger = new Logger('TrackingService');
    this.websocketUtil = websocketUtil;
    this.trackingRepository = trackingRepository;
    this.orderRepository = orderRepository;
  }

  async recordLocationUpdate(update: LocationUpdate): Promise<void> {
    try {
      this.logger.info(`Recording location update for order ${update.orderId}`);

      // Validate location data
      this.validateLocationUpdate(update);

      // Store in database - use create method from repository
      const trackingData: CreateTrackingData = {
        order_id: update.orderId,
        driver_id: update.driverId,
        latitude: update.latitude,
        longitude: update.longitude,
        speed: update.speed,
        bearing: update.bearing,
        accuracy: update.accuracy,
        battery_level: update.batteryLevel
      };
      
      await this.trackingRepository.create(trackingData);

      // Update order with current driver location
      await this.orderRepository.updateOrderDriverLocation(
        update.orderId,
        update.latitude,
        update.longitude
      );

      // Broadcast to connected clients
      await this.broadcastLocationUpdate(update);

      // Calculate and update ETA if needed
      await this.updateETA(update.orderId);

      this.logger.debug(`Location update recorded for order ${update.orderId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to record location update for order ${update.orderId}:`, errorMessage);
      throw error;
    }
  }

  async getOrderTracking(orderId: string, startTime?: Date, endTime?: Date): Promise<TrackingData> {
    try {
      this.logger.info(`Getting tracking data for order ${orderId}`);

      // Get locations from database - use findByOrderId method
      const locations = await this.trackingRepository.findByOrderId(orderId, {
        startDate: startTime,
        endDate: endTime,
        orderBy: 'ASC'
      });

      if (locations.length === 0) {
        throw new Error(`No tracking data found for order ${orderId}`);
      }

      // Calculate summary statistics
      const summary = this.calculateTrackingSummary(locations);

      // Get order and driver info
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // Get driver ID from order - adjust based on your actual Order type
      const driverId = (order as any).driver_id || (order as any).driverId || '';

      return {
        orderId,
        driverId,
        locations: locations.map((loc: LocationTracking) => ({
          latitude: loc.latitude,
          longitude: loc.longitude,
          timestamp: loc.timestamp,
          speed: loc.speed || undefined,
          bearing: loc.bearing || undefined
        })),
        summary
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get tracking data for order ${orderId}:`, errorMessage);
      throw error;
    }
  }

  async getLiveLocation(orderId: string): Promise<LocationUpdate | null> {
    try {
      const latestLocation = await this.trackingRepository.getLatestLocation(orderId);
      if (!latestLocation) {
        return null;
      }

      return {
        orderId,
        driverId: latestLocation.driver_id,
        latitude: latestLocation.latitude,
        longitude: latestLocation.longitude,
        speed: latestLocation.speed || undefined,
        bearing: latestLocation.bearing || undefined,
        accuracy: latestLocation.accuracy || undefined,
        batteryLevel: latestLocation.battery_level || undefined,
        timestamp: latestLocation.timestamp
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get live location for order ${orderId}:`, errorMessage);
      return null;
    }
  }

  async subscribeToLiveTracking(orderId: string, connectionId: string): Promise<void> {
    try {
      if (!this.liveConnections.has(orderId)) {
        this.liveConnections.set(orderId, new Set());
      }
      
      this.liveConnections.get(orderId)!.add(connectionId);
      
      // Send current location immediately
      const currentLocation = await this.getLiveLocation(orderId);
      if (currentLocation) {
        await this.websocketUtil.sendToConnection(connectionId, 'tracking_update', {
          type: 'location_update',
          orderId,
          data: currentLocation,
          timestamp: new Date()
        });
      }
      
      this.logger.info(`Connection ${connectionId} subscribed to order ${orderId} tracking`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to subscribe to live tracking for order ${orderId}:`, errorMessage);
      throw error;
    }
  }

  async unsubscribeFromLiveTracking(orderId: string, connectionId: string): Promise<void> {
    try {
      const connections = this.liveConnections.get(orderId);
      if (connections) {
        connections.delete(connectionId);
        if (connections.size === 0) {
          this.liveConnections.delete(orderId);
        }
      }
      
      this.logger.info(`Connection ${connectionId} unsubscribed from order ${orderId} tracking`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to unsubscribe from live tracking for order ${orderId}:`, errorMessage);
      throw error;
    }
  }

  async simulateRoute(
    orderId: string,
    driverId: string,
    routePolyline: string,
    intervalSeconds: number = 30,
    speedKph: number = 30
  ): Promise<void> {
    try {
      this.logger.info(`Simulating route for order ${orderId}`);
      
      // Decode polyline to get route points
      const routePoints = this.decodePolyline(routePolyline);
      
      if (routePoints.length < 2) {
        throw new Error('Invalid route polyline');
      }
      
      // Calculate total distance and time
      const totalDistance = this.calculateRouteDistance(routePoints);
      const totalTimeSeconds = (totalDistance / speedKph) * 3600;
      
      // Generate simulated location updates
      const numUpdates = Math.ceil(totalTimeSeconds / intervalSeconds);
      const distancePerUpdate = totalDistance / numUpdates;
      
      for (let i = 0; i <= numUpdates; i++) {
        const progress = i / numUpdates;
        const pointIndex = Math.floor(progress * (routePoints.length - 1));
        const nextPointIndex = Math.min(pointIndex + 1, routePoints.length - 1);
        const segmentProgress = (progress * (routePoints.length - 1)) - pointIndex;
        
        // Interpolate between points
        const currentPoint = routePoints[pointIndex];
        const nextPoint = routePoints[nextPointIndex];
        
        const lat = currentPoint.lat + (nextPoint.lat - currentPoint.lat) * segmentProgress;
        const lng = currentPoint.lng + (nextPoint.lng - currentPoint.lng) * segmentProgress;
        
        // Create simulated update
        const update: LocationUpdate = {
          orderId,
          driverId,
          latitude: lat,
          longitude: lng,
          speed: speedKph,
          bearing: this.calculateBearing(currentPoint, nextPoint),
          accuracy: 10, // 10 meter accuracy in simulation
          batteryLevel: 80 - Math.floor(i * (20 / numUpdates)), // Simulate battery drain
          timestamp: new Date(Date.now() + i * intervalSeconds * 1000)
        };
        
        // Record the update
        await this.recordLocationUpdate(update);
        
        // Wait for next interval
        if (i < numUpdates) {
          await this.delay(intervalSeconds * 1000);
        }
      }
      
      this.logger.info(`Route simulation complete for order ${orderId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Route simulation failed for order ${orderId}:`, errorMessage);
      throw error;
    }
  }

  async generateTrackingReport(
    orderId: string,
    format: 'json' | 'csv' | 'pdf' = 'json'
  ): Promise<any> {
    try {
      const trackingData = await this.getOrderTracking(orderId);
      const order = await this.orderRepository.findById(orderId);
      
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }
      
      // Cast to any to access properties or adjust based on your actual Order interface
      const orderAny = order as any;
      
      switch (format) {
        case 'json':
          return {
            order: {
              id: orderAny.id,
              order_number: orderAny.order_number || orderAny.orderNumber,
              status: orderAny.status,
              pickup_address: orderAny.pickup_address || orderAny.pickupAddress,
              delivery_address: orderAny.delivery_address || orderAny.deliveryAddress
            },
            tracking: trackingData
          };
          
        case 'csv':
          return this.generateCSVReport(trackingData);
          
        case 'pdf':
          // In a real implementation, this would generate a PDF
          throw new Error('PDF report generation not implemented');
          
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to generate tracking report for order ${orderId}:`, errorMessage);
      throw error;
    }
  }

  private validateLocationUpdate(update: LocationUpdate): void {
    if (!update.orderId || !update.driverId) {
      throw new Error('Order ID and Driver ID are required');
    }
    
    if (!update.latitude || !update.longitude) {
      throw new Error('Latitude and longitude are required');
    }
    
    if (update.latitude < -90 || update.latitude > 90) {
      throw new Error('Invalid latitude value');
    }
    
    if (update.longitude < -180 || update.longitude > 180) {
      throw new Error('Invalid longitude value');
    }
    
    if (update.speed !== undefined && update.speed < 0) {
      throw new Error('Speed cannot be negative');
    }
    
    if (update.bearing !== undefined && (update.bearing < 0 || update.bearing > 360)) {
      throw new Error('Bearing must be between 0 and 360 degrees');
    }
  }

  private async broadcastLocationUpdate(update: LocationUpdate): Promise<void> {
    const connections = this.liveConnections.get(update.orderId);
    if (connections && connections.size > 0) {
      const event: LiveTrackingEvent = {
        type: 'location_update',
        orderId: update.orderId,
        data: update,
        timestamp: new Date()
      };
      
      for (const connectionId of connections) {
        try {
          await this.websocketUtil.sendToConnection(connectionId, 'tracking_update', event);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(`Failed to send update to connection ${connectionId}:`, errorMessage);
          // Remove disconnected client
          connections.delete(connectionId);
        }
      }
    }
  }

  private async updateETA(orderId: string): Promise<void> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        return;
      }
      
      // Cast to any to access properties or adjust based on your actual Order interface
      const orderAny = order as any;
      
      // Check if delivery coordinates exist
      const deliveryLatitude = orderAny.delivery_latitude || orderAny.deliveryLatitude;
      const deliveryLongitude = orderAny.delivery_longitude || orderAny.deliveryLongitude;
      
      if (!deliveryLatitude || !deliveryLongitude) {
        return;
      }
      
      const latestLocation = await this.trackingRepository.getLatestLocation(orderId);
      if (!latestLocation) {
        return;
      }
      
      // Calculate distance to destination
      const distance = this.calculateHaversineDistance(
        { lat: latestLocation.latitude, lng: latestLocation.longitude },
        { lat: deliveryLatitude, lng: deliveryLongitude }
      );
      
      // Estimate time based on current speed or average speed
      const currentSpeed = latestLocation.speed || 30; // km/h
      const etaMinutes = (distance / currentSpeed) * 60;
      
      // Update order with ETA - you'll need to add this method to OrderRepository
      // For now, we'll just log it
      this.logger.info(`ETA for order ${orderId}: ${Math.round(etaMinutes)} minutes, distance: ${distance.toFixed(2)} km`);
      
      // Broadcast ETA update
      const connections = this.liveConnections.get(orderId);
      if (connections && connections.size > 0) {
        const event: LiveTrackingEvent = {
          type: 'eta_update',
          orderId,
          data: { etaMinutes: Math.round(etaMinutes), distance },
          timestamp: new Date()
        };
        
        for (const connectionId of connections) {
          try {
            await this.websocketUtil.sendToConnection(connectionId, 'tracking_update', event);
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to send ETA update to connection ${connectionId}:`, errorMessage);
          }
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to update ETA for order ${orderId}:`, errorMessage);
    }
  }

  private calculateTrackingSummary(locations: LocationTracking[]): TrackingData['summary'] {
    if (locations.length === 0) {
      throw new Error('No locations provided for summary calculation');
    }
    
    let totalDistance = 0;
    let totalSpeed = 0;
    let maxSpeed = 0;
    let speedCount = 0;
    
    for (let i = 0; i < locations.length - 1; i++) {
      const from = locations[i];
      const to = locations[i + 1];
      
      const distance = this.calculateHaversineDistance(
        { lat: from.latitude, lng: from.longitude },
        { lat: to.latitude, lng: to.longitude }
      );
      
      totalDistance += distance;
      
      if (from.speed) {
        totalSpeed += from.speed;
        maxSpeed = Math.max(maxSpeed, from.speed);
        speedCount++;
      }
    }
    
    const startTime = locations[0].timestamp;
    const endTime = locations[locations.length - 1].timestamp;
    const totalDuration = (endTime.getTime() - startTime.getTime()) / 1000 / 60; // minutes
    const averageSpeed = speedCount > 0 ? totalSpeed / speedCount : 0;
    
    return {
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalDuration: Math.round(totalDuration * 100) / 100,
      averageSpeed: Math.round(averageSpeed * 100) / 100,
      maxSpeed: Math.round(maxSpeed * 100) / 100,
      startTime,
      endTime
    };
  }

  private calculateHaversineDistance(
    point1: Coordinates,
    point2: Coordinates
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(point2.lat - point1.lat);
    const dLon = this.toRad(point2.lng - point1.lng);
    const lat1 = this.toRad(point1.lat);
    const lat2 = this.toRad(point2.lat);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private decodePolyline(encoded: string): Coordinates[] {
    const points: Coordinates[] = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }

    return points;
  }

  private calculateRouteDistance(points: Coordinates[]): number {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      total += this.calculateHaversineDistance(points[i], points[i + 1]);
    }
    return total;
  }

  private calculateBearing(
    point1: Coordinates,
    point2: Coordinates
  ): number {
    const lat1 = this.toRad(point1.lat);
    const lat2 = this.toRad(point2.lat);
    const dLon = this.toRad(point2.lng - point1.lng);
    
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    
    let bearing = Math.atan2(y, x);
    bearing = this.toDegrees(bearing);
    bearing = (bearing + 360) % 360;
    
    return Math.round(bearing);
  }

  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  private generateCSVReport(trackingData: TrackingData): string {
    let csv = 'Timestamp,Latitude,Longitude,Speed (km/h),Bearing\n';
    
    for (const location of trackingData.locations) {
      csv += `${location.timestamp.toISOString()},${location.latitude},${location.longitude},${location.speed || ''},${location.bearing || ''}\n`;
    }
    
    return csv;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const trackingService = new TrackingService(
  new WebSocketUtil(),
  new TrackingRepository(),
  new OrderRepository()
);