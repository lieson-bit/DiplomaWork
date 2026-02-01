import { Logger } from '../utils/logger'; // Changed from 'logger' to 'Logger'

export interface RoutePoint {
  lat: number;
  lng: number;
  timestamp?: Date;
}

export interface RouteCalculation {
  distance: number; // in kilometers
  duration: number; // in minutes
  polyline: string; // encoded route
  steps: RoutePoint[];
  trafficFactor: number;
  estimatedFuelCost: number;
}

export interface DriverSimulation {
  driverId: string;
  currentLocation: RoutePoint;
  assignedAddress?: string;
  speed: number; // km/h
  status: 'available' | 'busy' | 'offline';
  lastUpdated: Date;
}

class RoutesConfig {
  private driverSimulations: Map<string, DriverSimulation> = new Map();
  private logger: Logger; // Add logger instance
  
  // Earth's radius in kilometers
  private static readonly EARTH_RADIUS_KM = 6371;
  
  // Traffic factors based on time of day
  private static readonly TRAFFIC_FACTORS = {
    morningRush: { start: 7, end: 9, factor: 1.5 },
    eveningRush: { start: 16, end: 19, factor: 1.7 },
    night: { start: 22, end: 5, factor: 0.9 },
    normal: { factor: 1.1 }
  };
  
  // Speed limits based on area type
  private static readonly SPEED_LIMITS = {
    highway: 80, // km/h
    city: 40,    // km/h
    residential: 25, // km/h
    default: 30  // km/h
  };

  constructor() {
    this.logger = new Logger('RoutesConfig'); // Initialize logger
    this.initializeDriverSimulations();
    this.logger.info('Routes configuration initialized');
  }

  private initializeDriverSimulations() {
    // Simulate 10 drivers with random locations in a city
    const cityCenter = { lat: 40.7128, lng: -74.0060 }; // NYC
    const radius = 0.05; // ~5km radius
    
    for (let i = 1; i <= 10; i++) {
      const driverId = `driver-${i}`;
      const randomOffset = {
        lat: (Math.random() - 0.5) * radius,
        lng: (Math.random() - 0.5) * radius
      };
      
      this.driverSimulations.set(driverId, {
        driverId,
        currentLocation: {
          lat: cityCenter.lat + randomOffset.lat,
          lng: cityCenter.lng + randomOffset.lng
        },
        speed: 30 + Math.random() * 20, // 30-50 km/h
        status: Math.random() > 0.3 ? 'available' : 'busy',
        lastUpdated: new Date()
      });
    }
    
    this.logger.debug(`Initialized ${this.driverSimulations.size} driver simulations`);
  }

  // Calculate distance between two points using Haversine formula
  calculateDistance(point1: RoutePoint, point2: RoutePoint): number {
    const lat1 = this.toRadians(point1.lat);
    const lat2 = this.toRadians(point2.lat);
    const deltaLat = this.toRadians(point2.lat - point1.lat);
    const deltaLng = this.toRadians(point2.lng - point1.lng);

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return RoutesConfig.EARTH_RADIUS_KM * c;
  }

  // Calculate optimal route between pickup and delivery
  async calculateRoute(
    pickup: RoutePoint,
    delivery: RoutePoint
  ): Promise<RouteCalculation> {
    try {
      // 1. Calculate direct distance
      const directDistance = this.calculateDistance(pickup, delivery);
      
      // 2. Apply road network factor (typically 1.3x for actual road distance)
      const roadDistance = directDistance * 1.3;
      
      // 3. Get current traffic factor
      const trafficFactor = this.getTrafficFactor();
      
      // 4. Calculate base duration based on average speed
      const averageSpeed = this.getAverageSpeed(pickup, delivery);
      const baseDuration = (roadDistance / averageSpeed) * 60; // Convert to minutes
      
      // 5. Apply traffic factor to duration
      const estimatedDuration = baseDuration * trafficFactor;
      
      // 6. Generate simplified polyline
      const polyline = this.encodePolyline([pickup, delivery]);
      
      // 7. Estimate fuel cost (assuming 10km per liter, $1.2 per liter)
      const estimatedFuelCost = (roadDistance / 10) * 1.2;
      
      return {
        distance: parseFloat(roadDistance.toFixed(2)),
        duration: Math.ceil(estimatedDuration),
        polyline,
        steps: [pickup, delivery],
        trafficFactor,
        estimatedFuelCost: parseFloat(estimatedFuelCost.toFixed(2))
      };
      
    } catch (error: any) {
      this.logger.error('Route calculation failed:', error);
      throw new Error(`Failed to calculate route: ${error.message}`);
    }
  }

