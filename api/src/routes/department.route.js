const express = require('express');
const router = express.Router();
const { department } = require('../controllers');
const { protect, authorize } = require('../middleware');

// All routes require department_head role
router.use(protect);
router.use(authorize('department_head', 'admin'));

// Requisitions
router.post('/requisitions', department.createRequisition);
router.get('/requisitions', department.getRequisitions);
router.put('/requisitions/:id/submit', department.submitRequisition);
router.put('/requisitions/:id/approve', department.approveRequisition);

module.exports = router;

