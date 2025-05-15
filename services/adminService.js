import { CopyAssignments, CopyEval, UserLogin } from "../models/index.js";
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
import { JWT_SECRET, TOKEN_EXPIRY } from "../config/config.js";
import { sequelize } from "../config/db.js";




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



/**
 * Get all Evaluated/checked copies
 */
export const EvaluatedCopiesService = async () => {
  try {
    const evaluatedCopies = await CopyEval.findAll({
      where: { 
        del: false,
        status: 'Evaluated' // Ensure we only get evaluated copies
      },
      attributes: ['copyid', 'eval_id', 'obt_mark', 'max_mark', 'eval_time', 'createdat', 'updatedat'],
    });

    // Return proper data structure with all relevant fields
    return evaluatedCopies.map(record => ({
      copyId: record.copyid,
      evaluatorId: record.eval_id,
      obtainedMarks: record.obt_mark,
      maxMarks: record.max_mark,
      evaluationTime: record.eval_time,
      createdAt: record.createdat,
      updatedAt: record.updatedat
    }));
  } catch (error) {
    console.error("Error in EvaluatedCopiesService:", error);
    throw new Error(`Failed to retrieve evaluated copies: ${error.message}`);
  }
};
