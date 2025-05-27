import { Bagging, CopyAssignments, CopyBatchAssignment, CopyEval, CopyGunning, CopyReevaluation, SubjectAssignment, SubjectData, UserLogin } from "../models/index.js";
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
import { JWT_SECRET, TOKEN_EXPIRY } from "../config/config.js";
import { sequelize } from "../config/db.js";
import { Op } from "sequelize";
import { sendEvaluatorCredentials } from './emailService.js';



/**
 * Authenticate an admin user and generate a JWT token
 * 
 * @param {string} uid - Admin user ID
 * @param {string} pass - Admin password
 * @returns {Object} Object containing JWT token and admin user data
 * @throws {Error} If authentication fails
 */
export const adminLoginService = async (uid, pass) => {
  // First, find the admin user by UID
  const record = await UserLogin.findOne({ 
    where: { 
      Uid: uid, 
      Role: "admin" 
    } 
  });

  // If no admin user found with this UID
  if (!record) {
    const error = new Error("Invalid credentials");
    error.status = 401;
    throw error;
  }

  // Verify password
  const isMatch = await bcrypt.compare(pass, record.Pass);

  // If password doesn't match
  if (!isMatch) {
    const error = new Error("Invalid credentials");
    error.status = 401;
    throw error;
  }

  // Generate JWT token
  const token = jwt.sign(
    {
      uid: record.Uid,
      role: record.Role,
    },
    JWT_SECRET,
    {
      expiresIn: TOKEN_EXPIRY,
    }
  );

  // Return user data without sensitive information
  const userData = {
    uid: record.Uid,
    name: record.Name,
    email: record.Email,
    phoneNumber: record.PhoneNumber,
    role: record.Role,
    active: record.Active,
  };

  return { token, userData };
};


/**
 * Retrieves all evaluators from the database
 * 
 * @returns {Promise<Array>} List of evaluators with selected attributes
 * @throws {Error} If database query fails
 */
export const getEvaluatorsService = async () => {
  try {
    const evaluators = await UserLogin.findAll({
      where: {
        Role: 'evaluator'
      },
      attributes: ['Uid', 'Name', 'Email', 'PhoneNumber', 'Active']
    });
    
    // Map the database column names to more standard camelCase for API responses
    return evaluators.map(evaluator => ({
      uid: evaluator.Uid,
      name: evaluator.Name,
      email: evaluator.Email,
      phoneNumber: evaluator.PhoneNumber,
      active: evaluator.Active
    }));
  } catch (error) {
    console.error('Error in getEvaluatorsService:', error);
    const serviceError = new Error('Failed to retrieve evaluators');
    serviceError.status = 500;
    serviceError.original = error;
    throw serviceError;
  }
};




/**
 * Activate an evaluator account
 * @param {string} uid - The UID of the evaluator to activate
 * @returns {Promise<Object>} Result of the operation
 */
export const activateEvaluatorService = async (uid) => {
  try {
    // Find the evaluator
    const evaluator = await UserLogin.findOne({
      where: { 
        Uid: uid,
        Role: 'evaluator'
      }
    });
    
    if (!evaluator) {
      const error = new Error(`Evaluator with ID ${uid} not found`);
      error.status = 404;
      throw error;
    }
    
    // Check if already active
    if (evaluator.Active) {
      return {
        success: true,
        message: "Evaluator is already active",
        evaluator: {
          uid: evaluator.Uid,
          name: evaluator.Name,
          email: evaluator.Email,
          phoneNumber: evaluator.PhoneNumber,
          active: evaluator.Active
        }
      };
    }
    
    // Update evaluator status
    evaluator.Active = true;
    await evaluator.save();
    
    console.log(`Evaluator ${uid} activated successfully`);
    
    return {
      success: true,
      message: "Evaluator activated successfully",
      evaluator: {
        uid: evaluator.Uid,
        name: evaluator.Name,
        email: evaluator.Email,
        phoneNumber: evaluator.PhoneNumber,
        active: evaluator.Active
      }
    };
  } catch (error) {
    console.error(`Error in activateEvaluatorService: ${error.message}`);
    throw error;
  }
};

/**
 * Deactivate an evaluator account
 * @param {string} uid - The UID of the evaluator to deactivate
 * @returns {Promise<Object>} Result of the operation
 */
export const deactivateEvaluatorService = async (uid) => {
  try {
    // Find the evaluator
    const evaluator = await UserLogin.findOne({
      where: { 
        Uid: uid,
        Role: 'evaluator'
      }
    });
    
    if (!evaluator) {
      const error = new Error(`Evaluator with ID ${uid} not found`);
      error.status = 404;
      throw error;
    }
    
    // Check if already inactive
    if (!evaluator.Active) {
      return {
        success: true,
        message: "Evaluator is already inactive",
        evaluator: {
          uid: evaluator.Uid,
          name: evaluator.Name,
          email: evaluator.Email,
          phoneNumber: evaluator.PhoneNumber,
          active: evaluator.Active
        }
      };
    }
    
    // Update evaluator status
    evaluator.Active = false;
    await evaluator.save();
    
    console.log(`Evaluator ${uid} deactivated successfully`);
    
    return {
      success: true,
      message: "Evaluator deactivated successfully",
      evaluator: {
        uid: evaluator.Uid,
        name: evaluator.Name,
        email: evaluator.Email,
        phoneNumber: evaluator.PhoneNumber,
        active: evaluator.Active
      }
    };
  } catch (error) {
    console.error(`Error in deactivateEvaluatorService: ${error.message}`);
    throw error;
  }
};






