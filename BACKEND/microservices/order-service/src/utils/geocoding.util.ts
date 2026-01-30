import { Logger } from './logger';
import { HttpClient } from './httpClient';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeocodingResult {
  address: string;
  coordinates: Coordinates;
  formattedAddress: string;
  placeId: string;
  types: string[];
  components: AddressComponent[];
  precision: 'ROOFTOP' | 'RANGE_INTERPOLATED' | 'GEOMETRIC_CENTER' | 'APPROXIMATE';
}

export interface AddressComponent {
  longName: string;
  shortName: string;
  types: string[];
}

export interface ReverseGeocodingResult {
  address: string;
  coordinates: Coordinates;
  formattedAddress: string;
  placeId: string;
  types: string[];
}

export interface GeocodingOptions {
  language?: string;
  region?: string;
  bounds?: {
    northeast: Coordinates;
    southwest: Coordinates;
  };
}

export class GeocodingUtil {
  private logger: Logger;
  private httpClient: HttpClient;
  private apiKey: string;
  private apiUrl: string;
  private cache: Map<string, GeocodingResult>;

  constructor() {
    this.logger = new Logger('GeocodingUtil');
    this.httpClient = new HttpClient();
    this.apiKey = process.env.GEOCODING_API_KEY || '';
    this.apiUrl = process.env.GEOCODING_API_URL || 'https://maps.googleapis.com/maps/api/geocode';
    this.cache = new Map();
    
    if (!this.apiKey) {
      this.logger.warn('Geocoding API key not configured. Some features may not work.');
    }
  }

