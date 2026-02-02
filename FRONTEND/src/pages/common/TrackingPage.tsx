import React from 'react';
import { OrderTracking } from '../../components/OrderTracking';

interface TrackingPageProps {
  userType: 'driver' | 'customer';
}

/**
 * Order Tracking Page
 * 
 * Displays real-time tracking information for orders.
 * Used by both drivers and customers.
 */
export function TrackingPage({ userType }: TrackingPageProps) {
  return <OrderTracking userType={userType} />;
}

export default TrackingPage;
