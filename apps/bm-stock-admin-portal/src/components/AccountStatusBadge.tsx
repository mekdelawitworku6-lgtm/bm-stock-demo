import { Ban, CheckCircle2, ShieldAlert } from 'lucide-react';

export type AccountStatus = 'active' | 'deactivated' | 'subscription_expired' | string;

export function accountStatusLabel(status?: string): string {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'Active';
    case 'deactivated':
      return 'Deactivated';
    case 'subscription_expired':
      return 'Subscription Expired';
    default:
      return status || 'Unknown';
  }
}

export function accountStatusDescription(status?: string): string {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'Company and users can access the system normally.';
    case 'deactivated':
      return 'Admin deactivated this company. All users are blocked from signing in.';
    case 'subscription_expired':
      return 'The owner subscription has expired. Users are blocked until payment is renewed.';
    default:
      return 'Account status could not be determined.';
  }
}

export function AccountStatusBadge({
  status,
  size = 'md',
}: {
  status?: string;
  size?: 'sm' | 'md';
}) {
  const padding = size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-1.5';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  switch (status?.toLowerCase()) {
    case 'active':
      return (
        <span className={`inline-flex items-center ${padding} bg-emerald-50 text-emerald-700 font-semibold text-xs rounded-full border border-emerald-200`}>
          <CheckCircle2 className={`${iconSize} mr-1.5`} /> Active
        </span>
      );
    case 'deactivated':
      return (
        <span className={`inline-flex items-center ${padding} bg-red-50 text-red-700 font-semibold text-xs rounded-full border border-red-200`}>
          <Ban className={`${iconSize} mr-1.5`} /> Deactivated
        </span>
      );
    case 'subscription_expired':
      return (
        <span className={`inline-flex items-center ${padding} bg-amber-50 text-amber-700 font-semibold text-xs rounded-full border border-amber-200`}>
          <ShieldAlert className={`${iconSize} mr-1.5`} /> Subscription Expired
        </span>
      );
    default:
      return (
        <span className={`${padding} bg-slate-100 text-slate-600 font-semibold text-xs rounded-full`}>
          {status || 'Unknown'}
        </span>
      );
  }
}
