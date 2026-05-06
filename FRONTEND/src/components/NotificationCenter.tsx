// components/NotificationCenter.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import { Bell, Package, Truck, DollarSign, AlertTriangle, CheckCircle, Clock, MessageSquare, Settings, RefreshCw, Loader2 } from 'lucide-react';
import { orderApi } from '../src/lib/api';
import { toast } from 'sonner';
import { useLanguage } from './LanguageContext';

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
  actionLink?: string;
  orderId?: string;
  orderNumber?: string;
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
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    orderUpdates: true,
    paymentNotifications: true,
    systemUpdates: true,
    promotions: false,
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: true
  });

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem(`${userType}_notification_settings`);
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error('Error loading notification settings:', error);
      }
    }
  }, [userType]);

  // Load notifications on mount and set up polling
  useEffect(() => {
    loadNotifications();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      loadNotifications(true); // Silent refresh
    }, 30000);
    
    return () => clearInterval(interval);
  }, [userType]);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`${userType}_notification_settings`, JSON.stringify(settings));
  }, [settings, userType]);

  const loadNotifications = async (silent: boolean = false) => {
    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    
    try {
      const response = await orderApi.getNotifications();
      
      if (response.success && response.data) {
        let notificationsData = [];
        
        // Handle different response structures
        if (Array.isArray(response.data)) {
          notificationsData = response.data;
        } else if (response.data.notifications) {
          notificationsData = response.data.notifications;
        } else if (response.data.data?.notifications) {
          notificationsData = response.data.data.notifications;
        }
        
        // Format timestamps for display
        const formattedNotifications = notificationsData.map((notif: any) => ({
          ...notif,
          timestamp: formatTimestamp(notif.timestamp)
        }));
        
        setNotifications(formattedNotifications);
        
        if (!silent && formattedNotifications.length > 0) {
          const unreadCount = formattedNotifications.filter((n: Notification) => !n.read).length;
          if (unreadCount > 0) {
            toast.info(`You have ${unreadCount} new notification${unreadCount > 1 ? 's' : ''}`);
          }
        }
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      if (!silent) {
        toast.error('Failed to load notifications');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  const formatTimestamp = (timestamp: string | Date): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const markAsRead = async (id: string) => {
    try {
      const response = await orderApi.markNotificationRead(id);
      if (response.success) {
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === id ? { ...notif, read: true } : notif
          )
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await orderApi.markAllNotificationsRead();
      if (response.success) {
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, read: true }))
        );
        toast.success('All notifications marked as read');
      } else {
        toast.error(response.error || 'Failed to mark all as read');
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const response = await orderApi.deleteNotification(id);
      if (response.success) {
        setNotifications(prev => prev.filter(notif => notif.id !== id));
        toast.success('Notification deleted');
      } else {
        toast.error(response.error || 'Failed to delete notification');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const handleAction = (notification: Notification) => {
    if (notification.actionLink) {
      window.location.href = notification.actionLink;
    }
    if (notification.orderId) {
      localStorage.setItem('selectedOrderId', notification.orderId);
    }
    markAsRead(notification.id);
  };

  const getFilteredNotifications = () => {
    let filtered = [...notifications];
    
    // Filter by settings
    if (!settings.orderUpdates) {
      filtered = filtered.filter(n => n.type !== 'order');
    }
    if (!settings.paymentNotifications) {
      filtered = filtered.filter(n => n.type !== 'payment');
    }
    if (!settings.systemUpdates) {
      filtered = filtered.filter(n => n.type !== 'system');
    }
    
    // Filter by tab
    if (activeTab === 'unread') {
      filtered = filtered.filter(n => !n.read);
    } else if (activeTab !== 'all' && activeTab !== 'settings') {
      filtered = filtered.filter(n => n.type === activeTab);
    }
    
    return filtered;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
          <p className="text-gray-600">
            {unreadCount > 0 
              ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'All caught up!'}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => loadNotifications()}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
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
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No notifications</h3>
                        <p className="text-gray-600">
                          {tab === 'unread' ? 'All caught up! No unread notifications.' : 'No notifications in this category.'}
                        </p>
                      </div>
                    ) : (
                      getFilteredNotifications().map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-4 border-b hover:bg-gray-50 transition-colors cursor-pointer ${
                            !notification.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                          }`}
                          onClick={() => handleAction(notification)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1">
                              <div className={`p-2 rounded-lg ${getPriorityColor(notification.priority)}`}>
                                {getNotificationIcon(notification.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className={`text-sm ${!notification.read ? 'font-semibold' : ''}`}>
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
                                {notification.actionable && notification.actionText && (
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAction(notification);
                                    }}
                                  >
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(notification.id);
                                  }}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notification.id);
                                }}
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