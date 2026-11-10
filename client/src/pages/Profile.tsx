import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { authAPI } from '../lib/api';
import { User, Mail, Phone, Building2, Shield, Save, Loader2, Key, Eye, EyeOff } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SbuSettingsPanel from '../components/SbuSettingsPanel';
import { ACCOUNT_LIMITS, TEXT_LIMITS, validateChangePassword, validateMyProfile } from '@fossil/shared';
import FieldError from '../components/FieldError';
import { useFormValidation } from '../lib/useFormValidation';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState<any>(false);
  const [showPasswordSection, setShowPasswordSection] = useState<any>(false);
  const [formData, setFormData] = useState<any>({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || ''
  });
  const [passwordData, setPasswordData] = useState<any>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState<any>({
    current: false,
    new: false,
    confirm: false
  });

  const profileValues = {
    firstName: formData.firstName,
    lastName: formData.lastName,
    phone: formData.phone
  };
  const profileForm = useFormValidation(
    (values: typeof profileValues) => validateMyProfile(values, { currentPhone: user?.phone || '' }),
    profileValues
  );
  const passwordForm = useFormValidation(validateChangePassword, passwordData);

  const handleUpdateProfile = async (e: any) => {
    e.preventDefault();
    if (!profileForm.check()) return;
    try {
      setLoading(true);
      const response = await authAPI.updateProfile(profileValues);

      if (response.data.success) {
        updateUser(response.data.data);
        showToast('Profile updated successfully', 'success');
      }
    } catch (error: any) {
      if (!profileForm.fromServer(error)) {
        showToast(error.response?.data?.message || 'Failed to update profile', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordSection = () => {
    if (!showPasswordSection) passwordForm.reset();
    setShowPasswordSection(!showPasswordSection);
  };

  const handleChangePassword = async (e: any) => {
    e.preventDefault();
    if (!passwordForm.check()) return;

    try {
      setLoading(true);
      await authAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      showToast('Password changed successfully', 'success');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordSection(false);
    } catch (error: any) {
      if (!passwordForm.fromServer(error)) {
        showToast(error.response?.data?.message || 'Failed to change password', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const getRoleDisplayName = (role: any) => {
    const names: any = {
      admin: 'System Administrator',
      procurement_officer: 'Procurement Officer',
      department_head: 'Department Head',
      finance: 'Finance Manager',
      coo: 'Chief Operating Officer',
      stores_officer: 'Stores Officer',
      supplier: 'Supplier'
    };
    return names[role] || role;
  };

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader title="My Profile" subtitle="Manage your account settings" />

      {/* Profile Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
          <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center">
            <span className="text-3xl font-bold text-primary">
              {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{user?.firstName} {user?.lastName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm text-gray-600">{getRoleDisplayName(user?.role)}</span>
            </div>
          </div>
        </div>

        <form ref={profileForm.formRef} onSubmit={handleUpdateProfile} noValidate className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="h-4 w-4 inline mr-2" />
                First Name
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e: any) => setFormData({ ...formData, firstName: e.target.value })}
                maxLength={TEXT_LIMITS.name}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                {...profileForm.invalid('firstName')}
              />
              <FieldError message={profileForm.errors.firstName} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="h-4 w-4 inline mr-2" />
                Last Name
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e: any) => setFormData({ ...formData, lastName: e.target.value })}
                maxLength={TEXT_LIMITS.name}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                {...profileForm.invalid('lastName')}
              />
              <FieldError message={profileForm.errors.lastName} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="h-4 w-4 inline mr-2" />
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
              />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="h-4 w-4 inline mr-2" />
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e: any) => setFormData({ ...formData, phone: e.target.value })}
                maxLength={TEXT_LIMITS.phone}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="+263 77 123 4567"
                {...profileForm.invalid('phone')}
              />
              <FieldError message={profileForm.errors.phone} />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-colors"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <button
          onClick={togglePasswordSection}
          className="flex items-center gap-2 text-gray-700 font-medium"
        >
          <Key className="h-5 w-5" />
          Change Password
        </button>

        {showPasswordSection && (
          <form ref={passwordForm.formRef} onSubmit={handleChangePassword} noValidate className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
              <div className="relative">
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  value={passwordData.currentPassword}
                  onChange={(e: any) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  maxLength={ACCOUNT_LIMITS.existingPassword}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary pr-10"
                  {...passwordForm.invalid('currentPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <FieldError message={passwordForm.errors.currentPassword} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
              <div className="relative">
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e: any) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  maxLength={ACCOUNT_LIMITS.password}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary pr-10"
                  {...passwordForm.invalid('newPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <FieldError message={passwordForm.errors.newPassword} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e: any) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  maxLength={ACCOUNT_LIMITS.password}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary pr-10"
                  {...passwordForm.invalid('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <FieldError message={passwordForm.errors.confirmPassword} />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPasswordSection(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                Update Password
              </button>
            </div>
          </form>
        )}
      </div>

      {user?.role === 'admin' && <SbuSettingsPanel />}
    </div>
  );
}

