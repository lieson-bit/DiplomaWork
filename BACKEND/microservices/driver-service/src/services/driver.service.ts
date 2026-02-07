import axios from 'axios';
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

class UserServiceClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.USER_SERVICE_URL || 'http://user-service:3001';
  }

  async getUserById(userId: string) {
    const requestId = `user_fetch_${Date.now()}`;
    
    try {
      logger.info(`🔍 [${requestId}] Fetching user ${userId} from ${this.baseUrl}/api/users/${userId}`);
      
      const response = await axios.get(`${this.baseUrl}/api/users/${userId}`, {
        timeout: 5000
      });
      
      // CRITICAL FIX: Your user service returns data directly, not wrapped in { data: ... }
      if (!response.data) {
        logger.warn(`⚠️ [${requestId}] User service returned empty response for ${userId}`);
        return null;
      }
      
      // Use response.data directly since that's what your user service returns
      const userData = response.data;
      
      logger.info(`✅ [${requestId}] User ${userId} fetched successfully:`, {
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        email: userData.email,
        fullResponse: userData  // Log full response for debugging
      });
      
      return userData;
      
    } catch (error: any) {
      logger.error(`❌ [${requestId}] FAILED to fetch user ${userId}:`, {
        message: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        url: `${this.baseUrl}/api/users/${userId}`
      });
      
      return null;
    }
  }
}

