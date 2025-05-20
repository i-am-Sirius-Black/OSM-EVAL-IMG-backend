import cron from 'node-cron';
import { resetExpiredBatchesService } from '../services/evaluatorService.js';

/**
 * Schedule job to reset expired batches
 * Runs every hour to check for and reset expired batches
 */
const scheduleResetExpiredBatches = () => {
  // Run job every hour
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('Running scheduled job: Resetting expired copy batches');
      const result = await resetExpiredBatchesService();
      console.log('Job completed:', result);
    } catch (error) {
      console.error('Error in reset expired batches job:', error);
    }
  });
  
  console.log('Scheduled job: Reset expired batches (runs hourly)');
};

export default scheduleResetExpiredBatches;