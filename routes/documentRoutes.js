import express from 'express';
import { userProtected } from '../middleware/authMiddleware.js';
import { getBags } from '../controllers/documentController.js';

const router = express.Router();

router.get('/bags/:packingId', userProtected, getBags); // - Get bags by packing ID

export default router;