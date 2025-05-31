import express from 'express';
import { userProtected } from '../middleware/authMiddleware.js';
import { getAllRejectedCopies, getCopiesToEvaluate, getEvaluationStats, getQuestionsByPaperId, rejectCopy, saveEvaluation, unrejectCopy } from '../controllers/evaluationController.js';

const router = express.Router();
router.use(userProtected) //auth middleware


//** Tested and working Apis */
router.get('/questions/:paperId', getQuestionsByPaperId); // - Get questions fragmentation by paper ID
router.post('/save', saveEvaluation); //* - Save evaluation (eval+annotation)
router.get('/rejected', getAllRejectedCopies); // - Get All rejected copies
router.post('/reject', rejectCopy); // - Reject a copy
router.post('/unreject', unrejectCopy); //  - Unreject a copy
//** ........End .............**/


// router.post('/', userProtected, saveEvaluation); //* - Save evaluation record




router.get('/fetchAssignedCopies', getCopiesToEvaluate); // - Get All copies by evaluator ID
router.get('/stats', getEvaluationStats); // - Get All copies by evaluator ID




export default router;