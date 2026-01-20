import axios, { AxiosInstance } from 'axios';
import logger from './logger';

class HttpClient {
  private static instance: HttpClient;
  private client: AxiosInstance;

  private constructor() {
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
        logger.debug(`HTTP Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('HTTP Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`HTTP Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        if (error.response) {
          logger.error(`HTTP Error: ${error.response.status} - ${error.config.url}`);
        } else if (error.request) {
          logger.error('HTTP No Response:', error.request);
        } else {
          logger.error('HTTP Error:', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  public static getInstance(): HttpClient {
    if (!HttpClient.instance) {
      HttpClient.instance = new HttpClient();
    }
    return HttpClient.instance;
  }

  public async get(url: string, config?: any) {
    return this.client.get(url, config);
  }

  public async post(url: string, data?: any, config?: any) {
    return this.client.post(url, data, config);
  }

  public async put(url: string, data?: any, config?: any) {
    return this.client.put(url, data, config);
  }

  public async patch(url: string, data?: any, config?: any) {
    return this.client.patch(url, data, config);
  }

  public async delete(url: string, config?: any) {
    return this.client.delete(url, config);
  }
}

export const httpClient = HttpClient.getInstance();
export default httpClient;