import { getBagsByPackingId } from '../services/documentService.js';

/**
 * Get all bags for a specific packing ID
 */
export const getBags = async (req, res) => {
  try {
    const { packingId } = req.params;
    
    const bagIds = await getBagsByPackingId(packingId);
    
    res.status(200).json(bagIds);
  } catch (error) {
    console.error("Error fetching bag IDs:", error.message);
    
    const statusCode = error.status || 500;
    res.status(statusCode).json({ 
      error: error.message || "Failed to fetch bag IDs" 
    });
  }
}