  /**
   * Convert address to coordinates
   */
  async geocode(
    address: string,
    options: GeocodingOptions = {}
  ): Promise<GeocodingResult | null> {
    try {
      this.logger.debug(`Geocoding address: ${address}`);

      // Check cache
      const cacheKey = this.getCacheKey(address, options);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug('Returning cached geocoding result');
        return cached;
      }

      if (!this.apiKey) {
        this.logger.warn('Cannot geocode without API key');
        return null;
      }

      const params: any = {
        address: address,
        key: this.apiKey
      };

      if (options.language) {
        params.language = options.language;
      }
      if (options.region) {
        params.region = options.region;
      }
      if (options.bounds) {
        params.bounds = `${options.bounds.southwest.lat},${options.bounds.southwest.lng}|${options.bounds.northeast.lat},${options.bounds.northeast.lng}`;
      }

      const response = await this.httpClient.get(`${this.apiUrl}/json`, {
        params,
        timeout: 10000
      });

      const result = this.parseGeocodingResponse(response.data, address);
      
      if (result) {
        this.cache.set(cacheKey, result);
        
        // Limit cache size
        if (this.cache.size > 1000) {
          const firstKey = this.cache.keys().next().value;
          if (firstKey !== undefined) {
            this.cache.delete(firstKey);
          }
        }
      }

      return result;
    } catch (error) {
      this.logger.error('Geocoding failed:', error);
      return null;
    }
  }

  /**
   * Batch geocode multiple addresses
   */
  async geocodeBatch(
    addresses: string[],
    options: GeocodingOptions = {}
  ): Promise<(GeocodingResult | null)[]> {
    try {
      this.logger.debug(`Batch geocoding ${addresses.length} addresses`);

      // Process in batches to avoid rate limiting
      const batchSize = 10;
      const results: (GeocodingResult | null)[] = [];
      
      for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        const batchPromises = batch.map(address => this.geocode(address, options));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Delay between batches to respect rate limits
        if (i + batchSize < addresses.length) {
          await this.delay(100);
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Batch geocoding failed:', error);
      return addresses.map(() => null);
    }
  }

  /**
   * Convert coordinates to address (reverse geocoding)
   */
  async reverseGeocode(
    coordinates: Coordinates,
    options: GeocodingOptions = {}
  ): Promise<ReverseGeocodingResult | null> {
    try {
      this.logger.debug(`Reverse geocoding: ${coordinates.lat}, ${coordinates.lng}`);

      const cacheKey = `reverse_${coordinates.lat}_${coordinates.lng}`;
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug('Returning cached reverse geocoding result');
        return {
          address: cached.address,
          coordinates: cached.coordinates,
          formattedAddress: cached.formattedAddress,
          placeId: cached.placeId,
          types: cached.types
        };
      }

      if (!this.apiKey) {
        this.logger.warn('Cannot reverse geocode without API key');
        return null;
      }

      const params: any = {
        latlng: `${coordinates.lat},${coordinates.lng}`,
        key: this.apiKey
      };

      if (options.language) {
        params.language = options.language;
      }

      const response = await this.httpClient.get(`${this.apiUrl}/json`, {
        params,
        timeout: 10000
      });

      const result = this.parseReverseGeocodingResponse(response.data, coordinates);
      
      if (result) {
        // Cache as forward geocoding result for future use
        const geocodingResult: GeocodingResult = {
          address: result.address,
          coordinates: result.coordinates,
          formattedAddress: result.formattedAddress,
          placeId: result.placeId,
          types: result.types,
          components: [],
          precision: 'APPROXIMATE'
        };
        this.cache.set(cacheKey, geocodingResult);
      }

      return result;
    } catch (error) {
      this.logger.error('Reverse geocoding failed:', error);
      return null;
    }
  }

  /**
   * Get coordinates for a place ID
   */
  async geocodePlaceId(placeId: string): Promise<Coordinates | null> {
    try {
      this.logger.debug(`Geocoding place ID: ${placeId}`);

      if (!this.apiKey) {
        this.logger.warn('Cannot geocode place ID without API key');
        return null;
      }

      const response = await this.httpClient.get(`${this.apiUrl}/json`, {
        params: {
          place_id: placeId,
          key: this.apiKey
        },
        timeout: 10000
      });

      const results = response.data.results;
      if (results && results.length > 0) {
        const location = results[0].geometry.location;
        return {
          lat: location.lat,
          lng: location.lng
        };
      }

      return null;
    } catch (error) {
      this.logger.error('Place ID geocoding failed:', error);
      return null;
    }
  }

  /**
   * Validate address format
   */
  validateAddress(address: string): boolean {
    if (!address || typeof address !== 'string') {
      return false;
    }

    const trimmed = address.trim();
    if (trimmed.length < 5) {
      return false;
    }

    // Basic validation - address should contain at least a number and street name
    const hasNumber = /\d/.test(trimmed);
    const hasLetters = /[a-zA-Z]/.test(trimmed);
    
    return hasNumber && hasLetters;
  }

  /**
   * Calculate distance between coordinates
   */
  calculateDistance(
    point1: Coordinates,
    point2: Coordinates,
    unit: 'km' | 'mi' = 'km'
  ): number {
    const R = unit === 'km' ? 6371 : 3959; // Earth's radius in km or miles
    const dLat = this.toRad(point2.lat - point1.lat);
    const dLon = this.toRad(point2.lng - point1.lng);
    const lat1 = this.toRad(point1.lat);
    const lat2 = this.toRad(point2.lat);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  /**
   * Check if coordinates are within a radius
   */
  isWithinRadius(
    center: Coordinates,
    point: Coordinates,
    radius: number,
    unit: 'km' | 'mi' = 'km'
  ): boolean {
    const distance = this.calculateDistance(center, point, unit);
    return distance <= radius;
  }

  /**
   * Get address components
   */
  extractAddressComponents(
    address: string,
    componentTypes: string[] = ['street_number', 'route', 'locality', 'administrative_area_level_1', 'postal_code', 'country']
  ): Record<string, string> {
    const components: Record<string, string> = {};

    // Simple parsing for common patterns
    if (address.includes(',')) {
      const parts = address.split(',').map(part => part.trim());
      
      if (parts.length >= 2) {
        components.street = parts[0];
        components.city = parts[1];
      }
      
      if (parts.length >= 3) {
        // Try to extract state and zip
        const stateZip = parts[2].trim();
        const stateZipMatch = stateZip.match(/([A-Z]{2})\s+(\d{5}(-\d{4})?)/);
        if (stateZipMatch) {
          components.state = stateZipMatch[1];
          components.zip = stateZipMatch[2];
        } else {
          components.state = stateZip;
        }
      }
    }

    return components;
  }

  /**
   * Format address for display
   */
  formatAddress(
    street?: string,
    city?: string,
    state?: string,
    zip?: string,
    country?: string
  ): string {
    const parts = [];

    if (street) parts.push(street);
    if (city) parts.push(city);
    
    const stateZip = [];
    if (state) stateZip.push(state);
    if (zip) stateZip.push(zip);
    if (stateZip.length > 0) parts.push(stateZip.join(' '));
    
    if (country) parts.push(country);

    return parts.join(', ');
  }

  /**
   * Clear geocoding cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.debug('Geocoding cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hits: number; misses: number } {
    // Note: This is a simplified version. In production, you'd track actual hits/misses.
    return {
      size: this.cache.size,
      hits: 0, // Would need to be tracked
      misses: 0 // Would need to be tracked
    };
  }

  private parseGeocodingResponse(data: any, originalAddress: string): GeocodingResult | null {
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      this.logger.warn(`Geocoding API error: ${data.status}`, data.error_message);
      return null;
    }

    const results = data.results;
    if (!results || results.length === 0) {
      this.logger.debug(`No results found for address: ${originalAddress}`);
      return null;
    }

    const result = results[0];
    const location = result.geometry.location;
    const addressComponents = this.parseAddressComponents(result.address_components);

    return {
      address: originalAddress,
      coordinates: {
        lat: location.lat,
        lng: location.lng
      },
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      types: result.types || [],
      components: addressComponents,
      precision: this.mapLocationType(result.geometry.location_type)
    };
  }

  private parseReverseGeocodingResponse(
    data: any,
    originalCoordinates: Coordinates
  ): ReverseGeocodingResult | null {
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      this.logger.warn(`Reverse geocoding API error: ${data.status}`, data.error_message);
      return null;
    }

    const results = data.results;
    if (!results || results.length === 0) {
      this.logger.debug(`No results found for coordinates: ${originalCoordinates.lat}, ${originalCoordinates.lng}`);
      return null;
    }

    const result = results[0];

    return {
      address: result.formatted_address,
      coordinates: originalCoordinates,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      types: result.types || []
    };
  }

  private parseAddressComponents(components: any[]): AddressComponent[] {
    if (!components || !Array.isArray(components)) {
      return [];
    }

    return components.map(component => ({
      longName: component.long_name,
      shortName: component.short_name,
      types: component.types || []
    }));
  }

  private mapLocationType(locationType: string): GeocodingResult['precision'] {
    const typeMap: Record<string, GeocodingResult['precision']> = {
      'ROOFTOP': 'ROOFTOP',
      'RANGE_INTERPOLATED': 'RANGE_INTERPOLATED',
      'GEOMETRIC_CENTER': 'GEOMETRIC_CENTER',
      'APPROXIMATE': 'APPROXIMATE'
    };

    return typeMap[locationType] || 'APPROXIMATE';
  }

  private getCacheKey(address: string, options: GeocodingOptions): string {
    const optionsStr = JSON.stringify(options);
    return `${address}_${optionsStr}`;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const geocodingUtil = new GeocodingUtil();