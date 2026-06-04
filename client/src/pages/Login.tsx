import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loader2 } from 'lucide-react';
import Logo from '../components/Logo';

export default function Login() {
  const [formData, setFormData] = useState<any>({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState<any>(false);
  const [isLoading, setIsLoading] = useState<any>(false);

  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/app';

  const handleChange = (e: any) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const user = await login(formData.email, formData.password);
      
      // Redirect based on role
      const roleRoutes: any = {
        admin: '/app',
        procurement_officer: '/app',
        department_head: '/app',
        finance: '/app',
        coo: '/app',
        stores_officer: '/app',
        supplier: '/app'
      };
      
      navigate(roleRoutes[user.role] || from, { replace: true });
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Login failed. Please try again.', 'error', 5000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-primary/5 to-primary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6 animate-fade-in-up">
          {/* Header */}
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <Logo variant="default" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">Welcome to FossilProcure</h1>
              <p className="text-gray-600">Log in to your account to continue</p>
            </div>
          </div>

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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all duration-200 hover:border-gray-400 placeholder:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
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

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary focus:ring-2 transition-all duration-200 cursor-pointer"
                />
                <span className="ml-2 text-sm text-gray-600 group-hover:text-gray-900 transition-colors duration-200">Remember me</span>
                </label>
              <a 
                href="#" 
                className="text-sm text-primary hover:text-primary-dark font-medium transition-colors duration-200 hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded px-1"
              >
                  Forgot password?
                </a>
              </div>

            {/* Submit Button */}
              <button
                type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-white py-3 px-4 rounded-lg font-medium hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 active:scale-[0.98] transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-primary flex items-center justify-center gap-2"
              style={{ backgroundColor: '#193019' }}
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
        </div>
      </div>
    </div>
  );
}
