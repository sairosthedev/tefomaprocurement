import React, { Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { SplashScreen, shouldShowSplash } from './components/SplashScreen';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { EnvironmentBanner } from './components/EnvironmentBanner';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SidebarLayout } from './layouts/appLayout';
import { lazyPage, PageFallback, preloadPagesWhenIdle } from './lib/lazyPage';

// Shared Pages
import Login from './pages/Login';
const Register = lazyPage(() => import('./pages/Register'));
import Dashboard from './pages/Dashboard';
const Notifications = lazyPage(() => import('./pages/Notifications'));
import Unauthorized from './pages/Unauthorized';
const Profile = lazyPage(() => import('./pages/Profile'));
const Reports = lazyPage(() => import('./pages/Reports'));

// Admin Pages
const Users = lazyPage(() => import('./pages/Users'));
const Departments = lazyPage(() => import('./pages/Departments'));
const AuditLogs = lazyPage(() => import('./pages/AuditLogs'));
const Sites = lazyPage(() => import('./pages/Sites'));

// Procurement Pages
const Suppliers = lazyPage(() => import('./pages/Suppliers'));
const SupplierDetails = lazyPage(() => import('./pages/SupplierDetails'));
const RFQs = lazyPage(() => import('./pages/RFQs'));
const RFQDetail = lazyPage(() => import('./pages/RFQDetail'));
const AwardMatrix = lazyPage(() => import('./pages/AwardMatrix'));
const Quotations = lazyPage(() => import('./pages/Quotations'));
const QuotationDetail = lazyPage(() => import('./pages/QuotationDetail'));
const BankChanges = lazyPage(() => import('./pages/BankChanges'));
const Performance = lazyPage(() => import('./pages/suppliers/Performance'));
const Compliance = lazyPage(() => import('./pages/suppliers/Compliance'));
const Evaluations = lazyPage(() => import('./pages/suppliers/Evaluations'));
const PurchaseOrders = lazyPage(() => import('./pages/PurchaseOrders'));
const PurchaseOrderDetail = lazyPage(() => import('./pages/PurchaseOrderDetail'));

// Department Head Pages
const Requisitions = lazyPage(() => import('./pages/Requisitions'));
const RequisitionDetail = lazyPage(() => import('./pages/RequisitionDetail'));
const StoreRequisitions = lazyPage(() => import('./pages/StoreRequisitions'));
const StoresPrReview = lazyPage(() => import('./pages/StoresPrReview'));
const Approvals = lazyPage(() => import('./pages/Approvals'));
const Authorizations = lazyPage(() => import('./pages/Authorizations'));

// Finance Pages
const Budgets = lazyPage(() => import('./pages/Budgets'));
const Invoices = lazyPage(() => import('./pages/Invoices'));
const InvoiceDetail = lazyPage(() => import('./pages/InvoiceDetail'));
const Payments = lazyPage(() => import('./pages/Payments'));

// Stores Pages
const Deliveries = lazyPage(() => import('./pages/Deliveries'));
const Inventory = lazyPage(() => import('./pages/Inventory'));
const StockMovements = lazyPage(() => import('./pages/StockMovements'));
const StockTransfers = lazyPage(() => import('./pages/StockTransfers'));

// Supplier Portal Pages
const MyRFQs = lazyPage(() => import('./pages/supplier/MyRFQs'));
const SupplierRFQDetail = lazyPage(() => import('./pages/supplier/SupplierRFQDetail'));
const MyQuotations = lazyPage(() => import('./pages/supplier/MyQuotations'));
const MySubmittedQuotations = lazyPage(() => import('./pages/supplier/MySubmittedQuotations'));
const MyPurchaseOrders = lazyPage(() => import('./pages/supplier/MyPurchaseOrders'));
const MyDeliveries = lazyPage(() => import('./pages/supplier/MyDeliveries'));
const SupplierProfile = lazyPage(() => import('./pages/supplier/SupplierProfile'));
const MyKys = lazyPage(() => import('./pages/supplier/MyKys'));
const MyInvoices = lazyPage(() => import('./pages/supplier/MyInvoices'));
const ForgotPassword = lazyPage(() => import('./pages/ForgotPassword'));
const ResetPassword = lazyPage(() => import('./pages/ResetPassword'));
import NotFound from './pages/NotFound';

function SupplierKysRedirect() {
  const { id } = useParams();
  return <Navigate to={`/app/suppliers/${id}?tab=documents`} replace />;
}

/** Old create-page links: open the form's drawer on the page that hosts it, keeping their query. */
function OpenInDrawer({ to }: { to: string }) {
  const params = new URLSearchParams(useLocation().search);
  params.set('new', '1');
  return <Navigate to={`${to}?${params}`} replace />;
}

function SubmitQuotationRedirect() {
  const rfq = new URLSearchParams(useLocation().search).get('rfq');
  return <Navigate to={rfq ? `/app/my-rfqs/${rfq}?quote=1` : '/app/my-rfqs'} replace />;
}

