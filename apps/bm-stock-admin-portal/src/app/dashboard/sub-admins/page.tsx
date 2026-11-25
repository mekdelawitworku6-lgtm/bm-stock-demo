'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  ADMIN_PERMISSIONS,
  PERMISSION_PRESETS,
  getPermissionLabel,
  getPermissionBadgeClass,
} from '@/lib/permissions';
import {
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  Users,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Edit,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  RefreshCw,
  KeyRound,
  ChevronRight,
  Lock,
  Mail,
  Phone,
  User,
  Sliders,
  Check,
  Eye,
  EyeOff,
  Copy,
  Sparkles,
  Activity,
  Layers,
  Info,
} from 'lucide-react';

interface SubAdmin {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  adminPermissions?: string[];
  createdAt: string;
  updatedAt?: string;
}

export default function SubAdminsPage() {
  const { isSuperAdmin, user: currentUser } = useAuth();

  const [subAdmins, setSubAdmins] = useState<SubAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [permissionFilter, setPermissionFilter] = useState<string>('ALL');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedSubAdmin, setSelectedSubAdmin] = useState<SubAdmin | null>(null);

  // Form states
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    password: '',
    adminPermissions: ['dashboard', 'pending_approvals', 'users', 'companies'] as string[],
  });
  const [showAddPassword, setShowAddPassword] = useState(false);

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
  });

  const [editingPermissions, setEditingPermissions] = useState<string[]>([]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Feedback Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  // Fetch sub-admins
  const fetchSubAdmins = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const response = await api.get('/users/admin/sub-admins');
      const list = Array.isArray(response)
        ? response
        : (response?.data || response?.users || []);
      setSubAdmins(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('Failed to fetch sub-admins:', err);
      setError(err.message || 'Failed to load sub-admins');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchSubAdmins();
    } else {
      setLoading(false);
    }
  }, [isSuperAdmin, fetchSubAdmins]);

  // Generate strong random password
  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Filtered sub-admins
  const filteredSubAdmins = useMemo(() => {
    return subAdmins.filter((sa) => {
      // Search query filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        sa.firstName.toLowerCase().includes(q) ||
        sa.lastName.toLowerCase().includes(q) ||
        sa.email.toLowerCase().includes(q) ||
        (sa.phone && sa.phone.toLowerCase().includes(q));

      // Status filter
      const matchesStatus =
        statusFilter === 'ALL' ||
        sa.status.toUpperCase() === statusFilter;

      // Permission filter
      const matchesPerm =
        permissionFilter === 'ALL' ||
        (Array.isArray(sa.adminPermissions) && sa.adminPermissions.includes(permissionFilter));

      return matchesSearch && matchesStatus && matchesPerm;
    });
  }, [subAdmins, searchQuery, statusFilter, permissionFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = subAdmins.length;
    const active = subAdmins.filter((s) => s.status.toUpperCase() === 'ACTIVE').length;
    const inactive = total - active;
    const totalPerms = subAdmins.reduce((acc, s) => acc + (s.adminPermissions?.length || 0), 0);
    const avgPerms = total > 0 ? (totalPerms / total).toFixed(1) : '0';
    return { total, active, inactive, avgPerms };
  }, [subAdmins]);

  // Handlers
  const handleToggleStatus = async (subAdmin: SubAdmin) => {
    try {
      const response = await api.patch(`/users/admin/sub-admins/${subAdmin.id}/toggle-status`, {});
      const updatedUser = response?.data || response;
      setSubAdmins((prev) =>
        prev.map((s) => (s.id === subAdmin.id ? { ...s, status: updatedUser.status || (s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE') } : s))
      );
      showToast(
        `Sub-admin ${subAdmin.firstName} ${subAdmin.lastName} is now ${
          subAdmin.status === 'ACTIVE' ? 'Inactive' : 'Active'
        }.`
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle sub-admin status', 'error');
    }
  };

  const handleOpenAddModal = () => {
    setAddForm({
      name: '',
      email: '',
      password: generateRandomPassword(),
      adminPermissions: ['dashboard', 'pending_approvals', 'users', 'companies'],
    });
    setFormError('');
    setShowAddPassword(true);
    setIsAddModalOpen(true);
  };

  const handleCreateSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!addForm.name.trim() || !addForm.email.trim()) {
      setFormError('Please enter name and email address.');
      return;
    }

    if (!addForm.password || addForm.password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    setFormSubmitting(true);
    try {
      const trimmed = addForm.name.trim();
      const parts = trimmed.split(/\s+/);
      const firstName = parts[0] || trimmed;
      const lastName = parts.slice(1).join(' ') || '';

      const res = await api.post('/users/admin/sub-admins', {
        firstName,
        lastName,
        email: addForm.email.trim().toLowerCase(),
        password: addForm.password,
        adminPermissions: addForm.adminPermissions,
      });

      const newAdmin = res?.data || res;
      setSubAdmins((prev) => [newAdmin, ...prev]);
      setIsAddModalOpen(false);
      showToast(`Sub-admin ${newAdmin.firstName}${newAdmin.lastName ? ' ' + newAdmin.lastName : ''} added successfully!`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create sub-admin');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenEditModal = (subAdmin: SubAdmin) => {
    setSelectedSubAdmin(subAdmin);
    setEditForm({
      name: `${subAdmin.firstName || ''} ${subAdmin.lastName || ''}`.trim(),
      email: subAdmin.email,
    });
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleUpdateSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubAdmin) return;
    setFormError('');

    if (!editForm.name.trim() || !editForm.email.trim()) {
      setFormError('Name and email are required.');
      return;
    }

    setFormSubmitting(true);
    try {
      const trimmed = editForm.name.trim();
      const parts = trimmed.split(/\s+/);
      const firstName = parts[0] || trimmed;
      const lastName = parts.slice(1).join(' ') || '';

      const res = await api.patch(`/users/admin/sub-admins/${selectedSubAdmin.id}`, {
        firstName,
        lastName,
        email: editForm.email.trim().toLowerCase(),
      });

      const updated = res?.data || res;
      setSubAdmins((prev) =>
        prev.map((s) => (s.id === selectedSubAdmin.id ? { ...s, ...updated } : s))
      );
      setIsEditModalOpen(false);
      showToast('Sub-admin profile updated successfully!');
    } catch (err: any) {
      setFormError(err.message || 'Failed to update sub-admin');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenPermissionsModal = (subAdmin: SubAdmin) => {
    setSelectedSubAdmin(subAdmin);
    setEditingPermissions(subAdmin.adminPermissions || []);
    setFormError('');
    setIsPermissionsModalOpen(true);
  };

  const togglePermission = (key: string) => {
    setEditingPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const applyPreset = (presetPerms: string[]) => {
    setEditingPermissions(presetPerms);
  };

  const handleSavePermissions = async () => {
    if (!selectedSubAdmin) return;
    setFormSubmitting(true);
    setFormError('');

    try {
      const res = await api.patch(
        `/users/admin/sub-admins/${selectedSubAdmin.id}/permissions`,
        { adminPermissions: editingPermissions }
      );
      const updated = res?.data || res;
      setSubAdmins((prev) =>
        prev.map((s) =>
          s.id === selectedSubAdmin.id
            ? { ...s, adminPermissions: editingPermissions }
            : s
        )
      );
      setIsPermissionsModalOpen(false);
      showToast(`Permissions updated for ${selectedSubAdmin.firstName}!`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update permissions');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenResetPasswordModal = (subAdmin: SubAdmin) => {
    setSelectedSubAdmin(subAdmin);
    const generated = generateRandomPassword();
    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowNewPassword(true);
    setFormError('');
    setIsResetPasswordModalOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubAdmin) return;
    setFormError('');

    if (!newPassword || newPassword.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setFormSubmitting(true);
    try {
      await api.post(`/users/admin/sub-admins/${selectedSubAdmin.id}/reset-password`, {
        newPassword,
      });
      setIsResetPasswordModalOpen(false);
      showToast(`Password reset successfully for ${selectedSubAdmin.firstName}!`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to reset password');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenDeleteModal = (subAdmin: SubAdmin) => {
    setSelectedSubAdmin(subAdmin);
    setFormError('');
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSubAdmin = async () => {
    if (!selectedSubAdmin) return;
    setFormSubmitting(true);
    setFormError('');

    try {
      await api.delete(`/users/admin/sub-admins/${selectedSubAdmin.id}`);
      setSubAdmins((prev) => prev.filter((s) => s.id !== selectedSubAdmin.id));
      setIsDeleteModalOpen(false);
      showToast(`Sub-admin ${selectedSubAdmin.firstName} removed successfully.`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to delete sub-admin');
    } finally {
      setFormSubmitting(false);
    }
  };

  // If not super admin, show access restricted view
  if (!isSuperAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="w-16 h-16 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-600">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Super Admin Access Required</h2>
        <p className="text-slate-500 mt-2 text-sm leading-relaxed max-w-md mx-auto">
          Sub-admin management and portal permission assignment is restricted to Super
          Administrators. Please contact your system administrator if you require access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center space-x-3 px-5 py-3.5 rounded-2xl shadow-xl border text-sm font-semibold transition-all duration-300 animate-in slide-in-from-bottom-3 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20'
              : 'bg-rose-600 text-white border-rose-500 shadow-rose-500/20'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#025EA7]/10 text-[#025EA7] flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Sub-Admin Management
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Delegate portal administration with granular, module-level access permissions
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchSubAdmins(true)}
            disabled={refreshing}
            className="flex items-center space-x-2 px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-sm font-medium transition cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#025EA7]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center space-x-2 px-4 py-2.5 bg-[#025EA7] hover:bg-[#024A85] text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Sub-Admin</span>
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Sub-Admins
            </p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</h3>
            <span className="text-[11px] text-slate-400 font-medium">Administrative staff</span>
          </div>
          <div className="w-11 h-11 bg-blue-50 text-[#025EA7] rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Users
            </p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">{stats.active}</h3>
            <span className="text-[11px] text-slate-400 font-medium">Can log in to portal</span>
          </div>
          <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Inactive Users
            </p>
            <h3 className="text-2xl font-bold text-slate-400 mt-1">{stats.inactive}</h3>
            <span className="text-[11px] text-slate-400 font-medium">Access suspended</span>
          </div>
          <div className="w-11 h-11 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Avg. Modules
            </p>
            <h3 className="text-2xl font-bold text-indigo-600 mt-1">{stats.avgPerms}</h3>
            <span className="text-[11px] text-slate-400 font-medium">Modules per sub-admin</span>
          </div>
          <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] transition text-slate-800"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center space-x-3 overflow-x-auto pb-1 md:pb-0">
          {/* Status Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 p-1 rounded-xl">
            {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  statusFilter === status
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {status === 'ALL' ? 'All Status' : status === 'ACTIVE' ? 'Active' : 'Inactive'}
              </button>
            ))}
          </div>

          {/* Permission Filter */}
          <select
            value={permissionFilter}
            onChange={(e) => setPermissionFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7]"
          >
            <option value="ALL">All Permissions</option>
            {ADMIN_PERMISSIONS.map((perm) => (
              <option key={perm.key} value={perm.key}>
                {perm.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sub-Admins Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="w-8 h-8 text-[#025EA7] animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">Loading sub-administrators...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-rose-700">{error}</p>
            <button
              onClick={() => fetchSubAdmins()}
              className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : filteredSubAdmins.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-blue-50 text-[#025EA7] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Sub-Admins Found</h3>
            <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'ALL' || permissionFilter !== 'ALL'
                ? 'No sub-admins match your filter criteria. Try clearing search filters.'
                : 'You have not added any sub-admin users yet. Click "+ Add Sub-Admin" to create one.'}
            </p>
            {!searchQuery && statusFilter === 'ALL' && permissionFilter === 'ALL' && (
              <button
                onClick={handleOpenAddModal}
                className="mt-4 inline-flex items-center space-x-2 px-4 py-2 bg-[#025EA7] text-white rounded-xl text-xs font-semibold hover:bg-[#024A85] transition"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add First Sub-Admin</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Sub-Admin User</th>
                  <th className="px-6 py-4">Contact Info</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Assigned Permissions</th>
                  <th className="px-6 py-4">Created Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredSubAdmins.map((subAdmin) => {
                  const perms = subAdmin.adminPermissions || [];
                  const isActive = subAdmin.status.toUpperCase() === 'ACTIVE';

                  return (
                    <tr
                      key={subAdmin.id}
                      className="hover:bg-slate-50/60 transition-colors duration-150"
                    >
                      {/* Name & Avatar */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#025EA7] to-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                            {subAdmin.firstName?.charAt(0) || 'A'}
                            {subAdmin.lastName?.charAt(0) || ''}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center space-x-1.5">
                              <span>
                                {`${subAdmin.firstName || ''} ${subAdmin.lastName || ''}`.trim() || 'Admin User'}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#025EA7] border border-blue-100">
                                Sub-Admin
                              </span>
                            </div>
                            <span className="text-xs text-slate-400">ID: {subAdmin.id.slice(0, 8)}...</span>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5 text-xs text-slate-700">
                            <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate max-w-[200px]">{subAdmin.email}</span>
                          </div>
                          {subAdmin.phone && (
                            <div className="flex items-center space-x-1.5 text-xs text-slate-500">
                              <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span>{subAdmin.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status Toggle Switch */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(subAdmin)}
                          className="group flex items-center space-x-2 cursor-pointer focus:outline-none"
                          title={`Click to ${isActive ? 'deactivate' : 'activate'}`}
                        >
                          <div
                            className={`w-9 h-5 flex items-center rounded-full p-1 duration-300 ease-in-out ${
                              isActive ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                          >
                            <div
                              className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform duration-300 ease-in-out ${
                                isActive ? 'translate-x-4' : ''
                              }`}
                            />
                          </div>
                          <span
                            className={`text-xs font-semibold ${
                              isActive ? 'text-emerald-700' : 'text-slate-500'
                            }`}
                          >
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </button>
                      </td>

                      {/* Assigned Permissions Badges */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5 max-w-md">
                          {perms.length === 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-400">
                              No permissions granted
                            </span>
                          ) : (
                            <>
                              {perms.slice(0, 3).map((permKey) => (
                                <span
                                  key={permKey}
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${getPermissionBadgeClass(
                                    permKey
                                  )}`}
                                >
                                  {getPermissionLabel(permKey)}
                                </span>
                              ))}
                              {perms.length > 3 && (
                                <button
                                  onClick={() => handleOpenPermissionsModal(subAdmin)}
                                  className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                                  title="View all permissions"
                                >
                                  +{perms.length - 3} more
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        {subAdmin.createdAt
                          ? new Date(subAdmin.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </td>

                      {/* Action Buttons */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {/* Permissions Button */}
                          <button
                            onClick={() => handleOpenPermissionsModal(subAdmin)}
                            className="p-1.5 text-slate-500 hover:text-[#025EA7] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Manage Permissions"
                          >
                            <Sliders className="w-4 h-4" />
                          </button>

                          {/* Edit Details */}
                          <button
                            onClick={() => handleOpenEditModal(subAdmin)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Edit Sub-Admin"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {/* Reset Password */}
                          <button
                            onClick={() => handleOpenResetPasswordModal(subAdmin)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                            title="Reset Password"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleOpenDeleteModal(subAdmin)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Delete Sub-Admin"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── ADD SUB-ADMIN MODAL ────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#025EA7] text-white flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Add New Sub-Admin</h3>
                  <p className="text-xs text-slate-500">
                    Create administrator account and configure access permissions
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleCreateSubAdmin} className="flex-1 overflow-y-auto p-6 space-y-6">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Personal Details */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Account Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Name / Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={addForm.name}
                      onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="subadmin@company.com"
                      value={addForm.email}
                      onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7]"
                    />
                  </div>
                </div>
              </div>

              {/* Initial Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-600">
                    Temporary Password <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setAddForm({ ...addForm, password: generateRandomPassword() })}
                    className="text-xs text-[#025EA7] hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Strong Password</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showAddPassword ? 'text' : 'password'}
                    required
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    className="w-full pl-3.5 pr-20 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7]"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setShowAddPassword(!showAddPassword)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                      title={showAddPassword ? 'Hide password' : 'Show password'}
                    >
                      {showAddPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(addForm.password);
                        showToast('Password copied to clipboard!');
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600"
                      title="Copy password"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Granular Permission Assignment */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Admin Portal Permissions
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Select modules this sub-admin is authorized to view and manage
                    </p>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex flex-wrap gap-1.5">
                    {PERMISSION_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setAddForm({ ...addForm, adminPermissions: preset.permissions })}
                        className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 hover:text-[#025EA7] text-slate-600 rounded-lg border border-slate-200 transition cursor-pointer"
                        title={preset.description}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ADMIN_PERMISSIONS.map((perm) => {
                    const isSelected = addForm.adminPermissions.includes(perm.key);
                    return (
                      <div
                        key={perm.key}
                        onClick={() => {
                          setAddForm({
                            ...addForm,
                            adminPermissions: isSelected
                              ? addForm.adminPermissions.filter((p) => p !== perm.key)
                              : [...addForm.adminPermissions, perm.key],
                          });
                        }}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all duration-150 flex items-start space-x-3 ${
                          isSelected
                            ? 'bg-blue-50/70 border-blue-300 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div
                          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition ${
                            isSelected
                              ? 'bg-[#025EA7] border-[#025EA7] text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-slate-800 leading-tight">
                            {perm.label}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
                            {perm.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 bg-[#025EA7] hover:bg-[#024A85] text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-600/20 transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Create Sub-Admin</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT PERMISSIONS MODAL ─────────────────────────────────── */}
      {isPermissionsModalOpen && selectedSubAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full flex flex-col overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Configure Permissions</h3>
                  <p className="text-xs text-slate-500">
                    {selectedSubAdmin.firstName} {selectedSubAdmin.lastName} ({selectedSubAdmin.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPermissionsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Presets */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Quick Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PERMISSION_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => applyPreset(preset.permissions)}
                      className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-blue-50 hover:text-[#025EA7] text-slate-600 rounded-lg border border-slate-200 transition cursor-pointer"
                    >
                      {preset.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditingPermissions([])}
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-lg border border-slate-200 transition cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Permissions Checklist */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {ADMIN_PERMISSIONS.map((perm) => {
                  const isChecked = editingPermissions.includes(perm.key);
                  return (
                    <div
                      key={perm.key}
                      onClick={() => togglePermission(perm.key)}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition flex items-center justify-between ${
                        isChecked
                          ? 'bg-blue-50/70 border-blue-300 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition ${
                            isChecked
                              ? 'bg-[#025EA7] border-[#025EA7] text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{perm.label}</p>
                          <p className="text-[11px] text-slate-500">{perm.description}</p>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-slate-400 font-medium ml-2">
                        {perm.key}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsPermissionsModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={formSubmitting}
                  className="px-5 py-2.5 bg-[#025EA7] hover:bg-[#024A85] text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-600/20 transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Permissions</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── EDIT SUB-ADMIN PROFILE MODAL ─────────────────────────── */}
      {isEditModalOpen && selectedSubAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#025EA7] flex items-center justify-center font-bold">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Edit Sub-Admin</h3>
                  <p className="text-xs text-slate-500">Update account personal details</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSubAdmin} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Name / Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7]"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 bg-[#025EA7] hover:bg-[#024A85] text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-600/20 transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── RESET PASSWORD MODAL ───────────────────────────────────── */}
      {isResetPasswordModalOpen && selectedSubAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-50/50 to-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Reset Password</h3>
                  <p className="text-xs text-slate-500">
                    For {selectedSubAdmin.firstName} {selectedSubAdmin.lastName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsResetPasswordModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-600">
                    New Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const gen = generateRandomPassword();
                      setNewPassword(gen);
                      setConfirmPassword(gen);
                    }}
                    className="text-xs text-[#025EA7] hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Strong</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3.5 pr-20 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7]"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(newPassword);
                        showToast('Password copied to clipboard!');
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7]"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsResetPasswordModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-amber-600/20 transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Set New Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRMATION MODAL ─────────────────────────────── */}
      {isDeleteModalOpen && selectedSubAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-center animate-in fade-in duration-200">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Delete Sub-Admin?</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-800">
                {selectedSubAdmin.firstName} {selectedSubAdmin.lastName}
              </strong>{' '}
              ({selectedSubAdmin.email})? They will immediately lose access to the BM Stock Admin
              Portal.
            </p>

            {formError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {formError}
              </div>
            )}

            <div className="mt-6 flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubAdmin}
                disabled={formSubmitting}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-rose-600/20 transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
