'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Download,
  Calendar,
  User,
  Shield,
  Clock,
  Layers,
  Activity,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Copy,
  Check,
  Globe,
  SlidersHorizontal,
  FileSpreadsheet,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Edit3,
  Trash2,
  KeyRound,
  LogIn,
  LogOut,
  ToggleLeft,
  UserCheck,
  Monitor,
  Users,
} from 'lucide-react';

interface AuditLog {
  id: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  action: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  module?: string;
  method?: string;
  endpoint?: string;
  createdAt?: string;
}

interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  actionCount: number;
}

interface AuditStats {
  totalLogs: number;
  todayLogs: number;
  uniqueUsers: number;
  actionBreakdown: Record<string, number>;
  moduleBreakdown: Record<string, number>;
  userBreakdown?: Array<{ name: string; email: string; role: string; count: number }>;
  recentActivity: AuditLog[];
}

export default function AuditReportPage() {
  // Data state
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Users list for filtering
  const [usersList, setUsersList] = useState<UserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState<'today' | '7days' | '30days' | 'all'>('all');

  // View state
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Fetch summary stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await api.get('/audit-logs/stats');
      const data = res?.data !== undefined ? res.data : res;
      setStats(data);
    } catch (err) {
      console.error('Failed to load audit stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch users for filter dropdown
  const fetchUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const res = await api.get('/audit-logs/users');
      const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setUsersList(data);
    } catch (err) {
      console.error('Failed to load users list for audit filter:', err);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // Fetch available modules
  const fetchModules = useCallback(async () => {
    try {
      const res = await api.get('/audit-logs/modules');
      const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      if (data.length > 0) {
        setAvailableModules(data);
      } else {
        setAvailableModules(['users', 'companies', 'shops', 'products', 'inventory', 'sales', 'plans', 'borrowing', 'credits', 'issue-reports', 'auth', 'collections']);
      }
    } catch {
      setAvailableModules(['users', 'companies', 'shops', 'products', 'inventory', 'sales', 'plans', 'borrowing', 'credits', 'issue-reports', 'auth', 'collections']);
    }
  }, []);

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      params.append('sortBy', 'timestamp');
      params.append('sortOrder', 'DESC');

      if (search.trim()) params.append('search', search.trim());
      if (userFilter !== 'ALL') params.append('userId', userFilter);
      if (roleFilter !== 'ALL') params.append('role', roleFilter);
      if (actionFilter !== 'ALL') params.append('action', actionFilter.toLowerCase());
      if (moduleFilter !== 'ALL') params.append('module', moduleFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await api.get(`/audit-logs?${params.toString()}`);

      let items: AuditLog[] = [];
      let totalCount = 0;
      let totalP = 1;

      if (Array.isArray(res)) {
        items = res;
        totalCount = res.length;
      } else if (res && typeof res === 'object') {
        if (Array.isArray(res.data)) {
          items = res.data;
          totalCount = typeof res.total === 'number' ? res.total : items.length;
          totalP = typeof res.totalPages === 'number' ? res.totalPages : Math.ceil(totalCount / limit);
        } else if (Array.isArray(res.items)) {
          items = res.items;
          totalCount = typeof res.total === 'number' ? res.total : items.length;
          totalP = typeof res.totalPages === 'number' ? res.totalPages : Math.ceil(totalCount / limit);
        }
      }

      setLogs(items);
      setTotal(totalCount);
      setTotalPages(totalP);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, userFilter, roleFilter, actionFilter, moduleFilter, startDate, endDate]);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchModules();
  }, [fetchStats, fetchUsers, fetchModules]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs();
      fetchStats();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs, fetchStats]);

  // Handle Date presets
  const handleDatePreset = (preset: 'today' | '7days' | '30days' | 'all') => {
    setDatePreset(preset);
    setPage(1);
    const today = new Date();
    const formatDateStr = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const dStr = formatDateStr(today);
      setStartDate(dStr);
      setEndDate(dStr);
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      setStartDate(formatDateStr(past));
      setEndDate(formatDateStr(today));
    } else if (preset === '30days') {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      setStartDate(formatDateStr(past));
      setEndDate(formatDateStr(today));
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setUserFilter('ALL');
    setRoleFilter('ALL');
    setActionFilter('ALL');
    setModuleFilter('ALL');
    setStartDate('');
    setEndDate('');
    setDatePreset('all');
    setPage(1);
  };

  // CSV Export handler
  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (userFilter !== 'ALL') params.append('userId', userFilter);
      if (roleFilter !== 'ALL') params.append('role', roleFilter);
      if (actionFilter !== 'ALL') params.append('action', actionFilter.toLowerCase());
      if (moduleFilter !== 'ALL') params.append('module', moduleFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('limit', '5000');

      const res = await api.get(`/audit-logs/export?${params.toString()}`);
      const rawData = res?.data !== undefined ? res.data : res;
      const exportList: AuditLog[] = Array.isArray(rawData) ? rawData : rawData?.data || logs;

      if (!exportList || exportList.length === 0) {
        alert('No audit logs available to export for the selected filters.');
        return;
      }

      // Convert to CSV
      const headers = ['Timestamp', 'User Name', 'User Email', 'User Role', 'Action', 'Module', 'Entity Type', 'Entity Name', 'Description', 'IP Address', 'Method', 'Endpoint'];
      const csvRows = [headers.join(',')];

      for (const item of exportList) {
        const row = [
          `"${new Date(item.timestamp || item.createdAt || '').toLocaleString()}"`,
          `"${(item.userName || '').replace(/"/g, '""')}"`,
          `"${(item.userEmail || '').replace(/"/g, '""')}"`,
          `"${(item.userRole || '').replace(/"/g, '""')}"`,
          `"${(item.action || '').toUpperCase()}"`,
          `"${(item.module || '').replace(/"/g, '""')}"`,
          `"${(item.entityType || '').replace(/"/g, '""')}"`,
          `"${(item.entityName || '').replace(/"/g, '""')}"`,
          `"${(item.description || '').replace(/"/g, '""')}"`,
          `"${(item.ipAddress || '').replace(/"/g, '""')}"`,
          `"${(item.method || '').replace(/"/g, '""')}"`,
          `"${(item.endpoint || '').replace(/"/g, '""')}"`,
        ];
        csvRows.push(row.join(','));
      }

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `bm-stock-audit-report-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export audit logs:', err);
      alert('Failed to export audit report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Helper formatting functions
  const formatTime = (ts?: string) => {
    if (!ts) return '—';
    const date = new Date(ts);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatRelativeTime = (ts?: string) => {
    if (!ts) return '';
    const diffSec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  const isAccountDeletionLog = (log?: AuditLog | null) => {
    if (!log) return false;
    const act = (log.action || '').toLowerCase();
    const mod = (log.module || '').toLowerCase();
    const ent = (log.entityType || '').toLowerCase();
    const desc = (log.description || '').toLowerCase();
    const name = (log.entityName || '').toLowerCase();
    return (
      mod === 'account_deletion' ||
      act === 'account_deletion' ||
      desc.includes('account permanently deleted') ||
      desc.includes('company admin account') ||
      desc.includes('deleted account') ||
      desc.includes('account deleted') ||
      desc.includes('delete account') ||
      ((act === 'delete' || act === 'destroy') && (ent === 'user' || ent === 'account' || name.includes('user') || name.includes('account')))
    );
  };

  // Badge styling helper based on action
  const getActionBadge = (action: string, log?: AuditLog | null) => {
    if (log && isAccountDeletionLog(log)) {
      return {
        bg: 'bg-red-600 text-white border-red-700 shadow-sm ring-2 ring-red-400/50 font-black',
        icon: AlertTriangle,
        label: 'ACCOUNT DELETED',
      };
    }
    const act = (action || '').toLowerCase();
    switch (act) {
      case 'account_deletion':
        return {
          bg: 'bg-red-600 text-white border-red-700 shadow-sm ring-2 ring-red-400/50 font-black',
          icon: AlertTriangle,
          label: 'ACCOUNT DELETED',
        };
      case 'create':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: PlusCircle,
          label: 'CREATE',
        };
      case 'update':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: Edit3,
          label: 'UPDATE',
        };
      case 'delete':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: Trash2,
          label: 'DELETE',
        };
      case 'approve':
        return {
          bg: 'bg-teal-50 text-teal-700 border-teal-200',
          icon: CheckCircle2,
          label: 'APPROVE',
        };
      case 'reject':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200',
          icon: XCircle,
          label: 'REJECT',
        };
      case 'assign':
        return {
          bg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
          icon: UserCheck,
          label: 'ASSIGN',
        };
      case 'status_change':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: ToggleLeft,
          label: 'STATUS',
        };
      case 'password_reset':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: KeyRound,
          label: 'PASSWORD',
        };
      case 'login':
        return {
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          icon: LogIn,
          label: 'LOGIN',
        };
      case 'logout':
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: LogOut,
          label: 'LOGOUT',
        };
      case 'settings_change':
        return {
          bg: 'bg-orange-50 text-orange-700 border-orange-200',
          icon: SlidersHorizontal,
          label: 'SETTINGS',
        };
      case 'export':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: Download,
          label: 'EXPORT',
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-800 border-slate-200',
          icon: Activity,
          label: act.toUpperCase(),
        };
    }
  };

  // Format Role Badge
  const getRoleBadge = (role?: string) => {
    const r = (role || '').toLowerCase();
    if (r.includes('super_admin')) {
      return 'bg-purple-100 text-purple-800 border-purple-200';
    }
    if (r.includes('company_admin')) {
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    }
    if (r.includes('admin')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    if (r.includes('manager')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
    if (r.includes('employee') || r.includes('shop') || r.includes('warehouse')) {
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const selectedUserName = useMemo(() => {
    if (userFilter === 'ALL') return null;
    const found = usersList.find((u) => u.id === userFilter);
    return found ? found.name : 'Selected User';
  }, [userFilter, usersList]);

  const accountDeletionCount = useMemo(() => {
    return logs.filter(isAccountDeletionLog).length;
  }, [logs]);

  return (
    <div className="space-y-6">
      {/* Top Header & Executive Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-[#025EA7] rounded-xl border border-blue-100 shadow-sm">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audit Report & User Activity</h1>
              <p className="text-sm text-slate-500">
                Track every user action, authentication, modification, and status change across all system users.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center space-x-2.5">
          {/* Live Auto-Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all shadow-sm ${
              autoRefresh
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-2 ring-emerald-500/20'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title={autoRefresh ? 'Auto-refreshing every 10 seconds' : 'Enable live auto-refresh'}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
            <span>{autoRefresh ? 'Live Updates (10s)' : 'Live Updates Off'}</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={() => {
              fetchLogs();
              fetchStats();
              fetchUsers();
            }}
            disabled={loading}
            className="p-2.5 bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-xl transition shadow-sm disabled:opacity-50"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#025EA7]' : ''}`} />
          </button>

          {/* CSV Export Button */}
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-[#025EA7] hover:bg-[#024A85] text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-600/20 transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Account Deletion Security Alert Banner */}
      {accountDeletionCount > 0 && (
        <div className="bg-gradient-to-r from-red-50 via-rose-50 to-red-50 border-2 border-red-300 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-md ring-4 ring-red-100">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-extrabold text-red-950 uppercase tracking-tight">
                  Critical Security Notice: {accountDeletionCount} Company Admin Account Deletion(s)
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white animate-pulse">
                  HIGH ATTENTION
                </span>
              </div>
              <p className="text-xs text-red-700 mt-0.5 font-medium">
                Company admin verified phone number via OTP and deleted business account. Events are highlighted below in vivid red.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setModuleFilter('account_deletion');
              setActionFilter('ALL');
              setPage(1);
            }}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex-shrink-0"
          >
            Filter Deletion Logs
          </button>
        </div>
      )}

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Logs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Recorded Events</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {statsLoading ? '...' : (stats?.totalLogs || total).toLocaleString()}
            </div>
            <span className="text-xs text-slate-400 mt-0.5 inline-block">Complete multi-user audit trail</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#025EA7] flex items-center justify-center border border-blue-100">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Today's Events */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Events Today</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {statsLoading ? '...' : (stats?.todayLogs ?? 0).toLocaleString()}
            </div>
            <span className="text-xs text-emerald-600 font-medium mt-0.5 inline-flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
              Active operations
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Active Actors */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active System Users</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {usersLoading ? '...' : usersList.length.toLocaleString()}
            </div>
            <span className="text-xs text-slate-400 mt-0.5 inline-block">Users across all companies</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Most Active Module */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Most Active Section</span>
            <div className="text-lg font-bold text-slate-900 mt-1 capitalize truncate max-w-[120px]">
              {statsLoading
                ? '...'
                : Object.entries(stats?.moduleBreakdown || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || 'users'}
            </div>
            <span className="text-xs text-slate-400 mt-0.5 inline-block">Highest change volume</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Card 5: Account Deletions (High-Priority Alert Card) */}
        <div
          onClick={() => {
            setModuleFilter('account_deletion');
            setActionFilter('ALL');
            setPage(1);
          }}
          className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-sm flex items-center justify-between ${
            accountDeletionCount > 0
              ? 'bg-gradient-to-br from-red-50 via-rose-50 to-red-100/80 border-red-300 ring-2 ring-red-400/50 hover:shadow-md hover:border-red-400'
              : 'bg-white border-slate-200/80 hover:bg-slate-50'
          }`}
          title="Click to view all account deletion records"
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Account Deletions</span>
              {accountDeletionCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping inline-block" />
              )}
            </div>
            <div className="text-2xl font-black text-red-950 mt-1">
              {accountDeletionCount}
            </div>
            <span className="text-xs text-red-700 font-semibold mt-0.5 inline-block">
              {accountDeletionCount > 0 ? 'Click to filter logs' : '0 account erasures'}
            </span>
          </div>
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-xs transition ${
              accountDeletionCount > 0
                ? 'bg-red-600 text-white border-red-700 ring-4 ring-red-100 animate-pulse'
                : 'bg-rose-50 text-rose-400 border-rose-100'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Quick User Filter Strip: Top active users chips */}
      {usersList.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#025EA7]" />
              Track User Actions Directly
            </span>
            {userFilter !== 'ALL' && (
              <button
                onClick={() => setUserFilter('ALL')}
                className="text-xs text-[#025EA7] hover:underline font-semibold"
              >
                Clear user filter
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setUserFilter('ALL');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                userFilter === 'ALL'
                  ? 'bg-[#025EA7] text-white border-[#025EA7] shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Users ({total})
            </button>
            {usersList.slice(0, 10).map((u) => {
              const isSelected = userFilter === u.id;
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    setUserFilter(isSelected ? 'ALL' : u.id);
                    setPage(1);
                  }}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                    isSelected
                      ? 'bg-blue-50 text-[#025EA7] border-blue-300 ring-2 ring-blue-500/20 shadow-sm font-semibold'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center">
                    {u.name?.charAt(0) || 'U'}
                  </span>
                  <span className="truncate max-w-[120px]">{u.name}</span>
                  <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-500">
                    {u.actionCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active User Filter Notification Banner */}
      {userFilter !== 'ALL' && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-sm text-[#025EA7]">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-[#025EA7]" />
            <span>
              Showing activity history specifically for <strong className="font-bold">{selectedUserName}</strong> ({total} recorded events).
            </span>
          </div>
          <button
            onClick={() => {
              setUserFilter('ALL');
              setPage(1);
            }}
            className="inline-flex items-center space-x-1 text-xs font-bold text-[#025EA7] hover:underline"
          >
            <X className="w-3.5 h-3.5" />
            <span>Show All Users</span>
          </button>
        </div>
      )}

      {/* Filters & Control Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Free Text Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search user, email, entity name, description..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-[#025EA7] rounded-xl text-sm outline-none transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* User Selector Filter */}
          <div className="flex items-center space-x-2">
            <select
              value={userFilter}
              onChange={(e) => {
                setUserFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:border-[#025EA7] outline-none truncate"
            >
              <option value="ALL">All Users ({usersList.length})</option>
              {usersList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role.replace('_', ' ')}) - {u.actionCount} actions
                </option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div className="flex items-center space-x-2">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:border-[#025EA7] outline-none"
            >
              <option value="ALL">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="company_admin">Company Admin</option>
              <option value="manager">Manager</option>
              <option value="shop_employee">Shop Employee</option>
              <option value="warehouse_employee">Warehouse Employee</option>
              <option value="user">Standard User</option>
            </select>
          </div>

          {/* Action Filter */}
          <div className="flex items-center space-x-2">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:border-[#025EA7] outline-none"
            >
              <option value="ALL">All Actions</option>
              <option value="create">CREATE (New)</option>
              <option value="update">UPDATE (Edit)</option>
              <option value="delete">DELETE (Removal)</option>
              <option value="approve">APPROVE (Accept)</option>
              <option value="reject">REJECT (Decline)</option>
              <option value="assign">ASSIGN (Transfer)</option>
              <option value="status_change">STATUS (Change)</option>
              <option value="password_reset">PASSWORD (Reset)</option>
              <option value="login">LOGIN</option>
              <option value="logout">LOGOUT</option>
              <option value="export">EXPORT</option>
            </select>
          </div>
        </div>

        {/* Date Filters & Presets Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {/* Module Filter */}
            <select
              value={moduleFilter}
              onChange={(e) => {
                setModuleFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:border-[#025EA7] outline-none capitalize mr-2"
            >
              <option value="ALL">All Modules</option>
              {availableModules.map((m) => (
                <option key={m} value={m} className="capitalize">
                  {m}
                </option>
              ))}
            </select>

            {/* Quick Filter: Account Deletions */}
            <button
              onClick={() => {
                if (moduleFilter === 'account_deletion') {
                  setModuleFilter('ALL');
                } else {
                  setModuleFilter('account_deletion');
                  setActionFilter('ALL');
                }
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition mr-2 ${
                moduleFilter === 'account_deletion'
                  ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-400'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              <span>🚨 Account Deletions ({accountDeletionCount})</span>
            </button>

            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Timeframe:</span>
            {(['all', 'today', '7days', '30days'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => handleDatePreset(preset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                  datePreset === preset
                    ? 'bg-[#025EA7] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {preset === '7days' ? 'Last 7 Days' : preset === '30days' ? 'Last 30 Days' : preset}
              </button>
            ))}

            {/* Custom Dates */}
            <div className="flex items-center space-x-1.5 ml-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('all');
                  setPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
                placeholder="Start Date"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('all');
                  setPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
                placeholder="End Date"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* View Mode Switcher */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Table View
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'timeline' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Timeline View
              </button>
            </div>

            {/* Clear All Filters */}
            {(search || userFilter !== 'ALL' || roleFilter !== 'ALL' || actionFilter !== 'ALL' || moduleFilter !== 'ALL' || startDate || endDate) && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 hover:bg-rose-50 rounded-lg transition"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Audit Logs Display */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-10 h-10 border-4 border-[#025EA7] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading audit log entries...</p>
          <p className="text-xs text-slate-400 mt-1">Retrieving system-wide activity records</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
            <History className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Audit Logs Found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
            No activity matches the current filter criteria. Actions taken by users in the system will automatically appear here.
          </p>
          {(search || userFilter !== 'ALL' || roleFilter !== 'ALL' || actionFilter !== 'ALL' || moduleFilter !== 'ALL' || startDate || endDate) && (
            <button
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">User / Actor</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Module & Target</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4">IP & Client</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {logs.map((log) => {
                  const isDeleted = isAccountDeletionLog(log);
                  const actionStyle = getActionBadge(log.action, log);
                  const ActionIcon = actionStyle.icon;

                  return (
                    <tr
                      key={log.id}
                      className={`transition-colors group cursor-pointer ${
                        isDeleted
                          ? 'bg-red-50/60 hover:bg-red-50 border-l-4 border-l-red-500'
                          : 'hover:bg-blue-50/30'
                      }`}
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 text-xs">{formatTime(log.timestamp)}</div>
                        <div className="text-[11px] text-slate-400 font-medium">
                          {formatRelativeTime(log.timestamp)}
                        </div>
                      </td>

                      {/* User / Actor */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (log.userId) {
                                setUserFilter(log.userId);
                                setPage(1);
                              }
                            }}
                            className={`w-8 h-8 rounded-full border text-xs font-bold flex items-center justify-center flex-shrink-0 transition ${
                              isDeleted
                                ? 'bg-red-100 border-red-300 text-red-700'
                                : 'bg-slate-100 hover:bg-blue-100 border-slate-200 text-slate-700 hover:text-[#025EA7]'
                            }`}
                            title={log.userId ? `Click to filter activity by ${log.userName || 'this user'}` : undefined}
                          >
                            {log.userName?.charAt(0) || log.userEmail?.charAt(0) || 'U'}
                          </button>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (log.userId) {
                                setUserFilter(log.userId);
                                setPage(1);
                              }
                            }}
                            className={`font-semibold truncate text-xs text-left block transition ${
                              isDeleted ? 'text-red-800 hover:text-red-700' : 'text-slate-900 hover:text-[#025EA7]'
                            }`}
                          >
                            {log.userName || log.userEmail || 'System / Automated'}
                          </button>
                          <div className="flex items-center space-x-1.5 mt-0.5 flex-wrap gap-1">
                            {log.userRole && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${getRoleBadge(
                                  log.userRole,
                                )}`}
                              >
                                {log.userRole.replace('_', ' ')}
                              </span>
                            )}
                            {log.userEmail && log.userName && (
                              <span className="text-[11px] text-slate-400 truncate max-w-[130px]">
                                {log.userEmail}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${actionStyle.bg}`}
                      >
                        <ActionIcon className="w-3.5 h-3.5" />
                        <span>{actionStyle.label}</span>
                      </span>
                    </td>

                    {/* Module & Target */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wide border ${
                            isDeleted
                              ? 'bg-red-100 text-red-800 border-red-300 font-extrabold'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {isDeleted ? 'CRITICAL' : log.module || 'System'}
                        </span>
                        <span className={`text-xs font-semibold truncate max-w-[150px] ${isDeleted ? 'text-red-950 font-bold' : 'text-slate-800'}`}>
                          {log.entityName || log.entityType || 'General'}
                        </span>
                      </div>
                      {log.entityId && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[180px]">
                          ID: {log.entityId}
                        </div>
                      )}
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-4 max-w-sm">
                      <p className={`text-xs line-clamp-2 leading-relaxed ${
                        isDeleted ? 'text-red-800 font-semibold' : 'text-slate-700'
                      }`}>
                        {log.description || `${log.action} performed on ${log.entityType || 'entity'}`}
                      </p>
                    </td>

                    {/* IP & Client */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="text-xs font-mono text-slate-600 flex items-center space-x-1">
                        <Globe className="w-3 h-3 text-slate-400" />
                        <span>{log.ipAddress || '127.0.0.1'}</span>
                      </div>
                      {log.method && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 inline-block">
                          {log.method} {log.endpoint ? log.endpoint.split('?')[0].slice(0, 24) : ''}
                        </span>
                      )}
                    </td>

                    {/* Details Trigger */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className={`p-1.5 rounded-lg transition ${
                          isDeleted
                            ? 'text-red-600 hover:bg-red-100'
                            : 'text-slate-400 hover:text-[#025EA7] hover:bg-blue-50'
                        }`}
                        title="View complete audit record details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    ) : (
      /* TIMELINE VIEW */
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 py-2">
          {logs.map((log) => {
            const isDeleted = isAccountDeletionLog(log);
            const actionStyle = getActionBadge(log.action, log);
            const ActionIcon = actionStyle.icon;

            return (
              <div key={log.id} className="relative pl-6 group">
                {/* Timeline Node Dot */}
                <div
                  className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${
                    isDeleted
                      ? 'w-9 h-9 -left-[19px] bg-red-600 text-white ring-4 ring-red-200 animate-pulse shadow-md'
                      : actionStyle.bg
                  }`}
                >
                  <ActionIcon className="w-4 h-4" />
                </div>

                {/* Timeline Card */}
                <div
                  onClick={() => setSelectedLog(log)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
                    isDeleted
                      ? 'border-2 border-red-400 bg-red-50/80 hover:bg-red-100/90 shadow-md ring-1 ring-red-200'
                      : 'border-slate-200 hover:border-[#025EA7]/50 hover:bg-blue-50/20'
                  }`}
                >
                  {isDeleted && (
                    <div className="mb-2.5 p-2 rounded-lg bg-red-100 border border-red-300 text-red-900 flex items-center gap-1.5 text-xs font-black">
                      <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 animate-pulse" />
                      <span>CRITICAL SECURITY EVENT: COMPANY ADMIN DELETED VIA PHONE OTP</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded border ${actionStyle.bg}`}>
                        {actionStyle.label}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (log.userId) {
                            setUserFilter(log.userId);
                            setPage(1);
                          }
                        }}
                        className={`text-xs font-bold transition ${isDeleted ? 'text-red-950 font-black' : 'text-slate-800 hover:text-[#025EA7]'}`}
                      >
                        {log.userName || log.userEmail || 'System'}
                      </button>
                      {log.userRole && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${getRoleBadge(log.userRole)}`}>
                          {log.userRole}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 font-medium">
                      {formatTime(log.timestamp)} ({formatRelativeTime(log.timestamp)})
                    </div>
                  </div>

                  <p className={`text-sm font-medium ${isDeleted ? 'text-red-950 font-bold' : 'text-slate-700'}`}>
                    {log.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 mt-3 pt-2 border-t border-slate-100 text-xs text-slate-500 font-mono">
                    <span>Module: <strong className={isDeleted ? 'text-red-700' : 'text-slate-700'}>{log.module || 'system'}</strong></span>
                    {log.entityName && <span>Target: <strong className={isDeleted ? 'text-red-700' : 'text-slate-700'}>{log.entityName}</strong></span>}
                    <span>IP: <strong className="text-slate-700">{log.ipAddress || '127.0.0.1'}</strong></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}

      {/* Pagination Footer */}
      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-800">{total > 0 ? (page - 1) * limit + 1 : 0}</span> to{' '}
          <span className="font-bold text-slate-800">{Math.min(page * limit, total)}</span> of{' '}
          <span className="font-bold text-slate-800">{total.toLocaleString()}</span> entries
        </div>

        <div className="flex items-center space-x-3">
          {/* Limit selector */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-500">
            <span>Per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 outline-none"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Page controls */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1 || loading}
              className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-semibold text-slate-700">
              Page {page} of {Math.max(totalPages, 1)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages || loading}
              className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL / DRAWER */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-xl border ${getActionBadge(selectedLog.action, selectedLog).bg}`}>
                  {React.createElement(getActionBadge(selectedLog.action, selectedLog).icon, { className: 'w-5 h-5' })}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Audit Record Details</h3>
                  <p className="text-xs text-slate-500 font-mono">ID: {selectedLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Account Deletion Critical Banner */}
              {isAccountDeletionLog(selectedLog) && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-300 text-red-950 shadow-sm">
                  <div className="flex items-center gap-2 font-black text-sm text-red-700 uppercase tracking-wide">
                    <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse flex-shrink-0" />
                    <span>CRITICAL EVENT: COMPANY ADMIN ACCOUNT DELETION VIA OTP</span>
                  </div>
                  <p className="text-xs text-red-800 mt-1 font-medium leading-relaxed">
                    This company admin passed SMS OTP phone verification and permanently deleted their account and business records.
                  </p>
                </div>
              )}

              {/* Event Summary Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Action</span>
                  <div className="mt-1 font-bold text-sm text-slate-900 uppercase">{selectedLog.action}</div>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Module</span>
                  <div className="mt-1 font-bold text-sm text-slate-900 capitalize">{selectedLog.module || '—'}</div>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Target Entity</span>
                  <div className="mt-1 font-bold text-sm text-slate-900">
                    {selectedLog.entityName || selectedLog.entityType || '—'}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Date & Time</span>
                  <div className="mt-1 font-bold text-xs text-slate-900">{formatTime(selectedLog.timestamp)}</div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Action Narrative</h4>
                <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-sm text-slate-800 leading-relaxed font-medium">
                  {selectedLog.description || 'No detailed narrative recorded for this event.'}
                </div>
              </div>

              {/* Actor Identity */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Actor (Performed By)</h4>
                <div className="p-4 bg-white border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-400">Name</span>
                    <p className="font-semibold text-xs text-slate-800 mt-0.5">{selectedLog.userName || 'Unknown'}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Email</span>
                    <p className="font-semibold text-xs text-slate-800 mt-0.5">{selectedLog.userEmail || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Assigned Role</span>
                    <p className="mt-0.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${getRoleBadge(selectedLog.userRole)}`}>
                        {selectedLog.userRole || 'Standard'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Technical / HTTP Request Metadata */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Request Context</h4>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">HTTP Method:</span>
                    <span className="font-bold text-slate-800">{selectedLog.method || 'POST'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">API Endpoint:</span>
                    <span className="font-bold text-slate-800 truncate max-w-md">{selectedLog.endpoint || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">IP Address:</span>
                    <span className="font-bold text-slate-800">{selectedLog.ipAddress || '127.0.0.1'}</span>
                  </div>
                  {selectedLog.userAgent && (
                    <div className="flex items-start justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500">User Agent:</span>
                      <span className="text-[11px] text-slate-600 truncate max-w-md">{selectedLog.userAgent}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Changed Values / Payload JSON */}
              {(selectedLog.newValues || selectedLog.oldValues) && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payload Data</h4>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          JSON.stringify(
                            { oldValues: selectedLog.oldValues, newValues: selectedLog.newValues },
                            null,
                            2,
                          ),
                          'payload',
                        )
                      }
                      className="inline-flex items-center space-x-1 text-xs text-[#025EA7] hover:underline"
                    >
                      {copiedKey === 'payload' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'payload' ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  </div>
                  <div className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-xs overflow-x-auto max-h-60">
                    <pre>
                      {JSON.stringify(
                        {
                          ...(selectedLog.oldValues ? { previousValues: selectedLog.oldValues } : {}),
                          ...(selectedLog.newValues ? { updatedValues: selectedLog.newValues } : {}),
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-3">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