  // Find nearest available drivers
  async findNearestDrivers(
    location: RoutePoint,
    maxDistance: number = 10, // km
    limit: number = 5
  ): Promise<DriverSimulation[]> {
    const drivers: Array<DriverSimulation & { distance: number }> = [];
    
    for (const driver of this.driverSimulations.values()) {
      if (driver.status !== 'available') continue;
      
      const distance = this.calculateDistance(location, driver.currentLocation);
      
      if (distance <= maxDistance) {
        drivers.push({
          ...driver,
          distance: parseFloat(distance.toFixed(2))
        });
      }
    }
    
    // Sort by distance and limit results
    return drivers
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  // Simulate driver movement towards destination
  simulateDriverMovement(
    driverId: string,
    destination: RoutePoint,
    intervalMinutes: number = 1
  ): RoutePoint | null {
    const driver = this.driverSimulations.get(driverId);
    if (!driver || driver.status !== 'busy') {
      return null;
    }
    
    // Calculate distance traveled in this interval
    const distancePerInterval = (driver.speed * intervalMinutes) / 60; // km
    
    // Calculate bearing from current to destination
    const bearing = this.calculateBearing(driver.currentLocation, destination);
    
    // Calculate new position
    const newLocation = this.calculateDestination(
      driver.currentLocation,
      bearing,
      distancePerInterval
    );
    
    // Update driver simulation
    driver.currentLocation = newLocation;
    driver.lastUpdated = new Date();
    
    // Check if arrived (within 100m)
    const remainingDistance = this.calculateDistance(newLocation, destination);
    if (remainingDistance < 0.1) { // 100 meters
      driver.status = 'available';
      this.logger.debug(`Driver ${driverId} arrived at destination`);
    }
    
    return newLocation;
  }

  // Update driver simulation status
  updateDriverStatus(driverId: string, status: 'available' | 'busy' | 'offline'): boolean {
    const driver = this.driverSimulations.get(driverId);
    if (!driver) return false;
    
    driver.status = status;
    driver.lastUpdated = new Date();
    
    if (status === 'busy') {
      // Assign a random destination within 10km when driver becomes busy
      const randomBearing = Math.random() * 360;
      const randomDistance = 5 + Math.random() * 5; // 5-10km
      driver.assignedAddress = `Simulated destination ${Math.floor(Math.random() * 1000)}`;
      driver.currentLocation = this.calculateDestination(
        driver.currentLocation,
        randomBearing,
        randomDistance
      );
    }
    
    return true;
  }

  // Get all driver simulations
  getAllDriverSimulations(): DriverSimulation[] {
    return Array.from(this.driverSimulations.values());
  }

  // Helper methods
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  private getTrafficFactor(): number {
    const hour = new Date().getHours();
    
    if (hour >= RoutesConfig.TRAFFIC_FACTORS.morningRush.start && 
        hour < RoutesConfig.TRAFFIC_FACTORS.morningRush.end) {
      return RoutesConfig.TRAFFIC_FACTORS.morningRush.factor;
    }
    
    if (hour >= RoutesConfig.TRAFFIC_FACTORS.eveningRush.start && 
        hour < RoutesConfig.TRAFFIC_FACTORS.eveningRush.end) {
      return RoutesConfig.TRAFFIC_FACTORS.eveningRush.factor;
    }
    
    if (hour >= RoutesConfig.TRAFFIC_FACTORS.night.start || 
        hour < RoutesConfig.TRAFFIC_FACTORS.night.end) {
      return RoutesConfig.TRAFFIC_FACTORS.night.factor;
    }
    
    return RoutesConfig.TRAFFIC_FACTORS.normal.factor;
  }

  private getAverageSpeed(start: RoutePoint, end: RoutePoint): number {
    // Simple heuristic: assume mixed city/highway driving
    const distance = this.calculateDistance(start, end);
    
    if (distance > 20) {
      return RoutesConfig.SPEED_LIMITS.highway; // Long distance, mostly highway
    } else if (distance > 5) {
      return RoutesConfig.SPEED_LIMITS.city; // Medium distance, mixed
    } else {
      return RoutesConfig.SPEED_LIMITS.residential; // Short distance, local
    }
  }

  private encodePolyline(points: RoutePoint[]): string {
    // Simple encoding for MVP
    return points.map(p => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|');
  }

  private calculateBearing(start: RoutePoint, end: RoutePoint): number {
    const lat1 = this.toRadians(start.lat);
    const lat2 = this.toRadians(end.lat);
    const deltaLng = this.toRadians(end.lng - start.lng);

    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
    
    const bearing = Math.atan2(y, x);
    return (this.toDegrees(bearing) + 360) % 360;
  }

  private calculateDestination(start: RoutePoint, bearing: number, distance: number): RoutePoint {
    const angularDistance = distance / RoutesConfig.EARTH_RADIUS_KM;
    const bearingRad = this.toRadians(bearing);
    const lat1 = this.toRadians(start.lat);
    const lng1 = this.toRadians(start.lng);
    
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad)
    );
    
    const lng2 = lng1 + Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );
    
    return {
      lat: parseFloat(this.toDegrees(lat2).toFixed(6)),
      lng: parseFloat(this.toDegrees(lng2).toFixed(6))
    };
  }

  // Generate route steps for simulation
  generateRouteSteps(start: RoutePoint, end: RoutePoint, steps: number = 10): RoutePoint[] {
    const routeSteps: RoutePoint[] = [start];
    const totalDistance = this.calculateDistance(start, end);
    const bearing = this.calculateBearing(start, end);
    
    for (let i = 1; i < steps; i++) {
      const distance = (totalDistance / steps) * i;
      const point = this.calculateDestination(start, bearing, distance);
      routeSteps.push(point);
    }
    
    routeSteps.push(end);
    return routeSteps;
  }
}

// Create singleton instance
export const routesConfig = new RoutesConfig();

// Export for direct use
export default routesConfig;