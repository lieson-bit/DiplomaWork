import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";
import { Truck, User, Package, MapPin, Clock, Star } from 'lucide-react';
import { DriverDashboard } from './components/DriverDashboard';
import { CustomerBooking } from './components/CustomerBooking';
import { MatchingEngine } from './components/MatchingEngine';
import { OrderTracking } from './components/OrderTracking';
import { BulkBooking } from './components/BulkBooking';
import { LandingPage } from './src/components/LandingPage';
import { AuthPage } from './components/AuthPage';
import { DriverOnboarding } from './components/DriverOnboarding';
import { CustomerOnboarding } from './components/CustomerOnboarding';
import { NotificationCenter } from './components/NotificationCenter';
import { DriverProfile } from './components/DriverProfile';
import { CustomerProfile } from './components/CustomerProfile';
import { DriverEarnings } from './components/DriverEarnings';
import { DriverRouteOptimization } from './components/DriverRouteOptimization';
import { LanguageProvider, useLanguage } from './components/LanguageContext';
import { LanguageSelector } from './components/LanguageSelector';
import { Toaster } from './components/ui/sonner';
import { authApi } from './src/lib/api';
import { seedInitialData } from './src/lib/seed-data';
import './styles/globals.css';
import { TestConnection } from './components/TestConnection';


type AppState = 'landing' | 'auth' | 'onboarding' | 'dashboard';

function AppContent() {
  const { t } = useLanguage();
  const [appState, setAppState] = useState('landing');
  const [userType, setUserType] = useState(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');

  if (appState === 'test') {
    return <TestConnection />;
  }

  useEffect(() => {
    // Seed initial data on app mount
    seedInitialData();
  }, []);

  const handleGetStarted = () => {
    setAppState('auth');
  };

  const handleBackToLanding = () => {
    setAppState('landing');
    setUserType(null);
    setIsNewUser(false);
  };

  const handleLogin = (type: 'driver' | 'customer', newUser: boolean) => {
    setUserType(type);
    setIsNewUser(newUser);
    
    if (newUser) {
      setAppState('onboarding');
    } else {
      setAppState('dashboard');
    }
  };
  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.warn('Logout error:', error);
    } finally {
      setAppState('landing');
      setUserType(null);
      setIsNewUser(false);
      //Toaster.success('Logged out successfully');
    }
  };

  const handleOnboardingComplete = () => {
    setAppState('dashboard');
    setIsNewUser(false);
  };

  // Landing Page
  if (appState === 'landing') {
    return <LandingPage onGetStarted={handleGetStarted} />;
  }

  // Authentication Page
  if (appState === 'auth') {
    return <AuthPage onBack={handleBackToLanding} onLogin={handleLogin} />;
  }

  // Onboarding Pages
  if (appState === 'onboarding' && isNewUser) {
    if (userType === 'driver') {
      return <DriverOnboarding onComplete={handleOnboardingComplete} />;
    } else {
      return <CustomerOnboarding onComplete={handleOnboardingComplete} />;
    }
  }

  // Dashboard - existing code
  if (appState === 'dashboard' && userType) {

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Truck className="h-8 w-8 text-blue-600 mr-3" />
                <h1 className="text-xl text-gray-900">{t('app.name')}</h1>
                <Badge variant="secondary" className="ml-3">
                  {userType === 'driver' ? t('header.driver') : t('header.customer')}
                </Badge>
              </div>
              <div className="flex items-center space-x-4">
                <LanguageSelector />
                <Button 
                  variant="outline" 
                  onClick={() => {
                    authApi.logout();
                    setAppState('landing');
                    setUserType(null);
                    setIsNewUser(false);
                  }}
                >
                  {t('common.logout')}
                </Button>
              </div>
            </div>
          </div>
        </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {userType === 'driver' ? (
          <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="dashboard">{t('nav.dashboard')}</TabsTrigger>
              <TabsTrigger value="orders">{t('nav.orders')}</TabsTrigger>
              <TabsTrigger value="route">Route Optimization</TabsTrigger>
              <TabsTrigger value="earnings">{t('nav.earnings')}</TabsTrigger>
              <TabsTrigger value="notifications">{t('nav.notifications')}</TabsTrigger>
              <TabsTrigger value="profile">{t('nav.profile')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="dashboard">
              <DriverDashboard />
            </TabsContent>
            
            <TabsContent value="orders">
              <OrderTracking userType="driver" />
            </TabsContent>
            
            <TabsContent value="route">
              <DriverRouteOptimization />
            </TabsContent>
            
            <TabsContent value="earnings">
              <DriverEarnings />
            </TabsContent>
            
            <TabsContent value="notifications">
              <NotificationCenter userType="driver" />
            </TabsContent>
            
            <TabsContent value="profile">
              <DriverProfile />
              
            </TabsContent>
          </Tabs>
        ) : (
          <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="booking">{t('nav.booking')}</TabsTrigger>
              <TabsTrigger value="bulk">{t('nav.bulk')}</TabsTrigger>
              <TabsTrigger value="tracking">{t('nav.tracking')}</TabsTrigger>
              <TabsTrigger value="matching">{t('nav.matching')}</TabsTrigger>
              <TabsTrigger value="notifications">{t('nav.notifications')}</TabsTrigger>
              <TabsTrigger value="profile">{t('nav.profile')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="booking">
              <CustomerBooking />
            </TabsContent>
            
            <TabsContent value="bulk">
              <BulkBooking />
            </TabsContent>
            
            <TabsContent value="tracking">
              <OrderTracking userType="customer" />
            </TabsContent>
            
            <TabsContent value="matching">
              <MatchingEngine />
            </TabsContent>
            
            <TabsContent value="notifications">
              <NotificationCenter userType="customer" />
            </TabsContent>
            
            <TabsContent value="profile">
              <CustomerProfile />
            </TabsContent>
          </Tabs>
          )}
        </main>
      </div>
    );
  }

  // Fallback
  return null;
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
      <Toaster position="top-right" />
    </LanguageProvider>
  );
}

export default App;