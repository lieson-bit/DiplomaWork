import { Request, Response } from 'express';
import { CustomerService } from '../services/customer.service';
import { ResponseUtil } from '../utils/response.util';
import logger from '../utils/logger';

export class CustomerController {
  private customerService: CustomerService;

  constructor() {
    this.customerService = new CustomerService();
  }

  createProfile = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.userId;
      const customerData = req.body;

      const customer = await this.customerService.createCustomer(userId, customerData);
      
      return ResponseUtil.success(
        res,
        customer,
        'Customer profile created successfully',
        201
      );
    } catch (error: any) {
      logger.error('Create customer profile error:', error);
      
      if (error.message.includes('already exists')) {
        return ResponseUtil.badRequest(res, error.message);
      }
      
      if (error.message.includes('User not found')) {
        return ResponseUtil.badRequest(res, error.message);
      }
      
      return ResponseUtil.error(res, 'Failed to create customer profile', 500, error);
    }
  };

  getProfile = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.userId;
      
      const profile = await this.customerService.getCustomerProfile(userId);
      
      return ResponseUtil.success(res, profile, 'Customer profile retrieved successfully');
    } catch (error: any) {
      logger.error('Get customer profile error:', error);
      
      if (error.message.includes('not found')) {
        return ResponseUtil.notFound(res, error.message);
      }
      
      return ResponseUtil.error(res, 'Failed to retrieve customer profile', 500, error);
    }
  };

  updateProfile = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.userId;
      const updateData = req.body;

      const customer = await this.customerService.updateCustomer(userId, updateData);
      
      return ResponseUtil.success(res, customer, 'Customer profile updated successfully');
    } catch (error: any) {
      logger.error('Update customer profile error:', error);
      
      if (error.message.includes('not found')) {
        return ResponseUtil.notFound(res, error.message);
      }
      
      return ResponseUtil.error(res, 'Failed to update customer profile', 500, error);
    }
  };

  addAddress = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.userId;
      const addressData = req.body;

      const address = await this.customerService.addAddress(userId, addressData);
      
      return ResponseUtil.success(
        res,
        address,
        'Address added successfully',
        201
      );
    } catch (error: any) {
      logger.error('Add address error:', error);
      
      if (error.message.includes('not found')) {
        return ResponseUtil.notFound(res, error.message);
      }
      
      return ResponseUtil.error(res, 'Failed to add address', 500, error);
    }
  };

  updateAddress = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.userId;
      const addressId = req.params.id;
      const updateData = req.body;

      const address = await this.customerService.updateAddress(userId, addressId, updateData);
      
      return ResponseUtil.success(res, address, 'Address updated successfully');
    } catch (error: any) {
      logger.error('Update address error:', error);
      
      if (error.message.includes('not found')) {
        return ResponseUtil.notFound(res, error.message);
      }
      
      return ResponseUtil.error(res, 'Failed to update address', 500, error);
    }
  };

  deleteAddress = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.userId;
      const addressId = req.params.id;

      await this.customerService.deleteAddress(userId, addressId);
      
      return ResponseUtil.success(res, null, 'Address deleted successfully');
    } catch (error: any) {
      logger.error('Delete address error:', error);
      
      if (error.message.includes('not found')) {
        return ResponseUtil.notFound(res, error.message);
      }
      
      if (error.message.includes('only address')) {
        return ResponseUtil.badRequest(res, error.message);
      }
      
      return ResponseUtil.error(res, 'Failed to delete address', 500, error);
    }
  };

  addPaymentMethod = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.userId;
      const paymentData = req.body;

      const paymentMethod = await this.customerService.addPaymentMethod(userId, paymentData);
      
      return ResponseUtil.success(
        res,
        paymentMethod,
        'Payment method added successfully',
        201
      );
    } catch (error: any) {
      logger.error('Add payment method error:', error);
      
      if (error.message.includes('not found')) {
        return ResponseUtil.notFound(res, error.message);
      }
      
      return ResponseUtil.error(res, 'Failed to add payment method', 500, error);
    }
  };

  updatePaymentMethod = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.userId;
      const paymentMethodId = req.params.id;
      const updateData = req.body;

      const paymentMethod = await this.customerService.updatePaymentMethod(
        userId,
        paymentMethodId,
        updateData
      );
      
      return ResponseUtil.success(res, paymentMethod, 'Payment method updated successfully');
    } catch (error: any) {
      logger.error('Update payment method error:', error);
      
      if (error.message.includes('not found')) {
        return ResponseUtil.notFound(res, error.message);
      }
      
      return ResponseUtil.error(res, 'Failed to update payment method', 500, error);
    }
  };

  deletePaymentMethod = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.userId;
      const paymentMethodId = req.params.id;

      await this.customerService.deletePaymentMethod(userId, paymentMethodId);
      
      return ResponseUtil.success(res, null, 'Payment method deleted successfully');
    } catch (error: any) {
      logger.error('Delete payment method error:', error);
      
      if (error.message.includes('not found')) {
        return ResponseUtil.notFound(res, error.message);
      }
      
      if (error.message.includes('only payment method')) {
        return ResponseUtil.badRequest(res, error.message);
      }
      
      return ResponseUtil.error(res, 'Failed to delete payment method', 500, error);
    }
  };

  updatePreferences = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.userId;
      const preferencesData = req.body;

      const preferences = await this.customerService.updatePreferences(userId, preferencesData);
      
      return ResponseUtil.success(res, preferences, 'Preferences updated successfully');
    } catch (error: any) {
      logger.error('Update preferences error:', error);
      
      if (error.message.includes('not found')) {
        return ResponseUtil.notFound(res, error.message);
      }
      
      return ResponseUtil.error(res, 'Failed to update preferences', 500, error);
    }
  };

  updateTimeSlots = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.userId;
      const timeSlots = req.body;

      await this.customerService.updateTimeSlots(userId, timeSlots);
      
      return ResponseUtil.success(res, null, 'Time slots updated successfully');
    } catch (error: any) {
      logger.error('Update time slots error:', error);
      
      if (error.message.includes('not found')) {
        return ResponseUtil.notFound(res, error.message);
      }
      
      return ResponseUtil.error(res, 'Failed to update time slots', 500, error);
    }
  };

  addFeedback = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.userId;
      const feedbackData = req.body;

      const feedback = await this.customerService.addFeedback(userId, feedbackData);
      
      return ResponseUtil.success(
        res,
        feedback,
        'Feedback submitted successfully',
        201
      );
    } catch (error: any) {
      logger.error('Add feedback error:', error);
      
      if (error.message.includes('not found')) {
        return ResponseUtil.notFound(res, error.message);
      }
      
      return ResponseUtil.error(res, 'Failed to submit feedback', 500, error);
    }
  };

  updateOrderStats = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.userId;
      const { orderAmount } = req.body;

      const customer = await this.customerService.updateOrderStats(userId, orderAmount);
      
      return ResponseUtil.success(res, customer, 'Order stats updated successfully');
    } catch (error: any) {
      logger.error('Update order stats error:', error);
      
      if (error.message.includes('not found')) {
        return ResponseUtil.notFound(res, error.message);
      }
      
      return ResponseUtil.error(res, 'Failed to update order stats', 500, error);
    }
  };

  getStats = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.userId;
      
      const stats = await this.customerService.getCustomerStats(userId);
      
      return ResponseUtil.success(res, stats, 'Customer stats retrieved successfully');
    } catch (error: any) {
      logger.error('Get customer stats error:', error);
      
      if (error.message.includes('not found')) {
        return ResponseUtil.notFound(res, error.message);
      }
      
      return ResponseUtil.error(res, 'Failed to retrieve customer stats', 500, error);
    }
  };

  uploadProfilePicture = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.userId;
      
      if (!req.file) {
        return ResponseUtil.badRequest(res, 'No file uploaded');
      }

      const fileUrl = await this.customerService.uploadProfilePicture(userId, req.file);
      
      return ResponseUtil.success(
        res,
        { profilePictureUrl: fileUrl },
        'Profile picture uploaded successfully'
      );
    } catch (error: any) {
      logger.error('Upload profile picture error:', error);
      
      if (error.message.includes('not found')) {
        return ResponseUtil.notFound(res, error.message);
      }
      
      return ResponseUtil.error(res, 'Failed to upload profile picture', 500, error);
    }
  };

  deleteProfilePicture = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.userId;

      await this.customerService.deleteProfilePicture(userId);
      
      return ResponseUtil.success(res, null, 'Profile picture deleted successfully');
    } catch (error: any) {
      logger.error('Delete profile picture error:', error);
      
      if (error.message.includes('not found')) {
        return ResponseUtil.notFound(res, error.message);
      }
      
      if (error.message.includes('No profile picture')) {
        return ResponseUtil.badRequest(res, error.message);
      }
      
      return ResponseUtil.error(res, 'Failed to delete profile picture', 500, error);
    }
  };

  searchCustomers = async (req: Request, res: Response): Promise<Response> => {
    try {
      const {
        search,
        accountType,
        status,
        membershipLevel,
        minOrders,
        maxOrders,
        page = 1,
        limit = 20
      } = req.query;

      const filters = {
        accountType: accountType as string,
        status: status as string,
        membershipLevel: membershipLevel as string,
        minOrders: minOrders ? parseInt(minOrders as string) : undefined,
        maxOrders: maxOrders ? parseInt(maxOrders as string) : undefined
      };

      const result = await this.customerService.searchCustomers(
        search as string,
        filters,
        parseInt(page as string),
        parseInt(limit as string)
      );

      return ResponseUtil.success(
        res,
        {
          customers: result.customers,
          pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total: result.total,
            totalPages: Math.ceil(result.total / parseInt(limit as string))
          }
        },
        'Customers retrieved successfully'
      );
    } catch (error: any) {
      logger.error('Search customers error:', error);
      return ResponseUtil.error(res, 'Failed to search customers', 500, error);
    }
  };
}