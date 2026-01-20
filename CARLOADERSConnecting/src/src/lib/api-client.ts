// Base API client with interceptors and error handling

import { API_TIMEOUT } from '../config/environment';
import type { ApiResponse } from '../types';

interface RequestConfig extends RequestInit {
  timeout?: number;
}

class ApiClient {
  private async fetchWithTimeout(
    url: string,
    config: RequestConfig = {}
  ): Promise<Response> {
    const { timeout = API_TIMEOUT, ...fetchConfig } = config;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchConfig,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async request<T = any>(
    url: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = localStorage.getItem('authToken');
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...config.headers,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await this.fetchWithTimeout(url, {
        ...config,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || data.message || 'Request failed',
        };
      }

      return {
        success: true,
        data: data.data || data,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Request timeout',
          };
        }
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: 'An unknown error occurred',
      };
    }
  }

  async get<T = any>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'GET' });
  }

  async post<T = any>(
    url: string,
    body?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T = any>(
    url: string,
    body?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T = any>(
    url: string,
    body?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T = any>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
