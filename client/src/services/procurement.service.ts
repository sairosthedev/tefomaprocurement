import http from './http';

export const procurementAPI: any = {
  getSuppliers: (params?: any) => http.get('/procurement/suppliers', { params }),
  getSupplier: (id: any) => http.get(`/procurement/suppliers/${id}`),
  updateSupplier: (id: any, data: any) => http.put(`/procurement/suppliers/${id}`, data),
  createSupplier: (data: any) => http.post('/procurement/suppliers', data),
  bulkImportSuppliers: (data: any) => http.post('/procurement/suppliers/bulk-import', data),
  // Category-matched suppliers for RFQ invitation: exact matches plus related
  // (same-section) suggestions, matched across all suppliers server-side.
  matchSuppliers: (params: any) => http.get('/procurement/suppliers/match', { params }),
  // Document verification — a human confirming they opened the file.
  verifySupplierDocument: (id: any, docId: any, data: any) =>
    http.put(`/procurement/suppliers/${id}/documents/${docId}/verify`, data),
  // Blacklisting is reversible; reinstatement returns the supplier to pending.
  reinstateSupplier: (id: any, data: any) => http.put(`/procurement/suppliers/${id}/reinstate`, data),
  // Diligence tier drives how much KYS is required.
  getSupplierTierSuggestion: (id: any) => http.get(`/procurement/suppliers/${id}/tier-suggestion`),
  setSupplierTier: (id: any, data: any) => http.put(`/procurement/suppliers/${id}/tier`, data),
  // Supplier banking changes: held, callback-verified, then approved by a second person.
  getBankChangeRequests: (params?: any) => http.get('/procurement/bank-changes', { params }),
  verifyBankChangeCallback: (id: any, data: any) =>
    http.put(`/procurement/bank-changes/${id}/verify-callback`, data),
  approveBankChange: (id: any) => http.put(`/procurement/bank-changes/${id}/approve`),
  rejectBankChange: (id: any, data: any) => http.put(`/procurement/bank-changes/${id}/reject`, data),
  approveSupplier: (id: any, data?: any) => http.put(`/procurement/suppliers/${id}/approve`, data),
  blacklistSupplier: (id: any, data: any) => http.put(`/procurement/suppliers/${id}/blacklist`, data),
  setSupplierStatus: (id: any, data: any) => http.put(`/procurement/suppliers/${id}/status`, data),
  getRFQs: (params?: any) => http.get('/procurement/rfqs', { params }),
  getRFQ: (id: any) => http.get(`/procurement/rfqs/${id}`),
  createRFQ: (data: any) => http.post('/procurement/rfqs', data),
  publishRFQ: (id: any) => http.put(`/procurement/rfqs/${id}/publish`),
  closeRFQ: (id: any) => http.put(`/procurement/rfqs/${id}/close`),
  getQuotations: (params?: any) => http.get('/procurement/quotations', { params }),
  getQuotation: (id: any) => http.get(`/procurement/quotations/${id}`),
  acceptQuotation: (id: any, data: any) => http.put(`/procurement/quotations/${id}/accept`, data),
  rejectQuotation: (id: any, data: any) => http.put(`/procurement/quotations/${id}/reject`, data),
  requestQuotationRevision: (id: any, data: any) => http.put(`/procurement/quotations/${id}/request-revision`, data),
  getPurchaseOrders: (params?: any) => http.get('/procurement/purchase-orders', { params }),
  getPurchaseOrder: (id: any) => http.get(`/procurement/purchase-orders/${id}`),
  createPurchaseOrder: (data: any) => http.post('/procurement/purchase-orders', data),
  submitPurchaseOrder: (id: any) => http.put(`/procurement/purchase-orders/${id}/submit`),
  updateKys: (id: any, data: any) => http.put(`/procurement/suppliers/${id}/kys`, data),
  verifyKys: (id: any, data?: any) => http.put(`/procurement/suppliers/${id}/kys/verify`, data),
  uploadSupplierDocument: (id: any, data: any) => http.post(`/procurement/suppliers/${id}/documents`, data),
  deleteSupplierDocument: (id: any, docId: any) => http.delete(`/procurement/suppliers/${id}/documents/${docId}`),
  getSupplierEvaluations: (id: any) => http.get(`/procurement/suppliers/${id}/evaluations`),
  createSupplierEvaluation: (id: any, data: any) => http.post(`/procurement/suppliers/${id}/evaluations`, data),
  secApproveEvaluation: (id: any, data: any) => http.put(`/procurement/evaluations/${id}/sec-approve`, data),
  getEvaluationsDue: () => http.get('/procurement/evaluations/due'),
  getEvaluations: (params?: any) => http.get('/procurement/evaluations', { params }),
  getSupplierReports: (params?: any) => http.get('/procurement/supplier-reports', { params }),
  authorizeQuotation: (rfqId: any, data?: any) => http.put(`/procurement/rfqs/${rfqId}/authorize-quotation`, data),
  approveQuotationWaiver: (rfqId: any, data: any) => http.put(`/procurement/rfqs/${rfqId}/quotation-waiver`, data),
  cancelRequisition: (id: any, data: any) => http.put(`/procurement/requisitions/${id}/cancel`, data),
  cancelPurchaseOrder: (id: any, data: any) => http.put(`/procurement/purchase-orders/${id}/cancel`, data),
  // Per-line (split) award
  getLineAwards: (rfqId: any) => http.get(`/procurement/rfqs/${rfqId}/line-awards`),
  hodSelectLine: (rfqId: any, data: any) => http.put(`/department/rfqs/${rfqId}/line-awards/hod-select`, data),
  pmAuthorizeLine: (rfqId: any, data: any) => http.put(`/procurement/rfqs/${rfqId}/line-awards/pm-authorize`, data),
  waiveLine: (rfqId: any, data: any) => http.put(`/procurement/rfqs/${rfqId}/line-awards/waive`, data),
  generateLineAwardPOs: (rfqId: any, data: any) => http.post(`/procurement/rfqs/${rfqId}/line-awards/generate-pos`, data),
  resourceUnawardedLines: (rfqId: any, data: any) => http.post(`/procurement/rfqs/${rfqId}/line-awards/resource-unawarded`, data)
};
