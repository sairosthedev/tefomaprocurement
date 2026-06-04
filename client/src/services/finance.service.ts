import http from './http';

export const financeAPI = {
  getPendingApprovals: (params?: any) => http.get('/finance/pending-approvals', { params }),
  getPurchaseOrders: (params?: any) => http.get('/finance/purchase-orders', { params }),
  getPurchaseOrder: (id: any) => http.get(`/finance/purchase-orders/${id}`),
  approvePO: (id: any, data: any) => http.put(`/finance/purchase-orders/${id}/approve`, data),
  rejectPO: (id: any, data: any) => http.put(`/finance/purchase-orders/${id}/reject`, data)
};
