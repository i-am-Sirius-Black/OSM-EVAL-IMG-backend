import express from 'express';
import { changePassword, checkAuth, getNewUID, login, logout, register } from '../controllers/authController.js';
import { userProtected } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/check', checkAuth);
router.get('/uid/new', getNewUID); // Temporary route to generate new UID 
router.post('/login', login);
router.post('/logout', logout);
router.post('/register', register);
router.put('/change-password',userProtected, changePassword); 


export default router;