import { Logger } from '../utils/logger';
import { HttpClient } from '../utils/httpClient';

export interface PaymentRequest {
  orderId: string;
  customerId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentMethodId?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  transactionId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  paymentMethod: string;
  timestamp: Date;
  error?: string;
}

export interface RefundRequest {
  paymentId: string;
  orderId: string;
  amount: number;
  reason?: string;
}

export interface PaymentCard {
  id: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export type PaymentMethod = 'card' | 'wallet' | 'cash' | 'bank_transfer';
export type PaymentStatus = 'pending' | 'authorized' | 'completed' | 'refunded' | 'failed';

export class PaymentService {
  private logger = new Logger('PaymentService');
  private httpClient: HttpClient;
  private paymentGatewayUrl: string;
  private apiKey: string;

  constructor() {
    this.httpClient = new HttpClient();
    this.paymentGatewayUrl = process.env.PAYMENT_GATEWAY_URL || 'https://api.payment-gateway.com';
    this.apiKey = process.env.PAYMENT_GATEWAY_API_KEY || '';
  }

  async processPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    try {
      this.logger.info(`Processing payment for order ${paymentRequest.orderId}`);

      // Validate payment request
      this.validatePaymentRequest(paymentRequest);

      // Prepare payment payload for gateway
      const payload = this.preparePaymentPayload(paymentRequest);

      // Call payment gateway
      const response = await this.callPaymentGateway('/v1/payments', payload);

      // Parse and return response
      const paymentResponse: PaymentResponse = {
        transactionId: response.id,
        status: this.mapPaymentStatus(response.status),
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        paymentMethod: paymentRequest.paymentMethod,
        timestamp: new Date()
      };

      this.logger.info(`Payment processed for order ${paymentRequest.orderId}: ${paymentResponse.status}`);

      return paymentResponse;
    } catch (error) {
      this.logger.error(`Payment processing failed for order ${paymentRequest.orderId}:`, error);
      throw new Error(`Payment processing failed: ${error.message}`);
    }
  }

  async authorizePayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    try {
      this.logger.info(`Authorizing payment for order ${paymentRequest.orderId}`);

      const payload = {
        ...this.preparePaymentPayload(paymentRequest),
        capture: false // Only authorize, don't capture
      };

      const response = await this.callPaymentGateway('/v1/payments/authorize', payload);

      return {
        transactionId: response.id,
        status: 'authorized',
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        paymentMethod: paymentRequest.paymentMethod,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error(`Payment authorization failed for order ${paymentRequest.orderId}:`, error);
      throw new Error(`Payment authorization failed: ${error.message}`);
    }
  }

