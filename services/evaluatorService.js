import { Op } from 'sequelize';
import { sequelize } from '../config/db.js';
import { 
  SubjectAssignment, 
  CopyAssignments, 
  CopyBatchAssignment,
  UserLogin,
  SubjectData,
  CopyReevaluation,
} from '../models/index.js';



/**
 * Get all subjects assigned to an evaluator with iscopyassigned flag
 * 
 * @param {string} evaluatorId - Evaluator ID
 * @returns {Promise<Array>} List of subjects assigned to the evaluator
 */
export const getEvaluatorSubjectsService = async (evaluatorId) => {
  try {
    const subjects = await SubjectAssignment.findAll({
      where: { 
        EvaluatorID: evaluatorId,
        Active: true
      },
      attributes: ['AssignmentID', 'SubjectCode', 'ExamName', 'AssignedAt']
    });

    // Get all active batch assignments for this evaluator
    const activeBatches = await CopyBatchAssignment.findAll({
      where: {
        EvaluatorID: evaluatorId,
        IsActive: true,
        ExpiresAt: {
          [Op.gt]: new Date() // Not expired yet
        }
      },
      attributes: ['SubjectCode']
    });

    // Create a Set of subject codes that have active assignments
    const assignedSubjectCodes = new Set(activeBatches.map(batch => batch.SubjectCode));

    return subjects.map(subject => ({
      assignmentId: subject.AssignmentID,
      subjectCode: subject.SubjectCode,
      examName: subject.ExamName,
      assignedAt: subject.AssignedAt,
      isCopyAssigned: assignedSubjectCodes.has(subject.SubjectCode) // Check if this subject has active copies assigned
    }));
  } catch (error) {
    console.error('Error in getEvaluatorSubjectsService:', error);
    throw new Error(`Failed to retrieve assigned subjects: ${error.message}`);
  }
};


/**
 * Check if the evaluator already has an active batch for the given subject
 * 
 * @param {string} evaluatorId - Evaluator ID
 * @param {string} [subjectCode] - Optional subject code to filter by specific subject
 * @returns {Promise<Object|null>} Active batch details or null if none exists
 */
export const getCurrentActiveBatchService = async (evaluatorId, subjectCode = null) => {
  try {
    // Build the where clause
    const whereClause = {
      EvaluatorID: evaluatorId,
      IsActive: true,
      ExpiresAt: {
        [Op.gt]: new Date() // Not expired yet
      }
    };
    
    // Add subject filter if provided
    if (subjectCode) {
      whereClause.SubjectCode = subjectCode;
    }
    
    // Find active batch for this evaluator (and optionally for a specific subject)
    const activeBatch = await CopyBatchAssignment.findOne({
      where: whereClause
    });

    if (!activeBatch) {
      return null;
    }

    // // Get copies from this active batch
    // const activeCopies = await CopyAssignments.findAll({
    //   where: {
    //     EvaluatorID: evaluatorId,
    //     IsChecked: false,
    //     BatchID: activeBatch.BatchID // This ensures we only get copies from this batch
    //   },
    //   attributes: ['AssignmentID', 'CopyBarcode', 'AssignedAt']
    // });

    // return {
    //   batchId: activeBatch.BatchID,
    //   subjectCode: activeBatch.SubjectCode,
    //   examName: activeBatch.ExamName,
    //   assignedAt: activeBatch.AssignedAt,
    //   expiresAt: activeBatch.ExpiresAt,
    //   copies: activeCopies.map(copy => ({
    //     assignmentId: copy.AssignmentID,
    //     copyBarcode: copy.CopyBarcode,
    //     assignedAt: copy.AssignedAt,
    //     isChecked: copy.IsChecked
    //   }))
    // };


    // Get ALL copies for the current active batch
const allBatchCopies = await CopyAssignments.findAll({
  where: {
    EvaluatorID: evaluatorId,
    BatchID: activeBatch.BatchID // Get all copies from this batch
  },
  attributes: ['AssignmentID', 'CopyBarcode', 'AssignedAt', 'IsChecked']
});

// Calculate counts
const checkedCount = allBatchCopies.filter(copy => copy.IsChecked).length;
const pendingCount = allBatchCopies.filter(copy => !copy.IsChecked).length;
const totalCount = allBatchCopies.length;

return {
  batchId: activeBatch.BatchID,
  subjectCode: activeBatch.SubjectCode,
  examName: activeBatch.ExamName,
  assignedAt: activeBatch.AssignedAt,
  expiresAt: activeBatch.ExpiresAt,
  checkedCount,
  pendingCount,
  totalCount,
  copies: allBatchCopies.map(copy => ({
    assignmentId: copy.AssignmentID,
    copyBarcode: copy.CopyBarcode,
    assignedAt: copy.AssignedAt,
    isChecked: copy.IsChecked
  }))
};

  } catch (error) {
    console.error('Error in getCurrentActiveBatchService:', error);
    throw new Error(`Failed to check for active batch: ${error.message}`);
  }
};

