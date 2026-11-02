import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import Logo from '../components/Logo';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function ResetPassword() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      showToast('Passwords do not match', 'error');
      return;
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    if (!token || !email) {
      showToast('Invalid reset link', 'error');
      return;
    }

    try {
      setLoading(true);
      await authAPI.resetPassword({ token, email, newPassword: password });
      showToast('Password updated. You can sign in now.', 'success');
      navigate('/login', { replace: true });
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Reset failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center border border-gray-100">
          <p className="text-gray-600">This reset link is invalid or incomplete.</p>
          <Link to="/forgot-password" className="mt-4 inline-block text-primary font-medium hover:underline">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Set new password</h1>
          <p className="text-sm text-gray-500 mt-2">Choose a new password for {email}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Update password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
