import { Logger } from '../utils/logger';
import { WebSocketUtil } from '../utils/websocket.util';
import nodemailer from 'nodemailer';

export class NotificationService {
  private logger = new Logger('NotificationService');
  private websocketUtil: WebSocketUtil;
  private emailTransporter: any;
  
  constructor(websocketUtil: WebSocketUtil) {
    this.websocketUtil = websocketUtil;
    
    // Setup email transporter if configured
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_PORT === '465',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
    }
  }
  
  // In-app notification via WebSocket (PREFERRED METHOD)
  async sendInAppNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    try {
      const notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        title,
        body,
        data: {
          ...data,
          timestamp: new Date().toISOString(),
          read: false
        }
      };
      
      // Send via WebSocket (real-time delivery)
      await this.websocketUtil.sendToUser(userId, 'in_app_notification', notification);
      
      // Also store in database for offline users
      await this.storeNotification(userId, notification);
      
      this.logger.debug(`In-app notification sent to ${userId}: ${type}`);
    } catch (error) {
      this.logger.warn(`Failed to send in-app notification to ${userId}:`, error);
    }
  }
  
  // Email notification (fallback, with in-app like formatting)
  async sendEmailNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    if (!this.emailTransporter) return;
    
    try {
      // Get user email from user service
      const userEmail = await this.getUserEmail(userId);
      if (!userEmail) return;
      
      // Format email to look like in-app message
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .notification { border-left: 4px solid #4CAF50; padding: 15px; background: #f9f9f9; margin: 20px 0; }
            .title { font-size: 18px; font-weight: bold; color: #333; margin-bottom: 10px; }
            .body { font-size: 14px; color: #666; line-height: 1.6; }
            .button { display: inline-block; padding: 10px 20px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
            .footer { margin-top: 20px; font-size: 12px; color: #999; }
          </style>
        </head>
        <body>
          <div class="notification">
            <div class="title">${title}</div>
            <div class="body">${body}</div>
            ${data?.orderId ? `
              <a href="${process.env.APP_URL || 'https://app.example.com'}/orders/${data.orderId}" class="button">
                View in App
              </a>
            ` : ''}
          </div>
          <div class="footer">
            This notification was sent from ${process.env.APP_NAME || 'Order Service'}. 
            You can disable email notifications in your app settings.
          </div>
        </body>
        </html>
      `;
      
      await this.emailTransporter.sendMail({
        from: process.env.EMAIL_FROM || `"Order App" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: title,
        html: emailHtml
      });
      
      this.logger.debug(`Email sent to ${userEmail}`);
    } catch (error) {
      this.logger.warn(`Failed to send email to ${userId}:`, error);
    }
  }
  
  // Combined notification (in-app + email)
  async sendOrderNotification(
    userId: string,
    orderId: string,
    notificationType: string,
    data?: any
  ): Promise<void> {
    const notificationContent = this.getNotificationContent(notificationType, orderId, data);
    
    // 1. Send in-app notification (primary)
    await this.sendInAppNotification(
      userId,
      notificationType,
      notificationContent.title,
      notificationContent.body,
      { orderId, ...data }
    );
    
    // 2. Send email (secondary, formatted like in-app)
    await this.sendEmailNotification(
      userId,
      notificationType,
      notificationContent.title,
      notificationContent.body,
      { orderId, ...data }
    );
  }
  
  // Broadcast location updates to customer
  async broadcastLocationUpdate(
    orderId: string,
    driverId: string,
    location: { lat: number; lng: number },
    eta?: number,
    speed?: number
  ): Promise<void> {
    try {
      // Get customer ID from order
      const order = await this.getOrderDetails(orderId);
      if (!order?.customer_id) return;
      
      const notification = {
        type: 'location_update',
        orderId,
        data: {
          driverId,
          location,
          eta,
          speed,
          timestamp: new Date().toISOString()
        }
      };
      
      // Send to customer
      await this.websocketUtil.sendToUser(order.customer_id, 'driver_location', notification);
      
      // Also send in-app message
      await this.sendInAppNotification(
        order.customer_id,
        'location_update',
        'Driver Location Updated',
        `Driver is on the way to you${eta ? `, ETA: ${eta} minutes` : ''}`,
        { orderId, location, eta }
      );
    } catch (error) {
      this.logger.warn(`Failed to broadcast location for order ${orderId}:`, error);
    }
  }
  
  private getNotificationContent(
    type: string,
    orderId: string,
    data?: any
  ): { title: string; body: string } {
    const orderNumber = orderId.substring(0, 8).toUpperCase();
    
    switch (type) {
      case 'order_created':
        return {
          title: 'Order Created',
          body: `Your order #${orderNumber} has been created successfully. We're looking for a driver.`
        };
        
      case 'driver_assigned':
        return {
          title: 'Driver Assigned',
          body: `A driver has been assigned to your order #${orderNumber}. They will arrive soon.`
        };
        
      case 'driver_enroute':
        return {
          title: 'Driver On The Way',
          body: `Your driver is on the way to pick up your order #${orderNumber}.`
        };
        
      case 'pickup_started':
        return {
          title: 'Pickup Started',
          body: `Driver has picked up your order #${orderNumber} and is on the way to you.`
        };
        
      case 'order_delivered':
        return {
          title: 'Order Delivered',
          body: `Your order #${orderNumber} has been delivered successfully.`
        };
        
      case 'payment_received':
        return {
          title: 'Payment Received',
          body: `Payment of $${data?.amount?.toFixed(2) || '0.00'} for order #${orderNumber} has been processed.`
        };
        
      case 'new_message':
        return {
          title: 'New Message',
          body: `You have a new message for order #${orderNumber}.`
        };
        
      default:
        return {
          title: 'Order Update',
          body: `Your order #${orderNumber} has been updated.`
        };
    }
  }
  
  private async getUserEmail(userId: string): Promise<string | null> {
    try {
      // Call user service to get email
      // For now, return mock
      return `${userId}@example.com`;
    } catch (error) {
      return null;
    }
  }
  
  private async getOrderDetails(orderId: string): Promise<any> {
    // Call your order repository
    return { customer_id: 'customer_' + orderId };
  }
  
  private async storeNotification(userId: string, notification: any): Promise<void> {
    // Store in database for offline access
    // Implementation depends on your database setup
  }
}