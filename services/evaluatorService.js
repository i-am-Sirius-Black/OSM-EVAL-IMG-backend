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




/** v2 (fixing-> reactivation_count probmlem, need to be tested).
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
  console.log(`Assigning new batch to evaluator ${evaluatorId} for ${subjectCode} (${examName})`);

  // Reset any expired copies batch before proceeding
  await resetExpiredBatchesService();
  
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
        is_rejected: false,
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
      // Make sure we get the current reactivation_count
      const currentReactivationCount = newBatch.reactivation_count || 0;
      
      // Reactivate and update old batch
      batchReused = true;
      reactivationCount = currentReactivationCount + 1;
      
      console.log("Reusing existing batch ID:", newBatch.batch_id);
      console.log("Previous reactivation count:", currentReactivationCount);
      console.log("New reactivation count:", reactivationCount);
      
      // First, check if there are any existing assignments for this batch
      // and delete them to ensure a clean slate
      await CopyAssignments.destroy({
        where: { 
          batch_id: newBatch.batch_id 
        },
        transaction,
      });
      
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

// /**
//  * Assigns a new batch of unassigned copies to an evaluator for a specific subject and exam.
//  * * Enhancements over previous version:
//  * - Adds support for tracking batch reuse via `reactivation_count`.
//  * - Maintains previous logic integrity while improving traceability and auditability.
//  */
// export const assignNewBatchService = async (
//   evaluatorId,
//   subjectCode,
//   examName,
//   batchSize = 10
// ) => {

//   // Reset any expired copies batch before proceeding
//    await resetExpiredBatchesService();
  
//   let transaction;
//   try {
//     transaction = await sequelize.transaction();

//     // Check if the subject is assigned to this evaluator
//     const subjectAssignment = await SubjectAssignment.findOne({
//       where: {
//         evaluator_id: evaluatorId,
//         subject_code: subjectCode,
//         exam_name: examName,
//         active: true,
//       },
//       transaction,
//     });

//     if (!subjectAssignment) {
//       await transaction.rollback();
//       throw new Error(
//         `Subject ${subjectCode} for exam ${examName} is not assigned to evaluator ${evaluatorId}`
//       );
//     }

//     // Check if evaluator already has an active batch for this subject
//     const activeBatch = await CopyBatchAssignment.findOne({
//       where: {
//         evaluator_id: evaluatorId,
//         subject_code: subjectCode,
//         is_active: true,
//         expires_at: {
//           [Op.gt]: new Date(),
//         },
//       },
//       transaction,
//     });

//     if (activeBatch) {
//       await transaction.commit();
//       const currentBatch = await getCurrentActiveBatchService(evaluatorId, subjectCode);
//       return {
//         message: `You already have an active batch for subject ${subjectCode}. Please complete it before requesting a new one.`,
//         ...currentBatch,
//       };
//     }

//     // Find subjectdata_id for the given subjectCode
//     const subjectData = await SubjectData.findOne({
//       where: { SubjectID: subjectCode },
//       attributes: ['subjectdata_id'],
//       raw: true,
//       transaction,
//     });
    
//     if (!subjectData) {
//       await transaction.rollback();
//       throw new Error(`No subject found with code ${subjectCode}`);
//     }

//     console.log("Subject Data ID for subjectCode:", subjectData.subjectdata_id);
    
//     // Find unassigned and unchecked copies from Copy table
//     const unassignedCopies = await Copy.findAll({
//       where: {
//         subjectdata_id: subjectData.subjectdata_id,
//         is_assigned: false,
//         is_evaluated: false,
//         is_rejected: false,
//       },
//       limit: batchSize,
//       attributes: ["copyid", "bag_id", "pack_id"],
//       transaction,
//     });

//     if (!unassignedCopies || unassignedCopies.length === 0) {
//       await transaction.rollback();
//       throw new Error(
//         `No unassigned copies available for subject ${subjectCode}`
//       );
//     }

//     // Create a new batch assignment or reuse an existing inactive one
//     const now = new Date();
//     const expiresAt = new Date(now.getTime() + COPY_BATCH_EXPIRY);
//     console.log("date now:", now);
//     console.log("Batch expires at:", expiresAt);
    
//     // Look for an existing inactive batch that can be reused
//     let newBatch = await CopyBatchAssignment.findOne({
//       where: {
//         evaluator_id: evaluatorId,
//         subject_code: subjectCode,
//         exam_name: examName,
//         is_active: false,
//       },
//       order: [["batch_id", "DESC"]], // pick the latest one if multiple
//       transaction,
//     });

