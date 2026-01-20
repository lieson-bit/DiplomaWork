import React from 'react';
import { Card, CardContent } from "../../../components/ui/card";
import { Truck, Package, MapPin, Shield } from 'lucide-react';
import { useLanguage } from '../../../components/LanguageContext';

export function FeaturesSection() {
  const { t } = useLanguage();
  
  const features = [
    {
      icon: <Truck className="h-6 w-6 text-blue-600" />,
      title: t('landing.features.smart_matching.title'),
      description: t('landing.features.smart_matching.desc')
    },
    {
      icon: <Package className="h-6 w-6 text-green-600" />,
      title: t('landing.features.bulk_orders.title'),
      description: t('landing.features.bulk_orders.desc')
    },
    {
      icon: <MapPin className="h-6 w-6 text-purple-600" />,
      title: t('landing.features.real_time_tracking.title'),
      description: t('landing.features.real_time_tracking.desc')
    },
    {
      icon: <Shield className="h-6 w-6 text-orange-600" />,
      title: t('landing.features.secure_reliable.title'),
      description: t('landing.features.secure_reliable.desc')
    }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl text-gray-900 mb-4">{t('landing.features.title')}</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('landing.features.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="mb-4 flex justify-center">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-lg mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}