const userServiceClient = new UserServiceClient();

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
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    profileImageUrl?: string;
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
    logger.info(`🔍 [${requestId}] Starting REAL driver discovery with params:`, params);

    const pool = await ensurePool();

    const baseQuery = `
      SELECT 
        d.id as driver_id,
        d.user_id,
        d.rating,
        d.total_deliveries,
        d.completion_rate,
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
        v.current_status
      FROM drivers d
      LEFT JOIN vehicles v ON d.id = v.driver_id 
      WHERE d.status = 'active' 
        AND d.is_online = 1 
        AND d.verification_level IN ('verified', 'premium') 
        AND v.current_status = 'available'
    `;

    try {
      logger.info(`💾 [${requestId}] Executing database query...`);
      const [allRows] = await pool.execute(baseQuery);
      const allDrivers = allRows as any[];

      logger.info(`✅ [${requestId}] Database query found ${allDrivers.length} total drivers`);

      if (allDrivers.length === 0) {
        logger.warn(`⚠️ [${requestId}] No drivers found in database`);
        return [];
      }

      // Log the raw database data
      logger.debug(`📊 [${requestId}] Raw database data sample:`, allDrivers.slice(0, 2).map(row => ({
        driver_id: row.driver_id,
        user_id: row.user_id,
        vehicle_type: row.vehicle_type,
        current_location: row.current_location
      })));

      // Apply filters
      let filteredDrivers = allDrivers;

      if (params.vehicleType) {
        logger.info(`ℹ️ [${requestId}] Vehicle type filter requested: ${params.vehicleType}, but will include all vehicle types that meet capacity`);
        // Don't filter by vehicle type - just log it
      }

      if (params.estimatedWeight !== undefined) {
        filteredDrivers = filteredDrivers.filter(driver => {
          const maxWeight = parseFloat(driver.max_weight || 0);
          return maxWeight >= params.estimatedWeight!;
        });
        logger.info(`⚖️ [${requestId}] After weight filter: ${filteredDrivers.length} drivers`);
      }

      if (params.estimatedVolume !== undefined) {
        filteredDrivers = filteredDrivers.filter(driver => {
          const maxVolume = parseFloat(driver.max_volume || 0);
          return maxVolume >= params.estimatedVolume!;
        });
        logger.info(`📦 [${requestId}] After volume filter: ${filteredDrivers.length} drivers`);
      }

      // Apply pagination
      const limit = params.limit || 20;
      const page = params.page || 1;
      const offset = (page - 1) * limit;
      const paginatedDrivers = filteredDrivers.slice(offset, offset + limit);

      logger.info(`📄 [${requestId}] After pagination: ${paginatedDrivers.length} drivers (limit: ${limit}, page: ${page})`);

      if (paginatedDrivers.length === 0) {
        logger.warn(`⚠️ [${requestId}] No drivers match all filters`);
        return [];
      }

      // Process drivers with user data fetching
      logger.info(`👥 [${requestId}] Fetching user data for ${paginatedDrivers.length} drivers...`);
      
      const driverInfos: DriverInfo[] = [];
      
      // Process each driver row
      for (const row of paginatedDrivers) {
        try {
          // DECLARE userData at the top so we can use it later
          let userData: any = null;
          let userFetchError: string | null = null;
          
          // Fetch user data for this driver
          if (row.user_id) {
            try {
              logger.debug(`📞 [${requestId}] Fetching user data for userId: ${row.user_id}`);
              
              // TRY TO FETCH FROM USER SERVICE
              userData = await userServiceClient.getUserById(row.user_id);
              
              if (userData) {
                logger.info(`✅ [${requestId}] SUCCESS: User data fetched for ${row.user_id}`, {
                  firstName: userData.firstName,
                  lastName: userData.lastName,
                  phone: userData.phone,
                  email: userData.email
                });
              } else {
                logger.warn(`⚠️ [${requestId}] User service returned null for userId: ${row.user_id}`);
                userFetchError = 'User service returned null';
              }
            } catch (userError: any) {
              logger.error(`❌ [${requestId}] FAILED to fetch user ${row.user_id}:`, {
                message: userError.message,
                stack: userError.stack?.substring(0, 200),
                url: `http://user-service:3001/api/users/${row.user_id}`
              });
              userFetchError = userError.message;
            }
          } else {
            logger.warn(`⚠️ [${requestId}] Driver ${row.driver_id} has no user_id`);
          }
          
          // Create user info object - USE REAL DATA IF AVAILABLE
          const userInfo = userData ? {
            id: row.user_id,
            firstName: userData.firstName || 'Unknown',
            lastName: userData.lastName || 'User',
            email: userData.email || '',
            phone: userData.phone || '',
            profileImageUrl: userData.profileImage || userData.profileImageUrl || undefined
          } : {
            id: row.user_id || '',
            firstName: 'Driver',
            lastName: row.user_id ? `#${row.user_id.substring(0, 4)}` : 'Unknown',
            email: '',
            phone: '',
            profileImageUrl: undefined
          };
          
          // Get vehicle type
          const vehicleType = row.vehicle_type as 'motorbike' | 'small_van' | 'medium_truck' | 'large_truck' || 'motorbike';
          
          // Create vehicle object with real data
          const vehicle = {
            id: row.vehicle_id || '',
            type: vehicleType,
            make: row.make || 'Unknown',
            model: row.model || 'Unknown',
            year: parseInt(row.year) || new Date().getFullYear(),
            color: row.color || 'Unknown',
            licensePlate: row.license_plate || 'UNKNOWN',
            maxWeight: parseFloat(row.max_weight) || 0,
            maxVolume: parseFloat(row.max_volume) || 0,
            imageUrl: row.image_url || undefined,
            status: row.current_status || 'available'
          };
          
          // Parse numeric values safely
          const rating = parseFloat(row.rating);
          const totalDeliveries = parseInt(row.total_deliveries);
          const completionRate = parseFloat(row.completion_rate);
          
          // Create driver info with REAL data
          const driverInfo: DriverInfo = {
            driverId: row.driver_id,
            userId: row.user_id || '',
            rating: isNaN(rating) ? 0 : rating,
            totalDeliveries: isNaN(totalDeliveries) ? 0 : totalDeliveries,
            completionRate: isNaN(completionRate) ? 0 : completionRate,
            verificationLevel: row.verification_level || 'verified',
            isOnline: Boolean(row.is_online),
            currentLocation: row.current_location || 'Location not specified',
            profileCompleted: Boolean(row.profile_completed),
            user: userInfo,  // This should have real data if userData was fetched
            vehicles: [vehicle]
          };
          
          driverInfos.push(driverInfo);
          
          // Log driver processing status
          if (userData) {
            logger.debug(`✅ [${requestId}] Driver ${row.driver_id} processed WITH real user data:`, {
              name: `${userData.firstName} ${userData.lastName}`,
              phone: userData.phone,
              email: userData.email
            });
          } else {
            logger.debug(`⚠️ [${requestId}] Driver ${row.driver_id} processed WITHOUT real user data (using fallback)`, {
              fallbackName: `${userInfo.firstName} ${userInfo.lastName}`,
              userFetchError
            });
          }
          
        } catch (driverError: any) {
          logger.error(`❌ [${requestId}] Error processing driver row ${row.driver_id}:`, {
            message: driverError.message,
            errorName: driverError.name
          });
          continue;
        }
      }
      
      if (driverInfos.length === 0) {
        logger.warn(`⚠️ [${requestId}] No drivers could be processed after user data fetching`);
        return [];
      }
      
      // Log summary
      const driversWithRealUserData = driverInfos.filter(d => d.user && d.user.firstName !== 'Driver' && d.user.lastName !== `#${d.userId.substring(0, 4)}`);
      
      logger.info(`✅ [${requestId}] Processed ${driverInfos.length} drivers`, {
        withRealUserData: driversWithRealUserData.length,
        withFallbackUserData: driverInfos.length - driversWithRealUserData.length,
        sampleDrivers: driverInfos.slice(0, 2).map(d => ({
          driverId: d.driverId,
          userId: d.userId,
          name: `${d.user?.firstName} ${d.user?.lastName}`,
          phone: d.user?.phone,
          email: d.user?.email,
          hasRealData: d.user?.firstName !== 'Driver'
        }))
      });
      
      return driverInfos;
      
    } catch (queryError: any) {
      logger.error(`❌ [${requestId}] Database query failed:`, {
        message: queryError.message,
        errorCode: queryError.code,
        sqlMessage: queryError.sqlMessage
      });
      
      // Minimal fallback
      const fallbackDriver: DriverInfo = {
        driverId: 'fallback_driver',
        userId: 'fallback_user',
        rating: 0,
        totalDeliveries: 0,
        completionRate: 0,
        verificationLevel: 'verified',
        isOnline: true,
        currentLocation: 'Service unavailable',
        profileCompleted: false,
        user: {
          id: 'fallback_user',
          firstName: 'Fallback',
          lastName: 'Driver',
          email: '',
          phone: '',
          profileImageUrl: undefined
        },
        vehicles: [{
          id: 'fallback_vehicle',
          type: 'motorbike' as const,
          make: 'Unknown',
          model: 'Unknown',
          year: new Date().getFullYear(),
          color: 'Black',
          licensePlate: 'UNKNOWN',
          maxWeight: 25,
          maxVolume: 1,
          imageUrl: undefined,
          status: 'available'
        }]
      };
      
      return [fallbackDriver];
    }
    
  } catch (error: any) {
    logger.error(`💥 [${requestId}] Error in discoverAvailableDrivers:`, {
      message: error.message,
      stack: error.stack?.substring(0, 300),
      processingTime: Date.now() - startTime
    });
    
    return [];
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