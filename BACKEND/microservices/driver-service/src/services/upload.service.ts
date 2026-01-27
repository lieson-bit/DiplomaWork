import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const UPLOAD_PATH = process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads');
//const UPLOAD_PATH = process.env.UPLOAD_PATH || path.join(process.cwd(), 'src', 'uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5242880');
const ALLOWED_FILE_TYPES = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/jpg,application/pdf').split(',');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(UPLOAD_PATH)) {
  fs.mkdirSync(UPLOAD_PATH, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req: any, file, cb) => {
    const userId = req.user?.userId || 'temp';
    const userUploadPath = path.join(UPLOAD_PATH, userId);
    
    if (!fs.existsSync(userUploadPath)) {
      fs.mkdirSync(userUploadPath, { recursive: true });
    }
    cb(null, userUploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

export class UploadService {
  async processProfilePicture(filePath: string, userId: string) {
    const uploadDir = path.join(UPLOAD_PATH, userId);
    const fileName = path.basename(filePath);
    const fileBaseName = path.basename(fileName, path.extname(fileName));
    const extension = path.extname(fileName);

    // Create resized versions
    const sizes = [
      { name: 'thumbnail', width: 100, height: 100 },
      { name: 'small', width: 300, height: 300 },
      { name: 'medium', width: 600, height: 600 },
    ];

    const processedFiles: Record<string, string> = {
      original: `${userId}/${fileName}`,
    };

    for (const size of sizes) {
      const outputPath = path.join(uploadDir, `${fileBaseName}_${size.name}${extension}`);
      
      await sharp(filePath)
        .resize(size.width, size.height, {
          fit: 'cover',
          position: 'center',
        })
        .toFile(outputPath);

      processedFiles[size.name] = `${userId}/${path.basename(outputPath)}`;
    }

    // Get image metadata
    const metadata = await sharp(filePath).metadata();

    return {
      processedFiles,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: fs.statSync(filePath).size,
      },
    };
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(UPLOAD_PATH, filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        logger.info(`Deleted file: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Failed to delete file ${filePath}:`, error);
      return false;
    }
  }

  async deleteUserFiles(userId: string): Promise<boolean> {
    try {
      const userDir = path.join(UPLOAD_PATH, userId);
      if (fs.existsSync(userDir)) {
        fs.rmSync(userDir, { recursive: true, force: true });
        logger.info(`Deleted all files for user: ${userId}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Failed to delete files for user ${userId}:`, error);
      return false;
    }
  }

  getFileUrl(filePath: string): string {
    const baseUrl = process.env.APP_URL || 'http://localhost:3002';
    return `${baseUrl}/uploads/${filePath}`;
  }

  async validateFileSize(filePath: string, maxSize: number): Promise<boolean> {
    const stats = fs.statSync(filePath);
    return stats.size <= maxSize;
  }

  async getFileInfo(filePath: string) {
    const fullPath = path.join(UPLOAD_PATH, filePath);
    const stats = fs.statSync(fullPath);
    
    return {
      path: filePath,
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      isDirectory: stats.isDirectory(),
    };
  }
}

export const uploadService = new UploadService();