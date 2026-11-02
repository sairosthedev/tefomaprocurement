import express from 'express';
import { getProductName } from '../lib/branding.js';
const router = express.Router();

import authRoutes from './auth.route.js';
import adminRoutes from './admin.route.js';
import procurementRoutes from './procurement.route.js';
import supplierRoutes from './supplier.route.js';
import departmentRoutes from './department.route.js';
import financeRoutes from './finance.route.js';
import cooRoutes from './coo.route.js';
import storesRoutes from './stores.route.js';
import dashboardRoutes from './dashboard.route.js';
import notificationsRoutes from './notifications.route.js';
import sitesRoutes from './sites.route.js';

// API Status
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: `${getProductName()} API is running`,
    version: '1.0.0'
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/procurement', procurementRoutes);
router.use('/supplier', supplierRoutes);
router.use('/department', departmentRoutes);
router.use('/finance', financeRoutes);
router.use('/coo', cooRoutes);
router.use('/stores', storesRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/sites', sitesRoutes);

export default router;
