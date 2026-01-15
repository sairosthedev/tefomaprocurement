import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SidebarLayout } from './layouts/appLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Suppliers from './pages/Suppliers';
import RFQs from './pages/RFQs';
import Quotations from './pages/Quotations';
import PurchaseOrders from './pages/PurchaseOrders';
import Users from './pages/Users';
import Notifications from './pages/Notifications';
import Unauthorized from './pages/Unauthorized';

function AppLayout({ children }) {
  return (
    <ProtectedRoute>
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
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Protected Routes */}
          <Route path="/app" element={<AppLayout><Dashboard /></AppLayout>} />
          <Route path="/app/suppliers" element={
            <ProtectedRoute allowedRoles={['admin', 'procurement_officer']}>
              <SidebarLayout><Suppliers /></SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/app/rfqs" element={
            <ProtectedRoute allowedRoles={['admin', 'procurement_officer']}>
              <SidebarLayout><RFQs /></SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/app/quotations" element={
            <ProtectedRoute allowedRoles={['admin', 'procurement_officer']}>
              <SidebarLayout><Quotations /></SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/app/purchase-orders" element={
            <ProtectedRoute allowedRoles={['admin', 'procurement_officer', 'finance', 'coo']}>
              <SidebarLayout><PurchaseOrders /></SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/app/users" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SidebarLayout><Users /></SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/app/notifications" element={<AppLayout><Notifications /></AppLayout>} />

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
