import http from './http';

export const financeAPI = {
  getPendingApprovals: (params) => http.get('/finance/pending-approvals', { params }),
  getPurchaseOrders: (params) => http.get('/finance/purchase-orders', { params }),
  getPurchaseOrder: (id) => http.get(`/finance/purchase-orders/${id}`),
  approvePO: (id, data) => http.put(`/finance/purchase-orders/${id}/approve`, data),
  rejectPO: (id, data) => http.put(`/finance/purchase-orders/${id}/reject`, data)
};
