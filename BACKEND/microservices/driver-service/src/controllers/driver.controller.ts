import { Request, Response, NextFunction } from 'express';
import { driverService } from '../services/driver.service';
import { uploadService } from '../services/upload.service';
import { logger } from '../utils/logger';

export class DriverController {
  async createProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const driver = await driverService.createDriverProfile(userId, req.body);
      res.status(201).json({
        success: true,
        data: driver,
        message: 'Driver profile created successfully',
      });
    } catch (error: any) {
      logger.error('Create profile error:', error);
      next(error);
    }
  }

  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const profile = await driverService.getDriverProfile(userId);
      res.json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      logger.error('Get profile error:', error);
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const driver = await driverService.updateDriverProfile(userId, req.body);
      res.json({
        success: true,
        data: driver,
        message: 'Driver profile updated successfully',
      });
    } catch (error: any) {
      logger.error('Update profile error:', error);
      next(error);
    }
  }

  async uploadProfilePicture(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const profilePicture = await driverService.uploadProfilePicture(userId, req.file);
      res.status(201).json({
        success: true,
        data: profilePicture,
        message: 'Profile picture uploaded successfully',
      });
    } catch (error: any) {
      logger.error('Upload profile picture error:', error);
      next(error);
    }
  }

  async deleteProfilePicture(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await driverService.deleteProfilePicture(userId);
      res.json({
        success: true,
        message: 'Profile picture deleted successfully',
      });
    } catch (error: any) {
      logger.error('Delete profile picture error:', error);
      next(error);
    }
  }

  async addVehicle(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const vehicle = await driverService.addVehicle(userId, req.body);
      res.status(201).json({
        success: true,
        data: vehicle,
        message: 'Vehicle added successfully',
      });
    } catch (error: any) {
      logger.error('Add vehicle error:', error);
      next(error);
    }
  }

  async getVehicles(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const vehicles = await driverService.getVehicles(userId);
      res.json({
        success: true,
        data: vehicles,
      });
    } catch (error: any) {
      logger.error('Get vehicles error:', error);
      next(error);
    }
  }

  async updateVehicle(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const vehicleId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const vehicle = await driverService.updateVehicle(userId, vehicleId, req.body);
      res.json({
        success: true,
        data: vehicle,
        message: 'Vehicle updated successfully',
      });
    } catch (error: any) {
      logger.error('Update vehicle error:', error);
      next(error);
    }
  }

  async deleteVehicle(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const vehicleId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const success = await driverService.deleteVehicle(userId, vehicleId);
      res.json({
        success,
        message: success ? 'Vehicle deleted successfully' : 'Failed to delete vehicle',
      });
    } catch (error: any) {
      logger.error('Delete vehicle error:', error);
      next(error);
    }
  }

  // In the uploadDocument method, fix the expiryDate handling:
  async uploadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
    
      // FIX: Keep expiryDate as string for the request, conversion to Date happens in service
      const documentData = {
        type: req.body.type,
        name: req.body.name || req.file.originalname,
        expiryDate: req.body.expiryDate, // Keep as string
        file: req.file
      };
    
      const document = await driverService.addDocument(userId, documentData);
      res.status(201).json({
        success: true,
        data: document,
        message: 'Document uploaded successfully',
      });
    } catch (error: any) {
      logger.error('Upload document error:', error);
      next(error);
    }
  }

  async getDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const documents = await driverService.getDocuments(userId);
      res.json({
        success: true,
        data: documents,
      });
    } catch (error: any) {
      logger.error('Get documents error:', error);
      next(error);
    }
  }

  async updateDocumentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const documentId = req.params.id;
      const { status, verifiedBy, rejectionReason } = req.body;

      const document = await driverService.updateDocumentStatus(documentId, status, verifiedBy, rejectionReason);
      res.json({
        success: true,
        data: document,
        message: 'Document status updated successfully',
      });
    } catch (error: any) {
      logger.error('Update document status error:', error);
      next(error);
    }
  }

  async updateAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const availabilityData = Array.isArray(req.body) ? req.body : [req.body];
      const availabilities = await driverService.updateAvailability(userId, availabilityData);
      res.json({
        success: true,
        data: availabilities,
        message: 'Availability updated successfully',
      });
    } catch (error: any) {
      logger.error('Update availability error:', error);
      next(error);
    }
  }

  async getAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const availability = await driverService.getAvailability(userId);
      res.json({
        success: true,
        data: availability,
      });
    } catch (error: any) {
      logger.error('Get availability error:', error);
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { isOnline, location } = req.body;
      const driver = await driverService.updateDriverStatus(userId, isOnline, location);
      res.json({
        success: true,
        data: driver,
        message: 'Status updated successfully',
      });
    } catch (error: any) {
      logger.error('Update status error:', error);
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const stats = await driverService.getDriverStats(userId);
      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Get stats error:', error);
      next(error);
    }
  }

  // Add this method to your DriverController class in driver.controller.ts
  async uploadVehicleImage(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const vehicleId = req.params.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      // Process the vehicle image (you'll need to update driverService for this)
      const vehicle = await driverService.uploadVehicleImage(userId, vehicleId, req.file);
      
      res.json({
        success: true,
        data: vehicle,
        message: 'Vehicle image uploaded successfully'
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getVerificationStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const verification = await driverService.checkVerificationStatus(userId);
      res.json({
        success: true,
        data: verification,
      });
    } catch (error: any) {
      logger.error('Get verification status error:', error);
      next(error);
    }
  }

  async recordMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await driverService.recordMetrics(userId, req.body);
      res.json({
        success: true,
        message: 'Metrics recorded successfully',
      });
    } catch (error: any) {
      logger.error('Record metrics error:', error);
      next(error);
    }
  }
}

export const driverController = new DriverController();