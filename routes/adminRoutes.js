import express from 'express';
import { activateEvaluator, adminLogin, adminLogout, assignCopies, assignCopyReevaluation, assignSubject, checkAdminAuth, deactivateEvaluator, getAssignedReevaluations, getCheckedCopies, getEvaluatedCopies, getEvaluators, getEvaluatorsStatus, getSubjectAssignments, registerEvaluator, unassignSubject } from '../controllers/adminController.js';
import { adminProtected } from '../middleware/authMiddleware.js';

const router = express.Router();


router.get('/check', checkAdminAuth);
router.post('/login', adminLogin);
router.post('/logout', adminLogout);
router.get('/evaluators', adminProtected, getEvaluators);
router.post('/evaluators/activate', adminProtected, activateEvaluator);
router.post('/evaluators/deactivate', adminProtected, deactivateEvaluator);

router.post('/evaluator/assign-copies', adminProtected, assignCopies);
router.get('/get-evaluators-status', adminProtected, getEvaluatorsStatus);
router.get('/get-evaluated-copies', adminProtected, getEvaluatedCopies); //- Get all evaluated copies

//**New Routes for Subject Assignment to Evaluators*/
router.post('/assign-subject', adminProtected, assignSubject);
router.get('/subject-assignments', adminProtected, getSubjectAssignments);
router.post('/unassign-subject', adminProtected, unassignSubject);

router.post('/register-evaluator', adminProtected, registerEvaluator);

//*New routes for reevaluation */
router.post('/assign-reevaluation', adminProtected, assignCopyReevaluation);
router.get('/reevaluation-assignments', adminProtected, getAssignedReevaluations);
router.get('/checked-copies/:packingId', adminProtected, getCheckedCopies);

export default router;