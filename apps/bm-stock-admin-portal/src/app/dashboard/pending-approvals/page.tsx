'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Building2,
  CreditCard,
  Phone,
  Calendar,
  AlertCircle,
  Sparkles,
  Loader2,
  ShieldAlert,
  AlertTriangle,
  Mail,
  User,
  Hash,
  ImageIcon,
  Eye,
} from 'lucide-react';
import { api } from '@/lib/api';

interface PendingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  status: string;
  createdAt: string;
  numCompanies?: number;
  planTitle?: string;
  planAmount?: number | string | null;
  planPeriod?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentRef?: string;
  paymentScreenshot?: string;
}

interface ApprovalAccount {
  id: string;
  companyName: string;
  ownerName: string;
  phone: string;
  planTitle: string;
  amount: string;
  paymentRef: string;
  paymentMethod?: string;
  paymentScreenshot?: string;
  submittedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  numCompanies?: number;
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

const attemptNames = (attempt: LimitAttempt) =>
  attempt.companyNames && attempt.companyNames.length > 0 ? attempt.companyNames : [attempt.companyName];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `Today, ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  if (hours < 48) return 'Yesterday';
  return d.toLocaleDateString();
}

function resolveMediaUrl(path?: string): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export default function PendingApprovalsPage() {
  const [accounts, setAccounts] = useState<ApprovalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED'>('PENDING');
  const [notification, setNotification] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<LimitAttempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(true);
  const [approvalTarget, setApprovalTarget] = useState<LimitAttempt | null>(null);
  const [newLimit, setNewLimit] = useState<string>('');
  const [limitActionLoading, setLimitActionLoading] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/users/admin/approvals');
      const users: PendingUser[] = Array.isArray(data) ? data : data?.users || [];

      const mapped: ApprovalAccount[] = users.map((u) => ({
        id: u.id,
        companyName: `${u.firstName} ${u.lastName}`,
        ownerName: u.firstName,
        phone: u.phone || '',
        planTitle: u.planTitle || 'Subscription',
        amount: u.planAmount != null ? `ETB ${u.planAmount}` : '—',
        paymentRef: u.paymentRef || '—',
        paymentMethod: u.paymentMethod || undefined,
        paymentScreenshot: u.paymentScreenshot || undefined,
        submittedAt: formatDate(u.createdAt),
        status: u.status?.toLowerCase() === 'pending'
          ? 'PENDING'
          : u.status?.toLowerCase() === 'inactive'
            ? 'REJECTED'
            : 'APPROVED',
        numCompanies: u.numCompanies ?? undefined,
      }));

      setAccounts(mapped);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load pending accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const fetchLimitRequests = useCallback(async () => {
    try {
      const data = await api.get('/companies/admin/limit-attempts');
      setAttempts(Array.isArray(data) ? data : []);
    } catch {
      // Non-admin accounts get a 403 here; keep the section hidden without breaking the page.
    } finally {
      setAttemptsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLimitRequests();
  }, [fetchLimitRequests]);

  const pendingRequests = attempts.filter((a) => a.kind === 'request' && a.status === 'PENDING');

  const openApproval = (attempt: LimitAttempt) => {
    setApprovalTarget(attempt);
    setNewLimit(String((attempt.numCompanies ?? 0) + attemptNames(attempt).length));
  };

  const closeApproval = () => {
    setApprovalTarget(null);
    setLimitActionLoading(null);
  };

  const approveAttempt = async (attempt: LimitAttempt, limit?: number) => {
    setLimitActionLoading(attempt.id);
    try {
      await api.patch(`/companies/admin/limit-attempts/${attempt.id}/approve`, { numCompanies: limit });
      setAttempts((prev) =>
        prev.map((a) => (a.id === attempt.id ? { ...a, status: 'APPROVED', numCompanies: limit ?? a.numCompanies } : a)),
      );
      closeApproval();
      showToast(`Approved "${attempt.companyName}" — allowance raised to ${limit ?? (attempt.numCompanies ?? 0) + 1}.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Request failed';
      showToast(`Failed to approve: ${message}`);
      setLimitActionLoading(null);
    }
  };

  const rejectAttempt = async (attempt: LimitAttempt) => {
    setLimitActionLoading(attempt.id);
    try {
      await api.patch(`/companies/admin/limit-attempts/${attempt.id}/reject`, {});
      setAttempts((prev) => prev.map((a) => (a.id === attempt.id ? { ...a, status: 'REJECTED' } : a)));
      showToast(`Rejected "${attempt.companyName}" — user was notified.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Request failed';
      showToast(`Failed to reject: ${message}`);
    } finally {
      setLimitActionLoading(null);
    }
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleApprove = async (id: string, companyName: string) => {
    setActionLoading(id);
    try {
      await api.post(`/users/admin/${id}/approve`, {});
      setAccounts((prev) =>
        prev.map((acc) => (acc.id === id ? { ...acc, status: 'APPROVED' } : acc))
      );
      showToast(`${companyName} has been APPROVED!`);
    } catch (err: any) {
      showToast(`Failed to approve: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string, companyName: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/users/admin/${id}`, { status: 'inactive' });
      setAccounts((prev) =>
        prev.map((acc) => (acc.id === id ? { ...acc, status: 'REJECTED' } : acc))
      );
      showToast(`${companyName} has been REJECTED.`);
    } catch (err: any) {
      showToast(`Failed to reject: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredAccounts = accounts.filter((acc) => {
    const matchesSearch =
      acc.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.phone.includes(searchTerm);

    if (activeTab === 'ALL') return matchesSearch;
    return matchesSearch && acc.status === activeTab;
  });

  const pendingCount = accounts.filter((a) => a.status === 'PENDING').length;
  const approvedCount = accounts.filter((a) => a.status === 'APPROVED').length;

  return (
    <div className="space-y-6">
      {notification && (
        <div className="fixed top-20 right-8 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center space-x-3 transition-all animate-bounce">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          <span className="text-sm font-medium">{notification}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pending Account Approvals</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review and approve/reject business registration submissions.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold">
            <Clock className="w-4 h-4 mr-1.5 text-amber-600" />
            {pendingCount} Pending Verification
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-100/70 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Awaiting Review</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-0.5">{pendingCount}</h3>
          </div>
        </div>
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-100/70 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved Accounts</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-0.5">{approvedCount}</h3>
          </div>
        </div>
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-100/70 text-[#025EA7] rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Submissions</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-0.5">{accounts.length}</h3>
          </div>
        </div>
      </div>

      {!attemptsLoading && pendingRequests.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="flex items-center space-x-2 px-5 py-4 bg-amber-50 border-b border-amber-100">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <h2 className="font-bold text-slate-800 text-sm">Company Limit Requests</h2>
            <span className="ml-auto px-2.5 py-1 bg-amber-100 text-amber-700 font-bold text-xs rounded-full">{pendingRequests.length}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {pendingRequests.map((attempt) => {
              const names = attemptNames(attempt);
              const screenshotResolved = resolveMediaUrl(attempt.screenshotUrl ?? undefined);
              return (
                <div key={attempt.id} className="px-5 py-5 space-y-4">
                  {/* Row 1: User Info */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-amber-700" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{attempt.userFullName || 'Unknown User'}</p>
                          {attempt.attemptedAt && <p className="text-[11px] text-slate-400">{formatDate(attempt.attemptedAt)}</p>}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pl-10">
                        {attempt.userEmail && (
                          <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{attempt.userEmail}</span>
                        )}
                        {attempt.userPhone && (
                          <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{attempt.userPhone}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0 pt-1">
                      <button onClick={() => openApproval(attempt)} disabled={limitActionLoading === attempt.id} className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors">
                        <CheckCircle2 className="w-4 h-4" /><span>Approve</span>
                      </button>
                      <button onClick={() => rejectAttempt(attempt)} disabled={limitActionLoading === attempt.id} className="flex items-center space-x-1.5 px-3.5 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-xs font-bold transition-colors">
                        <XCircle className="w-4 h-4" /><span>Reject</span>
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Company Allowance & Requested Names */}
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

                  {/* Row 3: Plan & Payment Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {attempt.planTitle && (
                      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Plan</p>
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

                  {/* Row 4: Screenshot Proof */}
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

      {!attemptsLoading && attempts.filter((a) => a.kind !== 'request').length > 0 && (
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
          <div className="flex items-center space-x-2 px-5 py-4 bg-red-50 border-b border-red-100">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h2 className="font-bold text-slate-800 text-sm">Users who breached the company limit</h2>
            <span className="ml-auto px-2.5 py-1 bg-red-100 text-red-700 font-bold text-xs rounded-full">
              {attempts.filter((a) => a.kind !== 'request' && a.status === 'PENDING').length} active
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {attempts.filter((a) => a.kind !== 'request').map((attempt) => {
              const names = attemptNames(attempt);
              const isResolved = attempt.status !== 'PENDING';
              return (
                <div key={attempt.id} className={`px-5 py-5 space-y-4 ${isResolved ? 'opacity-50' : ''}`}>
                  {/* Row 1: User identity + status */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-red-700" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{attempt.userFullName || 'Unknown User'}</p>
                          {attempt.attemptedAt && <p className="text-[11px] text-slate-400">{formatDate(attempt.attemptedAt)}</p>}
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
                            disabled={limitActionLoading === attempt.id}
                            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" /><span>Increase Limit & Approve</span>
                          </button>
                          <button
                            onClick={() => rejectAttempt(attempt)}
                            disabled={limitActionLoading === attempt.id}
                            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-xs font-bold transition-colors"
                          >
                            <XCircle className="w-4 h-4" /><span>Dismiss</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Attempted company name + allowance */}
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

                  {/* Row 3: Existing companies list */}
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

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-xl w-full sm:w-auto">
          <button onClick={() => setActiveTab('PENDING')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'PENDING' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
            Pending ({pendingCount})
          </button>
          <button onClick={() => setActiveTab('APPROVED')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'APPROVED' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
            Approved ({approvedCount})
          </button>
          <button onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
            All Submissions
          </button>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input type="text" placeholder="Search company name..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#025EA7]" />
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-10 h-10 text-slate-300 mx-auto mb-3 animate-spin" />
          <h3 className="text-sm font-semibold text-slate-500">Loading registrations...</h3>
        </div>
      ) : error ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-red-200">
          <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Failed to load</h3>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
          <button onClick={fetchPending} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold">Retry</button>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No registrations found</h3>
          <p className="text-xs text-slate-500 mt-1">All accounts have been reviewed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAccounts.map((account) => (
            <div key={account.id}
              className={`p-6 bg-white rounded-2xl border transition-all shadow-sm hover:shadow-md ${
                account.status === 'PENDING' ? 'border-amber-200/80 bg-amber-50/20'
                : account.status === 'APPROVED' ? 'border-emerald-200/80'
                : 'border-slate-200 opacity-60'
              }`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-start space-x-4">
                  <div className="p-3.5 bg-blue-50 text-[#025EA7] rounded-2xl border border-blue-100 flex-shrink-0 mt-1">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{account.companyName}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-3">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 block uppercase">Owner / Manager</span>
                        <span className="text-xs font-semibold text-slate-800">{account.ownerName}</span>
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 block uppercase">Phone</span>
                        <span className="text-xs font-semibold text-slate-800 flex items-center">
                          <Phone className="w-3 h-3 mr-1 text-slate-400" />
                          {account.phone || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 gap-4">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-left lg:text-right w-full sm:w-auto">
                    <p className="text-xs text-slate-500">
                      Package: <span className="font-semibold text-slate-800">{account.planTitle}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {account.amount}
                      {account.numCompanies != null ? ` · ${account.numCompanies} ${account.numCompanies === 1 ? 'company' : 'companies'} to add` : ''}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5 flex items-center lg:justify-end">
                      <Calendar className="w-3 h-3 mr-1" />
                      {account.submittedAt}
                    </p>
                    {account.paymentMethod && (
                      <p className="text-[11px] text-slate-500 mt-1.5 flex items-center lg:justify-end">
                        <CreditCard className="w-3 h-3 mr-1 text-[#025EA7]" />
                        Paid via <span className="font-semibold text-slate-700 ml-1">{account.paymentMethod}</span>
                        {account.paymentRef !== '—' && (
                          <span className="text-slate-400"> · Ref: {account.paymentRef}</span>
                        )}
                      </p>
                    )}
                    {account.paymentScreenshot && (
                      <button
                        type="button"
                        onClick={() => setProofPreview(resolveMediaUrl(account.paymentScreenshot))}
                        className="mt-2.5 w-full flex items-center justify-center lg:justify-end cursor-pointer group"
                      >
                        <img
                          src={resolveMediaUrl(account.paymentScreenshot) || ''}
                          alt={`Payment proof for ${account.companyName}`}
                          className="w-full max-w-[220px] h-28 object-cover rounded-lg border border-slate-200 bg-white shadow-sm group-hover:border-[#025EA7] transition"
                        />
                      </button>
                    )}
                  </div>
                  {account.status === 'PENDING' ? (
                    <div className="flex items-center space-x-2 w-full sm:w-auto">
                      <button onClick={() => handleApprove(account.id, account.companyName)}
                        disabled={actionLoading === account.id}
                        className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-1.5 transition">
                        {actionLoading === account.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        <span>Approve Account</span>
                      </button>
                      <button onClick={() => handleReject(account.id, account.companyName)}
                        disabled={actionLoading === account.id}
                        className="px-3.5 py-2.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 disabled:text-slate-400 rounded-xl text-xs font-bold border border-slate-200 transition">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold ${
                      account.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-red-100 text-red-800 border border-red-200'
                    }`}>
                      {account.status === 'APPROVED' ? (
                        <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Approved</>
                      ) : (
                        <><XCircle className="w-4 h-4 mr-1.5" /> Rejected</>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {approvalTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={closeApproval}>
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
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
          onClick={() => setProofPreview(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <p className="text-sm font-bold flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-yellow-400" />
                <span>Payment Proof of Payment</span>
              </p>
              <button
                onClick={() => setProofPreview(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg cursor-pointer transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-slate-100 p-4">
              <img
                src={proofPreview}
                alt="Payment proof"
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
              />
            </div>
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-200">
              <p className="text-xs text-slate-500">Verification reference for this registration.</p>
              <a
                href={proofPreview}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-[#025EA7] hover:underline cursor-pointer"
              >
                Open in new tab
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
