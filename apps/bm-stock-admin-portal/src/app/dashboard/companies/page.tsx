'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AccountStatusBadge } from '@/components/AccountStatusBadge';
import { formatUserName } from '@/lib/user-display';
import {
  Building2,
  Search,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Filter,
  Plus,
  X,
  Store,
  Calendar,
  Building,
  Mail,
  User,
  Hash,
  ImageIcon,
  Eye,
  Phone,
  CreditCard,
} from 'lucide-react';

interface OwnerInfo {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  numCompanies?: number | null;
}

interface CompanyItem {
  id: string;
  name: string;
  address?: string;
  email?: string;
  phoneNumber?: string;
  createdAt?: string;
  status?: string;
  accountStatus?: string;
  storesCount?: number;
  staffCount?: number;
  subscription?: {
    planTitle?: string;
    paymentStatus?: string;
    subscriptionStartDate?: string;
    subscriptionExpiresAt?: string;
    subscriptionPaymentDate?: string;
  };
  createdBy?: OwnerInfo | null;
}

interface LimitAttempt {
  id: string;
  userId: string;
  companyName: string;
  companyNames?: string[];
  kind?: string;
  status: string;
  attemptedAt?: string;
  planId?: string | null;
  planTitle?: string | null;
  planAmount?: number | null;
  paymentMethod?: string | null;
  paymentRef?: string | null;
  screenshotUrl?: string | null;
  metadata?: any;
  userFullName?: string | null;
  userEmail?: string | null;
  userPhone?: string | null;
  numCompanies?: number | null;
  currentCompaniesCount?: number | null;
  existingCompanyNames?: string[];
}

const ownerName = (owner: OwnerInfo | null | undefined) => {
  if (!owner) return 'Unassigned';
  return formatUserName(owner);
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
};

const COMPANY_PHONE_PATTERN = /^(09|07)\d{8}$/;

const normalizeCompanyPhoneInput = (value: string) => {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('251')) digits = digits.slice(3);
  if (/^[79]\d{8}$/.test(digits)) digits = `0${digits}`;
  return digits.slice(0, 10);
};

const attemptNames = (attempt: LimitAttempt) =>
  attempt.companyNames && attempt.companyNames.length > 0 ? attempt.companyNames : [attempt.companyName];

function resolveMediaUrl(path?: string): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

const formatLimitDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `Today, ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  if (hours < 48) return 'Yesterday';
  return d.toLocaleDateString();
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [attempts, setAttempts] = useState<LimitAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [attemptsLoading, setAttemptsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [approvalTarget, setApprovalTarget] = useState<LimitAttempt | null>(null);
  const [newLimit, setNewLimit] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  // Modals state
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [isCreateStoreOpen, setIsCreateStoreOpen] = useState(false);
  const [ownersList, setOwnersList] = useState<any[]>([]);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Company Form
  const [companyForm, setCompanyForm] = useState({
    name: '',
    ownerId: '',
    phoneDigits: '',
    address: '',
    email: '',
    description: '',
  });

  // Store Form
  const [storeForm, setStoreForm] = useState({
    type: 'warehouse' as 'warehouse' | 'shop',
    companyId: '',
    name: '',
    location: '',
    managerName: '',
    phoneDigits: '',
  });

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200', ownerRole: 'company_admin' });
      if (statusFilter !== 'ALL') params.set('accountStatus', statusFilter);
      const data = await api.get(`/companies?${params.toString()}`);
      const extracted = Array.isArray(data) ? data : data?.data;
      setCompanies(Array.isArray(extracted) ? extracted : []);
    } catch (err) {
      console.error('Failed to fetch companies:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttempts = async () => {
    setAttemptsLoading(true);
    try {
      const data = await api.get('/companies/admin/limit-attempts');
      setAttempts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch limit attempts:', err);
    } finally {
      setAttemptsLoading(false);
    }
  };

  const fetchOwners = async () => {
    try {
      const data = await api.get('/users?limit=200');
      const users = Array.isArray(data) ? data : data?.data || [];
      setOwnersList(users);
    } catch (err) {
      console.error('Failed to fetch owners:', err);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [statusFilter]);

  useEffect(() => {
    fetchAttempts();
    fetchOwners();
  }, []);

  const refreshAll = async () => {
    await Promise.all([fetchCompanies(), fetchAttempts(), fetchOwners()]);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const openApproval = (attempt: LimitAttempt) => {
    setApprovalTarget(attempt);
    setNewLimit(String((attempt.numCompanies ?? 0) + attemptNames(attempt).length));
  };

  const closeApproval = () => {
    setApprovalTarget(null);
    setActionLoading(null);
  };

  const approveAttempt = async (attempt: LimitAttempt, limit?: number) => {
    setActionLoading(attempt.id);
    try {
      await api.patch(`/companies/admin/limit-attempts/${attempt.id}/approve`, { numCompanies: limit });
      setAttempts((prev) =>
        prev.map((a) => (a.id === attempt.id ? { ...a, status: 'APPROVED', numCompanies: limit ?? a.numCompanies } : a)),
      );
      closeApproval();
      showToast(`Approved "${attempt.companyName}" — allowance raised to ${limit ?? (attempt.numCompanies ?? 0) + 1}.`);
      fetchCompanies();
    } catch (err: any) {
      showToast(`Failed to approve: ${err.message}`);
      setActionLoading(null);
    }
  };

  const rejectAttempt = async (attempt: LimitAttempt) => {
    setActionLoading(attempt.id);
    try {
      await api.patch(`/companies/admin/limit-attempts/${attempt.id}/reject`, {});
      setAttempts((prev) => prev.map((a) => (a.id === attempt.id ? { ...a, status: 'REJECTED' } : a)));
      showToast(`Rejected "${attempt.companyName}" — user was notified.`);
    } catch (err: any) {
      showToast(`Failed to reject: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyForm.name.trim()) return;
    setModalError(null);
    const cleanPhone = normalizeCompanyPhoneInput(companyForm.phoneDigits);
    if (cleanPhone && !COMPANY_PHONE_PATTERN.test(cleanPhone)) {
      setModalError('Phone number must start with 09 or 07 and be 10 digits long');
      return;
    }
    setModalSubmitting(true);
    try {
      await api.post('/companies', {
        name: companyForm.name.trim(),
        address: companyForm.address.trim() || undefined,
        phoneNumber: cleanPhone || undefined,
        email: companyForm.email.trim() || undefined,
        description: companyForm.description.trim() || undefined,
        createdById: companyForm.ownerId || undefined,
      });
      showToast(`Company "${companyForm.name}" created successfully!`);
      setIsCreateCompanyOpen(false);
      setCompanyForm({ name: '', ownerId: '', phoneDigits: '', address: '', email: '', description: '' });
      fetchCompanies();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create company');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeForm.name.trim() || !storeForm.companyId) {
      setModalError('Store name and company target are required');
      return;
    }
    setModalError(null);
    setModalSubmitting(true);
    try {
      const cleanPhone = storeForm.phoneDigits ? `+251${storeForm.phoneDigits}` : undefined;
      const endpoint = storeForm.type === 'warehouse' ? '/warehouses' : '/shops';
      await api.post(endpoint, {
        name: storeForm.name.trim(),
        location: storeForm.location.trim() || undefined,
        companyId: storeForm.companyId,
        managerName: storeForm.managerName.trim() || undefined,
        contactPhone: cleanPhone,
      });
      showToast(`${storeForm.type === 'warehouse' ? 'Warehouse' : 'Shop'} "${storeForm.name}" created successfully!`);
      setIsCreateStoreOpen(false);
      setStoreForm({ type: 'warehouse', companyId: '', name: '', location: '', managerName: '', phoneDigits: '' });
      fetchCompanies();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create store');
    } finally {
      setModalSubmitting(false);
    }
  };

  const pendingRequests = attempts.filter((a) => a.kind === 'request' && a.status === 'PENDING');
  const handledRequests = attempts.filter((a) => a.kind === 'request' && a.status !== 'PENDING');
  const breaches = attempts.filter((a) => a.kind !== 'request');

  const filteredCompanies = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        ownerName(c.createdBy).toLowerCase().includes(q) ||
        (c.createdBy?.email && c.createdBy.email.toLowerCase().includes(q)),
    );
  }, [companies, searchTerm]);

  const getPaymentBadge = (status?: string) => {
    if (!status) return <span className="text-slate-400 text-xs">—</span>;
    const s = status.toLowerCase();
    if (s === 'active' || s === 'paid' || s === 'approved' || s === 'confirmed') {
      return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">{status}</span>;
    }
    if (s === 'pending') {
      return <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full">{status}</span>;
    }
    return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">{status}</span>;
  };

  return (
    <div className="space-y-8 animate-fadeIn bg-white">
      {/* Page Header with Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <Building2 className="w-6 h-6 text-[#025EA7]" />
            <h1 className="text-2xl font-bold text-slate-900">Companies & Stores</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            View companies owned by company admins — subscription packages, start/end dates, stores, and staff counts.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={refreshAll}
            title="Refresh List"
            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center space-x-2 text-sm font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => {
              setModalError(null);
              setIsCreateCompanyOpen(true);
            }}
            className="px-4 py-3 bg-[#025EA7] hover:bg-[#024A85] text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition flex items-center space-x-2 text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Company</span>
          </button>

          <button
            onClick={() => {
              setModalError(null);
              if (!storeForm.companyId && companies.length > 0) {
                setStoreForm((prev) => ({ ...prev, companyId: companies[0].id }));
              }
              setIsCreateStoreOpen(true);
            }}
            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition flex items-center space-x-2 text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Store</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search company, owner or email..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7]"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#025EA7]"
          >
            <option value="ALL">All Account Statuses</option>
            <option value="active">Active</option>
            <option value="deactivated">Deactivated</option>
            <option value="subscription_expired">Subscription Expired</option>
          </select>
        </div>
      </div>

      {/* Companies Table Listing with Package, Start Date, and End Date */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">All Companies</h2>
          <span className="text-xs text-slate-500">{filteredCompanies.length} companies</span>
        </div>
        {loading ? (
          <div className="py-16 text-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#025EA7] mb-2" />
            <p className="text-sm font-medium">Loading companies...</p>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-slate-700">No companies found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4">Package / Plan</th>
                  <th className="py-3 px-4">Start Date</th>
                  <th className="py-3 px-4">End Date</th>
                  <th className="py-3 px-4">Payment Status</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4 text-center">Stores</th>
                  <th className="py-3 px-4 text-center">Staff</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCompanies.map((comp) => {
                  const startDate = comp.subscription?.subscriptionStartDate;
                  const endDate = comp.subscription?.subscriptionExpiresAt;
                  const isExpired = endDate ? new Date(endDate) < new Date() : false;

                  return (
                    <tr key={comp.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{comp.name}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[180px]">{comp.address || '—'}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-slate-800 font-medium">{ownerName(comp.createdBy)}</p>
                        <p className="text-xs text-slate-400">{comp.createdBy?.email || '—'}</p>
                      </td>
                      <td className="py-3 px-4">
                        {comp.subscription?.planTitle ? (
                          <span className="px-2.5 py-1 bg-blue-50 text-[#025EA7] text-xs font-bold rounded-lg border border-blue-100 inline-block">
                            {comp.subscription.planTitle}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">No plan</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium text-xs">
                        {formatDate(startDate)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5">
                          <span className={`text-xs font-medium ${isExpired ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                            {formatDate(endDate)}
                          </span>
                          {endDate && (
                            <span className={`px-1.5 py-0.5 text-[10px] font-extrabold rounded-md ${isExpired ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {isExpired ? 'EXPIRED' : 'ACTIVE'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">{getPaymentBadge(comp.subscription?.paymentStatus)}</td>
                      <td className="py-3 px-4">
                        <AccountStatusBadge status={comp.accountStatus} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-800">{comp.storesCount ?? 0}</td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-800">{comp.staffCount ?? 0}</td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/dashboard/companies/${comp.id}`}
                          className="inline-flex items-center px-3 py-1.5 bg-[#025EA7] hover:bg-[#024A85] text-white text-xs font-bold rounded-lg transition"
                        >
                          View
                          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Limit request sections */}
      {!attemptsLoading && pendingRequests.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="flex items-center space-x-2 px-5 py-4 bg-amber-50 border-b border-amber-100">
            <CheckCircle2 className="w-5 h-5 text-amber-600" />
            <h2 className="font-bold text-slate-800 text-sm">Company limit requests</h2>
            <span className="ml-auto px-2.5 py-1 bg-amber-100 text-amber-700 font-bold text-xs rounded-full">{pendingRequests.length}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {pendingRequests.map((attempt) => {
              const names = attemptNames(attempt);
              const screenshotResolved = resolveMediaUrl(attempt.screenshotUrl ?? undefined);
              return (
                <div key={attempt.id} className="px-5 py-5 space-y-4">
                  {/* User Info */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-amber-700" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{attempt.userFullName || 'Unknown User'}</p>
                          {attempt.attemptedAt && <p className="text-[11px] text-slate-400">{formatLimitDate(attempt.attemptedAt)}</p>}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pl-10">
                        {attempt.userEmail && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{attempt.userEmail}</span>}
                        {attempt.userPhone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{attempt.userPhone}</span>}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0 pt-1">
                      <button onClick={() => openApproval(attempt)} disabled={actionLoading === attempt.id} className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors">
                        <CheckCircle2 className="w-4 h-4" /><span>Approve</span>
                      </button>
                      <button onClick={() => rejectAttempt(attempt)} disabled={actionLoading === attempt.id} className="flex items-center space-x-1.5 px-3.5 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-xs font-bold transition-colors">
                        <XCircle className="w-4 h-4" /><span>Reject</span>
                      </button>
                    </div>
                  </div>

                  {/* Company Allowance & Requested Names */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Company Allowance</p>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-extrabold text-slate-800">{attempt.numCompanies ?? 0}</span>
                        <span className="text-slate-400">→</span>
                        <span className="text-lg font-extrabold text-emerald-600">{(attempt.numCompanies ?? 0) + names.length}</span>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-bold">+{names.length}</span>
                      </div>
                      {(attempt.currentCompaniesCount != null && attempt.currentCompaniesCount > 0) && (
                        <p className="text-[11px] text-slate-400 mt-1">Currently owns {attempt.currentCompaniesCount} compan{attempt.currentCompaniesCount === 1 ? 'y' : 'ies'}</p>
                      )}
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Requested Companies</p>
                      <div className="flex flex-wrap gap-1.5">
                        {names.map((n, i) => (
                          <span key={n} className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold">
                            {i + 1}. {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Plan & Payment */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {attempt.planTitle && (
                      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Plan</p>
                        <p className="text-sm font-bold text-[#025EA7]">{attempt.planTitle}</p>
                        {attempt.planAmount != null && <p className="text-xs text-slate-500 mt-0.5">ETB {Number(attempt.planAmount).toLocaleString()}</p>}
                      </div>
                    )}
                    {attempt.paymentMethod && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payment Method</p>
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                          <p className="text-sm font-semibold text-slate-700">{attempt.paymentMethod}</p>
                        </div>
                      </div>
                    )}
                    {attempt.paymentRef && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reference</p>
                        <div className="flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5 text-slate-500" />
                          <p className="text-sm font-semibold text-slate-700 font-mono">{attempt.paymentRef}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Screenshot Proof */}
                  {screenshotResolved && (
                    <div className="flex items-center gap-3 p-3 bg-yellow-50/60 rounded-xl border border-yellow-100">
                      <div className="w-16 h-16 rounded-lg overflow-hidden border border-yellow-200 flex-shrink-0 bg-white">
                        <img src={screenshotResolved} alt="Payment proof" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" /> Payment Screenshot</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Click to view full size</p>
                      </div>
                      <button
                        onClick={() => setProofPreview(screenshotResolved)}
                        className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-white border border-yellow-200 hover:bg-yellow-50 text-yellow-700 rounded-lg text-xs font-bold transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!attemptsLoading && handledRequests.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center space-x-2 px-5 py-3 bg-slate-50 border-b border-slate-100">
            <ShieldAlert className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-600 text-xs uppercase tracking-wider">Limit request history</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {handledRequests.map((attempt) => (
              <div key={attempt.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <p className="text-xs text-slate-600 truncate">
                  <span className="font-semibold">{attempt.userFullName || 'User'}</span> → {attemptNames(attempt).map((n) => `"${n}"`).join(', ')}
                </p>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${attempt.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{attempt.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!attemptsLoading && breaches.length > 0 && (
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
          <div className="flex items-center space-x-2 px-5 py-4 bg-red-50 border-b border-red-100">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h2 className="font-bold text-slate-800 text-sm">Users who breached the company limit</h2>
            <span className="ml-auto px-2.5 py-1 bg-red-100 text-red-700 font-bold text-xs rounded-full">
              {breaches.filter((a) => a.status === 'PENDING').length} active
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {breaches.map((attempt) => {
              const names = attemptNames(attempt);
              const isResolved = attempt.status !== 'PENDING';
              return (
                <div key={attempt.id} className={`px-5 py-5 space-y-4 ${isResolved ? 'opacity-50' : ''}`}>
                  {/* Row 1: User identity + status/actions */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-red-700" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{attempt.userFullName || 'Unknown User'}</p>
                          {attempt.attemptedAt && <p className="text-[11px] text-slate-400">{formatLimitDate(attempt.attemptedAt)}</p>}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pl-10">
                        {attempt.userPhone && (
                          <a href={`tel:${attempt.userPhone}`} className="flex items-center gap-1 hover:text-[#025EA7] transition-colors">
                            <Phone className="w-3.5 h-3.5" />{attempt.userPhone}
                          </a>
                        )}
                        {attempt.userEmail && (
                          <a href={`mailto:${attempt.userEmail}`} className="flex items-center gap-1 hover:text-[#025EA7] transition-colors">
                            <Mail className="w-3.5 h-3.5" />{attempt.userEmail}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0 pt-1">
                      {isResolved ? (
                        <span className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                          attempt.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : attempt.status === 'REJECTED' ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>{attempt.status}</span>
                      ) : (
                        <>
                          <button
                            onClick={() => openApproval(attempt)}
                            disabled={actionLoading === attempt.id}
                            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" /><span>Increase Limit & Approve</span>
                          </button>
                          <button
                            onClick={() => rejectAttempt(attempt)}
                            disabled={actionLoading === attempt.id}
                            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-xs font-bold transition-colors"
                          >
                            <XCircle className="w-4 h-4" /><span>Dismiss</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Attempted company name + allowance grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-red-50/60 rounded-xl border border-red-100">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tried to Add</p>
                      <div className="flex flex-wrap gap-1.5">
                        {names.map((n, i) => (
                          <span key={i} className="px-2 py-0.5 bg-red-100 border border-red-200 text-red-800 rounded-lg text-xs font-semibold">
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Company Allowance</p>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-extrabold text-red-600">{attempt.currentCompaniesCount ?? '?'}</span>
                        <span className="text-xs text-slate-400">owned</span>
                        <span className="text-slate-300">/</span>
                        <span className="text-lg font-extrabold text-slate-800">{attempt.numCompanies ?? 1}</span>
                        <span className="text-xs text-slate-400">allowed</span>
                        {(attempt.currentCompaniesCount ?? 0) >= (attempt.numCompanies ?? 1) && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">LIMIT REACHED</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Existing companies */}
                  {attempt.existingCompanyNames && attempt.existingCompanyNames.length > 0 && (
                    <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-100">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Existing Companies</p>
                      <div className="flex flex-wrap gap-1.5">
                        {attempt.existingCompanyNames.map((name, i) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs font-semibold flex items-center gap-1">
                            <Building2 className="w-3 h-3" />{name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Row 4: Plan info */}
                  {(attempt.planTitle || attempt.paymentMethod) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {attempt.planTitle && (
                        <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Active Plan</p>
                          <p className="text-sm font-bold text-[#025EA7]">{attempt.planTitle}</p>
                          {attempt.planAmount != null && (
                            <p className="text-xs text-slate-500 mt-0.5">ETB {Number(attempt.planAmount).toLocaleString()}</p>
                          )}
                        </div>
                      )}
                      {attempt.paymentMethod && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payment Method</p>
                          <div className="flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                            <p className="text-sm font-semibold text-slate-700">{attempt.paymentMethod}</p>
                          </div>
                        </div>
                      )}
                      {attempt.paymentRef && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reference</p>
                          <div className="flex items-center gap-1.5">
                            <Hash className="w-3.5 h-3.5 text-slate-500" />
                            <p className="text-sm font-semibold text-slate-700 font-mono">{attempt.paymentRef}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CREATE COMPANY MODAL */}
      {isCreateCompanyOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-fadeIn border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Building className="w-5 h-5 text-[#025EA7]" />
                <h3 className="text-lg font-bold text-slate-900">Create New Company</h3>
              </div>
              <button onClick={() => setIsCreateCompanyOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateCompany} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  placeholder="e.g. Gelagle Trading PLC"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Assign Company Owner / Admin</label>
                <select
                  value={companyForm.ownerId}
                  onChange={(e) => setCompanyForm({ ...companyForm, ownerId: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7]"
                >
                  <option value="">Unassigned (System Created)</option>
                  {ownersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {formatUserName(u)} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Phone Number (Optional)</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="(09|07)[0-9]{8}"
                  maxLength={10}
                  value={companyForm.phoneDigits}
                  onChange={(e) => {
                    setCompanyForm({ ...companyForm, phoneDigits: normalizeCompanyPhoneInput(e.target.value) });
                    setModalError(null);
                  }}
                  placeholder="09xxxxxxxx or 07xxxxxxxx"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7] text-slate-800 font-medium"
                />
                <p className="text-[11px] text-slate-400 mt-1 font-medium">10 digits, numbers only (e.g. 09xxxxxxxx or 07xxxxxxxx)</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Location / Address</label>
                  <input
                    type="text"
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                    placeholder="Addis Ababa, Bole"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Company Email</label>
                  <input
                    type="email"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    placeholder="info@company.et"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7]"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateCompanyOpen(false)}
                  className="px-4 py-2.5 text-slate-600 font-semibold text-sm hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-5 py-2.5 bg-[#025EA7] hover:bg-[#024A85] text-white font-semibold text-sm rounded-xl shadow-md flex items-center space-x-2 disabled:opacity-50"
                >
                  {modalSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Create Company</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE STORE / BRANCH MODAL */}
      {isCreateStoreOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-fadeIn border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Store className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-900">Create Store / Branch</h3>
              </div>
              <button onClick={() => setIsCreateStoreOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateStore} className="mt-4 space-y-4">
              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Store Category *</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setStoreForm({ ...storeForm, type: 'warehouse' })}
                    className={`py-2 text-xs font-bold rounded-lg transition ${
                      storeForm.type === 'warehouse' ? 'bg-[#025EA7] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Warehouse
                  </button>
                  <button
                    type="button"
                    onClick={() => setStoreForm({ ...storeForm, type: 'shop' })}
                    className={`py-2 text-xs font-bold rounded-lg transition ${
                      storeForm.type === 'shop' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Retail Shop
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Target Company *</label>
                <select
                  required
                  value={storeForm.companyId}
                  onChange={(e) => setStoreForm({ ...storeForm, companyId: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7]"
                >
                  <option value="">Select Company...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Store / Branch Name *</label>
                <input
                  type="text"
                  required
                  value={storeForm.name}
                  onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                  placeholder={storeForm.type === 'warehouse' ? 'e.g. Central Warehouse #1' : 'e.g. Merkato Main Shop'}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Location / Address</label>
                  <input
                    type="text"
                    value={storeForm.location}
                    onChange={(e) => setStoreForm({ ...storeForm, location: e.target.value })}
                    placeholder="Bole Road, Gate 2"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Manager Name</label>
                  <input
                    type="text"
                    value={storeForm.managerName}
                    onChange={(e) => setStoreForm({ ...storeForm, managerName: e.target.value })}
                    placeholder="Abebe Kebede"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#025EA7]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Contact Phone (Optional)</label>
                <div className="flex rounded-xl overflow-hidden border border-slate-200 focus-within:ring-2 focus-within:ring-[#025EA7] bg-slate-50">
                  <span className="px-3.5 py-3 bg-slate-200/80 text-slate-700 font-bold text-sm select-none border-r border-slate-200 flex items-center shrink-0">
                    +251
                  </span>
                  <input
                    type="text"
                    value={storeForm.phoneDigits}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, '');
                      if (val.startsWith('251')) val = val.slice(3);
                      if (val.startsWith('0')) val = val.slice(1);
                      setStoreForm({ ...storeForm, phoneDigits: val });
                    }}
                    placeholder="911234567"
                    className="w-full p-3 bg-transparent text-sm outline-none text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateStoreOpen(false)}
                  className="px-4 py-2.5 text-slate-600 font-semibold text-sm hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-md flex items-center space-x-2 disabled:opacity-50"
                >
                  {modalSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Create Store</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approval Target Dialog */}
      {approvalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={closeApproval}>
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900">Approve company request</h3>

            {/* User summary */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <p className="text-sm font-bold text-slate-800">{approvalTarget.userFullName || 'Unknown User'}</p>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                {approvalTarget.userEmail && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{approvalTarget.userEmail}</span>}
                {approvalTarget.userPhone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{approvalTarget.userPhone}</span>}
              </div>
            </div>

            {/* Companies being requested */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Companies to create</p>
              <div className="flex flex-wrap gap-1.5">
                {attemptNames(approvalTarget).map((n, i) => (
                  <span key={n} className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold">{i + 1}. {n}</span>
                ))}
              </div>
            </div>

            {/* Plan + payment summary row */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {approvalTarget.planTitle && (
                <div className="p-2 bg-blue-50/60 rounded-lg border border-blue-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Plan</p>
                  <p className="font-bold text-[#025EA7] mt-0.5">{approvalTarget.planTitle}</p>
                  {approvalTarget.planAmount != null && <p className="text-slate-500">ETB {Number(approvalTarget.planAmount).toLocaleString()}</p>}
                </div>
              )}
              {approvalTarget.paymentMethod && (
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Payment</p>
                  <p className="font-semibold text-slate-700 mt-0.5">{approvalTarget.paymentMethod}</p>
                  {approvalTarget.paymentRef && <p className="text-slate-500 font-mono">{approvalTarget.paymentRef}</p>}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">New company allowance</label>
              <input type="number" min={1} value={newLimit} onChange={(e) => setNewLimit(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
            </div>
            <div className="flex space-x-3">
              <button onClick={closeApproval} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">Cancel</button>
              <button onClick={() => approveAttempt(approvalTarget, parseInt(newLimit, 10) || undefined)} disabled={!newLimit} className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold">Approve</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment proof lightbox */}
      {proofPreview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm" onClick={() => setProofPreview(null)}>
          <div className="relative max-w-3xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <p className="text-sm font-bold flex items-center space-x-2"><CreditCard className="w-4 h-4 text-yellow-400" /><span>Payment Proof</span></p>
              <button onClick={() => setProofPreview(null)} className="p-1.5 hover:bg-white/10 rounded-lg cursor-pointer transition"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="bg-slate-100 p-4">
              <img src={proofPreview} alt="Payment proof" className="w-full h-auto max-h-[70vh] object-contain rounded-lg" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-200">
              <p className="text-xs text-slate-500">Verification reference for this request.</p>
              <a href={proofPreview} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[#025EA7] hover:underline cursor-pointer">Open in new tab</a>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-20 right-8 z-[60] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium">{toast}</div>
      )}
    </div>
  );
}
