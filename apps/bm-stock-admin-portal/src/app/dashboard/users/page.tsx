'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, apiFetch } from '@/lib/api';
import { formatUserName } from '@/lib/user-display';
import { resolveMediaUrl } from '@/lib/media';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Building,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  Edit,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  UserCheck,
  RefreshCw,
  KeyRound,
  CreditCard,
  ChevronRight,
  IdCard,
  Receipt,
  Upload,
  Image as ImageIcon,
  ZoomIn,
} from 'lucide-react';

interface UserItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  companyId?: string;
  createdAt?: string;
  planTitle?: string;
  planAmount?: number;
  paymentStatus?: string;
  subscriptionStartDate?: string;
  subscriptionExpiresAt?: string;
  subscriptionPaymentDate?: string;
  faydaId?: string;
  tin?: string;
  paymentScreenshot?: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploadingReceiptForUser, setUploadingReceiptForUser] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    role: 'company_admin',
    status: 'active',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/users/admin?limit=100&role=company_admin');
      const extracted = Array.isArray(data) ? data : (data?.data || data?.users);
      const userList = Array.isArray(extracted) ? extracted : [];
      setUsers(userList);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setError(err.message || 'Failed to load users from backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError('');

    const cleanPhoneDigits = formData.phone ? formData.phone.replace(/\D/g, '').replace(/^251/, '').replace(/^0+/, '') : '';
    const formattedPhone = cleanPhoneDigits ? `+251${cleanPhoneDigits}` : undefined;

    try {
      await api.post('/auth/admin/create-user', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formattedPhone,
        password: formData.password,
        role: formData.role,
        skipEmailVerification: true,
      });

      setIsCreateModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create user');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormSubmitting(true);
    setFormError('');

    const cleanPhoneDigits = formData.phone ? formData.phone.replace(/\D/g, '').replace(/^251/, '').replace(/^0+/, '') : '';
    const formattedPhone = cleanPhoneDigits ? `+251${cleanPhoneDigits}` : undefined;

    try {
      await api.patch(`/users/admin/${selectedUser.id}`, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formattedPhone,
        role: formData.role,
        status: formData.status,
      });

      setIsEditModalOpen(false);
      setSelectedUser(null);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update user');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setFormSubmitting(true);
    try {
      await api.delete(`/users/admin/${selectedUser.id}`);
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword) return;
    setFormSubmitting(true);
    setFormError('');
    try {
      await api.post(`/users/admin/${selectedUser.id}/reset-password`, { newPassword });
      setIsResetPasswordModalOpen(false);
      setSelectedUser(null);
      setNewPassword('');
      alert('Password reset successfully.');
    } catch (err: any) {
      setFormError(err.message || 'Failed to reset password');
    } finally {
      setFormSubmitting(false);
    }
  };

  const openResetPasswordModal = (user: UserItem) => {
    setSelectedUser(user);
    setNewPassword('');
    setFormError('');
    setIsResetPasswordModalOpen(true);
  };

  const formatDate = (value?: string) => {
    if (!value) return '—';
    return new Date(value).toLocaleDateString();
  };

  const getPaymentBadge = (status?: string) => {
    if (!status) return <span className="text-slate-400 italic text-xs">—</span>;
    const s = status.toLowerCase();
    if (s === 'active' || s === 'paid' || s === 'approved' || s === 'confirmed') {
      return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">{status}</span>;
    }
    if (s === 'pending') {
      return <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full">{status}</span>;
    }
    return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">{status}</span>;
  };

  const openEditModal = (user: UserItem) => {
    setSelectedUser(user);
    const rawPhone = user.phone || '';
    const cleanPhoneDigits = rawPhone.replace(/\D/g, '').replace(/^251/, '').replace(/^0+/, '');
    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: cleanPhoneDigits,
      password: '',
      role: user.role || 'user',
      status: user.status || 'active',
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (user: UserItem) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      role: 'company_admin',
      status: 'active',
    });
    setFormError('');
  };

  const handleReceiptUpload = async (userId: string, file: File) => {
    setUploadingReceiptForUser(userId);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_access_token') : null;
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const uploadRes = await fetch(`${API_URL}/sales/upload-receipt`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();
      const url = uploadData?.data?.url || uploadData?.url;
      if (!url) throw new Error('No URL returned from upload');

      await api.patch(`/users/admin/${userId}`, { paymentScreenshot: url });
      fetchUsers();
    } catch (err: any) {
      console.error('Receipt upload failed:', err);
      alert(err.message || 'Failed to upload receipt');
    } finally {
      setUploadingReceiptForUser(null);
    }
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const fullName = formatUserName(u).toLowerCase();
    const email = (u.email || '').toLowerCase();
    const phone = (u.phone || '').toLowerCase();
    const matchesSearch =
      fullName.includes(searchTerm.toLowerCase()) ||
      email.includes(searchTerm.toLowerCase()) ||
      phone.includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || u.status?.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const getRoleBadge = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'super_admin':
      case 'admin':
        return (
          <span className="px-2.5 py-1 bg-purple-100 text-purple-700 font-semibold text-xs rounded-full border border-purple-200 inline-flex items-center">
            <Shield className="w-3 h-3 mr-1" /> Super Admin
          </span>
        );
      case 'company_admin':
        return (
          <span className="px-2.5 py-1 bg-blue-100 text-[#025EA7] font-semibold text-xs rounded-full border border-blue-200 inline-flex items-center">
            <Building className="w-3 h-3 mr-1" /> Company Admin
          </span>
        );
      case 'manager':
        return (
          <span className="px-2.5 py-1 bg-amber-100 text-amber-700 font-semibold text-xs rounded-full border border-amber-200">
            Manager
          </span>
        );
      case 'cashier':
        return (
          <span className="px-2.5 py-1 bg-teal-100 text-teal-700 font-semibold text-xs rounded-full border border-teal-200">
            Cashier
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-semibold text-xs rounded-full border border-slate-200">
            User
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return (
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-semibold text-xs rounded-full border border-emerald-200 inline-flex items-center">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Active
          </span>
        );
      case 'pending':
        return (
          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-semibold text-xs rounded-full border border-amber-200">
            Pending
          </span>
        );
      case 'suspended':
      case 'inactive':
        return (
          <span className="px-2.5 py-1 bg-red-50 text-red-700 font-semibold text-xs rounded-full border border-red-200 inline-flex items-center">
            <XCircle className="w-3 h-3 mr-1 text-red-600" /> Inactive
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 font-semibold text-xs rounded-full">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn bg-white">
      {/* Header & Main Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <Users className="w-6 h-6 text-[#025EA7]" />
            <h1 className="text-2xl font-bold text-slate-900">Company Admin Accounts</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage company owner accounts, subscriptions, and account statuses.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchUsers}
            title="Refresh Users"
            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              resetForm();
              setIsCreateModalOpen(true);
            }}
            className="px-5 py-3 bg-[#025EA7] hover:bg-[#024A85] text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-xl transition-all duration-200 flex items-center space-x-2 cursor-pointer"
          >
            <UserPlus className="w-5 h-5" />
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Company Admins</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{users.length}</h3>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-[#025EA7] rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Accounts</p>
            <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">
              {users.filter((u) => u.status === 'active').length}
            </h3>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending Approval</p>
            <h3 className="text-2xl font-extrabold text-amber-600 mt-1">
              {users.filter((u) => u.status === 'pending').length}
            </h3>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">With Subscription</p>
            <h3 className="text-2xl font-extrabold text-[#025EA7] mt-1">
              {users.filter((u) => u.planTitle).length}
            </h3>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-[#025EA7] rounded-xl flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Payment Pending</p>
            <h3 className="text-2xl font-extrabold text-amber-600 mt-1">
              {users.filter((u) => u.paymentStatus?.toLowerCase() === 'pending').length}
            </h3>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users by name, email, phone..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#025EA7] text-sm text-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#025EA7]"
          >
            <option value="ALL">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended / Inactive</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#025EA7] mb-2" />
            <p className="text-sm font-medium">Loading user records...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-slate-700">No users found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search term</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                  <th className="py-4 px-6">User Information</th>
                  <th className="py-4 px-6">Contact Phone</th>
                  <th className="py-4 px-6">Fayda / TIN</th>
                  <th className="py-4 px-6">Subscription</th>
                  <th className="py-4 px-6">Payment</th>
                  <th className="py-4 px-6">Receipt</th>
                  <th className="py-4 px-6">Role</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-4 px-6">
                      <Link href={`/dashboard/users/${user.id}`} className="flex items-center space-x-3 group">
                        <div className="w-10 h-10 bg-[#025EA7] text-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm">
                          {user.firstName?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 group-hover:text-[#025EA7]">
                            {formatUserName(user)}
                          </p>
                          <p className="text-xs text-slate-500 flex items-center mt-0.5">
                            <Mail className="w-3 h-3 mr-1 text-slate-400" />
                            {user.email}
                          </p>
                        </div>
                      </Link>
                    </td>

                    <td className="py-4 px-6 font-medium text-slate-700">
                      {user.phone ? (
                        <span className="flex items-center text-slate-700">
                          <Phone className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                          {user.phone}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Not specified</span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-xs text-slate-600">
                      {user.faydaId || user.tin ? (
                        <div className="space-y-0.5">
                          {user.faydaId && (
                            <p className="flex items-center"><IdCard className="w-3 h-3 mr-1 text-slate-400" />{user.faydaId}</p>
                          )}
                          {user.tin && <p>TIN: {user.tin}</p>}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    <td className="py-4 px-6">
                      {user.planTitle ? (
                        <div>
                          <span className="flex items-center text-sm font-medium text-slate-800">
                            <CreditCard className="w-3.5 h-3.5 mr-1 text-[#025EA7]" />
                            {user.planTitle}
                          </span>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Expires: {formatDate(user.subscriptionExpiresAt)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">No plan</span>
                      )}
                    </td>

                    <td className="py-4 px-6">
                      {getPaymentBadge(user.paymentStatus)}
                      <p className="text-[11px] text-slate-400 mt-0.5">Paid: {formatDate(user.subscriptionPaymentDate)}</p>
                    </td>

                    <td className="py-4 px-6">
                      {user.paymentScreenshot ? (
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setReceiptPreview(resolveMediaUrl(user.paymentScreenshot))}
                            className="relative group cursor-pointer flex-shrink-0"
                            title="Click to view receipt"
                          >
                            <img
                              src={resolveMediaUrl(user.paymentScreenshot) || ''}
                              alt={`Receipt for ${formatUserName(user)}`}
                              className="w-12 h-12 object-cover rounded-lg border border-slate-200 bg-white shadow-sm group-hover:border-[#025EA7] group-hover:shadow-md transition"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg flex items-center justify-center transition">
                              <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition" />
                            </div>
                          </button>
                          <label
                            className={`p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-[#025EA7] hover:border-[#025EA7] hover:bg-blue-50 cursor-pointer transition ${
                              uploadingReceiptForUser === user.id ? 'opacity-50 pointer-events-none' : ''
                            }`}
                            title="Replace receipt"
                          >
                            {uploadingReceiptForUser === user.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Upload className="w-3.5 h-3.5" />
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploadingReceiptForUser === user.id}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleReceiptUpload(user.id, file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                      ) : (
                        <label
                          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed cursor-pointer transition ${
                            uploadingReceiptForUser === user.id
                              ? 'border-blue-300 bg-blue-50 text-blue-500'
                              : 'border-slate-300 text-slate-400 hover:border-[#025EA7] hover:text-[#025EA7] hover:bg-blue-50'
                          }`}
                        >
                          {uploadingReceiptForUser === user.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          <span>{uploadingReceiptForUser === user.id ? 'Uploading...' : 'Upload'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingReceiptForUser === user.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleReceiptUpload(user.id, file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </td>

                    <td className="py-4 px-6">{getRoleBadge(user.role)}</td>

                    <td className="py-4 px-6">{getStatusBadge(user.status)}</td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          href={`/dashboard/users/${user.id}`}
                          title="View Details"
                          className="p-2 text-slate-600 hover:text-[#025EA7] hover:bg-blue-50 rounded-lg transition"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => openResetPasswordModal(user)}
                          title="Reset Password"
                          className="p-2 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(user)}
                          title="Edit User"
                          className="p-2 text-slate-600 hover:text-[#025EA7] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(user)}
                          title="Delete User"
                          className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE USER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-fadeIn border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-[#025EA7]" />
                <h3 className="text-lg font-bold text-slate-900">Create New User</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="John"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Doe"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Phone Number (Optional)</label>
                <div className="flex rounded-xl overflow-hidden border border-slate-200 focus-within:ring-2 focus-within:ring-[#025EA7] bg-slate-50">
                  <span className="px-3.5 py-3 bg-slate-200/80 text-slate-700 font-bold text-sm select-none border-r border-slate-200 flex items-center shrink-0">
                    +251
                  </span>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, '');
                      if (val.startsWith('251')) val = val.slice(3);
                      if (val.startsWith('0')) val = val.slice(1);
                      setFormData({ ...formData, phone: val });
                    }}
                    placeholder="911234567"
                    className="w-full p-3 bg-transparent text-sm outline-none text-slate-800 font-medium"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">Country code +251 is fixed and non-editable</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7]"
                >
                  <option value="company_admin">Company Admin</option>
                  <option value="manager">Manager</option>
                  <option value="cashier">Cashier</option>
                  <option value="user">Standard User</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 font-semibold text-sm hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 bg-[#025EA7] hover:bg-[#024A85] text-white font-semibold text-sm rounded-xl shadow-md flex items-center space-x-2 disabled:opacity-50"
                >
                  {formSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Edit className="w-5 h-5 text-[#025EA7]" />
                <h3 className="text-lg font-bold text-slate-900">Edit User Details</h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditUser} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Phone Number</label>
                <div className="flex rounded-xl overflow-hidden border border-slate-200 focus-within:ring-2 focus-within:ring-[#025EA7] bg-slate-50">
                  <span className="px-3.5 py-3 bg-slate-200/80 text-slate-700 font-bold text-sm select-none border-r border-slate-200 flex items-center shrink-0">
                    +251
                  </span>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, '');
                      if (val.startsWith('251')) val = val.slice(3);
                      if (val.startsWith('0')) val = val.slice(1);
                      setFormData({ ...formData, phone: val });
                    }}
                    placeholder="911234567"
                    className="w-full p-3 bg-transparent text-sm outline-none text-slate-800 font-medium"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">Country code +251 is fixed and non-editable</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7]"
                  >
                    <option value="company_admin">Company Admin</option>
                    <option value="manager">Manager</option>
                    <option value="cashier">Cashier</option>
                    <option value="user">Standard User</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Account Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7]"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended / Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 font-semibold text-sm hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 bg-[#025EA7] hover:bg-[#024A85] text-white font-semibold text-sm rounded-xl shadow-md flex items-center space-x-2 disabled:opacity-50"
                >
                  {formSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {isResetPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg font-bold text-slate-900">Reset Password</h3>
              </div>
              <button onClick={() => setIsResetPasswordModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mt-3">
              Set a new password for <span className="font-semibold text-slate-800">{formatUserName(selectedUser)}</span> ({selectedUser.email}).
            </p>
            {formError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}
            <form onSubmit={handleResetPassword} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7]"
                />
              </div>
              <div className="pt-2 flex items-center justify-end space-x-3">
                <button type="button" onClick={() => setIsResetPasswordModalOpen(false)} className="px-4 py-2.5 text-slate-600 font-semibold text-sm hover:bg-slate-100 rounded-xl">
                  Cancel
                </button>
                <button type="submit" disabled={formSubmitting} className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm rounded-xl flex items-center space-x-2 disabled:opacity-50">
                  {formSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  <span>Reset Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Delete User Account?</h3>
            <p className="text-sm text-slate-500 mt-2">
              Are you sure you want to delete <span className="font-semibold text-slate-800">{formatUserName(selectedUser)}</span> ({selectedUser.email})? This action cannot be undone.
            </p>

            <div className="mt-6 flex items-center justify-center space-x-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-5 py-2.5 text-slate-600 font-semibold text-sm hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={formSubmitting}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-xl shadow-md flex items-center space-x-2 disabled:opacity-50"
              >
                {formSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT PREVIEW LIGHTBOX */}
      {receiptPreview && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setReceiptPreview(null)}
        >
          <div
            className="relative max-w-2xl w-full max-h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-[#025EA7]" />
                <h3 className="text-sm font-bold text-slate-900">Payment Receipt</h3>
              </div>
              <div className="flex items-center space-x-2">
                <a
                  href={receiptPreview}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#025EA7] hover:underline px-2.5 py-1 bg-blue-50 rounded-lg transition"
                >
                  Open Original
                </a>
                <button
                  onClick={() => setReceiptPreview(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center overflow-auto max-h-[75vh]">
              <img
                src={receiptPreview}
                alt="Payment receipt"
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
