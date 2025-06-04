import fs from 'fs';
import path from 'path';
import { sequelize } from '../config/db.js';
import { ExamPapers, Questions, SubjectData } from '../models/index.js';
import { log } from 'console';




export const createExamPaper = async (paperData, questions) => {
  let transaction;
  
  try {
    transaction = await sequelize.transaction();
    
    const {
      subjectId,
      paperCode,
      title,
      maxMarks,
      filePath
    } = paperData;

    // Create the exam paper record
    const examPaper = await ExamPapers.create({
      subject_id: subjectId,
      paper_code: paperCode,
      title,
      max_marks: maxMarks,
      file_path: filePath
    }, { transaction });

    // Process all questions directly
    const questionsToCreate = questions.map(q => ({
      paper_id: examPaper.paper_id,
      q_no: q.questionNumber,
      max_mark: q.maxMarks
    }));

    await Questions.bulkCreate(questionsToCreate, { transaction });

    await transaction.commit();
    return examPaper;
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    throw error;
  }
};


// /**
//  * Create a new exam paper with questions
//  */
// export const createExamPaper = async (paperData, questions) => {

//   console.log('Creating exam paper with data:', paperData);

//   let transaction;
  
//   try {
//     // Properly initialize the transaction
//     transaction = await sequelize.transaction();
    
//     const {
//       subjectId,
//       paperCode,
//       examDate,
//       title,
//       maxMarks,
//       durationMinutes,
//       filePath,
//       hasChoiceBasedQuestions
//     } = paperData;

//     // Create the exam paper record
//     const examPaper = await ExamPapers.create({
//       subject_id: subjectId,
//       paper_code: paperCode,
//       exam_date: examDate,
//       title,
//       max_marks: maxMarks,
//       duration_minutes: durationMinutes,
//       file_path: filePath,
//       has_choice_based_questions: hasChoiceBasedQuestions || false
//     }, { transaction });

//     // Separate main questions and sub-questions
//     const mainQuestions = [];
//     const subQuestions = [];

//     questions.forEach(q => {
//       if (!q.isSubQuestion) {
//         mainQuestions.push({
//           paper_id: examPaper.paper_id,
//           question_number: q.questionNumber,
//           max_marks: q.maxMarks,
//           is_sub_question: false,
//           is_optional: q.isOptional || false,
//           is_choice_based: q.isChoiceBased || false,
//           choice_count: q.choiceCount || null,
//           total_choices: q.totalChoices || null,
//           parent_id: null
//         });
//       } else {
//         subQuestions.push({
//           temp_parent: q.parentId, // Temporary reference to parent question number
//           question_number: q.questionNumber,
//           max_marks: q.maxMarks,
//           is_sub_question: true,
//           is_optional: q.isOptional || false,
//           paper_id: examPaper.paper_id
//         });
//       }
//     });

//     // Insert main questions first
//     const createdMainQuestions = await Questions.bulkCreate(mainQuestions, { transaction });
    
//     // Create a map of question numbers to their IDs
//     const questionMap = {};
//     createdMainQuestions.forEach(q => {
//       questionMap[q.question_number] = q.question_id;
//     });

//     // Process sub-questions with the correct parent IDs
//     if (subQuestions.length > 0) {
//       const processedSubQuestions = subQuestions.map(sq => ({
//         paper_id: sq.paper_id,
//         parent_id: questionMap[sq.temp_parent], // Replace with actual parent ID
//         question_number: sq.question_number,
//         max_marks: sq.max_marks,
//         is_sub_question: true,
//         is_optional: sq.isOptional || false
//       }));

//       await Questions.bulkCreate(processedSubQuestions, { transaction });
//     }

//     // Make sure to await the commit
//     await transaction.commit();
//     return examPaper;
//   } catch (error) {
//     // Only try to rollback if transaction exists and is active
//     if (transaction) {
//       try {
//         await transaction.rollback();
//       } catch (rollbackError) {
//         console.error('Error rolling back transaction:', rollbackError);
//         // Don't rethrow rollback errors, just log them
//       }
//     }
    
//     // Rethrow the original error
//     throw error;
//   }
// };

/**
 * Get all exam papers for a subject
 */
