import { Bagging } from '../models/index.js';

/**
 * Get all bag IDs for a specific packing ID
 * @param {string} packingId - The packing ID to get bags for
 * @returns {Promise<string[]>} Promise resolving to list of bag IDs
 */
export const getBagsByPackingId = async (packingId) => {
  if (!packingId) {
    const error = new Error("Packing ID is required");
    error.status = 400;
    throw error;
  }

  const baggingRecords = await Bagging.findAll({
    where: { PackingID: packingId },
    attributes: ["BagID"],
    raw: true,
  });

  if (!baggingRecords || baggingRecords.length === 0) {
    const error = new Error("No bags found for the given packing ID");
    error.status = 404;
    throw error;
  }

  return baggingRecords.map((record) => record.BagID);
};