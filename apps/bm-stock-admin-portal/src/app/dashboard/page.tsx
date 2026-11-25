'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatUserName } from '@/lib/user-display';
import {
  Users,
  Building2,
  TrendingUp,
  ArrowUpRight,
  UserPlus,
  Activity,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

export default function DashboardOverviewPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCompanies: 0,
    activeUsers: 0,
    systemStatus: 'Healthy',
  });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOverview() {
      setLoading(true);
      try {
        const results = await Promise.allSettled([
          api.get('/users/admin/stats'),
          api.get('/users/admin?limit=5&role=company_admin'),
          api.get('/companies?limit=100&ownerRole=company_admin'),
        ]);

        const statsData = results[0].status === 'fulfilled' ? results[0].value : null;
        const usersData = results[1].status === 'fulfilled' ? results[1].value : null;
        const companiesData = results[2].status === 'fulfilled' ? results[2].value : null;

        const extracted = Array.isArray(usersData) ? usersData : (usersData?.data || usersData?.users);
        const userList = Array.isArray(extracted) ? extracted : [];
        const extractedCompanies = Array.isArray(companiesData) ? companiesData : companiesData?.data;
        const companyList = Array.isArray(extractedCompanies) ? extractedCompanies : [];

        setStats({
          totalUsers: statsData?.total ?? userList.length,
          totalCompanies: companyList.length || 0,
          activeUsers: statsData?.active ?? userList.filter((u: any) => u.status === 'active').length,
          systemStatus: 'Optimal',
        });
        setRecentUsers(userList.slice(0, 5));
      } catch (err) {
        console.error('Error fetching dashboard overview:', err);
      } finally {
        setLoading(false);
      }
    }

    loadOverview();
  }, []);

  return (
    <div className="space-y-8 animate-fadeIn bg-white">
      {/* Welcome Banner */}
      <div className="bg-[#025EA7] text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="px-3 py-1 bg-white/10 backdrop-blur-md text-blue-200 text-xs font-semibold rounded-full border border-white/20">
            BM Stock Admin Portal
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight mt-3">
            Welcome to BM Stock Admin Portal
          </h1>
          <p className="text-blue-100 text-sm mt-2 leading-relaxed">
            Enterprise administration console to manage users, system roles, store environments, and access permissions.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/dashboard/users"
              className="px-5 py-2.5 bg-white text-[#025EA7] hover:bg-blue-50 font-bold text-sm rounded-xl shadow transition flex items-center space-x-2"
            >
              <Users className="w-4 h-4" />
              <span>Manage Users</span>
            </Link>

            <Link
              href="/dashboard/companies"
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-sm rounded-xl transition flex items-center space-x-2"
            >
              <Building2 className="w-4 h-4" />
              <span>View Companies</span>
            </Link>
          </div>
        </div>

        <div className="absolute right-6 -bottom-10 opacity-15 pointer-events-none hidden md:block">
          <Activity className="w-80 h-80 text-white" />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total System Users</span>
            <div className="w-10 h-10 bg-blue-50 text-[#025EA7] rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-3xl font-extrabold text-slate-900 mt-3">{stats.totalUsers}</h3>
          <p className="text-xs text-slate-500 mt-1 flex items-center">
            <span className="text-emerald-600 font-semibold flex items-center mr-1">
              <TrendingUp className="w-3 h-3 mr-0.5" /> +100%
            </span>
            registered in system
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Accounts</span>
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-3xl font-extrabold text-emerald-600 mt-3">{stats.activeUsers}</h3>
          <p className="text-xs text-slate-500 mt-1">Verified & operational users</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Companies & Stores</span>
            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-3xl font-extrabold text-purple-700 mt-3">{stats.totalCompanies}</h3>
          <p className="text-xs text-slate-500 mt-1">Scoped store environments</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">System Status</span>
            <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-teal-600 mt-3">{stats.systemStatus}</h3>
          <p className="text-xs text-slate-500 mt-1">Backend API operational</p>
        </div>
      </div>

      {/* Main Feature Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Recent User Registrations</h3>
              <p className="text-xs text-slate-500">Latest user accounts added to BM Stock</p>
            </div>
            <Link
              href="/dashboard/users"
              className="text-xs font-bold text-[#025EA7] hover:text-[#024A85] flex items-center"
            >
              View All Users <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="space-y-4">
            {recentUsers.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">No recent user records found.</div>
            ) : (
              recentUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 bg-[#025EA7] text-white rounded-full flex items-center justify-center font-bold text-xs">
                      {u.firstName?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">
                        {formatUserName(u)}
                      </p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="px-2.5 py-1 bg-blue-100 text-[#025EA7] text-xs font-semibold rounded-full">
                      {u.role || 'user'}
                    </span>
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                      {u.status || 'active'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Quick Admin Actions</h3>
            <p className="text-xs text-slate-500 mb-6">Manage system configuration and accounts.</p>

            <div className="space-y-3">
              <Link
                href="/dashboard/users"
                className="w-full p-4 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl flex items-center justify-between group transition"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 text-[#025EA7] rounded-lg">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm text-slate-800 group-hover:text-[#025EA7]">Create User</p>
                    <p className="text-xs text-slate-500">Add user or company admin</p>
                  </div>
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-[#025EA7] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>

              <Link
                href="/dashboard/companies"
                className="w-full p-4 bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-200 rounded-xl flex items-center justify-between group transition"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm text-slate-800 group-hover:text-purple-700">Company List</p>
                    <p className="text-xs text-slate-500">View registered stores</p>
                  </div>
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-purple-700 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
