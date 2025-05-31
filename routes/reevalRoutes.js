import express from 'express';
import { userProtected } from '../middleware/authMiddleware.js';
import { submitReevaluationController } from '../controllers/reevalController.js';

const router = express.Router();

router.use(userProtected);


//** Tested and working Apis */

//** ........End .............**/



router.post('/submit', submitReevaluationController);

export default router;