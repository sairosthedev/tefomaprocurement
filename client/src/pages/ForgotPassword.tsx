import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import Logo from '../components/Logo';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function ForgotPassword() {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await authAPI.forgotPassword({ email: email.trim() });
      setSent(true);
      showToast(res.data.message || 'Check your email', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Request failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo variant="default" showText />
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <Link to="/login" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Forgot password</h1>
          <p className="text-sm text-gray-500 mt-2">
            Enter your work email and we&apos;ll send a reset link if an account exists.
          </p>

          {sent ? (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
              If an account exists for <strong>{email}</strong>, a reset link has been sent. Check your inbox.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Send reset link
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
