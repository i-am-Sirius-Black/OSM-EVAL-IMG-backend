import { Op } from "sequelize";
import { sequelize } from "../config/db.js";
import {
  SubjectAssignment,
  CopyAssignments,
  CopyBatchAssignment,
  UserLogin,
  SubjectData,
  CopyReevaluation,
  Copy,
} from "../models/index.js";
import { COPY_BATCH_EXPIRY } from "../config/config.js";

/**
 * Get all subjects assigned to an evaluator with isCopyAssigned flag
 */
export const getEvaluatorSubjectsService = async (evaluatorId) => {
  try {
    await resetExpiredBatchesService();

    const subjects = await SubjectAssignment.findAll({
      where: {
        evaluator_id: evaluatorId,
        active: true,
      },
      attributes: ["assignment_id", "subject_code", "exam_name", "assigned_at"],
      raw: true,
    });

    console.log("Subjects assigned to evaluator:", subjects);
    

    // Get all active batch assignments for this evaluator
    const activeBatches = await CopyBatchAssignment.findAll({
      where: {
        evaluator_id: evaluatorId,
        is_active: true,
        expires_at: {
          [Op.gt]: new Date(),
        },
      },
      attributes: ["subject_code"],
      raw: true,
    });

    const assignedSubjectCodes = new Set(
      activeBatches.map((batch) => batch.subject_code)
    );

    return subjects.map((subject) => ({
      assignmentId: subject.assignment_id,
      subjectCode: subject.subject_code,
      examName: subject.exam_name,
      assignedAt: subject.assigned_at,
      isCopyAssigned: assignedSubjectCodes.has(subject.subject_code),
    }));
  } catch (error) {
    console.error("Error in getEvaluatorSubjectsService:", error);
    throw new Error(`Failed to retrieve assigned subjects: ${error.message}`);
  }
};

/**
 * Check if the evaluator already has an active batch for the given subject
 */
export const getCurrentActiveBatchService = async (
  evaluatorId,
  subjectCode = null
) => {
  try {
    const whereClause = {
      evaluator_id: evaluatorId,
      is_active: true,
      expires_at: {
        [Op.gt]: new Date(),
      },
    };
    if (subjectCode) {
      whereClause.subject_code = subjectCode;
    }

    const activeBatch = await CopyBatchAssignment.findOne({
      where: whereClause,
      raw: true,
    });

    if (!activeBatch) {
      return null;
    }

    // Get all copies for the current active batch
    const allBatchCopies = await CopyAssignments.findAll({
      where: {
        evaluator_id: evaluatorId,
        batch_id: activeBatch.batch_id,
      },
      attributes: ["assignment_id", "copyid", "assigned_at", "is_checked"],
      raw: true,
    });

    const checkedCount = allBatchCopies.filter((copy) => copy.is_checked).length;
    const pendingCount = allBatchCopies.filter((copy) => !copy.is_checked).length;
    const totalCount = allBatchCopies.length;

    return {
      batchId: activeBatch.batch_id,
      subjectCode: activeBatch.subject_code,
      examName: activeBatch.exam_name,
      assignedAt: activeBatch.assigned_at,
      expiresAt: activeBatch.expires_at,
      checkedCount,
      pendingCount,
      totalCount,
      copies: allBatchCopies.map((copy) => ({
        assignmentId: copy.assignment_id,
        copyId: copy.copyid,
        assignedAt: copy.assigned_at,
        isChecked: copy.is_checked,
      })),
    };
  } catch (error) {
    console.error("Error in getCurrentActiveBatchService:", error);
    throw new Error(`Failed to check for active batch: ${error.message}`);
  }
};


/**
 * Assigns a new batch of unassigned copies to an evaluator for a specific subject and exam.
 * * Enhancements over previous version:
 * - Adds support for tracking batch reuse via `reactivation_count`.
 * - Maintains previous logic integrity while improving traceability and auditability.
 */
