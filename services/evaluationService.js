import { CopyEval } from '../models/index.js';

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