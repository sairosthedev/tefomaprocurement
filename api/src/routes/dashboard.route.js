const express = require('express');
const router = express.Router();
const { protect } = require('../middleware');
const { getStats } = require('../controllers/dashboard');

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', protect, getStats);

module.exports = router;

