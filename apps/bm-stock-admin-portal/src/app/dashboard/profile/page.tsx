'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, User } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  User as UserIcon,
  Mail,
  Phone,
  Shield,
  Calendar,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  Building2,
  Clock,
  Activity,
  Timer,
  LogOut,
} from 'lucide-react';

export default function AdminProfilePage() {
  const { user, token, login, logout, session } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Editable fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Password change
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/users/me');
      setProfile(data);
      setFirstName(data.firstName || '');
      setLastName(data.lastName || '');
      setEmail(data.email || '');
      setPhone(data.phone || '');
    } catch {
      setErrorMsg('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    setSaving(true);

    try {
      const updated = await api.patch('/users/me', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
      });

      // Update local auth context with new user data
      const updatedUser: User = {
        ...profile!,
        firstName: updated.firstName || firstName.trim(),
        lastName: updated.lastName || lastName.trim(),
        email: updated.email || email.trim(),
        phone: updated.phone || phone.trim(),
      };
      setProfile(updatedUser);
      if (token) {
        login(token, updatedUser);
      }
      setSuccessMsg('Profile updated successfully');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update profile');
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordSaving(true);
    try {
      await api.patch('/users/me', {
        currentPassword: currentPassword,
        password: newPassword,
      });
      setPasswordSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
      setTimeout(() => setPasswordSuccess(''), 4000);
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to change password');
      setTimeout(() => setPasswordError(''), 5000);
    } finally {
      setPasswordSaving(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#025EA7] animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Loading profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Profile</h1>
        <p className="text-sm text-slate-500 mt-1">
          View and manage your administrator account details
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Profile Banner */}
        <div className="h-28 bg-gradient-to-br from-[#025EA7] via-[#0373C8] to-[#38BDF8] relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoLTZWMjhoNnYtNmg2djZoNnY2aC02eiIvPjwvZz48L2c+PC9zdmc+')] opacity-40"></div>
        </div>

        {/* Avatar & Name */}
        <div className="px-8 pb-6 -mt-12 relative">
          <div className="flex items-end space-x-5">
            <div className="w-24 h-24 bg-[#025EA7] rounded-2xl flex items-center justify-center text-3xl font-bold text-white shadow-xl ring-4 ring-white">
              {profile?.firstName?.charAt(0) || 'A'}
              {profile?.lastName?.charAt(0) || ''}
            </div>
            <div className="pb-1">
              <h2 className="text-xl font-bold text-slate-900">
                {profile?.firstName} {profile?.lastName}
              </h2>
              <div className="flex items-center space-x-3 mt-1">
                <span className="inline-flex items-center px-2.5 py-0.5 bg-blue-50 text-[#025EA7] text-xs font-semibold rounded-full border border-blue-100">
                  <Shield className="w-3 h-3 mr-1" />
                  {profile?.role || 'ADMIN'}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                  profile?.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {profile?.status || 'ACTIVE'}
                </span>
              </div>
            </div>
          </div>

          {/* Account Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <Mail className="w-4 h-4 text-slate-400" />
              <div className="overflow-hidden">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Email</p>
                <p className="text-sm text-slate-700 font-medium truncate">{profile?.email || '—'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <Phone className="w-4 h-4 text-slate-400" />
              <div className="overflow-hidden">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Phone</p>
                <p className="text-sm text-slate-700 font-medium truncate">{profile?.phone || '—'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <Calendar className="w-4 h-4 text-slate-400" />
              <div className="overflow-hidden">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Joined</p>
                <p className="text-sm text-slate-700 font-medium truncate">{formatDate(profile?.createdAt)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-[#025EA7]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Edit Profile</h3>
            <p className="text-xs text-slate-500">Update your personal information</p>
          </div>
        </div>

        {successMsg && (
          <div className="mb-5 flex items-center space-x-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mb-5 flex items-center space-x-2 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none transition placeholder:text-slate-400"
                placeholder="First name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none transition placeholder:text-slate-400"
                placeholder="Last name"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none transition placeholder:text-slate-400"
                placeholder="admin@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none transition placeholder:text-slate-400"
                placeholder="+251 9XX XXX XXX"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center space-x-2 px-6 py-2.5 bg-[#025EA7] text-white rounded-xl text-sm font-semibold hover:bg-[#024A85] transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{saving ? 'Saving…' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Password Change */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Change Password</h3>
              <p className="text-xs text-slate-500">Update your account password</p>
            </div>
          </div>
          <button
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            className="text-sm font-semibold text-[#025EA7] hover:text-[#024A85] transition cursor-pointer"
          >
            {showPasswordSection ? 'Cancel' : 'Change'}
          </button>
        </div>

        {passwordSuccess && (
          <div className="mt-4 flex items-center space-x-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{passwordSuccess}</span>
          </div>
        )}
        {passwordError && (
          <div className="mt-4 flex items-center space-x-2 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        {showPasswordSection && (
          <form onSubmit={handleChangePassword} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Current Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none transition"
                  placeholder="Enter current password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none transition"
                  placeholder="Enter new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none transition"
                  placeholder="Re-enter new password"
                  required
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={passwordSaving}
                className="inline-flex items-center space-x-2 px-6 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {passwordSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span>{passwordSaving ? 'Updating…' : 'Update Password'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Session & Security */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Session & Security</h3>
            <p className="text-xs text-slate-500">Your current session information</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Session Started</p>
            </div>
            <p className="text-sm text-slate-700 font-semibold">
              {session.sessionStart
                ? new Date(session.sessionStart).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })
                : '—'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {session.sessionStart
                ? new Date(session.sessionStart).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : ''}
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center space-x-2 mb-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Last Activity</p>
            </div>
            <p className="text-sm text-slate-700 font-semibold">
              {session.lastActivity
                ? new Date(session.lastActivity).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                  })
                : '—'}
            </p>
            <p className="text-[11px] text-emerald-500 mt-0.5 font-medium">
              ● Active
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center space-x-2 mb-2">
              <Timer className="w-4 h-4 text-slate-400" />
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Session Timeout</p>
            </div>
            <p className="text-sm text-slate-700 font-semibold">
              {Math.round(session.timeoutMs / 60000)} minutes
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Auto-logout after inactivity
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100">
          <div>
            <p className="text-sm font-semibold text-red-700">End Current Session</p>
            <p className="text-xs text-red-500 mt-0.5">You will be redirected to the login page</p>
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition shadow-sm cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
