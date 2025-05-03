import { getExams, getSubjectsForExam } from '../services/examService.js';

/**
 * Get all exams
 */
export const getAllExams = async (req, res) => {
  try {
    const exams = await getExams();
    
    if (!exams || exams.length === 0) {
      return res.status(404).json({ message: "No exams found" });
    }
    
    res.status(200).json(exams);
  } catch (error) {
    console.error("Error fetching exams:", error.message);
    
    const statusCode = error.status || 500;
    res.status(statusCode).json({ 
      error: error.message || "Failed to fetch exams" 
    });
  }
}

/**
 * Get all subjects for a specific exam
 */
export const getAllSubjectsForExam = async (req, res) => {
  try {
    const { examId } = req.params;
    
    const subjects = await getSubjectsForExam(examId);
    
    if (!subjects || subjects.length === 0) {
      return res.status(404).json({ 
        message: `No subjects found for exam: ${examId}` 
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