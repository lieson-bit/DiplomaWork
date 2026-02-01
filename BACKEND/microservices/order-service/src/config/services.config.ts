import { Logger } from '../utils/logger'; // Changed from 'logger' to 'Logger'

export interface ServiceConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  headers: Record<string, string>;
}

export interface ServiceEndpoints {
  [key: string]: string;
}

class ServicesConfig {
  private config: Record<string, ServiceConfig> = {};
  private endpoints: Record<string, ServiceEndpoints> = {};
  private logger: Logger; // Add logger instance

  constructor() {
    this.logger = new Logger('ServicesConfig'); // Initialize logger
    this.initializeConfig();
  }

  private initializeConfig() {
    // User Service Configuration
    this.config.userService = {
      baseUrl: process.env.USER_SERVICE_URL || 'http://localhost:3001',
      timeout: parseInt(process.env.USER_SERVICE_TIMEOUT || '10000'),
      retries: parseInt(process.env.USER_SERVICE_RETRIES || '3'),
      headers: {
        'Content-Type': 'application/json',
        'x-service-secret': process.env.SERVICE_SECRET || 'shared_service_secret'
      }
    };

    this.endpoints.userService = {
      validateUser: '/api/auth/validate/:userId',
      getUser: '/api/users/:id',
      getUserProfile: '/api/users/profile',
      updateUser: '/api/users/:id',
      sendNotification: '/api/notifications'
    };

    // Driver Service Configuration
    this.config.driverService = {
      baseUrl: process.env.DRIVER_SERVICE_URL || 'http://localhost:3002',
      timeout: parseInt(process.env.DRIVER_SERVICE_TIMEOUT || '10000'),
      retries: parseInt(process.env.DRIVER_SERVICE_RETRIES || '3'),
      headers: {
        'Content-Type': 'application/json',
        'x-service-secret': process.env.SERVICE_SECRET || 'shared_service_secret'
      }
    };

    this.endpoints.driverService = {
      getAvailableDrivers: '/api/drivers/available',
      getDriverProfile: '/api/drivers/profile',
      getDriverVehicles: '/api/drivers/vehicles',
      updateDriverBalance: '/api/internal/balance/update',
      getDriverBalance: '/api/internal/balance/:driverId',
      notifyDriver: '/api/drivers/notify',
      updateDriverLocation: '/api/drivers/location',
      updateDriverStatus: '/api/drivers/status'
    };

    // Customer Service Configuration
    this.config.customerService = {
      baseUrl: process.env.CUSTOMER_SERVICE_URL || 'http://localhost:3003',
      timeout: parseInt(process.env.CUSTOMER_SERVICE_TIMEOUT || '10000'),
      retries: parseInt(process.env.CUSTOMER_SERVICE_RETRIES || '3'),
      headers: {
        'Content-Type': 'application/json',
        'x-service-secret': process.env.SERVICE_SECRET || 'shared_service_secret'
      }
    };

    this.endpoints.customerService = {
      getCustomerProfile: '/api/customers/profile',
      getCustomerAddresses: '/api/customers/addresses',
      updateCustomerBalance: '/api/internal/balance/update',
      getCustomerBalance: '/api/internal/balance/:customerId',
      notifyCustomer: '/api/customers/notify'
    };

    this.logger.info('Services configuration loaded');
  }

  getServiceConfig(serviceName: string): ServiceConfig {
    const config = this.config[serviceName];
    if (!config) {
      this.logger.error(`Service configuration not found for: ${serviceName}`);
      throw new Error(`Service configuration not found for: ${serviceName}`);
    }
    return config;
  }

  getServiceEndpoint(serviceName: string, endpointName: string): string {
    const endpoints = this.endpoints[serviceName];
    if (!endpoints) {
      this.logger.error(`Service endpoints not found for: ${serviceName}`);
      throw new Error(`Service endpoints not found for: ${serviceName}`);
    }
    
    const endpoint = endpoints[endpointName];
    if (!endpoint) {
      this.logger.error(`Endpoint not found: ${endpointName} for service: ${serviceName}`);
      throw new Error(`Endpoint not found: ${endpointName} for service: ${serviceName}`);
    }
    
    return endpoint;
  }

  buildUrl(serviceName: string, endpointName: string, params?: Record<string, any>): string {
    const config = this.getServiceConfig(serviceName);
    let endpoint = this.getServiceEndpoint(serviceName, endpointName);
    
    // Replace path parameters
    if (params) {
      Object.keys(params).forEach(key => {
        endpoint = endpoint.replace(`:${key}`, params[key]);
      });
    }
    
    return `${config.baseUrl}${endpoint}`;
  }

  // Helper methods for specific services
  getUserServiceUrl(endpoint: string, params?: Record<string, any>): string {
    return this.buildUrl('userService', endpoint, params);
  }

  getDriverServiceUrl(endpoint: string, params?: Record<string, any>): string {
    return this.buildUrl('driverService', endpoint, params);
  }

  getCustomerServiceUrl(endpoint: string, params?: Record<string, any>): string {
    return this.buildUrl('customerService', endpoint, params);
  }

  // Service health check URLs
  getServiceHealthUrls(): Record<string, string> {
    return {
      userService: `${this.config.userService.baseUrl}/health`,
      driverService: `${this.config.driverService.baseUrl}/health`,
      customerService: `${this.config.customerService.baseUrl}/health`,
      orderService: process.env.APP_URL ? `${process.env.APP_URL}/health` : 'http://localhost:3004/health'
    };
  }

  // Check if all required services are configured
  validateConfiguration(): boolean {
    const requiredServices = ['userService', 'driverService', 'customerService'];
    
    for (const service of requiredServices) {
      if (!this.config[service]) {
        this.logger.error(`Missing configuration for service: ${service}`);
        return false;
      }
      
      const baseUrl = this.config[service].baseUrl;
      if (!baseUrl || baseUrl === 'http://localhost:3000') {
        this.logger.warn(`Service ${service} is using default localhost URL: ${baseUrl}`);
      }
    }
    
    return true;
  }
}

// Create singleton instance
export const servicesConfig = new ServicesConfig();

// Export for direct use
export default servicesConfig;