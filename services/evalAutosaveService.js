import { EvaluationAutosave } from "../models/index.js";


/**
 * Save or update evaluation progress
 * @param {string} evaluatorId - The evaluator's ID
 * @param {string} copyId - The copy ID being evaluated
 * @param {object} annotations - Annotation data (will be stored as JSON)
 * @param {object} marks - Marking data (will be stored as JSON)
 * @returns {Promise<object>} - The saved autosave record
 */
export const saveEvaluationProgress = async (evaluatorId, copyId, annotations, marks, seconds) => {
  try {
    // Check if an autosave record already exists for this evaluator and copy
    const existingRecord = await EvaluationAutosave.findOne({
      where: {
        EvaluatorID: evaluatorId,
        CopyID: copyId
      }
    });

    if (existingRecord) {
      // Update existing record
      await existingRecord.update({
        Annotations: JSON.stringify(annotations),
        Marks: JSON.stringify(marks),
        Seconds: seconds,
        LastUpdatedAt: new Date()
      });

      console.log(`Updated autosave record for evaluator ${evaluatorId} and copy ${copyId}`);
      return existingRecord;
    } else {
      // Create new record
      const newRecord = await EvaluationAutosave.create({
        EvaluatorID: evaluatorId,
        CopyID: copyId,
        Annotations: JSON.stringify(annotations),
        Marks: JSON.stringify(marks),
        Seconds: seconds,
        LastUpdatedAt: new Date(),
      });

      console.log(`Created new autosave record for evaluator ${evaluatorId} and copy ${copyId}`);
      return newRecord;
    }
  } catch (error) {
    console.error(`Error in saveEvaluationProgress: ${error.message}`);
    throw new Error(`Failed to save evaluation progress: ${error.message}`);
  }
};

/**
 * Get the latest autosaved evaluation progress
 * @param {string} evaluatorId - The evaluator's ID
 * @param {string} copyId - The copy ID
 * @returns {Promise<object|null>} - The autosave record or null if none exists
 */
export const getEvaluationProgress = async (evaluatorId, copyId) => {
  try {
    const record = await EvaluationAutosave.findOne({
      where: {
        EvaluatorID: evaluatorId,
        CopyID: copyId
      },
      order: [['LastUpdatedAt', 'DESC']]
    });

    if (!record) {
      console.log(`No autosave record found for evaluator ${evaluatorId} and copy ${copyId}`);
      return null;
    }

    // Parse JSON strings back to objects
    const result = {
      evaluatorId: record.EvaluatorID,
      copyId: record.CopyID,
      annotations: JSON.parse(record.Annotations),
      marks: JSON.parse(record.Marks),
      seconds: record.Seconds,
      lastUpdatedAt: record.LastUpdatedAt
    };

    console.log(`Retrieved autosave record for evaluator ${evaluatorId} and copy ${copyId}`);
    return result;
  } catch (error) {
    console.error(`Error in getEvaluationProgress: ${error.message}`);
    throw new Error(`Failed to retrieve evaluation progress: ${error.message}`);
  }
};

/**
 * Delete autosave record after evaluation is complete
 * @param {string} evaluatorId - The evaluator's ID
 * @param {string} copyId - The copy ID
 * @returns {Promise<boolean>} - True if deletion was successful
 */
export const deleteEvaluationProgress = async (evaluatorId, copyId) => {
  try {
    const deleted = await EvaluationAutosave.destroy({
      where: {
        EvaluatorID: evaluatorId,
        CopyID: copyId
      }
    });

    if (deleted) {
      console.log(`Deleted autosave record for evaluator ${evaluatorId} and copy ${copyId}`);
      return true;
    } else {
      console.log(`No autosave record found to delete for evaluator ${evaluatorId} and copy ${copyId}`);
      return false;
    }
  } catch (error) {
    console.error(`Error in deleteEvaluationProgress: ${error.message}`);
    throw new Error(`Failed to delete evaluation progress: ${error.message}`);
  }
};