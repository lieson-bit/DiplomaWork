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
  private cache = new Map<string, { coords: Coordinates; timestamp: number }>();
  private cacheTTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.distanceMatrixApiKey = process.env.DISTANCE_MATRIX_API_KEY || 
      "NFLqNsgalupmIuzDS6zKuprvodMgjdaGAxBtGYNpOT9TUwnCnC4Z9Do6T2drMT4Y";
  }

  /**
   * Get distance and duration between two addresses using DistanceMatrix.ai
   * DistanceMatrix.ai can handle addresses directly - no need for geocoding first!
   */
  async getDistanceAndTime(
    origin: string, 
    destination: string,
    mode: string = 'driving'
  ): Promise<DistanceMatrixResponse | null> {
    try {
      logger.info(`Getting distance from "${origin}" to "${destination}"`);
      
      const response = await axios.get('https://api.distancematrix.ai/maps/api/distancematrix/json', {
        params: {
          origins: origin,
          destinations: destination,
          mode: mode,
          key: this.distanceMatrixApiKey
        },
        timeout: 10000 // 10 second timeout
      });

      logger.info('Distance matrix response status:', response.data.status);
      
      if (response.data.status === 'OK' && 
          response.data.rows && 
          response.data.rows[0] && 
          response.data.rows[0].elements && 
          response.data.rows[0].elements[0] &&
          response.data.rows[0].elements[0].status === 'OK') {
        
        const element = response.data.rows[0].elements[0];
        logger.info(`Distance: ${element.distance.text}, Duration: ${element.duration.text}`);
        
        return {
          distance: element.distance,
          duration: element.duration,
          status: 'OK'
        };
      } else {
        const errorStatus = response.data.rows?.[0]?.elements?.[0]?.status || response.data.status;
        logger.warn(`Distance matrix failed: ${errorStatus}`);
        logger.warn('Response data:', response.data);
        return null;
      }
    } catch (error: any) {
      logger.error('Distance matrix error:', error.message);
      if (error.response) {
        logger.error('Error response data:', error.response.data);
      }
      return null;
    }
  }

  /**
   * Batch process distances for multiple drivers
   * DistanceMatrix.ai can handle multiple origins/destinations in one request!
   */
  async getDistancesForDrivers(
    pickupAddress: string,
    drivers: Array<{ driverId: string; currentLocation: string }>
  ): Promise<Map<string, DistanceMatrixResponse>> {
    const results = new Map<string, DistanceMatrixResponse>();
    
    if (drivers.length === 0) {
      return results;
    }

    try {
      // Group drivers into batches (DistanceMatrix.ai has limits)
      const batchSize = 10; // Safe batch size
      const batches = [];
      
      for (let i = 0; i < drivers.length; i += batchSize) {
        batches.push(drivers.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        // Extract driver locations
        const origins = batch.map(d => d.currentLocation);
        
        logger.info(`Processing batch of ${batch.length} drivers`);
        logger.info('Origins:', origins);
        logger.info('Destination:', pickupAddress);

        // Make a single request for all drivers in this batch
        const response = await axios.get('https://api.distancematrix.ai/maps/api/distancematrix/json', {
          params: {
            origins: origins.join('|'), // Multiple origins separated by |
            destinations: pickupAddress,
            mode: 'driving',
            key: this.distanceMatrixApiKey
          },
          timeout: 15000 // 15 second timeout for batch
        });

        if (response.data.status === 'OK' && response.data.rows) {
          response.data.rows.forEach((row: any, index: number) => {
            const driver = batch[index];
            if (!driver) return;
            
            const element = row.elements?.[0];
            if (element && element.status === 'OK') {
              results.set(driver.driverId, {
                distance: element.distance,
                duration: element.duration,
                status: 'OK'
              });
              logger.info(`Driver ${driver.driverId}: ${element.distance.text}, ${element.duration.text}`);
            } else {
              logger.warn(`No distance for driver ${driver.driverId}: ${element?.status || 'no data'}`);
            }
          });
        } else {
          logger.warn(`Batch request failed: ${response.data.status}`);
        }

        // Add delay between batches to avoid rate limiting
        if (batches.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info(`Successfully got distances for ${results.size} out of ${drivers.length} drivers`);
      return results;

    } catch (error: any) {
      logger.error('Batch distance calculation error:', error.message);
      
      // Fallback: Try individual requests if batch fails
      logger.info('Trying individual requests as fallback...');
      await this.getDistancesIndividually(pickupAddress, drivers, results);
      
      return results;
    }
  }

  /**
   * Fallback method: Get distances one by one
   */
  private async getDistancesIndividually(
    pickupAddress: string,
    drivers: Array<{ driverId: string; currentLocation: string }>,
    results: Map<string, DistanceMatrixResponse>
  ): Promise<void> {
    for (const driver of drivers) {
      try {
        const distanceInfo = await this.getDistanceAndTime(
          driver.currentLocation,
          pickupAddress
        );
        
        if (distanceInfo) {
          results.set(driver.driverId, distanceInfo);
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        logger.error(`Individual distance failed for driver ${driver.driverId}:`, error);
      }
    }
  }

  /**
   * Simple geocoding using OpenWeatherMap (optional - only if needed)
   */
  async geocodeAddress(address: string): Promise<Coordinates | null> {
    try {
      // Check cache first
      const cached = this.cache.get(address);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.coords;
      }

      // Try OpenWeatherMap geocoding
      const weatherApiKey = process.env.WEATHER_API_KEY || 'your_openweather_api_key';
      const response = await axios.get('http://api.openweathermap.org/geo/1.0/direct', {
        params: {
          q: address,
          limit: 1,
          appid: weatherApiKey
        },
        timeout: 5000
      });

      if (response.data && response.data.length > 0) {
        const coords = {
          lat: response.data[0].lat,
          lng: response.data[0].lon
        };
        
        // Cache the result
        this.cache.set(address, {
          coords,
          timestamp: Date.now()
        });
        
        logger.info(`Geocoded "${address}" to ${coords.lat},${coords.lng}`);
        return coords;
      }

      logger.warn(`Geocoding failed for: ${address}`);
      return null;
    } catch (error: any) {
      logger.error('Geocoding error:', error.message);
      return null;
    }
  }

  /**
   * Get distance using coordinates (if you have them)
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
}

export const locationService = new LocationService();