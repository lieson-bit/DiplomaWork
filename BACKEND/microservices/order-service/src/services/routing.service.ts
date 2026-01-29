import { Logger } from '../utils/logger';
import { DistanceUtil } from '../utils/distance.util';
import { HttpClient } from '../utils/httpClient';

export interface RoutePoint {
  lat: number;
  lng: number;
  address?: string;
  orderId?: string;
  type: 'pickup' | 'delivery' | 'depot';
  timeWindow?: {
    start: Date;
    end: Date;
  };
  serviceTime?: number; // minutes required at this stop
}

export interface RouteOptimizationRequest {
  depot: {
    lat: number;
    lng: number;
  };
  points: RoutePoint[];
  vehicleCapacity?: {
    weight: number;
    volume: number;
    maxStops: number;
  };
  constraints?: {
    maxRouteDuration?: number;
    maxRouteDistance?: number;
    timeWindows?: boolean;
  };
}

export interface RouteOptimizationResult {
  routes: Route[];
  totalDistance: number;
  totalDuration: number;
  totalStops: number;
  unassignedPoints: RoutePoint[];
  optimizationTime: number;
}

export interface Route {
  routeId: string;
  vehicleId?: string;
  points: RoutePoint[];
  sequence: number[];
  distance: number;
  duration: number;
  polyline?: string;
  summary: {
    totalWeight: number;
    totalVolume: number;
    startTime: Date;
    endTime: Date;
    waitTime: number;
    serviceTime: number;
    travelTime: number;
  };
}

export interface DirectionsResponse {
  routes: Array<{
    distance: number;
    duration: number;
    geometry: string; // polyline
    legs: Array<{
      distance: number;
      duration: number;
      steps: any[];
    }>;
  }>;
}

export class RoutingService {
  private logger = new Logger('RoutingService');
  private distanceUtil: DistanceUtil;
  private httpClient: HttpClient;
  private routingApiKey: string;
  private routingApiUrl: string;

  constructor(distanceUtil: DistanceUtil, httpClient: HttpClient) {
    this.distanceUtil = distanceUtil;
    this.httpClient = httpClient;
    this.routingApiKey = process.env.ROUTING_API_KEY || '';
    this.routingApiUrl = process.env.ROUTING_API_URL || 'https://api.routing-service.com';
  }

  async optimizeRoutes(request: RouteOptimizationRequest): Promise<RouteOptimizationResult> {
    try {
      this.logger.info(`Optimizing routes for ${request.points.length} points`);

      const startTime = Date.now();

      // For small number of points, use simple algorithm
      if (request.points.length <= 10) {
        return await this.optimizeSimpleRoutes(request);
      }

      // For larger problems, use external routing service or more complex algorithm
      return await this.optimizeWithExternalService(request);
    } catch (error) {
      this.logger.error('Route optimization failed:', error);
      // Fall back to simple optimization
      return await this.optimizeSimpleRoutes(request);
    }
  }

