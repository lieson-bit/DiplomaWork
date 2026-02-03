import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Switch } from "./ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { User, Building, CreditCard, MapPin, Phone, Mail, Calendar, Settings, Bell, Star, Package, DollarSign, Trash2, Plus, Edit2, Camera, Save, X, Loader2, Eye, CheckCircle } from 'lucide-react';
import { toast } from "sonner";
import { useCustomerProfile } from '../src/hooks/useCustomerProfile';
import { useLanguage } from './LanguageContext';

interface Address {
  id: string;
  label: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  isDefault: boolean;
  isActive: boolean;
  notes?: string;
}

export function CustomerProfile() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('personal');
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isEditingBusiness, setIsEditingBusiness] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  
  const {
    userData,
    customerData,
    addresses,
    preferences,
    loading,
    error,
    getCombinedData,
    loadProfile,
    updateProfile,
    updateAccountType,
    uploadProfilePicture,
    addAddress,
    updateAddress,
    deleteAddress,
    updatePreferences,
  } = useCustomerProfile();

  const profilePicInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [tempPersonalData, setTempPersonalData] = useState({
    dateOfBirth: '',
  });

  const [tempBusinessData, setTempBusinessData] = useState({
    businessName: '',
    businessType: '',
    businessPhone: '',
    taxId: '',
  });

  const [newAddress, setNewAddress] = useState({
    label: 'Home',
    address: '',
    city: '',
    state: '',
    country: 'US',
    postalCode: '',
    isDefault: false,
    isActive: true,
    notes: ''
  });

  // Initialize form data when data loads - FIXED: Only run when customerData changes
  useEffect(() => {
    if (customerData) {
      const combined = getCombinedData();
      if (combined.customer?.dateOfBirth) {
        setTempPersonalData({
          dateOfBirth: new Date(combined.customer.dateOfBirth).toISOString().split('T')[0]
        });
      }

      if (combined.customer?.accountType === 'business') {
        setTempBusinessData({
          businessName: combined.customer.businessName || '',
          businessType: combined.customer.businessType || '',
          businessPhone: combined.customer.businessPhone || '',
          taxId: combined.customer.taxId || '',
        });
      }
    }
  }, [customerData]); // Removed getCombinedData from dependencies

  const combinedData = getCombinedData();
  const isBusinessAccount = combinedData.customer?.accountType === 'business';

  // Helper function to safely convert values to numbers
  const safeNumber = (value: any): number => {
    if (value === null || value === undefined) return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  };

  // Helper function to safely format average rating
  const formatAverageRating = (rating: any): string => {
    const num = safeNumber(rating);
    return num.toFixed(1);
  };

  // Helper function to safely format currency
  const formatCurrency = (amount: any): string => {
    const num = safeNumber(amount);
    return `$${num.toLocaleString()}`;
  };

  // Handle profile picture upload
  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('customer.profile.invalid_image') || 'Please select an image file');
      return;
    }

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('customer.profile.image_too_large') || 'Image size should be less than 5MB');
      return;
    }

    setIsUploadingPicture(true);
    try {
      console.log('📤 Uploading profile picture:', file.name);
      const success = await uploadProfilePicture(file);
      if (success) {
        toast.success(t('customer.profile.picture_uploaded') || 'Profile picture uploaded successfully');
      }
    } catch (error: any) {
      console.error('❌ Profile picture upload error:', error);
      toast.error(error.message || t('customer.common.error') || 'Failed to upload profile picture');
    } finally {
      setIsUploadingPicture(false);
    }
  };

  // Handle personal info update
  const handleSavePersonalInfo = async () => {
    try {
      const success = await updateProfile({
        dateOfBirth: tempPersonalData.dateOfBirth || undefined
      });
      if (success) {
        setIsEditingPersonal(false);
        toast.success(t('customer.profile.personal_info_updated') || 'Personal information updated successfully');
      }
    } catch (error: any) {
      toast.error(error.message || t('customer.common.error') || 'Failed to save personal info');
    }
  };

  // Handle business info update
  const handleSaveBusinessInfo = async () => {
    try {
      const updateData = {
        businessName: tempBusinessData.businessName || undefined,
        businessType: tempBusinessData.businessType || undefined,
        businessPhone: tempBusinessData.businessPhone || undefined,
        taxId: tempBusinessData.taxId || undefined
      };

      const success = await updateProfile(updateData);
      if (success) {
        setIsEditingBusiness(false);
        toast.success(t('customer.profile.business_info_updated') || 'Business information updated successfully');
      }
    } catch (error: any) {
      toast.error(error.message || t('customer.common.error') || 'Failed to save business info');
    }
  };

  // Handle address operations
  const handleAddAddress = async () => {
    if (!newAddress.label || !newAddress.address || !newAddress.city || !newAddress.state || !newAddress.postalCode) {
      toast.error(t('customer.profile.fill_all_address_fields') || 'Please fill all required address fields');
      return;
    }

    const addressData = {
      label: newAddress.label,
      address: newAddress.address,
      city: newAddress.city,
      state: newAddress.state,
      country: newAddress.country || 'US',
      postalCode: newAddress.postalCode,
      isDefault: newAddress.isDefault || false,
      notes: newAddress.notes
    };

    const success = await addAddress(addressData);
    if (success) {
      setShowAddAddress(false);
      setNewAddress({
        label: 'Home',
        address: '',
        city: '',
        state: '',
        country: 'US',
        postalCode: '',
        isDefault: false,
        isActive: true,
        notes: ''
      });
      toast.success(t('customer.profile.address_added') || 'Address added successfully');
    }
  };

  const handleUpdateAddress = async (address: Address) => {
    const success = await updateAddress(address.id, {
      label: address.label,
      address: address.address,
      city: address.city,
      state: address.state,
      country: address.country,
      postalCode: address.postalCode,
      isDefault: address.isDefault,
      notes: address.notes
    });

    if (success) {
      setEditingAddressId(null);
      toast.success(t('customer.profile.address_updated') || 'Address updated successfully');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (addresses.length <= 1) {
      toast.error(t('customer.profile.cannot_delete_only_address') || 'Cannot delete the only address');
      return;
    }

    const success = await deleteAddress(id);
    if (success) {
      toast.success(t('customer.profile.address_deleted') || 'Address deleted successfully');
    }
  };

  const handleSetDefaultAddress = async (id: string) => {
    const address = addresses.find((addr: any) => addr.id === id);
    if (!address) return;

    const success = await updateAddress(id, { isDefault: true });
    if (success) {
      toast.success(t('customer.profile.default_address_updated') || 'Default address updated');
    }
  };

  // Handle account type change
  const handleAccountTypeChange = async (accountType: 'personal' | 'business') => {
    try {
      const success = await updateAccountType(accountType);
      if (success) {
        toast.success(
          t('customer.profile.account_type_changed', { type: accountType }) || 
          `Account type changed to ${accountType}`
        );
      }
    } catch (error: any) {
      toast.error(error.message || t('customer.common.error') || 'Failed to update account type');
    }
  };

  // Trigger profile picture upload
  const triggerProfilePicUpload = () => {
    if (profilePicInputRef.current) {
      profilePicInputRef.current.click();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">{t('customer.common.loading') || 'Loading profile...'}</span>
      </div>
    );
  }

  if (error && !userData && !customerData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">{error}</p>
        <Button onClick={() => loadProfile()} className="mt-4">
          {t('customer.profile.retry_loading') || 'Retry Loading'}
        </Button>
      </div>
    );
  }

  // Display name based on data availability
  const displayName = () => {
    if (userData?.firstName && userData?.lastName) {
      return `${userData.firstName} ${userData.lastName}`;
    }
    if (userData?.firstName) {
      return userData.firstName;
    }
    if (userData?.email) {
      return userData.email.split('@')[0];
    }
    return t('customer.profile.customer') || 'Customer';
  };

  const hasProfileData = userData || customerData;

  if (!hasProfileData) {
    return (
      <div className="text-center py-12">
        <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">
          {t('customer.profile.no_profile') || 'No Profile Found'}
        </h3>
        <p className="text-gray-600 mt-1">
          {t('customer.profile.complete_onboarding') || 'Complete onboarding to create your customer profile'}
        </p>
        <Button className="mt-4" onClick={() => window.location.href = '/customer-onboarding'}>
          {t('customer.profile.go_to_onboarding') || 'Go to Onboarding'}
        </Button>
      </div>
    );
  }

  // Calculate statistics safely
  const totalOrders = safeNumber(combinedData.customer?.totalOrders);
  const totalSpent = safeNumber(combinedData.customer?.totalSpent);
  const averageRating = safeNumber(combinedData.customer?.averageRating);
  const loyaltyPoints = safeNumber(combinedData.customer?.loyaltyPoints);

  // Get profile picture URL
  const getProfilePictureUrl = () => {
    if (!combinedData.customer?.profilePictureUrl) return null;
    
    // Clean the URL by removing any query parameters
    const url = combinedData.customer.profilePictureUrl;
    return url.split('?')[0];
  };

  const profilePictureUrl = getProfilePictureUrl();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Avatar className="h-20 w-20 border-2 border-gray-200 shadow-lg">
              {profilePictureUrl ? (
                <>
                  <AvatarImage 
                    src={profilePictureUrl} 
                    alt={displayName()}
                    className="object-cover"
                    onError={(e) => {
                      console.error('❌ Failed to load profile picture:', profilePictureUrl);
                      e.currentTarget.style.display = 'none';
                    }}
                    onLoad={() => console.log('✅ Profile picture loaded:', profilePictureUrl)}
                    crossOrigin="anonymous"
                  />
                  <AvatarFallback className="text-lg bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700">
                    {userData?.firstName?.[0]}{userData?.lastName?.[0] || 'C'}
                  </AvatarFallback>
                </>
              ) : (
                <AvatarFallback className="text-lg bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700">
                  {userData?.firstName?.[0]}{userData?.lastName?.[0] || 'C'}
                </AvatarFallback>
              )}
            </Avatar>
            
            <input
              type="file"
              accept="image/*"
              ref={profilePicInputRef}
              className="hidden"
              onChange={handleProfilePictureChange}
              disabled={isUploadingPicture}
            />
            
            <button
              onClick={triggerProfilePicUpload}
              disabled={isUploadingPicture}
              className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 transition shadow-lg"
              title={t('customer.profile.change_picture') || 'Change profile picture'}
            >
              {isUploadingPicture ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Camera className="h-3 w-3" />
              )}
            </button>
          </div>
          <div>
            <h2 className="text-2xl text-gray-900 font-bold">
              {displayName()}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={isBusinessAccount ? "secondary" : "outline"} 
                className={isBusinessAccount ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-800"}>
                {isBusinessAccount 
                  ? t('customer.profile.business_account') || 'Business Account'
                  : t('customer.profile.personal_account') || 'Personal Account'}
              </Badge>
              {combinedData.customer?.membershipLevel && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {combinedData.customer.membershipLevel}
                </Badge>
              )}
            </div>
            {isBusinessAccount && combinedData.customer?.businessName && (
              <p className="text-sm text-gray-600 mt-1">{combinedData.customer.businessName}</p>
            )}
            <div className="flex items-center space-x-4 mt-2">
              {userData?.email && (
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <Mail className="h-4 w-4" />
                  <span>{userData.email}</span>
                </div>
              )}
              {combinedData.customer?.totalOrders !== undefined && (
                <div className="text-sm text-gray-600">
                  {totalOrders} {t('customer.profile.orders') || 'orders'}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {combinedData.customer?.joinDate && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {t('customer.profile.member_since', { 
                date: new Date(combinedData.customer.joinDate).toLocaleDateString() 
              }) || `Member since ${new Date(combinedData.customer.joinDate).toLocaleDateString()}`}
            </Badge>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {t('customer.profile.account_type') || 'Account Type'}:
            </span>
            <Select
              value={combinedData.customer?.accountType || 'personal'}
              onValueChange={(value: 'personal' | 'business') => handleAccountTypeChange(value)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">
                  {t('customer.profile.tab.personal') || 'Personal'}
                </SelectItem>
                <SelectItem value="business">
                  {t('customer.profile.tab.business') || 'Business'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="personal">
            {t('customer.profile.tab.personal') || 'Personal'}
          </TabsTrigger>
          <TabsTrigger value="addresses">
            {t('customer.profile.tab.addresses') || 'Addresses'}
          </TabsTrigger>
          <TabsTrigger value="payment">
            {t('customer.profile.tab.payment') || 'Payment'}
          </TabsTrigger>
          <TabsTrigger value="preferences">
            {t('customer.profile.tab.preferences') || 'Preferences'}
          </TabsTrigger>
          <TabsTrigger value="stats">
            {t('customer.profile.tab.stats') || 'Statistics'}
          </TabsTrigger>
        </TabsList>

        {/* Personal Information Tab */}
        <TabsContent value="personal" className="space-y-6">
          {/* Personal Information Card */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {t('customer.profile.personal_info') || 'Personal Information'}
                </CardTitle>
                <div className="flex items-center space-x-2">
                  {isEditingPersonal ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditingPersonal(false);
                          // Reset to original data
                          if (combinedData.customer?.dateOfBirth) {
                            setTempPersonalData({
                              dateOfBirth: new Date(combinedData.customer.dateOfBirth).toISOString().split('T')[0]
                            });
                          }
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        {t('customer.common.cancel') || 'Cancel'}
                      </Button>
                      <Button
                        onClick={handleSavePersonalInfo}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {t('customer.common.save') || 'Save'}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setIsEditingPersonal(true)}
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      {t('customer.common.edit') || 'Edit'}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">
                    {t('customer.profile.first_name') || 'First Name'}
                  </Label>
                  <Input
                    id="firstName"
                    value={userData?.firstName || ''}
                    disabled={true}
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">
                    {t('customer.profile.last_name') || 'Last Name'}
                  </Label>
                  <Input
                    id="lastName"
                    value={userData?.lastName || ''}
                    disabled={true}
                    className="bg-gray-50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  {t('customer.profile.email') || 'Email'}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={userData?.email || ''}
                    disabled={true}
                    className="pl-10 bg-gray-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    {t('customer.profile.phone') || 'Phone Number'}
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      value={userData?.phone || ''}
                      disabled={true}
                      className="pl-10 bg-gray-50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">
                    {t('customer.profile.date_of_birth') || 'Date of Birth'}
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={tempPersonalData.dateOfBirth}
                      disabled={!isEditingPersonal}
                      className="pl-10"
                      onChange={(e) => setTempPersonalData({
                        ...tempPersonalData,
                        dateOfBirth: e.target.value
                      })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Information Card (only for business accounts) */}
          {isBusinessAccount && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    {t('customer.profile.business_info') || 'Business Information'}
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    {isEditingBusiness ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditingBusiness(false);
                            // Reset to original data
                            setTempBusinessData({
                              businessName: combinedData.customer?.businessName || '',
                              businessType: combinedData.customer?.businessType || '',
                              businessPhone: combinedData.customer?.businessPhone || '',
                              taxId: combinedData.customer?.taxId || '',
                            });
                          }}
                        >
                          <X className="h-4 w-4 mr-2" />
                          {t('customer.common.cancel') || 'Cancel'}
                        </Button>
                        <Button
                          onClick={handleSaveBusinessInfo}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {t('customer.common.save') || 'Save'}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingBusiness(true)}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        {t('customer.common.edit') || 'Edit'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">
                    {t('customer.profile.business_name') || 'Business Name'}
                  </Label>
                  <Input
                    id="businessName"
                    value={tempBusinessData.businessName}
                    disabled={!isEditingBusiness}
                    onChange={(e) => setTempBusinessData({
                      ...tempBusinessData,
                      businessName: e.target.value
                    })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessType">
                      {t('customer.profile.business_type') || 'Business Type'}
                    </Label>
                    <Select 
                      value={tempBusinessData.businessType}
                      disabled={!isEditingBusiness}
                      onValueChange={(value) => setTempBusinessData({
                        ...tempBusinessData,
                        businessType: value
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('customer.profile.select_business_type') || 'Select business type'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Retail Store">
                          {t('customer.profile.business_type_retail') || 'Retail Store'}
                        </SelectItem>
                        <SelectItem value="Restaurant/Food Service">
                          {t('customer.profile.business_type_food') || 'Restaurant/Food Service'}
                        </SelectItem>
                        <SelectItem value="E-commerce">
                          {t('customer.profile.business_type_ecommerce') || 'E-commerce'}
                        </SelectItem>
                        <SelectItem value="Manufacturing">
                          {t('customer.profile.business_type_manufacturing') || 'Manufacturing'}
                        </SelectItem>
                        <SelectItem value="Healthcare">
                          {t('customer.profile.business_type_healthcare') || 'Healthcare'}
                        </SelectItem>
                        <SelectItem value="Education">
                          {t('customer.profile.business_type_education') || 'Education'}
                        </SelectItem>
                        <SelectItem value="Construction">
                          {t('customer.profile.business_type_construction') || 'Construction'}
                        </SelectItem>
                        <SelectItem value="Professional Services">
                          {t('customer.profile.business_type_professional') || 'Professional Services'}
                        </SelectItem>
                        <SelectItem value="Other">
                          {t('customer.profile.business_type_other') || 'Other'}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="taxId">
                      {t('customer.profile.tax_id') || 'Tax ID'}
                    </Label>
                    <Input
                      id="taxId"
                      value={tempBusinessData.taxId}
                      disabled={!isEditingBusiness}
                      onChange={(e) => setTempBusinessData({
                        ...tempBusinessData,
                        taxId: e.target.value
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessPhone">
                    {t('customer.profile.business_phone') || 'Business Phone'}
                  </Label>
                  <Input
                    id="businessPhone"
                    value={tempBusinessData.businessPhone}
                    disabled={!isEditingBusiness}
                    onChange={(e) => setTempBusinessData({
                      ...tempBusinessData,
                      businessPhone: e.target.value
                    })}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Addresses Tab */}
        <TabsContent value="addresses">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {t('customer.profile.saved_addresses') || 'Saved Addresses'}
                </CardTitle>
                <Button onClick={() => setShowAddAddress(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('customer.profile.add_address') || 'Add Address'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Add New Address Form */}
              {showAddAddress && (
                <div className="p-4 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium text-blue-900">
                      {t('customer.profile.add_new_address') || 'Add New Address'}
                    </h4>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        onClick={handleAddAddress}
                      >
                        {t('customer.common.save') || 'Save'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAddAddress(false)}
                      >
                        {t('customer.common.cancel') || 'Cancel'}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>{t('customer.profile.label') || 'Label'} *</Label>
                        <Select
                          value={newAddress.label}
                          onValueChange={(value) => setNewAddress({...newAddress, label: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Home">
                              {t('customer.profile.label_home') || 'Home'}
                            </SelectItem>
                            <SelectItem value="Office">
                              {t('customer.profile.label_office') || 'Office'}
                            </SelectItem>
                            <SelectItem value="Business">
                              {t('customer.profile.label_business') || 'Business'}
                            </SelectItem>
                            <SelectItem value="Other">
                              {t('customer.profile.label_other') || 'Other'}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('customer.profile.street_address') || 'Street Address'} *</Label>
                        <Input
                          value={newAddress.address}
                          onChange={(e) => setNewAddress({...newAddress, address: e.target.value})}
                          placeholder={t('customer.profile.street_address_placeholder') || '123 Main St'}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>{t('customer.profile.city') || 'City'} *</Label>
                        <Input
                          value={newAddress.city}
                          onChange={(e) => setNewAddress({...newAddress, city: e.target.value})}
                          placeholder={t('customer.profile.city_placeholder') || 'New York'}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('customer.profile.state') || 'State'} *</Label>
                        <Input
                          value={newAddress.state}
                          onChange={(e) => setNewAddress({...newAddress, state: e.target.value})}
                          placeholder={t('customer.profile.state_placeholder') || 'NY'}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('customer.profile.zip_code') || 'ZIP Code'} *</Label>
                        <Input
                          value={newAddress.postalCode}
                          onChange={(e) => setNewAddress({...newAddress, postalCode: e.target.value})}
                          placeholder={t('customer.profile.zip_code_placeholder') || '10001'}
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isDefault"
                        checked={newAddress.isDefault}
                        onChange={(e) => setNewAddress({...newAddress, isDefault: e.target.checked})}
                        className="rounded"
                      />
                      <Label htmlFor="isDefault" className="cursor-pointer">
                        {t('customer.profile.set_as_default') || 'Set as default address'}
                      </Label>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">
                        {t('customer.profile.notes') || 'Notes'} ({t('customer.profile.optional') || 'Optional'})
                      </Label>
                      <Textarea
                        id="notes"
                        value={newAddress.notes}
                        onChange={(e) => setNewAddress({...newAddress, notes: e.target.value})}
                        placeholder={t('customer.profile.notes_placeholder') || 'Any special instructions for delivery'}
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Address List */}
              <div className="space-y-4">
                {addresses.length === 0 ? (
                  <div className="text-center py-8">
                    <MapPin className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">
                      {t('customer.profile.no_addresses') || 'No addresses saved yet'}
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setShowAddAddress(true)}
                    >
                      {t('customer.profile.add_first_address') || 'Add Your First Address'}
                    </Button>
                  </div>
                ) : (
                  addresses.map((address: any) => {
                    const addr: Address = {
                      id: address.id,
                      label: address.label,
                      address: address.address,
                      city: address.city,
                      state: address.state,
                      country: address.country,
                      postalCode: address.postal_code || address.postalCode,
                      isDefault: address.is_default === 1 || address.is_default === true,
                      isActive: address.is_active === 1 || address.is_active === true,
                      notes: address.notes
                    };

                    return (
                      <div key={addr.id} className="flex flex-col md:flex-row items-start justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="font-medium">{addr.label}</span>
                            {addr.isDefault && (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                {t('customer.profile.default_badge') || 'Default'}
                              </Badge>
                            )}
                            {!addr.isActive && (
                              <Badge variant="outline" className="text-gray-500">
                                {t('customer.profile.inactive_badge') || 'Inactive'}
                              </Badge>
                            )}
                          </div>
                          
                          {editingAddressId === addr.id ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <Label>{t('customer.profile.label') || 'Label'}</Label>
                                  <Input
                                    value={addr.label}
                                    onChange={(e) => {
                                      // Update local copy for editing
                                      const updatedAddr = {...addr, label: e.target.value};
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label>{t('customer.profile.street_address') || 'Street Address'}</Label>
                                  <Input
                                    value={addr.address}
                                    onChange={(e) => {
                                      const updatedAddr = {...addr, address: e.target.value};
                                    }}
                                  />
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <Label>{t('customer.profile.city') || 'City'}</Label>
                                  <Input
                                    value={addr.city}
                                    onChange={(e) => {
                                      const updatedAddr = {...addr, city: e.target.value};
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label>{t('customer.profile.state') || 'State'}</Label>
                                  <Input
                                    value={addr.state}
                                    onChange={(e) => {
                                      const updatedAddr = {...addr, state: e.target.value};
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label>{t('customer.profile.zip_code') || 'ZIP Code'}</Label>
                                  <Input
                                    value={addr.postalCode}
                                    onChange={(e) => {
                                      const updatedAddr = {...addr, postalCode: e.target.value};
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="edit-notes">
                                  {t('customer.profile.notes') || 'Notes'} ({t('customer.profile.optional') || 'Optional'})
                                </Label>
                                <Textarea
                                  id="edit-notes"
                                  value={addr.notes || ''}
                                  onChange={(e) => {
                                    const updatedAddr = {...addr, notes: e.target.value};
                                  }}
                                  placeholder={t('customer.profile.notes_placeholder') || 'Any special instructions for delivery'}
                                  rows={2}
                                />
                              </div>
                              
                              <div className="flex space-x-2 pt-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleUpdateAddress(addr)}
                                >
                                  {t('customer.common.save') || 'Save'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingAddressId(null)}
                                >
                                  {t('customer.common.cancel') || 'Cancel'}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="text-gray-900">{addr.address}</div>
                              <div className="text-gray-600">
                                {addr.city}, {addr.state} {addr.postalCode}, {addr.country}
                              </div>
                              {addr.notes && (
                                <div className="text-sm text-gray-500 mt-1">
                                  {t('customer.profile.note') || 'Note'}: {addr.notes}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2 mt-4 md:mt-0 md:ml-4">
                          {!addr.isDefault && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSetDefaultAddress(addr.id)}
                            >
                              {t('customer.profile.set_default_button') || 'Set Default'}
                            </Button>
                          )}
                          {editingAddressId === addr.id ? null : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingAddressId(addr.id)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      {t('customer.profile.delete_address_title') || 'Delete Address'}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {t('customer.profile.delete_address_description') || 'Are you sure you want to delete this address? This action cannot be undone.'}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      {t('customer.common.cancel') || 'Cancel'}
                                    </AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteAddress(addr.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      {t('customer.common.delete') || 'Delete'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Tab */}
        <TabsContent value="payment">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {t('customer.profile.payment_methods') || 'Payment Methods'}
                </CardTitle>
                <Button onClick={() => toast.info(t('customer.profile.payment_setup_info') || 'Payment method setup would open here')}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('customer.profile.add_payment_method') || 'Add Payment Method'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">
                  {t('customer.profile.payment_integration_info') || 'Payment methods integration would be implemented separately'}
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  {t('customer.profile.payment_service_info') || 'This would connect to a payment service like Stripe'}
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => toast.info(t('customer.profile.payment_setup_info') || 'Payment method setup would open here')}
                >
                  {t('customer.profile.connect_payment_method') || 'Connect Payment Method'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  {t('customer.profile.notification_preferences') || 'Notification Preferences'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-notifications" className="cursor-pointer">
                      {t('customer.profile.email_notifications') || 'Email Notifications'}
                    </Label>
                    <p className="text-sm text-gray-600">
                      {t('customer.profile.email_notifications_desc') || 'Order updates, receipts, and newsletters'}
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={preferences?.notification_email === 1}
                    onCheckedChange={async (checked) => {
                      try {
                        await updatePreferences({ notification_email: checked ? 1 : 0 });
                        toast.success(t('customer.profile.email_preference_updated') || 'Email notification preference updated');
                      } catch (error: any) {
                        toast.error(error.message || t('customer.common.error') || 'Failed to update preference');
                      }
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="sms-notifications" className="cursor-pointer">
                      {t('customer.profile.sms_notifications') || 'SMS Notifications'}
                    </Label>
                    <p className="text-sm text-gray-600">
                      {t('customer.profile.sms_notifications_desc') || 'Real-time delivery updates'}
                    </p>
                  </div>
                  <Switch
                    id="sms-notifications"
                    checked={preferences?.notification_sms === 1}
                    onCheckedChange={async (checked) => {
                      try {
                        await updatePreferences({ notification_sms: checked ? 1 : 0 });
                        toast.success(t('customer.profile.sms_preference_updated') || 'SMS notification preference updated');
                      } catch (error: any) {
                        toast.error(error.message || t('customer.common.error') || 'Failed to update preference');
                      }
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="push-notifications" className="cursor-pointer">
                      {t('customer.profile.push_notifications') || 'Push Notifications'}
                    </Label>
                    <p className="text-sm text-gray-600">
                      {t('customer.profile.push_notifications_desc') || 'In-app notifications'}
                    </p>
                  </div>
                  <Switch
                    id="push-notifications"
                    checked={preferences?.notification_push === 1}
                    onCheckedChange={async (checked) => {
                      try {
                        await updatePreferences({ notification_push: checked ? 1 : 0 });
                        toast.success(t('customer.profile.push_preference_updated') || 'Push notification preference updated');
                      } catch (error: any) {
                        toast.error(error.message || t('customer.common.error') || 'Failed to update preference');
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {t('customer.profile.privacy_preferences') || 'Privacy Preferences'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="location-data" className="cursor-pointer">
                      {t('customer.profile.share_location') || 'Share Location Data'}
                    </Label>
                    <p className="text-sm text-gray-600">
                      {t('customer.profile.share_location_desc') || 'Help improve route optimization'}
                    </p>
                  </div>
                  <Switch
                    id="location-data"
                    checked={preferences?.share_location_data === 1}
                    onCheckedChange={async (checked) => {
                      try {
                        await updatePreferences({ share_location_data: checked ? 1 : 0 });
                        toast.success(t('customer.profile.location_preference_updated') || 'Location sharing preference updated');
                      } catch (error: any) {
                        toast.error(error.message || t('customer.common.error') || 'Failed to update preference');
                      }
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="usage-analytics" className="cursor-pointer">
                      {t('customer.profile.share_analytics') || 'Share Usage Analytics'}
                    </Label>
                    <p className="text-sm text-gray-600">
                      {t('customer.profile.share_analytics_desc') || 'Help improve the platform'}
                    </p>
                  </div>
                  <Switch
                    id="usage-analytics"
                    checked={preferences?.share_usage_analytics === 1}
                    onCheckedChange={async (checked) => {
                      try {
                        await updatePreferences({ share_usage_analytics: checked ? 1 : 0 });
                        toast.success(t('customer.profile.analytics_preference_updated') || 'Usage analytics preference updated');
                      } catch (error: any) {
                        toast.error(error.message || t('customer.common.error') || 'Failed to update preference');
                      }
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="marketing-emails" className="cursor-pointer">
                      {t('customer.profile.marketing_emails') || 'Marketing Emails'}
                    </Label>
                    <p className="text-sm text-gray-600">
                      {t('customer.profile.marketing_emails_desc') || 'Promotional offers and tips'}
                    </p>
                  </div>
                  <Switch
                    id="marketing-emails"
                    checked={preferences?.marketing_emails === 1}
                    onCheckedChange={async (checked) => {
                      try {
                        await updatePreferences({ marketing_emails: checked ? 1 : 0 });
                        toast.success(t('customer.profile.marketing_preference_updated') || 'Marketing emails preference updated');
                      } catch (error: any) {
                        toast.error(error.message || t('customer.common.error') || 'Failed to update preference');
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="stats">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {t('customer.profile.account_stats') || 'Account Statistics'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-3xl text-blue-600 font-bold">
                      {totalOrders}
                    </p>
                    <p className="text-gray-600">
                      {t('customer.profile.total_orders') || 'Total Orders'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('customer.profile.customer_service') || 'Customer Service'}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-3xl text-green-600 font-bold">
                      {formatCurrency(totalSpent)}
                    </p>
                    <p className="text-gray-600">
                      {t('customer.profile.total_spent') || 'Total Spent'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('customer.profile.customer_service') || 'Customer Service'}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-3xl text-yellow-600 font-bold">
                      {formatAverageRating(averageRating)}
                    </p>
                    <p className="text-gray-600">
                      {t('customer.profile.average_rating') || 'Average Rating'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('customer.profile.customer_service') || 'Customer Service'}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-3xl text-purple-600 font-bold">
                      {loyaltyPoints.toLocaleString()}
                    </p>
                    <p className="text-gray-600">
                      {t('customer.profile.loyalty_points') || 'Loyalty Points'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('customer.profile.customer_service') || 'Customer Service'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {t('customer.profile.account_benefits') || 'Account Benefits'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <Package className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium">
                          {t('customer.profile.membership_level') || 'Membership Level'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {combinedData.customer?.membershipLevel || 'Standard'}
                        </p>
                      </div>
                    </div>
                    <Badge className={
                      combinedData.customer?.membershipLevel === 'premium' ? 'bg-yellow-100 text-yellow-800' :
                      combinedData.customer?.membershipLevel === 'business' ? 'bg-purple-100 text-purple-800' :
                      'bg-green-100 text-green-800'
                    }>
                      {combinedData.customer?.membershipLevel || 'Standard'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <Star className="h-5 w-5 text-yellow-600" />
                      <div>
                        <p className="font-medium">
                          {t('customer.profile.account_status') || 'Account Status'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {t('customer.profile.active_since', { 
                            date: combinedData.customer?.joinDate 
                              ? new Date(combinedData.customer.joinDate).toLocaleDateString() 
                              : 'Recently'
                          }) || `Active since ${combinedData.customer?.joinDate 
                            ? new Date(combinedData.customer.joinDate).toLocaleDateString() 
                            : 'Recently'}`}
                        </p>
                      </div>
                    </div>
                    <Badge className={
                      combinedData.customer?.status === 'active' ? 'bg-green-100 text-green-800' :
                      combinedData.customer?.status === 'suspended' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }>
                      {combinedData.customer?.status || 'Active'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium">
                          {t('customer.profile.address_management') || 'Address Management'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {addresses.length} {t('customer.profile.saved_addresses_count') || 'saved address(es)'}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">
                      {addresses.length} {t('customer.profile.address_count') || 'Address(es)'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <User className="h-5 w-5 text-gray-600" />
                      <div>
                        <p className="font-medium">
                          {t('customer.profile.account_type_stat') || 'Account Type'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {isBusinessAccount 
                            ? t('customer.profile.business_account_full') || 'Business Account with full features' 
                            : t('customer.profile.personal_account_desc') || 'Personal Account'}
                        </p>
                      </div>
                    </div>
                    <Badge className={
                      isBusinessAccount 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-gray-100 text-gray-800'
                    }>
                      {isBusinessAccount 
                        ? t('customer.profile.business') || 'Business'
                        : t('customer.profile.personal') || 'Personal'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}