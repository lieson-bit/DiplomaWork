import React from 'react';
import { useLanguage } from '../../../components/LanguageContext';

export function StatsGrid() {
  const { t } = useLanguage();

  const stats = [
    { number: "10K+", label: t('landing.stats.drivers') },
    { number: "50K+", label: t('landing.stats.deliveries') },
    { number: "500+", label: t('landing.stats.cities') },
    { number: "4.9★", label: t('landing.stats.rating') }
  ];

  return (
    <div className="grid grid-cols-4 gap-6 pt-8">
      {stats.map((stat, index) => (
        <div key={index} className="text-center">
          <p className="text-2xl text-blue-600">{stat.number}</p>
          <p className="text-sm text-gray-600">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}