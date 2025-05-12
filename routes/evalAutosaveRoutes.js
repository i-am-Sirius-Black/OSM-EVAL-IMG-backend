import express from 'express';
import { deleteProgress, getProgress, saveProgress } from '../controllers/evalAutosaveController.js';

const router = express.Router();

// Autosave endpoints
router.post('/save', saveProgress);
router.get('/getSaved', getProgress);
router.delete('/deleteSaved', deleteProgress);

export default router;