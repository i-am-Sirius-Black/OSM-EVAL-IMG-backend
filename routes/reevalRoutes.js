import express from 'express';
import { userProtected } from '../middleware/authMiddleware.js';
import { submitReevaluationController } from '../controllers/reevalController.js';

const router = express.Router();

router.use(userProtected);

router.post('/reevaluate', submitReevaluationController);


export default router;