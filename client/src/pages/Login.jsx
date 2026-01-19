import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/app';

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await login(formData.email, formData.password);
      
      // Redirect based on role
      const roleRoutes = {
        admin: '/app',
        procurement_officer: '/app',
        department_head: '/app',
        finance: '/app',
        coo: '/app',
        stores_officer: '/app',
        supplier: '/app'
      };
      
      navigate(roleRoutes[user.role] || from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 via-green-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6 animate-fade-in-up">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-gray-900">Welcome to FossilProcure</h1>
              <p className="text-gray-600">Log in to your account to continue</p>
        </div>
      </div>

          {/* Error Message */}
            {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all duration-200 hover:border-gray-400 placeholder:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="you@example.com"
                />
              </div>

            {/* Password Field */}
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all duration-200 hover:border-gray-400 placeholder:text-gray-400 pr-20 disabled:bg-gray-100 disabled:cursor-not-allowed"
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

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 focus:ring-2 transition-all duration-200 cursor-pointer"
                />
                <span className="ml-2 text-sm text-gray-600 group-hover:text-gray-900 transition-colors duration-200">Remember me</span>
                </label>
              <a 
                href="#" 
                className="text-sm text-green-600 hover:text-green-700 font-medium transition-colors duration-200 hover:underline focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 rounded px-1"
              >
                  Forgot password?
                </a>
              </div>

            {/* Submit Button */}
              <button
                type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 active:scale-[0.98] transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-green-600 flex items-center justify-center gap-2"
              >
              {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Logging in...</span>
                  </>
                ) : (
                'Log In'
                )}
              </button>
            </form>

          {/* Supplier Registration Link */}
          <div className="text-center pt-4">
              <p className="text-gray-600 text-sm">
                Are you a supplier?{' '}
              <Link to="/register" className="text-green-600 hover:text-green-700 font-medium transition-colors duration-200 hover:underline">
                  Register here
                </Link>
              </p>
            </div>
        </div>
      </div>
    </div>
  );
}
