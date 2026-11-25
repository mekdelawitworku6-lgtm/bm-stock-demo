'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import {
  Users,
  Building2,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  ShieldAlert,
  Menu,
  X,
  ChevronRight,
  UserCheck,
  ClipboardCheck,
  BarChart3,
  CreditCard,
  AlertCircle,
  History,
  UserCircle,
  Settings,
  ChevronDown,
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isSuperAdmin, hasPermission, refreshUser } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [openIssuesCount, setOpenIssuesCount] = useState<number | null>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync latest user profile & permissions on mount
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const canViewApprovals = isSuperAdmin || hasPermission('pending_approvals');
  const canViewIssues = isSuperAdmin || hasPermission('issues');

  const fetchPendingCount = useCallback(async () => {
    if (!canViewApprovals) {
      setPendingCount(null);
      return;
    }
    try {
      const data = await api.get('/users/admin/pending');
      const users = Array.isArray(data) ? data : data?.users || [];
      setPendingCount(Array.isArray(users) ? users.length : 0);
    } catch {
      setPendingCount(null);
    }
  }, [canViewApprovals]);

  const fetchOpenIssuesCount = useCallback(async () => {
    if (!canViewIssues) {
      setOpenIssuesCount(null);
      return;
    }
    try {
      const res = await api.get('/issue-reports?status=OPEN');
      const data = res?.data !== undefined ? res.data : res;
      const reports = Array.isArray(data) ? data : [];
      setOpenIssuesCount(reports.length);
    } catch {
      setOpenIssuesCount(null);
    }
  }, [canViewIssues]);

  const userRole = String(user?.role || '').toLowerCase().replace(/[-_ ]/g, '');
  const isAuthorized = userRole === 'admin' || userRole === 'superadmin';

  useEffect(() => {
    if (!isAuthorized) return;

    fetchPendingCount();
    fetchOpenIssuesCount();

    const handleIssuesChanged = () => {
      fetchOpenIssuesCount();
    };
    window.addEventListener('issue_reports_changed', handleIssuesChanged);

    // Periodic poll every 20 seconds for real-time notification
    const interval = setInterval(() => {
      fetchPendingCount();
      fetchOpenIssuesCount();
    }, 20000);

    return () => {
      window.removeEventListener('issue_reports_changed', handleIssuesChanged);
      clearInterval(interval);
    };
  }, [pathname, isAuthorized, fetchPendingCount, fetchOpenIssuesCount]);

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-slate-200 max-w-md">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800">Access Denied</h2>
          <p className="text-sm text-slate-500 mt-2">
            You do not have permission to access the BM Stock Admin Portal. Only system administrators can access this area.
          </p>
          <button
            onClick={logout}
            className="mt-6 px-6 py-2.5 bg-[#025EA7] text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition cursor-pointer"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  const allNavItems = [
    {
      label: 'Overview',
      href: '/dashboard',
      icon: LayoutDashboard,
      permission: 'dashboard',
    },
    {
      label: 'Pending Approvals',
      href: '/dashboard/pending-approvals',
      icon: ClipboardCheck,
      badgeCount: pendingCount,
      badgeColor: 'bg-amber-500',
      permission: 'pending_approvals',
    },
    {
      label: 'Company Admins',
      href: '/dashboard/users',
      icon: Users,
      permission: 'users',
    },
    {
      label: 'Companies & Stores',
      href: '/dashboard/companies',
      icon: Building2,
      permission: 'companies',
    },
    {
      label: 'Subscription Plans',
      href: '/dashboard/plans',
      icon: CreditCard,
      permission: 'plans',
    },
    {
      label: 'Issue Reports',
      href: '/dashboard/issues',
      icon: AlertCircle,
      badgeCount: openIssuesCount,
      badgeColor: 'bg-rose-500',
      permission: 'issues',
    },
    {
      label: 'Audit Report',
      href: '/dashboard/audit-report',
      icon: History,
      permission: 'audit_report',
    },
    {
      label: 'Sub-Admins',
      href: '/dashboard/sub-admins',
      icon: ShieldAlert,
      superAdminOnly: true,
    },
    {
      label: 'My Profile',
      href: '/dashboard/profile',
      icon: UserCircle,
      alwaysShow: true,
    },
  ];

  // Filter out navigation items for which the sub-admin has not been granted permission
  const navItems = allNavItems.filter((item) => {
    if (isSuperAdmin) return true;
    if (item.superAdminOnly) return false;
    if (item.alwaysShow) return true;
    if (item.permission) {
      return hasPermission(item.permission);
    }
    return false;
  });

  // Check if current route requires permission that the user lacks
  const currentNavItem = allNavItems.find(
    (item) => item.href === pathname || (item.href !== '/dashboard' && pathname.startsWith(item.href))
  );

  const isCurrentRouteAllowed = Boolean(
    isSuperAdmin ||
    !currentNavItem ||
    currentNavItem.alwaysShow ||
    (currentNavItem.superAdminOnly ? isSuperAdmin : currentNavItem.permission ? hasPermission(currentNavItem.permission) : true)
  );

  return (
    <div className="min-h-screen bg-white flex text-slate-800">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-72 bg-slate-900 text-white flex-col flex-shrink-0 border-r border-slate-800 shadow-xl">
        {/* Brand Logo */}
        <div className="p-6 flex items-center space-x-3 border-b border-slate-800">
          <div className="w-10 h-10 bg-[#025EA7] rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-wide">BM Stock</h1>
            <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
              Admin Portal
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Management
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            const count = item.badgeCount;
            const hasBadge = count != null && count > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-[#025EA7] text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
                {hasBadge && (
                  <span
                    className={`ml-auto flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full ${item.badgeColor || 'bg-rose-500'} text-[10px] font-bold text-white shadow-sm ring-1 ring-slate-900 ${
                      item.badgeColor === 'bg-rose-500' ? 'animate-pulse' : ''
                    }`}
                  >
                    {count}
                  </span>
                )}
                {isActive && !hasBadge && <ChevronRight className="w-4 h-4 ml-auto text-blue-200" />}
              </Link>
            );
          })}
        </nav>

        {/* Admin User Profile Section */}
        <div className="p-4 m-4 bg-slate-800/80 rounded-2xl border border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-9 h-9 bg-[#025EA7] rounded-full flex items-center justify-center font-bold text-sm text-white shadow">
              {user?.firstName?.charAt(0) || 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="font-semibold text-sm truncate text-white">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Header Bar */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {pathname.startsWith('/dashboard/companies/') && pathname !== '/dashboard/companies'
                  ? 'Company Detail'
                  : pathname.startsWith('/dashboard/users/') && pathname !== '/dashboard/users'
                    ? 'User Detail'
                    : pathname.startsWith('/dashboard/audit-report')
                      ? 'Audit Report & User Activity'
                      : pathname === '/dashboard/sub-admins'
                        ? 'Sub-Admin Management'
                        : allNavItems.find((n) => n.href === pathname)?.label || 'BM Stock Admin'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">BM Stock Enterprise Administration</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="hidden sm:inline-flex items-center px-3.5 py-1.5 bg-blue-50 text-[#025EA7] text-xs font-semibold rounded-full border border-blue-100 shadow-sm">
              <UserCheck className="w-3.5 h-3.5 mr-1.5" />
              System Admin
            </span>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center space-x-2 p-1.5 pr-3 rounded-xl hover:bg-slate-100 transition cursor-pointer border border-transparent hover:border-slate-200"
              >
                <div className="w-8 h-8 bg-[#025EA7] rounded-lg flex items-center justify-center text-xs font-bold text-white">
                  {user?.firstName?.charAt(0) || 'A'}
                </div>
                <span className="hidden sm:block text-sm font-semibold text-slate-700 max-w-[120px] truncate">
                  {user?.firstName}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{user?.email}</p>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <Link
                      href="/dashboard/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center space-x-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition font-medium"
                    >
                      <UserCircle className="w-4 h-4 text-slate-400" />
                      <span>My Profile</span>
                    </Link>
                    <Link
                      href="/dashboard/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center space-x-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition font-medium"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>Account Settings</span>
                    </Link>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-slate-100 pt-1">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition font-medium cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-slate-900 text-white border-b border-slate-800 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              const count = item.badgeCount;
              const hasBadge = count != null && count > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm ${
                    isActive ? 'bg-[#025EA7] text-white' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                  {hasBadge && (
                    <span
                      className={`ml-auto flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full ${item.badgeColor || 'bg-rose-500'} text-[10px] font-bold text-white shadow-sm`}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
            <button
              onClick={logout}
              className="w-full mt-4 flex items-center justify-center space-x-2 px-4 py-3 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-xl font-medium text-sm"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        {/* Page Content Body */}
        <main className="flex-1 p-6 md:p-8 bg-white overflow-y-auto">
          {!isCurrentRouteAllowed ? (
            <div className="min-h-[50vh] flex items-center justify-center p-4">
              <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-slate-200 max-w-md w-full">
                <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Permission Required</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  You do not have permission to view the <span className="font-semibold text-slate-700">{currentNavItem?.label || 'requested'}</span> module. Please contact a Super Administrator if you need access.
                </p>
                <Link
                  href={navItems[0]?.href || '/dashboard/profile'}
                  className="inline-flex mt-6 px-5 py-2.5 bg-[#025EA7] text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition shadow-sm"
                >
                  Go to Permitted Dashboard
                </Link>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
