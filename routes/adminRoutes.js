import express from 'express';
import { activateEvaluator, adminLogin, adminLogout, assignCopies, assignCopyReevaluation, assignSubject, checkAdminAuth, deactivateEvaluator, getAssignedReevaluations, getCheckedCopies, getCopyById, getEvaluatedCopies, getEvaluatedCopiesForReevaluation, getEvaluationStats, getEvaluators, getEvaluatorsStatus, getSubjectAllocationStatus, getSubjectAssignments, registerEvaluator, unassignSubject,} from '../controllers/adminController.js';
import { adminProtected } from '../middleware/authMiddleware.js';
import { createExamPaperController, createFragmentation, createPaper, deletePaperController, getAllSubjects, getPaper, getPaperForFragmentationController, getPapers, getSubjectPapers, servePaperFile, upload, uploadQuestionPaper, deleteFragmentation, updateFragmentation, getPaperWithQuestionsForEdit  } from '../controllers/questionPaperController.js';
const router = express.Router();

//** Tested and working Apis */


//** Open Routes **/
router.get('/check', checkAdminAuth);
router.post('/login', adminLogin);
router.post('/logout', adminLogout);


router.get('/papers/:paperId', getPaper);
router.get('/papers/:paperId/file', servePaperFile);




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


// Subject and course data
router.get('/subjects', getAllSubjects);


//** Question paper management(new) */ 
// Upload paper routes
router.post('/upload-question-paper', upload.single('file'), uploadQuestionPaper);
router.post('/create-paper', createPaper);

// Fragmentation routes
router.get('/papers', getPapers);
router.get('/papers/:paperId', getPaperForFragmentationController);
router.post('/create-fragmentation', createFragmentation);



//** fragmentation management(new) */
router.get('/papers/:paperId/questions', getPaperWithQuestionsForEdit);
router.put('/papers/:paperId/fragmentation', updateFragmentation);
router.delete('/papers/:paperId/fragmentation', deleteFragmentation);




// Question paper management(old)
router.post('/upload-question-paper', upload.single('file'), uploadQuestionPaper);
router.post('/create-paper', createExamPaperController);
router.get('/papers/subject/:subjectId', getSubjectPapers);
router.delete('/papers/:paperId', deletePaperController);




// Evaluation statistics endpoint






router.post('/register-evaluator', registerEvaluator);

router.post('/evaluator/assign-copies', assignCopies);



router.get('/checked-copies/:packingId', getCheckedCopies);

export default router;