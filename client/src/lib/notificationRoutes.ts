type NotificationLike = {
  entity?: string;
  entityId?: string;
  type?: string;
};

const SUPPLIER_ENTITY_ROUTES: Record<string, (id: string) => string> = {
  RFQ: (id) => `/app/my-rfqs/${id}`,
  Quotation: (id) => `/app/my-submitted-quotations`,
  PurchaseOrder: (id) => `/app/my-purchase-orders`,
  Delivery: (id) => `/app/my-deliveries`,
  Invoice: (id) => `/app/my-invoices`,
  SupplierProfile: () => `/app/supplier-profile`
};

const INTERNAL_ENTITY_ROUTES: Record<string, (id: string) => string | null> = {
  PurchaseRequisition: (id) => `/app/requisitions/${id}`,
  PurchaseOrder: (id) => `/app/purchase-orders/${id}`,
  RFQ: (id) => `/app/rfqs/${id}`,
  Quotation: (id) => `/app/quotations/${id}`,
  Invoice: (id) => `/app/invoices/${id}`,
  SupplierProfile: (id) => `/app/suppliers/${id}`,
  SupplierEvaluation: () => `/app/suppliers/evaluations`,
  Delivery: () => `/app/deliveries`,
  StoreRequisition: () => `/app/store-requisitions`,
  User: () => `/app/profile`
};

export function getNotificationPath(
  notification: NotificationLike,
  role?: string
): string | null {
  const entity = notification.entity;
  const entityId = notification.entityId ? String(notification.entityId) : '';

  if (!entity) return null;

  const routes = role === 'supplier' ? SUPPLIER_ENTITY_ROUTES : INTERNAL_ENTITY_ROUTES;
  const resolver = routes[entity];
  if (!resolver) return null;

  return resolver(entityId);
}
