import express from 'express';
import { protect } from '../middleware/index.js';
import dashboardControllers from '../controllers/dashboard/index.js';

const { getStats } = dashboardControllers;
const router = express.Router();

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', protect, getStats);

export default router;
