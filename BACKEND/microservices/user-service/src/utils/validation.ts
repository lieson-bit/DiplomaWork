import { RegisterDto, LoginDto } from '../types';

export class ValidationUtils {
  static validateRegister(data: RegisterDto): { isValid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Invalid email format');
    }

    // Password validation
    if (!PasswordUtils.validate(data.password)) {
      errors.push('Password must be at least 8 characters with uppercase, lowercase, and number');
    }

    // Name validation
    if (!data.firstName || data.firstName.trim().length < 2) {
      errors.push('First name must be at least 2 characters');
    }

    if (!data.lastName || data.lastName.trim().length < 2) {
      errors.push('Last name must be at least 2 characters');
    }

    // User type validation
    if (!['driver', 'customer'].includes(data.userType)) {
      errors.push('User type must be either "driver" or "customer"');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  static validateLogin(data: LoginDto): { isValid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!data.email) {
      errors.push('Email is required');
    }

    if (!data.password) {
      errors.push('Password is required');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

// Import PasswordUtils after declaration
import { PasswordUtils } from './password';