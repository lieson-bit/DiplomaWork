import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { Logger } from './logger';

export class HttpClient {
  private client: AxiosInstance;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('HttpClient');
    this.client = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'x-service-secret': process.env.SERVICE_SECRET
      }
    });

    // Add request interceptor
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug(`Service call: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('Service call error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error: AxiosError) => {
        this.logger.error('Service call failed:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          statusText: error.response?.statusText
        });
        
        // Handle specific error cases
        if (error.code === 'ECONNABORTED') {
          throw new Error(`Service timeout after ${error.config?.timeout}ms`);
        }
        
        if (error.code === 'ENOTFOUND') {
          throw new Error(`Service not available: ${error.config?.baseURL || error.config?.url}`);
        }
        
        return Promise.reject(error);
      }
    );
  }

  async request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      return await this.client.request<T>(config);
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Service error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        throw new Error('Service not responding');
      } else {
        throw error;
      }
    }
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  // Helper methods for specific service calls
  async getCustomerDetails(customerId: string): Promise<any> {
    const response = await this.get(
      `${process.env.CUSTOMER_SERVICE_URL}/api/customers/${customerId}`
    );
    return response.data;
  }

  async getAvailableDrivers(lat: number, lng: number, radius: number = 10): Promise<any[]> {
    try {
      const response = await this.get(
        `${process.env.DRIVER_SERVICE_URL}/api/drivers/available`,
        { params: { lat, lng, radius } }
      );
      return response.data || [];
    } catch (error) {
      this.logger.warn('Failed to get available drivers, returning empty array:', error);
      return [];
    }
  }

  async getDriverVehicle(driverId: string): Promise<any> {
    try {
      const response = await this.get(
        `${process.env.DRIVER_SERVICE_URL}/api/drivers/${driverId}/vehicle`
      );
      return response.data;
    } catch (error) {
      this.logger.warn('Failed to get driver vehicle:', error);
      return null;
    }
  }

  async notifyDriverAssignment(driverId: string, orderId: string, orderDetails: any): Promise<void> {
    try {
      await this.post(
        `${process.env.DRIVER_SERVICE_URL}/api/drivers/${driverId}/notify`,
        {
          type: 'order_assigned',
          orderId,
          orderDetails
        }
      );
    } catch (error) {
      this.logger.warn('Failed to notify driver:', error);
    }
  }
}