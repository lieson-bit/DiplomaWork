import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Checkbox } from "./ui/checkbox";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import { Bell, Package, Truck, DollarSign, AlertTriangle, CheckCircle, Clock, MessageSquare, Settings } from 'lucide-react';

interface NotificationCenterProps {
  userType: 'driver' | 'customer';
}

interface Notification {
  id: string;
  type: 'order' | 'payment' | 'system' | 'message' | 'document';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
  actionable?: boolean;
  actionText?: string;
}

interface NotificationSettings {
  orderUpdates: boolean;
  paymentNotifications: boolean;
  systemUpdates: boolean;
  promotions: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
}

export function NotificationCenter({ userType }: NotificationCenterProps) {
  const [activeTab, setActiveTab] = useState('all');
  const [notifications, setNotifications] = useState<Notification[]>(
    userType === 'driver' ? driverNotifications : customerNotifications
  );
  const [settings, setSettings] = useState<NotificationSettings>({
    orderUpdates: true,
    paymentNotifications: true,
    systemUpdates: true,
    promotions: false,
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: true
  });

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const getFilteredNotifications = () => {
    if (activeTab === 'all') return notifications;
    if (activeTab === 'unread') return notifications.filter(n => !n.read);
    return notifications.filter(n => n.type === activeTab);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order': return <Package className="h-4 w-4" />;
      case 'payment': return <DollarSign className="h-4 w-4" />;
      case 'system': return <Settings className="h-4 w-4" />;
      case 'message': return <MessageSquare className="h-4 w-4" />;
      case 'document': return <AlertTriangle className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl text-gray-900">Notifications</h2>
          <p className="text-gray-600">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            Mark All Read
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="all">
            All ({notifications.length})
          </TabsTrigger>
          <TabsTrigger value="unread">
            Unread ({unreadCount})
          </TabsTrigger>
          <TabsTrigger value="order">Orders</TabsTrigger>
          <TabsTrigger value="payment">Payments</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <p className="text-gray-600">Choose what notifications you want to receive</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium">Notification Types</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="order-updates">Order Updates</Label>
                      <p className="text-sm text-gray-600">New orders, status changes, completions</p>
                    </div>
                    <Switch
                      id="order-updates"
                      checked={settings.orderUpdates}
                      onCheckedChange={(checked) => setSettings({...settings, orderUpdates: checked})}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="payment-notifications">Payment Notifications</Label>
                      <p className="text-sm text-gray-600">Payment confirmations, earnings updates</p>
                    </div>
                    <Switch
                      id="payment-notifications"
                      checked={settings.paymentNotifications}
                      onCheckedChange={(checked) => setSettings({...settings, paymentNotifications: checked})}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="system-updates">System Updates</Label>
                      <p className="text-sm text-gray-600">App updates, maintenance notifications</p>
                    </div>
                    <Switch
                      id="system-updates"
                      checked={settings.systemUpdates}
                      onCheckedChange={(checked) => setSettings({...settings, systemUpdates: checked})}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="promotions">Promotions & Tips</Label>
                      <p className="text-sm text-gray-600">Special offers, driving tips, platform updates</p>
                    </div>
                    <Switch
                      id="promotions"
                      checked={settings.promotions}
                      onCheckedChange={(checked) => setSettings({...settings, promotions: checked})}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium">Delivery Methods</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="email-notifications">Email Notifications</Label>
                      <p className="text-sm text-gray-600">Receive notifications via email</p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={settings.emailNotifications}
                      onCheckedChange={(checked) => setSettings({...settings, emailNotifications: checked})}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="sms-notifications">SMS Notifications</Label>
                      <p className="text-sm text-gray-600">Receive notifications via text message</p>
                    </div>
                    <Switch
                      id="sms-notifications"
                      checked={settings.smsNotifications}
                      onCheckedChange={(checked) => setSettings({...settings, smsNotifications: checked})}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="push-notifications">Push Notifications</Label>
                      <p className="text-sm text-gray-600">Receive notifications in the app</p>
                    </div>
                    <Switch
                      id="push-notifications"
                      checked={settings.pushNotifications}
                      onCheckedChange={(checked) => setSettings({...settings, pushNotifications: checked})}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other tabs show notifications */}
        {['all', 'unread', 'order', 'payment', 'system'].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="space-y-1">
                    {getFilteredNotifications().length === 0 ? (
                      <div className="text-center py-12">
                        <Bell className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg text-gray-900 mb-2">No notifications</h3>
                        <p className="text-gray-600">
                          {tab === 'unread' ? 'All caught up! No unread notifications.' : 'No notifications in this category.'}
                        </p>
                      </div>
                    ) : (
                      getFilteredNotifications().map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-4 border-b hover:bg-gray-50 transition-colors ${
                            !notification.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1">
                              <div className={`p-2 rounded-lg ${getPriorityColor(notification.priority)}`}>
                                {getNotificationIcon(notification.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className={`text-sm ${!notification.read ? 'font-medium' : ''}`}>
                                    {notification.title}
                                  </h4>
                                  <div className="flex items-center space-x-2">
                                    {notification.priority === 'high' && (
                                      <Badge variant="destructive" className="text-xs">Urgent</Badge>
                                    )}
                                    <span className="text-xs text-gray-500">{notification.timestamp}</span>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                                {notification.actionable && (
                                  <Button size="sm" variant="outline" className="text-xs">
                                    {notification.actionText}
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              {!notification.read && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => markAsRead(notification.id)}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteNotification(notification.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                ×
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// Mock notifications data
const driverNotifications: Notification[] = [
  {
    id: 'D001',
    type: 'document',
    title: 'Document Verification Required',
    message: 'Your vehicle registration expires in 30 days. Please upload a new document to continue driving.',
    timestamp: '2 hours ago',
    read: false,
    priority: 'high',
    actionable: true,
    actionText: 'Upload Document'
  },
  {
    id: 'D002',
    type: 'order',
    title: 'New Order Available',
    message: 'Order ORD-1234 is available for pickup at Downtown Mall. Estimated earnings: $45',
    timestamp: '3 hours ago',
    read: false,
    priority: 'medium',
    actionable: true,
    actionText: 'View Order'
  },
  {
    id: 'D003',
    type: 'payment',
    title: 'Payment Received',
    message: 'You received $85 for completing order ORD-1200. Total weekly earnings: $312',
    timestamp: '5 hours ago',
    read: true,
    priority: 'low'
  },
  {
    id: 'D004',
    type: 'system',
    title: 'App Update Available',
    message: 'Version 2.1.0 is now available with improved route optimization and earnings tracking.',
    timestamp: '1 day ago',
    read: true,
    priority: 'low'
  },
  {
    id: 'D005',
    type: 'order',
    title: 'Order Completed',
    message: 'Order ORD-1200 has been marked as delivered. Customer rating: 5 stars',
    timestamp: '1 day ago',
    read: true,
    priority: 'low'
  }
];

const customerNotifications: Notification[] = [
  {
    id: 'C001',
    type: 'order',
    title: 'Order Out for Delivery',
    message: 'Your order ORD-5678 is now out for delivery. Expected arrival: 3:30 PM',
    timestamp: '30 minutes ago',
    read: false,
    priority: 'medium',
    actionable: true,
    actionText: 'Track Order'
  },
  {
    id: 'C002',
    type: 'order',
    title: 'Driver Assigned',
    message: 'Mike Johnson has been assigned to your order ORD-5678. He will arrive in 45 minutes.',
    timestamp: '1 hour ago',
    read: false,
    priority: 'medium',
    actionable: true,
    actionText: 'Contact Driver'
  },
  {
    id: 'C003',
    type: 'payment',
    title: 'Payment Successful',
    message: 'Your payment of $65 for order ORD-5677 has been processed successfully.',
    timestamp: '2 hours ago',
    read: true,
    priority: 'low'
  },
  {
    id: 'C004',
    type: 'order',
    title: 'Order Delivered',
    message: 'Your order ORD-5677 has been delivered successfully. Please rate your experience.',
    timestamp: '3 hours ago',
    read: true,
    priority: 'low',
    actionable: true,
    actionText: 'Rate Driver'
  },
  {
    id: 'C005',
    type: 'system',
    title: 'New Feature: Bulk Upload',
    message: 'You can now upload multiple orders via Excel. Save time and get better rates for bulk shipments.',
    timestamp: '2 days ago',
    read: true,
    priority: 'low',
    actionable: true,
    actionText: 'Try Now'
  }
];