import express from 'express';
import { protect } from '../middleware/index.js';
import dashboardControllers from '../controllers/dashboard/index.js';

const { getStats, getActionCounts } = dashboardControllers;
const router = express.Router();

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', protect, getStats);

// GET /api/dashboard/action-counts - sidebar badge counts for the current user
router.get('/action-counts', protect, getActionCounts);

export default router;
