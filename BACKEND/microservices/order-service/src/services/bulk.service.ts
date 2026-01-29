import { OrderRepository } from '../repositories/order.repository';
import { BulkOrderRepository } from '../repositories/bulk.repository';
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
  private logger = new Logger('BulkService');
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
      await this.notificationService.sendBulkOrderCompleteNotification(
        bulkOrder.customerId,
        bulkOrderId,
        createdOrders.successful.length,
        createdOrders.failed.length
      );

      return {
        ...bulkOrder,
        orders: createdOrders.successful
      };
    } catch (error) {
      this.logger.error(`Failed to process bulk order ${bulkOrderId}:`, error);
      await this.bulkRepository.updateBulkOrderStatus(
        bulkOrderId, 
        'failed', 
        error.message
      );
      throw error;
    }
  }

  private async createBulkOrders(
    bulkOrderId: string, 
    orders: OrderData[]
  ): Promise<{ successful: any[]; failed: { order: OrderData; error: string }[] }> {
    const successful = [];
    const failed = [];

    for (const orderData of orders) {
      try {
        const order = await this.orderService.createOrder({
          ...orderData,
          isBulkOrder: true,
          bulkOrderId,
          customerId: await this.getCustomerIdFromBulkOrder(bulkOrderId)
        });

        successful.push(order);
        this.logger.info(`Created order ${order.id} for bulk order ${bulkOrderId}`);
      } catch (error) {
        failed.push({ order: orderData, error: error.message });
        this.logger.warn(`Failed to create order for bulk order ${bulkOrderId}:`, error);
      }
    }

    return { successful, failed };
  }

  private async getCustomerIdFromBulkOrder(bulkOrderId: string): Promise<string> {
    const bulkOrder = await this.bulkRepository.findById(bulkOrderId);
    if (!bulkOrder) {
      throw new Error(`Bulk order ${bulkOrderId} not found`);
    }
    return bulkOrder.customerId;
  }

  async getBulkOrderStatus(bulkOrderId: string): Promise<any> {
    return this.bulkRepository.findById(bulkOrderId);
  }

  async retryFailedOrders(bulkOrderId: string): Promise<{ retried: number; remainingFailed: number }> {
    const bulkOrder = await this.bulkRepository.findById(bulkOrderId);
    if (!bulkOrder || bulkOrder.processingStatus !== 'completed_with_errors') {
      throw new Error('Bulk order not found or not in retryable state');
    }

    // Implementation for retrying failed orders
    // This would fetch failed orders and retry them
    this.logger.info(`Retrying failed orders for bulk order ${bulkOrderId}`);
    
    // Placeholder implementation
    return { retried: 0, remainingFailed: bulkOrder.failedOrders };
  }
}