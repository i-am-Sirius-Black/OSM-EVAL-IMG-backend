import { Op } from "sequelize";
import { sequelize } from "../config/db.js";
import {
  Copy,
  CopyAnnotation,
  CopyAssignments,
  CopyEval,
  Questions,
} from "../models/index.js";

/**
 * Save an evaluation data (eval + annotation) only if it doesn't already exist
 * @param {Object} data - The evaluation data to save
 * @returns {Object} Result of the operation with success status and message
 */
export const saveEvaluationAndAnnotations = async (data) => {
  const {
    copyid,
    obt_mark,
    max_mark,
    status,
    eval_time,
    eval_id,
    bag_id,
    annotations,
    drawAnnotations,
  } = data;

  const transaction = await sequelize.transaction();
  try {
    // First check if the copy exists and is not rejected
    const copyRecord = await Copy.findOne({ 
      where: { copyid: copyid },
      transaction 
    });
    
    if (!copyRecord) {
      await transaction.rollback();
      return {
        success: false,
        message: `Copy with ID ${copyid} not found`,
      };
    }
    
    // Check if the copy is rejected
    if (copyRecord.is_rejected) {
      await transaction.rollback();
      return {
        success: false,
        message: "Cannot evaluate a rejected copy. The copy must be unrejected first.",
      };
    }

    // Check if CopyEval record already exists
    let evalRecord = await CopyEval.findOne({ where: { copyid }, transaction });
    if (evalRecord) {
      // Record already exists, don't update it
      await transaction.rollback();
      return {
        success: false,
        message: "Evaluation already exists for this copy",
        data: evalRecord,
      };
    }

    // Create new CopyEval record
    evalRecord = await CopyEval.create(
      {
        copyid,
        obt_mark,
        max_mark,
        status,
        eval_time,
        eval_id,
        bag_id,
      },
      { transaction }
    );

    // Check if CopyAnnotation record already exists
    let annotationRecord = await CopyAnnotation.findOne({
      where: { copyid: copyid },
      transaction,
    });

    if (annotationRecord) {
      // Annotation already exists, don't update it
      await transaction.rollback();
      return {
        success: false,
        message: "Annotations already exist for this copy",
        data: null,
      };
    }

    // Create new CopyAnnotation record
    await CopyAnnotation.create(
      {
        copyid: copyid,
        annotations: JSON.stringify(annotations || []),
        draw_annotations: JSON.stringify(drawAnnotations || []),
      },
      { transaction }
    );

    // Update the assignment record to mark it as checked
    const assignment = await CopyAssignments.findOne({
      where: {
        copyid: copyid,
        evaluator_id: eval_id,
      },
      transaction,
    });

    if (assignment) {
      await assignment.update(
        {
          is_checked: true,
          checked_at: new Date(),
        },
        { transaction }
      );
    }

    // Update the Copy table to mark it as evaluated
    await copyRecord.update(
      {
        is_evaluated: true,
        is_rejected: false, // Ensure it's not marked as rejected
        evaluation_status: status,
        current_evaluator_id: eval_id
      },
      { transaction }
    );

    await transaction.commit();
    return {
      success: true,
      message: "Evaluation and annotations saved successfully",
      data: evalRecord,
    };
  } catch (error) {
    await transaction.rollback();
    console.error("Error in saveEvaluationAndAnnotations:", error);
    throw new Error(`Failed to save evaluation: ${error.message}`);
  }
};




// /**updatedv2
//  * Save an evaluation data (eval + annotation)
//  * @param {Object} data - The evaluation data to save
//  * @returns {Object} The saved evaluation data
//  */
// export const saveEvaluationAndAnnotations = async (data) => {
//   const {
//     copyid,
//     obt_mark,
//     max_mark,
//     status,
//     eval_time,
//     eval_id,
//     bag_id,
//     annotations,
//     drawAnnotations,
//   } = data;

