"use client";

import React from 'react';
import {
  Home,
  Store as StoreIcon,
  ShoppingBag,
  Package,
  ArrowUpDown,
  Tag,
  FileText,
  CreditCard,
  Users,
  Truck,
  Box,
  Repeat,
  Shield,
  Percent,
  TrendingUp,
  BarChart3,
  Landmark,
  Building2,
  Settings,
  Zap,
  Plus,
  ShieldCheck,
} from 'lucide-react';

import { useTranslation } from '@/lib/i18n';
import { hasModulePermission, isUserOwnerOrAdmin } from '@/lib/permissions';
import { canUseCommission, canUseBorrowing, canRequestMoreCompanies } from '@/lib/subscriptionPlans';
import { DEMO_MODE } from '@/lib/demoMode';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenUpgradeModal: () => void;
  onOpenNewSaleModal: () => void;
  user?: any;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  onOpenUpgradeModal,
  onOpenNewSaleModal,
  user,
}: SidebarProps) {
  const { t } = useTranslation();

  const menuItems: Array<{ id: string; labelKey: string; icon: any; permissionKey?: string; action?: () => void }> = [
    { id: 'Home', labelKey: 'home', icon: Home },
    { id: 'Store', labelKey: 'store', icon: StoreIcon, permissionKey: 'warehouse' },
    { id: 'Shop', labelKey: 'shop', icon: ShoppingBag, permissionKey: 'shopStore' },
    { id: 'Outstanding Credit', labelKey: 'credit', icon: CreditCard, permissionKey: 'viewCredit' },
    { id: 'Products', labelKey: 'add_product', icon: Package, permissionKey: 'viewProducts' },
    { id: 'Stock Out / In', labelKey: 'stock_in_out', icon: ArrowUpDown, permissionKey: 'stockIn' },
    { id: 'Purchases', labelKey: 'purchases', icon: Tag, permissionKey: 'stockIn' },
    { id: 'Staff & Access', labelKey: 'permission_access', icon: Shield, permissionKey: 'staffManagement' },
    { id: 'Customer Management', labelKey: 'customer_management', icon: Users, permissionKey: 'viewSales' },
    { id: 'Product Borrowing', labelKey: 'product_borrowing', icon: Box, permissionKey: 'stockIn' },
    { id: 'Stock Transfer', labelKey: 'transfer_request', icon: Repeat, permissionKey: 'branchTransfers' },
    { id: 'Bank Accounts', labelKey: 'bank_accounts', icon: Landmark, permissionKey: 'bankAccounts' },
    { id: 'Verify Receipt', labelKey: 'verify_receipt', icon: ShieldCheck, permissionKey: undefined },
    { id: 'Reports', labelKey: 'reports', icon: BarChart3, permissionKey: 'reports' },
    { id: 'Commision Management', labelKey: 'commission_management', icon: Percent, permissionKey: 'commission' },
    { id: 'Request more companies', labelKey: 'request_more_companies', icon: Building2, permissionKey: 'companies' },
    { id: 'Settings', labelKey: 'settings', icon: Settings, permissionKey: 'settings' },
  ];

  const visibleMenuItems = menuItems.filter((item) => {
    // 1. Package / Plan Tier Restrictions (Remove completely from sidebar if not included in chosen package)
    if (item.id === 'Commision Management' && !canUseCommission(user)) {
      return false;
    }
    if (item.id === 'Product Borrowing' && !canUseBorrowing(user)) {
      return false;
    }
    if (item.id === 'Request more companies' && !canRequestMoreCompanies(user)) {
      return false;
    }
    // 2. Staff / Role permissions
    if (!item.permissionKey) return true;
    if (isUserOwnerOrAdmin(user)) return true;

    if (item.id === 'Store') {
      const branchPerms = (user as any)?.permissions?.branchPermissions || (user as any)?.branchPermissions;
      let bp = branchPerms;
      if (typeof bp === 'string') {
        try { bp = JSON.parse(bp); } catch (_) { bp = null; }
      }
      const hasAnyWhAccess = bp && Object.values(bp).some((access: any) =>
        access === true || access === 'true' || (access && typeof access === 'object' && (access.warehouse === true || access.warehouse === 'true'))
      );
      return hasModulePermission(user, 'warehouse', 'view') || hasModulePermission(user, 'addStore', 'view') || !!hasAnyWhAccess || !!(user as any)?.warehouseId;
    }

    if (item.id === 'Shop') {
      const branchPerms = (user as any)?.permissions?.branchPermissions || (user as any)?.branchPermissions;
      let bp = branchPerms;
      if (typeof bp === 'string') {
        try { bp = JSON.parse(bp); } catch (_) { bp = null; }
      }
      const hasAnyShAccess = bp && Object.values(bp).some((access: any) =>
        access === true || access === 'true' || (access && typeof access === 'object' && (access.shop === true || access.shop === 'true'))
      );
      return hasModulePermission(user, 'shopStore', 'view') || hasModulePermission(user, 'addShop', 'view') || !!hasAnyShAccess || !!(user as any)?.shopId;
    }

    return hasModulePermission(user, item.permissionKey, 'view');
  });

  const canCreateSale = hasModulePermission(user, 'createSale', 'edit');

  return (
    <aside className="w-64 bg-white rounded-2xl p-4 flex flex-col justify-between shadow-sm border border-slate-100 min-h-[95vh] shrink-0">
      {/* Brand Header */}
      <div>
        <div className="flex items-center px-2 py-2 mb-4">
          <img
            src="/logo/gelagle_logo_horizontal.png"
            alt="Logo"
            className="h-9 max-w-[80%] object-contain"
            onError={(e) => {
              // Fallback element if image fails
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          {DEMO_MODE && (
            <span className="ml-2 shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
              Demo
            </span>
          )}
        </div>

        {/* New Sale CTA */}
        {canCreateSale && (
          <button
            onClick={onOpenNewSaleModal}
            className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 bg-[#025EA7] hover:bg-[#014883] active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md shadow-blue-900/10 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t('new_sale')}</span>
          </button>
        )}

        {/* Navigation Links */}
        <nav className="space-y-0.5 max-h-[62vh] overflow-y-auto pr-1">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.action) {
                    item.action();
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#025EA7] text-white shadow-md shadow-blue-900/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Upgrade Banner Card */}
      <div
        onClick={onOpenUpgradeModal}
        className="mt-4 p-3.5 rounded-2xl bg-gradient-to-br from-[#E3F2FD] via-blue-50 to-indigo-100 border border-blue-200/60 text-center shadow-inner cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
      >
        <div className="w-8 h-8 bg-[#025EA7] rounded-xl flex items-center justify-center text-white mx-auto mb-1.5 shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform">
          <Zap className="w-4 h-4 fill-current" />
        </div>
        <h4 className="text-xs font-bold text-slate-900">Go 1 Year Plan</h4>
        <p className="text-[10px] text-slate-500 mt-0.5 mb-2 leading-snug">
          Unlimited multi-warehouse & permissions
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenUpgradeModal();
          }}
          className="w-full py-1.5 px-3 bg-[#025EA7] hover:bg-[#014883] active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
        >
          Upgrade Plan
        </button>
      </div>
    </aside>
  );
}
