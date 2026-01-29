import { Logger } from '../utils/logger';
import { DistanceUtil } from '../utils/distance.util';

export interface PricingRequest {
  pickupAddress: string;
  deliveryAddress: string;
  pickupLatLng?: { lat: number; lng: number };
  deliveryLatLng?: { lat: number; lng: number };
  weight: number; // in kg
  volume: number; // in m³
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  priority: 'low' | 'normal' | 'high' | 'urgent';
  isFragile: boolean;
  isTemperatureControlled: boolean;
  hasLiquid: boolean;
  scheduledPickup?: Date;
  timeWindow?: {
    start: Date;
    end: Date;
  };
}

export interface PricingResponse {
  basePrice: number;
  distanceFee: number;
  weightFee: number;
  volumeFee: number;
  rushFee: number;
  fuelSurcharge: number;
  specialHandlingFee: number;
  platformFee: number;
  platformFeePercent: number;
  subtotal: number;
  taxAmount: number;
  totalPrice: number;
  estimatedDistance: number; // in km
  estimatedDuration: number; // in minutes
  driverEarnings: number;
  breakdown: {
    item: string;
    amount: number;
    description: string;
  }[];
}

export interface PricingConfig {
  baseRate: number;
  distanceRate: number; // per km
  weightRate: number; // per kg
  volumeRate: number; // per m³
  priorityRates: {
    low: number;
    normal: number;
    high: number;
    urgent: number;
  };
  specialHandling: {
    fragile: number;
    temperatureControlled: number;
    liquid: number;
  };
  fuelSurchargePercent: number;
  platformFeePercent: number;
  taxRatePercent: number;
  minOrderValue: number;
  maxOrderValue: number;
}

export class PricingService {
  private logger = new Logger('PricingService');
  private distanceUtil: DistanceUtil;
  private config: PricingConfig;

  constructor(distanceUtil: DistanceUtil) {
    this.distanceUtil = distanceUtil;
    this.config = this.loadDefaultConfig();
  }

  async calculatePrice(request: PricingRequest): Promise<PricingResponse> {
    try {
      this.logger.info(`Calculating price for delivery from ${request.pickupAddress} to ${request.deliveryAddress}`);

      // Calculate distance and duration
      const { distance, duration } = await this.calculateDistanceAndDuration(request);

      // Calculate base price
      const basePrice = this.calculateBasePrice();

      // Calculate distance fee
      const distanceFee = this.calculateDistanceFee(distance);

      // Calculate weight fee
      const weightFee = this.calculateWeightFee(request.weight);

      // Calculate volume fee
      const volumeFee = this.calculateVolumeFee(request.volume);

      // Calculate rush fee based on priority
      const rushFee = this.calculateRushFee(request.priority, request.scheduledPickup);

      // Calculate special handling fees
      const specialHandlingFee = this.calculateSpecialHandlingFees(request);

      // Calculate fuel surcharge
      const fuelSurcharge = this.calculateFuelSurcharge(distanceFee + weightFee + volumeFee);

      // Calculate subtotal before platform fee
      const subtotal = basePrice + distanceFee + weightFee + volumeFee + rushFee + fuelSurcharge + specialHandlingFee;

      // Calculate platform fee
      const platformFee = this.calculatePlatformFee(subtotal);
      const platformFeePercent = this.config.platformFeePercent;

      // Calculate tax
      const taxAmount = this.calculateTax(subtotal);

      // Calculate total price
      const totalPrice = subtotal + platformFee + taxAmount;

      // Calculate driver earnings (total price minus platform fee)
      const driverEarnings = this.calculateDriverEarnings(totalPrice, platformFee, distanceFee, weightFee);

      // Prepare breakdown
      const breakdown = this.prepareBreakdown({
        basePrice,
        distanceFee,
        weightFee,
        volumeFee,
        rushFee,
        fuelSurcharge,
        specialHandlingFee,
        platformFee,
        taxAmount
      }, distance, request);

      // Validate against min/max order values
      this.validatePrice(totalPrice);

      return {
        basePrice,
        distanceFee,
        weightFee,
        volumeFee,
        rushFee,
        fuelSurcharge,
        specialHandlingFee,
        platformFee,
        platformFeePercent,
        subtotal,
        taxAmount,
        totalPrice,
        estimatedDistance: distance,
        estimatedDuration: duration,
        driverEarnings,
        breakdown
      };
    } catch (error) {
      this.logger.error('Error calculating price:', error);
      throw new Error(`Price calculation failed: ${error.message}`);
    }
  }

