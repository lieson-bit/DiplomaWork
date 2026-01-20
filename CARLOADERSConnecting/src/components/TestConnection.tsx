import React, { useState, useEffect } from 'react';
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';

export function TestConnection() {
  const [services, setServices] = useState([
    { name: 'User Service', url: 'http://localhost:3001', status: 'unknown', loading: true },
    { name: 'Driver Service', url: 'http://localhost:3002', status: 'unknown', loading: true },
    { name: 'Customer Service', url: 'http://localhost:3003', status: 'unknown', loading: true },
  ]);
  
  const [testing, setTesting] = useState(false);

  const testService = async (url: string) => {
    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        return { status: 'up', message: data.status || 'OK' };
      } else {
        return { status: 'down', message: `HTTP ${response.status}` };
      }
    } catch (error) {
      return { status: 'down', message: error.message || 'Connection failed' };
    }
  };

  const testAllServices = async () => {
    setTesting(true);
    
    const updatedServices = await Promise.all(
      services.map(async (service) => {
        const result = await testService(service.url);
        return {
          ...service,
          status: result.status,
          message: result.message,
          loading: false
        };
      })
    );
    
    setServices(updatedServices);
    setTesting(false);
  };

  useEffect(() => {
    testAllServices();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>API Connection Test</CardTitle>
            <Button onClick={testAllServices} disabled={testing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${testing ? 'animate-spin' : ''}`} />
              Test Again
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {services.map((service) => (
              <div key={service.name} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">{service.name}</h3>
                  <p className="text-sm text-gray-600">{service.url}</p>
                  {!service.loading && service.message && (
                    <p className="text-sm text-gray-500 mt-1">{service.message}</p>
                  )}
                </div>
                
                <div className="flex items-center">
                  {service.loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                      <span className="text-sm">Testing...</span>
                    </div>
                  ) : service.status === 'up' ? (
                    <Badge className="bg-green-100 text-green-800 flex items-center">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Online
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800 flex items-center">
                      <XCircle className="h-3 w-3 mr-1" />
                      Offline
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Troubleshooting Steps:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>1. Make sure all backend services are running</li>
              <li>2. Check that CORS is configured to allow localhost:5173</li>
              <li>3. Verify database connections in each service</li>
              <li>4. Run the seeding script to populate test data</li>
              <li>5. Check browser console for CORS errors</li>
            </ul>
          </div>

          <div className="mt-6">
            <h4 className="font-medium mb-2">Test Accounts:</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border rounded-lg">
                <p className="font-medium">Driver Account</p>
                <p className="text-sm text-gray-600">driver1@test.com</p>
                <p className="text-sm text-gray-600">password: password123</p>
              </div>
              <div className="p-3 border rounded-lg">
                <p className="font-medium">Customer Account</p>
                <p className="text-sm text-gray-600">customer1@test.com</p>
                <p className="text-sm text-gray-600">password: password123</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}