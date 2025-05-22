import express from 'express';
import { adminLogin, adminLogout, assignCopies, assignCopyReevaluation, assignSubject, checkAdminAuth, getAssignedReevaluations, getEvaluatedCopies, getEvaluators, getEvaluatorsStatus, getSubjectAssignments, unassignSubject } from '../controllers/adminController.js';
import { adminProtected } from '../middleware/authMiddleware.js';

const router = express.Router();


router.get('/check', checkAdminAuth);
router.post('/login', adminLogin);
router.post('/logout', adminLogout);
router.get('/evaluators', adminProtected, getEvaluators);
router.post('/evaluator/assign-copies', adminProtected, assignCopies);
router.get('/get-evaluators-status', adminProtected, getEvaluatorsStatus);
router.get('/get-evaluated-copies', adminProtected, getEvaluatedCopies); //- Get all evaluated copies

//**New Routes for Subject Assignment to Evaluators*/
router.post('/assign-subject', adminProtected, assignSubject);
router.get('/subject-assignments', adminProtected, getSubjectAssignments);
router.post('/unassign-subject', adminProtected, unassignSubject);
router.post('/assign-reevaluation', adminProtected, assignCopyReevaluation);
router.get('/reevaluation-assignments', adminProtected, getAssignedReevaluations);

export default router;