import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { CheckCircle, XCircle, AlertTriangle, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { driverApi, getAuthToken } from '../src/lib/api';
import { getCurrentUser } from '../src/lib/auth-utils';

interface DebugPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

interface ServiceStatus {
  userService: {
    status?: number;
    ok: boolean;
    url?: string;
    error?: string;
  };
  driverService: {
    status?: number;
    ok: boolean;
    url?: string;
    error?: string;
  };
  driverProfile: {
    success?: boolean;
    status?: number;
    error?: string;
  };
}

export function DebugPanel({ isVisible, onClose }: DebugPanelProps) {
  const [debugInfo, setDebugInfo] = useState({});
  const [apiStatus, setApiStatus] = useState({
    userService: { ok: false },
    driverService: { ok: false },
    driverProfile: { success: false }
  });
  const [isTesting, setIsTesting] = useState(false);

  const gatherDebugInfo = async () => {
    const user = getCurrentUser();
    const token = getAuthToken();
    
    const info = {
      timestamp: new Date().toISOString(),
      localStorage: {
        user: user,
        tokenExists: !!token,
        tokenLength: token?.length || 0,
        userId: localStorage.getItem('userId'),
        userType: localStorage.getItem('userType'),
      },
      environment: {
        driverServiceUrl: import.meta.env.VITE_DRIVER_SERVICE_URL || 'Not set',
        userServiceUrl: import.meta.env.VITE_USER_SERVICE_URL || 'Not set',
      },
      browser: {
        userAgent: navigator.userAgent,
        online: navigator.onLine,
      }
    };
    
    setDebugInfo(info);
  };

  const testAPIConnection = async () => {
    setIsTesting(true);
    try {
      const results: ServiceStatus = {
        userService: { ok: false },
        driverService: { ok: false },
        driverProfile: { success: false }
      };
      
      // Test User Service
      const userServiceUrl = import.meta.env.VITE_USER_SERVICE_URL;
      if (userServiceUrl) {
        try {
          const userResponse = await fetch(`${userServiceUrl}/health`);
          results.userService = {
            status: userResponse.status,
            ok: userResponse.ok,
            url: userServiceUrl,
          };
        } catch (error: any) {
          results.userService = {
            error: error.message,
            ok: false,
          };
        }
      }
      
      // Test Driver Service
      const driverServiceUrl = import.meta.env.VITE_DRIVER_SERVICE_URL;
      if (driverServiceUrl) {
        try {
          const driverResponse = await fetch(`${driverServiceUrl}/health`);
          results.driverService = {
            status: driverResponse.status,
            ok: driverResponse.ok,
            url: driverServiceUrl,
          };
        } catch (error: any) {
          results.driverService = {
            error: error.message,
            ok: false,
          };
        }
      }
      
      // Test Driver Profile API
      try {
        const profileResponse = await driverApi.getProfile();
        results.driverProfile = {
          success: profileResponse.success,
          error: profileResponse.error,
        };
      } catch (error: any) {
        results.driverProfile = {
          error: error.message,
          success: false,
        };
      }
      
      setApiStatus(results);
    } catch (error: any) {
      console.error('API test error:', error);
    } finally {
      setIsTesting(false);
    }
  };

  const copyDebugInfo = () => {
    const debugText = JSON.stringify({
      debugInfo,
      apiStatus,
      timestamp: new Date().toISOString(),
    }, null, 2);
    
    navigator.clipboard.writeText(debugText);
    toast.success('Debug info copied to clipboard');
  };

  useEffect(() => {
    if (isVisible) {
      gatherDebugInfo();
      testAPIConnection();
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Debug Panel
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyDebugInfo}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={testAPIConnection} disabled={isTesting}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isTesting ? 'animate-spin' : ''}`} />
                Test APIs
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* API Status */}
          <div>
            <h3 className="font-medium mb-2">API Service Status</h3>
            <div className="space-y-2">
              {Object.entries(apiStatus).map(([service, data]) => {
                const serviceData = data as ServiceStatus['userService' | 'driverService' | 'driverProfile'];
                return (
                  <div key={service} className="flex items-center justify-between p-2 border rounded">
                    <span className="font-medium capitalize">{service.replace('Service', ' Service')}</span>
                    <Badge className={
                      serviceData.status || (serviceData as any).success 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }>
                      {serviceData.status || (serviceData as any).success ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {serviceData.status || (serviceData as any).success ? 'Connected' : 'Failed'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Local Storage Info */}
          <div>
            <h3 className="font-medium mb-2">Authentication Status</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 border rounded">
                  <span className="text-sm text-gray-600">Token Exists</span>
                  <div className="font-medium">
                    {debugInfo.localStorage?.tokenExists ? 'Yes' : 'No'}
                  </div>
                </div>
                <div className="p-2 border rounded">
                  <span className="text-sm text-gray-600">User Type</span>
                  <div className="font-medium">
                    {debugInfo.localStorage?.userType || 'Not set'}
                  </div>
                </div>
                <div className="p-2 border rounded">
                  <span className="text-sm text-gray-600">User ID</span>
                  <div className="font-medium text-sm truncate">
                    {debugInfo.localStorage?.userId || 'Not set'}
                  </div>
                </div>
                <div className="p-2 border rounded">
                  <span className="text-sm text-gray-600">Browser Online</span>
                  <div className="font-medium">
                    {debugInfo.browser?.online ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Environment Variables */}
          <div>
            <h3 className="font-medium mb-2">Environment</h3>
            <div className="space-y-2">
              <div className="p-2 border rounded">
                <span className="text-sm text-gray-600">Driver Service URL</span>
                <div className="font-medium text-sm">
                  {debugInfo.environment?.driverServiceUrl}
                </div>
              </div>
              <div className="p-2 border rounded">
                <span className="text-sm text-gray-600">User Service URL</span>
                <div className="font-medium text-sm">
                  {debugInfo.environment?.userServiceUrl}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="font-medium mb-2">Quick Actions</h3>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
              >
                Clear Storage & Reload
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  console.log('Debug Info:', debugInfo);
                  console.log('API Status:', apiStatus);
                  toast.info('Debug info logged to console');
                }}
              >
                Log to Console
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const driverServiceUrl = import.meta.env.VITE_DRIVER_SERVICE_URL;
                  if (driverServiceUrl) {
                    window.open(`${driverServiceUrl}/api/docs`, '_blank');
                  }
                }}
              >
                Open API Docs
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}