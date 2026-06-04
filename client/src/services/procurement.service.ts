import http from './http';

export const procurementAPI: any = {
  getSuppliers: (params?: any) => http.get('/procurement/suppliers', { params }),
  getSupplier: (id: any) => http.get(`/procurement/suppliers/${id}`),
  createSupplier: (data: any) => http.post('/procurement/suppliers', data),
  bulkImportSuppliers: (data: any) => http.post('/procurement/suppliers/bulk-import', data),
  approveSupplier: (id: any) => http.put(`/procurement/suppliers/${id}/approve`),
  blacklistSupplier: (id: any, data: any) => http.put(`/procurement/suppliers/${id}/blacklist`, data),
  getRFQs: (params?: any) => http.get('/procurement/rfqs', { params }),
  getRFQ: (id: any) => http.get(`/procurement/rfqs/${id}`),
  createRFQ: (data: any) => http.post('/procurement/rfqs', data),
  publishRFQ: (id: any) => http.put(`/procurement/rfqs/${id}/publish`),
  closeRFQ: (id: any) => http.put(`/procurement/rfqs/${id}/close`),
  getQuotations: (params?: any) => http.get('/procurement/quotations', { params }),
  getQuotation: (id: any) => http.get(`/procurement/quotations/${id}`),
  acceptQuotation: (id: any, data: any) => http.put(`/procurement/quotations/${id}/accept`, data),
  rejectQuotation: (id: any, data: any) => http.put(`/procurement/quotations/${id}/reject`, data),
  getPurchaseOrders: (params?: any) => http.get('/procurement/purchase-orders', { params }),
  getPurchaseOrder: (id: any) => http.get(`/procurement/purchase-orders/${id}`),
  createPurchaseOrder: (data: any) => http.post('/procurement/purchase-orders', data),
  submitPurchaseOrder: (id: any) => http.put(`/procurement/purchase-orders/${id}/submit`)
};
