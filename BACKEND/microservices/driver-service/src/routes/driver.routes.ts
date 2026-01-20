import express from 'express';
import { driverController } from '../controllers/driver.controller';
import { authenticate, authorizeDriver } from '../middleware/auth.middleware';
import { validate, validationSchemas } from '../middleware/validation.middleware';
import { upload } from '../services/upload.service';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(authorizeDriver);

// Profile routes
router.post(
  '/drivers/profile',
  validate(validationSchemas.driver.create),
  driverController.createProfile
);
router.get('/drivers/profile', driverController.getProfile);
router.put(
  '/drivers/profile',
  validate(validationSchemas.driver.update),
  driverController.updateProfile
);

// Profile picture routes
router.post(
  '/drivers/profile-picture',
  upload.single('profilePicture'),
  driverController.uploadProfilePicture
);
router.get('/drivers/profile-picture', driverController.getProfile);
router.delete('/drivers/profile-picture', driverController.deleteProfilePicture);

// Vehicle routes
router.post(
  '/drivers/vehicles',
  validate(validationSchemas.vehicle.create),
  driverController.addVehicle
);
router.get('/drivers/vehicles', driverController.getVehicles);
router.put(
  '/drivers/vehicles/:id',
  validate(validationSchemas.vehicle.update),
  driverController.updateVehicle
);
router.delete('/drivers/vehicles/:id', driverController.deleteVehicle);

router.post(
  '/drivers/vehicles/:id/image',
  upload.single('image'),
  driverController.uploadVehicleImage
);

// Document routes
router.post(
  '/drivers/documents',
  upload.single('document'),
  validate(validationSchemas.document.create),
  driverController.uploadDocument
);
router.get('/drivers/documents', driverController.getDocuments);
router.patch(
  '/drivers/documents/:id/status',
  validate(validationSchemas.document.update),
  driverController.updateDocumentStatus
);

// Availability routes
router.put(
  '/drivers/availability',
  validate(validationSchemas.availability),
  driverController.updateAvailability
);
router.get('/drivers/availability', driverController.getAvailability);

// Status routes
router.patch(
  '/drivers/status',
  validate(validationSchemas.status),
  driverController.updateStatus
);

// Stats and verification routes
router.get('/drivers/stats', driverController.getStats);
router.get('/drivers/verification-status', driverController.getVerificationStatus);
router.post('/drivers/metrics', driverController.recordMetrics);

export default router;