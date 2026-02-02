import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { MapPin, Navigation, Package, Clock, TrendingUp, Map, CheckCircle2 } from 'lucide-react';
import { orderApi } from '../src/lib/api';
import { toast } from 'sonner';

interface RouteStop {
  id: string;
  orderNumber: string;
  address: string;
  customerName: string;
  packageDetails: string;
  estimatedTime: string;
  distance: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed';
}

interface RouteOptimization {
  totalDistance: string;
  estimatedDuration: string;
  numberOfStops: number;
  estimatedEarnings: string;
  fuelCost: string;
  netEarnings: string;
}

export function DriverRouteOptimization() {
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [optimization, setOptimization] = useState<RouteOptimization | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);

  useEffect(() => {
    loadDriverOrders();
  }, []);

  const loadDriverOrders = async () => {
    try {
      setLoading(true);
      // Fetch driver's accepted orders
      const response = await orderService.getDriverOrders();
      
      // Mock route optimization data - In production, this would come from a route optimization algorithm
      const mockStops: RouteStop[] = [
        {
          id: '1',
          orderNumber: 'ORD-1001',
          address: '123 Main St, Downtown',
          customerName: 'John Doe',
          packageDetails: '2 boxes (15kg)',
          estimatedTime: '9:00 AM',
          distance: '2.5 km',
          priority: 'high',
          status: 'pending'
        },
        {
          id: '2',
          orderNumber: 'ORD-1002',
          address: '456 Oak Ave, Midtown',
          customerName: 'Jane Smith',
          packageDetails: '1 pallet (45kg)',
          estimatedTime: '9:25 AM',
          distance: '3.8 km',
          priority: 'medium',
          status: 'pending'
        },
        {
          id: '3',
          orderNumber: 'ORD-1003',
          address: '789 Pine Rd, Uptown',
          customerName: 'Bob Johnson',
          packageDetails: '3 boxes (22kg)',
          estimatedTime: '10:10 AM',
          distance: '5.2 km',
          priority: 'high',
          status: 'pending'
        },
        {
          id: '4',
          orderNumber: 'ORD-1004',
          address: '321 Elm St, Westside',
          customerName: 'Alice Brown',
          packageDetails: '1 box (8kg)',
          estimatedTime: '10:45 AM',
          distance: '4.1 km',
          priority: 'low',
          status: 'pending'
        },
        {
          id: '5',
          orderNumber: 'ORD-1005',
          address: '654 Maple Dr, Eastside',
          customerName: 'Charlie Davis',
          packageDetails: '5 boxes (38kg)',
          estimatedTime: '11:30 AM',
          distance: '6.8 km',
          priority: 'medium',
          status: 'pending'
        }
      ];

      const mockOptimization: RouteOptimization = {
        totalDistance: '22.4 km',
        estimatedDuration: '2h 45m',
        numberOfStops: 5,
        estimatedEarnings: '$125.00',
        fuelCost: '$8.96',
        netEarnings: '$116.04'
      };

      setRouteStops(mockStops);
      setOptimization(mockOptimization);
    } catch (error) {
      console.error('Error loading driver orders:', error);
      toast.error('Failed to load route information');
    } finally {
      setLoading(false);
    }
  };

  const handleOptimizeRoute = async () => {
    try {
      setOptimizing(true);
      toast.info('Optimizing route...');
      
      // Simulate route optimization API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In production, this would call a route optimization service
      // that uses algorithms like Dijkstra's or A* for optimal routing
      
      toast.success('Route optimized successfully!');
      loadDriverOrders();
    } catch (error) {
      console.error('Error optimizing route:', error);
      toast.error('Failed to optimize route');
    } finally {
      setOptimizing(false);
    }
  };

  const handleMarkComplete = (stopId: string) => {
    setRouteStops(prev => 
      prev.map(stop => 
        stop.id === stopId 
          ? { ...stop, status: 'completed' as const }
          : stop
      )
    );
    toast.success('Delivery marked as complete');
  };

  const handleStartDelivery = (stopId: string) => {
    setRouteStops(prev => 
      prev.map(stop => 
        stop.id === stopId 
          ? { ...stop, status: 'in-progress' as const }
          : stop
      )
    );
    toast.info('Delivery started');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in-progress': return 'bg-blue-500';
      case 'pending': return 'bg-gray-300';
      default: return 'bg-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading route information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900">Optimized Delivery Route</h2>
          <p className="text-gray-600 mt-1">Your most efficient route for today's deliveries</p>
        </div>
        <Button 
          onClick={handleOptimizeRoute}
          disabled={optimizing}
          className="flex items-center gap-2"
        >
          <Navigation className="h-4 w-4" />
          {optimizing ? 'Optimizing...' : 'Re-optimize Route'}
        </Button>
      </div>

      {/* Route Summary */}
      {optimization && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600">Total Distance</p>
                  <p className="text-gray-900 mt-1">{optimization.totalDistance}</p>
                </div>
                <Map className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600">Duration</p>
                  <p className="text-gray-900 mt-1">{optimization.estimatedDuration}</p>
                </div>
                <Clock className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600">Stops</p>
                  <p className="text-gray-900 mt-1">{optimization.numberOfStops}</p>
                </div>
                <Package className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600">Earnings</p>
                  <p className="text-gray-900 mt-1">{optimization.estimatedEarnings}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600">Fuel Cost</p>
                  <p className="text-gray-900 mt-1">{optimization.fuelCost}</p>
                </div>
                <div className="h-8 w-8 text-red-600 flex items-center justify-center">⛽</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600">Net Earnings</p>
                  <p className="text-green-600 mt-1">{optimization.netEarnings}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Route Map Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Route Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 rounded-lg h-80 flex items-center justify-center">
            <div className="text-center">
              <Map className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Interactive route map</p>
              <p className="text-gray-500 mt-2">Map visualization would be integrated here using Google Maps or Mapbox</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Route Stops */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Stops</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {routeStops.map((stop, index) => (
              <div 
                key={stop.id} 
                className={`border rounded-lg p-4 ${
                  stop.status === 'completed' 
                    ? 'bg-green-50 border-green-200' 
                    : stop.status === 'in-progress'
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Stop Number */}
                  <div className="flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full ${getStatusColor(stop.status)} flex items-center justify-center text-white`}>
                      {stop.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        index + 1
                      )}
                    </div>
                  </div>

                  {/* Stop Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-gray-900">{stop.orderNumber}</p>
                          <Badge className={getPriorityColor(stop.priority)}>
                            {stop.priority}
                          </Badge>
                          {stop.status === 'completed' && (
                            <Badge className="bg-green-100 text-green-800">Completed</Badge>
                          )}
                          {stop.status === 'in-progress' && (
                            <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-gray-600">Address</p>
                              <p className="text-gray-900">{stop.address}</p>
                            </div>
                          </div>

                          <div className="flex items-start gap-2">
                            <Package className="h-4 w-4 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-gray-600">Package</p>
                              <p className="text-gray-900">{stop.packageDetails}</p>
                            </div>
                          </div>

                          <div className="flex items-start gap-2">
                            <Clock className="h-4 w-4 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-gray-600">ETA</p>
                              <p className="text-gray-900">{stop.estimatedTime}</p>
                            </div>
                          </div>

                          <div className="flex items-start gap-2">
                            <Navigation className="h-4 w-4 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-gray-600">Distance</p>
                              <p className="text-gray-900">{stop.distance} from previous</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {stop.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => handleStartDelivery(stop.id)}
                          >
                            Start
                          </Button>
                        )}
                        {stop.status === 'in-progress' && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleMarkComplete(stop.id)}
                          >
                            Complete
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Open navigation app
                            toast.info('Opening navigation...');
                          }}
                        >
                          <Navigation className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tips Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <Navigation className="h-5 w-5 text-white" />
              </div>
            </div>
            <div>
              <p className="text-blue-900">Route Optimization Tips</p>
              <ul className="mt-2 space-y-1 text-blue-800">
                <li>• High priority deliveries are scheduled earlier in the route</li>
                <li>• Route minimizes backtracking and traffic congestion</li>
                <li>• Consider traffic patterns when viewing estimated times</li>
                <li>• Re-optimize if you need to add or remove stops during your route</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
