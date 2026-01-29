import { Logger } from './logger';

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationRule {
  field: string;
  rules: ValidationRuleItem[];
  required?: boolean;
  custom?: (value: any, data?: any) => boolean | string;
}

export interface ValidationRuleItem {
  type: ValidationRuleType;
  params?: any;
  message?: string;
}

export type ValidationRuleType =
  | 'required'
  | 'email'
  | 'phone'
  | 'minLength'
  | 'maxLength'
  | 'min'
  | 'max'
  | 'pattern'
  | 'url'
  | 'uuid'
  | 'date'
  | 'enum'
  | 'array'
  | 'object'
  | 'boolean'
  | 'number'
  | 'string'
  | 'latitude'
  | 'longitude'
  | 'postalCode'
  | 'creditCard'
  | 'json';

export class ValidationUtil {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ValidationUtil');
  }

  /**
   * Validate data against rules
   */
  validate(data: any, rules: ValidationRule[]): ValidationResult {
    const errors: ValidationError[] = [];

    for (const rule of rules) {
      const value = data[rule.field];
      const fieldErrors = this.validateField(value, rule, data);

      if (fieldErrors.length > 0) {
        errors.push(...fieldErrors);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate single field
   */
  private validateField(
    value: any,
    rule: ValidationRule,
    data?: any
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check required
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: rule.field,
        message: `${rule.field} is required`,
        code: 'REQUIRED'
      });
      return errors; // No need to check other rules if required field is missing
    }

    // Skip validation if value is empty and not required
    if (value === undefined || value === null || value === '') {
      return errors;
    }

    // Apply validation rules
    for (const ruleItem of rule.rules) {
      const isValid = this.applyRule(value, ruleItem, data);

      if (!isValid) {
        errors.push({
          field: rule.field,
          message: ruleItem.message || `${rule.field} is invalid`,
          value,
          code: ruleItem.type.toUpperCase()
        });
      }
    }

    // Apply custom validation
    if (rule.custom) {
      const customResult = rule.custom(value, data);
      if (customResult !== true) {
        errors.push({
          field: rule.field,
          message: typeof customResult === 'string' ? customResult : `${rule.field} is invalid`,
          value,
          code: 'CUSTOM'
        });
      }
    }

    return errors;
  }

  /**
   * Apply specific validation rule
   */
  private applyRule(value: any, rule: ValidationRuleItem, data?: any): boolean {
    switch (rule.type) {
      case 'required':
        return value !== undefined && value !== null && value !== '';
      
      case 'email':
        return this.validateEmail(value);
      
      case 'phone':
        return this.validatePhone(value);
      
      case 'minLength':
        return String(value).length >= (rule.params?.min || rule.params);
      
      case 'maxLength':
        return String(value).length <= (rule.params?.max || rule.params);
      
      case 'min':
        return Number(value) >= (rule.params?.min || rule.params);
      
      case 'max':
        return Number(value) <= (rule.params?.max || rule.params);
      
      case 'pattern':
        return new RegExp(rule.params).test(value);
      
      case 'url':
        return this.validateUrl(value);
      
      case 'uuid':
        return this.validateUuid(value);
      
      case 'date':
        return this.validateDate(value);
      
      case 'enum':
        return rule.params?.includes(value);
      
      case 'array':
        return Array.isArray(value);
      
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      
      case 'boolean':
        return typeof value === 'boolean';
      
      case 'number':
        return !isNaN(parseFloat(value)) && isFinite(value);
      
      case 'string':
        return typeof value === 'string';
      
      case 'latitude':
        return this.validateLatitude(value);
      
      case 'longitude':
        return this.validateLongitude(value);
      
      case 'postalCode':
        return this.validatePostalCode(value);
      
      case 'creditCard':
        return this.validateCreditCard(value);
      
      case 'json':
        return this.validateJson(value);
      
      default:
        return true;
    }
  }

  /**
   * Validate email address
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number (international format)
   */
  validatePhone(phone: string): boolean {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  /**
   * Validate URL
   */
  validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate UUID v4
   */
  validateUuid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate date
   */
  validateDate(date: any): boolean {
    if (date instanceof Date) {
      return !isNaN(date.getTime());
    }
    
    if (typeof date === 'string') {
      const parsed = new Date(date);
      return !isNaN(parsed.getTime());
    }
    
    return false;
  }

  /**
   * Validate latitude (-90 to 90)
   */
  validateLatitude(lat: number): boolean {
    return !isNaN(lat) && lat >= -90 && lat <= 90;
  }

  /**
   * Validate longitude (-180 to 180)
   */
  validateLongitude(lng: number): boolean {
    return !isNaN(lng) && lng >= -180 && lng <= 180;
  }

  /**
   * Validate postal code (basic US format)
   */
  validatePostalCode(zip: string): boolean {
    const usZipRegex = /^\d{5}(-\d{4})?$/;
    return usZipRegex.test(zip);
  }

  /**
   * Validate credit card using Luhn algorithm
   */
  validateCreditCard(cardNumber: string): boolean {
    // Remove non-digits
    const cleanNumber = cardNumber.replace(/\D/g, '');
    
    // Check length
    if (cleanNumber.length < 13 || cleanNumber.length > 19) {
      return false;
    }
    
    // Luhn algorithm
    let sum = 0;
    let double = false;
    
    for (let i = cleanNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cleanNumber.charAt(i));
      
      if (double) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      double = !double;
    }
    
    return sum % 10 === 0;
  }

  /**
   * Validate JSON string
   */
  validateJson(json: string): boolean {
    try {
      JSON.parse(json);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate order creation request
   */
  validateOrderCreation(data: any): ValidationResult {
    const rules: ValidationRule[] = [
      {
        field: 'customerId',
        required: true,
        rules: [
          { type: 'string', message: 'Customer ID must be a string' },
          { type: 'minLength', params: 1, message: 'Customer ID is required' }
        ]
      },
      {
        field: 'pickupAddress',
        required: true,
        rules: [
          { type: 'string', message: 'Pickup address must be a string' },
          { type: 'minLength', params: 5, message: 'Pickup address is too short' }
        ]
      },
      {
        field: 'deliveryAddress',
        required: true,
        rules: [
          { type: 'string', message: 'Delivery address must be a string' },
          { type: 'minLength', params: 5, message: 'Delivery address is too short' }
        ]
      },
      {
        field: 'pickupContactPhone',
        required: false,
        rules: [
          { type: 'phone', message: 'Invalid phone number format' }
        ]
      },
      {
        field: 'deliveryContactPhone',
        required: false,
        rules: [
          { type: 'phone', message: 'Invalid phone number format' }
        ]
      },
      {
        field: 'weight',
        required: false,
        rules: [
          { type: 'number', message: 'Weight must be a number' },
          { type: 'min', params: 0.1, message: 'Weight must be at least 0.1 kg' },
          { type: 'max', params: 1000, message: 'Weight cannot exceed 1000 kg' }
        ]
      },
      {
        field: 'priority',
        required: false,
        rules: [
          { type: 'enum', params: ['low', 'normal', 'high', 'urgent'], message: 'Priority must be low, normal, high, or urgent' }
        ]
      },
      {
        field: 'scheduledPickupAt',
        required: false,
        rules: [
          { type: 'date', message: 'Invalid date format' }
        ],
        custom: (value) => {
          if (value) {
            const date = new Date(value);
            const now = new Date();
            return date > now ? true : 'Scheduled pickup must be in the future';
          }
          return true;
        }
      }
    ];

    return this.validate(data, rules);
  }

  /**
   * Validate payment request
   */
  validatePaymentRequest(data: any): ValidationResult {
    const rules: ValidationRule[] = [
      {
        field: 'orderId',
        required: true,
        rules: [
          { type: 'string', message: 'Order ID must be a string' },
          { type: 'uuid', message: 'Invalid Order ID format' }
        ]
      },
      {
        field: 'customerId',
        required: true,
        rules: [
          { type: 'string', message: 'Customer ID must be a string' }
        ]
      },
      {
        field: 'amount',
        required: true,
        rules: [
          { type: 'number', message: 'Amount must be a number' },
          { type: 'min', params: 0.01, message: 'Amount must be greater than 0' }
        ]
      },
      {
        field: 'paymentMethod',
        required: true,
        rules: [
          { type: 'enum', params: ['card', 'wallet', 'cash', 'bank_transfer'], message: 'Invalid payment method' }
        ]
      }
    ];

    return this.validate(data, rules);
  }

  /**
   * Validate coordinates
   */
  validateCoordinates(lat: number, lng: number): ValidationResult {
    const errors: ValidationError[] = [];

    if (!this.validateLatitude(lat)) {
      errors.push({
        field: 'latitude',
        message: 'Latitude must be between -90 and 90',
        value: lat,
        code: 'INVALID_LATITUDE'
      });
    }

    if (!this.validateLongitude(lng)) {
      errors.push({
        field: 'longitude',
        message: 'Longitude must be between -180 and 180',
        value: lng,
        code: 'INVALID_LONGITUDE'
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate dimensions
   */
  validateDimensions(
    length: number,
    width: number,
    height: number,
    unit: 'cm' | 'm' | 'in' = 'cm'
  ): ValidationResult {
    const errors: ValidationError[] = [];

    const maxLength = unit === 'cm' ? 500 : unit === 'm' ? 5 : 200; // in inches

    if (!length || length <= 0) {
      errors.push({
        field: 'length',
        message: 'Length must be greater than 0',
        value: length,
        code: 'INVALID_LENGTH'
      });
    } else if (length > maxLength) {
      errors.push({
        field: 'length',
        message: `Length cannot exceed ${maxLength} ${unit}`,
        value: length,
        code: 'MAX_LENGTH_EXCEEDED'
      });
    }

    if (!width || width <= 0) {
      errors.push({
        field: 'width',
        message: 'Width must be greater than 0',
        value: width,
        code: 'INVALID_WIDTH'
      });
    } else if (width > maxLength) {
      errors.push({
        field: 'width',
        message: `Width cannot exceed ${maxLength} ${unit}`,
        value: width,
        code: 'MAX_WIDTH_EXCEEDED'
      });
    }

    if (!height || height <= 0) {
      errors.push({
        field: 'height',
        message: 'Height must be greater than 0',
        value: height,
        code: 'INVALID_HEIGHT'
      });
    } else if (height > maxLength) {
      errors.push({
        field: 'height',
        message: `Height cannot exceed ${maxLength} ${unit}`,
        value: height,
        code: 'MAX_HEIGHT_EXCEEDED'
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate pagination parameters
   */
  validatePagination(page: number, limit: number): ValidationResult {
    const errors: ValidationError[] = [];

    if (page !== undefined && page !== null) {
      if (!Number.isInteger(page) || page < 1) {
        errors.push({
          field: 'page',
          message: 'Page must be a positive integer',
          value: page,
          code: 'INVALID_PAGE'
        });
      }
    }

    if (limit !== undefined && limit !== null) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        errors.push({
          field: 'limit',
          message: 'Limit must be between 1 and 100',
          value: limit,
          code: 'INVALID_LIMIT'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize input string
   */
  sanitizeString(input: string): string {
    if (!input) return '';
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, ''); // Remove event handlers
  }

  /**
   * Sanitize object recursively
   */
  sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = this.sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Format validation errors for API response
   */
  formatErrors(errors: ValidationError[]): any[] {
    return errors.map(error => ({
      field: error.field,
      message: error.message,
      ...(error.value !== undefined && { value: error.value }),
      ...(error.code && { code: error.code })
    }));
  }
}

// Singleton instance
export const validationUtil = new ValidationUtil();