  async getPriceEstimate(request: PricingRequest): Promise<PricingResponse> {
    // Simplified version for quick estimates
    const response = await this.calculatePrice(request);
    
    // Round to 2 decimal places for estimate
    return {
      ...response,
      basePrice: Math.round(response.basePrice * 100) / 100,
      totalPrice: Math.round(response.totalPrice * 100) / 100,
      estimatedDistance: Math.round(response.estimatedDistance * 10) / 10,
      breakdown: response.breakdown.slice(0, 3) // Only show top 3 items in estimate
    };
  }

  updateConfig(newConfig: Partial<PricingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Pricing configuration updated');
  }

  getCurrentConfig(): PricingConfig {
    return { ...this.config };
  }

  private async calculateDistanceAndDuration(request: PricingRequest): Promise<{ distance: number; duration: number }> {
    try {
      // Use provided coordinates or geocode addresses
      const pickup = request.pickupLatLng || await this.distanceUtil.geocodeAddress(request.pickupAddress);
      const delivery = request.deliveryLatLng || await this.distanceUtil.geocodeAddress(request.deliveryAddress);

      if (!pickup || !delivery) {
        throw new Error('Could not determine coordinates for addresses');
      }

      // Calculate distance and estimated duration
      const distance = await this.distanceUtil.calculateDistance(pickup, delivery);
      const duration = await this.distanceUtil.estimateTravelTime(distance);

      return { distance, duration };
    } catch (error) {
      this.logger.warn('Failed to calculate exact distance, using estimate:', error);
      // Return conservative estimates if calculation fails
      return { distance: 10, duration: 30 }; // Default 10km, 30 minutes
    }
  }

  private calculateBasePrice(): number {
    return this.config.baseRate;
  }

  private calculateDistanceFee(distance: number): number {
    return distance * this.config.distanceRate;
  }

  private calculateWeightFee(weight: number): number {
    // First 5kg is free, then charge per kg
    const chargeableWeight = Math.max(0, weight - 5);
    return chargeableWeight * this.config.weightRate;
  }

  private calculateVolumeFee(volume: number): number {
    // First 0.1m³ is free, then charge per m³
    const chargeableVolume = Math.max(0, volume - 0.1);
    return chargeableVolume * this.config.volumeRate;
  }

  private calculateRushFee(priority: PricingRequest['priority'], scheduledPickup?: Date): number {
    const baseRate = this.config.priorityRates[priority];
    
    // Add extra for scheduled pickups outside business hours
    let rushFee = baseRate;
    if (scheduledPickup) {
      const hour = scheduledPickup.getHours();
      const isWeekend = scheduledPickup.getDay() === 0 || scheduledPickup.getDay() === 6;
      const isOutsideHours = hour < 8 || hour > 20; // 8am to 8pm
      
      if (isOutsideHours || isWeekend) {
        rushFee += baseRate * 0.5; // 50% extra for outside hours
      }
    }
    
    return rushFee;
  }

  private calculateSpecialHandlingFees(request: PricingRequest): number {
    let fees = 0;
    
    if (request.isFragile) {
      fees += this.config.specialHandling.fragile;
    }
    
    if (request.isTemperatureControlled) {
      fees += this.config.specialHandling.temperatureControlled;
    }
    
    if (request.hasLiquid) {
      fees += this.config.specialHandling.liquid;
    }
    
    return fees;
  }

  private calculateFuelSurcharge(baseAmount: number): number {
    return baseAmount * (this.config.fuelSurchargePercent / 100);
  }

