// Notifications hook

import { useState, useEffect } from 'react';
import { notificationService } from '../../services';
import type { Notification } from '../../types';

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    loadNotifications();
    loadUnreadCount();

    // Subscribe to real-time notifications
    const unsubscribe = notificationService.subscribeToNotifications(
      userId,
      (notification) => {
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const loadNotifications = async () => {
    if (!userId) return;
    
    const response = await notificationService.getNotifications(userId);
    if (response.success && response.data) {
      setNotifications(response.data.data);
    }
    setLoading(false);
  };

  const loadUnreadCount = async () => {
    if (!userId) return;
    
    const response = await notificationService.getUnreadCount(userId);
    if (response.success && response.data) {
      setUnreadCount(response.data.count);
    }
  };

  const markAsRead = async (notificationId: string) => {
    const response = await notificationService.markAsRead(notificationId);
    if (response.success) {
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    
    const response = await notificationService.markAllAsRead(userId);
    if (response.success) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    const response = await notificationService.deleteNotification(notificationId);
    if (response.success) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: loadNotifications,
  };
}
