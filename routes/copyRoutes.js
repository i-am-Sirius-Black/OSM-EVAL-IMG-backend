import express from 'express';
import {  copyImage, copyPdfDownload} from '../controllers/copyController.js';
import { userProtected } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(userProtected) //auth middleware


//** Tested and working Apis */

//** ........End .............**/

router.get('/image', copyImage); //- Get image for a specific page 
router.get('/pdf/:copyId',  copyPdfDownload); //- Download PDF with annotations
// router.get('/search',  copySearch); //- Search and filter copies
// router.get('/annotated', copyAnnotated); // - Get all annotated copies
// router.get('/subject', getAllCopiesByPacking); // - Get All copies by packing ID
    
export default router;