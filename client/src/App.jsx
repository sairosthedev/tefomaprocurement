import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SidebarLayout } from './layouts/appLayout';

// Shared Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Notifications from './pages/Notifications';
import Unauthorized from './pages/Unauthorized';
import Profile from './pages/Profile';
import Reports from './pages/Reports';

// Admin Pages
import Users from './pages/Users';
import Departments from './pages/Departments';
import AuditLogs from './pages/AuditLogs';

// Procurement Pages
import Suppliers from './pages/Suppliers';
import RFQs from './pages/RFQs';
import RFQDetail from './pages/RFQDetail';
import CreateRFQ from './pages/CreateRFQ';
import Quotations from './pages/Quotations';
import QuotationDetail from './pages/QuotationDetail';
import PurchaseOrders from './pages/PurchaseOrders';
import PurchaseOrderDetail from './pages/PurchaseOrderDetail';

// Department Head Pages
import Requisitions from './pages/Requisitions';
import RequisitionDetail from './pages/RequisitionDetail';
import CreateRequisition from './pages/CreateRequisition';
import StoreRequisitions from './pages/StoreRequisitions';
import Approvals from './pages/Approvals';

// Finance Pages
import Budgets from './pages/Budgets';

// Stores Pages
import Deliveries from './pages/Deliveries';
import Inventory from './pages/Inventory';
import StockMovements from './pages/StockMovements';

// Supplier Portal Pages
import MyRFQs from './pages/supplier/MyRFQs';
import SubmitQuotation from './pages/supplier/SubmitQuotation';
import MyQuotations from './pages/supplier/MyQuotations';
import MySubmittedQuotations from './pages/supplier/MySubmittedQuotations';
import MyPurchaseOrders from './pages/supplier/MyPurchaseOrders';
import MyDeliveries from './pages/supplier/MyDeliveries';
import SupplierProfile from './pages/supplier/SupplierProfile';

function AppLayout({ children, allowedRoles }) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <SidebarLayout>{children}</SidebarLayout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
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
            <Route path="/app/rfqs" element={
              <AppLayout allowedRoles={['admin', 'procurement_officer']}>
                <RFQs />
              </AppLayout>
            } />
            <Route path="/app/rfqs/create" element={
              <AppLayout allowedRoles={['admin', 'procurement_officer']}>
                <CreateRFQ />
              </AppLayout>
            } />
            <Route path="/app/rfqs/:id" element={
              <AppLayout allowedRoles={['admin', 'procurement_officer']}>
                <RFQDetail />
              </AppLayout>
            } />
            <Route path="/app/quotations" element={
              <AppLayout allowedRoles={['admin', 'procurement_officer']}>
                <Quotations />
              </AppLayout>
            } />
            <Route path="/app/quotations/:id" element={
              <AppLayout allowedRoles={['admin', 'procurement_officer']}>
                <QuotationDetail />
              </AppLayout>
            } />
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
              <AppLayout allowedRoles={['admin', 'procurement_officer', 'department_head']}>
                <Requisitions />
              </AppLayout>
            } />
            <Route path="/app/requisitions/:id" element={
              <AppLayout allowedRoles={['admin', 'procurement_officer', 'department_head']}>
                <RequisitionDetail />
              </AppLayout>
            } />
            <Route path="/app/requisitions/create" element={
              <AppLayout allowedRoles={['department_head']}>
                <CreateRequisition />
              </AppLayout>
            } />
            <Route path="/app/store-requisitions" element={
              <AppLayout allowedRoles={['department_head', 'stores_officer']}>
                <StoreRequisitions />
              </AppLayout>
            } />
            <Route path="/app/approvals" element={
              <AppLayout allowedRoles={['finance', 'coo', 'admin']}>
                <Approvals />
              </AppLayout>
            } />

            {/* Finance Routes */}
            <Route path="/app/budgets" element={
              <AppLayout allowedRoles={['admin', 'finance']}>
                <Budgets />
              </AppLayout>
            } />

            {/* Stores Routes */}
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

            {/* Supplier Portal Routes */}
            <Route path="/app/my-rfqs" element={
              <AppLayout allowedRoles={['supplier']}>
                <MyRFQs />
              </AppLayout>
            } />
            <Route path="/app/submit-quotation" element={
              <AppLayout allowedRoles={['supplier']}>
                <SubmitQuotation />
              </AppLayout>
            } />
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

            {/* Redirect root to login */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            
            {/* Catch all - redirect to app */}
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
