import { CopyAnnotation } from '../models/index.js';

/**
 * Get annotations for a specific copy
 * @param {string} copyId - The ID of the copy
 * @returns {Object} The annotations and draw annotations
 */
export const getAnnotationsForCopy = async (copyId) => {
  // Fetch the record for the given copyId
  const record = await CopyAnnotation.findOne({
    where: { copy_id: copyId },
    attributes: ["annotations", "draw_annotations"],
  });

  if (!record) {
    // If no record is found, return empty annotations
    return { annotations: [], drawAnnotations: [] };
  }

  // Parse the JSON fields and return them
  return {
    annotations: JSON.parse(record.annotations || "[]"),
    drawAnnotations: JSON.parse(record.draw_annotations || "[]"),
  };
};

/**
 * Save or update annotations for a copy
 * @param {string} copyId - The ID of the copy
 * @param {Array} annotations - The annotations to save
 * @param {Array} drawAnnotations - The drawing annotations to save
 * @returns {Object} Result with success status and message
 */
export const saveAnnotationsForCopy = async (copyId, annotations, drawAnnotations) => {
  // Validate required data
  console.log("copyid received in annotation service:", copyId);
  
  if (!copyId) {
    const error = new Error("Copy ID is required");
    error.status = 400;
    throw error;
  }

  // Check if a record already exists for the given copyId
  const existingRecord = await CopyAnnotation.findOne({
    where: { copy_id: copyId },
  });

  if (existingRecord) {
    // Update existing annotations
    await existingRecord.update({
      annotations: JSON.stringify(annotations || []),
      draw_annotations: JSON.stringify(drawAnnotations || []),
    });

    return {
      success: true,
      message: "Annotations updated successfully",
      isNew: false
    };
  }

  // If no record exists, create a new one
  await CopyAnnotation.create({
    copy_id: copyId,
    annotations: JSON.stringify(annotations || []),
    draw_annotations: JSON.stringify(drawAnnotations || []),
  });

  return {
    success: true,
    message: "Annotations saved successfully",
    isNew: true
  };
};