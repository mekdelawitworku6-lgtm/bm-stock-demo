// Portfolio demo mode.
// When NEXT_PUBLIC_DEMO_MODE=true the web app runs entirely on local sample
// data, with no backend required. See DEPLOY.md for details.

import type { User } from './api';

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const DEMO_COMPANY_ID = 'b1f4a1c0-7d1e-4a2b-9f3a-2c9d5e6f7a01';
export const DEMO_USER_ID = 'a1b2c3d4-1111-4222-8333-444455556666';
export const DEMO_TOKEN = 'bm-demo-access-token';

export const DEMO_USER: User = {
  id: DEMO_USER_ID,
  email: 'demo@gelagle.com',
  phone: '+251911000123',
  firstName: 'Demo',
  lastName: 'Admin',
  companyId: DEMO_COMPANY_ID,
  companyName: 'Gelagle Trading House',
  role: 'super_admin',
  status: 'ACTIVE',
  planId: 'plan_enterprise',
  planTitle: 'Enterprise Plan',
  planAmount: 18000,
  planPeriod: 'yearly',
  subscriptionStartDate: '2026-01-01T00:00:00.000Z',
  subscriptionExpiresAt: '2030-12-31T23:59:59.000Z',
  subscriptionNextPaymentDate: '2027-01-01T00:00:00.000Z',
  paymentStatus: 'PAID',
  company: { id: DEMO_COMPANY_ID, name: 'Gelagle Trading House' },
  hasPin: true,
  employee: {
    id: DEMO_USER_ID,
    name: 'Demo Admin',
    jobTitle: 'Operations Manager',
    role: 'super_admin',
    permissions: {},
  },
};

/**
 * Seeds the same localStorage state a successful login would create.
 * Existing state is left alone so a viewer can still log out and explore login.
 */
export function seedDemoAuth(): void {
  if (!DEMO_MODE || typeof window === 'undefined') return;
  const storage = window.localStorage;
  if (storage.getItem('bm_user')) return;

  storage.setItem('bm_user', JSON.stringify(DEMO_USER));
  storage.setItem('bm_access_token', DEMO_TOKEN);
  storage.setItem('bm_selected_company_id', DEMO_COMPANY_ID);
  storage.setItem('bm_selected_company_name', DEMO_USER.companyName || 'Gelagle Trading House');
  storage.setItem('auth_device_configured', 'true');
  storage.setItem('auth_role', 'admin');
  storage.setItem('auth_account_id', DEMO_USER_ID);
  storage.setItem('auth_display_name', 'Demo Admin');
  storage.setItem('auth_company_name', DEMO_USER.companyName || 'Gelagle Trading House');
  storage.setItem('auth_phone', DEMO_USER.phone || '+251911000123');
  storage.setItem('last_login_phone', DEMO_USER.phone || '+251911000123');
}
