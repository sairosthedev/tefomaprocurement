import http from './http';

export const supplierAPI = {
  getProfile: () => http.get('/supplier/profile'),
  updateProfile: (data) => http.put('/supplier/profile', data),
  getMyRFQs: (params) => http.get('/supplier/rfqs', { params }),
  submitQuotation: (data) => http.post('/supplier/quotations', data),
  getMyQuotations: (params) => http.get('/supplier/quotations', { params }),
  getMyPurchaseOrders: (params) => http.get('/supplier/purchase-orders', { params }),
  getMyDeliveries: (params) => http.get('/supplier/deliveries', { params })
};
