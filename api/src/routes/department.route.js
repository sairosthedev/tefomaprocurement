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

// Store Requisitions
router.post('/store-requisitions', department.createStoreRequisition);
router.get('/store-requisitions', department.getStoreRequisitions);

module.exports = router;

