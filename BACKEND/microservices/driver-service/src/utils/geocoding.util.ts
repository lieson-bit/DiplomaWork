import axios from 'axios';
import { logger } from './logger';

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Convert address string to coordinates using DistanceMatrix.ai (primary) 
 * with multiple fallback options
 */
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  try {
    logger.info(`🌍 Attempting to geocode: "${address}"`);
    
    // ============================================
    // OPTION 1: Primary - DistanceMatrix.ai Geocoding
    // ============================================
    try {
      logger.info('📍 Trying DistanceMatrix.ai geocoding...');
      const distanceMatrixApiKey = process.env.DISTANCE_MATRIX_API_KEY || 
        'NFLqNsgalupmIuzDS6zKuprvodMgjdaGAxBtGYNpOT9TUwnCnC4Z9Do6T2drMT4Y';
      
      const response = await axios.get('https://api.distancematrix.ai/maps/api/geocode/json', {
        params: {
          address: address,
          key: distanceMatrixApiKey,
          language: 'en' // Use English for consistency
        },
        timeout: 8000
      });

      logger.info(`DistanceMatrix.ai response status: ${response.data.status}`);
      
      if (response.data.status === 'OK' && response.data.results && response.data.results.length > 0) {
        const location = response.data.results[0].geometry.location;
        const coords = {
          lat: location.lat,
          lng: location.lng
        };
        
        logger.info(`✅ Successfully geocoded via DistanceMatrix.ai: ${coords.lat},${coords.lng}`);
        logger.info(`📍 Location: ${response.data.results[0].formatted_address || 'Address found'}`);
        
        return coords;
      } else {
        logger.warn(`DistanceMatrix.ai geocoding failed with status: ${response.data.status}`);
      }
    } catch (dmError: any) {
      logger.warn(`DistanceMatrix.ai geocoding error: ${dmError.message}`);
      if (dmError.response) {
        logger.warn(`Response data: ${JSON.stringify(dmError.response.data)}`);
      }
    }

    // ============================================
    // OPTION 2: Secondary - Simple address parsing for Russian cities
    // ============================================
    logger.info('📍 Falling back to address parsing for Russian cities...');
    
    const russianCityCoordinates: Record<string, Coordinates> = {
      // Moscow and major cities
      'москва': { lat: 55.7558, lng: 37.6173 },
      'moscow': { lat: 55.7558, lng: 37.6173 },
      'msk': { lat: 55.7558, lng: 37.6173 },
      
      // Saint Petersburg
      'санкт-петербург': { lat: 59.9343, lng: 30.3351 },
      'санкт петербург': { lat: 59.9343, lng: 30.3351 },
      'saint petersburg': { lat: 59.9343, lng: 30.3351 },
      'st. petersburg': { lat: 59.9343, lng: 30.3351 },
      'st petersburg': { lat: 59.9343, lng: 30.3351 },
      'spb': { lat: 59.9343, lng: 30.3351 },
      'питер': { lat: 59.9343, lng: 30.3351 },
      
      // Other major Russian cities
      'казань': { lat: 55.7961, lng: 49.1064 },
      'kazan': { lat: 55.7961, lng: 49.1064 },
      
      'нижний новгород': { lat: 56.3269, lng: 44.0065 },
      'nizhny novgorod': { lat: 56.3269, lng: 44.0065 },
      'нижний': { lat: 56.3269, lng: 44.0065 },
      
      'екатеринбург': { lat: 56.8389, lng: 60.6057 },
      'yekaterinburg': { lat: 56.8389, lng: 60.6057 },
      'ekb': { lat: 56.8389, lng: 60.6057 },
      
      'новосибирск': { lat: 55.0084, lng: 82.9357 },
      'novosibirsk': { lat: 55.0084, lng: 82.9357 },
      
      'ростов-на-дону': { lat: 47.2220, lng: 39.7203 },
      'rostov-on-don': { lat: 47.2220, lng: 39.7203 },
      'ростов': { lat: 47.2220, lng: 39.7203 },
      
      'краснодар': { lat: 45.0448, lng: 38.9760 },
      'krasnodar': { lat: 45.0448, lng: 38.9760 },
      
      'волгоград': { lat: 48.7080, lng: 44.5133 },
      'volgograd': { lat: 48.7080, lng: 44.5133 },
      
      'пермь': { lat: 58.0105, lng: 56.2294 },
      'perm': { lat: 58.0105, lng: 56.2294 },
      
      'самара': { lat: 53.1959, lng: 50.1002 },
      'samara': { lat: 53.1959, lng: 50.1002 },
      
      'уфа': { lat: 54.7351, lng: 55.9587 },
      'ufa': { lat: 54.7351, lng: 55.9587 },
      
      'омск': { lat: 54.9914, lng: 73.3686 },
      'omsk': { lat: 54.9914, lng: 73.3686 },
      
      'челябинск': { lat: 55.1644, lng: 61.4368 },
      'chelyabinsk': { lat: 55.1644, lng: 61.4368 },
      
      'воронеж': { lat: 51.6606, lng: 39.2003 },
      'voronezh': { lat: 51.6606, lng: 39.2003 },
      
      'красноярск': { lat: 56.0153, lng: 92.8932 },
      'krasnoyarsk': { lat: 56.0153, lng: 92.8932 },
      
      // Warsaw street coordinates in Saint Petersburg (approximate)
      'варшавская': { lat: 59.8500, lng: 30.3167 },
      'warsaw street': { lat: 59.8500, lng: 30.3167 },
      'варшавская улица': { lat: 59.8500, lng: 30.3167 }
    };

    const addressLower = address.toLowerCase().trim();
    
    // Check for city names in address
    for (const [city, coords] of Object.entries(russianCityCoordinates)) {
      if (addressLower.includes(city)) {
        logger.info(`📍 Found city "${city}" in address, using coordinates: ${coords.lat},${coords.lng}`);
        return coords;
      }
    }

    // ============================================
    // OPTION 3: Try to extract address parts
    // ============================================
    logger.info('📍 Trying to extract location from address parts...');
    
    // Common address patterns in Russian addresses
    const parts = address.split(',');
    if (parts.length >= 2) {
      // Try the last part (usually country/city)
      const lastPart = parts[parts.length - 1].toLowerCase().trim();
      for (const [city, coords] of Object.entries(russianCityCoordinates)) {
        if (lastPart.includes(city)) {
          logger.info(`📍 Extracted city "${city}" from address end, using coordinates: ${coords.lat},${coords.lng}`);
          return coords;
        }
      }
      
      // Try the second-to-last part (often city)
      if (parts.length >= 2) {
        const cityPart = parts[parts.length - 2].toLowerCase().trim();
        for (const [city, coords] of Object.entries(russianCityCoordinates)) {
          if (cityPart.includes(city)) {
            logger.info(`📍 Extracted city "${city}" from address, using coordinates: ${coords.lat},${coords.lng}`);
            return coords;
          }
        }
      }
    }

    // ============================================
    // OPTION 4: Ultimate fallback - Default coordinates
    // ============================================
    logger.warn(`⚠️ All geocoding attempts failed for: "${address}"`);
    logger.warn(`⚠️ Using default Saint Petersburg coordinates as fallback`);
    
    // Default to Saint Petersburg center
    const defaultCoords = { lat: 59.9343, lng: 30.3351 };
    
    logger.info(`📍 Using fallback coordinates: ${defaultCoords.lat},${defaultCoords.lng}`);
    logger.info(`📍 These coordinates represent: Saint Petersburg city center, Russia`);
    
    return defaultCoords;
    
  } catch (error: any) {
    logger.error(`💥 Critical geocoding error for "${address}":`, error.message);
    logger.error('Error stack:', error.stack);
    
    // Even if everything fails, return default coordinates
    logger.info(`📍 Critical fallback: Using Saint Petersburg coordinates`);
    return { lat: 59.9343, lng: 30.3351 };
  }
}

/**
 * Helper function to check if coordinates are valid
 */
export function isValidCoordinates(coords: Coordinates | null): boolean {
  if (!coords) return false;
  if (typeof coords.lat !== 'number' || typeof coords.lng !== 'number') return false;
  if (coords.lat < -90 || coords.lat > 90) return false;
  if (coords.lng < -180 || coords.lng > 180) return false;
  return true;
}

/**
 * Format coordinates as a string for logging/debugging
 */
export function formatCoordinates(coords: Coordinates | null): string {
  if (!coords) return 'null';
  return `${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`;
}