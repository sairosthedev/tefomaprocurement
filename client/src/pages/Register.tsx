import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import { Loader2, Eye, EyeOff, Building2, ArrowLeft } from 'lucide-react';
import Logo from '../components/Logo';
import { CategoryMultiSelect } from '../components/CategorySelect';
import { PROVINCES, COUNTRIES, BANKS, ACCOUNT_TYPES } from '../lib/constants';

export default function Register() {
  const [step, setStep] = useState<any>(1);
  const [loading, setLoading] = useState<any>(false);
  const [success, setSuccess] = useState<any>(false);
  const [showPassword, setShowPassword] = useState<any>(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState<any>({
    // User info
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    // Company info
    companyName: '',
    tradingName: '',
    registrationNumber: '',
    vatNumber: '',
    // Address
    street: '',
    city: '',
    province: '',
    postalCode: '',
    country: '',
    countryOther: '',
    // Bank details
    bankName: '',
    accountNumber: '',
    branchCode: '',
    accountType: 'current',
    // Categories
    categories: [] as string[]
  });

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev: any) => {
      const next = { ...prev, [name]: value };
      if (name === 'country') {
        next.province = '';
        if (value !== 'Other') next.countryOther = '';
        if (value !== 'Zimbabwe') next.bankName = '';
      }
      return next;
    });
  };

  const resolvedCountry = () => (
    formData.country === 'Other' ? formData.countryOther.trim() : formData.country
  );

  const isZimbabwe = formData.country === 'Zimbabwe';

  const validateStep = () => {
    if (step === 1) {
      if (!formData.email || !formData.password || !formData.firstName || !formData.lastName) {
        showToast('Please fill in all required fields', 'error', 4000);
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        showToast('Passwords do not match', 'error', 4000);
        return false;
      }
      if (formData.password.length < 6) {
        showToast('Password must be at least 6 characters', 'error', 4000);
        return false;
      }
    }

    if (step === 2) {
      if (!formData.companyName || !formData.registrationNumber) {
        showToast('Company name and registration number are required', 'error', 4000);
        return false;
      }
    }

    if (step === 3) {
      const country = resolvedCountry();
      if (!formData.country) {
        showToast('Please select your country', 'error', 4000);
        return false;
      }
      if (formData.country === 'Other' && !country) {
        showToast('Please enter your country name', 'error', 4000);
        return false;
      }
    }

    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      setStep((prev: any) => prev + 1);
    }
  };

  const prevStep = () => {
    setStep((prev: any) => prev - 1);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!validateStep()) return;

    setLoading(true);

    try {
      await authAPI.register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        role: 'supplier',
        companyDetails: {
          companyName: formData.companyName,
          tradingName: formData.tradingName,
          registrationNumber: formData.registrationNumber,
          vatNumber: formData.vatNumber,
          address: {
            street: formData.street,
            city: formData.city,
            province: formData.province,
            postalCode: formData.postalCode,
            country: resolvedCountry()
          },
          bankDetails: {
            bankName: formData.bankName,
            accountNumber: formData.accountNumber,
            branchCode: formData.branchCode,
            accountType: formData.accountType
          },
          categories: formData.categories
        }
      });

      setSuccess(true);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Registration failed. Please try again.', 'error', 5000);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Successful!</h2>
          <p className="text-gray-600 mb-6">
            Your supplier account has been created and is pending approval. 
            You'll receive an email once your account is activated.
          </p>
          <Link
            to="/supplier/login"
            className="inline-flex items-center justify-center w-full px-4 py-3 bg-primary hover:bg-primary-dark text-white font-medium rounded-xl transition-colors"
          >
            Go to Supplier Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-primary px-8 py-6 text-white">
          <Link to="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <Logo variant="icon" className="text-white" />
            <div>
              <h1 className="text-2xl font-bold">Supplier Registration</h1>
              <p className="text-white/80 text-sm mt-1">
                Register your company to become a supplier for Tefoma Construction
              </p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="px-8 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            {['Account', 'Company', 'Address', 'Banking'].map((label: any, idx: any) => (
              <div key={label} className="flex items-center">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step > idx + 1 ? 'bg-primary text-white' :
                  step === idx + 1 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {step > idx + 1 ? '✓' : idx + 1}
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  step === idx + 1 ? 'text-primary' : 'text-gray-500'
                }`}>{label}</span>
                {idx < 3 && <div className="w-8 md:w-16 h-0.5 bg-gray-200 mx-2" />}
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8">

          {/* Step 1: Account Info */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Company Info */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trading Name (if different)</label>
                <input
                  type="text"
                  name="tradingName"
                  value={formData.tradingName}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number *</label>
                  <input
                    type="text"
                    name="registrationNumber"
                    value={formData.registrationNumber}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    placeholder="e.g., 2024/123456/07"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">VAT Number</label>
                  <input
                    type="text"
                    name="vatNumber"
                    value={formData.vatNumber}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product/Service Categories</label>
                <CategoryMultiSelect
                  value={formData.categories}
                  onChange={(codes) => setFormData((prev: any) => ({ ...prev, categories: codes }))}
                  placeholder="Select categories your company supplies…"
                  placement="top"
                />
              </div>
            </div>
          )}

          {/* Step 3: Address */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Address</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                <input
                  type="text"
                  name="street"
                  value={formData.street}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isZimbabwe ? 'Province' : 'State / Province / Region'}
                  </label>
                  {isZimbabwe ? (
                    <select
                      name="province"
                      value={formData.province}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
                    >
                      <option value="">Select Province</option>
                      {PROVINCES.map((province: string) => (
                        <option key={province} value={province}>{province}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      name="province"
                      value={formData.province}
                      onChange={handleChange}
                      placeholder="e.g. California, Gauteng, Ontario"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                  <input
                    type="text"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                  <select
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
                  >
                    <option value="">Select Country</option>
                    {COUNTRIES.map((country: string) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>
              </div>
              {formData.country === 'Other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country Name *</label>
                  <input
                    type="text"
                    name="countryOther"
                    value={formData.countryOther}
                    onChange={handleChange}
                    placeholder="Enter your country"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    required
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 4: Banking */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Banking Details</h3>
              <p className="text-sm text-gray-500 mb-4">
                These details will be used for payment processing. Please ensure they are accurate.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                {isZimbabwe ? (
                  <select
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
                  >
                    <option value="">Select Bank</option>
                    {BANKS.map((bank: string) => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleChange}
                    placeholder="Enter your bank name"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    name="accountNumber"
                    value={formData.accountNumber}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isZimbabwe ? 'Branch Code' : 'Branch / SWIFT / Routing Code'}
                  </label>
                  <input
                    type="text"
                    name="branchCode"
                    value={formData.branchCode}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                <select
                  name="accountType"
                  value={formData.accountType}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
                >
                  {ACCOUNT_TYPES.map((type: { value: string; label: string }) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            )}
            {step < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex-1 px-4 py-3 bg-primary hover:bg-primary-dark text-white font-medium rounded-xl transition-colors"
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-3 bg-primary hover:bg-primary-dark text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                {loading ? 'Registering...' : 'Complete Registration'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