//   const transaction = await sequelize.transaction();
//   try {
//     // Save or update CopyEval
//     let evalRecord = await CopyEval.findOne({ where: { copyid }, transaction });
//     if (evalRecord) {
//       await evalRecord.update({
//         obt_mark,
//         max_mark,
//         status,
//         eval_time,
//         eval_id,
//         bag_id,
//       }, { transaction });
//     } else {
//       evalRecord = await CopyEval.create({
//         copyid,
//         obt_mark,
//         max_mark,
//         status,
//         eval_time,
//         eval_id,
//         bag_id,
//       }, { transaction });
//     }

//     // Save or update CopyAnnotation
//     let annotationRecord = await CopyAnnotation.findOne({ where: { copy_id: copyid }, transaction });
//     if (annotationRecord) {
//       await annotationRecord.update({
//         annotations: JSON.stringify(annotations || []),
//         draw_annotations: JSON.stringify(drawAnnotations || []),
//       }, { transaction });
//     } else {
//       await CopyAnnotation.create({
//         copy_id: copyid,
//         annotations: JSON.stringify(annotations || []),
//         draw_annotations: JSON.stringify(drawAnnotations || []),
//       }, { transaction });
//     }

//     await transaction.commit();
//     return { message: "Evaluation and annotations saved", data: evalRecord };
//   } catch (error) {
//     await transaction.rollback();
//     throw error;
//   }
// };

/**
 * Get all rejected copies
 * @returns {Promise<Array>} List of rejected copies
 */
export const getRejectedCopies = async () => {
  const rejectedCopies = await CopyEval.findAll({
    where: { del: 1 }, // Filter for deleted records
    attributes: ["copyid", "reject_reason", "eval_id", "bag_id"],
    raw: true,
  });

  return rejectedCopies;
};

/**
 * Reject a copy
 * @param {Object} rejectData - Data for rejecting a copy
 * @returns {Object} The created reject record
 */
export const rejectCopyRecord = async (rejectData) => {
  const { copyId, reason, userId, bagId, copyStatus } = rejectData;
  const transaction = await sequelize.transaction();

  try {
    // Validate required fields
    if (!copyId || !reason || !userId || !bagId) {
      throw new Error("Copy ID, reason, user ID, and Bag ID are required");
    }

    // First check if this copy already has a CopyEval record (evaluated or rejected)
    const existingRecord = await CopyEval.findOne({ 
      where: { copyid: copyId },
      transaction
    });
    
    if (existingRecord) {
      await transaction.rollback();
      const error = new Error("A record for this Copy ID already exists");
      error.status = 409;
      throw error;
    }

    // Check if copy exists in Copy table and update it
    const copyRecord = await Copy.findOne({ 
      where: { copyid: copyId },
      transaction 
    });
    
    if (!copyRecord) {
      await transaction.rollback();
      const error = new Error(`Copy with ID ${copyId} not found`);
      error.status = 404;
      throw error;
    }

    // Update the Copy table to mark it as rejected
    await copyRecord.update({
      is_rejected: true,
      evaluation_status: 'Rejected',
      current_evaluator_id: userId
    }, { transaction });

    // Create a new record in the CopyEval table for the rejected copy
    const response = await CopyEval.create({
      copyid: copyId,
      status: copyStatus || "Rejected",
      reject_reason: reason,
      eval_id: userId,
      bag_id: bagId,
      del: 1 // Mark as deleted (1)
    }, { transaction });

    // Update the assignment record if exists
    const assignment = await CopyAssignments.findOne({
      where: {
        copyid: copyId,
        evaluator_id: userId,
      },
      transaction,
    });

    if (assignment) {
      await assignment.update(
        {
          is_checked: true, // Mark as checked since the evaluator made a decision
          checked_at: new Date(),
        },
        { transaction }
      );
    }

    await transaction.commit();
    return response;
  } catch (error) {
    await transaction.rollback();
    console.error("Error in rejectCopyRecord:", error);
    throw error;
  }
};


