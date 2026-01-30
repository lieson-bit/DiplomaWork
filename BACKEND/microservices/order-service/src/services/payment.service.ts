import { Logger } from './logger';
import { HttpClient } from '../utils/httpClient';

export interface PaymentRequest {
  orderId: string;
  customerId: string;
  driverId: string;
  amount: number;
  paymentMethod: 'wallet' | 'cash';
}

export interface PaymentResponse {
  success: boolean;
  message: string;
  customerBalanceUpdated: boolean;
  driverBalanceUpdated: boolean;
  transactionId?: string;
}

export class PaymentService {
  private logger = new Logger('PaymentService');
  private httpClient: HttpClient;

  constructor() {
    this.httpClient = new HttpClient();
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      this.logger.info(`Processing payment for order ${request.orderId}, method: ${request.paymentMethod}`);

      if (request.paymentMethod === 'cash') {
        // Cash payment - no balance updates needed
        return {
          success: true,
          message: 'Cash payment recorded. Driver will collect payment on delivery.',
          customerBalanceUpdated: false,
          driverBalanceUpdated: false
        };
      }

      // Wallet payment - update balances in customer and driver services
      const customerResponse = await this.updateCustomerBalance(
        request.customerId,
        -request.amount,
        request.orderId
      );

      if (!customerResponse.success) {
        throw new Error(`Failed to update customer balance: ${customerResponse.message}`);
      }

      // Calculate driver earnings (amount - 15% platform fee)
      const platformFee = request.amount * 0.15;
      const driverEarnings = request.amount - platformFee;

      const driverResponse = await this.updateDriverBalance(
        request.driverId,
        driverEarnings,
        request.orderId
      );

      if (!driverResponse.success) {
        // Refund customer if driver update fails
        await this.updateCustomerBalance(
          request.customerId,
          request.amount,
          `${request.orderId}_refund`
        );
        
        throw new Error(`Failed to update driver balance: ${driverResponse.message}`);
      }

      return {
        success: true,
        message: 'Payment processed successfully',
        customerBalanceUpdated: true,
        driverBalanceUpdated: true,
        transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
    } catch (error) {
      this.logger.error('Payment processing failed:', error);
      return {
        success: false,
        message: error.message || 'Payment processing failed',
        customerBalanceUpdated: false,
        driverBalanceUpdated: false
      };
    }
  }

  async refundPayment(
    customerId: string,
    driverId: string,
    amount: number,
    orderId: string,
    reason: string = 'refund'
  ): Promise<PaymentResponse> {
    try {
      this.logger.info(`Processing refund for order ${orderId}`);

      // Refund customer
      const customerResponse = await this.updateCustomerBalance(
        customerId,
        amount,
        `${orderId}_refund`
      );

      if (!customerResponse.success) {
        return customerResponse;
      }

      // Deduct from driver (if driver was already paid)
      let driverRefunded = false;
      if (driverId) {
        const driverResponse = await this.updateDriverBalance(
          driverId,
          -amount * 0.85, // Deduct driver earnings (excluding platform fee)
          `${orderId}_refund`
        );
        driverRefunded = driverResponse.success;
      }

      return {
        success: true,
        message: `Refund processed: ${reason}`,
        customerBalanceUpdated: true,
        driverBalanceUpdated: driverRefunded,
        transactionId: `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
    } catch (error) {
      this.logger.error('Refund processing failed:', error);
      return {
        success: false,
        message: error.message || 'Refund processing failed',
        customerBalanceUpdated: false,
        driverBalanceUpdated: false
      };
    }
  }

  private async updateCustomerBalance(
    customerId: string,
    amount: number,
    referenceId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.httpClient.post(
        `${process.env.CUSTOMER_SERVICE_URL}/api/internal/balance/update`,
        {
          customerId,
          amount,
          referenceId,
          type: 'order_transaction'
        },
        {
          headers: {
            'x-service-secret': process.env.SERVICE_SECRET
          }
        }
      );

      return {
        success: response.data.success || false,
        message: response.data.message || 'Balance updated'
      };
    } catch (error: any) {
      this.logger.error('Failed to update customer balance:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Customer service error'
      };
    }
  }

  private async updateDriverBalance(
    driverId: string,
    amount: number,
    referenceId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.httpClient.post(
        `${process.env.DRIVER_SERVICE_URL}/api/internal/balance/update`,
        {
          driverId,
          amount,
          referenceId,
          type: 'order_earnings'
        },
        {
          headers: {
            'x-service-secret': process.env.SERVICE_SECRET
          }
        }
      );

      return {
        success: response.data.success || false,
        message: response.data.message || 'Balance updated'
      };
    } catch (error: any) {
      this.logger.error('Failed to update driver balance:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Driver service error'
      };
    }
  }

  async verifyCustomerBalance(customerId: string, requiredAmount: number): Promise<boolean> {
    try {
      const response = await this.httpClient.get(
        `${process.env.CUSTOMER_SERVICE_URL}/api/internal/balance/${customerId}`,
        {
          headers: {
            'x-service-secret': process.env.SERVICE_SECRET
          }
        }
      );

      const balance = response.data.balance || 0;
      return balance >= requiredAmount;
    } catch (error) {
      this.logger.warn('Could not verify customer balance, assuming sufficient:', error);
      return true; // Fail open for development
    }
  }

  calculateDriverEarnings(totalAmount: number): number {
    const platformFeePercent = 15; // 15% platform fee
    const platformFee = totalAmount * (platformFeePercent / 100);
    return totalAmount - platformFee;
  }

  calculatePlatformFee(totalAmount: number): number {
    const platformFeePercent = 15;
    return totalAmount * (platformFeePercent / 100);
  }
}