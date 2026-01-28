import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Progress } from "./ui/progress";
import { Package, Building, User, MapPin, Bell, CreditCard, CheckCircle, Calendar } from 'lucide-react';
import { toast } from "sonner";
import { customerApi }  from '../src/lib/api'; 

interface CustomerOnboardingProps {
  onComplete: () => void;
  userInfo?: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
}

interface AddressData {
  label: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  notes?: string;
}

export function CustomerOnboarding({ onComplete, userInfo }: CustomerOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    // Personal Info (from user service)
    firstName: userInfo?.firstName || '',
    lastName: userInfo?.lastName || '',
    email: userInfo?.email || '',
    phone: userInfo?.phone || '',
    
    // Customer-specific fields
    accountType: 'personal' as 'personal' | 'business',
    dateOfBirth: '',
    
    // Business Info
    businessName: '',
    businessType: '',
    businessPhone: '',
    taxId: '',
    
    // Addresses
    addresses: [
      {
        id: 'home',
        label: 'Home',
        address: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
        isDefault: true,
        notes: ''
      },
      {
        label: 'Office',
        address: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
        isDefault: false,
        notes: ''
      }
    ] as AddressData[],
    
    // Preferences
    preferences: {
      notificationEmail: true,
      notificationSMS: true,
      notificationPush: true,
      shareLocationData: false,
      shareUsageAnalytics: false,
      marketingEmails: false,
      language: 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
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

  useEffect(() => {
    if (userInfo) {
      setProfile(prev => ({
        ...prev,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        email: userInfo.email,
        phone: userInfo.phone || ''
      }));
    }
  }, [userInfo]);

  const nextStep = () => {
    // Validate current step before proceeding
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep === 3 && !validateStep3()) return;
    
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const validateStep1 = () => {
    if (!profile.firstName.trim() || !profile.lastName.trim() || !profile.email.trim()) {
      toast.error('Please fill in all required personal information');
      return false;
    }
    if (profile.accountType === 'business' && !profile.businessName.trim()) {
      toast.error('Business name is required for business accounts');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    // Check if at least one address is provided
    const hasAddress = profile.addresses.some(addr => 
      addr.address.trim() && addr.city.trim() && addr.state.trim() && addr.postalCode.trim()
    );
    if (!hasAddress) {
      toast.error('Please provide at least one complete address');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    // Preferences are optional, but validate date if provided
    if (profile.dateOfBirth) {
      const dob = new Date(profile.dateOfBirth);
      const today = new Date();
      if (dob > today) {
        toast.error('Date of birth cannot be in the future');
        return false;
      }
    }
    return true;
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      // 1. Create customer profile
      const profileData = {
        accountType: profile.accountType,
        dateOfBirth: profile.dateOfBirth || undefined,
        ...(profile.accountType === 'business' && {
          businessName: profile.businessName,
          businessType: profile.businessType,
          businessPhone: profile.businessPhone,
          taxId: profile.taxId || undefined
        })
      };

      const profileResponse = await customerApi.createProfile(profileData);
      if (!profileResponse.success) {
        throw new Error(profileResponse.error || 'Failed to create profile');
      }

      // 2. Add addresses
      const validAddresses = profile.addresses.filter(addr => 
        addr.address.trim() && addr.city.trim() && addr.state.trim() && addr.postalCode.trim()
      );

      for (const address of validAddresses) {
        await customerApi.addAddress(address);
      }

      // 3. Update preferences
      await customerApi.updatePreferences(profile.preferences);

      toast.success('Profile created successfully!');
      onComplete();
    } catch (error: any) {
      console.error('Onboarding failed:', error);
      toast.error(error.message || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  const updateAddress = (index: number, field: keyof AddressData, value: string | boolean) => {
    setProfile(prev => {
      const newAddresses = [...prev.addresses];
      
      if (field === 'isDefault' && value === true) {
        // Set all other addresses to non-default
        newAddresses.forEach(addr => {
          addr.isDefault = false;
        });
      }
      
      newAddresses[index] = {
        ...newAddresses[index],
        [field]: value
      };
      
      return { ...prev, addresses: newAddresses };
    });
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
                onValueChange={(value: 'personal' | 'business') => 
                  setProfile({...profile, accountType: value})
                }
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
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={profile.firstName}
                    onChange={(e) => setProfile({...profile, firstName: e.target.value})}
                    placeholder="John"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={profile.lastName}
                    onChange={(e) => setProfile({...profile, lastName: e.target.value})}
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({...profile, email: e.target.value})}
                    placeholder="john@example.com"
                    required
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

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={profile.dateOfBirth}
                    onChange={(e) => setProfile({...profile, dateOfBirth: e.target.value})}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Business Info (if business account) */}
            {profile.accountType === 'business' && (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900">Business Information</h4>
                
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input
                    id="businessName"
                    value={profile.businessName}
                    onChange={(e) => setProfile({...profile, businessName: e.target.value})}
                    placeholder="Acme Corporation"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessType">Business Type</Label>
                    <Select 
                      value={profile.businessType} 
                      onValueChange={(value) => setProfile({...profile, businessType: value})}
                    >
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
                    <Label htmlFor="taxId">Tax ID</Label>
                    <Input
                      id="taxId"
                      value={profile.taxId}
                      onChange={(e) => setProfile({...profile, taxId: e.target.value})}
                      placeholder="XX-XXXXXXX"
                    />
                  </div>
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
              <h3 className="text-xl mb-2">Addresses</h3>
              <p className="text-gray-600">Add your shipping addresses</p>
            </div>

            <div className="space-y-6">
              {profile.addresses.map((address, index) => (
                <Card key={address.id}>
                  <CardHeader>
                    <CardTitle className="text-base flex justify-between items-center">
                      <span>{address.label} Address</span>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={address.isDefault}
                          onCheckedChange={(checked) => 
                            updateAddress(index, 'isDefault', checked === true)
                          }
                          id={`default-${address.id}`}
                        />
                        <Label htmlFor={`default-${address.id}`} className="text-sm">
                          Set as default
                        </Label>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor={`address-${address.id}`}>Street Address</Label>
                      <Input
                        id={`address-${address.id}`}
                        value={address.address}
                        onChange={(e) => updateAddress(index, 'address', e.target.value)}
                        placeholder="123 Main St"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor={`city-${address.id}`}>City</Label>
                        <Input
                          id={`city-${address.id}`}
                          value={address.city}
                          onChange={(e) => updateAddress(index, 'city', e.target.value)}
                          placeholder="New York"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`state-${address.id}`}>State</Label>
                        <Input
                          id={`state-${address.id}`}
                          value={address.state}
                          onChange={(e) => updateAddress(index, 'state', e.target.value)}
                          placeholder="NY"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`postalCode-${address.id}`}>ZIP Code</Label>
                        <Input
                          id={`postalCode-${address.id}`}
                          value={address.postalCode}
                          onChange={(e) => updateAddress(index, 'postalCode', e.target.value)}
                          placeholder="10001"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`notes-${address.id}`}>Notes (Optional)</Label>
                      <Textarea
                        id={`notes-${address.id}`}
                        value={address.notes || ''}
                        onChange={(e) => updateAddress(index, 'notes', e.target.value)}
                        placeholder="e.g., Leave at front desk, Ring bell twice"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Bell className="mx-auto h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl mb-2">Preferences</h3>
              <p className="text-gray-600">Set your notification and privacy preferences</p>
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
                      checked={profile.preferences.notificationEmail}
                      onCheckedChange={(checked) => setProfile({
                        ...profile,
                        preferences: {
                          ...profile.preferences,
                          notificationEmail: checked === true
                        }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">SMS Notifications</div>
                      <div className="text-sm text-gray-600">Real-time delivery updates</div>
                    </div>
                    <Checkbox
                      checked={profile.preferences.notificationSMS}
                      onCheckedChange={(checked) => setProfile({
                        ...profile,
                        preferences: {
                          ...profile.preferences,
                          notificationSMS: checked === true
                        }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Push Notifications</div>
                      <div className="text-sm text-gray-600">App notifications on your device</div>
                    </div>
                    <Checkbox
                      checked={profile.preferences.notificationPush}
                      onCheckedChange={(checked) => setProfile({
                        ...profile,
                        preferences: {
                          ...profile.preferences,
                          notificationPush: checked === true
                        }
                      })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium">Privacy Settings</h4>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Share Location Data</div>
                      <div className="text-sm text-gray-600">Allow us to use your location for better delivery estimates</div>
                    </div>
                    <Checkbox
                      checked={profile.preferences.shareLocationData}
                      onCheckedChange={(checked) => setProfile({
                        ...profile,
                        preferences: {
                          ...profile.preferences,
                          shareLocationData: checked === true
                        }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Share Usage Analytics</div>
                      <div className="text-sm text-gray-600">Help us improve our service by sharing anonymous usage data</div>
                    </div>
                    <Checkbox
                      checked={profile.preferences.shareUsageAnalytics}
                      onCheckedChange={(checked) => setProfile({
                        ...profile,
                        preferences: {
                          ...profile.preferences,
                          shareUsageAnalytics: checked === true
                        }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Marketing Emails</div>
                      <div className="text-sm text-gray-600">Receive promotions, tips, and news about our service</div>
                    </div>
                    <Checkbox
                      checked={profile.preferences.marketingEmails}
                      onCheckedChange={(checked) => setProfile({
                        ...profile,
                        preferences: {
                          ...profile.preferences,
                          marketingEmails: checked === true
                        }
                      })}
                    />
                  </div>
                </div>
              </div>
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
                  <CardTitle className="text-base">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div><span className="text-gray-600">Name:</span> {profile.firstName} {profile.lastName}</div>
                    <div><span className="text-gray-600">Account Type:</span> {profile.accountType}</div>
                    <div><span className="text-gray-600">Email:</span> {profile.email}</div>
                    <div><span className="text-gray-600">Phone:</span> {profile.phone || 'Not provided'}</div>
                    {profile.dateOfBirth && (
                      <div><span className="text-gray-600">Date of Birth:</span> {new Date(profile.dateOfBirth).toLocaleDateString()}</div>
                    )}
                  </div>
                  {profile.accountType === 'business' && profile.businessName && (
                    <div className="pt-2 border-t">
                      <div><span className="text-gray-600">Business:</span> {profile.businessName}</div>
                      <div><span className="text-gray-600">Type:</span> {profile.businessType || 'Not specified'}</div>
                      {profile.taxId && (
                        <div><span className="text-gray-600">Tax ID:</span> {profile.taxId}</div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Addresses</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {profile.addresses.map((address, index) => (
                    <div key={address.id} className={`p-3 rounded ${address.isDefault ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{address.label} {address.isDefault && '(Default)'}</div>
                          {address.address && (
                            <>
                              <div>{address.address}</div>
                              <div>{address.city}, {address.state} {address.postalCode}</div>
                            </>
                          )}
                          {!address.address && (
                            <div className="text-gray-500 italic">Not provided</div>
                          )}
                          {address.notes && (
                            <div className="text-gray-600 mt-1">Note: {address.notes}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notification Preferences</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className={`h-4 w-4 ${profile.preferences.notificationEmail ? 'text-green-600' : 'text-gray-400'}`} />
                      <span>Email</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className={`h-4 w-4 ${profile.preferences.notificationSMS ? 'text-green-600' : 'text-gray-400'}`} />
                      <span>SMS</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className={`h-4 w-4 ${profile.preferences.notificationPush ? 'text-green-600' : 'text-gray-400'}`} />
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
                    <>
                      <li>• Access business analytics and reporting</li>
                      <li>• Set up team members and permissions</li>
                      <li>• Generate monthly invoices</li>
                    </>
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
            disabled={currentStep === 1 || loading}
          >
            Previous
          </Button>
          <Button
            onClick={nextStep}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : currentStep === totalSteps ? (
              'Complete Setup'
            ) : (
              'Next Step'
            )}
          </Button>
        </div>

        <div className="mt-4 text-center text-sm text-gray-500">
          Step {currentStep} of {totalSteps} • Fields marked with * are required
        </div>
      </div>
    </div>
  );
}