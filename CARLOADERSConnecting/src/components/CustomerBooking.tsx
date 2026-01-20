import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { MapPin, Package, Weight, Ruler, Clock, DollarSign, Truck } from 'lucide-react';
//import { orderApi, matchingApi } from '../src/lib/api';
import { toast } from 'sonner';

interface BookingForm {
  pickupAddress: string;
  deliveryAddress: string;
  category: string;
  weight: string;
  volume: string;
  description: string;
  urgency: string;
  fragile: boolean;
  refrigerated: boolean;
  oversized: boolean;
}

export function CustomerBooking() {
  const [formData, setFormData] = useState<BookingForm>({
    pickupAddress: '',
    deliveryAddress: '',
    category: '',
    weight: '',
    volume: '',
    description: '',
    urgency: 'standard',
    fragile: false,
    refrigerated: false,
    oversized: false
  });

  const [step, setStep] = useState(1);
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [matchedDrivers, setMatchedDrivers] = useState<any[]>([]);

  const categories = [
    { value: 'documents', label: 'Documents & Small Packages' },
    { value: 'furniture', label: 'Furniture & Appliances' },
    { value: 'construction', label: 'Construction Materials' },
    { value: 'food', label: 'Food & Beverages' },
    { value: 'electronics', label: 'Electronics & Fragile Items' },
    { value: 'other', label: 'Other' }
  ];

  const handleInputChange = (field: keyof BookingForm, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateEstimate = async () => {
    try {
      // Calculate pricing
      const baseRate = 15;
      const weightRate = parseFloat(formData.weight) * 0.5;
      const volumeRate = parseFloat(formData.volume) * 2;
      const urgencyMultiplier = formData.urgency === 'urgent' ? 1.5 : 1;
      const specialRequirements = (formData.fragile ? 5 : 0) + (formData.refrigerated ? 10 : 0) + (formData.oversized ? 8 : 0);
      
      const total = (baseRate + weightRate + volumeRate + specialRequirements) * urgencyMultiplier;
      setEstimatedCost(Math.round(total));
      
      // Find matching drivers
      const matchingData = await matchingApi.findDrivers({
        pickupAddress: formData.pickupAddress,
        deliveryAddress: formData.deliveryAddress,
        totalWeight: parseFloat(formData.weight),
        totalVolume: parseFloat(formData.volume),
      });
      
      if (matchingData.matches && matchingData.matches.length > 0) {
        const drivers = matchingData.matches.map((match: any) => ({
          id: match.driverId,
          name: `${match.driver.firstName} ${match.driver.lastName}`,
          vehicle: match.driver.vehicleType || 'Vehicle',
          rating: match.driver.rating || 0,
          distance: `${match.distanceKm.toFixed(1)} km away`,
          eta: `${match.estimatedArrivalMin} mins`,
          price: Math.round(total),
          capacity: `${match.driver.maxWeightKg || 0} kg / ${match.driver.maxVolumeM3 || 0} m³`,
        }));
        setMatchedDrivers(drivers);
      } else {
        toast.info('No drivers available at the moment');
        setMatchedDrivers([]);
      }
      
      setStep(2);
    } catch (error: any) {
      console.error('Error finding drivers:', error);
      toast.error('Failed to find available drivers');
    }
  };

  const handleBooking = async (driverId: string) => {
    try {
      // Create order
      const order = await orderApi.create({
        pickupAddress: formData.pickupAddress,
        deliveryAddress: formData.deliveryAddress,
        totalWeightKg: parseFloat(formData.weight),
        totalVolumeM3: parseFloat(formData.volume),
        packageDescription: formData.description,
        fragileItems: formData.fragile,
        temperatureControlled: formData.refrigerated,
        basePrice: estimatedCost,
        totalPrice: estimatedCost,
        priority: formData.urgency === 'urgent' ? 'urgent' : 'normal',
      });
      
      // Assign driver
      await orderApi.assignDriver(order.id, driverId);
      
      toast.success('Booking confirmed!');
      setStep(3);
    } catch (error: any) {
      console.error('Error creating booking:', error);
      toast.error('Failed to create booking');
    }
  };

  if (step === 3) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-green-600">Booking Confirmed!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <Package className="h-8 w-8 text-green-600" />
          </div>
          <p>Your delivery has been booked successfully.</p>
          <p className="text-sm text-gray-600">Order ID: ORD-{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
          <Button onClick={() => {setStep(1); setFormData({pickupAddress: '', deliveryAddress: '', category: '', weight: '', volume: '', description: '', urgency: 'standard', fragile: false, refrigerated: false, oversized: false})}}>
            Book Another Delivery
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Available Drivers</CardTitle>
          <div className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <span className="text-lg">Estimated cost: ${estimatedCost}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {matchedDrivers.map((driver) => (
              <div key={driver.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium">{driver.name}</h4>
                    <p className="text-sm text-gray-600">{driver.vehicle}</p>
                    <div className="flex items-center space-x-1 mt-1">
                      <span className="text-yellow-500">★</span>
                      <span className="text-sm">{driver.rating}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg text-green-600">${driver.price}</p>
                    <p className="text-sm text-gray-600">{driver.distance}</p>
                    <p className="text-sm text-blue-600">ETA: {driver.eta}</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Capacity: {driver.capacity}
                  </div>
                  <Button 
                    onClick={() => handleBooking(driver.id)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Book This Driver
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setStep(1)}
              className="w-full"
            >
              Back to Booking Form
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Delivery Booking</CardTitle>
        <p className="text-gray-600">Fill in the details for your delivery request</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Addresses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pickup">Pickup Address</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="pickup"
                placeholder="Enter pickup address"
                value={formData.pickupAddress}
                onChange={(e) => handleInputChange('pickupAddress', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="delivery">Delivery Address</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="delivery"
                placeholder="Enter delivery address"
                value={formData.deliveryAddress}
                onChange={(e) => handleInputChange('deliveryAddress', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="category">Item Category</Label>
          <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
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
            <Label htmlFor="weight">Weight (kg)</Label>
            <div className="relative">
              <Weight className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="weight"
                type="number"
                placeholder="Enter weight"
                value={formData.weight}
                onChange={(e) => handleInputChange('weight', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="volume">Volume (m³)</Label>
            <div className="relative">
              <Ruler className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="volume"
                type="number"
                step="0.1"
                placeholder="Enter volume"
                value={formData.volume}
                onChange={(e) => handleInputChange('volume', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Describe your items in detail..."
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            rows={3}
          />
        </div>

        {/* Urgency */}
        <div className="space-y-2">
          <Label htmlFor="urgency">Delivery Urgency</Label>
          <Select value={formData.urgency} onValueChange={(value) => handleInputChange('urgency', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard (same day)</SelectItem>
              <SelectItem value="urgent">Urgent (within 2 hours)</SelectItem>
              <SelectItem value="scheduled">Scheduled (next day)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Special Requirements */}
        <div className="space-y-3">
          <Label>Special Requirements</Label>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="fragile"
                checked={formData.fragile}
                onCheckedChange={(checked) => handleInputChange('fragile', checked === true)}
              />
              <Label htmlFor="fragile" className="text-sm">Fragile items</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="refrigerated"
                checked={formData.refrigerated}
                onCheckedChange={(checked) => handleInputChange('refrigerated', checked === true)}
              />
              <Label htmlFor="refrigerated" className="text-sm">Refrigerated transport</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="oversized"
                checked={formData.oversized}
                onCheckedChange={(checked) => handleInputChange('oversized', checked === true)}
              />
              <Label htmlFor="oversized" className="text-sm">Oversized items</Label>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <Button 
          onClick={calculateEstimate}
          className="w-full bg-blue-600 hover:bg-blue-700"
          disabled={!formData.pickupAddress || !formData.deliveryAddress || !formData.category || !formData.weight || !formData.volume}
        >
          <Truck className="mr-2 h-4 w-4" />
          Find Available Drivers
        </Button>
      </CardContent>
    </Card>
  );
}