/**
 * Assign copies to an evaluator
 *
 * @param {string} evaluatorId - The ID of the evaluator
 * @param {Array<string>} copyIds - Array of copy barcodes to assign
 * @param {string} assignedBy - The ID of the admin making the assignment
 * @returns {Promise<Array>} - The created assignment records
 */
export const assignCopiesToEvaluator = async (evaluatorId, copyIds, assignedBy) => {
  // Validate evaluator exists and is active
  const evaluator = await UserLogin.findOne({ 
    where: { 
      Uid: evaluatorId, 
      Role: 'evaluator', 
      Active: true 
    } 
  });
  
  if (!evaluator) {
    const error = new Error(`Evaluator with ID ${evaluatorId} not found or not active`);
    error.status = 404;
    throw error;
  }

  // Check if any copies are already assigned - do this outside the transaction
  const existingAssignments = await CopyAssignments.findAll({
    where: {
      CopyBarcode: copyIds
    }
  });

  console.log(`Found ${existingAssignments.length} existing assignments for the provided copy barcodes`);
  
  
  // Handle already assigned copies
  let unassignedCopyIds = copyIds;
  if (existingAssignments.length > 0) {
    // Get the list of already assigned barcodes
    const alreadyAssigned = existingAssignments.map(assignment => assignment.CopyBarcode);
    
    // Filter out already assigned copies
    unassignedCopyIds = copyIds.filter(copyId => !alreadyAssigned.includes(copyId));
    
    if (unassignedCopyIds.length === 0) {
      // All copies are already assigned
      const error = new Error("All selected copies are already assigned to evaluators");
      error.status = 400;
      throw error;
    }
    
    // Continue with unassigned copies only
    console.log(`${alreadyAssigned.length} copies already assigned, proceeding with ${unassignedCopyIds.length} unassigned copies`);
  }
  
  // Only start transaction if we have copies to assign
  if (unassignedCopyIds.length === 0) {
    return [];
  }
  
  // Format date properly for SQL Server
  const currentDate = new Date();
  // Format as ISO string without milliseconds and Z to match SQL Server expected format
 
 
  //  Pass native Date object
const assignedAtDate = new Date();

  // Prepare assignment records with properly formatted date
  const assignments = unassignedCopyIds.map(copyId => ({
    CopyBarcode: copyId,
    EvaluatorID: evaluatorId,
    AssignedBy: assignedBy,
    AssignedAt: assignedAtDate,
    IsChecked: false
  }));  
  // Use a new transaction for just the bulk insert
  const transaction = await sequelize.transaction();
  
  try {
    // Bulk create assignment records
    const result = await CopyAssignments.bulkCreate(assignments, { 
      transaction,
      // Explicitly specify fields to ensure control over what is sent to DB
      fields: ['CopyBarcode', 'EvaluatorID', 'AssignedBy', 'AssignedAt', 'IsChecked']
    });
    
    // Commit the transaction
    await transaction.commit();
    
    return result;
  } catch (error) {
    // Handle rollback
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error('Error during transaction rollback:', rollbackError);
      // Just log rollback errors, don't throw them
    }
    
    // Enhanced error logging
    console.error('SQL Error in assignCopiesToEvaluator:', {
      message: error.message,
      sql: error.sql,
      code: error.parent?.code,
      originalError: error.original?.message
    });
    
    // Rethrow with better context
    const enhancedError = new Error(`Database error while assigning copies: ${error.message}`);
    enhancedError.status = 500;
    enhancedError.originalError = error;
    throw enhancedError;
  }
};





/**
 * Get status details for all evaluators
 * @returns {Promise<Array>} - Array of evaluator statistics objects
 */
export const getEvaluatorsStatusService = async () => {
  try {
    // Step 1: Get all distinct evaluator IDs
    const evaluators = await CopyAssignments.findAll({
      attributes: [
        'EvaluatorID',
        [sequelize.fn('COUNT', sequelize.col('AssignmentID')), 'totalAssigned'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN IsChecked = 1 THEN 1 ELSE 0 END')), 'checked'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN IsChecked = 0 THEN 1 ELSE 0 END')), 'pending']
      ],
      group: ['EvaluatorID'],
      raw: true
    });

    // Map the results to the desired format
    const evaluatorStats = evaluators.map(evaluator => ({
      evaluatorId: evaluator.EvaluatorID,
      totalAssigned: parseInt(evaluator.totalAssigned) || 0,
      checked: parseInt(evaluator.checked) || 0, 
      pending: parseInt(evaluator.pending) || 0
    }));

    // Step 2: (Optional) Enhance with evaluator names if needed
    const evaluatorIds = evaluatorStats.map(stat => stat.evaluatorId);
    
    if (evaluatorIds.length > 0) {
      const evaluatorDetails = await UserLogin.findAll({
        where: {
          Uid: evaluatorIds,
          Role: 'evaluator'
        },
        attributes: ['Uid', 'Name', 'Email'],
        raw: true
      });

      // Create a lookup map for quick access
      const evaluatorMap = {};
      evaluatorDetails.forEach(detail => {
        evaluatorMap[detail.Uid] = {
          name: detail.Name,
          email: detail.Email
        };
      });

      // Add evaluator details to the stats
      evaluatorStats.forEach(stat => {
        if (evaluatorMap[stat.evaluatorId]) {
          stat.name = evaluatorMap[stat.evaluatorId].name;
          stat.email = evaluatorMap[stat.evaluatorId].email;
        }
      });
    }

    console.log(`Retrieved statistics for ${evaluatorStats.length} evaluators`);
    return evaluatorStats;
  } catch (error) {
    console.error(`Error in getEvaluatorsStatusService: ${error.message}`);
    throw new Error(`Failed to retrieve evaluator statistics: ${error.message}`);
  }
};



