export type PlanTier = 'trial' | 'small' | 'medium' | 'large';

export interface PlanLimits {
  tier: PlanTier;
  title: string;
  price: string;
  amount: number;
  period: string;
  maxStores: number;
  maxShops: number;
  maxStaff: number;
  allowBulkEntry: boolean;
  allowImport: boolean;
  allowCommission: boolean;
  allowBorrowing: boolean;
  allowWebApp: boolean;
  features: string[];
}

export const PLAN_CONFIGS: Record<PlanTier, PlanLimits> = {
  trial: {
    tier: 'trial',
    title: 'Free Trial (14 Days)',
    price: '0',
    amount: 0,
    period: 'trial',
    maxStores: 1,
    maxShops: 1,
    maxStaff: 1,
    allowBulkEntry: false,
    allowImport: false,
    allowCommission: false,
    allowBorrowing: false,
    allowWebApp: false,
    features: [
      '14-Day Free Trial',
      'All features included for evaluation',
      'Up to 1 store',
      'Up to 1 warehouse',
      'Up to 1 staff account',
      'Single product entry',
      'Mobile app access only',
      'No credit card required',
    ],
  },
  small: {
    tier: 'small',
    title: 'Small Business',
    price: '7,999',
    amount: 7999,
    period: 'small',
    maxStores: 1,
    maxShops: 1,
    maxStaff: 1,
    allowBulkEntry: false,
    allowImport: false,
    allowCommission: false,
    allowBorrowing: false,
    allowWebApp: false,
    features: [
      'Up to 1 store',
      'Up to 1 warehouse',
      'Up to 1 staff account',
      'Single product entry only',
      'Basic analytics & reports',
      'Mobile app access only',
    ],
  },
  medium: {
    tier: 'medium',
    title: 'Medium Business',
    price: '10,999',
    amount: 10999,
    period: 'medium',
    maxStores: 5,
    maxShops: 5,
    maxStaff: 5,
    allowBulkEntry: true,
    allowImport: false,
    allowCommission: false,
    allowBorrowing: false,
    allowWebApp: false,
    features: [
      'Up to 5 stores',
      'Up to 5 shops',
      'Up to 5 staff accounts',
      'Bulk product entry',
      'Advanced analytics & reports',
      'Mobile app access only',
    ],
  },
  large: {
    tier: 'large',
    title: 'Large Business',
    price: '15,999',
    amount: 15999,
    period: 'large',
    maxStores: Infinity,
    maxShops: Infinity,
    maxStaff: Infinity,
    allowBulkEntry: true,
    allowImport: true,
    allowCommission: true,
    allowBorrowing: true,
    allowWebApp: true,
    features: [
      'Unlimited stores',
      'Unlimited shops',
      'Unlimited staff accounts',
      'Bulk product entry',
      'CSV & PDF product importing',
      'Commission management',
      'Product borrowing',
      'Advanced analytics & custom reports',
      'Full Web App & Mobile Access',
      '24/7 priority support',
    ],
  },
};

export function isTrialPlan(planIdentifier?: string | null): boolean {
  if (!planIdentifier) return false;
  const raw = String(planIdentifier).toLowerCase().trim();
  return (
    raw === 'trial' ||
    raw.includes('trial') ||
    raw.includes('free') ||
    raw.includes('14_day') ||
    raw.includes('14-day') ||
    raw.includes('two_week') ||
    raw.includes('2_week') ||
    raw.includes('2-week')
  );
}

export function resolvePlanTier(planIdentifier?: string | null): PlanTier {
  if (!planIdentifier) return 'small';
  const raw = String(planIdentifier).toLowerCase().trim();
  if (isTrialPlan(raw)) {
    return 'trial';
  }
  if (
    raw.includes('large') ||
    raw.includes('enterprise') ||
    raw.includes('15999') ||
    raw.includes('15,999') ||
    raw.includes('14999') ||
    raw.includes('14,999')
  ) {
    return 'large';
  }
  if (
    raw.includes('medium') ||
    raw.includes('growth') ||
    raw.includes('10999') ||
    raw.includes('10,999') ||
    raw.includes('9999') ||
    raw.includes('9,999') ||
    raw.includes('6_month')
  ) {
    return 'medium';
  }
  if (
    raw.includes('small') ||
    raw.includes('starter') ||
    raw.includes('7999') ||
    raw.includes('7,999') ||
    raw.includes('6999') ||
    raw.includes('6,999') ||
    raw.includes('1_month')
  ) {
    return 'small';
  }
  return 'small';
}

