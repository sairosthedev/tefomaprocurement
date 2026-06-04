import express from 'express';
import controllers from '../controllers/index.js';
import { protect, authorize } from '../middleware/index.js';

const { admin } = controllers;
const router = express.Router();

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

export default router;
