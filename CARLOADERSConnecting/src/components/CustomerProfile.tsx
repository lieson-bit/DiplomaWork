import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Switch } from "./ui/switch";
import { Avatar, AvatarContent, AvatarFallback } from "./ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { User, Building, CreditCard, MapPin, Phone, Mail, Calendar, Settings, Bell, Star, Package, DollarSign, Trash2, Plus } from 'lucide-react';

interface Address {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'bank';
  last4?: string;
  brand?: string;
  email?: string;
  isDefault: boolean;
}

interface CustomerData {
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    joinDate: string;
  };
  businessInfo?: {
    businessName: string;
    businessType: string;
    businessAddress: string;
    businessPhone: string;
    taxId: string;
  };
  addresses: Address[];
  paymentMethods: PaymentMethod[];
  preferences: {
    defaultPickupType: 'home' | 'business' | 'other';
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
    privacy: {
      shareLocationData: boolean;
      shareUsageAnalytics: boolean;
      marketingEmails: boolean;
    };
  };
  stats: {
    totalOrders: number;
    totalSpent: number;
    averageRating: number;
    memberSince: string;
  };
  accountType: 'personal' | 'business';
}

export function CustomerProfile() {
  const [activeTab, setActiveTab] = useState('personal');
  const [isEditing, setIsEditing] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerData>({
    personalInfo: {
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah.johnson@email.com',
      phone: '+1 (555) 987-6543',
      dateOfBirth: '1990-07-22',
      joinDate: '2023-06-15'
    },
    businessInfo: {
      businessName: 'Johnson Consulting LLC',
      businessType: 'Professional Services',
      businessAddress: '456 Business Ave, Suite 200, City 10002',
      businessPhone: '+1 (555) 987-6544',
      taxId: 'XX-XXXXXXX'
    },
    addresses: [
      {
        id: 'ADDR1',
        label: 'Home',
        address: '789 Residential St, Apt 4B, City 10003',
        isDefault: true
      },
      {
        id: 'ADDR2',
        label: 'Office',
        address: '456 Business Ave, Suite 200, City 10002',
        isDefault: false
      }
    ],
    paymentMethods: [
      {
        id: 'PM1',
        type: 'card',
        last4: '4242',
        brand: 'Visa',
        isDefault: true
      },
      {
        id: 'PM2',
        type: 'paypal',
        email: 'sarah.johnson@email.com',
        isDefault: false
      }
    ],
    preferences: {
      defaultPickupType: 'home',
      notifications: {
        email: true,
        sms: true,
        push: true
      },
      privacy: {
        shareLocationData: true,
        shareUsageAnalytics: false,
        marketingEmails: false
      }
    },
    stats: {
      totalOrders: 45,
      totalSpent: 2350,
      averageRating: 4.8,
      memberSince: '2023-06-15'
    },
    accountType: 'business'
  });

  const addAddress = () => {
    const newAddress: Address = {
      id: `ADDR${customerData.addresses.length + 1}`,
      label: 'New Address',
      address: '',
      isDefault: false
    };
    setCustomerData({
      ...customerData,
      addresses: [...customerData.addresses, newAddress]
    });
  };

  const removeAddress = (id: string) => {
    setCustomerData({
      ...customerData,
      addresses: customerData.addresses.filter(addr => addr.id !== id)
    });
  };

  const setDefaultAddress = (id: string) => {
    setCustomerData({
      ...customerData,
      addresses: customerData.addresses.map(addr => ({
        ...addr,
        isDefault: addr.id === id
      }))
    });
  };

  const addPaymentMethod = () => {
    // This would open a payment method setup dialog
    alert('Payment method setup would open here');
  };

  const removePaymentMethod = (id: string) => {
    setCustomerData({
      ...customerData,
      paymentMethods: customerData.paymentMethods.filter(pm => pm.id !== id)
    });
  };

  const setDefaultPaymentMethod = (id: string) => {
    setCustomerData({
      ...customerData,
      paymentMethods: customerData.paymentMethods.map(pm => ({
        ...pm,
        isDefault: pm.id === id
      }))
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-4">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-lg">
              {customerData.personalInfo.firstName[0]}{customerData.personalInfo.lastName[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl text-gray-900">
              {customerData.personalInfo.firstName} {customerData.personalInfo.lastName}
            </h2>
            <p className="text-gray-600">
              {customerData.accountType === 'business' ? 'Business Account' : 'Personal Account'}
            </p>
            {customerData.businessInfo && (
              <p className="text-sm text-gray-500">{customerData.businessInfo.businessName}</p>
            )}
            <div className="flex items-center space-x-4 mt-2">
              <div className="flex items-center space-x-1">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">{customerData.stats.averageRating} rating</span>
              </div>
              <div className="text-sm text-gray-600">
                {customerData.stats.totalOrders} orders
              </div>
            </div>
          </div>
        </div>
        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
          Member since {new Date(customerData.stats.memberSince).getFullYear()}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Personal Information
                  </CardTitle>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    {isEditing ? 'Save Changes' : 'Edit Profile'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={customerData.personalInfo.firstName}
                      disabled={!isEditing}
                      onChange={(e) => setCustomerData({
                        ...customerData,
                        personalInfo: { ...customerData.personalInfo, firstName: e.target.value }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={customerData.personalInfo.lastName}
                      disabled={!isEditing}
                      onChange={(e) => setCustomerData({
                        ...customerData,
                        personalInfo: { ...customerData.personalInfo, lastName: e.target.value }
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={customerData.personalInfo.email}
                      disabled={!isEditing}
                      className="pl-10"
                      onChange={(e) => setCustomerData({
                        ...customerData,
                        personalInfo: { ...customerData.personalInfo, email: e.target.value }
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      value={customerData.personalInfo.phone}
                      disabled={!isEditing}
                      className="pl-10"
                      onChange={(e) => setCustomerData({
                        ...customerData,
                        personalInfo: { ...customerData.personalInfo, phone: e.target.value }
                      })}
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
                      value={customerData.personalInfo.dateOfBirth}
                      disabled={!isEditing}
                      className="pl-10"
                      onChange={(e) => setCustomerData({
                        ...customerData,
                        personalInfo: { ...customerData.personalInfo, dateOfBirth: e.target.value }
                      })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {customerData.businessInfo && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Business Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name</Label>
                    <Input
                      id="businessName"
                      value={customerData.businessInfo.businessName}
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="businessType">Business Type</Label>
                      <Select value={customerData.businessInfo.businessType} disabled={!isEditing}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Professional Services">Professional Services</SelectItem>
                          <SelectItem value="Retail">Retail</SelectItem>
                          <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                          <SelectItem value="Healthcare">Healthcare</SelectItem>
                          <SelectItem value="Education">Education</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="taxId">Tax ID</Label>
                      <Input
                        id="taxId"
                        value={customerData.businessInfo.taxId}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessAddress">Business Address</Label>
                    <Textarea
                      id="businessAddress"
                      value={customerData.businessInfo.businessAddress}
                      disabled={!isEditing}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessPhone">Business Phone</Label>
                    <Input
                      id="businessPhone"
                      value={customerData.businessInfo.businessPhone}
                      disabled={!isEditing}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="addresses">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Saved Addresses
                </CardTitle>
                <Button onClick={addAddress}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Address
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {customerData.addresses.map((address) => (
                  <div key={address.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Input
                          value={address.label}
                          className="font-medium w-32"
                          onChange={(e) => {
                            const updatedAddresses = customerData.addresses.map(addr =>
                              addr.id === address.id ? { ...addr, label: e.target.value } : addr
                            );
                            setCustomerData({ ...customerData, addresses: updatedAddresses });
                          }}
                        />
                        {address.isDefault && (
                          <Badge variant="secondary">Default</Badge>
                        )}
                      </div>
                      <Textarea
                        value={address.address}
                        rows={2}
                        onChange={(e) => {
                          const updatedAddresses = customerData.addresses.map(addr =>
                            addr.id === address.id ? { ...addr, address: e.target.value } : addr
                          );
                          setCustomerData({ ...customerData, addresses: updatedAddresses });
                        }}
                      />
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {!address.isDefault && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDefaultAddress(address.id)}
                        >
                          Set Default
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Address</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this address? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeAddress(address.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Methods
                </CardTitle>
                <Button onClick={addPaymentMethod}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Payment Method
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {customerData.paymentMethods.map((method) => (
                  <div key={method.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gray-100 rounded">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          {method.type === 'card' ? (
                            <span className="font-medium">
                              {method.brand} •••• {method.last4}
                            </span>
                          ) : (
                            <span className="font-medium">
                              PayPal ({method.email})
                            </span>
                          )}
                          {method.isDefault && (
                            <Badge variant="secondary">Default</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {method.type === 'card' ? 'Credit/Debit Card' : 'PayPal Account'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!method.isDefault && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDefaultPaymentMethod(method.id)}
                        >
                          Set Default
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Payment Method</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove this payment method? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removePaymentMethod(method.id)}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-notifications">Email Notifications</Label>
                    <p className="text-sm text-gray-600">Order updates, receipts, and newsletters</p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={customerData.preferences.notifications.email}
                    onCheckedChange={(checked) => setCustomerData({
                      ...customerData,
                      preferences: {
                        ...customerData.preferences,
                        notifications: { ...customerData.preferences.notifications, email: checked }
                      }
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="sms-notifications">SMS Notifications</Label>
                    <p className="text-sm text-gray-600">Real-time delivery updates</p>
                  </div>
                  <Switch
                    id="sms-notifications"
                    checked={customerData.preferences.notifications.sms}
                    onCheckedChange={(checked) => setCustomerData({
                      ...customerData,
                      preferences: {
                        ...customerData.preferences,
                        notifications: { ...customerData.preferences.notifications, sms: checked }
                      }
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="push-notifications">Push Notifications</Label>
                    <p className="text-sm text-gray-600">In-app notifications</p>
                  </div>
                  <Switch
                    id="push-notifications"
                    checked={customerData.preferences.notifications.push}
                    onCheckedChange={(checked) => setCustomerData({
                      ...customerData,
                      preferences: {
                        ...customerData.preferences,
                        notifications: { ...customerData.preferences.notifications, push: checked }
                      }
                    })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Privacy Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="location-data">Share Location Data</Label>
                    <p className="text-sm text-gray-600">Help improve route optimization</p>
                  </div>
                  <Switch
                    id="location-data"
                    checked={customerData.preferences.privacy.shareLocationData}
                    onCheckedChange={(checked) => setCustomerData({
                      ...customerData,
                      preferences: {
                        ...customerData.preferences,
                        privacy: { ...customerData.preferences.privacy, shareLocationData: checked }
                      }
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="usage-analytics">Share Usage Analytics</Label>
                    <p className="text-sm text-gray-600">Help improve the platform</p>
                  </div>
                  <Switch
                    id="usage-analytics"
                    checked={customerData.preferences.privacy.shareUsageAnalytics}
                    onCheckedChange={(checked) => setCustomerData({
                      ...customerData,
                      preferences: {
                        ...customerData.preferences,
                        privacy: { ...customerData.preferences.privacy, shareUsageAnalytics: checked }
                      }
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="marketing-emails">Marketing Emails</Label>
                    <p className="text-sm text-gray-600">Promotional offers and tips</p>
                  </div>
                  <Switch
                    id="marketing-emails"
                    checked={customerData.preferences.privacy.marketingEmails}
                    onCheckedChange={(checked) => setCustomerData({
                      ...customerData,
                      preferences: {
                        ...customerData.preferences,
                        privacy: { ...customerData.preferences.privacy, marketingEmails: checked }
                      }
                    })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stats">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <p className="text-3xl text-blue-600">{customerData.stats.totalOrders}</p>
                    <p className="text-gray-600">Total Orders</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl text-green-600">${customerData.stats.totalSpent.toLocaleString()}</p>
                    <p className="text-gray-600">Total Spent</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl text-yellow-600">{customerData.stats.averageRating}</p>
                    <p className="text-gray-600">Average Rating</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl text-purple-600">
                      {Math.round((new Date().getTime() - new Date(customerData.stats.memberSince).getTime()) / (1000 * 60 * 60 * 24))}
                    </p>
                    <p className="text-gray-600">Days Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account Benefits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Package className="h-5 w-5 text-blue-600" />
                      <span>Free Delivery Credits</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">$50 Available</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Star className="h-5 w-5 text-yellow-600" />
                      <span>Loyalty Points</span>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800">2,340 Points</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <span>Bulk Discount Rate</span>
                    </div>
                    <Badge className="bg-purple-100 text-purple-800">15% Off</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}