// components/DriverRouteOptimization.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { MapPin, Navigation, Package, Clock, TrendingUp, Map as MapIcon, CheckCircle2, Loader2, RefreshCw, Compass, Car, Star, Fuel, DollarSign, ZoomIn, ZoomOut, ChevronDown, ChevronUp, User } from 'lucide-react';
import { orderApi } from '../src/lib/api';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface RouteStop {
  id: string;
  orderId: string;
  orderNumber: string;
  address: string;
  customerName: string;
  customerPhone: string;
  packageDetails: string;
  weight: number;
  volume: number;
  estimatedTime: string;
  distance: string;
  distanceKm: number;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed';
  type: 'pickup' | 'delivery';
  coordinates: { lat: number; lng: number };
  sequence: number;
}

interface RouteOptimizationData {
  stops: RouteStop[];
  totalDistance: number;
  totalDuration: number;
  optimizedSequence: number[];
  estimatedEarnings: number;
  fuelCost: number;
  netEarnings: number;
}

interface LocationCoords {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface CarAnimationState {
  active: boolean;
  fromStopId: string;
  toStopId: string;
  progress: number;
  startTime: number;
  duration: number;
}

export function DriverRouteOptimization() {
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [optimizationData, setOptimizationData] = useState<RouteOptimizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'simulation' | 'list'>('simulation');
  const [carAnimation, setCarAnimation] = useState<CarAnimationState | null>(null);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  
  const [dimensions, setDimensions] = useState({ width: 900, height: 550 });
  const [mapUrl, setMapUrl] = useState('');

  useEffect(() => {
    requestLocation();
    calculateOptimalRoute();
    
    const handleResize = () => {
      if (canvasRef.current?.parentElement) {
        setDimensions({
          width: Math.max(800, canvasRef.current.parentElement.clientWidth - 40),
          height: 550
        });
      }
      if (mapInstanceRef.current) {
        setTimeout(() => mapInstanceRef.current?.invalidateSize(), 100);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (mapInstanceRef.current) mapInstanceRef.current.remove();
    };
  }, []);

  useEffect(() => {
    if (routeStops.length > 0 && canvasRef.current && viewMode === 'simulation') {
      drawSimulationMap();
    }
  }, [routeStops, currentLocation, selectedStop, carAnimation, dimensions, viewMode, optimizationData, zoom, panX, panY]);

  useEffect(() => {
    if (viewMode === 'map' && mapContainerRef.current && (routeStops.length > 0 || currentLocation)) {
      initializeMap();
    }
  }, [viewMode, routeStops, currentLocation]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Initialize Leaflet map
  const initializeMap = () => {
    if (!mapContainerRef.current) return;
    
    // Clear existing map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    
    // Calculate center point
    let centerLat = 59.9343;
    let centerLng = 30.3351;
    
    if (currentLocation) {
      centerLat = currentLocation.lat;
      centerLng = currentLocation.lng;
    } else if (routeStops.length > 0) {
      centerLat = routeStops[0].coordinates.lat;
      centerLng = routeStops[0].coordinates.lng;
    }
    
    // Create map
    const map = L.map(mapContainerRef.current).setView([centerLat, centerLng], 12);
    mapInstanceRef.current = map;
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    
    const bounds: L.LatLngBounds = L.latLngBounds([]);
    const routePoints: [number, number][] = [];
    
    // Add current location marker (start)
    if (currentLocation) {
      const startIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #10B981; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>`,
        iconSize: [20, 20],
        popupAnchor: [0, -10]
      });
      
      const marker = L.marker([currentLocation.lat, currentLocation.lng], { icon: startIcon })
        .bindPopup(`
          <div class="text-center">
            <strong>📍 Your Location</strong>
            <br />
            <span class="text-sm text-gray-600">Starting point</span>
          </div>
        `)
        .addTo(map);
      
      markersRef.current.push(marker);
      bounds.extend([currentLocation.lat, currentLocation.lng]);
      routePoints.push([currentLocation.lat, currentLocation.lng]);
    }
    
    // Add stop markers
    routeStops.forEach((stop, index) => {
      const isSelected = selectedStop === stop.id;
      const isCompleted = stop.status === 'completed';
      const isPickup = stop.type === 'pickup';
      
      let markerColor = isPickup ? '#F59E0B' : '#8B5CF6';
      if (isCompleted) markerColor = '#10B981';
      if (isSelected) markerColor = '#3B82F6';
      
      const stopIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${markerColor}; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">${stop.sequence || index + 1}</div>`,
        iconSize: [32, 32],
        popupAnchor: [0, -16]
      });
      
      const marker = L.marker([stop.coordinates.lat, stop.coordinates.lng], { icon: stopIcon })
        .bindPopup(`
          <div class="text-center min-w-[200px]">
            <strong class="text-lg">${stop.type === 'pickup' ? '📦' : '🏠'} Order #${stop.orderNumber}</strong>
            <br />
            <span class="text-sm">${stop.type === 'pickup' ? 'Pickup' : 'Delivery'}</span>
            <br />
            <span class="text-xs text-gray-500">${stop.address.substring(0, 50)}...</span>
            <br />
            <span class="text-xs font-semibold text-green-600">Sequence: ${stop.sequence || index + 1}</span>
            ${stop.distance ? `<br /><span class="text-xs text-gray-500">Distance: ${stop.distance}</span>` : ''}
            <div class="mt-2">
              <button onclick="window.dispatchEvent(new CustomEvent('selectStop', { detail: { stopId: '${stop.id}' } }))" 
                class="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">
                Select Stop
              </button>
            </div>
          </div>
        `)
        .addTo(map);
      
      markersRef.current.push(marker);
      bounds.extend([stop.coordinates.lat, stop.coordinates.lng]);
      routePoints.push([stop.coordinates.lat, stop.coordinates.lng]);
    });
    
