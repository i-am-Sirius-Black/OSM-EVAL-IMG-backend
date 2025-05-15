import express from 'express';
import { adminLogin, adminLogout, assignCopies, checkAdminAuth, getEvaluatedCopies, getEvaluators, getEvaluatorsStatus } from '../controllers/adminController.js';
import { adminProtected } from '../middleware/authMiddleware.js';

const router = express.Router();


router.get('/check', checkAdminAuth);
router.post('/login', adminLogin);
router.post('/logout', adminLogout);
router.get('/evaluators', adminProtected, getEvaluators);
router.post('/evaluator/assign-copies', adminProtected, assignCopies);
router.get('/get-evaluators-status', adminProtected, getEvaluatorsStatus);
router.get('/get-evaluated-copies', adminProtected, getEvaluatedCopies); //- Get all evaluated copies

export default router;