import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from './logger';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const SERVICE_SECRET = process.env.SERVICE_SECRET || 'shared_service_secret_key';

export interface UserValidationResponse {
  valid: boolean;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    userType: string;
  };
}

export class HttpClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: USER_SERVICE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'x-service-secret': SERVICE_SECRET,
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`Making request to: ${config.baseURL}${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`Response from ${response.config.url}: ${response.status}`);
        return response;
      },
      (error: AxiosError) => {
        if (error.response) {
          logger.error(`Error response from ${error.config?.url}:`, {
            status: error.response.status,
            data: error.response.data,
          });
        } else if (error.request) {
          logger.error('No response received:', error.message);
        } else {
          logger.error('Request setup error:', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  async validateUser(userId: string): Promise<boolean> {
    try {
      const response = await this.client.get(
      `/api/auth/validate/${userId}`
    );
    
    if (response.data) {
      return response.data.valid === true;
    }else
      return response.data.valid === false
    } catch (error: any) {
      // If 404, user doesn't exist
      if (error.response?.status === 404) {
        logger.error(`User ${userId} not found`);
        return false;
      }

      // If 400/401, user invalid or inactive
      if (error.response?.status === 400 || error.response?.status === 401) {
        logger.error(`User ${userId} invalid or inactive`);
        return false;
      }

      logger.error('Failed to validate user:', error.message);
      return false;
    }
  }

  async getUser(userId: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/users/${userId}`);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get user:', error.message);
      throw new Error('User not found');
    }
  }

  async verifyToken(token: string): Promise<any> {
    try {
      const response = await this.client.post('/api/auth/verify-token', { token });
      return response.data;
    } catch (error: any) {
      logger.error('Failed to verify token:', error.message);
      throw new Error('Token verification failed');
    }
  }
}

export const httpClient = new HttpClient();