  async getDirections(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    waypoints?: Array<{ lat: number; lng: number }>
  ): Promise<DirectionsResponse> {
    try {
      const url = `${this.routingApiUrl}/v1/directions`;
      
      const params: any = {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode: 'driving',
        alternatives: false,
        optimize: waypoints ? true : false
      };

      if (waypoints && waypoints.length > 0) {
        params.waypoints = waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|');
      }

      const response = await this.httpClient.request({
        url,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.routingApiKey}`
        },
        params
      });

      return response.data;
    } catch (error) {
      this.logger.warn('Failed to get directions from external service, using fallback:', error);
      return this.getFallbackDirections(origin, destination, waypoints);
    }
  }

  async calculateRouteMatrix(
    origins: Array<{ lat: number; lng: number }>,
    destinations: Array<{ lat: number; lng: number }>
  ): Promise<{ distances: number[][]; durations: number[][] }> {
    try {
      // Use distance matrix API for multiple points
      if (origins.length * destinations.length <= 100) {
        // Small matrix, calculate directly
        return await this.calculateDirectMatrix(origins, destinations);
      } else {
        // Large matrix, use batching
        return await this.calculateBatchedMatrix(origins, destinations);
      }
    } catch (error) {
      this.logger.error('Failed to calculate route matrix:', error);
      throw error;
    }
  }

  decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
    const points = [];
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

  encodePolyline(points: Array<{ lat: number; lng: number }>): string {
    let encoded = '';
    let prevLat = 0, prevLng = 0;

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

  private async optimizeSimpleRoutes(request: RouteOptimizationRequest): Promise<RouteOptimizationResult> {
    // Simple clustering algorithm for route optimization
    const points = request.points;
    const depot = request.depot;
    
    // Cluster points by geographic proximity
    const clusters = this.clusterPoints(points, request.vehicleCapacity?.maxStops || 10);
    
    const routes: Route[] = [];
    const unassignedPoints: RoutePoint[] = [];
    
    for (let i = 0; i < clusters.length; i++) {
      const clusterPoints = clusters[i];
      
      // Sort points in cluster for efficient routing (nearest neighbor)
      const sortedPoints = this.sortPointsForRoute([depot, ...clusterPoints]);
      
      // Remove depot from points list
      const routePoints = sortedPoints.slice(1);
      
      // Calculate route metrics
      const { distance, duration, polyline } = await this.calculateRouteMetrics([depot, ...routePoints, depot]);
      
      routes.push({
        routeId: `route_${i + 1}`,
        points: routePoints,
        sequence: routePoints.map((_, idx) => idx),
        distance,
        duration,
        polyline,
        summary: {
          totalWeight: this.calculateTotalWeight(routePoints),
          totalVolume: this.calculateTotalVolume(routePoints),
          startTime: new Date(),
          endTime: new Date(Date.now() + duration * 60000),
          waitTime: 0,
          serviceTime: this.calculateTotalServiceTime(routePoints),
          travelTime: duration
        }
      });
    }
    
    const totalDistance = routes.reduce((sum, route) => sum + route.distance, 0);
    const totalDuration = routes.reduce((sum, route) => sum + route.duration, 0);
    const totalStops = routes.reduce((sum, route) => sum + route.points.length, 0);
    
    return {
      routes,
      totalDistance,
      totalDuration,
      totalStops,
      unassignedPoints,
      optimizationTime: Date.now() - startTime
    };
  }

  private async optimizeWithExternalService(request: RouteOptimizationRequest): Promise<RouteOptimizationResult> {
    // Call external routing optimization service
    const url = `${this.routingApiUrl}/v1/optimize`;
    
    const payload = {
      vehicles: [{
        id: 'vehicle_1',
        start: request.depot,
        end: request.depot,
        capacity: request.vehicleCapacity
      }],
      jobs: request.points.map((point, index) => ({
        id: `job_${index}`,
        location: point,
        service: point.serviceTime || 5, // default 5 minutes service time
        skills: point.type === 'pickup' ? ['pickup'] : ['delivery'],
        time_windows: point.timeWindow ? [[
          Math.floor(point.timeWindow.start.getTime() / 1000),
          Math.floor(point.timeWindow.end.getTime() / 1000)
        ]] : undefined
      })),
      options: {
        g: true // return geometry
      }
    };
    
    try {
      const response = await this.httpClient.request({
        url,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.routingApiKey}`,
          'Content-Type': 'application/json'
        },
        data: payload
      });
      
