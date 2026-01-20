import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { logger } from '../utils/logger';

// Configure storage
const storage = multer.diskStorage({
  destination: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    const uploadPath = path.join(process.cwd(), 'src', 'uploads');
    cb(null, uploadPath);
  },
  filename: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

// File filter
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`));
  }
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Max 1 file per upload
  },
});

// Error handling middleware for multer
export const handleMulterError = (
  err: any,
  req: Request,
  res: any,
  next: any
) => {
  if (err instanceof multer.MulterError) {
    let message = 'File upload error';

    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File size is too large. Maximum size is 5MB';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Maximum 1 file allowed';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      default:
        message = `File upload error: ${err.message}`;
    }

    logger.error('Multer error:', err);
    return res.status(400).json({
      success: false,
      error: {
        message,
        code: err.code,
      },
    });
  }

  if (err) {
    logger.error('Upload error:', err);
    return res.status(400).json({
      success: false,
      error: {
        message: err.message || 'File upload failed',
      },
    });
  }

  next();
};

// Validate file presence middleware
export const validateFilePresence = (fieldName: string) => {
  return (req: Request, res: any, next: any) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          message: `No file uploaded. Please provide a ${fieldName}`,
        },
      });
    }

    // Validate file type based on field name
    if (fieldName === 'profilePicture') {
      const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedImageTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid image format. Allowed formats: JPEG, JPG, PNG, GIF',
          },
        });
      }
    } else if (fieldName === 'document') {
      const allowedDocTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/jpg',
        'image/png',
      ];
      if (!allowedDocTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid document format. Allowed formats: PDF, DOC, DOCX, JPEG, JPG, PNG',
          },
        });
      }
    }

    next();
  };
};

// Middleware to check if user has upload permissions
export const checkUploadPermission = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Unauthorized: Authentication required',
      },
    });
  }

  // Check if user is a driver
  if (req.user.userType !== 'driver') {
    return res.status(403).json({
      success: false,
      error: {
        message: 'Forbidden: Only drivers can upload files',
      },
    });
  }

  next();
};

// Middleware to clean up uploaded files on error
export const cleanupOnError = (req: Request, res: any, next: any) => {
  const originalSend = res.send;

  res.send = function (data: any) {
    // If there's an error response and a file was uploaded, delete it
    if (res.statusCode >= 400 && req.file) {
      const fs = require('fs');
      const path = require('path');

      const filePath = path.join(process.cwd(), 'src', 'uploads', req.file.filename);
      
      fs.unlink(filePath, (err: any) => {
        if (err) {
          logger.error('Failed to cleanup file:', err);
        } else {
          logger.info(`Cleaned up file: ${req.file?.filename}`);
        }
      });
    }

    return originalSend.call(this, data);
  };

  next();
};

export { upload };