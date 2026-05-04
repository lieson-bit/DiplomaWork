// components/OrderTracking.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { MapPin, Phone, MessageCircle, Clock, Package, CheckCircle, Truck, Star, User, Navigation, Mail, Bell, Rocket } from 'lucide-react';
import { orderApi } from '../src/lib/api';
import { getCurrentUser } from '../src/lib/auth-utils';
import { toast } from 'sonner';
import { ChatModal } from './ChatModal';
import { ScrollArea } from "./ui/scroll-area";
import { NotificationCenter } from './NotificationCenter';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

interface OrderTrackingProps {
  userType: 'driver' | 'customer';
  onRateDriver?: (orderId: string, driverName: string) => void;
}

export function OrderTracking({ userType, onRateDriver }: OrderTrackingProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingReview, setRatingReview] = useState('');
  const [showChatModal, setShowChatModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Load orders list on mount
  useEffect(() => {
    loadOrders();
  }, [userType]);

  useEffect(() => {
  // Listen for order status updates from route optimization
  const handleOrderUpdate = (event: CustomEvent) => {
    const { orderId, status } = event.detail;
    if (selectedOrderId === orderId) {
      loadOrderProgress();
    }
    loadOrders(); // Refresh the orders list
  };
  
  window.addEventListener('orderStatusUpdated', handleOrderUpdate as EventListener);
  
  return () => {
    window.removeEventListener('orderStatusUpdated', handleOrderUpdate as EventListener);
  };
}, [selectedOrderId]);

  // Load selected order details and set up polling
  useEffect(() => {
    if (selectedOrderId) {
      loadOrderProgress();
      
      // Poll for updates every 10 seconds for real-time tracking
      const interval = setInterval(() => {
        loadOrderProgress();
      }, 10000);
      setPollingInterval(interval);
      
      return () => {
        if (pollingInterval) clearInterval(pollingInterval);
      };
    }
  }, [selectedOrderId]);

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      let response;
      if (userType === 'customer') {
        response = await orderApi.getCustomerOrders();
      } else {
        response = await orderApi.getDriverOrders();
      }
      
      if (response.success && response.data) {
        const ordersList = response.data.orders || [];
        setOrders(ordersList);
        
        // Auto-select first order if none selected and orders exist
        if (!selectedOrderId && ordersList.length > 0) {
          setSelectedOrderId(ordersList[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!selectedOrderId) return;
    try {
      const response = await orderApi.rateDriver(selectedOrderId, ratingValue, ratingReview);
      if (response.success) {
        toast.success('Thank you for rating the driver!');
        setShowRatingModal(false);
        await loadOrderProgress();
      } else {
        toast.error(response.error || 'Failed to submit rating');
      }
    } catch (error: any) {
      toast.error(error.message || 'Network error');
    }
  };

  const loadOrderProgress = async () => {
    if (!selectedOrderId) return;
    
    try {
      const response = await orderApi.getOrderProgress(selectedOrderId);
      if (response.success && response.data) {
        setCurrentOrder(response.data);
      }
    } catch (error) {
      console.error('Error loading order progress:', error);
    } finally {
      setLoading(false);
    }
  };

  // Driver actions
  const handleAcceptOrder = async () => {
    if (!selectedOrderId) return;
    
    try {
      const response = await orderApi.acceptOrder(selectedOrderId);
      if (response.success) {
        toast.success('Order accepted!');
        await loadOrders();
        await loadOrderProgress();
        // Show notification
        toast.info(`Order ${currentOrder?.order_number} has been assigned to you`);
      } else {
        toast.error(response.error || 'Failed to accept order');
      }
    } catch (error: any) {
      toast.error(error.message || 'Network error');
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedOrderId) return;
    
    try {
      let location;
      if (navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: true
          });
        });
        location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
      }
      
      const response = await orderApi.updateOrderStatus(selectedOrderId, status, location);
      if (response.success) {
        const statusMessages: Record<string, string> = {
          'route_to_pickup': 'You are on your way to pickup!',
          'in_transit': 'Delivery in progress!',
          'delivered': 'Order has been delivered!'
        };
        toast.success(statusMessages[status] || `Status updated to ${status.replace('_', ' ')}`);
        
        // If status is route_to_pickup, navigate to route optimization
        if (status === 'route_to_pickup') {
          toast.info('Opening route optimization for best delivery path...');
          // Navigate to route optimization page
          window.location.href = '/route-optimization';
        }
        
        await loadOrderProgress();
        await loadOrders();
      } else {
        toast.error(response.error || 'Failed to update status');
      }
    } catch (error: any) {
      toast.error(error.message || 'Network error');
    }
  };

  const handleCall = (phoneNumber: string | undefined) => {
    if (phoneNumber) {
      window.open(`tel:${phoneNumber}`);
    } else {
      toast.error('Phone number not available');
    }
  };

  const handleEmail = (email: string | undefined) => {
    if (email) {
      window.open(`mailto:${email}`);
    } else {
      toast.error('Email address not available');
    }
  };

  const handleOpenChat = () => {
    setShowChatModal(true);
  };

  const handleOpenNotifications = () => {
    setShowNotifications(true);
  };

  const handleRouteOptimization = () => {
    window.location.href = '/route-optimization';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'driver_assigned': 'bg-blue-100 text-blue-800',
      'route_to_pickup': 'bg-purple-100 text-purple-800',
      'in_transit': 'bg-green-100 text-green-800',
      'delivered': 'bg-gray-100 text-gray-800',
      'cancelled': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return <CheckCircle className="h-4 w-4" />;
      case 'in_transit': return <Truck className="h-4 w-4" />;
      case 'route_to_pickup': return <Navigation className="h-4 w-4" />;
      case 'driver_assigned': return <Clock className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getProgressPercentage = () => {
    if (!currentOrder?.progress) return 0;
    return currentOrder.progress.progressPercentage || 0;
  };

  const getTimelineSteps = () => {
    if (!currentOrder?.progress?.steps) return [];
    return currentOrder.progress.steps;
  };

  if (loadingOrders) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-600">
            {userType === 'customer' 
              ? 'You haven\'t placed any orders yet.' 
              : 'No orders assigned to you yet.'}
          </p>
          {userType === 'customer' && (
            <Button className="mt-4" onClick={() => window.location.href = '/customer-booking'}>
              Create New Order
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                {userType === 'customer' ? 'My Orders' : 'My Deliveries'}
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleOpenNotifications}
                className="relative"
              >
                <Bell className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {orders.slice(0, 4).map((order) => (
                  <div
                    key={order.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedOrderId === order.id 
                        ? 'bg-blue-50 border-blue-300' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm">
                        #{order.order_number?.slice(-8) || order.id?.slice(-8)}
                      </span>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status?.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      {order.package_details?.category || 'General'}
                    </p>
                    <p className="text-sm text-green-600">
                      ${order.pricing?.estimated_usd || '0'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
                {orders.length > 4 && (
                  <div className="text-center text-sm text-gray-500 py-2">
                    +{orders.length - 4} more orders (scroll to see all)
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Order Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {currentOrder && getStatusIcon(currentOrder.status)}
                  Order Details
                </CardTitle>
                <p className="text-gray-600 text-sm">
                  {currentOrder?.order_number || selectedOrderId}
                </p>
              </div>
              {currentOrder && (
                <Badge className={getStatusColor(currentOrder.status)}>
                  {currentOrder.status?.replace('_', ' ').toUpperCase()}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading && !currentOrder ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : currentOrder ? (
              <>
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{getProgressPercentage()}%</span>
                  </div>
                  <Progress value={getProgressPercentage()} className="h-2" />
                  {currentOrder.timing?.estimatedDuration?.formatted && (
                    <p className="text-sm text-gray-600">
                      Estimated time: {currentOrder.timing.estimatedDuration.formatted}
                    </p>
                  )}
                </div>

                {/* Timeline Steps */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-700">Timeline</h4>
                  <div className="space-y-2">
                    {getTimelineSteps().map((step: any, index: number) => (
                      <div key={index} className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${
                          step.completed ? 'bg-green-500' : 'bg-gray-300'
                        }`}></div>
                        <div className="flex-1">
                          <p className={`text-sm ${step.completed ? 'text-gray-900' : 'text-gray-500'}`}>
                            {step.label}
                          </p>
                        </div>
                        {step.timestamp && (
                          <span className="text-xs text-gray-400">
                            {new Date(step.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Driver Info (for customers) - Enhanced with email and phone */}
                {userType === 'customer' && currentOrder.driver_info && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-sm text-gray-700 mb-3 flex items-center gap-2">
                      <Truck className="h-4 w-4 text-blue-600" />
                      Driver Information
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-blue-100 text-blue-600 text-lg">
                              {currentOrder.driver_info.name?.[0] || 'D'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-gray-900">{currentOrder.driver_info.name}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Star className="h-3 w-3 text-yellow-500" />
                              <span className="text-sm text-gray-600">
                                {currentOrder.driver_info.rating 
                                  ? typeof currentOrder.driver_info.rating === 'number' 
                                    ? currentOrder.driver_info.rating.toFixed(1) 
                                    : parseFloat(currentOrder.driver_info.rating).toFixed(1)
                                  : 'N/A'}
                              </span>
                            </div>
                            {currentOrder.vehicle_info && (
                              <p className="text-xs text-gray-500 mt-1">
                                {currentOrder.vehicle_info.typeFormatted || currentOrder.vehicle_info.type}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Contact Information Section */}
                      <div className="border-t pt-3 mt-2">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Contact Information</h5>
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleCall(currentOrder.driver_info.phone)}
                            className="flex items-center gap-2"
                          >
                            <Phone className="h-3 w-3" />
                            Call Driver
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleEmail(currentOrder.driver_info.email)}
                            className="flex items-center gap-2"
                          >
                            <Mail className="h-3 w-3" />
                            Email Driver
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={handleOpenChat}
                            className="flex items-center gap-2 col-span-2"
                          >
                            <MessageCircle className="h-3 w-3" />
                            Chat with Driver
                          </Button>
                        </div>
                        {currentOrder.driver_info.phone && (
                          <p className="text-xs text-gray-500 mt-2">Phone: {currentOrder.driver_info.phone}</p>
                        )}
                        {currentOrder.driver_info.email && (
                          <p className="text-xs text-gray-500">Email: {currentOrder.driver_info.email}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Customer Info (for drivers) - Enhanced with email and phone */}
                {userType === 'driver' && currentOrder.customer_info && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-sm text-gray-700 mb-3 flex items-center gap-2">
                      <User className="h-4 w-4 text-green-600" />
                      Customer Information
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{currentOrder.customer_info.name}</p>
                        </div>
                      </div>

                      {/* Contact Information Section */}
                      <div className="border-t pt-3 mt-2">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Contact Information</h5>
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleCall(currentOrder.customer_info.phone)}
                            className="flex items-center gap-2"
                          >
                            <Phone className="h-3 w-3" />
                            Call Customer
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleEmail(currentOrder.customer_info.email)}
                            className="flex items-center gap-2"
                          >
                            <Mail className="h-3 w-3" />
                            Email Customer
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={handleOpenChat}
                            className="flex items-center gap-2 col-span-2"
                          >
                            <MessageCircle className="h-3 w-3" />
                            Chat with Customer
                          </Button>
                        </div>
                        {currentOrder.customer_info.phone && (
                          <p className="text-xs text-gray-500 mt-2">Phone: {currentOrder.customer_info.phone}</p>
                        )}
                        {currentOrder.customer_info.email && (
                          <p className="text-xs text-gray-500">Email: {currentOrder.customer_info.email}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Locations */}
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Pickup</p>
                      <p className="text-sm text-gray-600">{currentOrder.pickup_location?.address}</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Delivery</p>
                      <p className="text-sm text-gray-600">{currentOrder.delivery_location?.address}</p>
                    </div>
                  </div>
                </div>

                {/* Package Details */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500">Category</p>
                    <p className="text-sm font-medium">{currentOrder.package_details?.category || 'General'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Weight</p>
                    <p className="text-sm font-medium">{currentOrder.package_details?.weight_kg} kg</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Volume</p>
                    <p className="text-sm font-medium">{currentOrder.package_details?.volume_m3} m³</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Price</p>
                    <p className="text-sm font-medium text-green-600">${currentOrder.pricing?.estimated_usd}</p>
                  </div>
                </div>

                {/* Action Buttons - Driver Actions */}
                {userType === 'driver' && (
                  <div className="flex flex-wrap gap-3 pt-2">
                    {currentOrder.status === 'pending' && (
                      <Button onClick={handleAcceptOrder} className="bg-green-600 hover:bg-green-700">
                        Accept Order
                      </Button>
                    )}
                    
                    {currentOrder.status === 'driver_assigned' && (
                      <Button onClick={() => handleUpdateStatus('route_to_pickup')} className="bg-blue-600 hover:bg-blue-700">
                        <Rocket className="h-4 w-4 mr-2" />
                        Start to Pickup → Route Optimization
                      </Button>
                    )}
                    
                    {currentOrder.status === 'route_to_pickup' && (
                      <Button onClick={() => handleUpdateStatus('in_transit')} className="bg-blue-600 hover:bg-blue-700">
                        <Truck className="h-4 w-4 mr-2" />
                        Start Delivery
                      </Button>
                    )}
                    
                    {currentOrder.status === 'in_transit' && (
                      <Button onClick={() => handleUpdateStatus('delivered')} className="bg-green-600 hover:bg-green-700">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark as Delivered
                      </Button>
                    )}

                    <Button 
                      variant="outline" 
                      onClick={handleRouteOptimization}
                      className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300"
                    >
                      <Navigation className="h-4 w-4 mr-2" />
                      View Route Optimization
                    </Button>
                  </div>
                )}

                {/* Action Buttons - Customer Actions */}
                {userType === 'customer' && currentOrder.status === 'delivered' && (
                  <Button onClick={() => setShowRatingModal(true)} className="bg-yellow-600 hover:bg-yellow-700">
                    <Star className="h-4 w-4 mr-2" />
                    Rate Driver
                  </Button>
                )}

                {/* Route Optimization Suggestion */}
                {userType === 'driver' && currentOrder.status === 'driver_assigned' && (
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-start gap-3">
                      <Navigation className="h-5 w-5 text-purple-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-purple-800">Route Optimization Available</p>
                        <p className="text-xs text-purple-600 mt-1">
                          Click "Start to Pickup" to open route optimization for the best delivery path.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">Select an order to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Rate Your Driver</h3>
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRatingValue(star)}
                  className={`text-3xl ${star <= ratingValue ? 'text-yellow-500' : 'text-gray-300'}`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              className="w-full p-2 border rounded-lg mb-4"
              rows={3}
              placeholder="Share your experience (optional)"
              value={ratingReview}
              onChange={(e) => setRatingReview(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={handleSubmitRating} className="flex-1 bg-yellow-600 hover:bg-yellow-700">
                Submit Rating
              </Button>
              <Button onClick={() => setShowRatingModal(false)} variant="outline" className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      <ChatModal
        isOpen={showChatModal}
        onClose={() => setShowChatModal(false)}
        orderId={selectedOrderId!}
        driverName={userType === 'customer' ? currentOrder?.driver_info?.name : currentOrder?.customer_info?.name}
        driverPhone={userType === 'customer' ? currentOrder?.driver_info?.phone : currentOrder?.customer_info?.phone}
        userType={userType}
      />

      {/* Notifications Modal */}
      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </DialogTitle>
          </DialogHeader>
          <NotificationCenter userType={userType} />
        </DialogContent>
      </Dialog>
    </>
  );
}