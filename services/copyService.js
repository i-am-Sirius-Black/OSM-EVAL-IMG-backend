import fs from 'fs-extra';
import path from 'path';
import { CopyPage, CopyAnnotation, CopyAssignments } from '../models/index.js';

/**
 * Get image data for a copy page
 */
export const getCopyPageImage = async (copyId, page) => {
  const pageRecord = await CopyPage.findOne({
    where: {
      copyid: parseInt(copyId),
      page_number: parseInt(page),
    },
    attributes: ["image_data"],
  });

  if (!pageRecord || !pageRecord.image_data) {
    return null;
  }

  return pageRecord.image_data;
};





/**
 * v2 cleaner modular-> Generate PDF with annotations
 */

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

const calculateScaledDimensions = (imgWidth, imgHeight) => {
  const imgAspectRatio = imgWidth / imgHeight;
  const pageAspectRatio = A4_WIDTH / A4_HEIGHT;
  let scaledWidth, scaledHeight, x, y;

  if (imgAspectRatio > pageAspectRatio) {
    scaledWidth = A4_WIDTH - 40;
    scaledHeight = scaledWidth / imgAspectRatio;
    x = 20;
    y = (A4_HEIGHT - scaledHeight) / 2;
  } else {
    scaledHeight = A4_HEIGHT - 40;
    scaledWidth = scaledHeight * imgAspectRatio;
    x = (A4_WIDTH - scaledWidth) / 2;
    y = 20;
  }
  return { scaledWidth, scaledHeight, x, y };
};

const drawAnnotationsOnPage = (doc, annotations, x, y, xScaleFactor, yScaleFactor, img, useImageAnnotations, checkImagePath, crossImagePath) => {
  for (const annotation of annotations) {
    const originalX = (annotation.position.x * img.width) / 100;
    const originalY = (annotation.position.y * img.height) / 100;
    const scaledX = x + (originalX * xScaleFactor);
    const scaledY = y + (originalY * yScaleFactor);
    const annotationScale = Math.min(xScaleFactor, yScaleFactor);

    const drawCircle = (color) => {
      doc.circle(scaledX, scaledY, 10 * annotationScale)
        .lineWidth(2 * annotationScale)
        .fillOpacity(0.5)
        .fillAndStroke(color, color);
    };

    if (annotation.type === "check") {
      if (useImageAnnotations) {
        try {
          const checkImg = doc.openImage(checkImagePath);
          const imgSize = 75 * annotationScale;
          doc.image(checkImg, scaledX - imgSize / 2, scaledY - imgSize / 2, { width: imgSize, height: imgSize });
        } catch {
          drawCircle("green");
        }
      } else {
        drawCircle("green");
      }
    } else if (annotation.type === "cancel") {
      if (useImageAnnotations) {
        try {
          const crossImg = doc.openImage(crossImagePath);
          const imgSize = 75 * annotationScale;
          doc.image(crossImg, scaledX - imgSize / 2, scaledY - imgSize / 2, { width: imgSize, height: imgSize });
        } catch {
          drawCircle("red");
        }
      } else {
        drawCircle("red");
      }
    } else if (annotation.type === "comment") {
      doc.font("Helvetica-Oblique")
        .fontSize(50 * annotationScale)
        .fillColor("#EF4444")
        .text(annotation.text || "", scaledX, scaledY, {
          width: 400 * annotationScale,
          align: "left",
          lineBreak: true,
        });
    }
  }
};

const drawPathAnnotations = (doc, drawAnnotations, x, y, xScaleFactor, yScaleFactor, img) => {
  for (const drawAnnotation of drawAnnotations) {
    if (!drawAnnotation.position?.path?.length > 1) continue;

    doc.lineWidth(4 * Math.min(xScaleFactor, yScaleFactor))
      .strokeColor("red")
      .fillOpacity(0);

    const [firstPoint, ...rest] = drawAnnotation.position.path;
    let origX = (firstPoint.x * img.width) / 100;
    let origY = (firstPoint.y * img.height) / 100;
    doc.moveTo(x + (origX * xScaleFactor), y + (origY * yScaleFactor));

    for (const point of rest) {
      let px = (point.x * img.width) / 100;
      let py = (point.y * img.height) / 100;
      doc.lineTo(x + (px * xScaleFactor), y + (py * yScaleFactor));
    }
    doc.stroke();
  }
};

