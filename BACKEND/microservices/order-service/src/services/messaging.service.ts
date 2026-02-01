import { Logger } from '../utils/logger';
import { WebSocketUtil } from '../utils/websocket.util';

export interface Message {
  id: string;
  orderId: string;
  senderId: string;
  senderType: 'customer' | 'driver';
  receiverId: string;
  content: string;
  timestamp: Date;
  read: boolean;
  messageType: 'text' | 'location' | 'image' | 'status_update';
  metadata?: any;
}

export class MessagingService {
  private logger = new Logger('MessagingService');
  private messages: Map<string, Message[]> = new Map(); // orderId -> messages
  private websocketUtil: WebSocketUtil;
  
  constructor(websocketUtil: WebSocketUtil) {
    this.websocketUtil = websocketUtil;
  }
  
  async sendMessage(
    orderId: string,
    senderId: string,
    senderType: 'customer' | 'driver',
    content: string,
    messageType: 'text' | 'location' | 'image' | 'status_update' = 'text',
    metadata?: any
  ): Promise<Message> {
    try {
      // Get order to find receiver
      const order = await this.getOrderDetails(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      const receiverId = senderType === 'customer' ? order.driver_id : order.customer_id;
      if (!receiverId) {
        throw new Error('No receiver found for this order');
      }
      
      const message: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        orderId,
        senderId,
        senderType,
        receiverId,
        content,
        timestamp: new Date(),
        read: false,
        messageType,
        metadata
      };
      
      // Store message
      if (!this.messages.has(orderId)) {
        this.messages.set(orderId, []);
      }
      this.messages.get(orderId)!.push(message);
      
      // Send real-time notification via WebSocket
      await this.websocketUtil.sendToUser(receiverId, 'new_message', {
        ...message,
        orderNumber: order.order_number
      });
      
      // Also send to sender for confirmation
      await this.websocketUtil.sendToUser(senderId, 'message_sent', {
        ...message,
        orderNumber: order.order_number
      });
      
      this.logger.info(`Message sent for order ${orderId}: ${senderId} -> ${receiverId}`);
      
      return message;
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      throw error;
    }
  }
  
  async sendLocationUpdate(
    orderId: string,
    driverId: string,
    latitude: number,
    longitude: number,
    estimatedArrival?: number
  ): Promise<Message> {
    return this.sendMessage(
      orderId,
      driverId,
      'driver',
      `📍 Driver location updated`,
      'location',
      {
        latitude,
        longitude,
        estimatedArrival,
        timestamp: new Date().toISOString()
      }
    );
  }
  
  async sendStatusUpdate(
    orderId: string,
    senderId: string,
    senderType: 'customer' | 'driver',
    status: string,
    notes?: string
  ): Promise<Message> {
    return this.sendMessage(
      orderId,
      senderId,
      senderType,
      `🔄 Status updated: ${status}`,
      'status_update',
      {
        status,
        notes,
        timestamp: new Date().toISOString()
      }
    );
  }
  
  async getOrderMessages(orderId: string, userId: string): Promise<Message[]> {
    // Verify user has access to this order
    const order = await this.getOrderDetails(orderId);
    if (!order || (order.customer_id !== userId && order.driver_id !== userId)) {
      throw new Error('Access denied');
    }
    
    return this.messages.get(orderId) || [];
  }
  
  async markAsRead(messageId: string, userId: string): Promise<void> {
    for (const messages of this.messages.values()) {
      const message = messages.find(m => m.id === messageId && m.receiverId === userId);
      if (message) {
        message.read = true;
        break;
      }
    }
  }
  
  async getUnreadCount(userId: string): Promise<number> {
    let count = 0;
    for (const messages of this.messages.values()) {
      count += messages.filter(m => m.receiverId === userId && !m.read).length;
    }
    return count;
  }
  
  private async getOrderDetails(orderId: string): Promise<any> {
    // In production, this would query your database
    // For now, return mock data
    return {
      id: orderId,
      order_number: `ORD-${orderId.substr(0, 8)}`,
      customer_id: 'cust_' + orderId,
      driver_id: 'driver_' + orderId,
      status: 'in_transit'
    };
  }
}