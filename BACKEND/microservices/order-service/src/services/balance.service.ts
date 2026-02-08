import { Logger } from '../utils/logger';
import { db } from '../config/database';

export interface UserBalance {
  userId: string;
  userType: 'customer' | 'driver';
  availableBalance: number;
  pendingBalance: number;
  thisWeekSpent: number;
  thisWeekEarned: number;
  totalEarned: number;
  totalSpent: number;
  currency: string;
}

export interface Transaction {
  id: string;
  userId: string;
  orderId: string;
  transactionType: 'payment' | 'refund' | 'payout' | 'adjustment';
  amount: number;
  previousBalance: number;
  newBalance: number;
  description: string;
  createdAt: Date;
}

export class BalanceService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('BalanceService');
  }

  // Get user balance with all metrics
  async getUserBalance(userId: string, userType: 'customer' | 'driver'): Promise<UserBalance> {
    try {
      // Get current balance
      const balanceQuery = `
        SELECT * FROM user_balances 
        WHERE user_id = ? AND user_type = ?
      `;
      
      const balanceResult = await db.queryOne<any>(balanceQuery, [userId, userType]);
      
      if (!balanceResult) {
        // Initialize balance if not exists
        return await this.initializeUserBalance(userId, userType);
      }
      
      // Calculate this week's metrics
      const weekMetrics = await this.getThisWeekMetrics(userId, userType);
      
      return {
        userId,
        userType,
        availableBalance: parseFloat(balanceResult.available_balance),
        pendingBalance: parseFloat(balanceResult.pending_balance),
        thisWeekSpent: weekMetrics.thisWeekSpent,
        thisWeekEarned: weekMetrics.thisWeekEarned,
        totalEarned: parseFloat(balanceResult.total_earned),
        totalSpent: parseFloat(balanceResult.total_spent),
        currency: balanceResult.currency || 'USD'
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get user balance:', errorMessage);
      throw error;
    }
  }
  
  // Initialize user balance
  private async initializeUserBalance(userId: string, userType: 'customer' | 'driver'): Promise<UserBalance> {
    const insertQuery = `
      INSERT INTO user_balances 
      (user_id, user_type, available_balance, pending_balance, total_earned, total_spent, currency)
      VALUES (?, ?, 0, 0, 0, 0, 'USD')
    `;
    
    await db.execute(insertQuery, [userId, userType]);
    
    return {
      userId,
      userType,
      availableBalance: 0,
      pendingBalance: 0,
      thisWeekSpent: 0,
      thisWeekEarned: 0,
      totalEarned: 0,
      totalSpent: 0,
      currency: 'USD'
    };
  }
  
  // Get this week's metrics
  private async getThisWeekMetrics(userId: string, userType: 'customer' | 'driver'): Promise<{
    thisWeekSpent: number;
    thisWeekEarned: number;
  }> {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const query = `
      SELECT 
        SUM(CASE WHEN transaction_type IN ('payment', 'payout') AND amount < 0 THEN ABS(amount) ELSE 0 END) as spent,
        SUM(CASE WHEN transaction_type IN ('payment', 'payout') AND amount > 0 THEN amount ELSE 0 END) as earned
      FROM balance_transactions
      WHERE user_id = ? 
        AND created_at >= ?
    `;
    
    const result = await db.queryOne<any>(query, [userId, startOfWeek]);
    
    return {
      thisWeekSpent: parseFloat(result?.spent || 0),
      thisWeekEarned: parseFloat(result?.earned || 0)
    };
  }
  
  // Process order payment (deduct from customer, add to driver pending)
  async processOrderPayment(
    customerId: string,
    driverId: string,
    amount: number,
    orderId: string
  ): Promise<void> {
    try {
      await db.transaction(async (connection) => {
        // 1. Deduct from customer's available balance
        const customerUpdateQuery = `
          UPDATE user_balances 
          SET available_balance = available_balance - ?,
              total_spent = total_spent + ?,
              updated_at = NOW()
          WHERE user_id = ? AND user_type = 'customer'
        `;
        
        await connection.execute(customerUpdateQuery, [amount, amount, customerId]);
        
        // Record customer transaction
        const customerTransactionQuery = `
          INSERT INTO balance_transactions 
          (user_id, order_id, transaction_type, amount, description)
          VALUES (?, ?, 'payment', -?, ?)
        `;
        
        await connection.execute(customerTransactionQuery, [
          customerId,
          orderId,
          amount,
          `Payment for order ${orderId}`
        ]);
        
        // 2. Add to driver's pending balance
        const driverUpdateQuery = `
          UPDATE user_balances 
          SET pending_balance = pending_balance + ?,
              updated_at = NOW()
          WHERE user_id = ? AND user_type = 'driver'
        `;
        
        await connection.execute(driverUpdateQuery, [amount, driverId]);
        
        // Record driver transaction (pending)
        const driverTransactionQuery = `
          INSERT INTO balance_transactions 
          (user_id, order_id, transaction_type, amount, description)
          VALUES (?, ?, 'payment', ?, ?)
        `;
        
        await connection.execute(driverTransactionQuery, [
          driverId,
          orderId,
          amount,
          `Pending earnings from order ${orderId}`
        ]);
      });
      
      this.logger.info(`Payment processed: $${amount} from customer ${customerId} to driver ${driverId}`);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to process order payment:', errorMessage);
      throw error;
    }
  }
  
  // Fix the completeOrderPayment method - replace lines 102-106:
async completeOrderPayment(orderId: string): Promise<void> {
  try {
    // Get order details - FIXED QUERY
    const orderQuery = `
      SELECT driver_id, total_price, driver_earnings 
      FROM orders 
      WHERE id = ?
    `;
    
    const order = await db.queryOne<any>(orderQuery, [orderId]);
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    const driverId = order.driver_id;
    const amount = order.driver_earnings || order.total_price * 0.8; // 80% to driver if not specified
    
    await db.transaction(async (connection) => {
      // Move from pending to available balance for driver
      const updateQuery = `
        UPDATE user_balances 
        SET pending_balance = pending_balance - ?,
            available_balance = available_balance + ?,
            total_earned = total_earned + ?,
            updated_at = NOW()
        WHERE user_id = ? AND user_type = 'driver'
      `;
      
      await connection.execute(updateQuery, [amount, amount, amount, driverId]);
      
      // Update driver transaction status
      const transactionQuery = `
        UPDATE balance_transactions 
        SET description = ?
        WHERE user_id = ? AND order_id = ? AND transaction_type = 'payment' AND amount > 0
      `;
      
      await connection.execute(transactionQuery, [
        `Completed earnings from order ${orderId}`,
        driverId,
        orderId
      ]);
    });
    
    this.logger.info(`Order payment completed: $${amount} released to driver ${driverId}`);
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error('Failed to complete order payment:', errorMessage);
    throw error;
  }
}
  
  // Get recent transactions
  async getRecentTransactions(userId: string, limit: number = 10): Promise<Transaction[]> {
    try {
      const query = `
        SELECT * FROM balance_transactions 
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `;
      
      const transactions = await db.query<any>(query, [userId, limit]);
      
      return transactions.map((tx: any) => ({
        id: tx.id,
        userId: tx.user_id,
        orderId: tx.order_id,
        transactionType: tx.transaction_type,
        amount: parseFloat(tx.amount),
        previousBalance: parseFloat(tx.previous_balance),
        newBalance: parseFloat(tx.new_balance),
        description: tx.description,
        createdAt: tx.created_at
      }));
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get transactions:', errorMessage);
      throw error;
    }
  }
  
  // Add funds to user balance
  async addFunds(
    userId: string,
    userType: 'customer' | 'driver',
    amount: number,
    description: string
  ): Promise<void> {
    try {
      const query = `
        UPDATE user_balances 
        SET available_balance = available_balance + ?,
            updated_at = NOW()
        WHERE user_id = ? AND user_type = ?
      `;
      
      await db.execute(query, [amount, userId, userType]);
      
      // Record transaction
      const transactionQuery = `
        INSERT INTO balance_transactions 
        (user_id, transaction_type, amount, description)
        VALUES (?, 'adjustment', ?, ?)
      `;
      
      await db.execute(transactionQuery, [userId, amount, description]);
      
      this.logger.info(`Added $${amount} to ${userType} ${userId}: ${description}`);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to add funds:', errorMessage);
      throw error;
    }
  }
  
  // Process refund
  async processRefund(
    orderId: string,
    customerId: string,
    driverId: string,
    amount: number,
    reason: string
  ): Promise<void> {
    try {
      await db.transaction(async (connection) => {
        // 1. Refund customer
        const customerQuery = `
          UPDATE user_balances 
          SET available_balance = available_balance + ?,
              updated_at = NOW()
          WHERE user_id = ? AND user_type = 'customer'
        `;
        
        await connection.execute(customerQuery, [amount, customerId]);
        
        // Record customer refund transaction
        const customerTxQuery = `
          INSERT INTO balance_transactions 
          (user_id, order_id, transaction_type, amount, description)
          VALUES (?, ?, 'refund', ?, ?)
        `;
        
        await connection.execute(customerTxQuery, [
          customerId,
          orderId,
          amount,
          `Refund for order ${orderId}: ${reason}`
        ]);
        
        // 2. Deduct from driver if already paid
        const driverQuery = `
          UPDATE user_balances 
          SET available_balance = available_balance - ?,
              updated_at = NOW()
          WHERE user_id = ? AND user_type = 'driver'
        `;
        
        await connection.execute(driverQuery, [amount, driverId]);
        
        // Record driver refund transaction
        const driverTxQuery = `
          INSERT INTO balance_transactions 
          (user_id, order_id, transaction_type, amount, description)
          VALUES (?, ?, 'refund', -?, ?)
        `;
        
        await connection.execute(driverTxQuery, [
          driverId,
          orderId,
          amount,
          `Refund deduction for order ${orderId}: ${reason}`
        ]);
      });
      
      this.logger.info(`Refund processed: $${amount} for order ${orderId}`);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to process refund:', errorMessage);
      throw error;
    }
  }
}