  async capturePayment(transactionId: string, amount: number): Promise<PaymentResponse> {
    try {
      this.logger.info(`Capturing payment ${transactionId}`);

      const response = await this.callPaymentGateway(
        `/v1/payments/${transactionId}/capture`,
        { amount }
      );

      return {
        transactionId: response.id,
        status: 'completed',
        amount: response.amount,
        currency: response.currency,
        paymentMethod: response.payment_method,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error(`Payment capture failed for transaction ${transactionId}:`, error);
      throw new Error(`Payment capture failed: ${error.message}`);
    }
  }

  async refundPayment(refundRequest: RefundRequest): Promise<PaymentResponse> {
    try {
      this.logger.info(`Processing refund for payment ${refundRequest.paymentId}`);

      const response = await this.callPaymentGateway(
        `/v1/payments/${refundRequest.paymentId}/refund`,
        {
          amount: refundRequest.amount,
          reason: refundRequest.reason
        }
      );

      return {
        transactionId: response.id,
        status: 'refunded',
        amount: refundRequest.amount,
        currency: response.currency,
        paymentMethod: response.payment_method,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error(`Refund failed for payment ${refundRequest.paymentId}:`, error);
      throw new Error(`Refund failed: ${error.message}`);
    }
  }

  async getPaymentStatus(transactionId: string): Promise<PaymentResponse> {
    try {
      const response = await this.callPaymentGateway(`/v1/payments/${transactionId}`);

      return {
        transactionId: response.id,
        status: this.mapPaymentStatus(response.status),
        amount: response.amount,
        currency: response.currency,
        paymentMethod: response.payment_method,
        timestamp: new Date(response.created_at)
      };
    } catch (error) {
      this.logger.error(`Failed to get payment status for ${transactionId}:`, error);
      throw new Error(`Failed to get payment status: ${error.message}`);
    }
  }

  async savePaymentMethod(
    customerId: string,
    paymentMethod: PaymentMethod,
    details: any
  ): Promise<PaymentCard> {
    try {
      const response = await this.callPaymentGateway('/v1/payment-methods', {
        customer_id: customerId,
        type: paymentMethod,
        details
      });

      return {
        id: response.id,
        last4: response.last4,
        brand: response.brand,
        expMonth: response.exp_month,
        expYear: response.exp_year,
        isDefault: response.is_default
      };
    } catch (error) {
      this.logger.error(`Failed to save payment method for customer ${customerId}:`, error);
      throw new Error(`Failed to save payment method: ${error.message}`);
    }
  }

  async getCustomerPaymentMethods(customerId: string): Promise<PaymentCard[]> {
    try {
      const response = await this.callPaymentGateway(`/v1/customers/${customerId}/payment-methods`);
      return response.map((method: any) => ({
        id: method.id,
        last4: method.last4,
        brand: method.brand,
        expMonth: method.exp_month,
        expYear: method.exp_year,
        isDefault: method.is_default
      }));
    } catch (error) {
      this.logger.error(`Failed to get payment methods for customer ${customerId}:`, error);
      return [];
    }
  }

  async deletePaymentMethod(paymentMethodId: string): Promise<boolean> {
    try {
      await this.callPaymentGateway(`/v1/payment-methods/${paymentMethodId}`, {}, 'DELETE');
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete payment method ${paymentMethodId}:`, error);
      return false;
    }
  }

  private validatePaymentRequest(request: PaymentRequest): void {
    if (request.amount <= 0) {
      throw new Error('Payment amount must be greater than 0');
    }

    if (!request.customerId) {
      throw new Error('Customer ID is required');
    }

    if (!request.orderId) {
      throw new Error('Order ID is required');
    }

    if (!request.paymentMethod) {
      throw new Error('Payment method is required');
    }
  }

  private preparePaymentPayload(request: PaymentRequest): any {
    return {
      amount: Math.round(request.amount * 100), // Convert to cents
      currency: request.currency || 'USD',
      customer: request.customerId,
      order_id: request.orderId,
      payment_method: request.paymentMethod,
      payment_method_id: request.paymentMethodId,
      metadata: {
        ...request.metadata,
        service: 'order-delivery',
        timestamp: new Date().toISOString()
      }
    };
  }

  private async callPaymentGateway(endpoint: string, data?: any, method: string = 'POST'): Promise<any> {
    const url = `${this.paymentGatewayUrl}${endpoint}`;
    
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.httpClient.request({
        url,
        method,
        headers,
        data,
        timeout: 30000 // 30 seconds timeout
      });

      if (response.status >= 200 && response.status < 300) {
        return response.data;
      } else {
        throw new Error(`Payment gateway error: ${response.status} - ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      if (error.response) {
        throw new Error(`Payment gateway error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        throw new Error('Payment gateway not responding');
      } else {
        throw error;
      }
    }
  }

  private mapPaymentStatus(gatewayStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'pending': 'pending',
      'requires_action': 'pending',
      'requires_confirmation': 'pending',
      'requires_payment_method': 'pending',
      'requires_capture': 'authorized',
      'succeeded': 'completed',
      'canceled': 'failed',
      'failed': 'failed',
      'refunded': 'refunded'
    };

    return statusMap[gatewayStatus] || 'failed';
  }

  calculatePlatformFee(amount: number, feePercent: number = 15): number {
    return (amount * feePercent) / 100;
  }

  calculateDriverEarnings(
    totalAmount: number,
    platformFee: number,
    distanceFee?: number,
    weightFee?: number
  ): number {
    const baseEarnings = totalAmount - platformFee;
    // Driver gets 100% of distance and weight fees
    const additionalEarnings = (distanceFee || 0) + (weightFee || 0);
    return baseEarnings + additionalEarnings;
  }
}