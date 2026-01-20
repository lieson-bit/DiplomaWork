import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Progress } from "./ui/progress";
import { Package, Building, User, MapPin, Bell, CreditCard, CheckCircle } from 'lucide-react';

interface CustomerOnboardingProps {
  onComplete: () => void;
}

interface CustomerProfile {
  // Account Type
  accountType: 'personal' | 'business';
  
  // Personal/Business Info
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  
  // Business Info (if applicable)
  businessName: string;
  businessType: string;
  businessAddress: string;
  businessPhone: string;
  
  // Shipping Preferences
  defaultPickupAddress: string;
  preferredDeliveryAreas: string[];
  frequentlyShippedItems: string[];
  
  // Notification Preferences
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  
  // Billing Preferences
  billingAddress: string;
  paymentMethod: string;
  invoiceEmails: boolean;
}

export function CustomerOnboarding({ onComplete }: CustomerOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [profile, setProfile] = useState({
    accountType: 'personal',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    businessName: '',
    businessType: '',
    businessAddress: '',
    businessPhone: '',
    defaultPickupAddress: '',
    preferredDeliveryAreas: [],
    frequentlyShippedItems: [],
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: true,
    billingAddress: '',
    paymentMethod: '',
    invoiceEmails: true
  });

  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  const businessTypes = [
    'Retail Store',
    'Restaurant/Food Service',
    'E-commerce',
    'Manufacturing',
    'Healthcare',
    'Education',
    'Construction',
    'Professional Services',
    'Other'
  ];

  const commonItems = [
    'Documents',
    'Small Packages',
    'Electronics',
    'Clothing',
    'Food & Beverages',
    'Furniture',
    'Medical Supplies',
    'Books & Media',
    'Automotive Parts',
    'Office Supplies'
  ];

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleItemToggle = (item: string) => {
    setProfile(prev => ({
      ...prev,
      frequentlyShippedItems: prev.frequentlyShippedItems.includes(item)
        ? prev.frequentlyShippedItems.filter(i => i !== item)
        : [...prev.frequentlyShippedItems, item]
    }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Package className="mx-auto h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl mb-2">Account Setup</h3>
              <p className="text-gray-600">Tell us about yourself and your shipping needs</p>
            </div>

            {/* Account Type */}
            <div className="space-y-4">
              <Label>Account Type</Label>
              <RadioGroup
                value={profile.accountType}
                onValueChange={(value: 'personal' | 'business') => setProfile({...profile, accountType: value})}
              >
                <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="personal" id="personal" />
                  <Label htmlFor="personal" className="flex items-center cursor-pointer flex-1">
                    <User className="mr-3 h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-medium">Personal Account</div>
                      <div className="text-sm text-gray-600">For individual shipping needs</div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="business" id="business" />
                  <Label htmlFor="business" className="flex items-center cursor-pointer flex-1">
                    <Building className="mr-3 h-5 w-5 text-green-600" />
                    <div>
                      <div className="font-medium">Business Account</div>
                      <div className="text-sm text-gray-600">For companies with regular shipping needs</div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Personal Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={profile.firstName}
                    onChange={(e) => setProfile({...profile, firstName: e.target.value})}
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={profile.lastName}
                    onChange={(e) => setProfile({...profile, lastName: e.target.value})}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({...profile, email: e.target.value})}
                  placeholder="john@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({...profile, phone: e.target.value})}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            {/* Business Info (if business account) */}
            {profile.accountType === 'business' && (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900">Business Information</h4>
                
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    value={profile.businessName}
                    onChange={(e) => setProfile({...profile, businessName: e.target.value})}
                    placeholder="Acme Corporation"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessType">Business Type</Label>
                  <Select value={profile.businessType} onValueChange={(value) => setProfile({...profile, businessType: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select business type" />
                    </SelectTrigger>
                    <SelectContent>
                      {businessTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessAddress">Business Address</Label>
                  <Textarea
                    id="businessAddress"
                    value={profile.businessAddress}
                    onChange={(e) => setProfile({...profile, businessAddress: e.target.value})}
                    placeholder="123 Business St, City, State, ZIP"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessPhone">Business Phone</Label>
                  <Input
                    id="businessPhone"
                    type="tel"
                    value={profile.businessPhone}
                    onChange={(e) => setProfile({...profile, businessPhone: e.target.value})}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <MapPin className="mx-auto h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl mb-2">Shipping Preferences</h3>
              <p className="text-gray-600">Set up your default shipping preferences</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="defaultPickup">Default Pickup Address</Label>
                <Textarea
                  id="defaultPickup"
                  value={profile.defaultPickupAddress}
                  onChange={(e) => setProfile({...profile, defaultPickupAddress: e.target.value})}
                  placeholder="Enter your most common pickup location"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliveryAreas">Preferred Delivery Areas</Label>
                <Textarea
                  id="deliveryAreas"
                  value={profile.preferredDeliveryAreas.join(', ')}
                  onChange={(e) => setProfile({...profile, preferredDeliveryAreas: e.target.value.split(', ').filter(Boolean)})}
                  placeholder="Enter areas where you frequently send deliveries (e.g., Downtown, Uptown, Westside)"
                  rows={2}
                />
              </div>

              <div className="space-y-3">
                <Label>Items You Frequently Ship</Label>
                <div className="grid grid-cols-2 gap-3">
                  {commonItems.map((item) => (
                    <div
                      key={item}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        profile.frequentlyShippedItems.includes(item)
                          ? 'bg-blue-50 border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleItemToggle(item)}
                    >
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={profile.frequentlyShippedItems.includes(item)}
                          readOnly
                        />
                        <span className="text-sm">{item}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Bell className="mx-auto h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl mb-2">Notification Preferences</h3>
              <p className="text-gray-600">Choose how you want to receive updates</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium">Communication Preferences</h4>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Email Notifications</div>
                      <div className="text-sm text-gray-600">Order confirmations, delivery updates</div>
                    </div>
                    <Checkbox
                      checked={profile.emailNotifications}
                      onCheckedChange={(checked) => setProfile({...profile, emailNotifications: checked === true})}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">SMS Notifications</div>
                      <div className="text-sm text-gray-600">Real-time delivery updates</div>
                    </div>
                    <Checkbox
                      checked={profile.smsNotifications}
                      onCheckedChange={(checked) => setProfile({...profile, smsNotifications: checked === true})}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Push Notifications</div>
                      <div className="text-sm text-gray-600">App notifications on your device</div>
                    </div>
                    <Checkbox
                      checked={profile.pushNotifications}
                      onCheckedChange={(checked) => setProfile({...profile, pushNotifications: checked === true})}
                    />
                  </div>
                </div>
              </div>

              {profile.accountType === 'business' && (
                <div className="space-y-4 p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-900">Business Features</h4>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Invoice Emails</div>
                      <div className="text-sm text-gray-600">Monthly billing statements</div>
                    </div>
                    <Checkbox
                      checked={profile.invoiceEmails}
                      onCheckedChange={(checked) => setProfile({...profile, invoiceEmails: checked === true})}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-600 mb-4" />
              <h3 className="text-xl mb-2">Review & Complete</h3>
              <p className="text-gray-600">Review your information and complete setup</p>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Account Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div><span className="text-gray-600">Name:</span> {profile.firstName} {profile.lastName}</div>
                    <div><span className="text-gray-600">Account Type:</span> {profile.accountType}</div>
                    <div><span className="text-gray-600">Email:</span> {profile.email}</div>
                    <div><span className="text-gray-600">Phone:</span> {profile.phone}</div>
                  </div>
                  {profile.accountType === 'business' && profile.businessName && (
                    <div className="pt-2 border-t">
                      <div><span className="text-gray-600">Business:</span> {profile.businessName}</div>
                      <div><span className="text-gray-600">Type:</span> {profile.businessType}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Shipping Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div><span className="text-gray-600">Default Pickup:</span> {profile.defaultPickupAddress || 'Not set'}</div>
                  <div><span className="text-gray-600">Preferred Areas:</span> {profile.preferredDeliveryAreas.join(', ') || 'Not set'}</div>
                  <div><span className="text-gray-600">Common Items:</span> {profile.frequentlyShippedItems.slice(0, 3).join(', ')}{profile.frequentlyShippedItems.length > 3 ? '...' : ''}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notifications</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className={`h-4 w-4 ${profile.emailNotifications ? 'text-green-600' : 'text-gray-400'}`} />
                      <span>Email</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className={`h-4 w-4 ${profile.smsNotifications ? 'text-green-600' : 'text-gray-400'}`} />
                      <span>SMS</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className={`h-4 w-4 ${profile.pushNotifications ? 'text-green-600' : 'text-gray-400'}`} />
                      <span>Push</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">What's Next?</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Start creating delivery requests</li>
                  <li>• Upload bulk orders via Excel</li>
                  <li>• Track your deliveries in real-time</li>
                  <li>• Rate and review drivers</li>
                  {profile.accountType === 'business' && (
                    <li>• Access business analytics and reporting</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl text-gray-900">Customer Setup</h2>
            <span className="text-sm text-gray-600">Step {currentStep} of {totalSteps}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Content */}
        <Card>
          <CardContent className="p-8">
            {renderStep()}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            Previous
          </Button>
          <Button
            onClick={nextStep}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {currentStep === totalSteps ? 'Complete Setup' : 'Next Step'}
          </Button>
        </div>
      </div>
    </div>
  );
}