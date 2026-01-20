import axios from 'axios';

const API_BASE_URL = 'http://localhost:3002';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const DriverAPI = {
  // Profile Management
  getProfile: () => api.get('/api/drivers/profile'),
  
  createProfile: (payload: any) => api.post('/api/drivers/profile', payload),
  
  updateProfile: (payload: any) => api.put('/api/drivers/profile', payload),
  
  // Vehicle Management
  addVehicle: (payload: any) => api.post('/api/drivers/vehicles', payload),
  
  listVehicles: () => api.get('/api/drivers/vehicles'),
  
  uploadVehicleImage: (vehicleId: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post(`/api/drivers/vehicles/${vehicleId}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  // Document Management
  uploadDocument: (formData: FormData) => 
    api.post('/api/drivers/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  
  listDocuments: () => api.get('/api/drivers/documents'),
  
  // Availability Management
  setAvailability: (payload: any) => api.put('/api/drivers/availability', payload),
  
  getAvailability: () => api.get('/api/drivers/availability'),
  
  // Status Management
  updateStatus: (payload: any) => api.patch('/api/drivers/status', payload),
  
  getStats: () => api.get('/api/drivers/stats'),
  
  getVerificationStatus: () => api.get('/api/drivers/verification-status'),
};

export default DriverAPI;