export const assignNewBatchService = async (
  evaluatorId,
  subjectCode,
  examName,
  batchSize = 10
) => {
  console.log("Assigning new batch for evaluator:", evaluatorId, "subjectCode:", subjectCode, "examName:", examName, "batchSize:", batchSize);
  
  let transaction;
  try {
    transaction = await sequelize.transaction();

    // Check if the subject is assigned to this evaluator
    const subjectAssignment = await SubjectAssignment.findOne({
      where: {
        evaluator_id: evaluatorId,
        subject_code: subjectCode,
        exam_name: examName,
        active: true,
      },
      transaction,
    });

    if (!subjectAssignment) {
      await transaction.rollback();
      throw new Error(
        `Subject ${subjectCode} for exam ${examName} is not assigned to evaluator ${evaluatorId}`
      );
    }

    // Check if evaluator already has an active batch for this subject
    const activeBatch = await CopyBatchAssignment.findOne({
      where: {
        evaluator_id: evaluatorId,
        subject_code: subjectCode,
        is_active: true,
        expires_at: {
          [Op.gt]: new Date(),
        },
      },
      transaction,
    });

    if (activeBatch) {
      await transaction.commit();
      const currentBatch = await getCurrentActiveBatchService(evaluatorId, subjectCode);
      return {
        message: `You already have an active batch for subject ${subjectCode}. Please complete it before requesting a new one.`,
        ...currentBatch,
      };
    }

    // Find subjectdata_id for the given subjectCode
    const subjectData = await SubjectData.findOne({
      where: { SubjectID: subjectCode },
      attributes: ['subjectdata_id'],
      raw: true,
      transaction,
    });
    
    if (!subjectData) {
      await transaction.rollback();
      throw new Error(`No subject found with code ${subjectCode}`);
    }

    console.log("Subject Data ID for subjectCode:", subjectData.subjectdata_id);
    
    // Find unassigned and unchecked copies from Copy table
    const unassignedCopies = await Copy.findAll({
      where: {
        subjectdata_id: subjectData.subjectdata_id,
        is_assigned: false,
        is_evaluated: false,
      },
      limit: batchSize,
      attributes: ["copyid", "bag_id", "pack_id"],
      transaction,
    });

    if (!unassignedCopies || unassignedCopies.length === 0) {
      await transaction.rollback();
      throw new Error(
        `No unassigned copies available for subject ${subjectCode}`
      );
    }

    // Create a new batch assignment or reuse an existing inactive one
    const now = new Date();
    const expiresAt = new Date(now.getTime() + COPY_BATCH_EXPIRY);
    console.log("date now:", now);
    console.log("Batch expires at:", expiresAt);
    
    // Look for an existing inactive batch that can be reused
    let newBatch = await CopyBatchAssignment.findOne({
      where: {
        evaluator_id: evaluatorId,
        subject_code: subjectCode,
        exam_name: examName,
        is_active: false,
      },
      order: [["batch_id", "DESC"]], // pick the latest one if multiple
      transaction,
    });

    let batchReused = false;
    let reactivationCount = 0;

    if (newBatch) {
      // Reactivate and update old batch
      batchReused = true;
      reactivationCount = newBatch.reactivation_count + 1;
      
      console.log("Reusing existing batch ID:", newBatch.batch_id);
      await newBatch.update({
        assigned_at: now,
        expires_at: expiresAt,
        is_active: true,
        completed_at: null, // Reset completed_at since we're reactivating
        reactivation_count: reactivationCount
      }, { transaction });
    } else {
      // No previous batch found, create a new one
      console.log("Creating new batch");
      newBatch = await CopyBatchAssignment.create(
        {
          evaluator_id: evaluatorId,
          subject_code: subjectCode,
          exam_name: examName,
          assigned_at: now,
          expires_at: expiresAt,
          is_active: true,
          reactivation_count: 0
        },
        { transaction }
      );
    }

    // Create individual copy assignments
    const copyAssignments = unassignedCopies.map((copy) => ({
      copyid: copy.copyid,
      evaluator_id: evaluatorId,
      batch_id: newBatch.batch_id,
      assigned_by: "SYSTEM",
      assigned_at: now,
      is_checked: false,
    }));

    const createdAssignments = await CopyAssignments.bulkCreate(
      copyAssignments,
      {
        transaction,
        fields: [
          "copyid",
          "evaluator_id",
          "batch_id",
          "assigned_by",
          "assigned_at",
          "is_checked"
        ]
      }
    );

    // Mark the copies as assigned in Copy table
    await Copy.update(
      { is_assigned: true },
      {
        where: { copyid: unassignedCopies.map((copy) => copy.copyid) },
        transaction,
      }
    );

    await transaction.commit();

    return {
      message: `Successfully assigned ${createdAssignments.length} copies`,
      batchId: newBatch.batch_id,
      subjectCode,
      examName,
      assignedAt: newBatch.assigned_at,
      expiresAt: newBatch.expires_at,
      batchReused, // Flag indicating if this batch was reused
      reactivationCount, // Number of times this batch has been reactivated
      copies: createdAssignments.map((assignment, idx) => ({
        assignmentId: assignment.assignment_id,
        copyId: assignment.copyid,
        bagId: unassignedCopies[idx].bag_id,
        packId: unassignedCopies[idx].pack_id,
        assignedAt: assignment.assigned_at,
      })),
    };
  } catch (error) {
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Error rolling back transaction:", rollbackError);
      }
    }
    console.error("Error in assignNewBatchService:", error);
    throw error;
  }
};

/**
 * Mark a copy as started for evaluation
 */
export const startCopyEvaluationService = async (evaluatorId, copyId) => {
  try {
    const assignment = await CopyAssignments.findOne({
      where: {
        copyid: copyId,
        evaluator_id: evaluatorId,
        is_checked: false,
      },
    });

    if (!assignment) {
      throw new Error(
        `Copy ${copyId} is not assigned to evaluator ${evaluatorId} or has already been checked`
      );
    }

    // Find the batch this belongs to
    const batch = await CopyBatchAssignment.findOne({
      where: {
        evaluator_id: evaluatorId,
        is_active: true,
      },
    });

    if (batch) {
      const newExpiresAt = new Date();
      newExpiresAt.setHours(newExpiresAt.getHours() + 24);
      await batch.update({
        expires_at: newExpiresAt,
      });
    }

    return {
      message: "Copy evaluation started successfully",
      assignmentId: assignment.assignment_id,
      copyId,
      newExpiryTime: batch ? batch.expires_at : null,
    };
  } catch (error) {
    console.error("Error in startCopyEvaluationService:", error);
    throw error;
  }
};