// /**
//  * Check if the evaluator already has an active batch for the given subject
//  * 
//  * @param {string} evaluatorId - Evaluator ID
//  * @returns {Promise<Object|null>} Active batch details or null if none exists
//  */
// export const getCurrentActiveBatchService = async (evaluatorId) => {
//   try {
//     // Find active batch for this evaluator
//     const activeBatch = await CopyBatchAssignment.findOne({
//       where: {
//         EvaluatorID: evaluatorId,
//         IsActive: true,
//         ExpiresAt: {
//           [Op.gt]: new Date() // Not expired yet
//         }
//       }
//     });

//     if (!activeBatch) {
//       return null;
//     }

//     // Get copies from this active batch
//     const activeCopies = await CopyAssignments.findAll({
//       where: {
//         EvaluatorID: evaluatorId,
//         IsChecked: false
//       },
//       attributes: ['AssignmentID', 'CopyBarcode', 'AssignedAt']
//     });

//     return {
//       batchId: activeBatch.BatchID,
//       subjectCode: activeBatch.SubjectCode,
//       examName: activeBatch.ExamName,
//       assignedAt: activeBatch.AssignedAt,
//       expiresAt: activeBatch.ExpiresAt,
//       copies: activeCopies.map(copy => ({
//         assignmentId: copy.AssignmentID,
//         copyBarcode: copy.CopyBarcode,
//         assignedAt: copy.AssignedAt
//       }))
//     };
//   } catch (error) {
//     console.error('Error in getCurrentActiveBatchService:', error);
//     throw new Error(`Failed to check for active batch: ${error.message}`);
//   }
// };

/**
 * Assign a new batch of copies to the evaluator
 * 
 * @param {string} evaluatorId - Evaluator ID
 * @param {string} subjectCode - Subject code
 * @param {string} examName - Exam name
 * @param {number} batchSize - Number of copies to assign (default: 10)
 * @returns {Promise<Object>} Details of the assigned batch and copies
 */
