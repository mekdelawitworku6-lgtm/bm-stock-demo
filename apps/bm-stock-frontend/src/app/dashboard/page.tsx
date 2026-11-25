"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { generateReportPdf } from '@/lib/reportPdfExport';
import {
  Tag,
  Users,
  Building,
  ShoppingBag,
  FileText,
  FileCode,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Trash2,
  Search,
  Package,
  ArrowUpDown,
  ArrowLeftRight,
  CreditCard,
  Truck,
  Box,
  Repeat,
  Shield,
  Percent,
  BarChart3,
  Landmark,
  Building2,
  Settings,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Download,
  Eye,
  EyeOff,
  Wallet,
  SlidersHorizontal,
  X,
  Bell,
  Globe,
  LayoutGrid,
  List,
  Pencil,
  TrendingUp,
  DollarSign,
  KeyRound,
  FileSpreadsheet,
  UploadCloud,
  FileUp,
  FileCheck,
  Lock,
  Zap,
  Calendar,
  Share2,
  ChevronDown,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import ReceiptVerificationModal from '@/components/ReceiptVerificationModal';
import {
  NewSaleModal,
  AddProductModal,
  StaffModal,
  EditStaffModal,
  BranchModal,
  UpgradePlanModal,
  StoreDetailModal,
  RecordCreditPaymentModal,
  CustomerCreditDetailModal,
  ProductDetailModal,
  PermissionsConfigModal,
  ChangePasswordModal,
  ChangePinModal,
  DeleteAccountModal,
  PrivacyPolicyModal,
  RecordBorrowingModal,
  BorrowingDetailModal,
  AddBankAccountModal,
  AddBankBalanceModal,
  AddBankExpenseModal,
  CommissionConfigModal,
  ManualPaymentModal,
  ActivityDetailModal,
  RecordPurchaseModal,
} from '@/components/Modals';
import {
  api,
  DashboardStats,
  ActivityItem,
  Product,
  Warehouse,
  Shop,
  Customer,
  Supplier,
  Borrowing,
  Transfer,
  StaffMember,
  CommissionItem,
  BankAccount,
  SaleRecord,
  UserProfile,
} from '@/lib/api';
import { parseSalesFromCsvOrExcel, parseSalesFromPdf, downloadSampleSalesTemplate, isSaleWithin24Hours, ImportedSaleRecord } from '@/lib/salesImport';
import { useTranslation } from '@/lib/i18n';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { hasModulePermission, isUserOwnerOrAdmin, getAccessibleWarehouses, getAccessibleShops } from '@/lib/permissions';
import {
  canAccessWebApp,
  canUseBorrowing,
  canUseCommission,
  canRequestMoreCompanies,
  canUseBulkEntry,
  canUseProductImport,
  getPlanLimits,
  getUserPlanTier,
} from '@/lib/subscriptionPlans';

export default function DashboardPage() {
  const { showToast } = useToast();
  const { t, language, setLanguage } = useTranslation();
  const { logout, user, updateUser } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Home');

  // Enforce package restrictions: if active tab is restricted by the user's package, revert to Home
  useEffect(() => {
    if (activeTab === 'Commision Management' && !canUseCommission(user)) {
      setActiveTab('Home');
    }
    if (activeTab === 'Product Borrowing' && !canUseBorrowing(user)) {
      setActiveTab('Home');
    }
    if (activeTab === 'Request more companies' && !canRequestMoreCompanies(user)) {
      setActiveTab('Home');
    }
  }, [activeTab, user]);

  const paymentStatus = user?.paymentStatus?.toUpperCase();
  const isSubscriptionExpired = (() => {
    if (user?.status === 'EXPIRED' || paymentStatus === 'EXPIRED') return true;
    if (user?.subscriptionExpiresAt) {
      const exp = new Date(user.subscriptionExpiresAt).getTime();
      return !isNaN(exp) && exp < Date.now();
    }
    return false;
  })();

  const isPaymentDueSoon = (() => {
    if (isSubscriptionExpired) return false;
    if (user?.status === 'PAYMENT_DUE' || paymentStatus === 'DUE' || paymentStatus === 'PAYMENT_DUE') return true;
    if (user?.subscriptionNextPaymentDate) {
      const nextDue = new Date(user.subscriptionNextPaymentDate).getTime();
      if (!isNaN(nextDue) && nextDue <= Date.now() + 3 * 24 * 60 * 60 * 1000) return true;
    }
    if (user?.subscriptionExpiresAt) {
      const exp = new Date(user.subscriptionExpiresAt).getTime();
      if (!isNaN(exp)) {
        const daysLeft = Math.ceil((exp - Date.now()) / (1000 * 60 * 60 * 24));
        return daysLeft <= 3 && daysLeft >= 0;
      }
    }
    return false;
  })();

  // Modals state
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddProductMenuOpen, setIsAddProductMenuOpen] = useState(false);
  const [addProductEntryMode, setAddProductEntryMode] = useState<'single' | 'bulk' | 'import' | undefined>(undefined);

  const openAddProduct = (mode: 'single' | 'bulk' | 'import') => {
    setIsAddProductMenuOpen(false);
    setEditingProduct(null);
    setAddProductEntryMode(mode);
    setActiveTab('Products');
    setIsAddProductOpen(true);
  };
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [initialAddProductLocation, setInitialAddProductLocation] = useState<{ id?: string; type?: 'warehouse' | 'shop' } | null>(null);
  const [isStaffOpen, setIsStaffOpen] = useState(false);
  const [isBranchOpen, setIsBranchOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [isStoreDetailOpen, setIsStoreDetailOpen] = useState(false);
  const [selectedDetailLocation, setSelectedDetailLocation] = useState<{
    type: 'warehouse' | 'shop';
    item: Warehouse | Shop;
  } | null>(null);

  // Record Payment Modal state
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [selectedCreditSale, setSelectedCreditSale] = useState<{
    id: string;
    customerName: string;
    invoiceNumber: string;
    remainingBalance: number;
  } | null>(null);
  const [creditFilterTab, setCreditFilterTab] = useState<'All' | 'Overdue' | 'Recent'>('All');
  const [creditSearchQuery, setCreditSearchQuery] = useState('');
  const [creditViewMode, setCreditViewMode] = useState<'table' | 'cards'>('table');
  const [selectedCustomerCreditDetails, setSelectedCustomerCreditDetails] = useState<string | null>(null);
  const [bulkCreditPayment, setBulkCreditPayment] = useState<{ customerName: string; sales: SaleRecord[]; totalOwed: number } | null>(null);

  // Product Detail Modal state
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);

  // Activity Detail Modal state
  const [selectedActivityDetail, setSelectedActivityDetail] = useState<ActivityItem | null>(null);

  // Permissions & Edit Staff Modal state
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [selectedPermissionsStaff, setSelectedPermissionsStaff] = useState<StaffMember | null>(null);
  const [isNewStaffCreated, setIsNewStaffCreated] = useState(false);
  const [isEditStaffOpen, setIsEditStaffOpen] = useState(false);
  const [selectedEditStaff, setSelectedEditStaff] = useState<StaffMember | null>(null);

  // Product Borrowing Modal & Filter State
  const [isRecordBorrowingOpen, setIsRecordBorrowingOpen] = useState(false);
  const [selectedBorrowingDetail, setSelectedBorrowingDetail] = useState<Borrowing | null>(null);
  const [borrowingFilter, setBorrowingFilter] = useState<'all' | 'active' | 'partially_returned' | 'fully_returned'>('all');
  const [borrowingSearch, setBorrowingSearch] = useState('');

  // Settings Modals & Profile State (Flutter Parity)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false);
  const [isReportIssueOpen, setIsReportIssueOpen] = useState(false);
  const [issueCategory, setIssueCategory] = useState('Bug Report');
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileCompanyId, setProfileCompanyId] = useState<string | null>(null);
  const [profileCompanyName, setProfileCompanyName] = useState('');
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [subscriptionPlanTitle, setSubscriptionPlanTitle] = useState('');
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'ACTIVE' | 'EXPIRED' | 'PENDING'>('ACTIVE');
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(true);
  // Language is now managed by useTranslation() from i18n context

  // Data state
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayInvoices: 0,
    productsCredit: 0,
    creditCustomers: 0,
    stockRemainderStatus: 'Good',
    expiredCount: 0,
  });

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [borrowings, setBorrowings] = useState<Borrowing[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [commissions, setCommissions] = useState<CommissionItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [bankSummary, setBankSummary] = useState<{ todaySales: number; productSales: number; totalExpenses: number; commission: number; netProfit: number }>({
    todaySales: 0,
    productSales: 0,
    totalExpenses: 0,
    commission: 0,
    netProfit: 0,
  });
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);

  // Bank Modals state
  const [isAddBankAccModalOpen, setIsAddBankAccModalOpen] = useState(false);
  const [isAddBankBalModalOpen, setIsAddBankBalModalOpen] = useState(false);
  const [isAddBankExpModalOpen, setIsAddBankExpModalOpen] = useState(false);

  // Commission state
  const [commissionPeriod, setCommissionPeriod] = useState<'Week' | 'Month' | 'Quarter'>('Week');
  const [commissionActiveTab, setCommissionActiveTab] = useState<'Staff Earnings' | 'Commission Report' | 'Commission Rules'>('Staff Earnings');
  const [commissionProdFilter, setCommissionProdFilter] = useState<string | null>(null);
  const [isCommissionConfigOpen, setIsCommissionConfigOpen] = useState(false);

  // Products catalog filter state (all, expired, low_stock)
  const [productCatalogFilter, setProductCatalogFilter] = useState<'all' | 'expired' | 'low_stock'>('all');

  // Request More Companies state
  const [requestCompanyNames, setRequestCompanyNames] = useState<string[]>(['']);
  const [plansList, setPlansList] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isSubmittingCompanyRequest, setIsSubmittingCompanyRequest] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Stock In / Out Form state
  const [movementType, setMovementType] = useState<'in' | 'out'>('in');
  const [selectedMovementLocationId, setSelectedMovementLocationId] = useState<string>('');
  const [selectedProdId, setSelectedProdId] = useState('');
  const [movementQty, setMovementQty] = useState<number | string>(1);
  const [movementReason, setMovementReason] = useState('Restocking');

  // Add Item Modal form states
  const [newItemName, setNewItemName] = useState('');
  const [newItemPhone, setNewItemPhone] = useState('');
  const [newItemExtra, setNewItemExtra] = useState('');

  // Reports Hub State
  const [reportSubTab, setReportSubTab] = useState<string>('overview');
  const [reportPeriod, setReportPeriod] = useState<string>('month');
  const [reportDateFrom, setReportDateFrom] = useState<string>('');
  const [reportDateTo, setReportDateTo] = useState<string>('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [reportAnalytics, setReportAnalytics] = useState<any>(null);
  const [reportStockInTx, setReportStockInTx] = useState<any[]>([]);
  const [reportStockOutTx, setReportStockOutTx] = useState<any[]>([]);
  const [reportTransferTx, setReportTransferTx] = useState<any[]>([]);
  const [reportStockFilter, setReportStockFilter] = useState<'all' | 'stock_in' | 'stock_out' | 'transfer'>('all');
  const [reportStockSearch, setReportStockSearch] = useState('');
  const [selectedStockTx, setSelectedStockTx] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportProdSearch, setReportProdSearch] = useState('');

  // Invoice Detail Modal state (Business Report)
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<any>(null);

  // Sales Report & Import State
  const [importedSales, setImportedSales] = useState<ImportedSaleRecord[]>([]);
  const [isImportSalesModalOpen, setIsImportSalesModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importParsing, setImportParsing] = useState(false);
  const [importParsedRecords, setImportParsedRecords] = useState<ImportedSaleRecord[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [salesReportSearch, setSalesReportSearch] = useState('');
  const [salesReportPaymentFilter, setSalesReportPaymentFilter] = useState<string>('all');
  const [salesReportSourceFilter, setSalesReportSourceFilter] = useState<'all' | 'live' | 'imported'>('all');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('bm_imported_sales');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setImportedSales(parsed);
          }
        }
      } catch (err) {
        console.error('Failed to parse saved imported sales', err);
      }
    }
  }, []);

  const saveImportedSales = (newList: ImportedSaleRecord[]) => {
    setImportedSales(newList);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('bm_imported_sales', JSON.stringify(newList));
      } catch (err) {
        console.error('Failed to save imported sales to localStorage', err);
      }
    }
  };

  // Today's Sales calculation: strictly includes records within the last 24 hours / correlating with current date
  const todaySalesData = useMemo(() => {
    // 1. Live store sales recorded within the last 24 hours
    const live24hSales = sales.filter((s) => isSaleWithin24Hours(s.createdAt || (s as any).saleDate));
    const live24hTotal = live24hSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
    const live24hCount = live24hSales.length;

    // Use live24hSales if available; if sales array is not loaded yet but stats.todaySales is provided from backend, fallback to stats.todaySales
    const liveAmount = live24hCount > 0 ? live24hTotal : (sales.length === 0 && stats.todaySales > 0 ? stats.todaySales : live24hTotal);
    const liveCount = live24hCount > 0 ? live24hCount : (sales.length === 0 && stats.todayInvoices > 0 ? stats.todayInvoices : live24hCount);

    // 2. Imported sales recorded within 24 hours (correlating with current date)
    const imported24hSales = importedSales.filter((s) => isSaleWithin24Hours(s.saleDate));
    const imported24hTotal = imported24hSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
    const imported24hCount = imported24hSales.length;

    return {
      totalAmount: liveAmount + imported24hTotal,
      invoicesCount: liveCount + imported24hCount,
      liveAmount,
      liveCount,
      importedAmount: imported24hTotal,
      importedCount: imported24hCount,
    };
  }, [sales, importedSales, stats.todaySales, stats.todayInvoices]);

  const handleImportFileChange = async (selectedFile: File) => {
    setImportFile(selectedFile);
    setImportError(null);
    setImportParsing(true);
    setImportParsedRecords([]);

    try {
      const ext = selectedFile.name.toLowerCase().split('.').pop() || '';
      let records: ImportedSaleRecord[] = [];
      if (ext === 'pdf') {
        records = await parseSalesFromPdf(selectedFile);
      } else if (['csv', 'tsv', 'xlsx', 'xls'].includes(ext)) {
        records = await parseSalesFromCsvOrExcel(selectedFile);
      } else {
        throw new Error('Unsupported file format. Please upload a CSV, Excel (.xlsx, .xls), or PDF file.');
      }

      if (records.length === 0) {
        throw new Error('No valid sales records could be extracted from this file. Please verify the file content.');
      }
      setImportParsedRecords(records);
    } catch (err: any) {
      setImportError(err?.message || 'Failed to parse file. Please check format and try again.');
    } finally {
      setImportParsing(false);
    }
  };

  const handleConfirmImport = () => {
    if (importParsedRecords.length === 0) return;
    const combined = [...importedSales, ...importParsedRecords];
    saveImportedSales(combined);
    const todayMatches = importParsedRecords.filter((r) => isSaleWithin24Hours(r.saleDate));
    if (todayMatches.length > 0) {
      showToast(`Imported ${importParsedRecords.length} records (${todayMatches.length} matching today added to Today's Sales)!`, 'success');
    } else {
      showToast(`Successfully imported ${importParsedRecords.length} sales records!`, 'success');
    }
    setIsImportSalesModalOpen(false);
    setImportFile(null);
    setImportParsedRecords([]);
    setImportError(null);
  };

  const handleClearImportedSales = () => {
    if (typeof window !== 'undefined' && window.confirm('Are you sure you want to remove all imported sales records? Live sales will not be affected.')) {
      saveImportedSales([]);
      showToast('Imported sales records cleared.', 'info');
    }
  };

  const downloadSalesTemplateCsv = () => {
    downloadSampleSalesTemplate('csv');
    showToast('Downloaded sales template CSV!', 'success');
  };

  // Purchases Page State
  const [purchases, setPurchases] = useState<any[]>([]);
  const [purchasesSummary, setPurchasesSummary] = useState({ totalPurchasesCost: 0, totalUnitsPurchased: 0, transactionCount: 0 });
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchasesSearch, setPurchasesSearch] = useState('');
  const [purchasesDateFilter, setPurchasesDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [purchasesLocationFilter, setPurchasesLocationFilter] = useState<string>('all');
  const [selectedPurchaseDetail, setSelectedPurchaseDetail] = useState<any>(null);
  const [purchasesPage, setPurchasesPage] = useState(1);
  const [purchasesTotalPages, setPurchasesTotalPages] = useState(1);
  const [isRecordPurchaseModalOpen, setIsRecordPurchaseModalOpen] = useState(false);
  const [purchasesRefreshTrigger, setPurchasesRefreshTrigger] = useState(0);

  const exportPurchasesCsv = () => {
    const rows = [
      ['Date', 'Reference', 'Product', 'SKU', 'Category', 'Branch', 'Qty', 'Unit Cost (ETB)', 'Total Cost (ETB)', 'Supplier', 'Staff'],
      ...purchases.map((p: any) => [
        p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-',
        p.referenceNumber || '-',
        p.productName || p.product?.name || '-',
        p.productSku || p.product?.sku || '-',
        p.productCategory || '-',
        p.warehouseName || p.warehouse?.name || p.shopName || p.shop?.name || '-',
        p.quantity || 0,
        Number(p.unitCost || 0).toFixed(2),
        Number(p.totalCost || 0).toFixed(2),
        p.supplierName || p.supplier?.name || '-',
        p.performedByName || p.performedBy?.fullName || '-',
      ]),
    ];
    const csv = rows.map(r => r.map(String).map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `purchases_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (activeTab === 'Reports') {
      (async () => {
        setReportLoading(true);
        try {
          const analyticsParams: any = { period: reportPeriod };
          if (reportPeriod === 'custom' && reportDateFrom && reportDateTo) {
            analyticsParams.from = reportDateFrom;
            analyticsParams.to = reportDateTo;
          }
          const [a, txIn, txOut, txTransfers] = await Promise.all([
            api.getReportAnalytics(analyticsParams),
            api.getStockTransactions('stock_in', 200),
            api.getStockTransactions('stock_out', 200),
            api.getTransfers(200),
          ]);
          setReportAnalytics(a);
          setReportStockInTx(txIn);
          setReportStockOutTx(txOut);
          setReportTransferTx(txTransfers);
        } catch {}
        setReportLoading(false);
      })();
    }
  }, [activeTab, reportPeriod, reportDateFrom, reportDateTo]);

  // Load purchases when tab is active or filters change
  useEffect(() => {
    const isPurchasesTab = activeTab === 'Purchases';
    const isPurchasesReport = activeTab === 'Reports' && reportSubTab === 'purchases_report';
    if (!isPurchasesTab && !isPurchasesReport) return;

    (async () => {
      setPurchasesLoading(true);
      try {
        const now = new Date();
        let startDate: string | undefined;
        let endDate: string | undefined;

        if (isPurchasesReport) {
          if (reportPeriod === 'today') {
            const d = new Date(now); d.setHours(0, 0, 0, 0);
            startDate = d.toISOString();
          } else if (reportPeriod === 'week') {
            const d = new Date(now); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0);
            startDate = d.toISOString();
          } else if (reportPeriod === 'month') {
            const d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0);
            startDate = d.toISOString();
          } else if (reportPeriod === 'year') {
            const d = new Date(now.getFullYear(), 0, 1);
            startDate = d.toISOString();
          } else if (reportPeriod === 'custom' && reportDateFrom) {
            startDate = new Date(reportDateFrom).toISOString();
            if (reportDateTo) {
              const toD = new Date(reportDateTo); toD.setHours(23, 59, 59, 999);
              endDate = toD.toISOString();
            }
          }
        } else {
          if (purchasesDateFilter === 'today') {
            const d = new Date(now); d.setHours(0, 0, 0, 0);
            startDate = d.toISOString();
          } else if (purchasesDateFilter === 'week') {
            const d = new Date(now); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0);
            startDate = d.toISOString();
          } else if (purchasesDateFilter === 'month') {
            const d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0);
            startDate = d.toISOString();
          }
        }

        let targetWarehouseId: string | undefined;
        let targetShopId: string | undefined;
        if (purchasesLocationFilter.startsWith('warehouse:')) {
          targetWarehouseId = purchasesLocationFilter.replace('warehouse:', '').trim();
        } else if (purchasesLocationFilter.startsWith('shop:')) {
          targetShopId = purchasesLocationFilter.replace('shop:', '').trim();
        }

        const result = await api.getPurchases({
          search: purchasesSearch || undefined,
          startDate,
          endDate,
          warehouseId: targetWarehouseId,
          shopId: targetShopId,
          page: purchasesPage,
          limit: 50,
        });

        // Filter by location type client-side if "warehouse" (all warehouses) or "shop" (all shops)
        let filtered = result.data;
        if (purchasesLocationFilter === 'warehouse') {
          filtered = result.data.filter((p: any) => !!p.warehouseId);
        } else if (purchasesLocationFilter === 'shop') {
          filtered = result.data.filter((p: any) => !!p.shopId);
        } else if (targetWarehouseId) {
          filtered = result.data.filter((p: any) => p.warehouseId === targetWarehouseId);
        } else if (targetShopId) {
          filtered = result.data.filter((p: any) => p.shopId === targetShopId);
        }

        setPurchases(filtered);

        // Recalculate summary accurately
        if (purchasesLocationFilter === 'all' || targetWarehouseId || targetShopId) {
          setPurchasesSummary(result.summary);
        } else {
          // 'warehouse' (all warehouses) or 'shop' (all shops) filtered from list
          const totalCost = filtered.reduce((acc: number, item: any) => acc + (Number(item.totalCost) || 0), 0);
          const totalUnits = filtered.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0);
          setPurchasesSummary({
            totalPurchasesCost: totalCost,
            totalUnitsPurchased: totalUnits,
            transactionCount: filtered.length,
          });
        }
        setPurchasesTotalPages(result.totalPages);
      } catch {}
      setPurchasesLoading(false);
    })();
  }, [activeTab, reportSubTab, reportPeriod, reportDateFrom, reportDateTo, purchasesSearch, purchasesDateFilter, purchasesLocationFilter, purchasesPage, purchasesRefreshTrigger]);

  const activeProducts = React.useMemo(() => {
    return products.filter((p) => {
      const st = (p.status || '').toLowerCase().trim();
      if (st === 'inactive' || st === 'deleted' || st === 'discontinued' || st === 'unavailable') return false;
      if (p.metadata?.isDeleted === true || p.metadata?.is_deleted === true || (p as any).deletedAt) return false;
      return true;
    });
  }, [products]);

  const isProductExpired = React.useCallback((p: Product) => {
    if (p.isExpired) return true;
    const expStr = p.expiryDate || (p as any).expirationDate || p.metadata?.expiryDate;
    if (!expStr) return false;
    const exp = new Date(expStr);
    if (isNaN(exp.getTime())) return false;
    return exp.getTime() <= Date.now();
  }, []);

  const isProductCloseToExpiry = React.useCallback((p: Product) => {
    if (isProductExpired(p)) return true;
    const expStr = p.expiryDate || (p as any).expirationDate || p.metadata?.expiryDate;
    if (expStr) {
      const exp = new Date(expStr);
      if (!isNaN(exp.getTime())) {
        const diffMs = exp.getTime() - Date.now();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays <= 30) return true;
      }
    }
    if (p.reminderDate) {
      const rem = new Date(p.reminderDate);
      if (!isNaN(rem.getTime()) && rem.getTime() <= Date.now()) return true;
    }
    return false;
  }, [isProductExpired]);

  const displayedCatalogProducts = React.useMemo(() => {
    let list = activeProducts;
    if (productCatalogFilter === 'expired') {
      list = list.filter((p) => isProductCloseToExpiry(p) || isProductExpired(p));
    } else if (productCatalogFilter === 'low_stock') {
      list = list.filter((p) => (p.stockQuantity ?? 0) <= (p.minStockLevel ?? 5));
    }
    return list;
  }, [activeProducts, productCatalogFilter, isProductCloseToExpiry, isProductExpired]);

  const movementDisplayProducts = React.useMemo(() => {
    if (!selectedMovementLocationId) {
      return [];
    }
    const locId = selectedMovementLocationId;
    const isWarehouse = warehouses.some((w) => w.id === locId);
    const isShop = shops.some((s) => s.id === locId);
    const locName = warehouses.find((w) => w.id === locId)?.name || shops.find((s) => s.id === locId)?.name;

    return activeProducts.filter((p) => {
      if (isWarehouse) {
        if (p.warehouseProducts && p.warehouseProducts.length > 0) {
          if (p.warehouseProducts.some((wp: any) => wp.warehouseId === locId || wp.warehouse?.id === locId)) return true;
        }
        if (p.warehouseId === locId) return true;
        if (p.locations && p.locations.length > 0) {
          return p.locations.some((l: any) =>
            (l.type?.toLowerCase() === 'warehouse' || !l.type) &&
            (l.id === locId || l.warehouseId === locId || (locName && l.name?.trim().toLowerCase() === locName.trim().toLowerCase()))
          );
        }
      }
      if (isShop) {
        if (p.shopProducts && p.shopProducts.length > 0) {
          if (p.shopProducts.some((sp: any) => sp.shopId === locId || sp.shop?.id === locId)) return true;
        }
        if (p.shopId === locId) return true;
        if (p.locations && p.locations.length > 0) {
          return p.locations.some((l: any) =>
            (l.type?.toLowerCase() === 'shop' || !l.type) &&
            (l.id === locId || l.shopId === locId || (locName && l.name?.trim().toLowerCase() === locName.trim().toLowerCase()))
          );
        }
      }
      return false;
    });
  }, [selectedMovementLocationId, activeProducts, warehouses, shops]);

  useEffect(() => {
    if (selectedProdId && !movementDisplayProducts.some((p) => p.id === selectedProdId)) {
      setSelectedProdId('');
    }
  }, [selectedMovementLocationId, movementDisplayProducts, selectedProdId]);

  const isStaffOwner = React.useCallback((s: StaffMember) => {
    if (s.isOwner) return true;
    if (user) {
      const u = user as any;
      if (u.id && s.id === u.id) return true;
      if (u.username && (s.firstName?.toLowerCase() === u.username.toLowerCase() || (s as any).name?.toLowerCase() === u.username.toLowerCase())) return true;
      if (u.phone && s.phone && s.phone.replace(/\D/g, '') === u.phone.replace(/\D/g, '')) return true;
    }
    return false;
  }, [user]);

  const applyProfile = (profile: Partial<UserProfile>) => {
    const companyName = profile.companyName || profile.company?.name || '';
    setProfileCompanyId(profile.companyId || profile.company?.id || null);
    setProfileCompanyName(companyName);
    setProfileFirstName(profile.firstName || '');
    setProfileLastName(profile.lastName || '');
    setProfilePhone(profile.phone || '');
    setSubscriptionPlanTitle(profile.planTitle || '');
    setSubscriptionExpiresAt(profile.subscriptionExpiresAt || null);

    if (profile.status === 'PENDING') {
      setSubscriptionStatus('PENDING');
    } else if (profile.subscriptionExpiresAt && new Date(profile.subscriptionExpiresAt) < new Date()) {
      setSubscriptionStatus('EXPIRED');
    } else {
      setSubscriptionStatus('ACTIVE');
    }
  };

  const loadProfile = async () => {
    try {
      const profile = await api.getProfile();
      applyProfile(profile);
      updateUser({
        firstName: profile.firstName,
        lastName: profile.lastName,
        companyName: profile.companyName,
        companyId: profile.companyId,
        phone: profile.phone,
        planId: profile.planId,
        planTitle: profile.planTitle,
        planAmount: profile.planAmount,
        planPeriod: profile.planPeriod,
        paymentStatus: profile.paymentStatus,
        subscriptionStartDate: profile.subscriptionStartDate,
        subscriptionExpiresAt: profile.subscriptionExpiresAt,
        subscriptionNextPaymentDate: profile.subscriptionNextPaymentDate,
        status: profile.status,
      });
    } catch {
      if (user) {
        applyProfile({
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: user.companyName,
          companyId: user.companyId,
          phone: user.phone,
          planId: user.planId,
          planTitle: user.planTitle,
          planAmount: user.planAmount,
          planPeriod: user.planPeriod,
          paymentStatus: user.paymentStatus,
          subscriptionStartDate: user.subscriptionStartDate,
          subscriptionExpiresAt: user.subscriptionExpiresAt,
          subscriptionNextPaymentDate: user.subscriptionNextPaymentDate,
          status: user.status,
        });
      }
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    // Reset all data to empty defaults so stale company data doesn't persist
    setStats({
      todaySales: 0,
      todayInvoices: 0,
      productsCredit: 0,
      creditCustomers: 0,
      stockRemainderStatus: 'Good',
      expiredCount: 0,
    });
    setActivities([]);
    setProducts([]);
    setWarehouses([]);
    setShops([]);
    setCustomers([]);
    setSuppliers([]);
    setBorrowings([]);
    setTransfers([]);
    setStaff([]);
    setCommissions([]);
    setBankAccounts([]);
    setSales([]);
    setBankSummary({ todaySales: 0, productSales: 0, totalExpenses: 0, commission: 0, netProfit: 0 });

    try {
      const results = await Promise.allSettled([
        api.getDashboardSummary(),
        api.getRecentActivities(),
        api.getProducts(),
        api.getWarehouses(),
        api.getShops(),
        api.getCustomers(),
        api.getSuppliers(),
        api.getBorrowings(),
        api.getTransfers(),
        api.getStaff(),
        api.getCommissions(),
        api.getBankAccounts(),
        api.getSales(),
        api.getBankSummary(),
        api.getPlans(),
      ]);

      const emptyStats: DashboardStats = {
        todaySales: 0,
        todayInvoices: 0,
        productsCredit: 0,
        creditCustomers: 0,
        stockRemainderStatus: 'Good',
        expiredCount: 0,
      };
      const emptyBankSummary = { todaySales: 0, productSales: 0, totalExpenses: 0, commission: 0, netProfit: 0 };

      const val = <T,>(res: PromiseSettledResult<T>, fallback: T): T =>
        res.status === 'fulfilled' ? res.value : fallback;

      setStats(val(results[0], emptyStats));
      setActivities(val(results[1], []));
      setProducts(val(results[2], []));
      setWarehouses(val(results[3], []));
      setShops(val(results[4], []));
      setCustomers(val(results[5], []));
      setSuppliers(val(results[6], []));
      setBorrowings(val(results[7], []));
      setTransfers(val(results[8], []));
      setStaff(val(results[9], []));
      setCommissions(val(results[10], []));
      setBankAccounts(val(results[11], []));
      setSales(val(results[12], []));
      setBankSummary(val(results[13], emptyBankSummary));

      const plns = val(results[14], []);
      setPlansList(plns);
      if (plns && plns.length > 0 && !selectedPlanId) {
        setSelectedPlanId(plns[0].id || plns[0].period || '');
      }
    } catch {
      // Clean fallback handled in api.ts
    } finally {
      setLoading(false);
    }
  };

  // Track company changes via a refresh key to avoid stale closure issues
  const [companyRefreshKey, setCompanyRefreshKey] = useState(0);

  useEffect(() => {
    loadAllData();
  }, [companyRefreshKey]);

  useEffect(() => {
    const handleCompanyChange = () => {
      // Increment the key to trigger a fresh loadAllData with the new company context
      setCompanyRefreshKey((prev) => prev + 1);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('bm_company_changed', handleCompanyChange);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('bm_company_changed', handleCompanyChange);
      }
    };
  }, []);


  useEffect(() => {
    if (user?.id) {
      loadProfile();
    }
  }, [user?.id]);

  const [stockTxList, setStockTxList] = useState<any[]>([]);

  const handleStockMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovementLocationId) {
      showToast('Please select a storage warehouse or shop location first.', 'error');
      return;
    }
    const prod = products.find((p) => p.id === selectedProdId);
    if (!prod) {
      showToast('Please select a valid product.', 'error');
      return;
    }
    const finalMoveQty = typeof movementQty === 'number' ? movementQty : (parseInt(movementQty) || 1);
    try {
      await api.adjustStock({
        productId: selectedProdId,
        type: movementType === 'in' ? 'stock_in' : 'stock_out',
        quantity: finalMoveQty,
        reason: movementReason,
        warehouseId: warehouses.some((w) => w.id === selectedMovementLocationId) ? selectedMovementLocationId : undefined,
        shopId: shops.some((s) => s.id === selectedMovementLocationId) ? selectedMovementLocationId : undefined,
      });
      showToast(`Stock ${movementType === 'in' ? 'IN (+)' : 'OUT (-)'} (${finalMoveQty} units) processed for "${prod.name}"!`, 'success');
      setSelectedProdId('');
      setMovementQty(1);
      await loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to process stock adjustment', 'error');
    }
  };

  const handleAddWarehouseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName) return;
    const limits = getPlanLimits(user);
    if (warehouses.length >= limits.maxStores) {
      showToast(`Your ${limits.title} plan is limited to ${limits.maxStores} stores. Upgrade to add more.`, 'error');
      setIsUpgradeOpen(true);
      return;
    }
    try {
      const created = await api.createWarehouse({ name: newItemName, location: newItemPhone || 'Main' });
      setWarehouses((prev) => [created, ...prev]);
      showToast(`Warehouse "${created.name}" created successfully!`, 'success');
      setNewItemName('');
      setNewItemPhone('');
      await loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create warehouse', 'error');
    }
  };

  const handleAddShopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName) return;
    const limits = getPlanLimits(user);
    if (shops.length >= limits.maxShops) {
      showToast(`Your ${limits.title} plan is limited to ${limits.maxShops} shops. Upgrade to add more.`, 'error');
      setIsUpgradeOpen(true);
      return;
    }
    try {
      const created = await api.createShop({ name: newItemName, location: newItemPhone || 'Retail Branch' });
      setShops((prev) => [created, ...prev]);
      showToast(`Shop "${created.name}" created successfully!`, 'success');
      setNewItemName('');
      setNewItemPhone('');
      await loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create shop', 'error');
    }
  };

  const [deleteLocationModal, setDeleteLocationModal] = useState<{
    type: 'warehouse' | 'shop';
    id: string;
    name: string;
    loading: boolean;
  } | null>(null);

  const handleConfirmDeleteLocation = async () => {
    if (!deleteLocationModal) return;
    setDeleteLocationModal((prev) => (prev ? { ...prev, loading: true } : null));
    try {
      if (deleteLocationModal.type === 'warehouse') {
        await api.deleteWarehouse(deleteLocationModal.id);
        setWarehouses((prev) => prev.filter((w) => w.id !== deleteLocationModal.id));
        showToast(`Warehouse "${deleteLocationModal.name}" deleted successfully.`, 'success');
      } else {
        await api.deleteShop(deleteLocationModal.id);
        setShops((prev) => prev.filter((s) => s.id !== deleteLocationModal.id));
        showToast(`Retail Shop "${deleteLocationModal.name}" deleted successfully.`, 'success');
      }
      setDeleteLocationModal(null);
      await loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete location.', 'error');
      setDeleteLocationModal((prev) => (prev ? { ...prev, loading: false } : null));
    }
  };

  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName) return;
    try {
      const created = await api.createCustomer({ name: newItemName, phone: newItemPhone, address: newItemExtra });
      setCustomers((prev) => [created, ...prev]);
      showToast(`Customer "${created.name}" created successfully!`, 'success');
      setNewItemName('');
      setNewItemPhone('');
      setNewItemExtra('');
      await loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create customer', 'error');
    }
  };

  const handleAddBankAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemPhone) return;
    try {
      const created = await api.createBankAccount({
        bankName: newItemName,
        accountNumber: newItemPhone,
        note: newItemExtra || undefined,
      });
      setBankAccounts((prev) => [created, ...prev]);
      showToast(`Bank Account "${created.bankName}" added successfully!`, 'success');
      setNewItemName('');
      setNewItemPhone('');
      setNewItemExtra('');
      await loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to add bank account', 'error');
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  if (user && !canAccessWebApp(user)) {
    const userTier = getUserPlanTier(user);
    const isExpired = (() => {
      const paymentStatus = String(user?.paymentStatus || '').toUpperCase();
      if (user?.status === 'EXPIRED' || paymentStatus === 'EXPIRED') return true;
      if (user?.subscriptionExpiresAt) {
        const exp = new Date(user.subscriptionExpiresAt).getTime();
        return !isNaN(exp) && exp < Date.now();
      }
      return false;
    })();

    const tierTitle = isExpired
      ? 'Subscription Expired'
      : userTier === 'trial'
      ? 'Free Trial (Mobile Only)'
      : userTier === 'medium'
      ? 'Medium Business Plan'
      : userTier === 'small'
      ? 'Small Business Plan'
      : 'Subscription Inactive';

    return (
      <div className="min-h-screen bg-[#EAF0F6] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200/80 shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 bg-blue-50 text-[#025EA7] rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8 text-[#025EA7]" />
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#025EA7] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              Large Business Only
            </span>
            <h2 className="text-xl font-black text-slate-900 mt-3">
              Web App Access Restricted
            </h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              The BM Stock Web App is exclusively accessible to users who purchased the <strong>Large Business package (15,999 ETB)</strong>.
            </p>
            <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left text-xs space-y-2">
              <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Your Current Subscription</div>
              <div className="font-bold text-slate-900 flex items-center justify-between">
                <span>{user?.companyName || user?.firstName || 'Account'}</span>
                <span className="text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-extrabold text-[11px]">
                  {tierTitle}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 pt-1 leading-normal">
                {isExpired
                  ? 'Your subscription has expired. Please upgrade to the Large Business plan to continue using the Web App.'
                  : 'Free Trial, Small Business, and Medium Business packages include full access to the BM Stock Mobile App on Android & iOS. Upgrade to the Large Business package to unlock the Web App.'}
              </p>
            </div>
          </div>
          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsUpgradeOpen(true)}
              className="w-full py-3.5 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-current" />
              Upgrade to Large Business Plan (15,999 ETB)
            </button>
            <button
              type="button"
              onClick={logout}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all cursor-pointer"
            >
              Sign Out / Switch Account
            </button>
          </div>
        </div>
        <UpgradePlanModal isOpen={isUpgradeOpen} onClose={() => setIsUpgradeOpen(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EAF0F6] p-4 md:p-6 font-sans">
      <div className="max-w-[1600px] mx-auto flex gap-5 items-start">
        
        {/* Left Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          onOpenUpgradeModal={() => setIsUpgradeOpen(true)}
          onOpenNewSaleModal={() => setIsNewSaleOpen(true)}
          user={user}
        />

        {/* Main Content Web Portal Container */}
        <main className="flex-1 bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100/80 min-h-[95vh]">
          
          {/* Header Bar */}
          <Header />

          {/* Payment / Subscription Due Banner */}
          {(isSubscriptionExpired || isPaymentDueSoon) && (
            <div className={`mb-6 p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all shadow-sm ${
              isSubscriptionExpired
                ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                : 'bg-amber-50/90 border-amber-200 text-amber-950'
            }`}>
              <div className="flex items-start gap-3.5">
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  isSubscriptionExpired ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'
                }`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm md:text-base flex items-center gap-2">
                    {isSubscriptionExpired ? 'Subscription Expired' : 'Payment Due Soon'}
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      isSubscriptionExpired ? 'bg-rose-200 text-rose-800' : 'bg-amber-200 text-amber-900'
                    }`}>
                      {isSubscriptionExpired ? 'Action Required' : 'Payment Due'}
                    </span>
                  </h4>
                  <p className="text-xs md:text-sm mt-0.5 opacity-90">
                    {isSubscriptionExpired
                      ? (user?.subscriptionExpiresAt
                          ? `Your subscription expired on ${new Date(user.subscriptionExpiresAt).toLocaleDateString()}. Renew now to restore full access to all features.`
                          : 'Your subscription plan has expired. Renew your plan to continue using all features.')
                      : (user?.subscriptionNextPaymentDate
                          ? `Subscription payment is due on ${new Date(user.subscriptionNextPaymentDate).toLocaleDateString()}. Renew your plan to prevent service interruption.`
                          : 'Your subscription payment is due soon. Renew your plan to prevent service interruption.')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams({ renewal: 'true' });
                    if (user?.phone) params.set('phone', user.phone);
                    router.push(`/choose-plan?${params.toString()}`);
                  }}
                  className={`w-full md:w-auto px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold text-white shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 ${
                    isSubscriptionExpired
                      ? 'bg-rose-600 hover:bg-rose-700 active:scale-95'
                      : 'bg-[#025EA7] hover:bg-[#024a85] active:scale-95'
                  }`}
                >
                  <RefreshCw className="w-4 h-4" />
                  {isSubscriptionExpired ? 'Renew Subscription' : 'Renew Plan'}
                </button>
              </div>
            </div>
          )}

          {/* ACTIVE TAB VIEW CONTENT */}

          {/* TAB 1: HOME */}
          {activeTab === 'Home' && (
            <div>
              {/* Top 4 KPI Summary Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {(() => {
                  return (
                    <div onClick={() => setActiveTab('Sales History')} className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm cursor-pointer hover:border-[#025EA7]/40 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-3">
                        <span className="flex items-center gap-1.5 font-bold text-slate-700">
                          {t('todays_sales')}
                          {todaySalesData.importedCount > 0 && (
                            <span className="text-[10px] bg-blue-50 text-[#025EA7] font-semibold px-1.5 py-0.5 rounded-full border border-blue-200">
                              +{todaySalesData.importedCount} imp
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          {todaySalesData.invoicesCount} {todaySalesData.invoicesCount === 1 ? 'invoice' : 'invoices'} (24h)
                        </span>
                      </div>
                      <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
                        ETB {todaySalesData.totalAmount.toLocaleString()}
                      </div>
                      {todaySalesData.importedCount > 0 && (
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                          <span>Live: ETB {todaySalesData.liveAmount.toLocaleString()}</span>
                          <span>•</span>
                          <span className="text-[#025EA7] font-medium">Imp: ETB {todaySalesData.importedAmount.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div
                  onClick={() => {
                    setProductCatalogFilter('all');
                    setActiveTab('Products');
                  }}
                  className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm cursor-pointer hover:border-[#025EA7]/40 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-3">
                    <span>Total Products</span>
                    <span className="text-[11px] text-slate-400 font-normal">{products.length} items</span>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    {products.length}
                  </div>
                </div>

                <div onClick={() => setActiveTab('Outstanding Credit')} className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm cursor-pointer hover:border-[#025EA7]/40 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-3">
                    <span>Outstanding Credit</span>
                    <span className="text-[11px] text-slate-400 font-normal">{stats.creditCustomers} customers</span>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    ETB {stats.productsCredit.toLocaleString()}
                  </div>
                </div>

                <div
                  onClick={() => {
                    setProductCatalogFilter('low_stock');
                    setActiveTab('Products');
                  }}
                  className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm cursor-pointer hover:border-amber-400/60 hover:shadow-md transition-all group"
                >
                  <div className="text-xs text-slate-400 font-medium mb-3 group-hover:text-amber-600 transition-colors">{t('stock_reminder')}</div>
                  <div className="text-2xl font-extrabold text-red-600 tracking-tight group-hover:text-amber-600 transition-colors">
                    {stats.stockRemainderStatus}
                  </div>
                </div>

                <div
                  onClick={() => {
                    setProductCatalogFilter('expired');
                    setActiveTab('Products');
                  }}
                  className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm cursor-pointer hover:border-rose-400/60 hover:shadow-md transition-all group"
                >
                  <div className="text-xs text-slate-400 font-medium mb-3 group-hover:text-rose-600 transition-colors">{t('expired_items')}</div>
                  <div className="text-2xl font-extrabold text-slate-900 tracking-tight group-hover:text-rose-600 transition-colors">
                    {stats.expiredCount}
                  </div>
                </div>
              </div>

              {/* 4 Quick Action Pastel Cards Row — permission-gated */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {hasModulePermission(user, 'createSale', 'edit') && (
                <button
                  onClick={() => setIsNewSaleOpen(true)}
                  className="bg-[#F0F4FA] hover:bg-[#E4ECF6] active:scale-[0.98] rounded-2xl p-6 flex flex-col items-center justify-center transition-all border border-slate-100 group"
                >
                  <div className="w-12 h-12 bg-emerald-100/70 text-emerald-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Tag className="w-6 h-6 fill-emerald-100 stroke-[2.2]" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">{t('new_sale')}</span>
                </button>
                )}

                {hasModulePermission(user, 'staffManagement', 'edit') && (
                <button
                  onClick={() => setIsStaffOpen(true)}
                  className="bg-[#F0F4FA] hover:bg-[#E4ECF6] active:scale-[0.98] rounded-2xl p-6 flex flex-col items-center justify-center transition-all border border-slate-100 group"
                >
                  <div className="w-12 h-12 bg-blue-100/70 text-[#025EA7] rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">{t('add_staff')}</span>
                </button>
                )}

                {hasModulePermission(user, 'branch', 'edit') && (
                <button
                  onClick={() => setIsBranchOpen(true)}
                  className="bg-[#F0F4FA] hover:bg-[#E4ECF6] active:scale-[0.98] rounded-2xl p-6 flex flex-col items-center justify-center transition-all border border-slate-100 group"
                >
                  <div className="w-12 h-12 bg-amber-100/70 text-amber-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Building className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">{t('add_branch')}</span>
                </button>
                )}

                {hasModulePermission(user, 'reports') && (
                <button
                      onClick={() => {
                        setReportSubTab('overview');
                        setActiveTab('Reports');
                      }}
                  className="bg-[#F0F4FA] hover:bg-[#E4ECF6] active:scale-[0.98] rounded-2xl p-6 flex flex-col items-center justify-center transition-all border border-slate-100 group"
                >
                  <div className="w-12 h-12 bg-orange-100/70 text-orange-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <FileText className="w-6 h-6 stroke-[2.2]" />
                  </div>
                      <span className="text-sm font-bold text-slate-800">{t('reports')}</span>
                </button>
                )}
              </div>

              {/* Recent Activity Section */}
              <section className="bg-white border border-slate-100 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">{t('recent_activity')}</h2>
                  <button
                    onClick={() => setActiveTab('Sales History')}
                    className="text-xs font-bold text-[#025EA7] hover:underline"
                  >
                    {t('view_all')}
                  </button>
                </div>

                {activities.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No recent activities recorded in backend yet. Create your first sale above!
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {activities.map((act) => {
                      const getActivityTheme = (type: ActivityItem['type']) => {
                        switch (type) {
                          case 'sale':
                            return {
                              icon: Tag,
                              iconBg: 'bg-emerald-100 text-emerald-700',
                              badgeBg: 'bg-emerald-100 text-emerald-800',
                            };
                          case 'stockIn':
                            return {
                              icon: Plus,
                              iconBg: 'bg-blue-100 text-[#025EA7]',
                              badgeBg: 'bg-blue-100 text-[#025EA7]',
                            };
                          case 'stockOut':
                            return {
                              icon: ArrowUpRight,
                              iconBg: 'bg-rose-100 text-rose-700',
                              badgeBg: 'bg-rose-100 text-rose-800',
                            };
                          case 'borrowing':
                            return {
                              icon: Box,
                              iconBg: 'bg-amber-100 text-amber-800',
                              badgeBg: 'bg-amber-100 text-amber-800',
                            };
                          case 'productAdded':
                            return {
                              icon: Package,
                              iconBg: 'bg-purple-100 text-purple-700',
                              badgeBg: 'bg-purple-100 text-purple-800',
                            };
                          case 'transfer':
                            return {
                              icon: Repeat,
                              iconBg: 'bg-teal-100 text-teal-800',
                              badgeBg: 'bg-teal-100 text-teal-800',
                            };
                          default:
                            return {
                              icon: FileCode,
                              iconBg: 'bg-slate-100 text-slate-700',
                              badgeBg: 'bg-slate-100 text-slate-700',
                            };
                        }
                      };

                      const theme = getActivityTheme(act.type);
                      const IconComp = theme.icon;

                      return (
                        <div
                          key={act.id}
                          onClick={() => setSelectedActivityDetail(act)}
                          title="Click to view activity details"
                          className="py-4 px-3 rounded-2xl hover:bg-blue-50/70 transition-all cursor-pointer flex items-start justify-between group border border-transparent hover:border-blue-100"
                        >
                          <div className="flex items-start gap-3.5">
                            <div className={`w-10 h-10 rounded-2xl ${theme.iconBg} flex items-center justify-center shrink-0 mt-0.5 shadow-xs`}>
                              <IconComp className="w-5 h-5 stroke-[2.2]" />
                            </div>

                            <div>
                              <div className="text-sm font-bold text-slate-900 leading-tight group-hover:text-[#025EA7] transition-colors">{act.title}</div>
                              <div className="text-xs text-slate-400 mt-0.5 font-normal">{act.subtitle}</div>

                              <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400">Customer / Partner</span>
                                  <span className="font-bold text-slate-900">{act.customerName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400">Staff / Seller</span>
                                  <span className="font-bold text-slate-900">{act.salesPerson}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400">Amount / Qty</span>
                                  <span className="font-bold text-slate-900">{act.amount}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400">Store Branch</span>
                                  <span className="font-bold text-slate-900">{act.storeName}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 pt-1 text-right">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${theme.badgeBg}`}>
                              {act.status}
                            </span>
                            <span className="text-[11px] text-[#025EA7] font-bold opacity-0 group-hover:opacity-100 transition-opacity block mt-1">
                              View Details →
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB 2: STORE (WAREHOUSES) */}
          {activeTab === 'Store' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Warehouses ("Store" Tab)</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Manage storage facilities, inventory distribution, and bulk stock levels</p>
                </div>
                {hasModulePermission(user, 'addProduct', 'edit') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('Products');
                      setIsAddProductOpen(true);
                    }}
                    className="py-2.5 px-4 bg-[#025EA7] text-white rounded-xl text-xs font-bold hover:bg-[#014883] transition-all flex items-center gap-2 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> {t('add_product')}
                  </button>
                )}
              </div>

              {/* Add Warehouse inline form */}
              {hasModulePermission(user, 'warehouse', 'edit') && (
              <form onSubmit={handleAddWarehouseSubmit} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Warehouse Name (e.g. Mercato Main Store)"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Location / Address (e.g. Addis Ababa)"
                  value={newItemPhone}
                  onChange={(e) => setNewItemPhone(e.target.value)}
                  className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                />
                <button
                  type="submit"
                  className="py-2 px-4 bg-[#025EA7] text-white rounded-xl text-xs font-bold hover:bg-[#014883] transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Warehouse
                </button>
              </form>
              )}

              {/* Warehouses Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getAccessibleWarehouses(user, warehouses).length === 0 ? (
                  <div className="col-span-full py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    No accessible warehouses found.
                  </div>
                ) : (
                  getAccessibleWarehouses(user, warehouses).map((wh) => (
                    <div
                      key={wh.id}
                      onClick={() => {
                        setSelectedDetailLocation({ type: 'warehouse', item: wh });
                        setIsStoreDetailOpen(true);
                      }}
                      className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-blue-300"
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-blue-50 text-[#025EA7] rounded-xl flex items-center justify-center group-hover:bg-[#025EA7] group-hover:text-white transition-colors shrink-0">
                          <Building className="w-5 h-5" />
                        </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#025EA7] transition-colors truncate">{wh.name}</h4>
                            <span className="text-xs text-slate-500 truncate block">{wh.location || 'Main Storage'}</span>
                        </div>
                        </div>
                        {(isUserOwnerOrAdmin(user) || hasModulePermission(user, 'warehouse', 'edit')) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteLocationModal({
                                type: 'warehouse',
                                id: wh.id,
                                name: wh.name,
                                loading: false,
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition shrink-0"
                            title={`Delete Warehouse "${wh.name}"`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600">
                        <span>Manager: {wh.managerName || 'Admin'}</span>
                        <span className="text-[#025EA7] font-bold group-hover:underline">View Store Inventory →</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SHOP (RETAIL STORES) */}
          {activeTab === 'Shop' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Retail Shops & POS Branches</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Manage customer-facing retail outlets, register counters, and branch stock</p>
                </div>
                {hasModulePermission(user, 'addProduct', 'edit') && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsAddProductMenuOpen((v) => !v)}
                      className="py-2.5 px-4 bg-[#025EA7] text-white rounded-xl text-xs font-bold hover:bg-[#014883] transition-all flex items-center gap-2 shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> {t('add_product')} <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    {isAddProductMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsAddProductMenuOpen(false)} />
                        <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-1.5">
                          <button
                            type="button"
                            onClick={() => openAddProduct('single')}
                            className="w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left hover:bg-blue-50 transition"
                          >
                            <Package className="w-4 h-4 text-[#025EA7] mt-0.5 shrink-0" />
                            <span>
                              <span className="block text-xs font-bold text-slate-900">Single Product</span>
                              <span className="block text-[10px] text-slate-500">Add one product at a time</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={!canUseBulkEntry(user)}
                            onClick={() => {
                              if (!canUseBulkEntry(user)) return;
                              openAddProduct('bulk');
                            }}
                            className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition ${
                              canUseBulkEntry(user) ? 'hover:bg-blue-50' : 'opacity-60 cursor-not-allowed'
                            }`}
                          >
                            {canUseBulkEntry(user) ? (
                              <Tag className="w-4 h-4 text-[#7C3AED] mt-0.5 shrink-0" />
                            ) : (
                              <Lock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                            )}
                            <span>
                              <span className="block text-xs font-bold text-slate-900">Bulk Entry</span>
                              <span className="block text-[10px] text-slate-500">
                                {canUseBulkEntry(user) ? 'Paste rows from a spreadsheet' : 'Requires Medium or Large plan'}
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={!canUseProductImport(user)}
                            onClick={() => {
                              if (!canUseProductImport(user)) return;
                              openAddProduct('import');
                            }}
                            className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition ${
                              canUseProductImport(user) ? 'hover:bg-blue-50' : 'opacity-60 cursor-not-allowed'
                            }`}
                          >
                            {canUseProductImport(user) ? (
                              <UploadCloud className="w-4 h-4 text-[#16A34A] mt-0.5 shrink-0" />
                            ) : (
                              <Lock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                            )}
                            <span>
                              <span className="block text-xs font-bold text-slate-900">Import Excel / CSV</span>
                              <span className="block text-[10px] text-slate-500">
                                {canUseProductImport(user) ? 'Upload a file or export the template' : 'Requires Large plan'}
                              </span>
                            </span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Add Shop Form */}
              {hasModulePermission(user, 'branch', 'edit') && (
              <form onSubmit={handleAddShopSubmit} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Shop Name (e.g. Bole Branch Shop)"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Location (e.g. Bole Medhanialem)"
                  value={newItemPhone}
                  onChange={(e) => setNewItemPhone(e.target.value)}
                  className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                />
                <button
                  type="submit"
                  className="py-2 px-4 bg-[#025EA7] text-white rounded-xl text-xs font-bold hover:bg-[#014883] transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Retail Shop
                </button>
              </form>
              )}

              {/* Shops Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getAccessibleShops(user, shops).length === 0 ? (
                  <div className="col-span-full py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    No accessible retail shops found.
                  </div>
                ) : (
                  getAccessibleShops(user, shops).map((sh) => (
                    <div
                      key={sh.id}
                      onClick={() => {
                        setSelectedDetailLocation({ type: 'shop', item: sh });
                        setIsStoreDetailOpen(true);
                      }}
                      className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-emerald-300"
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">{sh.name}</h4>
                            <span className="text-xs text-slate-500 truncate block">{sh.location || 'Retail Store'}</span>
                        </div>
                        </div>
                        {(isUserOwnerOrAdmin(user) || hasModulePermission(user, 'branch', 'edit')) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteLocationModal({
                                type: 'shop',
                                id: sh.id,
                                name: sh.name,
                                loading: false,
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition shrink-0"
                            title={`Delete Retail Shop "${sh.name}"`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600">
                        <span>Manager: {sh.managerName || 'Branch Staff'}</span>
                        <span className="text-emerald-600 font-bold group-hover:underline">View Shop Inventory →</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ADD PRODUCTS */}
          {activeTab === 'Products' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{t('add_product')}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{t('products_catalog')}</p>
                </div>
                {hasModulePermission(user, 'addProduct', 'edit') && (
                <button
                  onClick={() => setIsAddProductOpen(true)}
                  className="py-2.5 px-4 bg-[#025EA7] text-white rounded-xl text-xs font-bold hover:bg-[#014883] transition-all flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> {t('add_product')}
                </button>
                )}
              </div>

              {/* Products Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setProductCatalogFilter('all')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      productCatalogFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Products ({activeProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductCatalogFilter('expired')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                      productCatalogFilter === 'expired'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-rose-600'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${productCatalogFilter === 'expired' ? 'bg-white' : 'bg-rose-500'}`}></span>
                    Close to Expiry ({activeProducts.filter((p) => isProductCloseToExpiry(p) || isProductExpired(p)).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductCatalogFilter('low_stock')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                      productCatalogFilter === 'low_stock'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-amber-600'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${productCatalogFilter === 'low_stock' ? 'bg-white' : 'bg-amber-500'}`}></span>
                    Low Stock ({activeProducts.filter((p) => (p.stockQuantity ?? 0) <= (p.minStockLevel ?? 5)).length})
                  </button>
                </div>

                {productCatalogFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setProductCatalogFilter('all')}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline"
                  >
                    Clear Filter
                  </button>
                )}
              </div>

              {/* Active Expiry Banner */}
              {productCatalogFilter === 'expired' && (
                <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Showing <strong>{displayedCatalogProducts.length}</strong> products close to expiration or already expired.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProductCatalogFilter('all')}
                    className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-700 font-bold rounded-lg border border-rose-200 transition-colors"
                  >
                    Show All
                  </button>
                </div>
              )}

              {/* Products Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">{t('product_name')}</th>
                      <th className="p-3.5">{t('sku')}</th>
                      <th className="p-3.5">{t('category')}</th>
                      <th className="p-3.5">{t('selling_price')}</th>
                      <th className="p-3.5">{t('stock_quantity')}</th>
                      <th className="p-3.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {displayedCatalogProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-xs text-slate-400">
                          {productCatalogFilter === 'expired'
                            ? 'No products are currently close to expiry or expired.'
                            : productCatalogFilter === 'low_stock'
                            ? 'No products are currently low in stock.'
                            : 'No active products found. Click "Add Product" to create your first item.'}
                        </td>
                      </tr>
                    ) : (
                      displayedCatalogProducts.map((p) => {
                        const expired = isProductExpired(p);
                        const closeToExpiry = !expired && isProductCloseToExpiry(p);

                        return (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedProductDetail(p)}
                          title="Click to view product details"
                          className="hover:bg-blue-50/70 cursor-pointer transition-colors group"
                        >
                            <td className="p-3.5 font-bold text-slate-900 group-hover:text-[#025EA7]">
                              <div className="flex items-center gap-2">
                            <span>{p.name}</span>
                                {expired && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                                    Expired
                                  </span>
                                )}
                                {closeToExpiry && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                    Close to Expiry
                                  </span>
                                )}
                            <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 font-normal">View →</span>
                              </div>
                          </td>
                          <td className="p-3.5 text-slate-500">{p.sku || 'N/A'}</td>
                          <td className="p-3.5 text-slate-600">{p.category || 'General'}</td>
                          <td className="p-3.5 font-bold text-slate-900">ETB {p.price.toLocaleString()}</td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              p.stockQuantity <= 5
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {p.stockQuantity} {p.unit || 'units'}
                            </span>
                            </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-1">
                              {(hasModulePermission(user, 'editProduct', 'edit') || hasModulePermission(user, 'addProduct', 'edit')) && (
                                <button
                                  type="button"
                                  title="Edit product"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedProductDetail(null);
                                    setEditingProduct(p);
                                    setIsAddProductOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold text-[#025EA7] bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all"
                                >
                                  <Pencil className="w-4 h-4" />
                                  Edit
                                </button>
                              )}
                              {hasModulePermission(user, 'addProduct', 'edit') && (
                                <button
                                  type="button"
                                  title="Remove product"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Remove "${p.name}" from the catalog? This cannot be undone.`)) {
                                      api.deleteProduct(p.id)
                                        .then(() => {
                                          showToast(`Product "${p.name}" removed successfully.`, 'success');
                                          loadAllData();
                                        })
                                        .catch((err: any) => showToast(err?.message || 'Failed to remove product', 'error'));
                                    }
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: STOCK IN / OUT */}
          {activeTab === 'Stock Out / In' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Stock In / Out Management</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Record inventory restocks (+ Stock In) or adjustments (- Stock Out)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form Column */}
                <form onSubmit={handleStockMovementSubmit} className="lg:col-span-2 bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-5">
                  
                  {/* Segmented Toggle: Stock In vs Stock Out */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Movement Action</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setMovementType('in');
                          setMovementReason('Restocking');
                        }}
                        className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                          movementType === 'in'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Plus className="w-4 h-4" /> 📥 Stock In (Restock)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMovementType('out');
                          setMovementReason('Sales / Correction');
                        }}
                        className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                          movementType === 'out'
                            ? 'bg-red-600 text-white border-red-600 shadow-md'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" /> 📤 Stock Out (Adjustment)
                      </button>
                    </div>
                  </div>

                  {/* Location Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                      <Building className="w-4 h-4 text-[#025EA7]" /> Storage Branch / Location *
                    </label>
                    <select
                      required
                      value={selectedMovementLocationId}
                      onChange={(e) => setSelectedMovementLocationId(e.target.value)}
                      className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7]"
                    >
                      <option value="">-- Select Warehouse or Shop Location --</option>
                      {warehouses.length > 0 && (
                        <optgroup label="Warehouses">
                      {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              Warehouse: {w.name} {w.location ? `(${w.location})` : ''}
                            </option>
                      ))}
                        </optgroup>
                      )}
                      {shops.length > 0 && (
                        <optgroup label="Shops">
                      {shops.map((s) => (
                            <option key={s.id} value={s.id}>
                              Shop: {s.name} {s.location ? `(${s.location})` : ''}
                            </option>
                      ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  {/* Product Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                      <Package className="w-4 h-4 text-[#025EA7]" /> Select Product *
                    </label>
                    <select
                      required
                      disabled={!selectedMovementLocationId}
                      value={selectedProdId}
                      onChange={(e) => setSelectedProdId(e.target.value)}
                      className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      {!selectedMovementLocationId ? (
                        <option value="">-- Please select a warehouse or shop first --</option>
                      ) : movementDisplayProducts.length === 0 ? (
                        <option value="" disabled>-- No products available under this location --</option>
                      ) : (
                        <>
                      <option value="">-- Select Product --</option>
                          {movementDisplayProducts.map((p) => {
                            const selectedLocName = warehouses.find((w) => w.id === selectedMovementLocationId)?.name || shops.find((s) => s.id === selectedMovementLocationId)?.name;
                            const locStock = p.locations?.find((l: any) => l.id === selectedMovementLocationId || (selectedLocName && l.name?.trim().toLowerCase() === selectedLocName.trim().toLowerCase()))?.quantity ?? p.stockQuantity;
                            return (
                        <option key={p.id} value={p.id}>
                                {p.name} (Stock at {selectedLocName || 'Location'}: {locStock} {p.unit || 'units'}) - ETB {p.price.toLocaleString()}
                        </option>
                            );
                          })}
                        </>
                      )}
                    </select>
                  </div>

                  {/* Quantity Stepper */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Adjustment Quantity</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setMovementQty(Math.max(1, (typeof movementQty === 'number' ? movementQty : parseInt(movementQty) || 1) - 1))}
                        className="w-10 h-10 bg-white rounded-xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 flex items-center justify-center"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={movementQty}
                        onChange={(e) => setMovementQty(e.target.value === '' ? '' : (parseInt(e.target.value) || ''))}
                        className="w-28 py-2.5 text-center bg-white border border-slate-200 rounded-xl text-sm font-extrabold focus:ring-2 focus:ring-[#025EA7]"
                      />
                      <button
                        type="button"
                        onClick={() => setMovementQty((typeof movementQty === 'number' ? movementQty : parseInt(movementQty) || 0) + 1)}
                        className="w-10 h-10 bg-white rounded-xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Reason Chips (Flutter-identical) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Transaction Reason</label>
                    <div className="flex flex-wrap gap-2">
                      {(movementType === 'in'
                        ? ['Restocking', 'Return', 'Damaged Return', 'Correction', 'Other']
                        : ['Sales / Correction', 'Damaged / Expired', 'Internal Use', 'Transfer Out', 'Loss / Theft', 'Other']
                      ).map((reason) => {
                        const isSelected = movementReason === reason;
                        return (
                          <button
                            key={reason}
                            type="button"
                            onClick={() => setMovementReason(reason)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                              isSelected
                                ? 'bg-[#025EA7] text-white border-[#025EA7] shadow-sm'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {reason}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!selectedProdId}
                    className={`w-full py-3.5 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 ${
                      movementType === 'in'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {movementType === 'in' ? '✓ Process Stock In (+)' : '✓ Process Stock Out (-)'}
                  </button>
                </form>

                {/* Live Stock Level Preview Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">Stock Impact Preview</h3>
                  
                  {selectedProdId ? (() => {
                    const prod = products.find((p) => p.id === selectedProdId);
                    if (!prod) return null;
                    const current = prod.stockQuantity || 0;
                    const numMoveQty = typeof movementQty === 'number' ? movementQty : (parseInt(movementQty) || 0);
                    const project = movementType === 'in' ? current + numMoveQty : Math.max(0, current - numMoveQty);
                    return (
                      <div className="space-y-3 text-xs">
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <div className="text-slate-400 font-medium">Product</div>
                          <div className="font-bold text-slate-900 text-sm">{prod.name}</div>
                          <div className="text-[11px] text-slate-500">SKU: {prod.sku || 'N/A'}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                            <div className="text-slate-400 font-medium">Current</div>
                            <div className="font-extrabold text-slate-900 text-lg">{current}</div>
                          </div>
                          <div className={`p-3 rounded-xl border text-center ${movementType === 'in' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="text-slate-500 font-medium">New Level</div>
                            <div className={`font-extrabold text-lg ${movementType === 'in' ? 'text-emerald-700' : 'text-red-700'}`}>
                              {project}
                            </div>
                          </div>
                        </div>

                        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-slate-700 font-medium">
                          Reason: <span className="font-bold">{movementReason}</span>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="py-12 text-center text-xs text-slate-400">
                      Select a product on the left to preview updated stock levels before posting.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: SALES HISTORY */}
          {activeTab === 'Sales History' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Sales History</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Full audit trail of sales invoices and transaction records</p>
                </div>
                {hasModulePermission(user, 'createSale', 'edit') && (
                <button
                  onClick={() => setIsNewSaleOpen(true)}
                  className="py-2.5 px-4 bg-[#025EA7] hover:bg-[#014883] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" /> New Sale
                </button>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Invoice #</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Customer</th>
                      <th className="p-3.5">Sales Person</th>
                      <th className="p-3.5">Store Branch</th>
                      <th className="p-3.5">Total Amount</th>
                      <th className="p-3.5">Advance Paid</th>
                      <th className="p-3.5">Remaining</th>
                      <th className="p-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {sales.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-xs text-slate-400">
                          No sales history found in backend.
                        </td>
                      </tr>
                    ) : (
                      sales.map((s) => {
                        const remBal = s.remainingBalance || 0;
                        const advPaid = s.advancePayment || (s.totalAmount - remBal);
                        const isPartiallyPaid = s.status === 'partially_paid' || (advPaid > 0 && remBal > 0);
                        const isUnpaid = s.status === 'pending' && advPaid <= 0 && remBal > 0;
                        const rawDate = s.saleDate || s.createdAt;
                        let dateFormatted = 'N/A';
                        if (rawDate) {
                          try {
                            const d = new Date(rawDate);
                            dateFormatted = !isNaN(d.getTime()) ? d.toLocaleDateString() : String(rawDate);
                          } catch {
                            dateFormatted = String(rawDate);
                          }
                        }
                        return (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="p-3.5 font-bold text-slate-900">{s.invoiceNumber}</td>
                          <td className="p-3.5 text-slate-500 whitespace-nowrap">{dateFormatted}</td>
                          <td className="p-3.5 text-slate-700">{s.customerName}</td>
                          <td className="p-3.5 text-slate-600">{s.salesPerson}</td>
                          <td className="p-3.5 text-slate-600">{s.storeName}</td>
                          <td className="p-3.5 font-bold text-slate-900">ETB {s.totalAmount.toLocaleString()}</td>
                          <td className="p-3.5 font-semibold text-emerald-600">ETB {advPaid > 0 ? advPaid.toLocaleString() : '0'}</td>
                          <td className="p-3.5 font-semibold text-amber-700">ETB {remBal > 0 ? remBal.toLocaleString() : '0'}</td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                              remBal <= 0
                                ? 'bg-emerald-100 text-emerald-700'
                                : isPartiallyPaid
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {remBal <= 0 ? 'Paid' : isPartiallyPaid ? 'Partially Paid' : 'Unpaid'}
                            </span>
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 8: OUTSTANDING CREDIT (Flutter Parity) */}
          {activeTab === 'Outstanding Credit' && (() => {
            const creditSales = sales.filter((s) => (s.paymentType === 'credit' || (s.remainingBalance && s.remainingBalance > 0)) && (s.remainingBalance || 0) > 0.01);

            const searchFiltered = creditSearchQuery.trim()
              ? creditSales.filter((s) =>
                  s.customerName.toLowerCase().includes(creditSearchQuery.toLowerCase().trim()) ||
                  (s.customerPhone && s.customerPhone.includes(creditSearchQuery.trim()))
                )
              : creditSales;

            const customerMap: Record<string, { name: string; phone?: string; totalOwed: number; invoiceCount: number; sales: SaleRecord[]; oldestDays: number }> = {};
            
            for (const sale of searchFiltered) {
              const key = sale.customerName || 'Walk-in Customer';
              const rem = sale.remainingBalance || sale.totalAmount || 0;
              const saleDate = sale.createdAt ? new Date(sale.createdAt) : new Date();
              const daysOld = Math.max(0, Math.floor((Date.now() - saleDate.getTime()) / (1000 * 60 * 60 * 24)));

              if (!customerMap[key]) {
                customerMap[key] = {
                  name: key,
                  phone: sale.customerPhone,
                  totalOwed: rem,
                  invoiceCount: 1,
                  sales: [sale],
                  oldestDays: daysOld,
                };
              } else {
                customerMap[key].totalOwed += rem;
                customerMap[key].invoiceCount += 1;
                customerMap[key].sales.push(sale);
                if (daysOld > customerMap[key].oldestDays) {
                  customerMap[key].oldestDays = daysOld;
                }
              }
            }

            var customerList = Object.values(customerMap).sort((a, b) => b.totalOwed - a.totalOwed);

            if (creditFilterTab === 'Overdue') {
              customerList = customerList.filter((c) => c.oldestDays > 30);
            } else if (creditFilterTab === 'Recent') {
              customerList = customerList.filter((c) => c.oldestDays <= 30);
            }

            const totalOutstanding = customerList.reduce((sum, c) => sum + c.totalOwed, 0);
            const totalInvoicesCount = customerList.reduce((sum, c) => sum + c.invoiceCount, 0);

            const totalCreditGiven = sales.filter(s => s.paymentType === 'credit').reduce((sum, s) => sum + s.totalAmount, 0);
            const paidCreditSum = sales.filter(s => s.paymentType === 'credit').reduce((sum, s) => sum + (s.totalAmount - (s.remainingBalance || 0)), 0);
            const unpaidCreditSum = creditSales.filter(s => (!s.advancePayment || s.advancePayment <= 0)).reduce((sum, s) => sum + (s.remainingBalance || 0), 0);
            const partiallyPaidCreditSum = creditSales.filter(s => (s.advancePayment && s.advancePayment > 0)).reduce((sum, s) => sum + (s.remainingBalance || 0), 0);
            const overdueCreditSum = customerList.filter(c => c.oldestDays > 30).reduce((sum, c) => sum + c.totalOwed, 0);

            return (
            <div className="space-y-6">
                {/* Top Header & Search/Filter Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Outstanding Credit Management</h2>
                <p className="text-xs text-slate-500">Track customer credit balances, due dates, and record repayments</p>
              </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={creditSearchQuery}
                        onChange={(e) => setCreditSearchQuery(e.target.value)}
                        placeholder="Search Credit by name..."
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                      {['All', 'Overdue', 'Recent'].map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setCreditFilterTab(tab as any)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            creditFilterTab === tab
                              ? 'bg-[#025EA7] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                  </div>
                  </div>
                </div>

                {/* Main Total Due Banner Card */}
                <div className="bg-gradient-to-r from-[#025EA7] via-[#024f8d] to-[#013560] text-white rounded-3xl p-6.5 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                  <div className="relative z-10">
                    <div className="text-xs text-blue-200 font-extrabold uppercase tracking-wider mb-1 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>Total Outstanding Balance</span>
                    </div>
                    <div className="text-3xl sm:text-4xl font-black tracking-tight">
                      ETB {totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                    <div className="text-xs text-blue-200/90 font-semibold mt-2 flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-white font-bold text-[11px]">
                        {customerList.length} customer{customerList.length !== 1 ? 's' : ''}
                      </span>
                      <span>•</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-white font-bold text-[11px]">
                        {totalInvoicesCount} credit invoice{totalInvoicesCount !== 1 ? 's' : ''}
                      </span>
                  </div>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-amber-300 flex items-center justify-center shadow-inner flex-shrink-0">
                    <CreditCard className="w-7 h-7 stroke-[2.5]" />
                </div>
              </div>

                {/* Credit Status Breakdown Card */}
                <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#025EA7]" /> Credit Status Breakdown
                </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-semibold">
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Credit</span>
                      <span className="text-slate-900 font-black text-sm block mt-1">ETB {totalCreditGiven.toLocaleString()}</span>
                    </div>
                    <div className="p-3 bg-rose-50/60 rounded-2xl border border-rose-100">
                      <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider block">Unpaid</span>
                      <span className="text-rose-700 font-black text-sm block mt-1">ETB {unpaidCreditSum.toLocaleString()}</span>
                    </div>
                    <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-100">
                      <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider block">Partially Paid</span>
                      <span className="text-amber-800 font-black text-sm block mt-1">ETB {partiallyPaidCreditSum.toLocaleString()}</span>
                    </div>
                    <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100">
                      <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">Paid</span>
                      <span className="text-emerald-800 font-black text-sm block mt-1">ETB {paidCreditSum.toLocaleString()}</span>
                    </div>
                    <div className="p-3 bg-purple-50/60 rounded-2xl border border-purple-100">
                      <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider block">Overdue ({'>'}30 days)</span>
                      <span className="text-purple-800 font-black text-sm block mt-1">ETB {overdueCreditSum.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Customer Credit Directory Section */}
                <div className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#025EA7] flex items-center justify-center">
                          <Users className="w-4 h-4 stroke-[2.5]" />
                  </div>
                        Customer Credit Directory
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">Click any customer to inspect individual invoices & issue payments</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider hidden sm:inline">View Mode:</span>
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                        <button
                          type="button"
                          onClick={() => setCreditViewMode('table')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            creditViewMode === 'table'
                              ? 'bg-white text-[#025EA7] shadow-xs border border-slate-200/60'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <List className="w-3.5 h-3.5" /> Table
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreditViewMode('cards')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            creditViewMode === 'cards'
                              ? 'bg-white text-[#025EA7] shadow-xs border border-slate-200/60'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <LayoutGrid className="w-3.5 h-3.5" /> Cards
                        </button>
                      </div>
                    </div>
                  </div>

                  {customerList.length === 0 ? (
                    <div className="py-14 text-center text-xs text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200 font-medium">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-300 mx-auto mb-3 flex items-center justify-center">
                        <Users className="w-6 h-6" />
                      </div>
                      No active credit customers found matching current filters.
                    </div>
                  ) : creditViewMode === 'table' ? (
                    /* Elegant Table View */
                    <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/80">
                            <tr>
                              <th className="py-3.5 px-4.5">Customer Name</th>
                              <th className="py-3.5 px-4.5">Phone / Contact</th>
                              <th className="py-3.5 px-4.5 text-center">Pending Invoices</th>
                              <th className="py-3.5 px-4.5">Oldest Credit Status</th>
                              <th className="py-3.5 px-4.5 text-right">Outstanding Balance</th>
                              <th className="py-3.5 px-4.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                            {customerList.map((customer) => {
                              const avatarInitials = customer.name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase() || 'WC';
                              const isOverdue = customer.oldestDays > 30;

                            return (
                                <tr
                                  key={customer.name}
                                  onClick={() => setSelectedCustomerCreditDetails(customer.name)}
                                  className={`hover:bg-blue-50/40 cursor-pointer transition-colors group ${
                                    isOverdue ? 'bg-amber-50/20' : ''
                                  }`}
                                >
                                  {/* Customer Name */}
                                  <td className="py-4 px-4.5 font-bold text-slate-900 group-hover:text-[#025EA7] transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#025EA7] to-[#013f70] text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0">
                                        {avatarInitials}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="font-bold text-xs text-slate-900 truncate group-hover:text-[#025EA7]">
                                          {customer.name}
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Click to inspect invoices</span>
                                      </div>
                                    </div>
                                </td>

                                  {/* Phone */}
                                  <td className="py-4 px-4.5 text-slate-600 font-semibold">
                                    {customer.phone || <span className="text-slate-300 italic">No phone record</span>}
                                  </td>

                                  {/* Invoices Count */}
                                  <td className="py-4 px-4.5 text-center">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200/80">
                                      {customer.invoiceCount} invoice{customer.invoiceCount !== 1 ? 's' : ''}
                                  </span>
                                </td>

                                  {/* Status */}
                                  <td className="py-4 px-4.5">
                                    {isOverdue ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300/80">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                                        {customer.oldestDays}d overdue
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                        Current ({customer.oldestDays}d)
                                      </span>
                                    )}
                                  </td>

                                  {/* Outstanding Balance */}
                                  <td className="py-4 px-4.5 text-right font-black text-rose-600 text-sm">
                                    ETB {customer.totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>

                                  {/* Actions */}
                                  <td className="py-4 px-4.5" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-center gap-1.5">
                                  <button
                                        type="button"
                                        onClick={() => showToast(`SMS Reminder notification queued for ${customer.name}`, 'success')}
                                        className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl transition-all shadow-2xs"
                                        title="Send SMS Reminder"
                                      >
                                        <Bell className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => setSelectedCustomerCreditDetails(customer.name)}
                                        className="py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-100 text-[#025EA7] text-xs font-bold rounded-xl transition-all flex items-center gap-1 shadow-2xs"
                                      >
                                        <Eye className="w-3.5 h-3.5" /> View
                                      </button>

                                      {hasModulePermission(user, 'receiveCreditPayment', 'edit') && (
                                        <button
                                          type="button"
                                    onClick={() => {
                                            setBulkCreditPayment({
                                              customerName: customer.name,
                                              sales: customer.sales,
                                              totalOwed: customer.totalOwed,
                                      });
                                      setIsRecordPaymentOpen(true);
                                    }}
                                          className="py-1.5 px-3 bg-[#025EA7] hover:bg-[#014883] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1 active:scale-95"
                                  >
                                          <CreditCard className="w-3.5 h-3.5" /> Pay All
                                  </button>
                                      )}
                                    </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                    </div>
                  ) : (
                    /* Ultra Modern Grid Cards View */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
                      {customerList.map((customer) => {
                        const avatarInitials = customer.name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase() || 'WC';
                        const isOverdue = customer.oldestDays > 30;

                        return (
                          <div
                            key={customer.name}
                            onClick={() => setSelectedCustomerCreditDetails(customer.name)}
                            className={`bg-white rounded-3xl border transition-all cursor-pointer overflow-hidden group hover:shadow-xl hover:-translate-y-0.5 flex flex-col justify-between ${
                              isOverdue ? 'border-amber-300/80 bg-amber-50/10' : 'border-slate-200/90 hover:border-[#025EA7]/50'
                            }`}
                          >
                            {/* Card Header & Content */}
                            <div className="p-5 space-y-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#025EA7] to-[#014175] text-white flex items-center justify-center font-black text-xs shadow-sm shrink-0">
                                    {avatarInitials}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-black text-slate-900 truncate group-hover:text-[#025EA7] transition-colors">
                                      {customer.name}
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                                      <span>{customer.invoiceCount} invoice{customer.invoiceCount !== 1 ? 's' : ''}</span>
                                      {customer.phone && (
                                        <>
                                          <span>•</span>
                                          <span className="truncate">{customer.phone}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
              </div>

                                {isOverdue && (
                                  <span className="px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-extrabold shrink-0">
                                    {customer.oldestDays}d overdue
                                  </span>
                                )}
                              </div>

                              {/* Outstanding Balance Highlight Box */}
                              <div className="p-3.5 bg-gradient-to-r from-slate-50 to-slate-100/80 rounded-2xl border border-slate-200/70 flex items-center justify-between">
                                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Outstanding Balance:</span>
                                <span className="text-base font-black text-rose-600">
                                  ETB {customer.totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                    </div>
                          </div>

                            {/* Card Footer Actions */}
                            <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                                type="button"
                                onClick={() => showToast(`SMS Reminder notification queued for ${customer.name}`, 'success')}
                                className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl transition-all cursor-pointer shadow-2xs"
                                title="Send SMS Reminder"
                              >
                                <Bell className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedCustomerCreditDetails(customer.name)}
                                className="flex-1 py-2 px-3 bg-white border border-slate-200 hover:bg-slate-100 text-[#025EA7] text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" /> View Invoices
                              </button>

                              {hasModulePermission(user, 'receiveCreditPayment', 'edit') && (
                                <button
                                  type="button"
                              onClick={() => {
                                    setBulkCreditPayment({
                                      customerName: customer.name,
                                      sales: customer.sales,
                                      totalOwed: customer.totalOwed,
                                    });
                                setIsRecordPaymentOpen(true);
                              }}
                                  className="flex-1 py-2 px-3 bg-[#025EA7] hover:bg-[#014883] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                            >
                                  <CreditCard className="w-3.5 h-3.5" /> Pay All
                            </button>
                  )}
                </div>
              </div>
                        );
                      })}
            </div>
          )}
                </div>
              </div>
            );
          })()}

          {/* TAB 9: CUSTOMERS */}
          {activeTab === 'Customer Management' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Customer Management</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Directory of client contacts and credit accounts</p>
                </div>
              </div>

              <form onSubmit={handleAddCustomerSubmit} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Customer Name"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Phone (+251...)"
                  value={newItemPhone}
                  onChange={(e) => setNewItemPhone(e.target.value)}
                  className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Address / Location"
                  value={newItemExtra}
                  onChange={(e) => setNewItemExtra(e.target.value)}
                  className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                />
                <button
                  type="submit"
                  className="py-2 px-4 bg-[#025EA7] text-white rounded-xl text-xs font-bold hover:bg-[#014883] transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Customer
                </button>
              </form>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Customer Name</th>
                      <th className="p-3.5">Phone</th>
                      <th className="p-3.5">Address</th>
                      <th className="p-3.5">Credit Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-xs text-slate-400">
                          No customers found in backend directory.
                        </td>
                      </tr>
                    ) : (
                      customers.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="p-3.5 font-bold text-slate-900">{c.name}</td>
                          <td className="p-3.5 text-slate-600">{c.phone || 'N/A'}</td>
                          <td className="p-3.5 text-slate-600">{c.address || 'N/A'}</td>
                          <td className="p-3.5 font-bold text-slate-900">ETB {(c.totalCredit || 0).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 10: SUPPLIERS */}
          {activeTab === 'Suppliers' && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Suppliers Directory</h2>
              <p className="text-xs text-slate-500 mb-6">Manage wholesale vendors and procurement suppliers</p>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Supplier / Company Name</th>
                      <th className="p-3.5">Contact Person</th>
                      <th className="p-3.5">Phone</th>
                      <th className="p-3.5">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {suppliers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-xs text-slate-400">
                          No suppliers found in backend database.
                        </td>
                      </tr>
                    ) : (
                      suppliers.map((sp) => (
                        <tr key={sp.id} className="hover:bg-slate-50">
                          <td className="p-3.5 font-bold text-slate-900">{sp.companyName || sp.name}</td>
                          <td className="p-3.5 text-slate-700">{sp.name}</td>
                          <td className="p-3.5 text-slate-600">{sp.phone || 'N/A'}</td>
                          <td className="p-3.5 text-slate-600">{sp.address || 'N/A'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 11: PRODUCT BORROWING */}
          {activeTab === 'Product Borrowing' && (
            <div>
              {!canUseBorrowing(user) ? (
                <div className="max-w-lg mx-auto mt-16 text-center p-8 bg-white rounded-3xl border border-slate-200 shadow-sm">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Product Borrowing — Large Plan Only</h3>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                    Product Borrowing is exclusively available on the <strong>Large Business Plan (15,999 ETB)</strong>. Upgrade now to track inventory items borrowed from partner sellers.
                  </p>
                  <button
                    onClick={() => router.push('/choose-plan')}
                    className="mt-6 px-6 py-3 bg-gradient-to-r from-[#025EA7] to-[#0284C7] text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all"
                  >
                    Upgrade to Large Plan — 15,999 ETB
                  </button>
                </div>
              ) : (
                <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Product Borrowing Management</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Track inventory items borrowed from partner sellers or lent out</p>
                </div>
                {hasModulePermission(user, 'stockIn', 'edit') && (
                <button
                  onClick={() => setIsRecordBorrowingOpen(true)}
                  className="py-2.5 px-4 bg-[#025EA7] text-white rounded-xl text-xs font-bold hover:bg-[#014883] transition-all flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Record Borrowing
                </button>
                )}
              </div>

              {/* Search & Status Filter Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl overflow-x-auto">
                  {[
                    { id: 'all', label: 'All Records' },
                    { id: 'active', label: 'Active' },
                    { id: 'partially_returned', label: 'Partially Returned' },
                    { id: 'fully_returned', label: 'Fully Returned' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setBorrowingFilter(f.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        borrowingFilter === f.id
                          ? 'bg-white text-[#025EA7] shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={borrowingSearch}
                    onChange={(e) => setBorrowingSearch(e.target.value)}
                    placeholder="Search product, seller..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#025EA7] outline-none"
                  />
                </div>
              </div>

              {/* Borrowings Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Product Name</th>
                      <th className="p-3.5">Taken From (Seller)</th>
                      <th className="p-3.5 text-center">Qty Taken</th>
                      <th className="p-3.5 text-center">Qty Returned</th>
                      <th className="p-3.5 text-center">Remaining</th>
                      <th className="p-3.5">Date Taken</th>
                      <th className="p-3.5">Receiving Store</th>
                      <th className="p-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {(() => {
                      const filtered = borrowings.filter((b) => {
                        if (borrowingFilter !== 'all' && b.status !== borrowingFilter) return false;
                        if (borrowingSearch.trim()) {
                          const q = borrowingSearch.toLowerCase().trim();
                          const matchProd = b.productName.toLowerCase().includes(q);
                          const matchSeller = b.sellerName.toLowerCase().includes(q);
                          const matchNote = (b.note || '').toLowerCase().includes(q);
                          return matchProd || matchSeller || matchNote;
                        }
                        return true;
                      });

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-xs text-slate-400">
                              No product borrowing records match criteria. Click &quot;Record Borrowing&quot; above to add an entry.
                            </td>
                          </tr>
                        );
                      }

                      return filtered.map((b) => (
                        <tr
                          key={b.id}
                          onClick={() => setSelectedBorrowingDetail(b)}
                          title="Click to view/update borrowing details"
                          className="hover:bg-amber-50/50 cursor-pointer transition-colors group"
                        >
                          <td className="p-3.5 font-bold text-slate-900 group-hover:text-[#025EA7]">
                            <div>{b.productName}</div>
                            {b.productCategory && <div className="text-[10px] text-slate-400 font-normal">{b.productCategory}</div>}
                          </td>
                          <td className="p-3.5 text-slate-700">
                            <div className="font-semibold">{b.sellerName}</div>
                            {b.sellerPhone && <div className="text-[10px] text-slate-400">{b.sellerPhone}</div>}
                          </td>
                          <td className="p-3.5 text-center font-bold text-slate-800">{b.quantityTaken}</td>
                          <td className="p-3.5 text-center text-slate-600">{b.quantityReturned}</td>
                          <td className="p-3.5 text-center font-extrabold">
                            <span className={`px-2 py-0.5 rounded-md ${b.remainingQuantity > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                              {b.remainingQuantity}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-600">{b.dateTaken ? b.dateTaken.split('T')[0] : '--'}</td>
                          <td className="p-3.5 text-slate-600">{b.warehouseName || b.shopName || 'Main Store'}</td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                              b.status === 'fully_returned'
                                ? 'bg-emerald-100 text-emerald-700'
                                : b.status === 'partially_returned'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-[#025EA7]'
                            }`}>
                              {b.status === 'fully_returned' ? 'Fully Returned' : b.status === 'partially_returned' ? 'Partially Returned' : 'Active'}
                            </span>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
              </>
              )}
            </div>
          )}

          {/* TAB 12: STOCK TRANSFERS (Flutter Parity) */}
          {activeTab === 'Stock Transfer' && (
            <StockTransferTab
              warehouses={warehouses}
              shops={shops}
              transfers={transfers}
              loadAllData={loadAllData}
              showToast={showToast}
              t={t}
            />
          )}

          {/* TAB 13: STAFF & ACCESS */}
          {activeTab === 'Staff & Access' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{t('permission_access')}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{t('staff_management')}</p>
                </div>
                {hasModulePermission(user, 'staffManagement', 'edit') && (
                <button
                  onClick={() => setIsStaffOpen(true)}
                  className="py-2.5 px-4 bg-[#025EA7] text-white rounded-xl text-xs font-bold hover:bg-[#014883] transition-all flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> {t('add_staff')}
                </button>
                )}
              </div>

              {/* Staff List matching Flutter UI Parity */}
              <div className="space-y-3">
                {!staff.some((s) => !isStaffOwner(s)) ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400 shadow-sm">
                    No registered staff members found. Click &quot;Add Staff&quot; to create your first team member.
                  </div>
                ) : (
                  staff.filter((s) => !isStaffOwner(s)).map((s) => {
                    const fullName = s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Staff Member';
                    const initialChar = fullName.charAt(0).toUpperCase();
                    const isRoleAdminOrManager = ['admin', 'manager', 'company_admin'].includes((s.role || '').toLowerCase());
                    let permsObj: any = s.permissions;
                    if (typeof permsObj === 'string') {
                      try { permsObj = JSON.parse(permsObj); } catch (_) { permsObj = {}; }
                    }
                    let branchPerms = permsObj?.branchPermissions || (s as any).branchPermissions;
                    if (typeof branchPerms === 'string') {
                      try { branchPerms = JSON.parse(branchPerms); } catch (_) { branchPerms = {}; }
                    }
                    const allowedList: Array<{ name: string; type: 'Shop' | 'Warehouse'; isPrimary: boolean }> = [];

                    // 1. Primary assigned shop or warehouse
                    const primaryShopName = s.shopName?.trim() || shops.find((sh) => sh.id === s.shopId)?.name;
                    const primaryWhName = s.warehouseName?.trim() || warehouses.find((w) => w.id === s.warehouseId)?.name;
                    if (primaryShopName) {
                      allowedList.push({ name: primaryShopName, type: 'Shop', isPrimary: true });
                    } else if (primaryWhName) {
                      allowedList.push({ name: primaryWhName, type: 'Warehouse', isPrimary: true });
                    }

                    // 2. Allowed branches from branch permissions
                    if (branchPerms && typeof branchPerms === 'object') {
                      Object.entries(branchPerms).forEach(([bId, access]: [string, any]) => {
                        const hasShopAccess = access && (access.shop === true || access.shop === 'true' || access === true || access === 'true');
                        const hasWhAccess = access && (access.warehouse === true || access.warehouse === 'true' || access === true || access === 'true');
                        if (hasShopAccess) {
                          const foundSh = shops.find((sh) => sh.id === bId);
                          if (foundSh && !allowedList.some((b) => b.name === foundSh.name)) {
                            allowedList.push({ name: foundSh.name, type: 'Shop', isPrimary: false });
                          }
                        }
                        if (hasWhAccess) {
                          const foundWh = warehouses.find((w) => w.id === bId);
                          if (foundWh && !allowedList.some((b) => b.name === foundWh.name)) {
                            allowedList.push({ name: foundWh.name, type: 'Warehouse', isPrimary: false });
                          }
                        }
                      });
                    }

                    const assignedLocation = allowedList.length > 0
                      ? `Allowed: ${allowedList.map((b) => b.isPrimary ? `${b.name} (Primary)` : b.name).join(', ')}`
                      : isRoleAdminOrManager
                      ? 'All Store Branches'
                      : 'Unassigned';

                    return (
                    <div
                      key={s.id}
                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:border-blue-200 transition-colors"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-full bg-blue-50 text-[#025EA7] flex items-center justify-center font-bold text-sm border border-blue-100 shrink-0 shadow-xs">
                              {initialChar}
                          </div>
                          <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-slate-900">{fullName}</span>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                  isRoleAdminOrManager
                                    ? 'bg-blue-100 text-[#025EA7]'
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {s.jobTitle || s.role || 'Staff'}
                              </span>
                              </div>
                              <div className="text-xs text-slate-500 font-medium mt-1 flex flex-wrap items-center gap-3">
                                <span>📞 {s.phone || s.phoneNumber || 'N/A'}</span>
                                <span>•</span>
                                <span>📍 {assignedLocation}</span>
                                <span>•</span>
                                <span className="text-[#025EA7] font-semibold">
                                  Sales: ETB {(s.salesAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                                <span>•</span>
                                <span className="font-semibold text-slate-600">
                                  Auth: {s.authMethod || 'Password'}
                                </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {hasModulePermission(user, 'staffManagement', 'edit') && (
                          <button
                            onClick={() => {
                              setSelectedPermissionsStaff(s);
                                  setIsNewStaffCreated(false);
                              setIsPermissionsOpen(true);
                            }}
                                className="py-2 px-3.5 bg-blue-50 hover:bg-[#025EA7] text-[#025EA7] hover:text-white border border-blue-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                          >
                                <Shield className="w-4 h-4" /> Permissions
                          </button>
                            )}
                            {hasModulePermission(user, 'staffManagement', 'edit') && (
                              <button
                                onClick={() => {
                                  setSelectedEditStaff(s);
                                  setIsEditStaffOpen(true);
                                }}
                                className="py-2 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                              >
                                <Pencil className="w-4 h-4" /> Edit
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 14: COMMISSIONS (Flutter Parity & Web Optimized) */}
          {activeTab === 'Commision Management' && (
            <div className="max-w-5xl space-y-6">
              {!canUseCommission(user) ? (
                <div className="max-w-lg mx-auto mt-16 text-center p-8 bg-white rounded-3xl border border-slate-200 shadow-sm">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Commission Management — Large Plan Only</h3>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                    Commission Management is exclusively available on the <strong>Large Business Plan (15,999 ETB)</strong>. Upgrade now to track staff earnings, approve payouts, and configure commission rules.
                  </p>
                  <button
                    onClick={() => router.push('/choose-plan')}
                    className="mt-6 px-6 py-3 bg-gradient-to-r from-[#025EA7] to-[#0284C7] text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all"
                  >
                    Upgrade to Large Plan — 15,999 ETB
                  </button>
                </div>
              ) : (
                <>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Commission Management</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Track staff earnings, approve payouts, and configure commission rules</p>
                </div>

                {/* Config Banner Button */}
                {hasModulePermission(user, 'commission', 'edit') && (
                <button
                  type="button"
                  onClick={() => setIsCommissionConfigOpen(true)}
                  className="py-2.5 px-4 bg-[#025EA7] hover:bg-[#014883] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 shrink-0"
                >
                  <SlidersHorizontal className="w-4 h-4" /> Configure Rates
                </button>
                )}
              </div>

              {/* Top Controls Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                {/* Period Selector Tabs */}
                <div className="bg-white border border-slate-200 rounded-xl p-1 flex gap-1 shadow-xs md:col-span-1">
                  {(['Week', 'Month', 'Quarter'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCommissionPeriod(p)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                        commissionPeriod === p ? 'bg-[#025EA7] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {/* Tab Segment Buttons */}
                <div className="bg-white border border-slate-200 rounded-xl p-1 flex gap-1 shadow-xs md:col-span-2">
                  {(['Staff Earnings', 'Commission Report', 'Commission Rules'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setCommissionActiveTab(tab)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                        commissionActiveTab === tab
                          ? 'bg-[#025EA7] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Filter Chips */}
              {products.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setCommissionProdFilter(null)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
                      commissionProdFilter === null
                        ? 'bg-[#025EA7] text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    All Products
                  </button>
                  {products.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => setCommissionProdFilter(prod.id)}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
                        commissionProdFilter === prod.id
                          ? 'bg-[#025EA7] text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {prod.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Hero Summary Card */}
              {(() => {
                const filteredCommissions = commissions.filter((c) => {
                  if (commissionProdFilter && c.product?.id !== commissionProdFilter && c.productName !== products.find(p => p.id === commissionProdFilter)?.name) {
                    return false;
                  }
                  return true;
                });

                const totalComm = filteredCommissions.reduce((acc, c) => acc + (c.commissionAmount || 0), 0);
                const paidOutComm = filteredCommissions.filter((c) => c.isApproved).reduce((acc, c) => acc + (c.commissionAmount || 0), 0);
                const pendingComm = totalComm - paidOutComm;

                return (
                  <div className="w-full bg-[#025EA7] rounded-2xl p-6 shadow-md text-white space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="text-xs text-white/80 font-medium mb-1">Total Commission Pool ({commissionPeriod})</div>
                        <div className="text-3xl font-extrabold tracking-tight">
                          ETB {totalComm.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-white/70 mt-1 font-medium">{filteredCommissions.length} recorded transactions</div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="px-3.5 py-2 bg-white/15 backdrop-blur-md rounded-xl text-xs font-semibold flex items-center gap-2 border border-white/20">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                          <span>Paid Out: ETB {paidOutComm.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="px-3.5 py-2 bg-white/15 backdrop-blur-md rounded-xl text-xs font-semibold flex items-center gap-2 border border-white/20">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                          <span>Pending: ETB {pendingComm.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Content Views */}
              {commissionActiveTab === 'Staff Earnings' && (
                <div className="space-y-4">
                  {(() => {
                    const filtered = commissions.filter((c) => {
                      if (commissionProdFilter && c.product?.id !== commissionProdFilter && c.productName !== products.find(p => p.id === commissionProdFilter)?.name) {
                        return false;
                      }
                      return true;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs text-slate-400 shadow-xs">
                          No commission earnings found for the selected filter.
                        </div>
                      );
                    }

                    // Group by Staff
                    const staffGroups: Record<string, CommissionItem[]> = {};
                    filtered.forEach((c) => {
                      const key = c.salespersonName || 'Staff';
                      if (!staffGroups[key]) staffGroups[key] = [];
                      staffGroups[key].push(c);
                    });

                    return Object.entries(staffGroups).map(([staffName, items]) => {
                      const totalStaffComm = items.reduce((acc, i) => acc + (i.commissionAmount || 0), 0);
                      const paidStaffComm = items.filter((i) => i.isApproved).reduce((acc, i) => acc + (i.commissionAmount || 0), 0);
                      const pendingIds = items.filter((i) => !i.isApproved).map((i) => i.id);

                      return (
                        <div key={staffName} className="bg-white border border-slate-200 hover:border-blue-200 rounded-2xl p-5 shadow-xs transition-all space-y-4">
                          {/* Staff Header */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-3.5">
                              <div className="w-11 h-11 rounded-full bg-blue-50 text-[#025EA7] font-bold text-sm flex items-center justify-center border border-blue-100 shrink-0">
                                {staffName[0].toUpperCase()}
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-slate-900">{staffName}</h4>
                                <div className="text-xs text-slate-500 font-medium">{items.length} sale transactions</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-base font-extrabold text-slate-900">
                                ETB {totalStaffComm.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </div>
                              <div className="text-[11px] text-emerald-600 font-semibold">
                                Paid: ETB {paidStaffComm.toLocaleString()}
                              </div>
                            </div>
                          </div>

                          {/* Entries */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {items.map((item) => {
                              const rawDate = item.sale?.saleDate || item.commissionDate || item.createdAt;
                              const dateFormatted = rawDate ? new Date(rawDate).toLocaleDateString() : '';
                              const customer = item.sale?.customer;
                              const customerText = customer?.name
                                ? `${customer.name}${customer.phoneNumber ? ` (${customer.phoneNumber})` : ''}`
                                : '';
                              const qtyPrice = item.sale?.item?.quantity
                                ? `${item.sale.item.quantity} x ETB ${Number(item.sale.item.unitPrice || 0).toLocaleString()}`
                                : null;
                              const lineTotal = item.sale?.item?.total != null ? Number(item.sale.item.total) : null;
                              const saleTotal = item.saleAmount || item.sale?.totalAmount || lineTotal || 0;

                              return (
                                <div key={item.id} className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-2.5 text-xs hover:bg-slate-100/60 transition-colors">
                                  <div className="flex items-center justify-between gap-2">
                                  <div className="font-bold text-slate-900 text-xs truncate">
                                    {item.productName || item.product?.name || 'Product'}
                                      {item.product?.sku && <span className="ml-1.5 text-[11px] font-normal text-slate-500">({item.product.sku})</span>}
                                  </div>
                                  <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full shrink-0 ${
                                    item.isApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {item.isApproved ? 'Paid' : 'Unpaid'}
                                  </span>
                                </div>
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-slate-500 text-[11px] pt-1.5 border-t border-slate-200/60">
                                  <div>Invoice: <strong className="text-slate-800">{item.sale?.invoiceNumber || 'POS'}</strong></div>
                                    {dateFormatted && <div>Date: <strong className="text-slate-800">{dateFormatted}</strong></div>}
                                    {customerText && <div className="col-span-2">Customer: <strong className="text-slate-800">{customerText}</strong></div>}
                                    {qtyPrice && <div>Qty & Price: <strong className="text-slate-800">{qtyPrice}</strong></div>}
                                    <div>Sale Total: <strong className="text-slate-800">ETB {saleTotal.toLocaleString()}</strong></div>
                                    {item.sale?.paymentType && <div>Payment: <strong className="text-slate-800">{item.sale.paymentType.replace('_', ' ')}</strong></div>}
                                  <div>Rate: <strong className="text-slate-800">{item.commissionRate}%</strong></div>
                                    <div className="col-span-2 pt-1 flex items-center justify-between border-t border-slate-200/40">
                                      <span className="text-slate-600 font-medium">Commission Earned:</span>
                                      <strong className="text-[#025EA7] text-sm font-extrabold">ETB {(item.commissionAmount || 0).toLocaleString()}</strong>
                                </div>
                              </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Mark Paid Action */}
                          {pendingIds.length > 0 && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await api.approveCommissions(pendingIds);
                                  showToast(`Approved ${pendingIds.length} commissions for ${staffName}!`, 'success');
                                  loadAllData();
                                } catch (err: any) {
                                  showToast(err.message || 'Failed to approve commissions', 'error');
                                }
                              }}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs"
                            >
                              Mark All Paid ({pendingIds.length})
                            </button>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {commissionActiveTab === 'Commission Report' && (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="p-3.5">Date</th>
                          <th className="p-3.5">Invoice</th>
                          <th className="p-3.5">Staff Member</th>
                          <th className="p-3.5">Product</th>
                          <th className="p-3.5">Customer</th>
                          <th className="p-3.5">Qty x Price</th>
                          <th className="p-3.5">Sale Total</th>
                          <th className="p-3.5">Rate</th>
                          <th className="p-3.5">Commission</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {(() => {
                          const reportList = commissions.filter((c) => {
                            if (commissionProdFilter && c.product?.id !== commissionProdFilter && c.productName !== products.find(p => p.id === commissionProdFilter)?.name) {
                              return false;
                            }
                            return true;
                          });

                          if (reportList.length === 0) {
                            return (
                              <tr>
                                <td colSpan={11} className="p-8 text-center text-xs text-slate-400">
                                  No commission records found{commissionProdFilter ? ' for this product' : ''}.
                            </td>
                          </tr>
                            );
                          }

                          return reportList.map((c) => {
                            const rawDate = c.sale?.saleDate || c.commissionDate || c.createdAt;
                            const dateFormatted = rawDate ? new Date(rawDate).toLocaleDateString() : '—';
                            const customer = c.sale?.customer;
                            const customerText = customer?.name
                              ? `${customer.name}${customer.phoneNumber ? ` (${customer.phoneNumber})` : ''}`
                              : (c.customerName && c.customerName !== 'Walk-in'
                                ? `${c.customerName}${c.customerPhone ? ` (${c.customerPhone})` : ''}`
                                : 'Walk-in');
                            const qty = c.quantity != null ? c.quantity : c.sale?.item?.quantity;
                            const unitP = c.unitPrice != null ? c.unitPrice : c.sale?.item?.unitPrice;
                            const qtyPrice = qty && unitP != null
                              ? `${qty} x ETB ${Number(unitP).toLocaleString()}`
                              : '—';
                            const saleTotal = c.saleAmount || c.sale?.totalAmount || c.sale?.item?.total || c.lineTotal || 0;
                            const salesperson = c.salespersonName || c.employee?.name || 'Staff';
                            const productTitle = c.productName || c.product?.name || 'Product';
                            const invNum = c.invoiceNumber || c.sale?.invoiceNumber || 'POS';

                            return (
                            <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-3.5 text-slate-500 whitespace-nowrap">{dateFormatted}</td>
                                <td className="p-3.5 font-bold text-slate-900">{invNum}</td>
                                <td className="p-3.5 font-bold text-slate-900">{salesperson}</td>
                                <td className="p-3.5 text-slate-700">
                                  <div className="font-semibold">{productTitle}</div>
                                  {(c.product?.sku) && <div className="text-[10px] text-slate-400">SKU: {c.product.sku}</div>}
                                </td>
                                <td className="p-3.5 text-slate-600">{customerText}</td>
                                <td className="p-3.5 text-slate-600 whitespace-nowrap">{qtyPrice}</td>
                                <td className="p-3.5 font-semibold text-slate-800 whitespace-nowrap">ETB {Number(saleTotal).toLocaleString()}</td>
                              <td className="p-3.5 font-bold text-slate-700">{c.commissionRate}%</td>
                                <td className="p-3.5 font-extrabold text-[#025EA7] whitespace-nowrap">ETB {Number(c.commissionAmount || 0).toLocaleString()}</td>
                              <td className="p-3.5">
                                <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                                  c.isApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {c.isApproved ? 'Paid' : 'Unpaid'}
                                </span>
                              </td>
                              <td className="p-3.5 text-right">
                                {!c.isApproved && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await api.approveCommissions([c.id]);
                                        showToast('Commission marked as paid!', 'success');
                                        loadAllData();
                                      } catch (err: any) {
                                        showToast(err.message || 'Failed to update commission status', 'error');
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold rounded-lg border border-emerald-200 transition-colors"
                                  >
                                    Mark Paid
                                  </button>
                                )}
                              </td>
                            </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {commissionActiveTab === 'Commission Rules' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 max-w-2xl">
                  <h3 className="text-sm font-bold text-slate-900">Commission System Guidelines</h3>
                  <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                    <p>• Commission is calculated automatically upon completing a sales invoice at the designated rates.</p>
                    <p>• Product-level commission rates take priority over base staff commission rates.</p>
                    <p>• Approved commissions are reflected under paid balances and recorded in financial summaries.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCommissionConfigOpen(true)}
                    className="py-2.5 px-4 bg-[#025EA7] hover:bg-[#014883] text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                  >
                    Configure Rates Now
                  </button>
                </div>
              )}
              </>
              )}
            </div>
          )}

          {/* TAB 15: REPORTS — Full Flutter-Parity Reports Hub */}
          {activeTab === 'Reports' && (() => {
            /* ── helpers ── */
            const toNum = (v: any, fb = 0) => { if (v === null || v === undefined) return fb; const n = parseFloat(String(v)); return Number.isFinite(n) ? n : fb; };
            const toInt = (v: any, fb = 0) => { if (v === null || v === undefined) return fb; const n = parseInt(String(v), 10); return Number.isFinite(n) ? n : fb; };
            const listOf = (obj: any, key: string): any[] => { if (!obj || typeof obj !== 'object') return []; const r = obj[key]; return Array.isArray(r) ? r : []; };
            const fmtDate = (raw: any) => { if (!raw) return ''; try { const d = new Date(raw); if (isNaN(d.getTime())) return String(raw); return d.toLocaleDateString('en-GB') + ' • ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); } catch { return String(raw); } };

            const stockInList = Array.isArray(reportStockInTx) ? reportStockInTx : [];
            const stockOutList = Array.isArray(reportStockOutTx) ? reportStockOutTx : [];
            const transferList = Array.isArray(reportTransferTx) ? reportTransferTx : [];

            /* combined + sorted stock tx */
            const combinedTx = [
              ...stockInList.map((t: any) => ({ ...(t && typeof t === 'object' ? t : {}), _txType: 'stock_in' })),
              ...stockOutList.map((t: any) => ({ ...(t && typeof t === 'object' ? t : {}), _txType: 'stock_out' })),
              ...transferList.map((t: any) => {
                const fromName = t?.fromWarehouseName || t?.fromShopName || t?.sourceWarehouseName || '';
                const toName = t?.toShopName || t?.toWarehouseName || t?.destinationShopName || '';
                const route = fromName && toName ? `${fromName} → ${toName}` : (fromName || toName || 'Transfer Route');
                return {
                  ...(t && typeof t === 'object' ? t : {}),
                  _txType: 'transfer',
                  productName: t?.productName || t?.product?.name || 'Transferred Product',
                  quantity: t?.quantity || 0,
                  locationName: route,
                  reason: `Transfer (${(t?.status || 'completed').toUpperCase()})`,
                  performedByName: t?.requestedByName || t?.requestedBy || t?.approvedByName || 'Staff',
                };
              }),
            ].sort((a, b) => new Date(b?.createdAt || b?.date || 0).getTime() - new Date(a?.createdAt || a?.date || 0).getTime());

            const stockFiltered = reportStockFilter === 'all'
              ? combinedTx
              : combinedTx.filter((t) => t._txType === reportStockFilter);

            const searchQuery = (reportStockSearch || '').trim().toLowerCase();
            const filteredTx = !searchQuery
              ? stockFiltered
              : stockFiltered.filter((t: any) =>
                  (t?.product?.name || t?.productName || '').toLowerCase().includes(searchQuery) ||
                  (t?.reason || '').toLowerCase().includes(searchQuery) ||
                  (t?.warehouse?.name || t?.shop?.name || t?.locationName || '').toLowerCase().includes(searchQuery)
                );

            const totalQtyIn = stockInList.reduce((s: number, t: any) => s + toInt(t?.quantity), 0);
            const totalQtyOut = stockOutList.reduce((s: number, t: any) => s + toInt(t?.quantity), 0);
            const totalQtyTransfer = transferList.reduce((s: number, t: any) => s + toInt(t?.quantity), 0);

            /* analytics helpers */
            const byProduct = listOf(reportAnalytics, 'byProduct');
            const byLocation = listOf(reportAnalytics, 'byLocation');
            const warehouseRows = byLocation.filter((r: any) => r && String(r?.type || '').toLowerCase() === 'warehouse');
            const shopRows = byLocation.filter((r: any) => r && String(r?.type || '').toLowerCase() !== 'warehouse');
            const summary = (reportAnalytics && typeof reportAnalytics === 'object' && reportAnalytics.summary) || {};

            /* low stock from products */
            const prodList = Array.isArray(products) ? products : [];
            const lowStockProducts = prodList.filter((p) => p && p.trackStock && p.minStockLevel && (p.stockQuantity || 0) <= (p.minStockLevel || 0));

            /* sub-tabs config */
            const subTabs = [
              { key: 'overview', label: 'Overview', icon: BarChart3 },
              { key: 'total_profit', label: 'Total Reports', icon: TrendingUp },
              { key: 'business_report', label: 'Business Report', icon: FileText },
              { key: 'stock_report', label: 'Stock Report', icon: ArrowUpDown },
              { key: 'product', label: 'Product Report', icon: Package },
              { key: 'warehouse', label: 'Warehouse', icon: Building2 },
              { key: 'shop', label: 'Shop', icon: ShoppingBag },
              { key: 'purchases_report', label: 'Purchases Report', icon: ShoppingBag },
              { key: 'low_stock', label: 'Low Stock', icon: AlertTriangle },
            ];

            const exportReport = (format: 'pdf' | 'csv') => {
              const currentTabObj = subTabs.find(s => s.key === reportSubTab);
              const title = currentTabObj ? currentTabObj.label : 'Report';
              const cName = user?.companyName || 'BM Stock Store';

              let metrics: { label: string; value: string }[] = [];
              let tables: { title?: string; headers: string[]; rows: (string | number)[][] }[] = [];

              if (reportSubTab === 'overview') {
                metrics = [
                  { label: 'Today Sales (24h)', value: `ETB ${todaySalesData.totalAmount.toLocaleString()}` },
                  { label: 'Today Invoices (24h)', value: String(todaySalesData.invoicesCount) },
                  { label: 'Period Revenue', value: `ETB ${toNum(summary.totalRevenue).toLocaleString()}` },
                  { label: 'Expired Items', value: String(stats.expiredCount) },
                ];
                tables = [
                  {
                    title: 'Overview Metrics Summary (24 Hours)',
                    headers: ['Metric Name', 'Recorded Value'],
                    rows: [
                      ['Today Sales Revenue (24h)', `ETB ${todaySalesData.totalAmount.toLocaleString()}`],
                      ['Today Invoices Count (24h)', String(todaySalesData.invoicesCount)],
                      ['Total Period Revenue', `ETB ${toNum(summary.totalRevenue).toLocaleString()}`],
                      ['Low Stock Product Count', String(lowStockProducts.length)],
                    ],
                  },
                ];
              } else if (reportSubTab === 'total_profit') {
                const totalRev = toNum(summary.totalRevenue || stats.todaySales);
                const totalPurchase = toNum(summary.totalPurchase);
                const totalExpense = toNum(summary.totalExpense);
                const totalCommission = toNum(summary.totalCommission);
                const totalCredit = toNum(summary.totalCredit);
                const creditCollected = toNum(summary.creditCollected);
                const outstandingCredit = toNum(summary.outstandingCredit);
                const grossProfit = toNum(summary.grossProfit || (totalRev - totalPurchase));
                const totalProfit = toNum(summary.totalProfit || (grossProfit - totalExpense - totalCommission));
                const cashProfit = toNum(summary.cashProfit);
                const totalTax = toNum(summary.totalTax);
                const totalDiscount = toNum(summary.totalDiscount);

                metrics = [
                  { label: 'Total Sales Revenue', value: `ETB ${totalRev.toLocaleString()}` },
                  { label: 'Purchases (COGS)', value: `ETB ${totalPurchase.toLocaleString()}` },
                  { label: 'Gross Profit', value: `ETB ${grossProfit.toLocaleString()}` },
                  { label: 'Operating Expenses', value: `ETB ${totalExpense.toLocaleString()}` },
                  { label: 'Commissions Paid', value: `ETB ${totalCommission.toLocaleString()}` },
                  { label: 'Net Total Profit', value: `ETB ${totalProfit.toLocaleString()}` },
                  { label: 'Realized Cash Profit', value: `ETB ${cashProfit.toLocaleString()}` },
                  { label: 'New Credit Issued', value: `ETB ${totalCredit.toLocaleString()}` },
                  { label: 'Credit Recovered', value: `ETB ${creditCollected.toLocaleString()}` },
                ];

                tables = [
                  {
                    title: 'Total Profit Accounting Derivation Statement',
                    headers: ['Accounting Component', 'Formula / Derivation', 'Amount (ETB)'],
                    rows: [
                      ['Gross Sales Revenue (+)', 'Total billed sales invoices', `ETB ${totalRev.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
                      ['Inventory Cost / Purchases (-)', 'Direct cost of goods sold', `-ETB ${totalPurchase.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
                      ['Gross Profit (=)', 'Revenue − Purchases', `ETB ${grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
                      ['Operating Expenses (-)', 'Recorded business expenses', `-ETB ${totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
                      ['Staff Commission (-)', 'Sales representative commission', `-ETB ${totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
                      ['Net Total Profit (=)', 'Gross Profit − Expenses − Commission', `ETB ${totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
                      ['New Credit Issued (Uncollected)', 'Billed on credit / remaining balance', `ETB ${totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
                      ['Credit Collected (Debt Recovery)', 'Payments received on credit accounts', `+ETB ${creditCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
                      ['Realized Cash Profit (=)', 'Cash Inflows − Total Outflows', `ETB ${cashProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
                    ],
                  },
                ];
              } else if (reportSubTab === 'business_report') {
                const salesList = Array.isArray(sales) ? sales : [];
                const totalRev = toNum(summary.totalRevenue || stats.todaySales);
                const totalSalesCount = toNum(summary.totalSales || salesList.length);
                const avgSale = totalSalesCount > 0 ? totalRev / totalSalesCount : 0;
                const totalCredit = toNum(summary.totalCredit);
                const totalPurchase = toNum(summary.totalPurchase);
                const totalExpense = toNum(summary.totalExpense);
                const totalCommission = toNum(summary.totalCommission);
                const totalProfit = toNum(summary.totalProfit);
                const grossProfit = toNum(summary.grossProfit || (totalRev - totalPurchase));

                metrics = [
                  { label: 'Total Revenue', value: `ETB ${totalRev.toLocaleString()}` },
                  { label: 'Total Purchases', value: `ETB ${totalPurchase.toLocaleString()}` },
                  { label: 'Gross Profit', value: `ETB ${grossProfit.toLocaleString()}` },
                  { label: 'Total Expenses', value: `ETB ${totalExpense.toLocaleString()}` },
                  { label: 'Total Commission', value: `ETB ${totalCommission.toLocaleString()}` },
                  { label: 'Net Profit', value: `ETB ${totalProfit.toLocaleString()}` },
                  { label: 'Invoices Count', value: String(totalSalesCount) },
                  { label: 'Avg Invoice', value: `ETB ${avgSale.toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
                  { label: 'Outstanding Credit', value: `ETB ${totalCredit.toLocaleString()}` },
                ];

                tables = [
                  {
                    title: 'Business Invoices Log',
                    headers: ['Invoice #', 'Date', 'Customer', 'Payment Method', 'Total Amount', 'Remaining', 'Status'],
                    rows: salesList.slice(0, 50).map((s: any) => [
                      `#${s.invoiceNumber || (s.id ? s.id.substring(0, 8) : 'N/A')}`,
                      s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'N/A',
                      s.customerName || 'Walk-in Customer',
                      (s.paymentType || 'CASH').toUpperCase(),
                      `ETB ${(s.totalAmount || 0).toLocaleString()}`,
                      `ETB ${(s.remainingBalance || 0).toLocaleString()}`,
                      s.status || 'COMPLETED',
                    ]),
                  },
                ];
              } else if (reportSubTab === 'stock_report') {
                const stockInList = Array.isArray(reportStockInTx) ? reportStockInTx : [];
                const stockOutList = Array.isArray(reportStockOutTx) ? reportStockOutTx : [];
                const transferList = Array.isArray(reportTransferTx) ? reportTransferTx : [];
                const combinedTx = [
                  ...stockInList.map((t: any) => ({ ...t, _txType: 'stock_in' })),
                  ...stockOutList.map((t: any) => ({ ...t, _txType: 'stock_out' })),
                  ...transferList.map((t: any) => ({
                    ...t,
                    _txType: 'transfer',
                    productName: t?.productName || t?.product?.name || 'Transferred Product',
                    quantity: t?.quantity || 0,
                    locationName: `${t?.fromWarehouseName || t?.fromShopName || 'Storage'} → ${t?.toShopName || t?.toWarehouseName || 'Shop'}`,
                    reason: `Transfer (${(t?.status || 'completed').toUpperCase()})`,
                  })),
                ];

                metrics = [
                  { label: 'Total Inflow Qty', value: String(stockInList.reduce((sum: number, t: any) => sum + (t.quantity || 0), 0)) },
                  { label: 'Total Outflow Qty', value: String(stockOutList.reduce((sum: number, t: any) => sum + (t.quantity || 0), 0)) },
                  { label: 'Total Transfers Qty', value: String(transferList.reduce((sum: number, t: any) => sum + (t.quantity || 0), 0)) },
                  { label: 'Total Operations', value: String(combinedTx.length) },
                ];

                tables = [
                  {
                    title: 'Stock Movement History',
                    headers: ['Date', 'Item Name', 'Type', 'Quantity', 'Route / Location', 'Reference / Note'],
                    rows: combinedTx.slice(0, 50).map((t: any) => [
                      t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'N/A',
                      t.productName || t.product?.name || 'Item',
                      t._txType === 'stock_in' ? 'Stock In (+)' : t._txType === 'stock_out' ? 'Stock Out (-)' : 'Transfer (⇄)',
                      t.quantity || 0,
                      t.locationName || t.warehouse?.name || t.shop?.name || 'N/A',
                      t.reason || t.note || t.reference || 'N/A',
                    ]),
                  },
                ];
              } else if (reportSubTab === 'product') {
                metrics = [
                  { label: 'Total Products', value: String(prodList.length) },
                  { label: 'Low Stock Count', value: String(lowStockProducts.length) },
                ];

                tables = [
                  {
                    title: 'Product Catalog Overview',
                    headers: ['Product Name', 'SKU', 'Category', 'Price', 'Stock Qty', 'Min Level'],
                    rows: prodList.map((p: any) => [
                      p.name,
                      p.sku || 'N/A',
                      p.category || 'General',
                      `ETB ${(p.price || 0).toLocaleString()}`,
                      p.stockQuantity || 0,
                      p.minStockLevel || 0,
                    ]),
                  },
                ];
              } else if (reportSubTab === 'warehouse') {
                tables = [
                  {
                    title: 'Warehouse Performance Breakdown',
                    headers: ['Warehouse Name', 'Location', 'Manager', 'Product Count', 'Revenue'],
                    rows: warehouseRows.map((w: any) => [
                      w.name || 'Warehouse',
                      w.location || 'N/A',
                      w.managerName || 'Unassigned',
                      w.productCount || 0,
                      `ETB ${(w.revenue || 0).toLocaleString()}`,
                    ]),
                  },
                ];
              } else if (reportSubTab === 'shop') {
                tables = [
                  {
                    title: 'Retail Shop Performance Breakdown',
                    headers: ['Shop Name', 'Location', 'Manager', 'Product Count', 'Revenue'],
                    rows: shopRows.map((s: any) => [
                      s.name || 'Shop',
                      s.location || 'N/A',
                      s.managerName || 'Unassigned',
                      s.productCount || 0,
                      `ETB ${(s.revenue || 0).toLocaleString()}`,
                    ]),
                  },
                ];
              } else if (reportSubTab === 'sales_report') {
                const combined = [
                  ...sales.map((s) => ({
                    inv: s.invoiceNumber || (s.id ? s.id.substring(0, 8) : 'N/A'),
                    date: s.createdAt ? new Date(s.createdAt).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A',
                    cust: s.customerName || 'Walk-in Customer',
                    prod: (s.items && s.items.length > 0) ? s.items.map(it => `${it.productName} (x${it.quantity})`).join('; ') : 'General Sale',
                    pmt: (s.paymentType || 'cash').toUpperCase().replace('_', ' '),
                    loc: s.storeName || 'Main Store',
                    stat: s.status || 'COMPLETED',
                    source: 'Live Sale',
                    amount: s.totalAmount || 0,
                  })),
                  ...importedSales.map((s) => ({
                    inv: s.invoiceNumber,
                    date: s.saleDate ? new Date(s.saleDate).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A',
                    cust: s.customerName,
                    prod: s.productName ? `${s.productName} (x${s.quantity})` : 'Imported Item',
                    pmt: s.paymentType.toUpperCase().replace('_', ' '),
                    loc: s.locationName || 'Main Store',
                    stat: s.status || 'COMPLETED',
                    source: `Imported (${s.source.toUpperCase()})`,
                    amount: s.totalAmount || 0,
                  })),
                ];

                const totalRev = combined.reduce((acc, c) => acc + c.amount, 0);
                metrics = [
                  { label: 'Total Invoices', value: String(combined.length) },
                  { label: 'Total Sales Revenue', value: `ETB ${totalRev.toLocaleString()}` },
                  { label: 'Live Sales Count', value: String(sales.length) },
                  { label: 'Imported Records', value: String(importedSales.length) },
                ];

                tables = [
                  {
                    title: 'Unified Sales Report (Live & Imported)',
                    headers: ['Invoice #', 'Date', 'Customer', 'Items / Products', 'Payment', 'Location', 'Status', 'Source', 'Total (ETB)'],
                    rows: combined.map((r) => [
                      r.inv,
                      r.date,
                      r.cust,
                      r.prod,
                      r.pmt,
                      r.loc,
                      r.stat,
                      r.source,
                      `ETB ${r.amount.toLocaleString()}`,
                    ]),
                  },
                ];
              } else if (reportSubTab === 'purchases_report') {
                const totalCost = purchases.reduce((acc: number, item: any) => acc + (Number(item.totalCost) || 0), 0);
                const totalUnits = purchases.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0);
                const avgCost = purchases.length > 0 ? totalCost / purchases.length : 0;
                metrics = [
                  { label: 'Total Purchases Cost', value: `ETB ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                  { label: 'Total Units Purchased', value: String(totalUnits.toLocaleString()) },
                  { label: 'Transaction Count', value: String(purchases.length) },
                  { label: 'Avg Purchase Value', value: `ETB ${avgCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
                ];
                tables = [
                  {
                    title: 'Purchases Report',
                    headers: ['Product', 'SKU', 'Date', 'Reference', 'Location', 'Quantity', 'Unit Cost (ETB)', 'Total Cost (ETB)', 'Supplier', 'Recorded By'],
                    rows: purchases.map((p: any) => [
                      p.productName || p.product?.name || 'N/A',
                      p.productSku || p.product?.sku || '-',
                      p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-',
                      p.referenceNumber || '-',
                      p.warehouseName || p.warehouse?.name || p.shopName || p.shop?.name || 'Main Location',
                      p.quantity || 0,
                      `ETB ${(Number(p.unitCost) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      `ETB ${(Number(p.totalCost) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      p.supplierName || p.supplier?.name || '-',
                      p.performedByName || p.performedBy?.fullName || '-',
                    ]),
                  },
                ];
              } else if (reportSubTab === 'low_stock') {
                tables = [
                  {
                    title: 'Low Stock Alert Items',
                    headers: ['Product Name', 'SKU', 'Category', 'Current Stock', 'Threshold', 'Status'],
                    rows: lowStockProducts.map((p: any) => [
                      p.name,
                      p.sku || 'N/A',
                      p.category || 'General',
                      p.stockQuantity || 0,
                      p.minStockLevel || 0,
                      'LOW STOCK',
                    ]),
                  },
                ];
              }

              const currentPeriodLabel =
                reportPeriod === 'all'
                  ? 'All Time (Grand Report)'
                  : reportPeriod === 'custom'
                  ? `${reportDateFrom || 'Start'} to ${reportDateTo || 'End'}`
                  : reportPeriod;

              if (format === 'pdf') {
                generateReportPdf({
                  reportTitle: `${title} - ${cName}`,
                  companyName: cName,
                  period: currentPeriodLabel,
                  metrics,
                  tables,
                });
                showToast(`PDF report exported successfully!`, 'success');
              } else {
                let csvContent = `data:text/csv;charset=utf-8,${title} - ${cName} (${currentPeriodLabel})\n\n`;
                tables.forEach((t) => {
                  if (t.title) csvContent += `"${t.title}"\n`;
                  csvContent += t.headers.map((h) => `"${h}"`).join(',') + '\n';
                  t.rows.forEach((r) => {
                    csvContent += r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',') + '\n';
                  });
                  csvContent += '\n';
                });
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_report_${reportPeriod}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showToast(`CSV report downloaded successfully!`, 'success');
              }
            };

            const handleShareReport = async () => {
              const currentTabObj = subTabs.find((s) => s.key === reportSubTab);
              const title = reportPeriod === 'all' ? 'Grand Report' : (currentTabObj ? currentTabObj.label : 'Report');
              const cName = user?.companyName || 'BM Stock Store';
              const totalRev = toNum(summary.totalRevenue || stats.todaySales);
              const totalProfit = toNum(summary.totalProfit);
              const shareText = `${cName} - ${title}\nPeriod: ${reportPeriod === 'all' ? 'All Time (Grand Report)' : reportPeriod}\nTotal Revenue: ETB ${totalRev.toLocaleString()}\nTotal Profit: ETB ${totalProfit.toLocaleString()}\nGenerated via Gelagle Stock.`;

              if (typeof navigator !== 'undefined' && navigator.share) {
                try {
                  await navigator.share({
                    title: `${title} - ${cName}`,
                    text: shareText,
                    url: window.location.href,
                  });
                  showToast('Report shared successfully!', 'success');
                  return;
                } catch (err: any) {
                  if (err.name !== 'AbortError') {
                    setIsShareModalOpen(true);
                  }
                }
              } else {
                setIsShareModalOpen(true);
              }
            };

            return (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                    <h2 className="text-2xl font-bold text-slate-900">Reports & Analytics Hub</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Comprehensive analytics, sales performance, and stock value reports</p>
                </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* Import Sales CSV/Excel - ONLY on Sales Report tab */}
                    {reportSubTab === 'sales_report' && (
                      <>
                <button
                          type="button"
                          onClick={() => downloadSampleSalesTemplate('csv')}
                          className="py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Download CSV sample template for sales import"
                        >
                          <Download className="w-4 h-4" /> Template CSV
                </button>
                        <button
                          type="button"
                          onClick={() => downloadSampleSalesTemplate('xlsx')}
                          className="py-2.5 px-4 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Download Excel sample template for sales import"
                        >
                          <Download className="w-4 h-4" /> Template Excel
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsImportSalesModalOpen(true)}
                          className="py-2.5 px-4 bg-[#025EA7] hover:bg-[#014883] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <UploadCloud className="w-4 h-4" /> Import CSV & PDF
                        </button>
                      </>
                    )}
                    {/* ONLY in Grand Report (reportPeriod === 'all') */}
                    {reportPeriod === 'all' && (
                      <>
                        <button
                          type="button"
                          onClick={() => exportReport('pdf')}
                          className="py-2.5 px-4 bg-gradient-to-r from-[#025EA7] to-blue-600 hover:from-[#014883] hover:to-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                          title="Download Grand Report PDF"
                        >
                          <Download className="w-4 h-4" /> Download PDF
                        </button>
                        <button
                          type="button"
                          onClick={handleShareReport}
                          className="py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                          title="Share Grand Report"
                        >
                          <Share2 className="w-4 h-4 text-[#025EA7]" /> Share Report
                        </button>
                      </>
                    )}
                  </div>
              </div>

                {/* Sub-Tab Navigation */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {subTabs.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setReportSubTab(key)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                        reportSubTab === key
                          ? 'bg-[#025EA7] text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" /> {label}
                    </button>
                  ))}
                </div>

                {/* Period Selector & Custom Calendar Picker */}
                {!['low_stock', 'product'].includes(reportSubTab) && (
                  <div className="flex flex-col lg:flex-row lg:items-center gap-3 flex-wrap">
                    <div className="bg-white border border-slate-200 rounded-xl p-1 flex gap-1 shadow-xs overflow-x-auto">
                      {[
                        { key: 'day', label: 'Day' },
                        { key: 'week', label: 'Week' },
                        { key: 'month', label: 'Month' },
                        { key: 'all', label: 'Grand Report', icon: Zap },
                        { key: 'custom', label: 'Custom Range', icon: Calendar },
                      ].map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          onClick={() => setReportPeriod(key)}
                          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
                            reportPeriod === key
                              ? (key === 'all'
                                  ? 'bg-gradient-to-r from-slate-900 to-[#025EA7] text-white shadow-xs'
                                  : 'bg-[#025EA7] text-white shadow-xs')
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                        >
                          {Icon && <Icon className="w-3.5 h-3.5" />}
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Interactive Calendar Picker for Custom Range */}
                    {reportPeriod === 'custom' && (
                      <div className="flex items-center gap-2 bg-blue-50/80 border border-blue-200 px-3.5 py-1.5 rounded-xl text-xs shadow-xs animate-in fade-in flex-wrap">
                        <Calendar className="w-4 h-4 text-[#025EA7] shrink-0" />
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <span>From:</span>
                          <input
                            type="date"
                            value={reportDateFrom}
                            onChange={(e) => setReportDateFrom(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-[#025EA7]"
                          />
                          <span>To:</span>
                          <input
                            type="date"
                            value={reportDateTo}
                            onChange={(e) => setReportDateTo(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-[#025EA7]"
                          />
                        </div>
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            type="button"
                            onClick={() => {
                              const end = new Date();
                              const start = new Date();
                              start.setDate(end.getDate() - 7);
                              setReportDateFrom(start.toISOString().split('T')[0]);
                              setReportDateTo(end.toISOString().split('T')[0]);
                            }}
                            className="px-2 py-1 bg-white border border-slate-200 hover:border-blue-300 rounded-md text-[11px] font-bold text-slate-600 hover:text-[#025EA7] cursor-pointer"
                          >
                            Last 7d
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const end = new Date();
                              const start = new Date();
                              start.setDate(end.getDate() - 30);
                              setReportDateFrom(start.toISOString().split('T')[0]);
                              setReportDateTo(end.toISOString().split('T')[0]);
                            }}
                            className="px-2 py-1 bg-white border border-slate-200 hover:border-blue-300 rounded-md text-[11px] font-bold text-slate-600 hover:text-[#025EA7] cursor-pointer"
                          >
                            Last 30d
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const now = new Date();
                              const start = new Date(now.getFullYear(), now.getMonth(), 1);
                              setReportDateFrom(start.toISOString().split('T')[0]);
                              setReportDateTo(now.toISOString().split('T')[0]);
                            }}
                            className="px-2 py-1 bg-white border border-slate-200 hover:border-blue-300 rounded-md text-[11px] font-bold text-slate-600 hover:text-[#025EA7] cursor-pointer"
                          >
                            This Month
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Grand Report Mode Status Banner */}
                {reportPeriod === 'all' && (
                  <div className="p-4 bg-gradient-to-r from-slate-900 via-blue-950 to-[#025EA7] text-white rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-blue-900/50">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                        <Zap className="w-5 h-5 text-amber-300" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">Grand Report Mode</h3>
                          <span className="text-[10px] bg-amber-400/20 border border-amber-400/40 text-amber-300 font-extrabold px-1.5 py-0.5 rounded tracking-wide">
                            ALL-TIME AUDIT
                          </span>
                        </div>
                        <p className="text-xs text-blue-100/80 mt-0.5">
                          Viewing comprehensive historical financials & stock valuation aggregated across all branches.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => exportReport('pdf')}
                        className="py-2 px-3.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                      >
                        <Download className="w-4 h-4 text-[#025EA7]" /> Download PDF
                      </button>
                      <button
                        type="button"
                        onClick={handleShareReport}
                        className="py-2 px-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Share2 className="w-4 h-4 text-white" /> Share Report
                      </button>
                    </div>
                  </div>
                )}

                {reportLoading && (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-5 h-5 animate-spin text-[#025EA7]" />
                    <span className="ml-2 text-xs text-slate-500 font-medium">Loading report data...</span>
                  </div>
                )}

                {!reportLoading && (
                  <>
                    {/* ═══════════ OVERVIEW ═══════════ */}
                    {reportSubTab === 'overview' && (
                      <div className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <div className="text-xs text-slate-400 font-medium mb-1 flex items-center justify-between">
                              <span>Today Sales</span>
                              {todaySalesData.importedCount > 0 && (
                                <span className="text-[10px] bg-blue-50 text-[#025EA7] font-bold px-1.5 py-0.5 rounded">
                                  +{todaySalesData.importedCount} imp
                                </span>
                              )}
                            </div>
                            <div className="text-xl font-extrabold text-[#025EA7]">ETB {todaySalesData.totalAmount.toLocaleString()}</div>
                            <div className="text-[10px] text-slate-400 mt-1">Recorded within last 24 hours</div>
                </div>
                <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                  <div className="text-xs text-slate-400 font-medium mb-1">Today Invoices</div>
                            <div className="text-xl font-extrabold text-slate-900">{todaySalesData.invoicesCount}</div>
                            <div className="text-[10px] text-slate-400 mt-1">{todaySalesData.liveCount} live + {todaySalesData.importedCount} imported</div>
                          </div>
                          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <div className="text-xs text-slate-400 font-medium mb-1">Revenue ({reportPeriod})</div>
                            <div className="text-xl font-extrabold text-emerald-600">ETB {toNum(summary.totalRevenue).toLocaleString()}</div>
                </div>
                <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                  <div className="text-xs text-slate-400 font-medium mb-1">Expired Items</div>
                  <div className="text-xl font-extrabold text-amber-600">{stats.expiredCount}</div>
                </div>
              </div>

                        {/* Report Category Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {[
                            { key: 'total_profit', title: 'Total Reports', desc: 'Net profit derived from purchases, sales, commission, & credit', icon: TrendingUp, color: 'emerald' },
                            { key: 'business_report', title: 'Business Report', desc: 'Revenue, margins & invoice breakdowns', icon: FileText, color: 'blue' },
                            { key: 'stock_report', title: 'Stock Report', desc: 'Stock In/Out movement history', icon: ArrowUpDown, color: 'purple' },
                            { key: 'warehouse', title: 'Warehouse Report', desc: 'Revenue & activity per warehouse', icon: Building2, color: 'emerald' },
                            { key: 'shop', title: 'Shop Report', desc: 'Revenue & activity per shop', icon: ShoppingBag, color: 'amber' },
                            { key: 'product', title: 'Product Report', desc: 'Full product inventory overview', icon: Package, color: 'slate' },
                            { key: 'sales_report', title: 'Sales Reports', desc: 'Live & imported sales reports from CSV & PDF', icon: FileSpreadsheet, color: 'blue' },
                            { key: 'low_stock', title: 'Low Stock Alerts', desc: `${lowStockProducts.length} products below threshold`, icon: AlertTriangle, color: 'red' },
                          ].map(({ key, title, desc, icon: Icon, color }) => (
                            <button
                              key={key}
                              onClick={() => setReportSubTab(key)}
                              className="p-5 bg-white border border-slate-200 hover:border-blue-200 rounded-2xl shadow-sm hover:shadow-md transition-all text-left group cursor-pointer"
                            >
                              <div className="flex items-center gap-3 mb-2">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                  color === 'blue' ? 'bg-blue-50 text-[#025EA7]' :
                                  color === 'purple' ? 'bg-purple-50 text-purple-600' :
                                  color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                                  color === 'amber' ? 'bg-amber-50 text-amber-600' :
                                  color === 'red' ? 'bg-red-50 text-red-600' :
                                  'bg-slate-50 text-slate-600'
                                }`}>
                                  <Icon className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#025EA7] transition-colors">{title}</h4>
                                  <p className="text-[11px] text-slate-500">{desc}</p>
                                </div>
                              </div>
                            </button>
                          ))}
              </div>
            </div>
          )}

                    {/* ═══════════ TOTAL PROFITS REPORT ═══════════ */}
                    {reportSubTab === 'total_profit' && (() => {
                      const totalRev = toNum(summary.totalRevenue || stats.todaySales);
                      const totalPurchase = toNum(summary.totalPurchase);
                      const totalExpense = toNum(summary.totalExpense);
                      const totalCommission = toNum(summary.totalCommission);
                      const totalCredit = toNum(summary.totalCredit);
                      const creditCollected = toNum(summary.creditCollected);
                      const outstandingCredit = toNum(summary.outstandingCredit);
                      const grossProfit = toNum(summary.grossProfit || (totalRev - totalPurchase));
                      const totalProfit = toNum(summary.totalProfit || (grossProfit - totalExpense - totalCommission));
                      const cashProfit = toNum(summary.cashProfit);
                      const totalTax = toNum(summary.totalTax);
                      const totalDiscount = toNum(summary.totalDiscount);
                      const totalBorrowings = toNum(summary.totalBorrowings);
                      const unreturnedBorrowingCount = toNum(summary.unreturnedBorrowingCount);

                      const grossMargin = totalRev > 0 ? ((grossProfit / totalRev) * 100).toFixed(1) : '0.0';
                      const netMargin = totalRev > 0 ? ((totalProfit / totalRev) * 100).toFixed(1) : '0.0';

                      return (
                        <div className="space-y-6">
                          {/* Executive Header Banner */}
                          <div className="p-6 bg-slate-900 text-white rounded-3xl shadow-xl border border-slate-700/60 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                              <div>
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-3 border border-emerald-500/30">
                                  <TrendingUp className="w-3.5 h-3.5" /> Total Profit & Loss Comprehensive Statement
                                </div>
                                <h3 className="text-2xl font-extrabold text-white tracking-tight">Financial Performance & Profit Analytics</h3>
                                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                                  Multi-metric profit derivation aggregated from sales revenue, inventory purchases (COGS), staff commissions, operating expenses, and credit cash-flow adjustments.
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-3">
                                <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/15 text-center">
                                  <div className="text-[10px] text-slate-300 uppercase font-bold tracking-wider">Net Profit Margin</div>
                                  <div className={`text-xl font-extrabold mt-0.5 ${totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {netMargin}%
                                  </div>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/15 text-center">
                                  <div className="text-[10px] text-slate-300 uppercase font-bold tracking-wider">Gross Margin</div>
                                  <div className="text-xl font-extrabold text-blue-300 mt-0.5">
                                    {grossMargin}%
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Top 6 KPI Metric Cards */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">1. Total Revenue</span>
                                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Inflow</span>
                              </div>
                              <div className="text-2xl font-extrabold text-[#025EA7]">ETB {totalRev.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                              <div className="text-[11px] text-slate-500 mt-1.5">Gross billed sales across all locations</div>
                            </div>

                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">2. Purchases (COGS)</span>
                                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Direct Cost</span>
                              </div>
                              <div className="text-2xl font-extrabold text-amber-600">ETB {totalPurchase.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                              <div className="text-[11px] text-slate-500 mt-1.5">Cost of inventory / goods sold</div>
                            </div>

                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">3. Gross Profit</span>
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Margin {grossMargin}%</span>
                              </div>
                              <div className="text-2xl font-extrabold text-indigo-600">ETB {grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                              <div className="text-[11px] text-slate-500 mt-1.5">Revenue minus inventory purchases</div>
                            </div>

                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">4. Operating Expenses</span>
                                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">Bank / Ops</span>
                              </div>
                              <div className="text-2xl font-extrabold text-rose-600">ETB {totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                              <div className="text-[11px] text-slate-500 mt-1.5">Recorded operational & bank expenses</div>
                            </div>

                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">5. Staff Commissions</span>
                                <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">Sales Staff</span>
                              </div>
                              <div className="text-2xl font-extrabold text-purple-600">ETB {totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                              <div className="text-[11px] text-slate-500 mt-1.5">Commissions earned on closed sales</div>
                            </div>

                            <div className={`p-5 bg-white border-2 rounded-2xl shadow-sm hover:shadow-md transition-shadow ${totalProfit >= 0 ? 'border-emerald-500/40 bg-emerald-50/10' : 'border-rose-500/40 bg-rose-50/10'}`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">6. Net Total Profit</span>
                                <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${totalProfit >= 0 ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'}`}>
                                  Net {netMargin}%
                                </span>
                              </div>
                              <div className={`text-2xl font-extrabold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                ETB {totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1.5">Gross Profit − Expenses − Commission</div>
                            </div>
                          </div>

                          {/* Derivation Equation Breakdown */}
                          <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-[#025EA7]" /> Net Total Profit Formula Derivation
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center text-center">
                              <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl">
                                <div className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Sales Revenue</div>
                                <div className="text-sm font-extrabold text-blue-900 mt-0.5">ETB {totalRev.toLocaleString()}</div>
                              </div>
                              <div className="flex items-center justify-center text-slate-400 font-bold text-lg">−</div>
                              <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl">
                                <div className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Purchases (COGS)</div>
                                <div className="text-sm font-extrabold text-amber-900 mt-0.5">ETB {totalPurchase.toLocaleString()}</div>
                              </div>
                              <div className="flex items-center justify-center text-slate-400 font-bold text-lg">−</div>
                              <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-xl">
                                <div className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">Expenses & Commission</div>
                                <div className="text-sm font-extrabold text-rose-900 mt-0.5">ETB {(totalExpense + totalCommission).toLocaleString()}</div>
                              </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                              <span>Formula: <code className="bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-semibold">Net Profit = Total Revenue − Purchases − Expenses − Commission</code></span>
                              <span className={`font-bold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                Result: ETB {totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          {/* Cash Flow & Credit Impact Card */}
                          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                <CreditCard className="w-4 h-4 text-emerald-400" /> Realized Cash Flow vs Credit Derivation
                              </h4>
                              <span className="text-[11px] text-emerald-300 font-semibold bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                                Cash Liquidity View
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Direct Cash Inflow</span>
                                <span className="text-lg font-bold text-blue-300 mt-1 block">ETB {(totalRev - totalCredit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                <span className="text-[10px] text-slate-400 mt-0.5 block">Cash paid at point of sale</span>
                              </div>
                              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Credit Recovered (+)</span>
                                <span className="text-lg font-bold text-emerald-400 mt-1 block">+ETB {creditCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                <span className="text-[10px] text-slate-400 mt-0.5 block">Debt collected from credit accounts</span>
                              </div>
                              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Total Cash Outflows (-)</span>
                                <span className="text-lg font-bold text-rose-300 mt-1 block">-ETB {(totalPurchase + totalExpense + totalCommission).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                <span className="text-[10px] text-slate-400 mt-0.5 block">Purchases + Expenses + Commission</span>
                              </div>
                              <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-xl">
                                <span className="text-emerald-300 block text-[10px] uppercase font-bold tracking-wider">Realized Cash Profit</span>
                                <span className={`text-lg font-extrabold mt-1 block ${cashProfit >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                                  ETB {cashProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                                <span className="text-[10px] text-emerald-200/70 mt-0.5 block">Actual cash gained this period</span>
                              </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                              <span>New credit debt issued this period: <strong className="text-rose-400">ETB {totalCredit.toLocaleString()}</strong></span>
                              <span>Total active outstanding debt across company: <strong className="text-amber-300">ETB {outstandingCredit.toLocaleString()}</strong></span>
                            </div>
                          </div>

                          {/* Operational Adjustments & Additional Metrics */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                              <div className="text-xs text-slate-400 font-bold uppercase mb-1">Discounts Granted</div>
                              <div className="text-xl font-extrabold text-amber-600">ETB {totalDiscount.toLocaleString()}</div>
                              <div className="text-[11px] text-slate-500 mt-1">Price concessions given to buyers</div>
                            </div>
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                              <div className="text-xs text-slate-400 font-bold uppercase mb-1">Tax Collected</div>
                              <div className="text-xl font-extrabold text-indigo-600">ETB {totalTax.toLocaleString()}</div>
                              <div className="text-[11px] text-slate-500 mt-1">Total sales tax liability recorded</div>
                            </div>
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                              <div className="text-xs text-slate-400 font-bold uppercase mb-1">Product Borrowings</div>
                              <div className="text-xl font-extrabold text-slate-900">{totalBorrowings} <span className="text-xs font-normal text-slate-500">records</span></div>
                              <div className="text-[11px] text-amber-600 mt-1 font-semibold">{unreturnedBorrowingCount} unreturned units pending</div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ═══════════ BUSINESS REPORT ═══════════ */}
                    {reportSubTab === 'business_report' && (() => {
                      const salesList = Array.isArray(sales) ? sales : [];
                      const totalRev = toNum(summary.totalRevenue || stats.todaySales);
                      const totalSalesCount = toNum(summary.totalSales || salesList.length);
                      const avgSale = totalSalesCount > 0 ? totalRev / totalSalesCount : 0;
                      const totalTax = toNum(summary.totalTax);
                      const totalDiscount = toNum(summary.totalDiscount);
                      const totalCredit = toNum(summary.totalCredit);
                      const totalPurchase = toNum(summary.totalPurchase);
                      const totalExpense = toNum(summary.totalExpense);
                      const totalProfit = toNum(summary.totalProfit);

                      const cashSales = salesList.filter(s => (s.paymentType || '').toLowerCase() === 'cash');
                      const bankSales = salesList.filter(s => (s.paymentType || '').toLowerCase() === 'bank_transfer');
                      const mobileSales = salesList.filter(s => (s.paymentType || '').toLowerCase() === 'mobile_money');
                      const creditSales = salesList.filter(s => (s.paymentType || '').toLowerCase() === 'credit' || (s.remainingBalance || 0) > 0);

                      const cashRev = cashSales.reduce((sum, s) => sum + toNum(s.totalAmount), 0);
                      const bankRev = bankSales.reduce((sum, s) => sum + toNum(s.totalAmount), 0);
                      const mobileRev = mobileSales.reduce((sum, s) => sum + toNum(s.totalAmount), 0);
                      const creditRev = creditSales.reduce((sum, s) => sum + toNum(s.remainingBalance || s.totalAmount), 0);

                      return (
                        <div className="space-y-6">
                          {/* KPI Metric Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total Business Revenue</div>
                              <div className="text-2xl font-extrabold text-[#025EA7]">ETB {totalRev.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                              <div className="text-[11px] text-slate-500 mt-1">{totalSalesCount} total sales processed</div>
                            </div>
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total Purchases (COGS)</div>
                              <div className="text-2xl font-extrabold text-amber-600">ETB {totalPurchase.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                              <div className="text-[11px] text-slate-500 mt-1">Direct inventory purchase cost</div>
                            </div>
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total Operating Expenses</div>
                              <div className="text-2xl font-extrabold text-rose-600">ETB {totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                              <div className="text-[11px] text-slate-500 mt-1">Recorded business expenses</div>
                            </div>
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Net Business Profit</div>
                              <div className={`text-2xl font-extrabold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                ETB {totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1">Revenue − Purchases − Expenses</div>
                            </div>
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Average Invoice Value</div>
                              <div className="text-2xl font-extrabold text-blue-600">ETB {avgSale.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                              <div className="text-[11px] text-slate-500 mt-1">Per transaction average</div>
                            </div>
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Outstanding Credit</div>
                              <div className="text-2xl font-extrabold text-rose-600">ETB {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                              <div className="text-[11px] text-slate-500 mt-1">{creditSales.length} credit invoices pending</div>
                            </div>
                          </div>

                          {/* Executive Financial Summary Statement */}
                          <div className="p-5 bg-slate-900 text-white rounded-2xl shadow-md border border-slate-800">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div>
                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Executive Financial Summary
                                </h4>
                                <p className="text-xs text-slate-300 mt-0.5">Calculated from total sales revenue minus inventory purchases and operating expenses</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
                                <div>
                                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Revenue</span>
                                  <span className="text-sm font-bold text-blue-300">ETB {totalRev.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <span className="text-slate-500 font-bold text-base">−</span>
                                <div>
                                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Purchases</span>
                                  <span className="text-sm font-bold text-amber-300">ETB {totalPurchase.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <span className="text-slate-500 font-bold text-base">−</span>
                                <div>
                                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Expenses</span>
                                  <span className="text-sm font-bold text-rose-300">ETB {totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <span className="text-slate-500 font-bold text-base">−</span>
                                <div>
                                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Commission</span>
                                  <span className="text-sm font-bold text-purple-300">ETB {toNum(summary.totalCommission).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <span className="text-slate-500 font-bold text-base">=</span>
                                <div className="bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/10">
                                  <span className="text-slate-300 block text-[10px] uppercase font-extrabold tracking-wider">Net Profit</span>
                                  <span className={`text-base font-extrabold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    ETB {totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Breakdown by Payment Channel */}
                          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-[#025EA7]" /> Payment Channel Breakdown
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                                <div className="text-xs text-slate-500 font-medium">Cash Payments</div>
                                <div className="text-lg font-bold text-slate-900 mt-1">ETB {cashRev.toLocaleString()}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5">{cashSales.length} Invoices</div>
                              </div>
                              <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                                <div className="text-xs text-blue-600 font-medium">Bank Transfer</div>
                                <div className="text-lg font-bold text-slate-900 mt-1">ETB {bankRev.toLocaleString()}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5">{bankSales.length} Invoices</div>
                              </div>
                              <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                                <div className="text-xs text-emerald-600 font-medium">Mobile Money / Telebirr</div>
                                <div className="text-lg font-bold text-slate-900 mt-1">ETB {mobileRev.toLocaleString()}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5">{mobileSales.length} Invoices</div>
                              </div>
                              <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-xl">
                                <div className="text-xs text-rose-600 font-medium">Credit Sales</div>
                                <div className="text-lg font-bold text-slate-900 mt-1">ETB {creditRev.toLocaleString()}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5">{creditSales.length} Invoices</div>
                              </div>
                            </div>
                          </div>

                          {/* Tax & Discount Summary Row */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center justify-between">
                              <div>
                                <div className="text-xs text-slate-400 font-bold uppercase mb-1">Total Tax Collected</div>
                                <div className="text-xl font-extrabold text-slate-900">ETB {totalTax.toLocaleString()}</div>
                              </div>
                              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                                <Percent className="w-5 h-5" />
                              </div>
                            </div>
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center justify-between">
                              <div>
                                <div className="text-xs text-slate-400 font-bold uppercase mb-1">Total Discounts Applied</div>
                                <div className="text-xl font-extrabold text-amber-600">ETB {totalDiscount.toLocaleString()}</div>
                              </div>
                              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                                <Tag className="w-5 h-5" />
                              </div>
                            </div>
                          </div>

                          {/* Recent Invoices Table */}
                          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                              <h3 className="text-sm font-bold text-slate-900">Recent Business Invoices</h3>
                              <span className="text-xs text-slate-500 font-medium">{salesList.length} total records</span>
                            </div>
                            {salesList.length === 0 ? (
                              <div className="py-12 text-center text-xs text-slate-400">No sales transactions available for this period.</div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold tracking-wider border-b border-slate-100">
                                      <th className="py-3 px-4">Invoice #</th>
                                      <th className="py-3 px-4">Customer</th>
                                      <th className="py-3 px-4">Payment Method</th>
                                      <th className="py-3 px-4">Total Amount</th>
                                      <th className="py-3 px-4">Remaining</th>
                                      <th className="py-3 px-4">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-xs font-medium">
                                    {salesList.slice(0, 20).map((s: any) => (
                                      <tr key={s.id} className="hover:bg-slate-50/80 cursor-pointer transition-colors" onClick={() => setSelectedInvoiceDetail(s)}>
                                        <td className="py-3 px-4 font-bold text-slate-900">#{s.invoiceNumber || (s.id ? s.id.substring(0, 8) : 'N/A')}</td>
                                        <td className="py-3 px-4 text-slate-700">{s.customerName || 'Walk-in Customer'}</td>
                                        <td className="py-3 px-4 text-slate-600 uppercase text-[11px] font-semibold">{s.paymentType || 'CASH'}</td>
                                        <td className="py-3 px-4 font-bold text-[#025EA7]">ETB {(s.totalAmount || 0).toLocaleString()}</td>
                                        <td className="py-3 px-4 text-rose-600 font-bold">ETB {(s.remainingBalance || 0).toLocaleString()}</td>
                                        <td className="py-3 px-4">
                                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                            (s.status || '').toUpperCase() === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                            (s.status || '').toUpperCase() === 'PARTIALLY_PAID' ? 'bg-amber-100 text-amber-700' :
                                            'bg-rose-100 text-rose-700'
                                          }`}>
                                            {s.status || 'COMPLETED'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* ═══════════ STOCK REPORT ═══════════ */}
                    {reportSubTab === 'stock_report' && (
                      <div className="space-y-5">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <div className="text-xs text-slate-400 font-medium mb-1">Stock In (+)</div>
                            <div className="text-xl font-extrabold text-emerald-600">+{totalQtyIn} <span className="text-xs text-slate-400 font-medium">({stockInList.length})</span></div>
                          </div>
                          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <div className="text-xs text-slate-400 font-medium mb-1">Stock Out (-)</div>
                            <div className="text-xl font-extrabold text-red-600">-{totalQtyOut} <span className="text-xs text-slate-400 font-medium">({stockOutList.length})</span></div>
                          </div>
                          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <div className="text-xs text-slate-400 font-medium mb-1">Transfers (⇄)</div>
                            <div className="text-xl font-extrabold text-[#025EA7]">⇄{totalQtyTransfer} <span className="text-xs text-slate-400 font-medium">({transferList.length})</span></div>
                          </div>
                          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <div className="text-xs text-slate-400 font-medium mb-1">Total Operations</div>
                            <div className="text-xl font-extrabold text-slate-900">{stockInList.length + stockOutList.length + transferList.length}</div>
                          </div>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex gap-2">
                          {[
                            { key: 'all' as const, label: 'All Changes' },
                            { key: 'stock_in' as const, label: 'Stock In (+)' },
                            { key: 'stock_out' as const, label: 'Stock Out (-)' },
                            { key: 'transfer' as const, label: 'Transfers (⇄)' },
                          ].map(({ key, label }) => (
                            <button
                              key={key}
                              onClick={() => setReportStockFilter(key)}
                              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                reportStockFilter === key ? 'bg-[#025EA7] text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        {/* Search */}
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type="text"
                            placeholder="Search transactions..."
                            value={reportStockSearch}
                            onChange={(e) => setReportStockSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7]"
                          />
                        </div>

                        {/* Transaction List Label */}
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Stock In / Out & Transfer Movements ({filteredTx.length})
                        </div>

                        {/* Transaction Cards */}
                        {filteredTx.length === 0 ? (
                          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs text-slate-400 shadow-xs">
                            No stock transactions found.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {filteredTx.slice(0, 50).map((t: any, idx: number) => {
                              const isTransfer = t._txType === 'transfer';
                              const isIn = t._txType === 'stock_in';
                              const prodName = t.product?.name || t.productName || 'Product';
                              const qty = toInt(t.quantity);
                              const reason = t.reason || '';
                              const locName = t.locationName || t.warehouse?.name || t.shop?.name || '';
                              const rawDate = t.createdAt || t.date || '';
                              const dateStr = rawDate ? fmtDate(rawDate) : '';
                              const userStr = t.user ? `${t.user.firstName || ''} ${t.user.lastName || ''}`.trim() : (t.performedByName || '');

                              return (
                                <button
                                  key={t.id || idx}
                                  onClick={() => setSelectedStockTx(t)}
                                  className="w-full p-4 bg-white border border-slate-200 rounded-2xl shadow-xs hover:border-blue-200 hover:shadow-md transition-all flex items-center gap-3.5 text-left group"
                                >
                                  {/* Icon */}
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                    isTransfer ? 'bg-blue-50' : isIn ? 'bg-emerald-50' : 'bg-red-50'
                                  }`}>
                                    {isTransfer ? (
                                      <ArrowLeftRight className="w-5 h-5 text-[#025EA7]" />
                                    ) : isIn ? (
                                      <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                                    ) : (
                                      <ArrowDownRight className="w-5 h-5 text-red-600" />
                                    )}
                                  </div>
                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-slate-900 group-hover:text-[#025EA7] transition-colors truncate">{prodName}</div>
                                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                      {[reason, locName, dateStr].filter(Boolean).join(' • ')}
                                    </div>
                                    {userStr && <div className="text-[11px] text-slate-400 mt-0.5 truncate">By: {userStr}</div>}
                                  </div>
                                  {/* Qty Badge */}
                                  <div className={`px-3 py-1.5 rounded-lg text-sm font-extrabold shrink-0 ${
                                    isTransfer ? 'bg-blue-50 text-[#025EA7]' : isIn ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                  }`}>
                                    {isTransfer ? '⇄ ' : isIn ? '+' : '-'}{qty}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ═══════════ WAREHOUSE REPORT ═══════════ */}
                    {reportSubTab === 'warehouse' && (
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <div className="text-xs text-slate-400 font-medium mb-1">Warehouses</div>
                            <div className="text-xl font-extrabold text-slate-900">{warehouseRows.length || warehouses.length}</div>
                          </div>
                          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <div className="text-xs text-slate-400 font-medium mb-1">Revenue</div>
                            <div className="text-xl font-extrabold text-[#025EA7]">ETB {warehouseRows.reduce((s: number, r: any) => s + toNum(r.revenue), 0).toLocaleString()}</div>
                          </div>
                          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <div className="text-xs text-slate-400 font-medium mb-1">Sales</div>
                            <div className="text-xl font-extrabold text-slate-900">{warehouseRows.reduce((s: number, r: any) => s + toInt(r.invoiceCount), 0)}</div>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 className="w-4 h-4 text-[#025EA7]" />
                            <h3 className="text-sm font-bold text-slate-900">Warehouse Activity</h3>
                          </div>
                          {(warehouseRows.length > 0 ? warehouseRows : warehouses.map((w: any) => ({ id: w.id, name: w.name, revenue: 0, invoiceCount: 0 }))).map((r: any) => {
                            const maxRev = Math.max(...(warehouseRows.length > 0 ? warehouseRows : [r]).map((x: any) => toNum(x.revenue)), 1);
                            const pct = toNum(r.revenue) / maxRev * 100;
                            const targetItem = warehouses.find((w) => w.id === r.id || w.name === r.name) || ({ id: r.id || 'wh', name: r.name || 'Warehouse', location: r.location || 'Main Warehouse' } as Warehouse);
                            return (
                              <div
                                key={r.id || r.name}
                                onClick={() => {
                                  setSelectedDetailLocation({ type: 'warehouse', item: targetItem });
                                  setIsStoreDetailOpen(true);
                                }}
                                className="p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold text-slate-900 group-hover:text-[#025EA7] transition-colors">{r.name || 'Unknown'}</span>
                                  <span className="text-xs font-bold text-slate-900">ETB {toNum(r.revenue).toLocaleString()}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mb-2">{toInt(r.invoiceCount)} invoices • Click to view store details</div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5">
                                  <div className="bg-[#025EA7] h-1.5 rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                                </div>
                              </div>
                            );
                          })}
                          {warehouseRows.length === 0 && warehouses.length === 0 && (
                            <div className="text-xs text-slate-400 text-center py-6">No warehouse data available</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ═══════════ SHOP REPORT ═══════════ */}
                    {reportSubTab === 'shop' && (
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <div className="text-xs text-slate-400 font-medium mb-1">Shops</div>
                            <div className="text-xl font-extrabold text-slate-900">{shopRows.length || shops.length}</div>
                          </div>
                          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <div className="text-xs text-slate-400 font-medium mb-1">Revenue</div>
                            <div className="text-xl font-extrabold text-[#025EA7]">ETB {shopRows.reduce((s: number, r: any) => s + toNum(r.revenue), 0).toLocaleString()}</div>
                          </div>
                          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <div className="text-xs text-slate-400 font-medium mb-1">Sales</div>
                            <div className="text-xl font-extrabold text-slate-900">{shopRows.reduce((s: number, r: any) => s + toInt(r.invoiceCount), 0)}</div>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                          <div className="flex items-center gap-2 mb-2">
                            <ShoppingBag className="w-4 h-4 text-[#025EA7]" />
                            <h3 className="text-sm font-bold text-slate-900">Store Activity</h3>
                          </div>
                          {(shopRows.length > 0 ? shopRows : shops.map((s: any) => ({ id: s.id, name: s.name, revenue: 0, invoiceCount: 0 }))).map((r: any) => {
                            const maxRev = Math.max(...(shopRows.length > 0 ? shopRows : [r]).map((x: any) => toNum(x.revenue)), 1);
                            const pct = toNum(r.revenue) / maxRev * 100;
                            const targetItem = shops.find((s) => s.id === r.id || s.name === r.name) || ({ id: r.id || 'shp', name: r.name || 'Shop', location: r.location || 'Retail Branch' } as Shop);
                            return (
                              <div
                                key={r.id || r.name}
                                onClick={() => {
                                  setSelectedDetailLocation({ type: 'shop', item: targetItem });
                                  setIsStoreDetailOpen(true);
                                }}
                                className="p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold text-slate-900 group-hover:text-[#025EA7] transition-colors">{r.name || 'Unknown'}</span>
                                  <span className="text-xs font-bold text-slate-900">ETB {toNum(r.revenue).toLocaleString()}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mb-2">{toInt(r.invoiceCount)} invoices • Click to view store details</div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5">
                                  <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                                </div>
                              </div>
                            );
                          })}
                          {shopRows.length === 0 && shops.length === 0 && (
                            <div className="text-xs text-slate-400 text-center py-6">No shop data available</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ═══════════ SALES REPORTS ═══════════ */}
                    {reportSubTab === 'sales_report' && (() => {
                      const allReportSales = [
                        ...sales.map((s) => ({
                          id: s.id,
                          invoiceNumber: s.invoiceNumber || (s.id ? s.id.substring(0, 8) : 'N/A'),
                          date: s.createdAt,
                          customerName: s.customerName || 'Walk-in Customer',
                          customerPhone: s.customerPhone,
                          productName: (s.items && s.items.length > 0) ? s.items.map(it => `${it.productName} (x${it.quantity})`).join(', ') : 'General Sale',
                          quantity: (s.items && s.items.length > 0) ? s.items.reduce((sum, it) => sum + (it.quantity || 1), 0) : 1,
                          unitPrice: s.totalAmount || 0,
                          totalAmount: s.totalAmount || 0,
                          remainingBalance: s.remainingBalance || 0,
                          advancePayment: s.advancePayment || 0,
                          paymentType: (s.paymentType || 'cash').toLowerCase(),
                          locationName: s.storeName || 'Main Store',
                          status: (s.status || 'COMPLETED').toUpperCase(),
                          source: 'live' as const,
                          sourceLabel: 'Live Sale',
                          rawRecord: s,
                          isImported: false,
                        })),
                        ...importedSales.map((s) => ({
                          id: s.id,
                          invoiceNumber: s.invoiceNumber,
                          date: s.saleDate,
                          customerName: s.customerName || 'Walk-in Customer',
                          customerPhone: s.customerPhone,
                          productName: s.productName ? `${s.productName} (x${s.quantity})` : 'Imported Item',
                          quantity: s.quantity || 1,
                          unitPrice: s.unitPrice || 0,
                          totalAmount: s.totalAmount || 0,
                          remainingBalance: s.remainingBalance || 0,
                          advancePayment: s.advancePayment || 0,
                          paymentType: (s.paymentType || 'cash').toLowerCase(),
                          locationName: s.locationName || 'Main Store',
                          status: (s.status || 'COMPLETED').toUpperCase(),
                          source: s.source,
                          sourceLabel: `Imported (${s.source.toUpperCase()})`,
                          rawRecord: s,
                          isImported: true,
                        })),
                      ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

                      const filteredReportSales = allReportSales.filter((s) => {
                        if (salesReportSourceFilter === 'live' && s.isImported) return false;
                        if (salesReportSourceFilter === 'imported' && !s.isImported) return false;
                        if (salesReportPaymentFilter !== 'all' && s.paymentType !== salesReportPaymentFilter) return false;
                        if (salesReportSearch.trim()) {
                          const q = salesReportSearch.toLowerCase();
                          const inv = s.invoiceNumber.toLowerCase();
                          const cust = s.customerName.toLowerCase();
                          const phone = (s.customerPhone || '').toLowerCase();
                          const prod = s.productName.toLowerCase();
                          const loc = s.locationName.toLowerCase();
                          if (!inv.includes(q) && !cust.includes(q) && !phone.includes(q) && !prod.includes(q) && !loc.includes(q)) {
                            return false;
                          }
                        }
                        return true;
                      });

                      const totalCombinedRevenue = filteredReportSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
                      const totalLiveRevenue = filteredReportSales.filter(s => !s.isImported).reduce((sum, s) => sum + (s.totalAmount || 0), 0);
                      const totalImportedRevenue = filteredReportSales.filter(s => s.isImported).reduce((sum, s) => sum + (s.totalAmount || 0), 0);
                      const totalRemainingCredit = filteredReportSales.reduce((sum, s) => sum + (s.remainingBalance || 0), 0);
                      const pendingCreditCount = filteredReportSales.filter(s => (s.remainingBalance || 0) > 0).length;

                      const cashTotal = filteredReportSales.filter(s => s.paymentType === 'cash').reduce((sum, s) => sum + (s.totalAmount || 0), 0);
                      const bankTotal = filteredReportSales.filter(s => s.paymentType.includes('bank')).reduce((sum, s) => sum + (s.totalAmount || 0), 0);
                      const mobileTotal = filteredReportSales.filter(s => s.paymentType.includes('mobile') || s.paymentType.includes('telebirr')).reduce((sum, s) => sum + (s.totalAmount || 0), 0);

                      const liveCount = allReportSales.filter(s => !s.isImported).length;
                      const importedCount = allReportSales.filter(s => s.isImported).length;

                      return (
                        <div className="space-y-5 animate-fade-in">
                          {/* Top Action Bar */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                            <div>
                              <div className="text-[11px] font-bold uppercase tracking-wider text-[#025EA7] flex items-center gap-1.5">
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                Sales Reports & Analytics
                              </div>
                              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                                Consolidated Sales Hub
                              </h3>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Showing {filteredReportSales.length} of {allReportSales.length} total records ({liveCount} Live Store, {importedCount} Imported)
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {importedSales.length > 0 && (
                                <button
                                  type="button"
                                  onClick={handleClearImportedSales}
                                  className="px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all"
                                  title="Clear all imported sales records"
                                >
                                  Clear Imported ({importedSales.length})
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => downloadSampleSalesTemplate('csv')}
                                className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all flex items-center gap-1.5"
                                title="Download CSV import template"
                              >
                                <Download className="w-3.5 h-3.5" /> Template CSV
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadSampleSalesTemplate('xlsx')}
                                className="px-3 py-2 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl transition-all flex items-center gap-1.5"
                                title="Download XLSX import template"
                              >
                                <Download className="w-3.5 h-3.5" /> Template XLSX
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsImportSalesModalOpen(true)}
                                className="px-4 py-2 text-xs font-bold text-white bg-[#025EA7] hover:bg-[#014883] rounded-xl flex items-center gap-2 shadow-xs transition-all"
                              >
                                <UploadCloud className="w-4 h-4" />
                                Import Sales (CSV / PDF)
                              </button>
                            </div>
                          </div>

                          {/* 4 Metric Cards */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Sales Revenue</span>
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                                  ETB
                                </div>
                              </div>
                              <div className="text-xl font-black text-slate-900">ETB {totalCombinedRevenue.toLocaleString()}</div>
                              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                                <span>Live: ETB {totalLiveRevenue.toLocaleString()}</span>
                                <span>Imp: ETB {totalImportedRevenue.toLocaleString()}</span>
                              </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Invoices</span>
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#025EA7] flex items-center justify-center">
                                  <FileText className="w-4 h-4" />
                                </div>
                              </div>
                              <div className="text-xl font-black text-slate-900">{filteredReportSales.length.toLocaleString()}</div>
                              <div className="text-[11px] text-slate-500 mt-1">
                                {liveCount} Live Transactions • {importedCount} Imported
                              </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Collections</span>
                                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                                  <CreditCard className="w-4 h-4" />
                                </div>
                              </div>
                              <div className="text-xs font-bold text-slate-800 space-y-0.5">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Cash:</span>
                                  <span>ETB {cashTotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Bank / Transfer:</span>
                                  <span>ETB {bankTotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Telebirr / Mobile:</span>
                                  <span>ETB {mobileTotal.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Credit / Outstanding</span>
                                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                  <AlertCircle className="w-4 h-4" />
                                </div>
                              </div>
                              <div className="text-xl font-black text-rose-600">ETB {totalRemainingCredit.toLocaleString()}</div>
                              <div className="text-[11px] text-slate-500 mt-1">
                                {pendingCreditCount} sales with outstanding balance
                              </div>
                            </div>
                          </div>

                          {/* Filter & Search Bar */}
                          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                            <div className="flex flex-col md:flex-row items-center gap-3">
                              {/* Search */}
                              <div className="relative flex-1 w-full">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                  type="text"
                                  value={salesReportSearch}
                                  onChange={(e) => setSalesReportSearch(e.target.value)}
                                  placeholder="Search by invoice #, customer name, phone, product, or store..."
                                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#025EA7] focus:bg-white transition-all text-slate-800 placeholder-slate-400"
                                />
                                {salesReportSearch && (
                                  <button
                                    onClick={() => setSalesReportSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>

                              {/* Source Filter */}
                              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 w-full md:w-auto overflow-x-auto">
                                {[
                                  { key: 'all', label: `All (${allReportSales.length})` },
                                  { key: 'live', label: `Live (${liveCount})` },
                                  { key: 'imported', label: `Imported (${importedCount})` },
                                ].map((tab) => (
                                  <button
                                    key={tab.key}
                                    onClick={() => setSalesReportSourceFilter(tab.key as any)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all shrink-0 ${
                                      salesReportSourceFilter === tab.key
                                        ? 'bg-white text-[#025EA7] shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    {tab.label}
                                  </button>
                                ))}
                              </div>

                              {/* Payment Filter */}
                              <select
                                value={salesReportPaymentFilter}
                                onChange={(e) => setSalesReportPaymentFilter(e.target.value)}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#025EA7] shrink-0 w-full md:w-auto"
                              >
                                <option value="all">All Payment Methods</option>
                                <option value="cash">Cash Only</option>
                                <option value="bank_transfer">Bank Transfer</option>
                                <option value="mobile_money">Telebirr / Mobile Money</option>
                                <option value="credit">Credit / Unpaid</option>
                              </select>
                            </div>
                          </div>

                          {/* Sales Records Table */}
                          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                              <div className="text-xs font-bold text-slate-700">
                                Sales Transactions ({filteredReportSales.length})
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Click any row to view full invoice & item details
                              </div>
                            </div>

                            {filteredReportSales.length === 0 ? (
                              <div className="p-12 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                                  <FileSpreadsheet className="w-7 h-7" />
                                </div>
                                <h4 className="text-sm font-bold text-slate-800">No Sales Records Found</h4>
                                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                  No transactions match your search or filter. You can import sales records from CSV or PDF files.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setIsImportSalesModalOpen(true)}
                                  className="mt-4 px-4 py-2 bg-[#025EA7] hover:bg-[#014883] text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-all"
                                >
                                  <UploadCloud className="w-4 h-4" />
                                  Import Sales (CSV / PDF)
                                </button>
                              </div>
                            ) : (
                              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                                    <tr className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                      <th className="py-3 px-4">Invoice # & Source</th>
                                      <th className="py-3 px-4">Date</th>
                                      <th className="py-3 px-4">Customer</th>
                                      <th className="py-3 px-4">Items / Product</th>
                                      <th className="py-3 px-4">Location</th>
                                      <th className="py-3 px-4">Payment</th>
                                      <th className="py-3 px-4 text-right">Amount (ETB)</th>
                                      <th className="py-3 px-4 text-center">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {filteredReportSales.map((s) => {
                                      const formattedDate = s.date
                                        ? new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                                        : 'N/A';
                                      const statusUpper = s.status || 'COMPLETED';
                                      const statusBadge =
                                        statusUpper === 'COMPLETED'
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : statusUpper.includes('PARTIAL')
                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                            : 'bg-rose-50 text-rose-700 border-rose-200';

                                      const sourceBadge =
                                        s.source === 'live'
                                          ? 'bg-blue-50 text-[#025EA7] border-blue-200'
                                          : s.source === 'pdf'
                                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                                            : s.source === 'excel'
                                              ? 'bg-teal-50 text-teal-700 border-teal-200'
                                              : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                                      return (
                                        <tr
                                          key={s.id}
                                          onClick={() => {
                                            if (s.isImported) {
                                              const imp = s.rawRecord as ImportedSaleRecord;
                                              setSelectedInvoiceDetail({
                                                id: imp.id,
                                                invoiceNumber: imp.invoiceNumber,
                                                customerName: imp.customerName,
                                                customerPhone: imp.customerPhone,
                                                salesPerson: `Imported via ${imp.source.toUpperCase()}`,
                                                totalAmount: imp.totalAmount,
                                                remainingBalance: imp.remainingBalance || 0,
                                                advancePayment: imp.advancePayment || 0,
                                                paymentType: imp.paymentType,
                                                storeName: imp.locationName,
                                                status: imp.status,
                                                createdAt: imp.saleDate,
                                                items: [
                                                  {
                                                    productName: imp.productName || 'Imported Product',
                                                    quantity: imp.quantity || 1,
                                                    unitPrice: imp.unitPrice || imp.totalAmount,
                                                  },
                                                ],
                                              });
                                            } else {
                                              setSelectedInvoiceDetail(s.rawRecord);
                                            }
                                          }}
                                          className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                                        >
                                          <td className="py-3 px-4">
                                            <div className="font-bold text-slate-900 group-hover:text-[#025EA7] transition-colors font-mono">
                                              #{s.invoiceNumber}
                                            </div>
                                            <div className="mt-1">
                                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${sourceBadge}`}>
                                                {s.sourceLabel}
                                              </span>
                                            </div>
                                          </td>
                                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                                            {formattedDate}
                                          </td>
                                          <td className="py-3 px-4">
                                            <div className="font-semibold text-slate-900 truncate max-w-[150px]">
                                              {s.customerName}
                                            </div>
                                            {s.customerPhone && (
                                              <div className="text-[10px] text-slate-400">
                                                {s.customerPhone}
                                              </div>
                                            )}
                                          </td>
                                          <td className="py-3 px-4 text-slate-700 max-w-[200px] truncate">
                                            {s.productName}
                                          </td>
                                          <td className="py-3 px-4 text-slate-600">
                                            {s.locationName}
                                          </td>
                                          <td className="py-3 px-4">
                                            <span className="capitalize font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                                              {s.paymentType.replace('_', ' ')}
                                            </span>
                                          </td>
                                          <td className="py-3 px-4 text-right">
                                            <div className="font-black text-slate-900">
                                              ETB {s.totalAmount.toLocaleString()}
                                            </div>
                                            {s.remainingBalance > 0 && (
                                              <div className="text-[10px] font-bold text-rose-600">
                                                Bal: ETB {s.remainingBalance.toLocaleString()}
                                              </div>
                                            )}
                                          </td>
                                          <td className="py-3 px-4 text-center">
                                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${statusBadge}`}>
                                              {statusUpper}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* ═══════════ PURCHASES REPORT ═══════════ */}
                    {reportSubTab === 'purchases_report' && (() => {
                      const filteredPurchases = purchases.filter((p: any) => {
                        if (purchasesSearch.trim()) {
                          const q = purchasesSearch.toLowerCase();
                          const prod = (p.productName || p.product?.name || '').toLowerCase();
                          const sku = (p.productSku || p.product?.sku || '').toLowerCase();
                          const supp = (p.supplierName || p.supplier?.name || '').toLowerCase();
                          const ref = (p.referenceNumber || '').toLowerCase();
                          const staff = (p.performedByName || p.performedBy?.fullName || '').toLowerCase();
                          const branch = (p.warehouseName || p.warehouse?.name || p.shopName || p.shop?.name || '').toLowerCase();
                          if (!prod.includes(q) && !sku.includes(q) && !supp.includes(q) && !ref.includes(q) && !staff.includes(q) && !branch.includes(q)) {
                            return false;
                          }
                        }
                        return true;
                      });

                      const totalCost = filteredPurchases.reduce((acc: number, item: any) => acc + (Number(item.totalCost) || 0), 0);
                      const totalUnits = filteredPurchases.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0);
                      const txCount = filteredPurchases.length;
                      const avgCost = txCount > 0 ? totalCost / txCount : 0;

                      return (
                        <div className="space-y-5 animate-fade-in">
                          {/* Header banner */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                            <div>
                              <div className="text-[11px] font-bold uppercase tracking-wider text-[#025EA7] flex items-center gap-1.5">
                                <ShoppingBag className="w-3.5 h-3.5" />
                                Purchases Report & Stock Inflows
                              </div>
                              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                                Consolidated Purchases Hub
                              </h3>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Showing {filteredPurchases.length} of {purchases.length} total records across warehouses and shops
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => exportReport('csv')}
                                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5"
                              >
                                <Download className="w-3.5 h-3.5 text-slate-500" />
                                Export CSV
                              </button>
                              <button
                                type="button"
                                onClick={() => exportReport('pdf')}
                                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5"
                              >
                                <FileText className="w-3.5 h-3.5 text-slate-500" />
                                Export PDF
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsRecordPurchaseModalOpen(true)}
                                className="px-3.5 py-2 text-xs font-bold text-white bg-[#025EA7] hover:bg-[#014883] rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Record Purchase
                              </button>
                            </div>
                          </div>

                          {/* Metric KPI cards */}
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
                              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                                <span>Total Purchases Cost</span>
                                <DollarSign className="w-4 h-4 text-[#025EA7]" />
                              </div>
                              <div className="text-xl font-extrabold text-slate-900">
                                ETB {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1">Inflow procurement capital</div>
                            </div>

                            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
                              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                                <span>Units Purchased</span>
                                <Package className="w-4 h-4 text-emerald-600" />
                              </div>
                              <div className="text-xl font-extrabold text-slate-900">
                                {totalUnits.toLocaleString()}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1">Total inventory received</div>
                            </div>

                            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
                              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                                <span>Transactions</span>
                                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                              </div>
                              <div className="text-xl font-extrabold text-slate-900">
                                {txCount}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1">Purchase orders recorded</div>
                            </div>

                            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
                              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                                <span>Avg. Purchase Value</span>
                                <TrendingUp className="w-4 h-4 text-amber-600" />
                              </div>
                              <div className="text-xl font-extrabold text-slate-900">
                                ETB {avgCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1">Per purchase order</div>
                            </div>
                          </div>

                          {/* Filters Bar */}
                          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                            <div className="relative w-full md:max-w-md">
                              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                value={purchasesSearch}
                                onChange={(e) => setPurchasesSearch(e.target.value)}
                                placeholder="Search by product, SKU, supplier, branch, reference..."
                                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#025EA7]"
                              />
                              {purchasesSearch && (
                                <button
                                  type="button"
                                  onClick={() => setPurchasesSearch('')}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                              <select
                                value={purchasesLocationFilter}
                                onChange={(e) => setPurchasesLocationFilter(e.target.value)}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#025EA7]"
                              >
                                <option value="all">All Locations</option>
                                <option value="warehouse">All Warehouses</option>
                                <option value="shop">All Shops</option>
                                {warehouses.length > 0 && (
                                  <optgroup label="Warehouses">
                                    {warehouses.map((w: any) => (
                                      <option key={w.id} value={`warehouse:${w.id}`}>{w.name}</option>
                                    ))}
                                  </optgroup>
                                )}
                                {shops.length > 0 && (
                                  <optgroup label="Shops">
                                    {shops.map((s: any) => (
                                      <option key={s.id} value={`shop:${s.id}`}>{s.name}</option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            </div>
                          </div>

                          {/* Purchases Table */}
                          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                              <div className="text-xs font-bold text-slate-700">
                                Purchase Transactions ({filteredPurchases.length})
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Click any row to view complete purchase details
                              </div>
                            </div>

                            {purchasesLoading ? (
                              <div className="p-12 text-center text-slate-400 text-xs font-medium">
                                Loading purchases report...
                              </div>
                            ) : filteredPurchases.length === 0 ? (
                              <div className="p-12 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#025EA7] flex items-center justify-center mx-auto mb-3">
                                  <ShoppingBag className="w-7 h-7" />
                                </div>
                                <h4 className="text-sm font-bold text-slate-800">No Purchase Records Found</h4>
                                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                  No purchase transactions match your current search or date period.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setIsRecordPurchaseModalOpen(true)}
                                  className="mt-4 px-4 py-2 bg-[#025EA7] hover:bg-[#014883] text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-all"
                                >
                                  <Plus className="w-4 h-4" />
                                  Record First Purchase
                                </button>
                              </div>
                            ) : (
                              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                                    <tr className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                      <th className="py-3 px-4">Product & SKU</th>
                                      <th className="py-3 px-4">Date</th>
                                      <th className="py-3 px-4">Branch / Destination</th>
                                      <th className="py-3 px-4">Supplier</th>
                                      <th className="py-3 px-4 text-center">Qty</th>
                                      <th className="py-3 px-4 text-right">Unit Cost (ETB)</th>
                                      <th className="py-3 px-4 text-right">Total (ETB)</th>
                                      <th className="py-3 px-4">Ref / PO #</th>
                                      <th className="py-3 px-4">Staff</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {filteredPurchases.map((p: any, idx: number) => {
                                      const prodName = p.productName || p.product?.name || 'Product';
                                      const prodSku = p.productSku || p.product?.sku || '—';
                                      const location = p.warehouseName || p.warehouse?.name || p.shopName || p.shop?.name || 'Main Location';
                                      const isWarehouse = !!(p.warehouseId || p.warehouseName);
                                      const supplier = p.supplierName || p.supplier?.name || '—';
                                      const unitCost = Number(p.unitCost || 0);
                                      const totalCost = Number(p.totalCost || 0);
                                      const qty = p.quantity || 0;
                                      const ref = p.referenceNumber || '—';
                                      const staff = p.performedByName || p.performedBy?.fullName || '—';
                                      const dateStr = p.createdAt
                                        ? new Date(p.createdAt).toLocaleDateString(undefined, {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                          })
                                        : '—';

                                      return (
                                        <tr
                                          key={p.id || idx}
                                          onClick={() => setSelectedPurchaseDetail(p)}
                                          className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                                        >
                                          <td className="py-3 px-4">
                                            <div className="font-bold text-slate-900 group-hover:text-[#025EA7] transition-colors">
                                              {prodName}
                                            </div>
                                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                              SKU: {prodSku}
                                            </div>
                                          </td>
                                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                                            {dateStr}
                                          </td>
                                          <td className="py-3 px-4">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                              isWarehouse
                                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            }`}>
                                              {isWarehouse ? <Building2 className="w-3 h-3" /> : <ShoppingBag className="w-3 h-3" />}
                                              {location}
                                            </span>
                                          </td>
                                          <td className="py-3 px-4 text-slate-700 max-w-[150px] truncate">
                                            {supplier}
                                          </td>
                                          <td className="py-3 px-4 text-center font-bold text-slate-900">
                                            {qty}
                                          </td>
                                          <td className="py-3 px-4 text-right text-slate-700 font-medium">
                                            ETB {unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </td>
                                          <td className="py-3 px-4 text-right font-black text-emerald-700">
                                            ETB {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </td>
                                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                                            {ref}
                                          </td>
                                          <td className="py-3 px-4 text-slate-600 text-[11px]">
                                            {staff}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* ═══════════ PRODUCT REPORT ═══════════ */}
                    {reportSubTab === 'product' && (() => {
                      const sortedProds = [...products].sort((a, b) => b.stockQuantity - a.stockQuantity);
                      const filteredProds = reportProdSearch
                        ? sortedProds.filter((p) => p.name.toLowerCase().includes(reportProdSearch.toLowerCase()) || (p.sku || '').toLowerCase().includes(reportProdSearch.toLowerCase()))
                        : sortedProds;

                      const totalQty = products.reduce((s, p) => s + (p.stockQuantity || 0), 0);
                      const trackedCount = products.filter((p) => p.trackStock).length;
                      const inventoryValue = products.reduce((s, p) => s + ((p.cost || p.costPrice || p.price) || 0) * (p.stockQuantity || 0), 0);

                      return (
                        <div className="space-y-5">
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                              <div className="text-xs text-slate-400 font-medium mb-1">Products</div>
                              <div className="text-lg font-extrabold text-slate-900">{products.length}</div>
                            </div>
                            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                              <div className="text-xs text-slate-400 font-medium mb-1">Tracked Stock</div>
                              <div className="text-lg font-extrabold text-slate-900">{trackedCount}</div>
                            </div>
                            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                              <div className="text-xs text-slate-400 font-medium mb-1">Total Quantity</div>
                              <div className="text-lg font-extrabold text-slate-900">{totalQty.toLocaleString()}</div>
                            </div>
                            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                              <div className="text-xs text-slate-400 font-medium mb-1">Inventory Value</div>
                              <div className="text-lg font-extrabold text-[#025EA7]">ETB {inventoryValue.toLocaleString()}</div>
                            </div>
                          </div>

                          {/* Search */}
                          <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                            <input
                              type="text"
                              placeholder="Search products..."
                              value={reportProdSearch}
                              onChange={(e) => setReportProdSearch(e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7]"
                            />
                          </div>

                          {filteredProds.length === 0 ? (
                            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs text-slate-400 shadow-xs">No products found</div>
                          ) : (
                            <div className="space-y-3">
                              {filteredProds.slice(0, 50).map((p) => (
                                <div
                                  key={p.id}
                                  onClick={() => setSelectedProductDetail(p)}
                                  className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center gap-3.5 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group"
                                >
                                  <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                                    <Package className="w-6 h-6 text-slate-400 group-hover:text-[#025EA7] transition-colors" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-slate-900 group-hover:text-[#025EA7] transition-colors truncate">{p.name}</div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">P.N: {p.sku || 'N/A'} • Click for full product details</div>
                                    <div className="text-xs font-bold text-orange-700 mt-1">Price: {(p.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                                  </div>
                                  <div className="text-xs text-slate-500 font-medium shrink-0">Qty: {p.stockQuantity}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ═══════════ LOW STOCK ═══════════ */}
                    {reportSubTab === 'low_stock' && (
                      <div className="space-y-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Low Stock Alerts ({lowStockProducts.length})
                        </div>
                        {lowStockProducts.length === 0 ? (
                          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs text-slate-400 shadow-xs">
                            All products are above minimum stock levels.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {lowStockProducts.map((p) => (
                              <div
                                key={p.id}
                                onClick={() => setSelectedProductDetail(p)}
                                className="p-4 bg-white border border-red-100 rounded-2xl shadow-xs flex items-center gap-3.5 hover:border-red-300 hover:shadow-md transition-all cursor-pointer group"
                              >
                                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                                  <AlertTriangle className="w-5 h-5 text-red-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-bold text-slate-900 group-hover:text-red-700 transition-colors truncate">{p.name}</div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">Min Level: {p.minStockLevel} | Current: {p.stockQuantity} • Click for details</div>
                                </div>
                                <div className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-extrabold shrink-0">
                                  {p.stockQuantity}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* ═══════════ STOCK TRANSACTION DETAIL MODAL ═══════════ */}
                {selectedStockTx && (() => {
                  const t = selectedStockTx;
                  const isTransfer = t._txType === 'transfer';
                  const isIn = (t._txType || t.type) === 'stock_in';
                  const prodName = t.product?.name || t.productName || 'Product';
                  const qty = toInt(t.quantity);
                  const reason = t.reason || '';
                  const locName = t.warehouse?.name || t.shop?.name || t.locationName || '';
                  const rawDate = t.createdAt || t.date || '';
                  const dateStr = rawDate ? fmtDate(rawDate) : '';
                  const userStr = t.user ? `${t.user.firstName || ''} ${t.user.lastName || ''}`.trim() : (t.performedByName || t.requestedByName || t.userName || '');
                  const prevQty = t.previousQuantity;
                  const newQty = t.newQuantity;
                  const refNum = t.referenceNumber || t.reference || '';
                  const accentColor = isTransfer ? 'blue' : isIn ? 'emerald' : 'red';

                  return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedStockTx(null)}>
                      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-100">
                          <h3 className="text-lg font-bold text-slate-900">Stock Transaction Detail</h3>
                          <button onClick={() => setSelectedStockTx(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                            <X className="w-5 h-5 text-slate-500" />
                          </button>
                        </div>

                        {/* Type Banner */}
                        <div className={`mx-5 mt-5 p-4 rounded-xl border ${
                          isTransfer ? 'bg-blue-50/60 border-blue-200' : isIn ? 'bg-emerald-50/60 border-emerald-200' : 'bg-red-50/60 border-red-200'
                        } flex items-center gap-3.5`}>
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isTransfer ? 'bg-blue-100' : isIn ? 'bg-emerald-100' : 'bg-red-100'}`}>
                            {isTransfer
                              ? <ArrowLeftRight className="w-6 h-6 text-[#025EA7]" />
                              : isIn
                                ? <ArrowUpRight className="w-6 h-6 text-emerald-700" />
                                : <ArrowDownRight className="w-6 h-6 text-red-700" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-base font-bold ${isTransfer ? 'text-[#025EA7]' : isIn ? 'text-emerald-700' : 'text-red-700'}`}>{isTransfer ? 'Transfer (⇄)' : isIn ? 'Stock In' : 'Stock Out'}</div>
                            <div className="text-sm text-slate-900 truncate">{prodName}</div>
                            {dateStr && <div className="text-[11px] text-slate-500 mt-0.5">{dateStr}</div>}
                          </div>
                          <div className={`text-2xl font-extrabold ${isTransfer ? 'text-[#025EA7]' : isIn ? 'text-emerald-700' : 'text-red-700'}`}>
                            {isTransfer ? '⇄ ' : isIn ? '+' : '-'}{qty}
                          </div>
                        </div>

                        {/* Detail Rows */}
                        <div className="mx-5 mt-4 mb-5 p-4 bg-white border border-slate-200 rounded-xl space-y-0">
                          {[
                            ['Product Name', prodName],
                            ['Quantity', `${isTransfer ? '⇄ ' : isIn ? '+' : '-'}${qty}`, isTransfer ? 'text-[#025EA7] font-bold' : isIn ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'],
                            ...(prevQty != null ? [['Previous Quantity', String(prevQty)]] : []),
                            ...(newQty != null ? [['New Quantity', String(newQty)]] : []),
                            ...(locName ? [[isTransfer ? 'Transfer Route' : 'Store / Warehouse', locName]] : []),
                            ...(userStr ? [['Performed By', userStr]] : []),
                            ...(reason ? [['Reason', reason]] : []),
                            ...(refNum ? [['Reference', refNum]] : []),
                          ].map(([label, value, extraClass], idx) => (
                            <div key={idx} className="flex items-start justify-between py-2.5 border-b border-slate-50 last:border-0">
                              <span className="text-xs text-slate-500 font-medium">{label}</span>
                              <span className={`text-xs font-semibold text-slate-900 text-right max-w-[60%] ${extraClass || ''}`}>{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Share Report Modal */}
                {isShareModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#025EA7] flex items-center justify-center">
                            <Share2 className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-slate-900">Share Report</h3>
                            <p className="text-xs text-slate-500">Distribute financial & audit summary</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setIsShareModalOpen(false)}
                          className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1.5 mb-5">
                        <div className="font-bold text-slate-900 text-sm">{user?.companyName || 'BM Stock'} - {reportPeriod === 'all' ? 'Grand Report' : 'Business Statement'}</div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Period:</span>
                          <span className="font-semibold text-slate-800">{reportPeriod === 'all' ? 'All Time (Grand Report)' : reportPeriod}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Total Revenue:</span>
                          <span className="font-bold text-emerald-600">ETB {toNum(summary.totalRevenue).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500">Net Total Profit:</span>
                          <span className="font-bold text-[#025EA7]">ETB {toNum(summary.totalProfit).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <button
                          onClick={() => {
                            exportReport('pdf');
                            setIsShareModalOpen(false);
                          }}
                          className="w-full py-2.5 px-4 bg-[#025EA7] hover:bg-[#014883] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                        >
                          <Download className="w-4 h-4" /> Download PDF Report
                        </button>
                        <button
                          onClick={() => {
                            const text = `${user?.companyName || 'BM Stock'} - Grand Report\nPeriod: All-Time\nTotal Revenue: ETB ${toNum(summary.totalRevenue).toLocaleString()}\nNet Profit: ETB ${toNum(summary.totalProfit).toLocaleString()}\nGenerated via Gelagle Stock.`;
                            navigator.clipboard.writeText(text);
                            showToast('Report summary copied to clipboard!', 'success');
                            setIsShareModalOpen(false);
                          }}
                          className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <FileText className="w-4 h-4 text-slate-500" /> Copy Summary to Clipboard
                        </button>
                        <a
                          href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${user?.companyName || 'BM Stock'} - Grand Report\nTotal Revenue: ETB ${toNum(summary.totalRevenue).toLocaleString()}\nNet Profit: ETB ${toNum(summary.totalProfit).toLocaleString()}\nGenerated via Gelagle Stock.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
                        >
                          Share via WhatsApp
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB 16: BANK ACCOUNTS (Flutter Parity) */}
          {activeTab === 'Bank Accounts' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Bank Accounts</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Manage your bank accounts, add balance, and track expenses</p>
                </div>
              </div>

              {/* 1. Total Balance Card */}
              <div className="w-full bg-[#1E60AA] rounded-2xl p-6 shadow-md shadow-blue-900/10 text-white relative overflow-hidden">
                <div className="text-xs font-medium text-white/80 mb-2">Total Balance</div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-extrabold tracking-tight">
                    {isBalanceVisible
                      ? `ETB ${bankAccounts.reduce((acc, b) => acc + (b.currentBalance || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                      : 'ETB ••••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsBalanceVisible(!isBalanceVisible)}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors"
                  >
                    {isBalanceVisible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* 2. Top Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddBankAccModalOpen(true)}
                  className="py-3.5 px-4 bg-[#025EA7] hover:bg-[#014883] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Add Account
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddBankBalModalOpen(true)}
                  className="py-3.5 px-4 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  <Wallet className="w-4 h-4" /> Add Balance
                </button>
              </div>

              {/* 3. Bank Accounts List Section */}
              <div className="space-y-3">
                <h3 className="text-base font-bold text-slate-900">Bank Accounts</h3>
                {bankAccounts.length === 0 ? (
                  <div className="p-6 bg-white border border-slate-200 rounded-2xl text-center text-xs text-slate-500 shadow-xs">
                    No bank accounts found. Add an account to get started.
                  </div>
                ) : (
                  bankAccounts.map((b) => (
                    <div
                      key={b.id}
                      className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center justify-between hover:border-blue-200 transition-colors"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-full bg-[#025EA7] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                          Bank
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{b.bankName}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{b.accountNumber}</div>
                        </div>
                      </div>
                      <div className="text-sm font-bold text-[#025EA7]">
                        {isBalanceVisible ? `ETB ${(b.currentBalance || 0).toLocaleString()}` : '••••'}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 4. Reports & Add Expense Header */}
              <div className="flex items-center justify-between pt-2">
                <h3 className="text-lg font-bold text-slate-900">Reports</h3>
                <button
                  type="button"
                  onClick={() => setIsAddBankExpModalOpen(true)}
                  className="py-2 px-3.5 bg-[#025EA7] hover:bg-[#014883] text-white rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Expense
                </button>
              </div>

              {/* 5. Summary Box Card */}
              {(() => {
                const totalAccountBal = bankAccounts.reduce((acc, b) => acc + (Number(b.currentBalance) || 0), 0);
                const totalExpenses = Number(bankSummary.totalExpenses) || 0;
                const grossBalance = totalAccountBal > 0 
                  ? (totalAccountBal + totalExpenses) 
                  : (Number(bankSummary.todaySales) || 0);
                const netBalance = totalAccountBal > 0
                  ? totalAccountBal
                  : (Number(bankSummary.netProfit) !== 0 
                      ? Number(bankSummary.netProfit) 
                      : (grossBalance - totalExpenses));
                const isPositive = netBalance >= 0;
                const formattedNet = Math.abs(netBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                return (
                  <>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="text-sm font-bold text-slate-900 mb-1">Financial Summary</div>
                <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                  <span>Total Balance</span>
                  <span className="font-semibold text-slate-900">
                          ETB {grossBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                  <span>Total Expenses</span>
                  <span className="font-semibold text-red-600">
                          ETB {totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">Net Balance</span>
                        <span className={`text-base font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isPositive ? `ETB ${formattedNet}` : `-ETB ${formattedNet}`}
                  </span>
                </div>
              </div>

              {/* 6. Income vs Expenses Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-[#F0FDF4] border border-[#DCFCE7] rounded-2xl text-center flex flex-col items-center">
                  <ArrowUpRight className="w-5 h-5 text-emerald-600 mb-1.5" />
                  <div className="text-xs text-slate-500 font-medium">Total Deposits</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                          ETB {grossBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-4 bg-[#FEF2F2] border border-[#FEE2E2] rounded-2xl text-center flex flex-col items-center">
                  <ArrowDownRight className="w-5 h-5 text-red-600 mb-1.5" />
                  <div className="text-xs text-slate-500 font-medium">Total Expenses</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                          ETB {totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* TAB 17: REQUEST MORE COMPANIES (Flutter Parity & Web Grid) */}
          {activeTab === 'Request more companies' && (
            <div className="max-w-4xl space-y-6">
              {/* Header */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Request More Companies</h2>
                <p className="text-xs text-slate-500 mt-0.5">Expand your business ownership to manage multiple corporate entities</p>
              </div>

              {/* 1. Hero Blue Info Card */}
              <div className="bg-gradient-to-br from-[#025EA7] via-[#024A85] to-[#1E60AA] rounded-2xl p-6 text-white shadow-md space-y-3">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 shrink-0">
                    <Building2 className="w-7 h-7 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-white">Multi-Company Ownership Expansion</h3>
                    <p className="text-xs leading-relaxed text-white/90 font-medium max-w-2xl">
                      Request additional company slots to expand your business ownership and manage multiple corporate entities seamlessly under a single account interface.
                    </p>
                    <div className="pt-1">
                      <span className="inline-block px-3.5 py-1 bg-white/15 backdrop-blur-md border border-white/25 rounded-full text-xs font-bold text-white shadow-xs">
                        Current Allowance: {shops.length + warehouses.length > 0 ? 1 : 1} Active Slot
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Company Names Section */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Target Company Names</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {requestCompanyNames.map((name, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Building className="w-4 h-4 text-[#025EA7] absolute left-3.5 top-3" />
                        <input
                          type="text"
                          placeholder="e.g. Gelagle Trading PLC"
                          value={name}
                          onChange={(e) => {
                            const copy = [...requestCompanyNames];
                            copy[idx] = e.target.value;
                            setRequestCompanyNames(copy);
                          }}
                          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#025EA7] outline-none"
                        />
                      </div>
                      {requestCompanyNames.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setRequestCompanyNames(requestCompanyNames.filter((_, i) => i !== idx))}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setRequestCompanyNames([...requestCompanyNames, ''])}
                  className="text-xs font-bold text-[#025EA7] hover:underline flex items-center gap-1.5 pt-1"
                >
                  <Plus className="w-4 h-4" /> Add Another Company Name
                </button>
              </div>

              {/* 3. Select Payment Plan Section (3-Column Web Grid) */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Select Subscription Plan</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {plansList.map((plan) => {
                    const id = plan.id || plan.period || '';
                    const isSelected = selectedPlanId === id;
                    return (
                      <div
                        key={id}
                        onClick={() => setSelectedPlanId(id)}
                        className={`p-5 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between hover:shadow-md ${
                          isSelected
                            ? 'bg-blue-50/70 border-[#025EA7] shadow-sm ring-2 ring-[#025EA7]/20'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                isSelected ? 'border-[#025EA7] bg-[#025EA7]' : 'border-slate-300 bg-white'
                              }`}>
                                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                              <span className="text-sm font-bold text-slate-900 leading-tight">{plan.title}</span>
                            </div>
                          </div>

                          <div className="text-xl font-extrabold text-[#025EA7]">
                            ETB {plan.price}
                          </div>

                          {plan.features && plan.features.length > 0 && (
                            <div className="space-y-2 border-t border-slate-100 pt-3">
                              {plan.features.map((f: string, fIdx: number) => (
                                <div key={fIdx} className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                  <span>{f}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const validNames = requestCompanyNames.map((n) => n.trim()).filter((n) => n.length > 0);
                  if (validNames.length === 0) {
                    showToast('Please enter at least one company name', 'error');
                    return;
                  }
                  if (!selectedPlanId) {
                    showToast('Please select a payment plan', 'error');
                    return;
                  }
                  setIsPaymentModalOpen(true);
                }}
                className="w-full max-w-md py-3.5 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                Submit Company License Request
              </button>
            </div>
          )}

          {/* TAB 18: SETTINGS (Flutter Screen Parity) */}
          {activeTab === 'Settings' && (
            <div className="max-w-4xl space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">{t('settings_profile')}</h2>
                <p className="text-xs text-slate-500">{t('settings_profile')}</p>
              </div>

              {/* 1. Subscription Plan Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center gap-2.5 mb-4 border-b border-slate-100 pb-3">
                  <Tag className="w-5 h-5 text-[#025EA7]" />
                  <h3 className="text-sm font-bold text-slate-900">{t('subscription_plan')}</h3>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-slate-900">
                        {subscriptionPlanTitle || 'No active plan'}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full ${
                          subscriptionStatus === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-700'
                            : subscriptionStatus === 'EXPIRED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {subscriptionStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      {subscriptionExpiresAt
                        ? `Valid until ${new Date(subscriptionExpiresAt).toLocaleDateString()}`
                        : 'Multi-branch inventory, receipts, and staff access'}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsUpgradeOpen(true)}
                    className="py-2 px-4 bg-[#025EA7] hover:bg-[#014883] text-white text-xs font-bold rounded-xl shadow-xs transition-all shrink-0"
                  >
                    {t('renew_upgrade')}
                  </button>
                </div>
              </div>

              {/* 2. Company & Profile Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <Building className="w-5 h-5 text-[#025EA7]" />
                    <h3 className="text-sm font-bold text-slate-900">{t('company_profile')}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (isEditingProfile) {
                        const firstName = profileFirstName.trim();
                        const lastName = profileLastName.trim();
                        const companyName = profileCompanyName.trim();

                        if (!companyName || !firstName || !lastName) {
                          showToast('Please fill in all profile fields', 'error');
                          return;
                        }

                        try {
                          if (profileCompanyId) {
                            await api.updateCompany(profileCompanyId, { name: companyName });
                            api.setSelectedCompany(profileCompanyId, companyName);
                          }
                          await api.updateProfile({ firstName, lastName });
                          updateUser({ firstName, lastName, companyName });
                          showToast('Profile updated successfully!', 'success');
                        setIsEditingProfile(false);
                        } catch (err: any) {
                          showToast(err?.message || 'Failed to update profile', 'error');
                        }
                      } else {
                        setIsEditingProfile(true);
                      }
                    }}
                    className="py-1.5 px-3 bg-blue-50 text-[#025EA7] hover:bg-blue-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    {isEditingProfile ? t('save_profile') : t('edit_profile')}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">{t('company_name')}</label>
                    <input
                      type="text"
                      disabled={!isEditingProfile}
                      value={profileCompanyName}
                      onChange={(e) => setProfileCompanyName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 disabled:opacity-70 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">{t('phone_number')}</label>
                    <input
                      type="text"
                      disabled
                      value={profilePhone}
                      className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 cursor-not-allowed outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">{t('first_name')}</label>
                    <input
                      type="text"
                      disabled={!isEditingProfile}
                      value={profileFirstName}
                      onChange={(e) => setProfileFirstName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 disabled:opacity-70 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">{t('last_name')}</label>
                    <input
                      type="text"
                      disabled={!isEditingProfile}
                      value={profileLastName}
                      onChange={(e) => setProfileLastName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 disabled:opacity-70 outline-none"
                    />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setIsChangePasswordOpen(true)}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4 text-[#025EA7]" /> {t('change_password')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsChangePinOpen(true)}
                    className="py-2.5 px-4 bg-blue-50 hover:bg-blue-100 text-[#025EA7] font-bold rounded-xl text-xs transition-all flex items-center gap-2 border border-blue-200/60"
                  >
                    <KeyRound className="w-4 h-4 text-[#025EA7]" /> Change Security PIN
                  </button>
                </div>
              </div>

              {/* 3. Preferences Section */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-slate-900">Preferences</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Notifications, language and display settings</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {/* Push Notifications */}
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                        <Bell className="w-4.5 h-4.5 text-[#025EA7]" />
                      </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{t('push_notifications')}</div>
                      <div className="text-[11px] text-slate-500">Receive instant alerts for stock levels and credit payments</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPushNotificationsEnabled(!pushNotificationsEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors p-0.5 relative shrink-0 cursor-pointer ${
                        pushNotificationsEnabled ? 'bg-[#025EA7]' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                          pushNotificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                </div>

                  {/* Language */}
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                        <Globe className="w-4.5 h-4.5 text-purple-600" />
                      </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{t('app_language')}</div>
                      <div className="text-[11px] text-slate-500">Select display language for dashboard interface</div>
                      </div>
                    </div>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as 'en' | 'am' | 'om')}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="en">🇬🇧 English (US)</option>
                      <option value="am">🇪🇹 አማርኛ (Amharic)</option>
                      <option value="om">🇪🇹 Afaan Oromoo</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 4. Support & Help Section */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-slate-900">Support & Help</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Report issues, view policies, and manage team access</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {/* Report an Issue */}
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-4.5 h-4.5 text-amber-600" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">Report an Issue</div>
                        <div className="text-[11px] text-slate-500">Submit bugs or suggestions to tech support</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsReportIssueOpen(true)}
                      className="py-2 px-4 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Report Issue
                    </button>
                  </div>

                  {/* Privacy Policy */}
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <Shield className="w-4.5 h-4.5 text-slate-600" />
                      </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{t('privacy_policy')}</div>
                    <div className="text-[11px] text-slate-500">Covers TIN, payment data, and retention guidelines</div>
                      </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPrivacyPolicyOpen(true)}
                      className="py-2 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    View Terms
                  </button>
                </div>

                  {/* Permission/Access */}
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                        <Users className="w-4.5 h-4.5 text-emerald-600" />
                      </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{t('permission_access')}</div>
                    <div className="text-[11px] text-slate-500">Role assignments and fine-grained access control</div>
                      </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('Staff & Access')}
                      className="py-2 px-4 bg-[#025EA7] text-white hover:bg-[#014883] text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    Manage Roster
                  </button>
                  </div>
                </div>
              </div>

              {/* 5. Danger Zone */}
              <div className="bg-white border border-red-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-5 py-4 border-b border-red-100 bg-red-50/50">
                  <h3 className="text-sm font-bold text-red-900">{t('danger_zone')}</h3>
                  <p className="text-[11px] text-red-500 mt-0.5">Irreversible actions — proceed with caution</p>
                </div>
                <div className="px-5 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                      <Trash2 className="w-4.5 h-4.5 text-red-500" />
                    </div>
                <div>
                      <div className="text-xs font-bold text-slate-900">Permanent Account Removal</div>
                      <div className="text-[11px] text-slate-500">Delete your account and all associated company data permanently</div>
                </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Are you sure you want to log out of your account?')) {
                        logout();
                        router.push('/login');
                      }
                    }}
                      className="py-2.5 px-4 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    {t('logout')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDeleteAccountOpen(true)}
                      className="py-2.5 px-4 bg-red-600 text-white font-bold rounded-xl text-xs hover:bg-red-700 transition-all shadow-xs cursor-pointer"
                  >
                    {t('delete_account')}
                  </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── PURCHASES TAB ─── */}
          {activeTab === 'Purchases' && (() => {
            const avgPurchase = purchasesSummary.transactionCount > 0
              ? purchasesSummary.totalPurchasesCost / purchasesSummary.transactionCount
              : 0;

            const exportCsv = () => {
              const rows = [
                ['Date', 'Reference', 'Product', 'SKU', 'Category', 'Branch', 'Qty', 'Unit Cost (ETB)', 'Total Cost (ETB)', 'Supplier', 'Staff'],
                ...purchases.map((p: any) => [
                  new Date(p.createdAt).toLocaleDateString(),
                  p.referenceNumber || '-',
                  p.productName || '-',
                  p.productSku || '-',
                  p.productCategory || '-',
                  p.warehouseName || p.shopName || '-',
                  p.quantity,
                  Number(p.unitCost || 0).toFixed(2),
                  Number(p.totalCost || 0).toFixed(2),
                  p.supplierName || '-',
                  p.performedByName || '-',
                ]),
              ];
              const csv = rows.map(r => r.map(String).map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url;
              a.download = `purchases_${new Date().toISOString().slice(0,10)}.csv`;
              a.click(); URL.revokeObjectURL(url);
            };

            const dateFilters: { key: typeof purchasesDateFilter; label: string }[] = [
              { key: 'all', label: t('all_time') },
              { key: 'today', label: t('today') },
              { key: 'week', label: t('this_week') },
              { key: 'month', label: t('this_month') },
            ];

            return (
              <div className="space-y-6">
                {/* Page Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('purchases')}</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{t('track_purchases')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={exportCsv}
                      className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      {t('export_csv')}
                    </button>
                    <button
                      onClick={() => setIsRecordPurchaseModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-[#025EA7] text-white rounded-xl text-xs font-bold hover:bg-[#014883] shadow-md shadow-blue-900/20 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      {t('record_purchase')}
                    </button>
                  </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    {
                      label: t('total_purchases'),
                      value: `ETB ${purchasesSummary.totalPurchasesCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      icon: DollarSign,
                      color: 'bg-blue-50 text-blue-600',
                      border: 'border-blue-100',
                    },
                    {
                      label: t('units_purchased'),
                      value: purchasesSummary.totalUnitsPurchased.toLocaleString(),
                      icon: Package,
                      color: 'bg-emerald-50 text-emerald-600',
                      border: 'border-emerald-100',
                    },
                    {
                      label: t('purchase_transactions'),
                      value: purchasesSummary.transactionCount.toLocaleString(),
                      icon: FileText,
                      color: 'bg-violet-50 text-violet-600',
                      border: 'border-violet-100',
                    },
                    {
                      label: t('avg_purchase'),
                      value: `ETB ${avgPurchase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      icon: TrendingUp,
                      color: 'bg-amber-50 text-amber-600',
                      border: 'border-amber-100',
                    },
                  ].map((card) => {
                    const Icon = card.icon;
                    return (
                      <div key={card.label} className={`bg-white rounded-2xl p-5 border ${card.border} shadow-sm`}>
                        <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center mb-3`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-medium text-slate-500">{card.label}</p>
                        <p className="text-xl font-extrabold text-slate-900 mt-0.5 tracking-tight">{card.value}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Filters Row */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by product, SKU, reference, supplier..."
                      value={purchasesSearch}
                      onChange={e => { setPurchasesSearch(e.target.value); setPurchasesPage(1); }}
                      className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] transition-all"
                    />
                    {purchasesSearch && (
                      <button onClick={() => setPurchasesSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Date Filter Chips + Location Filter */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      {dateFilters.map(f => (
                        <button
                          key={f.key}
                          onClick={() => { setPurchasesDateFilter(f.key); setPurchasesPage(1); }}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                            purchasesDateFilter === f.key
                              ? 'bg-[#025EA7] text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <select
                      value={purchasesLocationFilter}
                      onChange={e => { setPurchasesLocationFilter(e.target.value); setPurchasesPage(1); }}
                      className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] transition-all cursor-pointer font-medium"
                    >
                      <option value="all">{t('all_locations')}</option>
                      <option value="warehouse">{t('warehouse_only')}</option>
                      <option value="shop">{t('shop_only')}</option>
                      {warehouses.length > 0 && (
                        <optgroup label="Warehouses">
                          {warehouses.map(w => (
                            <option key={w.id} value={`warehouse:${w.id}`}>
                              Warehouse: {w.name} {w.location ? `(${w.location})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {shops.length > 0 && (
                        <optgroup label="Shops">
                          {shops.map(s => (
                            <option key={s.id} value={`shop:${s.id}`}>
                              Shop: {s.name} {s.location ? `(${s.location})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                </div>

                {/* Table / Content */}
                {purchasesLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-[#025EA7] border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-slate-500 font-medium">Loading purchases...</p>
                    </div>
                  </div>
                ) : purchases.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                      <ShoppingBag className="w-8 h-8 text-blue-400" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">{t('no_purchases_found')}</h3>
                    <p className="text-sm text-slate-500 mt-1 text-center max-w-xs">{t('no_purchases_desc')}</p>
                    <button
                      onClick={() => setIsRecordPurchaseModalOpen(true)}
                      className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-[#025EA7] text-white rounded-xl text-xs font-bold hover:bg-[#014883] shadow-md transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      {t('record_purchase')}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                              {[t('date'), t('reference'), t('product_name'), 'SKU', t('category'), t('branch'), t('quantity'), t('unit_cost'), t('total_cost'), t('supplier'), 'Staff', ''].map((h, i) => (
                                <th key={i} className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {purchases.map((p: any, idx: number) => {
                              const branch = p.warehouseName || p.shopName || '—';
                              const branchType = p.warehouseId ? 'warehouse' : 'shop';
                              const totalCost = Number(p.totalCost || 0);
                              const unitCost = Number(p.unitCost || 0);
                              return (
                                <tr
                                  key={p.id || idx}
                                  className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                                  onClick={() => setSelectedPurchaseDetail(p)}
                                >
                                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                                    {new Date(p.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                      {p.referenceNumber || '—'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-xs font-semibold text-slate-900 max-w-[150px] truncate">{p.productName || '—'}</td>
                                  <td className="px-4 py-3 text-[11px] text-slate-500 font-mono">{p.productSku || '—'}</td>
                                  <td className="px-4 py-3">
                                    {p.productCategory ? (
                                      <span className="px-2 py-0.5 bg-violet-50 text-violet-700 text-[10px] font-bold rounded-full">{p.productCategory}</span>
                                    ) : <span className="text-slate-400 text-xs">—</span>}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`w-2 h-2 rounded-full ${branchType === 'warehouse' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                                      <span className="text-xs text-slate-700 font-medium">{branch}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-xs font-bold text-slate-900">{(p.quantity || 0).toLocaleString()}</span>
                                    {p.productUnit && <span className="text-[10px] text-slate-400 ml-1">{p.productUnit}</span>}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-700">ETB {unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="px-4 py-3">
                                    <span className="text-xs font-bold text-[#025EA7]">ETB {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-600">{p.supplierName || '—'}</td>
                                  <td className="px-4 py-3 text-xs text-slate-600">{p.performedByName || '—'}</td>
                                  <td className="px-4 py-3">
                                    <button className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors">
                                      <Eye className="w-3.5 h-3.5 text-slate-400 hover:text-[#025EA7]" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Pagination */}
                    {purchasesTotalPages > 1 && (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          disabled={purchasesPage <= 1}
                          onClick={() => setPurchasesPage(p => Math.max(1, p - 1))}
                          className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          Previous
                        </button>
                        <span className="text-xs text-slate-600 font-medium">Page {purchasesPage} of {purchasesTotalPages}</span>
                        <button
                          disabled={purchasesPage >= purchasesTotalPages}
                          onClick={() => setPurchasesPage(p => Math.min(purchasesTotalPages, p + 1))}
                          className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}

        </main>
      </div>

      {/* Action Modals */}
      {selectedPurchaseDetail && (() => {
        const pd = selectedPurchaseDetail;
        const totalCost = Number(pd.totalCost || 0);
        const unitCost = Number(pd.unitCost || 0);
        const sellingPrice = Number(pd.sellingPrice || 0);
        const margin = sellingPrice > 0 ? ((sellingPrice - unitCost) / sellingPrice * 100) : null;
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedPurchaseDetail(null)}>
            <div
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#025EA7] to-[#0278d4] px-6 py-5 relative">
                <button
                  onClick={() => setSelectedPurchaseDetail(null)}
                  className="absolute right-4 top-4 w-8 h-8 bg-white/20 hover:bg-white/30 text-white rounded-xl flex items-center justify-center transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="pr-10">
                  <p className="text-blue-200 text-[11px] font-semibold uppercase tracking-widest">{t('purchase_details')}</p>
                  <h2 className="text-white text-xl font-extrabold mt-1">{pd.productName || 'Product'}</h2>
                  <p className="text-blue-200 text-xs mt-0.5">{new Date(pd.createdAt).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              {/* Receipt Body */}
              <div className="p-6 space-y-5">
                {/* Summary Row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Quantity', value: `${pd.quantity || 0} ${pd.productUnit || 'units'}`, color: 'bg-slate-50' },
                    { label: t('unit_cost'), value: `ETB ${unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: 'bg-blue-50' },
                    { label: t('total_cost'), value: `ETB ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: 'bg-emerald-50' },
                  ].map(s => (
                    <div key={s.label} className={`${s.color} rounded-2xl p-3 text-center`}>
                      <p className="text-[10px] text-slate-500 font-medium">{s.label}</p>
                      <p className="text-sm font-extrabold text-slate-900 mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Details Grid */}
                <div className="border border-slate-100 rounded-2xl divide-y divide-slate-50 overflow-hidden">
                  {[
                    { label: 'SKU', value: pd.productSku || '—' },
                    { label: t('category'), value: pd.productCategory || '—' },
                    { label: t('reference'), value: pd.referenceNumber || '—', mono: true },
                    { label: t('branch'), value: pd.warehouseName || pd.shopName || '—' },
                    { label: t('supplier'), value: pd.supplierName || '—' },
                    { label: 'Staff', value: pd.performedByName || '—' },
                    ...(sellingPrice > 0 ? [{ label: 'Selling Price', value: `ETB ${sellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }] : []),
                    ...(margin !== null ? [{ label: 'Est. Margin', value: `${margin.toFixed(1)}%` }] : []),
                    { label: pd.reason ? 'Reason' : '', value: pd.reason || '' },
                  ].filter(row => row.label && row.value && row.value !== '—').map(row => (
                    <div key={row.label} className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs text-slate-500 font-medium">{row.label}</span>
                      <span className={`text-xs font-semibold text-slate-800 ${(row as any).mono ? 'font-mono bg-slate-100 px-2 py-0.5 rounded' : ''}`}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedPurchaseDetail(null)}
                    className="flex-1 py-3 border border-slate-200 text-slate-700 rounded-2xl text-sm font-semibold hover:bg-slate-50 transition-all"
                  >
                    {t('close')}
                  </button>
                  <button
                    onClick={() => { exportPurchasesCsv(); setSelectedPurchaseDetail(null); }}
                    className="flex-1 py-3 bg-[#025EA7] text-white rounded-2xl text-sm font-bold hover:bg-[#014883] shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    {t('export_csv')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <ReceiptVerificationModal
        isOpen={activeTab === 'Verify Receipt'}
        onClose={() => setActiveTab('Home')}
      />
      <NewSaleModal isOpen={isNewSaleOpen} onClose={() => setIsNewSaleOpen(false)} onSuccess={loadAllData} />
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => {
          setIsAddProductOpen(false);
          setEditingProduct(null);
          setInitialAddProductLocation(null);
          setAddProductEntryMode(undefined);
        }}
        onSuccess={loadAllData}
        initialLocationId={initialAddProductLocation?.id}
        initialLocationType={initialAddProductLocation?.type}
        initialEntryMode={addProductEntryMode}
        shops={shops}
        warehouses={warehouses}
        product={editingProduct}
      />
      <StaffModal
        isOpen={isStaffOpen}
        onClose={() => setIsStaffOpen(false)}
        onSuccess={loadAllData}
        onOpenPermissions={(newStaff, isNew) => {
          setSelectedPermissionsStaff(newStaff);
          setIsNewStaffCreated(isNew);
          setIsPermissionsOpen(true);
        }}
        shops={shops}
        warehouses={warehouses}
      />
      <EditStaffModal
        isOpen={isEditStaffOpen}
        onClose={() => {
          setIsEditStaffOpen(false);
          setSelectedEditStaff(null);
        }}
        staff={selectedEditStaff}
        shops={shops}
        warehouses={warehouses}
        onSuccess={loadAllData}
      />
      <BranchModal isOpen={isBranchOpen} onClose={() => setIsBranchOpen(false)} onSuccess={loadAllData} />
      <UpgradePlanModal isOpen={isUpgradeOpen} onClose={() => setIsUpgradeOpen(false)} />
      <StoreDetailModal
        isOpen={isStoreDetailOpen}
        onClose={() => {
          setIsStoreDetailOpen(false);
          setSelectedDetailLocation(null);
        }}
        type={selectedDetailLocation?.type || 'warehouse'}
        item={selectedDetailLocation?.item || null}
        catalogProducts={products}
        staffList={staff}
        onRefresh={loadAllData}
        onNavigateToAddProducts={(locationId, locationType, entryMode) => {
          setIsStoreDetailOpen(false);
          setSelectedDetailLocation(null);
          setInitialAddProductLocation({ id: locationId, type: locationType });
          setAddProductEntryMode(entryMode);
          setActiveTab('Products');
          setIsAddProductOpen(true);
        }}
        onEditProduct={(p) => {
          setIsStoreDetailOpen(false);
          setSelectedDetailLocation(null);
          setSelectedProductDetail(null);
          setEditingProduct(p);
          setIsAddProductOpen(true);
        }}
      />
      <RecordCreditPaymentModal
        isOpen={isRecordPaymentOpen}
        onClose={() => {
          setIsRecordPaymentOpen(false);
          setSelectedCreditSale(null);
          setBulkCreditPayment(null);
        }}
        onSuccess={loadAllData}
        saleId={selectedCreditSale?.id}
        sales={bulkCreditPayment?.sales}
        customerName={bulkCreditPayment?.customerName || selectedCreditSale?.customerName}
        invoiceNumber={selectedCreditSale?.invoiceNumber}
        remainingBalance={bulkCreditPayment ? bulkCreditPayment.totalOwed : selectedCreditSale?.remainingBalance}
      />
      <CustomerCreditDetailModal
        isOpen={!!selectedCustomerCreditDetails}
        onClose={() => setSelectedCustomerCreditDetails(null)}
        customerName={selectedCustomerCreditDetails || ''}
        sales={sales}
        onRecordPayment={(sale) => {
          setSelectedCustomerCreditDetails(null);
          setBulkCreditPayment(null);
          setSelectedCreditSale({
            id: sale.id,
            customerName: sale.customerName || selectedCustomerCreditDetails || 'Customer',
            invoiceNumber: sale.invoiceNumber,
            remainingBalance: sale.remainingBalance || sale.totalAmount,
          });
          setIsRecordPaymentOpen(true);
        }}
        onPayAll={(customerName, sales, totalOwed) => {
          setSelectedCustomerCreditDetails(null);
          setBulkCreditPayment({ customerName, sales, totalOwed });
          setIsRecordPaymentOpen(true);
        }}
      />
      <ProductDetailModal
        isOpen={!!selectedProductDetail}
        onClose={() => setSelectedProductDetail(null)}
        product={selectedProductDetail}
        onEdit={() => {
          const p = selectedProductDetail;
          setSelectedProductDetail(null);
          setEditingProduct(p);
          setIsAddProductOpen(true);
        }}
        onDeleted={() => {
          setSelectedProductDetail(null);
          loadAllData();
        }}
      />
      <PermissionsConfigModal
        isOpen={isPermissionsOpen}
        onClose={() => {
          setIsPermissionsOpen(false);
          setSelectedPermissionsStaff(null);
          setIsNewStaffCreated(false);
        }}
        staff={selectedPermissionsStaff}
        isNewStaff={isNewStaffCreated}
        shops={shops}
        warehouses={warehouses}
        onSuccess={loadAllData}
      />
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
      <ChangePinModal
        isOpen={isChangePinOpen}
        onClose={() => setIsChangePinOpen(false)}
      />
      <DeleteAccountModal
        isOpen={isDeleteAccountOpen}
        onClose={() => setIsDeleteAccountOpen(false)}
        user={user}
      />
      <PrivacyPolicyModal
        isOpen={isPrivacyPolicyOpen}
        onClose={() => setIsPrivacyPolicyOpen(false)}
      />
      {deleteLocationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 pb-2 border-b border-rose-100">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center border border-rose-200 shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete {deleteLocationModal.type === 'warehouse' ? 'Warehouse Store' : 'Retail Shop'}?
                </h3>
                <p className="text-xs text-rose-600 font-semibold">Confirmation (No OTP Required)</p>
              </div>
            </div>
            <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-900 font-medium leading-relaxed">
              Are you sure you want to delete <strong>&quot;{deleteLocationModal.name}&quot;</strong>? This confirmation requires <strong>no OTP</strong>. All local storage associations for this facility will be removed.
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleteLocationModal.loading}
                onClick={() => setDeleteLocationModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
              >
                No, Cancel
              </button>
              <button
                type="button"
                disabled={deleteLocationModal.loading}
                onClick={handleConfirmDeleteLocation}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-2"
              >
                {deleteLocationModal.loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {isReportIssueOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#025EA7] flex items-center justify-center font-bold">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Report an Issue / Feedback</h3>
                  <p className="text-xs text-slate-500">Send bug reports or requests to technical support</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReportIssueOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Issue Category</label>
                <select
                  value={issueCategory}
                  onChange={(e) => setIssueCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none"
                >
                  <option value="Bug Report">Bug Report</option>
                  <option value="Feature Request">Feature Request</option>
                  <option value="Payment Issue">Payment Issue</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  placeholder="Brief summary of the issue"
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Detailed Description</label>
                <textarea
                  rows={4}
                  placeholder="Describe what happened or what feature you need..."
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsReportIssueOpen(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingIssue}
                onClick={async () => {
                  if (!issueTitle.trim() || !issueDescription.trim()) {
                    showToast('Please fill in both subject and description', 'error');
                    return;
                  }
                  setIsSubmittingIssue(true);
                  try {
                    await api.submitIssueReport({
                      title: issueTitle.trim(),
                      description: issueDescription.trim(),
                      category: issueCategory,
                      appType: 'web',
                    });
                    showToast('Issue report submitted successfully!', 'success');
                    setIssueTitle('');
                    setIssueDescription('');
                    setIsReportIssueOpen(false);
                  } catch (err: any) {
                    showToast(err?.message || 'Failed to submit issue report', 'error');
                  } finally {
                    setIsSubmittingIssue(false);
                  }
                }}
                className="py-2.5 px-5 bg-[#025EA7] hover:bg-[#014883] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmittingIssue ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
      <RecordBorrowingModal
        isOpen={isRecordBorrowingOpen}
        onClose={() => setIsRecordBorrowingOpen(false)}
        onSuccess={loadAllData}
        catalogProducts={products}
        warehouses={warehouses}
        shops={shops}
      />
      <BorrowingDetailModal
        isOpen={!!selectedBorrowingDetail}
        onClose={() => setSelectedBorrowingDetail(null)}
        borrowing={selectedBorrowingDetail}
        onSuccess={loadAllData}
      />
      <AddBankAccountModal
        isOpen={isAddBankAccModalOpen}
        onClose={() => setIsAddBankAccModalOpen(false)}
        onSuccess={loadAllData}
      />
      <AddBankBalanceModal
        isOpen={isAddBankBalModalOpen}
        onClose={() => setIsAddBankBalModalOpen(false)}
        accounts={bankAccounts}
        onSuccess={loadAllData}
      />
      <AddBankExpenseModal
        isOpen={isAddBankExpModalOpen}
        onClose={() => setIsAddBankExpModalOpen(false)}
        accounts={bankAccounts}
        onSuccess={loadAllData}
      />
      <CommissionConfigModal
        isOpen={isCommissionConfigOpen}
        onClose={() => setIsCommissionConfigOpen(false)}
        products={products}
        staff={staff}
        onSuccess={loadAllData}
      />
      <RecordPurchaseModal
        isOpen={isRecordPurchaseModalOpen}
        onClose={() => setIsRecordPurchaseModalOpen(false)}
        onSuccess={async () => {
          await loadAllData();
          setPurchasesRefreshTrigger((prev) => prev + 1);
        }}
        products={products}
        warehouses={warehouses}
        shops={shops}
      />
      {(() => {
        const selectedPlan = plansList.find((p) => (p.id || p.period) === selectedPlanId);
        const validNames = requestCompanyNames.map((n) => n.trim()).filter((n) => n.length > 0);
        return (
          <ManualPaymentModal
            isOpen={isPaymentModalOpen}
            onClose={() => setIsPaymentModalOpen(false)}
            planTitle={selectedPlan?.title || 'Company License Upgrade'}
            planPrice={selectedPlan?.price || '0'}
            companyNames={validNames}
            planId={selectedPlanId || ''}
            onSuccess={() => {
              setRequestCompanyNames(['']);
              setSelectedPlanId(null);
            }}
          />
        );
      })()}
      <ActivityDetailModal
        isOpen={!!selectedActivityDetail}
        onClose={() => setSelectedActivityDetail(null)}
        activity={selectedActivityDetail}
      />

      {/* Invoice Detail Modal (Business Report) */}
      {selectedInvoiceDetail && (() => {
        const inv = selectedInvoiceDetail;
        const invoiceItems: Array<{ productName: string; quantity: number; unitPrice: number }> = inv.items || [];
        const itemsTotal = invoiceItems.reduce((sum: number, it: any) => sum + (it.quantity || 0) * (it.unitPrice || 0), 0);
        const formattedDate = inv.createdAt
          ? new Date(inv.createdAt).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })
          : 'N/A';
        const statusUpper = (inv.status || 'COMPLETED').toUpperCase();
        const statusColor = statusUpper === 'COMPLETED'
          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
          : statusUpper === 'PARTIALLY_PAID'
            ? 'bg-amber-100 text-amber-700 border-amber-200'
            : 'bg-rose-100 text-rose-700 border-rose-200';
        const paymentLabel = (inv.paymentType || 'cash').toUpperCase().replace('_', ' ');

        return (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">

              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#025EA7] flex items-center justify-center border border-blue-100 shrink-0">
                    <FileText className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Sales Invoice</div>
                    <h3 className="text-base font-bold text-slate-900 leading-tight mt-0.5">
                      Invoice #{inv.invoiceNumber || (inv.id ? inv.id.substring(0, 8) : 'N/A')}
                    </h3>
                  </div>
                </div>
                <button onClick={() => setSelectedInvoiceDetail(null)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Banner */}
              <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500 font-medium">Payment Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${statusColor}`}>
                  {inv.status || 'COMPLETED'}
                </span>
              </div>

              {/* Date */}
              <div className="mb-4 p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs">
                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Transaction Date & Time</div>
                <div className="text-slate-800 font-bold">{formattedDate}</div>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Amount</div>
                  <div className="text-sm font-black text-[#025EA7] mt-0.5">ETB {(inv.totalAmount || 0).toLocaleString()}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Remaining Balance</div>
                  <div className={`text-sm font-black mt-0.5 ${(inv.remainingBalance || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    ETB {(inv.remainingBalance || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2.5 text-xs mb-4">
                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-medium">Customer</span>
                  <span className="font-bold text-slate-800">{inv.customerName || 'Walk-in Customer'}</span>
                </div>
                {inv.customerPhone && (
                  <div className="flex justify-between border-b border-slate-200/60 pb-2">
                    <span className="text-slate-500 font-medium">Phone</span>
                    <span className="font-bold text-slate-800">{inv.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-medium">Payment Method</span>
                  <span className="font-bold text-slate-800">{paymentLabel}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-medium">Sales Person</span>
                  <span className="font-bold text-slate-800">{inv.salesPerson || 'Staff'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-medium">Store / Branch</span>
                  <span className="font-bold text-slate-800">{inv.storeName || 'Main Branch'}</span>
                </div>
                {inv.advancePayment > 0 && (
                  <div className="flex justify-between border-b border-slate-200/60 pb-2">
                    <span className="text-slate-500 font-medium">Advance Payment</span>
                    <span className="font-bold text-emerald-700">ETB {(inv.advancePayment || 0).toLocaleString()}</span>
                  </div>
                )}
                {inv.dueDate && (
                  <div className="flex justify-between border-b border-slate-200/60 pb-2">
                    <span className="text-slate-500 font-medium">Due Date</span>
                    <span className="font-bold text-slate-800">{new Date(inv.dueDate).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Invoice Reference</span>
                  <span className="font-mono text-[11px] font-bold text-slate-600">{inv.id}</span>
                </div>
              </div>

              {/* Items Table */}
              {invoiceItems.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-5">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">Itemized Products</span>
                    <span className="text-[10px] text-slate-500 font-medium">{invoiceItems.length} item(s)</span>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-100">
                        <th className="py-2 px-4">Product</th>
                        <th className="py-2 px-4 text-center">Qty</th>
                        <th className="py-2 px-4 text-right">Price</th>
                        <th className="py-2 px-4 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {invoiceItems.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-semibold text-slate-800">{item.productName || item.product?.name || 'Product'}</td>
                          <td className="py-2.5 px-4 text-center font-bold text-slate-700">{item.quantity}</td>
                          <td className="py-2.5 px-4 text-right text-slate-600">ETB {(item.unitPrice || 0).toLocaleString()}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-[#025EA7]">ETB {((item.quantity || 0) * (item.unitPrice || 0)).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td colSpan={3} className="py-2.5 px-4 text-right text-[11px] font-bold text-slate-600 uppercase">Items Total</td>
                        <td className="py-2.5 px-4 text-right font-extrabold text-[#025EA7] text-sm">ETB {itemsTotal.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {invoiceItems.length === 0 && (
                <div className="mb-5 py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <div className="text-xs font-bold text-slate-500">No itemized product data available</div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Item details may not be included in this report view.</p>
                </div>
              )}

              {/* Footer */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceDetail(null)}
                  className="w-full py-2.5 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-xs transition-all"
                >
                  Close Details
                </button>
              </div>
            </div>
    </div>
  );
      })()}

      {/* ═══════════ IMPORT SALES MODAL ═══════════ */}
      {isImportSalesModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#025EA7] flex items-center justify-center border border-blue-100 shrink-0">
                  <UploadCloud className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Import Center</div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight mt-0.5">
                    Import Sales from CSV or PDF
                  </h3>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportSalesModalOpen(false);
                  setImportFile(null);
                  setImportParsedRecords([]);
                  setImportError(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Information & Format Guide */}
            <div className="mb-4 p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-slate-700 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-bold text-[#025EA7] flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4" />
                  Supported Formats & Auto-Detection
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => downloadSampleSalesTemplate('csv')}
                    className="px-2.5 py-1 bg-white hover:bg-blue-100 text-[#025EA7] border border-blue-200 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> Sample CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadSampleSalesTemplate('xlsx')}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> Sample Excel
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                • <strong>CSV / Excel (.xlsx, .xls)</strong>: Automatically maps headers like <code>Invoice #</code>, <code>Date</code>, <code>Customer</code>, <code>Product/Item</code>, <code>Quantity</code>, <code>Unit Price</code>, <code>Total Amount</code>, <code>Payment Method</code>, and <code>Location</code>.
              </p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                • <strong>PDF Reports / Invoices</strong>: Automatically parses tabular sales rows, invoice numbers, dates, and amounts directly from PDF documents.
              </p>
            </div>

            {/* File Dropzone */}
            <div className="mb-4">
              <label
                htmlFor="sales-file-upload"
                className="border-2 border-dashed border-slate-300 hover:border-[#025EA7] bg-slate-50/60 hover:bg-blue-50/20 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center block"
              >
                <input
                  id="sales-file-upload"
                  type="file"
                  accept=".csv,.tsv,.xlsx,.xls,.pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleImportFileChange(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#025EA7] flex items-center justify-center mb-2">
                  <FileUp className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {importFile ? importFile.name : 'Click to select or drag and drop sales file'}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Supports CSV (.csv), Excel (.xlsx, .xls), or PDF (.pdf) up to 25MB
                </p>
              </label>
            </div>

            {/* Parsing State */}
            {importParsing && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center gap-3 text-xs text-slate-600 mb-4">
                <RefreshCw className="w-4 h-4 animate-spin text-[#025EA7]" />
                <span>Parsing and analyzing sales records...</span>
              </div>
            )}

            {/* Error Message */}
            {importError && (
              <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <div className="font-bold">Failed to Import Records</div>
                  <div className="text-[11px] mt-0.5">{importError}</div>
                </div>
              </div>
            )}

            {/* Parsed Preview */}
            {importParsedRecords.length > 0 && !importParsing && (
              <div className="mb-4 space-y-2">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold">
                      Parsed {importParsedRecords.length} records from {importFile?.name}
                    </span>
                  </div>
                  <span className="font-black">
                    Total: ETB {importParsedRecords.reduce((sum, r) => sum + r.totalAmount, 0).toLocaleString()}
                  </span>
                </div>

                {/* Preview Table (first 6 records) */}
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                      <tr className="text-[9px] uppercase font-bold text-slate-500">
                        <th className="p-2">Invoice #</th>
                        <th className="p-2">Customer</th>
                        <th className="p-2">Product</th>
                        <th className="p-2 text-center">Qty</th>
                        <th className="p-2 text-right">Amount (ETB)</th>
                        <th className="p-2">Payment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importParsedRecords.slice(0, 6).map((r, i) => (
                        <tr key={r.id || i} className="hover:bg-slate-50/50">
                          <td className="p-2 font-mono font-bold text-slate-800">#{r.invoiceNumber}</td>
                          <td className="p-2 text-slate-700 truncate max-w-[120px]">{r.customerName}</td>
                          <td className="p-2 text-slate-600 truncate max-w-[120px]">{r.productName || 'Sale'}</td>
                          <td className="p-2 text-center text-slate-700 font-bold">{r.quantity}</td>
                          <td className="p-2 text-right font-black text-slate-900">ETB {r.totalAmount.toLocaleString()}</td>
                          <td className="p-2 capitalize text-slate-600">{r.paymentType.replace('_', ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importParsedRecords.length > 6 && (
                  <div className="text-[10px] text-slate-400 text-center">
                    + {importParsedRecords.length - 6} more records will be imported
                  </div>
                )}
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsImportSalesModalOpen(false);
                  setImportFile(null);
                  setImportParsedRecords([]);
                  setImportError(null);
                }}
                className="flex-1 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importParsedRecords.length === 0 || importParsing}
                className="flex-1 py-2.5 bg-[#025EA7] hover:bg-[#014883] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                Confirm & Add to Sales Report ({importParsedRecords.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StockTransferTab({
  warehouses,
  shops,
  transfers,
  loadAllData,
  showToast,
  t,
}: {
  warehouses: Warehouse[];
  shops: Shop[];
  transfers: Transfer[];
  loadAllData: () => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  t: (key: string) => string;
}) {
  const [transferFilter, setTransferFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('all');
  const [showCreateTransfer, setShowCreateTransfer] = useState(false);
  const [selectedTransferDetail, setSelectedTransferDetail] = useState<Transfer | null>(null);

  const [tfType, setTfType] = useState<'warehouse_to_shop' | 'shop_to_warehouse'>('warehouse_to_shop');
  const [tfFromId, setTfFromId] = useState('');
  const [tfToId, setTfToId] = useState('');
  const [tfProductId, setTfProductId] = useState('');
  const [tfQuantity, setTfQuantity] = useState<number>(1);
  const [tfNote, setTfNote] = useState('');
  const [tfSourceProducts, setTfSourceProducts] = useState<any[]>([]);
  const [tfLoadingProducts, setTfLoadingProducts] = useState(false);

  const [tfSubmitting, setTfSubmitting] = useState(false);
  const [tfActionPending, setTfActionPending] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    if (!tfFromId) {
      setTfSourceProducts([]);
      setTfProductId('');
      return;
    }
    let isMounted = true;
    setTfLoadingProducts(true);
    const fetchProducts = async () => {
      try {
        const items = tfType === 'warehouse_to_shop'
          ? await api.getWarehouseProducts(tfFromId)
          : await api.getShopProducts(tfFromId);
        if (isMounted) {
          const available = (items || []).filter((p: any) => (p.stockQuantity ?? 0) > 0);
          setTfSourceProducts(available);
          setTfProductId('');
          setTfQuantity(1);
        }
      } catch {
        if (isMounted) setTfSourceProducts([]);
      } finally {
        if (isMounted) setTfLoadingProducts(false);
      }
    };
    fetchProducts();
    return () => { isMounted = false; };
  }, [tfFromId, tfType]);

  const selectedProductInfo = tfSourceProducts.find((p) => p.id === tfProductId);
  const maxAvailableQty = selectedProductInfo ? (selectedProductInfo.stockQuantity ?? 1) : 1;

  const filteredTransfers = transferFilter === 'all'
    ? transfers
    : transfers.filter((t) => t.status.toLowerCase() === transferFilter);

  const statusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'completed' || s === 'approved') return { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' };
    if (s === 'pending') return { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' };
    if (s === 'rejected') return { bg: 'bg-red-100', text: 'text-red-600', dot: 'bg-red-500' };
    return { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tfFromId || !tfToId || !tfProductId || tfQuantity < 1) {
      showToast('Please fill all required fields', 'error');
      return;
    }
    if (tfQuantity > maxAvailableQty) {
      showToast(`Requested quantity exceeds available stock (${maxAvailableQty})`, 'error');
      return;
    }
    setTfSubmitting(true);
    try {
      const payload: any = {
        type: tfType,
        productId: tfProductId,
        quantity: tfQuantity,
        note: tfNote || undefined,
      };
      if (tfType === 'warehouse_to_shop') {
        payload.fromWarehouseId = tfFromId;
        payload.toShopId = tfToId;
      } else {
        payload.fromShopId = tfFromId;
        payload.toWarehouseId = tfToId;
      }

      await api.createTransfer(payload);
      showToast('Stock transfer created successfully!', 'success');
      setShowCreateTransfer(false);
      setTfFromId('');
      setTfToId('');
      setTfProductId('');
      setTfQuantity(1);
      setTfNote('');
      setTfSourceProducts([]);
      await loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create transfer', 'error');
    } finally {
      setTfSubmitting(false);
    }
  };

  const handleApprove = async (transferId: string) => {
    setTfActionPending(true);
    try {
      await api.approveTransfer(transferId);
      showToast('Transfer approved successfully!', 'success');
      setSelectedTransferDetail(null);
      await loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to approve transfer', 'error');
    } finally {
      setTfActionPending(false);
    }
  };

  const handleReject = async (transferId: string) => {
    setTfActionPending(true);
    try {
      await api.rejectTransfer(transferId, rejectReason || undefined);
      showToast('Transfer rejected.', 'success');
      setSelectedTransferDetail(null);
      setShowRejectModal(false);
      setRejectReason('');
      await loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to reject transfer', 'error');
    } finally {
      setTfActionPending(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t('transfer_request')}</h2>
          <p className="text-xs text-slate-500 mt-0.5">Inventory transfer between warehouses and shops</p>
        </div>
        <button
          onClick={() => { setShowCreateTransfer(!showCreateTransfer); setSelectedTransferDetail(null); }}
          className="py-2.5 px-4 bg-[#025EA7] text-white rounded-xl text-xs font-bold hover:bg-[#014883] transition-all flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Transfer
        </button>
      </div>

      {/* Create Transfer Form */}
      {showCreateTransfer && (
        <form onSubmit={handleCreateTransfer} className="mb-6 p-5 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-4 animate-fade-in">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Repeat className="w-4 h-4 text-[#025EA7]" /> Transfer Stock
          </h4>

          {/* Transfer Direction Switch */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-white border border-slate-200 rounded-xl max-w-md">
            <button
              type="button"
              onClick={() => {
                setTfType('warehouse_to_shop');
                setTfFromId('');
                setTfToId('');
              }}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                tfType === 'warehouse_to_shop'
                  ? 'bg-[#025EA7] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Warehouse → Shop
            </button>
            <button
              type="button"
              onClick={() => {
                setTfType('shop_to_warehouse');
                setTfFromId('');
                setTfToId('');
              }}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                tfType === 'shop_to_warehouse'
                  ? 'bg-[#025EA7] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Shop → Warehouse
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {tfType === 'warehouse_to_shop' ? 'Source Warehouse *' : 'Source Shop *'}
              </label>
              <select
                required
                value={tfFromId}
                onChange={(e) => setTfFromId(e.target.value)}
                className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
              >
                <option value="">Select {tfType === 'warehouse_to_shop' ? 'Warehouse' : 'Shop'}...</option>
                {(tfType === 'warehouse_to_shop' ? warehouses : shops).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {tfType === 'warehouse_to_shop' ? 'Destination Shop *' : 'Destination Warehouse *'}
              </label>
              <select
                required
                value={tfToId}
                onChange={(e) => setTfToId(e.target.value)}
                className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
              >
                <option value="">Select {tfType === 'warehouse_to_shop' ? 'Shop' : 'Warehouse'}...</option>
                {(tfType === 'warehouse_to_shop' ? shops : warehouses).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Product *</label>
              {tfLoadingProducts ? (
                <div className="py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-400 font-medium">
                  Loading location products...
                </div>
              ) : (
                <select
                  required
                  disabled={!tfFromId || tfSourceProducts.length === 0}
                  value={tfProductId}
                  onChange={(e) => setTfProductId(e.target.value)}
                  className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">
                    {!tfFromId
                      ? 'Select source location first...'
                      : tfSourceProducts.length === 0
                      ? 'No products in source location'
                      : 'Select Product...'}
                  </option>
                  {tfSourceProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.stockQuantity ?? 0} {p.unit || 'units'})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Quantity *</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTfQuantity(Math.max(1, tfQuantity - 1))}
                  className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-[#025EA7] font-bold text-lg hover:bg-blue-50 transition-all flex items-center justify-center"
                >−</button>
                <input
                  type="number"
                  min="1"
                  max={maxAvailableQty}
                  value={tfQuantity === 0 ? '' : tfQuantity}
                  onChange={(e) => {
                    const str = e.target.value;
                    if (str === '') {
                      setTfQuantity(0);
                      return;
                    }
                    const val = parseInt(str);
                    if (!isNaN(val)) {
                      setTfQuantity(maxAvailableQty > 0 ? Math.min(val, maxAvailableQty) : val);
                    }
                  }}
                  onBlur={() => {
                    if (tfQuantity < 1) setTfQuantity(1);
                  }}
                  className="flex-1 py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setTfQuantity(Math.min(maxAvailableQty, tfQuantity + 1))}
                  className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-[#025EA7] font-bold text-lg hover:bg-blue-50 transition-all flex items-center justify-center"
                >+</button>
              </div>
            </div>
          </div>

          {/* Available Qty Info */}
          {selectedProductInfo && (
            <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
              <span className="text-xs text-slate-500">Available Stock in Source</span>
              <span className="text-sm font-bold text-slate-900">{selectedProductInfo.stockQuantity} {selectedProductInfo.unit || 'units'}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Note (Optional)</label>
            <textarea
              rows={2}
              value={tfNote}
              onChange={(e) => setTfNote(e.target.value)}
              placeholder="Add a note for this transfer..."
              className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowCreateTransfer(false)}
              className="py-2.5 px-4 border border-slate-200 bg-white text-slate-600 rounded-xl text-xs font-semibold"
            >Cancel</button>
            <button
              type="submit"
              disabled={tfSubmitting || !tfProductId || tfQuantity < 1}
              className="py-2.5 px-6 bg-[#025EA7] text-white text-xs font-bold rounded-xl hover:bg-[#014883] shadow-md transition-all disabled:opacity-50"
            >{tfSubmitting ? 'Creating Transfer...' : 'Create Transfer'}</button>
          </div>
        </form>
      )}

      {/* Filter Chips */}
      <div className="flex items-center gap-2 mb-5">
        {(['all', 'pending', 'completed', 'rejected'] as const).map((f) => {
          const isActive = transferFilter === f;
          const count = f === 'all' ? transfers.length : transfers.filter(t => t.status.toLowerCase() === f).length;
          return (
            <button
              key={f}
              onClick={() => setTransferFilter(f)}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#025EA7] text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-slate-900'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Transfer Detail Panel */}
      {selectedTransferDetail && (
        <div className="mb-5 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#025EA7]" /> Transfer Detail
            </h4>
            <button onClick={() => setSelectedTransferDetail(null)} className="text-slate-400 hover:text-slate-600 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Status Banner */}
          {(() => {
            const sc = statusColor(selectedTransferDetail.status);
            return (
              <div className={`p-3.5 ${sc.bg} rounded-xl mb-4 flex items-center gap-3`}>
                <div className={`w-8 h-8 rounded-lg ${sc.bg} flex items-center justify-center`}>
                  {selectedTransferDetail.status.toLowerCase() === 'completed' || selectedTransferDetail.status.toLowerCase() === 'approved'
                    ? <CheckCircle className={`w-5 h-5 ${sc.text}`} />
                    : selectedTransferDetail.status.toLowerCase() === 'rejected'
                      ? <AlertTriangle className={`w-5 h-5 ${sc.text}`} />
                      : <RefreshCw className={`w-5 h-5 ${sc.text}`} />
                  }
                </div>
                <div>
                  <div className={`text-sm font-bold ${sc.text} uppercase`}>{selectedTransferDetail.status}</div>
                  <div className="text-[11px] text-slate-500">{new Date(selectedTransferDetail.date).toLocaleDateString()}</div>
                </div>
              </div>
            );
          })()}

          {/* Info Grid */}
          <div className="space-y-2 mb-4">
            {[
              ['Product', selectedTransferDetail.productName || 'N/A'],
              ['SKU', selectedTransferDetail.productSku || 'N/A'],
              ['Quantity', String(selectedTransferDetail.quantity || selectedTransferDetail.itemsCount)],
              ['From', selectedTransferDetail.sourceWarehouseName],
              ['To', selectedTransferDetail.destinationShopName],
              ['Requested By', selectedTransferDetail.requestedByName || 'Admin'],
              ...(selectedTransferDetail.approvedByName ? [['Approved By', selectedTransferDetail.approvedByName]] : []),
              ...(selectedTransferDetail.note ? [['Note', selectedTransferDetail.note]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-xs text-slate-500">{label}</span>
                <span className="text-xs font-bold text-slate-900">{value}</span>
              </div>
            ))}
          </div>

          {/* Rejection Reason */}
          {selectedTransferDetail.rejectionReason && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl mb-4">
              <div className="text-xs font-bold text-red-600 mb-1">Rejection Reason</div>
              <div className="text-xs text-slate-800">{selectedTransferDetail.rejectionReason}</div>
            </div>
          )}

          {/* Action Buttons for Pending */}
          {selectedTransferDetail.status.toLowerCase() === 'pending' && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleApprove(selectedTransferDetail.id)}
                disabled={tfActionPending}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" /> {tfActionPending ? 'Processing...' : 'Approve Transfer'}
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={tfActionPending}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" /> Reject Transfer
              </button>
            </div>
          )}

          {/* Reject Modal */}
          {showRejectModal && (
            <div className="mt-4 p-4 bg-red-50/80 border border-red-200 rounded-xl space-y-3 animate-fade-in">
              <h5 className="text-xs font-bold text-red-700">Rejection Reason</h5>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                className="w-full py-2 px-3 bg-white border border-red-200 rounded-xl text-xs focus:ring-2 focus:ring-red-400 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                  className="py-2 px-3 border border-slate-200 bg-white text-slate-600 rounded-lg text-xs font-semibold"
                >Cancel</button>
                <button
                  onClick={() => handleReject(selectedTransferDetail.id)}
                  disabled={tfActionPending}
                  className="py-2 px-4 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700"
                >{tfActionPending ? 'Rejecting...' : 'Confirm Reject'}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transfer History List */}
      {filteredTransfers.length === 0 ? (
        <div className="py-16 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <Repeat className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <div className="text-xs font-bold text-slate-500 mb-1">No transfers found</div>
          <p className="text-[11px] text-slate-400">Click &quot;New Transfer&quot; to create a stock transfer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransfers.map((t) => {
            const sc = statusColor(t.status);
            return (
              <div
                key={t.id}
                onClick={() => { setSelectedTransferDetail(t); setShowCreateTransfer(false); }}
                className={`p-4 bg-white border rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group ${
                  selectedTransferDetail?.id === t.id ? 'border-[#025EA7]' : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl ${sc.bg} flex items-center justify-center shrink-0`}>
                    <Repeat className={`w-5 h-5 ${sc.text}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 group-hover:text-[#025EA7] transition-colors">
                      {t.sourceWarehouseName} → {t.destinationShopName}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {t.productName || 'Product'} &nbsp;|&nbsp; Qty: {t.quantity || t.itemsCount}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(t.date).toLocaleDateString()} • {t.transferNumber}
                    </div>
                  </div>

                  <span className={`px-3 py-1.5 ${sc.bg} ${sc.text} text-[10px] font-extrabold rounded-full uppercase shrink-0`}>
                    {t.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
