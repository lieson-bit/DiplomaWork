import React from 'react';
import { Header } from './landing/Header';
import { HeroSection } from './landing/HeroSection';
import { FeaturesSection } from './landing/FeaturesSection';
import { HowItWorksSection } from './landing/HowItWorksSection';
import { CTASection } from './landing/CTASection';
import { Footer } from './landing/Footer';

interface LandingPageProps {
  onGetStarted: () => void;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <Header onGetStarted={onGetStarted} />
      <HeroSection onGetStarted={onGetStarted} />
      <FeaturesSection />
      <HowItWorksSection />
      <CTASection onGetStarted={onGetStarted} />
      <Footer />
    </div>
  );
}
