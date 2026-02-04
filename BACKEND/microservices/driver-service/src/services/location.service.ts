import axios from 'axios';
import { logger } from '../utils/logger';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DistanceMatrixResponse {
  distance: {
    text: string;  // e.g., "1.2 km"
    value: number; // in meters
  };
  duration: {
    text: string;  // e.g., "15 mins"
    value: number; // in seconds
  };
  status: string;
}

export class LocationService {
  private distanceMatrixApiKey: string;
  private geocodingApiUrl: string = 'https://nominatim.openstreetmap.org/search';

  constructor() {
    this.distanceMatrixApiKey = process.env.DISTANCE_MATRIX_API_KEY || 
      "NFLqNsgalupmIuzDS6zKuprvodMgjdaGAxBtGYNpOT9TUwnCnC4Z9Do6T2drMT4Y";
  }

  /**
   * Convert address to coordinates using OpenStreetMap Nominatim (free)
   */
  async geocodeAddress(address: string): Promise<Coordinates | null> {
    try {
      // Rate limiting: Nominatim requires max 1 request per second
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await axios.get(this.geocodingApiUrl, {
        params: {
          q: address,
          format: 'json',
          limit: 1,
          addressdetails: 1
        },
        headers: {
          'User-Agent': 'Delivery-App/1.0 (your-email@example.com)'
        }
      });

      if (response.data && response.data.length > 0) {
        return {
          lat: parseFloat(response.data[0].lat),
          lng: parseFloat(response.data[0].lon)
        };
      }
      
      logger.warn(`Geocoding failed for address: ${address}`);
      return null;
    } catch (error: any) {
      logger.error('Geocoding error:', error.message);
      return null;
    }
  }

  /**
   * Get distance and duration between two addresses using DistanceMatrix.ai
   */
  async getDistanceAndTime(
    origin: string, 
    destination: string,
    mode: string = 'driving'
  ): Promise<DistanceMatrixResponse | null> {
    try {
      const response = await axios.get('https://api.distancematrix.ai/maps/api/distancematrix/json', {
        params: {
          origins: origin,
          destinations: destination,
          mode: mode,
          key: this.distanceMatrixApiKey
        }
      });

      if (response.data.status === 'OK' && response.data.rows[0].elements[0].status === 'OK') {
        const element = response.data.rows[0].elements[0];
        return {
          distance: element.distance,
          duration: element.duration,
          status: 'OK'
        };
      } else {
        logger.warn(`Distance matrix failed: ${response.data.status}`);
        return null;
      }
    } catch (error: any) {
      logger.error('Distance matrix error:', error.message);
      return null;
    }
  }

  /**
   * Get distance and time between coordinates
   */
  async getDistanceAndTimeFromCoords(
    originCoords: Coordinates,
    destinationCoords: Coordinates,
    mode: string = 'driving'
  ): Promise<DistanceMatrixResponse | null> {
    const origin = `${originCoords.lat},${originCoords.lng}`;
    const destination = `${destinationCoords.lat},${destinationCoords.lng}`;
    
    return this.getDistanceAndTime(origin, destination, mode);
  }

  /**
   * Batch process distances for multiple drivers
   */
  async getDistancesForDrivers(
    pickupAddress: string,
    drivers: Array<{ driverId: string; currentLocation: string }>
  ): Promise<Map<string, DistanceMatrixResponse>> {
    const results = new Map<string, DistanceMatrixResponse>();
    
    // Process in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < drivers.length; i += batchSize) {
      const batch = drivers.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (driver) => {
        try {
          const distanceInfo = await this.getDistanceAndTime(
            driver.currentLocation,
            pickupAddress
          );
          
          if (distanceInfo) {
            results.set(driver.driverId, distanceInfo);
          }
        } catch (error) {
          logger.error(`Failed to get distance for driver ${driver.driverId}:`, error);
        }
      }));

      // Add delay between batches to respect rate limits
      if (i + batchSize < drivers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
}

export const locationService = new LocationService();