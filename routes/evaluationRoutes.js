import express from 'express';
import { userProtected } from '../middleware/authMiddleware.js';
import { getAllRejectedCopies, getCopiesToEvaluate, getEvaluationStats, getQuestionsByPaperId, rejectCopy, saveEvaluation, unrejectCopy } from '../controllers/evaluationController.js';

const router = express.Router();

router.post('/', userProtected, saveEvaluation); //* - Save evaluation record
router.get('/rejected', userProtected, getAllRejectedCopies); // - Get All rejected copies
router.post('/reject', userProtected, rejectCopy); // - Reject a copy
router.post('/unreject', userProtected, unrejectCopy); //  - Unreject a copy
router.get('/fetchAssignedCopies', userProtected, getCopiesToEvaluate); // - Get All copies by packing ID
router.get('/stats', userProtected, getEvaluationStats); // - Get All copies by evaluator ID

router.get('/questions/:paperId', userProtected, getQuestionsByPaperId); // - Get questions fragmentation by paper ID



export default router;