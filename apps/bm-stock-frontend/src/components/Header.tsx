"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, ChevronDown, LogOut, Building2, Plus, X, CheckCheck, Receipt, CreditCard, Package, Wallet, ArrowLeftRight, BarChart3, Box, Info } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { api, Company, AppNotification } from '@/lib/api';
import { AddCompanyModal, CompanyLimitReachedModal, UpgradePlanModal } from '@/components/Modals';
import { useTranslation, Language } from '@/lib/i18n';
import { getUserPlanTier } from '@/lib/subscriptionPlans';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function notificationIcon(type: string) {
  switch (type) {
    case 'new_sale': return <Receipt className="w-4 h-4" />;
    case 'credit': return <CreditCard className="w-4 h-4" />;
    case 'low_stock': return <Package className="w-4 h-4" />;
    case 'payment': return <Wallet className="w-4 h-4" />;
    case 'transfer': return <ArrowLeftRight className="w-4 h-4" />;
    case 'commission': return <BarChart3 className="w-4 h-4" />;
    case 'borrowing': return <Box className="w-4 h-4" />;
    default: return <Info className="w-4 h-4" />;
  }
}

function notificationColor(type: string): string {
  switch (type) {
    case 'new_sale': return 'bg-emerald-100 text-emerald-700';
    case 'credit': return 'bg-amber-100 text-amber-700';
    case 'low_stock': return 'bg-red-100 text-red-700';
    case 'payment': return 'bg-blue-100 text-[#025EA7]';
    case 'transfer': return 'bg-violet-100 text-violet-700';
    case 'commission': return 'bg-cyan-100 text-cyan-700';
    case 'borrowing': return 'bg-teal-100 text-teal-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

export default function Header() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const { t, language, setLanguage } = useTranslation();
  const router = useRouter();
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [companiesList, setCompaniesList] = useState<Company[]>([]);
  const [selectedCompanyObj, setSelectedCompanyObj] = useState<Company | null>(null);

  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);
  const [isLimitReachedOpen, setIsLimitReachedOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);

  // Notification state
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCompanies = async (preferCompanyId?: string) => {
    try {
      const isPlanTitle = (name?: string) => {
        if (!name) return false;
        const lower = name.toLowerCase().trim();
        return (
          lower === 'for 1 year' ||
          lower === 'for 1 month' ||
          lower === 'for 6 months' ||
          lower === '1 year unlimited license' ||
          lower === 'subscription plan upgrade' ||
          lower === '1_year' ||
          lower === '1 year' ||
          lower === '6 months' ||
          lower === '1 month'
        );
      };

      const comps = await api.getCompanies();
      let list: Company[] = comps.filter((c) => !isPlanTitle(c.name));

      const userCompName = user?.companyName;
      const userCompId = (user as any)?.companyId;

      if (userCompName && !isPlanTitle(userCompName) && !list.some((c) => c.name === userCompName || (userCompId && c.id === userCompId))) {
        list.unshift({
          id: userCompId || '',
          name: userCompName,
        });
      }

      if (list.length === 0) {
        list.push({ id: userCompId || '', name: (userCompName && !isPlanTitle(userCompName)) ? userCompName : 'Main Company' });
      }

      setCompaniesList(list);

      const targetId = preferCompanyId || api.getSelectedCompanyId();
      const savedMatch = targetId ? list.find((c) => c.id === targetId) : null;
      const userMatch = userCompId ? list.find((c) => c.id === userCompId) : null;
      const active = savedMatch || userMatch || list[0];

      if (active) {
        setSelectedCompanyObj(active);
        api.setSelectedCompany(active.id, active.name);
      }
    } catch {
      const fallback: Company = {
        id: (user as any)?.companyId || '',
        name: user?.companyName || 'Main Company',
      };
      setCompaniesList([fallback]);
      setSelectedCompanyObj(fallback);
      api.setSelectedCompany(fallback.id, fallback.name);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, [user?.companyName]);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    try {
      const [notifs, count] = await Promise.all([
        api.getNotifications(30),
        api.getUnreadNotificationCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch {
      // silently fail
    }
  }, []);

  // Load unread count only (lightweight poll)
  const loadUnreadCount = useCallback(async () => {
    try {
      const count = await api.getUnreadNotificationCount();
      setUnreadCount(count);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();
    // Poll every 30 seconds for unread count
    pollTimerRef.current = setInterval(loadUnreadCount, 30000);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [loadUnreadCount]);

  // When opening notification panel, load full list
  useEffect(() => {
    if (showNotifications) {
      setNotifLoading(true);
      loadNotifications().finally(() => setNotifLoading(false));
    }
  }, [showNotifications, loadNotifications]);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      showToast('Failed to mark notification as read', 'error');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      showToast('Failed to mark all as read', 'error');
    }
  };

  const userName = user?.employee?.name || (user as any)?.employeeName || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User');
  const allowedCompaniesCount = (user as any)?.numCompanies || (user as any)?.companyLimit || 1;

  const handleSelectCompany = (comp: Company) => {
    setSelectedCompanyObj(comp);
    setShowCompanyDropdown(false);
    api.setSelectedCompany(comp.id, comp.name);
    showToast(`Switched active company to ${comp.name}`, 'info');
  };

  const handleAddCompanyClick = () => {
    setShowCompanyDropdown(false);
    const tier = getUserPlanTier(user);
    const isLargeOrAdmin = tier === 'large' || user?.role === 'admin' || user?.role === 'super_admin' || (user as any)?.isSuperAdmin;
    if (!isLargeOrAdmin) {
      showToast('Managing multiple companies is exclusive to the Large Business plan. Please upgrade.', 'info');
      setIsUpgradeOpen(true);
      return;
    }
    if (companiesList.length < allowedCompaniesCount) {
      setIsAddCompanyOpen(true);
    } else {
      setIsLimitReachedOpen(true);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="flex items-center justify-between py-2 px-1 mb-6 border-b border-slate-100 pb-4">
      {/* Greeting Title */}
      <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
        <span>Welcome {userName}</span>
      </h1>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowCompanyDropdown(false);
            }}
            className="w-10 h-10 rounded-full bg-[#E3F2FD] text-[#025EA7] hover:bg-blue-100 flex items-center justify-center border border-blue-100 transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown Panel */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 animate-fade-in overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      className="text-[11px] font-bold text-[#025EA7] hover:text-[#014883] px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark all read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowNotifications(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Notification List */}
              <div className="max-h-[400px] overflow-y-auto">
                {notifLoading ? (
                  <div className="py-10 text-center text-xs text-slate-400 animate-pulse">
                    Loading notifications...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    <div className="text-xs text-slate-400 font-medium">No notifications yet</div>
                    <div className="text-[11px] text-slate-300 mt-0.5">You&apos;re all caught up!</div>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          if (!n.isRead) handleMarkAsRead(n.id);
                        }}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors group ${
                          n.isRead
                            ? 'bg-white hover:bg-slate-50'
                            : 'bg-blue-50/40 hover:bg-blue-50/70'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${notificationColor(n.type)}`}>
                          {notificationIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-semibold truncate ${n.isRead ? 'text-slate-700' : 'text-slate-900'}`}>
                              {n.title}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-slate-400 font-medium">
                                {timeAgo(n.createdAt)}
                              </span>
                              {!n.isRead && (
                                <span className="w-2 h-2 bg-[#025EA7] rounded-full shrink-0" />
                              )}
                            </div>
                          </div>
                          <p className={`text-[11px] mt-0.5 line-clamp-2 ${n.isRead ? 'text-slate-400' : 'text-slate-500'}`}>
                            {n.message}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
                  <div className="text-[10px] text-slate-400 text-center font-medium">
                    Showing latest {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Company Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowCompanyDropdown(!showCompanyDropdown);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#E3F2FD] hover:bg-blue-100/80 border border-blue-200/60 text-[#025EA7] text-xs font-semibold rounded-xl transition-all"
          >
            <Building2 className="w-4 h-4" />
            <span>{selectedCompanyObj?.name || 'Select Company'}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>

          {showCompanyDropdown && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50 animate-fade-in">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Active Corporate Entity / Company
              </div>
              {companiesList.map((comp) => (
                <button
                  key={comp.id || comp.name}
                  onClick={() => handleSelectCompany(comp)}
                  className={`w-full text-left px-3.5 py-2 text-xs font-medium transition-colors ${
                    selectedCompanyObj?.id === comp.id || selectedCompanyObj?.name === comp.name
                      ? 'bg-blue-50 text-[#025EA7] font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {comp.name}
                </button>
              ))}

              <div className="border-t border-slate-100 my-1"></div>

              <button
                type="button"
                onClick={handleAddCompanyClick}
                className="w-full text-left px-3.5 py-2 text-xs font-bold text-[#025EA7] hover:bg-blue-50 flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Company</span>
              </button>
            </div>
          )}
        </div>

        {/* Language Selector Dropdown */}
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          className="px-2.5 py-2 bg-[#E3F2FD] border border-blue-200/60 text-[#025EA7] text-xs font-bold rounded-xl focus:outline-none cursor-pointer"
        >
          <option value="en">🇬🇧 EN</option>
          <option value="am">🇪🇹 አማርኛ</option>
          <option value="om">🇪🇹 Afaan Oromoo</option>
        </select>

        {/* Dark Red Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-[#8B0000] hover:bg-[#700000] active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>{t('logout')}</span>
        </button>
      </div>

      {/* Modals */}
      <AddCompanyModal
        isOpen={isAddCompanyOpen}
        onClose={() => setIsAddCompanyOpen(false)}
        onSuccess={(createdComp?: any) => loadCompanies(createdComp?.id)}
      />

      <CompanyLimitReachedModal
        isOpen={isLimitReachedOpen}
        onClose={() => setIsLimitReachedOpen(false)}
        allowedCount={allowedCompaniesCount}
        onAddMoreCompanies={() => setIsUpgradeOpen(true)}
      />

      <UpgradePlanModal
        isOpen={isUpgradeOpen}
        onClose={() => setIsUpgradeOpen(false)}
      />
    </header>
  );
}