      return this.parseExternalResponse(response.data, request);
    } catch (error) {
      this.logger.error('External routing service failed:', error);
      throw error;
    }
  }

  private clusterPoints(points: RoutePoint[], maxPerCluster: number): RoutePoint[][] {
    // Simple k-means clustering
    const clusters: RoutePoint[][] = [];
    
    // Sort points by distance from depot
    const sortedPoints = [...points].sort((a, b) => {
      const distA = this.distanceUtil.calculateHaversineDistance(a, a); // Simplified
      const distB = this.distanceUtil.calculateHaversineDistance(b, b);
      return distA - distB;
    });
    
    // Create clusters
    for (let i = 0; i < sortedPoints.length; i += maxPerCluster) {
      clusters.push(sortedPoints.slice(i, i + maxPerCluster));
    }
    
    return clusters;
  }

  private sortPointsForRoute(points: RoutePoint[]): RoutePoint[] {
    // Nearest neighbor algorithm
    const sorted: RoutePoint[] = [];
    const remaining = [...points];
    
    // Start with depot
    let current = remaining.shift()!;
    sorted.push(current);
    
    while (remaining.length > 0) {
      // Find nearest point to current
      let nearestIndex = 0;
      let nearestDistance = Infinity;
      
      for (let i = 0; i < remaining.length; i++) {
        const distance = this.distanceUtil.calculateHaversineDistance(current, remaining[i]);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }
      
      current = remaining.splice(nearestIndex, 1)[0];
      sorted.push(current);
    }
    
    return sorted;
  }

  private async calculateRouteMetrics(points: RoutePoint[]): Promise<{ distance: number; duration: number; polyline: string }> {
    let totalDistance = 0;
    let totalDuration = 0;
    const routePoints: Array<{ lat: number; lng: number }> = [];
    
    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i];
      const to = points[i + 1];
      
      const distance = this.distanceUtil.calculateHaversineDistance(from, to);
      const duration = distance * 2; // Assume 30 km/h average speed
      
      totalDistance += distance;
      totalDuration += duration;
      
      // Add points for polyline (simplified - just start and end)
      if (i === 0) routePoints.push(from);
      routePoints.push(to);
    }
    
    // Add service time at each point (except start and end depot)
    for (let i = 1; i < points.length - 1; i++) {
      totalDuration += points[i].serviceTime || 5;
    }
    
    const polyline = this.encodePolyline(routePoints);
    
    return { distance: totalDistance, duration: totalDuration, polyline };
  }

  private calculateTotalWeight(points: RoutePoint[]): number {
    // In a real implementation, this would sum weights from orders
    return points.length * 5; // Assume 5kg average per stop
  }

  private calculateTotalVolume(points: RoutePoint[]): number {
    // In a real implementation, this would sum volumes from orders
    return points.length * 0.1; // Assume 0.1m³ average per stop
  }

  private calculateTotalServiceTime(points: RoutePoint[]): number {
    return points.reduce((sum, point) => sum + (point.serviceTime || 5), 0);
  }

  private async calculateDirectMatrix(
    origins: Array<{ lat: number; lng: number }>,
    destinations: Array<{ lat: number; lng: number }>
  ): Promise<{ distances: number[][]; durations: number[][] }> {
    const distances: number[][] = [];
    const durations: number[][] = [];
    
    for (let i = 0; i < origins.length; i++) {
      distances[i] = [];
      durations[i] = [];
      
      for (let j = 0; j < destinations.length; j++) {
        const distance = this.distanceUtil.calculateHaversineDistance(origins[i], destinations[j]);
        const duration = distance * 2; // 30 km/h average
        
        distances[i][j] = distance;
        durations[i][j] = duration;
      }
    }
    
    return { distances, durations };
  }

  private async calculateBatchedMatrix(
    origins: Array<{ lat: number; lng: number }>,
    destinations: Array<{ lat: number; lng: number }>
  ): Promise<{ distances: number[][]; durations: number[][] }> {
    // Batch calculation for large matrices
    const batchSize = 10;
    const distances: number[][] = Array(origins.length).fill(0).map(() => []);
    const durations: number[][] = Array(origins.length).fill(0).map(() => []);
    
    for (let i = 0; i < origins.length; i += batchSize) {
      for (let j = 0; j < destinations.length; j += batchSize) {
        const originBatch = origins.slice(i, i + batchSize);
        const destBatch = destinations.slice(j, j + batchSize);
        
        const batchResult = await this.calculateDirectMatrix(originBatch, destBatch);
        
        // Copy results to main matrices
        for (let oi = 0; oi < originBatch.length; oi++) {
          for (let dj = 0; dj < destBatch.length; dj++) {
            distances[i + oi][j + dj] = batchResult.distances[oi][dj];
            durations[i + oi][j + dj] = batchResult.durations[oi][dj];
          }
        }
      }
    }
    
    return { distances, durations };
  }

  private getFallbackDirections(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    waypoints?: Array<{ lat: number; lng: number }>
  ): DirectionsResponse {
    const points = [origin, ...(waypoints || []), destination];
    const distance = this.calculateTotalDistance(points);
    const duration = distance * 2; // 30 km/h average
    
    return {
      routes: [{
        distance,
        duration,
        geometry: this.encodePolyline(points),
        legs: [{
          distance,
          duration,
          steps: []
        }]
      }]
    };
  }

  private calculateTotalDistance(points: Array<{ lat: number; lng: number }>): number {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      total += this.distanceUtil.calculateHaversineDistance(points[i], points[i + 1]);
    }
    return total;
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

  private parseExternalResponse(data: any, request: RouteOptimizationRequest): RouteOptimizationResult {
    // Parse response from external routing service
    const routes: Route[] = [];
    
    if (data.routes) {
      data.routes.forEach((route: any, index: number) => {
        const routePoints: RoutePoint[] = [];
        
        route.steps.forEach((step: any) => {
          if (step.type === 'job') {
            const jobId = step.job;
            const originalPoint = request.points.find(p => p.orderId === jobId);
            if (originalPoint) {
              routePoints.push(originalPoint);
            }
          }
        });
        
        routes.push({
          routeId: `route_${index + 1}`,
          vehicleId: route.vehicle,
          points: routePoints,
          sequence: route.steps.map((_: any, idx: number) => idx),
          distance: route.distance,
          duration: route.duration,
          polyline: route.geometry,
          summary: {
            totalWeight: 0, // Would need to be calculated
            totalVolume: 0,
            startTime: new Date(route.start),
            endTime: new Date(route.end),
            waitTime: route.waiting_time || 0,
            serviceTime: route.service || 0,
            travelTime: route.driving_time || 0
          }
        });
      });
    }
    
    return {
      routes,
      totalDistance: data.total_distance || 0,
      totalDuration: data.total_duration || 0,
      totalStops: data.total_stops || 0,
      unassignedPoints: [],
      optimizationTime: data.optimization_time || 0
    };
  }
}