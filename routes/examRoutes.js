import express from 'express';
import { userProtected } from '../middleware/authMiddleware.js';
import { getAllCourses, getAllSubjectsForCourse } from '../controllers/examController.js';

const router = express.Router();

router.get('/', userProtected, getAllCourses); // Get all courses
router.get('/:courseId/subjects', userProtected, getAllSubjectsForCourse); // - Get all subjects for a course

export default router;