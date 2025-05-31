import express from 'express';
import { changePassword, checkAuth, login, logout } from '../controllers/authController.js';
import { userProtected } from '../middleware/authMiddleware.js';

const router = express.Router();

//** Tested and working Apis */
router.get('/check', checkAuth);
router.post('/login', login);
router.post('/logout', logout);
//** ........End .............**/


router.put('/change-password',userProtected, changePassword); 


export default router;