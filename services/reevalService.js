import { CopyEval, CopyAnnotation, CopyReevaluation } from '../models/index.js';

export const submitReevaluation = async ({
  copyid,
  obt_mark2,
  eval_id2,
  eval_time2,
  annotations2,
  draw_annotations2,
}) => {
  // Validate input
  if (!copyid || obt_mark2 == null || !eval_id2) {
    const error = new Error("Missing required fields for re-evaluation");
    error.status = 400;
    throw error;
  }

  // Find the existing evaluation record
  const evalRecord = await CopyEval.findOne({ where: { copyid } });
  if (!evalRecord) {
    const error = new Error("No evaluation record found for this copy");
    error.status = 404;
    throw error;
  }

  // Update re-evaluation columns
  await evalRecord.update({
    obt_mark2,
    eval_id2,
    eval_time2,
    status: "Reevaluated",
    updatedat: new Date(),
  });

  // Update or create annotation record
  let annotationRecord = await CopyAnnotation.findOne({ where: { copy_id: copyid } });
  if (annotationRecord) {
    await annotationRecord.update({
      annotations2: JSON.stringify(annotations2 || []),
      draw_annotations2: JSON.stringify(draw_annotations2 || []),
    });
  } else {
    await CopyAnnotation.create({
      copy_id: copyid,
      annotations2: JSON.stringify(annotations2 || []),
      draw_annotations2: JSON.stringify(draw_annotations2 || []),
    });
  }

  // Update the CopyReevaluation request table
  const reevalRequest = await CopyReevaluation.findOne({ where: { CopyID: copyid } });
  if (reevalRequest) {
    await reevalRequest.update({
      Status: "Completed",
      ReevaluatedMarks: obt_mark2,
      Remarks: remarks || null,
      IsChecked: true,
      SubmittedAt: new Date(),
    });
  }

  return { success: true, message: "Re-evaluation submitted successfully" };
};