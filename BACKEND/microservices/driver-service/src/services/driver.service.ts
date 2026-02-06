import { httpClient } from '../utils/httpClient';
import { uploadService } from './upload.service';
import { logger } from '../utils/logger';
import { getDriverRepository } from '../repositories/driver.repository';
import { getVehicleRepository } from '../repositories/vehicle.repository';
import { getDocumentRepository } from '../repositories/document.repository';
import { getProfilePictureRepository } from '../repositories/profilePicture.repository';
import { getDriverMetricsRepository } from '../repositories/driverMetrics.repository';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const UPLOAD_PATH = process.env.UPLOAD_PATH || path.join(process.cwd(), 'src', 'uploads');

import {
  Driver,
  Vehicle,
  Document,
  ProfilePicture,
  VehicleRequest,
  DocumentRequest,
  AvailabilityRequest,
  CreateDriverRequest,
  UpdateDriverRequest,
  StatusRequest,
   DriverMetrics
} from '../types';
import { ensurePool } from '../config/database';

export interface CreateDriverProfileInput {
  licenseNumber?: string;
  licenseExpiry?: Date;
  insuranceNumber?: string;
  insuranceExpiry?: Date;
}

export interface DiscoverDriversParams {
  pickupLocation?: string;
  pickupLat?: number;
  pickupLng?: number;
  estimatedWeight?: number;
  estimatedVolume?: number;
  vehicleType?: string;
  radius?: number;
  limit?: number;
  page?: number;
}

export interface DriverInfo {
  driverId: string;
  userId: string;
  rating: number;
  totalDeliveries: number;
  completionRate: number;
  verificationLevel: string;
  isOnline: boolean;
  currentLocation: string;
  profileCompleted: boolean;
  user?: { 
    firstName: string;
    lastName: string;
    phone: string;
  };
  vehicles: Array<{
    id: string;
    type: 'motorbike' | 'small_van' | 'medium_truck' | 'large_truck';
    make: string;
    model: string;
    year: number;
    color: string;
    licensePlate: string;
    maxWeight: number;
    maxVolume: number;
    imageUrl?: string;
    status: string;
  }>;
}

export class DriverService {
  private driverRepository = getDriverRepository();
  private vehicleRepository = getVehicleRepository();
  private documentRepository = getDocumentRepository();
  private profilePictureRepository = getProfilePictureRepository();
  private driverMetricsRepository = getDriverMetricsRepository();

  async validateAndGetUser(userId: string): Promise<any> {
    try {
      const isValid = await httpClient.validateUser(userId);
      if (!isValid) {
        throw new Error('User not found or inactive');
      }

      // If validation passes, assume user is OK
      return { id: userId, userType: 'driver' };

    } catch (error: any) {
      logger.error('User validation failed:', error.message);
      throw new Error('User not found or inactive');
    }
  }

  async createDriverProfile(userId: string, data: CreateDriverRequest): Promise<Driver> {
    await this.validateAndGetUser(userId);

    const existingDriver = await this.driverRepository.findByUserId(userId);
    if (existingDriver) {
      throw new Error('Driver profile already exists');
    }

    const driver = await this.driverRepository.create(userId, {
      licenseNumber: data.licenseNumber,
      licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry) : undefined,
      insuranceNumber: data.insuranceNumber,
      insuranceExpiry: data.insuranceExpiry ? new Date(data.insuranceExpiry) : undefined,
      status: 'pending',
      verificationLevel: 'none',
      onboardedAt: new Date(),
    });

