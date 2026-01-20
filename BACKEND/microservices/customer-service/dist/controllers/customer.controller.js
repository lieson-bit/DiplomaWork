"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerController = void 0;
const customer_service_1 = require("../services/customer.service");
const response_util_1 = require("../utils/response.util");
const logger_1 = __importDefault(require("../utils/logger"));
class CustomerController {
    constructor() {
        this.createProfile = async (req, res) => {
            try {
                const userId = req.user.userId;
                const customerData = req.body;
                const customer = await this.customerService.createCustomer(userId, customerData);
                return response_util_1.ResponseUtil.success(res, customer, 'Customer profile created successfully', 201);
            }
            catch (error) {
                logger_1.default.error('Create customer profile error:', error);
                if (error.message.includes('already exists')) {
                    return response_util_1.ResponseUtil.badRequest(res, error.message);
                }
                if (error.message.includes('User not found')) {
                    return response_util_1.ResponseUtil.badRequest(res, error.message);
                }
                return response_util_1.ResponseUtil.error(res, 'Failed to create customer profile', 500, error);
            }
        };
        this.getProfile = async (req, res) => {
            try {
                const userId = req.user.userId;
                const profile = await this.customerService.getCustomerProfile(userId);
                return response_util_1.ResponseUtil.success(res, profile, 'Customer profile retrieved successfully');
            }
            catch (error) {
                logger_1.default.error('Get customer profile error:', error);
                if (error.message.includes('not found')) {
                    return response_util_1.ResponseUtil.notFound(res, error.message);
                }
                return response_util_1.ResponseUtil.error(res, 'Failed to retrieve customer profile', 500, error);
            }
        };
        this.updateProfile = async (req, res) => {
            try {
                const userId = req.user.userId;
                const updateData = req.body;
                const customer = await this.customerService.updateCustomer(userId, updateData);
                return response_util_1.ResponseUtil.success(res, customer, 'Customer profile updated successfully');
            }
            catch (error) {
                logger_1.default.error('Update customer profile error:', error);
                if (error.message.includes('not found')) {
                    return response_util_1.ResponseUtil.notFound(res, error.message);
                }
                return response_util_1.ResponseUtil.error(res, 'Failed to update customer profile', 500, error);
            }
        };
        this.addAddress = async (req, res) => {
            try {
                const userId = req.user.userId;
                const addressData = req.body;
                const address = await this.customerService.addAddress(userId, addressData);
                return response_util_1.ResponseUtil.success(res, address, 'Address added successfully', 201);
            }
            catch (error) {
                logger_1.default.error('Add address error:', error);
                if (error.message.includes('not found')) {
                    return response_util_1.ResponseUtil.notFound(res, error.message);
                }
                return response_util_1.ResponseUtil.error(res, 'Failed to add address', 500, error);
            }
        };
        this.updateAddress = async (req, res) => {
            try {
                const userId = req.user.userId;
                const addressId = req.params.id;
                const updateData = req.body;
                const address = await this.customerService.updateAddress(userId, addressId, updateData);
                return response_util_1.ResponseUtil.success(res, address, 'Address updated successfully');
            }
            catch (error) {
                logger_1.default.error('Update address error:', error);
                if (error.message.includes('not found')) {
                    return response_util_1.ResponseUtil.notFound(res, error.message);
                }
                return response_util_1.ResponseUtil.error(res, 'Failed to update address', 500, error);
            }
        };
        this.deleteAddress = async (req, res) => {
            try {
                const userId = req.user.userId;
                const addressId = req.params.id;
                await this.customerService.deleteAddress(userId, addressId);
                return response_util_1.ResponseUtil.success(res, null, 'Address deleted successfully');
            }
            catch (error) {
                logger_1.default.error('Delete address error:', error);
                if (error.message.includes('not found')) {
                    return response_util_1.ResponseUtil.notFound(res, error.message);
                }
                if (error.message.includes('only address')) {
                    return response_util_1.ResponseUtil.badRequest(res, error.message);
                }
                return response_util_1.ResponseUtil.error(res, 'Failed to delete address', 500, error);
            }
        };
        this.addPaymentMethod = async (req, res) => {
            try {
                const userId = req.user.userId;
                const paymentData = req.body;
                const paymentMethod = await this.customerService.addPaymentMethod(userId, paymentData);
                return response_util_1.ResponseUtil.success(res, paymentMethod, 'Payment method added successfully', 201);
            }
            catch (error) {
                logger_1.default.error('Add payment method error:', error);
                if (error.message.includes('not found')) {
                    return response_util_1.ResponseUtil.notFound(res, error.message);
                }
                return response_util_1.ResponseUtil.error(res, 'Failed to add payment method', 500, error);
            }
        };
        this.updatePaymentMethod = async (req, res) => {
            try {
                const userId = req.user.userId;
                const paymentMethodId = req.params.id;
                const updateData = req.body;
                const paymentMethod = await this.customerService.updatePaymentMethod(userId, paymentMethodId, updateData);
                return response_util_1.ResponseUtil.success(res, paymentMethod, 'Payment method updated successfully');
            }
            catch (error) {
                logger_1.default.error('Update payment method error:', error);
                if (error.message.includes('not found')) {
                    return response_util_1.ResponseUtil.notFound(res, error.message);
                }
                return response_util_1.ResponseUtil.error(res, 'Failed to update payment method', 500, error);
            }
        };
        this.deletePaymentMethod = async (req, res) => {
            try {
                const userId = req.user.userId;
                const paymentMethodId = req.params.id;
                await this.customerService.deletePaymentMethod(userId, paymentMethodId);
                return response_util_1.ResponseUtil.success(res, null, 'Payment method deleted successfully');
            }
            catch (error) {
                logger_1.default.error('Delete payment method error:', error);
                if (error.message.includes('not found')) {
                    return response_util_1.ResponseUtil.notFound(res, error.message);
                }
                if (error.message.includes('only payment method')) {
                    return response_util_1.ResponseUtil.badRequest(res, error.message);
                }
                return response_util_1.ResponseUtil.error(res, 'Failed to delete payment method', 500, error);
            }
        };
        this.updatePreferences = async (req, res) => {
            try {
                const userId = req.user.userId;
                const preferencesData = req.body;
                const preferences = await this.customerService.updatePreferences(userId, preferencesData);
                return response_util_1.ResponseUtil.success(res, preferences, 'Preferences updated successfully');
            }
            catch (error) {
                logger_1.default.error('Update preferences error:', error);
                if (error.message.includes('not found')) {
                    return response_util_1.ResponseUtil.notFound(res, error.message);
                }
                return response_util_1.ResponseUtil.error(res, 'Failed to update preferences', 500, error);
            }
        };
        this.updateTimeSlots = async (req, res) => {
            try {
                const userId = req.user.userId;
                const timeSlots = req.body;
                await this.customerService.updateTimeSlots(userId, timeSlots);
                return response_util_1.ResponseUtil.success(res, null, 'Time slots updated successfully');
            }
            catch (error) {
                logger_1.default.error('Update time slots error:', error);
                if (error.message.includes('not found')) {
                    return response_util_1.ResponseUtil.notFound(res, error.message);
                }
                return response_util_1.ResponseUtil.error(res, 'Failed to update time slots', 500, error);
            }
        };
        this.addFeedback = async (req, res) => {
            try {
                const userId = req.user.userId;
                const feedbackData = req.body;
                const feedback = await this.customerService.addFeedback(userId, feedbackData);
                return response_util_1.ResponseUtil.success(res, feedback, 'Feedback submitted successfully', 201);
            }
            catch (error) {
                logger_1.default.error('Add feedback error:', error);
                if (error.message.includes('not found')) {
                    return response_util_1.ResponseUtil.notFound(res, error.message);
                }
                return response_util_1.ResponseUtil.error(res, 'Failed to submit feedback', 500, error);
            }
        };
        this.updateOrderStats = async (req, res) => {
            try {
                const userId = req.user.userId;
                const { orderAmount } = req.body;
                const customer = await this.customerService.updateOrderStats(userId, orderAmount);
                return response_util_1.ResponseUtil.success(res, customer, 'Order stats updated successfully');
            }
            catch (error) {
                logger_1.default.error('Update order stats error:', error);
                if (error.message.includes('not found')) {
                    return response_util_1.ResponseUtil.notFound(res, error.message);
                }
                return response_util_1.ResponseUtil.error(res, 'Failed to update order stats', 500, error);
            }
        };
        this.getStats = async (req, res) => {
            try {
                const userId = req.user.userId;
                const stats = await this.customerService.getCustomerStats(userId);
                return response_util_1.ResponseUtil.success(res, stats, 'Customer stats retrieved successfully');
            }
            catch (error) {
                logger_1.default.error('Get customer stats error:', error);
                if (error.message.includes('not found')) {
                    return response_util_1.ResponseUtil.notFound(res, error.message);
                }
                return response_util_1.ResponseUtil.error(res, 'Failed to retrieve customer stats', 500, error);
            }
        };
        this.uploadProfilePicture = async (req, res) => {
            try {
                const userId = req.user.userId;
                if (!req.file) {
                    return response_util_1.ResponseUtil.badRequest(res, 'No file uploaded');
                }
                const fileUrl = await this.customerService.uploadProfilePicture(userId, req.file);
                return response_util_1.ResponseUtil.success(res, { profilePictureUrl: fileUrl }, 'Profile picture uploaded successfully');
            }
            catch (error) {
                logger_1.default.error('Upload profile picture error:', error);
                if (error.message.includes('not found')) {
                    return response_util_1.ResponseUtil.notFound(res, error.message);
                }
                return response_util_1.ResponseUtil.error(res, 'Failed to upload profile picture', 500, error);
            }
        };
        this.deleteProfilePicture = async (req, res) => {
            try {
                const userId = req.user.userId;
                await this.customerService.deleteProfilePicture(userId);
                return response_util_1.ResponseUtil.success(res, null, 'Profile picture deleted successfully');
            }
            catch (error) {
                logger_1.default.error('Delete profile picture error:', error);
                if (error.message.includes('not found')) {
                    return response_util_1.ResponseUtil.notFound(res, error.message);
                }
                if (error.message.includes('No profile picture')) {
                    return response_util_1.ResponseUtil.badRequest(res, error.message);
                }
                return response_util_1.ResponseUtil.error(res, 'Failed to delete profile picture', 500, error);
            }
        };
        this.searchCustomers = async (req, res) => {
            try {
                const { search, accountType, status, membershipLevel, minOrders, maxOrders, page = 1, limit = 20 } = req.query;
                const filters = {
                    accountType: accountType,
                    status: status,
                    membershipLevel: membershipLevel,
                    minOrders: minOrders ? parseInt(minOrders) : undefined,
                    maxOrders: maxOrders ? parseInt(maxOrders) : undefined
                };
                const result = await this.customerService.searchCustomers(search, filters, parseInt(page), parseInt(limit));
                return response_util_1.ResponseUtil.success(res, {
                    customers: result.customers,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: result.total,
                        totalPages: Math.ceil(result.total / parseInt(limit))
                    }
                }, 'Customers retrieved successfully');
            }
            catch (error) {
                logger_1.default.error('Search customers error:', error);
                return response_util_1.ResponseUtil.error(res, 'Failed to search customers', 500, error);
            }
        };
        this.customerService = new customer_service_1.CustomerService();
    }
}
exports.CustomerController = CustomerController;
//# sourceMappingURL=customer.controller.js.map