import http from './http';

export const procurementAPI = {
  getSuppliers: (params) => http.get('/procurement/suppliers', { params }),
  getSupplier: (id) => http.get(`/procurement/suppliers/${id}`),
  createSupplier: (data) => http.post('/procurement/suppliers', data),
  bulkImportSuppliers: (data) => http.post('/procurement/suppliers/bulk-import', data),
  approveSupplier: (id) => http.put(`/procurement/suppliers/${id}/approve`),
  blacklistSupplier: (id, data) => http.put(`/procurement/suppliers/${id}/blacklist`, data),
  getRFQs: (params) => http.get('/procurement/rfqs', { params }),
  getRFQ: (id) => http.get(`/procurement/rfqs/${id}`),
  createRFQ: (data) => http.post('/procurement/rfqs', data),
  publishRFQ: (id) => http.put(`/procurement/rfqs/${id}/publish`),
  closeRFQ: (id) => http.put(`/procurement/rfqs/${id}/close`),
  getQuotations: (params) => http.get('/procurement/quotations', { params }),
  getQuotation: (id) => http.get(`/procurement/quotations/${id}`),
  acceptQuotation: (id, data) => http.put(`/procurement/quotations/${id}/accept`, data),
  rejectQuotation: (id, data) => http.put(`/procurement/quotations/${id}/reject`, data),
  getPurchaseOrders: (params) => http.get('/procurement/purchase-orders', { params }),
  getPurchaseOrder: (id) => http.get(`/procurement/purchase-orders/${id}`),
  createPurchaseOrder: (data) => http.post('/procurement/purchase-orders', data),
  submitPurchaseOrder: (id) => http.put(`/procurement/purchase-orders/${id}/submit`)
};
