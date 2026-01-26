import { useState, useEffect } from 'react';
import { driverApi, userApi } from '../lib/api';
import { toast } from 'sonner';
import { getCurrentUser, getCurrentUserId } from '../lib/auth-utils';

export function useDriverProfile() {
  const [driverData, setDriverData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  const loadDriverProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First try to load user profile from localStorage
      const currentUser = getCurrentUser();
      console.log('Current user from localStorage:', currentUser);
      
      if (!currentUser) {
        throw new Error('No user found in localStorage. Please login again.');
      }
      
      // Try to get user profile from API
      let userResponse;
      try {
        userResponse = await userApi.getProfile();
        console.log('User API response:', userResponse);
      } catch (apiError: any) {
        console.warn('Failed to fetch user profile from API:', apiError.message);
        // Use localStorage data as fallback
        userResponse = {
          success: true,
          data: currentUser
        };
      }
      
      if (!userResponse.success) {
        console.warn('User API returned error, using localStorage data');
        // Use localStorage data as fallback
        setUserProfile(currentUser);
      } else {
        setUserProfile(userResponse.data || currentUser);
      }
      
      // Try to load driver profile from driver service
      let driverResponse;
      try {
        driverResponse = await driverApi.getProfile();
        console.log('Driver API response:', driverResponse);
      } catch (driverError: any) {
        console.warn('Failed to fetch driver profile from API:', driverError.message);
        driverResponse = {
          success: false,
          error: driverError.message
        };
      }
      
      if (!driverResponse.success) {
        // If no driver profile exists yet, create a basic structure
        if (driverResponse.error?.includes('not found') || 
            driverResponse.error?.includes('No profile') ||
            driverResponse.error?.includes('No token') ||
            driverResponse.error?.includes('401')) {
          console.log('Creating new driver profile structure');
          const effectiveUserData = userResponse.data || currentUser;
          setDriverData({
            personalInfo: {
              firstName: effectiveUserData.firstName || '',
              lastName: effectiveUserData.lastName || '',
              email: effectiveUserData.email || '',
              phone: effectiveUserData.phone || '',
              address: '',
              dateOfBirth: '',
              joinDate: new Date().toISOString().split('T')[0]
            },
            vehicleInfo: {
              type: '',
              make: '',
              model: '',
              year: '',
              color: '',
              licensePlate: '',
              maxWeight: 0,
              maxVolume: 0
            },
            documents: [],
            stats: {
              totalDeliveries: 0,
              rating: 0,
              totalEarnings: 0,
              completionRate: 0
            },
            verification: {
              backgroundCheck: 'pending',
              profileCompletion: 30,
              canDrive: false
            }
          });
        } else {
          throw new Error(driverResponse.error || 'Failed to load driver profile');
        }
      } else {
        // Merge user data with driver data
        const effectiveUserData = userResponse.data || currentUser;
        setDriverData({
          ...driverResponse.data,
          personalInfo: {
            firstName: effectiveUserData.firstName || driverResponse.data.firstName || '',
            lastName: effectiveUserData.lastName || driverResponse.data.lastName || '',
            email: effectiveUserData.email || driverResponse.data.email || '',
            phone: effectiveUserData.phone || driverResponse.data.phone || '',
            address: effectiveUserData.address || driverResponse.data.address || '',
            dateOfBirth: effectiveUserData.dateOfBirth || driverResponse.data.dateOfBirth || '',
            joinDate: driverResponse.data.joinDate || new Date().toISOString().split('T')[0]
          }
        });
      }
      
    } catch (err: any) {
      console.error('Error loading driver profile:', err);
      setError(err.message);
      
      // Create minimal driver data structure for UI
      const currentUser = getCurrentUser();
      setDriverData({
        personalInfo: {
          firstName: currentUser?.firstName || '',
          lastName: currentUser?.lastName || '',
          email: currentUser?.email || '',
          phone: currentUser?.phone || '',
          address: '',
          dateOfBirth: '',
          joinDate: new Date().toISOString().split('T')[0]
        },
        vehicleInfo: {
          type: '',
          make: '',
          model: '',
          year: '',
          color: '',
          licensePlate: '',
          maxWeight: 0,
          maxVolume: 0
        },
        documents: [],
        stats: {
          totalDeliveries: 0,
          rating: 0,
          totalEarnings: 0,
          completionRate: 0
        },
        verification: {
          backgroundCheck: 'pending',
          profileCompletion: 30,
          canDrive: false
        }
      });
      
      // Only show error toast for serious errors
      if (!err.message.includes('No user found')) {
        toast.error(`Failed to load driver profile: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  
  const updateProfile = async (data: any) => {
    try {
      console.log('Updating profile with data:', data);

      // Update driver profile
      const driverResponse = await driverApi.updateProfile(data);
      console.log('Driver update response:', driverResponse);

      if (!driverResponse.success) {
        // If driver profile doesn't exist, try to create it
        if (driverResponse.error?.includes('not found')) {
          console.log('Creating new driver profile');
          const createResponse = await driverApi.createProfile(data);
          console.log('Create profile response:', createResponse);

          if (!createResponse.success) {
            throw new Error(createResponse.error || 'Failed to create driver profile');
          }
          toast.success('Profile created successfully');
          await loadDriverProfile();
          return true;
        }
        throw new Error(driverResponse.error || 'Failed to update driver profile');
      }

      toast.success('Profile updated successfully');
      await loadDriverProfile(); // Refresh data
      return true;
    } catch (err: any) {
      console.error('Error updating profile:', err);
      toast.error(`Failed to update profile: ${err.message}`);
      return false;
    }
  };

  const updateAvailability = async (isAvailable: boolean) => {
    try {
      const response = await driverApi.updateAvailability(isAvailable);
      if (!response.success) {
        throw new Error(response.error || 'Failed to update availability');
      }
      toast.success(`You are now ${isAvailable ? 'available' : 'unavailable'}`);
      return true;
    } catch (err: any) {
      toast.error(`Failed to update availability: ${err.message}`);
      return false;
    }
  };

  const addVehicle = async (vehicleData: any) => {
    try {
      const response = await driverApi.addVehicle(vehicleData);
      if (!response.success) {
        throw new Error(response.error || 'Failed to add vehicle');
      }
      toast.success('Vehicle added successfully');
      await loadDriverProfile(); // Refresh data
      return response.data;
    } catch (err: any) {
      toast.error(`Failed to add vehicle: ${err.message}`);
      return null;
    }
  };

  const getDriverStats = async () => {
    try {
      const response = await driverApi.getStats();
      if (!response.success) {
        // Return mock stats if API fails
        return {
          totalDeliveries: 0,
          rating: 0,
          totalEarnings: 0,
          completionRate: 0
        };
      }
      return response.data;
    } catch (err: any) {
      console.error('Error loading driver stats:', err);
      // Return mock stats on error
      return {
        totalDeliveries: 0,
        rating: 0,
        totalEarnings: 0,
        completionRate: 0
      };
    }
  };

  useEffect(() => {
    loadDriverProfile();
  }, []);

  return {
    driverData,
    userProfile,
    loading,
    error,
    loadDriverProfile,
    updateProfile,
    updateAvailability,
    addVehicle,
    getDriverStats
  };
}