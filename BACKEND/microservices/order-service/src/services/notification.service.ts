import { Logger } from '../utils/logger';
import { WebSocketUtil } from '../utils/websocket.util';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

export type NotificationType = 
  | 'order_created'
  | 'order_accepted'
  | 'order_picked_up'
  | 'order_delivered'
  | 'order_cancelled'
  | 'payment_received'
  | 'payment_failed'
  | 'driver_assigned'
  | 'driver_enroute'
  | 'driver_arrived'
  | 'rating_received'
  | 'bulk_order_complete'
  | 'promotional'
  | 'system_alert';

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
}

export class NotificationService {
  private logger = new Logger('NotificationService');
  private websocketUtil: WebSocketUtil;
  private notifications: Map<string, Notification[]> = new Map();

  constructor(websocketUtil: WebSocketUtil) {
    this.websocketUtil = websocketUtil;
  }

  async sendOrderNotification(
    userId: string,
    orderId: string,
    type: NotificationType,
    data?: any
  ): Promise<void> {
    try {
      const notification = this.createNotification(userId, type, {
        orderId,
        ...data
      });

      // Store notification
      await this.storeNotification(notification);

      // Send via WebSocket (real-time)
      await this.sendWebSocketNotification(userId, notification);

      // Send email notification (async)
      this.sendEmailNotification(userId, notification);

      // Send push notification (async)
      this.sendPushNotification(userId, notification);

      this.logger.info(`Sent ${type} notification to user ${userId} for order ${orderId}`);
    } catch (error) {
      this.logger.error(`Failed to send notification to user ${userId}:`, error);
      throw error;
    }
  }

  async sendBulkOrderCompleteNotification(
    userId: string,
    bulkOrderId: string,
    successfulCount: number,
    failedCount: number
  ): Promise<void> {
    const notification = this.createNotification(
      userId,
      'bulk_order_complete',
      {
        bulkOrderId,
        successfulCount,
        failedCount,
        message: `Bulk order processing complete. ${successfulCount} orders created successfully, ${failedCount} failed.`
      }
    );

    await this.sendNotification(userId, notification);
  }

  async sendDriverAssignmentNotification(
    driverId: string,
    orderId: string,
    orderDetails: any
  ): Promise<void> {
    const notification = this.createNotification(
      driverId,
      'driver_assigned',
      {
        orderId,
        pickupAddress: orderDetails.pickupAddress,
        deliveryAddress: orderDetails.deliveryAddress,
        estimatedEarnings: orderDetails.driverEarnings,
        message: `New order assigned to you. Pickup: ${orderDetails.pickupAddress}`
      }
    );

    await this.sendNotification(driverId, notification);
  }

  async sendPaymentNotification(
    userId: string,
    orderId: string,
    amount: number,
    status: 'completed' | 'failed' | 'refunded'
  ): Promise<void> {
    const type = status === 'completed' ? 'payment_received' : 'payment_failed';
    const notification = this.createNotification(
      userId,
      type,
      {
        orderId,
        amount,
        status,
        message: status === 'completed' 
          ? `Payment of $${amount.toFixed(2)} received for order ${orderId}`
          : `Payment of $${amount.toFixed(2)} failed for order ${orderId}`
      }
    );

    await this.sendNotification(userId, notification);
  }

  async getUserNotifications(userId: string, limit: number = 50, offset: number = 0): Promise<Notification[]> {
    const userNotifications = this.notifications.get(userId) || [];
    return userNotifications
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const userNotifications = this.notifications.get(userId);
    if (userNotifications) {
      const notification = userNotifications.find(n => n.id === notificationId);
      if (notification) {
        notification.read = true;
      }
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    const userNotifications = this.notifications.get(userId);
    if (userNotifications) {
      userNotifications.forEach(notification => {
        notification.read = true;
      });
    }
  }

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const userNotifications = this.notifications.get(userId);
    if (userNotifications) {
      const index = userNotifications.findIndex(n => n.id === notificationId);
      if (index !== -1) {
        userNotifications.splice(index, 1);
      }
    }
  }

  async deleteAllNotifications(userId: string): Promise<void> {
    this.notifications.delete(userId);
  }

  private createNotification(
    userId: string,
    type: NotificationType,
    data?: any
  ): Notification {
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Notifications expire after 30 days

    return {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type,
      title: this.getNotificationTitle(type),
      message: data?.message || this.getDefaultMessage(type),
      data,
      read: false,
      createdAt: now,
      expiresAt
    };
  }

  private async sendNotification(userId: string, notification: Notification): Promise<void> {
    // Store notification
    await this.storeNotification(notification);

    // Send via WebSocket
    await this.sendWebSocketNotification(userId, notification);

    // Send other notification types based on user preferences
    // (This would check user preferences in a real implementation)
    await this.sendEmailNotification(userId, notification);
    await this.sendPushNotification(userId, notification);
  }

  private async storeNotification(notification: Notification): Promise<void> {
    const userId = notification.userId;
    if (!this.notifications.has(userId)) {
      this.notifications.set(userId, []);
    }
    this.notifications.get(userId)!.push(notification);
  }

  private async sendWebSocketNotification(userId: string, notification: Notification): Promise<void> {
    try {
      await this.websocketUtil.sendToUser(userId, 'notification', notification);
    } catch (error) {
      this.logger.warn(`Failed to send WebSocket notification to user ${userId}:`, error);
    }
  }

  private async sendEmailNotification(userId: string, notification: Notification): Promise<void> {
    // In a real implementation, this would integrate with an email service
    this.logger.info(`[EMAIL] To: ${userId}, Subject: ${notification.title}, Body: ${notification.message}`);
  }

  private async sendPushNotification(userId: string, notification: Notification): Promise<void> {
    // In a real implementation, this would integrate with a push notification service
    this.logger.info(`[PUSH] To: ${userId}, Title: ${notification.title}, Body: ${notification.message}`);
  }

  private getNotificationTitle(type: NotificationType): string {
    const titles: Record<NotificationType, string> = {
      order_created: 'Order Created',
      order_accepted: 'Order Accepted by Driver',
      order_picked_up: 'Order Picked Up',
      order_delivered: 'Order Delivered',
      order_cancelled: 'Order Cancelled',
      payment_received: 'Payment Received',
      payment_failed: 'Payment Failed',
      driver_assigned: 'New Assignment',
      driver_enroute: 'Driver Enroute',
      driver_arrived: 'Driver Arrived',
      rating_received: 'New Rating Received',
      bulk_order_complete: 'Bulk Order Complete',
      promotional: 'Special Offer',
      system_alert: 'System Alert'
    };
    return titles[type] || 'Notification';
  }

  private getDefaultMessage(type: NotificationType): string {
    const messages: Record<NotificationType, string> = {
      order_created: 'Your order has been created successfully.',
      order_accepted: 'A driver has accepted your order.',
      order_picked_up: 'Your order has been picked up.',
      order_delivered: 'Your order has been delivered.',
      order_cancelled: 'Your order has been cancelled.',
      payment_received: 'Your payment has been processed successfully.',
      payment_failed: 'There was an issue processing your payment.',
      driver_assigned: 'You have been assigned a new delivery.',
      driver_enroute: 'You are now enroute to the delivery location.',
      driver_arrived: 'You have arrived at the delivery location.',
      rating_received: 'You have received a new rating.',
      bulk_order_complete: 'Your bulk order processing is complete.',
      promotional: 'Check out our latest offers!',
      system_alert: 'System notification.'
    };
    return messages[type] || 'You have a new notification.';
  }
}