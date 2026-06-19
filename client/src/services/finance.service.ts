import http from './http';

export const financeAPI: any = {
  getPendingApprovals: (params?: any) => http.get('/finance/pending-approvals', { params }),
  getPurchaseOrders: (params?: any) => http.get('/finance/purchase-orders', { params }),
  getPurchaseOrder: (id: any) => http.get(`/finance/purchase-orders/${id}`),
  approvePO: (id: any, data: any) => http.put(`/finance/purchase-orders/${id}/approve`, data),
  rejectPO: (id: any, data: any) => http.put(`/finance/purchase-orders/${id}/reject`, data),
  getInvoices: (params?: any) => http.get('/finance/invoices', { params }),
  getInvoice: (id: any) => http.get(`/finance/invoices/${id}`),
  approveInvoice: (id: any, data?: any) => http.put(`/finance/invoices/${id}/approve`, data),
  rejectInvoice: (id: any, data: any) => http.put(`/finance/invoices/${id}/reject`, data),
  getPayments: (params?: any) => http.get('/finance/payments', { params }),
  createPayment: (data: any) => http.post('/finance/payments', data),
  getBudgets: (params?: any) => http.get('/finance/budgets', { params }),
  upsertDepartmentBudget: (data: any) => http.put('/finance/budgets', data)
};
