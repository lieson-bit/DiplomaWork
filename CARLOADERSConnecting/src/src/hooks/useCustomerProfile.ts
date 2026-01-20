import { useState, useEffect } from 'react';
import { driverApi, userApi } from '../lib/api';
import { toast } from 'sonner';
import { getCurrentUser, getCurrentUserId } from '../lib/auth-utils';

export function useDriverProfile() {
  const [driverData, setDriverData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  const loadDriverProfile = async () => {
    try {
      setLoading(true);
      
      // First load user profile from user service
      const userResponse = await userApi.getProfile();
      if (!userResponse.success) {
        throw new Error(userResponse.error || 'Failed to load user profile');
      }
      setUserProfile(userResponse.data);
      
      // Then load driver profile from driver service
      const driverResponse = await driverApi.getProfile();
      
      if (!driverResponse.success) {
        // If no driver profile exists yet, create a basic structure
        if (driverResponse.error?.includes('not found') || driverResponse.error?.includes('No profile')) {
          console.log('No driver profile found, using user data');
          const currentUser = getCurrentUser();
          setDriverData({
            personalInfo: {
              firstName: currentUser?.firstName || userResponse.data.firstName || '',
              lastName: currentUser?.lastName || userResponse.data.lastName || '',
              email: currentUser?.email || userResponse.data.email || '',
              phone: currentUser?.phone || userResponse.data.phone || '',
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
          throw new Error(driverResponse.error);
        }
      } else {
        // Merge user data with driver data
        setDriverData({
          ...driverResponse.data,
          personalInfo: {
            firstName: userResponse.data.firstName || driverResponse.data.firstName || '',
            lastName: userResponse.data.lastName || driverResponse.data.lastName || '',
            email: userResponse.data.email || driverResponse.data.email || '',
            phone: userResponse.data.phone || driverResponse.data.phone || '',
            address: driverResponse.data.address || '',
            dateOfBirth: driverResponse.data.dateOfBirth || '',
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
      
      toast.error(`Failed to load driver profile: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: any) => {
    try {
      // Update driver profile
      const driverResponse = await driverApi.updateProfile(data);
      if (!driverResponse.success) {
        throw new Error(driverResponse.error || 'Failed to update driver profile');
      }
      
      // Also update user profile if needed
      if (data.firstName || data.lastName || data.phone) {
        const userUpdateData: any = {};
        if (data.firstName) userUpdateData.firstName = data.firstName;
        if (data.lastName) userUpdateData.lastName = data.lastName;
        if (data.phone) userUpdateData.phone = data.phone;
        
        await userApi.updateProfile(userUpdateData);
      }
      
      toast.success('Profile updated successfully');
      await loadDriverProfile(); // Refresh data
      return true;
    } catch (err: any) {
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
        throw new Error(response.error || 'Failed to load stats');
      }
      return response.data;
    } catch (err: any) {
      console.error('Error loading driver stats:', err);
      return null;
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