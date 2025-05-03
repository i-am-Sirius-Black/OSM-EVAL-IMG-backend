import { 
    saveEvaluationRecord, 
    getRejectedCopies, 
    rejectCopyRecord, 
    unrejectCopyRecord 
  } from '../services/evaluationService.js';
  
  /**
   * Save evaluation data
   */
  export const saveEvaluation = async (req, res) => {
    try {
      const evaluationData = {
        copyid: req.body.copyid,
        obt_mark: req.body.obt_mark,
        max_mark: req.body.max_mark,
        status: req.body.status,
        eval_time: req.body.eval_time,
        eval_id: req.body.eval_id,
        reject_reason: req.body.reject_reason,
        bag_id: req.body.bag_id || 'test',
      };
  
      console.log("Received request to save evaluation record:", evaluationData);
  
      const newEval = await saveEvaluationRecord(evaluationData);
  
      res.status(201).json({
        success: true,
        message: "Evaluation record saved successfully",
        data: newEval,
      });
    } catch (error) {
      console.error("Error saving evaluation record:", error.message);
      
      const statusCode = error.status || 500;
      res.status(statusCode).json({ 
        error: error.message || "Failed to save evaluation record" 
      });
    }
  }
  
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