import React from 'react';
import { Button } from "../../../components/ui/button";
import { useLanguage } from '../../../components/LanguageContext';

interface CTASectionProps {
  onGetStarted: () => void;
}

export function CTASection({ onGetStarted }: CTASectionProps) {
  const { t } = useLanguage();

  return (
    <section className="py-20 bg-blue-600">
      <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl text-white mb-4">{t('landing.cta.title')}</h2>
        <p className="text-xl text-blue-100 mb-8">
          {t('landing.cta.subtitle')}
        </p>
        <Button 
          onClick={onGetStarted}
          className="bg-white text-blue-600 hover:bg-gray-50 h-12 px-8 text-lg"
        >
          {t('landing.cta.button')}
        </Button>
      </div>
    </section>
  );
}