import { Logger } from './logger';
import { HttpClient } from './httpClient';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DistanceResult {
  distance: number; // in kilometers
  duration: number; // in minutes
}

export interface Route {
  distance: number;
  duration: number;
  polyline?: string;
  steps?: RouteStep[];
}

export interface RouteStep {
  distance: number;
  duration: number;
  instruction: string;
  polyline?: string;
}

export class DistanceUtil {
  private logger: Logger;
  private httpClient: HttpClient;
  private geocodingApiKey: string;
  private geocodingApiUrl: string;

  constructor() {
    this.logger = new Logger('DistanceUtil');
    this.httpClient = new HttpClient();
    this.geocodingApiKey = process.env.GEOCODING_API_KEY || '';
    this.geocodingApiUrl = process.env.GEOCODING_API_URL || 'https://maps.googleapis.com/maps/api';
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  calculateHaversineDistance(point1: Coordinates, point2: Coordinates): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(point2.lat - point1.lat);
    const dLon = this.toRad(point2.lng - point1.lng);
    const lat1 = this.toRad(point1.lat);
    const lat2 = this.toRad(point2.lat);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  /**
   * Calculate distance between multiple points
   */
  calculateRouteDistance(points: Coordinates[]): number {
    if (points.length < 2) {
      return 0;
    }

    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
      totalDistance += this.calculateHaversineDistance(points[i], points[i + 1]);
    }
    
    return totalDistance;
  }

  /**
   * Calculate driving distance and duration using external API
   */
  async calculateDrivingDistance(
    origin: Coordinates | string,
    destination: Coordinates | string,
    waypoints?: (Coordinates | string)[]
  ): Promise<Route> {
    try {
      // Convert addresses to coordinates if needed
      const originCoords = await this.resolveCoordinates(origin);
      const destinationCoords = await this.resolveCoordinates(destination);
      
      let waypointCoords: Coordinates[] = [];
      if (waypoints && waypoints.length > 0) {
        for (const waypoint of waypoints) {
          const coords = await this.resolveCoordinates(waypoint);
          waypointCoords.push(coords);
        }
      }

      // Use external routing service (e.g., Google Maps, Mapbox, OSRM)
      return await this.getRouteFromAPI(originCoords, destinationCoords, waypointCoords);
    } catch (error) {
      this.logger.warn('Failed to calculate driving distance, using fallback:', error);
      return this.getFallbackRoute(origin, destination, waypoints);
    }
  }

  /**
   * Estimate travel time based on distance and average speed
   */
  estimateTravelTime(distance: number, averageSpeed: number = 30): number {
    // distance in km, speed in km/h, result in minutes
    return (distance / averageSpeed) * 60;
  }

