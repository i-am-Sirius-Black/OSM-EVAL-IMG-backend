import express from 'express';
import { activateEvaluator, adminLogin, adminLogout, assignCopies, assignCopyReevaluation, assignSubject, checkAdminAuth, deactivateEvaluator, getAssignedReevaluations, getCheckedCopies, getEvaluatedCopies, getEvaluators, getEvaluatorsStatus, getSubjectAllocationStatus, getSubjectAssignments, registerEvaluator, unassignSubject } from '../controllers/adminController.js';
import { adminProtected } from '../middleware/authMiddleware.js';

const router = express.Router();



//** Tested and working Apis */
router.get('/evaluators', adminProtected, getEvaluators);
router.post('/assign-subject', adminProtected, assignSubject);
router.get('/subject-allocation/:subjectCode/:examName', adminProtected, getSubjectAllocationStatus); //*new**- Get the subject allocation status
router.get('/get-evaluators-status', adminProtected, getEvaluatorsStatus); //reconsider its usage
router.get('/subject-assignments', adminProtected, getSubjectAssignments);
router.post('/unassign-subject', adminProtected, unassignSubject);
router.post('/evaluators/activate', adminProtected, activateEvaluator);
router.post('/evaluators/deactivate', adminProtected, deactivateEvaluator);
//** ........End .............**/






router.get('/check', checkAdminAuth);
router.post('/login', adminLogin);
router.post('/logout', adminLogout);

//**New Route for Evaluator Registration */
router.post('/register-evaluator', adminProtected, registerEvaluator);

//** Evaluator Management Routes */

router.post('/evaluator/assign-copies', adminProtected, assignCopies);

router.get('/get-evaluated-copies', adminProtected, getEvaluatedCopies); //- Get all evaluated copies

//**New Routes for Subject Assignment to Evaluators*/




//*New routes for reevaluation */
router.post('/assign-reevaluation', adminProtected, assignCopyReevaluation);
router.get('/reevaluation-assignments', adminProtected, getAssignedReevaluations);
router.get('/checked-copies/:packingId', adminProtected, getCheckedCopies);

export default router;