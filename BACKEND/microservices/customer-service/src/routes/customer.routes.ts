import express from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { authenticate, authorizeCustomer, optionalAuthenticate } from '../middleware/auth.middleware';
import { validate, validationSchemas, validateFile } from '../middleware/validation.middleware';
import multer from 'multer';

const router = express.Router();
const customerController = new CustomerController();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880') // 5MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/jpg'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
    }
  }
});

// Apply authentication and authorization to all customer routes
router.use(authenticate);
router.use(authorizeCustomer);

// Profile routes
router.post(
  '/profile',
  validate(validationSchemas.customer.create),
  customerController.createProfile
);

router.get('/profile', customerController.getProfile);

router.put(
  '/profile',
  validate(validationSchemas.customer.update),
  customerController.updateProfile
);

// Profile picture routes
router.post(
  '/profile-picture',
  upload.single('profilePicture'),
  validateFile,
  customerController.uploadProfilePicture
);

router.delete(
  '/profile-picture',
  customerController.deleteProfilePicture
);

// Address routes
router.post(
  '/addresses',
  validate(validationSchemas.address.create),
  customerController.addAddress
);

router.put(
  '/addresses/:id',
  validate(validationSchemas.address.update),
  customerController.updateAddress
);

router.delete('/addresses/:id', customerController.deleteAddress);

// Payment method routes
router.post(
  '/payment-methods',
  validate(validationSchemas.paymentMethod.create),
  customerController.addPaymentMethod
);

router.put(
  '/payment-methods/:id',
  validate(validationSchemas.paymentMethod.update),
  customerController.updatePaymentMethod
);

router.delete('/payment-methods/:id', customerController.deletePaymentMethod);

// Preferences routes
router.put(
  '/preferences',
  validate(validationSchemas.preferences),
  customerController.updatePreferences
);

// Time slots routes
router.put(
  '/time-slots',
  validate(validationSchemas.timeSlots),
  customerController.updateTimeSlots
);

// Feedback routes
router.post(
  '/feedback',
  validate(validationSchemas.feedback),
  customerController.addFeedback
);

// Stats and orders routes
router.post(
  '/order-stats',
  validate(validationSchemas.orderStats),
  customerController.updateOrderStats
);

router.get('/stats', customerController.getStats);

// Admin/search routes (optional authentication for admin)
router.get(
  '/search',
  optionalAuthenticate,
  customerController.searchCustomers
);

// Public health check route
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'customer-service',
    timestamp: new Date().toISOString()
  });
});

export default router;