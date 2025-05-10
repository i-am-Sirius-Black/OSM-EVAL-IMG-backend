import { COOKIE_MAX_AGE } from "../config/config.js";
import { adminLoginService, assignCopiesToEvaluator, getEvaluatorsService, getEvaluatorsStatusService } from "../services/adminService.js";



/**
 * Handle admin login request
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with login status and user data
 */
export const adminLogin = async (req, res) => {
    const { uid, pass } = req.body;
  
    // Validate request body
    if (!uid || !pass) {
      return res.status(400).json({ error: "User ID or Password missing" });
    }
  console.log(`Admin login attempt:, uid: ${uid}, pass: ${pass}`);
  
    try {
      // Call the service to authenticate admin
      const { token, userData } = await adminLoginService(uid, pass);
  
      // Set the token as an HTTP-only cookie
      res.cookie("authToken", token, {
        httpOnly: true, // Prevent access via JavaScript
        secure: process.env.NODE_ENV === "production", // Use HTTPS in production
        sameSite: "strict", // Prevent CSRF
        maxAge: COOKIE_MAX_AGE, // Cookie expiration time
      });
  
      console.log(`Admin login successful: ${userData.uid} (${userData.name})`);
      
      // Return success response with user data
      return res.status(200).json({ 
        message: "Admin login successful", 
        userData 
      });
    } catch (error) {
      // Log the error
      console.error("Admin login error:", error.message);
      
      // Return appropriate error response
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  };



  export const adminLogout = async (req, res) => {
    res.clearCookie("authToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    return res.status(200).json({ message: "Logged out successfully" });
  };
  



/**
 * Retrieves all evaluators
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with evaluators data
 */
export const getEvaluators = async (req, res) => {
    try {
      // Call the service to retrieve evaluators
      const evaluators = await getEvaluatorsService();
      
      // Return success response with evaluators data
      return res.status(200).json(evaluators);
    } catch (error) {
      // Log the error
      console.error("Error retrieving evaluators:", error.message);
      
      // Return appropriate error response
      if (error.status) {
        return res.status(error.status).json({ 
          message: 'Error retrieving evaluators', 
          error: error.message 
        });
      }
      return res.status(500).json({ 
        message: 'Error retrieving evaluators', 
        error: 'Internal server error' 
      });
    }
  };



  //Assign copies to evaluator
export const assignCopies = async (req, res) => {
  const { evaluatorId, copyIds } = req.body;
  
  // Get admin ID from authenticated user
  const assignedBy = req.user.uid;

  // Validate request body
  if (!evaluatorId || !copyIds || !Array.isArray(copyIds) || copyIds.length === 0) {
    return res.status(400).json({ error: "Invalid request. Please provide evaluatorId and an array of copyIds" });
  }

  try {
    // Call the service to assign copies to evaluator
    const result = await assignCopiesToEvaluator(evaluatorId, copyIds, assignedBy);
    
    console.log(`Copies assigned successfully: Evaluator ID: ${evaluatorId}, ${copyIds.length} copies, Assigned By: ${assignedBy}`);
    
    // Return success response with result
    return res.status(200).json({ 
      message: "Copies assigned successfully", 
      count: result.length,
      assignments: result 
    });
  } catch (error) {
    // Log the error
    console.error("Error assigning copies:", error.message);
    console.log("Assignment data:", { evaluatorId, copyIds, assignedBy });   
    
    // Return appropriate error response
    if (error.status) {
      return res.status(error.status).json({ 
        message: 'Error assigning copies', 
        error: error.message 
      });
    }
    return res.status(500).json({ 
      message: 'Error assigning copies', 
      error: 'Internal server error' 
    });
  }
}





/**
 * Get evaluation stats for all evaluators individually
 */
export const getEvaluatorsStatus = async (req, res) => {
  try {
    const evaluatorsStats = await getEvaluatorsStatusService();

    res.status(200).json({
      message: "Successfully retrieved evaluation statistics for all evaluators",
      evaluators: evaluatorsStats,
      count: evaluatorsStats.length
    });
  } catch (error) {
    console.error("Error fetching evaluation statistics:", error.message);
    res.status(500).json({ 
      error: "Failed to fetch evaluation statistics",
      message: error.message 
    });
  }
};