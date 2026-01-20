import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Checkbox } from "./ui/checkbox";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Truck, Package, ArrowLeft, Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react';
import { useLanguage } from './LanguageContext';
import { LanguageSelector } from './LanguageSelector';
import { authApi } from '../src/lib/api';
import { toast } from 'sonner';

interface AuthPageProps {
  onBack: () => void;
  onLogin: (userType: 'driver' | 'customer', isNewUser: boolean) => void;
}

interface FormData {
  userType: 'driver' | 'customer';
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone: string;
  agreeToTerms: boolean;
}

export function AuthPage({ onBack, onLogin }: AuthPageProps) {
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    userType: 'customer',
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    agreeToTerms: false
  });

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    
    if (!isLogin) {
      // Signup validation
      if (formData.password !== formData.confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
      if (!formData.agreeToTerms) {
        toast.error('Please agree to the terms and conditions');
        return;
      }
      if (!formData.firstName || !formData.lastName || !formData.phone) {
        toast.error('Please fill in all required fields');
        return;
      }
    }
  
    try {
      if (isLogin) {
        // Login
        const response = await authApi.login({
          email: formData.email,
          password: formData.password,
        });
        
        if (response.success && response.data) {
          // Determine user type from response
          // Note: Your backend should return user type in the response
          const userType = response.data.user?.userType || response.data.userType || 'customer';
          toast.success('Login successful!');
          onLogin(userType, false);
        } else {
          toast.error(response.error || 'Login failed');
        }
      } else {
        // Register
        const response = await authApi.register({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          userType: formData.userType,
          phone: formData.phone,
        });
        
        if (response.success && response.data) {
          toast.success('Registration successful!');
          // For new users, we need to create their profile
          onLogin(formData.userType, true);
        } else {
          toast.error(response.error || 'Registration failed');
        }
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      toast.error(error.message || 'Authentication failed');
    }
  };
  const isFormValid = () => {
    if (isLogin) {
      return formData.email && formData.password;
    } else {
      return formData.email && 
             formData.password && 
             formData.confirmPassword && 
             formData.firstName && 
             formData.lastName && 
             formData.phone && 
             formData.agreeToTerms;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-between items-center mb-4">
            <Button
              variant="ghost"
              onClick={onBack}
              className="p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <LanguageSelector />
          </div>
          
          <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit">
            <Truck className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl text-gray-900">{t('auth.title')}</h1>
          <p className="text-gray-600">
            {isLogin ? t('auth.login.welcome') : t('auth.signup.welcome')}
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-center">
              <Tabs value={isLogin ? 'login' : 'signup'} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger 
                    value="login" 
                    onClick={() => setIsLogin(true)}
                  >
                    {t('auth.login')}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="signup" 
                    onClick={() => setIsLogin(false)}
                  >
                    {t('auth.signup')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* User Type Selection */}
              {!isLogin && (
                <div className="space-y-3">
                  <Label>{t('auth.account_type')}</Label>
                  <RadioGroup
                    value={formData.userType}
                    onValueChange={(value: 'driver' | 'customer') => handleInputChange('userType', value)}
                  >
                    <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
                      <RadioGroupItem value="customer" id="customer" />
                      <Label htmlFor="customer" className="flex items-center cursor-pointer flex-1">
                        <Package className="mr-2 h-4 w-4 text-blue-600" />
                        {t('auth.customer_option')}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
                      <RadioGroupItem value="driver" id="driver" />
                      <Label htmlFor="driver" className="flex items-center cursor-pointer flex-1">
                        <Truck className="mr-2 h-4 w-4 text-green-600" />
                        {t('auth.driver_option')}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Name Fields (Signup only) */}
              {!isLogin && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{t('common.first_name')}</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="firstName"
                        placeholder="John"
                        value={formData.firstName}
                        onChange={(e: any) => handleInputChange('firstName', e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{t('common.last_name')}</Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={(e: any) => handleInputChange('lastName', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">{t('common.email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e: any) => handleInputChange('email', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Phone (Signup only) */}
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('common.phone')}</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={formData.phone}
                      onChange={(e: any) => handleInputChange('phone', e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">{t('common.password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e: any) => handleInputChange('password', e.target.value)}
                    className="pl-10 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Confirm Password (Signup only) */}
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('auth.confirm_password')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={(e: any) => handleInputChange('confirmPassword', e.target.value)}
                      className="pl-10 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Terms and Conditions (Signup only) */}
              {!isLogin && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="terms"
                    checked={formData.agreeToTerms}
                    onCheckedChange={(checked: boolean) => handleInputChange('agreeToTerms', checked === true)}
                  />
                  <Label htmlFor="terms" className="text-sm text-gray-600">
                    {t('auth.agree_terms')}
                  </Label>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 h-12"
                disabled={!isFormValid()}
              >
                {isLogin ? t('auth.signin') : t('auth.signup')}
              </Button>

              {/* Forgot Password (Login only) */}
              {isLogin && (
                <div className="text-center">
                  <Button variant="link" className="text-blue-600 p-0">
                    {t('auth.forgot_password')}
                  </Button>
                </div>
              )}

              {/* Switch Mode */}
              <div className="text-center text-sm text-gray-600">
                {isLogin ? t('auth.no_account') : t('auth.have_account')}{' '}
                <Button
                  type="button"
                  variant="link"
                  className="text-blue-600 p-0 h-auto"
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin ? t('auth.signup') : t('auth.signin')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Demo Accounts */}
        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-3">Quick Demo Access:</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onLogin('customer', false)}
                  className="text-xs"
                >
                  <Package className="mr-1 h-3 w-3" />
                  Demo Customer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onLogin('driver', false)}
                  className="text-xs"
                >
                  <Truck className="mr-1 h-3 w-3" />
                  Demo Driver
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}