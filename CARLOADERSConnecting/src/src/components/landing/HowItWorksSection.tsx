import React from 'react';
import { useLanguage } from '../../../components/LanguageContext';

export function HowItWorksSection() {
  const { t } = useLanguage();

  const customerSteps = [
    { 
      step: "1", 
      title: t('landing.how_it_works.customer_step1'), 
      desc: t('landing.how_it_works.customer_step1_desc') 
    },
    { 
      step: "2", 
      title: t('landing.how_it_works.customer_step2'), 
      desc: t('landing.how_it_works.customer_step2_desc') 
    },
    { 
      step: "3", 
      title: t('landing.how_it_works.customer_step3'), 
      desc: t('landing.how_it_works.customer_step3_desc') 
    }
  ];

  const driverSteps = [
    { 
      step: "1", 
      title: t('landing.how_it_works.driver_step1'), 
      desc: t('landing.how_it_works.driver_step1_desc') 
    },
    { 
      step: "2", 
      title: t('landing.how_it_works.driver_step2'), 
      desc: t('landing.how_it_works.driver_step2_desc') 
    },
    { 
      step: "3", 
      title: t('landing.how_it_works.driver_step3'), 
      desc: t('landing.how_it_works.driver_step3_desc') 
    }
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl text-gray-900 mb-4">{t('landing.how_it_works.title')}</h2>
          <p className="text-lg text-gray-600">{t('landing.how_it_works.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          {/* For Customers */}
          <div className="space-y-8">
            <h3 className="text-xl text-center text-blue-600">{t('landing.how_it_works.customers')}</h3>
            <div className="space-y-6">
              {customerSteps.map((item, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm flex-shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="font-medium">{item.title}</h4>
                    <p className="text-gray-600 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* For Drivers */}
          <div className="space-y-8">
            <h3 className="text-xl text-center text-green-600">{t('landing.how_it_works.drivers')}</h3>
            <div className="space-y-6">
              {driverSteps.map((item, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm flex-shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="font-medium">{item.title}</h4>
                    <p className="text-gray-600 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}