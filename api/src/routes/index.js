const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.route');
const adminRoutes = require('./admin.route');
const procurementRoutes = require('./procurement.route');
const supplierRoutes = require('./supplier.route');
const departmentRoutes = require('./department.route');
const financeRoutes = require('./finance.route');
const cooRoutes = require('./coo.route');
const storesRoutes = require('./stores.route');
const dashboardRoutes = require('./dashboard.route');
const notificationsRoutes = require('./notifications.route');
const sitesRoutes = require('./sites.route');

// API Status
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'FosssilProcure API is running',
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

module.exports = router;
