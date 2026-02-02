import React from 'react';
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Package, Truck, CheckCircle } from 'lucide-react';
import { useLanguage } from '../../../components/LanguageContext';
import { StatsGrid } from './StatsGrid';

interface HeroSectionProps {
  onGetStarted: () => void;
}

export function HeroSection({ onGetStarted }: HeroSectionProps) {
  const { t } = useLanguage();

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                {t('landing.features.title')}
              </Badge>
              <h1 className="text-4xl lg:text-6xl text-gray-900 leading-tight">
                {t('landing.title')}
              </h1>
              <p className="text-lg text-gray-600 leading-relaxed">
                {t('landing.subtitle')}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                onClick={onGetStarted} 
                className="bg-blue-600 hover:bg-blue-700 h-12 px-8"
              >
                <Package className="mr-2 h-5 w-5" />
                {t('landing.ship_now')}
              </Button>
              <Button 
                onClick={onGetStarted} 
                variant="outline" 
                className="h-12 px-8 border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                <Truck className="mr-2 h-5 w-5" />
                {t('landing.drive_earn')}
              </Button>
            </div>

            <StatsGrid />
          </div>

          <div className="relative">
            <div className="relative z-10">
              <img
                src="https://images.unsplash.com/photo-1566576912322-38b6bf8bb9cb?w=600&h=400&fit=crop"
                alt="Delivery truck"
                className="rounded-2xl shadow-2xl w-full h-auto"
              />
            </div>
            {/* Floating Cards */}
            <div className="absolute -top-6 -left-6 bg-white rounded-lg shadow-lg p-4 z-20">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm">Live Tracking</span>
              </div>
            </div>
            <div className="absolute -bottom-6 -right-6 bg-white rounded-lg shadow-lg p-4 z-20">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm">Delivered</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}