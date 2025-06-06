import { Copy, CopyAssignments, CopyBatchAssignment, CopyEval, CopyReevaluation, SubjectAssignment, SubjectData, UserProfile, UserLogin } from "../models/index.js";
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
      uid: uid, 
      role: "admin" 
    } 
  });

  // If no admin user found with this UID
  if (!record) {
    const error = new Error("Invalid credentials");
    error.status = 401;
    throw error;
  }

  // Verify password
  const isMatch = await bcrypt.compare(pass, record.pass);

  // If password doesn't match
  if (!isMatch) {
    const error = new Error("Invalid credentials");
    error.status = 401;
    throw error;
  }

  // Generate JWT token
  const token = jwt.sign(
    {
      uid: record.uid,
      role: record.role,
    },
    JWT_SECRET,
    {
      expiresIn: TOKEN_EXPIRY,
    }
  );

  // Return user data without sensitive information
  const userData = {
    uid: record.uid,
    name: record.name,
    email: record.email,
    phoneNumber: record.phoneNumber,
    role: record.role,
    active: record.active,
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
        role: 'evaluator'
      },
      attributes: ['uid', 'name', 'email', 'phone_number', 'active']
    });
    
    // Map the database column names to more standard camelCase for API responses
    return evaluators.map(evaluator => ({
      uid: evaluator.uid,
      name: evaluator.name,
      email: evaluator.email,
      phoneNumber: evaluator.phone_number,
      active: evaluator.active
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
        uid: uid,
        role: 'evaluator'
      }
    });
    
    if (!evaluator) {
      const error = new Error(`Evaluator with ID ${uid} not found`);
      error.status = 404;
      throw error;
    }
    
    // Check if already active
    if (evaluator.active) {
      return {
        success: true,
        message: "Evaluator is already active",
        evaluator: {
          uid: evaluator.uid,
          name: evaluator.name,
          email: evaluator.email,
          phoneNumber: evaluator.phone_number,
          active: evaluator.active
        }
      };
    }
    
    // Update evaluator status
    evaluator.active = true;
    await evaluator.save();
    
    console.log(`Evaluator ${uid} activated successfully`);
    
    return {
      success: true,
      message: "Evaluator activated successfully",
      evaluator: {
        uid: evaluator.uid,
        name: evaluator.name,
        email: evaluator.email,
        phoneNumber: evaluator.phone_number,
        active: evaluator.active
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
        uid: uid,
        role: 'evaluator'
      }
    });
    
    if (!evaluator) {
      const error = new Error(`Evaluator with ID ${uid} not found`);
      error.status = 404;
      throw error;
    }
    
    // Check if already inactive
    if (!evaluator.active) {
      return {
        success: true,
        message: "Evaluator is already inactive",
        evaluator: {
          uid: evaluator.uid,
          name: evaluator.name,
          email: evaluator.email,
          phoneNumber: evaluator.phone_number ,
          active: evaluator.active
        }
      };
    }
    
    // Update evaluator status
    evaluator.active = false;
    await evaluator.save();
    
    console.log(`Evaluator ${uid} deactivated successfully`);
    
    return {
      success: true,
      message: "Evaluator deactivated successfully",
      evaluator: {
        uid: evaluator.uid,
        name: evaluator.name,
        email: evaluator.email,
        phoneNumber: evaluator.phone_number,
        active: evaluator.active
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
        'evaluator_id',
        [sequelize.fn('COUNT', sequelize.col('assignment_id')), 'totalAssigned'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN is_checked = 1 THEN 1 ELSE 0 END')), 'checked'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN is_checked = 0 THEN 1 ELSE 0 END')), 'pending']
      ],
      group: ['evaluator_id'],
      raw: true
    });

    // Map the results to the desired format
    const evaluatorStats = evaluators.map(evaluator => ({
      evaluatorId: evaluator.evaluator_id,
      totalAssigned: parseInt(evaluator.totalAssigned) || 0,
      checked: parseInt(evaluator.checked) || 0, 
      pending: parseInt(evaluator.pending) || 0
    }));

    // Step 2: (Optional) Enhance with evaluator names if needed
    const evaluatorIds = evaluatorStats.map(stat => stat.evaluatorId);
    
    if (evaluatorIds.length > 0) {
      const evaluatorDetails = await UserLogin.findAll({
        where: {
          uid: evaluatorIds,
          role: 'evaluator'
        },
        attributes: ['uid', 'name', 'email'],
        raw: true
      });

      // Create a lookup map for quick access
      const evaluatorMap = {};
      evaluatorDetails.forEach(detail => {
        evaluatorMap[detail.uid] = {
          name: detail.name,
          email: detail.email
        };
      });

      // Add evaluator details to the stats
      evaluatorStats.forEach(stat => {
        if (evaluatorMap[stat.evaluatorId]) {
          stat.name = evaluatorMap[stat.evaluatorId].name;
          stat.email = evaluatorMap[stat.evaluatorId].email;
        } else {
          stat.name = 'Unknown';
          stat.email = 'Unknown';
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




//?v3 updated filtering
/**
 * Get all Evaluated/checked copies with filtering options
 * @param {Object} filters - Optional filters (course, subject, evaluatorId)
 * @returns {Promise<Array>} Filtered evaluated copies
 */
export const EvaluatedCopiesService = async (filters = {}) => {
  try {
    const { course, subject, evaluatorId } = filters;
    
    // Base where clause - get evaluated and reevaluated copies
    const whereClause = {
      [Op.or]: [
        { is_evaluated: true },
        { is_reevaluated: true }
      ]
    };

    // Add evaluator filter if provided
    if (evaluatorId) {
      whereClause.current_evaluator_id = evaluatorId;
    }
    
    // First, get copies that match our criteria
    const copies = await Copy.findAll({
      where: whereClause,
      include: [{
        model: SubjectData,
        as: 'subjectData',
        required: false,
        attributes: ['SubjectID', 'Subject', 'Course']
      }],
      attributes: [
        'copyid',
        'evaluation_status',
        'created_at',
        'updated_at',
        'is_evaluated',
        'is_reevaluated',
        'current_evaluator_id'
      ]
    });

    // Apply course and subject filters (these might come from subject data)
    let filteredCopies = copies;
    
    if (course || subject) {
      filteredCopies = copies.filter(copy => {
        const subjectData = copy.subjectData || {};
        const matchesCourse = !course || subjectData.Course === course;
        const matchesSubject = !subject || subjectData.Subject === subject;
        return matchesCourse && matchesSubject;
      });
    }
    
    // Get evaluation details for all copies
    const copyIds = filteredCopies.map(copy => copy.copyid);
    
    // Fetch additional evaluation data
    let evalDetailsMap = {};
    if (copyIds.length > 0) {
      const evalDetails = await CopyEval.findAll({
        where: { 
          copyid: copyIds,
          del: false
        },
        attributes: [
          'copyid', 
          'eval_id', 
          'obt_mark', 
          'max_mark', 
          'eval_time',
          'status',
          'updated_at'
        ],
        raw: true
      });
      
      // Create a lookup map for quick access
      evalDetailsMap = evalDetails.reduce((map, detail) => {
        map[detail.copyid] = detail;
        return map;
      }, {});
    }
    
    // Get evaluator details
    const evaluatorIds = [...new Set(filteredCopies
      .map(copy => copy.current_evaluator_id)
      .filter(id => id))];
      
    let evaluatorMap = {};
    if (evaluatorIds.length > 0) {
      const evaluators = await UserLogin.findAll({
        where: { uid: evaluatorIds },
        attributes: ['uid', 'name', 'email'],
        raw: true
      });
      
      evaluatorMap = evaluators.reduce((map, evaluator) => {
        map[evaluator.uid] = {
          name: evaluator.name,
          email: evaluator.email
        };
        return map;
      }, {});
    }
    
    // Get unique courses and subjects for filter dropdowns
    const courses = [...new Set(copies
      .map(copy => copy.subjectData?.Course)
      .filter(course => course))];
      
    const subjects = [...new Set(copies
      .map(copy => copy.subjectData?.Subject)
      .filter(subject => subject))];
    
    // Combine all data and format response
    const formattedCopies = filteredCopies.map(copy => {
      const evalDetails = evalDetailsMap[copy.copyid] || {};
      const evaluator = evaluatorMap[copy.current_evaluator_id] || {};
      const subjectData = copy.subjectData || {};
      
      return {
        copyId: copy.copyid,
        evaluatorId: copy.current_evaluator_id,
        evaluatorName: evaluator.name || 'Unknown',
        status: copy.evaluation_status,
        isEvaluated: copy.is_evaluated,
        isReevaluated: copy.is_reevaluated,
        createdAt: copy.created_at,
        updatedAt: evalDetails.updated_at || copy.updated_at,
        obtainedMarks: evalDetails.obt_mark || 0,
        maxMarks: evalDetails.max_mark || 0,
        evaluationTime: evalDetails.eval_time || 0,
        course: subjectData.Course || 'Unknown',
        subject: subjectData.Subject || 'Unknown',
        subjectCode: subjectData.SubjectID || 'Unknown'
      };
    });
    
    return {
      copies: formattedCopies,
      filters: {
        courses,
        subjects,
        evaluators: Object.keys(evaluatorMap).map(id => ({
          id,
          name: evaluatorMap[id].name || id
        }))
      }
    };
  } catch (error) {
    console.error("Error in EvaluatedCopiesService:", error);
    throw new Error(`Failed to retrieve evaluated copies: ${error.message}`);
  }
};



//?v2 minimal data
// /** 
//  * Get all Evaluated/checked copies with filtering options
//  * @param {Object} filters - Optional filters (course, subject, session, etc.)
//  * @returns {Promise<Array>} Filtered evaluated copies
//  */
// export const EvaluatedCopiesService = async (filters = {}) => {
//   try {
//     const { evaluatorId } = filters;
    
//     const whereClause = {
//       [Op.or]: [
//         { is_evaluated: true },
//         { is_reevaluated: true }
//       ]
//     };

//     if (evaluatorId) {
//       whereClause.current_evaluator_id = evaluatorId;
//     }
    
//     const evaluatedCopies = await Copy.findAll({
//       where: whereClause,
//       attributes: [
//         'copyid',
//         'evaluation_status',
//         'created_at',
//         'updated_at',
//         'is_evaluated',
//         'is_reevaluated',
//         'current_evaluator_id'
//       ],
//       raw: true
//     });
    
//     return evaluatedCopies.map(copy => ({
//       copyId: copy.copyid,
//       evaluatorId: copy.current_evaluator_id,
//       status: copy.evaluation_status,
//       isEvaluated: copy.is_evaluated,
//       isReevaluated: copy.is_reevaluated,
//       createdAt: copy.created_at,
//       updatedAt: copy.updated_at
//     }));
    
//   } catch (error) {
//     console.error("Error in EvaluatedCopiesService:", error);
//     throw new Error(`Failed to retrieve evaluated copies: ${error.message}`);
//   }
// };



//?v1 old not working
// /** 
//  * Get all Evaluated/checked copies with filtering options
//  * @param {Object} filters - Optional filters (course, subject, session, etc.)
//  * @returns {Promise<Array>} Filtered evaluated copies
//  */
// export const EvaluatedCopiesService = async (filters = {}) => {

//   try {
//     const { course, subject, session, evaluatorId } = filters;
    
//     // Build the where clause for CopyEval
//     const whereClause = { 
//       del: false,
//       status: 'Evaluated' // Only fetch evaluated copies
//     };
    
//     // Add evaluator filter if provided
//     if (evaluatorId) {
//       whereClause.eval_id = evaluatorId;
//     }
    
//     // Base query with subject data include
//     const queryOptions = {
//       where: whereClause,
//       attributes: ['copyid', 'eval_id', 'obt_mark', 'max_mark', 'eval_time', 'status', 'createdat', 'updatedat'],
//       include: [{
//         model: SubjectData,
//         as: 'subjectData',
//         required: true,
//         attributes: ['course', 'subject', 'subject_id', 'exam_date']
//       }]
//     };
    
//     // Add course, subject, and session filters to the include
//     if (course || subject || session) {
//       const subjectWhere = {};
      
//       if (course) subjectWhere.course = course;
//       if (subject) subjectWhere.subject = subject;
      
//       if (session) {
//         // Convert ExamDate to string and check year part
//         subjectWhere.exam_date = sequelize.where(
//           sequelize.fn('YEAR', sequelize.col('exam_date')), 
//           session
//         );
//       }
      
//       queryOptions.include[0].where = subjectWhere;
//     }
    
//     const evaluatedCopies = await CopyEval.findAll(queryOptions);

//     // Return proper data structure with all relevant fields
//     return evaluatedCopies.map(record => ({
//       copyId: record.copyid,
//       evaluatorId: record.eval_id,
//       obtainedMarks: record.obt_mark,
//       maxMarks: record.max_mark,
//       evaluationTime: record.eval_time,
//       status: record.status,
//       createdAt: record.createdat,
//       updatedAt: record.updatedat,
//       // Add subject data
//       course: record.subjectData?.course || 'Unknown',
//       subject: record.subjectData?.subject || 'Unknown',
//       subjectCode: record.subjectData?.subject_id || 'Unknown',
//       examDate: record.subjectData?.exam_date || null
//     }));
//   } catch (error) {
//     console.error("Error in EvaluatedCopiesService:", error);
//     throw new Error(`Failed to retrieve evaluated copies: ${error.message}`);
//   }
// };




/**
 * Assign a subject to an evaluator (*Checking existing assignments and reactivating if again assigned)
 * @param {string} evaluatorId - ID of the evaluator
 * @param {string} subjectCode - Subject code to assign
 * @param {string} examName - Name of the exam
 * @param {string} assignedBy - Admin user ID making the assignment
 * @returns {Promise<Object>} - Created or reactivated subject assignment record
 */
export const assignSubjectToEvaluator = async (evaluatorId, subjectCode, examName, assignedBy) => {
  try {
    // Validate evaluator exists and is active
    const evaluator = await UserLogin.findOne({ 
      where: { 
        uid: evaluatorId, 
        role: 'evaluator', 
        active: true 
      } 
    });
    
    if (!evaluator) {
      const error = new Error(`Evaluator with ID ${evaluatorId} not found or not active`);
      error.status = 404;
      throw error;
    }

    // Check if this subject is already assigned to this evaluator
    const existingActiveAssignment = await SubjectAssignment.findOne({
      where: {
        evaluator_id: evaluatorId,
        subject_code: subjectCode,
        exam_name: examName,
        active: true
      }
    });

    if (existingActiveAssignment) {
      return existingActiveAssignment; // Subject already assigned to this evaluator
    }

    // NEW: Check if this subject was previously assigned but is now inactive
    const existingInactiveAssignment = await SubjectAssignment.findOne({
      where: {
        evaluator_id: evaluatorId,
        subject_code: subjectCode,
        exam_name: examName,
        active: false
      }
    });

    // Check if there are any unassigned copies available for this subject
    const subjectData = await SubjectData.findOne({
      where: { SubjectID: subjectCode },
      attributes: ['subjectdata_id'],
      raw: true,
    });
    
    if (!subjectData) {
      throw new Error(`Subject with code ${subjectCode} not found`);
    }
    
    // Count available unassigned copies
    const availableCopiesCount = await Copy.count({
      where: {
        subjectdata_id: subjectData.subjectdata_id,
        is_assigned: false,
        is_evaluated: false,
      }
    });
    
    if (availableCopiesCount === 0) {
      const error = new Error(`No unassigned copies available for subject ${subjectCode}. Cannot assign to evaluator.`);
      error.status = 400;
      throw error;
    }

    // If there's an inactive assignment, reactivate it instead of creating a new one
    if (existingInactiveAssignment) {
      console.log(`Reactivating previously assigned subject ${subjectCode} for evaluator ${evaluatorId}`);
      
      // Update the existing assignment
      await existingInactiveAssignment.update({
        active: true,
        assigned_by: assignedBy,
        assigned_at: new Date()
      });
      
      return existingInactiveAssignment;
    }

    // Create a new subject assignment (only if no inactive assignment exists)
    const subjectAssignment = await SubjectAssignment.create({
      subject_code: subjectCode,
      exam_name: examName,
      evaluator_id: evaluatorId,
      assigned_by: assignedBy,
      assigned_at: new Date(),
      active: true
    });

    return subjectAssignment;
  } catch (error) {
    console.error('Error in assignSubjectToEvaluator:', error);
    throw error;
  }
};



// /**
//  * Assign a subject to an evaluator
//  * @param {string} evaluatorId - ID of the evaluator
//  * @param {string} subjectCode - Subject code to assign
//  * @param {string} examName - Name of the exam
//  * @param {string} assignedBy - Admin user ID making the assignment
//  * @returns {Promise<Object>} - Created subject assignment record
//  */
// export const assignSubjectToEvaluator = async (evaluatorId, subjectCode, examName, assignedBy) => {
//   try {
//     // Validate evaluator exists and is active
//     const evaluator = await UserLogin.findOne({ 
//       where: { 
//         uid: evaluatorId, 
//         role: 'evaluator', 
//         active: true 
//       } 
//     });
    
//     if (!evaluator) {
//       const error = new Error(`Evaluator with ID ${evaluatorId} not found or not active`);
//       error.status = 404;
//       throw error;
//     }

//     // Check if this subject is already assigned to this evaluator
//     const existingAssignment = await SubjectAssignment.findOne({
//       where: {
//         evaluator_id: evaluatorId,
//         subject_code: subjectCode,
//         exam_name: examName,
//         active: true
//       }
//     });

//     if (existingAssignment) {
//       return existingAssignment; // Subject already assigned to this evaluator
//     }

//     //*: Check if there are any unassigned copies available for this subject
//     const subjectData = await SubjectData.findOne({
//       where: { SubjectID: subjectCode },
//       attributes: ['subjectdata_id'],
//       raw: true,
//     });
    
//     if (!subjectData) {
//       throw new Error(`Subject with code ${subjectCode} not found`);
//     }
    
//     // Count available unassigned copies
//     const availableCopiesCount = await Copy.count({
//       where: {
//         subjectdata_id: subjectData.subjectdata_id,
//         is_assigned: false,
//         is_evaluated: false,
//       }
//     });
    
//     if (availableCopiesCount === 0) {
//       const error = new Error(`No unassigned copies available for subject ${subjectCode}. Cannot assign to evaluator.`);
//       error.status = 400;
//       throw error;
//     }

//     // Create a new subject assignment
//     const subjectAssignment = await SubjectAssignment.create({
//       subject_code: subjectCode,
//       exam_name: examName,
//       evaluator_id: evaluatorId,
//       assigned_by: assignedBy,
//       assigned_at: new Date(),
//       active: true
//     });

//     return subjectAssignment;
//   } catch (error) {
//     console.error('Error in assignSubjectToEvaluator:', error);
//     throw error;
//   }
// };


/** * Get allocation status for a specific subject
 * 
*/
export const getSubjectAllocationStatusService = async (subjectCode, examName) => {
  try {
    const subjectData = await SubjectData.findOne({
      where: { SubjectID: subjectCode },
      attributes: ['subjectdata_id'],
      raw: true,
    });
    
    if (!subjectData) {
      throw new Error(`Subject with code ${subjectCode} not found`);
    }
    
    // Get total, assigned and evaluated counts
    const totalCopies = await Copy.count({
      where: { subjectdata_id: subjectData.subjectdata_id }
    });
    
    const assignedCopies = await Copy.count({
      where: { 
        subjectdata_id: subjectData.subjectdata_id,
        is_assigned: true
      }
    });
    
    const evaluatedCopies = await Copy.count({
      where: {
        subjectdata_id: subjectData.subjectdata_id,
        is_evaluated: true
      }
    });
    
    return {
      totalCopies,
      assignedCopies,
      evaluatedCopies,
      availableCopies: totalCopies - assignedCopies,
      completionPercentage: totalCopies > 0 ? Math.round((evaluatedCopies / totalCopies) * 100) : 0
    };
  } catch (error) {
    console.error('Error in getSubjectAllocationStatus:', error);
    throw error;
  }
};






/**
 * Get all subjects assigned to evaluators with active batch status
 * @returns {Promise<Array>} - List of subject assignments with evaluator details and batch status
 */
export const getSubjectAssignmentsService = async () => {
  try {
    // Get all active subject assignments with evaluator info
    const assignments = await SubjectAssignment.findAll({
      where: { active: true },
      include: [
        {
          model: UserLogin,
          as: 'evaluator', 
          attributes: ['name', 'email'],
          required: false
        }
      ]
    });

    // Get all active batches in a separate query
    const activeBatches = await CopyBatchAssignment.findAll({
      where: { is_active: true },
      attributes: ['evaluator_id', 'subject_code'],
      raw: true
    });

    // Create a simple lookup map for quick batch status checking
    const activeBatchMap = {};
    activeBatches.forEach(batch => {
      const key = `${batch.evaluator_id}:${batch.subject_code}`;
      activeBatchMap[key] = true;
    });

    // Map assignments with batch status check
    return assignments.map(assignment => {
      const key = `${assignment.evaluator_id}:${assignment.subject_code}`;
      
      return {
        assignmentId: assignment.assignment_id,
        subjectCode: assignment.subject_code,
        examName: assignment.exam_name,
        evaluatorId: assignment.evaluator_id,
        evaluatorName: assignment.evaluator?.name || 'Unknown',
        evaluatorEmail: assignment.evaluator?.email || 'Unknown',
        assignedBy: assignment.assigned_by,
        assignedAt: assignment.assigned_at,
        active: assignment.active,
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
        evaluator_id: evaluatorId,
        subject_code: subjectCode,
        active: true
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
        evaluator_id: evaluatorId,
        subject_code: subjectCode,
        is_active: true,
        expires_at: {
          [Op.gt]: new Date() // Not expired yet
        }
      }
    });

    if (activeBatch) {
      const error = new Error(`Active copies exist - cannot unassign`);
      error.status = 400;
      throw error;
    }

    // Force cleanup of any expired batches before unassigning
    // This handles cases where the batch is expired but still marked as active
    await CopyBatchAssignment.update(
      { is_active: false },
      {
        where: {
          evaluator_id: evaluatorId,
          subject_code: subjectCode,
          is_active: true,
          expires_at: {
            [Op.lte]: new Date() // Already expired
          }
        }
      }
    );

    // Update the assignment to set active = false
    const updatedCount = await SubjectAssignment.update(
      { active: false },
      {
        where: {
          evaluator_id: evaluatorId,
          subject_code: subjectCode,
          active: true
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




//*V2 - single source clean

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
        copyid: copyId,
        status: {
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
        uid: assignedEvaluatorId,
        role: 'evaluator',
        active: true
      }
    });

    if (!evaluator) {
      const error = new Error(`Evaluator with ID ${assignedEvaluatorId} not found or not active`);
      error.status = 404;
      throw error;
    }
    
    // Check if the copy exists in the Copy table
    const copyRecord = await Copy.findOne({
      where: {
        copyid: copyId
      }
    });
    
    if (!copyRecord) {
      const error = new Error(`Copy with ID ${copyId} not found in the system`);
      error.status = 404;
      throw error;
    }

    // Start the transaction for both operations
    transaction = await sequelize.transaction();
    
    console.log("Starting transaction for reevaluation assignment");

    // Update the Copy record to set is_re_assigned flag
    await Copy.update(
      {
        is_re_assigned: true,
        current_evaluator_id: assignedEvaluatorId,
        updated_at: new Date()
      },
      {
        where: { copyid: copyId },
        transaction
      }
    );

    // Create a new re-evaluation request with correct field names from the model
    const reevaluationRequest = await CopyReevaluation.create({
      copyid: copyId,
      status: 'Assigned',
      assigned_evaluator_id: assignedEvaluatorId,
      assigned_at: new Date(),
      reason: 'Administrative re-evaluation request',
      is_checked: false
    }, { transaction });

    // Commit the transaction
    await transaction.commit();
    console.log("Transaction committed successfully");

    // Prepare response with copy details
    return {
      requestId: reevaluationRequest.request_id,
      copyId: reevaluationRequest.copyid,
      evaluatorId: reevaluationRequest.assigned_evaluator_id,
      status: reevaluationRequest.status,
      assignedAt: reevaluationRequest.assigned_at,
      copyDetails: {
        course: copyRecord.course,
        subjectName: copyRecord.subject_name,
        subjectCode: copyRecord.subject_id,
        examDate: copyRecord.exam_date
      }
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
//   let transaction;
  
//   try {
//     // First check if the copy is evaluated (outside transaction)
//     const isEvaluated = await CopyEval.findOne({
//       where: {
//         copyid: copyId,
//         del: 0,
//         status: 'Evaluated' // Ensure the copy is fully evaluated
//       }
//     });

//     if (!isEvaluated) {
//       const error = new Error(`Copy ${copyId} has not been evaluated yet and cannot be re-evaluated`);
//       error.status = 400; // Bad Request
//       throw error;
//     }

//     // Check for existing requests (outside transaction)
//     const existingRequest = await CopyReevaluation.findOne({
//       where: {
//         CopyID: copyId,
//         Status: {
//           [Op.in]: ['Pending', 'Assigned'] // Active statuses
//         }
//       }
//     });

//     if (existingRequest) {
//       const error = new Error(`Copy ${copyId} already has an active re-evaluation request`);
//       error.status = 409; // Conflict
//       throw error;
//     }

//     // Verify the evaluator exists (outside transaction)
//     const evaluator = await UserLogin.findOne({
//       where: {
//         Uid: assignedEvaluatorId,
//         Role: 'evaluator',
//         Active: true
//       }
//     });

//     if (!evaluator) {
//       const error = new Error(`Evaluator with ID ${assignedEvaluatorId} not found or not active`);
//       error.status = 404;
//       throw error;
//     }
    
//     // Verify the copy exists (outside transaction)
//     const copyExists = await SubjectData.findOne({
//       where: {
//         barcode: copyId
//       }
//     });
    
//     if (!copyExists) {
//       const error = new Error(`Copy with ID ${copyId} not found`);
//       error.status = 404;
//       throw error;
//     }

//     // Start the transaction only for the insert operation
//     transaction = await sequelize.transaction();
    
//     console.log("Starting transaction for reevaluation assignment");

//     // Create a new re-evaluation request
//     const reevaluationRequest = await CopyReevaluation.create({
//       CopyID: copyId,
//       Status: 'Assigned',
//       AssignedEvaluatorID: assignedEvaluatorId,
//       AssignedAt: new Date(),
//       Reason: 'Administrative re-evaluation request',
//       OriginalEvaluatorID: isEvaluated.eval_id,
//       OriginalMarks: isEvaluated.obt_mark
//     }, { transaction });

//     // Commit the transaction
//     await transaction.commit();
//     console.log("Transaction committed successfully");

//     return {
//       requestId: reevaluationRequest.RequestID,
//       copyId: reevaluationRequest.CopyID,
//       evaluatorId: reevaluationRequest.AssignedEvaluatorID,
//       status: reevaluationRequest.Status,
//       assignedAt: reevaluationRequest.AssignedAt,
//       originalMarks: reevaluationRequest.OriginalMarks,
//       originalEvaluatorId: reevaluationRequest.OriginalEvaluatorID
//     };
//   } catch (error) {
//     console.error('Error in assignCopyReevaluationService:', error);
    
//     // Only try to rollback if we have an active transaction
//     if (transaction && !transaction.finished) {
//       try {
//         console.log("Rolling back transaction due to error");
//         await transaction.rollback();
//       } catch (rollbackError) {
//         console.error('Error rolling back transaction:', rollbackError);
//       }
//     }
    
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
      requestId: request.request_id,
      copyId: request.copyid,
      status: request.status,
      reason: request.reason,
      evaluatorId: request.assigned_evaluator_id,
      assignedAt: request.assigned_at,
      submittedAt: request.submitted_at,
      reevaluatedMarks: request.reevaluated_marks,
      remarks: request.remarks,
      isChecked: request.is_checked
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


//?v2 Updated registerEvaluatorService function
// Update the registerEvaluatorService function
export const registerEvaluatorService = async (name, email, phoneNumber, aadhaarNumber, address, instituteName, instituteCode, facultyId) => {
  // Validate input for essential fields
  if (!name || !email || !phoneNumber) {
    const error = new Error("Name, email and phone number are required");
    error.status = 400;
    throw error;
  }

  // Check if email already exists
  const existingEmailUser = await UserLogin.findOne({ where: { email: email } });
  if (existingEmailUser) {
    const error = new Error("Email is already registered");
    error.status = 409;
    throw error;
  }
  
  // Check if phone number already exists
  const existingPhoneUser = await UserLogin.findOne({ where: { phone_number: phoneNumber } });
  if (existingPhoneUser) {
    const error = new Error("Phone number is already registered");
    error.status = 409;
    throw error;
  }

  // Check if Aadhaar number already exists (if provided)
  if (aadhaarNumber) {
    // Use UserProfile model to check aadhaar
    const existingAadhaarUser = await UserProfile.findOne({ where: { adhaar_number: aadhaarNumber } });
    if (existingAadhaarUser) {
      const error = new Error("Aadhaar number is already registered");
      error.status = 409;
      throw error;
    }
  }

  // Use a transaction to ensure both tables are updated together
  const transaction = await sequelize.transaction();

  try {
    // Generate a new unique UID
    const uid = await generateNewUID();
    
    // Generate a random temp pass
    const tempPassword = generateRandomPassword(6);
    
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
  
    // 1. Create the user in UserLogin table
    const newEvaluator = await UserLogin.create({
      name: name,
      email: email,
      phone_number: phoneNumber,
      uid: uid,
      pass: hashedPassword,
      role: "evaluator",
      active: true,
    }, { transaction });
    
    // 2. Create additional details in UserProfile table
    await UserProfile.create({
      uid: uid,
      adhaar_number: aadhaarNumber,
      address: address,
      institute_name: instituteName,
      institute_code: instituteCode,
      faculty_id: facultyId,
      phone_number: phoneNumber // Store phone number in both tables for now
    }, { transaction });

    // Commit the transaction
    await transaction.commit();
    
    // Send credentials via email
    try {
      await sendEvaluatorCredentials(name, email, uid, tempPassword);
      console.log(`Credentials sent to ${email} successfully`);
    } catch (emailError) {
      console.error("Failed to send credentials email:", emailError);
      // We don't throw here to avoid rolling back the user creation
      // Just log the error and continue
    }
    
    return {
      success: true,
      uid: newEvaluator.uid,
      // password: tempPassword, // Plain text password (only for initial display)
      name: newEvaluator.name,
      email: newEvaluator.email,
      emailSent: true
    };

  } catch (error) {
    // Rollback the transaction if any error occurs
    await transaction.rollback();
    console.error("Error registering evaluator:", error);
    const serviceError = new Error("Failed to register evaluator");
    serviceError.status = 500;
    serviceError.originalError = error;
    throw serviceError;
  }
};



// // Update your existing function
// export const registerEvaluatorService = async (name, email, phoneNumber) => {
//   // Validate input
//   if (!name || !email || !phoneNumber) {
//     const error = new Error("Name, email and phone number are required");
//     error.status = 400;
//     throw error;
//   }

//   // Check if email already exists
//   const existingEmailUser = await UserLogin.findOne({ where: { email: email } });
//   if (existingEmailUser) {
//     const error = new Error("Email is already registered");
//     error.status = 409;
//     throw error;
//   }
  
//   // Check if phone number already exists
//   const existingPhoneUser = await UserLogin.findOne({ where: { phone_number: phoneNumber } });
//   if (existingPhoneUser) {
//     const error = new Error("Phone number is already registered");
//     error.status = 409;
//     throw error;
//   }

//   try {
//     // Generate a new unique UID
//     const uid = await generateNewUID();
    
//     // Generate a random temp pass
//     const tempPassword = generateRandomPassword(6);
    
//     const hashedPassword = await bcrypt.hash(tempPassword, 10);
  
//     const newEvaluator = await UserLogin.create({
//       name: name,
//       email: email,
//       phone_number: phoneNumber,
//       uid: uid,
//       pass: hashedPassword,
//       role: "evaluator",
//       active: true,
//     });
    
//     // Send credentials via email
//     try {
//       await sendEvaluatorCredentials(name, email, uid, tempPassword);
//       console.log(`Credentials sent to ${email} successfully`);
//     } catch (emailError) {
//       console.error("Failed to send credentials email:", emailError);
//       // We don't throw here to avoid rolling back the user creation
//       // Just log the error and continue
//     }
    
//     return {
//       success: true,
//       uid: newEvaluator.uid,
//       password: tempPassword, // Plain text password (only for initial display)
//       name: newEvaluator.name,
//       email: newEvaluator.email,
//       emailSent: true
//     };


//   } catch (error) {
//     console.error("Error registering evaluator:", error);
//     const serviceError = new Error("Failed to register evaluator");
//     serviceError.status = 500;
//     serviceError.originalError = error;
//     throw serviceError;
//   }
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
      order: [['uid', 'DESC']], // Simple ordering by UID
      limit: 1,
    });

    let newUID = "UID001"; // Default UID

    if (lastRecord) {
      // Extract the last UID and increment it
      const lastUID = lastRecord.uid;
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
 * Get checked (evaluated) copies by pack ID
 * @param {string} packId - The pack ID to get checked copies for
 * @returns {Promise<Object>} Details of checked copies
 */
export const getCheckedCopiesService = async (packId) => {
  if (!packId) {
    const error = new Error("Pack ID is required");
    error.status = 400;
    throw error;
  }

  try {
    // Step 1: Find all copies for the given packId
    const copies = await Copy.findAll({
      where: { pack_id: packId },
      attributes: ['copyid', 'bag_id', 'pack_id'],
      raw: true,
    });

    if (!copies || copies.length === 0) {
      return {
        checkedCount: 0,
        checkedCopies: [],
        message: "No copies found for the given pack ID"
      };
    }

    const copyIds = copies.map(c => c.copyid);

    // Step 2: Find checked assignments for these copies
    const checkedAssignments = await CopyAssignments.findAll({
      where: {
        copyid: copyIds,
        is_checked: true
      },
      attributes: ['copyid', 'evaluator_id', 'assigned_at', 'checked_at'],
      raw: true
    });

    // Step 3: Find evaluated copies from CopyEval (definitive source)
    const evaluatedCopies = await CopyEval.findAll({
      where: {
        copyid: copyIds,
        del: false,
        status: {
          [Op.in]: ['Evaluated', 'Reevaluated']
        }
      },
      attributes: ['copyid', 'eval_id', 'created_at', 'updated_at', 'status', 'obt_mark', 'max_mark'],
      raw: true
    });

    // Combine unique copies from both sources
    const uniqueCopyIds = new Set();
    let allCheckedCopies = [];

    // Process assignment records first
    checkedAssignments.forEach(assignment => {
      if (!uniqueCopyIds.has(assignment.copyid)) {
        uniqueCopyIds.add(assignment.copyid);
        allCheckedCopies.push({
          copyId: assignment.copyid,
          evaluatorId: assignment.evaluator_id,
          source: 'assignment',
          assignedAt: assignment.assigned_at,
          checkedAt: assignment.checked_at
        });
      }
    });

    // Then add evaluated copies that aren't already included
    evaluatedCopies.forEach(evalCopy => {
      if (!uniqueCopyIds.has(evalCopy.copyid)) {
        uniqueCopyIds.add(evalCopy.copyid);
        allCheckedCopies.push({
          copyId: evalCopy.copyid,
          evaluatorId: evalCopy.eval_id,
          source: 'copyeval',
          evaluatedAt: evalCopy.updated_at,
          status: evalCopy.status,
          obtainedMarks: evalCopy.obt_mark,
          maxMarks: evalCopy.max_mark
        });
      }
    });

    // Get evaluator information for all evaluator IDs
    const evaluatorIds = allCheckedCopies.map(copy => copy.evaluatorId);
    const uniqueEvaluatorIds = [...new Set(evaluatorIds)];

    const evaluatorsMap = {};
    if (uniqueEvaluatorIds.length > 0) {
      const evaluatorRecords = await UserLogin.findAll({
        where: { uid: uniqueEvaluatorIds },
        attributes: ['uid', 'name'],
        raw: true
      });

      evaluatorRecords.forEach(evaluator => {
        evaluatorsMap[evaluator.uid] = evaluator.name;
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



//** New apis for reevaluation with new str */

/**
 * Get evaluated copies suitable for reevaluation
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} List of evaluated copies
 */
export const getEvaluatedCopiesForReevaluationService = async (filters = {}) => {
  try {
    const { subjectCode, examName, evaluatorId, searchQuery } = filters;
    
    // Base where clause - must be evaluated and not rejected
    const whereClause = {
      is_evaluated: true,
      is_rejected: false,
      // Don't include copies already in reevaluation
      is_re_assigned: false
    };
    
    // Add subject code filter if provided
    if (subjectCode) {
      // First find the subjectdata_id for this subject code
      const subjectData = await SubjectData.findOne({
        where: { SubjectID: subjectCode },
        attributes: ['subjectdata_id'],
        raw: true
      });
      
      if (subjectData) {
        whereClause.subjectdata_id = subjectData.subjectdata_id;
      }
    }
    
    // Add evaluator filter if provided
    if (evaluatorId) {
      whereClause.current_evaluator_id = evaluatorId;
    }
    
    // Add search by copy ID
    if (searchQuery) {
      whereClause.copyid = {
        [Op.like]: `%${searchQuery}%`
      };
    }
    
    // Include joins to get subject and evaluator details
    const copies = await Copy.findAll({
      where: whereClause,
      include: [
        {
          model: SubjectData,
          as: 'subjectData',
          attributes: ['Course', 'Subject', 'SubjectID']
        }
      ],
      limit: 100, // Limit results to avoid performance issues
      attributes: [
        'copyid', 
        'current_evaluator_id', 
        'evaluation_status', 
        'is_evaluated',
        'bag_id',
        'pack_id',
        'updated_at'
      ]
    });
    
    // Get the evaluator details for these copies
    const evaluatorIds = [...new Set(copies.map(copy => copy.current_evaluator_id).filter(Boolean))];
    let evaluatorMap = {};
    
    if (evaluatorIds.length > 0) {
      const evaluators = await UserLogin.findAll({
        where: { uid: evaluatorIds },
        attributes: ['uid', 'name'],
        raw: true
      });
      
      evaluatorMap = evaluators.reduce((map, evaluator) => {
        map[evaluator.uid] = evaluator.name;
        return map;
      }, {});
    }
    
    // Get evaluation details from CopyEval for obtained marks
    const copyIds = copies.map(copy => copy.copyid);
    let evalDataMap = {};
    
    if (copyIds.length > 0) {
      const evalData = await CopyEval.findAll({
        where: { 
          copyid: copyIds,
          del: false, // Not deleted
          status: 'Evaluated' // Only evaluated
        },
        attributes: ['copyid', 'obt_mark', 'max_mark', 'eval_id'],
        raw: true
      });
      
      evalDataMap = evalData.reduce((map, evalCopy) => {
        map[evalCopy.copyid] = {
          obtainedMarks: evalCopy.obt_mark,
          maxMarks: evalCopy.max_mark,
          evaluatorId: evalCopy.eval_id
        };
        return map;
      }, {});
    }
    
    // Format the response
    return copies.map(copy => {
      const evalData = evalDataMap[copy.copyid] || {};
      
      return {
        copyId: copy.copyid,
        evaluatorId: copy.current_evaluator_id,
        evaluatorName: evaluatorMap[copy.current_evaluator_id] || 'Unknown',
        evaluationStatus: copy.evaluation_status,
        isEvaluated: copy.is_evaluated,
        bagId: copy.bag_id,
        packId: copy.pack_id,
        evaluatedAt: copy.updated_at,
        obtainedMarks: evalData.obtainedMarks,
        maxMarks: evalData.maxMarks,
        course: copy.subjectData?.Course || 'Unknown',
        subject: copy.subjectData?.Subject || 'Unknown',
        subjectCode: copy.subjectData?.SubjectID || 'Unknown'
      };
    });
    
  } catch (error) {
    console.error("Error in getEvaluatedCopiesForReevaluationService:", error);
    throw error;
  }
};

/**
 * Get copy details by ID
 * @param {string} copyId - The copy ID to retrieve
 * @returns {Promise<Object>} Copy details
 */
export const getCopyByIdService = async (copyId) => {
  try {
    // Find the copy with associated subject data
    const copy = await Copy.findOne({
      where: { copyid: copyId },
      include: [
        {
          model: SubjectData,
          as: 'subjectData',
          attributes: ['Course', 'Subject', 'SubjectID']
        }
      ]
    });
    
    if (!copy) {
      return null;
    }
    
    // Get evaluation data if it exists
    const evalData = await CopyEval.findOne({
      where: { 
        copyid: copyId,
        del: false,
        status: 'Evaluated'
      },
      attributes: ['copyid', 'obt_mark', 'max_mark', 'eval_id', 'created_at']
    });
    
    // Get evaluator name
    let evaluatorName = 'Unknown';
    if (copy.current_evaluator_id) {
      const evaluator = await UserLogin.findOne({
        where: { uid: copy.current_evaluator_id },
        attributes: ['name'],
        raw: true
      });
      
      if (evaluator) {
        evaluatorName = evaluator.name;
      }
    }
    
    // Return formatted copy details
    return {
      copyId: copy.copyid,
      bagId: copy.bag_id,
      packId: copy.pack_id,
      evaluatorId: copy.current_evaluator_id,
      evaluatorName,
      evaluationStatus: copy.evaluation_status,
      isEvaluated: copy.is_evaluated,
      isRejected: copy.is_rejected,
      isReassigned: copy.is_re_assigned,
      course: copy.subjectData?.Course || 'Unknown',
      subject: copy.subjectData?.Subject || 'Unknown',
      subjectCode: copy.subjectData?.SubjectID || 'Unknown',
      obtainedMarks: evalData?.obt_mark,
      maxMarks: evalData?.max_mark,
      evaluatedAt: evalData?.created_at || copy.updated_at
    };
    
  } catch (error) {
    console.error("Error in getCopyByIdService:", error);
    throw error;
  }
};





/**
 * Get evaluation statistics
 * @param {string} timeRange - Time range for the statistics (all, today, week, month)
 * @returns {Promise<Object>} - Statistics about evaluations and reevaluations
 */
export const getEvaluationStatsService = async (timeRange = 'all') => {
  try {
    // Set up date filters based on timeRange
    const whereClause = {};
    
    if (timeRange !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (timeRange) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          // Start of the current week (Sunday)
          startDate = new Date(now);
          startDate.setDate(now.getDate() - now.getDay());
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'month':
          // Start of the current month
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = null;
      }
      
      if (startDate) {
        whereClause.updated_at = {
          [Op.gte]: startDate
        };
      }
    }
    
    // Get total copies for perspective
    const totalCopies = await Copy.count();
    
    // Count total evaluations (copies that have been evaluated)
    const totalEvaluations = await Copy.count({
      where: {
        is_evaluated: true,
        ...whereClause
      }
    });

    // Count total reevaluation requests
    const totalReevaluations = await CopyReevaluation.count({
      ...whereClause
    });
    
    // Count total rejected copies
    const totalRejected = await Copy.count({
      where: {
        is_rejected: true,
        ...whereClause
      }
    });
    
    return {
      totalCopies,
      totalEvaluations,
      totalReevaluations,
      totalRejected
    };
  } catch (error) {
    console.error("Error in getEvaluationStatsService:", error);
    throw new Error(`Failed to get evaluation statistics: ${error.message}`);
  }
};







