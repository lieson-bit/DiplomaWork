// Simple auth utilities
export function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function isDriver() {
  const user = getCurrentUser();
  return user && user.userType === 'driver';
}

export function isCustomer() {
  const user = getCurrentUser();
  return user && user.userType === 'customer';
}

export function isAuthenticated() {
  return !!localStorage.getItem('authToken') && !!getCurrentUser();
}