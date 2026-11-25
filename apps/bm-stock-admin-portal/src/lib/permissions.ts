export interface AdminPermission {
  key: string;
  label: string;
  description: string;
  category: 'core' | 'operations' | 'system';
  badgeColor: string;
}

export const ADMIN_PERMISSIONS: AdminPermission[] = [
  {
    key: 'dashboard',
    label: 'Overview & Analytics',
    description: 'Access the main dashboard, quick stats, and company growth metrics.',
    category: 'core',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    key: 'pending_approvals',
    label: 'Pending Approvals',
    description: 'Review pending company registrations, inspect bank payment receipts, and approve/reject accounts.',
    category: 'operations',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    key: 'users',
    label: 'Company Admins',
    description: 'Manage company admin accounts, reset passwords, update details, and view registered users.',
    category: 'operations',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    key: 'companies',
    label: 'Companies & Stores',
    description: 'Browse registered companies, view company profiles, and inspect assigned shops and warehouses.',
    category: 'operations',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    key: 'plans',
    label: 'Subscription Plans',
    description: 'Create and configure subscription tiers, billing periods, pricing packages, and plan limits.',
    category: 'system',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    key: 'issues',
    label: 'Issue Reports',
    description: 'Review reported app bugs, mobile & web error reports, and track issue resolution status.',
    category: 'operations',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    key: 'audit_report',
    label: 'Audit Report',
    description: 'Review audit logs, user login activity history, and platform operational event trails.',
    category: 'system',
    badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
];

export const PERMISSION_PRESETS: { name: string; description: string; permissions: string[] }[] = [
  {
    name: 'Full Access',
    description: 'Grant all operational permissions across the portal',
    permissions: ADMIN_PERMISSIONS.map((p) => p.key),
  },
  {
    name: 'Approvals Officer',
    description: 'Review registrations and verify receipt payments',
    permissions: ['dashboard', 'pending_approvals'],
  },
  {
    name: 'Operations Manager',
    description: 'Manage registered companies, users, and store profiles',
    permissions: ['dashboard', 'companies', 'users'],
  },
  {
    name: 'Support & Audit',
    description: 'Monitor issue reports, error tickets, and audit trails',
    permissions: ['dashboard', 'issues', 'audit_report'],
  },
];

export function getPermissionLabel(key: string): string {
  const perm = ADMIN_PERMISSIONS.find((p) => p.key === key);
  return perm ? perm.label : key;
}

export function getPermissionBadgeClass(key: string): string {
  const perm = ADMIN_PERMISSIONS.find((p) => p.key === key);
  return perm ? perm.badgeColor : 'bg-slate-50 text-slate-700 border-slate-200';
}
