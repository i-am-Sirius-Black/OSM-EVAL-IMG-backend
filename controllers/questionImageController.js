import { QuestionImages, ExamPapers, Questions } from '../models/index.js';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

// Configure multer for batch uploads (multiple files)
const batchUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  },
}).array('questionImages', 50); // Allow up to 50 files

// Batch upload multiple question images with binary storage
export const batchUploadQuestionImages = async (req, res) => {
  batchUpload(req, res, async (err) => {
    try {
      if (err) {
        return res.status(400).json({ 
          success: false, 
          message: err.message 
        });
      }

      const { paperId, questionData } = req.body;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'No files provided' 
        });
      }

      if (!paperId || !questionData) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required fields' 
        });
      }

      // Parse question data
      let parsedQuestionData;
      try {
        parsedQuestionData = JSON.parse(questionData);
      } catch (parseError) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid question data format' 
        });
      }

      // Validate paper exists
      const paper = await ExamPapers.findByPk(paperId);
      if (!paper) {
        return res.status(404).json({ 
          success: false, 
          message: 'Paper not found' 
        });
      }

      const uploadResults = [];
      const errors = [];

      // Process each file
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const questionInfo = parsedQuestionData[i];

        if (!questionInfo) {
          errors.push(`No question data for file ${i + 1}`);
          continue;
        }

        try {
          const { questionId, questionNumber, parentQuestion, partLetter, type } = questionInfo;

          // Determine actual question number for validation
          const actualQuestionNumber = type === 'part' ? parentQuestion : questionNumber;

          // Validate question exists
          const question = await Questions.findOne({
            where: { 
              paper_id: paperId, 
              q_no: actualQuestionNumber 
            },
          });

          if (!question) {
            errors.push(`Question ${actualQuestionNumber} not found`);
            continue;
          }

          // Validate part letter if it's a part question
          if (partLetter) {
            if (!question.has_parts || partLetter.charCodeAt(0) - 97 >= question.parts_count) {
              errors.push(`Invalid part letter ${partLetter} for question ${actualQuestionNumber}`);
              continue;
            }
          }

          // Create the streaming URL
          const imageUrl = `/api/question-images/stream/${paperId}/${actualQuestionNumber}${partLetter ? `?partLetter=${partLetter}` : ''}`;

          // Update or create DB record with binary data
          const existingImage = await QuestionImages.findOne({
            where: {
              paper_id: paperId,
              question_number: actualQuestionNumber,
              part_letter: partLetter || null,
            },
          });

          if (existingImage) {
            await existingImage.update({
              image_data: file.buffer,
            });
          } else {
            await QuestionImages.create({
              paper_id: paperId,
              question_number: actualQuestionNumber,
              part_letter: partLetter || null,
              image_data: file.buffer,
            });
          }

          uploadResults.push({
            questionId,
            questionNumber: type === 'part' ? `${actualQuestionNumber}${partLetter}` : actualQuestionNumber,
            success: true,
            imageUrl,
            message: 'Image uploaded successfully'
          });

        } catch (uploadError) {
          console.error(`Upload error for file ${i + 1}:`, uploadError);
          errors.push(`Failed to upload image for question ${questionInfo.questionNumber}: ${uploadError.message}`);
          
          uploadResults.push({
            questionId: questionInfo.questionId,
            questionNumber: questionInfo.questionNumber,
            success: false,
            error: uploadError.message
          });
        }
      }

      // Return results
      const successCount = uploadResults.filter(r => r.success).length;
      const errorCount = errors.length;

      res.json({
        success: true,
        message: `Batch upload completed: ${successCount} successful, ${errorCount} failed`,
        results: uploadResults,
        errors: errors,
        summary: {
          total: req.files.length,
          successful: successCount,
          failed: errorCount
        }
      });

    } catch (error) {
      console.error('Batch upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during batch upload'
      });
    }
  });
};

