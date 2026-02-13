// services/notification.service.ts
import { Logger } from '../utils/logger';
import { WebSocketUtil } from '../utils/websocket.util';
import { webSocketManager } from '../utils/websocket.manager';

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

  // Method to ensure WebSocket is available before sending
  private async ensureWebSocket(): Promise<WebSocketUtil> {
    if (this.websocketUtil) {
      return this.websocketUtil;
    }
    
    // Try to get from manager (it might be initialized by now)
    this.websocketUtil = webSocketManager.getWebSocket();
    
    if (!this.websocketUtil) {
      // Wait for initialization
      this.logger.info('Waiting for WebSocket to be initialized...');
      this.websocketUtil = await webSocketManager.waitForWebSocket();
      this.logger.info('WebSocket now available for notifications');
    }
    
    return this.websocketUtil;
  }
  
  async sendOrderNotification(
    userId: string,
    orderId: string,
    type: string,
    data: any
  ): Promise<void> {
    try {
      // Ensure WebSocket is available
      const ws = await this.ensureWebSocket();
      
      if (!ws) {
        this.logger.warn('WebSocket still not available after waiting, cannot send notification');
        return;
      }
      
      if (typeof ws.sendToUser !== 'function') {
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
      await ws.sendToUser(userId, 'notification', notification);
      this.logger.info(`✅ Notification sent to ${userId}: ${type}`);
      
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

  // New method for driver notifications
  async sendDriverOrderNotification(
    driverId: string,
    orderData: any
  ): Promise<void> {
    await this.sendOrderNotification(
      driverId,
      orderData.orderId || orderData.orderNumber,
      'new_order_available',
      {
        ...orderData,
        requiresAction: true,
        actionType: 'accept_reject'
      }
    );
  }
}