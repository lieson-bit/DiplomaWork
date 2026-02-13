// services/notification.service.ts
import { Logger } from '../utils/logger';
import { WebSocketUtil } from '../utils/websocket.util';

export class NotificationService {
  private logger: Logger;
  private websocketUtil: WebSocketUtil | null;
  
  constructor(websocketUtil: WebSocketUtil | null) {
    this.logger = new Logger('NotificationService');
    
    // Store the websocketUtil (might be null initially)
    this.websocketUtil = websocketUtil;
    
    this.logger.info('NotificationService initialized', {
      hasWebSocket: !!this.websocketUtil,
      websocketType: typeof this.websocketUtil
    });
  }

  // Method to update WebSocket instance if it becomes available later
  public setWebSocket(websocketUtil: WebSocketUtil): void {
    this.websocketUtil = websocketUtil;
    this.logger.info('NotificationService: WebSocket instance updated');
  }
  
  async sendOrderNotification(
    userId: string,
    orderId: string,
    type: string,
    data: any
  ): Promise<void> {
    try {
      // Check if websocketUtil exists
      if (!this.websocketUtil) {
        this.logger.warn('WebSocketUtil not available yet, cannot send notification');
        return;
      }
      
      if (typeof this.websocketUtil.sendToUser !== 'function') {
        this.logger.error('sendToUser method not available on WebSocketUtil');
        return;
      }
      
      const notification = {
        type,
        orderId,
        data,
        timestamp: new Date().toISOString(),
        read: false
      };
      
      this.logger.debug(`Attempting to send ${type} notification to user ${userId}`);
      await this.websocketUtil.sendToUser(userId, 'notification', notification);
      this.logger.debug(`✅ Notification sent to ${userId}: ${type}`);
      
    } catch (error) {
      this.logger.warn(`Failed to send notification to ${userId}:`, error);
    }
  }
  
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