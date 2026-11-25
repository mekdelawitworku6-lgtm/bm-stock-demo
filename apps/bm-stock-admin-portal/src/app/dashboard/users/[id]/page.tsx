'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatUserName } from '@/lib/user-display';
import { resolveMediaUrl } from '@/lib/media';
import { AccountStatusBadge } from '@/components/AccountStatusBadge';
import {
  UserRound,
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  IdCard,
  CreditCard,
  Building2,
  Calendar,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  History,
} from 'lucide-react';

interface UserDetail {
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
  planPeriod?: string;
  numCompanies?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentRef?: string;
  paymentScreenshot?: string;
  subscriptionStartDate?: string;
  subscriptionPaymentDate?: string;
  subscriptionNextPaymentDate?: string;
  subscriptionExpiresAt?: string;
  faydaId?: string;
  tin?: string;
}

interface CompanyItem {
  id: string;
  name: string;
  accountStatus?: string;
  storesCount?: number;
  staffCount?: number;
  createdBy?: { id: string } | null;
}

const formatDate = (value?: string) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  if (value.includes('T') && d.getTime() - Date.now() < 24 * 60 * 60 * 1000) {
    return d.toLocaleString();
  }
  return d.toLocaleDateString();
};

const formatAmount = (value?: number) => {
  if (value == null) return '—';
  return `ETB ${Number(value).toLocaleString()}`;
};

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [userData, companiesData] = await Promise.all([
        api.get(`/users/admin/${userId}`),
        api.get('/companies?limit=200&ownerRole=company_admin'),
      ]);
      setUser(userData);
      const list = Array.isArray(companiesData) ? companiesData : companiesData?.data || [];
      setCompanies(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const ownedCompanies = useMemo(
    () => companies.filter((c) => c.createdBy?.id === userId),
    [companies, userId],
  );

  const paymentProofUrl = resolveMediaUrl(user?.paymentScreenshot);

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#025EA7] mb-2" />
        <p className="text-sm font-medium">Loading user details...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="py-24 text-center text-slate-500">
        <AlertCircle className="w-12 h-12 mx-auto text-red-300 mb-3" />
        <p className="font-semibold text-slate-700">Failed to load user</p>
        <button onClick={() => router.push('/dashboard/users')} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold">
          Back to Users
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn bg-white">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-start space-x-4">
          <Link href="/dashboard/users" className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <div className="flex items-center flex-wrap gap-3">
              <UserRound className="w-6 h-6 text-[#025EA7]" />
              <h1 className="text-2xl font-bold text-slate-900">{formatUserName(user)}</h1>
              <span className="px-3 py-1 bg-blue-50 text-[#025EA7] text-xs font-semibold rounded-full border border-blue-100">{user.role}</span>
              <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">{user.status}</span>
            </div>
            <p className="text-sm text-slate-500 mt-1">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center flex-wrap gap-3">
          <Link
            href={`/dashboard/audit-report`}
            className="p-3 bg-blue-50 text-[#025EA7] hover:bg-blue-100 rounded-xl flex items-center space-x-2 text-sm font-semibold border border-blue-200 transition"
          >
            <History className="w-4 h-4" />
            <span>Audit Trail</span>
          </Link>
          <button onClick={fetchData} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center space-x-2 text-sm font-semibold">
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Contact & Identity</h2>
          <InfoRow icon={Mail} label="Email" value={user.email} />
          <InfoRow icon={Phone} label="Phone" value={user.phone || '—'} />
          <InfoRow icon={IdCard} label="Fayda ID" value={user.faydaId || '—'} />
          <InfoRow icon={IdCard} label="TIN" value={user.tin || '—'} />
          <InfoRow icon={Calendar} label="Registered" value={formatDate(user.createdAt)} />
        </section>

        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-[#025EA7]" />
            <span>Subscription</span>
          </h2>
          {user.planTitle ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoRow label="Plan" value={user.planTitle} />
              <InfoRow label="Amount" value={formatAmount(user.planAmount)} />
              <InfoRow label="Payment Status" value={user.paymentStatus || '—'} />
              <InfoRow label="Payment Method" value={user.paymentMethod || '—'} />
              <InfoRow label="Reference" value={user.paymentRef || '—'} />
              <InfoRow label="Companies Allowed" value={String(user.numCompanies ?? '—')} />
              <InfoRow label="Start Date" value={formatDate(user.subscriptionStartDate)} />
              <InfoRow label="Expires" value={formatDate(user.subscriptionExpiresAt)} />
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No subscription on record.</p>
          )}
          {paymentProofUrl && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Payment Proof</p>
              <button type="button" onClick={() => setProofPreview(paymentProofUrl)} className="block max-w-xs rounded-xl border border-slate-200 overflow-hidden">
                <img src={paymentProofUrl} alt="Payment proof" className="w-full h-auto" />
              </button>
            </div>
          )}
        </section>
      </div>

      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
          <Building2 className="w-5 h-5 text-[#025EA7]" />
          <span>Companies Owned</span>
          <span className="px-2 py-0.5 bg-blue-50 text-[#025EA7] text-xs font-bold rounded-full">{ownedCompanies.length}</span>
        </h2>
        {ownedCompanies.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No companies linked to this owner.</p>
        ) : (
          <div className="space-y-2">
            {ownedCompanies.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/companies/${c.id}`}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-[#025EA7]/40 transition"
              >
                <div>
                  <p className="font-semibold text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.storesCount ?? 0} stores · {c.staffCount ?? 0} staff</p>
                </div>
                <div className="flex items-center space-x-3">
                  <AccountStatusBadge status={c.accountStatus} size="sm" />
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {proofPreview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm" onClick={() => setProofPreview(null)}>
          <img src={proofPreview} alt="Payment proof" className="max-w-full max-h-[90vh] rounded-xl shadow-2xl" />
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
