import React from 'react';
import { Truck } from 'lucide-react';
import { useLanguage } from '../../../components/LanguageContext';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="flex justify-center items-center mb-4">
            <div className="p-2 bg-blue-600 rounded-lg mr-3">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl">{t('app.name')}</h3>
          </div>
          <p className="text-gray-400">
            {t('landing.footer.subtitle')}
          </p>
        </div>
      </div>
    </footer>
  );
}