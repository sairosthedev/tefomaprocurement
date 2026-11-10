import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import { Building2, ArrowLeft } from 'lucide-react';
import Logo from '../components/Logo';
import { CategoryMultiSelect } from '../components/CategorySelect';
import { PROVINCES, COUNTRIES, BANKS, ACCOUNT_TYPES } from '../lib/constants';
import { FormSteps, FormStepNav } from '../components/FormSteps';
import {
  BUSINESS_TYPE_OPTIONS,
  ENTITY_TYPE_OPTIONS,
  businessTypeLabel,
  entityTypeLabel
} from '../lib/supplierTypes';
import { validateSupplierRegistration, type FieldErrors } from '@fossil/shared';
import FieldError from '../components/FieldError';
import { serverFieldErrors, useFormValidation } from '../lib/useFormValidation';

const STEPS = [
  { label: 'Account', description: 'Who is signing up' },
  { label: 'Company', description: 'Registration and categories' },
  { label: 'Address', description: 'Where you operate' },
  { label: 'Banking', description: 'Where you are paid' },
  { label: 'Review', description: 'Check, then register' }
];

/** The fields on each step: Next checks its own, and a problem found later opens its step. */
const STEP_FIELDS: string[][] = [
  ['firstName', 'lastName', 'email', 'phone', 'password', 'confirmPassword'],
  ['companyName', 'tradingName', 'registrationNumber', 'vatNumber', 'businessType', 'entityType', 'categories'],
  ['street', 'city', 'province', 'postalCode', 'country', 'countryOther'],
  ['bankName', 'accountName', 'accountNumber', 'branchCode', 'accountType'],
  []
];

