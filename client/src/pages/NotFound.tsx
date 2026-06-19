import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-md">
        <FileQuestion className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h1>
        <p className="text-gray-500 mb-6">
          The page you requested does not exist or you may not have access to it.
        </p>
        <Link
          to="/app"
          className="inline-flex items-center justify-center px-4 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
