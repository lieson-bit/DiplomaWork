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
import { Avatar, AvatarFallback } from "./ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { User, Car, FileText, Upload, CheckCircle, AlertTriangle, Clock, Star, MapPin, Phone, Mail, Calendar, Settings } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useDriverProfile } from '../src/hooks/useDriverProfile';
import { getCurrentUser } from '../src/lib/auth-utils';
import { driverApi } from '../src/lib/api';
import { useRef } from 'react';

interface Document {
  id: string;
  type: 'license' | 'insurance' | 'registration' | 'inspection';
  name: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  uploadDate: string;
  expiryDate?: string;
  rejectionReason?: string;
}


export function DriverProfile() {
  const [activeTab, setActiveTab] = useState('personal');
  const [isEditing, setIsEditing] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [activeVehicleId, setActiveVehicleId] = useState(null);
  const fileRef = useRef(null);
  const [formData, setFormData] = useState({
    personalInfo: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      dateOfBirth: '',
      joinDate: ''
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
    }
  });

  const { 
    driverData, 
    loading, 
    error, 
    updateProfile,
    addVehicle,
    loadDriverProfile
  } = useDriverProfile();

  const [localDocuments, setLocalDocuments] = useState([]);
  const [localStats, setLocalStats] = useState({
    totalDeliveries: 0,
    rating: 0,
    totalEarnings: 0,
    completionRate: 0
  });
  const [localVerification, setLocalVerification] = useState({
    backgroundCheck: 'pending' as const,
    profileCompletion: 30,
    canDrive: false
  });

  /*/ Initialize form data when driverData loads
  useEffect(() => {
    if (driverData) {
      console.log('Driver data loaded:', driverData);
      setFormData({
        personalInfo: {
          firstName: driverData.personalInfo?.firstName || driverData.firstName || '',
          lastName: driverData.personalInfo?.lastName || driverData.lastName || '',
          email: driverData.personalInfo?.email || driverData.email || '',
          phone: driverData.personalInfo?.phone || driverData.phone || '',
          address: driverData.personalInfo?.address || driverData.address || '',
          dateOfBirth: driverData.personalInfo?.dateOfBirth || driverData.dateOfBirth || '',
          joinDate: driverData.personalInfo?.joinDate || driverData.joinDate || new Date().toISOString().split('T')[0]
        },
        vehicleInfo: {
          type: driverData.vehicleInfo?.type || driverData.vehicleType || '',
          make: driverData.vehicleInfo?.make || driverData.make || '',
          model: driverData.vehicleInfo?.model || driverData.model || '',
          year: driverData.vehicleInfo?.year || driverData.year || '',
          color: driverData.vehicleInfo?.color || driverData.color || '',
          licensePlate: driverData.vehicleInfo?.licensePlate || driverData.licensePlate || '',
          maxWeight: driverData.vehicleInfo?.maxWeight || driverData.maxWeight || 0,
          maxVolume: driverData.vehicleInfo?.maxVolume || driverData.maxVolume || 0
        }
      });

      // For documents, stats, and verification, use seed data if not available from API
      setLocalDocuments(driverData.documents || getSeedDocuments());
      setLocalStats(driverData.stats || getSeedStats());
      setLocalVerification(driverData.verification || getSeedVerification(driverData));
    }
  }, [driverData]);*/

  // Replace ALL your useEffect code with this:
  useEffect(() => {
    const loadDriverProfile = async () => {
      try {
        console.log('🚗 Loading driver profile and vehicles...');

        // 1. Load driver profile
        const profileResponse = await driverApi.getProfile();
        if (profileResponse.success && profileResponse.data) {
          const profileData = profileResponse.data;
          console.log('👤 Profile loaded:', profileData);

          // Get user data from localStorage
          const userData = JSON.parse(localStorage.getItem('user') || '{}');

          // Set personal info from profile or user data
          setFormData({
            personalInfo: {
              firstName: profileData.firstName || userData.firstName || '',
              lastName: profileData.lastName || userData.lastName || '',
              email: profileData.email || userData.email || '',
              phone: profileData.phone || userData.phone || '',
              address: profileData.address || '',
              dateOfBirth: profileData.dateOfBirth || '',
              joinDate: profileData.joinDate || profileData.onboardedAt?.split('T')[0] || ''
            },
            // EMPTY vehicle info - we'll get it from vehicles API
            vehicleInfo: {
              type: '',
              make: '',
              model: '',
              year: '',
              color: '',
              licensePlate: '',
              maxWeight: 0,
              maxVolume: 0
            }
          });

          // Load documents if available
          if (profileData.documents) {
            setLocalDocuments(profileData.documents);
          } else {
            // Fetch documents separately
            const docsResponse = await driverApi.getDocuments();
            if (docsResponse.success) {
              setLocalDocuments(docsResponse.data || []);
            }
          }

          // Load stats if available
          if (profileData.stats) {
            setLocalStats(profileData.stats);
          } else {
            const statsResponse = await driverApi.getStats();
            if (statsResponse.success) {
              setLocalStats(statsResponse.data || getSeedStats());
            }
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };

    const loadVehicles = async () => {
      try {
        const response = await driverApi.getVehicles();
        if (response.success && response.data) {
          const vehiclesList = Array.isArray(response.data) 
            ? response.data 
            : response.data.data || [];

          console.log('🚗 Vehicles loaded:', vehiclesList);
          setVehicles(vehiclesList);

          // Set active vehicle if we have one
          if (vehiclesList.length > 0) {
            setActiveVehicleId(vehiclesList[0].id);
          }
        }
      } catch (error) {
        console.error('Error loading vehicles:', error);
      }
    };

    // Load both in parallel
    Promise.all([loadDriverProfile(), loadVehicles()]);
  }, []);

  const activeVehicle = vehicles.find(v => v.id === activeVehicleId);

  const getSeedDocuments = (): Document[] => [
    {
      id: 'DOC001',
      type: 'license',
      name: 'Driver License',
      status: 'pending',
      uploadDate: new Date().toISOString().split('T')[0],
      expiryDate: '2026-03-15'
    },
    {
      id: 'DOC002',
      type: 'insurance',
      name: 'Auto Insurance',
      status: 'pending',
      uploadDate: new Date().toISOString().split('T')[0],
      expiryDate: '2024-12-01'
    }
  ];

  const getSeedStats = () => ({
    totalDeliveries: 0,
    rating: 0,
    totalEarnings: 0,
    completionRate: 0
  });

  const getSeedVerification = (data: any) => {
    const completionScore = 
      (data?.firstName ? 20 : 0) +
      (data?.lastName ? 20 : 0) +
      (data?.phone ? 15 : 0) +
      (data?.address ? 15 : 0) +
      (data?.vehicleType || data?.vehicleInfo?.type ? 30 : 0);
    
    return {
      backgroundCheck: 'pending' as const,
      profileCompletion: Math.min(completionScore, 100),
      canDrive: false
    };
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

  const handleDocumentStatusUpdate = (docType: string) => {
    // Mock document upload (using seed data)
    const updatedDocs = localDocuments.map((doc: Document) => 
      doc.type === docType ? { 
        ...doc, 
        status: 'pending' as const, 
        uploadDate: new Date().toISOString().split('T')[0] 
      } : doc
    );
    setLocalDocuments(updatedDocs);
  };

  const canDriveStatus = () => {
    const hasExpiredDocs = localDocuments.some((doc: Document) => doc.status === 'expired');
    const hasPendingDocs = localDocuments.some((doc: Document) => doc.status === 'pending');
    const hasRejectedDocs = localDocuments.some((doc: Document) => doc.status === 'rejected');
    
    if (hasExpiredDocs || hasRejectedDocs) {
      return { canDrive: false, reason: 'Document issues need to be resolved' };
    }
    if (hasPendingDocs) {
      return { canDrive: false, reason: 'Waiting for document approval' };
    }
    return { canDrive: true, reason: 'All documents approved' };
  };

  const handleSaveProfile = async () => {
    // Prepare data for backend
    const updateData = {
      // Personal info
      firstName: formData.personalInfo.firstName,
      lastName: formData.personalInfo.lastName,
      phone: formData.personalInfo.phone,
      address: formData.personalInfo.address,
      dateOfBirth: formData.personalInfo.dateOfBirth,

      // Vehicle info
      vehicleInfo: {
        type: formData.vehicleInfo.type,
        make: formData.vehicleInfo.make,
        model: formData.vehicleInfo.model,
        year: formData.vehicleInfo.year,
        color: formData.vehicleInfo.color,
        licensePlate: formData.vehicleInfo.licensePlate,
        maxWeight: formData.vehicleInfo.maxWeight,
        maxVolume: formData.vehicleInfo.maxVolume
      }
    };

    const success = await updateProfile(updateData);
    if (success) {
      setIsEditing(false);
    }
  };

  const handleAddVehicle = async () => {
    if (!activeVehicleId) {
      // Creating a new vehicle
      const vehicleData = {
        type: formData.vehicleInfo.type,
        make: formData.vehicleInfo.make,
        model: formData.vehicleInfo.model,
        year: formData.vehicleInfo.year,
        color: formData.vehicleInfo.color,
        licensePlate: formData.vehicleInfo.licensePlate,
        maxWeight: formData.vehicleInfo.maxWeight,
        maxVolume: formData.vehicleInfo.maxVolume
      };
      
      const response = await driverApi.addVehicle(vehicleData);
      if (response.success) {
        // Refresh vehicles list
        const vehiclesResponse = await driverApi.getVehicles();
        if (vehiclesResponse.success) {
          setVehicles(vehiclesResponse.data);
        }
        setIsEditing(false);
        toast.success('Vehicle added successfully');
      }
    } else {
      // Updating existing vehicle
      const activeVehicle = vehicles.find(v => v.id === activeVehicleId);
      if (!activeVehicle) return;
      
      const updateData = {
        type: activeVehicle.type,
        make: activeVehicle.make,
        model: activeVehicle.model,
        year: activeVehicle.year,
        color: activeVehicle.color,
        licensePlate: activeVehicle.licensePlate,
        maxWeight: activeVehicle.maxWeight,
        maxVolume: activeVehicle.maxVolume
      };
      
      // Note: Your backend API needs a PUT endpoint for vehicles
      // If not available, you'll need to implement it
      toast.info('Vehicle update requires backend PUT endpoint');
    }
  };

  const handleDocumentUpload = async (docType: string, file: File) => {
    try {
      // For now, simulate API call - you'll need to import and use driverApi
      toast.success(`${docType} uploaded successfully (simulated)`);
      
      // Update local documents state
      const newDoc: Document = {
        id: `doc-${Date.now()}`,
        type: docType as any,
        name: `${docType} Document`,
        status: 'pending',
        uploadDate: new Date().toISOString().split('T')[0],
        expiryDate: '2026-12-31'
      };

      setLocalDocuments((prev: Document[]) => [...prev, newDoc]);
    } catch (error: any) {
      toast.error(`Error uploading document: ${error.message}`);
    }
  };

  const drivingStatus = canDriveStatus();

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

  const currentUser = getCurrentUser();
  const displayName = formData.personalInfo.firstName && formData.personalInfo.lastName 
    ? formData.personalInfo 
    : currentUser || { firstName: 'Driver', lastName: 'User' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-4">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-lg">
              {displayName.firstName?.[0] || 'D'}{displayName.lastName?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl text-gray-900">
              {displayName.firstName} {displayName.lastName}
            </h2>
            <p className="text-gray-600">{formData.vehicleInfo.type || 'Driver'}</p>
            <div className="flex items-center space-x-4 mt-2">
              <div className="flex items-center space-x-1">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">{localStats.rating || 0} rating</span>
              </div>
              <div className="text-sm text-gray-600">
                {localStats.totalDeliveries || 0} deliveries
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
        </div>
      </div>

      {/* Profile Completion */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Profile Completion</span>
            <span className="text-sm text-gray-600">{localVerification.profileCompletion}%</span>
          </div>
          <Progress value={localVerification.profileCompletion} className="h-2" />
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="vehicle">Vehicle Info</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

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
                    value={formData.personalInfo.firstName}
                    disabled={!isEditing}
                    onChange={(e: any) => setFormData({
                      ...formData,
                      personalInfo: { ...formData.personalInfo, firstName: e.target.value }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.personalInfo.lastName}
                    disabled={!isEditing}
                    onChange={(e: any) => setFormData({
                      ...formData,
                      personalInfo: { ...formData.personalInfo, lastName: e.target.value }
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
                    value={formData.personalInfo.email}
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
                    value={formData.personalInfo.phone}
                    disabled={!isEditing}
                    className="pl-10"
                    onChange={(e: any) => setFormData({
                      ...formData,
                      personalInfo: { ...formData.personalInfo, phone: e.target.value }
                    })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Textarea
                    id="address"
                    value={formData.personalInfo.address}
                    disabled={!isEditing}
                    className="pl-10"
                    rows={2}
                    onChange={(e: any) => setFormData({
                      ...formData,
                      personalInfo: { ...formData.personalInfo, address: e.target.value }
                    })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.personalInfo.dateOfBirth}
                      disabled={!isEditing}
                      className="pl-10"
                      onChange={(e: any) => setFormData({
                        ...formData,
                        personalInfo: { ...formData.personalInfo, dateOfBirth: e.target.value }
                      })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="joinDate">Member Since</Label>
                  <Input
                    id="joinDate"
                    value={new Date(formData.personalInfo.joinDate).toLocaleDateString()}
                    disabled
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicle">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Vehicle Information
                </CardTitle>
                <Button variant="outline" onClick={() => {
                  if (isEditing) {
                    handleAddVehicle();
                  } else {
                    setIsEditing(true);
                  }
                }}>
                  {isEditing ? 'Save Vehicle' : 'Edit Vehicle'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <ImageWithFallback
                    src={activeVehicle?.imageUrl || ''}
                    alt="Vehicle"
                    className="w-full h-48 object-cover rounded-lg"
                    fallbackText="No vehicle image"
                  />
                  
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    ref={fileRef}
                    onChange={async (e: any) => {
                      const file = e.target.files?.[0];
                      if (!file || !activeVehicleId) return;
                      
                      const formData = new FormData();
                      formData.append('image', file);
                      
                      await driverApi.uploadVehicleImage(activeVehicleId, formData);
                      
                      // Refresh vehicle list
                      const response = await driverApi.getVehicles();
                      if (response.success) {
                        setVehicles(response.data);
                      }
                    }}
                  />
                  
                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => fileRef.current?.click()}
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
                        value={formData.vehicleInfo.type} 
                        disabled={!isEditing}
                        onValueChange={(value: string) => setFormData({
                          ...formData,
                          vehicleInfo: { ...formData.vehicleInfo, type: value }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Motorbike">Motorbike</SelectItem>
                          <SelectItem value="Small Van">Small Van</SelectItem>
                          <SelectItem value="Medium Truck">Medium Truck</SelectItem>
                          <SelectItem value="Large Truck">Large Truck</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="licensePlate">License Plate</Label>

                      // Then in your form inputs, use activeVehicle instead of formData.vehicleInfo:
                      <Input
                        id="licensePlate"
                        value={activeVehicle?.licensePlate || ''}
                        disabled={!isEditing}
                        onChange={(e: any) => {
                          if (!activeVehicleId) return;
                          // Update the specific vehicle in state
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
                        value={formData.vehicleInfo.make}
                        disabled={!isEditing}
                        onChange={(e: any) => setFormData({
                          ...formData,
                          vehicleInfo: { ...formData.vehicleInfo, make: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="model">Model</Label>
                      <Input
                        id="model"
                        value={formData.vehicleInfo.model}
                        disabled={!isEditing}
                        onChange={(e: any) => setFormData({
                          ...formData,
                          vehicleInfo: { ...formData.vehicleInfo, model: e.target.value }
                        })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="year">Year</Label>
                      <Input
                        id="year"
                        value={formData.vehicleInfo.year}
                        disabled={!isEditing}
                        onChange={(e: any) => setFormData({
                          ...formData,
                          vehicleInfo: { ...formData.vehicleInfo, year: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="color">Color</Label>
                      <Input
                        id="color"
                        value={formData.vehicleInfo.color}
                        disabled={!isEditing}
                        onChange={(e: any) => setFormData({
                          ...formData,
                          vehicleInfo: { ...formData.vehicleInfo, color: e.target.value }
                        })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxWeight">Max Weight (kg)</Label>
                      <Input
                        id="maxWeight"
                        type="number"
                        value={formData.vehicleInfo.maxWeight}
                        disabled={!isEditing}
                        onChange={(e: any) => setFormData({
                          ...formData,
                          vehicleInfo: { ...formData.vehicleInfo, maxWeight: parseInt(e.target.value) || 0 }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxVolume">Max Volume (m³)</Label>
                      <Input
                        id="maxVolume"
                        type="number"
                        value={formData.vehicleInfo.maxVolume}
                        disabled={!isEditing}
                        onChange={(e: any) => setFormData({
                          ...formData,
                          vehicleInfo: { ...formData.vehicleInfo, maxVolume: parseInt(e.target.value) || 0 }
                        })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
                  {localDocuments.map((doc: Document) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getDocumentIcon(doc.status)}
                        <div>
                          <h4 className="font-medium">{doc.name}</h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span>Uploaded: {doc.uploadDate}</span>
                            {doc.expiryDate && (
                              <span>Expires: {doc.expiryDate}</span>
                            )}
                          </div>
                          {doc.rejectionReason && (
                            <p className="text-sm text-red-600 mt-1">
                              Rejected: {doc.rejectionReason}
                            </p>
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
                                  onChange={(e: any) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleDocumentUpload(doc.type, file);
                                    }
                                  }}
                                />
                              </div>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => {
                                  handleDocumentStatusUpdate(doc.type);
                                }}>
                                  Upload
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stats">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Driver Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <p className="text-3xl text-blue-600">{localStats.totalDeliveries}</p>
                    <p className="text-gray-600">Total Deliveries</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl text-yellow-600">{localStats.rating}</p>
                    <p className="text-gray-600">Average Rating</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl text-green-600">${localStats.totalEarnings.toLocaleString()}</p>
                    <p className="text-gray-600">Total Earnings</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl text-purple-600">{localStats.completionRate}%</p>
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
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span>Background Check</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">
                      {localVerification.backgroundCheck === 'approved' ? 'Approved' : 'Pending'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Settings className="h-5 w-5 text-blue-600" />
                      <span>Profile Completion</span>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">{localVerification.profileCompletion}%</Badge>
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