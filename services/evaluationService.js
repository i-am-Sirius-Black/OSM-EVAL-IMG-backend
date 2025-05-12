import { CopyAssignments, CopyEval, EvaluationAutosave, Questions } from '../models/index.js';

/**
 * Save an evaluation record
 * @param {Object} evaluationData - The evaluation data to save
 * @returns {Object} The saved evaluation record
 */
export const saveEvaluationRecord = async (evaluationData) => {
  const {
    copyid,
    obt_mark,
    max_mark,
    status,
    eval_time,
    eval_id,
    reject_reason='',
    bag_id,
  } = evaluationData;

  // Validate required fields
  if (!copyid || !bag_id) {
    const error = new Error("Copy ID and Bag ID are required");
    error.status = 400;
    throw error;
  }

  // Create the evaluation record
  const newEval = await CopyEval.create({
    copyid,
    obt_mark,
    max_mark,
    status: status || "Not-Evaluated", // Default if not provided
    eval_time,
    eval_id,
    reject_reason,
    bag_id,
  });

  return newEval;
};

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

  // Validate required fields
  if (!copyId || !reason || !userId || !bagId) {
    const error = new Error("Copy ID, reason, user ID, and Bag ID are required");
    error.status = 400;
    throw error;
  }

  // Check if the copy has already been rejected
  const existingRecord = await CopyEval.findOne({ where: { copyid: copyId } });
  if (existingRecord) {
    const error = new Error("A record for this Copy ID already exists");
    error.status = 409;
    throw error;
  }

  // Create a new record in the CopyEval table for the rejected copy
  const response = await CopyEval.create({
    copyid: copyId,
    status: copyStatus || "Rejected",
    reject_reason: reason,
    eval_id: userId,
    bag_id: bagId,
    del: 1, // Mark as deleted (1)
  });

  return response;
};

/**
 * Unreject a previously rejected copy
 * @param {string} copyId - The ID of the copy to unreject
 * @returns {Promise<boolean>} Success status
 */
export const unrejectCopyRecord = async (copyId) => {
  // Validate required fields
  if (!copyId) {
    const error = new Error("Copy ID is required");
    error.status = 400;
    throw error;
  }

  // Find the rejected record for the given Copy ID
  const existingRecord = await CopyEval.findOne({
    where: { copyid: copyId, del: 1 }, // Filter for deleted records
  });

  if (!existingRecord) {
    const error = new Error("No rejected record found");
    error.status = 404;
    throw error;
  }

  // Update the record to mark it as not deleted (0)
  await existingRecord.update(
    { status: "Not-Evaluated", reject_reason: '', del: 0 }
  );

  return true;
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
      where: { PaperID: paperId },
      attributes: [
        'Sno',
        'PaperID',
        'QNo',
        'MaxMark'
      ],
      order: [['QNo', 'ASC']], // Order by question number
      raw: true
    });

    // Transform data to match frontend expectations if needed
    const formattedQuestions = questions.map(q => ({
      sno: q.Sno,
      paperId: q.PaperID,
      qNo: q.QNo,
      maxMark: parseFloat(q.MaxMark) // Convert to number from decimal
    }));

    return formattedQuestions;
  } catch (error) {
    console.error('Error fetching questions:', error);
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
        EvaluatorID: evaluatorId,
        // Only return copies that haven't been fully evaluated yet
        IsChecked: false
      },
      attributes: ['CopyBarcode', 'AssignedAt'],
      raw: true
    });


    // // Format the response to include both copyId and assignedAt
    // const copies = assignments.map(assignment => ({
    //   copyId: assignment.CopyBarcode,
    //   assignedAt: assignment.AssignedAt
    // }));


        // Check for any partial copies in EvaluationAutosave table
    const partialCopies = await EvaluationAutosave.findAll({
      where: {
        EvaluatorID: evaluatorId
      },
      attributes: ['CopyID'], // Make sure this matches your actual column name
      raw: true
    });

    // Create a Set of partial copy IDs for faster lookup
    const partialCopyIdsSet = new Set(partialCopies.map(copy => copy.CopyID));

    // Format the response to include copyId, assignedAt, and partial flag
    const copies = assignments.map(assignment => ({
      copyId: assignment.CopyBarcode,
      assignedAt: assignment.AssignedAt,
      partial: partialCopyIdsSet.has(assignment.CopyBarcode) // true if copy exists in autosave, false otherwise
    }));
    
    // Log results for debugging
    console.log(`Found ${copies.length} copies assigned to evaluator ${evaluatorId}`);
    console.log("Assignment data:", { evaluatorId });
    return copies;
  } catch (error) {
    console.error(`Error in getCopiesToEvaluateService: ${error.message}`);
    throw new Error(`Failed to retrieve copies for evaluator: ${error.message}`);
  }
}






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
        EvaluatorID: evaluatorId,
       IsChecked: true // Only count copies that have been evaluated
      }
    });
    
    // Get pending count
    const pendingCount = await CopyAssignments.count({
      where: {
        EvaluatorID: evaluatorId,
        IsChecked: false
      }
    });

    //Get partially evaluated count
    const partialCount = await EvaluationAutosave.count({
      where: {
        EvaluatorID: evaluatorId
      }
    });
    
    // Get total assigned count
    const totalAssigned = await CopyAssignments.count({
      where: {
        EvaluatorID: evaluatorId
      }
    });
    
    console.log(`Evaluation stats for evaluator ${evaluatorId}:`, {
      evaluated: evaluatedCount,
      pending: pendingCount,
      total: totalAssigned,
      partial: partialCount 
    });
    
    return {
      evaluated: evaluatedCount,
      pending: pendingCount,
      total: totalAssigned,
      partial: partialCount
    };
  } catch (error) {
    console.error(`Error in getEvaluationStatsService: ${error.message}`);
    throw new Error(`Failed to retrieve evaluation stats for evaluator: ${error.message}`);
  }
}