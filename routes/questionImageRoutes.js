import express from 'express';
import { 
  batchUploadQuestionImages,
  streamQuestionImage,
  removeQuestionImage, 
  getQuestionImagesForPaper,
  bulkDeleteQuestionImages
} from '../controllers/questionImageController.js';

const router = express.Router();

// Batch image upload
router.post('/batch-upload', batchUploadQuestionImages);

// Stream image from database
router.get('/stream/:paperId/:questionNumber', streamQuestionImage);

// Remove question image
router.delete('/:paperId/:questionNumber', removeQuestionImage);

// Get all images metadata for a paper
router.get('/paper/:paperId', getQuestionImagesForPaper);

// Bulk delete images
router.delete('/bulk/:paperId', bulkDeleteQuestionImages);

export default router;






// import express from 'express';
// import { 
//   removeQuestionImage, 
//   getQuestionImages, 
//   getQuestionImagesForPaper,
//   batchUploadQuestionImages
// } from '../controllers/questionImageController.js';

// const router = express.Router();

// // // Single image upload (existing)
// // router.post('/upload', uploadQuestionImage);

// // Batch image upload (new)
// router.post('/batch-upload', batchUploadQuestionImages);

// // Remove question image (admin only)
// router.delete('/:paperId/:questionNumber', removeQuestionImage);

// // Get all images for a paper (both admin and user)
// router.get('/paper/:paperId', getQuestionImagesForPaper);

// // Legacy route (can keep for backward compatibility)
// router.get('/:paperId', getQuestionImages);

// export default router;