export const assignNewBatchService = async (evaluatorId, subjectCode, examName, batchSize = 10) => {
  // Start a transaction
  let transaction;
  
  try {
    transaction = await sequelize.transaction();
    
    // Check if the subject is assigned to this evaluator
    const subjectAssignment = await SubjectAssignment.findOne({
      where: {
        EvaluatorID: evaluatorId,
        SubjectCode: subjectCode,
        ExamName: examName,
        Active: true
      }
    });

    if (!subjectAssignment) {
      throw new Error(`Subject ${subjectCode} for exam ${examName} is not assigned to evaluator ${evaluatorId}`);
    }

    // // Check if evaluator already has an active batch for any subject
    // const activeBatch = await CopyBatchAssignment.findOne({
    //   where: {
    //     EvaluatorID: evaluatorId,
    //     IsActive: true,
    //     ExpiresAt: {
    //       [Op.gt]: new Date() // Not expired yet
    //     }
    //   },
    //   transaction
    // });


      //* Check if evaluator already has an active batch FOR THIS SPECIFIC SUBJECT
    const activeBatch = await CopyBatchAssignment.findOne({
      where: {
        EvaluatorID: evaluatorId,
        SubjectCode: subjectCode, // Only check for this specific subject
        IsActive: true,
        ExpiresAt: {
          [Op.gt]: new Date() // Not expired yet
        }
      },
      transaction
    });

    if (activeBatch) {
      // Don't rollback here - just return the current batch
      await transaction.commit();
      const currentBatch = await getCurrentActiveBatchService(evaluatorId);
      return {
        message: `You already have an active batch for subject ${subjectCode}. Please complete it before requesting a new one.`,
        ...currentBatch
      };
    }

// Find unassigned copies directly from SubjectData
const unassignedCopies = await SubjectData.findAll({
  where: {
    SubjectID: subjectCode,  // Make sure this matches the actual column name casing
    IsAssigned: false
  },
  limit: batchSize,
  attributes: ['barcode', 'bagid', 'packid'],
  transaction
});

// Add a debug log to see what's happening
console.log(`Looking for copies with SubjectID='${subjectCode}', IsAssigned=false`);
console.log(`Found ${unassignedCopies?.length || 0} unassigned copies`);
    if (!unassignedCopies || unassignedCopies.length === 0) {
      await transaction.commit(); // Commit instead of rollback for this case
      throw new Error(`No unassigned copies available for subject ${subjectCode}`);
    }

       // Create a new batch assignment
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry
    
    const newBatch = await CopyBatchAssignment.create({
      EvaluatorID: evaluatorId,
      SubjectCode: subjectCode,
      ExamName: examName,
      AssignedAt: new Date(),
      ExpiresAt: expiresAt,
      IsActive: true
    }, { transaction });

    // Create individual copy assignments
    const copyAssignments = unassignedCopies.map(copy => ({
      CopyBarcode: copy.barcode,
      EvaluatorID: evaluatorId,
      BatchID: newBatch.BatchID, // Add the BatchID to link copies to their batch
      AssignedBy: 'SYSTEM', // Assigned by system, not admin
      AssignedAt: new Date(),
      IsChecked: false
    }));

    const createdAssignments = await CopyAssignments.bulkCreate(copyAssignments, { 
      transaction,
      fields: ['CopyBarcode', 'EvaluatorID', 'BatchID', 'AssignedBy', 'AssignedAt', 'IsChecked']
    });

    // Mark the copies as assigned in SubjectData
    await SubjectData.update(
      { IsAssigned: true },
      { 
        where: { barcode: unassignedCopies.map(copy => copy.barcode) },
        transaction 
      }
    );

    // Commit the transaction
    await transaction.commit();

    return {
      message: `Successfully assigned ${createdAssignments.length} copies`,
      batchId: newBatch.BatchID,
      subjectCode,
      examName,
      assignedAt: newBatch.AssignedAt,
      expiresAt: newBatch.ExpiresAt,
      copies: createdAssignments.map((assignment, index) => ({
        assignmentId: assignment.AssignmentID,
        copyBarcode: assignment.CopyBarcode,
        bagId: unassignedCopies[index].bagid,
        packId: unassignedCopies[index].packid,
        assignedAt: assignment.AssignedAt
      }))
    };
    
  } catch (error) {
    // Only rollback if transaction exists and is still active
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError);
      }
    }
    
    console.error('Error in assignNewBatchService:', error);
    throw error;
  }
};


/**
 * Mark a copy as started for evaluation
 * 
 * @param {string} evaluatorId - Evaluator ID
 * @param {string} copyBarcode - Copy barcode
 * @returns {Promise<Object>} Updated assignment details
 */
export const startCopyEvaluationService = async (evaluatorId, copyBarcode) => {
  try {
    // Find the assignment
    const assignment = await CopyAssignments.findOne({
      where: {
        CopyBarcode: copyBarcode,
        EvaluatorID: evaluatorId,
        IsChecked: false
      }
    });

    if (!assignment) {
      throw new Error(`Copy ${copyBarcode} is not assigned to evaluator ${evaluatorId} or has already been checked`);
    }

    // Find the batch this belongs to
    const batch = await CopyBatchAssignment.findOne({
      where: {
        EvaluatorID: evaluatorId,
        IsActive: true
      }
    });

    if (batch) {
      // Reset expiry time when evaluation starts
      // This gives the evaluator more time to complete once they've started
      const newExpiresAt = new Date();
      newExpiresAt.setHours(newExpiresAt.getHours() + 24); // Another 24 hours from now
      
      await batch.update({
        ExpiresAt: newExpiresAt
      });
    }

    return {
      message: 'Copy evaluation started successfully',
      assignmentId: assignment.AssignmentID,
      copyBarcode,
      newExpiryTime: batch ? batch.ExpiresAt : null
    };
  } catch (error) {
    console.error('Error in startCopyEvaluationService:', error);
    throw error;
  }
};

/**
 * Mark copy as completed
 * 
 * @param {string} evaluatorId - Evaluator ID
 * @param {string} copyBarcode - Copy barcode
 * @returns {Promise<Object>} Updated assignment details
 */
