import express from 'express';
import { activateEvaluator, adminLogin, adminLogout, assignCopies, assignCopyReevaluation, assignSubject, checkAdminAuth, deactivateEvaluator, getAssignedReevaluations, getCheckedCopies, getCopyById, getEvaluatedCopies, getEvaluatedCopiesForReevaluation, getEvaluationStats, getEvaluators, getEvaluatorsStatus, getSubjectAllocationStatus, getSubjectAssignments, registerEvaluator, unassignSubject } from '../controllers/adminController.js';
import { adminProtected } from '../middleware/authMiddleware.js';

const router = express.Router();

//** Tested and working Apis */


//** Open Routes **/
router.get('/check', checkAdminAuth);
router.post('/login', adminLogin);
router.post('/logout', adminLogout);



//** Protected Routes **/
router.use(adminProtected); 
router.get('/evaluators', getEvaluators);
router.post('/assign-subject', assignSubject);
router.get('/subject-allocation/:subjectCode/:examName', getSubjectAllocationStatus); //*new**- Get the subject allocation status
router.get('/get-evaluators-status', getEvaluatorsStatus); //reconsider its usage (maybe more descriptive data subject evaluator wise)
router.get('/subject-assignments', getSubjectAssignments);
router.post('/unassign-subject', unassignSubject);
router.post('/evaluators/activate', activateEvaluator);
router.post('/evaluators/deactivate', deactivateEvaluator);
router.get('/evaluated-copies', getEvaluatedCopiesForReevaluation);
router.get('/copy/:copyId', getCopyById);
router.post('/assign-reevaluation', assignCopyReevaluation);
router.get('/reevaluation-assignments', getAssignedReevaluations);
router.get('/stats/evaluation', getEvaluationStats);
router.get('/get-evaluated-copies', getEvaluatedCopies); //- Get all evaluated copies
//** ........End .............**/


// Evaluation statistics endpoint






router.post('/register-evaluator', registerEvaluator);

router.post('/evaluator/assign-copies', assignCopies);



router.get('/checked-copies/:packingId', getCheckedCopies);

export default router;