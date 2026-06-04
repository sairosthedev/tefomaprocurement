import http from './http';

export const departmentAPI: any = {
  createRequisition: (data: any) => http.post('/department/requisitions', data),
  getRequisitions: (params?: any) => http.get('/department/requisitions', { params }),
  submitRequisition: (id: any) => http.put(`/department/requisitions/${id}/submit`),
  approveRequisition: (id: any, data: any) => http.put(`/department/requisitions/${id}/approve`, data),
  createStoreRequisition: (data: any) => http.post('/department/store-requisitions', data),
  getStoreRequisitions: (params?: any) => http.get('/department/store-requisitions', { params })
};
