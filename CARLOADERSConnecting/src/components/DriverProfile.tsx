import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Progress } from "./ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { User, Car, FileText, Upload, CheckCircle, AlertTriangle, Clock, Star, MapPin, Phone, Mail, Calendar, Settings, Edit, Save } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { driverApi } from '../src/lib/api';

interface Document {
  id: string;
  type: 'license' | 'insurance' | 'registration' | 'inspection' | 'background_check';
  name: string;
  fileName: string;
  fileUrl: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  uploadDate: string;
  expiryDate?: string;
  rejectionReason?: string;
}

interface Vehicle {
  id: string;
  type: string;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  maxWeight: number;
  maxVolume: number;
  imageUrl?: string;
  isActive: boolean;
  currentStatus: 'available' | 'in_use' | 'maintenance';
}

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface DriverProfileData {
  id: string;
  userId: string;
  licenseNumber: string;
  licenseExpiry: string;
  insuranceNumber: string;
  insuranceExpiry: string;
  rating: number;
  totalDeliveries: number;
  totalEarnings: number;
  completionRate: number;
  status: 'pending' | 'active' | 'suspended' | 'inactive';
  verificationLevel: 'none' | 'basic' | 'verified' | 'premium';
  isOnline: boolean;
  profileCompleted: boolean;
  user?: UserProfile;
  vehicles?: Vehicle[];
  documents?: Document[];
  profilePicture?: {
    thumbnailUrl?: string;
    smallUrl?: string;
    mediumUrl?: string;
    originalUrl?: string;
  };
  onboardedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function DriverProfile() {
  const [activeTab, setActiveTab] = useState('personal');
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState<DriverProfileData | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    joinDate: '',
    licenseNumber: '',
    licenseExpiry: '',
    insuranceNumber: '',
    insuranceExpiry: '',
  });

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      console.log('🔄 Loading driver profile data...');

      // Load driver profile from API
      const profileResponse = await driverApi.getProfile();
      
      if (profileResponse.success && profileResponse.data) {
        const data = profileResponse.data;
        console.log('✅ Driver profile loaded:', data);
        setProfileData(data);

        // Set form data from profile
        setFormData({
          firstName: data.user?.firstName || '',
          lastName: data.user?.lastName || '',
          email: data.user?.email || '',
          phone: data.user?.phone || '',
          address: '', // Note: address might not be in the API response
          dateOfBirth: '', // Not in your API response
          joinDate: data.onboardedAt ? new Date(data.onboardedAt).toISOString().split('T')[0] : '',
          licenseNumber: data.licenseNumber || '',
          licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry).toISOString().split('T')[0] : '',
          insuranceNumber: data.insuranceNumber || '',
          insuranceExpiry: data.insuranceExpiry ? new Date(data.insuranceExpiry).toISOString().split('T')[0] : '',
        });

        // Set vehicles
        if (data.vehicles && Array.isArray(data.vehicles)) {
          setVehicles(data.vehicles);
          if (data.vehicles.length > 0) {
            setActiveVehicleId(data.vehicles[0].id);
          }
        }

        // Set documents
        if (data.documents && Array.isArray(data.documents)) {
          setDocuments(data.documents);
        }
      } else {
        console.log('No profile data found');
        // Get user data from localStorage as fallback
        const userStr = localStorage.getItem('user');
        if (userStr) {
          try {
            const userData = JSON.parse(userStr);
            setFormData(prev => ({
              ...prev,
              firstName: userData.firstName || '',
              lastName: userData.lastName || '',
              email: userData.email || '',
              phone: userData.phone || '',
            }));
          } catch (e) {
            console.error('Error parsing user data:', e);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error loading profile:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const getProfileCompletion = () => {
    if (!profileData) return 0;
    
    let score = 0;
    const fields = [
      profileData.licenseNumber,
      profileData.licenseExpiry,
      profileData.insuranceNumber,
      profileData.insuranceExpiry,
      profileData.user?.firstName,
      profileData.user?.lastName,
      profileData.user?.phone,
    ];

    fields.forEach(field => {
      if (field && field.toString().trim().length > 0) {
        score += 14.3; // 100/7 ≈ 14.3
      }
    });

    return Math.min(Math.round(score), 100);
  };

  const getDocumentStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDocumentIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'rejected': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'expired': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const canDriveStatus = () => {
    if (!profileData) {
      return { canDrive: false, reason: 'Profile not loaded' };
    }

    if (profileData.status !== 'active') {
      return { canDrive: false, reason: 'Account not active' };
    }

    const hasExpiredDocs = documents.some((doc) => doc.status === 'expired');
    const hasPendingDocs = documents.some((doc) => doc.status === 'pending');
    const hasRejectedDocs = documents.some((doc) => doc.status === 'rejected');
    
    if (hasExpiredDocs) {
      return { canDrive: false, reason: 'Expired documents need renewal' };
    }
    if (hasRejectedDocs) {
      return { canDrive: false, reason: 'Rejected documents need re-upload' };
    }
    if (hasPendingDocs) {
      return { canDrive: false, reason: 'Waiting for document approval' };
    }
    
    // Check license and insurance expiry
    if (profileData.licenseExpiry && new Date(profileData.licenseExpiry) < new Date()) {
      return { canDrive: false, reason: 'License expired' };
    }
    if (profileData.insuranceExpiry && new Date(profileData.insuranceExpiry) < new Date()) {
      return { canDrive: false, reason: 'Insurance expired' };
    }

    return { canDrive: true, reason: 'All documents approved and valid' };
  };

  const handleSaveProfile = async () => {
    try {
      const updateData = {
        licenseNumber: formData.licenseNumber,
        licenseExpiry: formData.licenseExpiry,
        insuranceNumber: formData.insuranceNumber,
        insuranceExpiry: formData.insuranceExpiry,
      };

      const response = await driverApi.updateProfile(updateData);
      
      if (response.success) {
        toast.success('Profile updated successfully');
        setIsEditing(false);
        await loadProfileData(); // Refresh profile data
      } else {
        toast.error(`Failed to update profile: ${response.error}`);
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleAddVehicle = async () => {
    if (isEditing && activeVehicleId) {
      // Updating existing vehicle
      const activeVehicle = vehicles.find(v => v.id === activeVehicleId);
      if (!activeVehicle) return;
      
      const updateData = {
        make: activeVehicle.make,
        model: activeVehicle.model,
        year: activeVehicle.year,
        color: activeVehicle.color,
        licensePlate: activeVehicle.licensePlate,
        maxWeight: activeVehicle.maxWeight,
        maxVolume: activeVehicle.maxVolume,
      };
      
      const response = await driverApi.updateVehicle(activeVehicleId, updateData);
      if (response.success) {
        toast.success('Vehicle updated successfully');
        setIsEditing(false);
        await loadProfileData();
      } else {
        toast.error(`Failed to update vehicle: ${response.error}`);
      }
    } else {
      // Adding new vehicle
      const vehicleData = {
        type: 'small_van',
        make: 'Unknown',
        model: 'Unknown',
        year: new Date().getFullYear(),
        color: 'Unknown',
        licensePlate: '',
        maxWeight: 1000,
        maxVolume: 10,
      };
      
      const response = await driverApi.addVehicle(vehicleData);
      if (response.success) {
        toast.success('Vehicle added successfully');
        await loadProfileData();
      } else {
        toast.error(`Failed to add vehicle: ${response.error}`);
      }
    }
  };

  const handleDocumentUpload = async (docType: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('type', docType);
      formData.append('name', `${docType.charAt(0).toUpperCase() + docType.slice(1)} Document`);
      
      const response = await driverApi.uploadDocument(formData);
      
      if (response.success) {
        toast.success(`${docType} uploaded successfully`);
        await loadProfileData(); // Refresh data
      } else {
        toast.error(`Failed to upload document: ${response.error}`);
      }
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast.error(`Error uploading document: ${error.message}`);
    }
  };

  const handleVehicleImageUpload = async (vehicleId: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await driverApi.uploadVehicleImage(vehicleId, formData);
      
      if (response.success) {
        toast.success('Vehicle image uploaded successfully');
        await loadProfileData(); // Refresh data
      } else {
        toast.error(`Failed to upload image: ${response.error}`);
      }
    } catch (error: any) {
      console.error('Error uploading vehicle image:', error);
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleProfilePicUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('profilePicture', file);

      const response = await driverApi.uploadProfilePicture(formData);

      if (response.success) {
        toast.success('Profile picture uploaded successfully');
        await loadProfileData(); // Refresh data
      } else {
        toast.error(`Failed to upload profile picture: ${response.error}`);
      }
    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      toast.error(`Error: ${error.message}`);
    }
  };

  const drivingStatus = canDriveStatus();
  const activeVehicle = vehicles.find(v => v.id === activeVehicleId);
  const profileCompletion = getProfileCompletion();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profileData && !formData.firstName) {
    return (
      <div className="text-center py-12">
        <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No Profile Found</h3>
        <p className="text-gray-600 mt-1">Complete onboarding to create your driver profile</p>
        <Button className="mt-4" onClick={() => window.location.href = '/driver-onboarding'}>
          Go to Onboarding
        </Button>
      </div>
    );
  }

  const firstName = formData.firstName || profileData?.user?.firstName || 'Driver';
  const lastName = formData.lastName || profileData?.user?.lastName || '';
  const email = formData.email || profileData?.user?.email || '';
  const phone = formData.phone || profileData?.user?.phone || '';
  const rating = profileData?.rating || 0;
  const totalDeliveries = profileData?.totalDeliveries || 0;
  const totalEarnings = profileData?.totalEarnings || 0;
  const completionRate = profileData?.completionRate || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Avatar className="h-20 w-20">
              {profileData?.profilePicture?.originalUrl ? (
                <img
                  src={profileData.profilePicture.originalUrl}
                  alt={`${firstName} ${lastName}`}
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              <AvatarFallback className="text-lg bg-blue-100 text-blue-600">
                {firstName[0]}{lastName[0] || 'D'}
              </AvatarFallback>
            </Avatar>
            <input
              type="file"
              accept="image/*"
              id="profilePicInput"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  await handleProfilePicUpload(file);
                }
              }}
            />
            <label
              htmlFor="profilePicInput"
              className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full cursor-pointer hover:bg-blue-700 transition"
              title="Change profile picture"
            >
              <Edit className="h-3 w-3" />
            </label>
          </div>
          <div>
            <h2 className="text-2xl text-gray-900">
              {firstName} {lastName}
            </h2>
            <p className="text-gray-600">
              {activeVehicle ? `${activeVehicle.make} ${activeVehicle.model}` : 'No vehicle'}
            </p>
            <div className="flex items-center space-x-4 mt-2">
              <div className="flex items-center space-x-1">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">{rating.toFixed(1)} rating</span>
              </div>
              <div className="text-sm text-gray-600">
                {totalDeliveries} deliveries
              </div>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
            drivingStatus.canDrive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {drivingStatus.canDrive ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <span>{drivingStatus.canDrive ? 'Approved to Drive' : 'Cannot Drive'}</span>
          </div>
          <p className="text-xs text-gray-600 mt-1">{drivingStatus.reason}</p>
          <p className="text-xs text-gray-600 mt-2">
            Status: <Badge className="ml-1">{profileData?.status || 'pending'}</Badge>
          </p>
        </div>
      </div>

      {/* Profile Completion */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Profile Completion</span>
            <span className="text-sm text-gray-600">{profileCompletion}%</span>
          </div>
          <Progress value={profileCompletion} className="h-2" />
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="vehicle">Vehicle Info</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        {/* Personal Info Tab */}
        <TabsContent value="personal">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </CardTitle>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (isEditing) {
                      handleSaveProfile();
                    } else {
                      setIsEditing(true);
                    }
                  }}
                >
                  {isEditing ? <Save className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />}
                  {isEditing ? 'Save Changes' : 'Edit Profile'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    disabled={true} // User data comes from user service
                    onChange={(e) => setFormData({
                      ...formData,
                      firstName: e.target.value
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    disabled={true} // User data comes from user service
                    onChange={(e) => setFormData({
                      ...formData,
                      lastName: e.target.value
                    })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled={true}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    value={formData.phone}
                    disabled={true} // User data comes from user service
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="licenseNumber">License Number</Label>
                  <Input
                    id="licenseNumber"
                    value={formData.licenseNumber}
                    disabled={!isEditing}
                    onChange={(e) => setFormData({
                      ...formData,
                      licenseNumber: e.target.value
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licenseExpiry">License Expiry</Label>
                  <Input
                    id="licenseExpiry"
                    type="date"
                    value={formData.licenseExpiry}
                    disabled={!isEditing}
                    onChange={(e) => setFormData({
                      ...formData,
                      licenseExpiry: e.target.value
                    })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="insuranceNumber">Insurance Number</Label>
                  <Input
                    id="insuranceNumber"
                    value={formData.insuranceNumber}
                    disabled={!isEditing}
                    onChange={(e) => setFormData({
                      ...formData,
                      insuranceNumber: e.target.value
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="insuranceExpiry">Insurance Expiry</Label>
                  <Input
                    id="insuranceExpiry"
                    type="date"
                    value={formData.insuranceExpiry}
                    disabled={!isEditing}
                    onChange={(e) => setFormData({
                      ...formData,
                      insuranceExpiry: e.target.value
                    })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="joinDate">Member Since</Label>
                  <Input
                    id="joinDate"
                    value={formData.joinDate || 'Not available'}
                    disabled
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vehicle Info Tab */}
        <TabsContent value="vehicle">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Vehicle Information
                </CardTitle>
                <Button variant="outline" onClick={() => setIsEditing(!isEditing)}>
                  {isEditing ? <Save className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />}
                  {isEditing ? 'Save Vehicle' : 'Edit Vehicle'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {vehicles.length === 0 ? (
                <div className="text-center py-8">
                  <Car className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">No Vehicles</h3>
                  <p className="text-gray-600 mt-1">Add your first vehicle to get started</p>
                  <Button className="mt-4" onClick={handleAddVehicle}>
                    Add Vehicle
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
                        {activeVehicle?.imageUrl ? (
                          <img
                            src={activeVehicle.imageUrl}
                            alt="Vehicle"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.error('Failed to load vehicle image:', activeVehicle.imageUrl);
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : null}
                        {!activeVehicle?.imageUrl && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                            <Car className="h-12 w-12 mb-2" />
                            <span>No vehicle image</span>
                          </div>
                        )}
                      </div>
                      
                      <input
                        type="file"
                        accept="image/*"
                        id="vehicleImageInput"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !activeVehicleId) return;
                          
                          await handleVehicleImageUpload(activeVehicleId, file);
                        }}
                      />
                      
                      <Button
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() => document.getElementById('vehicleImageInput')?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Update Vehicle Photo
                      </Button>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="vehicleType">Vehicle Type</Label>
                          <Select 
                            value={activeVehicle?.type || ''} 
                            disabled={!isEditing}
                            onValueChange={(value) => {
                              if (!activeVehicleId) return;
                              setVehicles(prev => prev.map(vehicle => 
                                vehicle.id === activeVehicleId 
                                  ? { ...vehicle, type: value }
                                  : vehicle
                              ));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="motorcycle">Motorcycle</SelectItem>
                              <SelectItem value="small_van">Small Van</SelectItem>
                              <SelectItem value="medium_van">Medium Van</SelectItem>
                              <SelectItem value="truck">Truck</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="licensePlate">License Plate</Label>
                          <Input
                            id="licensePlate"
                            value={activeVehicle?.licensePlate || ''}
                            disabled={!isEditing}
                            onChange={(e) => {
                              if (!activeVehicleId) return;
                              setVehicles(prev => prev.map(vehicle => 
                                vehicle.id === activeVehicleId 
                                  ? { ...vehicle, licensePlate: e.target.value }
                                  : vehicle
                              ));
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="make">Make</Label>
                          <Input
                            id="make"
                            value={activeVehicle?.make || ''}
                            disabled={!isEditing}
                            onChange={(e) => {
                              if (!activeVehicleId) return;
                              setVehicles(prev => prev.map(vehicle => 
                                vehicle.id === activeVehicleId 
                                  ? { ...vehicle, make: e.target.value }
                                  : vehicle
                              ));
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="model">Model</Label>
                          <Input
                            id="model"
                            value={activeVehicle?.model || ''}
                            disabled={!isEditing}
                            onChange={(e) => {
                              if (!activeVehicleId) return;
                              setVehicles(prev => prev.map(vehicle => 
                                vehicle.id === activeVehicleId 
                                  ? { ...vehicle, model: e.target.value }
                                  : vehicle
                              ));
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="year">Year</Label>
                          <Input
                            id="year"
                            type="number"
                            value={activeVehicle?.year || ''}
                            disabled={!isEditing}
                            onChange={(e) => {
                              if (!activeVehicleId) return;
                              setVehicles(prev => prev.map(vehicle => 
                                vehicle.id === activeVehicleId 
                                  ? { ...vehicle, year: parseInt(e.target.value) || 0 }
                                  : vehicle
                              ));
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="color">Color</Label>
                          <Input
                            id="color"
                            value={activeVehicle?.color || ''}
                            disabled={!isEditing}
                            onChange={(e) => {
                              if (!activeVehicleId) return;
                              setVehicles(prev => prev.map(vehicle => 
                                vehicle.id === activeVehicleId 
                                  ? { ...vehicle, color: e.target.value }
                                  : vehicle
                              ));
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="maxWeight">Max Weight (kg)</Label>
                          <Input
                            id="maxWeight"
                            type="number"
                            value={activeVehicle?.maxWeight || ''}
                            disabled={!isEditing}
                            onChange={(e) => {
                              if (!activeVehicleId) return;
                              setVehicles(prev => prev.map(vehicle => 
                                vehicle.id === activeVehicleId 
                                  ? { ...vehicle, maxWeight: parseInt(e.target.value) || 0 }
                                  : vehicle
                              ));
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="maxVolume">Max Volume (m³)</Label>
                          <Input
                            id="maxVolume"
                            type="number"
                            value={activeVehicle?.maxVolume || ''}
                            disabled={!isEditing}
                            onChange={(e) => {
                              if (!activeVehicleId) return;
                              setVehicles(prev => prev.map(vehicle => 
                                vehicle.id === activeVehicleId 
                                  ? { ...vehicle, maxVolume: parseFloat(e.target.value) || 0 }
                                  : vehicle
                              ));
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {isEditing && (
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddVehicle}>
                        Save Changes
                      </Button>
                    </div>
                  )}
                  
                  {vehicles.length > 1 && (
                    <div>
                      <Label>Select Vehicle</Label>
                      <div className="flex gap-2 mt-2">
                        {vehicles.map((vehicle) => (
                          <Button
                            key={vehicle.id}
                            variant={activeVehicleId === vehicle.id ? "default" : "outline"}
                            onClick={() => setActiveVehicleId(vehicle.id)}
                          >
                            {vehicle.make} {vehicle.model}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <div className="space-y-6">
            {!drivingStatus.canDrive && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <h4 className="font-medium text-red-900">Action Required</h4>
                </div>
                <p className="text-red-700 mt-1">
                  You cannot accept orders until all document issues are resolved. Please upload or renew expired documents.
                </p>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Required Documents
                </CardTitle>
                <p className="text-gray-600">Keep your documents up to date to continue driving</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {documents.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900">No Documents</h3>
                      <p className="text-gray-600 mt-1">Upload your documents to get verified</p>
                    </div>
                  ) : (
                    documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center space-x-3">
                          {getDocumentIcon(doc.status)}
                          <div>
                            <h4 className="font-medium">{doc.name}</h4>
                            <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 text-sm text-gray-600">
                              <span>Type: {doc.type}</span>
                              <span>Uploaded: {new Date(doc.uploadDate).toLocaleDateString()}</span>
                              {doc.expiryDate && (
                                <span>Expires: {new Date(doc.expiryDate).toLocaleDateString()}</span>
                              )}
                            </div>
                            {doc.rejectionReason && (
                              <p className="text-sm text-red-600 mt-1">
                                Rejected: {doc.rejectionReason}
                              </p>
                            )}
                            {doc.fileUrl && (
                              <a 
                                href={doc.fileUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                              >
                                View Document
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Badge className={getDocumentStatusColor(doc.status)}>
                            {doc.status}
                          </Badge>
                          {(doc.status === 'expired' || doc.status === 'rejected') && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <Upload className="mr-2 h-4 w-4" />
                                  Re-upload
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Upload {doc.name}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Please upload a new {doc.name.toLowerCase()} document. Make sure it's clear and not expired.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="py-4">
                                  <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    className="w-full p-2 border rounded"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        handleDocumentUpload(doc.type, file);
                                      }
                                    }}
                                  />
                                </div>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction>
                                    Upload
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  
                  {/* Upload new document button */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="w-full mt-4">
                        <Upload className="mr-2 h-4 w-4" />
                        Upload New Document
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Upload Document</AlertDialogTitle>
                        <AlertDialogDescription>
                          Select document type and file to upload.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="py-4 space-y-4">
                        <Select onValueChange={(type) => {
                          const fileInput = document.getElementById('newDocumentFile') as HTMLInputElement;
                          if (fileInput?.files?.[0]) {
                            handleDocumentUpload(type as string, fileInput.files[0]);
                          }
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select document type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="license">Driver License</SelectItem>
                            <SelectItem value="insurance">Insurance</SelectItem>
                            <SelectItem value="registration">Vehicle Registration</SelectItem>
                            <SelectItem value="inspection">Inspection Certificate</SelectItem>
                          </SelectContent>
                        </Select>
                        <input
                          id="newDocumentFile"
                          type="file"
                          accept="image/*,.pdf"
                          className="w-full p-2 border rounded"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            const typeSelect = document.querySelector('[data-state="open"] [role="combobox"]') as HTMLInputElement;
                            if (file && typeSelect?.value) {
                              handleDocumentUpload(typeSelect.value, file);
                            }
                          }}
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction>
                          Upload
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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
                <CardTitle>Driver Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <p className="text-3xl text-blue-600">{totalDeliveries}</p>
                    <p className="text-gray-600">Total Deliveries</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl text-yellow-600">{rating.toFixed(1)}</p>
                    <p className="text-gray-600">Average Rating</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl text-green-600">${totalEarnings.toLocaleString()}</p>
                    <p className="text-gray-600">Total Earnings</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl text-purple-600">{completionRate}%</p>
                    <p className="text-gray-600">Completion Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Verification Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {profileData?.verificationLevel === 'verified' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-yellow-600" />
                      )}
                      <span>Account Verification</span>
                    </div>
                    <Badge className={profileData?.verificationLevel === 'verified' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                      {profileData?.verificationLevel || 'none'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Settings className="h-5 w-5 text-blue-600" />
                      <span>Profile Completion</span>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">{profileCompletion}%</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {drivingStatus.canDrive ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      )}
                      <span>Driving Authorization</span>
                    </div>
                    <Badge className={drivingStatus.canDrive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {drivingStatus.canDrive ? 'Authorized' : 'Suspended'}
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