/** ---v2
 * Get all Evaluated/checked copies with filtering options
 * @param {Object} filters - Optional filters (course, subject, session, etc.)
 * @returns {Promise<Array>} Filtered evaluated copies
 */
export const EvaluatedCopiesService = async (filters = {}) => {
  try {
    const { course, subject, session, evaluatorId } = filters;
    
    // Build the where clause for CopyEval
    const whereClause = { 
      del: false,
      // Add more conditions if needed
    };
    
    // Add evaluator filter if provided
    if (evaluatorId) {
      whereClause.eval_id = evaluatorId;
    }
    
    // Base query with subject data include
    const queryOptions = {
      where: whereClause,
      attributes: ['copyid', 'eval_id', 'obt_mark', 'max_mark', 'eval_time', 'status', 'createdat', 'updatedat'],
      include: [{
        model: SubjectData,
        as: 'subjectData',
        required: true,
        attributes: ['Course', 'Subject', 'SubjectID', 'ExamDate']
      }]
    };
    
    // Add course, subject, and session filters to the include
    if (course || subject || session) {
      const subjectWhere = {};
      
      if (course) subjectWhere.Course = course;
      if (subject) subjectWhere.Subject = subject;
      // if (session) {
      //   // Assuming ExamDate can be used to filter by session/year
      //   subjectWhere.ExamDate = {
      //     [Op.like]: `${session}%` // This will match dates starting with the session year
      //   };
      // }
      if (session) {
        // Convert ExamDate to string and check year part
        subjectWhere.ExamDate = sequelize.where(
          sequelize.fn('YEAR', sequelize.col('ExamDate')), 
          session
        );
      }
      
      queryOptions.include[0].where = subjectWhere;
    }
    
    const evaluatedCopies = await CopyEval.findAll(queryOptions);

    // Return proper data structure with all relevant fields
    return evaluatedCopies.map(record => ({
      copyId: record.copyid,
      evaluatorId: record.eval_id,
      obtainedMarks: record.obt_mark,
      maxMarks: record.max_mark,
      evaluationTime: record.eval_time,
      status: record.status,
      createdAt: record.createdat,
      updatedAt: record.updatedat,
      // Add subject data
      course: record.subjectData?.Course || 'Unknown',
      subject: record.subjectData?.Subject || 'Unknown',
      subjectCode: record.subjectData?.SubjectID || 'Unknown',
      examDate: record.subjectData?.ExamDate || null
    }));
  } catch (error) {
    console.error("Error in EvaluatedCopiesService:", error);
    throw new Error(`Failed to retrieve evaluated copies: ${error.message}`);
  }
};



// /**
//  * Get all Evaluated/checked copies
//  */
// export const EvaluatedCopiesService = async () => {
//   try {
//     const evaluatedCopies = await CopyEval.findAll({
//       where: { 
//         del: false,
//         // status: 'Evaluated' // Ensure we only get evaluated copies
//       },
//       attributes: ['copyid', 'eval_id', 'obt_mark', 'max_mark', 'eval_time','status', 'createdat', 'updatedat'],
//     });

//     // Return proper data structure with all relevant fields
//     return evaluatedCopies.map(record => ({
//       copyId: record.copyid,
//       evaluatorId: record.eval_id,
//       obtainedMarks: record.obt_mark,
//       maxMarks: record.max_mark,
//       evaluationTime: record.eval_time,
//       status: record.status,
//       createdAt: record.createdat,
//       updatedAt: record.updatedat
//     }));
//   } catch (error) {
//     console.error("Error in EvaluatedCopiesService:", error);
//     throw new Error(`Failed to retrieve evaluated copies: ${error.message}`);
//   }
// };















//? *********************************************

// Add these functions to the existing adminService.js file

/**
 * Assign a subject to an evaluator
 * @param {string} evaluatorId - ID of the evaluator
 * @param {string} subjectCode - Subject code to assign
 * @param {string} examName - Name of the exam
 * @param {string} slotName - Name of the slot
 * @param {string} assignedBy - Admin user ID making the assignment
 * @returns {Promise<Object>} - Created subject assignment record
 */
export const assignSubjectToEvaluator = async (evaluatorId, subjectCode, examName, assignedBy) => {
  try {
    // Validate evaluator exists and is active
    const evaluator = await UserLogin.findOne({ 
      where: { 
        Uid: evaluatorId, 
        Role: 'evaluator', 
        Active: true 
      } 
    });
    
    if (!evaluator) {
      const error = new Error(`Evaluator with ID ${evaluatorId} not found or not active`);
      error.status = 404;
      throw error;
    }

    // Check if this subject is already assigned to this evaluator
    const existingAssignment = await SubjectAssignment.findOne({
      where: {
        EvaluatorID: evaluatorId,
        SubjectCode: subjectCode,
        ExamName: examName,
        Active: true
      }
    });

    if (existingAssignment) {
      return existingAssignment; // Subject already assigned to this evaluator
    }

    // Create a new subject assignment
    const subjectAssignment = await SubjectAssignment.create({
      SubjectCode: subjectCode,
      ExamName: examName,
      EvaluatorID: evaluatorId,
      AssignedBy: assignedBy,
      AssignedAt: new Date(),
      Active: true
    });

    return subjectAssignment;
  } catch (error) {
    console.error('Error in assignSubjectToEvaluator:', error);
    throw error;
  }
};

/**
 * Get all subjects assigned to evaluators
 * @returns {Promise<Array>} - List of subject assignments with evaluator details
 */
// export const getSubjectAssignmentsService = async () => {
//   try {
//     const assignments = await SubjectAssignment.findAll({
//       where: { Active: true },
//       include: [
//         {
//           model: UserLogin,
//           attributes: ['Name', 'Email'],
//           required: false
//         }
//       ]
//     });

