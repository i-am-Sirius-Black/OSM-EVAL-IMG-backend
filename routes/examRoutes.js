import express from 'express';
import { userProtected } from '../middleware/authMiddleware.js';
import { getAllCourses, getAllSubjectsForCourse } from '../controllers/examController.js';

const router = express.Router();
router.use(userProtected) //auth middleware

//** Tested and working Apis */
router.get('/', getAllCourses); // Get all courses
router.get('/:courseId/subjects', getAllSubjectsForCourse); // - Get all subjects for a course

//** ........End .............**/



export default router;