//     let batchReused = false;
//     let reactivationCount = 0;

//     if (newBatch) {
//       // Reactivate and update old batch
//       batchReused = true;
//       reactivationCount = newBatch.reactivation_count + 1;
      
//       console.log("Reusing existing batch ID:", newBatch.batch_id);
//       await newBatch.update({
//         assigned_at: now,
//         expires_at: expiresAt,
//         is_active: true,
//         completed_at: null, // Reset completed_at since we're reactivating
//         reactivation_count: reactivationCount
//       }, { transaction });
//     } else {
//       // No previous batch found, create a new one
//       console.log("Creating new batch");
//       newBatch = await CopyBatchAssignment.create(
//         {
//           evaluator_id: evaluatorId,
//           subject_code: subjectCode,
//           exam_name: examName,
//           assigned_at: now,
//           expires_at: expiresAt,
//           is_active: true,
//           reactivation_count: 0
//         },
//         { transaction }
//       );
//     }

//     // Create individual copy assignments
//     const copyAssignments = unassignedCopies.map((copy) => ({
//       copyid: copy.copyid,
//       evaluator_id: evaluatorId,
//       batch_id: newBatch.batch_id,
//       assigned_by: "SYSTEM",
//       assigned_at: now,
//       is_checked: false,
//     }));

//     const createdAssignments = await CopyAssignments.bulkCreate(
//       copyAssignments,
//       {
//         transaction,
//         fields: [
//           "copyid",
//           "evaluator_id",
//           "batch_id",
//           "assigned_by",
//           "assigned_at",
//           "is_checked"
//         ]
//       }
//     );

//     // Mark the copies as assigned in Copy table
//     await Copy.update(
//       { is_assigned: true },
//       {
//         where: { copyid: unassignedCopies.map((copy) => copy.copyid) },
//         transaction,
//       }
//     );

//     await transaction.commit();