//     return assignments.map(assignment => ({
//       assignmentId: assignment.AssignmentID,
//       subjectCode: assignment.SubjectCode,
//       examName: assignment.ExamName,
//       evaluatorId: assignment.EvaluatorID,
//       evaluatorName: assignment.UserLogin?.Name || 'Unknown',
//       evaluatorEmail: assignment.UserLogin?.Email || 'Unknown',
//       assignedBy: assignment.AssignedBy,
//       assignedAt: assignment.AssignedAt,
//       active: assignment.Active
//     }));
//   } catch (error) {
//     console.error('Error in getSubjectAssignmentsService:', error);
//     throw new Error(`Failed to retrieve subject assignments: ${error.message}`);
//   }
// };


/**
 * Get all subjects assigned to evaluators with active batch status
 * @returns {Promise<Array>} - List of subject assignments with evaluator details and batch status
 */
export const getSubjectAssignmentsService = async () => {
  try {
    // Get all active subject assignments with evaluator info
    const assignments = await SubjectAssignment.findAll({
      where: { Active: true },
      include: [
        {
          model: UserLogin,
          attributes: ['Name', 'Email'],
          required: false
        }
      ]
    });

    // Get all active batches in a separate query
    const activeBatches = await CopyBatchAssignment.findAll({
      where: { IsActive: true },
      attributes: ['EvaluatorID', 'SubjectCode'],
      raw: true
    });

    // Create a simple lookup map for quick batch status checking
    const activeBatchMap = {};
    activeBatches.forEach(batch => {
      const key = `${batch.EvaluatorID}:${batch.SubjectCode}`;
      activeBatchMap[key] = true;
    });

    // Map assignments with batch status check
    return assignments.map(assignment => {
      const key = `${assignment.EvaluatorID}:${assignment.SubjectCode}`;
      
      return {
        assignmentId: assignment.AssignmentID,
        subjectCode: assignment.SubjectCode,
        examName: assignment.ExamName,
        evaluatorId: assignment.EvaluatorID,
        evaluatorName: assignment.UserLogin?.Name || 'Unknown',
        evaluatorEmail: assignment.UserLogin?.Email || 'Unknown',
        assignedBy: assignment.AssignedBy,
        assignedAt: assignment.AssignedAt,
        active: assignment.Active,
        hasActiveBatch: !!activeBatchMap[key] // Will be true if key exists in map
      };
    });
  } catch (error) {
    console.error('Error in getSubjectAssignmentsService:', error);
    throw new Error(`Failed to retrieve subject assignments: ${error.message}`);
  }
};




/**
 * Unassign a subject from an evaluator
 * @param {string} evaluatorId - ID of the evaluator 
 * @param {string} subjectCode - Subject code to unassign
 * @returns {Promise<Object>} - Result of the unassignment operation
 */
export const unassignSubjectFromEvaluator = async (evaluatorId, subjectCode) => {
  try {
    // Find the assignment to confirm it exists
    const existingAssignment = await SubjectAssignment.findOne({
      where: {
        EvaluatorID: evaluatorId,
        SubjectCode: subjectCode,
        Active: true
      }
    });

    if (!existingAssignment) {
      const error = new Error(`No active assignment found for evaluator ${evaluatorId} and subject ${subjectCode}`);
      error.status = 404;
      throw error;
    }

    // Check if evaluator has any active batches for this subject
    // Modified to also check expiration time
    const activeBatch = await CopyBatchAssignment.findOne({
      where: {
        EvaluatorID: evaluatorId,
        SubjectCode: subjectCode,
        IsActive: true,
        ExpiresAt: {
          [Op.gt]: new Date() // Not expired yet
        }
      }
    });

    if (activeBatch) {
      const error = new Error(`Cannot unassign subject as evaluator has active copies assigned for this subject`);
      error.status = 400;
      throw error;
    }

    // Force cleanup of any expired batches before unassigning
    // This handles cases where the batch is expired but still marked as active
    await CopyBatchAssignment.update(
      { IsActive: false },
      {
        where: {
          EvaluatorID: evaluatorId,
          SubjectCode: subjectCode,
          IsActive: true,
          ExpiresAt: {
            [Op.lte]: new Date() // Already expired
          }
        }
      }
    );

    // Update the assignment to set Active = false
    const updatedCount = await SubjectAssignment.update(
      { Active: false },
      {
        where: {
          EvaluatorID: evaluatorId,
          SubjectCode: subjectCode,
          Active: true
        }
      }
    );

    return {
      success: updatedCount[0] > 0,
      unassignedCount: updatedCount[0],
      evaluatorId,
      subjectCode
    };
  } catch (error) {
    console.error('Error in unassignSubjectFromEvaluator:', error);
    throw error;
  }
};



/**
 * Assign a copy to an evaluator for re-evaluation
 * @param {string} copyId
 * @param {string} assignedEvaluatorId
 * @returns {Promise<Object>} 
 */
