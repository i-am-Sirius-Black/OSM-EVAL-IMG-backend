import { checkAvailableCopies, submitReevaluationService } from '../services/evaluatorService.js';
import { 
  getEvaluatorSubjectsService, 
  getCurrentActiveBatchService, 
  assignNewBatchService,
  startCopyEvaluationService,
  completeCopyEvaluationService
} from '../services/evaluatorService.js';

/**
 * Get all subjects assigned to the evaluator
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getAssignedSubjects = async (req, res) => {
  try {
    
    const evaluatorId = req.params.evaluatorId || req.user.uid;
    console.log("evaluatorId from check assigned sub", evaluatorId);
    
    const subjects = await getEvaluatorSubjectsService(evaluatorId);
    
    return res.status(200).json({
      message: "Successfully retrieved assigned subjects",
      subjects,
      count: subjects.length,
      evaluatorId: evaluatorId,
    });
  } catch (error) {
    console.error("Error fetching assigned subjects:", error.message);
    
    return res.status(500).json({ 
      error: "Failed to fetch assigned subjects",
      message: error.message 
    });
  }
};




/**
 * Get evaluator's current active batch if any
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getCurrentBatch = async (req, res) => {
  try {
    const evaluatorId = req.user.uid;
    const {subjectCode } = req.params;
    const batch = await getCurrentActiveBatchService(evaluatorId, subjectCode);
    
    if (!batch) {
      return res.status(200).json({
        message: "No active batch found",
        hasBatch: false
      });
    }
    
    return res.status(200).json({
      message: "Successfully retrieved active batch",
      hasBatch: true,
      batch
    });
  } catch (error) {
    console.error("Error fetching active batch:", error.message);
    
    return res.status(500).json({ 
      error: "Failed to fetch active batch",
      message: error.message 
    });
  }
};

/**
 * Assign a new batch of copies to the evaluator
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const assignNewBatch = async (req, res) => {
  const { subjectCode, examName, batchSize } = req.body;
  const evaluatorId = req.user.uid;
  
  if (!subjectCode || !examName) {
    return res.status(400).json({ 
      error: "Invalid request. Please provide subjectCode and examName" 
    });
  }
  
  try {
    const batch = await assignNewBatchService(
      evaluatorId, 
      subjectCode, 
      examName, 
      batchSize || 10
    );
    
    return res.status(200).json({
      message: "Successfully assigned new batch of copies",
      batch
    });
  } catch (error) {
    console.error("Error assigning new batch:", error.message);
    
    return res.status(400).json({ 
      error: "Failed to assign new batch",
      message: error.message 
    });
  }
};

/**
 * Mark a copy as started for evaluation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const startCopyEvaluation = async (req, res) => {
  try {
    const evaluatorId = req.user.uid;
    const { copyBarcode } = req.body;
    
    if (!copyBarcode) {
      return res.status(400).json({
        error: "Missing required parameter: copyBarcode"
      });
    }
    
    const result = await startCopyEvaluationService(evaluatorId, copyBarcode);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error starting copy evaluation:", error.message);
    
    return res.status(400).json({ 
      error: "Failed to start copy evaluation",
      message: error.message 
    });
  }
};

/**
 * Mark a copy as completed after evaluation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const completeCopyEvaluation = async (req, res) => {
  try {
    const evaluatorId = req.user.uid;
    const { copyBarcode } = req.body;
    
    if (!copyBarcode) {
      return res.status(400).json({
        error: "Missing required parameter: copyBarcode"
      });
    }
    
    const result = await completeCopyEvaluationService(evaluatorId, copyBarcode);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error completing copy evaluation:", error.message);
    
    return res.status(400).json({ 
      error: "Failed to complete copy evaluation",
      message: error.message 
    });
  }
};



export const checkCopies = async (req, res) => {
  try {
    const { subjectCode, examName } = req.query;
    
    if (!subjectCode || !examName) {
      return res.status(400).json({
        error: "Missing required query parameters: subjectCode and examName"
      });
    }
    
    const result = await checkAvailableCopies(subjectCode, examName);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error checking copies:", error.message);
    
    return res.status(500).json({ 
      error: "Failed to check copies",
      message: error.message 
    });
  }
};



/**
 * Submit re-evaluation results
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const submitReevaluation = async (req, res) => {
  const { requestId, reevaluatedMarks, remarks } = req.body;
  const evaluatorId = req.user.uid; // Get from authenticated user

  // Validate request body
  if (!requestId || reevaluatedMarks === undefined) {
    return res.status(400).json({ 
      error: "Invalid request. Please provide requestId and reevaluatedMarks" 
    });
  }

  // Validate marks is a number
  if (isNaN(parseFloat(reevaluatedMarks))) {
    return res.status(400).json({ 
      error: "Marks must be a valid number" 
    });
  }

  try {
    const result = await submitReevaluationService(
      requestId, 
      evaluatorId, 
      parseFloat(reevaluatedMarks), 
      remarks || ""
    );
    
    console.log(`Re-evaluation completed successfully for request ID: ${requestId}`);
    
    return res.status(200).json({ 
      message: "Re-evaluation completed successfully", 
      result 
    });
  } catch (error) {
    console.error("Error submitting re-evaluation:", error.message);
    
    if (error.status) {
      return res.status(error.status).json({ 
        message: 'Error submitting re-evaluation', 
        error: error.message 
      });
    }
    return res.status(500).json({ 
      message: 'Error submitting re-evaluation', 
      error: 'Internal server error' 
    });
  }
};


