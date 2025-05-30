import { sequelize } from '../config/db.js';
import { SubjectData } from '../models/index.js';

/**
 * Get all distinct courses
 * @returns {Promise<Array>} List of course objects with name and ID
 */
export const getCourses = async () => {
  const courses = await SubjectData.findAll({
    attributes: [
      [sequelize.fn("DISTINCT", sequelize.col("Course")), "courseName"],
      [sequelize.col("Course"), "courseId"],
    ],
    raw: true,
  });

  return courses.map((course) => ({
    courseName: course.courseName,
    courseId: course.courseId,
  }));
};

/**
 * Get all subjects for a specific course
 * @param {string} courseId - The ID of the course
 * @returns {Promise<Array>} List of subject objects with name and ID
 */
export const getSubjectsForCourse = async (courseId) => {
  if (!courseId) {
    const error = new Error("Course ID is required");
    error.status = 400;
    throw error;
  }

  const subjects = await SubjectData.findAll({
    where: { Course: courseId },
    attributes: [
      [sequelize.fn("DISTINCT", sequelize.col("Subject")), "subject"],
      [sequelize.col("SubjectID"), "subjectId"],
      [sequelize.col("packid"), "packId"],
    ],
    raw: true,
  });

  return subjects.map((subject) => ({
    subject: subject.subject,
    subjectId: subject.subjectId,
    packId: subject.packId,
  }));
};