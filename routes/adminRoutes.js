import express from 'express';
import { adminLogin, adminLogout, getEvaluators } from '../controllers/adminController.js';

const router = express.Router();


router.post('/login', adminLogin);
router.post('/logout', adminLogout);
router.get('/evaluators', getEvaluators);

export default router;