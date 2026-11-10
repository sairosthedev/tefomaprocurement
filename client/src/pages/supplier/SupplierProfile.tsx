import React, { useState, useEffect } from 'react';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';
import { 
  Building2, Mail, Phone, MapPin, FileText, 
  Save, Loader2, Upload, CheckCircle, AlertCircle, Shield
} from 'lucide-react';
import { PROVINCES, BANKS } from '../../lib/constants';
import PageHeader from '../../components/PageHeader';
import { CategoryMultiSelect } from '../../components/CategorySelect';
import { BUSINESS_TYPE_OPTIONS, ENTITY_TYPE_OPTIONS } from '../../lib/supplierTypes';
import { firstError, validateSupplierProfileUpdate, type FieldErrors } from '@fossil/shared';
import FieldError from '../../components/FieldError';
import { serverFieldErrors, useFormValidation } from '../../lib/useFormValidation';
import { useAuth } from '../../context/AuthContext';

/** Where a requested banking change stands, in the supplier's terms. */
const BANK_CHANGE_STATUS: Record<string, string> = {
  pending_verification: 'Waiting for our call-back to confirm the change',
  pending_approval: 'Confirmed by phone; waiting for final approval',
  approved: 'Approved: payments now go to the new account',
  rejected: 'Not approved: payments still go to your previous account',
  cancelled: 'Cancelled'
};

