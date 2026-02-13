import { Logger } from '../utils/logger';
import { WebSocketUtil } from '../utils/websocket.util';

export class NotificationService {
  private logger: Logger;
  private websocketUtil: WebSocketUtil;
  
  constructor(websocketUtil: WebSocketUtil) {
    this.logger = new Logger('NotificationService');
    this.websocketUtil = websocketUtil;
    
    // Debug log to verify WebSocketUtil is passed correctly
    this.logger.info('NotificationService initialized with WebSocketUtil', { 
      hasWebSocket: !!this.websocketUtil,
      methods: this.websocketUtil ? Object.getOwnPropertyNames(Object.getPrototypeOf(this.websocketUtil)) : []
    });
  }
  
  async sendOrderNotification(
    userId: string,
    orderId: string,
    type: string,
    data: any
  ): Promise<void> {
    try {
      if (!this.websocketUtil) {
        this.logger.warn('WebSocketUtil not available, cannot send notification');
        return;
      }
      
      if (typeof this.websocketUtil.sendToUser !== 'function') {
        this.logger.error('sendToUser method not available on WebSocketUtil', {
          type: typeof this.websocketUtil,
          hasMethod: this.websocketUtil && 'sendToUser' in this.websocketUtil
        });
        return;
      }
      
      const notification = {
        type,
        orderId,
        data,
        timestamp: new Date().toISOString(),
        read: false
      };
      
      await this.websocketUtil.sendToUser(userId, 'notification', notification);
      this.logger.debug(`Notification sent to ${userId}: ${type}`);
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