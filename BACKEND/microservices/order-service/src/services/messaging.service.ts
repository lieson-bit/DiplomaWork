import { Logger } from '../utils/logger';
import { db } from '../config/database';

export class MessagingService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('MessagingService');
  }

  // Send message
  async sendMessage(
    orderId: string,
    senderId: string,
    senderType: 'customer' | 'driver',
    receiverId: string,
    receiverType: 'customer' | 'driver',
    content: string,
    messageType: 'text' | 'location' | 'image' | 'status_update' = 'text',
    metadata?: any
  ): Promise<any> {
    try {
      // Get sender name
      const senderName = await this.getUserName(senderId, senderType);
      
      const query = `
        INSERT INTO order_messages 
        (order_id, sender_id, sender_type, message_type, content, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      const result = await db.execute(query, [
        orderId,
        senderId,
        senderType,
        messageType,
        content,
        metadata ? JSON.stringify(metadata) : null
      ]);
      
      return {
        id: result.insertId.toString(),
        orderId,
        senderId,
        senderType,
        senderName,
        content,
        messageType,
        metadata,
        readStatus: false,
        createdAt: new Date()
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to send message:', errorMessage);
      throw error;
    }
  }
  
  // Get order messages
  async getOrderMessages(orderId: string, userId: string): Promise<any[]> {
    try {
      const query = `
        SELECT * FROM order_messages 
        WHERE order_id = ? 
        ORDER BY created_at ASC
      `;
      
      const messages = await db.query<any>(query, [orderId]);
      
      // Get sender names
      const messagesWithNames = await Promise.all(
        messages.map(async (msg) => {
          const senderName = await this.getUserName(msg.sender_id, msg.sender_type);
          return {
            ...msg,
            senderName
          };
        })
      );
      
      return messagesWithNames;
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get messages:', errorMessage);
      throw error;
    }
  }
  
  // Mark message as read
  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    try {
      const query = `
        UPDATE order_messages 
        SET read_status = TRUE, read_at = NOW()
        WHERE id = ? AND sender_id != ?
      `;
      
      await db.execute(query, [messageId, userId]);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to mark message as read:', errorMessage);
      throw error;
    }
  }
  
  // Save driver rating
  async saveDriverRating(
    orderId: string,
    customerId: string,
    driverId: string,
    rating: number,
    review?: string
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO driver_ratings 
        (driver_id, order_id, customer_id, rating, review)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      await db.execute(query, [driverId, orderId, customerId, rating, review]);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to save driver rating:', errorMessage);
      throw error;
    }
  }
  
  // Get driver ratings
  async getDriverRatings(driverId: string): Promise<{ rating: number }[]> {
    try {
      const query = `
        SELECT rating FROM driver_ratings 
        WHERE driver_id = ?
      `;
      
      const ratings = await db.query<{ rating: number }>(query, [driverId]);
      return ratings;
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get driver ratings:', errorMessage);
      throw error;
    }
  }
  
  // Get user name
  private async getUserName(userId: string, userType: string): Promise<string> {
    try {
      if (userType === 'customer') {
        const query = `SELECT pickup_contact_name as name FROM orders WHERE customer_id = ? LIMIT 1`;
        const result = await db.queryOne<any>(query, [userId]);
        return result?.name || 'Customer';
      } else {
        const query = `SELECT pickup_contact_name as name FROM orders WHERE driver_id = ? LIMIT 1`;
        const result = await db.queryOne<any>(query, [userId]);
        return result?.name || 'Driver';
      }
    } catch {
      return userType === 'customer' ? 'Customer' : 'Driver';
    }
  }
}

// Export singleton instance
export const messagingService = new MessagingService();