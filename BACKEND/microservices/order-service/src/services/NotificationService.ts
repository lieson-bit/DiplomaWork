// services/NotificationService.ts
interface Notification {
  id: string;
  userId: string;
  userType: 'driver' | 'customer';
  type: 'order' | 'payment' | 'system' | 'message' | 'document';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
  actionable?: boolean;
  actionText?: string;
  actionLink?: string;
  orderId?: string;
  orderNumber?: string;
  metadata?: Record<string, any>;
}

export class NotificationService {
  private notifications: Map<string, Notification[]> = new Map();
  
  async getUserNotifications(userId: string): Promise<Notification[]> {
    // You should implement this to fetch from your database
    // For now, returning from memory
    return this.notifications.get(userId) || [];
  }
  
  async createNotification(userId: string, notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Promise<Notification> {
    const userNotifications = this.notifications.get(userId) || [];
    
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      timestamp: new Date(),
      read: false
    };
    
    userNotifications.unshift(newNotification);
    this.notifications.set(userId, userNotifications);
    
    // TODO: Save to database
    return newNotification;
  }
  
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const userNotifications = this.notifications.get(userId) || [];
    const updated = userNotifications.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    );
    this.notifications.set(userId, updated);
    // TODO: Update in database
  }
  
  async markAllAsRead(userId: string): Promise<void> {
    const userNotifications = this.notifications.get(userId) || [];
    const updated = userNotifications.map(n => ({ ...n, read: true }));
    this.notifications.set(userId, updated);
    // TODO: Update in database
  }
  
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const userNotifications = this.notifications.get(userId) || [];
    const updated = userNotifications.filter(n => n.id !== notificationId);
    this.notifications.set(userId, updated);
    // TODO: Update in database
  }
  
  // Auto-create notifications based on order events
  async onOrderStatusChange(order: any, oldStatus: string, newStatus: string): Promise<void> {
    const customerId = order.customer_id;
    const driverId = order.driver_id;
    
    // Notify customer
    if (customerId) {
      let notification: Omit<Notification, 'id' | 'timestamp' | 'read'> | null = null;
      
      switch (newStatus) {
        case 'driver_assigned':
          notification = {
            userId: customerId,
            userType: 'customer',
            type: 'order',
            title: 'Driver Assigned',
            message: `A driver has been assigned to your order ${order.order_number?.slice(-8)}.`,
            priority: 'medium',
            actionable: true,
            actionText: 'Track Order',
            actionLink: '/order-tracking',
            orderId: order.id,
            orderNumber: order.order_number
          };
          break;
          
        case 'route_to_pickup':
          notification = {
            userId: customerId,
            userType: 'customer',
            type: 'order',
            title: 'Driver En Route to Pickup',
            message: `Your driver is on the way to pickup your order ${order.order_number?.slice(-8)}.`,
            priority: 'medium',
            actionable: true,
            actionText: 'Track Order',
            actionLink: '/order-tracking',
            orderId: order.id,
            orderNumber: order.order_number
          };
          break;
          
        case 'in_transit':
          notification = {
            userId: customerId,
            userType: 'customer',
            type: 'order',
            title: 'Order Out for Delivery',
            message: `Your order ${order.order_number?.slice(-8)} is out for delivery.`,
            priority: 'medium',
            actionable: true,
            actionText: 'Track Order',
            actionLink: '/order-tracking',
            orderId: order.id,
            orderNumber: order.order_number
          };
          break;
          
        case 'delivered':
          notification = {
            userId: customerId,
            userType: 'customer',
            type: 'order',
            title: 'Order Delivered',
            message: `Your order ${order.order_number?.slice(-8)} has been delivered successfully.`,
            priority: 'low',
            actionable: true,
            actionText: 'Rate Driver',
            actionLink: '/order-tracking',
            orderId: order.id,
            orderNumber: order.order_number
          };
          break;
      }
      
      if (notification) {
        await this.createNotification(customerId, notification);
      }
    }
    
    // Notify driver for new orders
    if (driverId && newStatus === 'driver_assigned') {
      const notification: Omit<Notification, 'id' | 'timestamp' | 'read'> = {
        userId: driverId,
        userType: 'driver',
        type: 'order',
        title: 'New Order Assigned',
        message: `You have been assigned to order ${order.order_number?.slice(-8)}. Estimated earnings: $${order.pricing?.estimated_usd || '0'}`,
        priority: 'medium',
        actionable: true,
        actionText: 'View Order',
        actionLink: '/order-tracking',
        orderId: order.id,
        orderNumber: order.order_number
      };
      await this.createNotification(driverId, notification);
    }
  }
}