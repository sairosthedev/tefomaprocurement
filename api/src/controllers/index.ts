import authControllers from './auth/index.js';
import adminControllers from './admin/index.js';
import procurementControllers from './procurement/index.js';
import supplierControllers from './supplier/index.js';
import departmentControllers from './department/index.js';
import financeControllers from './finance/index.js';
import cooControllers from './coo/index.js';
import storesControllers from './stores/index.js';
import notificationsControllers from './notifications/index.js';
import sitesControllers from './sites/index.js';

export default {
  auth: authControllers,
  admin: adminControllers,
  procurement: procurementControllers,
  supplier: supplierControllers,
  department: departmentControllers,
  finance: financeControllers,
  coo: cooControllers,
  stores: storesControllers,
  notifications: notificationsControllers,
  sites: sitesControllers
};
