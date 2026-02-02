// CARLOADERSConnecting\src\src\hooks\useCustomerProfile.ts
import { useState, useEffect, useCallback } from 'react';
import { customerApi, authApi } from '../lib/api';
import { toast } from 'sonner';
import { getCurrentUser } from '../lib/auth-utils';

export const useCustomerProfile = () => {
  const [customerData, setCustomerData] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('👤 Loading customer profile data from both services...');
      
      // Get current user from localStorage
      const currentUser = getCurrentUser();
      if (!currentUser) {
        setError('No user logged in');
        toast.error('Please login first');
        setLoading(false);
        return;
      }

      const userId = currentUser.id;
      console.log('🆔 Current user ID:', userId);

      // 1. Load user personal info from User Service
      console.log('📨 Fetching user data from User Service...');
      const userResponse = await authApi.getUserById(userId);
      console.log('✅ User Service response:', userResponse);
      
      if (!userResponse.success) {
        console.error('❌ Failed to load user data:', userResponse.error);
        toast.error('Failed to load personal information');
      } else {
        setUserData(userResponse.data);
        console.log('👤 User data loaded:', {
          firstName: userResponse.data?.firstName,
          lastName: userResponse.data?.lastName,
          email: userResponse.data?.email
        });
      }

      // 2. Load customer profile from Customer Service
      console.log('📨 Fetching customer data from Customer Service...');
      const customerResponse = await customerApi.getProfile();
      console.log('✅ Customer Service response:', customerResponse);
      
      if (!customerResponse.success) {
        // If no customer profile exists yet
        if (customerResponse.error?.toLowerCase().includes('not found') || 
            customerResponse.status === 404) {
          console.log('ℹ️ No customer profile found yet');
          setCustomerData(null);
          setAddresses([]);
          setPreferences(null);
        } else {
          setError(customerResponse.error || 'Failed to load customer profile');
          toast.error(customerResponse.error || 'Failed to load customer profile');
        }
      } else {
        console.log('✅ Customer data loaded:', customerResponse.data);
        setCustomerData(customerResponse.data);
        
        // Extract addresses
        if (customerResponse.data?.addresses && Array.isArray(customerResponse.data.addresses)) {
          console.log('🏠 Addresses loaded:', customerResponse.data.addresses.length);
          setAddresses(customerResponse.data.addresses);
        } else {
          console.log('🏠 No addresses found in profile, fetching separately...');
          // Try to load addresses separately
          const addressesResponse = await customerApi.getAddresses();
          if (addressesResponse.success) {
            console.log('🏠 Addresses loaded separately:', addressesResponse.data?.length || 0);
            setAddresses(addressesResponse.data || []);
          }
        }

        // Extract preferences
        if (customerResponse.data?.preferences) {
          console.log('⚙️ Preferences loaded:', customerResponse.data.preferences);
          setPreferences(customerResponse.data.preferences);
        }
      }

    } catch (err: any) {
      console.error('❌ Error loading customer profile:', err);
      setError(err.message || 'Network error');
      toast.error('Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Combined data getter for easy access
  const getCombinedData = () => {
    return {
      // User data from User Service
      userInfo: userData ? {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        userType: userData.userType,
      } : null,
      
      // Customer data from Customer Service
      customer: customerData ? {
        id: customerData.id,
        accountType: customerData.account_type || customerData.accountType || 'personal',
        dateOfBirth: customerData.date_of_birth || customerData.dateOfBirth,
        businessName: customerData.business_name || customerData.businessName,
        businessType: customerData.business_type || customerData.businessType,
        businessPhone: customerData.business_phone || customerData.businessPhone,
        taxId: customerData.tax_id || customerData.taxId,
        joinDate: customerData.join_date || customerData.joinDate,
        totalOrders: customerData.total_orders || customerData.totalOrders || 0,
        totalSpent: customerData.total_spent || customerData.totalSpent || 0,
        averageRating: customerData.average_rating || customerData.averageRating || 0,
        loyaltyPoints: customerData.loyalty_points || customerData.loyaltyPoints || 0,
        membershipLevel: customerData.membership_level || customerData.membershipLevel || 'standard',
        status: customerData.status || 'active',
        profilePictureUrl: customerData.profile_picture_url || customerData.profilePictureUrl,
      } : null,
      
      // Arrays
      addresses: addresses || [],
      preferences: preferences || {
        notification_email: 1,
        notification_sms: 1,
        notification_push: 1,
        share_location_data: 0,
        share_usage_analytics: 0,
        marketing_emails: 0
      }
    };
  };

  // Create profile
  const createProfile = async (data: any) => {
    try {
      const response = await customerApi.createProfile(data);
      if (response.success) {
        await loadProfile();
        toast.success('Profile created successfully');
        return true;
      }
      toast.error(response.error || 'Failed to create profile');
      return false;
    } catch (error: any) {
      console.error('Error creating profile:', error);
      toast.error(error.message || 'Network error');
      return false;
    }
  };

  // Update profile
  const updateProfile = async (data: any) => {
    try {
      const response = await customerApi.updateProfile(data);
      if (response.success) {
        await loadProfile();
        toast.success('Profile updated successfully');
        return true;
      }
      toast.error(response.error || 'Failed to update profile');
      return false;
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Network error');
      return false;
    }
  };

  // Update account type (personal/business)
  const updateAccountType = async (accountType: 'personal' | 'business') => {
    try {
      const response = await customerApi.updateProfile({ accountType });
      if (response.success) {
        await loadProfile();
        toast.success(`Account type changed to ${accountType}`);
        return true;
      }
      toast.error(response.error || 'Failed to update account type');
      return false;
    } catch (error: any) {
      console.error('Error updating account type:', error);
      toast.error(error.message || 'Network error');
      return false;
    }
  };

  // Upload profile picture
  const uploadProfilePicture = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('profilePicture', file);
      const response = await customerApi.uploadProfilePicture(formData);
      if (response.success) {
        await loadProfile();
        toast.success('Profile picture uploaded successfully');
        return true;
      }
      toast.error(response.error || 'Failed to upload picture');
      return false;
    } catch (error: any) {
      console.error('Error uploading picture:', error);
      toast.error(error.message || 'Network error');
      return false;
    }
  };

  // Address operations
  const addAddress = async (data: any) => {
    try {
      const response = await customerApi.addAddress(data);
      if (response.success) {
        await loadProfile();
        toast.success('Address added successfully');
        return true;
      }
      toast.error(response.error || 'Failed to add address');
      return false;
    } catch (error: any) {
      console.error('Error adding address:', error);
      toast.error(error.message || 'Network error');
      return false;
    }
  };

  const updateAddress = async (id: string, data: any) => {
    try {
      const response = await customerApi.updateAddress(id, data);
      if (response.success) {
        await loadProfile();
        toast.success('Address updated successfully');
        return true;
      }
      toast.error(response.error || 'Failed to update address');
      return false;
    } catch (error: any) {
      console.error('Error updating address:', error);
      toast.error(error.message || 'Network error');
      return false;
    }
  };

  const deleteAddress = async (id: string) => {
    try {
      const response = await customerApi.deleteAddress(id);
      if (response.success) {
        await loadProfile();
        toast.success('Address deleted successfully');
        return true;
      }
      toast.error(response.error || 'Failed to delete address');
      return false;
    } catch (error: any) {
      console.error('Error deleting address:', error);
      toast.error(error.message || 'Network error');
      return false;
    }
  };

  // Update preferences
  const updatePreferences = async (data: any) => {
    try {
      const response = await customerApi.updatePreferences(data);
      if (response.success) {
        await loadProfile();
        toast.success('Preferences updated successfully');
        return true;
      }
      toast.error(response.error || 'Failed to update preferences');
      return false;
    } catch (error: any) {
      console.error('Error updating preferences:', error);
      toast.error(error.message || 'Network error');
      return false;
    }
  };

  return {
    // Data
    customerData,
    userData,
    addresses,
    preferences,
    
    // State
    loading,
    error,
    
    // Combined data
    getCombinedData,
    
    // Methods
    loadProfile,
    createProfile,
    updateProfile,
    updateAccountType,
    uploadProfilePicture,
    addAddress,
    updateAddress,
    deleteAddress,
    updatePreferences,
  };
};