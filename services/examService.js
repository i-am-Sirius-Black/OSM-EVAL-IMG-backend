import { CenterPackingSlip } from '../models/index.js';
import { sequelize } from '../config/db.js';

/**
 * Get all distinct exams
 * @returns {Array} List of course objects with name and ID
 * @returns {Promise<Array>} List of course objects with name and ID
 */
export const getCourses = async () => {
  const courses = await CenterPackingSlip.findAll({
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
 * @returns {Promise<Array>} List of subject objects with name, ID, and packing ID
 */
export const getSubjectsForCourse = async (courseId) => {
  if (!courseId) {
    const error = new Error("Course ID is required");
    error.status = 400;
    throw error;
  }

  const subjects = await CenterPackingSlip.findAll({
    where: { Course: courseId },
    attributes: [
      [sequelize.fn("DISTINCT", sequelize.col("Subject")), "subject"],
      [sequelize.col("SubjectID"), "subjectId"],
      [sequelize.col("PackingID"), "packingId"],
    ],
    raw: true,
  });

  return subjects.map((subject) => ({
    subject: subject.subject,
    subjectId: subject.subjectId,
    packingId: subject.packingId,
  }));
};