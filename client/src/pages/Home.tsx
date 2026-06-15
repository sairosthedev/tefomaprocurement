import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Truck, ArrowRight } from 'lucide-react';
import Logo from '../components/Logo';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <Logo variant="default" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Tefoma Procurement</h1>
          <p className="text-gray-600 mt-2">Choose how you want to access the system</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Link
            to="/login"
            className="group bg-white rounded-2xl shadow-lg hover:shadow-xl border border-gray-100 p-8 transition-all duration-200 hover:-translate-y-1"
          >
            <div className="h-14 w-14 bg-primary/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Tefoma Staff</h2>
            <p className="text-gray-600 text-sm mb-6">
              For employees — procurement, finance, stores, department heads, and management.
            </p>
            <span className="inline-flex items-center gap-2 text-primary font-medium text-sm group-hover:gap-3 transition-all">
              Employee sign in
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          <Link
            to="/supplier/login"
            className="group bg-white rounded-2xl shadow-lg hover:shadow-xl border border-gray-100 p-8 transition-all duration-200 hover:-translate-y-1"
          >
            <div className="h-14 w-14 bg-brand-blue/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-brand-blue/15 transition-colors">
              <Truck className="h-7 w-7 text-brand-blue" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Supplier Portal</h2>
            <p className="text-gray-600 text-sm mb-6">
              For registered vendors — respond to RFQs, submit quotes, upload compliance documents, and track orders.
            </p>
            <span className="inline-flex items-center gap-2 text-brand-blue font-medium text-sm group-hover:gap-3 transition-all">
              Supplier sign in
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>

        <p className="text-center text-sm text-gray-500 mt-8">
          New supplier?{' '}
          <Link to="/register" className="font-medium text-brand-green hover:text-brand-green-dark">
            Register your company
          </Link>
        </p>
      </div>
    </div>
  );
}