/**
 * Unreject a previously rejected copy (deleting old copyassignment)
 * @param {string} copyId - The ID of the copy to unreject
 * @returns {Promise<boolean>} Success status
 */
export const unrejectCopyRecord = async (copyId) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Validate required fields
    if (!copyId) {
      throw new Error("Copy ID is required");
    }

    // Find the rejected record in CopyEval
    const existingRecord = await CopyEval.findOne({
      where: { 
        copyid: copyId, 
        del: true,
        status: "Rejected"
      },
      transaction
    });

    if (!existingRecord) {
      await transaction.rollback();
      const error = new Error("No rejected record found");
      error.status = 404;
      throw error;
    }

    // Find the copy in Copy table
    const copyRecord = await Copy.findOne({ 
      where: { copyid: copyId },
      transaction 
    });
    
    if (!copyRecord) {
      await transaction.rollback();
      const error = new Error(`Copy with ID ${copyId} not found`);
      error.status = 404;
      throw error;
    }

    // Update the Copy table to remove rejection flag and make available for assignment
    await copyRecord.update({
      is_rejected: false,
      is_assigned: false, // Make the copy available for new assignments
      evaluation_status: 'Not-Evaluated',
      is_evaluated: false
    }, { transaction });

    // Delete the CopyEval record entirely
    await existingRecord.destroy({ transaction });

    // DELETE the assignment record entirely rather than updating it
    // This ensures the copy is completely removed from the original evaluator's queue
    await CopyAssignments.destroy({
      where: { copyid: copyId },
      transaction
    });

    await transaction.commit();
    return true;
  } catch (error) {
    await transaction.rollback();
    console.error("Error in unrejectCopyRecord:", error);
    throw error;
  }
};


/**
 * Get all questions for a specific paper
 * @param {number} paperId - The ID of the paper
 * @returns {Promise<Array>} List of questions for the paper
 */
export const getQuestionsService = async (paperId) => {
  // Validate required field
  if (!paperId) {
    const error = new Error("Paper ID is required");
    error.status = 400;
    throw error;
  }

  try {
    // Fetch questions for the specified paper ID
    const questions = await Questions.findAll({
      where: { paper_id: paperId },
      attributes: ["sno", "paper_id", "q_no", "max_mark"],
      order: [["q_no", "ASC"]], // Order by question number
      raw: true,
    });

    // Handle empty results gracefully
    if (!questions || questions.length === 0) {
      console.log(`No questions found for paper ID: ${paperId}`);
      return []; // Return empty array instead of error
    }

    // Transform data to match frontend expectations if needed
    const formattedQuestions = questions.map((q) => ({
      sno: q.sno,
      paperId: q.paper_id,
      qNo: q.q_no,
      maxMark: parseFloat(q.max_mark), // Convert to number from decimal
    }));

    return formattedQuestions;
  } catch (error) {
    console.error("Error fetching questions:", error);
    throw error;
  }
};




/**
 * Get copies assigned to an evaluator
 * @param {string} evaluatorId - The evaluator's ID
 * @returns {Promise<Array>} - Array of copy objects with copyId and assignedAt date
 */
export const getCopiesToEvaluateService = async (evaluatorId) => {
  try {
    // Query copy assignments table to get copies assigned to this evaluator
    const assignments = await CopyAssignments.findAll({
      where: {
        evaluator_id: evaluatorId,
        is_checked: false,
      },
      attributes: ["copyid", "assigned_at"],
      raw: true,
    });

    // Format the response to include copyId and assignedAt
    const copies = assignments.map((assignment) => ({
      copyId: assignment.copyid,
      assignedAt: assignment.assigned_at,
      // No partial flag since EvaluationAutosave is deprecated
    }));

    // Log results for debugging
    console.log(
      `Found ${copies.length} copies assigned to evaluator ${evaluatorId}`
    );
    return copies;
  } catch (error) {
    console.error(`Error in getCopiesToEvaluateService: ${error.message}`);
    throw new Error(
      `Failed to retrieve copies for evaluator: ${error.message}`
    );
  }
};

