import express from 'express';
import { userProtected } from '../middleware/authMiddleware.js';
import { getAllExams, getAllSubjectsForExam } from '../controllers/examController.js';

const router = express.Router();

router.get('/', userProtected, getAllExams); // Get all exams
router.get('/:examId/subjects', userProtected, getAllSubjectsForExam); // - Get all subjects for an exam

export default router;