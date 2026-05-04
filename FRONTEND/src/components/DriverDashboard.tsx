import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Truck, MapPin, Package, Clock, Star, Weight, Gauge, Upload, Eye, AlertTriangle, RefreshCw, Navigation, Compass, User, Wifi, WifiOff, CheckCircle } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { driverApi } from '../src/lib/api';
import { useDriverProfile } from '../src/hooks/useDriverProfile';
import { orderApi } from '../src/lib/api';
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

interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

interface DriverOrder {
  id: string;
  order_number: string;
  status: string;
  customer_info?: {
    name: string;
    phone: string;
  };
  pickup_location?: {
    address: string;
  };
  delivery_location?: {
    address: string;
  };
  pricing?: {
    estimated_usd: number;
  };
  package_details?: {
    category: string;
    weight_kg: number;
    volume_m3: number;
  };
  progress?: {
    progressPercentage: number;
    currentStatus: string;
  };
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
  const [optimizedRoute, setOptimizedRoute] = useState<any>(null);
  const [driverOrders, setDriverOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [rejectTimers, setRejectTimers] = useState<Record<string, NodeJS.Timeout>>({});
  const [timeRemaining, setTimeRemaining] = useState<Record<string, number>>({});

  // Location state
  const [currentLocation, setCurrentLocation] = useState<string>('Downtown Area');
  const [locationCoords, setLocationCoords] = useState<LocationCoords | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const { driverData } = useDriverProfile();

  useEffect(() => {
    loadDashboardData();
    // Initialize with current driver status
    if (driverData?.isOnline !== undefined) {
      setIsOnline(driverData.isOnline);
    }
    if (driverData?.currentLocation) {
      setCurrentLocation(driverData.currentLocation);
    }
    loadDriverOrders();
    loadOptimizedRoute();
  }, [driverData]);

  // Auto-reject timer effect for pending orders
  useEffect(() => {
    const intervals: NodeJS.Timeout[] = [];
    
    driverOrders.forEach(order => {
      if (order.status === 'pending') {
        const interval = setInterval(() => {
          setTimeRemaining(prev => {
            const current = prev[order.id] || 120; // 2 minutes = 120 seconds
            if (current <= 0) {
              clearInterval(interval);
              return prev;
            }
            return { ...prev, [order.id]: current - 1 };
          });
        }, 1000);
        intervals.push(interval);
        
        // Initialize timer if not set
        setTimeRemaining(prev => {
          if (!prev[order.id]) {
            return { ...prev, [order.id]: 120 };
          }
          return prev;
        });
        
        // Start auto-reject timer
        startAutoRejectTimer(order.id);
      }
    });
    
    return () => {
      intervals.forEach(interval => clearInterval(interval));
    };
  }, [driverOrders]);

  const loadDriverOrders = async () => {
  setLoadingOrders(true);
  try {
    const response = await orderApi.getDriverOrders();
    console.log('📦 Full driver orders response:', response);
    
    if (response.success && response.data) {
      // Check different possible data structures
      let ordersList = [];
      
      if (Array.isArray(response.data)) {
        // If data is directly an array
        ordersList = response.data;
      } else if (response.data.orders && Array.isArray(response.data.orders)) {
        // If data has an orders property
        ordersList = response.data.orders;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        // If data has a nested data property
        ordersList = response.data.data;
      } else if (response.data.items && Array.isArray(response.data.items)) {
        ordersList = response.data.items;
      } else {
        // Try to see what's in the response
        console.log('⚠️ Unknown orders data structure:', Object.keys(response.data));
        ordersList = [];
      }
      
      console.log(`📦 Found ${ordersList.length} orders for driver`);
      
      // Log each order to see what's coming through
      ordersList.forEach((order: any, index: number) => {
        console.log(`  Order ${index + 1}:`, {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          driver_id: order.driver_id,
          customer_name: order.customer_info?.name
        });
      });
      
      setDriverOrders(ordersList);
    } else {
      console.log('No orders in response:', response);
      setDriverOrders([]);
    }
  } catch (error) {
    console.error('Error loading driver orders:', error);
    toast.error('Failed to load orders');
    setDriverOrders([]);
  } finally {
    setLoadingOrders(false);
  }
};

  // Add function to start auto-reject timer
  const startAutoRejectTimer = (orderId: string) => {
    // Clear existing timer if any
    if (rejectTimers[orderId]) {
      clearTimeout(rejectTimers[orderId]);
    }
    
    // Set timer to auto-reject after 2 minutes (120 seconds)
    const timer = setTimeout(async () => {
      try {
        const response = await orderApi.rejectOrder(orderId, 'Auto-rejected: No response within 2 minutes');
        if (response.success) {
          toast.info(`Order ${orderId.slice(-8)} was auto-rejected due to no response`);
          loadDriverOrders(); // Refresh orders list
          loadOptimizedRoute();
        }
      } catch (error) {
        console.error('Auto-reject failed:', error);
      } finally {
        // Clean up timer
        setRejectTimers(prev => {
          const newTimers = { ...prev };
          delete newTimers[orderId];
          return newTimers;
        });
        setTimeRemaining(prev => {
          const newTime = { ...prev };
          delete newTime[orderId];
          return newTime;
        });
      }
    }, 120000); // 2 minutes = 120000 ms
    
    setRejectTimers(prev => ({ ...prev, [orderId]: timer }));
  };

  // Modify handleAcceptOrder to clear timer when accepted
  const handleAcceptOrder = async (orderId: string) => {
    // Clear auto-reject timer
    if (rejectTimers[orderId]) {
      clearTimeout(rejectTimers[orderId]);
      setRejectTimers(prev => {
        const newTimers = { ...prev };
        delete newTimers[orderId];
        return newTimers;
      });
      setTimeRemaining(prev => {
        const newTime = { ...prev };
        delete newTime[orderId];
        return newTime;
      });
    }
    
    try {
      const response = await orderApi.acceptOrder(orderId);
      if (response.success) {
        toast.success('Order accepted successfully!');
        loadDriverOrders();
        loadOptimizedRoute();
      } else {
        toast.error(response.error || 'Failed to accept order');
      }
    } catch (error: any) {
      toast.error(error.message || 'Network error');
    }
  };

  // Add function to manually reject
  const handleRejectOrder = async (orderId: string, reason?: string) => {
    // Clear auto-reject timer
    if (rejectTimers[orderId]) {
      clearTimeout(rejectTimers[orderId]);
      setRejectTimers(prev => {
        const newTimers = { ...prev };
        delete newTimers[orderId];
        return newTimers;
      });
      setTimeRemaining(prev => {
        const newTime = { ...prev };
        delete newTime[orderId];
        return newTime;
      });
    }
    
    try {
      const response = await orderApi.rejectOrder(orderId, reason || 'Driver rejected');
      if (response.success) {
        toast.info('Order rejected');
        loadDriverOrders();
        loadOptimizedRoute();
      } else {
        toast.error(response.error || 'Failed to reject order');
      }
    } catch (error: any) {
      toast.error(error.message || 'Network error');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      let location;
      if (navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: true
          });
        });
        location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
      }

      const response = await orderApi.updateOrderStatus(orderId, status, location);
      if (response.success) {
        toast.success(`Order status updated to ${status.replace('_', ' ')}`);
        loadDriverOrders(); // Refresh orders list
        loadOptimizedRoute(); // Refresh optimized route
      } else {
        toast.error(response.error || 'Failed to update status');
      }
    } catch (error: any) {
      toast.error(error.message || 'Network error');
    }
  };

  const loadOptimizedRoute = async () => {
    try {
      const response = await orderApi.getOptimizedRoute();
      if (response.success && response.data) {
        setOptimizedRoute(response.data);
      }
    } catch (error) {
      console.error('Error loading optimized route:', error);
    }
  };

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

  const getCurrentLocation = async (): Promise<{display: string, full: string}> => {
    try {
      setGettingLocation(true);
      setLocationError(null);
    
      // Try to get precise location from browser
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported'));
          return;
        }
      
        navigator.geolocation.getCurrentPosition(
          resolve,
          (error) => {
            reject(error);
          },
          {
            timeout: 10000,
            enableHighAccuracy: true,
            maximumAge: 0
          }
        );
      });
    
      const { latitude, longitude, accuracy } = position.coords;
      setLocationCoords({
        latitude,
        longitude,
        accuracy,
        timestamp: position.timestamp
      });
    
      // Try to get human-readable address using reverse geocoding
      try {
        const addressData = await reverseGeocode(latitude, longitude);
        return addressData;
      } catch (geocodeError) {
        console.warn('Reverse geocoding failed:', geocodeError);
        // Return coordinates if reverse geocoding fails
        const fallback = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        return {
          display: fallback,
          full: fallback
        };
      }
    
    } catch (error: any) {
      console.warn('Could not get precise location:', error);
      
      let errorMessage = 'Unable to get location';
      if (error.code === error.PERMISSION_DENIED) {
        errorMessage = 'Location permission denied. Please enable location services in your browser settings.';
      } else if (error.code === error.TIMEOUT) {
        errorMessage = 'Location request timed out.';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        errorMessage = 'Location information is unavailable.';
      }
      
      setLocationError(errorMessage);
      return {
        display: "Downtown Area",
        full: "Downtown Area"
      };
    } finally {
      setGettingLocation(false);
    }
  };
  
  const reverseGeocode = async (latitude: number, longitude: number): Promise<{display: string, full: string}> => {
    try {
      // Using OpenStreetMap Nominatim API for Russian addresses
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=ru`
      );
      
      if (!response.ok) {
        throw new Error('Reverse geocoding failed');
      }
      
      const data = await response.json();
      
      // Store the FULL address for database
      const fullAddress = data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    
      // Create display address: street + house number + city/specific details
      let displayAddress = '';
    
      if (data.address) {
        const addr = data.address;
        const parts = [];
        
        // Add street name
        if (addr.road) {
          // Format Russian street names nicely
          let streetName = addr.road;
          if (streetName.includes('улица')) {
            streetName = streetName.replace('улица', 'ул.');
          } else if (streetName.includes('проспект')) {
            streetName = streetName.replace('проспект', 'пр.');
          } else if (streetName.includes('проезд')) {
            streetName = streetName.replace('проезд', 'пр.');
          } else if (streetName.includes('бульвар')) {
            streetName = streetName.replace('бульвар', 'б-р');
          }
          parts.push(streetName);
        }
        
        // Add house number
        if (addr.house_number) {
          parts[parts.length - 1] = `${parts[parts.length - 1]}, ${addr.house_number}`;
        } else if (addr.house) {
          parts[parts.length - 1] = `${parts[parts.length - 1]}, ${addr.house}`;
        }
        
        // Add building/block (корпус)
        if (addr.building) {
          parts.push(`к. ${addr.building}`);
        }
        
        // Add unit/section (секция)
        if (addr.unit) {
          parts.push(`секция ${addr.unit}`);
        }
        
        // Add entrance (подъезд)
        if (addr.entrance) {
          parts.push(`подъезд ${addr.entrance}`);
        }
        
        // If we have specific parts, use them
        if (parts.length > 0) {
          displayAddress = parts.join(', ');
          
          // If we don't have a city yet, try to add it from address components
          if (!displayAddress.includes('Санкт-Петербург') && !displayAddress.includes('Saint Petersburg')) {
            if (addr.city) {
              displayAddress += `, ${addr.city}`;
            } else if (addr.town) {
              displayAddress += `, ${addr.town}`;
            } else if (addr.suburb) {
              displayAddress += `, ${addr.suburb}`;
            }
          }
        } else {
          // Fallback: Take first 3 parts of full address (removing country/district)
          const fullParts = fullAddress.split(',');
          const displayParts = fullParts.slice(0, Math.min(3, fullParts.length));
          displayAddress = displayParts.join(', ');
        }
      } else {
        // Fallback: Use first 3 parts of full address
        const parts = fullAddress.split(',');
        displayAddress = parts.slice(0, Math.min(3, parts.length)).join(', ');
      }
      
      // Clean up the display address
      displayAddress = displayAddress.trim();
      
      // Ensure it's not empty
      if (!displayAddress) {
        displayAddress = fullAddress;
      }
    
      return {
        display: displayAddress,
        full: fullAddress
      };
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      const fallback = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      return {
        display: fallback,
        full: fallback
      };
    }
  };
  
  const handleToggleOnline = async (value: boolean) => {
    try {
      setGettingLocation(true);
      
      // Get current location for the API call
      const locationData = await getCurrentLocation();
      
      // Update location state with DISPLAY version
      setCurrentLocation(locationData.display);
      
      // Make API call with both isOnline and FULL location
      const response = await driverApi.updateStatus({ 
        isOnline: value, 
        location: locationData.full  // Save FULL address to database
      });
    
      if (response.success) {
        setIsOnline(value);
        toast.success(`You are now ${value ? 'online and available for orders' : 'offline'}`);
        
        // Update driver data if needed
        if (driverData) {
          driverData.isOnline = value;
          driverData.currentLocation = locationData.display;
        }
      } else {
        toast.error(response.error || 'Failed to update status');
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      
      // Even if location failed, try to update status with fallback location
      try {
        const fallbackResponse = await driverApi.updateStatus({ 
          isOnline: value, 
          location: "Downtown Area" 
        });
        
        if (fallbackResponse.success) {
          setIsOnline(value);
          toast.warning(`You are now ${value ? 'online' : 'offline'} (using approximate location)`);
          setCurrentLocation("Downtown Area");
        } else {
          toast.error('Failed to update status');
        }
      } catch (fallbackError) {
        toast.error('Network error. Please check your connection.');
      }
    } finally {
      setGettingLocation(false);
    }
  };
  
  const refreshLocation = async () => {
    try {
      setGettingLocation(true);
      const locationData = await getCurrentLocation();
      
      // Update UI with DISPLAY version
      setCurrentLocation(locationData.display);
      
      if (isOnline) {
        // Update location in backend with FULL address
        const response = await driverApi.updateStatus({ 
          isOnline: true, 
          location: locationData.full  // Save full address to database
        });
        
        if (response.success) {
          toast.success('Location updated');
        }
      } else {
        toast.success('Location refreshed');
      }
    } catch (error) {
      console.error('Error refreshing location:', error);
      toast.error('Failed to refresh location');
    } finally {
      setGettingLocation(false);
    }
  };

  const openInMaps = () => {
    if (!locationCoords) {
      toast.error('No location coordinates available');
      return;
    }
    
    const url = `https://www.google.com/maps?q=${locationCoords.latitude},${locationCoords.longitude}`;
    window.open(url, '_blank');
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

  // Add a useEffect to periodically refresh orders when driver is online
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout | null = null;
    
    if (isOnline) {
      // Refresh orders every 30 seconds when online
      refreshInterval = setInterval(() => {
        loadDriverOrders();
      }, 30000);
    }
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [isOnline]);

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
            
            <div className="flex items-center space-x-4">
              {/* Location refresh button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshLocation}
                disabled={gettingLocation}
                className="flex items-center space-x-1"
                title="Refresh location"
              >
                {gettingLocation ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              
              {/* Online/Offline button */}
              <Button
                variant={isOnline ? "default" : "outline"}
                size="sm"
                onClick={() => handleToggleOnline(!isOnline)}
                disabled={gettingLocation}
                className={`flex items-center space-x-2 transition-all ${
                  isOnline 
                    ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg' 
                    : ''
                }`}
                aria-label={isOnline ? "Go offline" : "Go online"}
              >
                {isOnline ? (
                  <>
                    <Wifi className="h-4 w-4" />
                    <span>Online</span>
                    <div className="ml-1 w-2 h-2 rounded-full bg-white animate-pulse"></div>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4" />
                    <span>Offline</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {/* Status indicators */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <span className="text-sm font-medium">
                  {isOnline ? 'Available for orders' : 'Unavailable for orders'}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-medium block truncate" title={currentLocation}>
                    {currentLocation}
                  </span>
                  {locationError && (
                    <span className="text-xs text-red-500 block">{locationError}</span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Star className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                <span className="text-sm">{stats?.rating?.toFixed(1) || 0} Rating</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span className="text-sm">{stats?.totalDeliveries || 0} Deliveries</span>
              </div>
            </div>
            
            {/* Location details and actions */}
            {locationCoords && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-sm text-gray-600">
                    <p>Coordinates: {locationCoords.latitude.toFixed(6)}, {locationCoords.longitude.toFixed(6)}</p>
                    {locationCoords.accuracy && (
                      <p className="text-xs">Accuracy: ±{Math.round(locationCoords.accuracy)} meters</p>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={openInMaps}
                      className="flex items-center space-x-1"
                    >
                      <Compass className="h-3 w-3" />
                      <span>Open in Maps</span>
                    </Button>
                    
                    {isOnline && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleOnline(true)} // Refresh status with current location
                        disabled={gettingLocation}
                        className="flex items-center space-x-1"
                      >
                        {gettingLocation ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        <span>Update Status</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
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
            <div className="text-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition">
              <p className="text-3xl font-bold text-blue-600">{stats?.totalDeliveries || 0}</p>
              <p className="text-gray-600">Total Deliveries</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition">
              <p className="text-3xl font-bold text-yellow-600">{stats?.rating?.toFixed(1) || 0}</p>
              <p className="text-gray-600">Average Rating</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition">
              <p className="text-3xl font-bold text-green-600">${(stats?.totalEarnings || 0).toLocaleString()}</p>
              <p className="text-gray-600">Total Earnings</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition">
              <p className="text-3xl font-bold text-purple-600">{stats?.completionRate || 0}%</p>
              <p className="text-gray-600">Completion Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* My Orders Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              My Orders
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadDriverOrders}
              disabled={loadingOrders}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingOrders ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <p className="text-gray-600">Orders assigned to you for delivery</p>
        </CardHeader>
        <CardContent>
          {loadingOrders ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : driverOrders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg text-gray-900 mb-2">No orders assigned</h3>
              <p className="text-gray-600">
                {isOnline 
                  ? 'You are online. Orders will appear here when assigned.'
                  : 'Go online to receive delivery requests.'}
              </p>
              {!isOnline && (
                <Button 
                  onClick={() => handleToggleOnline(true)} 
                  className="mt-4 bg-green-600 hover:bg-green-700"
                >
                  <Wifi className="h-4 w-4 mr-2" />
                  Go Online
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {driverOrders.map((order) => (
                <div key={order.id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">#{order.order_number?.slice(-8) || order.id?.slice(-8)}</h4>
                        <Badge className={order.status === 'delivered' ? 'bg-green-100 text-green-800' : 
                                        order.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                                        order.status === 'route_to_pickup' ? 'bg-purple-100 text-purple-800' :
                                        order.status === 'driver_assigned' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-gray-100 text-gray-800'}>
                          {order.status?.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Customer: {order.customer_info?.name || 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-green-600">
                        ${order.pricing?.estimated_usd || '0'}
                      </p>
                      {order.progress && (
                        <p className="text-xs text-gray-500">
                          {order.progress.progressPercentage}% complete
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Pickup:</p>
                        <p className="text-sm text-gray-600">{order.pickup_location?.address || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Delivery:</p>
                        <p className="text-sm text-gray-600">{order.delivery_location?.address || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span>📦 {order.package_details?.category || 'General'}</span>
                      <span>⚖️ {order.package_details?.weight_kg || 0} kg</span>
                      <span>📐 {order.package_details?.volume_m3 || 0} m³</span>
                    </div>
                    
                    <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <>
                          <Button 
                            onClick={() => handleAcceptOrder(order.id)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Accept Order
                          </Button>
                          <Button 
                            onClick={() => handleRejectOrder(order.id, 'Driver unavailable')}
                            size="sm"
                            variant="destructive"
                          >
                            Reject
                          </Button>
                          {timeRemaining[order.id] > 0 && (
                            <div className="text-xs text-orange-600 mt-1">
                              Auto-reject in: {Math.floor(timeRemaining[order.id] / 60)}:{String(timeRemaining[order.id] % 60).padStart(2, '0')}
                            </div>
                          )}
                        </>
                      )}
                      
                      {order.status === 'driver_assigned' && (
                        <Button 
                          onClick={() => handleUpdateOrderStatus(order.id, 'route_to_pickup')}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Navigation className="h-4 w-4 mr-1" />
                          Start to Pickup
                        </Button>
                      )}
                      
                      {order.status === 'route_to_pickup' && (
                        <Button 
                          onClick={() => handleUpdateOrderStatus(order.id, 'in_transit')}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Truck className="h-4 w-4 mr-1" />
                          Start Delivery
                        </Button>
                      )}
                      
                      {order.status === 'in_transit' && (
                        <Button 
                          onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Mark Delivered
                        </Button>
                      )}
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.location.href = `/order-tracking?orderId=${order.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Timer display for pending orders */}
                  {order.status === 'pending' && timeRemaining[order.id] > 0 && (
                    <div className="mt-3 pt-2 border-t">
                      <div className="text-xs text-orange-600">
                        Auto-reject in: {Math.floor(timeRemaining[order.id] / 60)}:{String(timeRemaining[order.id] % 60).padStart(2, '0')} minutes
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Orders - Available Orders Near You */}
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