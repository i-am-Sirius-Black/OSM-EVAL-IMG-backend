import express from 'express';
import { userProtected } from '../middleware/authMiddleware.js';
import { getAnnotations, saveAnnotations } from '../controllers/annotationController.js';

const router = express.Router();

router.get('/:copyId', userProtected, getAnnotations);
router.post('/', userProtected, saveAnnotations);

export default router;