'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, Clock, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

// ─── Configuration ───────────────────────────────────────────────
const SESSION_TIMEOUT_MS = 60 * 60 * 1000;       // 1 hour
const WARNING_BEFORE_MS  = 5 * 60 * 1000;        // Show warning 5 min before
const ACTIVITY_THROTTLE_MS = 30 * 1000;           // Throttle activity tracking to every 30s
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  status: string;
  companyId?: string;
  companyName?: string;
  createdAt?: string;
  adminPermissions?: string[];
}

interface SessionInfo {
  sessionStart: number | null;
  lastActivity: number | null;
  timeoutMs: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isSuperAdmin: boolean;
  hasPermission: (permission: string) => boolean;
  refreshUser: () => Promise<void>;
  session: SessionInfo;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  isSuperAdmin: false,
  hasPermission: () => false,
  refreshUser: async () => {},
  session: { sessionStart: null, lastActivity: null, timeoutMs: SESSION_TIMEOUT_MS },
  login: () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [lastActivity, setLastActivity] = useState<number | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityTsRef = useRef<number>(Date.now());
  const throttleRef = useRef<boolean>(false);

  const isAdminRole = (role?: string) => {
    if (!role) return false;
    const normalized = role.toLowerCase().replace(/[-_ ]/g, '');
    return normalized === 'admin' || normalized === 'superadmin';
  };

