import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Truck, MapPin, Package, Clock, Star, Weight, Gauge, Upload, Eye, AlertTriangle, RefreshCw } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { driverApi } from '../src/lib/api';
import { useDriverProfile } from '../src/hooks/useDriverProfile';
import { toast } from 'sonner';

interface Vehicle {
  id: string;
  type: string;
  make: string;
  model: string;
  licensePlate: string;
  maxWeight: number;
  maxVolume: number;
  categories: string[];
  imageUrl?: string;
  color?: string;
  year?: number;
  isActive?: boolean;
}

interface Order {
  id: string;
  customer: string;
  payment: string;
  distance: string;
  pickup: string;
  delivery: string;
  weight: string;
  volume: string;
  urgency: 'urgent' | 'normal';
}

interface Stats {
  totalDeliveries: number;
  rating: number;
  totalEarnings: number;
  completionRate: number;
}

export function DriverDashboard() {
  const [isOnline, setIsOnline] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingVehiclePic, setUploadingVehiclePic] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const { driverData } = useDriverProfile();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      console.log('🚗 Loading dashboard data...');

      // Load vehicles
      const vehiclesResponse = await driverApi.getVehicles();
      console.log('🚗 Vehicles response:', vehiclesResponse);

      if (vehiclesResponse.success && vehiclesResponse.data) {
        const vehiclesData = Array.isArray(vehiclesResponse.data) 
          ? vehiclesResponse.data 
          : vehiclesResponse.data.vehicles || [];

        console.log('🚗 Raw vehicles data:', vehiclesData);

        const mappedVehicles: Vehicle[] = vehiclesData.map((v: any) => ({
          id: v.id || v._id,
          type: v.type || v.vehicleType || 'vehicle',
          make: v.make || '',
          model: v.model || '',
          licensePlate: v.licensePlate || v.license_plate || '',
          maxWeight: v.maxWeight || v.maxWeightKg || 0,
          maxVolume: v.maxVolume || v.maxVolumeM3 || 0,
          imageUrl: v.imageUrl || v.image_url,
          color: v.color || '',
          year: v.year || 0,
          isActive: v.isActive || false,
          categories: v.categories || []
        }));

        console.log('🚗 Mapped vehicles:', mappedVehicles);
        setVehicles(mappedVehicles);

        if (mappedVehicles.length > 0) {
          setSelectedVehicle(mappedVehicles[0].id);
        }
      }

      // Load stats
      const statsResponse = await driverApi.getStats();
      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data as Stats);
      } else {
        // Use fallback stats
        setStats({
          totalDeliveries: driverData?.totalDeliveries || 0,
          rating: driverData?.rating || 0,
          totalEarnings: driverData?.totalEarnings || 0,
          completionRate: driverData?.completionRate || 0
        });
      }

      // Load pending orders (you'll need to implement this API endpoint)
      // For now, we'll set empty array
      setPendingOrders([]);

    } catch (error: any) {
      console.error('❌ Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data. Using sample data.');

      // Fallback to sample data
      const sampleVehicle: Vehicle = {
        id: 'sample-1',
        type: 'Medium Truck',
        make: 'Ford',
        model: 'Transit',
        licensePlate: 'ABC-123',
        maxWeight: 1000,
        maxVolume: 10,
        imageUrl: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13',
        color: 'White',
        year: 2023,
        isActive: true,
        categories: ['General']
      };
      
      setVehicles([sampleVehicle]);
      setSelectedVehicle('sample-1');
      setStats({
        totalDeliveries: 0,
        rating: 0,
        totalEarnings: 0,
        completionRate: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOnline = async (value: boolean) => {
    try {
      // Use the correct endpoint for online/offline toggle
      const response = await driverApi.updateStatus({ isOnline: value });

      if (response.success) {
        setIsOnline(value);
        toast.success(`You are now ${value ? 'available' : 'offline'}`);
      } else {
        toast.error(response.error || 'Failed to update status');
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error('Failed to update availability');
    }
  };

  const getVehicleImageUrl = (vehicle: Vehicle): string | null => {
    if (!vehicle?.imageUrl) return null;
    // Clean URL by removing query parameters if present
    return vehicle.imageUrl.split('?')[0];
  };

  const handleVehicleImageUpload = async (vehicleId: string, file: File) => {
    setUploadingVehiclePic(vehicleId);
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      console.log('📤 Uploading vehicle image for vehicle:', vehicleId);
      
      const response = await driverApi.uploadVehicleImage(vehicleId, formData);
      
      if (response.success) {
        toast.success('Vehicle image uploaded successfully');
        console.log('✅ Vehicle image upload response:', response.data);
        
        // Clear image error for this vehicle
        setImageErrors(prev => ({ ...prev, [vehicleId]: false }));
        
        // Reload data with delay to ensure backend has processed
        setTimeout(async () => {
          await loadDashboardData();
        }, 1000);
      } else {
        toast.error(`Failed to upload image: ${response.error}`);
      }
    } catch (error: any) {
      console.error('Error uploading vehicle image:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setUploadingVehiclePic(null);
    }
  };

  const handleImageError = (vehicleId: string) => {
    console.error(`❌ Vehicle image load error:`, vehicleId);
    setImageErrors(prev => ({ ...prev, [vehicleId]: true }));
  };

  const handleRetryImage = (vehicleId: string) => {
    setImageErrors(prev => ({ ...prev, [vehicleId]: false }));
    
    // Force re-render by updating state
    setVehicles(prev => [...prev]);
  };

  const currentVehicle = vehicles.find((v: Vehicle) => v.id === selectedVehicle);
  const currentVehicleImageUrl = currentVehicle ? getVehicleImageUrl(currentVehicle) : null;
  const hasVehiclePicError = currentVehicle ? imageErrors[currentVehicle.id] : false;

  const getDefaultVehicleImage = () => {
    return 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=250&fit=crop';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Driver Status</CardTitle>
            {/* Make the status itself a clickable button */}
            <Button
              variant={isOnline ? "default" : "outline"}
              size="sm"
              onClick={() => handleToggleOnline(!isOnline)}
              className={`flex items-center space-x-2 ${
                isOnline ? 'bg-green-500 hover:bg-green-600' : ''
              }`}
              aria-label={isOnline ? "Go offline" : "Go online"}
            >
              {isOnline ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                  <span>Available</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  <span>Offline</span>
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-sm font-medium">
                {isOnline ? 'Available for orders' : 'Unavailable'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span className="text-sm">Downtown Area</span>
            </div>
            <div className="flex items-center space-x-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">{stats?.rating?.toFixed(1) || 0} Rating</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm">{stats?.totalDeliveries || 0} Deliveries</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Active Vehicle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Label htmlFor="vehicle-select" className="font-medium">Select Vehicle:</Label>
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Choose vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle: Vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.type} - {vehicle.licensePlate} {vehicle.make && `(${vehicle.make} ${vehicle.model})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {currentVehicle ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden border">
                  {currentVehicleImageUrl && !hasVehiclePicError ? (
                    <>
                      <img
                        key={`vehicle-img-${currentVehicle.id}`}
                        src={currentVehicleImageUrl}
                        alt={`${currentVehicle.make} ${currentVehicle.model}`}
                        className="w-full h-full object-cover"
                        onError={() => {
                          console.error('❌ Vehicle image failed to load:', {
                            url: currentVehicleImageUrl,
                            vehicleId: currentVehicle.id,
                          });
                          handleImageError(currentVehicle.id);
                        }}
                        onLoad={() => {
                          console.log('✅ Vehicle image loaded successfully:', currentVehicleImageUrl);
                          // Clear any previous errors
                          handleRetryImage(currentVehicle.id);
                        }}
                        crossOrigin="anonymous"
                      />
                      
                      <button
                        onClick={() => window.open(currentVehicleImageUrl, '_blank')}
                        className="absolute top-2 left-2 bg-black/70 text-white p-1.5 rounded hover:bg-black/90 transition"
                        title="Open image in new tab"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      
                      {currentVehicleImageUrl && (
                        <button
                          onClick={() => handleRetryImage(currentVehicle.id)}
                          className="absolute top-2 right-2 bg-black/70 text-white p-1.5 rounded hover:bg-black/90 transition"
                          title="Refresh image"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                      {hasVehiclePicError ? (
                        <>
                          <AlertTriangle className="h-12 w-12 mb-2 text-red-400" />
                          <span>Image failed to load</span>
                          <button
                            onClick={() => handleRetryImage(currentVehicle.id)}
                            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                          >
                            Retry
                          </button>
                        </>
                      ) : (
                        <>
                          <Truck className="h-12 w-12 mb-2" />
                          <span>No vehicle image</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="vehicle-image-upload"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const file = e.target.files?.[0];
                    if (file && currentVehicle) {
                      handleVehicleImageUpload(currentVehicle.id, file);
                      e.target.value = ''; // Reset input
                    }
                  }}
                />
                <label htmlFor="vehicle-image-upload">
                  <Button 
                    variant="outline" 
                    className="w-full cursor-pointer"
                    disabled={uploadingVehiclePic === currentVehicle.id}
                  >
                    {uploadingVehiclePic === currentVehicle.id ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        {currentVehicleImageUrl ? 'Update Vehicle Photo' : 'Upload Vehicle Photo'}
                      </>
                    )}
                  </Button>
                </label>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold">
                    {currentVehicle.make} {currentVehicle.model}
                    {currentVehicle.year && ` (${currentVehicle.year})`}
                  </h3>
                  <p className="text-gray-600">{currentVehicle.licensePlate}</p>
                  {currentVehicle.color && (
                    <p className="text-sm text-gray-500">
                      Color: {currentVehicle.color}
                    </p>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Weight className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Max Weight</span>
                    </div>
                    <p className="text-lg">{currentVehicle.maxWeight} kg</p>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Package className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Max Volume</span>
                    </div>
                    <p className="text-lg">{currentVehicle.maxVolume} m³</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Vehicle Type</h4>
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    {currentVehicle.type}
                  </Badge>
                </div>
                
                {currentVehicle.categories && currentVehicle.categories.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Capabilities</h4>
                    <div className="flex flex-wrap gap-2">
                      {currentVehicle.categories.map((category: string) => (
                        <Badge key={category} variant="outline">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-2 ${currentVehicle.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-sm">
                    {currentVehicle.isActive ? 'Vehicle Active' : 'Vehicle Inactive'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Truck className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Vehicles</h3>
              <p className="text-gray-600 mt-1">Add a vehicle in your profile to get started</p>
              <Button 
                className="mt-4"
                onClick={() => window.location.href = '/driver-profile?tab=vehicle'}
              >
                Go to Vehicle Setup
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Driver Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-3xl font-bold text-blue-600">{stats?.totalDeliveries || 0}</p>
              <p className="text-gray-600">Total Deliveries</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-3xl font-bold text-yellow-600">{stats?.rating?.toFixed(1) || 0}</p>
              <p className="text-gray-600">Average Rating</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-3xl font-bold text-green-600">${(stats?.totalEarnings || 0).toLocaleString()}</p>
              <p className="text-gray-600">Total Earnings</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-3xl font-bold text-purple-600">{stats?.completionRate || 0}%</p>
              <p className="text-gray-600">Completion Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Orders */}
      {pendingOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Orders Near You</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingOrders.map((order: Order) => (
                <div key={order.id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium">Order #{order.id}</h4>
                      <p className="text-sm text-gray-600">Customer: {order.customer}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-green-600">{order.payment}</p>
                      <p className="text-sm text-gray-600">{order.distance}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 text-green-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Pickup:</p>
                        <p className="text-sm text-gray-600">{order.pickup}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 text-red-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Delivery:</p>
                        <p className="text-sm text-gray-600">{order.delivery}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-600">{order.weight}</span>
                      <span className="text-sm text-gray-600">{order.volume}</span>
                      <Badge variant={order.urgency === 'urgent' ? 'destructive' : 'secondary'}>
                        {order.urgency}
                      </Badge>
                    </div>
                    <div className="space-x-2">
                      <Button variant="outline" size="sm">View Details</Button>
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                        Accept Order
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}