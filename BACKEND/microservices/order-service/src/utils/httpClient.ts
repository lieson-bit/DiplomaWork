import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { Logger } from './logger';

export interface HttpClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  withCredentials?: boolean;
}

export interface RequestConfig extends AxiosRequestConfig {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface Response<T = any> {
  status: number;
  statusText: string;
  headers: any;
  data: T;
  config: RequestConfig;
}

export class HttpClient {
  private client: AxiosInstance;
  private logger: Logger;
  private defaultConfig: HttpClientConfig;

  constructor(config: HttpClientConfig = {}) {
    this.logger = new Logger('HttpClient');
    this.defaultConfig = {
      timeout: 30000, // 30 seconds default timeout
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      ...config
    };

    this.client = axios.create(this.defaultConfig);

    // Add request interceptor
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug(`Request: ${config.method?.toUpperCase()} ${config.url}`);
        if (config.data && !(config.data instanceof FormData)) {
          this.logger.debug('Request data:', JSON.stringify(config.data));
        }
        return config;
      },
      (error) => {
        this.logger.error('Request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug(`Response: ${response.status} ${response.config.url}`);
        return response;
      },
      async (error: AxiosError) => {
        this.logger.error('Response error:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
        
        // Handle specific error cases
        if (error.code === 'ECONNABORTED') {
          throw new Error(`Request timeout after ${error.config?.timeout}ms`);
        }
        
        if (error.code === 'ENOTFOUND') {
          throw new Error(`Unable to connect to ${error.config?.baseURL || error.config?.url}`);
        }
        
        return Promise.reject(error);
      }
    );
  }

  async request<T = any>(config: RequestConfig): Promise<Response<T>> {
    const {
      retries = 3,
      retryDelay = 1000,
      ...axiosConfig
    } = config;

    let lastError: any;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.client.request<T>(axiosConfig);
        return {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data,
          config: config
        };
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on 4xx errors (except 429 - rate limiting)
        if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
          throw this.formatError(error);
        }
        
        // Don't retry on non-retryable errors
        if (this.isNonRetryableError(error)) {
          throw this.formatError(error);
        }
        
        if (attempt < retries) {
          const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          this.logger.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt}/${retries})`);
          await this.delay(delay);
        }
      }
    }
    
    throw this.formatError(lastError);
  }

  async get<T = any>(url: string, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>({
      method: 'GET',
      url,
      ...config
    });
  }

  async post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>({
      method: 'POST',
      url,
      data,
      ...config
    });
  }

  async put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>({
      method: 'PUT',
      url,
      data,
      ...config
    });
  }

  async patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>({
      method: 'PATCH',
      url,
      data,
      ...config
    });
  }

  async delete<T = any>(url: string, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>({
      method: 'DELETE',
      url,
      ...config
    });
  }

  async uploadFile<T = any>(
    url: string, 
    file: File | Buffer, 
    fieldName: string = 'file',
    additionalData: Record<string, any> = {},
    config?: RequestConfig
  ): Promise<Response<T>> {
    const formData = new FormData();
    
    if (file instanceof File) {
      formData.append(fieldName, file);
    } else {
      const blob = new Blob([file]);
      formData.append(fieldName, blob, 'upload.xlsx');
    }
    
    // Append additional data
    Object.entries(additionalData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value.toString());
      }
    });
    
    return this.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      ...config
    });
  }

  async downloadFile(url: string, config?: RequestConfig): Promise<Buffer> {
    const response = await this.request<ArrayBuffer>({
      method: 'GET',
      url,
      responseType: 'arraybuffer',
      ...config
    });
    
    return Buffer.from(response.data);
  }

  setBaseURL(baseURL: string): void {
    this.client.defaults.baseURL = baseURL;
  }

  setHeader(key: string, value: string): void {
    this.client.defaults.headers.common[key] = value;
  }

  removeHeader(key: string): void {
    delete this.client.defaults.headers.common[key];
  }

  setAuthToken(token: string, type: string = 'Bearer'): void {
    this.setHeader('Authorization', `${type} ${token}`);
  }

  clearAuthToken(): void {
    this.removeHeader('Authorization');
  }

  setTimeout(timeout: number): void {
    this.client.defaults.timeout = timeout;
  }

  private formatError(error: AxiosError): Error {
    if (error.response) {
      // Server responded with error
      const status = error.response.status;
      const data = error.response.data;
      
      let message = `HTTP ${status}`;
      if (data && typeof data === 'object') {
        if (data.message) {
          message = data.message;
        } else if (data.error) {
          message = data.error;
        }
      } else if (data && typeof data === 'string') {
        message = data;
      }
      
      const formattedError = new Error(message);
      (formattedError as any).status = status;
      (formattedError as any).data = data;
      return formattedError;
    } else if (error.request) {
      // Request made but no response
      return new Error('No response received from server');
    } else {
      // Error setting up request
      return error;
    }
  }

  private isNonRetryableError(error: any): boolean {
    // Don't retry on these status codes
    const nonRetryableStatuses = [400, 401, 403, 404, 409, 422];
    
    if (error.response?.status && nonRetryableStatuses.includes(error.response.status)) {
      return true;
    }
    
    // Don't retry on network errors that are unlikely to succeed
    if (error.code && ['ENOTFOUND', 'ECONNREFUSED'].includes(error.code)) {
      return true;
    }
    
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance for global use
export const httpClient = new HttpClient();