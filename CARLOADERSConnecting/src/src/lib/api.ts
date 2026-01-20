import { MICROSERVICES_CONFIG } from '../config/environment';
class ApiClient {
  private async request<T = any>(
    endpoint: string,
    method: string = 'GET',
    body?: any,
    service: 'user' | 'driver' | 'customer' = 'user'
  ): Promise<{ success: boolean; data?: T; error?: string; message?: string }> {
    try {
      const token = localStorage.getItem('authToken');
      let baseUrl = '';
    
      switch (service) {
        case 'user':
          baseUrl = MICROSERVICES_CONFIG.USER_SERVICE.baseUrl;
          break;
        case 'driver':
          baseUrl = MICROSERVICES_CONFIG.DRIVER_SERVICE.baseUrl;
          break;
        case 'customer':
          baseUrl = MICROSERVICES_CONFIG.CUSTOMER_SERVICE.baseUrl;
          break;
      }
    
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
    
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        console.warn('No auth token found for request to:', endpoint);
      }
    
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    
      const responseText = await response.text();
      let data;
      
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { message: responseText };
      }
    
      if (!response.ok) {
        // Handle 401 unauthorized (token expired or invalid)
        if (response.status === 401) {
          // Clear invalid token
          localStorage.removeItem('authToken');
          return {
            success: false,
            error: 'Session expired. Please login again.',
            message: 'Unauthorized'
          };
        }
        
        return {
          success: false,
          error: data.error || data.message || `HTTP ${response.status}`,
          message: data.message
        };
      }
    
      return {
        success: true,
        data: data.data || data,
        message: data.message
      };
    } catch (error: any) {
      console.error('API Request Error:', error);
      
      // Handle network errors
      if (error.message.includes('Failed to fetch')) {
        return {
          success: false,
          error: `Cannot connect to ${service} service at port ${service === 'user' ? '3001' : service === 'driver' ? '3002' : '3003'}. Please make sure the service is running.`,
        };
      }
      
      return {
        success: false,
        error: error.message || 'An unknown error occurred',
      };
    }
  }

  async get<T = any>(endpoint: string, service?: 'user' | 'driver' | 'customer') {
    return this.request<T>(endpoint, 'GET', undefined, service);
  }

  async post<T = any>(endpoint: string, body?: any, service?: 'user' | 'driver' | 'customer') {
    return this.request<T>(endpoint, 'POST', body, service);
  }

  async put<T = any>(endpoint: string, body?: any, service?: 'user' | 'driver' | 'customer') {
    return this.request<T>(endpoint, 'PUT', body, service);
  }

  async patch<T = any>(endpoint: string, body?: any, service?: 'user' | 'driver' | 'customer') {
    return this.request<T>(endpoint, 'PATCH', body, service);
  }

  async delete<T = any>(endpoint: string, service?: 'user' | 'driver' | 'customer') {
    return this.request<T>(endpoint, 'DELETE', undefined, service);
  }
}

export const apiClient = new ApiClient();

// Auth token management
export function setAuthToken(token: string) {
  localStorage.setItem('authToken', token);
}

export function clearAuthToken() {
  localStorage.removeItem('authToken');
}

export function getAuthToken() {
  return localStorage.getItem('authToken');
}

// ==========================================
// AUTH API (User Service)
// ==========================================

export const authApi = {
  register: async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    userType: 'driver' | 'customer';
    phone?: string;
  }) => {
    const response = await apiClient.post('/api/auth/register', data, 'user');
    console.log('Register response:', response); // Debug log
    if (response.success && response.data?.tokens?.accessToken) {
      setAuthToken(response.data.tokens.accessToken);
      // Store user data - check the actual response structure
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('userType', response.data.user.userType);
        localStorage.setItem('userId', response.data.user.id);
      } else if (response.data) {
        // Try alternative structure
        localStorage.setItem('user', JSON.stringify(response.data));
        localStorage.setItem('userType', response.data.userType);
        localStorage.setItem('userId', response.data.id);
      }
    }
    return response;
  },

  login: async (data: { email: string; password: string }) => {
    const response = await apiClient.post('/api/auth/login', data, 'user');
    console.log('Login response:', response); // Debug log
    if (response.success && response.data?.tokens?.accessToken) {
      setAuthToken(response.data.tokens.accessToken);
      // Store user data - check the actual response structure
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('userType', response.data.user.userType);
        localStorage.setItem('userId', response.data.user.id);
      } else if (response.data) {
        // Try alternative structure
        localStorage.setItem('user', JSON.stringify(response.data));
        localStorage.setItem('userType', response.data.userType);
        localStorage.setItem('userId', response.data.id);
      }
    }
    return response;
  },

  logout: async () => {
    try {
      await apiClient.post('/api/auth/logout', undefined, 'user');
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('userType');
      localStorage.removeItem('userId');
    }
  },

  getCurrentUser: async () => {
    return apiClient.get('/api/auth/profile', 'user');
  },

  refreshToken: async () => {
    const response = await apiClient.post('/api/auth/refresh-token', undefined, 'user');
    if (response.success && response.data?.tokens?.accessToken) {
      setAuthToken(response.data.tokens.accessToken);
    }
    return response;
  },
};

