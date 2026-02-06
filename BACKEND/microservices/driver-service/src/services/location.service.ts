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

  constructor() {
    this.distanceMatrixApiKey = process.env.DISTANCE_MATRIX_API_KEY || 
      "NFLqNsgalupmIuzDS6zKuprvodMgjdaGAxBtGYNpOT9TUwnCnC4Z9Do6T2drMT4Y";
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
      logger.info(`📍 Getting distance from "${origin}" to "${destination}"`);
      
      const response = await axios.get('https://api.distancematrix.ai/maps/api/distancematrix/json', {
        params: {
          origins: origin,
          destinations: destination,
          mode: mode,
          key: this.distanceMatrixApiKey
        },
        timeout: 10000
      });

      logger.info(`DistanceMatrix.ai response status: ${response.data.status}`);
      
      if (response.data.status === 'OK' && 
          response.data.rows && 
          response.data.rows[0] && 
          response.data.rows[0].elements && 
          response.data.rows[0].elements[0] &&
          response.data.rows[0].elements[0].status === 'OK') {
        
        const element = response.data.rows[0].elements[0];
        logger.info(`✅ Distance: ${element.distance.text}, Duration: ${element.duration.text}`);
        
        return {
          distance: element.distance,
          duration: element.duration,
          status: 'OK'
        };
      } else {
        const errorStatus = response.data.rows?.[0]?.elements?.[0]?.status || response.data.status;
        logger.warn(`❌ Distance matrix failed: ${errorStatus}`);
        return null;
      }
    } catch (error: any) {
      logger.error('❌ Distance matrix error:', error.message);
      return null;
    }
  }

  /**
   * Calculate distance between coordinates using haversine formula
   */
  async calculateDistanceBetweenCoordinates(
    originCoords: Coordinates,
    destinationCoords: Coordinates
  ): Promise<number> {
    const R = 6371; // Earth's radius in kilometers
    const lat1 = originCoords.lat * Math.PI / 180;
    const lat2 = destinationCoords.lat * Math.PI / 180;
    const deltaLat = (destinationCoords.lat - originCoords.lat) * Math.PI / 180;
    const deltaLon = (destinationCoords.lng - originCoords.lng) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    logger.info(`📍 Coordinate distance: ${distanceKm.toFixed(2)} km`);
    
    return distanceKm;
  }

  /**
   * Estimate travel time based on distance and mode
   */
  estimateTravelTime(distanceKm: number, mode: string = 'driving'): number {
    let averageSpeedKmph = 30; // Default for driving in city
    
    switch (mode) {
      case 'walking':
        averageSpeedKmph = 5;
        break;
      case 'bicycling':
        averageSpeedKmph = 15;
        break;
      case 'transit':
        averageSpeedKmph = 20;
        break;
      case 'driving':
      default:
        averageSpeedKmph = 30;
    }

    const timeHours = distanceKm / averageSpeedKmph;
    const timeMinutes = timeHours * 60;
    
    logger.info(`⏱️ Estimated travel time: ${Math.ceil(timeMinutes)} minutes (${mode} at ${averageSpeedKmph} km/h)`);
    
    return timeMinutes;
  }

  /**
   * Format distance for display
   */
  formatDistance(distanceMeters: number): string {
    if (distanceMeters < 1000) {
      return `${Math.round(distanceMeters)} m`;
    } else {
      return `${(distanceMeters / 1000).toFixed(1)} km`;
    }
  }

  /**
   * Format duration for display
   */
  formatDuration(seconds: number): string {
    const minutes = Math.ceil(seconds / 60);
    if (minutes < 60) {
      return `${minutes} mins`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}`;
      } else {
        return `${hours}h ${remainingMinutes}m`;
      }
    }
  }
}

export const locationService = new LocationService();