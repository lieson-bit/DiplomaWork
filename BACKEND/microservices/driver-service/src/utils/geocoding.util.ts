import axios from 'axios';
import { logger } from './logger';

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Convert address string to coordinates with multiple fallback options
 */
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const requestId = `geocode_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const startTime = Date.now();
  
  try {
    logger.info(`🌍 [${requestId}] Geocoding address: "${address.substring(0, 50)}${address.length > 50 ? '...' : ''}"`);
    
    if (!address || address.trim().length === 0) {
      logger.warn(`⚠️ [${requestId}] Empty address provided`);
      return getFallbackCoordinates('empty');
    }
    
    // Clean the address
    const cleanAddress = address.trim();
    
    // ============================================
    // OPTION 1: DistanceMatrix.ai Geocoding (Primary)
    // ============================================
    try {
      logger.info(`📍 [${requestId}] Trying DistanceMatrix.ai geocoding...`);
      const distanceMatrixApiKey = process.env.DISTANCE_MATRIX_API_KEY || 
        'NFLqNsgalupmIuzDS6zKuprvodMgjdaGAxBtGYNpOT9TUwnCnC4Z9Do6T2drMT4Y';
      
      const response = await axios.get('https://api.distancematrix.ai/maps/api/geocode/json', {
        params: {
          address: cleanAddress,
          key: distanceMatrixApiKey,
          language: 'en'
        },
        headers: {
          'User-Agent': 'DeliveryMatch/1.0 (lieson.work@gmail.com)'
        },
        timeout: 8000
      });

      logger.debug(`📍 [${requestId}] DistanceMatrix.ai response status: ${response.data.status}`);
      
      // Check for "OK" status AND "results" array
      if (response.data.status === 'OK' && Array.isArray(response.data.result)) {
        const results = response.data.result;
        if (results.length > 0) {
          const location = results[0];
          const coords = {
            lat: location.geometry?.location?.lat,
            lng: location.geometry?.location?.lng
          };
          
          // Validate coordinates
          if (coords.lat && coords.lng && !isNaN(coords.lat) && !isNaN(coords.lng)) {
            const finalCoords = {
              lat: parseFloat(coords.lat),
              lng: parseFloat(coords.lng)
            };
            
            logger.info(`✅ [${requestId}] Successfully geocoded via DistanceMatrix.ai: ${finalCoords.lat},${finalCoords.lng}`);
            logger.info(`📍 [${requestId}] Location: ${location.formatted_address?.substring(0, 100) || 'Address found'}`);
            logger.info(`⏱️ [${requestId}] Geocoding time: ${Date.now() - startTime}ms`);
            
            return finalCoords;
          } else {
            logger.warn(`⚠️ [${requestId}] Invalid coordinates in DistanceMatrix.ai response:`, coords);
          }
        } else {
          logger.warn(`⚠️ [${requestId}] DistanceMatrix.ai returned empty results array`);
        }
      } else {
        logger.warn(`⚠️ [${requestId}] DistanceMatrix.ai geocoding failed with status: ${response.data.status}`);
      }
    } catch (dmError: any) {
      logger.warn(`⚠️ [${requestId}] DistanceMatrix.ai geocoding error:`, {
        message: dmError.message,
        code: dmError.code,
        responseStatus: dmError.response?.status
      });
    }

    // ============================================
    // OPTION 2: OpenStreetMap Nominatim (Fallback 1)
    // ============================================
    try {
      logger.info(`📍 [${requestId}] Trying OpenStreetMap Nominatim as fallback...`);
      
      // Special handling for Russian addresses
      let searchAddress = cleanAddress;
      if (cleanAddress.toLowerCase().includes('sankt-peterburg') || 
          cleanAddress.toLowerCase().includes('st. petersburg') ||
          cleanAddress.toLowerCase().includes('питер')) {
        searchAddress = 'Saint Petersburg, Russia';
      }
      
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: searchAddress,
          format: 'json',
          limit: 1,
          'accept-language': 'en'
        },
        headers: {
          'User-Agent': 'DeliveryMatch/1.0 (lieson.work@gmail.com)'
        },
        timeout: 5000
      });

      const results = response.data;
      if (Array.isArray(results) && results.length > 0) {
        const lat = parseFloat(results[0].lat);
        const lng = parseFloat(results[0].lon);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          const coords = { lat, lng };
          
          logger.info(`✅ [${requestId}] Successfully geocoded via Nominatim: ${coords.lat},${coords.lng}`);
          logger.info(`📍 [${requestId}] Location: ${results[0].display_name?.substring(0, 100) || 'Address found'}`);
          logger.info(`⏱️ [${requestId}] Geocoding time: ${Date.now() - startTime}ms`);
          
          return coords;
        } else {
          logger.warn(`⚠️ [${requestId}] Invalid coordinates from Nominatim: lat=${results[0].lat}, lon=${results[0].lon}`);
        }
      } else {
        logger.warn(`⚠️ [${requestId}] Nominatim returned no results`);
      }
    } catch (nominatimError: any) {
      logger.warn(`⚠️ [${requestId}] Nominatim geocoding error:`, {
        message: nominatimError.message,
        status: nominatimError.response?.status
      });
    }

    // ============================================
    // OPTION 3: Address parsing for known locations (Fallback 2)
    // ============================================
    logger.info(`📍 [${requestId}] Trying address parsing for known locations...`);
    
    // Check for specific addresses in the input
    const knownLocations: Array<{keywords: string[], coords: Coordinates}> = [
      {
        keywords: ['khersonskiy', 'khersonskiy proyezd', 'варшавская', 'warsaw'],
        coords: { lat: 59.8500, lng: 30.3167 } // Warsaw street area in St. Petersburg
      },
      {
        keywords: ['sankt-peterburg', 'st. petersburg', 'saint petersburg', 'питер', 'spb'],
        coords: { lat: 59.9343, lng: 30.3351 } // St. Petersburg center
      },
      {
        keywords: ['москва', 'moscow', 'msk'],
        coords: { lat: 55.7558, lng: 37.6173 } // Moscow
      },
      {
        keywords: ['казань', 'kazan'],
        coords: { lat: 55.7961, lng: 49.1064 } // Kazan
      }
    ];
    
    const addressLower = cleanAddress.toLowerCase();
    
    for (const location of knownLocations) {
      for (const keyword of location.keywords) {
        if (addressLower.includes(keyword.toLowerCase())) {
          logger.info(`📍 [${requestId}] Found keyword "${keyword}" in address, using coordinates: ${location.coords.lat},${location.coords.lng}`);
          logger.info(`⏱️ [${requestId}] Geocoding time: ${Date.now() - startTime}ms`);
          return location.coords;
        }
      }
    }

    // ============================================
    // OPTION 4: Extract street numbers and use district centers (Fallback 3)
    // ============================================
    logger.info(`📍 [${requestId}] Trying street number extraction...`);
    
    // Try to extract street number for better precision
    const streetNumberMatch = cleanAddress.match(/\b(\d+[A-Za-z]?)\b/);
    if (streetNumberMatch) {
      const streetNumber = streetNumberMatch[1];
      logger.info(`📍 [${requestId}] Found street number: ${streetNumber}`);
      
      // Check if it's in St. Petersburg
      if (addressLower.includes('sankt') || addressLower.includes('peterburg') || addressLower.includes('питер')) {
        // Use a coordinate based on street number (simplified logic)
        // For real implementation, you'd have a database of street coordinates
        const baseLat = 59.9343;
        const baseLng = 30.3351;
        
        // Add small variations based on street number
        const streetNum = parseInt(streetNumber) || 1;
        const variation = (streetNum % 100) / 10000; // Small variation
        
        const coords = {
          lat: baseLat + variation,
          lng: baseLng - variation
        };
        
        logger.info(`📍 [${requestId}] Using street-number adjusted coordinates: ${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`);
        logger.info(`⏱️ [${requestId}] Geocoding time: ${Date.now() - startTime}ms`);
        
        return coords;
      }
    }

    // ============================================
    // OPTION 5: Ultimate fallback - Default coordinates
    // ============================================
    logger.warn(`⚠️ [${requestId}] All geocoding attempts failed for address`);
    logger.warn(`⚠️ [${requestId}] Address was: "${cleanAddress.substring(0, 100)}${cleanAddress.length > 100 ? '...' : ''}"`);
    
    return getFallbackCoordinates('all_failed');
    
  } catch (error: any) {
    logger.error(`💥 [${requestId}] Critical geocoding error:`, {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      address: address.substring(0, 100)
    });
    
    return getFallbackCoordinates('error');
  }
}

/**
 * Helper function to get fallback coordinates with logging
 */
function getFallbackCoordinates(reason: string): Coordinates {
  const defaultCoords = { lat: 59.9343, lng: 30.3351 }; // St. Petersburg center
  
  logger.info(`📍 Using fallback coordinates (reason: ${reason}): ${defaultCoords.lat},${defaultCoords.lng}`);
  logger.info(`📍 These coordinates represent: Saint Petersburg city center, Russia`);
  
  return defaultCoords;
}

/**
 * Helper function to check if coordinates are valid
 */
export function isValidCoordinates(coords: Coordinates | null): boolean {
  if (!coords) return false;
  if (typeof coords.lat !== 'number' || typeof coords.lng !== 'number') return false;
  if (coords.lat < -90 || coords.lat > 90) return false;
  if (coords.lng < -180 || coords.lng > 180) return false;
  if (isNaN(coords.lat) || isNaN(coords.lng)) return false;
  return true;
}

/**
 * Format coordinates as a string for logging/debugging
 */
export function formatCoordinates(coords: Coordinates | null): string {
  if (!coords || !isValidCoordinates(coords)) return 'null';
  return `${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`;
}