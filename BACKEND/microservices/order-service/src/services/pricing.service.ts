import { Logger } from '../utils/logger';
import { distanceUtil } from '../utils/distance.util';

// Base interface for all pricing strategies
export interface PricingStrategy {
  calculatePrice(request: PricingRequest): Promise<PricingResult>;
  getName(): string;
}

// ML Pricing Strategy (for future implementation)
export class MLPricingStrategy implements PricingStrategy {
  private mlModel: any; // To be loaded from your trained model
  
  constructor() {
    // Initialize ML model
    // this.mlModel = loadModel('path/to/model');
  }
  
  async calculatePrice(request: PricingRequest): Promise<PricingResult> {
    // Extract features for ML model
    const features = this.extractFeatures(request);
    
    // Predict price using ML model
    // const predictedPrice = await this.mlModel.predict(features);
    
    // For now, use rule-based as fallback
    return new RuleBasedPricingStrategy().calculatePrice(request);
  }
  
  private extractFeatures(request: PricingRequest): any {
    return {
      distance: request.distance,
      weight: request.weight,
      volume: request.volume,
      hourOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      isWeekend: [0, 6].includes(new Date().getDay()),
      priority: request.priority,
      hasFragile: request.isFragile,
      hasTemperatureControl: request.isTemperatureControlled,
      areaType: this.determineAreaType(request.pickupLatLng, request.deliveryLatLng)
    };
  }
  
  private determineAreaType(pickup: any, delivery: any): string {
    // Determine urban/suburban/rural based on coordinates
    return 'urban'; // Simplified
  }
  
  getName(): string {
    return 'ML_Pricing';
  }
}

// Rule-based pricing strategy (current implementation)
export class RuleBasedPricingStrategy implements PricingStrategy {
  async calculatePrice(request: PricingRequest): Promise<PricingResult> {
    // Your existing rule-based calculation
    const config = this.getPricingConfig();
    
    const basePrice = config.baseRate;
    const distanceFee = request.distance * config.distanceRate;
    const weightFee = Math.max(0, request.weight - 5) * config.weightRate;
    const volumeFee = Math.max(0, request.volume - 0.1) * config.volumeRate;
    const rushFee = config.priorityRates[request.priority];
    
    // ... rest of calculation
    return this.formatResult(basePrice, distanceFee, weightFee, volumeFee, rushFee, request);
  }
  formatResult(basePrice: number, distanceFee: number, weightFee: number, volumeFee: number, rushFee: number, request: PricingRequest): PricingResult | PromiseLike<PricingResult> {
    throw new Error('Method not implemented.');
  }
  
  private getPricingConfig() {
    return {
      baseRate: 5.00,
      distanceRate: 1.50,
      weightRate: 0.50,
      volumeRate: 10.00,
      priorityRates: {
        low: 0.00,
        normal: 0.00,
        high: 3.00,
        urgent: 7.00
      }
    };
  }
  
  getName(): string {
    return 'Rule_Based_Pricing';
  }
}

// Main Pricing Service with strategy pattern
export class PricingService {
  private logger = new Logger('PricingService');
  private currentStrategy: PricingStrategy;
  private strategies: Map<string, PricingStrategy> = new Map();
  
  constructor() {
    // Initialize strategies
    this.strategies.set('rule_based', new RuleBasedPricingStrategy());
    this.strategies.set('ml', new MLPricingStrategy());
    
    // Default to rule-based
    this.currentStrategy = this.strategies.get('rule_based')!;
  }
  
  // Main method - abstracts strategy
  async calculatePrice(request: {
    pickupAddress: string;
    deliveryAddress: string;
    pickupLatLng: { lat: number; lng: number };
    deliveryLatLng: { lat: number; lng: number };
    weight: number;
    volume: number;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    isFragile?: boolean;
    isTemperatureControlled?: boolean;
    hasLiquid?: boolean;
  }): Promise<PricingResult> {
    try {
      // Calculate distance
      const distance = distanceUtil.calculateHaversineDistance(
        request.pickupLatLng,
        request.deliveryLatLng
      );
      
      // Prepare request for strategy
      const pricingRequest: PricingRequest = {
        ...request,
        distance,
        timestamp: new Date()
      };
      
      // Use current strategy
      const result = await this.currentStrategy.calculatePrice(pricingRequest);
      
      // Log which strategy was used
      this.logger.debug(`Pricing calculated using: ${this.currentStrategy.getName()}`);
      
      return result;
    } catch (error) {
      this.logger.error('Price calculation failed:', error);
      return this.getFallbackPrice();
    }
  }
  
  // Switch pricing strategy at runtime
  setStrategy(strategyName: string): void {
    const strategy = this.strategies.get(strategyName);
    if (strategy) {
      this.currentStrategy = strategy;
      this.logger.info(`Switched to pricing strategy: ${strategyName}`);
    } else {
      this.logger.warn(`Unknown pricing strategy: ${strategyName}`);
    }
  }
  
  // Get current strategy
  getCurrentStrategy(): string {
    return this.currentStrategy.getName();
  }
  
  // Add new strategy dynamically (for ML model updates)
  addStrategy(name: string, strategy: PricingStrategy): void {
    this.strategies.set(name, strategy);
    this.logger.info(`Added new pricing strategy: ${name}`);
  }
  
  // Fallback pricing
  private getFallbackPrice(): PricingResult {
    return {
      basePrice: 5.00,
      distanceFee: 10.00,
      weightFee: 2.50,
      volumeFee: 5.00,
      rushFee: 0,
      fuelSurcharge: 1.00,
      specialHandlingFee: 0,
      platformFee: 3.45,
      platformFeePercent: 15,
      subtotal: 18.50,
      taxAmount: 1.64,
      totalPrice: 20.14,
      estimatedDistance: 10,
      estimatedDuration: 30,
      driverEarnings: 16.69,
      pricingStrategy: 'fallback',
      confidence: 0.0
    };
  }
}

// Types for ML integration
export interface PricingRequest {
  distance: number;
  weight: number;
  volume: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  isFragile?: boolean;
  isTemperatureControlled?: boolean;
  hasLiquid?: boolean;
  timestamp: Date;
  pickupLatLng: { lat: number; lng: number };
  deliveryLatLng: { lat: number; lng: number };
}

export interface PricingResult {
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
  estimatedDistance: number;
  estimatedDuration: number;
  driverEarnings: number;
  pricingStrategy?: string;
  confidence?: number; // For ML predictions
  features?: any; // Features used for prediction
}