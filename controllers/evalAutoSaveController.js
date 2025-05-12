import {
  saveEvaluationProgress,
  getEvaluationProgress,
  deleteEvaluationProgress
} from '../services/evalAutosaveService.js';

/**
 * Save the current state of an evaluation
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
export const saveProgress = async (req, res) => {
  try {
    const { evaluatorId, copyId, annotations, marks } = req.body;

    // Validate required fields
    if (!evaluatorId || !copyId) {
      return res.status(400).json({
        success: false,
        message: 'Evaluator ID and Copy ID are required'
      });
    }

    // Ensure annotations and marks are provided
    if (!annotations || !marks) {
      return res.status(400).json({
        success: false,
        message: 'Annotations and marks data are required'
      });
    }

    // Save the evaluation progress
    await saveEvaluationProgress(evaluatorId, copyId, annotations, marks);

    res.status(200).json({
      success: true,
      message: 'Evaluation progress saved successfully',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error saving evaluation progress:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to save evaluation progress',
      error: error.message
    });
  }
};

/**
 * Get the latest autosaved evaluation
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
export const getProgress = async (req, res) => {
  try {
    const { evaluatorId, copyId } = req.query;

    // Validate required query parameters
    if (!evaluatorId || !copyId) {
      return res.status(400).json({
        success: false,
        message: 'Evaluator ID and Copy ID are required'
      });
    }

    // Get the autosaved progress
    const progress = await getEvaluationProgress(evaluatorId, copyId);

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'No saved progress found for this evaluation'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Evaluation progress retrieved successfully',
      data: progress
    });
  } catch (error) {
    console.error('Error retrieving evaluation progress:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve evaluation progress',
      error: error.message
    });
  }
};

/**
 * Delete an autosaved evaluation after completion
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
export const deleteProgress = async (req, res) => {
  try {
    const { evaluatorId, copyId } = req.query;

    // Validate required query parameters
    if (!evaluatorId || !copyId) {
      return res.status(400).json({
        success: false,
        message: 'Evaluator ID and Copy ID are required'
      });
    }

    // Delete the autosaved progress
    const deleted = await deleteEvaluationProgress(evaluatorId, copyId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'No saved progress found to delete'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Evaluation progress deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting evaluation progress:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete evaluation progress',
      error: error.message
    });
  }
}