export const getExamPapersForSubject = async (subjectId) => {
  const papers = await ExamPapers.findAll({
    where: { subject_id: subjectId },
    include: [
      {
        model: SubjectData,
        as: 'subject',
        attributes: ['Subject', 'Course']
      }
    ],
    order: [['exam_date', 'DESC']]
  });

  return papers.map(paper => ({
    paperId: paper.paper_id,
    paperCode: paper.paper_code,
    examDate: paper.exam_date,
    title: paper.title || `${paper.subject?.Subject} Exam Paper`,
    maxMarks: paper.max_marks,
    durationMinutes: paper.duration_minutes,
    filePath: paper.file_path,
    subject: paper.subject?.Subject,
    course: paper.subject?.Course
  }));
};

/**
 * Get paper details with questions (keeping structure but removing subject data)
 */
export const getPaperWithQuestions = async (paperId) => {
  const paper = await ExamPapers.findByPk(paperId);

  if (!paper) {
    const error = new Error('Paper not found');
    error.status = 404;
    throw error;
  }

  // Get all questions for this paper
  const questions = await Questions.findAll({
    where: { paper_id: paperId },
    order: [['q_no', 'ASC']]
  });

  // Format questions
  const formattedQuestions = questions.map(q => ({
    sno: q.sno,
    qNo: q.q_no,
    maxMark: q.max_mark
  }));

  return {
    paperId: paper.paper_id,
    paperCode: paper.paper_code,
    examDate: paper.exam_date,
    title: paper.title,
    maxMarks: paper.max_marks,
    durationMinutes: paper.duration_minutes,
    filePath: paper.file_path,
    questions: formattedQuestions
  };
};

/**
 * Delete a paper and its questions
 */
export const deletePaper = async (paperId) => {
  let transaction;
  
  try {
    // Initialize the transaction
    transaction = await sequelize.transaction();
    
    // Get paper details first to retrieve file path
    const paper = await ExamPapers.findByPk(paperId);
    
    if (!paper) {
      const error = new Error('Paper not found');
      error.status = 404;
      throw error;
    }
    
    // Delete all questions first
    await Questions.destroy({
      where: { paper_id: paperId },
      transaction
    });
    
    // Delete paper record
    await ExamPapers.destroy({
      where: { paper_id: paperId },
      transaction
    });
    
    // Make sure to await the commit
    await transaction.commit();
    
    // Delete the file if it exists - do this after transaction is committed
    if (paper.file_path && fs.existsSync(paper.file_path)) {
      fs.unlinkSync(paper.file_path);
    }
    
    return { message: 'Paper deleted successfully' };
  } catch (error) {
    // Only try to rollback if transaction exists
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError);
      }
    }
    
    throw error;
  }
};








//?New Service as per separate fragmentation tabs

/**
 * Create a paper without questions (for separate fragmentation)
 */
export const createPaperWithoutQuestions = async (paperData) => {
  try {
    const examPaper = await ExamPapers.create({
      subject_id: paperData.subjectId,
      paper_code: paperData.paperCode,
      title: paperData.title,
      max_marks: paperData.maxMarks,
      file_path: paperData.filePath,
      fragmentation: paperData.fragmentation || false
    });
    
    return examPaper;
  } catch (error) {
    console.error('Error creating paper in service:', error);
    throw error;
  }
};

/**
 * Get all papers with optional filtering for unfragmented papers
 */
export const getAllPapers = async (filterUnfragmented = false) => {
  try {
    let whereClause = {};
    if (filterUnfragmented) {
      whereClause.fragmentation = false;
    }
    
    const papers = await ExamPapers.findAll({
      where: whereClause,
      include: [
        {
          model: SubjectData,
          as: 'subject',
          attributes: ['Subject']
        }
      ],
      order: [['created_at', 'DESC']]
    });
    
    return papers.map(paper => ({
      paperId: paper.paper_id,
      paperCode: paper.paper_code,
      subject: paper.subject?.Subject || 'Unknown',
      maxMarks: paper.max_marks,
      hasFragmentation: paper.fragmentation
    }));
  } catch (error) {
    console.error('Error getting papers in service:', error);
    throw error;
  }
};

/**
 * Add question structure to paper and update fragmentation flag
 */
