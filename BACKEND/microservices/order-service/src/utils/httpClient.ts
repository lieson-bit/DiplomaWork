// utils/httpClient.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
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
        this.logger.debug(`HTTP ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('HTTP request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.code === 'ECONNABORTED') {
          this.logger.error(`HTTP timeout: ${error.config?.url}`);
        } else if (error.code === 'ENOTFOUND') {
          this.logger.error(`HTTP DNS error: ${error.config?.url}`);
        } else if (error.response) {
          this.logger.error(`HTTP ${error.response.status}: ${error.config?.url}`);
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }
}