// Stream image from database
export const streamQuestionImage = async (req, res) => {
  try {
    const { paperId, questionNumber } = req.params;
    const { partLetter } = req.query;

    // Find the image record
    const imageRecord = await QuestionImages.findOne({
      where: {
        paper_id: paperId,
        question_number: questionNumber,
        part_letter: partLetter || null
      },
      attributes: ['image_data']
    });

    if (!imageRecord || !imageRecord.image_data) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Set appropriate headers for image streaming
    res.set({
      'Content-Type': 'image/jpeg', // Default to JPEG, you could store MIME type if needed
      'Content-Length': imageRecord.image_data.length,
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      'ETag': `"${paperId}-${questionNumber}-${partLetter || 'main'}"`
    });

    // Stream the binary data
    res.send(imageRecord.image_data);

  } catch (error) {
    console.error('Stream image error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Remove question image
export const removeQuestionImage = async (req, res) => {
  try {
    const { paperId, questionNumber } = req.params;
    const { partLetter } = req.query;

    // Find and delete the image record
    const imageRecord = await QuestionImages.findOne({
      where: {
        paper_id: paperId,
        question_number: questionNumber,
        part_letter: partLetter || null
      }
    });

    if (!imageRecord) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Delete the database record (binary data will be deleted automatically)
    await imageRecord.destroy();

    res.json({
      success: true,
      message: 'Image removed successfully'
    });
  } catch (error) {
    console.error('Remove error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get question images metadata for a paper
export const getQuestionImagesForPaper = async (req, res) => {
  try {
    const { paperId } = req.params;

    // Verify paper exists
    const paper = await ExamPapers.findByPk(paperId);
    if (!paper) {
      return res.status(404).json({
        success: false,
        message: 'Paper not found'
      });
    }

    // Get all images metadata for this paper (no binary data)
    const images = await QuestionImages.findAll({
      where: {
        paper_id: paperId
      },
      attributes: ['question_number', 'part_letter'], // Only metadata, no binary data
      order: [
        ['question_number', 'ASC'],
        ['part_letter', 'ASC']
      ]
    });

    // Group images by question number with streaming URLs
    const groupedImages = {};
    images.forEach(img => {
      if (!groupedImages[img.question_number]) {
        groupedImages[img.question_number] = {
          main: null,
          parts: {}
        };
      }

      const imageUrl = `/api/question-images/stream/${paperId}/${img.question_number}${img.part_letter ? `?partLetter=${img.part_letter}` : ''}`;

      if (img.part_letter) {
        groupedImages[img.question_number].parts[img.part_letter] = imageUrl;
      } else {
        groupedImages[img.question_number].main = imageUrl;
      }
    });

    res.json({
      success: true,
      paperId: paperId,
      images: groupedImages
    });
  } catch (error) {
    console.error('Get images error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Bulk delete images
export const bulkDeleteQuestionImages = async (req, res) => {
  try {
    const { paperId } = req.params;
    const { questionIds } = req.body;

    if (!questionIds || !Array.isArray(questionIds)) {
      return res.status(400).json({
        success: false,
        message: 'Question IDs array is required'
      });
    }

    const deleteResults = [];
    const errors = [];

    for (const questionId of questionIds) {
      try {
        const { questionNumber, partLetter } = questionId;

        const imageRecord = await QuestionImages.findOne({
          where: {
            paper_id: paperId,
            question_number: questionNumber,
            part_letter: partLetter || null
          }
        });

        if (imageRecord) {
          await imageRecord.destroy();
          deleteResults.push({
            questionNumber: partLetter ? `${questionNumber}${partLetter}` : questionNumber,
            success: true
          });
        } else {
          deleteResults.push({
            questionNumber: partLetter ? `${questionNumber}${partLetter}` : questionNumber,
            success: false,
            error: 'Image not found'
          });
        }
      } catch (deleteError) {
        errors.push(`Failed to delete image for question ${questionId.questionNumber}: ${deleteError.message}`);
      }
    }

    const successCount = deleteResults.filter(r => r.success).length;

    res.json({
      success: true,
      message: `Bulk delete completed: ${successCount} successful, ${errors.length} failed`,
      results: deleteResults,
      errors: errors
    });

  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};















// import { QuestionImages, ExamPapers, Questions } from '../models/index.js';
// import multer from 'multer';
// import path from 'path';
// import fs from 'fs';
// import { fileURLToPath } from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);


// // Use memoryStorage to access body and file in controller
// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: { fileSize: 5 * 1024 * 1024 },
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = /jpeg|jpg|png|gif|webp/;
//     const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
//     const mimetype = allowedTypes.test(file.mimetype);
//     if (mimetype && extname) {
//       return cb(null, true);
//     }
//     cb(new Error('Only image files are allowed!'));
//   },
// }).single('questionImage');

// export const uploadQuestionImage = async (req, res) => {
//   upload(req, res, async (err) => {
//     try {
//       if (err) {
//         return res.status(400).json({ success: false, message: err.message });
//       }

//       const { paperId, questionNumber, partLetter } = req.body;

//       if (!req.file || !paperId || !questionNumber) {
//         return res.status(400).json({ success: false, message: 'Missing required fields or file.' });
//       }

//       // Validate paper and question
//       const paper = await ExamPapers.findByPk(paperId);
//       if (!paper) return res.status(404).json({ success: false, message: 'Paper not found' });

//       const question = await Questions.findOne({
//         where: { paper_id: paperId, q_no: questionNumber },
//       });
//       if (!question) return res.status(404).json({ success: false, message: 'Question not found' });

//       if (partLetter) {
//         if (!question.has_parts || partLetter.charCodeAt(0) - 97 >= question.parts_count) {
//           return res.status(400).json({ success: false, message: 'Invalid part letter' });
//         }
//       }

//       // Generate filename
//       const timestamp = Date.now();
//       const ext = path.extname(req.file.originalname);
//       const filename = partLetter
//         ? `paper-${paperId}-q${questionNumber}${partLetter}-${timestamp}${ext}`
//         : `paper-${paperId}-q${questionNumber}-${timestamp}${ext}`;

//       const uploadDir = path.join(__dirname, '../uploads/question-images');
//       if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

//       const fullPath = path.join(uploadDir, filename);
//       fs.writeFileSync(fullPath, req.file.buffer);

//       const imageUrl = `/uploads/question-images/${filename}`;

//       // Update or create DB record
//       const existingImage = await QuestionImages.findOne({
//         where: {
//           paper_id: paperId,
//           question_number: questionNumber,
//           part_letter: partLetter || null,
//         },
//       });

//       if (existingImage) {
//         const oldPath = path.join(__dirname, '../', existingImage.image_url);
//         if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
//         await existingImage.update({ image_url: imageUrl, updated_at: new Date() });
//       } else {
//         await QuestionImages.create({
//           paper_id: paperId,
//           question_number: questionNumber,
//           part_letter: partLetter || null,
//           image_url: imageUrl,
//         });
//       }

//       res.json({ success: true, message: 'Image uploaded successfully', imageUrl });
//     } catch (error) {
//       console.error('Upload error:', error);
//       res.status(500).json({ success: false, message: 'Internal server error' });
//     }
//   });
// };

// //?-----

// //? V2
// // Configure multer for batch uploads (multiple files)
// const batchUpload = multer({
//   storage: multer.memoryStorage(),
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = /jpeg|jpg|png|gif|webp/;
//     const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
//     const mimetype = allowedTypes.test(file.mimetype);
//     if (mimetype && extname) {
//       return cb(null, true);
//     }
//     cb(new Error('Only image files are allowed!'));
//   },
// }).array('questionImages', 50); // Allow up to 50 files

// // Batch upload multiple question images
// export const batchUploadQuestionImages = async (req, res) => {
//   batchUpload(req, res, async (err) => {
//     try {
//       if (err) {
//         return res.status(400).json({ 
//           success: false, 
//           message: err.message 
//         });
//       }

//       const { paperId, questionData } = req.body;

//       if (!req.files || req.files.length === 0) {
//         return res.status(400).json({ 
//           success: false, 
//           message: 'No files provided' 
//         });
//       }

//       if (!paperId || !questionData) {
//         return res.status(400).json({ 
//           success: false, 
//           message: 'Missing required fields' 
//         });
//       }

//       // Parse question data (sent as JSON string)
//       let parsedQuestionData;
//       try {
//         parsedQuestionData = JSON.parse(questionData);
//       } catch (parseError) {
//         return res.status(400).json({ 
//           success: false, 
//           message: 'Invalid question data format' 
//         });
//       }

//       // Validate paper exists
//       const paper = await ExamPapers.findByPk(paperId);
//       if (!paper) {
//         return res.status(404).json({ 
//           success: false, 
//           message: 'Paper not found' 
//         });
//       }

//       const uploadResults = [];
//       const errors = [];

//       // Process each file
//       for (let i = 0; i < req.files.length; i++) {
//         const file = req.files[i];
//         const questionInfo = parsedQuestionData[i];

//         if (!questionInfo) {
//           errors.push(`No question data for file ${i + 1}`);
//           continue;
//         }

//         try {
//           const { questionId, questionNumber, parentQuestion, partLetter, type } = questionInfo;

//           // Determine actual question number for validation
//           const actualQuestionNumber = type === 'part' ? parentQuestion : questionNumber;

//           // Validate question exists
//           const question = await Questions.findOne({
//             where: { 
//               paper_id: paperId, 
//               q_no: actualQuestionNumber 
//             },
//           });

//           if (!question) {
//             errors.push(`Question ${actualQuestionNumber} not found`);
//             continue;
//           }

//           // Validate part letter if it's a part question
//           if (partLetter) {
//             if (!question.has_parts || partLetter.charCodeAt(0) - 97 >= question.parts_count) {
//               errors.push(`Invalid part letter ${partLetter} for question ${actualQuestionNumber}`);
//               continue;
//             }
//           }

//           // Generate filename
//           const timestamp = Date.now();
//           const fileIndex = Math.random().toString(36).substring(7); // Add random string for uniqueness
//           const ext = path.extname(file.originalname);
//           const filename = partLetter
//             ? `paper-${paperId}-q${actualQuestionNumber}${partLetter}-${timestamp}-${fileIndex}${ext}`
//             : `paper-${paperId}-q${actualQuestionNumber}-${timestamp}-${fileIndex}${ext}`;

//           const uploadDir = path.join(__dirname, '../uploads/question-images');
//           if (!fs.existsSync(uploadDir)) {
//             fs.mkdirSync(uploadDir, { recursive: true });
//           }

//           const fullPath = path.join(uploadDir, filename);
//           fs.writeFileSync(fullPath, file.buffer);

//           const imageUrl = `/uploads/question-images/${filename}`;

//           // Update or create DB record
//           const existingImage = await QuestionImages.findOne({
//             where: {
//               paper_id: paperId,
//               question_number: actualQuestionNumber,
//               part_letter: partLetter || null,
//             },
//           });

//           if (existingImage) {
//             // Delete old image file
//             const oldPath = path.join(__dirname, '../', existingImage.image_url);
//             if (fs.existsSync(oldPath)) {
//               fs.unlinkSync(oldPath);
//             }
//             await existingImage.update({ 
//               image_url: imageUrl, 
//               updated_at: new Date() 
//             });
//           } else {
//             await QuestionImages.create({
//               paper_id: paperId,
//               question_number: actualQuestionNumber,
//               part_letter: partLetter || null,
//               image_url: imageUrl,
//             });
//           }

//           uploadResults.push({
//             questionId,
//             questionNumber: type === 'part' ? `${actualQuestionNumber}${partLetter}` : actualQuestionNumber,
//             success: true,
//             imageUrl,
//             message: 'Image uploaded successfully'
//           });

//         } catch (uploadError) {
//           console.error(`Upload error for file ${i + 1}:`, uploadError);
//           errors.push(`Failed to upload image for question ${questionInfo.questionNumber}: ${uploadError.message}`);
          
//           uploadResults.push({
//             questionId: questionInfo.questionId,
//             questionNumber: questionInfo.questionNumber,
//             success: false,
//             error: uploadError.message
//           });
//         }
//       }

//       // Return results
//       const successCount = uploadResults.filter(r => r.success).length;
//       const errorCount = errors.length;

//       res.json({
//         success: true,
//         message: `Batch upload completed: ${successCount} successful, ${errorCount} failed`,
//         results: uploadResults,
//         errors: errors,
//         summary: {
//           total: req.files.length,
//           successful: successCount,
//           failed: errorCount
//         }
//       });

//     } catch (error) {
//       console.error('Batch upload error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Internal server error during batch upload'
//       });
//     }
//   });
// };



// // Remove question image
// export const removeQuestionImage = async (req, res) => {
//   try {
//     const { paperId, questionNumber } = req.params;
//     const { partLetter } = req.query;

//     // Find the image record
//     const imageRecord = await QuestionImages.findOne({
//       where: {
//         paper_id: paperId,
//         question_number: questionNumber,
//         part_letter: partLetter || null
//       }
//     });

//     if (!imageRecord) {
//       return res.status(404).json({
//         success: false,
//         message: 'Image not found'
//       });
//     }

//     // Delete the physical file
//     const imagePath = path.join(__dirname, '../', imageRecord.image_url);
//     if (fs.existsSync(imagePath)) {
//       fs.unlinkSync(imagePath);
//     }

//     // Delete the database record
//     await imageRecord.destroy();

//     res.json({
//       success: true,
//       message: 'Image removed successfully'
//     });
//   } catch (error) {
//     console.error('Remove error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal server error'
//     });
//   }
// };

// // Get question images for a paper
// export const getQuestionImages = async (req, res) => {
//   try {
//     const { paperId } = req.params;

//     const images = await QuestionImages.findAll({
//       where: {
//         paper_id: paperId
//       },
//       order: [
//         ['question_number', 'ASC'],
//         ['part_letter', 'ASC']
//       ]
//     });

//     // Group images by question number
//     const groupedImages = {};
//     images.forEach(img => {
//       if (!groupedImages[img.question_number]) {
//         groupedImages[img.question_number] = {
//           main: null,
//           parts: {}
//         };
//       }

//       if (img.part_letter) {
//         groupedImages[img.question_number].parts[img.part_letter] = img.image_url;
//       } else {
//         groupedImages[img.question_number].main = img.image_url;
//       }
//     });

//     res.json({
//       success: true,
//       images: groupedImages
//     });
//   } catch (error) {
//     console.error('Get images error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal server error'
//     });
//   }
// };



// // Get question images for a paper (for both admin and user)
// export const getQuestionImagesForPaper = async (req, res) => {
//   try {
//     const { paperId } = req.params;

//     // Verify paper exists
//     const paper = await ExamPapers.findByPk(paperId);
//     if (!paper) {
//       return res.status(404).json({
//         success: false,
//         message: 'Paper not found'
//       });
//     }

//     // Get all images for this paper
//     const images = await QuestionImages.findAll({
//       where: {
//         paper_id: paperId
//       },
//       attributes: ['question_number', 'part_letter', 'image_url'],
//       order: [
//         ['question_number', 'ASC'],
//         ['part_letter', 'ASC']
//       ]
//     });

//     // Group images by question number
//     const groupedImages = {};
//     images.forEach(img => {
//       if (!groupedImages[img.question_number]) {
//         groupedImages[img.question_number] = {
//           main: null,
//           parts: {}
//         };
//       }

//       if (img.part_letter) {
//         groupedImages[img.question_number].parts[img.part_letter] = img.image_url;
//       } else {
//         groupedImages[img.question_number].main = img.image_url;
//       }
//     });

//     res.json({
//       success: true,
//       paperId: paperId,
//       images: groupedImages
//     });
//   } catch (error) {
//     console.error('Get images error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal server error'
//     });
//   }
// };



// export const bulkDeleteQuestionImages = async (req, res) => {
//   try {
//     const { paperId } = req.params;
//     const { questionIds } = req.body; // Array of question identifiers

//     if (!questionIds || !Array.isArray(questionIds)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Question IDs array is required'
//       });
//     }

//     const deleteResults = [];
//     const errors = [];

//     for (const questionId of questionIds) {
//       try {
//         const { questionNumber, partLetter } = questionId;

//         const imageRecord = await QuestionImages.findOne({
//           where: {
//             paper_id: paperId,
//             question_number: questionNumber,
//             part_letter: partLetter || null
//           }
//         });

//         if (imageRecord) {
//           // Delete physical file
//           const imagePath = path.join(__dirname, '../', imageRecord.image_url);
//           if (fs.existsSync(imagePath)) {
//             fs.unlinkSync(imagePath);
//           }

//           // Delete database record
//           await imageRecord.destroy();

//           deleteResults.push({
//             questionNumber: partLetter ? `${questionNumber}${partLetter}` : questionNumber,
//             success: true
//           });
//         } else {
//           deleteResults.push({
//             questionNumber: partLetter ? `${questionNumber}${partLetter}` : questionNumber,
//             success: false,
//             error: 'Image not found'
//           });
//         }
//       } catch (deleteError) {
//         errors.push(`Failed to delete image for question ${questionId.questionNumber}: ${deleteError.message}`);
//       }
//     }

//     const successCount = deleteResults.filter(r => r.success).length;

//     res.json({
//       success: true,
//       message: `Bulk delete completed: ${successCount} successful, ${errors.length} failed`,
//       results: deleteResults,
//       errors: errors
//     });

//   } catch (error) {
//     console.error('Bulk delete error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal server error'
//     });
//   }
// };