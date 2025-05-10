import express from 'express';
import { copyAnnotated, copyImage, copyPdfDownload, copySearch, getAllCopiesByPacking } from '../controllers/copyController.js';
import { userProtected } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/image', userProtected, copyImage); //- Get image for a specific page 
router.get('/pdf/:copyId', userProtected, copyPdfDownload); //- Download PDF with annotations
router.get('/search', userProtected, copySearch); //- Search and filter copies
router.get('/annotated', userProtected, copyAnnotated); // - Get all annotated copies
router.get('/subject', userProtected, getAllCopiesByPacking); // - Get All copies by packing ID
    
export default router;