import React, { useState, useEffect } from 'react';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';
import { 
  Building2, Mail, Phone, MapPin, FileText, 
  Save, Loader2, Upload, CheckCircle, AlertCircle, Shield
} from 'lucide-react';
import { PROVINCES, BANKS, SUPPLIER_CATEGORIES } from '../../lib/constants';

export default function SupplierProfile() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    companyName: '',
    tradingAs: '',
    registrationNumber: '',
    taxNumber: '',
    vatNumber: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: {
      physical: '',
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
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await api.put('/supplier/profile', profile);
      if (response.data.success) {
        showToast('Profile updated successfully', 'success');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryChange = (category) => {
    const current = profile.categories || [];
    if (current.includes(category)) {
      setProfile({ ...profile, categories: current.filter(c => c !== category) });
    } else {
      setProfile({ ...profile, categories: [...current, category] });
    }
  };

  const getStatusBadge = () => {
    switch (profile.status) {
      case 'approved':
        return (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Approved Supplier</span>
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Profile</h1>
          <p className="text-gray-500 mt-1">Manage your supplier information</p>
        </div>
        {getStatusBadge()}
      </div>

      <div className="space-y-6">
        {/* Company Information */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Company Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Company Name *</label>
              <input
                type="text"
                value={profile.companyName}
                onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Trading As</label>
              <input
                type="text"
                value={profile.tradingAs || ''}
                onChange={(e) => setProfile({ ...profile, tradingAs: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Registration Number</label>
              <input
                type="text"
                value={profile.registrationNumber || ''}
                onChange={(e) => setProfile({ ...profile, registrationNumber: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tax Number (TIN)</label>
              <input
                type="text"
                value={profile.taxNumber || ''}
                onChange={(e) => setProfile({ ...profile, taxNumber: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">VAT Number</label>
              <input
                type="text"
                value={profile.vatNumber || ''}
                onChange={(e) => setProfile({ ...profile, vatNumber: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
              <input
                type="text"
                value={profile.contactPerson}
                onChange={(e) => setProfile({ ...profile, contactPerson: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input
                type="tel"
                value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
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
                onChange={(e) => setProfile({ ...profile, address: { ...profile.address, physical: e.target.value } })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
              <input
                type="text"
                value={profile.address?.city || ''}
                onChange={(e) => setProfile({ ...profile, address: { ...profile.address, city: e.target.value } })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Province</label>
              <select
                value={profile.address?.province || ''}
                onChange={(e) => setProfile({ ...profile, address: { ...profile.address, province: e.target.value } })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Select Province</option>
                {PROVINCES.map(province => (
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
            {SUPPLIER_CATEGORIES.map(category => (
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
                onChange={(e) => setProfile({ ...profile, bankDetails: { ...profile.bankDetails, bankName: e.target.value } })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Select Bank</option>
                {BANKS.map(bank => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Name</label>
              <input
                type="text"
                value={profile.bankDetails?.accountName || ''}
                onChange={(e) => setProfile({ ...profile, bankDetails: { ...profile.bankDetails, accountName: e.target.value } })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
              <input
                type="text"
                value={profile.bankDetails?.accountNumber || ''}
                onChange={(e) => setProfile({ ...profile, bankDetails: { ...profile.bankDetails, accountNumber: e.target.value } })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Branch Code</label>
              <input
                type="text"
                value={profile.bankDetails?.branchCode || ''}
                onChange={(e) => setProfile({ ...profile, bankDetails: { ...profile.bankDetails, branchCode: e.target.value } })}
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

