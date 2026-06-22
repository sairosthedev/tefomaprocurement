import { getAppUrl, getClientUrl } from './branding.js';

/** Staff app deep link (under /app). */
export function staffPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getAppUrl()}${normalized}`;
}

/** Public route (login, register). */
export function publicPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getClientUrl()}${normalized}`;
}

export const emailPaths = {
  dashboard: () => staffPath(''),
  requisition: (id: string) => staffPath(`/requisitions/${id}`),
  quotation: (id: string) => staffPath(`/quotations/${id}`),
  purchaseOrder: (id: string) => staffPath(`/purchase-orders/${id}`),
  invoice: (id: string) => staffPath(`/invoices/${id}`),
  inventory: () => staffPath('/inventory'),
  deliveries: () => staffPath('/deliveries'),
  storeRequisitions: () => staffPath('/store-requisitions'),
  supplier: (id: string) => staffPath(`/suppliers/${id}`),
  supplierLogin: () => publicPath('/supplier/login'),
  supplierDashboard: () => staffPath(''),
  supplierRfqs: (id: string) => staffPath(`/my-rfqs/${id}`),
  supplierQuotations: () => staffPath('/my-submitted-quotations'),
  supplierPurchaseOrders: () => staffPath('/my-purchase-orders'),
  supplierInvoices: () => staffPath('/my-invoices'),
  supplierDeliveries: () => staffPath('/my-deliveries'),
  supplierProfile: () => staffPath('/supplier-profile')
};
