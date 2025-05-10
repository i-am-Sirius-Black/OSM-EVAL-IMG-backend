import sharp from 'sharp';
import path from 'path';
import os from 'os';
import PDFDocument from 'pdfkit';
import fs from 'fs-extra';
import { 
  getCopyPageImage, 
  generatePdfWithAnnotations,
  searchCopiesByBagId,
  getAnnotatedCopies,
  getAllCopiesByPackingId
} from '../services/copyService.js';
import { fileURLToPath } from 'url';


// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


/**
 * Get/Stream image for a specific copy page
 */
export const copyImage = async (req, res) => {
  const { copyId, page } = req.query;

  if (!copyId || !page) {
    console.log("Missing copyId or page");
    return res.status(400).json({ error: "copyId and page are required" });
  }

  try {
    const imageBuffer = await getCopyPageImage(copyId, page);

    if (!imageBuffer) {
      console.log(`No image found for copyId: ${copyId}, page: ${page}`);
      return res.status(404).json({ error: "Image not found" });
    }

    const optimizedImage = await sharp(imageBuffer)
      .resize({ width: 800 })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Set response headers for image
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Length", optimizedImage.length);

    // Send binary image data
    res.send(optimizedImage);
  } catch (error) {
    console.error("Error streaming image:", error.message);
    res.status(500).json({
      error: "Error streaming image",
      message: error.message,
    });
  }
}

/**
 * Generate and download PDF with annotations
 */
export const copyPdfDownload = async (req, res) => {
  const tempDir = path.join(os.tmpdir(), `pdf-${Date.now()}`);
  
  try {
    const { copyId } = req.params;

    if (!copyId) {
      return res.status(400).json({ error: "Copy ID is required" });
    }

    console.log(`Generating PDF for copyId: ${copyId}`);

    // Create temp directory for processing images
    await fs.ensureDir(tempDir);

    // Set up PDF document and pipe to response
    const doc = new PDFDocument({ autoFirstPage: false });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${copyId}.pdf`);
    doc.pipe(res);

    // Generate PDF with annotations
    await generatePdfWithAnnotations(doc, copyId, tempDir, __dirname);

    // Finalize the PDF
    doc.end();
    
    // Clean up temp directory
    fs.remove(tempDir).catch(err => {
      console.warn(`Warning: Could not remove temp directory ${tempDir}: ${err.message}`);
    });
    
  } catch (error) {
    console.error("Error generating PDF:", error);
    
    // Clean up temp directory on error
    fs.remove(tempDir).catch(() => {});
    
    // Only send error if headers haven't been sent
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate PDF", details: error.message });
    }
  }
}


/**
 * Search and filter copies
 */
export const copySearch = async (req, res) => {
  try {
    const { bagId, searchTerm, sortOrder } = req.query;

    if (!bagId) {
      return res.status(400).json({ error: "Bag ID is required" });
    }

    const copyList = await searchCopiesByBagId(bagId, searchTerm, sortOrder);

    res.status(200).json(copyList);
  } catch (error) {
    console.error("Error searching copies:", error.message);
    res.status(500).json({ error: "Failed to search copies" });
  }
}

/**
 * Get annotated copies
 */
export const copyAnnotated = async (req, res) => {
  try {
    const annotatedCopies = await getAnnotatedCopies();

    if (!annotatedCopies || annotatedCopies.length === 0) {
      return res.status(404).json({ 
        message: "No annotated copies found",
        copies: [] 
      });
    }

    res.status(200).json({
      count: annotatedCopies.length,
      copies: annotatedCopies
    });
  } catch (error) {
    console.error("Error fetching annotated copies:", error.message);
    res.status(500).json({ error: "Failed to fetch annotated copies" });
  }
}






//get all copies of a Packing
export const getAllCopiesByPacking = async (req, res) => {
  try {
    const { packingId } = req.query;
    console.log("Received request for /api/copies/by-packing/:id with packingId:", packingId);
  
    const copyList = await getAllCopiesByPackingId(packingId);

    // Return the list of copies
    res.status(200).json(copyList);
  } catch (error) {
    console.error("Error fetching copies by packing ID:", error.message);
    
    // Use the error status from the service if available
    const statusCode = error.status || 500;
    res.status(statusCode).json({ 
      error: error.message || "Failed to fetch copies by packing ID" 
    });
  }
}




