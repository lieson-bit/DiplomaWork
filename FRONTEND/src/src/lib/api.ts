import { MICROSERVICES_CONFIG } from '../config/environment';
// ==========================================
// Helper Functions
// ==========================================

export function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

export function setAuthToken(token: string) {
  localStorage.setItem('authToken', token);
}

export function clearAuthToken() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  localStorage.removeItem('userType');
  localStorage.removeItem('userId');
  localStorage.removeItem('driverId');
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

// ==========================================
// API Request Functions
// ==========================================

// Generic API request
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
    
    if (service === 'customer' && body && method !== 'GET' && method !== 'DELETE') {
      const currentUser = getCurrentUser();
      if (currentUser?.id && !body.userId) {
        body = { ...body, userId: currentUser.id };
      }
    }

    const url = `${baseUrl}${endpoint}`;
    const config: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET' && method !== 'DELETE') {
      config.body = JSON.stringify(body);
    }

    console.log(`🌐 ${method} ${url}`, body ? { body } : '');

    const response = await fetch(url, config);
    const data = await response.json();

    console.log(`📨 ${response.status} ${url}:`, data);

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
      // Extract error message safely
      let errorMsg = data.error || data.message || `HTTP ${response.status}`;
      if (typeof errorMsg === 'object') {
        errorMsg = errorMsg.message || JSON.stringify(errorMsg);
      }
      return {
        success: false,
        error: String(errorMsg),
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
    console.error('❌ API Error:', error);
    
    if (error.message.includes('Failed to fetch')) {
      return {
        success: false,
        error: `Cannot connect to ${service} service.`,
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

    const data = await response.json();

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
      // Extract error message safely
      let errorMsg = data.error || data.message || `HTTP ${response.status}`;
      if (typeof errorMsg === 'object') {
        errorMsg = errorMsg.message || JSON.stringify(errorMsg);
      }
      return {
        success: false,
        error: String(errorMsg),
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
        error: `Cannot connect to ${service} service.`,
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
    }
  },

  getCurrentUser: async () => {
    return makeRequest('/api/auth/profile', 'GET', undefined, 'user');
  },

   getUserById: async (userId: string) => {
    return makeRequest(`/api/users/${userId}`, 'GET', undefined, 'user');
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

  // In driverApi object
  updateStatus: async (data: { isOnline: boolean; location?: string }) => {
    return makeRequest('/api/drivers/status', 'PATCH', data, 'driver');
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

  deleteVehicle: async (vehicleId: string) => {
    return makeRequest(`/api/drivers/vehicles/${vehicleId}`, 'DELETE', undefined, 'driver');
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

  deleteDocument: async (documentId: string) => {
    return makeRequest(`/api/drivers/documents/${documentId}`, 'DELETE', undefined, 'driver');
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
    return makeRequest('/api/drivers/stats', 'GET', undefined, 'driver');
  },

  getEarnings: async (startDate?: string, endDate?: string) => {
    let url = '/api/drivers/earnings';
    if (startDate || endDate) {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      url += `?${params.toString()}`;
    }
    return makeRequest(url, 'GET', undefined, 'driver');
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
  uploadProfilePicture: async (formData: FormData) => {
    return makeUploadRequest('/api/customers/profile-picture', formData, 'customer');
  },
  addAddress: async (data: any) => {
    return makeRequest('/api/customers/addresses', 'POST', data, 'customer');
  },
  updateAddress: async (id: string, data: any) => {
    return makeRequest(`/api/customers/addresses/${id}`, 'PUT', data, 'customer');
  },
  // Get all addresses
  getAddresses: async () => {
    return makeRequest('/api/customers/addresses', 'GET', undefined, 'customer');
  },

  // Delete address
  deleteAddress: async (id: string) => {
    return makeRequest(`/api/customers/addresses/${id}`, 'DELETE', undefined, 'customer');
  },

  // Update preferences (optional but useful)
  updatePreferences: async (data: any) => {
    return makeRequest('/api/customers/preferences', 'PUT', data, 'customer');
  },

  // Get stats (member since, order count, etc.)
  getStats: async () => {
    return makeRequest('/api/customers/stats', 'GET', undefined, 'customer');
  },
};



// ==========================================
// Order Service API
// ==========================================

// Helper function for order requests
async function makeOrderRequest<T = any>(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  includeServiceSecret: boolean = false
): Promise<{
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  status?: number;
}> {
  try {
    const token = getAuthToken();
    const url = `http://localhost:3004${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (includeServiceSecret) {
      headers['x-service-secret'] = 'shared_service_secret_key_1234567890';
    }

    const config: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    console.log(`🌐 Order Service ${method} ${url}`);

    const response = await fetch(url, config);
    const data = await response.json();

    console.log(`📨 Order Service ${response.status}:`, data);

    if (response.status === 401) {
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
    console.error('❌ Order Service Error:', error);
    return {
      success: false,
      error: error.message || 'Network error',
      status: 0,
    };
  }
}

// Create orderApi object
const orderApi = {
  createOrder: async (data: any) => makeOrderRequest('/api/orders/receive', 'POST', data, true),
  getOrderProgress: async (orderId: string) => makeOrderRequest(`/api/orders/${orderId}/progress`, 'GET'),
  getOrderTracking: async (orderId: string) => makeOrderRequest(`/api/orders/${orderId}/tracking`, 'GET'),
  getOrderMessages: async (orderId: string) => makeOrderRequest(`/api/orders/${orderId}/messages`, 'GET'),
  sendMessage: async (orderId: string, content: string) => makeOrderRequest(`/api/orders/${orderId}/messages`, 'POST', { content }),
  rateDriver: async (orderId: string, rating: number, review?: string) => makeOrderRequest(`/api/orders/${orderId}/rate`, 'POST', { rating, review }),
  getBalance: async () => makeOrderRequest('/api/balance', 'GET'),
  getCustomerOrders: async (status?: string, page: number = 1, limit: number = 20) => {
    let url = `/api/customer/orders?page=${page}&limit=${limit}`;
    if (status) url += `&status=${status}`;
    return makeOrderRequest(url, 'GET');
  },
  getDriverOrders: async (status?: string, page: number = 1, limit: number = 20) => {
    let url = `/api/driver/orders?page=${page}&limit=${limit}`;
    if (status) url += `&status=${status}`;
    return makeOrderRequest(url, 'GET');
  },
  acceptOrder: async (orderId: string) => makeOrderRequest(`/api/orders/${orderId}/accept`, 'POST', {}),
  rejectOrder: async (orderId: string, reason?: string) => makeOrderRequest(`/api/orders/${orderId}/reject`, 'POST', { reason }),
  updateOrderStatus: async (orderId: string, status: string, location?: { lat: number; lng: number }) => 
    makeOrderRequest(`/api/orders/${orderId}/status`, 'PATCH', { status, location }),
  getOptimizedRoute: async () => makeOrderRequest('/api/driver/route/optimized', 'GET'),
  getNotifications: async (markAsRead: boolean = false) => {
    return makeOrderRequest(`/api/notifications?markAsRead=${markAsRead}`, 'GET');
  },
  
  markNotificationRead: async (notificationId: string) => {
    return makeOrderRequest(`/api/notifications/${notificationId}/read`, 'PATCH', {});
  },
  
  markAllNotificationsRead: async () => {
    return makeOrderRequest('/api/notifications/read-all', 'PATCH', {});
  },
  
  deleteNotification: async (notificationId: string) => {
    return makeOrderRequest(`/api/notifications/${notificationId}`, 'DELETE');
  },
};

// ==========================================
// EXPORTS - THIS IS THE IMPORTANT PART
// ==========================================

// Named export for orderApi (what you're trying to import)
export { orderApi };

// Default export with all APIs
export default {
  auth: authApi,
  driver: driverApi,
  customer: customerApi,
  order: orderApi,
};