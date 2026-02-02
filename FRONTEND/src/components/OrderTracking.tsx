import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Avatar, AvatarContent, AvatarFallback } from "./ui/avatar";
import { MapPin, Phone, MessageCircle, Clock, Package, CheckCircle, Truck, Star } from 'lucide-react';
import { orderApi, trackingApi } from '../src/lib/api';
import { toast } from 'sonner';

interface Order {
  id: string;
  status: 'pending' | 'accepted' | 'pickup' | 'in_transit' | 'delivered';
  customer?: string;
  driver?: {
    name: string;
    phone: string;
    vehicle: string;
    rating: number;
  };
  pickup: string;
  delivery: string;
  items: string;
  weight: number;
  volume: number;
  cost: number;
  estimatedTime: string;
  progress: number;
  timeline: {
    step: string;
    time?: string;
    completed: boolean;
  }[];
}

interface OrderTrackingProps {
  userType: 'driver' | 'customer';
}

export function OrderTracking({ userType }: OrderTrackingProps) {
  const [selectedOrder, setSelectedOrder] = useState<string>('ORD-001');

  const mockOrders: Order[] = [
    {
      id: 'ORD-001',
      status: 'in_transit',
      customer: 'John Smith',
      driver: {
        name: 'Mike Johnson',
        phone: '+1 (555) 123-4567',
        vehicle: 'Ford Transit 350 (ABC-123)',
        rating: 4.9
      },
      pickup: '123 Main St, Downtown',
      delivery: '456 Oak Ave, Uptown',
      items: 'Office furniture (desk, chair, filing cabinet)',
      weight: 150,
      volume: 3.2,
      cost: 85,
      estimatedTime: '45 mins',
      progress: 65,
      timeline: [
        { step: 'Order Placed', time: '2:15 PM', completed: true },
        { step: 'Driver Assigned', time: '2:18 PM', completed: true },
        { step: 'En Route to Pickup', time: '2:25 PM', completed: true },
        { step: 'Items Picked Up', time: '2:45 PM', completed: true },
        { step: 'In Transit', time: '2:50 PM', completed: true },
        { step: 'Delivered', completed: false }
      ]
    },
    {
      id: 'ORD-002',
      status: 'pending',
      customer: 'Sarah Williams',
      pickup: '789 Pine Rd, Westside',
      delivery: '321 Elm St, Eastside',
      items: 'Electronics package',
      weight: 12,
      volume: 0.5,
      cost: 35,
      estimatedTime: 'Pending driver assignment',
      progress: 10,
      timeline: [
        { step: 'Order Placed', time: '3:02 PM', completed: true },
        { step: 'Finding Driver', completed: false },
        { step: 'Driver Assigned', completed: false },
        { step: 'Pickup', completed: false },
        { step: 'Delivery', completed: false }
      ]
    },
    {
      id: 'ORD-003',
      status: 'delivered',
      customer: 'David Chen',
      driver: {
        name: 'Sarah Williams',
        phone: '+1 (555) 987-6543',
        vehicle: 'Mercedes Sprinter (XYZ-789)',
        rating: 4.7
      },
      pickup: '555 Broadway, Central',
      delivery: '888 Fifth Ave, North',
      items: 'Restaurant supplies',
      weight: 75,
      volume: 2.1,
      cost: 65,
      estimatedTime: 'Completed',
      progress: 100,
      timeline: [
        { step: 'Order Placed', time: '12:30 PM', completed: true },
        { step: 'Driver Assigned', time: '12:33 PM', completed: true },
        { step: 'Items Picked Up', time: '12:55 PM', completed: true },
        { step: 'In Transit', time: '1:10 PM', completed: true },
        { step: 'Delivered', time: '1:35 PM', completed: true }
      ]
    }
  ];

  const currentOrder = mockOrders.find(order => order.id === selectedOrder);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-blue-100 text-blue-800';
      case 'pickup': return 'bg-purple-100 text-purple-800';
      case 'in_transit': return 'bg-green-100 text-green-800';
      case 'delivered': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'accepted': return <CheckCircle className="h-4 w-4" />;
      case 'pickup': return <Package className="h-4 w-4" />;
      case 'in_transit': return <Truck className="h-4 w-4" />;
      case 'delivered': return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Orders List */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>
            {userType === 'driver' ? 'My Orders' : 'Your Orders'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockOrders.map((order) => (
              <div
                key={order.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedOrder === order.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedOrder(order.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium">{order.id}</span>
                  <Badge className={getStatusColor(order.status)}>
                    {order.status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  {userType === 'driver' ? order.customer : order.items}
                </p>
                <p className="text-sm text-green-600">${order.cost}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Order Details */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                {currentOrder && getStatusIcon(currentOrder.status)}
                Order {currentOrder?.id}
              </CardTitle>
              <p className="text-gray-600">
                {userType === 'driver' ? `Customer: ${currentOrder?.customer}` : `Items: ${currentOrder?.items}`}
              </p>
            </div>
            {currentOrder && (
              <Badge className={getStatusColor(currentOrder.status)}>
                {currentOrder.status.replace('_', ' ')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentOrder && (
            <>
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{currentOrder.progress}%</span>
                </div>
                <Progress value={currentOrder.progress} className="w-full" />
                <p className="text-sm text-gray-600">
                  ETA: {currentOrder.estimatedTime}
                </p>
              </div>

              {/* Driver/Customer Info */}
              {currentOrder.driver && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarFallback>
                            {currentOrder.driver.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-medium">
                            {userType === 'driver' ? 'You' : currentOrder.driver.name}
                          </h4>
                          <p className="text-sm text-gray-600">{currentOrder.driver.vehicle}</p>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500" />
                            <span className="text-sm">{currentOrder.driver.rating}</span>
                          </div>
                        </div>
                      </div>
                      {userType === 'customer' && (
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline">
                            <Phone className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Addresses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-green-500" />
                    Pickup Address
                  </h4>
                  <p className="text-sm text-gray-600 pl-6">{currentOrder.pickup}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-red-500" />
                    Delivery Address
                  </h4>
                  <p className="text-sm text-gray-600 pl-6">{currentOrder.delivery}</p>
                </div>
              </div>

              {/* Order Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-gray-500">Weight</p>
                  <p className="font-medium">{currentOrder.weight} kg</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Volume</p>
                  <p className="font-medium">{currentOrder.volume} m³</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Cost</p>
                  <p className="font-medium text-green-600">${currentOrder.cost}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="font-medium capitalize">{currentOrder.status.replace('_', ' ')}</p>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-3 pt-4 border-t">
                <h4 className="font-medium">Order Timeline</h4>
                <div className="space-y-3">
                  {currentOrder.timeline.map((step, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        step.completed ? 'bg-green-500' : 'bg-gray-300'
                      }`}></div>
                      <div className="flex-1">
                        <p className={`text-sm ${step.completed ? 'text-gray-900' : 'text-gray-500'}`}>
                          {step.step}
                        </p>
                        {step.time && (
                          <p className="text-xs text-gray-500">{step.time}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 border-t">
                {userType === 'driver' && currentOrder.status === 'in_transit' && (
                  <Button className="bg-green-600 hover:bg-green-700">
                    Mark as Delivered
                  </Button>
                )}
                {currentOrder.status === 'delivered' && (
                  <Button variant="outline">
                    <Star className="h-4 w-4 mr-2" />
                    Rate {userType === 'driver' ? 'Customer' : 'Driver'}
                  </Button>
                )}
                <Button variant="outline">View Full Details</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}