import http from './http';

export const cooAPI = {
  getPendingApprovals: (params) => http.get('/coo/pending-approvals', { params }),
  getPurchaseOrder: (id) => http.get(`/coo/purchase-orders/${id}`),
  approvePO: (id, data) => http.put(`/coo/purchase-orders/${id}/approve`, data)
};
