import { COOKIE_MAX_AGE, JWT_SECRET } from "../config/config.js";
import { activateEvaluatorService, adminLoginService, assignCopiesToEvaluator, assignCopyReevaluationService, assignSubjectToEvaluator, deactivateEvaluatorService, EvaluatedCopiesService, getAssignedReevaluationsService, getCheckedCopiesService, getCopyByIdService, getEvaluatedCopiesForReevaluationService, getEvaluationStatsService, getEvaluatorsService, getEvaluatorsStatusService, getSubjectAllocationStatusService, getSubjectAssignmentsService, registerEvaluatorService, unassignSubjectFromEvaluator } from "../services/adminService.js";
import jwt from "jsonwebtoken";
import { deletePaperFragmentation, getPaperWithQuestionsService, updatePaperFragmentation } from "../services/questionPaperService.js";


export const checkAdminAuth = (req, res) => {
  const token = req.cookies.adminAuthToken;
  console.log("Checking admin auth, token exists:", !!token);
  
  if (!token) {
    return res.status(401).json({ error: "Not authenticated admin" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.status(200).json({ user: decoded });
  } catch (err) {
    console.error("Token verification failed:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}



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
      res.cookie("adminAuthToken", token, {
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
    res.clearCookie("adminAuthToken", {
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


/**
 * Activate an evaluator account
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const activateEvaluator = async (req, res) => {
  const { uid } = req.body;
  
  // Validate request
  if (!uid) {
    return res.status(400).json({
      success: false,
      error: "Evaluator UID is required"
    });
  }
  
  try {
    // Ensure request is from admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: "Not authorized to activate evaluators"
      });
    }
    
    const result = await activateEvaluatorService(uid);
    
    return res.status(200).json({
      success: true,
      message: result.message,
      evaluator: result.evaluator
    });
  } catch (error) {
    console.error("Error activating evaluator:", error);
    
    return res.status(error.status || 500).json({
      success: false,
      message: "Failed to activate evaluator",
      error: error.message
    });
  }
};

/**
 * Deactivate an evaluator account
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const deactivateEvaluator = async (req, res) => {
  const { uid } = req.body;
  
  // Validate request
  if (!uid) {
    return res.status(400).json({
      success: false,
      error: "Evaluator UID is required"
    });
  }
  
  try {
    // Ensure request is from admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: "Not authorized to deactivate evaluators"
      });
    }
    
    const result = await deactivateEvaluatorService(uid);
    
    return res.status(200).json({
      success: true,
      message: result.message,
      evaluator: result.evaluator
    });
  } catch (error) {
    console.error("Error deactivating evaluator:", error);
    
    return res.status(error.status || 500).json({
      success: false,
      message: "Failed to deactivate evaluator",
      error: error.message
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








/** v3
 * Get all evaluated/checked copies
 * @param {Object} req - Express request object with optional query params
 * @param {Object} res - Express response object
 */
export const getEvaluatedCopies = async (req, res) => {
  try {
    // Extract filter parameters from query string
    const { course, subject, evaluatorId } = req.query;
    
    // Call service with filters
    const result = await EvaluatedCopiesService({ 
      course, 
      subject, 
      evaluatorId 
    });
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in getEvaluatedCopies controller:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve evaluated copies',
      message: error.message 
    });
  }
};


// /**v2
//  * Get evaluated copies with filtering
//  */
// export const getEvaluatedCopies = async (req, res) => {
//   try {
//     // Extract filter parameters from query
//     const { course, subject, session, evaluatorId } = req.query;
//     const filters = { course, subject, session, evaluatorId };
    
//     // Call service with filters
//     const evaluatedCopies = await EvaluatedCopiesService(filters);

//     if (!evaluatedCopies || evaluatedCopies.length === 0) {
//       return res.status(200).json({
//         message: "No evaluated copies found",
//         count: 0,
//         copies: []
//       });
//     }

//     // Get unique filter options for dropdowns
//     const courses = [...new Set(evaluatedCopies.map(copy => copy.course).filter(Boolean))];
//     const subjects = [...new Set(evaluatedCopies.map(copy => copy.subject).filter(Boolean))];
//     const sessions = [...new Set(evaluatedCopies.map(copy => {
//       if (copy.examDate) {
//         // Extract year from examDate
//         const date = new Date(copy.examDate);
//         return date.getFullYear();
//       }
//       return null;
//     }).filter(Boolean))];

//     res.status(200).json({
//       message: "Successfully retrieved evaluated copies",
//       count: evaluatedCopies.length,
//       copies: evaluatedCopies,
//       filters: {
//         courses,
//         subjects,
//         sessions
//       }
//     });
//   } catch (error) {
//     console.error("Error fetching evaluated copies:", error.message);
//     res.status(500).json({ 
//       error: "Failed to fetch evaluated copies",
//       message: error.message
//     });
//   }
// }


/**
 * Assign a subject to an evaluator
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const assignSubject = async (req, res) => {
  const { evaluatorId, subjectCode, examName } = req.body;
  
  // Get admin ID from authenticated user
  const assignedBy = req.user.uid;

  // Validate request body
    if (!evaluatorId || !subjectCode ) {
      return res.status(400).json({ 
      error: "Invalid request. Please provide evaluatorId, subjectCode, examName" 
    });
  }

  try {
    const result = await assignSubjectToEvaluator(evaluatorId, subjectCode, examName, assignedBy);
    
    console.log(`Subject assigned successfully: Evaluator ID: ${evaluatorId}, Subject: ${subjectCode}`);
    
    return res.status(200).json({ 
      message: "Subject assigned successfully", 
      assignment: result 
    });
  } catch (error) {
    console.error("Error assigning subject:", error.message);
    
    if (error.status) {
      return res.status(error.status).json({ 
        message: 'Error assigning subject', 
        error: error.message 
      });
    }
    return res.status(500).json({ 
      message: 'Error assigning subject', 
      error: 'Internal server error' 
    });
  }
};


/**
 * Get allocation status for a specific subject
 * @route GET /api/admin/subject-allocation/:subjectCode/:examName
 * @param {Object} req - Request object with subject code and exam name params
 * @param {Object} res - Response object
 * @returns {Object} Subject allocation statistics
 */
export const getSubjectAllocationStatus = async (req, res) => {
  try {
    const { subjectCode, examName } = req.params;
    
    if (!subjectCode || !examName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Subject code and exam name are required' 
      });
    }
    
    const allocationStatus = await getSubjectAllocationStatusService(subjectCode, examName);
    
    return res.status(200).json({
      success: true,
      data: allocationStatus,
      message: `Successfully retrieved allocation status for subject ${subjectCode} in exam ${examName}`
    });
  } catch (error) {
    console.error('Error in getSubjectAllocationStatus controller:', error);
    
    // Determine appropriate status code based on error
    const statusCode = error.status || 500;
    
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to retrieve subject allocation status',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};



/**
 * Get all subject assignments
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getSubjectAssignments = async (req, res) => {
  try {
    const assignments = await getSubjectAssignmentsService();
    
    return res.status(200).json({
      message: "Successfully retrieved subject assignments",
      assignments,
      count: assignments.length
    });
  } catch (error) {
    console.error("Error fetching subject assignments:", error.message);
    
    return res.status(500).json({ 
      error: "Failed to fetch subject assignments",
      message: error.message 
    });
  }
};



/**
 * Unassign a subject from an evaluator
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const unassignSubject = async (req, res) => {
  const { evaluatorId, subjectCode } = req.body;

  // Validate request body
  if (!evaluatorId || !subjectCode) {
    return res.status(400).json({
      error: "Invalid request. Please provide evaluatorId and subjectCode"
    });
  }

  try {
    const result = await unassignSubjectFromEvaluator(evaluatorId, subjectCode);
    
    console.log(`Subject unassigned successfully: Evaluator ID: ${evaluatorId}, Subject: ${subjectCode}`);
    
    return res.status(200).json({
      message: "Subject unassigned successfully",
      result
    });
  } catch (error) {
    console.error("Error unassigning subject:", error.message);
    
    if (error.status) {
      return res.status(error.status).json({
        message: 'Error unassigning subject',
        error: error.message
      });
    }
    
    return res.status(500).json({
      message: 'Error unassigning subject',
      error: 'Internal server error'
    });
  }
};



/**
 * Assign a copy to an evaluator for re-evaluation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const assignCopyReevaluation = async (req, res) => {
  const { copyId, assignedEvaluatorId } = req.body;

  // Validate request body
  if (!copyId || !assignedEvaluatorId) {
    return res.status(400).json({ error: "Invalid request. Please provide copyId and assignedEvaluatorId" });
  }

  try {
    const result = await assignCopyReevaluationService(copyId, assignedEvaluatorId);

    console.log(`Reevaluation request submitted successfully: Copy ID: ${copyId}`);
    
    // Return success response with result
    return res.status(200).json({ 
      message: "Reevaluation request submitted successfully", 
      result 
    });
  } catch (error) {
    // Log the error
    console.error("Error submitting reevaluation request:", error.message);
    
    // Return error response
    if (error.status) {
      return res.status(error.status).json({ 
        message: 'Error submitting reevaluation request', 
        error: error.message 
      });
    }
    return res.status(500).json({ 
      message: 'Error submitting reevaluation request', 
      error: 'Internal server error' 
    });
  }
}


/**
 * Get all reevaluation assignments
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getAssignedReevaluations = async (req, res) => {
  try {
    const reevaluations = await getAssignedReevaluationsService();
    
    return res.status(200).json({
      message: "Successfully retrieved reevaluation assignments",
      reevaluations,
      count: reevaluations.length
    });
  } catch (error) {
    console.error("Error fetching reevaluation assignments:", error.message);
    
    return res.status(500).json({ 
      error: "Failed to fetch reevaluation assignments",
      message: error.message 
    });
  }
};



{/*--Evaluator Registration--*/}

/**
 * Register a new evaluator (Admin only endpoint)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const registerEvaluator = async (req, res) => {
  const { name, email, phone } = req.body;
  
  try {
    // Make sure the request is coming from an admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: "Not authorized to register evaluators"
      });
    }
    
    // Call the service to register the evaluator
    const result = await registerEvaluatorService(name, email, phone);
    
    // Return the credentials to the admin
    return res.status(201).json({
      success: true,
      message: "Evaluator registered successfully",
      uid: result.uid,
      password: result.password,
      name: result.name,
      email: result.email
    });
  } catch (error) {
    console.error("Error in registerEvaluator controller:", error);
    
    // Return appropriate error based on status code
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      success: false,
      error: error.message || "Failed to register evaluator"
    });
  }
};


//** Get Checked Copies */

/**
 * Get all checked copies by packing ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getCheckedCopies = async (req, res) => {
  try {
    const { packingId } = req.params;
    
    if (!packingId) {
      return res.status(400).json({
        success: false,
        error: "Packing ID is required"
      });
    }
    
    const result = await getCheckedCopiesService(packingId);
    
    return res.status(200).json({
      success: true,
      message: "Successfully retrieved checked copies information",
      data: result
    });
    
  } catch (error) {
    console.error("Error retrieving checked copies:", error);
    
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || "Error retrieving checked copies"
    });
  }
};





//** New Apis with new str */

/**
 * Get evaluated copies suitable for reevaluation with optional filtering
 * @param {Object} req - Express request object with query parameters
 * @param {Object} res - Express response object
 */
export const getEvaluatedCopiesForReevaluation = async (req, res) => {
  try {
    // Extract filter parameters from query
    const { subjectCode, examName, evaluatorId, searchQuery } = req.query;
    
    // Call service to get evaluated copies
    const evaluatedCopies = await getEvaluatedCopiesForReevaluationService({
      subjectCode,
      examName,
      evaluatorId,
      searchQuery
    });

    return res.status(200).json({
      success: true,
      count: evaluatedCopies.length,
      data: evaluatedCopies
    });
  } catch (error) {
    console.error("Error fetching evaluated copies for reevaluation:", error);
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to fetch evaluated copies"
    });
  }
};

/**
 * Get a specific copy by its ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getCopyById = async (req, res) => {
  try {
    const { copyId } = req.params;
    
    if (!copyId) {
      return res.status(400).json({
        success: false,
        error: "Copy ID is required"
      });
    }
    
    const copyDetails = await getCopyByIdService(copyId);
    
    if (!copyDetails) {
      return res.status(404).json({
        success: false,
        error: "Copy not found"
      });
    }
    
    return res.status(200).json({
      success: true,
      data: copyDetails
    });
  } catch (error) {
    console.error("Error fetching copy details:", error);
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to fetch copy details"
    });
  }
};






/**
 * Get evaluation statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getEvaluationStats = async (req, res) => {
  try {
    const { timeRange = 'all' } = req.query;
    const stats = await getEvaluationStatsService(timeRange);
    
    return res.status(200).json(stats);
  } catch (error) {
    console.error("Error getting evaluation statistics:", error);
    return res.status(500).json({ 
      error: "Failed to get evaluation statistics",
      message: error.message 
    });
  }
};




