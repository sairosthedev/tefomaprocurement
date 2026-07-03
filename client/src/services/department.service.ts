import http from './http';

export const departmentAPI: any = {
  createRequisition: (data: any) => http.post('/department/requisitions', data),
  getRequisitions: (params?: any) => http.get('/department/requisitions', { params }),
  submitRequisition: (id: any) => http.put(`/department/requisitions/${id}/submit`),
  approveRequisition: (id: any, data: any) => http.put(`/department/requisitions/${id}/approve`, data),
  createStoreRequisition: (data: any) => http.post('/department/store-requisitions', data),
  getStoreRequisitions: (params?: any) => http.get('/department/store-requisitions', { params }),
  getPendingPoApprovals: () => http.get('/department/pending-po-approvals'),
  approvePO: (id: any, data?: any) => http.put(`/department/purchase-orders/${id}/approve`, data),
  rejectPO: (id: any, data: any) => http.put(`/department/purchase-orders/${id}/reject`, data),
  getPendingEvaluations: () => http.get('/department/evaluations/pending'),
  hodReviewEvaluation: (id: any, data: any) => http.put(`/department/evaluations/${id}/review`, data),
  hodSelectQuotation: (rfqId: any, data: any) => http.put(`/department/rfqs/${rfqId}/select-quotation`, data),
  cancelRequisition: (id: any, data: any) => http.put(`/department/requisitions/${id}/cancel`, data)
};
