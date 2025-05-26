import {  
    getRejectedCopies, 
    rejectCopyRecord, 
    unrejectCopyRecord,
    getQuestionsService,
    getCopiesToEvaluateService,
    getEvaluationStatsService,
    saveEvaluationAndAnnotations,
  } from '../services/evaluationService.js';
  
  // /**updated v2
  //  * Save evaluation data (eval+annotations included)
  //  */
export const saveEvaluation = async (req, res) => {
  try {
    // Handles both normal and re-evaluation based on payload
    const result = await saveEvaluationAndAnnotations(req.body);
    res.status(201).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.error("Error saving evaluation:", error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to save evaluation"
    });
  }
};




  // /**
  //  * Save evaluation data
  //  */
  // export const saveEvaluation = async (req, res) => {
  //   try {
  //     const evaluationData = {
  //       copyid: req.body.copyid,
  //       obt_mark: req.body.obt_mark,
  //       max_mark: req.body.max_mark,
  //       status: req.body.status,
  //       eval_time: req.body.eval_time,
  //       eval_id: req.body.eval_id,
  //       reject_reason: req.body.reject_reason,
  //       bag_id: req.body.bag_id || 'test',
  //     };
  
  //     console.log("Received request to save evaluation record:", evaluationData);
  
  //     const newEval = await saveEvaluationRecord(evaluationData);
  
  //     res.status(201).json({
  //       success: true,
  //       message: "Evaluation record saved successfully",
  //       data: newEval,
  //     });
  //   } catch (error) {
  //     console.error("Error saving evaluation record:", error.message);
      
  //     const statusCode = error.status || 500;
  //     res.status(statusCode).json({ 
  //       error: error.message || "Failed to save evaluation record" 
  //     });
  //   }
  // }
  
  /**
   * Get all rejected copies
   */
  export const getAllRejectedCopies = async (req, res) => {
    try {
      const rejectedCopies = await getRejectedCopies();
      
      if (!rejectedCopies || rejectedCopies.length === 0) {
        return res.status(404).json({ message: "No rejected copies found" });
      }
  
      res.status(200).json(rejectedCopies);
    } catch (error) {
      console.error("Error fetching rejected copies:", error.message);
      
      const statusCode = error.status || 500;
      res.status(statusCode).json({ 
        error: error.message || "Failed to fetch rejected copies" 
      });
    }
  }
  
  /**
   * Reject a copy
   */
  export const rejectCopy = async (req, res) => {
    const rejectData = {
      copyId: req.body.copyId,
      reason: req.body.reason,
      userId: req.body.userId,
      bagId: req.body.bagId,
      copyStatus: req.body.copyStatus || "Rejected"
    };
  
    console.log("Received request to reject copy:", rejectData);
  
    try {
      const response = await rejectCopyRecord(rejectData);
  
      // Return success response
      return res.status(201).json({
        success: true,
        message: "Copy rejected successfully",
        data: response,
      });
    } catch (error) {
      console.error("Error rejecting copy:", error.message);
      
      const statusCode = error.status || 500;
      res.status(statusCode).json({
        error: error.message || "Failed to reject copy"
      });
    }
  }
  
  /**
   * Unreject a previously rejected copy
   */
  export const unrejectCopy = async (req, res) => {
    const { copyId } = req.body;
  
    console.log("Received request to unreject copy:", req.body);
  
    try {
      await unrejectCopyRecord(copyId);
  
      // Return success response
      return res.status(200).json({
        success: true,
        message: "Copy unrejected successfully",
      });
    } catch (error) {
      console.error("Error unrejecting copy:", error.message);
      
      const statusCode = error.status || 500;
      res.status(statusCode).json({ 
        error: error.message || "Failed to unreject copy" 
      });
    }
  }





  /**
 * Get questions by paper ID
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} Questions for the specified paper
 */
export const getQuestionsByPaperId = async (req, res) => {
  try {
    const { paperId } = req.params;
    
    // Convert paperId to number if it's a string
    const paperIdNum = parseInt(paperId, 10);
    
    if (isNaN(paperIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Paper ID format'
      });
    }
    
    const questions = await getQuestionsService(paperIdNum);
    
    if (!questions || questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No questions found for this paper ID'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: questions
    });
  } catch (error) {
    console.error('Controller error:', error);
    
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to fetch questions'
    });
  }
};




/**
 * Get copies to evaluate
 */
export const getCopiesToEvaluate = async (req, res) => {
  try {
    const { evaluatorId } = req.query;

    if (!evaluatorId) {
      return res.status(400).json({ error: "Evaluator ID is required" });
    }

    const copiesToEvaluate = await getCopiesToEvaluateService(evaluatorId);

    // Return empty array with 200 status if no copies found (better for client handling)
    if (!copiesToEvaluate || copiesToEvaluate.length === 0) {
      return res.status(200).json({ 
        message: "No copies found for evaluation",
        count: 0,
        copies: [] 
      });
    }

    res.status(200).json({
      message: "Successfully retrieved copies for evaluation",
      count: copiesToEvaluate.length,
      copies: copiesToEvaluate
    });
  } catch (error) {
    console.error("Error fetching copies to evaluate:", error.message);
    res.status(500).json({ error: "Failed to fetch copies for evaluation" });
  }
}






/**
 * Get evaluation statistics for an evaluator
 */
export const getEvaluationStats = async (req, res) => {
  try {
    const { evaluatorId } = req.query;

    if (!evaluatorId) {
      return res.status(400).json({ error: "Evaluator ID is required" });
    }

    const stats = await getEvaluationStatsService(evaluatorId);

    res.status(200).json({
      message: "Successfully retrieved evaluation statistics",
      stats
    });
  } catch (error) {
    console.error("Error fetching evaluation statistics:", error.message);
    res.status(500).json({ error: "Failed to fetch evaluation statistics" });
  }
}