// Safe access to environment variables with fallbacks
const getEnvVar = (key: string, defaultValue: string): string => {
  try {
    // For Vite/React apps
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      return ((import.meta as any).env)[key] || defaultValue;
    }
    return defaultValue;
  } catch {
    return defaultValue;
  }
};

// Microservices configuration
export const MICROSERVICES_CONFIG = {
  USER_SERVICE: {
    baseUrl: getEnvVar('VITE_USER_SERVICE_URL', 'http://localhost:3001'),
  },
  DRIVER_SERVICE: {
    baseUrl: getEnvVar('VITE_DRIVER_SERVICE_URL', 'http://localhost:3002'),
  },
  CUSTOMER_SERVICE: {
    baseUrl: getEnvVar('VITE_CUSTOMER_SERVICE_URL', 'http://localhost:3003'),
  },
};

export const API_TIMEOUT = parseInt(getEnvVar('VITE_API_TIMEOUT', '30000')); // 30 seconds
export const ENABLE_MOCK_API = getEnvVar('VITE_ENABLE_MOCK_API', 'false') === 'true';
export const APP_ENV = getEnvVar('VITE_MODE', 'development');