export default function SupplierProfile() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState<any>(true);
  const [saving, setSaving] = useState<any>(false);
  // Banking is only submitted when actually touched: any change raises a
  // verification-and-approval request rather than saving straight through.
  const [bankDirty, setBankDirty] = useState(false);
  // Categories are sent only when edited, so a profile still holding older
  // free-text values (which the server rejects) can save its other sections.
  const [categoriesDirty, setCategoriesDirty] = useState(false);
  const [profile, setProfile] = useState<any>({
    companyName: '',
    // Schema field is `tradingName`; `tradingAs` was silently discarded.
    tradingName: '',
    registrationNumber: '',
    taxNumber: '',
    vatNumber: '',
    contactPersons: [],
    address: {
      // Schema field is `street`; `physical` was silently discarded.
      street: '',
      city: '',
      province: '',
      postalCode: ''
    },
    categories: [],
    bankDetails: {
      bankName: '',
      accountName: '',
      accountNumber: '',
      branchCode: ''
    },
    status: 'pending'
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  // `quiet` refreshes in place, without the full-page loader.
  const fetchProfile = async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      const response = await api.get('/supplier/profile');
      if (response.data.success && response.data.data) {
        setProfile(response.data.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // Send only what the server accepts. Posting the whole profile made the
  // form look like it saved company name, registration number and so on,
  // which the controller ignores — the values silently reverted on reload.
  const toPayload = (values: any) => {
    const payload: any = {
      tradingName: values.tradingName,
      address: values.address,
      contactPersons: values.contactPersons,
      // Optional; an empty choice clears it.
      businessType: values.businessType ?? undefined,
      entityType: values.entityType ?? undefined
    };
    if (categoriesDirty) payload.categories = values.categories;
    if (bankDirty) payload.bankDetails = values.bankDetails;
    return payload;
  };

  // The checks the API runs on the same payload; a banking change is checked before it is requested.
  const validation = useFormValidation(
    (values: any) => validateSupplierProfileUpdate(toPayload(values), { country: values.address?.country }),
    profile
  );

  /** A problem on a field this page does not show (a second contact, say) is said in a toast instead. */
  const sayHiddenProblem = (errors: FieldErrors | null) => {
    setTimeout(() => {
      if (errors && !validation.formRef.current?.querySelector('[aria-invalid="true"]')) {
        showToast(firstError(errors), 'error');
      }
    }, 0);
  };

  const handleSave = async () => {
    if (!validation.check()) {
      sayHiddenProblem(validateSupplierProfileUpdate(toPayload(profile), { country: profile.address?.country }));
      return;
    }
    try {
      setSaving(true);
      const payload = toPayload(profile);

      const response = await api.put('/supplier/profile', payload);
      if (response.data.success) {
        setCategoriesDirty(false);
        if (response.data.bankChangePending) {
          setBankDirty(false);
          fetchProfile(true);
          showToast(
            'Profile saved. Your banking change needs verification and approval before it takes effect.',
            'success'
          );
        } else {
          showToast('Profile updated successfully', 'success');
        }
      }
    } catch (error: any) {
      if (validation.fromServer(error)) {
        sayHiddenProblem(serverFieldErrors(error));
      } else {
        showToast(error.response?.data?.message || 'Failed to update profile', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = () => {
    // Must match the SupplierProfile status enum: pending | active | suspended
    // | blacklisted | dormant | rejected. 'approved' is not a member, and
    // because it was the only success case, active suppliers previously
    // showed no badge.
    switch (profile.status) {
      case 'rejected':
        return (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-xl">
            <Shield className="h-5 w-5" />
            <span className="font-medium">Registration Not Approved</span>
          </div>
        );
      case 'active':
        return (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Approved Supplier</span>
          </div>
        );
      case 'suspended':
        return (
          <div className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-xl">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Suspended</span>
          </div>
        );
      case 'dormant':
        return (
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Dormant</span>
          </div>
        );
      case 'pending':
        return (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-xl">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">{profile.activationPending ? 'With Procurement for Approval' : 'Pending Approval'}</span>
          </div>
        );
      case 'blacklisted':
        return (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-xl">
            <Shield className="h-5 w-5" />
            <span className="font-medium">Blacklisted</span>
          </div>
        );
      default:
        return null;
    }
  };

  /** The first contact, when the profile has none: it carries the sign-in email, as the page shows. */
  const newPrimaryContact = () => ({ isPrimary: true, email: user?.email || '' });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        title="Company Profile"
        subtitle="Manage your supplier information"
        actions={getStatusBadge()}
      />

      {profile.status === 'rejected' && (
        <div className="mb-6 flex items-start gap-2 p-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Your supplier registration was not approved.
            {profile.rejectionReason ? ` Reason: ${profile.rejectionReason}.` : ''} Contact procurement if you have any questions.
          </span>
        </div>
      )}

      <div ref={validation.formRef} className="space-y-6">
        {/* Company Information */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Company Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Supplier Code</label>
              {/* Assigned by the system and permanent; quote it to procurement. */}
              <input
                type="text"
                value={profile.supplierCode || 'Not yet assigned'}
                readOnly
                title="Your permanent supplier number on our register"
                className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 text-gray-600 rounded-xl cursor-not-allowed font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
              {/* Read-only: the registered identity is changed by procurement,
                  not self-service. It used to look editable and silently revert. */}
              <input
                type="text"
                value={profile.companyName || ''}
                readOnly
                title="Contact procurement to change your registered company name"
                className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 text-gray-600 rounded-xl cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Trading As</label>
              <input
                type="text"
                value={profile.tradingName || ''}
                onChange={(e: any) => setProfile({ ...profile, tradingName: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                maxLength={200}
                {...validation.invalid('tradingName')}
              />
              <FieldError message={validation.errors.tradingName} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Registration Number</label>
              <input
                type="text"
                value={profile.registrationNumber || ''}
                readOnly
                title="Contact procurement to change your registration number"
                className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 text-gray-600 rounded-xl cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tax Number (TIN)</label>
              <input
                type="text"
                value={profile.taxNumber || ''}
                readOnly
                title="Contact procurement to change your tax number"
                className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 text-gray-600 rounded-xl cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">VAT Number</label>
              <input
                type="text"
                value={profile.vatNumber || ''}
                readOnly
                title="Contact procurement to change your VAT number"
                className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 text-gray-600 rounded-xl cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Business Type</label>
              <select
                value={profile.businessType || ''}
                onChange={(e: any) => setProfile({ ...profile, businessType: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                {...validation.invalid('businessType')}
              >
                <option value="">Not specified</option>
                {BUSINESS_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <FieldError message={validation.errors.businessType} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Entity Type</label>
              <select
                value={profile.entityType || ''}
                onChange={(e: any) => setProfile({ ...profile, entityType: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                {...validation.invalid('entityType')}
              >
                <option value="">Not specified</option>
                {ENTITY_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <FieldError message={validation.errors.entityType} />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Contact Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person *</label>
              {/* The primary contact lives in contactPersons[]; a flat
                  `contactPerson` field does not exist on the profile and was
                  discarded on save. */}
              <input
                type="text"
                value={profile.contactPersons?.[0]?.name || ''}
                onChange={(e: any) => {
                  const contacts = [...(profile.contactPersons || [])];
                  contacts[0] = { ...(contacts[0] || newPrimaryContact()), name: e.target.value };
                  setProfile({ ...profile, contactPersons: contacts });
                }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                maxLength={120}
                {...validation.invalid('contactPersons.0.name')}
              />
              <FieldError message={validation.errors['contactPersons.0.name']} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
              {/* Login email lives on the User record, not the supplier profile. */}
              <input
                type="email"
                value={profile.contactPersons?.[0]?.email || profile.user?.email || user?.email || ''}
                disabled
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                {...validation.invalid('contactPersons.0.email')}
              />
              <FieldError message={validation.errors['contactPersons.0.email']} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
              <input
                type="tel"
                value={profile.contactPersons?.[0]?.phone || ''}
                onChange={(e: any) => {
                  const contacts = [...(profile.contactPersons || [])];
                  contacts[0] = { ...(contacts[0] || newPrimaryContact()), phone: e.target.value };
                  setProfile({ ...profile, contactPersons: contacts });
                }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="+263 77 123 4567"
                maxLength={30}
                {...validation.invalid('contactPersons.0.phone')}
              />
              <FieldError message={validation.errors['contactPersons.0.phone']} />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Address
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Physical Address</label>
              <input
                type="text"
                value={profile.address?.street || profile.address?.physical || ''}
                onChange={(e: any) => setProfile({ ...profile, address: { ...profile.address, street: e.target.value } })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                maxLength={200}
                {...validation.invalid('address.street')}
              />
              <FieldError message={validation.errors['address.street']} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
              <input
                type="text"
                value={profile.address?.city || ''}
                onChange={(e: any) => setProfile({ ...profile, address: { ...profile.address, city: e.target.value } })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                maxLength={80}
                {...validation.invalid('address.city')}
              />
              <FieldError message={validation.errors['address.city']} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Province</label>
              <select
                value={profile.address?.province || ''}
                onChange={(e: any) => setProfile({ ...profile, address: { ...profile.address, province: e.target.value } })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                {...validation.invalid('address.province')}
              >
                <option value="">Select Province</option>
                {PROVINCES.map((province: any) => (
                  <option key={province} value={province}>{province}</option>
                ))}
              </select>
              <FieldError message={validation.errors['address.province']} />
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Service Categories
          </h2>
          
          {/* The same picker as registration and Add Supplier: categories are
              stored as codes, which the old name grid never matched, so nothing
              showed as ticked and any tick made the save fail. */}
          <CategoryMultiSelect
            value={Array.isArray(profile.categories) ? profile.categories : []}
            onChange={(codes) => {
              setCategoriesDirty(true);
              setProfile({ ...profile, categories: codes });
            }}
            placeholder="Select the categories you supply…"
            invalid={!!validation.errors.categories}
          />
          <FieldError message={validation.errors.categories} />
          <p className="text-xs text-gray-400 mt-2">Used to match you to RFQs in these categories.</p>
        </div>

        {/* Bank Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Bank Details</h2>

          {/* A recent banking change: where it stands, so a supplier knows
              which account they will be paid into. */}
          {profile.bankChangeRequest && (
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-1">Your latest banking change</p>
              <p className="text-sm text-gray-600">
                {BANK_CHANGE_STATUS[profile.bankChangeRequest.status] || profile.bankChangeRequest.status}
                {profile.bankChangeRequest.requestedAt &&
                  ` · requested ${new Date(profile.bankChangeRequest.requestedAt).toLocaleDateString('en-ZA')}`}
              </p>
              {profile.bankChangeRequest.rejectionReason && (
                <p className="text-sm text-red-700 mt-1">Reason: {profile.bankChangeRequest.rejectionReason}</p>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
              <select
                value={profile.bankDetails?.bankName || ''}
                onChange={(e: any) => { setBankDirty(true); setProfile({ ...profile, bankDetails: { ...profile.bankDetails, bankName: e.target.value } }); }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                {...validation.invalid('bankDetails.bankName')}
              >
                <option value="">Select Bank</option>
                {BANKS.map((bank: any) => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>
              <FieldError message={validation.errors['bankDetails.bankName']} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Name</label>
              <input
                type="text"
                value={profile.bankDetails?.accountName || ''}
                onChange={(e: any) => { setBankDirty(true); setProfile({ ...profile, bankDetails: { ...profile.bankDetails, accountName: e.target.value } }); }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                maxLength={200}
                {...validation.invalid('bankDetails.accountName')}
              />
              <FieldError message={validation.errors['bankDetails.accountName']} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
              <input
                type="text"
                value={profile.bankDetails?.accountNumber || ''}
                onChange={(e: any) => { setBankDirty(true); setProfile({ ...profile, bankDetails: { ...profile.bankDetails, accountNumber: e.target.value } }); }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                maxLength={42}
                {...validation.invalid('bankDetails.accountNumber')}
              />
              <FieldError message={validation.errors['bankDetails.accountNumber']} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Branch Code</label>
              <input
                type="text"
                value={profile.bankDetails?.branchCode || ''}
                onChange={(e: any) => { setBankDirty(true); setProfile({ ...profile, bankDetails: { ...profile.bankDetails, branchCode: e.target.value } }); }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                maxLength={40}
                {...validation.invalid('bankDetails.branchCode')}
              />
              <FieldError message={validation.errors['bankDetails.branchCode']} />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