/**
 * Mark copy as completed
 */
export const completeCopyEvaluationService = async (
  evaluatorId,
  copyId
) => {
  try {
    const assignment = await CopyAssignments.findOne({
      where: {
        copyid: copyId,
        evaluator_id: evaluatorId,
        is_checked: false,
      },
    });

    if (!assignment) {
      throw new Error(
        `Copy ${copyId} is not assigned to evaluator ${evaluatorId} or has already been checked`
      );
    }

    await assignment.update({
      is_checked: true,
      checked_at: new Date(),
    });

    // Check if all copies in the batch are checked
    const remainingCopies = await CopyAssignments.count({
      where: {
        evaluator_id: evaluatorId,
        is_checked: false,
        batch_id: assignment.batch_id,
      },
    });

    let batchStatus = "active";

    if (remainingCopies === 0) {
      const batch = await CopyBatchAssignment.findOne({
        where: {
          evaluator_id: evaluatorId,
          batch_id: assignment.batch_id,
          is_active: true,
        },
      });

      if (batch) {
        await batch.update({
          is_active: false,
          completed_at: new Date(),
        });
        batchStatus = "completed";
      }
    }

    return {
      message: "Copy evaluation completed successfully",
      assignmentId: assignment.assignment_id,
      copyId,
      remainingCopies,
      batchStatus,
    };
  } catch (error) {
    console.error("Error in completeCopyEvaluationService:", error);
    throw error;
  }
};

/**
 * Reset expired batches and remove assignments
 */
export const resetExpiredBatchesService = async () => {
  const transaction = await sequelize.transaction();

  try {
    const expiredBatches = await CopyBatchAssignment.findAll({
      where: {
        is_active: true,
        expires_at: {
          [Op.lt]: new Date(),
        },
      },
      transaction,
    });

    if (expiredBatches.length === 0) {
      await transaction.commit();
      return { message: "No expired batches found", count: 0 };
    }

    // Get all batch IDs that have expired
    const expiredBatchIds = expiredBatches.map((batch) => batch.batch_id);

    // Mark batches as inactive
    await CopyBatchAssignment.update(
      { is_active: false },
      {
        where: { batch_id: expiredBatchIds },
        transaction,
      }
    );

    // Find all copy assignments for these expired batches that aren't checked
    const expiredAssignments = await CopyAssignments.findAll({
      where: {
        batch_id: {
          [Op.in]: expiredBatchIds,
        },
        is_checked: false,
      },
      transaction,
    });

    // Get all copyids of expired assignments
    const expiredCopyIds = expiredAssignments.map(
      (assignment) => assignment.copyid
    );

    if (expiredCopyIds.length > 0) {
      // Mark copies as unassigned in the Copy table
      await Copy.update(
        { is_assigned: false },
        {
          where: { copyid: expiredCopyIds },
          transaction,
        }
      );

      // Delete the assignments
      await CopyAssignments.destroy({
        where: {
          batch_id: {
            [Op.in]: expiredBatchIds,
          },
          is_checked: false,
        },
        transaction,
      });
    }

    await transaction.commit();

    return {
      message: "Successfully reset expired batches",
      batchesReset: expiredBatches.length,
      assignmentsRemoved: expiredAssignments.length,
    };
  } catch (error) {
    // Only rollback if transaction is still active
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Error rolling back transaction:", rollbackError);
      }
    }
    console.error("Error in resetExpiredBatchesService:", error);
    throw error;
  }
};





export const checkAvailableCopies = async (subjectCode, examName) => {
  try {
    // Check how many total copies exist for this subject/exam
    const totalCopies = await SubjectData.count({
      where: {
        SubjectID: subjectCode,
        Course: examName,
      },
    });

    // Check how many unassigned copies exist
    const unassignedCopies = await SubjectData.count({
      where: {
        SubjectID: subjectCode,
        Course: examName,
        IsAssigned: false,
      },
    });

    // Get sample copy to verify data structure
    const sampleCopy = await SubjectData.findOne({
      where: {
        SubjectID: subjectCode,
        Course: examName,
      },
    });

    return {
      subjectCode,
      examName,
      totalCopies,
      unassignedCopies,
      sampleCopy: sampleCopy
        ? {
            barcode: sampleCopy.barcode,
            subjectID: sampleCopy.SubjectID,
            course: sampleCopy.Course,
            isAssigned: sampleCopy.IsAssigned,
          }
        : null,
    };
  } catch (error) {
    console.error("Error in checkAvailableCopies:", error);
    throw error;
  }
};

/**
 * Submit re-evaluation results for a copy
 * @param {string} requestId - ID of the re-evaluation request
 * @param {string} evaluatorId - ID of the evaluator submitting results
 * @param {number} reevaluatedMarks - The new marks assigned after re-evaluation
 * @param {string} remarks - Comments or justification for the re-evaluation
 * @returns {Promise<Object>} Updated re-evaluation request record
 */
