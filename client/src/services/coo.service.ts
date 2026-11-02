import http from './http';

export const cooAPI: any = {
  getPendingApprovals: (params?: any) => http.get('/coo/pending-approvals', { params }),
  // The COO's purchase order list is their approval queue.
  getPurchaseOrders: (params?: any) => http.get('/coo/pending-approvals', { params }),
  getPurchaseOrder: (id: any) => http.get(`/coo/purchase-orders/${id}`),
  approvePO: (id: any, data: any) => http.put(`/coo/purchase-orders/${id}/approve`, data),
  cancelPurchaseOrder: (id: any, data: any) => http.put(`/coo/purchase-orders/${id}/cancel`, data)
};
