import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import Logo from './Logo';

type LoginVariant = 'staff' | 'supplier';

const variantConfig = {
  staff: {
    title: 'Employee Sign In',
    subtitle: 'For Tefoma staff and authorised internal users',
    accentClass: 'from-primary/10 via-primary/5 to-primary/10',
    footer: (
      <p className="text-center text-sm text-gray-600">
        Are you a supplier?{' '}
        <Link to="/supplier/login" className="font-medium text-brand-blue hover:text-brand-blue-dark">
          Go to Supplier Portal
        </Link>
      </p>
    )
  },
  supplier: {
    title: 'Supplier Portal',
    subtitle: 'Manage RFQs, quotations, compliance documents, and deliveries',
    accentClass: 'from-brand-blue/10 via-brand-green/5 to-brand-amber/10',
    footer: (
      <div className="space-y-3 text-center text-sm text-gray-600">
        <p>
          New supplier?{' '}
          <Link to="/register" className="font-medium text-brand-green hover:text-brand-green-dark">
            Register your company
          </Link>
        </p>
        <p>
          Tefoma employee?{' '}
          <Link to="/login" className="font-medium text-brand-blue hover:text-brand-blue-dark">
            Staff sign in
          </Link>
        </p>
      </div>
    )
  }
};

export default function LoginForm({ variant }: { variant: LoginVariant }) {
  const config = variantConfig[variant];
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [pendingEmail, setPendingEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { login, verifyOtp } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/app';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(formData.email, formData.password);
      if (result.requiresOtp) {
        setPendingEmail(result.email || formData.email);
        setStep('otp');
        setOtp('');
        showToast(result.message || 'Check your email for the verification code', 'info', 6000);
        return;
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Login failed. Please try again.', 'error', 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      showToast('Enter the verification code from your email', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await verifyOtp(pendingEmail, otp.trim());
      navigate(from, { replace: true });
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Invalid verification code', 'error', 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const backToCredentials = () => {
    setStep('credentials');
    setOtp('');
    setPendingEmail('');
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${config.accentClass} flex items-center justify-center p-4`}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
          <div className="brand-accent-bar h-1.5 w-full" />
          <div className="p-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <Logo variant="default" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  {step === 'otp' ? 'Enter verification code' : config.title}
                </h1>
                <p className="text-gray-600">
                  {step === 'otp'
                    ? `We sent a 6-digit code to ${pendingEmail}`
                    : config.subtitle}
                </p>
              </div>
            </div>

            {step === 'credentials' ? (
              <form onSubmit={handleCredentialsSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all duration-200 hover:border-gray-400 placeholder:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="you@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all duration-200 hover:border-gray-400 placeholder:text-gray-400 pr-20 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors duration-200 focus:outline-none rounded px-2 py-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? 'HIDE' : 'SHOW'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary text-white py-3 px-4 rounded-lg font-medium hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 active:scale-[0.98] transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-primary flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Continuing...</span>
                    </>
                  ) : (
                    'Continue'
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                    Verification code
                  </label>
                  <input
                    type="text"
                    id="otp"
                    name="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    disabled={isLoading}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-center text-2xl tracking-[0.4em] font-mono disabled:bg-gray-100"
                    placeholder="000000"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 text-center">Code expires in 10 minutes</p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otp.length < 6}
                  className="w-full bg-primary text-white py-3 px-4 rounded-lg font-medium hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    'Verify & sign in'
                  )}
                </button>

                <button
                  type="button"
                  onClick={backToCredentials}
                  className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </button>
              </form>
            )}

            {config.footer}
          </div>
        </div>

        <p className="text-center mt-4">
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to portal selection
          </Link>
        </p>
      </div>
    </div>
  );
}
