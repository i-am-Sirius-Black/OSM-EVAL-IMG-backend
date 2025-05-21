import { Op } from 'sequelize';
import { sequelize } from '../config/db.js';
import { 
  SubjectAssignment, 
  CopyAssignments, 
  CopyBatchAssignment,
  UserLogin,
  SubjectData,
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

    // Get copies from this active batch
    const activeCopies = await CopyAssignments.findAll({
      where: {
        EvaluatorID: evaluatorId,
        IsChecked: false,
        BatchID: activeBatch.BatchID // This ensures we only get copies from this batch
      },
      attributes: ['AssignmentID', 'CopyBarcode', 'AssignedAt']
    });

    return {
      batchId: activeBatch.BatchID,
      subjectCode: activeBatch.SubjectCode,
      examName: activeBatch.ExamName,
      assignedAt: activeBatch.AssignedAt,
      expiresAt: activeBatch.ExpiresAt,
      copies: activeCopies.map(copy => ({
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



//? Below is old one
// import { CopyBatchAssignment, SubjectAssignment, CopyAssignments } from '../models/index.js';
// import { sequelize } from '../config/db.js';
// import { Op } from 'sequelize';

// /**
//  * Get all subjects assigned to an evaluator
//  * @param {string} evaluatorId - The evaluator's ID
//  * @returns {Promise<Array>} - List of subjects assigned to the evaluator
//  */
// export const getEvaluatorSubjectsService = async (evaluatorId) => {
//   try {
//     const assignments = await SubjectAssignment.findAll({
//       where: {
//         EvaluatorID: evaluatorId,
//         Active: true
//       },
//       attributes: ['AssignmentID', 'SubjectCode', 'ExamName', 'SlotName', 'AssignedAt']
//     });

//     return assignments.map(assignment => ({
//       assignmentId: assignment.AssignmentID,
//       subjectCode: assignment.SubjectCode,
//       examName: assignment.ExamName,
//       slotName: assignment.SlotName,
//       assignedAt: assignment.AssignedAt
//     }));
//   } catch (error) {
//     console.error('Error in getEvaluatorSubjectsService:', error);
//     throw new Error(`Failed to retrieve assigned subjects: ${error.message}`);
//   }
// };

// /**
//  * Get an evaluator's current active batch
//  * @param {string} evaluatorId - The evaluator's ID
//  * @returns {Promise<Object|null>} - Current active batch or null if none exists
//  */
// export const getCurrentActiveBatchService = async (evaluatorId) => {
//   try {
//     // Find the evaluator's current active batch
//     const activeBatch = await CopyBatchAssignment.findOne({
//       where: {
//         EvaluatorID: evaluatorId,
//         IsActive: true,
//         ExpiresAt: {
//           [Op.gt]: new Date() // Not expired yet
//         }
//       },
//       order: [['AssignedAt', 'DESC']]
//     });

//     if (!activeBatch) {
//       return null;
//     }

//     // Get the copies assigned in this batch
//     const copies = await CopyAssignments.findAll({
//       where: {
//         EvaluatorID: evaluatorId,
//         BatchID: activeBatch.BatchID
//       },
//       attributes: ['AssignmentID', 'CopyBarcode', 'IsChecked', 'AssignedAt', 'CheckedAt']
//     });

//     return {
//       batchId: activeBatch.BatchID,
//       subjectCode: activeBatch.SubjectCode,
//       examName: activeBatch.ExamName,
//       slotName: activeBatch.SlotName,
//       assignedAt: activeBatch.AssignedAt,
//       expiresAt: activeBatch.ExpiresAt,
//       remainingCopies: copies.filter(copy => !copy.IsChecked).length,
//       completedCopies: copies.filter(copy => copy.IsChecked).length,
//       totalCopies: copies.length,
//       copies: copies.map(copy => ({
//         assignmentId: copy.AssignmentID,
//         copyBarcode: copy.CopyBarcode,
//         isChecked: copy.IsChecked,
//         assignedAt: copy.AssignedAt,
//         checkedAt: copy.CheckedAt
//       }))
//     };
//   } catch (error) {
//     console.error('Error in getCurrentActiveBatchService:', error);
//     throw new Error(`Failed to retrieve active batch: ${error.message}`);
//   }
// };

// /**
//  * Assign a new batch of copies to an evaluator
//  * @param {string} evaluatorId - The evaluator's ID
//  * @param {string} subjectCode - The subject code
//  * @param {string} examName - The exam name
//  * @param {string} slotName - The slot name
//  * @param {number} batchSize - Number of copies to assign (default: 10)
//  * @returns {Promise<Object>} - The newly created batch with assigned copies
//  */
// export const assignNewBatchService = async (evaluatorId, subjectCode, examName, batchSize = 10) => {
//   const transaction = await sequelize.transaction();
  
//   try {
//     // 1. Check if evaluator already has an active batch
//     const existingActiveBatch = await CopyBatchAssignment.findOne({
//       where: {
//         EvaluatorID: evaluatorId,
//         IsActive: true,
//         ExpiresAt: {
//           [Op.gt]: new Date()
//         }
//       },
//       transaction
//     });

//     if (existingActiveBatch) {
//       await transaction.rollback();
//       throw new Error('You already have an active batch. Please complete or wait for it to expire.');
//     }

//     // 2. Check if the subject is assigned to this evaluator
//     const subjectAssignment = await SubjectAssignment.findOne({
//       where: {
//         EvaluatorID: evaluatorId,
//         SubjectCode: subjectCode,
//         ExamName: examName,
//         SlotName: slotName,
//         Active: true
//       },
//       transaction
//     });

//     console.log('subjectAssignment:', subjectAssignment);
    
//     if (!subjectAssignment) {
//       await transaction.rollback();
//       throw new Error('This subject is not assigned to you.');
//     }

//     // 3. Find unassigned copies for this subject - USING SQL SERVER SYNTAX
//     const unassignedCopies = await sequelize.query(
//       `SELECT TOP(:batchSize) c.copyid, c.subject_code 
//        FROM tbl_copies c
//        LEFT JOIN tbl_copy_assignments ca ON c.copyid = ca.CopyBarcode
//        WHERE c.subject_code = :subjectCode
//        AND c.exam_name = :examName
//        AND c.slot_name = :slotName
//        AND ca.AssignmentID IS NULL`,
//       {
//         replacements: { 
//           subjectCode, 
//           examName,
//           slotName,
//           batchSize 
//         },
//         type: sequelize.QueryTypes.SELECT,
//         transaction
//       }
//     );

//     if (unassignedCopies.length === 0) {
//       await transaction.rollback();
//       throw new Error('No unassigned copies available for this subject.');
//     }

//     // 4. Create a new batch
//     const expiryDate = new Date();
//     expiryDate.setHours(expiryDate.getHours() + 24); // 24 hour expiry
    
//     const newBatch = await CopyBatchAssignment.create({
//       EvaluatorID: evaluatorId,
//       SubjectCode: subjectCode,
//       ExamName: examName,
//       SlotName: slotName,
//       AssignedAt: new Date(),
//       ExpiresAt: expiryDate,
//       IsActive: true
//     }, { transaction });

//     // 5. Assign copies to the evaluator with batch ID
//     const copyAssignments = unassignedCopies.map(copy => ({
//       CopyBarcode: copy.copyid,
//       EvaluatorID: evaluatorId,
//       AssignedBy: evaluatorId, // Self-assigned
//       AssignedAt: new Date(),
//       IsChecked: false,
//       BatchID: newBatch.BatchID
//     }));

//     await CopyAssignments.bulkCreate(copyAssignments, { 
//       transaction,
//       fields: ['CopyBarcode', 'EvaluatorID', 'AssignedBy', 'AssignedAt', 'IsChecked', 'BatchID']
//     });

//     await transaction.commit();

//     // Return the complete batch information
//     return {
//       batchId: newBatch.BatchID,
//       subjectCode,
//       examName,
//       slotName,
//       assignedAt: newBatch.AssignedAt,
//       expiresAt: newBatch.ExpiresAt,
//       totalCopies: copyAssignments.length,
//       copies: copyAssignments.map(copy => ({
//         copyBarcode: copy.CopyBarcode,
//         isChecked: false,
//         assignedAt: copy.AssignedAt
//       }))
//     };
//   } catch (error) {
//     await transaction.rollback();
//     console.error('Error in assignNewBatchService:', error);
//     throw error;
//   }
// };






// /**
//  * Setup a scheduled task to expire batches
//  */
// export const setupBatchExpiryTask = () => {
//   // This should be set up when the server starts
//   setInterval(async () => {
//     try {
//       // Find expired batches and mark them inactive
//       await CopyBatchAssignment.update(
//         { IsActive: false },
//         {
//           where: {
//             IsActive: true,
//             ExpiresAt: {
//               [Op.lt]: new Date()
//             }
//           }
//         }
//       );

//       // Unassign copies from expired batches
//       const expiredBatches = await CopyBatchAssignment.findAll({
//         where: {
//           IsActive: false,
//           CompletedAt: null
//         }
//       });

//       for (const batch of expiredBatches) {
//         await CopyAssignments.destroy({
//           where: {
//             BatchID: batch.BatchID,
//             IsChecked: false // Only delete assignments that weren't checked
//           }
//         });
//       }

//       console.log('Expired batches processed successfully');
//     } catch (error) {
//       console.error('Error processing expired batches:', error);
//     }
//   }, 15 * 60 * 1000); // Run every 15 minutes
// };