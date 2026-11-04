import http from './http';

export const supplierAPI: any = {
  getProfile: () => http.get('/supplier/profile'),
  updateProfile: (data: any) => http.put('/supplier/profile', data),
  uploadKysDocument: (data: any) => http.post('/supplier/kys/documents', data),
  deleteKysDocument: (docId: any) => http.delete(`/supplier/kys/documents/${docId}`),
  getKysDocumentFile: (docId: any) => http.get(`/supplier/kys/documents/${docId}/file`, { responseType: 'blob' }),
  getMyRFQs: (params?: any) => http.get('/supplier/rfqs', { params }),
  submitQuotation: (data: any) => http.post('/supplier/quotations', data),
  getMyQuotations: (params?: any) => http.get('/supplier/quotations', { params }),
  getMyPurchaseOrders: (params?: any) => http.get('/supplier/purchase-orders', { params }),
  // The order document as a PDF, the same one procurement emails.
  printPurchaseOrder: (id: any) => http.get(`/supplier/purchase-orders/${id}/print`, { responseType: 'blob' }),
  getMyDeliveries: (params?: any) => http.get('/supplier/deliveries', { params }),
  getMyInvoices: (params?: any) => http.get('/supplier/invoices', { params }),
  submitInvoice: (data: any) => http.post('/supplier/invoices', data)
};
