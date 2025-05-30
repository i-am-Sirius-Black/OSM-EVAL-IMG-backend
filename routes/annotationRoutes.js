import express from 'express';
import { userProtected } from '../middleware/authMiddleware.js';
import { getAnnotations, saveAnnotations } from '../controllers/annotationController.js';

const router = express.Router();

router.use(userProtected) //auth middleware


//** Tested and working Apis */

//** ........End .............**/


router.get('/:copyId', getAnnotations);
router.post('/',  saveAnnotations);

export default router;