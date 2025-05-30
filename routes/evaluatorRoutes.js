import express from 'express';
import { assignNewBatch, checkAssignedReeval, checkCopies, completeCopyEvaluation, getAssignedSubjects, getCurrentBatch, startCopyEvaluation, submitReevaluation } from '../controllers/evaluatorController.js';
import { userProtected } from '../middleware/authMiddleware.js';

const router = express.Router();


// Apply authentication middleware to all routes
router.use(userProtected);


//** Tested and working Apis */

// Get all subjects assigned to the evaluator (admin usage)
router.get('/assigned-subjects/:evaluatorId', getAssignedSubjects);

// Get all subjects assigned to the evaluator (regular user usage)
router.get('/assigned-subjects', getAssignedSubjects);

// Assign a new batch of copies
router.post('/assign-batch', assignNewBatch);

// Get current active batch for a subject
router.get('/current-batch/:subjectCode', getCurrentBatch);

//** ........End .............**/













// Mark a copy as started for evaluation
router.post('/start-evaluation', startCopyEvaluation);

// Mark a copy as completed after evaluation
router.post('/complete-evaluation', completeCopyEvaluation);

// Check available copies for debugging
router.get('/check-copies', checkCopies);

// Submit reevaluated copy (that was assigned to you) 
router.post('/submit-reevaluation', submitReevaluation);

// Check if a evaluator has been assigned with Reeval Copy
router.get('/check-reeval-assigned', checkAssignedReeval)

export default router;