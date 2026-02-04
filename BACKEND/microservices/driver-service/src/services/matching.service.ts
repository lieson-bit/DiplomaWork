import { logger } from '../utils/logger';
import { driverService } from './driver.service';
import { locationService, DistanceMatrixResponse } from './location.service';

export interface OrderRequirements {
  pickupAddress: string;
  pickupCoords?: { lat: number; lng: number };
  dropoffAddress?: string;
  dropoffCoords?: { lat: number; lng: number };
  weight: number;
  volume: number;
  vehicleType?: 'motorbike' | 'small_van' | 'medium_truck' | 'large_truck';
  urgency?: 'normal' | 'urgent' | 'express';
  maxDistance?: number; // in km
}

export interface VehicleInfo {
  id: string;
  type: 'motorbike' | 'small_van' | 'medium_truck' | 'large_truck';
  make: string;
  model: string;
  imageUrl?: string;
  maxWeight: number;
  maxVolume: number;
  licensePlate: string;
  color: string;
  status?: string;
  year?: number;
}

export interface DriverInfo {
  driverId: string;
  userId: string;
  rating: number;
  totalDeliveries: number;
  completionRate: number;
  verificationLevel: string;
  isOnline: boolean;
  currentLocation: string;
  profileCompleted: boolean;
  user: {
    firstName: string;
    lastName: string;
    phone: string;
  };
  vehicles: Array<{
    id: string;
    type: 'motorbike' | 'small_van' | 'medium_truck' | 'large_truck';
    make: string;
    model: string;
    year: number;
    color: string;
    licensePlate: string;
    maxWeight: number;
    maxVolume: number;
    imageUrl?: string;
    status: string;
  }>;
}

export interface MatchedDriver extends DriverInfo {
  distanceInfo?: {
    distance: {
      text: string;
      value: number; // meters
    };
    duration: {
      text: string;
      value: number; // seconds
    };
  };
  matchScore: number;
  suitability: 'excellent' | 'good' | 'fair' | 'poor';
  estimatedArrival: string; // Formatted arrival time
}

export class MatchingService {
  async findMatchingDrivers(order: OrderRequirements): Promise<MatchedDriver[]> {
    try {
      // Step 1: Get available drivers based on capacity
      const drivers = await driverService.discoverAvailableDrivers({
        estimatedWeight: order.weight,
        estimatedVolume: order.volume,
        vehicleType: order.vehicleType,
        limit: 50 // Get more drivers initially for filtering
      });

      if (drivers.length === 0) {
        return [];
      }

      // Step 2: Get distances and times for all drivers
      const distances = await locationService.getDistancesForDrivers(
        order.pickupAddress,
        drivers.map(d => ({
          driverId: d.driverId,
          currentLocation: d.currentLocation
        }))
      );

      // Step 3: Filter drivers by max distance if specified
      let filteredDrivers = drivers;
      if (order.maxDistance) {
        filteredDrivers = drivers.filter(driver => {
          const distanceInfo = distances.get(driver.driverId);
          if (!distanceInfo) return false;
          
          const distanceKm = distanceInfo.distance.value / 1000;
          return distanceKm <= order.maxDistance!;
        });
      }

      // Step 4: Apply matching algorithm with distance scoring
      const scoredDrivers = filteredDrivers.map(driver => {
        const distanceInfo = distances.get(driver.driverId);
        const primaryVehicle = driver.vehicles[0];
        
        let score = this.calculateBaseScore(driver);
        
        // Distance score (closer is better)
        if (distanceInfo) {
          const distanceScore = this.calculateDistanceScore(distanceInfo);
          score = (score * 0.4) + (distanceScore * 0.6);
        }

        // Vehicle suitability score
        const vehicleScore = this.calculateVehicleSuitability(primaryVehicle, order);
        score = (score * 0.5) + (vehicleScore * 0.5);

        // Urgency factor
        if (order.urgency === 'express') {
          // Prioritize closer drivers more heavily for express orders
          score = distanceInfo ? (score * 0.3) + (this.calculateDistanceScore(distanceInfo) * 0.7) : score;
        }

        return {
          ...driver,
          distanceInfo,
          matchScore: Math.round(score),
          suitability: this.getSuitabilityLevel(score),
          estimatedArrival: this.formatEstimatedArrival(distanceInfo?.duration.value)
        };
      });

      // Step 5: Sort by match score (highest first)
      return scoredDrivers.sort((a, b) => b.matchScore - a.matchScore);

    } catch (error: any) {
      logger.error('Matching service error:', error);
      throw new Error('Failed to find matching drivers');
    }
  }

  private calculateBaseScore(driver: DriverInfo): number {
    let score = 100;

    // Rating score (higher rating is better)
    const ratingScore = driver.rating * 20; // Convert 0-5 to 0-100
    score = (score * 0.6) + (ratingScore * 0.4);

    // Completion rate score
    const completionScore = driver.completionRate * 100;
    score = (score * 0.7) + (completionScore * 0.3);

    // Experience score (more deliveries is better, but capped)
    const experienceScore = Math.min(100, driver.totalDeliveries / 100);
    score = (score * 0.8) + (experienceScore * 0.2);

    // Verification level bonus
    const verificationBonus = driver.verificationLevel === 'premium' ? 10 : 0;
    score += verificationBonus;

    return Math.min(100, score);
  }

  private calculateDistanceScore(distanceInfo: DistanceMatrixResponse): number {
    const distanceKm = distanceInfo.distance.value / 1000;
    const durationMins = distanceInfo.duration.value / 60;
    
    // Score based on distance and time
    // Closer distances get higher scores
    const distanceScore = Math.max(0, 100 - (distanceKm * 5)); // Lose 5 points per km
    const timeScore = Math.max(0, 100 - (durationMins * 2)); // Lose 2 points per minute
    
    return (distanceScore * 0.6) + (timeScore * 0.4);
  }

  private calculateVehicleSuitability(
    vehicle: VehicleInfo | undefined, 
    order: OrderRequirements
  ): number {
    if (!vehicle) return 0;
    
    let score = 100;

    // Weight capacity score
    const weightUtilization = order.weight / vehicle.maxWeight;
    if (weightUtilization > 1) return 0; // Cannot carry
    
    const weightScore = 100 - (weightUtilization * 50);
    score = (score * 0.4) + (weightScore * 0.6);

    // Volume capacity score
    const volumeUtilization = order.volume / vehicle.maxVolume;
    if (volumeUtilization > 1) return 0; // Cannot fit
    
    const volumeScore = 100 - (volumeUtilization * 50);
    score = (score * 0.4) + (volumeScore * 0.6);

    // Vehicle type preference - FIXED TYPE
    const typeScores: Record<'motorbike' | 'small_van' | 'medium_truck' | 'large_truck', number> = {
      'motorbike': order.weight < 10 && order.volume < 0.5 ? 100 : 70,
      'small_van': order.weight < 100 && order.volume < 5 ? 100 : 85,
      'medium_truck': order.weight < 500 && order.volume < 20 ? 100 : 90,
      'large_truck': 100
    };
    
    const typeScore = typeScores[vehicle.type] || 75;
    score = (score * 0.5) + (typeScore * 0.5);

    return score;
  }

  private getSuitabilityLevel(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    return 'poor';
  }

  private formatEstimatedArrival(durationSeconds?: number): string {
    if (!durationSeconds) return 'N/A';
    
    const minutes = Math.ceil(durationSeconds / 60);
    
    if (minutes < 60) {
      return `${minutes} min${minutes !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
  }
}

export const matchingService = new MatchingService();