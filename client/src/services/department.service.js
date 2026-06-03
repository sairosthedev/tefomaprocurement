import http from './http';

export const departmentAPI = {
  createRequisition: (data) => http.post('/department/requisitions', data),
  getRequisitions: (params) => http.get('/department/requisitions', { params }),
  submitRequisition: (id) => http.put(`/department/requisitions/${id}/submit`),
  approveRequisition: (id, data) => http.put(`/department/requisitions/${id}/approve`, data),
  createStoreRequisition: (data) => http.post('/department/store-requisitions', data),
  getStoreRequisitions: (params) => http.get('/department/store-requisitions', { params })
};