export const submitReevaluationService = async (
  requestId,
  evaluatorId,
  reevaluatedMarks,
  remarks
) => {
  const transaction = await sequelize.transaction();

  try {
    // Find the re-evaluation request and verify it exists
    const reevalRequest = await CopyReevaluation.findOne({
      where: {
        RequestID: requestId,
        Status: "Assigned",
        AssignedEvaluatorID: evaluatorId,
      },
      transaction,
    });

    if (!reevalRequest) {
      await transaction.rollback();
      const error = new Error(
        `No active re-evaluation request found with ID ${requestId} for evaluator ${evaluatorId}`
      );
      error.status = 404;
      throw error;
    }

    // Update the re-evaluation request with results
    const updatedRequest = await reevalRequest.update(
      {
        Status: "Completed",
        ReevaluatedMarks: reevaluatedMarks,
        Remarks: remarks,
        SubmittedAt: new Date(),
      },
      { transaction }
    );

    // Commit the transaction
    await transaction.commit();

    return {
      requestId: updatedRequest.RequestID,
      copyId: updatedRequest.CopyID,
      status: updatedRequest.Status,
      reevaluatedMarks: updatedRequest.ReevaluatedMarks,
      originalEvaluatorId: updatedRequest.OriginalEvaluatorID,
      assignedEvaluatorId: updatedRequest.AssignedEvaluatorID,
      submittedAt: updatedRequest.SubmittedAt,
      remarks: updatedRequest.Remarks,
    };
  } catch (error) {
    if (transaction.finished !== "rollback") {
      await transaction.rollback();
    }
    console.error("Error in submitReevaluationService:", error);
    throw error;
  }
};

/**
 * Get all reevaluation requests assigned to an evaluator
 * @param {string} evaluatorId - ID of the evaluator
 * @returns {Promise<Array>} - List of reevaluation requests assigned to the evaluator
 */
export const getEvaluatorReevaluationsService = async (evaluatorId) => {
  try {
    // Find all reevaluation requests assigned to this evaluator with status 'Assigned'
    const requests = await CopyReevaluation.findAll({
      where: {
        AssignedEvaluatorID: evaluatorId,
        Status: "Assigned", // Only get active assignments
        isChecked: false,
      },
      include: [
        {
          model: SubjectData,
          as: "CopyDetails",
          attributes: ["SubjectID", "Subject", "Course", "barcode"], // Use correct column names from your model
          required: false,
        },
      ],
    });

    if (!requests || requests.length === 0) {
      return [];
    }

    // Format the data for API response with correct property mappings
    return requests.map((request) => ({
      requestId: request.RequestID,
      copyId: request.CopyID,
      assignedAt: request.AssignedAt,
      reason: request.Reason,
      status: request.Status,
      subjectCode: request.CopyDetails?.SubjectID, // Map to the actual column name
      subjectName: request.CopyDetails?.Subject || "Unknown Subject", // Map to the actual column name
      examName: request.CopyDetails?.Course || "Unknown Exam", // Map to the actual column name
      courseName: request.CopyDetails?.Course || "Unknown Course", // Use Course directly
    }));
  } catch (error) {
    console.error("Error in getEvaluatorReevaluationsService:", error);
    throw new Error(
      `Failed to retrieve reevaluation assignments: ${error.message}`
    );
  }
};





// import { Op } from "sequelize";
// import { sequelize } from "../config/db.js";
// import {
//   SubjectAssignment,
//   CopyAssignments,
//   CopyBatchAssignment,
//   UserLogin,
//   SubjectData,
//   CopyReevaluation,
// } from "../models/index.js";
// import { COPY_BATCH_EXPIRY } from "../config/config.js";

// /**
//  * Get all subjects assigned to an evaluator with iscopyassigned flag
//  *
//  * @param {string} evaluatorId - Evaluator ID
//  * @returns {Promise<Array>} List of subjects assigned to the evaluator
//  */
// export const getEvaluatorSubjectsService = async (evaluatorId) => {
//   try {
//     //*new, clear previous expired copy, copybatch
//     await resetExpiredBatchesService();

//     const subjects = await SubjectAssignment.findAll({
//       where: {
//         evaluator_id: evaluatorId,
//         active: true,
//       },
//       attributes: ["assignment_id", "subject_code", "exam_name", "assigned_at"],
//     });

//     // Get all active batch assignments for this evaluator
//     const activeBatches = await CopyBatchAssignment.findAll({
//       where: {
//         evaluator_id: evaluatorId,
//         is_active: true,
//         expires_at: {
//           [Op.gt]: new Date(), // Not expired yet
//         },
//       },
//       attributes: ["subject_code"],
//     });

//     // Create a Set of subject codes that have active assignments
//     const assignedSubjectCodes = new Set(
//       activeBatches.map((batch) => batch.subject_code)
//     );

//     return subjects.map((subject) => ({
//       assignmentId: subject.assignment_id,
//       subjectCode: subject.subject_code,
//       examName: subject.exam_name,
//       assignedAt: subject.assigned_at,
//       isCopyAssigned: assignedSubjectCodes.has(subject.subject_code), // Check if this subject has active copies assigned
//     }));
//   } catch (error) {
//     console.error("Error in getEvaluatorSubjectsService:", error);
//     throw new Error(`Failed to retrieve assigned subjects: ${error.message}`);
//   }
// };