    logger.info(`Created driver profile for user: ${userId}`);
    return driver;
  }

  async getDriverProfile(userId: string): Promise<any> {
    const driver = await this.driverRepository.findByUserId(userId);
    if (!driver) {
      throw new Error('Driver profile not found');
    }

    const userInfo = await httpClient.getUser(userId);
    const [vehicles, documents, profilePicture, availability] = await Promise.all([
      this.vehicleRepository.findByDriverId(driver.id),
      this.documentRepository.findByDriverId(driver.id),
      this.profilePictureRepository.findByDriverId(driver.id),
      this.driverRepository.getAvailability(driver.id)
    ]);

    return {
      ...driver,
      user: {
        id: userInfo.id,
        email: userInfo.email,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        phone: userInfo.phone,
      },
      vehicles,
      documents,
      profilePicture,
      availability
    };
  }

  // In your discoverAvailableDrivers method, update it to include user information:
  async discoverAvailableDrivers(params: {
    estimatedWeight?: number;
    estimatedVolume?: number;
    vehicleType?: 'motorbike' | 'small_van' | 'medium_truck' | 'large_truck';
    limit?: number;
    page?: number;
  }): Promise<DriverInfo[]> {
    const requestId = `discover_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const startTime = Date.now();
    
    try {
      logger.info(`🔍 [${requestId}] Starting driver discovery with params:`, params);
      
      const pool = await ensurePool();
      
      // Start building the query
      let query = `
        SELECT 
          d.id as driver_id,
          d.user_id,
          d.rating,
          d.total_deliveries,
          d.completion_rate,
          d.status as driver_status,
          d.verification_level,
          d.is_online,
          d.current_location,
          d.profile_completed,
          
          v.id as vehicle_id,
          v.type as vehicle_type,
          v.make,
          v.model,
          v.year,
          v.color,
          v.license_plate,
          v.max_weight,
          v.max_volume,
          v.image_url,
          v.current_status as vehicle_status
        FROM drivers d
        LEFT JOIN vehicles v ON d.id = v.driver_id AND v.is_active = TRUE
        WHERE d.status = 'active'
          AND d.is_online = TRUE
          AND d.verification_level IN ('verified', 'premium')
          AND v.current_status = 'available'
      `;
      
      const values: any[] = [];
      
      // Add optional filters
      if (params.vehicleType) {
        query += ` AND v.type = ?`;
        values.push(params.vehicleType);
      }
      
      if (params.estimatedWeight !== undefined && params.estimatedWeight !== null) {
        query += ` AND v.max_weight >= ?`;
        values.push(params.estimatedWeight);
      }
      
      if (params.estimatedVolume !== undefined && params.estimatedVolume !== null) {
        query += ` AND v.max_volume >= ?`;
        values.push(params.estimatedVolume);
      }
      
      // Add pagination
      const limit = params.limit || 20;
      const page = params.page || 1;
      const offset = (page - 1) * limit;
      
      query += ` ORDER BY d.rating DESC, d.total_deliveries DESC LIMIT ? OFFSET ?`;
      values.push(limit, offset);
      
      logger.info(`📊 [${requestId}] Final SQL query:`, {
        query: query,
        values: values,
        valuesLength: values.length
      });
    
      try {
        logger.info(`💾 [${requestId}] Executing database query...`);
        const [rows] = await pool.execute(query, values);
        const drivers = rows as any[];
        
        if (!drivers || drivers.length === 0) {
          logger.info(`ℹ️ [${requestId}] No drivers found matching criteria`);
          return [];
        }
        
        logger.info(`✅ [${requestId}] Found ${drivers.length} raw driver records from database`);
        
        // Group vehicles by driver and fetch user info
        const driversMap = new Map();
        const userPromises: Promise<any>[] = [];
        
        for (const row of drivers) {
          if (!driversMap.has(row.driver_id)) {
            driversMap.set(row.driver_id, {
              driverId: row.driver_id,
              userId: row.user_id,
              rating: row.rating || 0,
              totalDeliveries: row.total_deliveries || 0,
              completionRate: row.completion_rate || 0,
              status: row.driver_status,
              verificationLevel: row.verification_level,
              isOnline: Boolean(row.is_online),
              currentLocation: row.current_location || '',
              profileCompleted: Boolean(row.profile_completed),
              vehicles: [],
              user: null
            });
            
            // Fetch user info for this driver
            userPromises.push(
              httpClient.getUser(row.user_id)
                .then(userInfo => {
                  logger.debug(`✅ [${requestId}] Fetched user info for ${row.user_id}:`, {
                    firstName: userInfo.firstName,
                    lastName: userInfo.lastName
                  });
                  return {
                    driverId: row.driver_id,
                    userInfo: {
                      firstName: userInfo.firstName || 'Driver',
                      lastName: userInfo.lastName || `#${row.user_id.substring(0, 4)}`,
                      phone: userInfo.phone || 'Contact via app',
                      email: userInfo.email || ''
                    }
                  };
                })
                .catch(error => {
                  logger.warn(`⚠️ [${requestId}] Failed to fetch user info for ${row.user_id}:`, {
                    message: error.message,
                    errorCode: error.code
                  });
                  return {
                    driverId: row.driver_id,
                    userInfo: {
                      firstName: 'Driver',
                      lastName: `#${row.user_id.substring(0, 4)}`,
                      phone: 'Contact via app',
                      email: ''
                    }
                  };
                })
            );
          }
        
          if (row.vehicle_id) {
            const driverData = driversMap.get(row.driver_id);
            driverData.vehicles.push({
              id: row.vehicle_id,
              type: row.vehicle_type,
              make: row.make,
              model: row.model,
              year: row.year,
              color: row.color,
              licensePlate: row.license_plate,
              maxWeight: parseFloat(row.max_weight?.toString() || '0'),
              maxVolume: parseFloat(row.max_volume?.toString() || '0'),
              imageUrl: row.image_url,
              status: row.vehicle_status
            });
          }
        }
        
        logger.info(`👥 [${requestId}] Waiting for ${userPromises.length} user info requests...`);
        
        // Wait for all user info to be fetched
        const userResults = await Promise.all(userPromises);
        
        logger.info(`✅ [${requestId}] All user info fetched, updating drivers...`);
        
        // Update drivers with user info
        userResults.forEach(result => {
          const driverData = driversMap.get(result.driverId);
          if (driverData && result.userInfo) {
            driverData.user = result.userInfo;
          }
        });
        
        // Filter out drivers without user info
        const validDrivers = Array.from(driversMap.values()).filter(driver => 
          driver.user !== null
        );
        
        // Also filter out drivers without vehicles
        const driversWithVehicles = validDrivers.filter(driver => 
          driver.vehicles && driver.vehicles.length > 0
        );
        
        logger.info(`📊 [${requestId}] Discovery results:`, {
          totalRawRecords: drivers.length,
          uniqueDrivers: driversMap.size,
          withUserInfo: validDrivers.length,
          withVehicles: driversWithVehicles.length,
          processingTime: Date.now() - startTime
        });
        
        if (driversWithVehicles.length === 0) {
          logger.warn(`⚠️ [${requestId}] No valid drivers found after filtering`);
        } else {
          logger.info(`🎯 [${requestId}] Returning ${driversWithVehicles.length} valid drivers`);
          driversWithVehicles.forEach((driver, index) => {
            logger.debug(`  ${index + 1}. ${driver.user.firstName} ${driver.user.lastName} - ${driver.vehicles.length} vehicle(s)`);
          });
        }
        
        return driversWithVehicles;
        
      } catch (error: any) {
        logger.error(`❌ [${requestId}] Database query error:`, {
          message: error.message,
          query: query,
          values: values,
          errorCode: error.code,
          sqlMessage: error.sqlMessage,
          stack: error.stack?.substring(0, 500)
        });
        throw new Error(`Database query failed: ${error.message}`);
      }
    } catch (error: any) {
      logger.error(`💥 [${requestId}] Error in discoverAvailableDrivers:`, {
        message: error.message,
        params: params,
        processingTime: Date.now() - startTime
      });
      throw error;
    }
  }


  async updateDriverProfile(userId: string, data: UpdateDriverRequest): Promise<Driver | null> {
    const driver = await this.driverRepository.findByUserId(userId);
    if (!driver) {
      throw new Error('Driver profile not found');
    }

    const updateData: any = {};
    if (data.licenseNumber !== undefined) updateData.licenseNumber = data.licenseNumber;
    if (data.licenseExpiry !== undefined) updateData.licenseExpiry = new Date(data.licenseExpiry);
    if (data.insuranceNumber !== undefined) updateData.insuranceNumber = data.insuranceNumber;
    if (data.insuranceExpiry !== undefined) updateData.insuranceExpiry = new Date(data.insuranceExpiry);
    if (data.currentLocation !== undefined) updateData.currentLocation = data.currentLocation;
    updateData.profileCompleted = true;

    const updatedDriver = await this.driverRepository.update(userId, updateData);
    logger.info(`Updated driver profile for user: ${userId}`);
    return updatedDriver;
  }

  async uploadProfilePicture(userId: string, file: Express.Multer.File): Promise<ProfilePicture> {
    const driver = await this.driverRepository.findByUserId(userId);
    if (!driver) {
      throw new Error('Driver profile not found');
    }

  // 🔥 CRITICAL FIX: Delete existing profile picture FIRST
  const existingPicture = await this.profilePictureRepository.findByDriverId(driver.id);
  if (existingPicture) {
    // Delete physical files
    const filesToDelete = [
      existingPicture.originalUrl.replace(`${process.env.APP_URL}/uploads/`, ''),
      existingPicture.thumbnailUrl?.replace(`${process.env.APP_URL}/uploads/`, ''),
      existingPicture.smallUrl?.replace(`${process.env.APP_URL}/uploads/`, ''),
      existingPicture.mediumUrl?.replace(`${process.env.APP_URL}/uploads/`, ''),
    ].filter(Boolean) as string[];

    for (const filePath of filesToDelete) {
      await uploadService.deleteFile(filePath);
    }

    // Delete from DB
    await this.profilePictureRepository.deleteByDriverId(driver.id);
  }

  // Now process and save new picture
  const processed = await uploadService.processProfilePicture(file.path, userId);
  const profilePicture = await this.profilePictureRepository.create({
    driverId: driver.id,
    originalUrl: uploadService.getFileUrl(processed.processedFiles.original),
    thumbnailUrl: processed.processedFiles.thumbnail ? uploadService.getFileUrl(processed.processedFiles.thumbnail) : undefined,
    smallUrl: processed.processedFiles.small ? uploadService.getFileUrl(processed.processedFiles.small) : undefined,
    mediumUrl: processed.processedFiles.medium ? uploadService.getFileUrl(processed.processedFiles.medium) : undefined,
    mimeType: file.mimetype,
    size: processed.metadata.size,
    width: processed.metadata.width,
    height: processed.metadata.height,
    isActive: true
  });

  logger.info(`Uploaded profile picture for driver: ${userId}`);
  return profilePicture;
}

  async deleteProfilePicture(userId: string): Promise<void> {
    const driver = await this.driverRepository.findByUserId(userId);
    if (!driver) {
      throw new Error('Driver profile not found');
    }

    const picture = await this.profilePictureRepository.findByDriverId(driver.id);
    if (!picture) {
      throw new Error('Profile picture not found');
    }

    const filesToDelete = [
      picture.originalUrl.replace(`${process.env.APP_URL}/uploads/`, ''),
      picture.thumbnailUrl?.replace(`${process.env.APP_URL}/uploads/`, ''),
      picture.smallUrl?.replace(`${process.env.APP_URL}/uploads/`, ''),
      picture.mediumUrl?.replace(`${process.env.APP_URL}/uploads/`, ''),
    ].filter(Boolean) as string[];

    for (const filePath of filesToDelete) {
      await uploadService.deleteFile(filePath);
    }

    await this.profilePictureRepository.deleteByDriverId(driver.id);
    logger.info(`Deleted profile picture for driver: ${userId}`);
  }

  async addVehicle(userId: string, data: VehicleRequest): Promise<Vehicle> {
    const driver = await this.driverRepository.findByUserId(userId);
    if (!driver) {
      throw new Error('Driver profile not found');
    }

    const vehicle = await this.vehicleRepository.create({
      driverId: driver.id,
      type: data.type,
      make: data.make,
      model: data.model,
      year: data.year,
      color: data.color,
      licensePlate: data.licensePlate,
      maxWeight: data.maxWeight,
      maxVolume: data.maxVolume,
      imageUrl: data.imageUrl,
      insuranceInfo: data.insuranceInfo,
      isActive: true,
      currentStatus: 'available'
    });

    logger.info(`Added vehicle for driver: ${userId}`);
    return vehicle;
  }

  async getVehicles(userId: string): Promise<Vehicle[]> {
    const driver = await this.driverRepository.findByUserId(userId);
    if (!driver) {
      throw new Error('Driver profile not found');
    }

    return await this.vehicleRepository.findByDriverId(driver.id);
  }

  // Add this method to your DriverService class
  async uploadVehicleImage(userId: string, vehicleId: string, file: Express.Multer.File): Promise<Vehicle> {
    const driver = await this.driverRepository.findByUserId(userId);
    if (!driver) {
      throw new Error('Driver profile not found');
    }

    const vehicle = await this.vehicleRepository.findById(vehicleId);
    if (!vehicle || vehicle.driverId !== driver.id) {
      throw new Error('Vehicle not found or unauthorized');
    }

    // Process the vehicle image
    const imageUrl = await this.processVehicleImage(file, userId, vehicleId);

    // Update vehicle with image URL
    const updatedVehicle = await this.vehicleRepository.update(vehicleId, { 
      imageUrl: imageUrl 
    });

    if (!updatedVehicle) {
      throw new Error('Failed to update vehicle image');
    }

    logger.info(`Uploaded image for vehicle ${vehicleId} for driver: ${userId}`);
    return updatedVehicle;
  }

  private async processVehicleImage(file: Express.Multer.File, userId: string, vehicleId: string): Promise<string> {
    // Create vehicle-specific upload directory
    const uploadDir = path.join(UPLOAD_PATH, 'vehicles', userId);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const uniqueName = `${vehicleId}_${Date.now()}${path.extname(file.originalname)}`;
    const filePath = path.join(uploadDir, uniqueName);

    // Move the uploaded file
    await fs.promises.copyFile(file.path, filePath);

    // Optional: Process image (resize, optimize, etc.)
    if (file.mimetype.startsWith('image/')) {
      try {
        await sharp(filePath)
          .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(filePath);
      } catch (error) {
        // Type the error properly
        if (error instanceof Error) {
          logger.warn(`Could not process vehicle image: ${error.message}`);
        } else {
          logger.warn(`Could not process vehicle image: ${String(error)}`);
        }
      }
    }

    // Return the URL
    return `${process.env.APP_URL || 'http://localhost:3002'}/uploads/vehicles/${userId}/${uniqueName}`;
  }

  async updateVehicle(userId: string, vehicleId: string, data: Partial<VehicleRequest>): Promise<Vehicle> {
    const driver = await this.driverRepository.findByUserId(userId);
    if (!driver) {
      throw new Error('Driver profile not found');
    }

    const vehicle = await this.vehicleRepository.findById(vehicleId);
    if (!vehicle || vehicle.driverId !== driver.id) {
      throw new Error('Vehicle not found');
    }

    const updatedVehicle = await this.vehicleRepository.update(vehicleId, data);
    if (!updatedVehicle) {
      throw new Error('Failed to update vehicle');
    }

    logger.info(`Updated vehicle ${vehicleId} for driver: ${userId}`);
    return updatedVehicle;
  }

  async deleteVehicle(userId: string, vehicleId: string): Promise<boolean> {
    const driver = await this.driverRepository.findByUserId(userId);
    if (!driver) {
      throw new Error('Driver profile not found');
    }

    const vehicle = await this.vehicleRepository.findById(vehicleId);
    if (!vehicle || vehicle.driverId !== driver.id) {
      throw new Error('Vehicle not found');
    }

    const result = await this.vehicleRepository.delete(vehicleId);
    logger.info(`Deleted vehicle ${vehicleId} for driver: ${userId}`);
    return result;
  }

  // In the addDocument method, add uploadDate:
  async addDocument(userId: string, data: DocumentRequest & { file: Express.Multer.File }): Promise<Document> {
    const driver = await this.driverRepository.findByUserId(userId);
    if (!driver) {
      throw new Error('Driver profile not found');
    }
  
    // Fix: Convert string expiryDate back to Date and add uploadDate
    const expiryDate = data.expiryDate ? new Date(data.expiryDate) : undefined;
  
    const documentData = {
      driverId: driver.id,
      type: data.type,
      name: data.name || data.file.originalname,
      fileName: data.file.filename,
      fileUrl: uploadService.getFileUrl(`${userId}/${data.file.filename}`),
      fileSize: data.file.size,
      mimeType: data.file.mimetype,
      expiryDate: expiryDate,
      uploadDate: new Date(), // Add this
      status: 'pending' as const
    };
  
    const document = await this.documentRepository.create(documentData);
    logger.info(`Added document for driver: ${userId}`);
    return document;
  }

  async getDocuments(userId: string): Promise<Document[]> {
    const driver = await this.driverRepository.findByUserId(userId);
    if (!driver) {
      throw new Error('Driver profile not found');
    }

    return await this.documentRepository.findByDriverId(driver.id);
  }

  async updateDocumentStatus(
    documentId: string,
    status: string,
    verifiedBy?: string,
    rejectionReason?: string
  ): Promise<Document> {
    const updatedDocument = await this.documentRepository.updateStatus(documentId, status, verifiedBy, rejectionReason);
    if (!updatedDocument) {
      throw new Error('Document not found');
    }

    logger.info(`Updated document ${documentId} status to: ${status}`);
    return updatedDocument;
  }

  async updateAvailability(userId: string, availabilityData: AvailabilityRequest[]): Promise<any[]> {
    const driver = await this.driverRepository.findByUserId(userId);
    if (!driver) {
      throw new Error('Driver profile not found');
    }

    await this.driverRepository.updateAvailability(driver.id, availabilityData);

    const availabilities = availabilityData.map(avail => ({
      driverId: driver.id,
      dayOfWeek: avail.dayOfWeek,
      startTime: avail.startTime,
      endTime: avail.endTime,
      isActive: avail.isActive !== undefined ? avail.isActive : true
    }));

    logger.info(`Updated availability for driver: ${userId}`);
    return availabilities;
  }

  async getAvailability(userId: string): Promise<any[]> {
    const driver = await this.driverRepository.findByUserId(userId);
    if (!driver) {
      throw new Error('Driver profile not found');
    }

    return await this.driverRepository.getAvailability(driver.id);
  }

  async updateDriverStatus(userId: string, isOnline: boolean, location?: string): Promise<Driver | null> {
    const updatedDriver = await this.driverRepository.updateStatus(userId, isOnline, location);
    if (!updatedDriver) {
      throw new Error('Driver profile not found');
    }

    logger.info(`Updated driver status for ${userId}: online=${isOnline}`);
    return updatedDriver;
  }

  async getDriverStats(userId: string): Promise<any> {
    const driver = await this.driverRepository.findByUserId(userId);
    if (!driver) {
      throw new Error('Driver profile not found');
    }

    const metrics = await this.driverMetricsRepository.findByDriverId(driver.id, 30);
    const totalMetrics = metrics.reduce(
      (acc, metric) => ({
        deliveriesCount: acc.deliveriesCount + metric.deliveriesCount,
        successfulDeliveries: acc.successfulDeliveries + metric.successfulDeliveries,
        totalEarnings: acc.totalEarnings + metric.totalEarnings,
        onlineHours: acc.onlineHours + metric.onlineHours,
        distanceTraveled: acc.distanceTraveled + metric.distanceTraveled,
      }),
      {
        deliveriesCount: 0,
        successfulDeliveries: 0,
        totalEarnings: 0,
        onlineHours: 0,
        distanceTraveled: 0,
      }
    );

    const completionRate = totalMetrics.deliveriesCount > 0
      ? (totalMetrics.successfulDeliveries / totalMetrics.deliveriesCount) * 100
      : 0;

    return {
      driverId: driver.id,
      userId: driver.userId,
      rating: driver.rating,
      totalDeliveries: totalMetrics.deliveriesCount,
      successfulDeliveries: totalMetrics.successfulDeliveries,
      completionRate: parseFloat(completionRate.toFixed(2)),
      totalEarnings: totalMetrics.totalEarnings,
      onlineHours: parseFloat(totalMetrics.onlineHours.toFixed(2)),
      distanceTraveled: parseFloat(totalMetrics.distanceTraveled.toFixed(2)),
      isOnline: driver.isOnline,
      status: driver.status,
      verificationLevel: driver.verificationLevel,
    };
  }

  async checkVerificationStatus(userId: string): Promise<any> {
    const driver = await this.driverRepository.findByUserId(userId);
    if (!driver) {
      throw new Error('Driver profile not found');
    }

    const documents = await this.documentRepository.findByDriverId(driver.id);
    const requiredDocuments = ['license', 'insurance', 'registration'];
    const approvedDocs = documents.filter((doc: Document) => doc.status === 'approved');
    const expiredDocs = documents.filter((doc: Document) => doc.status === 'expired');

    const hasAllRequired = requiredDocuments.every((type) => 
      approvedDocs.some((doc: Document) => doc.type === type)
    );

    const canDrive = hasAllRequired && expiredDocs.length === 0 && driver.status === 'active';

    let verificationLevel = 'none';
    if (hasAllRequired) {
      verificationLevel = 'verified';
      if (approvedDocs.length > requiredDocuments.length) {
        verificationLevel = 'premium';
      }
    } else if (approvedDocs.length > 0) {
      verificationLevel = 'basic';
    }

    return {
      canDrive,
      verificationLevel,
      status: driver.status,
      approvedDocuments: approvedDocs.length,
      expiredDocuments: expiredDocs.length,
      missingDocuments: requiredDocuments.filter((type) => 
        !approvedDocs.some((doc: Document) => doc.type === type)
      ),
      details: {
        approved: approvedDocs.map((doc: Document) => ({ 
          type: doc.type, 
          name: doc.name, 
          expiryDate: doc.expiryDate 
        })),
        expired: expiredDocs.map((doc: Document) => ({ 
          type: doc.type, 
          name: doc.name, 
          expiryDate: doc.expiryDate 
        })),
      },
    };
  }

  async recordMetrics(userId: string, metrics: Partial<Omit<DriverMetrics, 'id' | 'driverId' | 'date' | 'createdAt'>>): Promise<void> {
    const driver = await this.driverRepository.findByUserId(userId);
    if (!driver) {
      throw new Error('Driver profile not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingMetrics = await this.driverMetricsRepository.getDailyMetrics(driver.id, today);
    
    if (existingMetrics) {
      await this.driverMetricsRepository.updateMetrics(existingMetrics.id, metrics);
    } else {
      await this.driverMetricsRepository.create({
        driverId: driver.id,
        date: today,
        deliveriesCount: metrics.deliveriesCount || 0,
        successfulDeliveries: metrics.successfulDeliveries || 0,
        failedDeliveries: metrics.failedDeliveries || 0,
        totalEarnings: metrics.totalEarnings || 0,
        averageRating: metrics.averageRating || 0.0,
        onlineHours: metrics.onlineHours || 0.0,
        distanceTraveled: metrics.distanceTraveled || 0.0
      });
    }
  }
}

export const driverService = new DriverService();