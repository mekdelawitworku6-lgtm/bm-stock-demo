"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, api } from '@/lib/api';
import { DEMO_MODE, seedDemoAuth } from '@/lib/demoMode';

interface RegisterPayload {
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  email?: string;
  sector?: string;
  address?: string;
  numCompanies?: number;
  faydaId?: string;
  tinNumber?: string;
  receiptVerified?: boolean;
  receiptUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  authError: string | null;
  selectedStore: string;
  setSelectedStore: (store: string) => void;
  login: (phone: string, passwordOrPin: string) => Promise<string | null>;
  staffFirstLogin: (payload: { companyName: string; companyPassword?: string; pin: string; phone?: string }) => Promise<string | null>;
  cadminFirstLogin: (payload: { email: string; password: string; pin?: string }) => Promise<{ error: string | null; hasPin?: boolean; user?: User }>;
  saveDeviceConfig: (user: any, role: 'admin' | 'staff', accountId: string, companyName?: string) => void;
  pinUnlock: (payload: { role: 'admin' | 'staff'; accountId: string; pin: string }) => Promise<string | null>;
  register: (payload: RegisterPayload) => Promise<string | null>;
  logout: () => void;
  resetDevice: () => void;
  clearError: () => void;
  updateUser: (partial: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  authError: null,
  selectedStore: 'Store1',
  setSelectedStore: () => {},
  login: async () => null,
  staffFirstLogin: async () => null,
  cadminFirstLogin: async () => ({ error: null }),
  saveDeviceConfig: () => {},
  pinUnlock: async () => null,
  register: async () => null,
  logout: () => {},
  resetDevice: () => {},
  clearError: () => {},
  updateUser: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string>('Store1');

  useEffect(() => {
    if (DEMO_MODE) seedDemoAuth();
    const savedUser = localStorage.getItem('bm_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (_) {}
    }
  }, []);

  const saveDeviceConfig = (resUser: any, role: 'admin' | 'staff', accountId: string, companyName?: string) => {
    localStorage.setItem('auth_device_configured', 'true');
    localStorage.setItem('auth_role', role);
    localStorage.setItem('auth_account_id', accountId);
    const displayName = resUser?.employee?.name || `${resUser?.firstName || ''} ${resUser?.lastName || ''}`.trim() || 'User';
    localStorage.setItem('auth_display_name', displayName);
    const comp = companyName || resUser?.companyName || resUser?.company?.name;
    if (comp) {
      localStorage.setItem('auth_company_name', comp);
    }
    const phone = resUser?.phone || resUser?.employee?.phone || resUser?.username;
    if (phone) {
      localStorage.setItem('auth_phone', phone);
      localStorage.setItem('last_login_phone', phone);
    }
  };

  const handleAuthSuccess = (resUser: any, role: 'admin' | 'staff', accountId: string, companyName?: string, configureDevice: boolean = true) => {
    setUser(resUser);
    localStorage.setItem('bm_user', JSON.stringify(resUser));
    const userCompId = resUser?.companyId || resUser?.company?.id || null;
    const userCompName = companyName || resUser?.companyName || resUser?.company?.name || null;
    api.setSelectedCompany(userCompId, userCompName);

    if (configureDevice) {
      saveDeviceConfig(resUser, role, accountId, userCompName || undefined);
    }
  };

  /** Returns null on success, or an error message string on failure. */
  const login = async (phone: string, passwordOrPin: string): Promise<string | null> => {
    try {
      setAuthError(null);
      const res = await api.login(phone, passwordOrPin);
      handleAuthSuccess(res.user, 'admin', res.user.id);
      return null;
    } catch (err: any) {
      const msg = err?.message || 'Login failed. Please try again.';
      setAuthError(msg);
      return msg;
    }
  };

  const staffFirstLogin = async (payload: { companyName: string; companyPassword?: string; pin: string; phone?: string }): Promise<string | null> => {
    try {
      setAuthError(null);
      const res = await api.staffFirstLogin(payload);
      const employeeId = res.user?.employee?.id || res.user.id;
      handleAuthSuccess(res.user, 'staff', employeeId, payload.companyName, true);
      return null;
    } catch (err: any) {
      const msg = err?.message || 'Staff sign in failed. Please check your company name, phone, and PIN.';
      setAuthError(msg);
      return msg;
    }
  };

  const cadminFirstLogin = async (payload: { email: string; password: string; pin?: string }): Promise<{ error: string | null; hasPin?: boolean; user?: User }> => {
    try {
      setAuthError(null);
      const res = await api.cadminFirstLogin(payload);
      const hasPin = (res.user as any)?.hasPin ?? false;
      // Configure device only if user already has a PIN; otherwise wait until PIN is created
      handleAuthSuccess(res.user, 'admin', res.user.id, undefined, hasPin);
      return { error: null, hasPin, user: res.user };
    } catch (err: any) {
      const msg = err?.message || 'Sign in failed. Please check your phone number and password.';
      setAuthError(msg);
      return { error: msg };
    }
  };

  const pinUnlock = async (payload: { role: 'admin' | 'staff'; accountId: string; pin: string }): Promise<string | null> => {
    try {
      setAuthError(null);
      const res = await api.pinUnlock(payload);
      handleAuthSuccess(res.user, payload.role, payload.accountId, undefined, true);
      return null;
    } catch (err: any) {
      const msg = err?.message || 'Incorrect PIN. Please try again.';
      setAuthError(msg);
      return msg;
    }
  };

  /** Returns null on success, or an error message string on failure. */
  const register = async (payload: RegisterPayload): Promise<string | null> => {
    try {
      setAuthError(null);
      const res = await api.register(payload);
      if (res.user && res.accessToken) {
        handleAuthSuccess(res.user, 'admin', res.user.id, payload.companyName);
        return null;
      }
      return null;
    } catch (err: any) {
      const msg = err?.message || 'Registration failed. Please try again.';
      setAuthError(msg);
      return msg;
    }
  };

  const logout = () => {
    setUser(null);
    setAuthError(null);
    api.setToken(null);
    api.setSelectedCompany(null, null);
    localStorage.removeItem('bm_user');
  };

  const resetDevice = () => {
    logout();
    localStorage.removeItem('auth_device_configured');
    localStorage.removeItem('auth_role');
    localStorage.removeItem('auth_account_id');
    localStorage.removeItem('auth_display_name');
    localStorage.removeItem('auth_company_name');
  };

  const clearError = () => setAuthError(null);

  const updateUser = (partial: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      localStorage.setItem('bm_user', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        authError,
        selectedStore,
        setSelectedStore,
        login,
        staffFirstLogin,
        cadminFirstLogin,
        saveDeviceConfig,
        pinUnlock,
        register,
        logout,
        resetDevice,
        clearError,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
