import { logger } from '../utils/logger';
import { driverService } from './driver.service';
import { locationService } from './location.service';
import { geocodeAddress, isValidCoordinates } from '../utils/geocoding.util';

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
    const requestStartTime = Date.now();
    const matchingId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    try {
      logger.info(`🚗 [${matchingId}] ===== STARTING MATCHING PROCESS =====`);
      logger.info(`📦 [${matchingId}] Order requirements:`, {
        weight: order.weight,
        volume: order.volume,
        vehicleType: order.vehicleType,
        urgency: order.urgency,
        maxDistance: order.maxDistance,
        pickupAddress: order.pickupAddress.substring(0, 100) + '...'
      });
      
      // STEP 1: Get available drivers
      logger.info(`🔍 [${matchingId}] Step 1: Finding drivers with suitable capacity...`);
      
      let drivers: any[] = [];
      try {
        drivers = await driverService.discoverAvailableDrivers({
          estimatedWeight: order.weight,
          estimatedVolume: order.volume,
          vehicleType: order.vehicleType as any,
          limit: 50
        });
        
        logger.info(`✅ [${matchingId}] Driver service returned ${drivers.length} drivers`);
        
        if (drivers.length === 0) {
          logger.warn(`❌ [${matchingId}] No drivers found matching capacity requirements`);
          return [];
        }
        
        // Log driver details
        drivers.forEach((driver, index) => {
          logger.debug(`👤 [${matchingId}] Driver ${index + 1}: ${driver.user?.firstName} ${driver.user?.lastName}`, {
            driverId: driver.driverId,
            userId: driver.userId,
            vehicles: driver.vehicles?.length || 0,
            location: driver.currentLocation || 'No location'
          });
        });
        
      } catch (dbError: any) {
        logger.error(`❌ [${matchingId}] Driver service failed:`, {
          message: dbError.message,
          stack: dbError.stack?.substring(0, 500),
          errorName: dbError.name
        });
        throw new Error(`Failed to get available drivers: ${dbError.message}`);
      }
      
      // STEP 2: Get pickup coordinates
      logger.info(`📍 [${matchingId}] Step 2: Getting pickup coordinates for: "${order.pickupAddress}"`);
      
      let pickupCoords: { lat: number; lng: number };
      
      // Check if coordinates were provided and are valid
      if (order.pickupCoords && 
          order.pickupCoords.lat !== undefined && 
          order.pickupCoords.lng !== undefined &&
          !isNaN(order.pickupCoords.lat) && 
          !isNaN(order.pickupCoords.lng)) {
        
        pickupCoords = order.pickupCoords;
        logger.info(`📍 [${matchingId}] Using provided coordinates: ${pickupCoords.lat}, ${pickupCoords.lng}`);
        
      } else {
        // No valid coordinates provided, try to geocode
        try {
          logger.info(`🗺️ [${matchingId}] Geocoding address...`);
          const geocoded = await geocodeAddress(order.pickupAddress);
          
          if (geocoded && isValidCoordinates(geocoded)) {
            pickupCoords = geocoded;
            logger.info(`📍 [${matchingId}] Successfully geocoded to: ${pickupCoords.lat}, ${pickupCoords.lng}`);
          } else {
            logger.warn(`⚠️ [${matchingId}] Geocoding returned invalid coordinates:`, geocoded);
            pickupCoords = { lat: 59.9343, lng: 30.3351 }; // St. Petersburg center
            logger.info(`📍 [${matchingId}] Using fallback coordinates: ${pickupCoords.lat}, ${pickupCoords.lng}`);
          }
        } catch (geocodingError: any) {
          logger.warn(`⚠️ [${matchingId}] Geocoding error: ${geocodingError.message}`);
          pickupCoords = { lat: 59.9343, lng: 30.3351 }; // St. Petersburg center
          logger.info(`📍 [${matchingId}] Using fallback coordinates after error: ${pickupCoords.lat}, ${pickupCoords.lng}`);
        }
      }
      
      // STEP 3: Process each driver
      logger.info(`🎯 [${matchingId}] Step 3: Processing ${drivers.length} drivers...`);
      
      const matchedDrivers: MatchedDriver[] = [];
      let processedCount = 0;
      let skippedCount = 0;
      let distanceCalcSuccess = 0;
      let distanceCalcFailed = 0;
      
      for (const driver of drivers) {
        processedCount++;
        
        try {
          logger.debug(`👤 [${matchingId}] Processing driver ${processedCount}/${drivers.length}: ${driver.user?.firstName} ${driver.user?.lastName}`);
          
          let distanceInfo = null;
          let driverGeocodingStatus: 'success' | 'fallback' | 'failed' = 'success';
          let shouldSkipDriver = false;
          
          // Try to calculate distance if driver has location
          if (driver.currentLocation && driver.currentLocation.trim()) {
            try {
              logger.debug(`📍 [${matchingId}] Geocoding driver location: "${driver.currentLocation.substring(0, 50)}..."`);
              
              const driverCoords = await geocodeAddress(driver.currentLocation);
              
              if (driverCoords && isValidCoordinates(driverCoords)) {
                // Check if these are fallback coordinates
                const isFallbackCoords = 
                  Math.abs(driverCoords.lat - 59.9343) < 0.01 && 
                  Math.abs(driverCoords.lng - 30.3351) < 0.01;
                
                if (isFallbackCoords) {
                  driverGeocodingStatus = 'fallback';
                  logger.debug(`📍 [${matchingId}] Driver coordinates are fallback/default`);
                }
                
                // Calculate distance using haversine formula
                const distanceKm = this.haversineDistance(
                  pickupCoords.lat,
                  pickupCoords.lng,
                  driverCoords.lat,
                  driverCoords.lng
                );
                
                logger.debug(`📏 [${matchingId}] Distance calculated: ${distanceKm.toFixed(2)} km`);
                
                // Apply maxDistance filter if specified
                if (order.maxDistance && distanceKm > order.maxDistance) {
                  logger.debug(`📍 [${matchingId}] Skipping driver: ${distanceKm.toFixed(1)}km > ${order.maxDistance}km max`);
                  shouldSkipDriver = true;
                  skippedCount++;
                } else {
                  // Create distance info
                  const distanceMeters = distanceKm * 1000;
                  // Estimate duration based on distance and traffic
                  const baseDurationSeconds = (distanceKm / 30) * 3600; // 30 km/h average
                  const urgencyMultiplier = order.urgency === 'express' ? 0.8 : order.urgency === 'urgent' ? 0.9 : 1;
                  const durationSeconds = baseDurationSeconds * urgencyMultiplier;
                  
                  distanceInfo = {
                    distance: {
                      text: `${distanceKm.toFixed(1)} km`,
                      value: Math.round(distanceMeters)
                    },
                    duration: {
                      text: `${Math.ceil(durationSeconds / 60)} mins`,
                      value: Math.round(durationSeconds)
                    }
                  };
                  
                  distanceCalcSuccess++;
                  logger.debug(`✅ [${matchingId}] Distance info created: ${distanceInfo.distance.text} in ${distanceInfo.duration.text}`);
                }
              } else {
                logger.warn(`⚠️ [${matchingId}] Could not geocode driver location`);
                driverGeocodingStatus = 'failed';
                distanceCalcFailed++;
              }
            } catch (distanceError: any) {
              logger.warn(`⚠️ [${matchingId}] Distance calculation failed:`, {
                message: distanceError.message,
                driverId: driver.driverId
              });
              driverGeocodingStatus = 'failed';
              distanceCalcFailed++;
            }
          } else {
            logger.info(`ℹ️ [${matchingId}] Driver has no location data`);
            driverGeocodingStatus = 'failed';
            distanceCalcFailed++;
          }
          
          // Skip driver if beyond max distance
          if (shouldSkipDriver) {
            continue;
          }
          
          // Calculate scores
          const baseScore = this.calculateBaseScore(driver);
          logger.debug(`📊 [${matchingId}] Base score: ${baseScore.toFixed(1)}`);
          
          let finalScore = baseScore;
          
          // Adjust score based on distance (if available)
          if (distanceInfo) {
            const distanceKm = distanceInfo.distance.value / 1000;
            const distanceScore = Math.max(0, 100 - (distanceKm * 2)); // Closer is better
            finalScore = (baseScore * 0.5) + (distanceScore * 0.5);
            logger.debug(`📊 [${matchingId}] Distance score: ${distanceScore.toFixed(1)}, Combined: ${finalScore.toFixed(1)}`);
          }
          
          // Adjust for vehicle suitability
          const primaryVehicle = driver.vehicles && driver.vehicles[0];
          if (primaryVehicle) {
            const vehicleScore = this.calculateVehicleSuitability(primaryVehicle, order);
            finalScore = (finalScore * 0.7) + (vehicleScore * 0.3);
            logger.debug(`🚗 [${matchingId}] Vehicle score: ${vehicleScore.toFixed(1)}, Final: ${finalScore.toFixed(1)}`);
          }
          
          // Adjust for urgency
          if (order.urgency === 'express') {
            // For express orders, prioritize drivers who are closer
            if (distanceInfo) {
              const distanceKm = distanceInfo.distance.value / 1000;
              const distanceScore = Math.max(0, 100 - (distanceKm * 3)); // More weight for distance
              finalScore = (baseScore * 0.3) + (distanceScore * 0.7);
              logger.debug(`⚡ [${matchingId}] Express order adjustment, final: ${finalScore.toFixed(1)}`);
            }
          }
          
          // Ensure score is valid
          finalScore = Math.max(0, Math.min(100, Math.round(finalScore)));
          
          // Create matched driver object
          const matchedDriver = this.createMatchedDriver(
            driver,
            distanceInfo,
            order,
            finalScore,
            driverGeocodingStatus
          );
          
          matchedDrivers.push(matchedDriver);
          
          logger.debug(`✅ [${matchingId}] Driver ${driver.driverId} added: Score ${finalScore} (${matchedDriver.suitability})`);
          
        } catch (driverError: any) {
          logger.warn(`⚠️ [${matchingId}] Error processing driver ${driver.driverId}:`, {
            message: driverError.message,
            errorName: driverError.name
          });
          skippedCount++;
          continue; // Skip this driver and continue with others
        }
      }
      
      // STEP 4: Sort and return results
      logger.info(`📊 [${matchingId}] Step 4: Sorting ${matchedDrivers.length} matched drivers...`);
      
      // Sort by match score (highest first)
      const sortedDrivers = matchedDrivers.sort((a, b) => b.matchScore - a.matchScore);
      
      const processingTime = Date.now() - requestStartTime;
      
      logger.info(`🎉 [${matchingId}] ===== MATCHING PROCESS COMPLETE =====`, {
        stats: {
          totalDriversProcessed: processedCount,
          successfullyMatched: matchedDrivers.length,
          skipped: skippedCount,
          distanceCalculations: {
            success: distanceCalcSuccess,
            failed: distanceCalcFailed
          }
        },
        results: {
          topScore: sortedDrivers[0]?.matchScore || 0,
          averageScore: sortedDrivers.length > 0 
            ? (sortedDrivers.reduce((sum, d) => sum + d.matchScore, 0) / sortedDrivers.length).toFixed(1)
            : 0,
          suitabilityBreakdown: {
            excellent: sortedDrivers.filter(d => d.suitability === 'excellent').length,
            good: sortedDrivers.filter(d => d.suitability === 'good').length,
            fair: sortedDrivers.filter(d => d.suitability === 'fair').length,
            poor: sortedDrivers.filter(d => d.suitability === 'poor').length
          }
        },
        processingTime
      });
      
      // Log top 3 drivers for debugging
      if (sortedDrivers.length > 0) {
        logger.info(`🏆 [${matchingId}] Top ${Math.min(3, sortedDrivers.length)} drivers:`);
        sortedDrivers.slice(0, 3).forEach((driver, index) => {
          const distanceText = driver.distanceInfo 
            ? `${driver.distanceInfo.distance.text} (${driver.distanceInfo.duration.text})`
            : 'no distance';
          logger.info(`  ${index + 1}. ${driver.user.firstName} ${driver.user.lastName} - Score: ${driver.matchScore} - ${distanceText}`);
        });
      } else {
        logger.warn(`⚠️ [${matchingId}] No drivers matched after processing`);
      }
      
      return sortedDrivers;
      
    } catch (error: any) {
      const processingTime = Date.now() - requestStartTime;
      logger.error(`💥 [${matchingId}] Matching service critical error after ${processingTime}ms:`, {
        message: error.message,
        stack: error.stack?.substring(0, 500),
        errorName: error.name
      });
      throw new Error(`Matching service failed: ${error.message}`);
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
      return 0; // Cannot carry the weight
    }
    
    const weightScore = 100 - (weightUtilization * 40); // Lose up to 40 points for high utilization
    score = (score * 0.4) + (weightScore * 0.6);

    // Check volume capacity
    const volumeUtilization = order.volume / vehicle.maxVolume;
    if (volumeUtilization > 1) {
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