    // Add route polyline
    if (routePoints.length > 1) {
      if (polylineRef.current) polylineRef.current.remove();
      
      const polyline = L.polyline(routePoints, {
        color: '#3B82F6',
        weight: 3,
        opacity: 0.8,
        dashArray: '5, 10'
      }).addTo(map);
      
      polylineRef.current = polyline;
    }
    
    // Fit bounds to show all markers
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
    
    // Add custom event listener for popup button clicks
    const handleSelectStop = (e: CustomEvent) => {
      setSelectedStop(e.detail.stopId === selectedStop ? null : e.detail.stopId);
    };
    
    window.addEventListener('selectStop', handleSelectStop as EventListener);
    
    return () => {
      window.removeEventListener('selectStop', handleSelectStop as EventListener);
    };
  };

  const requestLocation = useCallback(async () => {
    setGettingLocation(true);
    setLocationError(null);
    
    try {
      if (!navigator.geolocation) {
        console.warn('Geolocation not supported, using fallback location');
        const fallbackLocation = { lat: 59.9343, lng: 30.3351 };
        setCurrentLocation(fallbackLocation);
        toast.info('Using approximate location (St. Petersburg center)');
        calculateOptimalRoute();
        setGettingLocation(false);
        return;
      }
      
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      
      setCurrentLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      });
      
      toast.success('Location detected');
      calculateOptimalRoute();
    } catch (error: any) {
      console.error('Geolocation error:', error);
      const fallbackLocation = { lat: 59.9343, lng: 30.3351 };
      setCurrentLocation(fallbackLocation);
      
      let errorMessage = 'Using approximate location. ';
      if (error.code === error.PERMISSION_DENIED) {
        errorMessage = 'Location permission denied. Using approximate location.';
      } else if (error.code === error.TIMEOUT) {
        errorMessage = 'Location request timed out. Using approximate location.';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        errorMessage = 'Location unavailable. Using approximate location.';
      }
      
      setLocationError(errorMessage);
      toast.warning(errorMessage);
      calculateOptimalRoute();
    } finally {
      setGettingLocation(false);
    }
  }, []);

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const formatEstimatedTime = (distanceKm: number): string => {
    const minutes = Math.max(5, Math.ceil(distanceKm * 2));
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  // ============================================
  // GROUP STOPS INTO REGIONS (within 3km)
  // ============================================
  const groupIntoRegions = (stops: RouteStop[]): RouteStop[][] => {
    const regions: RouteStop[][] = [];
    const used = new Set<string>();
    const regionThreshold = 3;
    
    for (const stop of stops) {
      if (used.has(stop.id)) continue;
      
      const newRegion: RouteStop[] = [stop];
      used.add(stop.id);
      
      for (const other of stops) {
        if (used.has(other.id)) continue;
        
        const distance = calculateDistance(
          stop.coordinates.lat, stop.coordinates.lng,
          other.coordinates.lat, other.coordinates.lng
        );
        
        if (distance < regionThreshold) {
          newRegion.push(other);
          used.add(other.id);
        }
      }
      
      regions.push(newRegion);
    }
    
    return regions;
  };

  // ============================================
  // OPTIMIZE PICKUPS USING NEAREST NEIGHBOR
  // ============================================
  const optimizePickups = (pickups: RouteStop[], startPoint: LocationCoords): RouteStop[] => {
    if (pickups.length === 0) return [];
    if (pickups.length === 1) return pickups;
    
    const sequence: RouteStop[] = [];
    let currentPoint = startPoint;
    let remaining = [...pickups];
    
    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDistance = Infinity;
      
      for (let i = 0; i < remaining.length; i++) {
        const distance = calculateDistance(
          currentPoint.lat, currentPoint.lng,
          remaining[i].coordinates.lat, remaining[i].coordinates.lng
        );
        
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIdx = i;
        }
      }
      
      const selected = remaining[bestIdx];
      sequence.push(selected);
      currentPoint = selected.coordinates;
      remaining.splice(bestIdx, 1);
    }
    
    return sequence;
  };

  // ============================================
  // OPTIMIZE DELIVERIES USING NEAREST NEIGHBOR
  // ============================================
  const optimizeDeliveries = (deliveries: RouteStop[], startPoint: LocationCoords): RouteStop[] => {
    if (deliveries.length === 0) return [];
    if (deliveries.length === 1) return deliveries;
    
    const sequence: RouteStop[] = [];
    let currentPoint = startPoint;
    let remaining = [...deliveries];
    
    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDistance = Infinity;
      
      for (let i = 0; i < remaining.length; i++) {
        const distance = calculateDistance(
          currentPoint.lat, currentPoint.lng,
          remaining[i].coordinates.lat, remaining[i].coordinates.lng
        );
        
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIdx = i;
        }
      }
      
      const selected = remaining[bestIdx];
      sequence.push(selected);
      currentPoint = selected.coordinates;
      remaining.splice(bestIdx, 1);
    }
    
    return sequence;
  };

  // ============================================
  // PICKUP-FIRST THEN DELIVERY OPTIMIZATION
  // ============================================
  const pickupFirstOptimization = (stops: RouteStop[], startPoint: LocationCoords): RouteStop[] => {
    if (stops.length === 0) return [];
    if (stops.length === 1) return stops;
    
    const pickups = stops.filter(s => s.type === 'pickup');
    const deliveries = stops.filter(s => s.type === 'delivery');
    
    const optimizedPickups = optimizePickups(pickups, startPoint);
    const lastPickupPoint = optimizedPickups.length > 0 
      ? optimizedPickups[optimizedPickups.length - 1].coordinates 
      : startPoint;
    const optimizedDeliveries = optimizeDeliveries(deliveries, lastPickupPoint);
    
    return [...optimizedPickups, ...optimizedDeliveries];
  };

  // ============================================
  // MAIN OPTIMIZATION FUNCTION
  // ============================================
  const calculateOptimalRoute = async () => {
    try {
      setOptimizing(true);
      setLoading(true);
      
      const response = await orderApi.getDriverOrders();
      
      if (response.success && response.data) {
        const orders = response.data.orders || [];
        const activeOrders = orders.filter((order: any) => 
          order.status === 'driver_assigned' || 
          order.status === 'route_to_pickup' || 
          order.status === 'in_transit'
        );
        
        if (activeOrders.length === 0) {
          setRouteStops([]);
          setOptimizationData(null);
          setLoading(false);
          setOptimizing(false);
          return;
        }
        
        let allStops: RouteStop[] = [];
        
        activeOrders.forEach((order: any, index: number) => {
          allStops.push({
            id: `${order.id}-pickup`,
            orderId: order.id,
            orderNumber: order.order_number || order.id.slice(-8),
            address: order.pickup_location?.address || 'Pickup address',
            customerName: order.customer_info?.name || 'Customer',
            customerPhone: order.customer_info?.phone || '',
            packageDetails: `${order.package_details?.category || 'Package'} (${order.package_details?.weight_kg || 0}kg)`,
            weight: order.package_details?.weight_kg || 0,
            volume: order.package_details?.volume_m3 || 0,
            estimatedTime: '',
            distance: '',
            distanceKm: 0,
            priority: order.package_details?.urgency === 'urgent' ? 'high' : 'medium',
            status: order.status === 'in_transit' ? 'in-progress' : 'pending',
            type: 'pickup',
            coordinates: order.pickup_location?.coordinates || { lat: 59.9343 + (index * 0.01), lng: 30.3351 + (index * 0.01) },
            sequence: 0
          });
          
          allStops.push({
            id: `${order.id}-delivery`,
            orderId: order.id,
            orderNumber: order.order_number || order.id.slice(-8),
            address: order.delivery_location?.address || 'Delivery address',
            customerName: order.customer_info?.name || 'Customer',
            customerPhone: order.customer_info?.phone || '',
            packageDetails: `${order.package_details?.category || 'Package'} (${order.package_details?.weight_kg || 0}kg)`,
            weight: order.package_details?.weight_kg || 0,
            volume: order.package_details?.volume_m3 || 0,
            estimatedTime: '',
            distance: '',
            distanceKm: 0,
            priority: order.package_details?.urgency === 'urgent' ? 'high' : 'medium',
            status: 'pending',
            type: 'delivery',
            coordinates: order.delivery_location?.coordinates || { lat: 59.9343 + (index * 0.02), lng: 30.3351 + (index * 0.02) },
            sequence: 0
          });
        });
        
        console.log('📍 All Stops:', allStops.length);
        
        const regions = groupIntoRegions(allStops);
        console.log(`📍 Grouped into ${regions.length} regions`);
        
        let optimizedStops: RouteStop[] = [];
        let currentPoint = currentLocation || allStops[0]?.coordinates || { lat: 59.9343, lng: 30.3351 };
        
        regions.sort((a, b) => {
          const avgLatA = a.reduce((sum, s) => sum + s.coordinates.lat, 0) / a.length;
          const avgLngA = a.reduce((sum, s) => sum + s.coordinates.lng, 0) / a.length;
          const avgLatB = b.reduce((sum, s) => sum + s.coordinates.lat, 0) / b.length;
          const avgLngB = b.reduce((sum, s) => sum + s.coordinates.lng, 0) / b.length;
          
          const distToA = calculateDistance(currentPoint.lat, currentPoint.lng, avgLatA, avgLngA);
          const distToB = calculateDistance(currentPoint.lat, currentPoint.lng, avgLatB, avgLngB);
          return distToA - distToB;
        });
        
        for (let regionIdx = 0; regionIdx < regions.length; regionIdx++) {
          const region = regions[regionIdx];
          const optimizedRegion = pickupFirstOptimization(region, currentPoint);
          optimizedStops.push(...optimizedRegion);
          
          if (optimizedRegion.length > 0) {
            currentPoint = optimizedRegion[optimizedRegion.length - 1].coordinates;
          }
        }
        
        console.log('\n🎯 FINAL OPTIMIZED SEQUENCE:', optimizedStops.length, 'stops');
        
        optimizedStops.forEach((stop, idx) => {
          stop.sequence = idx + 1;
        });
        
        for (let i = 0; i < optimizedStops.length; i++) {
          const prevCoords = i === 0 && currentLocation 
            ? currentLocation 
            : (i === 0 ? optimizedStops[0].coordinates : optimizedStops[i-1].coordinates);
          
          const distance = calculateDistance(
            prevCoords.lat, prevCoords.lng,
            optimizedStops[i].coordinates.lat, optimizedStops[i].coordinates.lng
          );
          
          optimizedStops[i].distance = `${distance.toFixed(1)} km`;
          optimizedStops[i].distanceKm = distance;
          optimizedStops[i].estimatedTime = formatEstimatedTime(distance);
        }
        
        setRouteStops(optimizedStops);
        
        const totalDistanceKm = optimizedStops.reduce((sum, stop) => sum + stop.distanceKm, 0);
        const totalDurationMinutes = optimizedStops.reduce((sum, stop) => sum + (stop.distanceKm * 2), 0);
        const totalEarningsUsd = optimizedStops.filter(s => s.type === 'delivery').length * 15;
        const fuelCostUsd = totalDistanceKm * 0.4;
        
        setOptimizationData({
          stops: optimizedStops,
          totalDistance: totalDistanceKm,
          totalDuration: totalDurationMinutes,
          optimizedSequence: optimizedStops.map((_, i) => i),
          estimatedEarnings: totalEarningsUsd,
          fuelCost: fuelCostUsd,
          netEarnings: totalEarningsUsd - fuelCostUsd
        });
        
        generateGoogleMapsUrl(optimizedStops);
        
        toast.success(`✅ Route optimized: ${optimizedStops.length} stops | ${totalDistanceKm.toFixed(1)} km`);
        
        // Re-initialize map if in map view
        if (viewMode === 'map') {
          setTimeout(() => initializeMap(), 100);
        }
      } else {
        setRouteStops([]);
        setOptimizationData(null);
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      toast.error('Failed to calculate optimal route');
    } finally {
      setLoading(false);
      setOptimizing(false);
    }
  };

  const generateGoogleMapsUrl = (stops: RouteStop[]) => {
    if (!stops.length) return;
    
    const origin = currentLocation ? `${currentLocation.lat},${currentLocation.lng}` : `${stops[0].coordinates.lat},${stops[0].coordinates.lng}`;
    const destination = `${stops[stops.length - 1].coordinates.lat},${stops[stops.length - 1].coordinates.lng}`;
    
    const url = `https://www.google.com/maps/dir/${origin}/${destination}/@${stops[0]?.coordinates.lat || 59.9343},${stops[0]?.coordinates.lng || 30.3351},12z`;
    setMapUrl(url);
  };

  const openRealMap = () => {
    if (mapUrl) {
      window.open(mapUrl, '_blank');
    } else if (routeStops.length > 0) {
      const origin = currentLocation ? `${currentLocation.lat},${currentLocation.lng}` : `${routeStops[0].coordinates.lat},${routeStops[0].coordinates.lng}`;
      const destination = `${routeStops[routeStops.length - 1].coordinates.lat},${routeStops[routeStops.length - 1].coordinates.lng}`;
      window.open(`https://www.google.com/maps/dir/${origin}/${destination}`, '_blank');
    }
  };

  const centerMapOnLocation = () => {
    if (mapInstanceRef.current && currentLocation) {
      mapInstanceRef.current.setView([currentLocation.lat, currentLocation.lng], 15);
      toast.info('Map centered on your location');
    } else if (mapInstanceRef.current && routeStops.length > 0) {
      mapInstanceRef.current.setView([routeStops[0].coordinates.lat, routeStops[0].coordinates.lng], 12);
      toast.info('Map centered on first stop');
    }
  };

  const startCarSimulation = async (stopId: string) => {
    console.log('🚗 Starting car simulation for stop:', stopId);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (!currentLocation) {
      toast.info('Getting your location first...');
      await requestLocation();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!currentLocation) {
        toast.error('Unable to get your location. Please enable location services.');
        return;
      }
    }

    const currentStopIndex = routeStops.findIndex(s => s.id === stopId);
    if (currentStopIndex === -1) {
      console.error('Stop not found:', stopId);
      toast.error('Stop not found');
      return;
    }

    const targetStop = routeStops[currentStopIndex];
    
    await handleStartDelivery(stopId);
    
    let fromPoint: LocationCoords;
    if (currentStopIndex === 0) {
      fromPoint = currentLocation!;
    } else {
      const prevStop = routeStops[currentStopIndex - 1];
      fromPoint = prevStop.coordinates;
    }
    
    const toPoint = targetStop.coordinates;
    const distance = calculateDistance(fromPoint.lat, fromPoint.lng, toPoint.lat, toPoint.lng);
    const duration = Math.max(2000, Math.min(8000, distance * 1500 / simulationSpeed));
    
    setIsSimulating(true);
    setActiveOrderId(targetStop.orderId);
    
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      setCarAnimation({
        active: true,
        fromStopId: currentStopIndex === 0 ? 'current-location' : routeStops[currentStopIndex - 1].id,
        toStopId: stopId,
        progress: progress,
        startTime: startTime,
        duration: duration
      });
      
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        handleMarkComplete(stopId);
        setCarAnimation(null);
        setIsSimulating(false);
        setActiveOrderId(null);
        animationFrameRef.current = null;
        
        const nextPending = routeStops.find(s => s.status === 'pending');
        if (nextPending) {
          toast.info(`✅ Completed! Next: ${nextPending.type === 'pickup' ? 'Pickup' : 'Delivery'} for order ${nextPending.orderNumber}`);
        }
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const drawSimulationMap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (routeStops.length === 0) return;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < canvas.width; i += 100) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }
    
    const allPoints = [...routeStops.map(stop => stop.coordinates)];
    if (currentLocation) allPoints.unshift(currentLocation);
    
    let minLat = Math.min(...allPoints.map(p => p.lat));
    let maxLat = Math.max(...allPoints.map(p => p.lat));
    let minLng = Math.min(...allPoints.map(p => p.lng));
    let maxLng = Math.max(...allPoints.map(p => p.lng));
    
    const latSpan = (maxLat - minLat) || 0.1;
    const lngSpan = (maxLng - minLng) || 0.1;
    const padding = 0.15 / zoom;
    
    minLat = minLat - latSpan * padding;
    maxLat = maxLat + latSpan * padding;
    minLng = minLng - lngSpan * padding;
    maxLng = maxLng + lngSpan * padding;
    
    const latRange = maxLat - minLat;
    const lngRange = maxLng - minLng;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    const toX = (lng: number) => {
      const x = ((lng - minLng) / lngRange) * canvas.width;
      return centerX + (x - centerX) * zoom + panX;
    };
    const toY = (lat: number) => {
      const y = canvas.height - ((lat - minLat) / latRange) * canvas.height;
      return centerY + (y - centerY) * zoom + panY;
    };
    
    const points: {x: number, y: number, stop?: RouteStop}[] = [];
    if (currentLocation) points.push({ x: toX(currentLocation.lng), y: toY(currentLocation.lat) });
    for (const stop of routeStops) points.push({ x: toX(stop.coordinates.lng), y: toY(stop.coordinates.lat), stop });
    
    if (points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.lineWidth = 8;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    if (carAnimation?.active) {
      let fromX, fromY, toXCoord, toYCoord;
      
      if (carAnimation.fromStopId === 'current-location' && currentLocation) {
        fromX = toX(currentLocation.lng);
        fromY = toY(currentLocation.lat);
        const toStop = routeStops.find(s => s.id === carAnimation.toStopId);
        if (toStop) {
          toXCoord = toX(toStop.coordinates.lng);
          toYCoord = toY(toStop.coordinates.lat);
        } else {
          return;
        }
      } else {
        const fromStop = routeStops.find(s => s.id === carAnimation.fromStopId);
        const toStop = routeStops.find(s => s.id === carAnimation.toStopId);
        if (!fromStop || !toStop) return;
        
        fromX = toX(fromStop.coordinates.lng);
        fromY = toY(fromStop.coordinates.lat);
        toXCoord = toX(toStop.coordinates.lng);
        toYCoord = toY(toStop.coordinates.lat);
      }
      
      const progress = Math.min(1, carAnimation.progress);
      const carX = fromX + (toXCoord - fromX) * progress;
      const carY = fromY + (toYCoord - fromY) * progress;
      
      ctx.beginPath();
      ctx.arc(carX, carY, 25, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.fill();
      
      ctx.beginPath();
      ctx.ellipse(carX, carY, 18, 14, 0, 0, 2 * Math.PI);
      ctx.fillStyle = '#EF4444';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(carX, carY, 16, 12, 0, 0, 2 * Math.PI);
      ctx.fillStyle = '#DC2626';
      ctx.fill();
      
      ctx.font = '28px "Segoe UI"';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚗', carX, carY);
      
      for (let i = 1; i <= 6; i++) {
        const trailProgress = Math.max(0, progress - i * 0.06);
        if (trailProgress > 0) {
          const trailX = fromX + (toXCoord - fromX) * trailProgress;
          const trailY = fromY + (toYCoord - fromY) * trailProgress;
          ctx.beginPath();
          ctx.arc(trailX, trailY, 16 - i * 2, 0, 2 * Math.PI);
          ctx.fillStyle = `rgba(239, 68, 68, ${0.3 - i * 0.04})`;
          ctx.fill();
        }
      }
    } else if (currentLocation) {
      const x = toX(currentLocation.lng);
      const y = toY(currentLocation.lat);
      
      const pulseSize = 20 + Math.sin(Date.now() / 500) * 5;
      ctx.beginPath();
      ctx.arc(x, y, pulseSize, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, 2 * Math.PI);
      ctx.fillStyle = '#10B981';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = '#10B981';
      ctx.fill();
      
      ctx.font = 'bold 13px "Segoe UI"';
      ctx.fillStyle = '#10B981';
      ctx.fillText('📍 START', x - 25, y - 22);
    }
    
    for (let i = 0; i < routeStops.length; i++) {
      const stop = routeStops[i];
      const x = toX(stop.coordinates.lng);
      const y = toY(stop.coordinates.lat);
      const isSelected = selectedStop === stop.id;
      const isCompleted = stop.status === 'completed';
      const isInProgress = stop.status === 'in-progress';
      const isPickup = stop.type === 'pickup';
      const isDelivery = stop.type === 'delivery';
      
      let color = '#F59E0B';
      if (isDelivery) color = '#8B5CF6';
      if (isCompleted) color = '#10B981';
      if (isInProgress) color = '#3B82F6';
      
      const radius = isSelected ? 26 : 22;
      
      ctx.beginPath();
      ctx.arc(x, y, radius + 8, 0, 2 * Math.PI);
      ctx.fillStyle = `${color}40`;
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, radius - 6, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      
      ctx.font = `bold ${isSelected ? 22 : 20}px "Segoe UI"`;
      ctx.fillStyle = color;
      ctx.fillText((stop.sequence || i + 1).toString(), x, y + 1);
      
      const icon = isPickup ? '📦' : '🏠';
      ctx.font = '22px "Segoe UI"';
      ctx.fillStyle = color;
      ctx.fillText(icon, x - 13, y - 16);
      
      let label = `${stop.sequence || i + 1}. ${isPickup ? `Pickup ${stop.orderNumber.slice(-6)}` : `Delivery ${stop.orderNumber.slice(-6)}`}`;
      
      ctx.font = '12px "Segoe UI"';
      const labelWidth = ctx.measureText(label).width + 16;
      const labelY = y - radius - 12;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(x - labelWidth/2, labelY - 14, labelWidth, 28);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(label, x - labelWidth/2 + 8, labelY);
      
      if (stop.distance && i > 0) {
        ctx.font = '10px "Segoe UI"';
        ctx.fillStyle = '#9CA3AF';
        ctx.fillText(`↗ ${stop.distance}`, x + 24, y + 10);
      }
    }
    
    const legendX = canvas.width - 210;
    const legendY = 20;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(legendX, legendY, 200, 150);
    ctx.strokeStyle = '#4B5563';
    ctx.strokeRect(legendX, legendY, 200, 150);
    
    ctx.font = 'bold 11px "Segoe UI"';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('LEGEND', legendX + 15, legendY + 18);
    
    ctx.font = '10px "Segoe UI"';
    ctx.fillStyle = '#10B981';
    ctx.fillText('📍 START - Your Location', legendX + 15, legendY + 38);
    ctx.fillStyle = '#F59E0B';
    ctx.fillText('📦 PICKUP - Collect packages', legendX + 15, legendY + 58);
    ctx.fillStyle = '#8B5CF6';
    ctx.fillText('🏠 DELIVERY - Drop off', legendX + 15, legendY + 78);
    ctx.fillStyle = '#EF4444';
    ctx.fillText('🚗 MOVING - Vehicle', legendX + 15, legendY + 98);
    ctx.fillStyle = '#3B82F6';
    ctx.fillText('🔵 IN PROGRESS', legendX + 15, legendY + 118);
    ctx.fillStyle = '#00FF00';
    ctx.fillText('✓ COMPLETED', legendX + 15, legendY + 138);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(canvas.width - 130, canvas.height - 35, 125, 28);
    ctx.font = '9px "Segoe UI"';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('🔍 + / - Zoom | 🖱️ Drag to pan', canvas.width - 125, canvas.height - 18);
  };

  const handleStartDelivery = async (stopId: string) => {
    const stop = routeStops.find(s => s.id === stopId);
    if (!stop) return;
    
    try {
      const response = await orderApi.updateOrderStatus(stop.orderId, 'in_transit');
      if (response.success) {
        setRouteStops(prev => prev.map(s => 
          s.id === stopId ? { ...s, status: 'in-progress' as const } : s
        ));
        toast.info(`Started ${stop.type === 'pickup' ? 'pickup' : 'delivery'} for order ${stop.orderNumber}`);
      }
    } catch (error) {
      console.error('Error starting delivery:', error);
    }
  };

  const handleMarkComplete = async (stopId: string) => {
    const stop = routeStops.find(s => s.id === stopId);
    if (!stop) return;
    
    try {
      const newStatus = stop.type === 'pickup' ? 'in_transit' : 'delivered';
      const response = await orderApi.updateOrderStatus(stop.orderId, newStatus);
      if (response.success) {
        setRouteStops(prev => prev.map(s => 
          s.id === stopId ? { ...s, status: 'completed' as const } : s
        ));
        toast.success(`${stop.type === 'pickup' ? 'Pickup' : 'Delivery'} completed for order ${stop.orderNumber}`);
        
        setTimeout(() => calculateOptimalRoute(), 500);
      }
    } catch (error) {
      console.error('Error marking complete:', error);
      toast.error('Failed to mark as complete');
    }
  };

  const handleNavigate = (stop: RouteStop) => {
    if (currentLocation) {
      window.open(`https://www.google.com/maps/dir/${currentLocation.lat},${currentLocation.lng}/${stop.coordinates.lat},${stop.coordinates.lng}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${stop.coordinates.lat},${stop.coordinates.lng}`, '_blank');
    }
  };

  const handleZoomIn = () => setZoom(Math.min(zoom + 0.2, 3));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.2, 0.5));
  const handleResetView = () => { setZoom(1); setPanX(0); setPanY(0); };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setPanX(e.clientX - dragStart.x);
      setPanY(e.clientY - dragStart.y);
    }
  };

  const handleCanvasMouseUp = () => setIsDragging(false);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Calculating optimal route...</p>
        </div>
      </div>
    );
  }

  if (routeStops.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg text-gray-900 mb-2">No Active Deliveries</h3>
          <p className="text-gray-600">You don't have any active deliveries at the moment.</p>
          <Button className="mt-4" variant="outline" onClick={calculateOptimalRoute}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Check for Orders
          </Button>
        </CardContent>
      </Card>
    );
  }

  const completedCount = routeStops.filter(s => s.status === 'completed').length;
  const firstPendingStop = routeStops.find(s => s.status === 'pending');
  const totalPickups = routeStops.filter(s => s.type === 'pickup').length;
  const totalDeliveries = routeStops.filter(s => s.type === 'delivery').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Optimal Delivery Route</h2>
          <p className="text-gray-600 mt-1">
            🎯 {totalPickups} pickups | {totalDeliveries} deliveries | {routeStops.length} total stops
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setViewMode('map')} className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1 ${viewMode === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}`}>
              <MapIcon className="h-4 w-4" /> Real Map
            </button>
            <button onClick={() => setViewMode('simulation')} className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1 ${viewMode === 'simulation' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}`}>
              <Car className="h-4 w-4" /> Simulation
            </button>
            <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1 ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}`}>
              <Package className="h-4 w-4" /> List
            </button>
          </div>
          <Button onClick={calculateOptimalRoute} variant="outline" disabled={optimizing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${optimizing ? 'animate-spin' : ''}`} />
            Re-optimize
          </Button>
        </div>
      </div>

      {optimizationData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-gray-600">Total Distance</p><p className="text-xl font-bold text-blue-700">{optimizationData.totalDistance.toFixed(1)} km</p></div>
                <MapIcon className="h-6 w-6 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-gray-600">Est. Duration</p><p className="text-xl font-bold text-purple-700">{Math.floor(optimizationData.totalDuration / 60)}h {optimizationData.totalDuration % 60}m</p></div>
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-gray-600">Total Stops</p><p className="text-xl font-bold text-orange-700">{routeStops.length}</p></div>
                <Package className="h-6 w-6 text-orange-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-gray-600">Net Earnings</p><p className="text-xl font-bold text-green-700">${optimizationData.netEarnings.toFixed(2)}</p></div>
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {firstPendingStop && (
        <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center"><Star className="h-5 w-5 text-white" /></div>
                <div>
                  <p className="text-sm font-medium text-emerald-800">Next stop in sequence:</p>
                  <p className="text-lg font-bold text-emerald-900">
                    {firstPendingStop.type === 'pickup' ? '📦 Pickup' : '🏠 Delivery'} - Order {firstPendingStop.orderNumber}
                  </p>
                  <p className="text-xs text-emerald-700">{firstPendingStop.address}</p>
                </div>
              </div>
              <Button 
                onClick={() => startCarSimulation(firstPendingStop.id)} 
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={isSimulating}
              >
                {isSimulating && activeOrderId === firstPendingStop.orderId ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Simulating...</>
                ) : (
                  <><Car className="h-4 w-4 mr-2" /> Start {firstPendingStop.type === 'pickup' ? 'Pickup' : 'Delivery'}</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === 'map' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <MapIcon className="h-5 w-5 text-red-600" />
                Interactive Route Map
              </CardTitle>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={centerMapOnLocation}
                >
                  <Compass className="h-4 w-4 mr-1" />
                  Center on Me
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={openRealMap}
                >
                  <Navigation className="h-4 w-4 mr-1" />
                  Open in Google Maps
                </Button>
              </div>
            </div>
            <p className="text-gray-600 text-sm">Click on any marker to see details • Colored dots show stop sequence</p>
          </CardHeader>
          <CardContent>
            <div 
              ref={mapContainerRef} 
              className="h-[500px] w-full rounded-lg overflow-hidden border border-gray-200 z-10"
              style={{ position: 'relative' }}
            />
            <div className="mt-3 flex flex-wrap gap-3 justify-center text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Your Location</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span>Pickup</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span>Delivery</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Completed</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>Selected</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-6 h-0.5 bg-blue-500"></div>
                <span>Optimized Route</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === 'simulation' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2"><Car className="h-5 w-5 text-red-600" /> Route Simulation</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleZoomIn} className="h-8 w-8 p-0"><ZoomIn className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" onClick={handleZoomOut} className="h-8 w-8 p-0"><ZoomOut className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" onClick={handleResetView} className="h-8 px-2 text-xs">Reset View</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative w-full overflow-x-auto">
              <canvas
                ref={canvasRef}
                width={dimensions.width}
                height={dimensions.height}
                className="rounded-lg border border-gray-300 w-full cursor-grab active:cursor-grabbing bg-gradient-to-br from-gray-900 to-gray-800"
                style={{ height: `${dimensions.height}px`, minWidth: '800px' }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              />
              
              <div className="absolute left-4 top-4 bg-black/80 rounded-lg p-3 text-white text-xs space-y-2 backdrop-blur-sm shadow-xl border border-gray-700 max-w-[220px]">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={requestLocation} 
                  disabled={gettingLocation}
                  className="w-full mb-2 bg-blue-600 hover:bg-blue-700 text-white border-none"
                >
                  <Compass className="h-3 w-3 mr-1" />
                  {gettingLocation ? 'Getting location...' : '📍 Get My Location'}
                </Button>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2"><span className="text-lg">🐌</span><span>Speed</span></div>
                  <input type="range" min="0.5" max="3" step="0.5" value={simulationSpeed} onChange={(e) => setSimulationSpeed(parseFloat(e.target.value))} className="w-24" />
                  <div className="flex items-center gap-1"><span className="text-lg">🚀</span><Badge className={isSimulating ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}>{isSimulating ? 'Moving...' : 'Ready'}</Badge></div>
                </div>
                <div className="border-t border-gray-700 pt-2">
                  <p className="text-gray-400 text-xs">✨ Click "Start" button on any stop to begin</p>
                  <p className="text-gray-400 text-xs mt-1">🚗 Red car will animate along the route</p>
                  <p className="text-gray-400 text-xs mt-1">✅ Optimized route: All pickups first, then all deliveries</p>
                </div>
              </div>
              
              <div className="absolute right-4 top-4 bg-black/80 rounded-lg p-3 text-white text-xs backdrop-blur-sm shadow-xl border border-gray-700 min-w-[180px]">
                <p className="font-bold text-center mb-2">📊 PROGRESS</p>
                <div className="mb-2">
                  <div className="flex justify-between text-xs"><span>Completed: {completedCount}/{routeStops.length}</span><span>{Math.round((completedCount / routeStops.length) * 100)}%</span></div>
                  <div className="w-full bg-gray-700 rounded-full h-2 mt-1"><div className="bg-green-500 rounded-full h-2 transition-all" style={{ width: `${(completedCount / routeStops.length) * 100}%` }} /></div>
                </div>
                <div className="border-t border-gray-700 pt-2 mt-1">
                  <p className="text-center text-[11px]">{totalPickups} pickups • {totalDeliveries} deliveries</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === 'list' && (
        <Card>
          <CardHeader>
            <CardTitle>Delivery Sequence ({routeStops.length} stops in optimal order)</CardTitle>
            <p className="text-gray-600 text-sm">✨ Optimized route: Pickups first (nearest neighbor), then deliveries (nearest neighbor)</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {routeStops.map((stop, index) => (
                <div key={stop.id} className={`border rounded-lg transition-all ${selectedStop === stop.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : stop.status === 'completed' ? 'bg-green-50 border-green-200' : stop.status === 'in-progress' ? 'bg-blue-50 border-blue-200' : 'bg-white hover:shadow-md'}`}>
                  <div className="p-4 cursor-pointer" onClick={() => setSelectedStop(stop.id === selectedStop ? null : stop.id)}>
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${stop.status === 'completed' ? 'bg-green-500' : stop.status === 'in-progress' ? 'bg-blue-500' : stop.type === 'pickup' ? 'bg-orange-500' : 'bg-purple-500'}`}>
                          {stop.status === 'completed' ? <CheckCircle2 className="h-6 w-6" /> : stop.sequence || index + 1}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-gray-900">#{stop.orderNumber}</p>
                            <Badge className={getPriorityColor(stop.priority)}>{stop.priority} priority</Badge>
                            <Badge className={stop.type === 'pickup' ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-800'}>{stop.type === 'pickup' ? '📦 Pickup' : '🏠 Delivery'}</Badge>
                            {stop.status === 'completed' && <Badge className="bg-green-100 text-green-800">✓ Completed</Badge>}
                            {stop.status === 'in-progress' && <Badge className="bg-blue-100 text-blue-800">▶ In Progress</Badge>}
                          </div>
                          <div className="text-sm text-gray-500">Est. {stop.estimatedTime}</div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                          <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" /><div><p className="text-xs text-gray-500">Address</p><p className="text-sm">{stop.address}</p></div></div>
                          <div className="flex items-start gap-2"><Package className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" /><div><p className="text-xs text-gray-500">Details</p><p className="text-sm">{stop.packageDetails}</p></div></div>
                          <div className="flex items-start gap-2"><Navigation className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" /><div><p className="text-xs text-gray-500">Distance</p><p className="text-sm">{stop.distance}</p></div></div>
                          <div className="flex items-start gap-2"><User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" /><div><p className="text-xs text-gray-500">Customer</p><p className="text-sm">{stop.customerName}</p></div></div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {stop.status === 'pending' && (
                          <Button 
                            size="sm" 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              startCarSimulation(stop.id); 
                            }} 
                            className={stop.type === 'pickup' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-purple-600 hover:bg-purple-700'}
                            disabled={isSimulating}
                          >
                            {isSimulating && activeOrderId === stop.orderId ? (
                              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Simulating...</>
                            ) : (
                              <><Car className="h-4 w-4 mr-1" /> Start {stop.type === 'pickup' ? 'Pickup' : 'Delivery'}</>
                            )}
                          </Button>
                        )}
                        {stop.status === 'in-progress' && (
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); handleMarkComplete(stop.id); }} className="bg-green-600 hover:bg-green-700">
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Complete
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleNavigate(stop); }}><Navigation className="h-4 w-4 mr-1" /> Navigate</Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
        <CardContent className="pt-5 pb-5">
          <div className="flex gap-3">
            <div className="flex-shrink-0"><div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center"><Navigation className="h-5 w-5 text-white" /></div></div>
            <div><p className="font-semibold text-blue-900">Route Optimization Features</p>
              <ul className="mt-2 space-y-1 text-sm text-blue-800">
                <li>• ✅ <strong>REGION CLUSTERING</strong> - Stops within 3km are grouped together</li>
                <li>• ✅ <strong>PICKUP-FIRST OPTIMIZATION</strong> - All pickups first (nearest neighbor), then all deliveries</li>
                <li>• ✅ <strong>CONSTRAINT ENFORCEMENT</strong> - Delivery NEVER happens before pickup</li>
                <li>• ✅ <strong>SAME ADDRESS BATCHING</strong> - Multiple orders at same address are processed together</li>
                <li>• Each order has separate Pickup and Delivery stops</li>
                <li>• Follow the numbered sequence for optimal route efficiency</li>
                <li>• Route automatically re-optimizes after each completion</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}