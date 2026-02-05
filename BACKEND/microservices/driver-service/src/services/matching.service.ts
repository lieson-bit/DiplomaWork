import { logger } from '../utils/logger';
import { geocodeAddress } from '../utils/geocoding.util';
import { driverService } from './driver.service';

export interface OrderRequirements {
  pickupAddress: string;
  pickupCoords?: { lat: number; lng: number };
  weight: number;
  volume: number;
  vehicleType?: 'motorbike' | 'small_van' | 'medium_truck' | 'large_truck';
  urgency?: 'normal' | 'urgent' | 'express';
  maxDistance?: number; // in km
}

export interface MatchedDriver {
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
  distanceInfo?: {
    distance: { text: string; value: number }; // meters
    duration: { text: string; value: number }; // seconds
  };
  matchScore: number;
  suitability: 'excellent' | 'good' | 'fair' | 'poor';
  estimatedArrival: string; // e.g., "15 mins"
}

export class MatchingService {
  async findMatchingDrivers(order: OrderRequirements): Promise<MatchedDriver[]> {
    try {
      logger.info('🚗 Starting driver matching process', {
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
        limit: 50
      });

      if (drivers.length === 0) {
        logger.info('❌ No drivers meet basic capacity requirements');
        return [];
      }

      logger.info(`✅ Found ${drivers.length} drivers meeting capacity requirements`);

      // Step 2: Geocode pickup address ONCE
        let pickupCoords: { lat: number; lng: number } | undefined = order.pickupCoords;
      
        if (!pickupCoords) {
          logger.info('📍 Geocoding pickup address...');
          const geocoded = await geocodeAddress(order.pickupAddress);
          pickupCoords = geocoded || undefined; // ✅ Convert null → undefined
        
          if (!pickupCoords) {
            logger.warn('⚠️ Could not geocode pickup address, skipping distance-based filtering');
            return drivers.map(driver => this.createMatchedDriver(driver, null, order));
          }
        }

      // Step 3: Geocode each driver's location and calculate distances
      const validDrivers: Array<{ driver: any; distanceKm: number }> = [];
      
      for (const driver of drivers) {
        if (!driver.currentLocation) continue;

        logger.info(`📍 Geocoding driver ${driver.driverId} location...`);
        const driverCoords = await geocodeAddress(driver.currentLocation);
        if (!driverCoords) continue;

        const distanceKm = this.haversineDistance(
          pickupCoords.lat,
          pickupCoords.lng,
          driverCoords.lat,
          driverCoords.lng
        );

        // Apply maxDistance filter if specified
        if (order.maxDistance && distanceKm > order.maxDistance) {
          logger.info(`❌ Driver ${driver.driverId} is ${distanceKm.toFixed(2)}km away (max: ${order.maxDistance}km) - excluded`);
          continue;
        }

        validDrivers.push({ driver, distanceKm });
      }

      if (validDrivers.length === 0) {
        logger.info('❌ No drivers within the specified distance range');
        return [];
      }

      logger.info(`🎯 ${validDrivers.length} drivers within ${order.maxDistance || 'any'} km range`);

      // Step 4: Create MatchedDriver objects with scores
      const scoredDrivers: MatchedDriver[] = validDrivers.map(({ driver, distanceKm }) => {
        // Calculate base score (rating, completion rate, experience)
        let score = this.calculateBaseScore(driver);

        // Distance score (closer is better)
        const distanceScore = Math.max(0, 100 - (distanceKm * 5)); // Lose 5 points per km
        score = (score * 0.6) + (distanceScore * 0.4);

        // Vehicle suitability score
        const primaryVehicle = driver.vehicles[0];
        if (primaryVehicle) {
          const vehicleScore = this.calculateVehicleSuitability(primaryVehicle, order);
          score = (score * 0.5) + (vehicleScore * 0.5);
        }

        // Urgency factor
        if (order.urgency === 'express') {
          // Prioritize closer drivers more heavily for express orders
          score = (score * 0.3) + (distanceScore * 0.7);
        }

        // Create distance info object
        const distanceMeters = distanceKm * 1000;
        const durationSeconds = distanceKm * 180; // Assume 20 km/h average speed (180 sec/km)
        
        const distanceInfo = {
          distance: {
            text: `${distanceKm.toFixed(1)} km`,
            value: distanceMeters
          },
          duration: {
            text: `${Math.ceil(durationSeconds / 60)} mins`,
            value: durationSeconds
          }
        };

        return this.createMatchedDriver(driver, distanceInfo, order, Math.round(score));
      });

      // Step 5: Sort by match score (highest first)
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

  private createMatchedDriver(
    driver: any,
    distanceInfo: { distance: { text: string; value: number }; duration: { text: string; value: number } } | null,
    order: OrderRequirements,
    matchScore: number = 0
  ): MatchedDriver {
    // Ensure user info exists
    const userInfo = driver.user || {
      firstName: 'Driver',
      lastName: `#${driver.driverId.substring(0, 4)}`,
      phone: 'Not available'
    };

    // Calculate base score if not provided
    if (matchScore === 0) {
      matchScore = this.calculateBaseScore(driver);
    }

    return {
      driverId: driver.driverId,
      userId: driver.userId,
      rating: driver.rating || 0,
      totalDeliveries: driver.totalDeliveries || 0,
      completionRate: driver.completionRate || 0,
      verificationLevel: driver.verificationLevel || 'none',
      isOnline: driver.isOnline || false,
      currentLocation: driver.currentLocation || 'Unknown',
      profileCompleted: driver.profileCompleted || false,
      user: userInfo,
      vehicles: driver.vehicles || [],
      distanceInfo: distanceInfo || undefined,
      matchScore: matchScore,
      suitability: this.getSuitabilityLevel(matchScore),
      estimatedArrival: distanceInfo 
        ? `${Math.ceil(distanceInfo.duration.value / 60)} mins`
        : 'N/A'
    };
  }

  private calculateBaseScore(driver: any): number {
    let score = 100;

    // Rating score (higher rating is better)
    const ratingScore = (driver.rating || 0) * 20; // Convert 0-5 to 0-100
    score = (score * 0.6) + (ratingScore * 0.4);

    // Completion rate score
    const completionScore = (driver.completionRate || 0) * 100;
    score = (score * 0.7) + (completionScore * 0.3);

    // Experience score (more deliveries is better, but capped)
    const experienceScore = Math.min(100, (driver.totalDeliveries || 0) / 100);
    score = (score * 0.8) + (experienceScore * 0.2);

    // Verification level bonus
    const verificationBonus = driver.verificationLevel === 'premium' ? 10 : 
                             driver.verificationLevel === 'verified' ? 5 : 0;
    score += verificationBonus;

    return Math.min(100, score);
  }

  private calculateVehicleSuitability(
    vehicle: any,
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

    // Vehicle type preference
    const typeScores: Record<string, number> = {
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

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}