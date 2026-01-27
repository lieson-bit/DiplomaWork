import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';
import { getCurrentUser } from '../lib/auth-utils';

export const useDriverProfile = () => {
  const [driverData, setDriverData] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDriverProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('👤 Loading driver profile...');
      
      // 🔴 FIX: Typo was "getp()" → should be "getProfile()"
      const profileResponse = await api.driver.getProfile();
      console.log('📨 Profile API response:', profileResponse);
      
      if (!profileResponse.success) {
        const errorMsg = profileResponse.error || 'Failed to load driver profile';
        
        // Handle "not found" gracefully (onboarding state)
        if (
          errorMsg.toLowerCase().includes('not found') ||
          errorMsg.includes('No profile') ||
          profileResponse.status === 404
        ) {
          console.log('ℹ️ No driver profile found yet — showing onboarding');
          setDriverData(null);
          setVehicles([]);
        } else {
          setError(errorMsg);
          toast.error(`Profile load failed: ${errorMsg}`);
        }
        setLoading(false);
        return;
      }

      // ✅ Success: Set full driver data
      console.log('✅ Driver profile loaded:', profileResponse.data);
      setDriverData(profileResponse.data);

      // Load vehicles
      const vehiclesResponse = await api.driver.getVehicles();
      if (vehiclesResponse.success) {
        console.log('🚗 Vehicles loaded:', vehiclesResponse.data);
        setVehicles(vehiclesResponse.data || []);
      } else {
        console.warn('⚠️ Failed to load vehicles:', vehiclesResponse.error);
        setVehicles([]);
      }

      setError(null);
    } catch (err: any) {
      const message = err.message || 'Unknown error loading profile';
      console.error('❌ Error loading driver profile:', err);
      setError(message);
      toast.error(`Failed to load profile: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDriverProfile();
  }, [loadDriverProfile]);

  // ✅ Update driver profile (license/insurance only)
  const updateProfile = async (data: any) => {
    try {
      const response = await api.driver.updateProfile(data);
      if (response.success) {
        await loadDriverProfile(); // Refresh full state
        toast.success('Profile updated successfully');
        return true;
      } else {
        const msg = response.error || 'Update failed';
        toast.error(msg);
        return false;
      }
    } catch (error: any) {
      const msg = error.message || 'Network error';
      console.error('Error updating profile:', error);
      toast.error(`Update failed: ${msg}`);
      return false;
    }
  };

  // ✅ Add new vehicle
  const addVehicle = async (data: any) => {
    try {
      const response = await api.driver.addVehicle(data);
      if (response.success) {
        await loadDriverProfile();
        toast.success('Vehicle added successfully');
        return response.data;
      } else {
        const msg = response.error || 'Add vehicle failed';
        toast.error(msg);
        return null;
      }
    } catch (error: any) {
      const msg = error.message || 'Network error';
      console.error('Error adding vehicle:', error);
      toast.error(`Add vehicle failed: ${msg}`);
      return null;
    }
  };

  // ✅ Update availability (online/offline)
  const updateAvailability = async (isOnline: boolean) => {
    try {
      const response = await api.driver.updateAvailability(isOnline);
      if (response.success) {
        await loadDriverProfile();
        toast.success(`You are now ${isOnline ? 'online' : 'offline'}`);
        return true;
      } else {
        const msg = response.error || 'Update failed';
        toast.error(msg);
        return false;
      }
    } catch (error: any) {
      const msg = error.message || 'Network error';
      console.error('Error updating availability:', error);
      toast.error(`Availability update failed: ${msg}`);
      return false;
    }
  };

  return {
    driverData,
    vehicles,
    loading,
    error,
    loadDriverProfile,
    updateProfile,
    addVehicle,
    updateAvailability,
  };
};