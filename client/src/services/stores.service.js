import http from './http';

export const storesAPI = {
  receiveGoods: (data) => http.post('/stores/deliveries', data),
  getDeliveries: (params) => http.get('/stores/deliveries', { params }),
  getInventory: (params) => http.get('/stores/inventory', { params }),
  getStoreRequisitions: (params) => http.get('/stores/requisitions', { params }),
  approveStoreRequisition: (id, data) => http.put(`/stores/requisitions/${id}/approve`, data),
  rejectStoreRequisition: (id, data) => http.put(`/stores/requisitions/${id}/reject`, data),
  issueStock: (id, data) => http.put(`/stores/requisitions/${id}/issue`, data),
  getTransfers: (params) => http.get('/stores/transfers', { params }),
  createTransfer: (data) => http.post('/stores/transfers', data),
  approveTransfer: (id) => http.put(`/stores/transfers/${id}/approve`),
  shipTransfer: (id, data) => http.put(`/stores/transfers/${id}/ship`, data),
  receiveTransfer: (id, data) => http.put(`/stores/transfers/${id}/receive`, data)
};
