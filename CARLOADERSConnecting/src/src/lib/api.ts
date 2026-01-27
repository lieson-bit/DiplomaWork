import { MICROSERVICES_CONFIG } from '../config/environment';

// Helper functions
export function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

export function setAuthToken(token: string) {
  localStorage.setItem('authToken', token);
}

export function clearAuthToken() {
  localStorage.removeItem('authToken');
}

export function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// Generic request function
async function makeRequest<T = any>(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  service: 'user' | 'driver' | 'customer' = 'user'
): Promise<{
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  status?: number;
}> {
  try {
    const token = getAuthToken();
    let baseUrl = '';
    
    // Determine base URL based on service
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
    }

    const url = `${baseUrl}${endpoint}`;
    const config: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET' && method !== 'DELETE') {
      config.body = JSON.stringify(body);
    }

    console.log(`🌐 API ${method} ${url}`);
    if (body) console.log('📦 Request body:', body);

    const response = await fetch(url, config);
    const responseText = await response.text();
    let data;
    
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { message: responseText };
    }

    console.log(`📨 Response ${response.status}:`, data);

    // Handle unauthorized
    if (response.status === 401) {
      clearAuthToken();
      return {
        success: false,
        error: 'Session expired. Please login again.',
        status: 401,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.message || `HTTP ${response.status}`,
        status: response.status,
      };
    }

    return {
      success: true,
      data: data.data || data,
      message: data.message,
      status: response.status,
    };
  } catch (error: any) {
    console.error('❌ API Request Error:', error);
    
    if (error.message.includes('Failed to fetch')) {
      return {
        success: false,
        error: `Cannot connect to ${service} service. Please make sure it's running on localhost:${service === 'user' ? '3001' : service === 'driver' ? '3002' : '3003'}.`,
        status: 0,
      };
    }
    
    return {
      success: false,
      error: error.message || 'Network error',
      status: 0,
    };
  }
}

// Upload function for FormData
async function makeUploadRequest<T = any>(
  endpoint: string,
  formData: FormData,
  service: 'user' | 'driver' | 'customer' = 'user'
): Promise<{
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  status?: number;
}> {
  try {
    const token = getAuthToken();
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

    const headers: HeadersInit = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${baseUrl}${endpoint}`;
    
    console.log(`📤 Upload to ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    const responseText = await response.text();
    let data;
    
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { message: responseText };
    }

    console.log(`📨 Upload response ${response.status}:`, data);

    if (response.status === 401) {
      clearAuthToken();
      return {
        success: false,
        error: 'Session expired. Please login again.',
        status: 401,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.message || `HTTP ${response.status}`,
        status: response.status,
      };
    }

    return {
      success: true,
      data: data.data || data,
      message: data.message,
      status: response.status,
    };
  } catch (error: any) {
    console.error('❌ Upload Error:', error);
    
    if (error.message.includes('Failed to fetch')) {
      return {
        success: false,
        error: `Cannot connect to ${service} service. Please make sure it's running.`,
        status: 0,
      };
    }
    
    return {
      success: false,
      error: error.message || 'Network error',
      status: 0,
    };
  }
}

// ==========================================
// AUTH API (User Service - Port 3001)
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
    const response = await makeRequest('/api/auth/register', 'POST', data, 'user');
    
    if (response.success && response.data?.tokens?.accessToken) {
      setAuthToken(response.data.tokens.accessToken);
      // Store user data
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('userType', response.data.user.userType);
        localStorage.setItem('userId', response.data.user.id);
      }
    }
    return response;
  },

  login: async (data: { email: string; password: string }) => {
    const response = await makeRequest('/api/auth/login', 'POST', data, 'user');
    
    if (response.success && response.data?.tokens?.accessToken) {
      setAuthToken(response.data.tokens.accessToken);
      // Store user data
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('userType', response.data.user.userType);
        localStorage.setItem('userId', response.data.user.id);
      }
    }
    return response;
  },

  logout: async () => {
    try {
      await makeRequest('/api/auth/logout', 'POST', undefined, 'user');
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      clearAuthToken();
      localStorage.removeItem('user');
      localStorage.removeItem('userType');
      localStorage.removeItem('userId');
      localStorage.removeItem('driverId');
    }
  },

  getCurrentUser: async () => {
    return makeRequest('/api/auth/profile', 'GET', undefined, 'user');
  },
};

