// Helper functions for auth management
export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const getCurrentUserType = (): 'driver' | 'customer' | null => {
  return localStorage.getItem('userType') as 'driver' | 'customer';
};

export const getCurrentUserId = (): string | null => {
  return localStorage.getItem('userId');
};

export const storeUserData = (user: any) => {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('userType', user.userType);
  localStorage.setItem('userId', user.id);
};

export const clearUserData = () => {
  localStorage.removeItem('user');
  localStorage.removeItem('userType');
  localStorage.removeItem('userId');
  localStorage.removeItem('authToken');
};