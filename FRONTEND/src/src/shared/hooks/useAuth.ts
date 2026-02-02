// Authentication hook

import { useState, useEffect } from 'react';
import { userService } from '../../services';
import type { User } from '../../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setLoading(false);
      return;
    }

    const response = await userService.getProfile();
    if (response.success && response.data) {
      setUser(response.data);
    } else {
      localStorage.removeItem('authToken');
    }
    setLoading(false);
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    
    const response = await userService.login(email, password);
    
    if (response.success && response.data) {
      setUser(response.data.user);
      localStorage.setItem('authToken', response.data.token);
      setLoading(false);
      return true;
    } else {
      setError(response.error || 'Login failed');
      setLoading(false);
      return false;
    }
  };

  const logout = async () => {
    await userService.logout();
    setUser(null);
    localStorage.removeItem('authToken');
  };

  const register = async (data: any) => {
    setLoading(true);
    setError(null);
    
    const response = await userService.register(data);
    
    if (response.success && response.data) {
      setUser(response.data);
      setLoading(false);
      return true;
    } else {
      setError(response.error || 'Registration failed');
      setLoading(false);
      return false;
    }
  };

  return {
    user,
    loading,
    error,
    login,
    logout,
    register,
    isAuthenticated: !!user,
  };
}