export const generatePdfWithAnnotations = async (doc, copyId, tempDir, dirName) => {
  const rootDir = path.resolve(dirName, '..');
  const checkImagePath = path.join(rootDir, "public/images/annotations/check.png");
  const crossImagePath = path.join(rootDir, "public/images/annotations/cross.png");
  const useImageAnnotations = fs.existsSync(checkImagePath) && fs.existsSync(crossImagePath);

  const annotationRecord = await CopyAnnotation.findOne({
    where: { copyid: copyId },
    attributes: ["annotations", "draw_annotations"],
  });

  let annotations = JSON.parse(annotationRecord?.annotations || "[]");
  let drawAnnotations = JSON.parse(annotationRecord?.draw_annotations || "[]");

  const pages = await CopyPage.findAll({
    where: { copyid: copyId },
    order: [["page_number", "ASC"]],
    attributes: ["page_number", "image_data"],
  });

  if (!pages.length) throw new Error("No pages found for this copy");

  for (const page of pages) {
    const { page_number, image_data } = page;
    const tempImagePath = path.join(tempDir, `temp_${copyId}_${page_number}.jpg`);
    await fs.writeFile(tempImagePath, image_data);

    try {
      doc.addPage({ size: [A4_WIDTH, A4_HEIGHT] });
      const img = doc.openImage(tempImagePath);
      const { scaledWidth, scaledHeight, x, y } = calculateScaledDimensions(img.width, img.height);

      doc.image(img, x, y, { width: scaledWidth, height: scaledHeight });

      const xScaleFactor = scaledWidth / img.width;
      const yScaleFactor = scaledHeight / img.height;

      drawAnnotationsOnPage(
        doc,
        annotations.filter(a => a.page === page_number),
        x,
        y,
        xScaleFactor,
        yScaleFactor,
        img,
        useImageAnnotations,
        checkImagePath,
        crossImagePath
      );

      drawPathAnnotations(
        doc,
        drawAnnotations.filter(a => a.page === page_number),
        x,
        y,
        xScaleFactor,
        yScaleFactor,
        img
      );
    } catch (err) {
      console.error(`Error processing page ${page_number}:`, err);
    }

    await fs.remove(tempImagePath).catch(err =>
      console.warn(`Warning: Could not remove temp file ${tempImagePath}: ${err.message}`)
    );
  }
};




// /**
//  * Generate PDF with annotations
//  */
// export const generatePdfWithAnnotations = async (doc, copyId, tempDir, dirName) => {
//   // Define paths to annotation images

//   // Go up one level from the passed dirName (from controller) to reach root directory
//   const rootDir = path.resolve(dirName, '..');

//   const checkImagePath = path.join(
//     rootDir,
//     "public/images/annotations/check.png"
//   );
//   const crossImagePath = path.join(
//     rootDir,
//     "public/images/annotations/cross.png"
//   );

//   // Check if annotation images exist
//   const useImageAnnotations =
//     fs.existsSync(checkImagePath) && fs.existsSync(crossImagePath);

//   console.log(`Using image annotations: ${useImageAnnotations}`);

//   // Fetch annotations for this copy
//   const annotationRecord = await CopyAnnotation.findOne({
//     where: { copy_id: copyId },
//     attributes: ["annotations", "draw_annotations"],
//   });

//   let annotations = [];
//   let drawAnnotations = [];

//   if (annotationRecord) {
//     annotations = JSON.parse(annotationRecord.annotations || "[]");
//     drawAnnotations = JSON.parse(annotationRecord.draw_annotations || "[]");
//     console.log("Found annotations:", annotations.length);
//     console.log("Found draw annotations:", drawAnnotations.length);
//   }

//   // Fetch all pages for this copy
//   const pages = await CopyPage.findAll({
//     where: { copy_id: copyId },
//     order: [["page_number", "ASC"]],
//     attributes: ["page_number", "image_data"],
//   });

//   if (!pages || pages.length === 0) {
//     throw new Error("No pages found for this copy");
//   }

//   console.log(`Found ${pages.length} pages for copyId: ${copyId}`);

//   // Process each page (Scale to A4 Size)
//   for (const page of pages) {
//     const pageNumber = page.page_number;
//     console.log(`Processing page ${pageNumber}`);

//     // Create a temporary image file for this page
//     const tempImagePath = path.join(
//       tempDir,
//       `temp_${copyId}_${pageNumber}.jpg`
//     );
//     await fs.writeFile(tempImagePath, page.image_data);

//     try {
//       // Add a new page to the PDF (standard A4 size)
//       const A4_WIDTH = 595.28;
//       const A4_HEIGHT = 841.89;
//       doc.addPage({ size: [A4_WIDTH, A4_HEIGHT] });
      
//       // Open image and calculate scaling to fit A4 while preserving aspect ratio
//       const img = doc.openImage(tempImagePath);
//       const imgAspectRatio = img.width / img.height;
//       const pageAspectRatio = A4_WIDTH / A4_HEIGHT;
      
