// Add these imports at the top of your file
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createExamPaper, getExamPapersForSubject, getPaperWithQuestions, deletePaper, createPaperWithoutQuestions, getAllPapers, addFragmentationToPaper, getPaperForFragmentation, getPaperWithQuestionsService, updatePaperFragmentation, deletePaperFragmentation } from '../services/questionPaperService.js';
import { ExamPapers, SubjectData } from '../models/index.js';


/**
 * ✅ Configure Multer Storage for Uploaded PDFs
 * --------------------------------------------
 * We configure the destination where uploaded files will be saved.
 * For the filename, we use a temporary name first, and later rename it in the controller
 * because fields like `paperCode` and `subjectId` are not available during `filename()` execution.
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'papers');

    // ✅ Create the 'uploads/papers' directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    // ❗ Use a temporary name, since `req.body.paperCode` is not available yet
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `temp-${uniqueSuffix}${ext}`); // We'll rename this in the controller
  }
});

/**
 * ✅ Filter to Allow Only PDF Files
 */
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

/**
 * ✅ Export Multer Middleware with Config
 */
export const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * ✅ Controller: Handle PDF Upload and Rename File with Paper Metadata
 * --------------------------------------------------------------------
 * After the file is uploaded, we now have access to `req.body.paperCode` and `subjectId`,
 * so we rename the file to include this info for better file tracking.
 */
export const uploadQuestionPaper = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { paperCode, subjectId } = req.body;

    if (!paperCode || !subjectId) {
      return res.status(400).json({ message: 'Missing paperCode or subjectId' });
    }

    // Build new filename with metadata
    const ext = path.extname(req.file.originalname);
    const newFileName = `paper-${subjectId}-${paperCode}-${Date.now()}${ext}`;

    // Build full path
    const uploadDir = path.join(process.cwd(), 'uploads', 'papers');
    const newPath = path.join(uploadDir, newFileName);

    // ✅ Rename the file (from temp to meaningful name)
    fs.renameSync(req.file.path, newPath);

    // ✅ Send the new file path back to the client (for DB saving)
    return res.status(200).json({
      message: 'File uploaded successfully',
      filePath: newPath.replace(/\\/g, '/') // Normalize Windows paths
    });

  } catch (error) {
    console.error('Error uploading question paper:', error);
    return res.status(500).json({ message: 'Failed to upload file', error: error.message });
  }
};


/**
 * Create a new exam paper record with questions
 */
export const createExamPaperController = async (req, res) => {
  try {
    const {
      subjectId,
      paperCode,
      examDate,
      title,
      maxMarks,
      durationMinutes,
      filePath,
      questions
    } = req.body;

    // Validate required fields
    if (!subjectId || !paperCode || !examDate || !maxMarks || !questions) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const paperData = {
      subjectId,
      paperCode,
      examDate,
      title,
      maxMarks,
      durationMinutes,
      filePath
    };

    const examPaper = await createExamPaper(paperData, questions);

    return res.status(201).json({
      message: 'Exam paper created successfully',
      paperId: examPaper.paper_id
    });
  } catch (error) {
    console.error('Error creating exam paper:', error);
    return res.status(500).json({ message: 'Failed to create exam paper', error: error.message });
  }
};

/**
 * Get all subjects for dropdown
 */
