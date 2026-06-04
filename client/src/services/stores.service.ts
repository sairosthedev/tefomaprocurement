import http from './http';

export const storesAPI = {
  receiveGoods: (data: any) => http.post('/stores/deliveries', data),
  getDeliveries: (params?: any) => http.get('/stores/deliveries', { params }),
  getInventory: (params?: any) => http.get('/stores/inventory', { params }),
  getStoreRequisitions: (params?: any) => http.get('/stores/requisitions', { params }),
  approveStoreRequisition: (id: any, data: any) => http.put(`/stores/requisitions/${id}/approve`, data),
  rejectStoreRequisition: (id: any, data: any) => http.put(`/stores/requisitions/${id}/reject`, data),
  issueStock: (id: any, data: any) => http.put(`/stores/requisitions/${id}/issue`, data),
  getTransfers: (params?: any) => http.get('/stores/transfers', { params }),
  createTransfer: (data: any) => http.post('/stores/transfers', data),
  approveTransfer: (id: any) => http.put(`/stores/transfers/${id}/approve`),
  shipTransfer: (id: any, data: any) => http.put(`/stores/transfers/${id}/ship`, data),
  receiveTransfer: (id: any, data: any) => http.put(`/stores/transfers/${id}/receive`, data)
};
