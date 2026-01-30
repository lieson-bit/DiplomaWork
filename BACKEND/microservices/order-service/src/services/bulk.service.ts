// Update bulk.service.ts:
import { OrderRepository } from '../repositories/order.repository';
import { BulkOrderRepository } from '../repositories/bulk.repository'
import { NotificationService } from './notification.service';
import { ExcelParser } from '../utils/excel.parser';
import { Logger } from '../utils/logger';
import { OrderService } from './order.service';

export interface BulkOrderData {
  customerId: string;
  bulkOrderName: string;
  fileUrl: string;
  totalOrders: number;
  orders: OrderData[];
}

export interface OrderData {
  pickupAddress: string;
  deliveryAddress: string;
  recipientName: string;
  recipientPhone: string;
  packageDescription: string;
  weight: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  specialInstructions?: string;
}

export class BulkService {
  private logger: Logger;
  private orderRepository: OrderRepository;
  private bulkRepository: BulkOrderRepository;
  private notificationService: NotificationService;
  private orderService: OrderService;
  private excelParser: ExcelParser;

  constructor(
    orderRepository: OrderRepository,
    bulkRepository: BulkOrderRepository,
    notificationService: NotificationService,
    orderService: OrderService,
    excelParser: ExcelParser
  ) {
    this.logger = new Logger('BulkService');
    this.orderRepository = orderRepository;
    this.bulkRepository = bulkRepository;
    this.notificationService = notificationService;
    this.orderService = orderService;
    this.excelParser = excelParser;
  }

  async processBulkOrder(bulkOrderId: string, fileBuffer: Buffer): Promise<BulkOrderData> {
    try {
      this.logger.info(`Processing bulk order ${bulkOrderId}`);

      // Parse Excel file
      const orders = await this.excelParser.parseBulkOrderFile(fileBuffer);
      
      // Update bulk order status to processing
      await this.bulkRepository.updateBulkOrderStatus(bulkOrderId, 'processing');

      // Create orders in batch
      const createdOrders = await this.createBulkOrders(bulkOrderId, orders);

      // Update bulk order with results
      const bulkOrder = await this.bulkRepository.completeBulkOrderProcessing(
        bulkOrderId,
        createdOrders.successful.length,
        createdOrders.failed.length
      );

      // Send notification
      await this.sendBulkOrderCompleteNotification(
        bulkOrder.customer_id,
        bulkOrderId,
        createdOrders.successful.length,
        createdOrders.failed.length
      );

      return {
        customerId: bulkOrder.customer_id,
        bulkOrderName: bulkOrder.bulk_order_name,
        fileUrl: bulkOrder.file_url,
        totalOrders: bulkOrder.total_orders,
        orders: createdOrders.successful
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process bulk order ${bulkOrderId}:`, errorMessage);
      await this.bulkRepository.updateBulkOrderStatus(
        bulkOrderId, 
        'failed', 
        errorMessage
      );
      throw error;
    }
  }

  private async createBulkOrders(
    bulkOrderId: string, 
    orders: any
  ): Promise<{ successful: any[]; failed: { order: OrderData; error: string }[] }> {
    const successful = [];
    const failed = [];

    const orderList: OrderData[] = Array.isArray(orders)
      ? orders
      : orders?.rows ?? orders?.data ?? orders?.orders ?? orders?.items ?? [];

    for (const orderData of orderList) {
      if (!orderData) continue;
      try {
        const customerId = await this.getCustomerIdFromBulkOrder(bulkOrderId);
        
        const order = await this.orderService.createOrder(customerId, {
          pickup_address: orderData.pickupAddress,
          delivery_address: orderData.deliveryAddress,
          pickup_contact_name: orderData.recipientName,
          pickup_contact_phone: orderData.recipientPhone,
          delivery_contact_name: orderData.recipientName,
          delivery_contact_phone: orderData.recipientPhone,
          package_description: orderData.packageDescription,
          total_weight_kg: orderData.weight,
          total_volume_m3: orderData.dimensions ? 
            (orderData.dimensions.length * orderData.dimensions.width * orderData.dimensions.height) / 1000000 : 0.1,
          customer_notes: orderData.specialInstructions,
          is_bulk_order: true,
          bulk_order_id: bulkOrderId
        });

        successful.push(order);
        this.logger.info(`Created order ${order.id} for bulk order ${bulkOrderId}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        failed.push({ order: orderData, error: errorMessage });
        this.logger.warn(`Failed to create order for bulk order ${bulkOrderId}:`, errorMessage);
      }
    }

    return { successful, failed };
  }

  private async getCustomerIdFromBulkOrder(bulkOrderId: string): Promise<string> {
    const bulkOrder = await this.bulkRepository.findById(bulkOrderId);
    if (!bulkOrder) {
      throw new Error(`Bulk order ${bulkOrderId} not found`);
    }
    return bulkOrder.customer_id;
  }

  async getBulkOrderStatus(bulkOrderId: string): Promise<any> {
    return this.bulkRepository.findById(bulkOrderId);
  }

  async retryFailedOrders(bulkOrderId: string): Promise<{ retried: number; remainingFailed: number }> {
    const bulkOrder = await this.bulkRepository.findById(bulkOrderId);
    if (!bulkOrder || bulkOrder.processing_status !== 'completed_with_errors') {
      throw new Error('Bulk order not found or not in retryable state');
    }

    // Implementation for retrying failed orders
    this.logger.info(`Retrying failed orders for bulk order ${bulkOrderId}`);
    
    // Placeholder implementation
    return { retried: 0, remainingFailed: bulkOrder.failed_orders };
  }

  // ADDED: Missing method for notification
  private async sendBulkOrderCompleteNotification(
    customerId: string,
    bulkOrderId: string,
    successfulCount: number,
    failedCount: number
  ): Promise<void> {
    try {
      await this.notificationService.sendOrderNotification(
        customerId,
        bulkOrderId,
        'bulk_order_completed',
        { 
          successfulCount, 
          failedCount,
          totalCount: successfulCount + failedCount
        }
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn('Failed to send bulk order completion notification:', errorMessage);
    }
  }
}