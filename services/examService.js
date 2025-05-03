import { CenterPackingSlip } from '../models/index.js';
import { sequelize } from '../config/db.js';

/**
 * Get all distinct exams
 * @returns {Array} List of exam objects with name and ID
 */
export const getExams = async () => {
  const exams = await CenterPackingSlip.findAll({
    attributes: [
      [sequelize.fn("DISTINCT", sequelize.col("Course")), "examName"],
      [sequelize.col("Course"), "examId"],
    ],
    raw: true,
  });

  return exams.map((exam) => ({
    examName: exam.examName,
    examId: exam.examId,
  }));
};

/**
 * Get all subjects for a specific exam
 * @param {string} examId - The ID of the exam
 * @returns {Array} List of subject objects with name, ID, and packing ID
 */
export const getSubjectsForExam = async (examId) => {
  if (!examId) {
    const error = new Error("Exam ID is required");
    error.status = 400;
    throw error;
  }

  const subjects = await CenterPackingSlip.findAll({
    where: { Course: examId },
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