//       let scaledWidth, scaledHeight, x, y;
      
//       if (imgAspectRatio > pageAspectRatio) {
//         // Image is wider than page (relative to height)
//         scaledWidth = A4_WIDTH - 40; // 20pt margin on each side
//         scaledHeight = scaledWidth / imgAspectRatio;
//         x = 20; // 20pt from left edge
//         y = (A4_HEIGHT - scaledHeight) / 2; // Center vertically
//       } else {
//         // Image is taller than page (relative to width)
//         scaledHeight = A4_HEIGHT - 40; // 20pt margin top and bottom
//         scaledWidth = scaledHeight * imgAspectRatio;
//         x = (A4_WIDTH - scaledWidth) / 2; // Center horizontally
//         y = 20; // 20pt from top
//       }
      
//       // Draw the image scaled to fit A4
//       doc.image(img, x, y, { width: scaledWidth, height: scaledHeight });

//       // We need to adjust annotations to match the new scale
//       const pageAnnotations = annotations.filter(a => a.page === pageNumber);
//       const pageDrawAnnotations = drawAnnotations.filter(a => a.page === pageNumber);
      
//       // Calculate scaling factors for annotations
//       const xScaleFactor = scaledWidth / img.width;
//       const yScaleFactor = scaledHeight / img.height;
      
//       // Draw annotations with adjusted positions
//       for (const annotation of pageAnnotations) {
//         // Convert percentage position to actual pixels on original image
//         const originalX = (annotation.position.x * img.width) / 100;
//         const originalY = (annotation.position.y * img.height) / 100;
        
//         // Apply scaling to get position on the new scaled image
//         const scaledX = x + (originalX * xScaleFactor);
//         const scaledY = y + (originalY * yScaleFactor);
        
//         // Adjust size for annotations based on scaling
//         const annotationScale = Math.min(xScaleFactor, yScaleFactor);
        
//         if (annotation.type === "check") {
//           if (useImageAnnotations) {
//             try {
//               const checkImg = doc.openImage(checkImagePath);
//               const imgSize = 75 * annotationScale;
//               doc.image(checkImg, scaledX - imgSize / 2, scaledY - imgSize / 2, {
//                 width: imgSize,
//                 height: imgSize,
//               });
//             } catch (imgErr) {
//               console.error("Error loading check image:", imgErr);
//               doc
//                 .circle(scaledX, scaledY, 10 * annotationScale)
//                 .lineWidth(2 * annotationScale)
//                 .fillOpacity(0.5)
//                 .fillAndStroke("green", "#008800");
//             }
//           } else {
//             doc
//               .circle(scaledX, scaledY, 10 * annotationScale)
//               .lineWidth(2 * annotationScale)
//               .fillOpacity(0.5)
//               .fillAndStroke("green", "#008800");
//           }
//         } else if (annotation.type === "cancel") {
//           if (useImageAnnotations) {
//             try {
//               const crossImg = doc.openImage(crossImagePath);
//               const imgSize = 75 * annotationScale;
//               doc.image(crossImg, scaledX - imgSize / 2, scaledY - imgSize / 2, {
//                 width: imgSize,
//                 height: imgSize,
//               });
//             } catch (imgErr) {
//               console.error("Error loading cancel image:", imgErr);
//               doc
//                 .circle(scaledX, scaledY, 10 * annotationScale)
//                 .lineWidth(2 * annotationScale)
//                 .fillOpacity(0.5)
//                 .fillAndStroke("red", "#880000");
//             }
//           } else {
//             doc
//               .circle(scaledX, scaledY, 10 * annotationScale)
//               .lineWidth(2 * annotationScale)
//               .fillOpacity(0.5)
//               .fillAndStroke("red", "#880000");
//           }
//         } else if (annotation.type === "comment") {
//           doc
//             .font("Helvetica-Oblique")
//             .fontSize(50 * annotationScale)
//             .fillColor("#EF4444")
//             .text(annotation.text || "", scaledX, scaledY, {
//               width: 400 * annotationScale,
//               align: "left",
//               lineBreak: true,
//             });
//         }
//       }

//       // Draw path annotations with adjusted positions
//       for (const drawAnnotation of pageDrawAnnotations) {
//         if (
//           drawAnnotation.position &&
//           drawAnnotation.position.path &&
//           drawAnnotation.position.path.length > 1
//         ) {
//           doc
//             .lineWidth(4 * Math.min(xScaleFactor, yScaleFactor))
//             .strokeColor("red")
//             .fillOpacity(0);

