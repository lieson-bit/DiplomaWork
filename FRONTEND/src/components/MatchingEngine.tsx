import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { MapPin, Truck, Clock, Route, Users, Calculator } from 'lucide-react';

interface Driver {
  id: string;
  name: string;
  vehicle: string;
  location: string;
  capacity: {
    weight: number;
    volume: number;
    available: {
      weight: number;
      volume: number;
    }
  };
  status: 'available' | 'busy' | 'offline';
  currentRoute?: string;
  rating: number;
  estimatedArrival: string;
}

interface MatchingCriteria {
  location: string;
  weight: string;
  volume: string;
  category: string;
  radius: string;
}

export function MatchingEngine() {
  const [criteria, setCriteria] = useState<MatchingCriteria>({
    location: '',
    weight: '',
    volume: '',
    category: '',
    radius: '10'
  });
  
  const [matchedDrivers, setMatchedDrivers] = useState<Driver[]>([]);
  const [showOptimization, setShowOptimization] = useState(false);

  const mockDrivers: Driver[] = [
    {
      id: 'D001',
      name: 'Mike Johnson',
      vehicle: 'Ford Transit 350 (ABC-123)',
      location: 'Downtown, 2.3 km away',
      capacity: {
        weight: 2000,
        volume: 15,
        available: {
          weight: 1500,
          volume: 12
        }
      },
      status: 'available',
      rating: 4.9,
      estimatedArrival: '15 mins'
    },
    {
      id: 'D002',
      name: 'Sarah Williams',
      vehicle: 'Mercedes Sprinter (XYZ-789)',
      location: 'Midtown, 4.1 km away',
      capacity: {
        weight: 1500,
        volume: 12,
        available: {
          weight: 800,
          volume: 8
        }
      },
      status: 'busy',
      currentRoute: 'Delivering to Eastside → Available in 45 mins',
      rating: 4.7,
      estimatedArrival: '45 mins'
    },
    {
      id: 'D003',
      name: 'David Chen',
      vehicle: 'Isuzu NPR (DEF-456)',
      location: 'Uptown, 6.8 km away',
      capacity: {
        weight: 3000,
        volume: 20,
        available: {
          weight: 3000,
          volume: 20
        }
      },
      status: 'available',
      rating: 4.8,
      estimatedArrival: '25 mins'
    }
  ];

  const handleSearch = () => {
    // Mock matching algorithm
    const weight = parseFloat(criteria.weight);
    const volume = parseFloat(criteria.volume);
    
    const matched = mockDrivers.filter(driver => {
      const hasCapacity = driver.capacity.available.weight >= weight && 
                         driver.capacity.available.volume >= volume;
      return hasCapacity;
    }).sort((a, b) => {
      // Sort by availability first, then by distance
      if (a.status === 'available' && b.status !== 'available') return -1;
      if (a.status !== 'available' && b.status === 'available') return 1;
      return a.rating > b.rating ? -1 : 1;
    });
    
    setMatchedDrivers(matched);
  };

  const RouteOptimization = () => (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="h-5 w-5" />
          Route Optimization
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900">Optimized Route Suggestion</h4>
            <p className="text-sm text-blue-700 mt-1">
              Driver D001 can pick up 2 additional orders along the route, reducing costs by 30%
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h5 className="font-medium">Shared Route Benefits:</h5>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Reduced cost per delivery</li>
                <li>• Lower environmental impact</li>
                <li>• Faster delivery times</li>
                <li>• Better vehicle utilization</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h5 className="font-medium">Route Details:</h5>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Total Distance:</span>
                  <span>18.5 km</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Time:</span>
                  <span>65 mins</span>
                </div>
                <div className="flex justify-between">
                  <span>Fuel Savings:</span>
                  <span>40%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Driver Matching Engine
          </CardTitle>
          <p className="text-gray-600">Find the best drivers based on your requirements</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Pickup Location</Label>
              <Input
                id="location"
                placeholder="Enter address or area"
                value={criteria.location}
                onChange={(e) => setCriteria({...criteria, location: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                placeholder="Enter weight"
                value={criteria.weight}
                onChange={(e) => setCriteria({...criteria, weight: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="volume">Volume (m³)</Label>
              <Input
                id="volume"
                type="number"
                step="0.1"
                placeholder="Enter volume"
                value={criteria.volume}
                onChange={(e) => setCriteria({...criteria, volume: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={criteria.category} onValueChange={(value) => setCriteria({...criteria, category: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="documents">Documents</SelectItem>
                  <SelectItem value="furniture">Furniture</SelectItem>
                  <SelectItem value="construction">Construction</SelectItem>
                  <SelectItem value="electronics">Electronics</SelectItem>
                  <SelectItem value="food">Food & Beverages</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="radius">Search Radius (km)</Label>
              <Select value={criteria.radius} onValueChange={(value) => setCriteria({...criteria, radius: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 km</SelectItem>
                  <SelectItem value="10">10 km</SelectItem>
                  <SelectItem value="20">20 km</SelectItem>
                  <SelectItem value="50">50 km</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button 
                onClick={handleSearch}
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={!criteria.weight || !criteria.volume}
              >
                Find Drivers
              </Button>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => setShowOptimization(!showOptimization)}
              className="flex items-center gap-2"
            >
              <Route className="h-4 w-4" />
              {showOptimization ? 'Hide' : 'Show'} Route Optimization
            </Button>
          </div>
        </CardContent>
      </Card>

      {matchedDrivers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Matched Drivers ({matchedDrivers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {matchedDrivers.map((driver) => (
                <div key={driver.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{driver.name}</h4>
                        <Badge 
                          variant={driver.status === 'available' ? 'default' : 'secondary'}
                          className={driver.status === 'available' ? 'bg-green-100 text-green-800' : ''}
                        >
                          {driver.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{driver.vehicle}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-yellow-500">★</span>
                        <span className="text-sm">{driver.rating}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                        <MapPin className="h-3 w-3" />
                        {driver.location}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-blue-600">
                        <Clock className="h-3 w-3" />
                        ETA: {driver.estimatedArrival}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-sm">
                    <div>
                      <span className="text-gray-500">Max Weight:</span>
                      <p className="font-medium">{driver.capacity.weight} kg</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Max Volume:</span>
                      <p className="font-medium">{driver.capacity.volume} m³</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Available Weight:</span>
                      <p className="font-medium text-green-600">{driver.capacity.available.weight} kg</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Available Volume:</span>
                      <p className="font-medium text-green-600">{driver.capacity.available.volume} m³</p>
                    </div>
                  </div>
                  
                  {driver.currentRoute && (
                    <div className="mb-3 p-2 bg-yellow-50 rounded text-sm">
                      <span className="text-yellow-800">Current Route: {driver.currentRoute}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      Compatibility Score: <span className="font-medium text-green-600">95%</span>
                    </div>
                    <div className="space-x-2">
                      <Button variant="outline" size="sm">View Profile</Button>
                      <Button size="sm" disabled={driver.status !== 'available'}>
                        {driver.status === 'available' ? 'Request Driver' : 'Not Available'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {showOptimization && matchedDrivers.length > 0 && <RouteOptimization />}
    </div>
  );
}