// ==========================================
// USER API (User Service)
// ==========================================

export const userApi = {
   getProfile: async () => {
    // Try /api/auth/profile first, then /api/users/profile
    const authResponse = await apiClient.get('/api/auth/profile', 'user');
    if (authResponse.success) {
      return authResponse;
    }
    // Fallback to /api/users/profile
    return apiClient.get('/api/users/profile', 'user');
  },

  updateProfile: async (data: any) => {
    return apiClient.put('/api/users/profile', data, 'user');
  },

  getAllUsers: async () => {
    return apiClient.get('/api/users', 'user');
  },

  getUserById: async (id: string) => {
    return apiClient.get(`/api/users/${id}`, 'user');
  },

  searchUsers: async (query: string) => {
    return apiClient.get(`/api/users/search?q=${encodeURIComponent(query)}`, 'user');
  },

  getUsersByType: async (type: 'driver' | 'customer') => {
    return apiClient.get(`/api/users/type/${type}`, 'user');
  },
};

// ==========================================
// DRIVER API (Driver Service)
// ==========================================

export const driverApi = {
  createProfile: async (data: any) => {
    return apiClient.post('/api/drivers/profile', data, 'driver');
  },

  getProfile: async () => {
    return apiClient.get('/api/drivers/profile', 'driver');
  },

  updateProfile: async (data: any) => {
    return apiClient.put('/api/drivers/profile', data, 'driver');
  },

  updateAvailability: async (isAvailable: boolean) => {
    return apiClient.put('/api/drivers/availability', { isAvailable }, 'driver');
  },

  getAvailability: async () => {
    return apiClient.get('/api/drivers/availability', 'driver');
  },

  updateStatus: async (status: 'available' | 'busy' | 'offline') => {
    return apiClient.patch('/api/drivers/status', { status }, 'driver');
  },

  addVehicle: async (data: any) => {
    return apiClient.post('/api/drivers/vehicles', data, 'driver');
  },

  getVehicles: async () => {
    return apiClient.get('/api/drivers/vehicles', 'driver');
  },

  uploadVehicleImage: async (vehicleId: string, formData: FormData) => {
    const token = getAuthToken();
    const response = await fetch(
      `${MICROSERVICES_CONFIG.DRIVER_SERVICE.baseUrl}/api/drivers/vehicles/${vehicleId}/image`,
      {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      }
    );
    
    const data = await response.json();
    return { success: response.ok, data, status: response.status };
  },

  getStats: async () => {
    return apiClient.get('/api/drivers/stats', 'driver');
  },

  uploadProfilePicture: async (formData: FormData) => {
    const token = getAuthToken();
    const response = await fetch(
      `${MICROSERVICES_CONFIG.DRIVER_SERVICE.baseUrl}/api/drivers/profile-picture`,
      {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      }
    );
    
    const data = await response.json();
    return { success: response.ok, data };
  },
  
  setAvailability: async (availability: any[]) => {
    return apiClient.put('/api/drivers/availability', { availability }, 'driver');
  },

  // For updating driver profile with additional fields
  updateProfileDetails: async (data: any) => {
    return apiClient.patch('/api/drivers/profile/details', data, 'driver');
  },

  getVerificationStatus: async () => {
    return apiClient.get('/api/drivers/verification-status', 'driver');
  },

  uploadDocument: async (formData: FormData): Promise<{
    success: boolean;
    data?: any;
    error?: string;
    status?: number;
    message?: string;
  }> => {
    try {
      const token = getAuthToken();
      
      if (!token) {
        console.error('❌ No auth token found');
        return { 
          success: false, 
          error: 'No authentication token found. Please login again.',
          data: null,
          status: 401
        };
      }

      console.log('🔐 Auth Token:', token.substring(0, 20) + '...');
      console.log('📤 Uploading document to:', `${MICROSERVICES_CONFIG.DRIVER_SERVICE.baseUrl}/api/drivers/documents`);
      
      // Debug FormData contents
      console.log('📋 FormData contents:');
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}:`, value.name, `(${value.type}, ${value.size} bytes)`);
        } else {
          console.log(`  ${key}:`, value);
        }
      }

      const response = await fetch(
        `${MICROSERVICES_CONFIG.DRIVER_SERVICE.baseUrl}/api/drivers/documents`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            // NOTE: Don't set Content-Type for FormData - browser does it automatically with boundary
          },
          body: formData,
        }
      );

      console.log('📨 Upload response status:', response.status, response.statusText);
      
      // Get response as text first to debug
      const responseText = await response.text();
      console.log('📄 Response text:', responseText);
      
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
        console.log('📊 Parsed response data:', data);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', parseError);
        console.log('Raw response:', responseText);
        data = { message: 'Invalid JSON response from server' };
      }

      if (!response.ok) {
        console.error('❌ Upload failed with status:', response.status);
        
        // Handle specific error codes
        if (response.status === 401) {
          localStorage.removeItem('authToken');
          return { 
            success: false, 
            error: 'Session expired. Please login again.',
            data: null,
            status: 401
          };
        }
        
        if (response.status === 413) {
          return { 
            success: false, 
            error: 'File too large. Maximum size is 5MB.',
            data: null,
            status: 413
          };
        }
        
        return { 
          success: response.ok, 
          error: data.error || data.message || `HTTP ${response.status}: ${response.statusText}`,
          data: data.data || data,
          status: response.status
        };
      }

      console.log('✅ Upload successful:', data);
      return { 
        success: true, 
        data: data.data || data,
        message: data.message,
        status: response.status
      };
      
    } catch (error: any) {
      console.error('🚨 Network error during upload:', error);
      
      // Handle network errors
      if (error.message.includes('Failed to fetch')) {
        return { 
          success: false, 
          error: `Cannot connect to driver service at ${MICROSERVICES_CONFIG.DRIVER_SERVICE.baseUrl}. Please make sure the service is running.`,
          data: null,
          status: 0
        };
      }
      
      return { 
        success: false, 
        error: error.message || 'Network error occurred',
        data: null,
        status: 0
      };
    }
  },

  getDocuments: async () => {
    return apiClient.get('/api/drivers/documents', 'driver');
  },
};

// ==========================================
// CUSTOMER API (Customer Service)
// ==========================================

export const customerApi = {
  createProfile: async (data: any) => {
    return apiClient.post('/api/customers/profile', data, 'customer');
  },

  getProfile: async () => {
    return apiClient.get('/api/customers/profile', 'customer');
  },

  updateProfile: async (data: any) => {
    return apiClient.put('/api/customers/profile', data, 'customer');
  },

  addAddress: async (data: any) => {
    return apiClient.post('/api/customers/addresses', data, 'customer');
  },

  getAddresses: async () => {
    return apiClient.get('/api/customers/addresses', 'customer');
  },

  updateAddress: async (id: string, data: any) => {
    return apiClient.put(`/api/customers/addresses/${id}`, data, 'customer');
  },

  deleteAddress: async (id: string) => {
    return apiClient.delete(`/api/customers/addresses/${id}`, 'customer');
  },

  addPaymentMethod: async (data: any) => {
    return apiClient.post('/api/customers/payment-methods', data, 'customer');
  },

  updatePreferences: async (data: any) => {
    return apiClient.put('/api/customers/preferences', data, 'customer');
  },

  getStats: async () => {
    return apiClient.get('/api/customers/stats', 'customer');
  },

  uploadProfilePicture: async (formData: FormData) => {
    const token = getAuthToken();
    const response = await fetch(
      `${MICROSERVICES_CONFIG.CUSTOMER_SERVICE.baseUrl}/api/customers/profile-picture`,
      {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      }
    );
    
    const data = await response.json();
    return { success: response.ok, data };
  },
};

// Export all APIs
export default {
  auth: authApi,
  user: userApi,
  driver: driverApi,
  customer: customerApi,
};