  // ─── Clear all session timers ────────────────────────────────
  const clearAllTimers = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    logoutTimerRef.current = null;
    warningTimerRef.current = null;
    countdownIntervalRef.current = null;
  }, []);

  // ─── Logout ──────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_session_start');
    localStorage.removeItem('admin_last_activity');
    setToken(null);
    setUser(null);
    setSessionStart(null);
    setLastActivity(null);
    router.push('/login');
  }, [clearAllTimers, router]);

  // ─── Start / Reset the inactivity timer ──────────────────────
  const resetInactivityTimer = useCallback(() => {
    if (!token) return;

    clearAllTimers();
    setShowWarning(false);

    const now = Date.now();
    lastActivityTsRef.current = now;
    setLastActivity(now);
    localStorage.setItem('admin_last_activity', String(now));

    // Set warning timer (fires 5 min before logout)
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(Math.ceil(WARNING_BEFORE_MS / 1000));

      // Start countdown
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // Time's up — log out
            logout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, SESSION_TIMEOUT_MS - WARNING_BEFORE_MS);

    // Set hard logout timer
    logoutTimerRef.current = setTimeout(() => {
      logout();
    }, SESSION_TIMEOUT_MS);
  }, [token, clearAllTimers, logout]);

  // ─── Handle user activity (throttled) ────────────────────────
  const handleActivity = useCallback(() => {
    if (throttleRef.current || !token) return;
    throttleRef.current = true;
    setTimeout(() => { throttleRef.current = false; }, ACTIVITY_THROTTLE_MS);
    resetInactivityTimer();
  }, [token, resetInactivityTimer]);

  // ─── "Stay Logged In" action ─────────────────────────────────
  const stayLoggedIn = useCallback(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const isSuperAdmin = Boolean(
    user?.role && (
      user.role.toUpperCase() === 'SUPER_ADMIN' ||
      user.role.toLowerCase().replace(/[-_ ]/g, '') === 'superadmin'
    )
  );

  const getEffectivePermissions = useCallback((): string[] => {
    if (!user) return [];
    if (isSuperAdmin) {
      return ['dashboard', 'pending_approvals', 'users', 'companies', 'plans', 'issues', 'audit_report'];
    }
    let perms: any = user.adminPermissions;
    if (typeof perms === 'string') {
      try {
        perms = JSON.parse(perms);
      } catch {
        perms = [];
      }
    }
    if (Array.isArray(perms)) {
      return perms.map((p) => String(p).trim().toLowerCase());
    }
    return [];
  }, [user, isSuperAdmin]);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      if (isSuperAdmin) return true;
      const perms = getEffectivePermissions();
      return perms.includes(permission.trim().toLowerCase());
    },
    [user, isSuperAdmin, getEffectivePermissions]
  );

  const refreshUser = useCallback(async () => {
    const currentToken = typeof window !== 'undefined' ? localStorage.getItem('admin_access_token') : null;
    if (!currentToken) return;
    try {
      const data = await api.get('/users/me');
      const profile = data?.data || data;
      if (profile && profile.id) {
        setUser((prev) => {
          const merged = { ...prev, ...profile };
          localStorage.setItem('admin_user', JSON.stringify(merged));
          return merged;
        });
      }
    } catch {
      // background sync failed, ignore
    }
  }, []);

  // ─── Hydrate session from localStorage ───────────────────────
  useEffect(() => {
    const storedToken = localStorage.getItem('admin_access_token');
    const storedUser = localStorage.getItem('admin_user');
    const storedSessionStart = localStorage.getItem('admin_session_start');
    const storedLastActivity = localStorage.getItem('admin_last_activity');

    if (storedToken && storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (isAdminRole(parsed?.role)) {
          // Check if session has already expired
          const lastAct = storedLastActivity ? parseInt(storedLastActivity, 10) : Date.now();
          const elapsed = Date.now() - lastAct;

          if (elapsed >= SESSION_TIMEOUT_MS) {
            // Session expired while away
            localStorage.removeItem('admin_access_token');
            localStorage.removeItem('admin_user');
            localStorage.removeItem('admin_session_start');
            localStorage.removeItem('admin_last_activity');
          } else {
            setToken(storedToken);
            setUser(parsed);
            setSessionStart(storedSessionStart ? parseInt(storedSessionStart, 10) : Date.now());
            setLastActivity(lastAct);
          }
        } else {
          localStorage.removeItem('admin_access_token');
          localStorage.removeItem('admin_user');
        }
      } catch (e) {
        localStorage.removeItem('admin_access_token');
        localStorage.removeItem('admin_user');
      }
    }
    setLoading(false);
    if (storedToken) {
      refreshUser();
    }
  }, [refreshUser]);

  // ─── Route protection ────────────────────────────────────────
  useEffect(() => {
    if (!loading) {
      const publicPaths = ['/login', '/forgot-password'];
      const hasAdminAccess = token && isAdminRole(user?.role);
      if (!hasAdminAccess && !publicPaths.includes(pathname)) {
        router.push('/login');
      } else if (hasAdminAccess && publicPaths.includes(pathname)) {
        router.push('/dashboard');
      }
    }
  }, [token, user, loading, pathname, router]);

  // ─── Attach activity listeners when authenticated ────────────
  useEffect(() => {
    if (!token) return;

    // Start the inactivity timer
    resetInactivityTimer();

    // Attach DOM event listeners
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
    };
  }, [token, handleActivity, resetInactivityTimer, clearAllTimers]);

  // ─── Login ───────────────────────────────────────────────────
  const login = (newToken: string, newUser: User) => {
    if (!isAdminRole(newUser?.role)) {
      throw new Error('Access denied. Only system administrators can access the admin portal.');
    }
    const now = Date.now();
    localStorage.setItem('admin_access_token', newToken);
    localStorage.setItem('admin_user', JSON.stringify(newUser));
    localStorage.setItem('admin_session_start', String(now));
    localStorage.setItem('admin_last_activity', String(now));
    setToken(newToken);
    setUser(newUser);
    setSessionStart(now);
    setLastActivity(now);
    router.push('/dashboard');
  };

  // ─── Format countdown ───────────────────────────────────────
  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isSuperAdmin,
        hasPermission,
        refreshUser,
        session: { sessionStart, lastActivity, timeoutMs: SESSION_TIMEOUT_MS },
        login,
        logout,
      }}
    >
      {children}

      {/* Session Timeout Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Session Expiring</h3>
                <p className="text-white/80 text-xs font-medium">Due to inactivity</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-amber-50 border-4 border-amber-200 flex items-center justify-center">
                <Clock className="w-8 h-8 text-amber-500" />
              </div>
              <p className="text-slate-700 text-sm mb-2">
                Your session will expire in
              </p>
              <p className="text-3xl font-bold text-amber-600 font-mono mb-4">
                {formatCountdown(countdown)}
              </p>
              <p className="text-slate-500 text-xs">
                You will be automatically logged out due to inactivity.
                Click below to continue your session.
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex space-x-3">
              <button
                onClick={logout}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
              <button
                onClick={stayLoggedIn}
                className="flex-1 px-4 py-2.5 bg-[#025EA7] text-white rounded-xl text-sm font-semibold hover:bg-[#024A85] transition shadow-sm cursor-pointer"
              >
                Stay Logged In
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