// ==========================================
// DRIVER API (Driver Service - Port 3002) 
// ==========================================

export const driverApi = {
  // Profile
  getProfile: async () => {
    return makeRequest('/api/drivers/profile', 'GET', undefined, 'driver');
  },

  createProfile: async (data: {
    licenseNumber: string;
    licenseExpiry: string;
    insuranceNumber: string;
    insuranceExpiry: string;
  }) => {
    return makeRequest('/api/drivers/profile', 'POST', data, 'driver');
  },

  updateProfile: async (data: {
    licenseNumber?: string;
    licenseExpiry?: string;
    insuranceNumber?: string;
    insuranceExpiry?: string;
  }) => {
    return makeRequest('/api/drivers/profile', 'PUT', data, 'driver');
  },

  // Vehicles
  getVehicles: async () => {
    return makeRequest('/api/drivers/vehicles', 'GET', undefined, 'driver');
  },

  addVehicle: async (data: {
    type: string;
    make: string;
    model: string;
    year: number;
    color: string;
    licensePlate: string;
    maxWeight: number;
    maxVolume: number;
  }) => {
    return makeRequest('/api/drivers/vehicles', 'POST', data, 'driver');
  },

  updateVehicle: async (vehicleId: string, data: {
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    licensePlate?: string;
    maxWeight?: number;
    maxVolume?: number;
    insuranceInfo?: string;
  }) => {
    return makeRequest(`/api/drivers/vehicles/${vehicleId}`, 'PUT', data, 'driver');
  },

  // Uploads
  uploadVehicleImage: async (vehicleId: string, formData: FormData) => {
    return makeUploadRequest(`/api/drivers/vehicles/${vehicleId}/image`, formData, 'driver');
  },

  uploadProfilePicture: async (formData: FormData) => {
    return makeUploadRequest('/api/drivers/profile-picture', formData, 'driver');
  },

  // Documents
  uploadDocument: async (formData: FormData) => {
    return makeUploadRequest('/api/drivers/documents', formData, 'driver');
  },

  getDocuments: async () => {
    return makeRequest('/api/drivers/documents', 'GET', undefined, 'driver');
  },

  // Availability
  updateAvailability: async (isAvailable: boolean) => {
    return makeRequest('/api/drivers/availability', 'PUT', { isAvailable }, 'driver');
  },

  setAvailability: async (availability: any[]) => {
    return makeRequest('/api/drivers/availability', 'PUT', { availability }, 'driver');
  },

  getAvailability: async () => {
    return makeRequest('/api/drivers/availability', 'GET', undefined, 'driver');
  },

  // Stats
  getStats: async () => {
    const profile = await driverApi.getProfile();
    if (profile.success && profile.data) {
      return {
        success: true,
        data: {
          totalDeliveries: profile.data.totalDeliveries || 0,
          rating: profile.data.rating || 0,
          totalEarnings: profile.data.totalEarnings || 0,
          completionRate: profile.data.completionRate || 0
        }
      };
    }
    return { 
      success: false, 
      error: 'Failed to load stats',
      status: profile.status 
    };
  },
};

// ==========================================
// CUSTOMER API (Customer Service - Port 3003)
// ==========================================

export const customerApi = {
  getProfile: async () => {
    return makeRequest('/api/customers/profile', 'GET', undefined, 'customer');
  },

  createProfile: async (data: any) => {
    return makeRequest('/api/customers/profile', 'POST', data, 'customer');
  },

  updateProfile: async (data: any) => {
    return makeRequest('/api/customers/profile', 'PUT', data, 'customer');
  },
};

// ==========================================
// Export all APIs
// ==========================================

export default {
  auth: authApi,
  driver: driverApi,
  customer: customerApi,
};