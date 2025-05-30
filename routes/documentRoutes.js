import express from 'express';
import { userProtected } from '../middleware/authMiddleware.js';
// import { getBags } from '../controllers/documentController.js';

const router = express.Router();

//** Tested and working Apis */

//** ........End .............**/

router.use(userProtected) //auth middleware

// router.get('/bags/:packingId', getBags); // - Get bags by packing ID

export default router;