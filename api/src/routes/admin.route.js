const express = require('express');
const router = express.Router();
const { admin } = require('../controllers');
const { protect, authorize } = require('../middleware');

// All routes require admin role
router.use(protect);
router.use(authorize('admin'));

// User management
router.post('/users', admin.createUser);
router.get('/users', admin.getUsers);
router.put('/users/:id', admin.updateUser);
router.delete('/users/:id', admin.deleteUser);

// Department management
router.post('/departments', admin.createDepartment);
router.get('/departments', admin.getDepartments);
router.put('/departments/:id', admin.updateDepartment);
router.delete('/departments/:id', admin.deleteDepartment);

// Site management
router.post('/sites', admin.createSite);
router.get('/sites', admin.getSites);
router.put('/sites/:id', admin.updateSite);
router.delete('/sites/:id', admin.deleteSite);

module.exports = router;