/** The earliest step (1-based) holding one of these fields, or 0 when none is on a step. */
function firstStepWith(errors: FieldErrors): number {
  const steps = Object.keys(errors)
    .map((field) => STEP_FIELDS.findIndex((fields) => fields.includes(field)) + 1)
    .filter((n) => n > 0);
  return steps.length ? Math.min(...steps) : 0;
}

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
    // Optional descriptions of the business
    businessType: '',
    entityType: '',
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

  /** What is sent to register. */
  const toPayload = (values: any) => ({
    email: values.email,
    password: values.password,
    firstName: values.firstName,
    lastName: values.lastName,
    phone: values.phone.trim(),
    role: 'supplier',
    companyDetails: {
      companyName: values.companyName,
      tradingName: values.tradingName,
      registrationNumber: values.registrationNumber,
      vatNumber: values.vatNumber,
      businessType: values.businessType || undefined,
      entityType: values.entityType || undefined,
      address: {
        street: values.street,
        city: values.city,
        province: values.province,
        postalCode: values.postalCode,
        country: values.country === 'Other' ? values.countryOther.trim() : values.country
      },
      bankDetails: {
        bankName: values.bankName,
        accountNumber: values.accountNumber,
        branchCode: values.branchCode,
        accountType: values.accountType
      },
      categories: values.categories
    }
  });

  /** Every problem with the form: the payload, plus what only the screen asks (confirmation, the "Other" country). */
  const allErrors = (values: any) => {
    const payload = toPayload(values);
    return validateSupplierRegistration(
      {
        ...payload,
        confirmPassword: values.confirmPassword,
        countryOther: values.countryOther,
        companyDetails: { ...payload.companyDetails, address: { ...payload.companyDetails.address, country: values.country } }
      },
      { requireCountry: true }
    );
  };

  // Next checks the step on screen; Register, on the review step, checks them all.
  const validation = useFormValidation((values: any) => {
    const errors = allErrors(values);
    if (step >= STEPS.length) return errors;
    const fields = STEP_FIELDS[step - 1];
    return Object.fromEntries(Object.entries(errors).filter(([field]) => fields.includes(field)));
  }, formData);

  const goToStep = (next: number) => {
    validation.reset();
    setStep(next);
  };

  const nextStep = () => {
    if (!validation.check()) return;
    goToStep(Math.min(step + 1, STEPS.length));
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const prevStep = () => {
    goToStep(step - 1);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    // Enter in a field before the review step moves on; only the last step registers.
    if (step < STEPS.length) {
      nextStep();
      return;
    }
    if (!validation.check()) {
      // Open the step holding the first problem; its messages show there.
      const target = firstStepWith(allErrors(formData));
      if (target) setStep(target);
      return;
    }

    setLoading(true);

    try {
      await authAPI.register(toPayload(formData));

      setSuccess(true);
    } catch (err: any) {
      const fields = serverFieldErrors(err);
      const target = fields ? firstStepWith(fields) : 0;
      if (target && validation.fromServer(err)) {
        setStep(target);
      } else {
        showToast(err.response?.data?.message || 'Registration failed. Please try again.', 'error', 5000);
      }
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
            to="/"
            className="inline-flex items-center justify-center w-full px-4 py-3 bg-primary hover:bg-primary-dark text-white font-medium rounded-xl transition-colors"
          >
            Go to Sign In
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
                Register your company to supply the group's businesses on Procureline
              </p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="px-8 pt-6">
          <FormSteps steps={STEPS} current={step - 1} onSelect={(i) => goToStep(i + 1)} />
        </div>

        {/* Form */}
        <form ref={validation.formRef} onSubmit={handleSubmit} noValidate className="p-8">

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
                    maxLength={120}
                    {...validation.invalid('firstName')}
                  />
                  <FieldError message={validation.errors.firstName} />
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
                    maxLength={120}
                    {...validation.invalid('lastName')}
                  />
                  <FieldError message={validation.errors.lastName} />
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
                  maxLength={254}
                  {...validation.invalid('email')}
                />
                <FieldError message={validation.errors.email} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  required
                  maxLength={30}
                  {...validation.invalid('phone')}
                />
                <FieldError message={validation.errors.phone} />
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none pr-16"
                      required
                      {...validation.invalid('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors rounded px-2 py-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? 'HIDE' : 'SHOW'}
                    </button>
                  </div>
                  <FieldError message={validation.errors.password} />
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
                    {...validation.invalid('confirmPassword')}
                  />
                  <FieldError message={validation.errors.confirmPassword} />
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
                  maxLength={200}
                  {...validation.invalid('companyName')}
                />
                <FieldError message={validation.errors.companyName} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trading Name (if different)</label>
                <input
                  type="text"
                  name="tradingName"
                  value={formData.tradingName}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  maxLength={200}
                  {...validation.invalid('tradingName')}
                />
                <FieldError message={validation.errors.tradingName} />
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
                    maxLength={50}
                    {...validation.invalid('registrationNumber')}
                  />
                  <FieldError message={validation.errors.registrationNumber} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">VAT Number</label>
                  <input
                    type="text"
                    name="vatNumber"
                    value={formData.vatNumber}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    maxLength={50}
                    {...validation.invalid('vatNumber')}
                  />
                  <FieldError message={validation.errors.vatNumber} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
                  <select
                    name="businessType"
                    value={formData.businessType}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
                    {...validation.invalid('businessType')}
                  >
                    <option value="">Select (optional)</option>
                    {BUSINESS_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <FieldError message={validation.errors.businessType} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
                  <select
                    name="entityType"
                    value={formData.entityType}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
                    {...validation.invalid('entityType')}
                  >
                    <option value="">Select (optional)</option>
                    {ENTITY_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <FieldError message={validation.errors.entityType} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product/Service Categories</label>
                <CategoryMultiSelect
                  value={formData.categories}
                  onChange={(codes) => setFormData((prev: any) => ({ ...prev, categories: codes }))}
                  placeholder="Select categories your company supplies…"
                  placement="top"
                  invalid={!!validation.errors.categories}
                />
                <FieldError message={validation.errors.categories} />
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
                  maxLength={200}
                  {...validation.invalid('street')}
                />
                <FieldError message={validation.errors.street} />
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
                    maxLength={80}
                    {...validation.invalid('city')}
                  />
                  <FieldError message={validation.errors.city} />
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
                      {...validation.invalid('province')}
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
                      maxLength={80}
                      {...validation.invalid('province')}
                    />
                  )}
                  <FieldError message={validation.errors.province} />
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
                    maxLength={20}
                    {...validation.invalid('postalCode')}
                  />
                  <FieldError message={validation.errors.postalCode} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                  <select
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
                    {...validation.invalid('country')}
                  >
                    <option value="">Select Country</option>
                    {COUNTRIES.map((country: string) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                  <FieldError message={validation.errors.country} />
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
                    maxLength={80}
                    {...validation.invalid('countryOther')}
                  />
                  <FieldError message={validation.errors.countryOther} />
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
                    {...validation.invalid('bankName')}
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
                    maxLength={120}
                    {...validation.invalid('bankName')}
                  />
                )}
                <FieldError message={validation.errors.bankName} />
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
                    maxLength={42}
                    {...validation.invalid('accountNumber')}
                  />
                  <FieldError message={validation.errors.accountNumber} />
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
                    maxLength={40}
                    {...validation.invalid('branchCode')}
                  />
                  <FieldError message={validation.errors.branchCode} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                <select
                  name="accountType"
                  value={formData.accountType}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
                  {...validation.invalid('accountType')}
                >
                  {ACCOUNT_TYPES.map((type: { value: string; label: string }) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <FieldError message={validation.errors.accountType} />
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Review your registration</h3>
              {[
                {
                  title: 'Account',
                  to: 1,
                  rows: [
                    ['Name', `${formData.firstName} ${formData.lastName}`.trim()],
                    ['Email', formData.email],
                    ['Phone', formData.phone]
                  ]
                },
                {
                  title: 'Company',
                  to: 2,
                  rows: [
                    ['Company name', formData.companyName],
                    ['Trading name', formData.tradingName],
                    ['Registration number', formData.registrationNumber],
                    ['VAT number', formData.vatNumber],
                    ['Business type', businessTypeLabel(formData.businessType)],
                    ['Entity type', entityTypeLabel(formData.entityType)],
                    ['Categories', formData.categories.length ? `${formData.categories.length} selected` : '']
                  ]
                },
                {
                  title: 'Address',
                  to: 3,
                  rows: [
                    ['Street', formData.street],
                    ['City', formData.city],
                    ['Province / state', formData.province],
                    ['Country', resolvedCountry()]
                  ]
                },
                {
                  title: 'Banking',
                  to: 4,
                  rows: [
                    ['Bank', formData.bankName],
                    // Only the last digits, as everywhere else the number is shown.
                    ['Account number', formData.accountNumber ? `•••• ${formData.accountNumber.slice(-4)}` : ''],
                    ['Branch code', formData.branchCode],
                    ['Account type', ACCOUNT_TYPES.find((t: any) => t.value === formData.accountType)?.label || formData.accountType]
                  ]
                }
              ].map((section) => (
                <div key={section.title} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-900">{section.title}</p>
                    <button type="button" onClick={() => goToStep(section.to)} className="text-sm font-medium text-primary hover:underline">
                      Edit
                    </button>
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {section.rows.map(([label, value]) => (
                      <div key={label} className="flex gap-2">
                        <dt className="text-gray-500">{label}:</dt>
                        <dd className="text-gray-900 truncate">{value || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
              <p className="text-sm text-gray-500">
                After registering, upload your compliance documents. Your account is activated once Procurement has verified and approved them.
              </p>
            </div>
          )}

          <FormStepNav
            current={step - 1}
            total={STEPS.length}
            onBack={prevStep}
            onNext={nextStep}
            finishLabel={loading ? 'Registering...' : 'Complete Registration'}
            submitting={loading}
          />
        </form>
      </div>
    </div>
  );
}