export const assignCopyReevaluationService = async (copyId, assignedEvaluatorId) => {
  let transaction;
  
  try {
    // First check if the copy is evaluated (outside transaction)
    const isEvaluated = await CopyEval.findOne({
      where: {
        copyid: copyId,
        del: 0,
        status: 'Evaluated' // Ensure the copy is fully evaluated
      }
    });

    if (!isEvaluated) {
      const error = new Error(`Copy ${copyId} has not been evaluated yet and cannot be re-evaluated`);
      error.status = 400; // Bad Request
      throw error;
    }

    // Check for existing requests (outside transaction)
    const existingRequest = await CopyReevaluation.findOne({
      where: {
        CopyID: copyId,
        Status: {
          [Op.in]: ['Pending', 'Assigned'] // Active statuses
        }
      }
    });

    if (existingRequest) {
      const error = new Error(`Copy ${copyId} already has an active re-evaluation request`);
      error.status = 409; // Conflict
      throw error;
    }

    // Verify the evaluator exists (outside transaction)
    const evaluator = await UserLogin.findOne({
      where: {
        Uid: assignedEvaluatorId,
        Role: 'evaluator',
        Active: true
      }
    });

    if (!evaluator) {
      const error = new Error(`Evaluator with ID ${assignedEvaluatorId} not found or not active`);
      error.status = 404;
      throw error;
    }
    
    // Verify the copy exists (outside transaction)
    const copyExists = await SubjectData.findOne({
      where: {
        barcode: copyId
      }
    });
    
    if (!copyExists) {
      const error = new Error(`Copy with ID ${copyId} not found`);
      error.status = 404;
      throw error;
    }

    // Start the transaction only for the insert operation
    transaction = await sequelize.transaction();
    
    console.log("Starting transaction for reevaluation assignment");

    // Create a new re-evaluation request
    const reevaluationRequest = await CopyReevaluation.create({
      CopyID: copyId,
      Status: 'Assigned',
      AssignedEvaluatorID: assignedEvaluatorId,
      AssignedAt: new Date(),
      Reason: 'Administrative re-evaluation request',
      OriginalEvaluatorID: isEvaluated.eval_id,
      OriginalMarks: isEvaluated.obt_mark
    }, { transaction });

    // Commit the transaction
    await transaction.commit();
    console.log("Transaction committed successfully");

    return {
      requestId: reevaluationRequest.RequestID,
      copyId: reevaluationRequest.CopyID,
      evaluatorId: reevaluationRequest.AssignedEvaluatorID,
      status: reevaluationRequest.Status,
      assignedAt: reevaluationRequest.AssignedAt,
      originalMarks: reevaluationRequest.OriginalMarks,
      originalEvaluatorId: reevaluationRequest.OriginalEvaluatorID
    };
  } catch (error) {
    console.error('Error in assignCopyReevaluationService:', error);
    
    // Only try to rollback if we have an active transaction
    if (transaction && !transaction.finished) {
      try {
        console.log("Rolling back transaction due to error");
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError);
      }
    }
    
    throw error; 
  }
};


// /**
//  * Assign a copy to an evaluator for re-evaluation
//  * @param {string} copyId
//  * @param {string} assignedEvaluatorId
//  * @returns {Promise<Object>} 
//  */
// export const assignCopyReevaluationService = async (copyId, assignedEvaluatorId) => {
//   const transaction = await sequelize.transaction();
// console.log("Reevaluation form data->", copyId, assignedEvaluatorId);

//   try {
//     // Check if copyid exists in copyeval (means it's evaluated, then only we'll allow reeval)
//     const isEvaluated = await CopyEval.findOne({
//       where: {
//         copyid: copyId,
//         del: 0,
//         status: 'Evaluated' // Ensure the copy is fully evaluated
//       },
//       transaction
//     });

//     if (!isEvaluated) {
//       await transaction.rollback();
//       const error = new Error(`Copy ${copyId} has not been evaluated yet and cannot be re-evaluated`);
//       error.status = 400; // Bad Request
//       throw error;
//     }

//     // First check if this copy already has an active re-evaluation request
//     const existingRequest = await CopyReevaluation.findOne({
//       where: {
//         CopyID: copyId,
//         Status: {
//           [Op.in]: ['Pending', 'Assigned'] // Active statuses
//         }
//       },
//       transaction
//     });

//     if (existingRequest) {
//       await transaction.rollback();
//       const error = new Error(`Copy ${copyId} already has an active re-evaluation request`);
//       error.status = 409; // Conflict
//       throw error;
//     }

//     // Verify the evaluator exists and is active
//     const evaluator = await UserLogin.findOne({
//       where: {
//         Uid: assignedEvaluatorId,
//         Role: 'evaluator',
//         Active: true
//       },
//       transaction
//     });

//     if (!evaluator) {
//       await transaction.rollback();
//       const error = new Error(`Evaluator with ID ${assignedEvaluatorId} not found or not active`);
//       error.status = 404;
//       throw error;
//     }
    
//     // Verify the copy exists
//     const copyExists = await SubjectData.findOne({
//       where: {
//         barcode: copyId
//       },
//       transaction
//     });
    
//     if (!copyExists) {
//       await transaction.rollback();
//       const error = new Error(`Copy with ID ${copyId} not found`);
//       error.status = 404;
//       throw error;
//     }

//     // Create a new re-evaluation request
//     const reevaluationRequest = await CopyReevaluation.create({
//       CopyID: copyId,
//       Status: 'Assigned',
//       AssignedEvaluatorID: assignedEvaluatorId,
//       AssignedAt: new Date(),
//       Reason: 'Administrative re-evaluation request',
//     }, { transaction });

//     // Commit the transaction
//     await transaction.commit();

//     return {
//       requestId: reevaluationRequest.RequestID,
//       copyId: reevaluationRequest.CopyID,
//       evaluatorId: reevaluationRequest.AssignedEvaluatorID,
//       status: reevaluationRequest.Status,
//       assignedAt: reevaluationRequest.AssignedAt,
//     };
//   } catch (error) {
//     // Make sure to rollback if not already done
//     if (transaction.finished !== 'rollback') {
//       await transaction.rollback();
//     }
//     console.error('Error in assignCopyReevaluationService:', error);
//     throw error; 
//   }
// };




/**
 * Get all assigned reevaluations
 * @returns {Promise<Array>} - List of all reevaluation assignments with details
 */