  private calculatePlatformFee(subtotal: number): number {
    return subtotal * (this.config.platformFeePercent / 100);
  }

  private calculateTax(subtotal: number): number {
    return subtotal * (this.config.taxRatePercent / 100);
  }

  private calculateDriverEarnings(
    totalPrice: number,
    platformFee: number,
    distanceFee: number,
    weightFee: number
  ): number {
    // Driver gets: total price - platform fee + 100% of distance and weight fees
    return (totalPrice - platformFee) + distanceFee + weightFee;
  }

  private prepareBreakdown(
    fees: Record<string, number>,
    distance: number,
    request: PricingRequest
  ): PricingResponse['breakdown'] {
    const breakdown: PricingResponse['breakdown'] = [];

    if (fees.basePrice > 0) {
      breakdown.push({
        item: 'Base Delivery Fee',
        amount: fees.basePrice,
        description: 'Standard delivery service'
      });
    }

    if (fees.distanceFee > 0) {
      breakdown.push({
        item: 'Distance Fee',
        amount: fees.distanceFee,
        description: `${distance.toFixed(1)} km @ $${this.config.distanceRate}/km`
      });
    }

    if (fees.weightFee > 0) {
      breakdown.push({
        item: 'Weight Fee',
        amount: fees.weightFee,
        description: `${request.weight} kg @ $${this.config.weightRate}/kg (first 5kg free)`
      });
    }

    if (fees.volumeFee > 0) {
      breakdown.push({
        item: 'Volume Fee',
        amount: fees.volumeFee,
        description: `${request.volume} m³ @ $${this.config.volumeRate}/m³ (first 0.1m³ free)`
      });
    }

    if (fees.rushFee > 0) {
      breakdown.push({
        item: 'Priority Fee',
        amount: fees.rushFee,
        description: `${request.priority} priority delivery`
      });
    }

    if (fees.specialHandlingFee > 0) {
      breakdown.push({
        item: 'Special Handling',
        amount: fees.specialHandlingFee,
        description: 'Fragile/temperature-controlled items'
      });
    }

    if (fees.fuelSurcharge > 0) {
      breakdown.push({
        item: 'Fuel Surcharge',
        amount: fees.fuelSurcharge,
        description: `${this.config.fuelSurchargePercent}% of transportation fees`
      });
    }

    breakdown.push({
      item: 'Platform Fee',
      amount: fees.platformFee,
      description: `${this.config.platformFeePercent}% service fee`
    });

    if (fees.taxAmount > 0) {
      breakdown.push({
        item: 'Tax',
        amount: fees.taxAmount,
        description: `${this.config.taxRatePercent}% sales tax`
      });
    }

    return breakdown;
  }

  private validatePrice(totalPrice: number): void {
    if (totalPrice < this.config.minOrderValue) {
      throw new Error(`Order value ($${totalPrice.toFixed(2)}) is below minimum ($${this.config.minOrderValue.toFixed(2)})`);
    }

    if (totalPrice > this.config.maxOrderValue) {
      throw new Error(`Order value ($${totalPrice.toFixed(2)}) exceeds maximum ($${this.config.maxOrderValue.toFixed(2)})`);
    }
  }

  private loadDefaultConfig(): PricingConfig {
    return {
      baseRate: 5.00,
      distanceRate: 1.50, // $1.50 per km
      weightRate: 0.50,  // $0.50 per kg after first 5kg
      volumeRate: 10.00, // $10.00 per m³ after first 0.1m³
      priorityRates: {
        low: 0.00,
        normal: 0.00,
        high: 3.00,
        urgent: 7.00
      },
      specialHandling: {
        fragile: 2.00,
        temperatureControlled: 5.00,
        liquid: 1.00
      },
      fuelSurchargePercent: 5, // 5% of transportation fees
      platformFeePercent: 15,  // 15% platform fee
      taxRatePercent: 8.875,   // Example tax rate
      minOrderValue: 3.00,
      maxOrderValue: 1000.00
    };
  }
}