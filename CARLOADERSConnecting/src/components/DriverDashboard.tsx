import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback } from "./ui/avatar"; // Removed AvatarContent
import { Truck, MapPin, Package, Clock, Star, Weight, Gauge, Upload } from 'lucide-react'; // Added Upload
import { ImageWithFallback } from './figma/ImageWithFallback';
import { driverApi } from '../src/lib/api';
import { useDriverProfile } from '../src/hooks/useDriverProfile';
import { toast } from 'sonner';

interface Vehicle {
  id: string;
  type: string;
  model: string;
  licensePlate: string;
  maxWeight: number;
  maxVolume: number;
  categories: string[];
  imageUrl?: string;
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
  const [vehicles, setVehicles] = useState([] as Vehicle[]);
  const [pendingOrders, setPendingOrders] = useState([] as Order[]);
  const [stats, setStats] = useState(null as Stats | null);
  const [loading, setLoading] = useState(true);

  const { driverData, updateAvailability, getDriverStats } = useDriverProfile();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Use driverData from useDriverProfile hook instead of driverService
      console.log('Driver profile loaded:', driverData);

      // Load vehicles
      const vehiclesResponse = await driverApi.getVehicles();
      console.log('Vehicles response:', vehiclesResponse);

      if (vehiclesResponse.success && vehiclesResponse.data) {
        const vehiclesData = Array.isArray(vehiclesResponse.data) 
          ? vehiclesResponse.data 
          : vehiclesResponse.data.vehicles || [];

        const mappedVehicles: Vehicle[] = vehiclesData.map((v: any) => ({
          id: v.id,
          type: v.type || v.vehicleType || '',
          model: `${v.make || ''} ${v.model || ''}`.trim(),
          licensePlate: v.licensePlate || v.license_plate || '',
          maxWeight: v.maxWeight || v.maxWeightKg || 0,
          maxVolume: v.maxVolume || v.maxVolumeM3 || 0,
          imageUrl: v.imageUrl || v.image_url,
          categories: v.categories || []
        }));

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
          totalDeliveries: 0,
          rating: 0,
          totalEarnings: 0,
          completionRate: 0
        });
      }

    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data. Using sample data.');

      // Fallback to sample data
      const sampleVehicle: Vehicle = {
        id: 'sample-1',
        type: 'Medium Truck',
        model: 'Sample Vehicle',
        licensePlate: 'ABC-123',
        maxWeight: 1000,
        maxVolume: 10,
        imageUrl: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13',
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
      const success = await updateAvailability(value);
      if (success) {
        setIsOnline(value);
      }
    } catch (error: any) {
      console.error('Error updating availability:', error);
      toast.error('Failed to update availability');
    }
  };

  const handleVehicleImageUpload = async (vehicleId: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await driverApi.uploadVehicleImage(vehicleId, formData);
      if (response.success) {
        toast.success('Vehicle image uploaded successfully');
        // Refresh vehicles list
        loadDashboardData();
      } else {
        toast.error('Failed to upload vehicle image');
      }
    } catch (error: any) {
      console.error('Error uploading vehicle image:', error);
      toast.error('Error uploading vehicle image');
    }
  };

  const currentVehicle = vehicles.find((v: Vehicle) => v.id === selectedVehicle);

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
            <div className="flex items-center space-x-2">
              <Label htmlFor="online-status">
                {isOnline ? 'Online' : 'Offline'}
              </Label>
              <Switch
                id="online-status"
                checked={isOnline}
                onCheckedChange={handleToggleOnline}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className="text-sm">{isOnline ? 'Available for orders' : 'Unavailable'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span className="text-sm">Downtown Area</span>
            </div>
            <div className="flex items-center space-x-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">{stats?.rating || 0} Rating</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Active Today</span>
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
            <Label htmlFor="vehicle-select">Select Vehicle:</Label>
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Choose vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle: Vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.type} - {vehicle.licensePlate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {currentVehicle && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                {currentVehicle.imageUrl ? (
                  <img 
                    src={currentVehicle.imageUrl}
                    alt={currentVehicle.model}
                    className="w-full h-40 object-cover rounded-lg"
                    onError={(e: any) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=250&fit=crop';
                    }}
                  />
                ) : (
                  <ImageWithFallback
                    src="https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=250&fit=crop"
                    alt={currentVehicle.model}
                    className="w-full h-40 object-cover rounded-lg"
                  />
                )}
                
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="vehicle-image-upload"
                  onChange={(e: any) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleVehicleImageUpload(currentVehicle.id, file);
                    }
                  }}
                />
                <label htmlFor="vehicle-image-upload">
                  <Button variant="outline" className="w-full mt-2 cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    {currentVehicle.imageUrl ? 'Change Photo' : 'Upload Photo'}
                  </Button>
                </label>
              </div>
              <div className="space-y-3">
                <div>
                  <h4 className="text-lg">{currentVehicle.model}</h4>
                  <p className="text-gray-600">{currentVehicle.licensePlate}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <Weight className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{currentVehicle.maxWeight} kg</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Package className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{currentVehicle.maxVolume} m³</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {currentVehicle.categories.map((category: string) => (
                    <Badge key={category} variant="secondary">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Available Orders Near You</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pendingOrders.map((order: Order) => (
              <div key={order.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium">{order.id}</h4>
                    <p className="text-sm text-gray-600">Customer: {order.customer}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg text-green-600">{order.payment}</p>
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
    </div>
  );
}