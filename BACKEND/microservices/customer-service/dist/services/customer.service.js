"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerService = void 0;
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const database_1 = require("../config/database");
const httpClient_1 = __importDefault(require("../utils/httpClient"));
const logger_1 = __importDefault(require("../utils/logger"));
class CustomerService {
    async validateUser(userId) {
        try {
            const userServiceUrl = process.env.USER_SERVICE_URL;
            const serviceSecret = process.env.SERVICE_SECRET;
            const response = await httpClient_1.default.get(`${userServiceUrl}/api/auth/validate/${userId}`, {
                headers: {
                    'x-service-secret': serviceSecret
                }
            });
            return response.data.valid === true;
        }
        catch (error) {
            logger_1.default.error('User validation failed:', error);
            if (error.response?.status === 503 || error.code === 'ECONNREFUSED') {
                logger_1.default.warn('User service unavailable, proceeding with caution');
                return true;
            }
            return false;
        }
    }
    async createCustomer(userId, data) {
        const isValidUser = await this.validateUser(userId);
        if (!isValidUser) {
            throw new Error('User not found or invalid');
        }
        const existingCustomers = await database_1.db.query('SELECT * FROM customers WHERE user_id = ?', [userId]);
        if (existingCustomers.length > 0) {
            throw new Error('Customer profile already exists');
        }
        const customerId = (0, uuid_1.v4)();
        const now = new Date();
        await database_1.db.query(`INSERT INTO customers (
        id, user_id, account_type, date_of_birth, business_name,
        business_type, business_phone, tax_id, join_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            customerId,
            userId,
            data.accountType || 'personal',
            data.dateOfBirth || null,
            data.businessName || null,
            data.businessType || null,
            data.businessPhone || null,
            data.taxId || null,
            now
        ]);
        await database_1.db.query(`INSERT INTO customer_preferences (
        id, customer_id, language, timezone
      ) VALUES (UUID(), ?, ?, ?)`, [customerId, 'en', 'UTC']);
        const customer = await database_1.db.queryOne('SELECT * FROM customers WHERE id = ?', [customerId]);
        if (!customer) {
            throw new Error('Failed to create customer');
        }
        return customer;
    }
    async getCustomerByUserId(userId) {
        return await database_1.db.queryOne('SELECT * FROM customers WHERE user_id = ?', [userId]);
    }
    async getCustomerProfile(userId) {
        const customer = await this.getCustomerByUserId(userId);
        if (!customer) {
            throw new Error('Customer profile not found');
        }
        const addresses = await database_1.db.query('SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC', [customer.id]);
        const preferences = await database_1.db.query('SELECT * FROM customer_preferences WHERE customer_id = ?', [customer.id]);
        const paymentMethods = await database_1.db.query('SELECT * FROM customer_payment_methods WHERE customer_id = ? AND is_active = TRUE ORDER BY is_default DESC, created_at DESC', [customer.id]);
        const timeSlots = await database_1.db.query('SELECT * FROM delivery_time_slots WHERE customer_id = ? AND is_active = TRUE ORDER BY day_of_week, start_time', [customer.id]);
        const recentFeedback = await database_1.db.query('SELECT * FROM customer_feedback WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10', [customer.id]);
        return {
            ...customer,
            addresses,
            preferences: preferences.length > 0 ? preferences[0] : {},
            paymentMethods,
            timeSlots,
            recentFeedback
        };
    }
    async updateCustomer(userId, data) {
        const customer = await this.getCustomerByUserId(userId);
        if (!customer) {
            throw new Error('Customer profile not found');
        }
        const updates = [];
        const values = [];
        if (data.accountType) {
            updates.push('account_type = ?');
            values.push(data.accountType);
        }
        if (data.dateOfBirth) {
            updates.push('date_of_birth = ?');
            values.push(data.dateOfBirth);
        }
        else if (data.dateOfBirth === null) {
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
        await database_1.db.query(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`, values);
        const updatedCustomer = await database_1.db.queryOne('SELECT * FROM customers WHERE id = ?', [customer.id]);
        if (!updatedCustomer) {
            throw new Error('Failed to update customer');
        }
        return updatedCustomer;
    }
    async addAddress(userId, data) {
        const customer = await this.getCustomerByUserId(userId);
        if (!customer) {
            throw new Error('Customer profile not found');
        }
        if (data.isDefault) {
            await database_1.db.query('UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = ?', [customer.id]);
        }
        const addressId = (0, uuid_1.v4)();
        await database_1.db.query(`INSERT INTO customer_addresses (
        id, customer_id, label, address, city, state, country,
        postal_code, latitude, longitude, is_default, is_active, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
        ]);
        const address = await database_1.db.queryOne('SELECT * FROM customer_addresses WHERE id = ?', [addressId]);
        if (!address) {
            throw new Error('Failed to create address');
        }
        return address;
    }
    async updateAddress(userId, addressId, data) {
        const customer = await this.getCustomerByUserId(userId);
        if (!customer) {
            throw new Error('Customer profile not found');
        }
        const existingAddress = await database_1.db.queryOne('SELECT * FROM customer_addresses WHERE id = ? AND customer_id = ?', [addressId, customer.id]);
        if (!existingAddress) {
            throw new Error('Address not found');
        }
        if (data.isDefault === true && !existingAddress.isDefault) {
            await database_1.db.query('UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = ?', [customer.id]);
        }
        const updates = [];
        const values = [];
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
        await database_1.db.query(`UPDATE customer_addresses SET ${updates.join(', ')} WHERE id = ?`, values);
        const updatedAddress = await database_1.db.queryOne('SELECT * FROM customer_addresses WHERE id = ?', [addressId]);
        if (!updatedAddress) {
            throw new Error('Failed to update address');
        }
        return updatedAddress;
    }
    async deleteAddress(userId, addressId) {
        const customer = await this.getCustomerByUserId(userId);
        if (!customer) {
            throw new Error('Customer profile not found');
        }
        const address = await database_1.db.queryOne('SELECT * FROM customer_addresses WHERE id = ? AND customer_id = ?', [addressId, customer.id]);
        if (!address) {
            throw new Error('Address not found');
        }
        const allAddresses = await database_1.db.query('SELECT * FROM customer_addresses WHERE customer_id = ? AND is_active = TRUE', [customer.id]);
        if (allAddresses.length <= 1) {
            throw new Error('Cannot delete the only address');
        }
        if (address.isDefault) {
            const otherAddress = allAddresses.find((a) => a.id !== addressId);
            if (otherAddress) {
                await database_1.db.query('UPDATE customer_addresses SET is_default = TRUE WHERE id = ?', [otherAddress.id]);
            }
        }
        await database_1.db.query('DELETE FROM customer_addresses WHERE id = ?', [addressId]);
    }
    async addPaymentMethod(userId, data) {
        const customer = await this.getCustomerByUserId(userId);
        if (!customer) {
            throw new Error('Customer profile not found');
        }
        if (data.isDefault) {
            await database_1.db.query('UPDATE customer_payment_methods SET is_default = FALSE WHERE customer_id = ?', [customer.id]);
        }
        const paymentMethodId = (0, uuid_1.v4)();
        await database_1.db.query(`INSERT INTO customer_payment_methods (
        id, customer_id, type, provider, last4, expiry_month, expiry_year,
        name_on_card, paypal_email, bank_name, account_number_masked,
        is_default, is_active, token
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
        ]);
        const paymentMethod = await database_1.db.queryOne('SELECT * FROM customer_payment_methods WHERE id = ?', [paymentMethodId]);
        if (!paymentMethod) {
            throw new Error('Failed to create payment method');
        }
        return paymentMethod;
    }
    async updatePaymentMethod(userId, paymentMethodId, data) {
        const customer = await this.getCustomerByUserId(userId);
        if (!customer) {
            throw new Error('Customer profile not found');
        }
        const existingMethod = await database_1.db.queryOne('SELECT * FROM customer_payment_methods WHERE id = ? AND customer_id = ?', [paymentMethodId, customer.id]);
        if (!existingMethod) {
            throw new Error('Payment method not found');
        }
        if (data.isDefault === true && !existingMethod.isDefault) {
            await database_1.db.query('UPDATE customer_payment_methods SET is_default = FALSE WHERE customer_id = ?', [customer.id]);
        }
        const updates = [];
        const values = [];
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
        await database_1.db.query(`UPDATE customer_payment_methods SET ${updates.join(', ')} WHERE id = ?`, values);
        const updatedMethod = await database_1.db.queryOne('SELECT * FROM customer_payment_methods WHERE id = ?', [paymentMethodId]);
        if (!updatedMethod) {
            throw new Error('Failed to update payment method');
        }
        return updatedMethod;
    }
    async deletePaymentMethod(userId, paymentMethodId) {
        const customer = await this.getCustomerByUserId(userId);
        if (!customer) {
            throw new Error('Customer profile not found');
        }
        const paymentMethod = await database_1.db.queryOne('SELECT * FROM customer_payment_methods WHERE id = ? AND customer_id = ?', [paymentMethodId, customer.id]);
        if (!paymentMethod) {
            throw new Error('Payment method not found');
        }
        const allMethods = await database_1.db.query('SELECT * FROM customer_payment_methods WHERE customer_id = ? AND is_active = TRUE', [customer.id]);
        if (allMethods.length <= 1) {
            throw new Error('Cannot delete the only payment method');
        }
        if (paymentMethod.isDefault) {
            const otherMethod = allMethods.find((m) => m.id !== paymentMethodId);
            if (otherMethod) {
                await database_1.db.query('UPDATE customer_payment_methods SET is_default = TRUE WHERE id = ?', [otherMethod.id]);
            }
        }
        await database_1.db.query('DELETE FROM customer_payment_methods WHERE id = ?', [paymentMethodId]);
    }
    async updatePreferences(userId, data) {
        const customer = await this.getCustomerByUserId(userId);
        if (!customer) {
            throw new Error('Customer profile not found');
        }
        const updates = [];
        const values = [];
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
            const preferences = await database_1.db.query('SELECT * FROM customer_preferences WHERE customer_id = ?', [customer.id]);
            return preferences.length > 0 ? preferences[0] : null;
        }
        updates.push('updated_at = ?');
        values.push(new Date());
        values.push(customer.id);
        await database_1.db.query(`UPDATE customer_preferences SET ${updates.join(', ')} WHERE customer_id = ?`, values);
        const preferences = await database_1.db.query('SELECT * FROM customer_preferences WHERE customer_id = ?', [customer.id]);
        return preferences.length > 0 ? preferences[0] : null;
    }
    async updateTimeSlots(userId, timeSlots) {
        const customer = await this.getCustomerByUserId(userId);
        if (!customer) {
            throw new Error('Customer profile not found');
        }
        await database_1.db.query('DELETE FROM delivery_time_slots WHERE customer_id = ?', [customer.id]);
        if (timeSlots.length > 0) {
            const values = timeSlots.map(slot => [
                (0, uuid_1.v4)(),
                customer.id,
                slot.dayOfWeek,
                slot.startTime,
                slot.endTime,
                slot.isActive !== false
            ]);
            await database_1.db.query(`INSERT INTO delivery_time_slots 
        (id, customer_id, day_of_week, start_time, end_time, is_active)
        VALUES ?`, [values]);
        }
    }
    async addFeedback(userId, data) {
        const customer = await this.getCustomerByUserId(userId);
        if (!customer) {
            throw new Error('Customer profile not found');
        }
        const feedbackId = (0, uuid_1.v4)();
        await database_1.db.query(`INSERT INTO customer_feedback (
        id, customer_id, order_id, rating, comment, category, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            feedbackId,
            customer.id,
            data.orderId || null,
            data.rating,
            data.comment || null,
            data.category || 'other',
            'pending'
        ]);
        await this.updateCustomerRating(customer.id);
        const feedback = await database_1.db.queryOne('SELECT * FROM customer_feedback WHERE id = ?', [feedbackId]);
        if (!feedback) {
            throw new Error('Failed to create feedback');
        }
        return feedback;
    }
    async updateCustomerRating(customerId) {
        const feedback = await database_1.db.query('SELECT AVG(rating) as avg_rating FROM customer_feedback WHERE customer_id = ? AND rating IS NOT NULL', [customerId]);
        const averageRating = feedback.length > 0 ? feedback[0].avg_rating : 0;
        await database_1.db.query('UPDATE customers SET average_rating = ?, updated_at = ? WHERE id = ?', [averageRating, new Date(), customerId]);
    }
    async updateOrderStats(userId, orderAmount) {
        const customer = await this.getCustomerByUserId(userId);
        if (!customer) {
            throw new Error('Customer profile not found');
        }
        const loyaltyPointsEarned = Math.floor(orderAmount / 10);
        await database_1.db.query(`UPDATE customers 
      SET total_orders = total_orders + 1,
          total_spent = total_spent + ?,
          loyalty_points = loyalty_points + ?,
          updated_at = ?
      WHERE id = ?`, [orderAmount, loyaltyPointsEarned, new Date(), customer.id]);
        const updatedCustomer = await database_1.db.queryOne('SELECT * FROM customers WHERE id = ?', [customer.id]);
        if (!updatedCustomer) {
            throw new Error('Failed to update order stats');
        }
        let membershipLevel = 'standard';
        if (updatedCustomer.totalSpent >= 10000) {
            membershipLevel = 'premium';
        }
        else if (updatedCustomer.totalSpent >= 50000) {
            membershipLevel = 'business';
        }
        if (membershipLevel !== updatedCustomer.membershipLevel) {
            await database_1.db.query('UPDATE customers SET membership_level = ?, updated_at = ? WHERE id = ?', [membershipLevel, new Date(), customer.id]);
        }
        const finalCustomer = await database_1.db.queryOne('SELECT * FROM customers WHERE id = ?', [customer.id]);
        if (!finalCustomer) {
            throw new Error('Failed to get updated customer');
        }
        return finalCustomer;
    }
    async getCustomerStats(userId) {
        const customer = await this.getCustomerByUserId(userId);
        if (!customer) {
            throw new Error('Customer profile not found');
        }
        const addressesCount = await database_1.db.query('SELECT COUNT(*) as count FROM customer_addresses WHERE customer_id = ? AND is_active = TRUE', [customer.id]);
        const paymentMethodsCount = await database_1.db.query('SELECT COUNT(*) as count FROM customer_payment_methods WHERE customer_id = ? AND is_active = TRUE', [customer.id]);
        const feedbackCount = await database_1.db.query('SELECT COUNT(*) as count FROM customer_feedback WHERE customer_id = ?', [customer.id]);
        const accountAgeDays = Math.floor((new Date().getTime() - new Date(customer.joinDate).getTime()) /
            (1000 * 60 * 60 * 24));
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
    async uploadProfilePicture(userId, file) {
        const customer = await this.getCustomerByUserId(userId);
        if (!customer) {
            throw new Error('Customer profile not found');
        }
        const ext = path_1.default.extname(file.originalname);
        const filename = `profile_${customer.id}_${Date.now()}${ext}`;
        const uploadPath = process.env.UPLOAD_PATH || './src/uploads';
        const filePath = path_1.default.join(uploadPath, filename);
        await promises_1.default.writeFile(filePath, file.buffer);
        const baseUrl = process.env.APP_URL || 'http://localhost:3003';
        const fileUrl = `${baseUrl}/uploads/${filename}`;
        await database_1.db.query('UPDATE customers SET profile_picture_url = ?, updated_at = ? WHERE id = ?', [fileUrl, new Date(), customer.id]);
        return fileUrl;
    }
    async deleteProfilePicture(userId) {
        const customer = await this.getCustomerByUserId(userId);
        if (!customer) {
            throw new Error('Customer profile not found');
        }
        if (!customer.profilePictureUrl) {
            throw new Error('No profile picture to delete');
        }
        const urlParts = customer.profilePictureUrl.split('/');
        const filename = urlParts[urlParts.length - 1];
        const uploadPath = process.env.UPLOAD_PATH || './src/uploads';
        const filePath = path_1.default.join(uploadPath, filename);
        try {
            await promises_1.default.unlink(filePath);
        }
        catch (error) {
            logger_1.default.warn('Profile picture file not found:', filePath);
        }
        await database_1.db.query('UPDATE customers SET profile_picture_url = NULL, updated_at = ? WHERE id = ?', [new Date(), customer.id]);
    }
    async searchCustomers(searchTerm, filters = {}, page = 1, limit = 20) {
        let query = 'SELECT * FROM customers WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) as total FROM customers WHERE 1=1';
        const values = [];
        const countValues = [];
        if (searchTerm) {
            query += ' AND (business_name LIKE ? OR user_id LIKE ?)';
            countQuery += ' AND (business_name LIKE ? OR user_id LIKE ?)';
            const searchValue = `%${searchTerm}%`;
            values.push(searchValue, searchValue);
            countValues.push(searchValue, searchValue);
        }
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
        const offset = (page - 1) * limit;
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        values.push(limit, offset);
        const customers = await database_1.db.query(query, values);
        const countResult = await database_1.db.query(countQuery, countValues);
        return {
            customers,
            total: countResult.length > 0 ? countResult[0].total : 0
        };
    }
}
exports.CustomerService = CustomerService;
//# sourceMappingURL=customer.service.js.map