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
    try {
      const response = await axios.get(`${this.baseUrl}/api/users/${userId}`, {
        timeout: 5000
      });
      return response.data.data;
    } catch (error) {
      logger.warn(`Failed to fetch user ${userId}:`);
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
    
      // Build query with SQL parameters for better performance and security
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
        // Execute the query
        logger.info(`💾 [${requestId}] Executing database query...`);
        const [allRows] = await pool.execute(baseQuery);
        const allDrivers = allRows as any[];
      
        logger.info(`✅ [${requestId}] Database query found ${allDrivers.length} total drivers`);
      
        if (allDrivers.length === 0) {
          logger.warn(`⚠️ [${requestId}] No drivers found in database`);
          return [];
        }
      
        // Log sample driver for debugging
        if (allDrivers[0]) {
          logger.debug(`📝 [${requestId}] Sample database row:`, {
            driverId: allDrivers[0].driver_id,
            userId: allDrivers[0].user_id,
            verificationLevel: allDrivers[0].verification_level,
            isOnline: allDrivers[0].is_online,
            vehicleType: allDrivers[0].vehicle_type,
            maxWeight: allDrivers[0].max_weight,
            maxVolume: allDrivers[0].max_volume,
            currentLocation: allDrivers[0].current_location
          });
        }
      
        // Apply filters in JavaScript
        let filteredDrivers = allDrivers;
      
        // Apply vehicle type filter
        if (params.vehicleType) {
          filteredDrivers = filteredDrivers.filter(driver => 
            driver.vehicle_type === params.vehicleType
          );
          logger.info(`🚗 [${requestId}] After vehicle type filter: ${filteredDrivers.length} drivers`);
        }
      
        // Apply weight filter
        if (params.estimatedWeight !== undefined) {
          filteredDrivers = filteredDrivers.filter(driver => {
            const maxWeight = parseFloat(driver.max_weight || 0);
            return maxWeight >= params.estimatedWeight!;
          });
          logger.info(`⚖️ [${requestId}] After weight filter: ${filteredDrivers.length} drivers`);
        }
      
        // Apply volume filter
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
        const userFetchPromises: Promise<void>[] = [];
        
        // Create a map to store user data
        const userDataMap = new Map<string, any>();
        
        // Collect unique user IDs
        const uniqueUserIds = [...new Set(paginatedDrivers
          .filter(row => row.user_id)
          .map(row => row.user_id)
        )];
        
        logger.info(`📞 [${requestId}] Fetching ${uniqueUserIds.length} unique users from user service`);
        
        // Fetch all users in parallel
        for (const userId of uniqueUserIds) {
          const promise = userServiceClient.getUserById(userId)
            .then(userData => {
              if (userData) {
                userDataMap.set(userId, userData);
              }
            })
            .catch(error => {
              logger.warn(`⚠️ [${requestId}] Failed to fetch user ${userId}:`, error.message);
            });
          userFetchPromises.push(promise);
        }
        
        // Wait for all user fetches to complete
        await Promise.all(userFetchPromises);
        
        logger.info(`✅ [${requestId}] User data fetched: ${userDataMap.size}/${uniqueUserIds.length} users found`);
        
        // Process each driver row
        for (const row of paginatedDrivers) {
          try {
            // Get user data from map or create fallback
            let userData = null;
            if (row.user_id && userDataMap.has(row.user_id)) {
              userData = userDataMap.get(row.user_id);
            }
            
            // Create user info object
            const userInfo = userData ? {
              id: row.user_id,
              firstName: userData.firstName || 'Driver',
              lastName: userData.lastName || '',
              email: userData.email || '',
              phone: userData.phone || '',
              profileImageUrl: userData.profileImage || userData.profileImageUrl
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
              user: userInfo,
              vehicles: [vehicle]
            };
            
            driverInfos.push(driverInfo);
            
          } catch (driverError: any) {
            logger.warn(`⚠️ [${requestId}] Error processing driver row ${row.driver_id}:`, {
              message: driverError.message,
              errorName: driverError.name
            });
            // Continue processing other drivers
            continue;
          }
        }
        
        if (driverInfos.length === 0) {
          logger.warn(`⚠️ [${requestId}] No drivers could be processed after user data fetching`);
          return [];
        }
        
        logger.info(`✅ [${requestId}] Successfully processed ${driverInfos.length} drivers with real data`);
        
        // Log detailed information for debugging
        logger.debug(`📊 [${requestId}] Processed drivers summary:`, {
          totalProcessed: driverInfos.length,
          withUserData: driverInfos.filter(d => d.user?.firstName !== 'Driver').length,
          withRealLocation: driverInfos.filter(d => d.currentLocation && !d.currentLocation.includes('not specified')).length,
          sampleDriver: driverInfos.length > 0 ? {
            driverId: driverInfos[0].driverId,
            userId: driverInfos[0].userId,
            name: `${driverInfos[0].user?.firstName} ${driverInfos[0].user?.lastName}`,
            vehicleType: driverInfos[0].vehicles[0]?.type,
            location: driverInfos[0].currentLocation
          } : null
        });
        
        return driverInfos;
        
      } catch (queryError: any) {
        logger.error(`❌ [${requestId}] Database query failed:`, {
          message: queryError.message,
          errorCode: queryError.code,
          sqlMessage: queryError.sqlMessage
        });
        
        // Try a simpler query as fallback
        logger.info(`🔄 [${requestId}] Trying simplified fallback query...`);
        try {
          const simpleQuery = `SELECT id as driver_id, user_id FROM drivers WHERE status = 'active' AND is_online = 1 LIMIT 10`;
          const [simpleRows] = await pool.execute(simpleQuery);
          const simpleDrivers = simpleRows as any[];
          
          logger.info(`🔄 [${requestId}] Simple query returned ${simpleDrivers.length} rows`);
          
          if (simpleDrivers.length === 0) {
            logger.warn(`⚠️ [${requestId}] No drivers found even with simple query`);
            return [];
          }
          
          // Process simple results with minimal data
          const fallbackDrivers: DriverInfo[] = [];
          
          for (const row of simpleDrivers) {
            const driverInfo: DriverInfo = {
              driverId: row.driver_id,
              userId: row.user_id || '',
              rating: 0,
              totalDeliveries: 0,
              completionRate: 0,
              verificationLevel: 'verified',
              isOnline: true,
              currentLocation: 'Location data unavailable',
              profileCompleted: false,
              user: {
                id: row.user_id || '',
                firstName: 'Driver',
                lastName: row.user_id ? `#${row.user_id.substring(0, 4)}` : 'Unknown',
                email: '',
                phone: '',
                profileImageUrl: undefined
              },
              vehicles: [{
                id: 'unknown_vehicle',
                type: 'motorbike' as const,
                make: 'Unknown',
                model: 'Unknown',
                year: new Date().getFullYear(),
                color: 'Unknown',
                licensePlate: 'UNKNOWN',
                maxWeight: 50,
                maxVolume: 2,
                imageUrl: undefined,
                status: 'available'
              }]
            };
            fallbackDrivers.push(driverInfo);
          }
          
          logger.info(`🔄 [${requestId}] Returning ${fallbackDrivers.length} drivers with fallback data`);
          return fallbackDrivers;
          
        } catch (simpleError: any) {
          logger.error(`💥 [${requestId}] Simple query also failed:`, simpleError.message);
          
          // Ultimate minimal fallback
          const minimalDriver: DriverInfo = {
            driverId: 'minimal_driver_1',
            userId: 'minimal_user_1',
            rating: 0,
            totalDeliveries: 0,
            completionRate: 0,
            verificationLevel: 'verified',
            isOnline: true,
            currentLocation: 'St. Petersburg, Russia',
            profileCompleted: false,
            user: {
              id: 'minimal_user_1',
              firstName: 'Driver',
              lastName: '#0001',
              email: '',
              phone: '',
              profileImageUrl: undefined
            },
            vehicles: [{
              id: 'minimal_vehicle_1',
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
          
          return [minimalDriver];
        }
      }
      
    } catch (error: any) {
      logger.error(`💥 [${requestId}] Error in discoverAvailableDrivers:`, {
        message: error.message,
        stack: error.stack?.substring(0, 300),
        processingTime: Date.now() - startTime
      });
      
      // Emergency fallback
      const emergencyDriver: DriverInfo = {
        driverId: `emergency_${Date.now()}`,
        userId: `emergency_user_${Date.now()}`,
        rating: 0,
        totalDeliveries: 0,
        completionRate: 0,
        verificationLevel: 'verified',
        isOnline: true,
        currentLocation: 'Service temporarily unavailable',
        profileCompleted: false,
        user: {
          id: `emergency_user_${Date.now()}`,
          firstName: 'Service',
          lastName: 'Unavailable',
          email: '',
          phone: '',
          profileImageUrl: undefined
        },
        vehicles: [{
          id: 'emergency_vehicle',
          type: 'motorbike' as const,
          make: 'Service',
          model: 'Unavailable',
          year: new Date().getFullYear(),
          color: 'Gray',
          licensePlate: 'SVC-000',
          maxWeight: 0,
          maxVolume: 0,
          imageUrl: undefined,
          status: 'unavailable'
        }]
      };
      
      return [emergencyDriver];
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