import React from 'react';
import { Button } from "../../../components/ui/button";
import { Truck } from 'lucide-react';
import { useLanguage } from '../../../components/LanguageContext';
import { LanguageSelector } from '../../../components/LanguageSelector';

interface HeaderProps {
  onGetStarted: () => void;
}

export function Header({ onGetStarted }: HeaderProps) {
  const { t } = useLanguage();

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-blue-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="p-2 bg-blue-600 rounded-lg mr-3">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl text-gray-900">{t('app.name')}</h1>
          </div>
          <div className="flex items-center space-x-4">
            <LanguageSelector />
            <Button onClick={onGetStarted} className="bg-blue-600 hover:bg-blue-700">
              {t('landing.get_started')}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}