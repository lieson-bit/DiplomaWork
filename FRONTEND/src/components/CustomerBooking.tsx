import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { MapPin, Package, Weight, Ruler, Clock, DollarSign, Loader2, User, Star, Check, ChevronDown, ChevronUp, Car, Calendar, Trophy, Eye, RefreshCw, AlertTriangle, X, Info, FileText, Navigation, Truck, Globe, Mail, Phone, Home, Box, Shield, Thermometer, AlertCircle, CheckCircle, CreditCard, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import debounce from 'lodash/debounce';
import { useLanguage } from './LanguageContext';
import { Badge } from "./ui/badge";
import { getAuthToken, getCurrentUser } from '../src/lib/api';
import { orderApi } from '../src/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import axios from 'axios';

interface BookingForm {
  pickupAddress: string;
  deliveryAddress: string;
  category: string;
  weight: string;
  volume: string;
  urgency: string;
  fragile: boolean;
  refrigerated: boolean;
  oversized: boolean;
  hazardous: boolean;
}

interface PriceResponse {
  success: boolean;
  price_rub: number;
  price_usd: number;
  distance_km: number;
  duration_minutes: number;
  duration_text: string;
  vehicle_type: string;
  confidence_interval_low: number;
  confidence_interval_high: number;
  error?: string;
  timestamp: string;
}

interface Driver {
  driverId: string;
  userId: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  rating: number;
  distanceInfo: {
    distance: {
      text: string;
    };
    duration: {
      text: string;
    };
  };
  estimatedArrival: string;
  matchScore: number;
  suitability: string;
  vehicles: Array<{
    type: string;
    make: string;
    model: string;
    licensePlate: string;
    maxWeight: number;
    maxVolume: number;
    imageUrl: string;
  }>;
}

interface DriversResponse {
  success: boolean;
  count: number;
  data: Driver[];
  error?: string;
}

interface Coordinates {
  lat: number;
  lng: number;
}

// DistanceMatrix.ai API key
const DISTANCE_MATRIX_API_KEY = 'NFLqNsgalupmIuzDS6zKuprvodMgjdaGAxBtGYNpOT9TUwnCnC4Z9Do6T2drMT4Y';

// Predefined coordinates for major Russian cities (fallback)
const CITY_COORDINATES: Record<string, Coordinates> = {
  'москва': { lat: 55.7558, lng: 37.6173 },
  'moscow': { lat: 55.7558, lng: 37.6173 },
  'санкт-петербург': { lat: 59.9343, lng: 30.3351 },
  'saint petersburg': { lat: 59.9343, lng: 30.3351 },
  'st. petersburg': { lat: 59.9343, lng: 30.3351 },
  'st petersburg': { lat: 59.9343, lng: 30.3351 },
  'питер': { lat: 59.9343, lng: 30.3351 },
  'spb': { lat: 59.9343, lng: 30.3351 },
  'новосибирск': { lat: 55.0084, lng: 82.9357 },
  'novosibirsk': { lat: 55.0084, lng: 82.9357 },
  'екатеринбург': { lat: 56.8389, lng: 60.6057 },
  'yekaterinburg': { lat: 56.8389, lng: 60.6057 },
  'казань': { lat: 55.7961, lng: 49.1064 },
  'kazan': { lat: 55.7961, lng: 49.1064 },
  'нижний новгород': { lat: 56.2965, lng: 43.9361 },
  'nizhny novgorod': { lat: 56.2965, lng: 43.9361 },
};

// Known locations with specific coordinates
const KNOWN_LOCATIONS: Array<{keywords: string[], coords: Coordinates}> = [
  {
    keywords: ['zagorodnyi prospekt', 'загородный проспект'],
    coords: { lat: 59.9280, lng: 30.3470 } // Zagorodnyi Prospekt area
  },
  {
    keywords: ['esenina', 'есенина'],
    coords: { lat: 59.8920, lng: 30.3190 } // Ulitsa Esenina area
  },
  {
    keywords: ['khersonskiy', 'khersonskiy proyezd', 'херсонский'],
    coords: { lat: 59.8500, lng: 30.3167 }
  },
  {
    keywords: ['варшавская', 'warsaw'],
    coords: { lat: 59.8500, lng: 30.3167 }
  },
  {
    keywords: ['nevsky', 'невский'],
    coords: { lat: 59.9358, lng: 30.3259 } // Nevsky Prospekt
  },
  {
    keywords: ['адмиралтейская', 'admiralteyskaya'],
    coords: { lat: 59.9375, lng: 30.3086 } // Admiralteyskaya metro
  }
];

export function CustomerBooking() {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<BookingForm>({
    pickupAddress: '',
    deliveryAddress: '',
    category: '',
    weight: '',
    volume: '',
    urgency: 'normal',
    fragile: false,
    refrigerated: false,
    oversized: false,
    hazardous: false
  });

  const [priceData, setPriceData] = useState<PriceResponse | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [categories, setCategories] = useState<Array<{value: string, label: string}>>([]);
  const [imageErrors, setImageErrors] = useState<{[key: string]: boolean}>({});
  const [pickupCoordinates, setPickupCoordinates] = useState<Coordinates | null>(null);
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<Coordinates | null>(null);
  const [geocodingInProgress, setGeocodingInProgress] = useState(false);
  const [showOrderPreview, setShowOrderPreview] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [geocodingResults, setGeocodingResults] = useState<{
    pickup: { status: 'idle' | 'loading' | 'success' | 'error', method?: string, accuracy?: string },
    delivery: { status: 'idle' | 'loading' | 'success' | 'error', method?: string, accuracy?: string }
  }>({
    pickup: { status: 'idle' },
    delivery: { status: 'idle' }
  });
  
  // Store last fetched data
  const lastFetchedFormDataRef = useRef<Partial<BookingForm>>({});
  const lastFetchedPriceDataRef = useRef<string>('');

  // Check if user is customer
  useEffect(() => {
    const user = getCurrentUser();
    if (user && user.userType !== 'customer') {
      toast.error(t('customer.booking.only_customers'));
    }
  }, [t]);

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/categories');
        if (!response.ok) throw new Error('Failed to fetch categories');
        const data = await response.json();
        setCategories(data.categories);
      } catch {
        setCategories([
          { value: 'documents', label: t('customer.booking.category_documents') },
          { value: 'furniture', label: t('customer.booking.category_furniture') },
          { value: 'construction', label: t('customer.booking.category_construction') },
          { value: 'food', label: t('customer.booking.category_food') },
          { value: 'electronics', label: t('customer.booking.category_electronics') },
          { value: 'other', label: t('customer.booking.category_other') }
        ]);
      }
    };
    
    loadCategories();
  }, [t]);

  // Robust geocoding function similar to your example
  const geocodeAddress = useCallback(async (address: string, type: 'pickup' | 'delivery'): Promise<Coordinates | null> => {
    const requestId = `geocode_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const startTime = Date.now();
    
    try {
      console.log(`🌍 [${requestId}] Geocoding ${type} address: "${address.substring(0, 50)}${address.length > 50 ? '...' : ''}"`);
      
      if (!address || address.trim().length === 0) {
        console.warn(`⚠️ [${requestId}] Empty ${type} address provided`);
        return getFallbackCoordinates('empty');
      }
      
      const cleanAddress = address.trim();
      
      // Update geocoding status
      setGeocodingResults(prev => ({
        ...prev,
        [type]: { status: 'loading' }
      }));

      // ============================================
      // OPTION 1: DistanceMatrix.ai Geocoding (Primary)
      // ============================================
      try {
        console.log(`📍 [${requestId}] Trying DistanceMatrix.ai geocoding...`);
        
        const response = await axios.get('https://api.distancematrix.ai/maps/api/geocode/json', {
          params: {
            address: cleanAddress,
            key: DISTANCE_MATRIX_API_KEY,
            language: 'en'
          },
          headers: {
            'User-Agent': 'DeliveryBooking/1.0'
          },
          timeout: 8000
        });

        console.log(`📍 [${requestId}] DistanceMatrix.ai response status: ${response.data.status}`);
        
        if (response.data.status === 'OK' && Array.isArray(response.data.result)) {
          const results = response.data.result;
          if (results.length > 0) {
            const location = results[0];
            const coords = {
              lat: location.geometry?.location?.lat,
              lng: location.geometry?.location?.lng
            };
            
            if (coords.lat && coords.lng && !isNaN(coords.lat) && !isNaN(coords.lng)) {
              const finalCoords = {
                lat: parseFloat(coords.lat),
                lng: parseFloat(coords.lng)
              };
              
              console.log(`✅ [${requestId}] Successfully geocoded via DistanceMatrix.ai: ${finalCoords.lat},${finalCoords.lng}`);
              console.log(`📍 [${requestId}] Location: ${location.formatted_address?.substring(0, 100) || 'Address found'}`);
              console.log(`⏱️ [${requestId}] Geocoding time: ${Date.now() - startTime}ms`);
              
              setGeocodingResults(prev => ({
                ...prev,
                [type]: { 
                  status: 'success', 
                  method: 'DistanceMatrix.ai',
                  accuracy: 'high'
                }
              }));
              
              return finalCoords;
            }
          }
        }
      } catch (dmError: any) {
        console.warn(`⚠️ [${requestId}] DistanceMatrix.ai geocoding error:`, dmError.message);
      }

      // ============================================
      // OPTION 2: OpenStreetMap Nominatim (Fallback 1)
      // ============================================
      try {
        console.log(`📍 [${requestId}] Trying OpenStreetMap Nominatim as fallback...`);
        
        let searchAddress = cleanAddress;
        if (cleanAddress.toLowerCase().includes('sankt-peterburg') || 
            cleanAddress.toLowerCase().includes('st. petersburg') ||
            cleanAddress.toLowerCase().includes('питер')) {
          searchAddress = 'Saint Petersburg, Russia';
        }
        
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: {
            q: searchAddress,
            format: 'json',
            limit: 1,
            'accept-language': 'en'
          },
          headers: {
            'User-Agent': 'DeliveryBooking/1.0'
          },
          timeout: 5000
        });

        const results = response.data;
        if (Array.isArray(results) && results.length > 0) {
          const lat = parseFloat(results[0].lat);
          const lng = parseFloat(results[0].lon);
          
          if (!isNaN(lat) && !isNaN(lng)) {
            const coords = { lat, lng };
            
            console.log(`✅ [${requestId}] Successfully geocoded via Nominatim: ${coords.lat},${coords.lng}`);
            console.log(`📍 [${requestId}] Location: ${results[0].display_name?.substring(0, 100) || 'Address found'}`);
            console.log(`⏱️ [${requestId}] Geocoding time: ${Date.now() - startTime}ms`);
            
            setGeocodingResults(prev => ({
              ...prev,
              [type]: { 
                status: 'success', 
                method: 'Nominatim',
                accuracy: 'medium'
              }
            }));
            
            return coords;
          }
        }
      } catch (nominatimError: any) {
        console.warn(`⚠️ [${requestId}] Nominatim geocoding error:`, nominatimError.message);
      }

      // ============================================
      // OPTION 3: Known locations detection
      // ============================================
      console.log(`📍 [${requestId}] Trying known locations detection...`);
      
      const addressLower = cleanAddress.toLowerCase();
      
      for (const location of KNOWN_LOCATIONS) {
        for (const keyword of location.keywords) {
          if (addressLower.includes(keyword.toLowerCase())) {
            console.log(`📍 [${requestId}] Found keyword "${keyword}" in address, using coordinates: ${location.coords.lat},${location.coords.lng}`);
            console.log(`⏱️ [${requestId}] Geocoding time: ${Date.now() - startTime}ms`);
            
            setGeocodingResults(prev => ({
              ...prev,
              [type]: { 
                status: 'success', 
                method: 'Known Location',
                accuracy: 'medium'
              }
            }));
            
            return location.coords;
          }
        }
      }

      // ============================================
      // OPTION 4: Extract street number for variation
      // ============================================
      console.log(`📍 [${requestId}] Trying street number extraction...`);
      
      const streetNumberMatch = cleanAddress.match(/\b(\d+[A-Za-z]?)\b/);
      if (streetNumberMatch) {
        const streetNumber = streetNumberMatch[1];
        console.log(`📍 [${requestId}] Found street number: ${streetNumber}`);
        
        // Check which city it's in
        let baseCoords: Coordinates | null = null;
        let cityName = '';
        
        if (addressLower.includes('sankt') || addressLower.includes('peterburg') || addressLower.includes('питер') || addressLower.includes('spb')) {
          baseCoords = { lat: 59.9343, lng: 30.3351 };
          cityName = 'Saint Petersburg';
        } else if (addressLower.includes('москва') || addressLower.includes('moscow')) {
          baseCoords = { lat: 55.7558, lng: 37.6173 };
          cityName = 'Moscow';
        } else if (addressLower.includes('казань') || addressLower.includes('kazan')) {
          baseCoords = { lat: 55.7961, lng: 49.1064 };
          cityName = 'Kazan';
        }
        
        if (baseCoords) {
          // Add small variations based on street number
          const streetNum = parseInt(streetNumber) || 1;
          const variation = (streetNum % 100) / 10000;
          
          const coords = {
            lat: baseCoords.lat + variation,
            lng: baseCoords.lng - variation
          };
          
          console.log(`📍 [${requestId}] Using street-number adjusted coordinates in ${cityName}: ${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`);
          console.log(`⏱️ [${requestId}] Geocoding time: ${Date.now() - startTime}ms`);
          
          setGeocodingResults(prev => ({
            ...prev,
            [type]: { 
              status: 'success', 
              method: 'Street Number',
              accuracy: 'low'
            }
          }));
          
          return coords;
        }
      }

      // ============================================
      // OPTION 5: City detection from address
      // ============================================
      console.log(`📍 [${requestId}] Trying city detection...`);
      
      for (const [cityName, coords] of Object.entries(CITY_COORDINATES)) {
        if (addressLower.includes(cityName)) {
          console.log(`📍 [${requestId}] Detected city "${cityName}", using coordinates: ${coords.lat},${coords.lng}`);
          console.log(`⏱️ [${requestId}] Geocoding time: ${Date.now() - startTime}ms`);
          
          setGeocodingResults(prev => ({
            ...prev,
            [type]: { 
              status: 'success', 
              method: 'City Detection',
              accuracy: 'low'
            }
          }));
          
          return coords;
        }
      }

      // ============================================
      // OPTION 6: Ultimate fallback
      // ============================================
      console.warn(`⚠️ [${requestId}] All geocoding attempts failed for ${type} address`);
      console.warn(`⚠️ [${requestId}] Address was: "${cleanAddress.substring(0, 100)}${cleanAddress.length > 100 ? '...' : ''}"`);
      
      const fallback = getFallbackCoordinates('all_failed');
      
      setGeocodingResults(prev => ({
        ...prev,
        [type]: { 
          status: 'error', 
          method: 'Fallback',
          accuracy: 'very low'
        }
      }));
      
      return fallback;
      
    } catch (error: any) {
      console.error(`💥 [${requestId}] Critical geocoding error:`, error.message);
      
      setGeocodingResults(prev => ({
        ...prev,
        [type]: { 
          status: 'error', 
          method: 'Error',
          accuracy: 'very low'
        }
      }));
      
      return getFallbackCoordinates('error');
    }
  }, []);

  // Helper function for fallback coordinates
  const getFallbackCoordinates = (reason: string): Coordinates => {
    console.log(`📍 Using fallback coordinates (reason: ${reason}): 59.9343,30.3351 (St. Petersburg center)`);
    return { lat: 59.9343, lng: 30.3351 };
  };

  // Geocode both addresses when they change
  useEffect(() => {
    const geocodeAddresses = async () => {
      if (!formData.pickupAddress || !formData.deliveryAddress) {
        setPickupCoordinates(null);
        setDeliveryCoordinates(null);
        setGeocodingResults({
          pickup: { status: 'idle' },
          delivery: { status: 'idle' }
        });
        return;
      }

      setGeocodingInProgress(true);
      
      try {
        const [pickupResult, deliveryResult] = await Promise.all([
          geocodeAddress(formData.pickupAddress, 'pickup'),
          geocodeAddress(formData.deliveryAddress, 'delivery')
        ]);

        if (pickupResult) {
          setPickupCoordinates(pickupResult);
        }

        if (deliveryResult) {
          setDeliveryCoordinates(deliveryResult);
        }

      } catch (error) {
        console.error('Error geocoding addresses:', error);
      } finally {
        setGeocodingInProgress(false);
      }
    };

    const timeoutId = setTimeout(() => {
      geocodeAddresses();
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [formData.pickupAddress, formData.deliveryAddress, geocodeAddress]);

  // Memoized function to get vehicle type
  const getVehicleType = useCallback((weight: string, volume: string) => {
    const weightNum = parseFloat(weight) || 0;
    const volumeNum = parseFloat(volume) || 0;
    
    if (weightNum <= 25 && volumeNum <= 1) return 'motorbike';
    if (weightNum <= 500 && volumeNum <= 80) return 'medium_truck';
    if (weightNum <= 100 && volumeNum <= 10) return 'small_van';
    return 'large_truck';
  }, []);

  // Function to fetch available drivers
  const fetchAvailableDrivers = useCallback(async (
    formData: BookingForm, 
    priceData: PriceResponse | null,
    forceFetch: boolean = false
  ) => {
    const currentKey = `${formData.pickupAddress}-${formData.weight}-${formData.volume}-${formData.urgency}`;
    const lastKey = `${lastFetchedFormDataRef.current.pickupAddress}-${lastFetchedFormDataRef.current.weight}-${lastFetchedFormDataRef.current.volume}-${lastFetchedFormDataRef.current.urgency}`;
    
    if (currentKey === lastKey && drivers.length > 0 && !forceFetch) {
      return;
    }
    
    const token = getAuthToken();
    
    if (!token) {
      toast.error(t('customer.booking.login_required'));
      return;
    }

    lastFetchedFormDataRef.current = {
      pickupAddress: formData.pickupAddress,
      weight: formData.weight,
      volume: formData.volume,
      urgency: formData.urgency
    };

    setLoadingDrivers(true);
    
    try {
      const response = await fetch('http://localhost:3002/api/drivers/match', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickupAddress: formData.pickupAddress,
          weight: parseFloat(formData.weight) || 1,
          volume: parseFloat(formData.volume) || 0.1,
          vehicleType: getVehicleType(formData.weight, formData.volume),
          urgency: formData.urgency,
          maxDistance: 50
        }),
      });

      if (!response.ok) {
        throw new Error(`Drivers API error: ${response.status}`);
      }

      const data: DriversResponse = await response.json();
      
      if (data.success && data.data && data.data.length > 0) {
        setDrivers(data.data.slice(0, 4));
        toast.success(t('customer.booking.drivers_found', { count: data.count }));
      } else {
        setDrivers([]);
        toast.info(t('customer.booking.no_drivers_available'));
      }
      
    } catch (error: any) {
      console.error('Error fetching drivers:', error);
      setDrivers([]);
      
      if (error.message.includes('401')) {
        toast.error(t('customer.booking.session_expired'));
      } else if (error.message.includes('Failed to fetch')) {
        toast.error(t('customer.booking.driver_service_error'));
      } else {
        toast.error(t('customer.booking.failed_fetch_drivers'));
      }
    } finally {
      setLoadingDrivers(false);
    }
  }, [getVehicleType, t, drivers.length]);

  const formatRating = (rating: number) => {
    if (!rating || rating === 0) return '0.0';
    return rating.toFixed(1);
  };

  // Calculate price
  const calculatePrice = useCallback(
    debounce(async (formData: BookingForm, forceCalculate: boolean = false) => {
      if (!formData.pickupAddress || !formData.deliveryAddress || 
          !formData.category || !formData.weight || !formData.volume) {
        setPriceData(null);
        setDrivers([]);
        setSelectedDriver(null);
        return;
      }

      const currentKey = JSON.stringify({
        pickup: formData.pickupAddress,
        delivery: formData.deliveryAddress,
        category: formData.category,
        weight: formData.weight,
        volume: formData.volume,
        urgency: formData.urgency,
        fragile: formData.fragile,
        refrigerated: formData.refrigerated,
        oversized: formData.oversized,
        hazardous: formData.hazardous
      });

      if (currentKey === lastFetchedPriceDataRef.current && !forceCalculate) {
        return;
      }

      setLoading(true);
      
      try {
        const response = await fetch('http://localhost:8000/api/calculate-price', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pickup_address: formData.pickupAddress,
            delivery_address: formData.deliveryAddress,
            category: formData.category,
            weight_kg: parseFloat(formData.weight) || 1,
            volume_m3: parseFloat(formData.volume) || 0.1,
            urgency: formData.urgency,
            fragile: formData.fragile,
            refrigerated: formData.refrigerated,
            oversized: formData.oversized,
            hazardous: formData.hazardous
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data: PriceResponse = await response.json();
        
        if (data.success) {
          setPriceData(data);
          lastFetchedPriceDataRef.current = currentKey;
          toast.success(t('customer.booking.price_calculated_success'));
          fetchAvailableDrivers(formData, data, true);
        } else {
          setPriceData(null);
          setDrivers([]);
          lastFetchedPriceDataRef.current = '';
          toast.error(data.error || t('customer.booking.price_calculation_failed'));
        }
        
      } catch (error: any) {
        console.error('Error calculating price:', error);
        setPriceData(null);
        setDrivers([]);
        lastFetchedPriceDataRef.current = '';
        toast.error(t('customer.booking.service_connection_failed'));
      } finally {
        setLoading(false);
      }
    }, 1000),
    [fetchAvailableDrivers, t]
  );

  // Update calculation when form data changes
  useEffect(() => {
    calculatePrice(formData);
  }, [formData, calculatePrice]);

  const handleInputChange = (field: keyof BookingForm, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field !== 'fragile' && field !== 'refrigerated' && field !== 'oversized' && field !== 'hazardous') {
      setSelectedDriver(null);
      setExpandedDriver(null);
    }
  };

  const handleDriverSelect = (driverId: string) => {
    setSelectedDriver(driverId);
    toast.success(t('customer.booking.driver_selected'));
  };

  const handleSubmit = async () => {
    if (!priceData) {
      toast.error(t('common.fill_all_fields'));
      return;
    }
    
    if (!selectedDriver) {
      toast.error(t('customer.booking.select_driver'));
      return;
    }

    // Always create order data
    let finalPickupCoords = pickupCoordinates || getFallbackCoordinates('no_coords');
    let finalDeliveryCoords = deliveryCoordinates || getFallbackCoordinates('no_coords');

    console.log('📍 Final coordinates for order:', {
      pickup: finalPickupCoords,
      delivery: finalDeliveryCoords
    });

    // Get order data
    const orderData = createOrderData(finalPickupCoords, finalDeliveryCoords);
    console.log('📦 Generated Order Data:', orderData);
    setOrderData(orderData);
    
    // Show preview modal
    setShowOrderPreview(true);
  };

  // Handle final order confirmation
  const handleConfirmOrder = async () => {
    if (!orderData) return;
    
    setIsCreatingOrder(true);
    try {
      await createOrder(orderData);
      setShowOrderPreview(false);
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // Create order data structure
  const createOrderData = (pickupCoords: Coordinates, deliveryCoords: Coordinates) => {
    const selectedDriverData = drivers.find(d => d.driverId === selectedDriver);
    const vehicle = selectedDriverData?.vehicles[0];
    const currentUser = getCurrentUser();
    
    const getUrgencyLabel = () => {
      switch(formData.urgency) {
        case 'standard': return t('customer.booking.urgency_standard');
        case 'urgent': return t('customer.booking.urgency_urgent');
        case 'scheduled': return t('customer.booking.urgency_scheduled');
        default: return formData.urgency;
      }
    };

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();

    return {
      // Order metadata
      orderId,
      status: 'pending',
      createdAt,
      lastUpdated: createdAt,

      // Customer information - FIXED: Use phone from driver data or current user
      customerInfo: {
        id: currentUser?.id || 'guest',
        name: currentUser ? `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.email || 'Guest User' : 'Guest User',
        email: currentUser?.email || 'guest@example.com',
        phone: currentUser?.phone || selectedDriverData?.user.phone || t('customer.booking.not_available'),
        userType: currentUser?.userType || 'customer'
      },

      // Location information
      locations: {
        pickup: {
          address: formData.pickupAddress,
          coordinates: pickupCoords,
          geocoded: true,
          geocodingMethod: geocodingResults.pickup.method,
          accuracy: geocodingResults.pickup.accuracy
        },
        delivery: {
          address: formData.deliveryAddress,
          coordinates: deliveryCoords,
          geocoded: true,
          geocodingMethod: geocodingResults.delivery.method,
          accuracy: geocodingResults.delivery.accuracy
        },
        distance: {
          km: priceData?.distance_km || 0,
          miles: priceData?.distance_km ? priceData.distance_km * 0.621371 : 0
        }
      },

      // Package information
      packageDetails: {
        category: formData.category,
        categoryLabel: getTranslatedCategoryLabel(formData.category),
        weight: {
          value: parseFloat(formData.weight) || 0,
          unit: 'kg'
        },
        volume: {
          value: parseFloat(formData.volume) || 0,
          unit: 'm³'
        },
        urgency: formData.urgency,
        urgencyLabel: getUrgencyLabel()
      },

      // Special requirements
      specialRequirements: {
        fragile: formData.fragile,
        refrigerated: formData.refrigerated,
        oversized: formData.oversized,
        hazardous: formData.hazardous,
        requirementsList: [
          ...(formData.fragile ? ['fragile'] : []),
          ...(formData.refrigerated ? ['refrigerated'] : []),
          ...(formData.oversized ? ['oversized'] : []),
          ...(formData.hazardous ? ['hazardous'] : [])
        ]
      },

      // Driver information
      driverInfo: selectedDriverData ? {
        id: selectedDriverData.userId,
        driverId: selectedDriverData.driverId,
        userId: selectedDriverData.userId,
        name: `${selectedDriverData.user.firstName} ${selectedDriverData.user.lastName}`,
        phone: selectedDriverData.user.phone,
        email: selectedDriverData.user.email,
        rating: selectedDriverData.rating || 0,
        matchScore: selectedDriverData.matchScore || 0,
        suitability: selectedDriverData.suitability || '',
        estimatedArrival: selectedDriverData.estimatedArrival || '15'
      } : null,

      // Vehicle information
      vehicleInfo: vehicle ? {
        type: vehicle.type,
        typeFormatted: formatVehicleType(vehicle.type),
        make: vehicle.make,
        model: vehicle.model,
        licensePlate: vehicle.licensePlate,
        capacity: {
          maxWeight: vehicle.maxWeight,
          maxVolume: vehicle.maxVolume,
          unit: { weight: 'kg', volume: 'm³' }
        },
        imageUrl: vehicle.imageUrl,
        imageError: imageErrors[`${selectedDriverData?.driverId}-0`] || false
      } : null,

      // Price information
      pricing: {
        estimatedPrice: {
          usd: priceData?.price_usd || 0,
          rub: priceData?.price_rub || 0,
          formatted: {
            usd: `$${priceData?.price_usd.toFixed(2) || '0.00'}`,
            rub: `₽${priceData?.price_rub.toFixed(2) || '0.00'}`
          }
        },
        confidenceInterval: {
          low: priceData?.confidence_interval_low || 0,
          high: priceData?.confidence_interval_high || 0,
          formatted: priceData ? 
            `$${(priceData.confidence_interval_low / 90).toFixed(2)} - $${(priceData.confidence_interval_high / 90).toFixed(2)}` :
            t('customer.booking.not_available')
        },
        currency: 'USD',
        baseCurrency: 'RUB'
      },

      // Timing information
      timing: {
        estimatedDuration: {
          minutes: priceData?.duration_minutes || 0,
          text: priceData?.duration_text || '',
          formatted: priceData?.duration_text || t('customer.booking.not_available')
        },
        pickupTime: {
          estimated: new Date().toISOString(),
          driverArrival: selectedDriverData?.estimatedArrival ? 
            `${selectedDriverData.estimatedArrival} ${t('units.minutes')}` : t('customer.booking.not_available')
        },
        deliveryTime: {
          estimated: new Date(Date.now() + (priceData?.duration_minutes || 30) * 60000).toISOString(),
          scheduled: new Date(Date.now() + (priceData?.duration_minutes || 30) * 60000).toISOString()
        },
        urgencyLevel: formData.urgency,
        serviceHours: '24/7'
      },

      // System information
      systemInfo: {
        geocodingStatus: {
          pickup: geocodingResults.pickup.status,
          delivery: geocodingResults.delivery.status
        },
        calculationTimestamp: priceData?.timestamp || new Date().toISOString(),
        apiVersion: '1.0',
        source: 'customer-booking-form'
      },

      // Additional metadata
      metadata: {
        geocodingAttempts: 1,
        driverSelectionTime: new Date().toISOString(),
        userAgent: navigator.userAgent,
        platform: 'web'
      }
    };
  };

  // Format date for display
  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return t('common.invalid_date');
      return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return t('common.invalid_date');
    }
  };

  // Send order to order-service
  const createOrder = async (orderData: any) => {
    try {
      const token = getAuthToken();

      console.log('📦 Sending Order Data to Order Service:', JSON.stringify(orderData, null, 2));

      // Use the orderApi instead of direct fetch
      const response = await orderApi.createOrder(orderData);

      if (response.success) {
        toast.success(t('customer.booking.order_created'));
        console.log('✅ Order Created Successfully!');
        console.log('📊 Order ID:', orderData.orderId);
        console.log('📍 Pickup Coordinates:', orderData.locations.pickup.coordinates);
        console.log('📍 Delivery Coordinates:', orderData.locations.delivery.coordinates);
        console.log('💰 Price:', orderData.pricing.estimatedPrice.formatted?.usd);
        return response;
      } else {
        toast.error(response.error || t('customer.booking.order_creation_failed'));
        return null;
      }

    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error(t('customer.booking.order_service_error'));
      return null;
    }
  };

  const getCurrentTimePlusMinutes = (minutes: number) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatVehicleType = (type: string) => {
    if (!type) return t('customer.booking.not_available');
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleImageError = (driverId: string, vehicleIndex: number = 0) => {
    setImageErrors(prev => ({
      ...prev,
      [`${driverId}-${vehicleIndex}`]: true
    }));
  };

  const handleRetryImage = (driverId: string, vehicleIndex: number = 0) => {
    setImageErrors(prev => ({
      ...prev,
      [`${driverId}-${vehicleIndex}`]: false
    }));
  };

  const VehicleImage = ({ driver, isExpanded = false }: { driver: Driver, isExpanded?: boolean }) => {
    const vehicle = driver.vehicles[0];
    const imageKey = `${driver.driverId}-0`;
    const hasError = imageErrors[imageKey];
    
    if (!vehicle) {
      return (
        <div className={`w-full ${isExpanded ? 'h-40' : 'h-full'} flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200`}>
          <Car className={`${isExpanded ? 'h-16 w-16' : 'h-8 w-8'} text-gray-600`} />
        </div>
      );
    }

    const imageUrl = vehicle.imageUrl;
    const isValidUrl = imageUrl && imageUrl.startsWith('http');
    
    if (!isValidUrl || hasError) {
      return (
        <div className={`w-full ${isExpanded ? 'h-40' : 'h-full'} flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-cyan-100`}>
          {hasError && (
            <AlertTriangle className={`${isExpanded ? 'h-10 w-10' : 'h-6 w-6'} text-red-400 mb-2`} />
          )}
          <Car className={`${isExpanded ? 'h-12 w-12' : 'h-8 w-8'} text-blue-600 mb-2`} />
          <span className={`text-center ${isExpanded ? 'text-sm' : 'text-xs'} font-medium text-gray-700`}>
            {formatVehicleType(vehicle.type)}
          </span>
          {isExpanded && (
            <span className="text-xs text-gray-500 mt-1">
              {vehicle.make} {vehicle.model}
            </span>
          )}
          {hasError && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRetryImage(driver.driverId, 0);
              }}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              {t('customer.booking.retry')}
            </button>
          )}
        </div>
      );
    }

    return (
      <>
        <img 
          src={imageUrl}
          alt={`${vehicle.make} ${vehicle.model}`}
          className={`w-full ${isExpanded ? 'h-40' : 'h-full'} object-cover`}
          onError={() => handleImageError(driver.driverId, 0)}
          crossOrigin="anonymous"
        />
      </>
    );
  };

  const getTranslatedCategoryLabel = (value: string) => {
    switch(value) {
      case 'documents':
        return t('customer.booking.category_documents');
      case 'furniture':
        return t('customer.booking.category_furniture');
      case 'construction':
        return t('customer.booking.category_construction');
      case 'food':
        return t('customer.booking.category_food');
      case 'electronics':
        return t('customer.booking.category_electronics');
      case 'other':
        return t('customer.booking.category_other');
      default:
        return value;
    }
  };

  // Geocoding status indicator
  const GeocodingStatus = () => {
    if (!formData.pickupAddress || !formData.deliveryAddress) {
      return null;
    }

    const pickupStatus = geocodingResults.pickup.status;
    const deliveryStatus = geocodingResults.delivery.status;
    
    if (geocodingInProgress) {
      return (
        <div className="flex items-center text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm">
            {t('customer.booking.getting_precise_coordinates')}
          </span>
        </div>
      );
    }

    const anyError = pickupStatus === 'error' || deliveryStatus === 'error';

    if (anyError) {
      return (
        <div className="flex items-center text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
          <AlertTriangle className="h-4 w-4 mr-2" />
          <span className="text-sm">
            {t('customer.booking.using_approximate_coordinates')}
          </span>
        </div>
      );
    }

    return null;
  };

  // Coordinate display for each address
  const CoordinateDisplay = ({ type }: { type: 'pickup' | 'delivery' }) => {
    const coords = type === 'pickup' ? pickupCoordinates : deliveryCoordinates;
    const status = geocodingResults[type].status;
    const method = geocodingResults[type].method;
    const accuracy = geocodingResults[type].accuracy;
    
    if (!coords) return null;
    
    const getAccuracyColor = () => {
      switch(accuracy) {
        case 'high': return 'text-green-600';
        case 'medium': return 'text-blue-600';
        case 'low': return 'text-amber-600';
        default: return 'text-gray-600';
      }
    };
    
    const getAccuracyIcon = () => {
      switch(accuracy) {
        case 'high': return <CheckCircle className="h-3 w-3" />;
        case 'medium': return <Info className="h-3 w-3" />;
        case 'low': return <AlertTriangle className="h-3 w-3" />;
        default: return <AlertCircle className="h-3 w-3" />;
      }
    };

    return null;
  };

  // Price display component
  const PriceDisplay = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center space-x-2 p-4 bg-blue-50 rounded-lg">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-blue-600">
            {t('customer.booking.calculating')}
          </span>
        </div>
      );
    }

    if (priceData && priceData.success) {
      return (
        <div className="space-y-3 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">
                {t('customer.booking.estimated_price')}
              </div>
              <div className="text-3xl font-bold text-green-700">
                ${priceData.price_usd.toFixed(2)}
              </div>
              <div className="text-sm text-gray-500">
                ₽{priceData.price_rub.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">
                {t('customer.booking.delivery_distance')}
              </div>
              <div className="text-lg font-semibold text-gray-800">
                {priceData.distance_km.toFixed(1)} {t('units.km')}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <div>
                <div className="font-medium">{priceData.distance_km.toFixed(1)} {t('units.km')}</div>
                <div className="text-gray-500">
                  {t('common.distance')}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <div>
                <div className="font-medium">{priceData.duration_text}</div>
                <div className="text-gray-500">
                  {t('customer.booking.estimated_time')}
                </div>
              </div>
            </div>
          </div>
          
          <div className="pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              {t('customer.booking.confidence_interval', {
                low: (priceData.confidence_interval_low / 90).toFixed(2),
                high: (priceData.confidence_interval_high / 90).toFixed(2)
              })}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center">
        <div className="text-gray-500">
          {t('customer.booking.fill_all_fields_to_see_price')}
        </div>
      </div>
    );
  };

  // Drivers display component
  const DriversDisplay = () => {
    if (loadingDrivers) {
      return (
        <div className="flex items-center justify-center space-x-2 p-4 bg-blue-50 rounded-lg">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-blue-600">
            {t('customer.booking.finding_drivers')}
          </span>
        </div>
      );
    }

    if (drivers.length === 0 && priceData) {
      return (
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-center">
          <div className="text-yellow-700">
            {t('customer.booking.no_drivers_available')}
          </div>
        </div>
      );
    }

    if (drivers.length > 0) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                {t('customer.booking.available_drivers')}
              </h3>
              <p className="text-sm text-gray-600">
                {t('customer.booking.select_driver_description')}
              </p>
            </div>
            <Badge variant="outline" className="bg-blue-50">
              {drivers.length} {t('customer.booking.drivers_count')}
            </Badge>
          </div>
          
          <div className="space-y-3">
            {drivers.map((driver) => {
              const vehicle = driver.vehicles[0];
              const minutes = parseInt(driver.estimatedArrival) || 15;
              const isSelected = selectedDriver === driver.driverId;
              const isExpanded = expandedDriver === driver.driverId;
              
              return (
                <div 
                  key={driver.driverId}
                  className={`rounded-lg border transition-all duration-200 ${
                    isSelected 
                      ? 'border-green-500 ring-2 ring-green-200 bg-green-50' 
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                  } ${
                    isExpanded ? 'bg-blue-50' : ''
                  }`}
                >
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedDriver(
                      isExpanded ? null : driver.driverId
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="relative group">
                          <div className={`${isSelected ? 'w-20 h-20' : 'w-16 h-16'} rounded-lg overflow-hidden border-2 ${isSelected ? 'border-green-400 shadow-sm' : 'border-gray-200'} relative`}>
                            <VehicleImage driver={driver} />
                          </div>
                          
                          {isSelected && (
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-semibold text-gray-800">
                              {driver.user.firstName} {driver.user.lastName}
                            </h4>
                            {driver.rating > 0 && (
                              <div className="flex items-center text-yellow-500 bg-yellow-50 px-1.5 py-0.5 rounded-full">
                                <Star className="h-3 w-3 fill-current" />
                                <span className="text-xs ml-0.5 font-medium">{formatRating(driver.rating)}</span>
                              </div>
                            )}
                            <Badge variant={
                              driver.suitability === 'excellent' ? 'default' :
                              driver.suitability === 'good' ? 'secondary' : 'outline'
                            } className="text-xs">
                              {t(`customer.booking.suitability.${driver.suitability}`)}
                            </Badge>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-600">
                            <div className="flex items-center bg-gray-50 px-2 py-1 rounded">
                              <Car className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
                              <span className="font-medium capitalize">{formatVehicleType(vehicle?.type || '')}</span>
                            </div>
                            <div className="flex items-center bg-gray-50 px-2 py-1 rounded">
                              <Clock className="h-3.5 w-3.5 mr-1.5 text-green-500" />
                              <span className="font-medium">
                                {t('customer.booking.arrives_by_time')} {getCurrentTimePlusMinutes(minutes)}
                              </span>
                            </div>
                            <div className="flex items-center bg-gray-50 px-2 py-1 rounded">
                              <Trophy className="h-3.5 w-3.5 mr-1.5 text-purple-500" />
                              <span className="font-medium">
                                {driver.matchScore}{t('customer.booking.match_score')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end space-y-1">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                        <div className="text-xs text-gray-500 text-right">
                          {driver.distanceInfo?.distance?.text || t('customer.booking.not_available')} {t('customer.booking.distance_away')}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-200 pt-4">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-semibold text-gray-700 mb-3 flex items-center">
                              <User className="h-4 w-4 mr-2 text-blue-600" />
                              {t('customer.booking.driver_information')}
                            </h5>
                            <div className="space-y-3 text-sm bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">{t('customer.booking.name')}:</span>
                                <span className="font-medium text-gray-800">{driver.user.firstName} {driver.user.lastName}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">{t('customer.booking.phone')}:</span>
                                <span className="font-medium text-gray-800">{driver.user.phone}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">{t('customer.booking.rating')}:</span>
                                <div className="flex items-center">
                                  <Star className="h-3 w-3 fill-current text-yellow-500 mr-1" />
                                  <span className="font-medium text-gray-800">{driver.rating > 0 ? formatRating(driver.rating) : t('customer.booking.no_ratings')}</span>
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">{t('customer.booking.suitability')}:</span>
                                <Badge variant={
                                  driver.suitability === 'excellent' ? 'default' :
                                  driver.suitability === 'good' ? 'secondary' : 'outline'
                                } className="font-medium">
                                  {t(`customer.booking.suitability.${driver.suitability}`)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-semibold text-gray-700 mb-3 flex items-center">
                              <Car className="h-4 w-4 mr-2 text-green-600" />
                              {t('customer.booking.vehicle_information')}
                            </h5>
                            <div className="space-y-3 text-sm bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                              <div className="mb-3">
                                <div className="w-full rounded-lg overflow-hidden border border-gray-200 shadow-sm relative group">
                                  <VehicleImage driver={driver} isExpanded={true} />
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">{t('customer.booking.type')}:</span>
                                    <span className="font-medium text-gray-800 capitalize">{formatVehicleType(vehicle?.type || '')}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">{t('customer.booking.model')}:</span>
                                    <span className="font-medium text-gray-800">{vehicle?.make || ''} {vehicle?.model || ''}</span>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">{t('customer.booking.license')}:</span>
                                    <span className="font-medium text-gray-800">{vehicle?.licensePlate || t('customer.booking.not_available')}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">{t('customer.booking.capacity')}:</span>
                                    <span className="font-medium text-gray-800">{vehicle?.maxWeight || 0}kg, {vehicle?.maxVolume || 0}m³</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-semibold text-gray-700 mb-3 flex items-center">
                              <MapPin className="h-4 w-4 mr-2 text-red-600" />
                              {t('customer.booking.distance_information')}
                            </h5>
                            <div className="space-y-3 text-sm bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                              <div className="space-y-3">
                                <div className="bg-gradient-to-r from-blue-50 to-gray-50 p-3 rounded-lg border border-blue-100">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      <MapPin className="h-4 w-4 text-blue-600 mr-2" />
                                      <div>
                                        <div className="text-xs text-gray-500">
                                          {t('customer.booking.distance_to_pickup')}
                                        </div>
                                        <div className="font-semibold text-gray-800">{driver.distanceInfo?.distance?.text || t('customer.booking.not_available')}</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="bg-gradient-to-r from-green-50 to-gray-50 p-3 rounded-lg border border-green-100">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      <Clock className="h-4 w-4 text-green-600 mr-2" />
                                      <div>
                                        <div className="text-xs text-gray-500">
                                          {t('customer.booking.time_to_pickup')}
                                        </div>
                                        <div className="font-semibold text-gray-800">{driver.distanceInfo?.duration?.text || t('customer.booking.not_available')}</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="bg-gradient-to-r from-purple-50 to-gray-50 p-3 rounded-lg border border-purple-100">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      <Calendar className="h-4 w-4 text-purple-600 mr-2" />
                                      <div>
                                        <div className="text-xs text-gray-500">
                                          {t('customer.booking.estimated_arrival_time')}
                                        </div>
                                        <div className="font-semibold text-gray-800">{getCurrentTimePlusMinutes(minutes)}</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 flex justify-end">
                        <Button
                          onClick={() => handleDriverSelect(driver.driverId)}
                          variant={isSelected ? "default" : "outline"}
                          size="lg"
                          className={`font-medium ${
                            isSelected 
                              ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-md' 
                              : 'border-green-500 text-green-600 hover:bg-green-50 hover:border-green-600 hover:text-green-700'
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check className="h-5 w-5 mr-2" />
                              {t('customer.booking.driver_selected_button')}
                            </>
                          ) : (
                            t('customer.booking.select_this_driver')
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {selectedDriver && (
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-green-700">
                  <Check className="h-5 w-5 mr-3 bg-green-100 p-1 rounded-full" />
                  <div>
                    <div className="font-semibold">
                      {t('customer.booking.driver_selected_message')}
                    </div>
                    <div className="text-sm text-green-600 mt-0.5">
                      {t('customer.booking.driver_waiting', { 
                        name: drivers.find(d => d.driverId === selectedDriver)?.user.firstName || t('common.driver') 
                      })}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="bg-white text-green-700 border-green-300">
                  <Clock className="h-3 w-3 mr-1" />
                  {t('customer.booking.ready_to_go')}
                </Badge>
              </div>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  // Order Preview Modal Component
  const OrderPreviewModal = () => {
    if (!orderData) return null;

    return (
      <Dialog open={showOrderPreview} onOpenChange={setShowOrderPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center text-2xl">
              <FileText className="h-6 w-6 mr-2 text-blue-600" />
              {t('customer.booking.order_preview')}
              <Badge className="ml-3" variant="outline">
                {t('customer.booking.order_id')}: {orderData.orderId?.substring(0, 12) || t('customer.booking.not_available')}...
              </Badge>
            </DialogTitle>
            <DialogDescription>
              {t('customer.booking.review_order_details')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Order Summary Banner */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg text-gray-800">{t('customer.booking.delivery_summary')}</h3>
                  <p className="text-sm text-gray-600">{t('customer.booking.all_details_verified')}</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-green-700">
                    {orderData.pricing?.estimatedPrice?.formatted?.usd || '$0.00'}
                  </div>
                  <div className="text-sm text-gray-500">
                    {orderData.pricing?.estimatedPrice?.formatted?.rub || '₽0.00'}
                  </div>
                </div>
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Customer Information */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <h4 className="font-semibold text-lg mb-3 flex items-center">
                    <User className="h-5 w-5 mr-2 text-blue-600" />
                    {t('customer.booking.customer_information')}
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-gray-500">{t('common.name')}:</span>
                      <span className="font-medium">{orderData.customerInfo?.name || t('customer.booking.not_available')}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-gray-500">{t('common.email')}:</span>
                      <span className="font-medium flex items-center">
                        <Mail className="h-4 w-4 mr-1 text-gray-400" />
                        {orderData.customerInfo?.email || t('customer.booking.not_available')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{t('common.phone')}:</span>
                      <span className="font-medium flex items-center">
                        <Phone className="h-4 w-4 mr-1 text-gray-400" />
                        {orderData.customerInfo?.phone || t('customer.booking.not_available')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Package Details */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <h4 className="font-semibold text-lg mb-3 flex items-center">
                    <Package className="h-5 w-5 mr-2 text-orange-600" />
                    {t('customer.booking.package_details')}
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-gray-500">{t('customer.booking.category')}:</span>
                      <Badge variant="outline">{orderData.packageDetails?.categoryLabel || t('customer.booking.not_available')}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-3 rounded">
                        <div className="flex items-center mb-1">
                          <Weight className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="text-gray-500">{t('common.weight')}</span>
                        </div>
                        <div className="font-semibold text-lg">{orderData.packageDetails?.weight?.value || 0} {t('units.kg')}</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <div className="flex items-center mb-1">
                          <Ruler className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="text-gray-500">{t('common.volume')}</span>
                        </div>
                        <div className="font-semibold text-lg">{orderData.packageDetails?.volume?.value || 0} {t('units.m3')}</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{t('customer.booking.urgency')}:</span>
                      <Badge variant={orderData.packageDetails?.urgency === 'urgent' ? 'destructive' : 'outline'}>
                        {orderData.packageDetails?.urgencyLabel || t('customer.booking.not_available')}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Location Details */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <h4 className="font-semibold text-lg mb-3 flex items-center">
                    <Navigation className="h-5 w-5 mr-2 text-green-600" />
                    {t('customer.booking.location_details')}
                  </h4>
                  <div className="space-y-4">
                    {/* Pickup Location */}
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                      <div className="flex items-start mb-2">
                        <div className="bg-blue-100 p-1.5 rounded-full mr-3">
                          <Home className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-800">{t('customer.booking.pickup_location')}</h5>
                          <p className="text-sm text-gray-600 mt-1">{orderData.locations?.pickup?.address || t('customer.booking.not_available')}</p>
                          {orderData.locations?.pickup?.coordinates && (
                            <div className="mt-2 text-xs text-gray-500 flex items-center">
                              <Globe className="h-3 w-3 mr-1" />
                              {t('customer.booking.coordinates')}: {orderData.locations.pickup.coordinates.lat?.toFixed(6) || t('customer.booking.not_available')}, {orderData.locations.pickup.coordinates.lng?.toFixed(6) || t('customer.booking.not_available')}
                            </div>
                          )}
                        </div>
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      </div>
                    </div>

                    {/* Delivery Location */}
                    <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                      <div className="flex items-start mb-2">
                        <div className="bg-green-100 p-1.5 rounded-full mr-3">
                          <MapPin className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-800">{t('customer.booking.delivery_location')}</h5>
                          <p className="text-sm text-gray-600 mt-1">{orderData.locations?.delivery?.address || t('customer.booking.not_available')}</p>
                          {orderData.locations?.delivery?.coordinates && (
                            <div className="mt-2 text-xs text-gray-500 flex items-center">
                              <Globe className="h-3 w-3 mr-1" />
                              {t('customer.booking.coordinates')}: {orderData.locations.delivery.coordinates.lat?.toFixed(6) || t('customer.booking.not_available')}, {orderData.locations.delivery.coordinates.lng?.toFixed(6) || t('customer.booking.not_available')}
                            </div>
                          )}
                        </div>
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      </div>
                    </div>

                    {/* Distance Information */}
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-500">{t('common.distance')}</div>
                          <div className="font-semibold">{orderData.locations?.distance?.km?.toFixed(1) || 0} {t('units.km')}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">{t('customer.booking.estimated_duration')}</div>
                          <div className="font-semibold">{orderData.timing?.estimatedDuration?.formatted || t('customer.booking.not_available')}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Driver & Vehicle Information */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <h4 className="font-semibold text-lg mb-3 flex items-center">
                    <Truck className="h-5 w-5 mr-2 text-purple-600" />
                    {t('customer.booking.driver_vehicle')}
                  </h4>
                  <div className="space-y-4">
                    {/* Driver Info */}
                    {orderData.driverInfo && (
                      <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                        <div className="bg-purple-100 p-2 rounded-full">
                          <User className="h-6 w-6 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <h5 className="font-semibold">{orderData.driverInfo.name}</h5>
                          <div className="flex items-center mt-1">
                            <Star className="h-4 w-4 text-yellow-500 mr-1" />
                            <span className="text-sm">{formatRating(orderData.driverInfo.rating || 0)}</span>
                            <span className="mx-2 text-gray-300">•</span>
                            <span className="text-sm text-gray-600">{orderData.driverInfo.matchScore || 0}% {t('customer.booking.match')}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <h4 className="font-semibold text-lg mb-3 flex items-center">
                <CreditCard className="h-5 w-5 mr-2 text-green-600" />
                {t('customer.booking.price_breakdown')}
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{t('customer.booking.estimated_price')}</div>
                    <div className="text-sm text-gray-500">{t('customer.booking.includes_fees')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-700">
                      {orderData.pricing?.estimatedPrice?.formatted?.usd || '$0.00'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {orderData.pricing?.estimatedPrice?.formatted?.rub || '₽0.00'}
                    </div>
                  </div>
                </div>
                
              </div>
            </div>

            {/* Raw JSON View */}
            <details className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <summary className="cursor-pointer font-medium text-gray-700 flex items-center">
                <Info className="h-4 w-4 mr-2" />
                {t('customer.booking.view_json')}
              </summary>
              <pre className="mt-3 p-3 bg-gray-900 text-gray-100 rounded text-xs overflow-auto max-h-60">
                {JSON.stringify(orderData, null, 2)}
              </pre>
            </details>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => setShowOrderPreview(false)}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleConfirmOrder}
              disabled={isCreatingOrder}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {isCreatingOrder ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('customer.booking.creating_order')}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {t('customer.booking.confirm_create_order')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <>
      <Card className="max-w-5xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Package className="mr-2 h-6 w-6" />
            {t('customer.booking.title')}
          </CardTitle>
          <p className="text-gray-600">
            {t('customer.booking.subtitle')}
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Geocoding Status */}
          <GeocodingStatus />

          {/* Price Display */}
          {PriceDisplay()}

          {/* Available Drivers */}
          {priceData && <DriversDisplay />}

          {/* Addresses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pickup" className="flex items-center">
                <MapPin className="h-4 w-4 mr-1" />
                {t('customer.booking.pickup_address')} *
              </Label>
              <Input
                id="pickup"
                placeholder={t('customer.booking.pickup_address_placeholder')}
                value={formData.pickupAddress}
                onChange={(e) => handleInputChange('pickupAddress', e.target.value)}
                className="h-10"
              />
              <CoordinateDisplay type="pickup" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery" className="flex items-center">
                <MapPin className="h-4 w-4 mr-1" />
                {t('customer.booking.delivery_address')} *
              </Label>
              <Input
                id="delivery"
                placeholder={t('customer.booking.delivery_address_placeholder')}
                value={formData.deliveryAddress}
                onChange={(e) => handleInputChange('deliveryAddress', e.target.value)}
                className="h-10"
              />
              <CoordinateDisplay type="delivery" />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">
              {t('customer.booking.item_category')} *
            </Label>
            <Select 
              value={formData.category} 
              onValueChange={(value) => handleInputChange('category', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('customer.booking.select_category')} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {getTranslatedCategoryLabel(cat.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Weight and Volume */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weight" className="flex items-center">
                <Weight className="h-4 w-4 mr-1" />
                {t('customer.booking.weight')} *
              </Label>
              <Input
                id="weight"
                type="number"
                min="0.1"
                step="0.1"
                placeholder={t('customer.booking.weight_placeholder')}
                value={formData.weight}
                onChange={(e) => handleInputChange('weight', e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="volume" className="flex items-center">
                <Ruler className="h-4 w-4 mr-1" />
                {t('customer.booking.volume')} *
              </Label>
              <Input
                id="volume"
                type="number"
                min="0.1"
                step="0.1"
                placeholder={t('customer.booking.volume_placeholder')}
                value={formData.volume}
                onChange={(e) => handleInputChange('volume', e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          {/* Urgency */}
          <div className="space-y-2">
            <Label htmlFor="urgency">
              {t('customer.booking.urgency')}
            </Label>
            <Select 
              value={formData.urgency} 
              onValueChange={(value) => handleInputChange('urgency', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">
                  {t('customer.booking.urgency_standard')}
                </SelectItem>
                <SelectItem value="urgent">
                  {t('customer.booking.urgency_urgent')}
                </SelectItem>
                <SelectItem value="scheduled">
                  {t('customer.booking.urgency_scheduled')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Special Requirements */}
          <div className="space-y-3">
            <Label>{t('customer.booking.special_requirements')}</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-gray-50">
                <Checkbox
                  id="fragile"
                  checked={formData.fragile}
                  onCheckedChange={(checked) => handleInputChange('fragile', checked === true)}
                />
                <Label htmlFor="fragile" className="text-sm cursor-pointer flex-1">
                  {t('customer.booking.fragile')}
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-gray-50">
                <Checkbox
                  id="refrigerated"
                  checked={formData.refrigerated}
                  onCheckedChange={(checked) => handleInputChange('refrigerated', checked === true)}
                />
                <Label htmlFor="refrigerated" className="text-sm cursor-pointer flex-1">
                  {t('customer.booking.refrigerated')}
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-gray-50">
                <Checkbox
                  id="oversized"
                  checked={formData.oversized}
                  onCheckedChange={(checked) => handleInputChange('oversized', checked === true)}
                />
                <Label htmlFor="oversized" className="text-sm cursor-pointer flex-1">
                  {t('customer.booking.oversized')}
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-gray-50">
                <Checkbox
                  id="hazardous"
                  checked={formData.hazardous}
                  onCheckedChange={(checked) => handleInputChange('hazardous', checked === true)}
                />
                <Label htmlFor="hazardous" className="text-sm cursor-pointer flex-1">
                  {t('customer.booking.hazardous')}
                </Label>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button 
            onClick={handleSubmit}
            className="w-full h-12 text-lg bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 shadow-md"
            disabled={loading || !priceData || !selectedDriver || geocodingInProgress}
          >
            {geocodingInProgress ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('customer.booking.getting_precise_coordinates')}
              </>
            ) : loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('customer.booking.calculating')}
              </>
            ) : priceData ? (
              selectedDriver ? (
                <>
                  <FileText className="mr-2 h-5 w-5" />
                  {t('customer.booking.review_book_delivery')}
                </>
              ) : (
                <>
                  <User className="mr-2 h-5 w-5" />
                  {t('customer.booking.select_driver_continue')}
                </>
              )
            ) : (
              t('customer.booking.fill_all_fields')
            )}
          </Button>

          <div className="text-center text-sm text-gray-500 pt-4">
            <p>{t('customer.booking.price_updates_automatically')}</p>
            <p className="text-xs mt-1">
              {t('customer.booking.ai_powered_prediction')}
            </p>
            <p className="text-xs mt-1">
              {t('customer.booking.precise_coordinates_automatically')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Order Preview Modal */}
      <OrderPreviewModal />
    </>
  );
}