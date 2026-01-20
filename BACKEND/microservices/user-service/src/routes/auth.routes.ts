import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateRegister, validateLogin, validateUserId } from '../middleware/validation.middleware';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/register', validateRegister, authController.register.bind(authController));
router.post('/login', validateLogin, authController.login.bind(authController));
router.post('/refresh-token', authController.refreshToken.bind(authController));
router.get('/validate/:userId', validateUserId, authController.validate.bind(authController));

// Protected routes
router.post('/logout', authMiddleware, authController.logout.bind(authController));
router.get('/profile', authMiddleware, authController.getProfile.bind(authController));

export default router;