//           // Scale all points in the path
//           if (drawAnnotation.position.path.length > 0) {
//             const firstPoint = drawAnnotation.position.path[0];
//             const originalX = (firstPoint.x * img.width) / 100;
//             const originalY = (firstPoint.y * img.height) / 100;
//             const scaledX = x + (originalX * xScaleFactor);
//             const scaledY = y + (originalY * yScaleFactor);
            
//             doc.moveTo(scaledX, scaledY);

//             for (let i = 1; i < drawAnnotation.position.path.length; i++) {
//               const point = drawAnnotation.position.path[i];
//               const pointOriginalX = (point.x * img.width) / 100;
//               const pointOriginalY = (point.y * img.height) / 100;
//               const pointScaledX = x + (pointOriginalX * xScaleFactor);
//               const pointScaledY = y + (pointOriginalY * yScaleFactor);
              
//               doc.lineTo(pointScaledX, pointScaledY);
//             }
            
//             doc.stroke();
//           }
//         }
//       }
//     } catch (imgError) {
//       console.error(`Error processing image for page ${pageNumber}:`, imgError);
//     }

//     // Clean up the temporary image file
//     await fs.remove(tempImagePath).catch((err) =>
//       console.warn(`Warning: Could not remove temp file ${tempImagePath}: ${err.message}`)
//     );
//   }
// };


// /**
//  * Search copies by bag ID
//  */

// export const searchCopiesByBagId = async (bagId, searchTerm, sortOrder) => {
//   const gunningRecords = await CopyGunning.findAll({
//     where: { BagID: bagId },
//     attributes: ["CopyBarcode"],
//     raw: true,
//   });

//   let copyList = gunningRecords.map((record) => record.CopyBarcode);

//   // Filter by search term
//   if (searchTerm) {
//     copyList = copyList.filter((copy) =>
//       copy.toLowerCase().includes(searchTerm.toLowerCase())
//     );
//   }

//   // Sort copies
//   if (sortOrder === "asc") {
//     copyList.sort((a, b) => a.localeCompare(b));
//   } else if (sortOrder === "desc") {
//     copyList.sort((a, b) => b.localeCompare(a));
//   }

//   return copyList;
// };



// /**
//  * Get all annotated copies
//  */
// export const getAnnotatedCopies = async () => {
//   const annotatedCopies = await CopyAnnotation.findAll({
//     attributes: ['copyid'],
//     raw: true,
//   });

//   return annotatedCopies.map(record => record.copyid);
// };



// /**
//  * Get all copies by packing ID
//  * @param {string} packingId - The packing ID to get copies for
//  * @returns {Promise<string[]>} Promise resolving to list of copy barcodes
//  */
// export const getAllCopiesByPackingId = async (packingId) => {
//   if (!packingId) {
//     const error = new Error("Packing ID is required");
//     error.status = 400;
//     throw error;
//   }

//   // Step 1: Find all BagIDs for the PackingID
//   const baggingRecords = await Bagging.findAll({
//     where: { PackingID: packingId },
//     attributes: ["BagID"],
//     raw: true,
//   });

//   if (!baggingRecords || baggingRecords.length === 0) {
//     const error = new Error("No BagIDs found for the given PackingID");
//     error.status = 404;
//     throw error;
//   }

//   const bagIds = baggingRecords.map((record) => record.BagID);

//   // Step 2: Find all CopyBarcodes for the BagIDs
//   const gunningRecords = await CopyGunning.findAll({
//     where: { BagID: bagIds, IsScanned: 1 },
//     attributes: ["CopyBarcode"],
//     raw: true,
//   });

//   if (!gunningRecords || gunningRecords.length === 0) {
//     const error = new Error("No copies found for the given BagIDs");
//     error.status = 404;
//     throw error;
//   }

//   // Get all copy barcodes
//   const allCopyBarcodes = gunningRecords.map((record) => record.CopyBarcode);
  
//   // Find all assigned copies
//   const assignedCopies = await CopyAssignments.findAll({
//     where: {
//       CopyBarcode: allCopyBarcodes
//     },
//     attributes: ['CopyBarcode'],
//     raw: true
//   });
  
//   // Create a set of assigned copy barcodes for faster lookup
//   const assignedCopySet = new Set(assignedCopies.map(copy => copy.CopyBarcode));
  
//   // Filter out the assigned copies, keeping only unassigned ones
//   const unassignedCopies = allCopyBarcodes.filter(barcode => !assignedCopySet.has(barcode));
  
//   // Return the list of unassigned copy barcodes
//   return unassignedCopies;


//   // Return the list of copy barcodes
//   // return gunningRecords.map((record) => record.CopyBarcode);
// };