//     return {
//       message: `Successfully assigned ${createdAssignments.length} copies`,
//       batchId: newBatch.batch_id,
//       subjectCode,
//       examName,
//       assignedAt: newBatch.assigned_at,
//       expiresAt: newBatch.expires_at,
//       batchReused, // Flag indicating if this batch was reused
//       reactivationCount, // Number of times this batch has been reactivated
//       copies: createdAssignments.map((assignment, idx) => ({
//         assignmentId: assignment.assignment_id,
//         copyId: assignment.copyid,
//         bagId: unassignedCopies[idx].bag_id,
//         packId: unassignedCopies[idx].pack_id,
//         assignedAt: assignment.assigned_at,
//       })),
//     };
//   } catch (error) {
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

    // Start a transaction to ensure data consistency
    const transaction = await sequelize.transaction();
    
    try {
      await assignment.update({
        is_checked: true,
        checked_at: new Date(),
      }, { transaction });

      // Also update the Copy table to reflect completion
      // This is important to maintain consistency
      await Copy.update({
        current_evaluator_id: evaluatorId,
        // Don't mark as evaluated here because that should happen in saveEvaluationAndAnnotations
        // But you should set other flags that indicate processing is complete
      }, { 
        where: { copyid: copyId },
        transaction 
      });

      // Check if all copies in the batch are checked
      const remainingCopies = await CopyAssignments.count({
        where: {
          evaluator_id: evaluatorId,
          is_checked: false,
          batch_id: assignment.batch_id,
        },
        transaction
      });

      let batchStatus = "active";

      if (remainingCopies === 0) {
        const batch = await CopyBatchAssignment.findOne({
          where: {
            evaluator_id: evaluatorId,
            batch_id: assignment.batch_id,
            is_active: true,
          },
          transaction
        });

        if (batch) {
          await batch.update({
            is_active: false,
            completed_at: new Date(),
          }, { transaction });
          batchStatus = "completed";
        }
      }

      await transaction.commit();

      return {
        message: "Copy evaluation completed successfully",
        assignmentId: assignment.assignment_id,
        copyId,
        remainingCopies,
        batchStatus,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
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
          where: { copyid: expiredCopyIds, is_rejected: false },
          transaction,
        }
      );

      // Delete the unchecked assignments
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

    // IMPORTANT ADDITION: Also delete checked assignments from expired batches
    // This ensures that when reactivating a batch, there are no leftover checked copies
    await CopyAssignments.destroy({
      where: {
        batch_id: {
          [Op.in]: expiredBatchIds,
        },
        is_checked: true,
      },
      transaction,
    });

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
    // Find the subject data ID first
    const subjectData = await SubjectData.findOne({
      where: { 
        SubjectID: subjectCode,
        Course: examName 
      },
      attributes: ['subjectdata_id'],
      raw: true
    });
    
    if (!subjectData) {
      return {
        subjectCode,
        examName,
        totalCopies: 0,
        unassignedCopies: 0,
        sampleCopy: null
      };
    }
    
    // Count total copies for this subject
    const totalCopies = await Copy.count({
      where: {
        subjectdata_id: subjectData.subjectdata_id
      }
    });
    
    // Count unassigned and not evaluated copies
    const unassignedCopies = await Copy.count({
      where: {
        subjectdata_id: subjectData.subjectdata_id,
        is_assigned: false,
        is_evaluated: false,
        is_rejected: false
      }
    });
    
    // Get a sample copy for info
    const sampleCopy = await Copy.findOne({
      where: {
        subjectdata_id: subjectData.subjectdata_id
      },
      attributes: ['copyid', 'is_assigned', 'is_evaluated', 'is_rejected'],
      raw: true
    });
    
    return {
      subjectCode,
      examName,
      totalCopies,
      unassignedCopies,
      sampleCopy
    };
  } catch (error) {
    console.error("Error in checkAvailableCopies:", error);
    throw error;
  }
};

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
    // Find all reevaluation requests with copy and subject data in a single query
    const requests = await CopyReevaluation.findAll({
      where: {
        assigned_evaluator_id: evaluatorId,
        status: "Assigned",
        is_checked: false,
      },
      include: [{
        model: Copy,
        as: 'copy',
        attributes: ['copyid', 'subjectdata_id'],
        include: [{
          model: SubjectData,
          as: 'subjectData',
          attributes: ['SubjectID', 'Subject', 'Course']
        }]
      }],
      attributes: [
        'request_id',
        'copyid',
        'status',
        'assigned_evaluator_id',
        'assigned_at',
        'reason',
        'is_checked'
      ]
    });

    if (!requests || requests.length === 0) {
      return [];
    }

    // Map the results to the expected format with graceful fallbacks
    return requests.map(request => {
      // Get subject data with fallbacks if not available
      const copyDetails = request.copy || {};
      const subjectData = copyDetails.subjectData || {};

      return {
        requestId: request.request_id,
        copyId: request.copyid,
        assignedAt: request.assigned_at,
        reason: request.reason || "Administrative reevaluation",
        status: request.status,
        subjectCode: subjectData.SubjectID || "Unknown",
        subjectName: subjectData.Subject || "Unknown Subject",
        courseName: subjectData.Course || "Unknown Course",
        examName: subjectData.Course || "Unknown Exam"
      };
    });
  } catch (error) {
    console.error("Error in getEvaluatorReevaluationsService:", error);
    
    // If the include query fails, try a simpler approach as fallback
    try {
      console.log("Trying fallback approach for reevaluation data...");
      
      // Just get basic reevaluation data without associations
      const basicRequests = await CopyReevaluation.findAll({
        where: {
          assigned_evaluator_id: evaluatorId,
          status: "Assigned",
          is_checked: false,
        },
        attributes: [
          'request_id',
          'copyid',
          'status',
          'assigned_evaluator_id',
          'assigned_at',
          'reason',
          'is_checked'
        ],
        raw: true
      });
      
      if (!basicRequests || basicRequests.length === 0) {
        return [];
      }
      
      // Return basic data without subject information
      return basicRequests.map(request => ({
        requestId: request.request_id,
        copyId: request.copyid,
        assignedAt: request.assigned_at,
        reason: request.reason || "Administrative reevaluation",
        status: request.status,
        subjectCode: "Unknown",
        subjectName: "Unknown Subject",
        courseName: "Unknown Course",
        examName: "Unknown Exam"
      }));
    } catch (fallbackError) {
      console.error("Fallback approach also failed:", fallbackError);
      throw new Error(
        `Failed to retrieve reevaluation assignments: ${error.message}`
      );
    }
  }
};


/**
 * Get count of reevaluation assignments for an evaluator
 * @param {string} evaluatorId - ID of the evaluator
 * @returns {Promise<number>} - Count of reevaluation assignments
 */
export const getReevaluationCountService = async (evaluatorId) => {
  try {    
    const count = await CopyReevaluation.count({
      where: {
        assigned_evaluator_id: evaluatorId,
        status: 'Assigned',
        is_checked: false
      }
    });
    
    return count;
  } catch (error) {
    console.error("Error in getReevaluationCountService:", error);
    throw new Error(`Failed to count reevaluation assignments: ${error.message}`);
  }
};