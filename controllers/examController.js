import { getCourses, getSubjectsForCourse,  } from '../services/examService.js';

/**
 * Get all courses
 */
export const getAllCourses = async (req, res) => {
  try {
    const courses = await getCourses();

    if (!courses || courses.length === 0) {
      return res.status(404).json({ message: "No courses found" });
    }

    res.status(200).json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error.message);

    const statusCode = error.status || 500;
    res.status(statusCode).json({
      error: error.message || "Failed to fetch courses"
    });
  }
}

/**
 * Get all subjects for a specific course
 */
export const getAllSubjectsForCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const subjects = await getSubjectsForCourse(courseId);
    if (!subjects || subjects.length === 0) {
      return res.status(404).json({ 
        message: `No subjects found for course: ${courseId}` 
      });
    }

    res.status(200).json(subjects);
  } catch (error) {
    console.error("Error fetching subjects:", error.message);

    const statusCode = error.status || 500;
    res.status(statusCode).json({ 
      error: error.message || "Failed to fetch subjects" 
    });
  }
}