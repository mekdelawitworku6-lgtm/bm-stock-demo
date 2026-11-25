'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { AccountStatusBadge, accountStatusDescription } from '@/components/AccountStatusBadge';
import { resolveMediaUrl } from '@/lib/media';
import { formatUserName } from '@/lib/user-display';
import {
  Building2,
  ArrowLeft,
  Loader2,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Warehouse,
  Store,
  Users,
  UserCog,
  CreditCard,
  ShieldAlert,
  Ban,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  UserRound,
  History,
  IdCard,
  ExternalLink,
} from 'lucide-react';

interface CompanyDetail {
  id: string;
  name: string;
  address?: string;
  email?: string;
  phoneNumber?: string;
  description?: string;
  status?: string;
  accountStatus?: string;
  storesCount?: number;
  staffCount?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    numCompanies?: number | null;
    faydaId?: string;
    tin?: string;
  } | null;
  subscription?: {
    planTitle?: string;
    planAmount?: number;
    planPeriod?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    paymentRef?: string;
    paymentScreenshot?: string;
    subscriptionStartDate?: string;
    subscriptionPaymentDate?: string;
    subscriptionNextPaymentDate?: string;
    subscriptionExpiresAt?: string;
  };
  paymentHistory?: {
    id: string;
    type: string;
    description?: string;
    amount?: number;
    method?: string;
    reference?: string;
    status?: string;
    paidAt?: string;
  }[];
  warehouses: { id: string; name: string }[];
  shops: { id: string; name: string }[];
  users: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    role: string;
    status: string;
    createdAt?: string;
  }[];
  employees: {
    id: string;
    name: string;
    phoneNumber?: string;
    jobTitle?: string;
    userName?: string;
    userEmail?: string;
  }[];
}

const ownerName = (owner: CompanyDetail['createdBy']) => {
  if (!owner) return 'Unassigned';
  return formatUserName(owner);
};

const isStaffAccount = (role: string) =>
  !['company_admin', 'admin', 'super_admin'].includes(role?.toLowerCase());

const formatDate = (value?: string) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
};

