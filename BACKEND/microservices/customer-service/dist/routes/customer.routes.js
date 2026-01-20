"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const customer_controller_1 = require("../controllers/customer.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const multer_1 = __importDefault(require("multer"));
const router = express_1.default.Router();
const customerController = new customer_controller_1.CustomerController();
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880')
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
            'image/jpeg',
            'image/png',
            'image/jpg'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
        }
    }
});
router.use(auth_middleware_1.authenticate);
router.use(auth_middleware_1.authorizeCustomer);
router.post('/profile', (0, validation_middleware_1.validate)(validation_middleware_1.validationSchemas.customer.create), customerController.createProfile);
router.get('/profile', customerController.getProfile);
router.put('/profile', (0, validation_middleware_1.validate)(validation_middleware_1.validationSchemas.customer.update), customerController.updateProfile);
router.post('/profile-picture', upload.single('profilePicture'), validation_middleware_1.validateFile, customerController.uploadProfilePicture);
router.delete('/profile-picture', customerController.deleteProfilePicture);
router.post('/addresses', (0, validation_middleware_1.validate)(validation_middleware_1.validationSchemas.address.create), customerController.addAddress);
router.put('/addresses/:id', (0, validation_middleware_1.validate)(validation_middleware_1.validationSchemas.address.update), customerController.updateAddress);
router.delete('/addresses/:id', customerController.deleteAddress);
router.post('/payment-methods', (0, validation_middleware_1.validate)(validation_middleware_1.validationSchemas.paymentMethod.create), customerController.addPaymentMethod);
router.put('/payment-methods/:id', (0, validation_middleware_1.validate)(validation_middleware_1.validationSchemas.paymentMethod.update), customerController.updatePaymentMethod);
router.delete('/payment-methods/:id', customerController.deletePaymentMethod);
router.put('/preferences', (0, validation_middleware_1.validate)(validation_middleware_1.validationSchemas.preferences), customerController.updatePreferences);
router.put('/time-slots', (0, validation_middleware_1.validate)(validation_middleware_1.validationSchemas.timeSlots), customerController.updateTimeSlots);
router.post('/feedback', (0, validation_middleware_1.validate)(validation_middleware_1.validationSchemas.feedback), customerController.addFeedback);
router.post('/order-stats', (0, validation_middleware_1.validate)(validation_middleware_1.validationSchemas.orderStats), customerController.updateOrderStats);
router.get('/stats', customerController.getStats);
router.get('/search', auth_middleware_1.optionalAuthenticate, customerController.searchCustomers);
router.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'customer-service',
        timestamp: new Date().toISOString()
    });
});
exports.default = router;
//# sourceMappingURL=customer.routes.js.map