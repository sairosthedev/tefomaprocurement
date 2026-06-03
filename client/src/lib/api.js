// Back-compat shim. The real implementation lives in `src/services/`.
// Existing pages still import `authAPI`, `procurementAPI`, etc. from here.
// New code should import directly from `@/services` instead.

import http from '../services/http';

export {
  http,
  authAPI,
  adminAPI,
  procurementAPI,
  supplierAPI,
  departmentAPI,
  financeAPI,
  cooAPI,
  storesAPI,
  notificationsAPI
} from '../services';

export default http;