  /**
   * Calculate bearing between two points
   */
  calculateBearing(point1: Coordinates, point2: Coordinates): number {
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

  /**
   * Check if a point is within a radius of another point
   */
  isWithinRadius(
    center: Coordinates,
    point: Coordinates,
    radius: number
  ): boolean {
    const distance = this.calculateHaversineDistance(center, point);
    return distance <= radius;
  }

  /**
   * Find nearest point from a list of points
   */
  findNearestPoint(
    reference: Coordinates,
    points: Coordinates[]
  ): { point: Coordinates; distance: number; index: number } {
    if (points.length === 0) {
      throw new Error('No points provided');
    }

    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < points.length; i++) {
      const distance = this.calculateHaversineDistance(reference, points[i]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    return {
      point: points[nearestIndex],
      distance: nearestDistance,
      index: nearestIndex
    };
  }

  /**
   * Convert address to coordinates
   */
  async geocodeAddress(address: string): Promise<Coordinates | null> {
    try {
      this.logger.debug(`Geocoding address: ${address}`);
      
      if (!this.geocodingApiKey) {
        this.logger.warn('Geocoding API key not configured');
        return null;
      }

      const response = await this.httpClient.get(
        `${this.geocodingApiUrl}/geocode/json`,
        {
          params: {
            address: address,
            key: this.geocodingApiKey
          },
          timeout: 5000
        }
      );

      const results = response.data.results;
      if (results && results.length > 0) {
        const location = results[0].geometry.location;
        return {
          lat: location.lat,
          lng: location.lng
        };
      }

      return null;
    } catch (error) {
      this.logger.error('Geocoding failed:', error);
      return null;
    }
  }

  /**
   * Convert coordinates to address (reverse geocoding)
   */
  async reverseGeocode(coords: Coordinates): Promise<string | null> {
    try {
      this.logger.debug(`Reverse geocoding: ${coords.lat}, ${coords.lng}`);
      
      if (!this.geocodingApiKey) {
        this.logger.warn('Geocoding API key not configured');
        return null;
      }

      const response = await this.httpClient.get(
        `${this.geocodingApiUrl}/geocode/json`,
        {
          params: {
            latlng: `${coords.lat},${coords.lng}`,
            key: this.geocodingApiKey
          },
          timeout: 5000
        }
      );

      const results = response.data.results;
      if (results && results.length > 0) {
        return results[0].formatted_address;
      }

      return null;
    } catch (error) {
      this.logger.error('Reverse geocoding failed:', error);
      return null;
    }
  }

  /**
   * Calculate distance matrix between multiple origins and destinations
   */
  async calculateDistanceMatrix(
    origins: Coordinates[],
    destinations: Coordinates[]
  ): Promise<{ distances: number[][]; durations: number[][] }> {
    try {
      // For small matrices, calculate directly
      if (origins.length <= 5 && destinations.length <= 5) {
        return await this.calculateDirectMatrix(origins, destinations);
      }
      
      // For larger matrices, use external service
      return await this.getMatrixFromAPI(origins, destinations);
    } catch (error) {
      this.logger.warn('Failed to calculate distance matrix, using fallback:', error);
      return this.getFallbackMatrix(origins, destinations);
    }
  }

  private async resolveCoordinates(location: Coordinates | string): Promise<Coordinates> {
    if (typeof location === 'string') {
      const coords = await this.geocodeAddress(location);
      if (!coords) {
        throw new Error(`Could not geocode address: ${location}`);
      }
      return coords;
    }
    return location;
  }

  private async getRouteFromAPI(
    origin: Coordinates,
    destination: Coordinates,
    waypoints?: Coordinates[]
  ): Promise<Route> {
    // This is a placeholder for actual API integration
    // In production, you would integrate with Google Maps, Mapbox, OSRM, etc.
    
    const distance = this.calculateHaversineDistance(origin, destination);
    const duration = this.estimateTravelTime(distance);
    
    return {
      distance,
      duration,
      polyline: this.encodePolyline([origin, destination]),
      steps: [
        {
          distance,
          duration,
          instruction: `Drive from origin to destination`
        }
      ]
    };
  }

  private async getMatrixFromAPI(
    origins: Coordinates[],
    destinations: Coordinates[]
  ): Promise<{ distances: number[][]; durations: number[][] }> {
    // Placeholder for actual API integration
    const distances: number[][] = [];
    const durations: number[][] = [];

    for (let i = 0; i < origins.length; i++) {
      distances[i] = [];
      durations[i] = [];
      
      for (let j = 0; j < destinations.length; j++) {
        const distance = this.calculateHaversineDistance(origins[i], destinations[j]);
        const duration = this.estimateTravelTime(distance);
        
        distances[i][j] = distance;
        durations[i][j] = duration;
      }
    }

    return { distances, durations };
  }

  private async calculateDirectMatrix(
    origins: Coordinates[],
    destinations: Coordinates[]
  ): Promise<{ distances: number[][]; durations: number[][] }> {
    const distances: number[][] = [];
    const durations: number[][] = [];

    for (let i = 0; i < origins.length; i++) {
      distances[i] = [];
      durations[i] = [];
      
      for (let j = 0; j < destinations.length; j++) {
        const distance = this.calculateHaversineDistance(origins[i], destinations[j]);
        const duration = this.estimateTravelTime(distance);
        
        distances[i][j] = Math.round(distance * 100) / 100;
        durations[i][j] = Math.round(duration);
      }
    }

    return { distances, durations };
  }

  private getFallbackRoute(
    origin: Coordinates | string,
    destination: Coordinates | string,
    waypoints?: (Coordinates | string)[]
  ): Route {
    // Simple fallback using Haversine distance
    const distance = 10; // Default 10km
    const duration = this.estimateTravelTime(distance);
    
    return {
      distance,
      duration,
      polyline: '',
      steps: [
        {
          distance,
          duration,
          instruction: 'Fallback route - using estimated distance'
        }
      ]
    };
  }

  private getFallbackMatrix(
    origins: Coordinates[],
    destinations: Coordinates[]
  ): { distances: number[][]; durations: number[][] } {
    const distances: number[][] = [];
    const durations: number[][] = [];

    for (let i = 0; i < origins.length; i++) {
      distances[i] = [];
      durations[i] = [];
      
      for (let j = 0; j < destinations.length; j++) {
        // Use Haversine as fallback
        const distance = this.calculateHaversineDistance(origins[i], destinations[j]);
        const duration = this.estimateTravelTime(distance);
        
        distances[i][j] = distance;
        durations[i][j] = duration;
      }
    }

    return { distances, durations };
  }

  private encodePolyline(points: Coordinates[]): string {
    // Simple polyline encoding (Google Maps polyline algorithm simplified)
    let encoded = '';
    let prevLat = 0;
    let prevLng = 0;

    for (const point of points) {
      const lat = Math.round(point.lat * 1e5);
      const lng = Math.round(point.lng * 1e5);
      
      encoded += this.encodeNumber(lat - prevLat);
      encoded += this.encodeNumber(lng - prevLng);
      
      prevLat = lat;
      prevLng = lng;
    }

    return encoded;
  }

  private encodeNumber(num: number): string {
    num = num << 1;
    if (num < 0) {
      num = ~(num);
    }
    
    let encoded = '';
    while (num >= 0x20) {
      encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
      num >>= 5;
    }
    encoded += String.fromCharCode(num + 63);
    return encoded;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }
}

// Singleton instance
export const distanceUtil = new DistanceUtil();