export const addFragmentationToPaper = async (paperId, questions) => {
  let transaction;
  
  try {
    transaction = await sequelize.transaction();
    
    // Get the paper to verify it exists
    const paper = await ExamPapers.findByPk(paperId);
    if (!paper) {
      const error = new Error('Paper not found');
      error.status = 404;
      throw error;
    }
    
    // Create question records
    const questionsToCreate = questions.map(q => ({
      paper_id: paperId,
      q_no: q.questionNumber,
      max_mark: q.maxMarks
    }));

    await Questions.bulkCreate(questionsToCreate, { transaction });
    
    // Update fragmentation flag
    await paper.update({ fragmentation: true }, { transaction });

    await transaction.commit();
    
    return paper;
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error('Error adding fragmentation in service:', error);
    throw error;
  }
};

/**
 * Get paper details by ID for fragmentation (simpler version for UI display)
 */
export const getPaperForFragmentation = async (paperId) => {
  try {
    const paper = await ExamPapers.findByPk(paperId, {
      include: [
        {
          model: SubjectData,
          as: 'subject',
          attributes: ['subject']
        }
      ]
    });

    if (!paper) {
      const error = new Error('Paper not found');
      error.status = 404;
      throw error;
    }

    return {
      paperId: paper.paper_id,
      paperCode: paper.paper_code,
      subject: paper.subject?.subject || 'Unknown',
      maxMarks: paper.max_marks,
      title: paper.title,
      filePath: paper.file_path,
      hasFragmentation: paper.fragmentation
    };
  } catch (error) {
    console.error('Error getting paper for fragmentation:', error);
    throw error;
  }
};



//**Fragmentation management service methods */

/**
 * Get paper with its questions
 */
export const getPaperWithQuestionsService = async (paperId) => {
  try {
    const paper = await ExamPapers.findByPk(paperId, {
      include: [
        {
          model: SubjectData,
          as: 'subject',
          attributes: ['subject']
        },
        {
          model: Questions,
          as: 'questions',
          attributes: ['question_id', 'q_no', 'max_mark'],
        }
      ]
    });

    if (!paper) {
      const error = new Error('Paper not found');
      error.status = 404;
      throw error;
    }

    // Format the response
    return {
      paperId: paper.paper_id,
      paperCode: paper.paper_code,
      subject: paper.subject?.subject || 'Unknown',
      maxMarks: paper.max_marks,
      title: paper.title,
      filePath: paper.file_path,
      hasFragmentation: paper.fragmentation,
      questions: paper.questions.map(q => ({
        questionId: q.question_id,
        questionNumber: q.q_no,
        maxMarks: q.max_mark
      }))
    };
  } catch (error) {
    console.error('Error getting paper with questions:', error);
    throw error;
  }
};

/**
 * Update paper fragmentation
 */
export const updatePaperFragmentation = async (paperId, questions) => {
  let transaction;
  
  try {
    transaction = await sequelize.transaction();
    
    // Get the paper to verify it exists
    const paper = await ExamPapers.findByPk(paperId);
    if (!paper) {
      const error = new Error('Paper not found');
      error.status = 404;
      throw error;
    }
    
    // Delete existing questions
    await Questions.destroy({
      where: { paper_id: paperId },
      transaction
    });
    
    // Create new question records
    const questionsToCreate = questions.map(q => ({
      paper_id: paperId,
      q_no: q.questionNumber,
      max_mark: q.maxMarks
    }));

    await Questions.bulkCreate(questionsToCreate, { transaction });
    
    await transaction.commit();
    
    return paper;
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error('Error updating fragmentation:', error);
    throw error;
  }
};

/**
 * Delete paper fragmentation
 */
export const deletePaperFragmentation = async (paperId) => {
  let transaction;
  
  try {
    transaction = await sequelize.transaction();
    
    // Get the paper to verify it exists
    const paper = await ExamPapers.findByPk(paperId);
    if (!paper) {
      const error = new Error('Paper not found');
      error.status = 404;
      throw error;
    }
    
    // Delete existing questions
    await Questions.destroy({
      where: { paper_id: paperId },
      transaction
    });
    
    // Update fragmentation flag to false
    await paper.update({ fragmentation: false }, { transaction });

    await transaction.commit();
    
    return paper;
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error('Error deleting fragmentation:', error);
    throw error;
  }
};

