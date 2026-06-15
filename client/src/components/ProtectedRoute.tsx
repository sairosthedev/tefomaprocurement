import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isProcurementHead } from '@fossil/shared';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({ children, allowedRoles }: any) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="text-lg text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // A procurement department head also has procurement_officer capabilities.
  const effectiveRoles = isProcurementHead(user)
    ? [user.role, 'procurement_officer']
    : [user.role];

  if (allowedRoles && !effectiveRoles.some((r: string) => allowedRoles.includes(r))) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
