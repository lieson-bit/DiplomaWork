import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { MapPin, Package, Weight, Ruler, Clock, DollarSign, Truck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import debounce from 'lodash/debounce';
import { useLanguage } from './LanguageContext';

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

export function CustomerBooking() {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<BookingForm>({
    pickupAddress: '',
    deliveryAddress: '',
    category: '',
    weight: '',
    volume: '',
    urgency: 'standard',
    fragile: false,
    refrigerated: false,
    oversized: false,
    hazardous: false
  });

  const [priceData, setPriceData] = useState<PriceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Array<{value: string, label: string}>>([]);

  // Загружаем категории при монтировании
  useEffect(() => {
    fetch('http://localhost:8000/api/categories')
      .then(res => res.json())
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
        } else {
          setPriceData(null);
          toast.error(data.error || t('customer.booking.price_calculation_failed') || 'Failed to calculate price');
        }
        
      } catch (error: any) {
        console.error('Error calculating price:', error);
        setPriceData(null);
        toast.error(t('customer.booking.service_connection_failed') || 'Failed to connect to pricing service');
      } finally {
        setLoading(false);
      }
    }, 1000), // Дебаунс 1 секунда
    [t]
  );

  // Обновляем расчет при изменении данных формы
  useEffect(() => {
    calculatePrice(formData);
  }, [formData, calculatePrice]);

  const handleInputChange = (field: keyof BookingForm, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!priceData) {
      toast.error(t('customer.booking.fill_all_fields') || 'Please fill all required fields');
      return;
    }
    
    // Здесь можно добавить логику создания заказа
    toast.success(
      t('customer.booking.ready_to_book', { price: priceData.price_usd.toFixed(2) }) || 
      `Ready to book! Estimated price: $${priceData.price_usd.toFixed(2)}`
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

    if (priceData) {
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
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                <Truck className="h-3 w-3 mr-1" />
                {priceData.vehicle_type}
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

  return (
    <Card className="max-w-4xl mx-auto">
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
        {/* Price Display - Now at the top */}
        {PriceDisplay()}

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
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="fragile"
                checked={formData.fragile}
                onCheckedChange={(checked) => handleInputChange('fragile', checked === true)}
              />
              <Label htmlFor="fragile" className="text-sm cursor-pointer">
                {t('customer.booking.fragile') || 'Fragile items'}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="refrigerated"
                checked={formData.refrigerated}
                onCheckedChange={(checked) => handleInputChange('refrigerated', checked === true)}
              />
              <Label htmlFor="refrigerated" className="text-sm cursor-pointer">
                {t('customer.booking.refrigerated') || 'Refrigerated'}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="oversized"
                checked={formData.oversized}
                onCheckedChange={(checked) => handleInputChange('oversized', checked === true)}
              />
              <Label htmlFor="oversized" className="text-sm cursor-pointer">
                {t('customer.booking.oversized') || 'Oversized'}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hazardous"
                checked={formData.hazardous}
                onCheckedChange={(checked) => handleInputChange('hazardous', checked === true)}
              />
              <Label htmlFor="hazardous" className="text-sm cursor-pointer">
                {t('customer.booking.hazardous') || 'Hazardous'}
              </Label>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <Button 
          onClick={handleSubmit}
          className="w-full h-12 text-lg bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
          disabled={loading || !priceData}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('customer.booking.calculating') || 'Calculating...'}
            </>
          ) : priceData ? (
            <>
              <DollarSign className="mr-2 h-5 w-5" />
              {t('customer.booking.book_delivery', { amount: priceData.price_usd.toFixed(2) }) || `Book Delivery for $${priceData.price_usd.toFixed(2)}`}
            </>
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