export const completeCopyEvaluationService = async (evaluatorId, copyBarcode) => {
  try {
    // Find the assignment
    const assignment = await CopyAssignments.findOne({
      where: {
        CopyBarcode: copyBarcode,
        EvaluatorID: evaluatorId,
        IsChecked: false
      }
    });

    if (!assignment) {
      throw new Error(`Copy ${copyBarcode} is not assigned to evaluator ${evaluatorId} or has already been checked`);
    }

    // Update the assignment
    await assignment.update({
      IsChecked: true,
      CheckedAt: new Date()
    });

    // Check if all copies in the batch are checked
    const remainingCopies = await CopyAssignments.count({
      where: {
        EvaluatorID: evaluatorId,
        IsChecked: false
      }
    });

    let batchStatus = "active";
    
    // If all copies are evaluated, mark the batch as completed
    if (remainingCopies === 0) {
      const batch = await CopyBatchAssignment.findOne({
        where: {
          EvaluatorID: evaluatorId,
          IsActive: true
        }
      });
      
      if (batch) {
        await batch.update({
          IsActive: false,
          CompletedAt: new Date()
        });
        batchStatus = "completed";
      }
    }

    return {
      message: 'Copy evaluation completed successfully',
      assignmentId: assignment.AssignmentID,
      copyBarcode,
      remainingCopies,
      batchStatus
    };
  } catch (error) {
    console.error('Error in completeCopyEvaluationService:', error);
    throw error;
  }
};


/**
 * Reset expired batches and remove assignments
 * Called by a scheduled job
 */
export const resetExpiredBatchesService = async () => {
  const transaction = await sequelize.transaction();
  
  try {
    // Find all expired batches
    const expiredBatches = await CopyBatchAssignment.findAll({
      where: {
        IsActive: true,
        ExpiresAt: {
          [Op.lt]: new Date() // Already expired
        }
      },
      transaction
    });

    if (expiredBatches.length === 0) {
      await transaction.commit();
      return { message: 'No expired batches found', count: 0 };
    }

    // Get all batch IDs that have expired
    const expiredBatchIds = expiredBatches.map(batch => batch.BatchID);

    // Mark batches as inactive
    await CopyBatchAssignment.update(
      { IsActive: false },
      { 
        where: { BatchID: expiredBatchIds },
        transaction
      }
    );

    // Find all copy assignments FOR THESE SPECIFIC BATCHES that aren't checked
    const expiredAssignments = await CopyAssignments.findAll({
      where: {
        BatchID: {
          [Op.in]: expiredBatchIds
        },
        IsChecked: false
      },
      transaction
    });

    // Get all barcodes of expired assignments
    const expiredBarcodes = expiredAssignments.map(assignment => assignment.CopyBarcode);

    // Mark copies as unassigned in SubjectData
    if (expiredBarcodes.length > 0) {
      await SubjectData.update(
        { IsAssigned: false },
        { 
          where: { barcode: expiredBarcodes },
          transaction 
        }
      );

      // Delete the assignments - now using BatchID to only target expired batch assignments
      await CopyAssignments.destroy({
        where: {
          BatchID: {
            [Op.in]: expiredBatchIds
          },
          IsChecked: false
        },
        transaction
      });
    }

    await transaction.commit();

    return {
      message: 'Successfully reset expired batches',
      batchesReset: expiredBatches.length,
      assignmentsRemoved: expiredAssignments.length
    };
  } catch (error) {
    await transaction.rollback();
    console.error('Error in resetExpiredBatchesService:', error);
    throw error;
  }
};

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
//           [Op.lt]: new Date() // Already expired
//         }
//       },
//       transaction
//     });

//     if (expiredBatches.length === 0) {
//       await transaction.commit();
//       return { message: 'No expired batches found', count: 0 };
//     }

//     // Get all evaluator IDs with expired batches
//     const expiredBatchIds = expiredBatches.map(batch => batch.BatchID);

//     // Mark batches as inactive
//     await CopyBatchAssignment.update(
//       { IsActive: false },
//       { 
//         where: { BatchID: expiredBatchIds },
//         transaction
//       }
//     );

//     // Find all copy assignments for these batches that aren't checked
//     const expiredAssignments = await CopyAssignments.findAll({
//       where: {
//         EvaluatorID: {
//           [Op.in]: expiredBatches.map(batch => batch.EvaluatorID)
//         },
//         IsChecked: false
//       },
//       transaction
//     });

//     // Get all barcodes of expired assignments
//     const expiredBarcodes = expiredAssignments.map(assignment => assignment.CopyBarcode);

//     // Mark copies as unassigned in SubjectData
//     if (expiredBarcodes.length > 0) {
//       await SubjectData.update(
//         { IsAssigned: false },
//         { 
//           where: { barcode: expiredBarcodes },
//           transaction 
//         }
//       );

