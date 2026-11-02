import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isProcurementHead } from '@fossil/shared';
import { Loader2 } from 'lucide-react';
import { hasStoredSession, readStoredSession } from '../lib/session';

export function ProtectedRoute({ children, allowedRoles }: any) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const storedSession = readStoredSession();
  const sessionUser = user || storedSession.user;
  const authenticated = hasStoredSession();

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

  if (!authenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (!sessionUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="text-lg text-gray-600">Loading session...</span>
        </div>
      </div>
    );
  }

  const effectiveRoles = isProcurementHead(sessionUser)
    ? [sessionUser.role, 'procurement_officer']
    : [sessionUser.role];

  if (allowedRoles && !effectiveRoles.some((r: string) => allowedRoles.includes(r))) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