export function getUserPlanTier(user?: any): PlanTier {
  if (!user) return 'small';
  const role = String(user.role || '').toLowerCase();
  if (role === 'super_admin' || (user as any).isSuperAdmin) return 'large';

  // Explicit check for trial indicators on user
  if (
    user.isTrial === true ||
    user.isTrial === 'true' ||
    isTrialPlan(user.paymentMethod) ||
    isTrialPlan(user.paymentRef) ||
    isTrialPlan(user.planPeriod) ||
    isTrialPlan(user.planTitle) ||
    isTrialPlan(user.planId) ||
    isTrialPlan(user.company?.planPeriod) ||
    isTrialPlan(user.company?.planId) ||
    isTrialPlan(user.company?.planTitle) ||
    isTrialPlan(user.employee?.company?.planPeriod) ||
    isTrialPlan(user.employee?.company?.planTitle)
  ) {
    return 'trial';
  }

  // Also check planAmount on user or company
  const amount = Number(user.planAmount || user.company?.planAmount || user.employee?.company?.planAmount);
  if (!isNaN(amount) && amount > 0) {
    if (amount >= 14000) return 'large';
    if (amount >= 9000) return 'medium';
    return 'small';
  }

  const planIdent = user.planPeriod || user.planTitle || user.planId || user.company?.planPeriod || user.company?.planTitle || user.company?.planId || user.employee?.company?.planPeriod || user.employee?.company?.planTitle;
  return resolvePlanTier(planIdent);
}

export function getPlanLimits(userOrTier: any): PlanLimits {
  const tier: PlanTier = typeof userOrTier === 'string'
    ? resolvePlanTier(userOrTier)
    : getUserPlanTier(userOrTier);
  return PLAN_CONFIGS[tier];
}

export function canAccessWebApp(user?: any): boolean {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  if (role === 'super_admin' || (user as any).isSuperAdmin) return true;

  // Check if subscription or trial is expired
  const paymentStatus = String(user?.paymentStatus || '').toUpperCase();
  if (user?.status === 'EXPIRED' || paymentStatus === 'EXPIRED') return false;
  if (user?.subscriptionExpiresAt) {
    const exp = new Date(user.subscriptionExpiresAt).getTime();
    if (!isNaN(exp) && exp < Date.now()) return false;
  }

  const tier = getUserPlanTier(user);
  return tier === 'large';
}

export function canUseBulkEntry(user?: any): boolean {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  if (role === 'super_admin' || (user as any).isSuperAdmin) return true;
  const tier = getUserPlanTier(user);
  return tier === 'medium' || tier === 'large' || tier === 'trial';
}

export function canUseProductImport(user?: any): boolean {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  if (role === 'super_admin' || (user as any).isSuperAdmin) return true;
  const tier = getUserPlanTier(user);
  return tier === 'large';
}

export function canUseCommission(user?: any): boolean {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  if (role === 'super_admin' || (user as any).isSuperAdmin) return true;
  const tier = getUserPlanTier(user);
  return tier === 'large' || tier === 'trial';
}

export function canUseBorrowing(user?: any): boolean {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  if (role === 'super_admin' || (user as any).isSuperAdmin) return true;
  const tier = getUserPlanTier(user);
  return tier === 'large' || tier === 'trial';
}

export function canRequestMoreCompanies(user?: any): boolean {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  if (role === 'super_admin' || (user as any).isSuperAdmin) return true;
  const tier = getUserPlanTier(user);
  return tier === 'large';
}
