import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware';

const router = Router();
const userController = new UserController();

// Public routes
router.get('/', userController.getAllUsers.bind(userController));
router.get('/search', userController.searchUsers.bind(userController));
router.get('/type/:type', userController.getUsersByType.bind(userController));
router.get('/:id', userController.getUserById.bind(userController));

// Protected routes
router.put('/profile', authMiddleware, userController.updateProfile.bind(userController));

export default router;