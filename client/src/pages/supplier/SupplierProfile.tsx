import React, { useState, useEffect } from 'react';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';
import { 
  Building2, Mail, Phone, MapPin, FileText, 
  Save, Loader2, Upload, CheckCircle, AlertCircle, Shield
} from 'lucide-react';
import { PROVINCES, BANKS, SUPPLIER_CATEGORIES } from '../../lib/constants';
import PageHeader from '../../components/PageHeader';

export default function SupplierProfile() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState<any>(true);
  const [saving, setSaving] = useState<any>(false);
  // Banking is only submitted when actually touched: any change raises a
  // verification-and-approval request rather than saving straight through.
  const [bankDirty, setBankDirty] = useState(false);
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

  const fetchProfile = async () => {
    try {
      setLoading(true);
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

  const handleSave = async () => {
    try {
      setSaving(true);
      // Send only what the server accepts. Posting the whole profile made the
      // form look like it saved company name, registration number and so on,
      // which the controller ignores — the values silently reverted on reload.
      const payload: any = {
        tradingName: profile.tradingName,
        address: profile.address,
        contactPersons: profile.contactPersons,
        categories: profile.categories
      };
      if (bankDirty) payload.bankDetails = profile.bankDetails;

      const response = await api.put('/supplier/profile', payload);
      if (response.data.success) {
        if (response.data.bankChangePending) {
          setBankDirty(false);
          showToast(
            'Profile saved. Your banking change needs verification and approval before it takes effect.',
            'success'
          );
        } else {
          showToast('Profile updated successfully', 'success');
        }
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryChange = (category: any) => {
    const current = profile.categories || [];
    if (current.includes(category)) {
      setProfile({ ...profile, categories: current.filter((c: any) => c !== category) });
    } else {
      setProfile({ ...profile, categories: [...current, category] });
    }
  };

  const getStatusBadge = () => {
    // Must match the SupplierProfile status enum: pending | active | suspended
    // | blacklisted | dormant. 'approved' is not a member, and because it was
    // the only success case, active suppliers previously showed no badge.
    switch (profile.status) {
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
            <span className="font-medium">Pending Approval</span>
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Company Profile"
        subtitle="Manage your supplier information"
        actions={getStatusBadge()}
      />

      <div className="space-y-6">
        {/* Company Information */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Company Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              />
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
                  contacts[0] = { ...(contacts[0] || { isPrimary: true }), name: e.target.value };
                  setProfile({ ...profile, contactPersons: contacts });
                }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
              {/* Login email lives on the User record, not the supplier profile. */}
              <input
                type="email"
                value={profile.contactPersons?.[0]?.email || profile.user?.email || ''}
                disabled
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input
                type="tel"
                value={profile.contactPersons?.[0]?.phone || ''}
                onChange={(e: any) => {
                  const contacts = [...(profile.contactPersons || [])];
                  contacts[0] = { ...(contacts[0] || { isPrimary: true }), phone: e.target.value };
                  setProfile({ ...profile, contactPersons: contacts });
                }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="+263 77 123 4567"
              />
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
                value={profile.address?.physical || ''}
                onChange={(e: any) => setProfile({ ...profile, address: { ...profile.address, street: e.target.value } })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
              <input
                type="text"
                value={profile.address?.city || ''}
                onChange={(e: any) => setProfile({ ...profile, address: { ...profile.address, city: e.target.value } })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Province</label>
              <select
                value={profile.address?.province || ''}
                onChange={(e: any) => setProfile({ ...profile, address: { ...profile.address, province: e.target.value } })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Select Province</option>
                {PROVINCES.map((province: any) => (
                  <option key={province} value={province}>{province}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Service Categories
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {SUPPLIER_CATEGORIES.map((category: any) => (
              <label
                key={category}
                className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                  profile.categories?.includes(category)
                    ? 'bg-primary/5 border-primary text-primary'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={profile.categories?.includes(category)}
                  onChange={() => handleCategoryChange(category)}
                  className="sr-only"
                />
                <span className="text-sm font-medium">{category}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Bank Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Bank Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
              <select
                value={profile.bankDetails?.bankName || ''}
                onChange={(e: any) => { setBankDirty(true); setProfile({ ...profile, bankDetails: { ...profile.bankDetails, bankName: e.target.value } }); }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Select Bank</option>
                {BANKS.map((bank: any) => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Name</label>
              <input
                type="text"
                value={profile.bankDetails?.accountName || ''}
                onChange={(e: any) => { setBankDirty(true); setProfile({ ...profile, bankDetails: { ...profile.bankDetails, accountName: e.target.value } }); }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
              <input
                type="text"
                value={profile.bankDetails?.accountNumber || ''}
                onChange={(e: any) => { setBankDirty(true); setProfile({ ...profile, bankDetails: { ...profile.bankDetails, accountNumber: e.target.value } }); }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Branch Code</label>
              <input
                type="text"
                value={profile.bankDetails?.branchCode || ''}
                onChange={(e: any) => { setBankDirty(true); setProfile({ ...profile, bankDetails: { ...profile.bankDetails, branchCode: e.target.value } }); }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-colors"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

