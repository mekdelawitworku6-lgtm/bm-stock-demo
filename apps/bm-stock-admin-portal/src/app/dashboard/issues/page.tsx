'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Check,
  X,
  Smartphone,
  Globe,
  User,
  Building,
  Phone,
  Mail,
  Loader2,
  ChevronRight,
} from 'lucide-react';

interface IssueReport {
  id: string;
  title: string;
  description: string;
  category: string;
  appType: 'flutter' | 'web';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  userPhone?: string;
  userEmail?: string;
  userName?: string;
  companyName?: string;
  createdAt: string;
  updatedAt: string;
}

export default function IssuesPage() {
  const [reports, setReports] = useState<IssueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [appTypeFilter, setAppTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedReport, setSelectedReport] = useState<IssueReport | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'>('OPEN');
  const [flash, setFlash] = useState<string | null>(null);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (appTypeFilter !== 'ALL') params.append('appType', appTypeFilter);

      const endpoint = `/issue-reports${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await api.get(endpoint);
      const data = res?.data || res;
      setReports(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load issue reports');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, appTypeFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleUpdateStatus = async () => {
    if (!selectedReport) return;
    setUpdatingStatus(true);
    try {
      await api.patch(`/issue-reports/${selectedReport.id}/status`, { status: newStatus });
      showFlash(`Report status updated to ${newStatus}`);
      setSelectedReport(null);
      await fetchReports();
      // Notify the sidebar layout to refresh the open issues badge count
      window.dispatchEvent(new Event('issue_reports_changed'));
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredReports = reports.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      (r.userName && r.userName.toLowerCase().includes(q)) ||
      (r.userPhone && r.userPhone.includes(q)) ||
      (r.userEmail && r.userEmail.toLowerCase().includes(q)) ||
      (r.companyName && r.companyName.toLowerCase().includes(q))
    );
  });

  const totalCount = reports.length;
  const openCount = reports.filter((r) => r.status === 'OPEN').length;
  const inProgressCount = reports.filter((r) => r.status === 'IN_PROGRESS').length;
  const resolvedCount = reports.filter((r) => r.status === 'RESOLVED' || r.status === 'CLOSED').length;

  return (
    <div className="space-y-6 animate-fadeIn bg-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-6 h-6 text-[#025EA7]" />
            <h1 className="text-2xl font-bold text-slate-900">User Issue Reports</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            View, track, and resolve feedback and bug reports submitted by Flutter mobile app and web users.
          </p>
        </div>

        <button
          onClick={fetchReports}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center space-x-2 cursor-pointer text-sm font-semibold self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {flash && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-2 text-emerald-700 text-sm font-semibold animate-fadeIn">
          <Check className="w-5 h-5" />
          <span>{flash}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start space-x-3 text-red-700 text-sm animate-fadeIn">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Reports</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{totalCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#025EA7] flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Open</p>
            <h3 className="text-2xl font-extrabold text-amber-600 mt-1">{openCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">In Progress</p>
            <h3 className="text-2xl font-extrabold text-blue-600 mt-1">{inProgressCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <RefreshCw className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resolved / Closed</p>
            <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">{resolvedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by title, submitter, phone, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#025EA7]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Platform:</span>
            <select
              value={appTypeFilter}
              onChange={(e) => setAppTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold outline-none cursor-pointer"
            >
              <option value="ALL">All Platforms</option>
              <option value="flutter">Flutter Mobile</option>
              <option value="web">Web App</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#025EA7] mb-2" />
            <p className="text-sm font-medium">Loading issue reports...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <AlertCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-slate-700">No issue reports found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Platform</th>
                  <th className="py-3.5 px-4">Category & Subject</th>
                  <th className="py-3.5 px-4">Submitter</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-4 font-semibold text-slate-600 whitespace-nowrap">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap">
                      {report.appType === 'flutter' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-full font-bold text-[10px]">
                          <Smartphone className="w-3 h-3" /> Flutter Mobile
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full font-bold text-[10px]">
                          <Globe className="w-3 h-3" /> Web App
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <div>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-extrabold uppercase mr-1.5">
                          {report.category}
                        </span>
                        <span className="font-bold text-slate-900">{report.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 max-w-xs">
                        {report.description}
                      </p>
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900">{report.userName || 'Anonymous User'}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        {report.userPhone && <span>{report.userPhone}</span>}
                        {report.companyName && <span className="font-medium text-slate-600">({report.companyName})</span>}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSelectedReport(report);
                          setNewStatus(report.status);
                        }}
                        className="py-1.5 px-3 bg-[#025EA7] hover:bg-[#014883] text-white text-xs font-bold rounded-xl shadow-xs transition-all inline-flex items-center gap-1"
                      >
                        Details <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details & Update Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#025EA7] flex items-center justify-center font-bold">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Issue Details</h3>
                  <p className="text-xs text-slate-500">Report ID: {selectedReport.id.slice(0, 8)}...</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-extrabold text-slate-700">
                    {selectedReport.category}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(selectedReport.createdAt).toLocaleString()}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mt-1">{selectedReport.title}</h4>
                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {selectedReport.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Submitter</div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" /> {selectedReport.userName || 'N/A'}
                  </div>
                  {selectedReport.userPhone && (
                    <div className="text-slate-500 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> {selectedReport.userPhone}
                    </div>
                  )}
                  {selectedReport.userEmail && (
                    <div className="text-slate-500 flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> {selectedReport.userEmail}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Platform & Company</div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    {selectedReport.appType === 'flutter' ? (
                      <>
                        <Smartphone className="w-3.5 h-3.5 text-cyan-600" /> Flutter Mobile App
                      </>
                    ) : (
                      <>
                        <Globe className="w-3.5 h-3.5 text-indigo-600" /> Web App Frontend
                      </>
                    )}
                  </div>
                  <div className="text-slate-600 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400" /> {selectedReport.companyName || 'Not specified'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Update Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#025EA7]"
                >
                  <option value="OPEN">OPEN (Under Review)</option>
                  <option value="IN_PROGRESS">IN_PROGRESS (Being Worked On)</option>
                  <option value="RESOLVED">RESOLVED (Fixed / Completed)</option>
                  <option value="CLOSED">CLOSED (Dismissed / Closed)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingStatus}
                onClick={handleUpdateStatus}
                className="py-2.5 px-5 bg-[#025EA7] hover:bg-[#014883] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {updatingStatus ? 'Updating...' : 'Save Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