const formatAmount = (value?: number) => {
  if (value == null) return '—';
  return `ETB ${Number(value).toLocaleString()}`;
};

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;

  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/companies/admin/${companyId}/detail`);
      setDetail(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load company details');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleDeactivate = async () => {
    if (!confirm('Deactivate this company? Users will not be able to access their account.')) return;
    setActionLoading(true);
    try {
      const data = await api.patch(`/companies/admin/${companyId}/deactivate`, {});
      setDetail(data);
      showToast('Company deactivated successfully.');
    } catch (err: any) {
      showToast(`Failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    setActionLoading(true);
    try {
      const data = await api.patch(`/companies/admin/${companyId}/reactivate`, {});
      setDetail(data);
      showToast('Company reactivated successfully.');
    } catch (err: any) {
      showToast(`Failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const roleLabel = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: 'Super Admin',
      admin: 'Admin',
      company_admin: 'Company Admin',
      manager: 'Manager',
      user: 'Staff',
    };
    return labels[role] || role || '—';
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#025EA7] mb-2" />
        <p className="text-sm font-medium">Loading company details...</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="py-24 text-center text-slate-500">
        <AlertCircle className="w-12 h-12 mx-auto text-red-300 mb-3" />
        <p className="font-semibold text-slate-700">Failed to load company</p>
        <p className="text-xs text-slate-400 mt-1">{error}</p>
        <button onClick={() => router.push('/dashboard/companies')} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold">
          Back to Companies
        </button>
      </div>
    );
  }

  const isDeactivated = detail.accountStatus === 'deactivated';
  const isExpired = detail.accountStatus === 'subscription_expired';
  const paymentProofUrl = resolveMediaUrl(detail.subscription?.paymentScreenshot);
  const staffAccounts = detail.users.filter((u) => isStaffAccount(u.role));

  return (
    <div className="space-y-8 animate-fadeIn bg-white">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-start space-x-4">
          <Link
            href="/dashboard/companies"
            className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <div className="flex items-center flex-wrap gap-3">
              <Building2 className="w-6 h-6 text-[#025EA7]" />
              <h1 className="text-2xl font-bold text-slate-900">{detail.name}</h1>
              <AccountStatusBadge status={detail.accountStatus} />
            </div>
            <p className="text-xs font-mono text-slate-400 mt-1">ID: {detail.id}</p>
            {detail.createdBy && (
              <p className="text-sm text-slate-500 mt-1 flex items-center space-x-1.5">
                <UserRound className="w-4 h-4" />
                <span>Owner: {ownerName(detail.createdBy)}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          <button
            onClick={fetchDetail}
            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center space-x-2 text-sm font-semibold"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
          {isDeactivated ? (
            <button
              onClick={handleReactivate}
              disabled={actionLoading}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center space-x-2"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Reactivate Company</span>
            </button>
          ) : (
            <button
              onClick={handleDeactivate}
              disabled={actionLoading}
              className="px-5 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center space-x-2"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              <span>Deactivate Company</span>
            </button>
          )}
        </div>
      </div>

      <section className={`p-5 rounded-2xl border shadow-sm ${
        isDeactivated
          ? 'bg-red-50 border-red-200'
          : isExpired
            ? 'bg-amber-50 border-amber-200'
            : 'bg-emerald-50 border-emerald-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Account Status</p>
            <AccountStatusBadge status={detail.accountStatus} />
            <p className="text-sm text-slate-600 mt-2">{accountStatusDescription(detail.accountStatus)}</p>
          </div>
          {isExpired && !isDeactivated && (
            <p className="text-xs text-amber-800 bg-amber-100/80 px-3 py-2 rounded-xl border border-amber-200 max-w-md">
              Subscription expired — users cannot sign in. Deactivate only if you need to block access for other reasons; renewal restores access.
            </p>
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 text-center">
          <Store className="w-5 h-5 mx-auto text-[#025EA7] mb-1" />
          <p className="text-2xl font-extrabold text-slate-900">{detail.storesCount ?? detail.shops.length + detail.warehouses.length}</p>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Stores</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 text-center">
          <Users className="w-5 h-5 mx-auto text-[#025EA7] mb-1" />
          <p className="text-2xl font-extrabold text-slate-900">{detail.staffCount ?? staffAccounts.length}</p>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Staff</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 text-center">
          <Warehouse className="w-5 h-5 mx-auto text-[#025EA7] mb-1" />
          <p className="text-2xl font-extrabold text-slate-900">{detail.warehouses.length}</p>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Warehouses</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 text-center">
          <UserCog className="w-5 h-5 mx-auto text-[#025EA7] mb-1" />
          <p className="text-2xl font-extrabold text-slate-900">{detail.employees.length}</p>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Employees</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-[#025EA7]" />
            <span>Company Information</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow icon={MapPin} label="Address" value={detail.address || 'Not specified'} />
            <InfoRow icon={Phone} label="Phone" value={detail.phoneNumber || 'Not specified'} />
            <InfoRow icon={Mail} label="Email" value={detail.email || 'Not specified'} />
            <InfoRow icon={Calendar} label="Registered" value={formatDate(detail.createdAt)} />
          </div>
          {detail.description && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Description</p>
              <p className="text-sm text-slate-700">{detail.description}</p>
            </div>
          )}
        </section>

        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <UserRound className="w-5 h-5 text-[#025EA7]" />
            <span>Owner / Admin</span>
          </h2>
          {detail.createdBy ? (
            <div className="space-y-3">
              <InfoRow label="Name" value={ownerName(detail.createdBy)} />
              <InfoRow icon={Mail} label="Email" value={detail.createdBy.email || '—'} />
              <InfoRow icon={Phone} label="Phone" value={detail.createdBy.phone || '—'} />
              <InfoRow icon={IdCard} label="Fayda ID" value={detail.createdBy.faydaId || '—'} />
              <InfoRow icon={IdCard} label="TIN" value={detail.createdBy.tin || '—'} />
              <Link
                href={`/dashboard/users/${detail.createdBy.id}`}
                className="inline-flex items-center text-sm font-semibold text-[#025EA7] hover:underline"
              >
                View owner profile
                <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </Link>
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No owner linked.</p>
          )}
        </section>
      </div>

      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
          <CreditCard className="w-5 h-5 text-[#025EA7]" />
          <span>Subscription</span>
        </h2>
        {detail.subscription?.planTitle ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoRow label="Plan" value={detail.subscription.planTitle} />
            <InfoRow label="Amount" value={formatAmount(detail.subscription.planAmount)} />
            <InfoRow label="Payment Status" value={detail.subscription.paymentStatus || '—'} />
            <InfoRow label="Payment Method" value={detail.subscription.paymentMethod || '—'} />
            <InfoRow label="Start Date" value={formatDate(detail.subscription.subscriptionStartDate)} />
            <InfoRow label="Last Payment" value={formatDate(detail.subscription.subscriptionPaymentDate)} />
            <InfoRow label="Next Payment" value={formatDate(detail.subscription.subscriptionNextPaymentDate)} />
            <InfoRow label="Expires" value={formatDate(detail.subscription.subscriptionExpiresAt)} />
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">No subscription on record.</p>
        )}
        {paymentProofUrl && (
          <div className="pt-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Payment Proof</p>
            <button
              type="button"
              onClick={() => setProofPreview(paymentProofUrl)}
              className="block max-w-xs rounded-xl border border-slate-200 overflow-hidden hover:ring-2 hover:ring-[#025EA7] transition"
            >
              <img src={paymentProofUrl} alt="Payment proof" className="w-full h-auto object-cover" />
            </button>
          </div>
        )}
      </section>

      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
          <History className="w-5 h-5 text-[#025EA7]" />
          <span>Payment History</span>
        </h2>
        {!detail.paymentHistory?.length ? (
          <p className="text-sm text-slate-400 italic">No payment records.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.paymentHistory.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4">{formatDate(p.paidAt)}</td>
                    <td className="py-3 px-4">{p.description || p.type}</td>
                    <td className="py-3 px-4">{formatAmount(p.amount)}</td>
                    <td className="py-3 px-4">{p.method || '—'}</td>
                    <td className="py-3 px-4 font-mono text-xs">{p.reference || '—'}</td>
                    <td className="py-3 px-4">{p.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
          <Store className="w-5 h-5 text-[#025EA7]" />
          <span>Stores</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...detail.shops.map((s) => ({ ...s, type: 'Shop' })), ...detail.warehouses.map((w) => ({ ...w, type: 'Warehouse' }))].map((item) => (
            <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center space-x-3">
              <div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center">
                {item.type === 'Shop' ? <Store className="w-4 h-4 text-[#025EA7]" /> : <Warehouse className="w-4 h-4 text-[#025EA7]" />}
              </div>
              <div>
                <p className="font-medium text-slate-800 text-sm">{item.name}</p>
                <p className="text-xs text-slate-400">{item.type}</p>
              </div>
            </div>
          ))}
          {detail.shops.length === 0 && detail.warehouses.length === 0 && (
            <p className="text-sm text-slate-400 italic col-span-2">No stores linked.</p>
          )}
        </div>
      </section>

      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
          <Users className="w-5 h-5 text-[#025EA7]" />
          <span>Staff Accounts</span>
        </h2>
        {staffAccounts.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No staff accounts.</p>
        ) : (
          <div className="space-y-2">
            {staffAccounts.map((u) => (
              <div key={u.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{formatUserName(u)}</p>
                  <p className="text-xs text-slate-500">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">{roleLabel(u.role)}</span>
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">{u.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {toast && (
        <div className="fixed top-20 right-8 z-[60] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium">
          {toast}
        </div>
      )}

      {proofPreview && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
          onClick={() => setProofPreview(null)}
        >
          <img src={proofPreview} alt="Payment proof preview" className="max-w-full max-h-[90vh] rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className="text-sm text-slate-700 flex items-center space-x-1.5">
        {Icon && <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        <span className="break-all">{value}</span>
      </p>
    </div>
  );
}
