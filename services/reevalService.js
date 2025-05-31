// import { CopyEval, CopyAnnotation, CopyReevaluation } from '../models/index.js';

// export const submitReevaluation = async ({
//   copyid,
//   obt_mark2,
//   eval_id2,
//   eval_time2,
//   annotations2,
//   draw_annotations2,
//   remarks = null,
// }) => {
//   // Validate input
//   if (!copyid || obt_mark2 == null || !eval_id2) {
//     const error = new Error("Missing required fields for re-evaluation");
//     error.status = 400;
//     throw error;
//   }

//   // Find the existing evaluation record
//   const evalRecord = await CopyEval.findOne({ where: { copyid } });
//   if (!evalRecord) {
//     const error = new Error("No evaluation record found for this copy");
//     error.status = 404;
//     throw error;
//   }

//   // Update re-evaluation columns
//   await evalRecord.update({
//     obt_mark2,
//     eval_id2,
//     eval_time2,
//     status: "Reevaluated",
//     updated_at: new Date(),
//   });

//   // Update or create annotation record
//   let annotationRecord = await CopyAnnotation.findOne({ where: { copyid: copyid } });
//   if (annotationRecord) {
//     await annotationRecord.update({
//       annotations2: JSON.stringify(annotations2 || []),
//       draw_annotations2: JSON.stringify(draw_annotations2 || []),
//     });
//   } else {
//     await CopyAnnotation.create({
//       copyid: copyid,
//       annotations2: JSON.stringify(annotations2 || []),
//       draw_annotations2: JSON.stringify(draw_annotations2 || []),
//     });
//   }

//   // Update the CopyReevaluation request table
//   const reevalRequest = await CopyReevaluation.findOne({ where: { copyid: copyid } });
//   if (reevalRequest) {
//     await reevalRequest.update({
//       status: "Completed",
//       reevaluated_marks: obt_mark2,
//       remarks: remarks || null,
//       is_checked: true,
//       submitted_at: new Date(),
//     });
//   }

//   return { success: true, message: "Re-evaluation submitted successfully" };
// };



import { CopyEval, CopyAnnotation, CopyReevaluation, Copy } from '../models/index.js';

export const submitReevaluation = async ({
  copyid,
  obt_mark2,
  eval_id2,
  eval_time2,
  annotations2,
  draw_annotations2,
  remarks = null,
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
    updated_at: new Date(),
  });

  // Update or create annotation record
  let annotationRecord = await CopyAnnotation.findOne({ where: { copyid: copyid } });
  if (annotationRecord) {
    await annotationRecord.update({
      annotations2: JSON.stringify(annotations2 || []),
      draw_annotations2: JSON.stringify(draw_annotations2 || []),
    });
  } else {
    await CopyAnnotation.create({
      copyid: copyid,
      annotations2: JSON.stringify(annotations2 || []),
      draw_annotations2: JSON.stringify(draw_annotations2 || []),
    });
  }

  // Update the CopyReevaluation request table
  const reevalRequest = await CopyReevaluation.findOne({ where: { copyid: copyid } });
  if (reevalRequest) {
    await reevalRequest.update({
      status: "Completed",
      reevaluated_marks: obt_mark2,
      remarks: remarks || null,
      is_checked: true,
      submitted_at: new Date(),
    });
  }

  // Update the Copy record in tbl_copies
  const copyRecord = await Copy.findByPk(copyid);
  if (copyRecord) {
    await copyRecord.update({
      is_reevaluated: true,
      evaluation_status: "Reevaluated", 
      updated_at: new Date()
    });
  } else {
    console.warn(`Copy record not found for copyid: ${copyid} during reevaluation submission`);
  }

  return { success: true, message: "Re-evaluation submitted successfully" };
};