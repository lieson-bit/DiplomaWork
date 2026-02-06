import { logger } from '../utils/logger';
import { geocodeAddress, formatCoordinates } from '../utils/geocoding.util';
import { driverService } from './driver.service';
import { locationService } from './location.service';

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
  estimatedArrival: string;
  geocodingStatus: 'success' | 'fallback' | 'failed';
}

export class MatchingService {
  
  async findMatchingDrivers(order: OrderRequirements): Promise<MatchedDriver[]> {
    try {
      logger.info('🚗 ===== STARTING DRIVER MATCHING PROCESS =====');
      logger.info('📦 Order Requirements:', {
        pickupAddress: order.pickupAddress,
        weight: order.weight,
        volume: order.volume,
        vehicleType: order.vehicleType,
        urgency: order.urgency,
        maxDistance: order.maxDistance
      });

      // Step 1: Get available drivers based on capacity
      logger.info('🔍 Step 1: Finding drivers with suitable capacity...');
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

      logger.info(`✅ Step 1 Complete: Found ${drivers.length} drivers meeting capacity requirements`);

      // Step 2: Geocode pickup address
      logger.info('📍 Step 2: Geocoding pickup address...');
      let pickupCoords: { lat: number; lng: number } | undefined = order.pickupCoords;
      let geocodingStatus: 'success' | 'fallback' | 'failed' = 'success';

      if (!pickupCoords) {
        const geocoded = await geocodeAddress(order.pickupAddress);
        if (geocoded) {
          pickupCoords = geocoded;
          logger.info(`📍 Pickup coordinates: ${formatCoordinates(pickupCoords)}`);
          
          // Check if these are fallback coordinates (Saint Petersburg center)
          if (Math.abs(pickupCoords.lat - 59.9343) < 0.01 && Math.abs(pickupCoords.lng - 30.3351) < 0.01) {
            geocodingStatus = 'fallback';
            logger.warn('⚠️ Using fallback coordinates for pickup location');
          }
        } else {
          logger.warn('⚠️ Could not geocode pickup address');
          geocodingStatus = 'failed';
          // Use default coordinates to continue
          pickupCoords = { lat: 59.9343, lng: 30.3351 };
        }
      }

      // Step 3: Process each driver and calculate scores
      logger.info('🎯 Step 3: Calculating driver suitability scores...');
      const matchedDrivers: MatchedDriver[] = [];

      for (const driver of drivers) {
        try {
          let distanceInfo = null;
          let driverGeocodingStatus: 'success' | 'fallback' | 'failed' = 'success';

          // Try to get distance info if driver has location
          if (driver.currentLocation && pickupCoords) {
            try {
              // First, geocode driver's location
              logger.info(`📍 Geocoding driver ${driver.driverId} location: ${driver.currentLocation}`);
              const driverCoords = await geocodeAddress(driver.currentLocation);
              
              if (driverCoords) {
                // Check if driver coordinates are fallback
                if (Math.abs(driverCoords.lat - 59.9343) < 0.01 && Math.abs(driverCoords.lng - 30.3351) < 0.01) {
                  driverGeocodingStatus = 'fallback';
                }
                
                // Calculate distance using haversine formula
                const distanceKm = this.haversineDistance(
                  pickupCoords.lat,
                  pickupCoords.lng,
                  driverCoords.lat,
                  driverCoords.lng
                );

                // Apply maxDistance filter if specified
                if (order.maxDistance && distanceKm > order.maxDistance) {
                  logger.info(`❌ Driver ${driver.driverId} excluded: ${distanceKm.toFixed(1)}km > ${order.maxDistance}km`);
                  continue; // Skip this driver
                }

                // Create distance info object
                const distanceMeters = distanceKm * 1000;
                // Estimate duration: assume average speed of 30 km/h in city traffic
                const durationSeconds = (distanceKm / 30) * 3600;
                
                distanceInfo = {
                  distance: {
                    text: `${distanceKm.toFixed(1)} km`,
                    value: distanceMeters
                  },
                  duration: {
                    text: `${Math.ceil(durationSeconds / 60)} mins`,
                    value: durationSeconds
                  }
                };

                logger.info(`📏 Driver ${driver.driverId}: ${distanceKm.toFixed(1)}km away`);
              } else {
                logger.warn(`⚠️ Could not geocode driver ${driver.driverId} location`);
                driverGeocodingStatus = 'failed';
              }
            } catch (geoError: any) {
              logger.warn(`⚠️ Distance calculation failed for driver ${driver.driverId}:`, geoError.message);
              driverGeocodingStatus = 'failed';
            }
          } else if (!driver.currentLocation) {
            logger.info(`ℹ️ Driver ${driver.driverId} has no location data`);
            driverGeocodingStatus = 'failed';
          }

          // Calculate base score
          const baseScore = this.calculateBaseScore(driver);
          
          // Calculate distance score (if we have distance info)
          let distanceScore = 0;
          if (distanceInfo) {
            const distanceKm = distanceInfo.distance.value / 1000;
            // Score decreases with distance: 100 points for 0km, 0 points for 50km
            distanceScore = Math.max(0, 100 - (distanceKm * 2));
          }

          // Calculate vehicle suitability score
          let vehicleScore = 0;
          const primaryVehicle = driver.vehicles && driver.vehicles[0];
          if (primaryVehicle) {
            vehicleScore = this.calculateVehicleSuitability(primaryVehicle, order);
          }

          // Combine scores
          let finalScore = baseScore;
          if (distanceInfo) {
            // Weighted average: 50% base score, 30% distance, 20% vehicle
            finalScore = (baseScore * 0.5) + (distanceScore * 0.3) + (vehicleScore * 0.2);
          } else {
            // No distance info: 70% base score, 30% vehicle
            finalScore = (baseScore * 0.7) + (vehicleScore * 0.3);
          }

          // Adjust for urgency
          if (order.urgency === 'express') {
            // For express orders, prioritize closer drivers more
            if (distanceInfo) {
              finalScore = (baseScore * 0.3) + (distanceScore * 0.5) + (vehicleScore * 0.2);
            }
          }

          // Ensure score is between 0-100
          finalScore = Math.max(0, Math.min(100, finalScore));

          // Create matched driver object
          const matchedDriver = this.createMatchedDriver(
            driver,
            distanceInfo,
            order,
            Math.round(finalScore),
            driverGeocodingStatus
          );

          matchedDrivers.push(matchedDriver);
          logger.info(`✅ Driver ${driver.driverId} scored: ${finalScore.toFixed(1)} (${matchedDriver.suitability})`);

        } catch (driverError: any) {
          logger.error(`❌ Error processing driver ${driver.driverId}:`, driverError.message);
          // Continue with next driver
          continue;
        }
      }

      if (matchedDrivers.length === 0) {
        logger.info('❌ No drivers matched after filtering');
        return [];
      }

      // Step 4: Sort drivers by match score (highest first)
      logger.info('📊 Step 4: Sorting drivers by match score...');
      const sortedDrivers = matchedDrivers.sort((a, b) => b.matchScore - a.matchScore);

      logger.info(`🎉 MATCHING PROCESS COMPLETE: ${sortedDrivers.length} drivers matched`);
      logger.info('🏆 Top 3 drivers:');
      sortedDrivers.slice(0, 3).forEach((driver, index) => {
        logger.info(`  ${index + 1}. ${driver.user.firstName} ${driver.user.lastName} - Score: ${driver.matchScore} (${driver.suitability})`);
        if (driver.distanceInfo) {
          logger.info(`     Distance: ${driver.distanceInfo.distance.text}, Time: ${driver.distanceInfo.duration.text}`);
        }
      });

      return sortedDrivers;

    } catch (error: any) {
      logger.error('💥 MATCHING SERVICE CRITICAL ERROR:', error);
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
    matchScore: number = 0,
    geocodingStatus: 'success' | 'fallback' | 'failed' = 'success'
  ): MatchedDriver {
    // Ensure user info exists
    const userInfo = driver.user || {
      firstName: 'Driver',
      lastName: `#${driver.driverId.substring(0, 8)}`,
      phone: 'Contact via app'
    };

    // Calculate arrival estimate
    let estimatedArrival = 'N/A';
    if (distanceInfo) {
      const minutes = Math.ceil(distanceInfo.duration.value / 60);
      estimatedArrival = `${minutes} mins`;
    } else if (geocodingStatus === 'failed') {
      estimatedArrival = 'Location data unavailable';
    } else {
      estimatedArrival = 'Calculating...';
    }

    return {
      driverId: driver.driverId,
      userId: driver.userId,
      rating: driver.rating || 0,
      totalDeliveries: driver.totalDeliveries || 0,
      completionRate: driver.completionRate || 0,
      verificationLevel: driver.verificationLevel || 'none',
      isOnline: driver.isOnline || false,
      currentLocation: driver.currentLocation || 'Location not set',
      profileCompleted: driver.profileCompleted || false,
      user: userInfo,
      vehicles: driver.vehicles || [],
      distanceInfo: distanceInfo || undefined,
      matchScore: matchScore,
      suitability: this.getSuitabilityLevel(matchScore),
      estimatedArrival: estimatedArrival,
      geocodingStatus: geocodingStatus
    };
  }

  private calculateBaseScore(driver: any): number {
    let score = 0;

    // Rating score (0-5 rating becomes 0-100 points)
    const ratingScore = (driver.rating || 0) * 20;
    score += ratingScore * 0.3; // 30% weight

    // Completion rate score
    const completionScore = (driver.completionRate || 0) * 100;
    score += completionScore * 0.25; // 25% weight

    // Experience score (more deliveries is better, but with diminishing returns)
    const experienceDeliveries = driver.totalDeliveries || 0;
    let experienceScore = 0;
    if (experienceDeliveries > 0) {
      experienceScore = Math.min(100, Math.log10(experienceDeliveries + 1) * 40);
    }
    score += experienceScore * 0.2; // 20% weight

    
    // Or alternatively, with type safety:
    const verificationBonus = (() => {
      const level = driver.verificationLevel as 'none' | 'basic' | 'verified' | 'premium' | string;
      switch (level) {
        case 'none': return 0;
        case 'basic': return 10;
        case 'verified': return 25;
        case 'premium': return 50;
        default: return 0;
      }
    })();

    score += verificationBonus * 0.15;// 15% weight

    // Online status bonus
    const onlineBonus = driver.isOnline ? 10 : 0;
    score += onlineBonus * 0.1; // 10% weight

    return Math.min(100, score);
  }

  private calculateVehicleSuitability(
    vehicle: any,
    order: OrderRequirements
  ): number {
    if (!vehicle) return 0;
    
    let score = 100;

    // Check weight capacity
    const weightUtilization = order.weight / vehicle.maxWeight;
    if (weightUtilization > 1) {
      logger.info(`❌ Vehicle ${vehicle.id} cannot carry ${order.weight}kg (max: ${vehicle.maxWeight}kg)`);
      return 0; // Cannot carry the weight
    }
    
    const weightScore = 100 - (weightUtilization * 40); // Lose up to 40 points for high utilization
    score = (score * 0.4) + (weightScore * 0.6);

    // Check volume capacity
    const volumeUtilization = order.volume / vehicle.maxVolume;
    if (volumeUtilization > 1) {
      logger.info(`❌ Vehicle ${vehicle.id} cannot fit ${order.volume}m³ (max: ${vehicle.maxVolume}m³)`);
      return 0; // Cannot fit the volume
    }
    
    const volumeScore = 100 - (volumeUtilization * 40); // Lose up to 40 points for high utilization
    score = (score * 0.4) + (volumeScore * 0.6);

    // Vehicle type suitability
    const typeScores: Record<string, number> = {
      'motorbike': order.weight < 50 && order.volume < 1 ? 100 : 70,
      'small_van': order.weight < 500 && order.volume < 5 ? 100 : 85,
      'medium_truck': order.weight < 2000 && order.volume < 20 ? 100 : 90,
      'large_truck': 100 // Large truck can handle anything
    };
    
    const typeScore = typeScores[vehicle.type] || 75;
    score = (score * 0.5) + (typeScore * 0.5);

    return Math.min(100, score);
  }

  private getSuitabilityLevel(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
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

export const matchingService = new MatchingService();