//       // Delete the assignments
//       await CopyAssignments.destroy({
//         where: {
//           AssignmentID: expiredAssignments.map(a => a.AssignmentID),
//           BatchID: expiredAssignments.map(a => a.BatchID)
//         },
//         transaction
//       });
//     }

//     await transaction.commit();

//     return {
//       message: 'Successfully reset expired batches',
//       batchesReset: expiredBatches.length,
//       assignmentsRemoved: expiredAssignments.length
//     };
//   } catch (error) {
//     await transaction.rollback();
//     console.error('Error in resetExpiredBatchesService:', error);
//     throw error;
//   }
// };


// Debug helper function
export const checkAvailableCopies = async (subjectCode, examName) => {
  try {
    // Check how many total copies exist for this subject/exam
    const totalCopies = await SubjectData.count({
      where: {
        SubjectID: subjectCode,
        Course: examName
      }
    });

    // Check how many unassigned copies exist
    const unassignedCopies = await SubjectData.count({
      where: {
        SubjectID: subjectCode,
        Course: examName,
        IsAssigned: false
      }
    });

    // Get sample copy to verify data structure
    const sampleCopy = await SubjectData.findOne({
      where: {
        SubjectID: subjectCode,
        Course: examName
      }
    });

    return {
      subjectCode,
      examName,
      totalCopies,
      unassignedCopies,
      sampleCopy: sampleCopy ? {
        barcode: sampleCopy.barcode,
        subjectID: sampleCopy.SubjectID,
        course: sampleCopy.Course,
        isAssigned: sampleCopy.IsAssigned
      } : null
    };
  } catch (error) {
    console.error('Error in checkAvailableCopies:', error);
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
export const submitReevaluationService = async (requestId, evaluatorId, reevaluatedMarks, remarks) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Find the re-evaluation request and verify it exists
    const reevalRequest = await CopyReevaluation.findOne({
      where: {
        RequestID: requestId,
        Status: 'Assigned',
        AssignedEvaluatorID: evaluatorId
      },
      transaction
    });

    if (!reevalRequest) {
      await transaction.rollback();
      const error = new Error(`No active re-evaluation request found with ID ${requestId} for evaluator ${evaluatorId}`);
      error.status = 404;
      throw error;
    }

    // Update the re-evaluation request with results
    const updatedRequest = await reevalRequest.update({
      Status: 'Completed',
      ReevaluatedMarks: reevaluatedMarks,
      Remarks: remarks,
      SubmittedAt: new Date()
    }, { transaction });

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
      remarks: updatedRequest.Remarks
    };
  } catch (error) {
    if (transaction.finished !== 'rollback') {
      await transaction.rollback();
    }
    console.error('Error in submitReevaluationService:', error);
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
        Status: 'Assigned', // Only get active assignments
        isChecked: false
      },
      include: [
        {
          model: SubjectData,
          as: 'CopyDetails',
          attributes: ['SubjectID', 'Subject', 'Course', 'barcode'], // Use correct column names from your model
          required: false
        }
      ]
    });

    if (!requests || requests.length === 0) {
      return [];
    }

    // Format the data for API response with correct property mappings
    return requests.map(request => ({
      requestId: request.RequestID,
      copyId: request.CopyID,
      assignedAt: request.AssignedAt,
      reason: request.Reason,
      status: request.Status,
      subjectCode: request.CopyDetails?.SubjectID, // Map to the actual column name
      subjectName: request.CopyDetails?.Subject || 'Unknown Subject', // Map to the actual column name
      examName: request.CopyDetails?.Course || 'Unknown Exam', // Map to the actual column name
      courseName: request.CopyDetails?.Course || 'Unknown Course' // Use Course directly
    }));
  } catch (error) {
    console.error('Error in getEvaluatorReevaluationsService:', error);
    throw new Error(`Failed to retrieve reevaluation assignments: ${error.message}`);
  }
};

/**
 * Helper function to extract course name from subject code
 * @param {string} subjectCode - The subject code
 * @returns {string} - Course name
 */
const getCourseNameFromSubjectCode = (subjectCode) => {
  // This is a placeholder implementation - modify based on your actual subject code format
  if (!subjectCode) return 'Unknown Course';
  
  // Example implementation assuming subject codes follow a pattern like "CS101-BTECH"
  const parts = subjectCode.split('-');
  if (parts.length > 1) {
    return parts[1];
  }
  
  return 'General Course';
};

