import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { db } from '../config/database';
import httpClient from '../utils/httpClient';
import logger from '../utils/logger';
import {
  Customer,
  CustomerAddress,
  CustomerPreference,
  CustomerPaymentMethod,
  DeliveryTimeSlot,
  CustomerFeedback,
  CreateCustomerDto,
  UpdateCustomerDto,
  AddressDto,
  PaymentMethodDto,
  PreferencesDto,
  TimeSlotDto,
  FeedbackDto,
  CustomerStats
} from '../types';

export class CustomerService {
  private async validateUser(userId: string): Promise<boolean> {
    try {
      const userServiceUrl = process.env.USER_SERVICE_URL;
      const serviceSecret = process.env.SERVICE_SECRET;
      
      const response = await httpClient.get(
        `${userServiceUrl}/api/auth/validate/${userId}`,
        {
          headers: {
            'x-service-secret': serviceSecret
          }
        }
      );
      
      return response.data.valid === true;
    } catch (error: any) {
      logger.error('User validation failed:', error);
      
      // If user service is down but we have service secret, we can trust the JWT
      if (error.response?.status === 503 || error.code === 'ECONNREFUSED') {
        logger.warn('User service unavailable, proceeding with caution');
        return true;
      }
      
      return false;
    }
  }

  async createCustomer(userId: string, data: CreateCustomerDto): Promise<Customer> {
    // Validate user exists
    const isValidUser = await this.validateUser(userId);
    if (!isValidUser) {
      throw new Error('User not found or invalid');
    }

    // Check if customer already exists
    const existingCustomers = await db.query<Customer>(
      'SELECT * FROM customers WHERE user_id = ?',
      [userId]
    );

    if (existingCustomers.length > 0) {
      throw new Error('Customer profile already exists');
    }

    const customerId = uuidv4();
    const now = new Date();

    // Create customer
    await db.query(
      `INSERT INTO customers (
        id, user_id, account_type, date_of_birth, business_name,
        business_type, business_phone, tax_id, join_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        userId,
        data.accountType || 'personal',
        data.dateOfBirth || null,
        data.businessName || null,
        data.businessType || null,
        data.businessPhone || null,
        data.taxId || null,
        now
      ]
    );

    // Create default preferences
    await db.query(
      `INSERT INTO customer_preferences (
        id, customer_id, language, timezone
      ) VALUES (UUID(), ?, ?, ?)`,
      [customerId, 'en', 'UTC']
    );

    // Return created customer
    const customer = await db.queryOne<Customer>(
      'SELECT * FROM customers WHERE id = ?',
      [customerId]
    );

    if (!customer) {
      throw new Error('Failed to create customer');
    }

    return customer;
  }

  async getCustomerByUserId(userId: string): Promise<Customer | null> {
    return await db.queryOne<Customer>(
      'SELECT * FROM customers WHERE user_id = ?',
      [userId]
    );
  }

  async getCustomerProfile(userId: string): Promise<any> {
    const customer = await this.getCustomerByUserId(userId);
    
    if (!customer) {
      throw new Error('Customer profile not found');
    }

    // Get related data
    const addresses = await db.query<CustomerAddress>(
      'SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC',
      [customer.id]
    );

    const preferences = await db.query<CustomerPreference>(
      'SELECT * FROM customer_preferences WHERE customer_id = ?',
      [customer.id]
    );

    const paymentMethods = await db.query<CustomerPaymentMethod>(
      'SELECT * FROM customer_payment_methods WHERE customer_id = ? AND is_active = TRUE ORDER BY is_default DESC, created_at DESC',
      [customer.id]
    );

    const timeSlots = await db.query<DeliveryTimeSlot>(
      'SELECT * FROM delivery_time_slots WHERE customer_id = ? AND is_active = TRUE ORDER BY day_of_week, start_time',
      [customer.id]
    );

    const recentFeedback = await db.query<CustomerFeedback>(
      'SELECT * FROM customer_feedback WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10',
      [customer.id]
    );

    return {
      ...customer,
      addresses,
      preferences: preferences.length > 0 ? preferences[0] : {},
      paymentMethods,
      timeSlots,
      recentFeedback
    };
  }

  async updateCustomer(userId: string, data: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.getCustomerByUserId(userId);
    
    if (!customer) {
      throw new Error('Customer profile not found');
    }

    // Build update fields
    const updates: string[] = [];
    const values: any[] = [];

    if (data.accountType) {
      updates.push('account_type = ?');
      values.push(data.accountType);
    }

    if (data.dateOfBirth) {
      updates.push('date_of_birth = ?');
      values.push(data.dateOfBirth);
    } else if (data.dateOfBirth === null) {
      updates.push('date_of_birth = NULL');
    }

    if (data.businessName !== undefined) {
      updates.push('business_name = ?');
      values.push(data.businessName);
    }

    if (data.businessType !== undefined) {
      updates.push('business_type = ?');
      values.push(data.businessType);
    }

    if (data.businessPhone !== undefined) {
      updates.push('business_phone = ?');
      values.push(data.businessPhone);
    }

    if (data.taxId !== undefined) {
      updates.push('tax_id = ?');
      values.push(data.taxId);
    }

    if (data.profilePictureUrl !== undefined) {
      updates.push('profile_picture_url = ?');
      values.push(data.profilePictureUrl);
    }

    if (updates.length === 0) {
      return customer;
    }

    updates.push('updated_at = ?');
    values.push(new Date());

    values.push(customer.id);

    await db.query(
      `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Return updated customer
    const updatedCustomer = await db.queryOne<Customer>(
      'SELECT * FROM customers WHERE id = ?',
      [customer.id]
    );

    if (!updatedCustomer) {
      throw new Error('Failed to update customer');
    }

    return updatedCustomer;
  }

  async addAddress(userId: string, data: AddressDto): Promise<CustomerAddress> {
    const customer = await this.getCustomerByUserId(userId);
    
    if (!customer) {
      throw new Error('Customer profile not found');
    }

    // If setting as default, update other addresses
    if (data.isDefault) {
      await db.query(
        'UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = ?',
        [customer.id]
      );
    }

    const addressId = uuidv4();

    await db.query(
      `INSERT INTO customer_addresses (
        id, customer_id, label, address, city, state, country,
        postal_code, latitude, longitude, is_default, is_active, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        addressId,
        customer.id,
        data.label,
        data.address,
        data.city,
        data.state,
        data.country || 'US',
        data.postalCode,
        data.latitude || null,
        data.longitude || null,
        data.isDefault || false,
        true,
        data.notes || null
      ]
    );

    const address = await db.queryOne<CustomerAddress>(
      'SELECT * FROM customer_addresses WHERE id = ?',
      [addressId]
    );

    if (!address) {
      throw new Error('Failed to create address');
    }

    return address;
  }

  async updateAddress(userId: string, addressId: string, data: any): Promise<CustomerAddress> {
    const customer = await this.getCustomerByUserId(userId);
    
    if (!customer) {
      throw new Error('Customer profile not found');
    }

    // Check if address exists and belongs to customer
    const existingAddress = await db.queryOne<CustomerAddress>(
      'SELECT * FROM customer_addresses WHERE id = ? AND customer_id = ?',
      [addressId, customer.id]
    );

    if (!existingAddress) {
      throw new Error('Address not found');
    }

    // If setting as default, update other addresses
    if (data.isDefault === true && !existingAddress.isDefault) {
      await db.query(
        'UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = ?',
        [customer.id]
      );
    }

    // Build update fields
    const updates: string[] = [];
    const values: any[] = [];

    if (data.label !== undefined) {
      updates.push('label = ?');
      values.push(data.label);
    }

    if (data.address !== undefined) {
      updates.push('address = ?');
      values.push(data.address);
    }

    if (data.city !== undefined) {
      updates.push('city = ?');
      values.push(data.city);
    }

    if (data.state !== undefined) {
      updates.push('state = ?');
      values.push(data.state);
    }

    if (data.country !== undefined) {
      updates.push('country = ?');
      values.push(data.country);
    }

    if (data.postalCode !== undefined) {
      updates.push('postal_code = ?');
      values.push(data.postalCode);
    }

    if (data.latitude !== undefined) {
      updates.push('latitude = ?');
      values.push(data.latitude);
    }

    if (data.longitude !== undefined) {
      updates.push('longitude = ?');
      values.push(data.longitude);
    }

    if (data.isDefault !== undefined) {
      updates.push('is_default = ?');
      values.push(data.isDefault);
    }

    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(data.isActive);
    }

    if (data.notes !== undefined) {
      updates.push('notes = ?');
      values.push(data.notes);
    }

    if (updates.length === 0) {
      return existingAddress;
    }

    updates.push('updated_at = ?');
    values.push(new Date());

    values.push(addressId);

    await db.query(
      `UPDATE customer_addresses SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updatedAddress = await db.queryOne<CustomerAddress>(
      'SELECT * FROM customer_addresses WHERE id = ?',
      [addressId]
    );

    if (!updatedAddress) {
      throw new Error('Failed to update address');
    }

    return updatedAddress;
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const customer = await this.getCustomerByUserId(userId);
    
    if (!customer) {
      throw new Error('Customer profile not found');
    }

    // Check if address exists and belongs to customer
    const address = await db.queryOne<CustomerAddress>(
      'SELECT * FROM customer_addresses WHERE id = ? AND customer_id = ?',
      [addressId, customer.id]
    );

    if (!address) {
      throw new Error('Address not found');
    }

    // Don't allow deleting the only address
    const allAddresses = await db.query<CustomerAddress>(
      'SELECT * FROM customer_addresses WHERE customer_id = ? AND is_active = TRUE',
      [customer.id]
    );

    if (allAddresses.length <= 1) {
        throw new Error('Cannot delete the only address');
    }

    // If deleting default address, set another as default
    if (address.isDefault) {
      const otherAddress = allAddresses.find((a: CustomerAddress) => a.id !== addressId);
      if (otherAddress) {
        await db.query(
          'UPDATE customer_addresses SET is_default = TRUE WHERE id = ?',
          [otherAddress.id]
        );
      }
    }

    await db.query(
      'DELETE FROM customer_addresses WHERE id = ?',
      [addressId]
    );
  }

  async addPaymentMethod(userId: string, data: PaymentMethodDto): Promise<CustomerPaymentMethod> {
    const customer = await this.getCustomerByUserId(userId);
    
    if (!customer) {
      throw new Error('Customer profile not found');
    }

    // If setting as default, update other payment methods
    if (data.isDefault) {
      await db.query(
        'UPDATE customer_payment_methods SET is_default = FALSE WHERE customer_id = ?',
        [customer.id]
      );
    }

    const paymentMethodId = uuidv4();

    await db.query(
      `INSERT INTO customer_payment_methods (
        id, customer_id, type, provider, last4, expiry_month, expiry_year,
        name_on_card, paypal_email, bank_name, account_number_masked,
        is_default, is_active, token
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentMethodId,
        customer.id,
        data.type,
        data.provider,
        data.last4 || null,
        data.expiryMonth || null,
        data.expiryYear || null,
        data.nameOnCard || null,
        data.paypalEmail || null,
        data.bankName || null,
        data.accountNumberMasked || null,
        data.isDefault || false,
        true,
        data.token || null
      ]
    );

    const paymentMethod = await db.queryOne<CustomerPaymentMethod>(
      'SELECT * FROM customer_payment_methods WHERE id = ?',
      [paymentMethodId]
    );

    if (!paymentMethod) {
      throw new Error('Failed to create payment method');
    }

    return paymentMethod;
  }

  async updatePaymentMethod(
    userId: string,
    paymentMethodId: string,
    data: any
  ): Promise<CustomerPaymentMethod> {
    const customer = await this.getCustomerByUserId(userId);
    
    if (!customer) {
      throw new Error('Customer profile not found');
    }

    // Check if payment method exists and belongs to customer
    const existingMethod = await db.queryOne<CustomerPaymentMethod>(
      'SELECT * FROM customer_payment_methods WHERE id = ? AND customer_id = ?',
      [paymentMethodId, customer.id]
    );

    if (!existingMethod) {
      throw new Error('Payment method not found');
    }

    // If setting as default, update other payment methods
    if (data.isDefault === true && !existingMethod.isDefault) {
      await db.query(
        'UPDATE customer_payment_methods SET is_default = FALSE WHERE customer_id = ?',
        [customer.id]
      );
    }

    // Build update fields
    const updates: string[] = [];
    const values: any[] = [];

    if (data.isDefault !== undefined) {
      updates.push('is_default = ?');
      values.push(data.isDefault);
    }

    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(data.isActive);
    }

    if (data.expiryMonth !== undefined) {
      updates.push('expiry_month = ?');
      values.push(data.expiryMonth);
    }

    if (data.expiryYear !== undefined) {
      updates.push('expiry_year = ?');
      values.push(data.expiryYear);
    }

    if (data.nameOnCard !== undefined) {
      updates.push('name_on_card = ?');
      values.push(data.nameOnCard);
    }

    if (updates.length === 0) {
      return existingMethod;
    }

    updates.push('updated_at = ?');
    values.push(new Date());

    values.push(paymentMethodId);

    await db.query(
      `UPDATE customer_payment_methods SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updatedMethod = await db.queryOne<CustomerPaymentMethod>(
      'SELECT * FROM customer_payment_methods WHERE id = ?',
      [paymentMethodId]
    );

    if (!updatedMethod) {
      throw new Error('Failed to update payment method');
    }

    return updatedMethod;
  }

  async deletePaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    const customer = await this.getCustomerByUserId(userId);
    
    if (!customer) {
      throw new Error('Customer profile not found');
    }

    // Check if payment method exists and belongs to customer
    const paymentMethod = await db.queryOne<CustomerPaymentMethod>(
      'SELECT * FROM customer_payment_methods WHERE id = ? AND customer_id = ?',
      [paymentMethodId, customer.id]
    );

    if (!paymentMethod) {
      throw new Error('Payment method not found');
    }

    // Don't allow deleting the only active payment method
    const allMethods = await db.query<CustomerPaymentMethod>(
      'SELECT * FROM customer_payment_methods WHERE customer_id = ? AND is_active = TRUE',
      [customer.id]
    );

    if (allMethods.length <= 1) {
      throw new Error('Cannot delete the only payment method');
    }

    // If deleting default payment method, set another as default
    if (paymentMethod.isDefault) {
      const otherMethod = allMethods.find((m: CustomerPaymentMethod) => m.id !== paymentMethodId);
      if (otherMethod) {
        await db.query(
          'UPDATE customer_payment_methods SET is_default = TRUE WHERE id = ?',
          [otherMethod.id]
        );
      }
    }

    await db.query(
      'DELETE FROM customer_payment_methods WHERE id = ?',
      [paymentMethodId]
    );
  }

  async updatePreferences(userId: string, data: PreferencesDto): Promise<CustomerPreference | null> {
    const customer = await this.getCustomerByUserId(userId);
    
    if (!customer) {
      throw new Error('Customer profile not found');
    }

    // Build update fields
    const updates: string[] = [];
    const values: any[] = [];

    if (data.defaultPickupType !== undefined) {
      updates.push('default_pickup_type = ?');
      values.push(data.defaultPickupType);
    }

    if (data.defaultPaymentId !== undefined) {
      updates.push('default_payment_id = ?');
      values.push(data.defaultPaymentId);
    }

    if (data.notificationEmail !== undefined) {
      updates.push('notification_email = ?');
      values.push(data.notificationEmail);
    }

    if (data.notificationSMS !== undefined) {
      updates.push('notification_sms = ?');
      values.push(data.notificationSMS);
    }

    if (data.notificationPush !== undefined) {
      updates.push('notification_push = ?');
      values.push(data.notificationPush);
    }

    if (data.shareLocationData !== undefined) {
      updates.push('share_location_data = ?');
      values.push(data.shareLocationData);
    }

    if (data.shareUsageAnalytics !== undefined) {
      updates.push('share_usage_analytics = ?');
      values.push(data.shareUsageAnalytics);
    }

    if (data.marketingEmails !== undefined) {
      updates.push('marketing_emails = ?');
      values.push(data.marketingEmails);
    }

    if (data.language !== undefined) {
      updates.push('language = ?');
      values.push(data.language);
    }

    if (data.timezone !== undefined) {
      updates.push('timezone = ?');
      values.push(data.timezone);
    }

    if (updates.length === 0) {
      const preferences = await db.query<CustomerPreference>(
        'SELECT * FROM customer_preferences WHERE customer_id = ?',
        [customer.id]
      );
      return preferences.length > 0 ? preferences[0] : null;
    }

    updates.push('updated_at = ?');
    values.push(new Date());

    values.push(customer.id);

    await db.query(
      `UPDATE customer_preferences SET ${updates.join(', ')} WHERE customer_id = ?`,
      values
    );

    const preferences = await db.query<CustomerPreference>(
      'SELECT * FROM customer_preferences WHERE customer_id = ?',
      [customer.id]
    );

    return preferences.length > 0 ? preferences[0] : null;
  }

  async updateTimeSlots(userId: string, timeSlots: TimeSlotDto[]): Promise<void> {
    const customer = await this.getCustomerByUserId(userId);
    
    if (!customer) {
      throw new Error('Customer profile not found');
    }

    // Delete existing time slots
    await db.query(
      'DELETE FROM delivery_time_slots WHERE customer_id = ?',
      [customer.id]
    );

    // Insert new time slots
    if (timeSlots.length > 0) {
      const values = timeSlots.map(slot => [
        uuidv4(),
        customer.id,
        slot.dayOfWeek,
        slot.startTime,
        slot.endTime,
        slot.isActive !== false
      ]);

      await db.query(
        `INSERT INTO delivery_time_slots 
        (id, customer_id, day_of_week, start_time, end_time, is_active)
        VALUES ?`,
        [values]
      );
    }
  }

  async addFeedback(userId: string, data: FeedbackDto): Promise<CustomerFeedback> {
    const customer = await this.getCustomerByUserId(userId);
    
    if (!customer) {
      throw new Error('Customer profile not found');
    }

    const feedbackId = uuidv4();

    await db.query(
      `INSERT INTO customer_feedback (
        id, customer_id, order_id, rating, comment, category, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        feedbackId,
        customer.id,
        data.orderId || null,
        data.rating,
        data.comment || null,
        data.category || 'other',
        'pending'
      ]
    );

    // Update customer's average rating
    await this.updateCustomerRating(customer.id);

    const feedback = await db.queryOne<CustomerFeedback>(
      'SELECT * FROM customer_feedback WHERE id = ?',
      [feedbackId]
    );

    if (!feedback) {
      throw new Error('Failed to create feedback');
    }

    return feedback;
  }

  private async updateCustomerRating(customerId: string): Promise<void> {
    const feedback = await db.query<{ avg_rating: number }>(
      'SELECT AVG(rating) as avg_rating FROM customer_feedback WHERE customer_id = ? AND rating IS NOT NULL',
      [customerId]
    );

    const averageRating = feedback.length > 0 ? feedback[0].avg_rating : 0;

    await db.query(
      'UPDATE customers SET average_rating = ?, updated_at = ? WHERE id = ?',
      [averageRating, new Date(), customerId]
    );
  }

  async updateOrderStats(userId: string, orderAmount: number): Promise<Customer> {
    const customer = await this.getCustomerByUserId(userId);
    
    if (!customer) {
      throw new Error('Customer profile not found');
    }

    // Calculate loyalty points (1 point per $10 spent)
    const loyaltyPointsEarned = Math.floor(orderAmount / 10);

    // Update customer stats
    await db.query(
      `UPDATE customers 
      SET total_orders = total_orders + 1,
          total_spent = total_spent + ?,
          loyalty_points = loyalty_points + ?,
          updated_at = ?
      WHERE id = ?`,
      [orderAmount, loyaltyPointsEarned, new Date(), customer.id]
    );

    // Update membership level based on total spent
    const updatedCustomer = await db.queryOne<Customer>(
      'SELECT * FROM customers WHERE id = ?',
      [customer.id]
    );

    if (!updatedCustomer) {
      throw new Error('Failed to update order stats');
    }

    let membershipLevel = 'standard';
    if (updatedCustomer.totalSpent >= 10000) {
      membershipLevel = 'premium';
    } else if (updatedCustomer.totalSpent >= 50000) {
      membershipLevel = 'business';
    }

    if (membershipLevel !== updatedCustomer.membershipLevel) {
      await db.query(
        'UPDATE customers SET membership_level = ?, updated_at = ? WHERE id = ?',
        [membershipLevel, new Date(), customer.id]
      );
    }

    const finalCustomer = await db.queryOne<Customer>(
      'SELECT * FROM customers WHERE id = ?',
      [customer.id]
    );

    if (!finalCustomer) {
      throw new Error('Failed to get updated customer');
    }

    return finalCustomer;
  }

  async getCustomerStats(userId: string): Promise<CustomerStats> {
    const customer = await this.getCustomerByUserId(userId);
    
    if (!customer) {
      throw new Error('Customer profile not found');
    }

    // Get counts
    const addressesCount = await db.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM customer_addresses WHERE customer_id = ? AND is_active = TRUE',
      [customer.id]
    );

    const paymentMethodsCount = await db.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM customer_payment_methods WHERE customer_id = ? AND is_active = TRUE',
      [customer.id]
    );

    const feedbackCount = await db.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM customer_feedback WHERE customer_id = ?',
      [customer.id]
    );

    // Calculate account age
    const accountAgeDays = Math.floor(
      (new Date().getTime() - new Date(customer.joinDate).getTime()) /
      (1000 * 60 * 60 * 24)
    );

    return {
      totalOrders: customer.totalOrders,
      totalSpent: customer.totalSpent,
      averageRating: customer.averageRating,
      loyaltyPoints: customer.loyaltyPoints,
      membershipLevel: customer.membershipLevel,
      addressesCount: addressesCount.length > 0 ? addressesCount[0].count : 0,
      paymentMethodsCount: paymentMethodsCount.length > 0 ? paymentMethodsCount[0].count : 0,
      feedbackCount: feedbackCount.length > 0 ? feedbackCount[0].count : 0,
      memberSince: customer.joinDate,
      accountAgeDays
    };
  }

  async uploadProfilePicture(userId: string, file: Express.Multer.File): Promise<string> {
    const customer = await this.getCustomerByUserId(userId);
    
    if (!customer) {
      throw new Error('Customer profile not found');
    }

    // Generate unique filename
    const ext = path.extname(file.originalname);
    const filename = `profile_${customer.id}_${Date.now()}${ext}`;
    const uploadPath = process.env.UPLOAD_PATH || './src/uploads';
    const filePath = path.join(uploadPath, filename);

    // Save file
    await fs.writeFile(filePath, file.buffer);

    // Generate URL
    const baseUrl = process.env.APP_URL || 'http://localhost:3003';
    const fileUrl = `${baseUrl}/uploads/${filename}`;

    // Update customer record
    await db.query(
      'UPDATE customers SET profile_picture_url = ?, updated_at = ? WHERE id = ?',
      [fileUrl, new Date(), customer.id]
    );

    return fileUrl;
  }

  async deleteProfilePicture(userId: string): Promise<void> {
    const customer = await this.getCustomerByUserId(userId);
    
    if (!customer) {
      throw new Error('Customer profile not found');
    }

    if (!customer.profilePictureUrl) {
      throw new Error('No profile picture to delete');
    }

    // Extract filename from URL
    const urlParts = customer.profilePictureUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    const uploadPath = process.env.UPLOAD_PATH || './src/uploads';
    const filePath = path.join(uploadPath, filename);

    // Delete file if exists
    try {
      await fs.unlink(filePath);
    } catch (error) {
      logger.warn('Profile picture file not found:', filePath);
    }

    // Update customer record
    await db.query(
      'UPDATE customers SET profile_picture_url = NULL, updated_at = ? WHERE id = ?',
      [new Date(), customer.id]
    );
  }

  async searchCustomers(
    searchTerm: string,
    filters: {
      accountType?: string;
      status?: string;
      membershipLevel?: string;
      minOrders?: number;
      maxOrders?: number;
    } = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{ customers: Customer[]; total: number }> {
    let query = 'SELECT * FROM customers WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM customers WHERE 1=1';
    const values: any[] = [];
    const countValues: any[] = [];

    // Search term
    if (searchTerm) {
      query += ' AND (business_name LIKE ? OR user_id LIKE ?)';
      countQuery += ' AND (business_name LIKE ? OR user_id LIKE ?)';
      const searchValue = `%${searchTerm}%`;
      values.push(searchValue, searchValue);
      countValues.push(searchValue, searchValue);
    }

    // Filters
    if (filters.accountType) {
      query += ' AND account_type = ?';
      countQuery += ' AND account_type = ?';
      values.push(filters.accountType);
      countValues.push(filters.accountType);
    }

    if (filters.status) {
      query += ' AND status = ?';
      countQuery += ' AND status = ?';
      values.push(filters.status);
      countValues.push(filters.status);
    }

    if (filters.membershipLevel) {
      query += ' AND membership_level = ?';
      countQuery += ' AND membership_level = ?';
      values.push(filters.membershipLevel);
      countValues.push(filters.membershipLevel);
    }

    if (filters.minOrders !== undefined) {
      query += ' AND total_orders >= ?';
      countQuery += ' AND total_orders >= ?';
      values.push(filters.minOrders);
      countValues.push(filters.minOrders);
    }

    if (filters.maxOrders !== undefined) {
      query += ' AND total_orders <= ?';
      countQuery += ' AND total_orders <= ?';
      values.push(filters.maxOrders);
      countValues.push(filters.maxOrders);
    }

    // Pagination
    const offset = (page - 1) * limit;
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    values.push(limit, offset);

    const customers = await db.query<Customer>(query, values);
    const countResult = await db.query<{ total: number }>(countQuery, countValues);

    return {
      customers,
      total: countResult.length > 0 ? countResult[0].total : 0
    };
  }
}