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
  user?: { 
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
        logger.info('🚗 Starting driver matching process');
        logger.info('Order requirements:', {
          pickupAddress: order.pickupAddress,
          weight: order.weight,
          volume: order.volume,
          vehicleType: order.vehicleType,
          maxDistance: order.maxDistance
        });
    
        // Step 1: Get available drivers based on capacity
        const drivers = await driverService.discoverAvailableDrivers({
          estimatedWeight: order.weight,
          estimatedVolume: order.volume,
          vehicleType: order.vehicleType,
          limit: 20
        });
    
        logger.info(`📊 Found ${drivers.length} drivers meeting capacity requirements`);
    
        if (drivers.length === 0) {
          logger.info('❌ No drivers found with required capacity');
          return [];
        }
    
        // Log driver details
        drivers.forEach((driver, index) => {
          logger.info(`Driver ${index + 1}: ${driver.driverId}, Location: ${driver.currentLocation}`);
        });
    
        // Step 2: Filter out drivers without valid locations
        const driversWithLocations = drivers.filter(driver => {
          if (!driver.currentLocation || driver.currentLocation.trim() === '') {
            logger.warn(`⚠ Driver ${driver.driverId} has no location`);
            return false;
          }
          return true;
        });
    
        if (driversWithLocations.length === 0) {
          logger.warn('❌ No drivers have valid locations');
          return [];
        }
    
        logger.info(`📍 Processing ${driversWithLocations.length} drivers with locations`);
    
        // Step 3: Get distances and times for all drivers
        logger.info('📏 Calculating distances...');
        const distances = await locationService.getDistancesForDrivers(
          order.pickupAddress,
          driversWithLocations.map(d => ({
            driverId: d.driverId,
            currentLocation: d.currentLocation
          }))
        );
    
        logger.info(`✅ Got distances for ${distances.size} drivers`);
    
        // Log distances
        distances.forEach((distance, driverId) => {
          logger.info(`   ${driverId}: ${distance.distance.text} in ${distance.duration.text}`);
        });
    
        // Step 4: Filter drivers by max distance if specified
        let filteredDrivers = driversWithLocations;
        if (order.maxDistance) {
          filteredDrivers = driversWithLocations.filter(driver => {
            const distanceInfo = distances.get(driver.driverId);
            if (!distanceInfo) {
              logger.warn(`   ${driver.driverId}: No distance info`);
              return false;
            }
            
            const distanceKm = distanceInfo.distance.value / 1000;
            const withinRange = distanceKm <= order.maxDistance!;
            logger.info(`   ${driver.driverId}: ${distanceKm.toFixed(2)}km (max: ${order.maxDistance}km) - ${withinRange ? '✅' : '❌'}`);
            return withinRange;
          });
        }
    
        logger.info(`🎯 ${filteredDrivers.length} drivers within ${order.maxDistance || 'any'} km range`);
    
        if (filteredDrivers.length === 0) {
          logger.info('❌ No drivers within the specified distance range');
          return [];
        }
    
        // Step 5: Apply matching algorithm with distance scoring
        logger.info('🧮 Calculating match scores...');
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
          const vehicleScore = primaryVehicle ? 
            this.calculateVehicleSuitability(primaryVehicle, order) : 0;
          score = (score * 0.5) + (vehicleScore * 0.5);
      
          // Urgency factor
          if (order.urgency === 'express') {
            score = distanceInfo ? (score * 0.3) + (this.calculateDistanceScore(distanceInfo) * 0.7) : score;
          }
      
          // Add user fallback if missing
          const userInfo = driver.user || {
            firstName: 'Driver',
            lastName: '# ' + driver.driverId.substring(0, 4),
            phone: 'Not available'
          };
      
          const suitability = this.getSuitabilityLevel(score);
          logger.info(`   ${driver.driverId}: Score=${Math.round(score)}, ${suitability}`);
      
          return {
            ...driver,
            user: userInfo,
            distanceInfo,
            matchScore: Math.round(score),
            suitability,
            estimatedArrival: this.formatEstimatedArrival(distanceInfo?.duration.value)
          };
        });
    
        // Step 6: Sort by match score (highest first)
        const sortedDrivers = scoredDrivers.sort((a, b) => b.matchScore - a.matchScore);
    
        logger.info(`✅ Returning ${sortedDrivers.length} matched drivers`);
        return sortedDrivers;
    
      } catch (error: any) {
        logger.error('❌ Matching service error:', error);
        logger.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
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