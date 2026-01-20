import React from 'react';
import { NotificationCenter } from '../../components/NotificationCenter';

interface NotificationsPageProps {
  userType: 'driver' | 'customer';
}

/**
 * Notifications Page
 * 
 * Displays notifications and alerts for users.
 * Used by both drivers and customers.
 */
export function NotificationsPage({ userType }: NotificationsPageProps) {
  return <NotificationCenter userType={userType} />;
}

export default NotificationsPage;