export const getAllSubjects = async (req, res) => {
  try {
    const subjects = await SubjectData.findAll({
      attributes: ['subjectdata_id', 'SubjectID', 'Subject', 'Course'],
      order: [['Course', 'ASC'], ['Subject', 'ASC']]
    });
    
    return res.status(200).json(subjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return res.status(500).json({ message: 'Failed to fetch subjects', error: error.message });
  }
};

/**
 * Get papers for a subject
 */
export const getSubjectPapers = async (req, res) => {
  try {
    const { subjectId } = req.params;
    
    const papers = await getExamPapersForSubject(subjectId);
    
    return res.status(200).json({
      papers
    });
  } catch (error) {
    console.error('Error fetching papers:', error);
    return res.status(500).json({ message: 'Failed to fetch papers', error: error.message });
  }
};

/**
 * Get a paper with its questions
 */
export const getPaper = async (req, res) => {
  try {
    const { paperId } = req.params;
    const paper = await getPaperWithQuestions(paperId);

    // ❌ Don't send filePath in the JSON response
    const { filePath, ...filteredPaper } = paper;

    return res.status(200).json(filteredPaper);
  } catch (error) {
    console.error('Error fetching paper details:', error);
    const status = error.status || 500;
    return res.status(status).json({ message: error.message || 'Failed to fetch paper details' });
  }
};


/**
 * Serve a question paper PDF
 */
export const servePaperFile = async (req, res) => {
  try {
    const { paperId } = req.params;
    
    const paper = await getPaperWithQuestions(paperId);
    
    if (!paper.filePath || !fs.existsSync(paper.filePath)) {
      return res.status(404).json({ message: 'Paper file not found' });
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="question_paper_${paper.paperCode}.pdf"`);
    
    const fileStream = fs.createReadStream(paper.filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error serving paper file:', error);
    const status = error.status || 500;
    return res.status(status).json({ message: error.message || 'Failed to serve paper file' });
  }
};

/**
 * Delete a paper
 */
export const deletePaperController = async (req, res) => {
  try {
    const { paperId } = req.params;
    
    await deletePaper(paperId);
    
    return res.status(200).json({ message: 'Paper deleted successfully' });
  } catch (error) {
    console.error('Error deleting paper:', error);
    const status = error.status || 500;
    return res.status(status).json({ message: error.message || 'Failed to delete paper' });
  }
};



//** New controllers to manage fragmentation */


/**
 * Get paper with its questions
 */
export const getPaperWithQuestionsForEdit = async (req, res) => {
  try {
    const { paperId } = req.params;
    
    // Use service function
    const paper = await getPaperWithQuestionsService(paperId);
    
    return res.status(200).json(paper);
  } catch (error) {
    console.error('Error fetching paper with questions:', error);
    const status = error.status || 500;
    return res.status(status).json({ 
      message: error.message || 'Failed to fetch paper details', 
      error: error.message 
    });
  }
};

/**
 * Update paper fragmentation
 */
export const updateFragmentation = async (req, res) => {
  try {
    const { paperId } = req.params;
    const { questions } = req.body;

    // Validate required fields
    if (!paperId || !questions) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Use service function
    await updatePaperFragmentation(paperId, questions);
    
    return res.status(200).json({
      message: 'Fragmentation updated successfully',
      paperId
    });
  } catch (error) {
    console.error('Error updating fragmentation:', error);
    const status = error.status || 500;
    return res.status(status).json({ 
      message: error.message || 'Failed to update fragmentation', 
      error: error.message 
    });
  }
};

/**
 * Delete paper fragmentation
 */
export const deleteFragmentation = async (req, res) => {
  try {
    const { paperId } = req.params;

    // Use service function
    await deletePaperFragmentation(paperId);
    
    return res.status(200).json({
      message: 'Fragmentation deleted successfully',
      paperId
    });
  } catch (error) {
    console.error('Error deleting fragmentation:', error);
    const status = error.status || 500;
    return res.status(status).json({ 
      message: error.message || 'Failed to delete fragmentation', 
      error: error.message 
    });
  }
};










//? New APIs for separated Fragmentation and Question Paper uploads




/**
 * Create paper record without questions yet
 */
export const createPaper = async (req, res) => {
  try {
    const {
      subjectId,
      paperCode,
      title,
      maxMarks,
      filePath,
      fragmentation = false
    } = req.body;

    // Validate required fields
    if (!subjectId || !paperCode || !maxMarks) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if a paper already exists for this subject
    const existingPapers = await ExamPapers.findAll({
      where: { subject_id: subjectId }
    });

    if (existingPapers && existingPapers.length > 0) {
      return res.status(409).json({
        message: 'A paper already exists for this subject',
        existingPaper: existingPapers[0]
      });
    }

    const paperData = {
      subjectId,
      paperCode,
      title,
      maxMarks,
      filePath,
      fragmentation
    };

    // Use service function
    const examPaper = await createPaperWithoutQuestions(paperData);

    return res.status(201).json({
      message: 'Paper created successfully',
      paperId: examPaper.paper_id
    });
  } catch (error) {
    console.error('Error creating paper:', error);
    
    // Return appropriate status code from the error if available
    const statusCode = error.status || 500;
    return res.status(statusCode).json({ 
      message: error.message || 'Failed to create paper', 
      error: error.message 
    });
  }
};

/**
 * Get papers that don't have fragmentation yet
 */
export const getPapers = async (req, res) => {
  try {
    const unfragmented = req.query.unfragmented === 'true';
    
    // Use service function
    const formattedPapers = await getAllPapers(unfragmented);
    
    return res.status(200).json(formattedPapers);
  } catch (error) {
    console.error('Error fetching papers:', error);
    return res.status(500).json({ message: 'Failed to fetch papers', error: error.message });
  }
};




/**
 * Add questions to paper using enhanced questions table
 */
export const createFragmentation = async (req, res) => {
  try {
    const { paperId, questions } = req.body;

    // Validate required fields
    if (!paperId || !questions) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Use service function with the updated signature
    const result = await addFragmentationToPaper(paperId, questions);
    
    return res.status(201).json({
      message: 'Fragmentation created successfully',
      paperId,
      questionsCreated: result.questionsCreated
    });
  } catch (error) {
    console.error('Error creating fragmentation:', error);
    const status = error.status || 500;
    return res.status(status).json({ 
      message: error.message || 'Failed to create fragmentation', 
      error: error.message 
    });
  }
};


// /**
//  * Add questions to paper and update fragmentation flag
//  */
// export const createFragmentation = async (req, res) => {
//   try {
//     const { paperId, questions } = req.body;

//     // Validate required fields
//     if (!paperId || !questions) {
//       return res.status(400).json({ message: 'Missing required fields' });
//     }

//     // Use service function
//     await addFragmentationToPaper(paperId, questions);
    
//     return res.status(201).json({
//       message: 'Fragmentation created successfully',
//       paperId
//     });
//   } catch (error) {
//     console.error('Error creating fragmentation:', error);
//     const status = error.status || 500;
//     return res.status(status).json({ 
//       message: error.message || 'Failed to create fragmentation', 
//       error: error.message 
//     });
//   }
// };

/**
 * Get paper details for fragmentation
 */
export const getPaperForFragmentationController = async (req, res) => {
  try {
    const { paperId } = req.params;
    
    // Use service function
    const paper = await getPaperForFragmentation(paperId);
    
    return res.status(200).json(paper);
  } catch (error) {
    console.error('Error fetching paper for fragmentation:', error);
    const status = error.status || 500;
    return res.status(status).json({ 
      message: error.message || 'Failed to fetch paper details', 
      error: error.message 
    });
  }
};