// /**
//  * Check if the evaluator already has an active batch for the given subject
//  *
//  * @param {string} evaluatorId - Evaluator ID
//  * @param {string} [subjectCode] - Optional subject code to filter by specific subject
//  * @returns {Promise<Object|null>} Active batch details or null if none exists
//  */
// export const getCurrentActiveBatchService = async (
//   evaluatorId,
//   subjectCode = null
// ) => {
//   try {
//     // Build the where clause
//     const whereClause = {
//       EvaluatorID: evaluatorId,
//       IsActive: true,
//       ExpiresAt: {
//         [Op.gt]: new Date(), // Not expired yet
//       },
//     };

//     // Add subject filter if provided
//     if (subjectCode) {
//       whereClause.SubjectCode = subjectCode;
//     }

//     // Find active batch for this evaluator (and optionally for a specific subject)
//     const activeBatch = await CopyBatchAssignment.findOne({
//       where: whereClause,
//     });

//     if (!activeBatch) {
//       return null;
//     }

//     // // Get copies from this active batch
//     // const activeCopies = await CopyAssignments.findAll({
//     //   where: {
//     //     EvaluatorID: evaluatorId,
//     //     IsChecked: false,
//     //     BatchID: activeBatch.BatchID // This ensures we only get copies from this batch
//     //   },
//     //   attributes: ['AssignmentID', 'CopyBarcode', 'AssignedAt']
//     // });

//     // return {
//     //   batchId: activeBatch.BatchID,
//     //   subjectCode: activeBatch.SubjectCode,
//     //   examName: activeBatch.ExamName,
//     //   assignedAt: activeBatch.AssignedAt,
//     //   expiresAt: activeBatch.ExpiresAt,
//     //   copies: activeCopies.map(copy => ({
//     //     assignmentId: copy.AssignmentID,
//     //     copyBarcode: copy.CopyBarcode,
//     //     assignedAt: copy.AssignedAt,
//     //     isChecked: copy.IsChecked
//     //   }))
//     // };

//     // Get ALL copies for the current active batch
//     const allBatchCopies = await CopyAssignments.findAll({
//       where: {
//         EvaluatorID: evaluatorId,
//         BatchID: activeBatch.BatchID, // Get all copies from this batch
//       },
//       attributes: ["AssignmentID", "CopyBarcode", "AssignedAt", "IsChecked"],
//     });

//     // Calculate counts
//     const checkedCount = allBatchCopies.filter((copy) => copy.IsChecked).length;
//     const pendingCount = allBatchCopies.filter(
//       (copy) => !copy.IsChecked
//     ).length;
//     const totalCount = allBatchCopies.length;

//     return {
//       batchId: activeBatch.BatchID,
//       subjectCode: activeBatch.SubjectCode,
//       examName: activeBatch.ExamName,
//       assignedAt: activeBatch.AssignedAt,
//       expiresAt: activeBatch.ExpiresAt,
//       checkedCount,
//       pendingCount,
//       totalCount,
//       copies: allBatchCopies.map((copy) => ({
//         assignmentId: copy.AssignmentID,
//         copyBarcode: copy.CopyBarcode,
//         assignedAt: copy.AssignedAt,
//         isChecked: copy.IsChecked,
//       })),
//     };
//   } catch (error) {
//     console.error("Error in getCurrentActiveBatchService:", error);
//     throw new Error(`Failed to check for active batch: ${error.message}`);
//   }
// };

// /**
//  * Assign a new batch of copies to the evaluator
//  *
//  * @param {string} evaluatorId - Evaluator ID
//  * @param {string} subjectCode - Subject code
//  * @param {string} examName - Exam name
//  * @param {number} batchSize - Number of copies to assign (default: 10)
//  * @returns {Promise<Object>} Details of the assigned batch and copies
//  */
// export const assignNewBatchService = async (
//   evaluatorId,
//   subjectCode,
//   examName,
//   batchSize = 10
// ) => {
//   // Start a transaction
//   let transaction;

//   try {
//     transaction = await sequelize.transaction();

//     // Check if the subject is assigned to this evaluator
//     const subjectAssignment = await SubjectAssignment.findOne({
//       where: {
//         EvaluatorID: evaluatorId,
//         SubjectCode: subjectCode,
//         ExamName: examName,
//         Active: true,
//       },
//     });

//     if (!subjectAssignment) {
//       throw new Error(
//         `Subject ${subjectCode} for exam ${examName} is not assigned to evaluator ${evaluatorId}`
//       );
//     }

//     //* Check if evaluator already has an active batch FOR THIS SPECIFIC SUBJECT
//     const activeBatch = await CopyBatchAssignment.findOne({
//       where: {
//         EvaluatorID: evaluatorId,
//         SubjectCode: subjectCode, // Only check for this specific subject
//         IsActive: true,
//         ExpiresAt: {
//           [Op.gt]: new Date(), // Not expired yet
//         },
//       },
//       transaction,
//     });

//     if (activeBatch) {
//       // Don't rollback here - just return the current batch
//       await transaction.commit();
//       const currentBatch = await getCurrentActiveBatchService(evaluatorId);
//       return {
//         message: `You already have an active batch for subject ${subjectCode}. Please complete it before requesting a new one.`,
//         ...currentBatch,
//       };
//     }