function AppLayout({ children, allowedRoles }: any) {
  // Signed in: fetch the other pages' code in the background.
  React.useEffect(preloadPagesWhenIdle, []);
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      {/* Inside the layout, so the sidebar stays put while a page's code loads. */}
      <SidebarLayout>
        <Suspense fallback={<PageFallback />}>{children}</Suspense>
      </SidebarLayout>
    </ProtectedRoute>
  );
}

// Decided once at load: StrictMode runs state initialisers twice, and the
// second call would see the flag the first one set.
const SHOW_SPLASH = shouldShowSplash();

function App() {
  const [splashDone, setSplashDone] = useState(!SHOW_SPLASH);

  return (
    <>
      {!splashDone && <SplashScreen onComplete={() => setSplashDone(true)} />}
      <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          {/* Renders nothing in production. */}
          <EnvironmentBanner />
          <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/supplier/login" element={<Navigate to="/" replace />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Dashboard - All authenticated users */}
            <Route path="/app" element={
              <AppLayout>
                <Dashboard />
              </AppLayout>
            } />

            {/* Profile - All authenticated users */}
            <Route path="/app/profile" element={
              <AppLayout>
                <Profile />
              </AppLayout>
            } />

            {/* Reports - All internal users */}
            <Route path="/app/reports" element={
              <AppLayout allowedRoles={['admin', 'procurement_officer', 'department_head', 'finance', 'coo', 'stores_officer']}>
                <Reports />
              </AppLayout>
            } />

            {/* Notifications - All users */}
            <Route path="/app/notifications" element={
              <AppLayout>
                <Notifications />
              </AppLayout>
            } />

            {/* Admin Routes */}
            <Route path="/app/users" element={
              <AppLayout allowedRoles={['admin']}>
                <Users />
              </AppLayout>
            } />
            <Route path="/app/departments" element={
              <AppLayout allowedRoles={['admin']}>
                <Departments />
              </AppLayout>
            } />
            <Route path="/app/sites" element={
              <AppLayout allowedRoles={['admin']}>
                <Sites />
              </AppLayout>
            } />
            <Route path="/app/audit-logs" element={
              <AppLayout allowedRoles={['admin']}>
                <AuditLogs />
              </AppLayout>
            } />

            {/* Procurement Routes */}
            <Route path="/app/suppliers" element={
              <AppLayout allowedRoles={['admin', 'procurement_officer', 'coo']}>
                <Suppliers />
              </AppLayout>
            } />
            <Route path="/app/suppliers/:id" element={
              <AppLayout allowedRoles={['admin', 'procurement_officer', 'coo']}>
                <SupplierDetails />
              </AppLayout>
            } />
            <Route path="/app/verification-hub" element={
              <Navigate to="/app/suppliers?status=pending" replace />
            } />
            <Route path="/app/suppliers/analytics/performance" element={
              <AppLayout allowedRoles={['admin', 'procurement_officer', 'coo']}>
                <Performance />
              </AppLayout>
            } />
            <Route path="/app/suppliers/analytics/compliance" element={
              <AppLayout allowedRoles={['admin', 'procurement_officer', 'coo']}>
                <Compliance />
              </AppLayout>
            } />
            <Route path="/app/suppliers/evaluations" element={
              <AppLayout allowedRoles={['admin', 'procurement_officer', 'coo']}>
                <Evaluations />
              </AppLayout>
            } />
            <Route path="/app/suppliers/reports" element={
              <Navigate to="/app/reports?tab=suppliers" replace />
            } />
            {/* Banking changes are held here until callback-verified and
                approved by a second person; payments pause meanwhile. The
                whole workflow is procurement's, so only they open it. */}
            <Route path="/app/bank-changes" element={
              <AppLayout allowedRoles={['procurement_officer']}>
                <BankChanges />
              </AppLayout>
            } />
            <Route path="/app/suppliers/:id/kys" element={
              <AppLayout allowedRoles={['admin', 'procurement_officer', 'coo']}>
                <SupplierKysRedirect />
              </AppLayout>
            } />
            <Route path="/app/rfqs" element={
              <AppLayout allowedRoles={['procurement_officer']}>
                <RFQs />
              </AppLayout>
            } />
            <Route path="/app/rfqs/create" element={<OpenInDrawer to="/app/rfqs" />} />
            <Route path="/app/rfqs/:id" element={
              <AppLayout allowedRoles={['procurement_officer']}>
                <RFQDetail />
              </AppLayout>
            } />
            {/* The COO opens the award matrix and a quotation only to approve a
                waiver; those pages show them nothing else to act on. */}
            <Route path="/app/rfqs/:id/award" element={
              <AppLayout allowedRoles={['procurement_officer', 'coo']}>
                <AwardMatrix />
              </AppLayout>
            } />
            {/* Head of Procurement's queue; they hold procurement_officer
                through ProtectedRoute, and only their menu links here. */}
            <Route path="/app/authorizations" element={
              <AppLayout allowedRoles={['procurement_officer']}>
                <Authorizations />
              </AppLayout>
            } />
            <Route path="/app/quotations" element={
              <AppLayout allowedRoles={['procurement_officer']}>
                <Quotations />
              </AppLayout>
            } />
            <Route path="/app/quotations/:id" element={
              <AppLayout allowedRoles={['procurement_officer', 'coo']}>
                <QuotationDetail />
              </AppLayout>
            } />
            {/* Department heads and requesters follow a PO from its requisition
                rather than opening the procurement PO pages. */}
            <Route path="/app/purchase-orders" element={
              <AppLayout allowedRoles={['admin', 'procurement_officer', 'finance', 'coo']}>
                <PurchaseOrders />
              </AppLayout>
            } />
            <Route path="/app/purchase-orders/:id" element={
              <AppLayout allowedRoles={['admin', 'procurement_officer', 'finance', 'coo']}>
                <PurchaseOrderDetail />
              </AppLayout>
            } />

            {/* Department Head Routes */}
            <Route path="/app/requisitions" element={
              <AppLayout allowedRoles={['procurement_officer', 'department_head', 'end_user']}>
                <Requisitions />
              </AppLayout>
            } />
            <Route path="/app/requisitions/:id" element={
              <AppLayout allowedRoles={['procurement_officer', 'department_head', 'end_user']}>
                <RequisitionDetail />
              </AppLayout>
            } />
            {/* Creating now happens in a drawer on the list; old links land there. */}
            <Route path="/app/requisitions/create" element={<Navigate to="/app/requisitions?new=1" replace />} />
            <Route path="/app/store-requisitions" element={
              <AppLayout allowedRoles={['department_head', 'stores_officer']}>
                <StoreRequisitions />
              </AppLayout>
            } />
            <Route path="/app/approvals" element={
              <AppLayout allowedRoles={['finance', 'coo', 'department_head']}>
                <Approvals />
              </AppLayout>
            } />

            {/* Finance Routes */}
            <Route path="/app/budgets" element={
              <AppLayout allowedRoles={['finance']}>
                <Budgets />
              </AppLayout>
            } />
            <Route path="/app/invoices" element={
              <AppLayout allowedRoles={['finance']}>
                <Invoices />
              </AppLayout>
            } />
            <Route path="/app/invoices/:id" element={
              <AppLayout allowedRoles={['finance']}>
                <InvoiceDetail />
              </AppLayout>
            } />
            <Route path="/app/payments" element={
              <AppLayout allowedRoles={['finance']}>
                <Payments />
              </AppLayout>
            } />

            {/* Stores Routes */}
            <Route path="/app/stores-pr-review" element={
              <AppLayout allowedRoles={['stores_officer']}>
                <StoresPrReview />
              </AppLayout>
            } />
            <Route path="/app/deliveries" element={
              <AppLayout allowedRoles={['stores_officer']}>
                <Deliveries />
              </AppLayout>
            } />
            <Route path="/app/inventory" element={
              <AppLayout allowedRoles={['stores_officer']}>
                <Inventory />
              </AppLayout>
            } />
            <Route path="/app/stock-movements" element={
              <AppLayout allowedRoles={['stores_officer']}>
                <StockMovements />
              </AppLayout>
            } />
            <Route path="/app/stock-transfers" element={
              <AppLayout allowedRoles={['stores_officer']}>
                <StockTransfers />
              </AppLayout>
            } />

            {/* Supplier Portal Routes */}
            <Route path="/app/my-rfqs" element={
              <AppLayout allowedRoles={['supplier']}>
                <MyRFQs />
              </AppLayout>
            } />
            <Route path="/app/my-rfqs/:id" element={
              <AppLayout allowedRoles={['supplier']}>
                <SupplierRFQDetail />
              </AppLayout>
            } />
            <Route path="/app/submit-quotation" element={<SubmitQuotationRedirect />} />
            <Route path="/app/my-submitted-quotations" element={
              <AppLayout allowedRoles={['supplier']}>
                <MySubmittedQuotations />
              </AppLayout>
            } />
            <Route path="/app/my-quotations" element={
              <AppLayout allowedRoles={['supplier']}>
                <MyQuotations />
              </AppLayout>
            } />
            <Route path="/app/my-purchase-orders" element={
              <AppLayout allowedRoles={['supplier']}>
                <MyPurchaseOrders />
              </AppLayout>
            } />
            <Route path="/app/my-deliveries" element={
              <AppLayout allowedRoles={['supplier']}>
                <MyDeliveries />
              </AppLayout>
            } />
            <Route path="/app/supplier-profile" element={
              <AppLayout allowedRoles={['supplier']}>
                <SupplierProfile />
              </AppLayout>
            } />
            <Route path="/app/my-kys" element={
              <AppLayout allowedRoles={['supplier']}>
                <MyKys />
              </AppLayout>
            } />
            <Route path="/app/my-invoices" element={
              <AppLayout allowedRoles={['supplier']}>
                <MyInvoices />
              </AppLayout>
            } />
            <Route path="/app/submit-invoice" element={<OpenInDrawer to="/app/my-invoices" />} />

            {/* Catch all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
      </BrowserRouter>
    </>
  );
}

export default App;
