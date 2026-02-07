import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { MapPin, Package, Weight, Ruler, Clock, DollarSign, Loader2, User, Star, Check, ChevronDown, ChevronUp, Car, Calendar, Trophy, Eye, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import debounce from 'lodash/debounce';
import { useLanguage } from './LanguageContext';
import { Badge } from "./ui/badge";
import { getAuthToken, getCurrentUser } from '../src/lib/api';

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

  // Check if user is customer
  useEffect(() => {
    const user = getCurrentUser();
    if (user && user.userType !== 'customer') {
      toast.error('Only customers can book deliveries');
    }
  }, []);

  // Загружаем категории при монтировании
  useEffect(() => {
    fetch('http://localhost:8000/api/categories')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch categories');
        return res.json();
      })
      .then(data => setCategories(data.categories))
      .catch(() => {
        // Fallback categories
        setCategories([
          { value: 'documents', label: t('customer.booking.category_documents') || 'Documents & Small Packages' },
          { value: 'furniture', label: t('customer.booking.category_furniture') || 'Furniture & Appliances' },
          { value: 'construction', label: t('customer.booking.category_construction') || 'Construction Materials' },
          { value: 'food', label: t('customer.booking.category_food') || 'Food & Beverages' },
          { value: 'electronics', label: t('customer.booking.category_electronics') || 'Electronics & Fragile Items' },
          { value: 'other', label: t('customer.booking.category_other') || 'Other' }
        ]);
      });
  }, [t]);

  // Функция для расчета стоимости
  const calculatePrice = useCallback(
    debounce(async (formData: BookingForm) => {
      // Проверяем обязательные поля
      if (!formData.pickupAddress || !formData.deliveryAddress || 
          !formData.category || !formData.weight || !formData.volume) {
        setPriceData(null);
        setDrivers([]);
        setSelectedDriver(null);
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
          toast.success(t('customer.booking.price_calculated_success') || 'Price calculated successfully!');
          // Fetch drivers after price calculation
          fetchAvailableDrivers(formData);
        } else {
          setPriceData(null);
          setDrivers([]);
          toast.error(data.error || t('customer.booking.price_calculation_failed') || 'Failed to calculate price');
        }
        
      } catch (error: any) {
        console.error('Error calculating price:', error);
        setPriceData(null);
        setDrivers([]);
        toast.error(t('customer.booking.service_connection_failed') || 'Failed to connect to pricing service');
      } finally {
        setLoading(false);
      }
    }, 1000), // Дебаунс 1 секунда
    [t]
  );

  // Функция для получения доступных водителей с использованием вашего API utilities
  const fetchAvailableDrivers = async (formData: BookingForm) => {
    const token = getAuthToken();
    
    if (!token) {
      toast.error('Please login first to book a delivery');
      return;
    }

    // Определяем vehicleType на основе категории и веса/объема
    const getVehicleType = () => {
      const weight = parseFloat(formData.weight) || 0;
      const volume = parseFloat(formData.volume) || 0;
      
      if (weight <= 25 && volume <= 1) return 'motorbike';
      if (weight <= 500 && volume <= 80) return 'medium_truck';
      if (weight <= 100 && volume <= 10) return 'small_van';
      return 'large_truck';
    };

    setLoadingDrivers(true);
    
    try {
      console.log('Fetching drivers with token:', token.substring(0, 20) + '...');
      
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
          vehicleType: getVehicleType(),
          urgency: formData.urgency,
          maxDistance: 50
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Drivers API error:', response.status, errorText);
        throw new Error(`Drivers API error: ${response.status}`);
      }

      const data: DriversResponse = await response.json();
      
      console.log('Drivers response:', data);
      
      if (data.success && data.data && data.data.length > 0) {
        // Debug: Log vehicle image URLs
        data.data.forEach((driver, index) => {
          console.log(`Driver ${index + 1} vehicle image:`, driver.vehicles[0]?.imageUrl);
        });
        
        setDrivers(data.data.slice(0, 4)); // Берем максимум 4 водителя
        toast.success(`Found ${data.count} available drivers`);
      } else {
        setDrivers([]);
        toast.info('No drivers available at the moment');
      }
      
    } catch (error: any) {
      console.error('Error fetching drivers:', error);
      setDrivers([]);
      
      // More specific error messages
      if (error.message.includes('401')) {
        toast.error('Session expired. Please login again.');
      } else if (error.message.includes('Failed to fetch')) {
        toast.error('Cannot connect to driver service. Please try again later.');
      } else {
        toast.error('Failed to fetch available drivers. Please try again.');
      }
    } finally {
      setLoadingDrivers(false);
    }
  };

  // Обновляем расчет при изменении данных формы
  useEffect(() => {
    calculatePrice(formData);
  }, [formData, calculatePrice]);

  const handleInputChange = (field: keyof BookingForm, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Сбрасываем выбор водителя при изменении формы
    if (field !== 'fragile' && field !== 'refrigerated' && field !== 'oversized' && field !== 'hazardous') {
      setSelectedDriver(null);
      setExpandedDriver(null);
    }
  };

  const handleDriverSelect = (driverId: string) => {
    setSelectedDriver(driverId);
    toast.success('Driver selected successfully!');
  };

  const handleSubmit = () => {
    if (!priceData) {
      toast.error(t('customer.booking.fill_all_fields') || 'Please fill all required fields');
      return;
    }
    
    if (!selectedDriver) {
      toast.error('Please select a driver to proceed');
      return;
    }
    
    // Здесь можно добавить логику создания заказа
    toast.success(
      t('customer.booking.ready_to_book', { price: priceData.price_usd.toFixed(2) }) || 
      `Ready to book! Estimated price: $${priceData.price_usd.toFixed(2)}`
    );
  };

  // Функция для получения временной метки
  const getCurrentTimePlusMinutes = (minutes: number) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Функция для форматирования типа транспортного средства
  const formatVehicleType = (type: string) => {
    if (!type) return 'N/A';
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Функция для обработки ошибок изображения
  const handleImageError = (driverId: string, vehicleIndex: number = 0) => {
    console.log(`Image error for driver ${driverId}, vehicle ${vehicleIndex}`);
    setImageErrors(prev => ({
      ...prev,
      [`${driverId}-${vehicleIndex}`]: true
    }));
  };

  // Функция для повторной попытки загрузки изображения
  const handleRetryImage = (driverId: string, vehicleIndex: number = 0) => {
    console.log(`Retrying image for driver ${driverId}, vehicle ${vehicleIndex}`);
    setImageErrors(prev => ({
      ...prev,
      [`${driverId}-${vehicleIndex}`]: false
    }));
  };

  // Функция для получения цвета градиента на основе типа транспортного средства
  const getVehicleGradient = (type: string) => {
    switch(type) {
      case 'motorbike':
        return 'from-orange-100 to-yellow-100';
      case 'small_van':
        return 'from-blue-100 to-cyan-100';
      case 'medium_truck':
        return 'from-green-100 to-emerald-100';
      case 'large_truck':
        return 'from-purple-100 to-pink-100';
      default:
        return 'from-gray-100 to-gray-200';
    }
  };

  // Функция для получения цвета иконки на основе типа транспортного средства
  const getVehicleIconColor = (type: string) => {
    switch(type) {
      case 'motorbike':
        return 'text-orange-600';
      case 'small_van':
        return 'text-blue-600';
      case 'medium_truck':
        return 'text-green-600';
      case 'large_truck':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  // Компонент для отображения изображения транспортного средства
  const VehicleImage = ({ driver, isExpanded = false }: { driver: Driver, isExpanded?: boolean }) => {
    const vehicle = driver.vehicles[0];
    const imageKey = `${driver.driverId}-0`;
    const hasError = imageErrors[imageKey];
    
    if (!vehicle) {
      return (
        <div className={`w-full ${isExpanded ? 'h-40' : 'h-full'} flex items-center justify-center bg-gradient-to-br ${getVehicleGradient('')}`}>
          <Car className={`${isExpanded ? 'h-16 w-16' : 'h-8 w-8'} ${getVehicleIconColor('')}`} />
        </div>
      );
    }

    const imageUrl = vehicle.imageUrl;
    const isValidUrl = imageUrl && imageUrl.startsWith('http');
    
    if (!isValidUrl || hasError) {
      return (
        <div className={`w-full ${isExpanded ? 'h-40' : 'h-full'} flex flex-col items-center justify-center bg-gradient-to-br ${getVehicleGradient(vehicle.type)}`}>
          {hasError && (
            <AlertTriangle className={`${isExpanded ? 'h-10 w-10' : 'h-6 w-6'} text-red-400 mb-2`} />
          )}
          <Car className={`${isExpanded ? 'h-12 w-12' : 'h-8 w-8'} ${getVehicleIconColor(vehicle.type)} mb-2`} />
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
              Retry
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
          onLoad={() => console.log('✅ Vehicle image loaded successfully:', imageUrl)}
          crossOrigin="anonymous"
        />
        {imageUrl && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(imageUrl, '_blank');
            }}
            className="absolute top-2 left-2 bg-black/70 text-white p-1.5 rounded-full hover:bg-black/90 transition opacity-0 group-hover:opacity-100"
            title="Open image in new tab"
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
        {imageUrl && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRetryImage(driver.driverId, 0);
            }}
            className="absolute top-2 right-2 bg-black/70 text-white p-1.5 rounded-full hover:bg-black/90 transition opacity-0 group-hover:opacity-100"
            title="Refresh image"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </>
    );
  };

  // Компонент отображения цены
  const PriceDisplay = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center space-x-2 p-4 bg-blue-50 rounded-lg">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-blue-600">
            {t('customer.booking.calculating') || 'Calculating price...'}
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
                {t('customer.booking.estimated_price') || 'Estimated Price'}
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
                Delivery distance
              </div>
              <div className="text-lg font-semibold text-gray-800">
                {priceData.distance_km.toFixed(1)} km
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <div>
                <div className="font-medium">{priceData.distance_km.toFixed(1)} km</div>
                <div className="text-gray-500">
                  {t('customer.booking.distance') || 'Distance'}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <div>
                <div className="font-medium">{priceData.duration_text}</div>
                <div className="text-gray-500">
                  {t('customer.booking.estimated_time') || 'Est. time'}
                </div>
              </div>
            </div>
          </div>
          
          <div className="pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              {t('customer.booking.confidence_interval', {
                low: (priceData.confidence_interval_low / 90).toFixed(2),
                high: (priceData.confidence_interval_high / 90).toFixed(2)
              }) || `Confidence interval: $${(priceData.confidence_interval_low / 90).toFixed(2)} - $${(priceData.confidence_interval_high / 90).toFixed(2)}`}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center">
        <div className="text-gray-500">
          {t('customer.booking.fill_all_fields_to_see_price') || 'Fill in all fields to see price estimate'}
        </div>
      </div>
    );
  };

  // Компонент отображения водителей
  const DriversDisplay = () => {
    if (loadingDrivers) {
      return (
        <div className="flex items-center justify-center space-x-2 p-4 bg-blue-50 rounded-lg">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-blue-600">
            Finding available drivers...
          </span>
        </div>
      );
    }

    if (drivers.length === 0 && priceData) {
      return (
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-center">
          <div className="text-yellow-700">
            No drivers available at the moment. Please try again later.
          </div>
        </div>
      );
    }

    if (drivers.length > 0) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Available Drivers</h3>
              <p className="text-sm text-gray-600">Select a driver for your delivery</p>
            </div>
            <Badge variant="outline" className="bg-blue-50">
              {drivers.length} available
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
                  {/* Driver Summary */}
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedDriver(
                      isExpanded ? null : driver.driverId
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="relative group">
                          {/* Small vehicle image when not selected */}
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
                                <span className="text-xs ml-0.5 font-medium">{driver.rating}</span>
                              </div>
                            )}
                            <Badge variant={
                              driver.suitability === 'excellent' ? 'default' :
                              driver.suitability === 'good' ? 'secondary' : 'outline'
                            } className="text-xs">
                              {driver.suitability}
                            </Badge>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-600">
                            <div className="flex items-center bg-gray-50 px-2 py-1 rounded">
                              <Car className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
                              <span className="font-medium capitalize">{formatVehicleType(vehicle?.type || '')}</span>
                            </div>
                            <div className="flex items-center bg-gray-50 px-2 py-1 rounded">
                              <Clock className="h-3.5 w-3.5 mr-1.5 text-green-500" />
                              <span className="font-medium">Arrives by {getCurrentTimePlusMinutes(minutes)}</span>
                            </div>
                            <div className="flex items-center bg-gray-50 px-2 py-1 rounded">
                              <Trophy className="h-3.5 w-3.5 mr-1.5 text-purple-500" />
                              <span className="font-medium">{driver.matchScore}% Match</span>
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
                          {driver.distanceInfo?.distance?.text || 'N/A'} away
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-200 pt-4">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Driver Details */}
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-semibold text-gray-700 mb-3 flex items-center">
                              <User className="h-4 w-4 mr-2 text-blue-600" />
                              Driver Information
                            </h5>
                            <div className="space-y-3 text-sm bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">Name:</span>
                                <span className="font-medium text-gray-800">{driver.user.firstName} {driver.user.lastName}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">Phone:</span>
                                <span className="font-medium text-gray-800">{driver.user.phone}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">Rating:</span>
                                <div className="flex items-center">
                                  <Star className="h-3 w-3 fill-current text-yellow-500 mr-1" />
                                  <span className="font-medium text-gray-800">{driver.rating > 0 ? driver.rating : 'No ratings yet'}</span>
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">Suitability:</span>
                                <Badge variant={
                                  driver.suitability === 'excellent' ? 'default' :
                                  driver.suitability === 'good' ? 'secondary' : 'outline'
                                } className="font-medium">
                                  {driver.suitability}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Vehicle Details */}
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-semibold text-gray-700 mb-3 flex items-center">
                              <Car className="h-4 w-4 mr-2 text-green-600" />
                              Vehicle Information
                            </h5>
                            <div className="space-y-3 text-sm bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                              {/* Larger vehicle image in expanded view */}
                              <div className="mb-3">
                                <div className="w-full rounded-lg overflow-hidden border border-gray-200 shadow-sm relative group">
                                  <VehicleImage driver={driver} isExpanded={true} />
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Type:</span>
                                    <span className="font-medium text-gray-800 capitalize">{formatVehicleType(vehicle?.type || '')}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Model:</span>
                                    <span className="font-medium text-gray-800">{vehicle?.make || ''} {vehicle?.model || ''}</span>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">License:</span>
                                    <span className="font-medium text-gray-800">{vehicle?.licensePlate || 'N/A'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Capacity:</span>
                                    <span className="font-medium text-gray-800">{vehicle?.maxWeight || 0}kg, {vehicle?.maxVolume || 0}m³</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Distance Information */}
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-semibold text-gray-700 mb-3 flex items-center">
                              <MapPin className="h-4 w-4 mr-2 text-red-600" />
                              Distance Information
                            </h5>
                            <div className="space-y-3 text-sm bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                              <div className="space-y-3">
                                <div className="bg-gradient-to-r from-blue-50 to-gray-50 p-3 rounded-lg border border-blue-100">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      <MapPin className="h-4 w-4 text-blue-600 mr-2" />
                                      <div>
                                        <div className="text-xs text-gray-500">Distance to pickup</div>
                                        <div className="font-semibold text-gray-800">{driver.distanceInfo?.distance?.text || 'N/A'}</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="bg-gradient-to-r from-green-50 to-gray-50 p-3 rounded-lg border border-green-100">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      <Clock className="h-4 w-4 text-green-600 mr-2" />
                                      <div>
                                        <div className="text-xs text-gray-500">Time to pickup</div>
                                        <div className="font-semibold text-gray-800">{driver.distanceInfo?.duration?.text || 'N/A'}</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="bg-gradient-to-r from-purple-50 to-gray-50 p-3 rounded-lg border border-purple-100">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      <Calendar className="h-4 w-4 text-purple-600 mr-2" />
                                      <div>
                                        <div className="text-xs text-gray-500">Estimated arrival time</div>
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
                      
                      {/* Select Button */}
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
                              Driver Selected
                            </>
                          ) : (
                            'Select This Driver'
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
                    <div className="font-semibold">Driver selected! Ready to book delivery.</div>
                    <div className="text-sm text-green-600 mt-0.5">
                      {drivers.find(d => d.driverId === selectedDriver)?.user.firstName} is waiting for your order
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="bg-white text-green-700 border-green-300">
                  <Clock className="h-3 w-3 mr-1" />
                  Ready to go
                </Badge>
              </div>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <Card className="max-w-5xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Package className="mr-2 h-6 w-6" />
          {t('customer.booking.title') || 'Delivery Price Calculator'}
        </CardTitle>
        <p className="text-gray-600">
          {t('customer.booking.subtitle') || 'Get instant price estimates for your delivery'}
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Price Display */}
        {PriceDisplay()}

        {/* Available Drivers */}
        {priceData && DriversDisplay()}

        {/* Addresses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pickup" className="flex items-center">
              <MapPin className="h-4 w-4 mr-1" />
              {t('customer.booking.pickup_address') || 'Pickup Address'} *
            </Label>
            <Input
              id="pickup"
              placeholder={t('customer.booking.pickup_address_placeholder') || 'Enter pickup address'}
              value={formData.pickupAddress}
              onChange={(e) => handleInputChange('pickupAddress', e.target.value)}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="delivery" className="flex items-center">
              <MapPin className="h-4 w-4 mr-1" />
              {t('customer.booking.delivery_address') || 'Delivery Address'} *
            </Label>
            <Input
              id="delivery"
              placeholder={t('customer.booking.delivery_address_placeholder') || 'Enter delivery address'}
              value={formData.deliveryAddress}
              onChange={(e) => handleInputChange('deliveryAddress', e.target.value)}
              className="h-10"
            />
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="category">
            {t('customer.booking.item_category') || 'Item Category'} *
          </Label>
          <Select 
            value={formData.category} 
            onValueChange={(value) => handleInputChange('category', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('customer.booking.select_category') || 'Select category'} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
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
              {t('customer.booking.weight') || 'Weight (kg)'} *
            </Label>
            <Input
              id="weight"
              type="number"
              min="0.1"
              step="0.1"
              placeholder={t('customer.booking.weight_placeholder') || 'e.g., 5.5'}
              value={formData.weight}
              onChange={(e) => handleInputChange('weight', e.target.value)}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="volume" className="flex items-center">
              <Ruler className="h-4 w-4 mr-1" />
              {t('customer.booking.volume') || 'Volume (m³)'} *
            </Label>
            <Input
              id="volume"
              type="number"
              min="0.1"
              step="0.1"
              placeholder={t('customer.booking.volume_placeholder') || 'e.g., 0.5'}
              value={formData.volume}
              onChange={(e) => handleInputChange('volume', e.target.value)}
              className="h-10"
            />
          </div>
        </div>

        {/* Urgency */}
        <div className="space-y-2">
          <Label htmlFor="urgency">
            {t('customer.booking.urgency') || 'Delivery Urgency'}
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
                {t('customer.booking.urgency_standard') || 'Standard (same day)'}
              </SelectItem>
              <SelectItem value="urgent">
                {t('customer.booking.urgency_urgent') || 'Urgent (within 2 hours)'}
              </SelectItem>
              <SelectItem value="scheduled">
                {t('customer.booking.urgency_scheduled') || 'Scheduled (next day)'}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Special Requirements */}
        <div className="space-y-3">
          <Label>{t('customer.booking.special_requirements') || 'Special Requirements'}</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-gray-50">
              <Checkbox
                id="fragile"
                checked={formData.fragile}
                onCheckedChange={(checked) => handleInputChange('fragile', checked === true)}
              />
              <Label htmlFor="fragile" className="text-sm cursor-pointer flex-1">
                {t('customer.booking.fragile') || 'Fragile items'}
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-gray-50">
              <Checkbox
                id="refrigerated"
                checked={formData.refrigerated}
                onCheckedChange={(checked) => handleInputChange('refrigerated', checked === true)}
              />
              <Label htmlFor="refrigerated" className="text-sm cursor-pointer flex-1">
                {t('customer.booking.refrigerated') || 'Refrigerated'}
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-gray-50">
              <Checkbox
                id="oversized"
                checked={formData.oversized}
                onCheckedChange={(checked) => handleInputChange('oversized', checked === true)}
              />
              <Label htmlFor="oversized" className="text-sm cursor-pointer flex-1">
                {t('customer.booking.oversized') || 'Oversized'}
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-gray-50">
              <Checkbox
                id="hazardous"
                checked={formData.hazardous}
                onCheckedChange={(checked) => handleInputChange('hazardous', checked === true)}
              />
              <Label htmlFor="hazardous" className="text-sm cursor-pointer flex-1">
                {t('customer.booking.hazardous') || 'Hazardous'}
              </Label>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <Button 
          onClick={handleSubmit}
          className="w-full h-12 text-lg bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 shadow-md"
          disabled={loading || !priceData || !selectedDriver}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('customer.booking.calculating') || 'Calculating...'}
            </>
          ) : priceData ? (
            selectedDriver ? (
              <>
                <Check className="mr-2 h-5 w-5" />
                {t('customer.booking.book_delivery', { amount: priceData.price_usd.toFixed(2) }) || `Book Delivery for $${priceData.price_usd.toFixed(2)}`}
              </>
            ) : (
              <>
                <User className="mr-2 h-5 w-5" />
                Select a driver to continue
              </>
            )
          ) : (
            t('customer.booking.fill_all_fields_to_book') || 'Fill all fields to see price'
          )}
        </Button>

        <div className="text-center text-sm text-gray-500 pt-4">
          <p>{t('customer.booking.price_updates_automatically') || 'Price updates automatically as you fill the form'}</p>
          <p className="text-xs mt-1">
            {t('customer.booking.ai_powered_prediction') || 'Using AI-powered delivery cost prediction with 81% accuracy'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}