//     // Find unassigned and unchecked copies directly from SubjectData
//     const unassignedCopies = await SubjectData.findAll({
//       where: {
//         SubjectID: subjectCode, // Make sure this matches the actual column name casing
//         IsAssigned: false,
//         IsChecked: false
//       },
//       limit: batchSize,
//       attributes: ["barcode", "bagid", "packid"],
//       transaction,
//     });

//     // Add a debug log to see what's happening
//     console.log(
//       `Looking for copies with SubjectID='${subjectCode}', IsAssigned=false`
//     );
//     console.log(`Found ${unassignedCopies?.length || 0} unassigned copies`);
//     if (!unassignedCopies || unassignedCopies.length === 0) {
//       await transaction.commit(); // Commit instead of rollback for this case
//       throw new Error(
//         `No unassigned copies available for subject ${subjectCode}`
//       );
//     }

//     // Create or reassign a new batch assignment
//     const now = new Date();
//     const expiresAt = new Date(now.getTime() + COPY_BATCH_EXPIRY); // 24 hours later

//     let newBatch = await CopyBatchAssignment.findOne({
//       where: {
//         EvaluatorID: evaluatorId,
//         SubjectCode: subjectCode,
//         ExamName: examName,
//         IsActive: false,
//       },
//       order: [["BatchID", "DESC"]], // pick the latest one if multiple
//       transaction,
//     });

//     if (newBatch) {
//       // Reactivate and update old batch
//       newBatch.AssignedAt = now;
//       newBatch.ExpiresAt = expiresAt;
//       newBatch.IsActive = true;
//       await newBatch.save({ transaction });
//     } else {
//       // No previous batch found, create a new one
//       newBatch = await CopyBatchAssignment.create(
//         {
//           EvaluatorID: evaluatorId,
//           SubjectCode: subjectCode,
//           ExamName: examName,
//           AssignedAt: now,
//           ExpiresAt: expiresAt,
//           IsActive: true,
//         },
//         { transaction }
//       );
//     }

//     // Create individual copy assignments
//     const copyAssignments = unassignedCopies.map((copy) => ({
//       CopyBarcode: copy.barcode,
//       EvaluatorID: evaluatorId,
//       BatchID: newBatch.BatchID, // Add the BatchID to link copies to their batch
//       AssignedBy: "SYSTEM", // Assigned by system, not admin
//       AssignedAt: new Date(),
//       IsChecked: false,
//     }));

//     const createdAssignments = await CopyAssignments.bulkCreate(
//       copyAssignments,
//       {
//         transaction,
//         fields: [
//           "CopyBarcode",
//           "EvaluatorID",
//           "BatchID",
//           "AssignedBy",
//           "AssignedAt",
//           "IsChecked",
//         ],
//       }
//     );

//     // Mark the copies as assigned in SubjectData
//     await SubjectData.update(
//       { IsAssigned: true },
//       {
//         where: { barcode: unassignedCopies.map((copy) => copy.barcode) },
//         transaction,
//       }
//     );

//     // Commit the transaction
//     await transaction.commit();

//     return {
//       message: `Successfully assigned ${createdAssignments.length} copies`,
//       batchId: newBatch.BatchID,
//       subjectCode,
//       examName,
//       assignedAt: newBatch.AssignedAt,
//       expiresAt: newBatch.ExpiresAt,
//       copies: createdAssignments.map((assignment, index) => ({
//         assignmentId: assignment.AssignmentID,
//         copyBarcode: assignment.CopyBarcode,
//         bagId: unassignedCopies[index].bagid,
//         packId: unassignedCopies[index].packid,
//         assignedAt: assignment.AssignedAt,
//       })),
//     };
//   } catch (error) {
//     // Only rollback if transaction exists and is still active
//     if (transaction && !transaction.finished) {
//       try {
//         await transaction.rollback();
//       } catch (rollbackError) {
//         console.error("Error rolling back transaction:", rollbackError);
//       }
//     }

//     console.error("Error in assignNewBatchService:", error);
//     throw error;
//   }
// };

// /**
//  * Mark a copy as started for evaluation
//  *
//  * @param {string} evaluatorId - Evaluator ID
//  * @param {string} copyBarcode - Copy barcode
//  * @returns {Promise<Object>} Updated assignment details
//  */
// export const startCopyEvaluationService = async (evaluatorId, copyBarcode) => {
//   try {
//     // Find the assignment
//     const assignment = await CopyAssignments.findOne({
//       where: {
//         CopyBarcode: copyBarcode,
//         EvaluatorID: evaluatorId,
//         IsChecked: false,
//       },
//     });

//     if (!assignment) {
//       throw new Error(
//         `Copy ${copyBarcode} is not assigned to evaluator ${evaluatorId} or has already been checked`
//       );
//     }

//     // Find the batch this belongs to
//     const batch = await CopyBatchAssignment.findOne({
//       where: {
//         EvaluatorID: evaluatorId,
//         IsActive: true,
//       },
//     });

//     if (batch) {
//       // Reset expiry time when evaluation starts
//       // This gives the evaluator more time to complete once they've started
//       const newExpiresAt = new Date();
//       newExpiresAt.setHours(newExpiresAt.getHours() + 24); // Another 24 hours from now

//       await batch.update({
//         ExpiresAt: newExpiresAt,
//       });
//     }