/**
 * Get evaluation statistics for an evaluator
 * @param {string} evaluatorId - The evaluator's ID
 * @returns {Promise<Object>} - Object containing evaluation statistics
 */
export const getEvaluationStatsService = async (evaluatorId) => {
  try {
    // Get evaluated count
    const evaluatedCount = await CopyAssignments.count({
      where: {
        evaluator_id: evaluatorId,
        is_checked: true, // Only count copies that have been evaluated
      },
    });

    // Get pending count
    const pendingCount = await CopyAssignments.count({
      where: {
        evaluator_id: evaluatorId,
        is_checked: false,
      },
    });

    // Get total assigned count
    const totalAssigned = await CopyAssignments.count({
      where: {
        evaluator_id: evaluatorId,
      },
    });

    console.log(`Evaluation stats for evaluator ${evaluatorId}:`, {
      evaluated: evaluatedCount,
      pending: pendingCount,
      total: totalAssigned,
    });

    return {
      evaluated: evaluatedCount,
      pending: pendingCount,
      total: totalAssigned,
    };
  } catch (error) {
    console.error(`Error in getEvaluationStatsService: ${error.message}`);
    throw new Error(
      `Failed to retrieve evaluation stats for evaluator: ${error.message}`
    );
  }
};










/**
 * Get the next copy to evaluate in the current batch
 * @param {string} currentCopyId - The current copy ID
 * @param {string} evaluatorId - The evaluator's ID
 * @param {string} subjectCode - The subject code
 * @returns {Promise<Object>} The next copy or null if no more copies
 */
export const getNextCopyInBatchService = async (currentCopyId, evaluatorId, subjectCode) => {
  try {
    // Input validation
    if (!currentCopyId || !evaluatorId) {
      throw new Error("Copy ID and evaluator ID are required");
    }

    // 1. First get the batch ID for the current copy
    const currentAssignment = await CopyAssignments.findOne({
      where: { 
        copyid: currentCopyId,
        evaluator_id: evaluatorId
      },
      attributes: ['batch_id'],
      raw: true
    });

    if (!currentAssignment || !currentAssignment.batch_id) {
      console.log(`No batch found for copy ${currentCopyId} and evaluator ${evaluatorId}`);
      return null;
    }

    const batchId = currentAssignment.batch_id;

    // 2. Check if the batch is still active
    const batchInfo = await sequelize.models.tbl_copy_batch_assignments.findOne({
      where: {
        batch_id: batchId,
        evaluator_id: evaluatorId,
        is_active: true,
        subject_code: subjectCode
      },
      raw: true
    });

    if (!batchInfo) {
      console.log(`Batch ${batchId} is not active for evaluator ${evaluatorId}`);
      return null;
    }

    // 3. Find the next unchecked copy in the same batch
    const nextCopy = await CopyAssignments.findOne({
      where: {
        batch_id: batchId,
        evaluator_id: evaluatorId,
        is_checked: false,
        copyid: { [Op.ne]: currentCopyId }
      },
      attributes: ['copyid'],
      order: [['assignment_id', 'ASC']], // Get the next copy in sequence
      raw: true
    });

    if (!nextCopy) {
      console.log(`No more copies to evaluate in batch ${batchId} for evaluator ${evaluatorId}`);
      return null;
    }

    // Get basic information about the copy
    const copyInfo = await Copy.findOne({
      where: { copyid: nextCopy.copyid },
      attributes: ['copyid', 'evaluation_status'],
      raw: true
    });

    return {
      copyId: nextCopy.copyid,
      status: copyInfo ? copyInfo.evaluation_status : 'PENDING'
    };
  } catch (error) {
    console.error(`Error in getNextCopyInBatchService: ${error.message}`);
    throw new Error(`Failed to get next copy: ${error.message}`);
  }
};



