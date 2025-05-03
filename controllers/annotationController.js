import { 
    getAnnotationsForCopy, 
    saveAnnotationsForCopy 
  } from '../services/annotationService.js';
  
  /**
   * Get annotations for a copy
   */
  export const getAnnotations = async (req, res) => {
    try {
      const { copyId } = req.params;
      
      const result = await getAnnotationsForCopy(copyId);
      
      res.status(200).json(result);
    } catch (error) {
      console.error("Error fetching annotations:", error);
      res.status(500).json({ error: "Failed to fetch annotations" });
    }
  }
  
  /**
   * Save annotations for a copy
   */
  export const saveAnnotations = async (req, res) => {
    try {
      const { copyId, annotations, drawAnnotations } = req.body;
      console.log("Received request to save annotations->:", req.body);
      
      const result = await saveAnnotationsForCopy(copyId, annotations, drawAnnotations);
      
      // Return appropriate status code (201 for new records, 200 for updates)
      const statusCode = result.isNew ? 201 : 200;
      
      return res.status(statusCode).json({
        success: result.success,
        message: result.message
      });
    } catch (error) {
      console.error("Error saving annotations:", error);
      
      // Return appropriate error status code if available
      const statusCode = error.status || 500;
      
      res.status(statusCode).json({ 
        error: error.message || "Failed to save annotations" 
      });
    }
  }