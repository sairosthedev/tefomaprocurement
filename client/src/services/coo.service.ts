import http from './http';

export const cooAPI: any = {
  getPendingApprovals: (params?: any) => http.get('/coo/pending-approvals', { params }),
  getPurchaseOrder: (id: any) => http.get(`/coo/purchase-orders/${id}`),
  approvePO: (id: any, data: any) => http.put(`/coo/purchase-orders/${id}/approve`, data)
};