export const getAssignedReevaluationsService = async () => {
  try {
    // Find all reevaluation requests with their evaluator information
    const reevaluations = await CopyReevaluation.findAll();

    if (!reevaluations || reevaluations.length === 0) {
      return [];
    }

    // Format the data for API response
    return reevaluations.map(request => ({
      requestId: request.RequestID,
      copyId: request.CopyID,
      status: request.Status,
      reason: request.Reason,
      evaluatorId: request.AssignedEvaluatorID,
      assignedAt: request.AssignedAt,
      submittedAt: request.SubmittedAt,
      reevaluatedMarks: request.ReevaluatedMarks,
      remarks: request.Remarks,
      isChecked: request.IsChecked
    }));
  } catch (error) {
    console.error('Error in getAssignedReevaluationsService:', error);
    throw new Error(`Failed to retrieve reevaluation assignments: ${error.message}`);
  }
};


{/*--Evaluator registration and auto generation of uid pass--*/}

// /**
//  * Register a new evaluator with auto-generated UID and temporary password
//  * @param {string} name - Evaluator's full name
//  * @param {string} email - Evaluator's email
//  * @param {string} phoneNumber - Evaluator's phone number
//  * @returns {Promise<Object>} Object containing the evaluator details and credentials
//  */
// export const registerEvaluatorService = async (name, email, phoneNumber) => {
//   // Validate input
//   if (!name || !email || !phoneNumber) {
//     const error = new Error("Name, email and phone number are required");
//     error.status = 400;
//     throw error;
//   }

//   // Check if email already exists
//   const existingEmailUser = await UserLogin.findOne({ where: { Email: email } });
//   if (existingEmailUser) {
//     const error = new Error("Email is already registered");
//     error.status = 409;
//     throw error;
//   }
  
//   // Check if phone number already exists
//   const existingPhoneUser = await UserLogin.findOne({ where: { PhoneNumber: phoneNumber } });
//   if (existingPhoneUser) {
//     const error = new Error("Phone number is already registered");
//     error.status = 409;
//     throw error;
//   }

//   try {
//     // Generate a new unique UID
//     const uid = await generateNewUID();
    
//     // Generate a random temporary password (4 characters)
//     const tempPassword = generateRandomPassword(4);
    
//     // Hash the password
//     const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
//     // Create the new evaluator record
//     const newEvaluator = await UserLogin.create({
//       Name: name,
//       Email: email,
//       PhoneNumber: phoneNumber,
//       Uid: uid,
//       Pass: hashedPassword,
//       Role: "evaluator",
//       Active: true,
//       FirstLogin: true // Flag to force password change on first login
//     });
    
//     // Return the user data with the plain text password (for one-time display)
//     return {
//       success: true,
//       uid: newEvaluator.Uid,
//       password: tempPassword, // Plain text password (only for initial display)
//       name: newEvaluator.Name,
//       email: newEvaluator.Email
//     };
//   } catch (error) {
//     console.error("Error registering evaluator:", error);
//     const serviceError = new Error("Failed to register evaluator");
//     serviceError.status = 500;
//     serviceError.originalError = error;
//     throw serviceError;
//   }
// };






// Update your existing function
export const registerEvaluatorService = async (name, email, phoneNumber) => {
  // Validate input
  if (!name || !email || !phoneNumber) {
    const error = new Error("Name, email and phone number are required");
    error.status = 400;
    throw error;
  }

  // Check if email already exists
  const existingEmailUser = await UserLogin.findOne({ where: { Email: email } });
  if (existingEmailUser) {
    const error = new Error("Email is already registered");
    error.status = 409;
    throw error;
  }
  
  // Check if phone number already exists
  const existingPhoneUser = await UserLogin.findOne({ where: { PhoneNumber: phoneNumber } });
  if (existingPhoneUser) {
    const error = new Error("Phone number is already registered");
    error.status = 409;
    throw error;
  }

  try {
    // Generate a new unique UID
    const uid = await generateNewUID();
    
    // Generate a random temporary password (6 characters for better security)
    const tempPassword = generateRandomPassword(6);
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    // Create the new evaluator record
    const newEvaluator = await UserLogin.create({
      Name: name,
      Email: email,
      PhoneNumber: phoneNumber,
      Uid: uid,
      Pass: hashedPassword,
      Role: "evaluator",
      Active: true,
      FirstLogin: true // Flag to force password change on first login
    });
    
    // Send credentials via email
    try {
      await sendEvaluatorCredentials(name, email, uid, tempPassword);
      console.log(`Credentials sent to ${email} successfully`);
    } catch (emailError) {
      console.error("Failed to send credentials email:", emailError);
      // We don't throw here to avoid rolling back the user creation
      // Just log the error and continue
    }
    
    // Return the user data with the plain text password (for one-time display)
    return {
      success: true,
      uid: newEvaluator.Uid,
      password: tempPassword, // Plain text password (only for initial display)
      name: newEvaluator.Name,
      email: newEvaluator.Email,
      emailSent: true
    };

    // //?testing
    //     return {
    //   success: true,
    //   uid: uid,
    //   password: tempPassword, // Plain text password (only for initial display)
    //   name: name,
    //   email: email,
    //   emailSent: true
    // };
  } catch (error) {
    console.error("Error registering evaluator:", error);
    const serviceError = new Error("Failed to register evaluator");
    serviceError.status = 500;
    serviceError.originalError = error;
    throw serviceError;
  }
};



// /**
//  * Generate a random password of specified length
//  * @param {number} length - Length of the password to generate
//  * @returns {string} Random password
//  */
// const generateRandomPassword = (length) => {
//   const charset = "abcdefghijklmnopqrstuvwxyz0123456789";
//   let password = "";
  
//   for (let i = 0; i < length; i++) {
//     const randomIndex = Math.floor(Math.random() * charset.length);
//     password += charset[randomIndex];
//   }
  
