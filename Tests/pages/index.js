const { LoginPage } = require('./LoginPage');
const { BasePage } = require('./BasePage');
const { RequisitionsPage } = require('./RequisitionsPage');
const {
  RequisitionDetailPage,
  StoresPrReviewPage,
  RfqDrawer,
  RfqDetailPage,
  SupplierRfqsPage,
  QuotationDetailPage,
  AuthorizationsPage
} = require('./SourcingPages');
const {
  PurchaseOrdersPage,
  PurchaseOrderDetailPage,
  ApprovalsPage,
  SupplierPurchaseOrdersPage,
  DashboardPage
} = require('./PurchaseOrderPages');
const {
  DeliveriesPage,
  StoreRequisitionsPage,
  InventoryPage,
  SupplierInvoicesPage,
  InvoicesPage,
  PaymentsPage,
  EvaluationsPage
} = require('./ReceivePayPages');

/** Every page object, bound to one browser page. */
function pagesFor(page) {
  return {
    base: new BasePage(page),
    login: new LoginPage(page),
    dashboard: new DashboardPage(page),
    requisitions: new RequisitionsPage(page),
    requisition: new RequisitionDetailPage(page),
    storesReview: new StoresPrReviewPage(page),
    rfqDrawer: new RfqDrawer(page),
    rfq: new RfqDetailPage(page),
    supplierRfqs: new SupplierRfqsPage(page),
    quotation: new QuotationDetailPage(page),
    authorizations: new AuthorizationsPage(page),
    purchaseOrders: new PurchaseOrdersPage(page),
    purchaseOrder: new PurchaseOrderDetailPage(page),
    approvals: new ApprovalsPage(page),
    supplierOrders: new SupplierPurchaseOrdersPage(page),
    deliveries: new DeliveriesPage(page),
    storeRequisitions: new StoreRequisitionsPage(page),
    inventory: new InventoryPage(page),
    supplierInvoices: new SupplierInvoicesPage(page),
    invoices: new InvoicesPage(page),
    payments: new PaymentsPage(page),
    evaluations: new EvaluationsPage(page)
  };
}

module.exports = { pagesFor };