//     return {
//       message: "Copy evaluation started successfully",
//       assignmentId: assignment.AssignmentID,
//       copyBarcode,
//       newExpiryTime: batch ? batch.ExpiresAt : null,
//     };
//   } catch (error) {
//     console.error("Error in startCopyEvaluationService:", error);
//     throw error;
//   }
// };

// /**
//  * Mark copy as completed
//  *
//  * @param {string} evaluatorId - Evaluator ID
//  * @param {string} copyBarcode - Copy barcode
//  * @returns {Promise<Object>} Updated assignment details
//  */
// export const completeCopyEvaluationService = async (
//   evaluatorId,
//   copyBarcode
// ) => {
//   try {
//     // Find the assignment
//     const assignment = await CopyAssignments.findOne({
//       where: {
//         CopyBarcode: copyBarcode,
//         EvaluatorID: evaluatorId,
//         IsChecked: false,
//       },
//     });

//     if (!assignment) {
//       throw new Error(
//         `Copy ${copyBarcode} is not assigned to evaluator ${evaluatorId} or has already been checked`
//       );
//     }

//     // Update the assignment
//     await assignment.update({
//       IsChecked: true,
//       CheckedAt: new Date(),
//     });

//     // Check if all copies in the batch are checked
//     const remainingCopies = await CopyAssignments.count({
//       where: {
//         EvaluatorID: evaluatorId,
//         IsChecked: false,
//       },
//     });

//     let batchStatus = "active";

//     // If all copies are evaluated, mark the batch as completed
//     if (remainingCopies === 0) {
//       const batch = await CopyBatchAssignment.findOne({
//         where: {
//           EvaluatorID: evaluatorId,
//           IsActive: true,
//         },
//       });

//       if (batch) {
//         await batch.update({
//           IsActive: false,
//           CompletedAt: new Date(),
//         });
//         batchStatus = "completed";
//       }
//     }

//     return {
//       message: "Copy evaluation completed successfully",
//       assignmentId: assignment.AssignmentID,
//       copyBarcode,
//       remainingCopies,
//       batchStatus,
//     };
//   } catch (error) {
//     console.error("Error in completeCopyEvaluationService:", error);
//     throw error;
//   }
// };

// /**
//  * Reset expired batches and remove assignments
//  * Called by a scheduled job
//  */




// export const resetExpiredBatchesService = async () => {
//   const transaction = await sequelize.transaction();

//   try {
//     // Find all expired batches
//     const expiredBatches = await CopyBatchAssignment.findAll({
//       where: {
//         IsActive: true,
//         ExpiresAt: {
//           [Op.lt]: new Date(), // Already expired
//         },
//       },
//       transaction,
//     });

//     if (expiredBatches.length === 0) {
//       await transaction.commit();
//       return { message: "No expired batches found", count: 0 };
//     }

//     // Get all batch IDs that have expired
//     const expiredBatchIds = expiredBatches.map((batch) => batch.BatchID);

//     // Mark batches as inactive
//     await CopyBatchAssignment.update(
//       { IsActive: false },
//       {
//         where: { BatchID: expiredBatchIds },
//         transaction,
//       }
//     );

//     // Find all copy assignments FOR THESE SPECIFIC BATCHES that aren't checked
//     const expiredAssignments = await CopyAssignments.findAll({
//       where: {
//         BatchID: {
//           [Op.in]: expiredBatchIds,
//         },
//         IsChecked: false,
//       },
//       transaction,
//     });

//     // Get all barcodes of expired assignments
//     const expiredBarcodes = expiredAssignments.map(
//       (assignment) => assignment.CopyBarcode
//     );

//     // Mark copies as unassigned in SubjectData
//     if (expiredBarcodes.length > 0) {
//       await SubjectData.update(
//         { IsAssigned: false },
//         {
//           where: { barcode: expiredBarcodes },
//           transaction,
//         }
//       );

//       // Delete the assignments - now using BatchID to only target expired batch assignments
//       await CopyAssignments.destroy({
//         where: {
//           BatchID: {
//             [Op.in]: expiredBatchIds,
//           },
//           IsChecked: false,
//         },
//         transaction,
//       });
//     }


//     // Step 4: Reset IsAssigned in SubjectData
//     await SubjectData.update(
//       { IsAssigned: false },
//       {
//         where: { barcode: expiredBarcodes, IsChecked: false },
//         transaction
//       }
//     );




//     await transaction.commit();

//     return {
//       message: "Successfully reset expired batches",
//       batchesReset: expiredBatches.length,
//       assignmentsRemoved: expiredAssignments.length,
//     };
//   } catch (error) {
//     await transaction.rollback();
//     console.error("Error in resetExpiredBatchesService:", error);
//     throw error;
//   }
// };

// // Debug helper function


// export const checkAvailableCopies = async (subjectCode, examName) => {
//   try {
//     // Check how many total copies exist for this subject/exam
//     const totalCopies = await SubjectData.count({
//       where: {
//         SubjectID: subjectCode,
//         Course: examName,
//       },
//     });

//     // Check how many unassigned copies exist
//     const unassignedCopies = await SubjectData.count({
//       where: {
//         SubjectID: subjectCode,
//         Course: examName,
//         IsAssigned: false,
//       },
//     });