//   return password;
// };



/**
 * Generate a more secure random password with mixed character types
 * @param {number} length - Length of the password to generate (minimum 8 recommended)
 * @returns {string} Secure random password
 */
const generateRandomPassword = (length) => {
  // Ensure minimum length of 8 for security
  const passwordLength = Math.max(length, 8);
  
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const specialChars = "!@#$%^&*()-_=+";
  
  // Ensure at least one character from each set
  let password = "";
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
  
  // Fill the rest with random characters from all sets
  const allChars = lowercase + uppercase + numbers + specialChars;
  for (let i = password.length; i < passwordLength; i++) {
    const randomIndex = Math.floor(Math.random() * allChars.length);
    password += allChars[randomIndex];
  }
  
  // Shuffle the password to avoid predictable pattern (4 specific chars at beginning)
  return password.split('').sort(() => Math.random() - 0.5).join('');
};


/**
 * Service to generate a new unique UID by finding the last one and incrementing
 * @returns {Promise<string>} The new UID
 */
const generateNewUID = async () => {
  try {
    // SQL Server compatible query
    const lastRecord = await UserLogin.findOne({
      order: [['Uid', 'DESC']], // Simple ordering by UID
      limit: 1,
    });

    let newUID = "UID001"; // Default UID

    if (lastRecord) {
      // Extract the last UID and increment it
      const lastUID = lastRecord.Uid;
      // Extract numeric part using JavaScript instead of SQL function
      const uidNumber = parseInt(lastUID.replace(/\D/g, '')); 
      newUID = `UID${String(uidNumber + 1).padStart(3, "0")}`; // Increment UID and format it
    }

    return newUID;
  } catch (error) {
    console.error("Error generating new UID:", error.message);
    throw error; // Rethrow the error to be handled by the controller
  }
};






//** Get checked Copies */

/**
 * Get checked (evaluated) copies by packing ID
 * @param {string} packingId - The packing ID to get checked copies for
 * @returns {Promise<Object>} Details of checked copies
 */


//?v2
export const getCheckedCopiesService = async (packingId) => {
  if (!packingId) {
    const error = new Error("Packing ID is required");
    error.status = 400;
    throw error;
  }

  try {
    // Step 1: Find all BagIDs for the PackingID
    const baggingRecords = await Bagging.findAll({
      where: { PackingID: packingId },
      attributes: ["BagID"],
      raw: true,
    });

    if (!baggingRecords || baggingRecords.length === 0) {
      const error = new Error("No bags found for the given packing ID");
      error.status = 404;
      throw error;
    }

    const bagIds = baggingRecords.map((record) => record.BagID);
    console.log("bagids", bagIds);
    
    // Step 2: Find all CopyBarcodes for the BagIDs
    const gunningRecords = await CopyGunning.findAll({
      where: { BagID: bagIds, IsScanned: 1 },
      attributes: ["CopyBarcode", "BagID"],
      raw: true,
    });

    console.log("Gunning records found:", gunningRecords.length);
    if (gunningRecords.length > 0) {
      console.log("Sample gunning record:", gunningRecords[0]);
    }
    
    if (!gunningRecords || gunningRecords.length === 0) {
      return {
        checkedCount: 0,
        checkedCopies: [],
        message: "No copies found for the given bags"
      };
    }

    // Get all copy barcodes
    const allCopyBarcodes = gunningRecords.map((record) => record.CopyBarcode);
    console.log("All copy barcodes:", allCopyBarcodes);
    
    // Find checked copies from CopyAssignments first
    const checkedAssignments = await CopyAssignments.findAll({
      where: {
        CopyBarcode: allCopyBarcodes,
        IsChecked: true  // Only get checked copies
      },
      attributes: ['CopyBarcode', 'EvaluatorID', 'AssignedAt', 'CheckedAt'],
      raw: true
    });
    
    console.log("Checked assignments found:", checkedAssignments.length);
    
    // ALSO check CopyEval table for evaluated copies, since that's the definitive source
    const evaluatedCopies = await CopyEval.findAll({
      where: {
        copyid: allCopyBarcodes,
        del: false,
        status: {
          [Op.in]: ['Evaluated', 'Reevaluated'] // Include both statuses
        }
      },
      attributes: ['copyid', 'eval_id', 'createdat', 'updatedat', 'status', 'obt_mark', 'max_mark'],
      raw: true
    });
    
    console.log("Evaluated copies found in CopyEval:", evaluatedCopies.length);
    if (evaluatedCopies.length > 0) {
      console.log("Sample evaluated copy:", evaluatedCopies[0]);
    }
    
    // Combine unique copies from both sources
    const uniqueCopyIds = new Set();
    let allCheckedCopies = [];
    
    // Process assignment records first
    if (checkedAssignments.length > 0) {
      checkedAssignments.forEach(assignment => {
        if (!uniqueCopyIds.has(assignment.CopyBarcode)) {
          uniqueCopyIds.add(assignment.CopyBarcode);
          allCheckedCopies.push({
            copyId: assignment.CopyBarcode,
            evaluatorId: assignment.EvaluatorID,
            source: 'assignment',
            assignedAt: assignment.AssignedAt,
            checkedAt: assignment.CheckedAt
          });
        }
      });
    }
    
    // Then add evaluated copies that aren't already included
    if (evaluatedCopies.length > 0) {
      evaluatedCopies.forEach(evalCopy => {
        if (!uniqueCopyIds.has(evalCopy.copyid)) {
          uniqueCopyIds.add(evalCopy.copyid);
          allCheckedCopies.push({
            copyId: evalCopy.copyid,
            evaluatorId: evalCopy.eval_id,
            source: 'copyeval',
            evaluatedAt: evalCopy.updatedat,
            status: evalCopy.status,
            obtainedMarks: evalCopy.obt_mark,
            maxMarks: evalCopy.max_mark
          });
        }
      });
    }
    
    // Get evaluator information for all evaluator IDs
    const evaluatorIds = allCheckedCopies.map(copy => copy.evaluatorId);
    const uniqueEvaluatorIds = [...new Set(evaluatorIds)];
    
    const evaluatorsMap = {};
    if (uniqueEvaluatorIds.length > 0) {
      const evaluatorRecords = await UserLogin.findAll({
        where: { Uid: uniqueEvaluatorIds },
        attributes: ['Uid', 'Name'],
        raw: true
      });
      
      evaluatorRecords.forEach(evaluator => {
        evaluatorsMap[evaluator.Uid] = evaluator.Name;
      });
    }
    
    // Add evaluator names to the checked copies
    allCheckedCopies = allCheckedCopies.map(copy => ({
      ...copy,
      evaluatorName: evaluatorsMap[copy.evaluatorId] || 'Unknown'
    }));
    
    // Return just the checked copies data
    return {
      checkedCount: allCheckedCopies.length,
      checkedCopies: allCheckedCopies
    };
  } catch (error) {
    console.error(`Error in getCheckedCopiesService: ${error.message}`);
    throw error;
  }
};



