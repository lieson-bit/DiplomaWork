import { Request, Response, NextFunction } from 'express';
import { driverService } from '../services/driver.service';
import { uploadService } from '../services/upload.service';
import { logger } from '../utils/logger';
import { matchingService } from '../services/matching.service';

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

  // Add this method to the DriverController class
async getDriverVehiclesWithPicture(req: Request, res: Response, next: NextFunction) {
  try {
    const driverId = req.params.driverId;
    
    if (!driverId) {
      return res.status(400).json({ 
        success: false,
        error: 'Driver ID is required' 
      });
    }

    logger.info(`Getting vehicles with picture for driver ID: ${driverId}`);
    
    const result = await driverService.getDriverVehiclesWithPicture(driverId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    if (error.message === 'No vehicles found for this driver') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    logger.error('Get driver vehicles with picture error:', error);
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

   async discoverDrivers(req: Request, res: Response, next: NextFunction) {
    try {
      // Customers can access this, so we don't restrict to driver userType
      const userType = req.user?.userType;
      logger.info('🔍 Discover drivers request received', {
        userType,
        query: req.query
      });

      const {
        estimatedWeight,
        estimatedVolume,
        vehicleType,
        limit = 20,
        page = 1
      } = req.query;

      // Validate and cast vehicleType
      const validVehicleTypes = ['motorbike', 'small_van', 'medium_truck', 'large_truck'];
      const typedVehicleType = vehicleType && validVehicleTypes.includes(vehicleType as string)
        ? vehicleType as 'motorbike' | 'small_van' | 'medium_truck' | 'large_truck'
        : undefined;

      logger.info('📊 Parsed discovery parameters:', {
        estimatedWeight: estimatedWeight ? parseFloat(estimatedWeight as string) : undefined,
        estimatedVolume: estimatedVolume ? parseFloat(estimatedVolume as string) : undefined,
        vehicleType: typedVehicleType,
        limit: parseInt(limit as string),
        page: parseInt(page as string)
      });

      const drivers = await driverService.discoverAvailableDrivers({
        estimatedWeight: estimatedWeight ? parseFloat(estimatedWeight as string) : undefined,
        estimatedVolume: estimatedVolume ? parseFloat(estimatedVolume as string) : undefined,
        vehicleType: typedVehicleType,
        limit: parseInt(limit as string),
        page: parseInt(page as string)
      });

      logger.info(`✅ Discover drivers found ${drivers.length} drivers`);

      res.json({
        success: true,
        data: drivers,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: drivers.length,
          hasNext: drivers.length === parseInt(limit as string)
        }
      });
    } catch (error: any) {
      logger.error('❌ Discover drivers error:', {
        message: error.message,
        stack: error.stack?.substring(0, 500),
        query: req.query
      });
      next(error);
    }
  }

  async findMatchingDrivers(req: Request, res: Response, next: NextFunction) {
    const requestId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const startTime = Date.now();
    
    try {
      const userType = req.user?.userType;
      
      const {
        pickupAddress,
        pickupLat,
        pickupLng,
        weight,
        volume,
        vehicleType,
        urgency,
        maxDistance
      } = req.body;
      
      logger.info(`🚗 [${requestId}] Customer matching request received:`, {
        userType,
        pickupAddress: pickupAddress?.substring(0, 100),
        weight,
        volume,
        vehicleType,
        urgency,
        maxDistance
      });
      
      // Validate required fields
      if (!pickupAddress || weight === undefined || volume === undefined) {
        logger.warn(`❌ [${requestId}] Missing required fields`, {
          hasPickupAddress: !!pickupAddress,
          hasWeight: weight !== undefined,
          hasVolume: volume !== undefined,
          body: req.body
        });
        return res.status(400).json({ 
          success: false,
          error: 'Missing required fields: pickupAddress, weight, volume' 
        });
      }
      
      // Parse numeric values safely
      const parsedWeight = parseFloat(weight as string);
      const parsedVolume = parseFloat(volume as string);
      
      if (isNaN(parsedWeight) || isNaN(parsedVolume)) {
        logger.warn(`❌ [${requestId}] Invalid numeric values`, {
          weightValue: weight,
          volumeValue: volume,
          parsedWeight,
          parsedVolume
        });
        return res.status(400).json({
          success: false,
          error: 'Invalid numeric values for weight or volume'
        });
      }
      
      // Build order requirements
      const orderRequirements = {
        pickupAddress,
        pickupCoords: pickupLat && pickupLng ? { 
          lat: parseFloat(pickupLat as string), 
          lng: parseFloat(pickupLng as string) 
        } : undefined,
        weight: parsedWeight,
        volume: parsedVolume,
        vehicleType: vehicleType as 'motorbike' | 'small_van' | 'medium_truck' | 'large_truck',
        urgency: urgency as 'normal' | 'urgent' | 'express',
        maxDistance: maxDistance ? parseFloat(maxDistance as string) : undefined
      };
      
      logger.info(`📦 [${requestId}] Order requirements:`, orderRequirements);
      
      // Call matching service
      let matchedDrivers;
      try {
        logger.info(`🔍 [${requestId}] Calling matching service...`);
        matchedDrivers = await matchingService.findMatchingDrivers(orderRequirements);
        logger.info(`✅ [${requestId}] Matching service completed: ${matchedDrivers.length} drivers found`);
      } catch (matchingError: any) {
        logger.error(`❌ [${requestId}] Matching service failed:`, {
          message: matchingError.message,
          stack: matchingError.stack?.substring(0, 500),
          errorName: matchingError.name
        });
        
        // Return a more helpful error message
        let errorMessage = 'Failed to find matching drivers';
        let statusCode = 500;
        
        if (matchingError.message.includes('database') || matchingError.message.includes('query')) {
          errorMessage = 'Driver database service is temporarily unavailable';
          statusCode = 503;
        } else if (matchingError.message.includes('geocoding') || matchingError.message.includes('coordinates')) {
          errorMessage = 'Location service is temporarily unavailable';
          statusCode = 503;
        }
        
        return res.status(statusCode).json({
          success: false,
          error: {
            message: errorMessage,
            details: process.env.NODE_ENV === 'development' ? matchingError.message : undefined
          },
          timestamp: new Date().toISOString(),
          requestId
        });
      }
      
      // Analyze results
      const totalDrivers = matchedDrivers.length;
      const driversWithDistance = matchedDrivers.filter(d => d.distanceInfo).length;
      const driversWithoutDistance = totalDrivers - driversWithDistance;
      
      // Prepare response
      const response: any = {
        success: true,
        data: matchedDrivers,
        count: totalDrivers,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId,
          processingTime: Date.now() - startTime,
          matchingStats: {
            total: totalDrivers,
            top4Returned: Math.min(4, totalDrivers),
            withDistanceInfo: driversWithDistance,
            withoutDistanceInfo: driversWithoutDistance,
            vehicleTypesIncluded: 'all'
          },
          note: 'Returning top 4 drivers across all vehicle types that can handle your order capacity',
          filtersApplied: {
            weight: orderRequirements.weight,
            volume: orderRequirements.volume,
            vehicleType: orderRequirements.vehicleType,
            maxDistance: orderRequirements.maxDistance,
            urgency: orderRequirements.urgency
          }
        }
      };
      
      // Add warnings if needed
      const warnings = [];
      
      if (driversWithoutDistance > 0) {
        warnings.push(`${driversWithoutDistance} driver(s) have no distance information`);
      }
      
      if (totalDrivers === 0) {
        warnings.push('No drivers found matching your criteria');
      }
      
      if (warnings.length > 0) {
        response.warnings = warnings;
      }
      
      // Log successful response
      logger.info(`🎉 [${requestId}] Matching request completed successfully`, {
        driversFound: totalDrivers,
        withDistance: driversWithDistance,
        warnings: warnings.length,
        processingTime: Date.now() - startTime
      });
      
      return res.json(response);
      
    } catch (error: any) {
      // Catch any unexpected errors
      logger.error(`💥 [${requestId}] Unexpected error in findMatchingDrivers:`, {
        message: error.message,
        stack: error.stack?.substring(0, 500),
        body: req.body,
        user: req.user,
        processingTime: Date.now() - startTime
      });
      
      return res.status(500).json({
        success: false,
        error: {
          message: 'An unexpected error occurred while processing your request',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
          requestId
        },
        timestamp: new Date().toISOString()
      });
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