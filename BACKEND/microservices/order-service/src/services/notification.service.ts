import { Logger } from '../utils/logger';
import { WebSocketUtil } from '../utils/websocket.util';

export class NotificationService {
  private logger = new Logger('NotificationService');
  private websocketUtil: WebSocketUtil;
  
  // FIXED: Accept WebSocketUtil as parameter instead of creating new instance
  constructor(websocketUtil: WebSocketUtil) {
    this.websocketUtil = websocketUtil;
  }
  
  // Send order notification
  async sendOrderNotification(
    userId: string,
    orderId: string,
    type: string,
    data: any
  ): Promise<void> {
    try {
      const notification = {
        type,
        orderId,
        data,
        timestamp: new Date().toISOString(),
        read: false
      };
      
      // Send via WebSocket
      await this.websocketUtil.sendToUser(userId, 'notification', notification);
      
      // Also log to database if needed
      // await this.saveNotificationToDatabase(userId, type, orderId, data);
      
      this.logger.debug(`Notification sent to ${userId}: ${type}`);
    } catch (error) {
      this.logger.warn(`Failed to send notification to ${userId}:`, error);
    }
  }
  
  // Send booking failed notification
  async sendBookingFailedNotification(
    customerId: string,
    orderId: string,
    reason: string,
    recommendations: string[]
  ): Promise<void> {
    await this.sendOrderNotification(
      customerId,
      orderId,
      'booking_failed',
      {
        reason,
        recommendations,
        message: 'Booking failed. Please try again with different parameters.'
      }
    );
  }
}

// FIXED: Don't export a singleton instance - it will be created in index.ts
// export const notificationService = new NotificationService();