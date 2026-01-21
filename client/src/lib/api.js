import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect on 401 if NOT on login/register endpoints
    const isAuthEndpoint = error.config?.url?.includes('/auth/login') || 
                           error.config?.url?.includes('/auth/register');
    
    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me')
};

// Admin API
export const adminAPI = {
  getUsers: (params) => api.get('/admin/users', { params }),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getDepartments: () => api.get('/admin/departments'),
  createDepartment: (data) => api.post('/admin/departments', data)
};

// Procurement API
export const procurementAPI = {
  getSuppliers: (params) => api.get('/procurement/suppliers', { params }),
  getSupplier: (id) => api.get(`/procurement/suppliers/${id}`),
  createSupplier: (data) => api.post('/procurement/suppliers', data),
  bulkImportSuppliers: (data) => api.post('/procurement/suppliers/bulk-import', data),
  approveSupplier: (id) => api.put(`/procurement/suppliers/${id}/approve`),
  blacklistSupplier: (id, data) => api.put(`/procurement/suppliers/${id}/blacklist`, data),
  getRFQs: (params) => api.get('/procurement/rfqs', { params }),
  getRFQ: (id) => api.get(`/procurement/rfqs/${id}`),
  createRFQ: (data) => api.post('/procurement/rfqs', data),
  publishRFQ: (id) => api.put(`/procurement/rfqs/${id}/publish`),
  getQuotations: (params) => api.get('/procurement/quotations', { params }),
  getQuotation: (id) => api.get(`/procurement/quotations/${id}`),
  acceptQuotation: (id, data) => api.put(`/procurement/quotations/${id}/accept`, data),
  rejectQuotation: (id, data) => api.put(`/procurement/quotations/${id}/reject`, data),
  getPurchaseOrders: (params) => api.get('/procurement/purchase-orders', { params }),
  getPurchaseOrder: (id) => api.get(`/procurement/purchase-orders/${id}`),
  createPurchaseOrder: (data) => api.post('/procurement/purchase-orders', data),
  submitPurchaseOrder: (id) => api.put(`/procurement/purchase-orders/${id}/submit`)
};

// Supplier API
export const supplierAPI = {
  getProfile: () => api.get('/supplier/profile'),
  updateProfile: (data) => api.put('/supplier/profile', data),
  getMyRFQs: (params) => api.get('/supplier/rfqs', { params }),
  submitQuotation: (data) => api.post('/supplier/quotations', data),
  getMyQuotations: (params) => api.get('/supplier/quotations', { params }),
  getMyPurchaseOrders: (params) => api.get('/supplier/purchase-orders', { params }),
  getMyDeliveries: (params) => api.get('/supplier/deliveries', { params })
};

// Department API
export const departmentAPI = {
  createRequisition: (data) => api.post('/department/requisitions', data),
  getRequisitions: (params) => api.get('/department/requisitions', { params }),
  submitRequisition: (id) => api.put(`/department/requisitions/${id}/submit`),
  approveRequisition: (id, data) => api.put(`/department/requisitions/${id}/approve`, data),
  createStoreRequisition: (data) => api.post('/department/store-requisitions', data),
  getStoreRequisitions: (params) => api.get('/department/store-requisitions', { params })
};

// Finance API
export const financeAPI = {
  getPendingApprovals: (params) => api.get('/finance/pending-approvals', { params }),
  getPurchaseOrders: (params) => api.get('/finance/purchase-orders', { params }),
  getPurchaseOrder: (id) => api.get(`/finance/purchase-orders/${id}`),
  approvePO: (id, data) => api.put(`/finance/purchase-orders/${id}/approve`, data),
  rejectPO: (id, data) => api.put(`/finance/purchase-orders/${id}/reject`, data)
};

// COO API
export const cooAPI = {
  getPendingApprovals: (params) => api.get('/coo/pending-approvals', { params }),
  getPurchaseOrder: (id) => api.get(`/coo/purchase-orders/${id}`),
  approvePO: (id, data) => api.put(`/coo/purchase-orders/${id}/approve`, data)
};

// Stores API
export const storesAPI = {
  receiveGoods: (data) => api.post('/stores/deliveries', data),
  getDeliveries: (params) => api.get('/stores/deliveries', { params }),
  getInventory: (params) => api.get('/stores/inventory', { params }),
  getStoreRequisitions: (params) => api.get('/stores/requisitions', { params }),
  approveStoreRequisition: (id, data) => api.put(`/stores/requisitions/${id}/approve`, data),
  rejectStoreRequisition: (id, data) => api.put(`/stores/requisitions/${id}/reject`, data),
  issueStock: (id, data) => api.put(`/stores/requisitions/${id}/issue`, data)
};

// Notifications API
export const notificationsAPI = {
  getNotifications: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all')
};

export default api;