//     // Get sample copy to verify data structure
//     const sampleCopy = await SubjectData.findOne({
//       where: {
//         SubjectID: subjectCode,
//         Course: examName,
//       },
//     });

//     return {
//       subjectCode,
//       examName,
//       totalCopies,
//       unassignedCopies,
//       sampleCopy: sampleCopy
//         ? {
//             barcode: sampleCopy.barcode,
//             subjectID: sampleCopy.SubjectID,
//             course: sampleCopy.Course,
//             isAssigned: sampleCopy.IsAssigned,
//           }
//         : null,
//     };
//   } catch (error) {
//     console.error("Error in checkAvailableCopies:", error);
//     throw error;
//   }
// };

// /**
//  * Submit re-evaluation results for a copy
//  * @param {string} requestId - ID of the re-evaluation request
//  * @param {string} evaluatorId - ID of the evaluator submitting results
//  * @param {number} reevaluatedMarks - The new marks assigned after re-evaluation
//  * @param {string} remarks - Comments or justification for the re-evaluation
//  * @returns {Promise<Object>} Updated re-evaluation request record
//  */
// export const submitReevaluationService = async (
//   requestId,
//   evaluatorId,
//   reevaluatedMarks,
//   remarks
// ) => {
//   const transaction = await sequelize.transaction();

//   try {
//     // Find the re-evaluation request and verify it exists
//     const reevalRequest = await CopyReevaluation.findOne({
//       where: {
//         RequestID: requestId,
//         Status: "Assigned",
//         AssignedEvaluatorID: evaluatorId,
//       },
//       transaction,
//     });

//     if (!reevalRequest) {
//       await transaction.rollback();
//       const error = new Error(
//         `No active re-evaluation request found with ID ${requestId} for evaluator ${evaluatorId}`
//       );
//       error.status = 404;
//       throw error;
//     }

//     // Update the re-evaluation request with results
//     const updatedRequest = await reevalRequest.update(
//       {
//         Status: "Completed",
//         ReevaluatedMarks: reevaluatedMarks,
//         Remarks: remarks,
//         SubmittedAt: new Date(),
//       },
//       { transaction }
//     );

//     // Commit the transaction
//     await transaction.commit();

//     return {
//       requestId: updatedRequest.RequestID,
//       copyId: updatedRequest.CopyID,
//       status: updatedRequest.Status,
//       reevaluatedMarks: updatedRequest.ReevaluatedMarks,
//       originalEvaluatorId: updatedRequest.OriginalEvaluatorID,
//       assignedEvaluatorId: updatedRequest.AssignedEvaluatorID,
//       submittedAt: updatedRequest.SubmittedAt,
//       remarks: updatedRequest.Remarks,
//     };
//   } catch (error) {
//     if (transaction.finished !== "rollback") {
//       await transaction.rollback();
//     }
//     console.error("Error in submitReevaluationService:", error);
//     throw error;
//   }
// };

// /**
//  * Get all reevaluation requests assigned to an evaluator
//  * @param {string} evaluatorId - ID of the evaluator
//  * @returns {Promise<Array>} - List of reevaluation requests assigned to the evaluator
//  */
// export const getEvaluatorReevaluationsService = async (evaluatorId) => {
//   try {
//     // Find all reevaluation requests assigned to this evaluator with status 'Assigned'
//     const requests = await CopyReevaluation.findAll({
//       where: {
//         AssignedEvaluatorID: evaluatorId,
//         Status: "Assigned", // Only get active assignments
//         isChecked: false,
//       },
//       include: [
//         {
//           model: SubjectData,
//           as: "CopyDetails",
//           attributes: ["SubjectID", "Subject", "Course", "barcode"], // Use correct column names from your model
//           required: false,
//         },
//       ],
//     });

//     if (!requests || requests.length === 0) {
//       return [];
//     }

//     // Format the data for API response with correct property mappings
//     return requests.map((request) => ({
//       requestId: request.RequestID,
//       copyId: request.CopyID,
//       assignedAt: request.AssignedAt,
//       reason: request.Reason,
//       status: request.Status,
//       subjectCode: request.CopyDetails?.SubjectID, // Map to the actual column name
//       subjectName: request.CopyDetails?.Subject || "Unknown Subject", // Map to the actual column name
//       examName: request.CopyDetails?.Course || "Unknown Exam", // Map to the actual column name
//       courseName: request.CopyDetails?.Course || "Unknown Course", // Use Course directly
//     }));
//   } catch (error) {
//     console.error("Error in getEvaluatorReevaluationsService:", error);
//     throw new Error(
//       `Failed to retrieve reevaluation assignments: ${error.message}`
//     );
//   }
// };

// /**
//  * Helper function to extract course name from subject code
//  * @param {string} subjectCode - The subject code
//  * @returns {string} - Course name
//  */
// const getCourseNameFromSubjectCode = (subjectCode) => {
//   // This is a placeholder implementation - modify based on your actual subject code format
//   if (!subjectCode) return "Unknown Course";

//   // Example implementation assuming subject codes follow a pattern like "CS101-BTECH"
//   const parts = subjectCode.split("-");
//   if (parts.length > 1) {
//     return parts[1];
//   }

//   return "General Course";
// };