// export const getCheckedCopiesService = async (packingId) => {
//   if (!packingId) {
//     const error = new Error("Packing ID is required");
//     error.status = 400;
//     throw error;
//   }

//   try {
//     // Step 1: Find all BagIDs for the PackingID
//     const baggingRecords = await Bagging.findAll({
//       where: { PackingID: packingId },
//       attributes: ["BagID"],
//       raw: true,
//     });



//     if (!baggingRecords || baggingRecords.length === 0) {
//       const error = new Error("No bags found for the given packing ID");
//       error.status = 404;
//       throw error;
//     }

//     const bagIds = baggingRecords.map((record) => record.BagID);
//     console.log("bagids", bagIds);
    

//     // Step 2: Find all CopyBarcodes for the BagIDs
//     const gunningRecords = await CopyGunning.findAll({
//       where: { BagID: bagIds, IsScanned: 1 },
//       attributes: ["CopyBarcode", "BagID"],
//       raw: true,
//     });

//      console.log("Gunning records found:", gunningRecords.length);
//     if (gunningRecords.length > 0) {
//       console.log("Sample gunning record:", gunningRecords[0]);
//     }
    

//     if (!gunningRecords || gunningRecords.length === 0) {
//       return {
//         packingId,
//         bagCount: bagIds.length,
//         totalCopies: 0,
//         checkedCopies: [],
//         message: "No copies found for the given bags"
//       };
//     }

//     // Get all copy barcodes
//     const allCopyBarcodes = gunningRecords.map((record) => record.CopyBarcode);
    
//     // Find only checked assignments for these copies
//     const checkedAssignments = await CopyAssignments.findAll({
//       where: {
//         CopyBarcode: allCopyBarcodes,
//         IsChecked: true  // Only get checked copies
//       },
//       attributes: ['CopyBarcode', 'EvaluatorID', 'AssignedAt', 'CheckedAt'],
//       raw: true
//     });
    
//     // Get evaluator information for checked copies
//     const evaluatorIds = checkedAssignments.map(assignment => assignment.EvaluatorID);
//     const uniqueEvaluatorIds = [...new Set(evaluatorIds)];
    
//     const evaluatorsMap = {};
//     if (uniqueEvaluatorIds.length > 0) {
//       const evaluatorRecords = await UserLogin.findAll({
//         where: { Uid: uniqueEvaluatorIds },
//         attributes: ['Uid', 'Name'],
//         raw: true
//       });
      
//       evaluatorRecords.forEach(evaluator => {
//         evaluatorsMap[evaluator.Uid] = evaluator.Name;
//       });
//     }
    
//     // Format the checked copies data
//     const checkedCopies = checkedAssignments.map(assignment => ({
//       copyId: assignment.CopyBarcode,
//       evaluatorId: assignment.EvaluatorID,
//       evaluatorName: evaluatorsMap[assignment.EvaluatorID] || 'Unknown',
//       assignedAt: assignment.AssignedAt,
//       checkedAt: assignment.CheckedAt
//     }));

//     // Group checked copies by bag
//     const bagCheckedMap = {};
//     checkedAssignments.forEach(assignment => {
//       // Find which bag this copy belongs to
//       const gunningRecord = gunningRecords.find(record => 
//         record.CopyBarcode === assignment.CopyBarcode
//       );
      
//       if (gunningRecord) {
//         const bagId = gunningRecord.BagID;
//         if (!bagCheckedMap[bagId]) {
//           bagCheckedMap[bagId] = {
//             checkedCount: 0,
//             copies: []
//           };
//         }
        
//         bagCheckedMap[bagId].checkedCount++;
//         bagCheckedMap[bagId].copies.push({
//           copyId: assignment.CopyBarcode,
//           evaluatorId: assignment.EvaluatorID,
//           evaluatorName: evaluatorsMap[assignment.EvaluatorID] || 'Unknown'
//         });
//       }
//     });
    
//     // Return just the checked copies data
//     return {
//       // packingId,
//       // bagCount: bagIds.length,
//       // totalCopies: allCopyBarcodes.length,
//       checkedCount: checkedCopies.length,
//       checkedCopies,
//       // bagDetails: bagCheckedMap,
//       // evaluators: evaluatorsMap
//     };
//   } catch (error) {
//     console.error(`Error in getCheckedCopiesService: ${error.message}`);
//     throw error;
//   }
// };