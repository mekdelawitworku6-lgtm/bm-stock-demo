// BM Stock API Client (Live Backend Integration)
// In portfolio demo mode every request is answered by the local sample dataset.

import { demoRequest } from './demoData';
import { DEMO_MODE, seedDemoAuth } from './demoMode';

if (DEMO_MODE) seedDemoAuth();

const getBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  // If an explicit API URL is configured (and not the production domain), use it
  if (envUrl && !envUrl.includes('possibletechplc.com')) {
    return envUrl;
  }

  // In the browser, use relative path so Next.js rewrites proxy to the local backend
  if (typeof window !== 'undefined') {
    return '/api/v1';
  }

  // Server-side fallback to local backend
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  return `${backendUrl}/api/v1`;
};
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isValidUuid = (id?: string | null): boolean => !!id && UUID_REGEX.test(id.trim());

/** Coerce API decimal/string values to numbers (avoids string concatenation in sums). */
function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

export interface User {
  id: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  companyId?: string;
  companyName?: string;
  role?: string;
  status?: string;
  planId?: string;
  planTitle?: string;
  planAmount?: number;
  planPeriod?: string;
  subscriptionExpiresAt?: string;
  subscriptionStartDate?: string;
  subscriptionNextPaymentDate?: string;
  paymentStatus?: string;
  company?: { id?: string; name?: string };
  hasPin?: boolean;
  employee?: {
    id?: string;
    name?: string;
    jobTitle?: string;
    role?: string;
    permissions?: any;
  } | null;
}

export interface UserProfile extends User {
  company?: { id?: string; name?: string };
}


export interface DashboardStats {
  todaySales: number;
  todayInvoices: number;
  productsCredit: number;
  creditCustomers: number;
  stockRemainderStatus: string;
  expiredCount: number;
}

export interface ActivityItem {
  id: string;
  type: 'sale' | 'stockOut' | 'stockIn' | 'productAdded' | 'transfer' | 'borrowing';
  title: string;
  subtitle: string;
  customerName: string;
  salesPerson: string;
  amount: string;
  storeName: string;
  status: string;
  occurredAt: string;
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  price: number;
  cost?: number;
  costPrice?: number;
  stockQuantity: number;
  minStockLevel?: number;
  category?: string;
  unit?: string;
  expiryDate?: string;
  expirationDate?: string;
  isExpired?: boolean;
  trackStock?: boolean;
  description?: string;
  supplierName?: string;
  supplierId?: string;
  storeName?: string;
  locations?: Array<{ name: string; quantity: number; type: string }>;
  status?: string;
  type?: string;
  reminderDate?: string;
  commissionRate?: number;
  commissionType?: string;
  metadata?: any;
  deletedAt?: string;
  warehouseProducts?: any[];
  shopProducts?: any[];
  warehouseId?: string;
  shopId?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code?: string;
  location?: string;
  managerName?: string;
  totalProducts?: number;
  totalQuantity?: number;
}

export interface Shop {
  id: string;
  name: string;
  location?: string;
  managerName?: string;
  totalProducts?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  totalCredit?: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  companyName?: string;
  address?: string;
}

export interface Borrowing {
  id: string;
  productName: string;
  productCategory?: string;
  productId?: string;
  quantityTaken: number;
  quantityReturned: number;
  remainingQuantity: number;
  sellerName: string;
  sellerPhone?: string;
  dateTaken: string;
  expectedReturnDate?: string;
  note?: string;
  warehouseId?: string;
  warehouseName?: string;
  shopId?: string;
  shopName?: string;
  status: 'active' | 'partially_returned' | 'fully_returned' | string;
  recordedByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Transfer {
  id: string;
  transferNumber: string;
  type?: string;
  sourceWarehouseName: string;
  destinationShopName: string;
  fromWarehouseName?: string;
  fromShopName?: string;
  toWarehouseName?: string;
  toShopName?: string;
  fromWarehouseId?: string;
  fromShopId?: string;
  toWarehouseId?: string;
  toShopId?: string;
  productName?: string;
  productSku?: string;
  productId?: string;
  quantity?: number;
  note?: string;
  rejectionReason?: string;
  requestedById?: string;
  requestedByName?: string;
  approvedById?: string;
  approvedByName?: string;
  status: 'pending' | 'completed' | 'rejected' | 'Pending' | 'Approved' | 'Rejected' | string;
  itemsCount: number;
  date: string;
  createdAt?: string;
}

export interface StaffMember {
  id: string;
  name?: string;
  firstName: string;
  lastName: string;
  phone: string;
  phoneNumber?: string;
  role: string;
  jobTitle?: string;
  email?: string;
  active?: boolean;
  shopId?: string;
  shopName?: string;
  warehouseId?: string;
  warehouseName?: string;
  authMethod?: string;
  assignedPassword?: string;
  assignedPin?: string;
  salesAmount?: number;
  isOwner?: boolean;
  permissions?: {
    modulePermissions?: Record<string, any>;
    branchPermissions?: Record<string, any>;
    [key: string]: any;
  };
  branchPermissions?: Record<string, any>;
  modulePermissions?: Record<string, any>;
}

export interface CommissionItem {
  id: string;
  salespersonName: string;
  productName: string;
  saleAmount: number;
  commissionRate: number;
  commissionAmount: number;
  isApproved?: boolean;
  createdAt?: string;
  commissionDate?: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
  customerName?: string;
  customerPhone?: string;
  invoiceNumber?: string;
  employee?: { id?: string; name?: string; jobTitle?: string; phoneNumber?: string };
  product?: { id?: string; name?: string; sku?: string; price?: number };
  sale?: {
    id?: string;
    invoiceNumber?: string;
    saleDate?: string;
    totalAmount?: number;
    subtotal?: number;
    taxAmount?: number;
    discountAmount?: number;
    paymentType?: string;
    status?: string;
    customer?: { id?: string; name?: string; phoneNumber?: string };
    item?: { quantity?: number; unitPrice?: number; total?: number };
    items?: Array<{ productName?: string; sku?: string; quantity?: number; unitPrice?: number; total?: number }>;
  };
}

export interface Company {
  id: string;
  name: string;
  address?: string;
  phoneNumber?: string;
  status?: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountName?: string;
  accountNumber: string;
  branchName?: string;
  currentBalance?: number;
  initialBalance?: number;
  isPrimary?: boolean;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface SaleRecord {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone?: string;
  salesPerson: string;
  totalAmount: number;
  remainingBalance?: number;
  advancePayment?: number;
  paymentType?: string;
  dueDate?: string;
  storeName: string;
  status: string;
  createdAt: string;
  saleDate?: string;
  items?: Array<{ productName: string; quantity: number; unitPrice: number }>;
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('bm_access_token');
    }
  }

  setToken(token: string | null): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('bm_access_token', token);
      } else {
        localStorage.removeItem('bm_access_token');
        localStorage.removeItem('bm_user');
        localStorage.removeItem('bm_selected_company_id');
        localStorage.removeItem('bm_selected_company_name');
        this.selectedCompanyId = null;
        this.selectedCompanyName = null;
      }
    }
  }

  private selectedCompanyId: string | null = null;
  private selectedCompanyName: string | null = null;

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('bm_access_token');
    }
    return this.token;
  }

  getSelectedCompanyId(): string | null {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('bm_selected_company_id');
      if (stored && !isValidUuid(stored)) {
        localStorage.removeItem('bm_selected_company_id');
        this.selectedCompanyId = null;
      } else if (stored) {
        this.selectedCompanyId = stored;
      }
    }
    return isValidUuid(this.selectedCompanyId) ? this.selectedCompanyId : null;
  }

  getSelectedCompanyName(): string | null {
    if (!this.selectedCompanyName && typeof window !== 'undefined') {
      this.selectedCompanyName = localStorage.getItem('bm_selected_company_name');
    }
    return this.selectedCompanyName;
  }

  setSelectedCompany(companyId: string | null, companyName: string | null): void {
    const validId = isValidUuid(companyId) ? companyId : null;
    this.selectedCompanyId = validId;
    this.selectedCompanyName = companyName;
    if (typeof window !== 'undefined') {
      if (validId) {
        localStorage.setItem('bm_selected_company_id', validId);
      } else {
        localStorage.removeItem('bm_selected_company_id');
      }
      if (companyName) {
        localStorage.setItem('bm_selected_company_name', companyName);
      } else {
        localStorage.removeItem('bm_selected_company_name');
      }
      window.dispatchEvent(new CustomEvent('bm_company_changed', { detail: { companyId: validId, companyName } }));
    }
  }

  private async request(path: string, options: RequestInit = {}) {
    if (DEMO_MODE) {
      return demoRequest(path, options);
    }

    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const companyId = this.getSelectedCompanyId();
    if (companyId && isValidUuid(companyId)) {
      headers['x-company-id'] = companyId;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(`${getBaseUrl()}${path}`, {
        ...options,
        headers,
        signal: options.signal || controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json().catch(() => null);

      if (response.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/')) {
        this.setToken(null);
        window.location.href = '/login';
        throw new Error('Session expired. Please log in again.');
      }

      if (!response.ok) {
        const errMsg = Array.isArray(data?.message)
          ? data.message.join(', ')
          : (data?.message || data?.error || `Request failed with status ${response.status}`);
        throw new Error(errMsg);
      }

      return data?.data !== undefined ? data.data : data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Server connection timed out. Please check if backend server is running.');
      }
      if (process.env.NODE_ENV === 'development' && !['/suppliers', '/borrowings', '/commissions', '/users'].includes(path)) {
        console.warn(`API request to ${path} failed:`, err.message);
      }
      throw err;
    }
  }

  // Auth Methods
  async checkStaffAuthMethod(phone: string): Promise<{ authMethod: 'password' | 'pin' }> {
    const res = await this.request(`/auth/staff-auth-method?phone=${encodeURIComponent(phone)}`);
    return { authMethod: res?.authMethod === 'pin' ? 'pin' : 'password' };
  }

  async login(phone: string, passwordOrPin: string): Promise<{ user: User; accessToken: string }> {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: phone, password: passwordOrPin }),
    });
    if (data?.accessToken) {
      this.setToken(data.accessToken);
    }
    return {
      user: data.user || { id: 'u-1', phone, firstName: 'User', lastName: 'Admin', companyName: 'BM Stock' },
      accessToken: data?.accessToken || '',
    };
  }

  async staffFirstLogin(payload: { companyName: string; companyPassword?: string; pin: string; phone?: string }): Promise<{ user: User; accessToken: string }> {
    const data = await this.request('/auth/staff-first-login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data?.accessToken) {
      this.setToken(data.accessToken);
    }
    return {
      user: data.user,
      accessToken: data?.accessToken || '',
    };
  }

  async cadminFirstLogin(payload: { email: string; password: string; pin?: string }): Promise<{ user: User; accessToken: string }> {
    const data = await this.request('/auth/cadmin-first-login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data?.accessToken) {
      this.setToken(data.accessToken);
    }
    return {
      user: data.user,
      accessToken: data?.accessToken || '',
    };
  }

  async pinUnlock(payload: { role: 'admin' | 'staff'; accountId: string; pin: string }): Promise<{ user: User; accessToken: string }> {
    const data = await this.request('/auth/pin-unlock', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data?.accessToken) {
      this.setToken(data.accessToken);
    }
    return {
      user: data.user,
      accessToken: data?.accessToken || '',
    };
  }

  async changeAdminPin(payload: { currentPassword: string; newPin: string }): Promise<{ success: boolean; message: string }> {
    return this.request('/auth/change-admin-pin', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async setAdminPin(pin: string): Promise<{ success: boolean; message: string }> {
    return this.request('/auth/set-admin-pin', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
  }

  async register(payload: {
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
    planId?: string;
    planTitle?: string;
    planAmount?: number;
    planPeriod?: string;
    paymentMethod?: string;
    paymentRef?: string;
    paymentScreenshot?: string;
    receiptVerified?: boolean;
    receiptUrl?: string;
  }): Promise<{ user: User; accessToken: string }> {
    const cleanPayload: Record<string, any> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== null && value !== '') {
        cleanPayload[key] = value;
      }
    }
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(cleanPayload),
    });
    if (data?.accessToken) {
      this.setToken(data.accessToken);
    }
    return {
      user: data.user || { id: 'u-new', phone: payload.phone, firstName: payload.firstName, lastName: payload.lastName },
      accessToken: data?.accessToken || '',
    };
  }

  async sendOtp(phone: string): Promise<{ success: boolean; verificationId?: string; code?: string; smsError?: string }> {
    const res = await this.request('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
    return {
      success: true,
      verificationId: res?.verificationId,
      code: res?.code,
      smsError: res?.smsError,
    };
  }

  async verifyOtp(phone: string, code: string): Promise<boolean> {
    const res = await this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    });
    return res?.verified === true;
  }

  async checkPhone(phone: string): Promise<void> {
    await this.request('/auth/check-phone', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async checkRegistration(phone: string, email?: string): Promise<void> {
    await this.request('/auth/check-registration', {
      method: 'POST',
      body: JSON.stringify({ phone, ...(email ? { email } : {}) }),
    });
  }


  async renewalPreview(phone: string): Promise<{ subscriptionExpired: boolean; canRenew: boolean; numCompanies: number }> {
    try {
      const data = await this.request(`/auth/renewal-preview?phone=${encodeURIComponent(phone)}`);
      if (data && typeof data === 'object') {
        return {
          subscriptionExpired: data.subscriptionExpired === true,
          canRenew: data.canRenew === true,
          numCompanies: (data.numCompanies as number) || 1,
        };
      }
      return { subscriptionExpired: false, canRenew: false, numCompanies: 1 };
    } catch {
      return { subscriptionExpired: false, canRenew: false, numCompanies: 1 };
    }
  }

  async resetPassword(phone: string, code: string, newPassword: string): Promise<void> {
    await this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ phone, code, newPassword }),
    });
  }

  private extractList(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.data?.data)) return data.data.data;
    if (Array.isArray(data?.data?.items)) return data.data.items;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  }

  // Dashboard & Reports
  async getReportAnalytics(params: { period?: string; locationId?: string; locationType?: string; from?: string; to?: string } = {}): Promise<any> {
    try {
      const queryParams = new URLSearchParams();
      if (params.period) queryParams.set('period', params.period);
      if (params.locationId) queryParams.set('locationId', params.locationId);
      if (params.locationType) queryParams.set('locationType', params.locationType);
      if (params.from) queryParams.set('from', params.from);
      if (params.to) queryParams.set('to', params.to);
      const query = queryParams.toString();
      return await this.request(`/sales/reports/analytics${query ? `?${query}` : ''}`);
    } catch {
      return null;
    }
  }

  async getStockTransactions(type?: string, limit = 100): Promise<any[]> {
    try {
      const queryParams = new URLSearchParams({ limit: String(limit) });
      if (type) queryParams.set('type', type);
      const data = await this.request(`/inventory/transactions?${queryParams.toString()}`);
      return this.extractList(data);
    } catch {
      return [];
    }
  }

  async getPurchases(params: {
    search?: string;
    warehouseId?: string;
    shopId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    summary: { totalPurchasesCost: number; totalUnitsPurchased: number; transactionCount: number };
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (params.search) queryParams.set('search', params.search);
      if (params.warehouseId) queryParams.set('warehouseId', params.warehouseId);
      if (params.shopId) queryParams.set('shopId', params.shopId);
      if (params.startDate) queryParams.set('startDate', params.startDate);
      if (params.endDate) queryParams.set('endDate', params.endDate);
      if (params.page) queryParams.set('page', String(params.page));
      if (params.limit) queryParams.set('limit', String(params.limit));
      const query = queryParams.toString();
      const data = await this.request(`/inventory/purchases${query ? `?${query}` : ''}`);
      return {
        data: Array.isArray(data?.data) ? data.data : [],
        total: data?.total || 0,
        page: data?.page || 1,
        limit: data?.limit || 20,
        totalPages: data?.totalPages || 1,
        summary: {
          totalPurchasesCost: toNumber(data?.summary?.totalPurchasesCost),
          totalUnitsPurchased: toNumber(data?.summary?.totalUnitsPurchased),
          transactionCount: toNumber(data?.summary?.transactionCount),
        },
      };
    } catch {
      return {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
        summary: { totalPurchasesCost: 0, totalUnitsPurchased: 0, transactionCount: 0 },
      };
    }
  }

  async getDashboardSummary(): Promise<DashboardStats> {
    try {
      const data = await this.request('/reports/dashboard/summary');
      return {
        todaySales: toNumber(data?.sales?.totalRevenue),
        todayInvoices: toNumber(data?.sales?.totalSales),
        productsCredit: toNumber(data?.sales?.totalCredit),
        creditCustomers: toNumber(data?.sales?.creditCustomers),
        stockRemainderStatus: data?.inventory?.lowStockItems > 0 ? 'Low Stock Warning' : 'Good',
        expiredCount: toNumber(data?.inventory?.expiredItems),
      };
    } catch {
      return {
        todaySales: 0,
        todayInvoices: 0,
        productsCredit: 0,
        creditCustomers: 0,
        stockRemainderStatus: 'Good',
        expiredCount: 0,
      };
    }
  }

  async getRecentActivities(): Promise<ActivityItem[]> {
    const activities: ActivityItem[] = [];

    // 1. Sales
    try {
      const salesData = await this.request('/sales');
      const salesList = this.extractList(salesData);
      salesList.forEach((sale: any, idx: number) => {
        const prodTitle = sale.items?.[0]?.productName || sale.items?.[0]?.product?.name || 'Sale Invoice';
        activities.push({
          id: sale.id || `sale-${idx}`,
          type: 'sale',
          title: `Sale: ${prodTitle}`,
          subtitle: `Invoice #${sale.invoiceNumber || sale.id?.substring(0, 8)}`,
          customerName: sale.customer?.name || sale.customerName || 'Walk-in Customer',
          salesPerson: sale.salesPerson || sale.user?.firstName || 'Sales Staff',
          amount: `ETB ${(sale.totalAmount || 0).toLocaleString()}`,
          storeName: sale.warehouse?.name || sale.shop?.name || sale.storeName || 'Main Branch',
          status: sale.status === 'cancelled' ? 'Cancelled' : sale.status === 'pending' ? 'Pending' : 'Paid',
          occurredAt: sale.createdAt || sale.saleDate || new Date().toISOString(),
        });
      });
    } catch (_) {}

    // 2. Added Products (Catalog Stock In)
    try {
      const prodsData = await this.request('/products');
      const prodsList = this.extractList(prodsData);
      prodsList.forEach((prod: any, idx: number) => {
        activities.push({
          id: `prod-${prod.id || idx}`,
          type: 'productAdded',
          title: `Product Added: ${prod.name}`,
          subtitle: `SKU: ${prod.sku || 'N/A'} • Category: ${prod.category || 'General'}`,
          customerName: 'Catalog Entry',
          salesPerson: 'Store Manager',
          amount: `+${prod.stockQuantity || 0} ${prod.unit || 'piece'}`,
          storeName: prod.warehouse?.name || 'Main Warehouse',
          status: 'In Stock',
          occurredAt: prod.createdAt || new Date().toISOString(),
        });
      });
    } catch (_) {}

    // 3. Stock Transfers / Movement
    try {
      const transData = await this.request('/transfers');
      const transList = this.extractList(transData);
      transList.forEach((t: any, idx: number) => {
        const isStockOut = t.type === 'stock_out' || t.sourceWarehouseName;
        activities.push({
          id: `trans-${t.id || idx}`,
          type: isStockOut ? 'stockOut' : 'stockIn',
          title: isStockOut ? `Stock Out: ${t.itemsCount || 1} item(s)` : `Stock In: ${t.itemsCount || 1} item(s)`,
          subtitle: `${t.sourceWarehouseName || 'Warehouse'} → ${t.destinationShopName || 'Shop'}`,
          customerName: 'Stock Transfer',
          salesPerson: t.requestedBy || 'Inventory Staff',
          amount: `${isStockOut ? '-' : '+'}${t.itemsCount || 1} units`,
          storeName: t.sourceWarehouseName || 'Storage Depot',
          status: t.status === 'approved' ? 'Completed' : 'Pending',
          occurredAt: t.createdAt || t.date || new Date().toISOString(),
        });
      });
    } catch (_) {}

    // 4. Inventory Adjustments (Stock In / Stock Out transactions)
    try {
      const invData = await this.request('/inventory/transactions');
      const invList = this.extractList(invData);
      invList.forEach((tx: any, idx: number) => {
        const isOut = tx.type === 'stock_out' || tx.type === 'sale' || tx.type === 'transfer_out';
        activities.push({
          id: `inv-${tx.id || idx}`,
          type: isOut ? 'stockOut' : 'stockIn',
          title: isOut ? `Stock Out: ${tx.productName || 'Product'}` : `Stock In: ${tx.productName || 'Product'}`,
          subtitle: `Qty: ${tx.quantity} • ${tx.reason || 'Adjustment'} • ${tx.warehouseName || tx.shopName || 'Location'}`,
          customerName: tx.performedByName || 'Inventory Staff',
          salesPerson: tx.performedByName || 'Staff',
          amount: `${isOut ? '-' : '+'}${tx.quantity} units`,
          storeName: tx.warehouseName || tx.shopName || 'Main Branch',
          status: 'Completed',
          occurredAt: tx.createdAt || new Date().toISOString(),
        });
      });
    } catch (_) {}

    // 5. Product Borrowings
    try {
      const borrsData = await this.request('/borrowings');
      const borrsList = this.extractList(borrsData);
      borrsList.forEach((b: any, idx: number) => {
        const prodName = b.product?.name || b.productName || 'Borrowed Item';
        const seller = b.sellerName || 'Partner Seller';
        const taken = b.quantityTaken ?? b.quantity ?? 1;
        activities.push({
          id: `borr-${b.id || idx}`,
          type: 'borrowing',
          title: `Borrowed: ${prodName}`,
          subtitle: `Taken from ${seller}${b.note ? ` • ${b.note}` : ''}`,
          customerName: b.recordedByName || 'Borrowing Staff',
          salesPerson: seller,
          amount: `-${taken} units`,
          storeName: b.warehouse?.name || b.shop?.name || b.warehouseName || b.shopName || 'Receiving Location',
          status: b.status === 'fully_returned' ? 'Fully Returned' : b.status === 'partially_returned' ? 'Partially Returned' : 'Active Borrowing',
          occurredAt: b.dateTaken || b.createdAt || new Date().toISOString(),
        });
      });
    } catch (_) {}

    // Sort descending by occurredAt
    activities.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    return activities.slice(0, 15);
  }

  // Sales
  async getSales(): Promise<SaleRecord[]> {
    try {
      const data = await this.request('/sales');
      const list = this.extractList(data);
      return list.map((s: any) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber || s.id?.substring(0, 8),
        customerName: s.customer?.name || s.customerName || 'Walk-in Customer',
        customerPhone: s.customer?.phoneNumber || s.customerPhone,
        salesPerson: s.salespersonName || s.salesPerson?.firstName || 'Staff',
        totalAmount: toNumber(s.totalAmount),
        remainingBalance: s.remainingBalance !== undefined
          ? toNumber(s.remainingBalance)
          : (s.paymentType === 'credit' ? toNumber(s.totalAmount) : 0),
        advancePayment: toNumber(s.advancePayment),
        paymentType: s.paymentType,
        dueDate: s.dueDate,
        storeName: s.warehouseName || s.shopName || s.warehouse?.name || s.shop?.name || 'Main Branch',
        status: s.status || 'Paid',
        createdAt: s.createdAt || s.saleDate || new Date().toISOString(),
        items: s.items || [],
      }));
    } catch {
      return [];
    }
  }

  async createSale(payload: any): Promise<SaleRecord> {
    const cleanPayload: Record<string, any> = {
      items: (payload.items || []).map((it: any) => ({
        productId: it.productId,
        quantity: parseInt(it.quantity) || 1,
        unitPrice: parseFloat(it.unitPrice) || 0,
      })),
      paymentType: payload.paymentType || 'cash',
    };
    if (payload.customerId) cleanPayload.customerId = payload.customerId;
    if (payload.warehouseId) cleanPayload.warehouseId = payload.warehouseId;
    if (payload.shopId) cleanPayload.shopId = payload.shopId;
    if (payload.referenceNumber) cleanPayload.referenceNumber = payload.referenceNumber;
    if (payload.receiptImageUrl) cleanPayload.receiptImageUrl = payload.receiptImageUrl;
    if (payload.advancePayment !== undefined && payload.advancePayment !== '') cleanPayload.advancePayment = parseFloat(payload.advancePayment);
    if (payload.dueDate) cleanPayload.dueDate = payload.dueDate;
    if (payload.reminderDate) cleanPayload.reminderDate = payload.reminderDate;
    if (payload.discountType && payload.discountType !== 'none') cleanPayload.discountType = payload.discountType;
    if (payload.discountRate) cleanPayload.discountRate = parseFloat(payload.discountRate);
    if (payload.note) cleanPayload.note = payload.note;

    return this.request('/sales', {
      method: 'POST',
      body: JSON.stringify(cleanPayload),
    });
  }

  async recordSalePayment(saleId: string, payload: { amount: number; paymentMethod?: string; notes?: string }): Promise<any> {
    return this.request(`/sales/${saleId}/payment`, {
      method: 'POST',
      body: JSON.stringify({
        saleId,
        amount: payload.amount,
        paymentMethod: payload.paymentMethod || 'cash',
        transactionType: 'sale',
        notes: payload.notes || undefined,
      }),
    });
  }

  async getSalePaymentHistory(saleId: string): Promise<any[]> {
    try {
      const data = await this.request(`/sales/${saleId}/payment-history`);
      return this.extractList(data);
    } catch {
      return [];
    }
  }

  // Products
  async getProducts(limit = 500): Promise<Product[]> {
    try {
      const data = await this.request(`/products?limit=${limit}`);
      const list = this.extractList(data);
      return list.map((p: any) => {
        const locations = Array.isArray(p.locations) && p.locations.length > 0
          ? p.locations.map((l: any) => ({
              ...l,
              id: l.id || l.warehouseId || l.shopId,
              name: l.name || 'Location',
              quantity: l.quantity ?? l.stockQuantity ?? 0,
              type: l.type || 'Warehouse',
            }))
          : [
              ...(p.warehouseProducts || []).map((wp: any) => ({
                id: wp.warehouseId || wp.warehouse?.id,
                name: wp.warehouse?.name || 'Warehouse',
                quantity: wp.stockQuantity || wp.quantity || 0,
                type: 'Warehouse',
              })),
              ...(p.shopProducts || []).map((sp: any) => ({
                id: sp.shopId || sp.shop?.id,
                name: sp.shop?.name || 'Shop',
                quantity: sp.stockQuantity || sp.quantity || 0,
                type: 'Shop',
              })),
            ];

        const computedStoreName = locations.length > 0
          ? locations.map((l: any) => l.name).join(', ')
          : (p.warehouseName || p.shopName || p.warehouse?.name || p.shop?.name || undefined);

        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          price: p.price || p.sellingPrice || 0,
          cost: p.cost ?? p.costPrice ?? p.purchasePrice ?? 0,
          costPrice: p.costPrice || p.cost || p.purchasePrice || 0,
          stockQuantity: p.stockQuantity ?? (locations.length > 0 ? locations.reduce((s: number, l: any) => s + (l.quantity || 0), 0) : 0),
          minStockLevel: p.minStockLevel,
          category: p.category,
          unit: p.unit,
          type: p.type,
          expiryDate: p.expiryDate,
          reminderDate: p.reminderDate,
          trackStock: p.trackStock,
          description: p.description,
          status: p.status,
          commissionRate: p.commissionRate,
          commissionType: p.commissionType,
          metadata: p.metadata,
          supplierId: p.supplierId || p.supplier?.id,
          supplierName: p.supplier?.name || p.supplierName,
          storeName: computedStoreName,
          locations,
          warehouseId: p.warehouseId || p.warehouse?.id,
          shopId: p.shopId || p.shop?.id,
          warehouseProducts: p.warehouseProducts,
          shopProducts: p.shopProducts,
        };
      });
    } catch {
      return [];
    }
  }

  async getProductLocations(productId: string): Promise<{ warehouses: any[]; shops: any[] }> {
    try {
      const data = await this.request(`/products/${productId}/locations`);
      return data || { warehouses: [], shops: [] };
    } catch {
      return { warehouses: [], shops: [] };
    }
  }

  async createProduct(payload: any): Promise<Product> {
    const cleanPayload: Record<string, any> = {
      type: payload.type || 'product',
      name: payload.name,
      category: payload.category?.trim() ? payload.category.trim() : undefined,
      unit: payload.unit || 'piece',
      price: parseFloat(payload.price) || 0,
      trackStock: payload.trackStock !== false,
    };
    if (payload.sku) cleanPayload.sku = payload.sku;
    if (payload.barcode) cleanPayload.barcode = payload.barcode;
    if (payload.description) cleanPayload.description = payload.description;
    cleanPayload.cost = (payload.cost !== undefined && payload.cost !== '' && !isNaN(parseFloat(payload.cost))) ? parseFloat(payload.cost) : 0;
    if (payload.stockQuantity !== undefined && payload.stockQuantity !== '') cleanPayload.stockQuantity = parseInt(payload.stockQuantity);
    if (payload.minStockLevel !== undefined && payload.minStockLevel !== '') cleanPayload.minStockLevel = parseInt(payload.minStockLevel);
    if (payload.commissionRate !== undefined && payload.commissionRate !== '') cleanPayload.commissionRate = parseFloat(payload.commissionRate);
    if (payload.commissionType !== undefined && payload.commissionType !== '') cleanPayload.commissionType = payload.commissionType;
    if (payload.expiryDate) cleanPayload.expiryDate = payload.expiryDate;
    if (payload.reminderDate) cleanPayload.reminderDate = payload.reminderDate;
    if (payload.status) cleanPayload.status = payload.status;
    if (payload.warehouseIds && payload.warehouseIds.length > 0) cleanPayload.warehouseIds = payload.warehouseIds;
    if (payload.warehouseId) {
      cleanPayload.warehouseId = payload.warehouseId;
      if (!cleanPayload.warehouseIds) cleanPayload.warehouseIds = [payload.warehouseId];
    }
    if (payload.shopIds && payload.shopIds.length > 0) cleanPayload.shopIds = payload.shopIds;
    if (payload.shopId) {
      cleanPayload.shopId = payload.shopId;
      if (!cleanPayload.shopIds) cleanPayload.shopIds = [payload.shopId];
    }
    if (payload.supplierId) cleanPayload.supplierId = payload.supplierId;

    const metadata: Record<string, any> = {};
    if (payload.brand) metadata.brand = payload.brand;
    if (payload.wholesale) metadata.wholesale = parseFloat(payload.wholesale);
    if (payload.discount) metadata.discount = parseFloat(payload.discount);
    if (payload.discountType) metadata.discountType = payload.discountType;
    if (Object.keys(metadata).length > 0) cleanPayload.metadata = metadata;

    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(cleanPayload),
    });
  }

  async updateProduct(id: string, payload: any): Promise<Product> {
    const cleanPayload: Record<string, any> = {
      type: payload.type || 'product',
      name: payload.name,
      category: payload.category?.trim() ? payload.category.trim() : undefined,
      unit: payload.unit || 'piece',
      price: parseFloat(payload.price) || 0,
      trackStock: payload.trackStock !== false,
    };
    if (payload.sku) cleanPayload.sku = payload.sku;
    if (payload.barcode !== undefined) cleanPayload.barcode = payload.barcode;
    if (payload.description !== undefined) cleanPayload.description = payload.description;
    cleanPayload.cost = (payload.cost !== undefined && payload.cost !== '' && !isNaN(parseFloat(payload.cost))) ? parseFloat(payload.cost) : 0;
    if (payload.stockQuantity !== undefined && payload.stockQuantity !== '') cleanPayload.stockQuantity = parseInt(payload.stockQuantity);
    if (payload.minStockLevel !== undefined && payload.minStockLevel !== '') cleanPayload.minStockLevel = parseInt(payload.minStockLevel);
    if (payload.commissionRate !== undefined && payload.commissionRate !== '') cleanPayload.commissionRate = parseFloat(payload.commissionRate);
    if (payload.commissionType !== undefined && payload.commissionType !== '') cleanPayload.commissionType = payload.commissionType;
    if (payload.expiryDate) cleanPayload.expiryDate = payload.expiryDate;
    if (payload.reminderDate) cleanPayload.reminderDate = payload.reminderDate;
    if (payload.status) cleanPayload.status = payload.status;
    if (payload.supplierId) cleanPayload.supplierId = payload.supplierId;

    const metadata: Record<string, any> = {};
    if (payload.brand !== undefined) metadata.brand = payload.brand;
    if (payload.wholesale !== undefined && payload.wholesale !== '') metadata.wholesale = parseFloat(payload.wholesale);
    if (payload.discount !== undefined && payload.discount !== '') metadata.discount = parseFloat(payload.discount);
    if (payload.discountType) metadata.discountType = payload.discountType;
    if (Object.keys(metadata).length > 0) cleanPayload.metadata = metadata;

    return this.request(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(cleanPayload),
    });
  }

  async deleteProduct(id: string): Promise<any> {
    return this.request(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  // Warehouses
  async getWarehouses(limit = 500): Promise<Warehouse[]> {
    try {
      const data = await this.request(`/warehouses?limit=${limit}`);
      const list = this.extractList(data);
      return list.map((w: any) => ({
        id: w.id,
        name: w.name,
        code: w.code,
        location: w.location || w.address,
        managerName: w.manager?.firstName || w.managerName,
        totalProducts: w.totalProducts || 0,
        totalQuantity: w.totalQuantity || 0,
      }));
    } catch {
      return [];
    }
  }

  async createWarehouse(payload: any): Promise<Warehouse> {
    return this.request('/warehouses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async deleteWarehouse(id: string): Promise<any> {
    return this.request(`/warehouses/${id}`, {
      method: 'DELETE',
    });
  }

  // Shops
  async getShops(limit = 500): Promise<Shop[]> {
    try {
      const data = await this.request(`/shops?limit=${limit}`);
      const list = this.extractList(data);
      return list.map((s: any) => ({
        id: s.id,
        name: s.name || s.shopName || s.title || 'Retail Shop',
        location: s.location || s.address,
        managerName: s.manager?.firstName || s.managerName,
        totalProducts: s.totalProducts || 0,
      }));
    } catch {
      return [];
    }
  }

  async createShop(payload: any): Promise<Shop> {
    return this.request('/shops', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async deleteShop(id: string): Promise<any> {
    return this.request(`/shops/${id}`, {
      method: 'DELETE',
    });
  }

  // Customers
  async getCustomers(): Promise<Customer[]> {
    try {
      const data = await this.request('/customers');
      const list = this.extractList(data);
      return list.map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        totalCredit: toNumber(c.totalCredit),
      }));
    } catch {
      return [];
    }
  }

  async createCustomer(payload: any): Promise<Customer> {
    const cleanPayload: Record<string, any> = {
      name: payload.name,
      phoneNumber: payload.phoneNumber || payload.phone || undefined,
      address: payload.address || undefined,
    };
    if (cleanPayload.phoneNumber) {
      let p = String(cleanPayload.phoneNumber).trim().replace(/\s+/g, '');
      if (p.startsWith('+251')) p = '0' + p.substring(4);
      if (p.startsWith('251')) p = '0' + p.substring(3);
      cleanPayload.phoneNumber = p;
    }
    return this.request('/customers', {
      method: 'POST',
      body: JSON.stringify(cleanPayload),
    });
  }

  async updateStaffPermissions(staffId: string, payload: { modulePermissions?: Record<string, string>; branchPermissions?: Record<string, any> }): Promise<any> {
    try {
      return await this.request(`/employees/${staffId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch {
      return await this.request(`/users/${staffId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    }
  }

  // Suppliers
  async getSuppliers(): Promise<Supplier[]> {
    try {
      const data = await this.request('/collections/suppliers');
      const list = this.extractList(data);
      return list.map((sp: any) => ({
        id: sp.id,
        name: sp.name,
        phone: sp.phone || sp.contact,
        email: sp.email,
        companyName: sp.companyName,
        address: sp.address,
      }));
    } catch {
      return [];
    }
  }

  async createSupplier(payload: { name: string; contact?: string; email?: string; address?: string }): Promise<Supplier> {
    const data = await this.request('/collections/supplier', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        contact: payload.contact || '0000000000',
        ...(payload.email ? { email: payload.email } : {}),
        ...(payload.address ? { address: payload.address } : {}),
      }),
    });
    return {
      id: (data as any).id,
      name: (data as any).name,
      phone: (data as any).phone || (data as any).contact,
      email: (data as any).email,
      companyName: (data as any).companyName,
      address: (data as any).address,
    };
  }

  // Borrowings
  async getBorrowings(): Promise<Borrowing[]> {
    try {
      const data = await this.request('/borrowings');
      const list = this.extractList(data);
      return list.map((b: any) => {
        const taken = b.quantityTaken ?? b.quantity ?? 1;
        const returned = b.quantityReturned ?? 0;
        const remaining = b.remainingQuantity ?? Math.max(0, taken - returned);
        return {
          id: b.id,
          productName: b.product?.name || b.productName || 'Item',
          productCategory: b.productCategory || b.product?.category,
          productId: b.productId || b.product?.id,
          quantityTaken: taken,
          quantityReturned: returned,
          remainingQuantity: remaining,
          sellerName: b.sellerName || b.borrowerName || b.borrower || 'Partner',
          sellerPhone: b.sellerPhone,
          dateTaken: b.dateTaken || b.createdAt || new Date().toISOString(),
          expectedReturnDate: b.expectedReturnDate,
          note: b.note,
          warehouseId: b.warehouseId || b.warehouse?.id,
          warehouseName: b.warehouseName || b.warehouse?.name,
          shopId: b.shopId || b.shop?.id,
          shopName: b.shopName || b.shop?.name,
          status: b.status || (remaining === 0 ? 'fully_returned' : returned > 0 ? 'partially_returned' : 'active'),
          recordedByName: b.recordedByName || (b.recordedBy ? `${b.recordedBy.firstName || ''} ${b.recordedBy.lastName || ''}`.trim() : undefined),
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        };
      });
    } catch {
      return [];
    }
  }

  async createBorrowing(payload: {
    productName: string;
    productCategory?: string;
    productId?: string;
    quantityTaken: number;
    sellerName: string;
    sellerPhone?: string;
    dateTaken: string;
    expectedReturnDate?: string;
    note?: string;
    warehouseId?: string;
    shopId?: string;
  }): Promise<Borrowing> {
    return this.request('/borrowings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateBorrowing(
    id: string,
    payload: { quantityReturned?: number; note?: string; expectedReturnDate?: string }
  ): Promise<Borrowing> {
    return this.request(`/borrowings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  // Inventory Adjustments (Stock In / Stock Out)
  async adjustStock(payload: {
    productId: string;
    type: 'stock_in' | 'stock_out' | 'purchase';
    quantity: number;
    warehouseId?: string;
    shopId?: string;
    reason?: string;
    referenceNumber?: string;
    unitCost?: number;
    supplierId?: string;
  }): Promise<any> {
    return this.request('/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({
        productId: payload.productId,
        type: payload.type,
        quantity: payload.quantity,
        warehouseId: payload.warehouseId || undefined,
        shopId: payload.shopId || undefined,
        reason: payload.reason || undefined,
        referenceNumber: payload.referenceNumber || undefined,
        unitCost: payload.unitCost,
        supplierId: payload.supplierId,
      }),
    });
  }

  async getInventoryTransactions(type?: string): Promise<any[]> {
    try {
      const q = type ? `?type=${type}` : '';
      const data = await this.request(`/inventory/transactions${q}`);
      return this.extractList(data);
    } catch {
      return [];
    }
  }

  // Transfers
  async getTransfers(limit = 200): Promise<Transfer[]> {
    try {
      const data = await this.request(`/transfers?limit=${limit}`);
      const list = this.extractList(data);
      return list.map((t: any) => {
        const fromWarehouseName = t.fromWarehouseName || t.sourceWarehouse?.name || t.fromName || '';
        const fromShopName = t.fromShopName || '';
        const toShopName = t.toShopName || t.destinationShop?.name || t.toName || '';
        const toWarehouseName = t.toWarehouseName || '';
        return {
          id: t.id,
          type: t.type,
          transferNumber: t.transferNumber || (t.id ? `TRF-${t.id.substring(0, 6)}` : 'TRF-001'),
          sourceWarehouseName: fromWarehouseName || fromShopName || 'Main Warehouse',
          destinationShopName: toShopName || toWarehouseName || 'Retail Shop',
          fromWarehouseName,
          fromShopName,
          toWarehouseName,
          toShopName,
          fromWarehouseId: t.fromWarehouseId || t.sourceWarehouseId,
          fromShopId: t.fromShopId,
          toWarehouseId: t.toWarehouseId,
          toShopId: t.toShopId || t.destinationShopId,
          productName: t.product?.name || t.productName || (t.items?.[0]?.product?.name),
          productSku: t.product?.sku || t.productSku || (t.items?.[0]?.product?.sku),
          productId: t.productId || (t.items?.[0]?.productId),
          quantity: t.quantity ?? (t.items?.[0]?.quantity) ?? 0,
          note: t.note,
          rejectionReason: t.rejectionReason,
          requestedById: t.requestedById,
          requestedByName: t.requestedBy ? `${t.requestedBy.firstName || ''} ${t.requestedBy.lastName || ''}`.trim() : (t.requestedByName || 'Admin'),
          approvedById: t.approvedById,
          approvedByName: t.approvedBy ? `${t.approvedBy.firstName || ''} ${t.approvedBy.lastName || ''}`.trim() : t.approvedByName,
          status: t.status || 'pending',
          itemsCount: t.items?.length || (t.quantity ? 1 : 1),
          date: t.createdAt || new Date().toISOString(),
          createdAt: t.createdAt,
        };
      });
    } catch {
      return [];
    }
  }

  async createTransfer(payload: {
    type?: string;
    productId: string;
    fromWarehouseId?: string;
    toWarehouseId?: string;
    fromShopId?: string;
    toShopId?: string;
    quantity: number;
    note?: string;
  }): Promise<any> {
    return this.request('/transfers', {
      method: 'POST',
      body: JSON.stringify({
        type: payload.type || 'warehouse_to_shop',
        productId: payload.productId,
        fromWarehouseId: payload.fromWarehouseId,
        toWarehouseId: payload.toWarehouseId,
        fromShopId: payload.fromShopId,
        toShopId: payload.toShopId,
        quantity: payload.quantity,
        note: payload.note,
      }),
    });
  }

  async approveTransfer(id: string): Promise<any> {
    return this.request(`/transfers/${id}/approve`, {
      method: 'PATCH',
    });
  }

  async rejectTransfer(id: string, reason?: string): Promise<any> {
    return this.request(`/transfers/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  }

  // Staff / Users / Employees
  async getStaff(): Promise<StaffMember[]> {
    try {
      let data: any = null;
      try {
        data = await this.request('/employees');
      } catch {
        data = await this.request('/users');
      }
      const list = this.extractList(data);
      return list.map((u: any) => {
        const roleClean = String(u.role || u.position || u.jobTitle || u.roleName || '').toLowerCase().trim();
        const isOwner = u.isOwner === true;

        const fullName = (u.name || (u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : '') || 'Staff').trim();
        const firstParts = fullName.split(' ');
        const fName = u.firstName || firstParts[0] || fullName;
        const lName = u.lastName || (firstParts.length > 1 ? firstParts.slice(1).join(' ') : '');

        return {
          id: u.id,
          name: fullName,
          firstName: fName,
          lastName: lName,
          phone: u.phoneNumber || u.phone || '',
          phoneNumber: u.phoneNumber || u.phone || '',
          role: u.role || u.position || 'STAFF',
          jobTitle: u.jobTitle || u.role || 'Staff Member',
          email: u.email,
          active: u.isActive !== false && u.status !== 'INACTIVE',
          shopId: u.shopId,
          shopName: u.shopName || u.shop?.name || '',
          warehouseId: u.warehouseId,
          warehouseName: u.warehouseName || u.warehouse?.name || '',
          authMethod: u.authMethod ? (u.authMethod.toLowerCase() === 'pin' ? 'PIN' : 'Password') : (u.pin || u.assignedPin ? 'PIN' : 'Password'),
          assignedPassword: u.assignedPassword || u.password || '',
          assignedPin: u.assignedPin || u.pin || '',
          salesAmount: toNumber(u.salesAmount || u.totalSales || 0),
          isOwner,
          permissions: (() => {
            let perms = u.permissions;
            if (typeof perms === 'string') {
              try { perms = JSON.parse(perms); } catch (_) { perms = {}; }
            }
            if (!perms || typeof perms !== 'object') {
              perms = {};
            }
            let branchPerms = perms.branchPermissions || u.branchPermissions;
            if (typeof branchPerms === 'string') {
              try { branchPerms = JSON.parse(branchPerms); } catch (_) { branchPerms = {}; }
            }
            let modulePerms = perms.modulePermissions || u.modulePermissions;
            if (typeof modulePerms === 'string') {
              try { modulePerms = JSON.parse(modulePerms); } catch (_) { modulePerms = {}; }
            }
            perms.branchPermissions = branchPerms || {};
            perms.modulePermissions = modulePerms || {};
            return perms;
          })(),
          branchPermissions: (() => {
            let perms = u.permissions;
            if (typeof perms === 'string') {
              try { perms = JSON.parse(perms); } catch (_) { perms = {}; }
            }
            let bp = perms?.branchPermissions || u.branchPermissions;
            if (typeof bp === 'string') {
              try { bp = JSON.parse(bp); } catch (_) { bp = {}; }
            }
            return bp || {};
          })(),
          modulePermissions: (() => {
            let perms = u.permissions;
            if (typeof perms === 'string') {
              try { perms = JSON.parse(perms); } catch (_) { perms = {}; }
            }
            let mp = perms?.modulePermissions || u.modulePermissions;
            if (typeof mp === 'string') {
              try { mp = JSON.parse(mp); } catch (_) { mp = {}; }
            }
            return mp || {};
          })(),
        };
      });
    } catch {
      return [];
    }
  }

  async createEmployee(payload: {
    name: string;
    phoneNumber: string;
    jobTitle: string;
    role: string;
    authMethod: string;
    password?: string;
    pin?: string;
    shopId?: string;
    warehouseId?: string;
  }): Promise<any> {
    return this.request('/employees', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateEmployee(
    id: string,
    payload: Partial<{
      name: string;
      phoneNumber: string;
      jobTitle: string;
      role: string;
      authMethod: string;
      password?: string;
      pin?: string;
      shopId?: string;
      warehouseId?: string;
    }>
  ): Promise<any> {
    return this.request(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteEmployee(id: string): Promise<any> {
    return this.request(`/employees/${id}`, {
      method: 'DELETE',
    });
  }

  // Commissions
  async getCommissions(): Promise<CommissionItem[]> {
    try {
      const data = await this.request('/commissions');
      const list = this.extractList(data);
      return list.map((cm: any) => ({
        id: cm.id,
        salespersonName: cm.salespersonName || cm.user?.firstName || cm.employee?.name || 'Staff',
        productName: cm.productName || cm.product?.name || 'Product',
        saleAmount: toNumber(cm.saleAmount || cm.sale?.totalAmount || cm.sale?.item?.total || cm.lineTotal),
        commissionRate: toNumber(cm.commissionRate, 5),
        commissionAmount: toNumber(cm.commissionAmount || cm.amount),
        isApproved: cm.isApproved || false,
        createdAt: cm.createdAt || cm.commissionDate,
        commissionDate: cm.commissionDate || cm.createdAt,
        quantity: cm.quantity != null ? toNumber(cm.quantity) : (cm.sale?.item?.quantity != null ? toNumber(cm.sale.item.quantity) : 1),
        unitPrice: cm.unitPrice != null ? toNumber(cm.unitPrice) : (cm.sale?.item?.unitPrice != null ? toNumber(cm.sale.item.unitPrice) : 0),
        lineTotal: cm.lineTotal != null ? toNumber(cm.lineTotal) : (cm.sale?.item?.total != null ? toNumber(cm.sale.item.total) : 0),
        customerName: cm.customerName || cm.sale?.customer?.name || 'Walk-in',
        customerPhone: cm.customerPhone || cm.sale?.customer?.phoneNumber || '',
        invoiceNumber: cm.invoiceNumber || cm.sale?.invoiceNumber || 'POS',
        employee: cm.employee,
        product: cm.product,
        sale: cm.sale,
      }));
    } catch {
      return [];
    }
  }

  async approveCommissions(ids: string[]): Promise<any> {
    return this.request('/commissions/approve', {
      method: 'POST',
      body: JSON.stringify({ commissionIds: ids, ids }),
    });
  }

  async updateProductCommissionRate(productId: string, commissionRate: number, commissionType: 'percent' | 'fixed' = 'percent'): Promise<any> {
    return this.request(`/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify({ commissionRate, commissionType }),
    });
  }

  async updateStaffCommissionRate(employeeId: string, baseCommissionRate: number, baseCommissionType: 'percent' | 'fixed' = 'percent'): Promise<any> {
    return this.request(`/employees/${employeeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ baseCommissionRate, baseCommissionType }),
    });
  }

  async getPlans(): Promise<any[]> {
    try {
      const data = await this.request('/plans');
      return this.extractList(data);
    } catch {
      return [
        {
          id: 'plan_starter',
          title: 'Starter Plan (1 Additional Slot)',
          price: '1,500',
          features: ['Manage 1 new company entity', 'Separate inventory & sales tracking', 'Dedicated staff access levels'],
        },
        {
          id: 'plan_growth',
          title: 'Growth Plan (3 Additional Slots)',
          price: '3,800',
          features: ['Manage 3 new company entities', 'Full multi-branch reporting & transfers', 'Priority admin support'],
        },
        {
          id: 'plan_enterprise',
          title: 'Enterprise Plan (Unlimited)',
          price: '8,500',
          features: ['Unlimited company entities', 'Custom workflow permissions', '24/7 VIP assistance'],
        },
      ];
    }
  }

  async uploadPaymentProof(file: File): Promise<{ url: string }> {
    if (DEMO_MODE) {
      return { url: '/logo/gelagle_logo.png' };
    }
    const formData = new FormData();
    formData.append('file', file);
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${getBaseUrl()}/auth/upload-payment-proof`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Payment proof upload failed');
    }
    return res.json();
  }

  async requestLimitUpgrade(payload: {
    companyNames: string[];
    planId: string;
    paymentMethod?: string;
    paymentRef?: string;
    screenshotUrl?: string;
  }): Promise<any> {
    return this.request('/companies/request-limit-upgrade', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async submitIssueReport(payload: {
    title: string;
    description: string;
    category?: string;
    appType?: 'flutter' | 'web';
  }): Promise<any> {
    return this.request('/issue-reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async renewSubscription(payload: {
    phone: string;
    planId?: string;
    planTitle?: string;
    planAmount?: number;
    planPeriod?: string;
    paymentMethod?: string;
    paymentRef?: string;
    paymentScreenshot?: string;
  }): Promise<any> {
    return this.request('/auth/renew-subscription', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Companies
  async getCompanies(): Promise<Company[]> {
    try {
      const data = await this.request('/companies');
      const list = this.extractList(data);
      return list.map((c: any) => ({
        id: c.id,
        name: c.name || c.companyName,
        address: c.address,
        phoneNumber: c.phoneNumber || c.phone,
        status: c.status,
      }));
    } catch {
      return [];
    }
  }

  async createCompany(payload: { name: string; address?: string; phoneNumber?: string; email?: string }): Promise<Company> {
    return this.request('/companies', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateCompany(companyId: string, payload: { name?: string; address?: string; phoneNumber?: string; email?: string }): Promise<Company> {
    return this.request(`/companies/${companyId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  // Location Products & Management
  async getWarehouseProducts(warehouseId: string): Promise<Product[]> {
    try {
      const data = await this.request(`/warehouses/${warehouseId}/with-products`);
      const list = this.extractList(data);
      return list.map((p: any) => ({
        ...p,
        id: p.id || p.productId,
        name: p.name || p.productName || 'Item',
        sku: p.sku,
        barcode: p.barcode,
        price: Number(p.price ?? p.sellingPrice ?? p.product?.price ?? 0) || 0,
        cost: Number(p.cost ?? p.costPrice ?? p.purchasePrice ?? p.product?.cost ?? 0) || 0,
        stockQuantity: p.stockQuantity ?? p.quantity ?? 0,
        minStockLevel: p.minStockLevel,
        category: p.category,
        unit: p.unit || p.product?.unit || 'piece',
      }));
    } catch {
      return [];
    }
  }

  async getShopProducts(shopId: string): Promise<Product[]> {
    try {
      const data = await this.request(`/shops/${shopId}/with-products`);
      const list = this.extractList(data);
      return list.map((p: any) => ({
        ...p,
        id: p.id || p.productId,
        name: p.name || p.productName || 'Item',
        sku: p.sku,
        barcode: p.barcode,
        price: Number(p.price ?? p.sellingPrice ?? p.product?.price ?? 0) || 0,
        cost: Number(p.cost ?? p.costPrice ?? p.purchasePrice ?? p.product?.cost ?? 0) || 0,
        stockQuantity: p.stockQuantity ?? p.quantity ?? 0,
        minStockLevel: p.minStockLevel,
        category: p.category,
        unit: p.unit || p.product?.unit || 'piece',
      }));
    } catch {
      return [];
    }
  }

  async attachProductToWarehouse(warehouseId: string, productId: string, stockQuantity: number): Promise<void> {
    return this.request(`/warehouses/${warehouseId}/products`, {
      method: 'POST',
      body: JSON.stringify({ productId, stockQuantity }),
    });
  }

  async attachProductToShop(shopId: string, productId: string, stockQuantity: number): Promise<void> {
    return this.request(`/shops/${shopId}/products`, {
      method: 'POST',
      body: JSON.stringify({ productId, stockQuantity }),
    });
  }

  async detachProductFromWarehouse(warehouseId: string, productId: string): Promise<void> {
    return this.request(`/warehouses/${warehouseId}/products/${productId}`, {
      method: 'DELETE',
    });
  }

  async detachProductFromShop(shopId: string, productId: string): Promise<void> {
    return this.request(`/shops/${shopId}/products/${productId}`, {
      method: 'DELETE',
    });
  }

  // Bank Accounts
  async getBankAccounts(): Promise<BankAccount[]> {
    try {
      const data = await this.request('/bank/accounts');
      const list = this.extractList(data);
      return list.map((b: any) => ({
        id: b.id,
        bankName: b.bankName || b.name,
        accountName: b.accountName || b.holderName || '',
        accountNumber: b.accountNumber,
        branchName: b.branchName,
        currentBalance: parseFloat(b.currentBalance ?? b.initialBalance ?? 0),
        initialBalance: parseFloat(b.initialBalance ?? 0),
        isPrimary: b.isPrimary || false,
      }));
    } catch {
      return [];
    }
  }

  async createBankAccount(payload: { bankName: string; accountNumber: string; initialBalance?: number; note?: string }): Promise<BankAccount> {
    return this.request('/bank/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async addBankBalance(payload: { bankAccountId: string; amount: number; note?: string }): Promise<any> {
    return this.request('/bank/add-balance', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async addBankExpense(payload: { amount: number; reason?: string; bankAccountId?: string }): Promise<any> {
    return this.request('/bank/expenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getBankSummary(): Promise<{ todaySales: number; productSales: number; totalExpenses: number; commission: number; netProfit: number }> {
    try {
      const res = await this.request('/bank/summary');
      return {
        todaySales: toNumber(res?.todaySales),
        productSales: toNumber(res?.productSales),
        totalExpenses: toNumber(res?.totalExpenses),
        commission: toNumber(res?.commission),
        netProfit: toNumber(res?.netProfit),
      };
    } catch {
      return { todaySales: 0, productSales: 0, totalExpenses: 0, commission: 0, netProfit: 0 };
    }
  }

  // Profile & Settings API methods
  async getProfile(): Promise<UserProfile> {
    const data = await this.request('/users/me');
    const companyName = data?.company?.name || data?.companyName || null;
    return {
      id: data?.id,
      email: data?.email,
      phone: data?.phone || '',
      firstName: data?.firstName || '',
      lastName: data?.lastName || '',
      companyId: data?.companyId || data?.company?.id,
      companyName,
      role: data?.role,
      status: data?.status,
      planId: data?.planId,
      planTitle: data?.planTitle,
      planAmount: toNumber(data?.planAmount),
      planPeriod: data?.planPeriod,
      subscriptionExpiresAt: data?.subscriptionExpiresAt,
      subscriptionStartDate: data?.subscriptionStartDate,
      subscriptionNextPaymentDate: data?.subscriptionNextPaymentDate,
      company: data?.company ? { id: data.company.id, name: data.company.name } : undefined,
    };
  }

  async updateProfile(payload: { firstName?: string; lastName?: string }): Promise<UserProfile> {
    const data = await this.request('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return this.getProfile().catch(() => ({
      id: data?.id,
      firstName: data?.firstName,
      lastName: data?.lastName,
      phone: data?.phone,
      companyId: data?.companyId,
    }));
  }

  async changePassword(payload: { currentPassword?: string; newPassword: string }): Promise<any> {
    return this.request('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ password: payload.newPassword }),
    });
  }

  async sendDeleteAccountOtp(phone?: string): Promise<{ success: boolean; message: string; phone?: string; code?: string }> {
    return this.request('/users/me/send-delete-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async deleteAccount(payload?: { otp?: string; phone?: string }): Promise<any> {
    return this.request('/users/me', {
      method: 'DELETE',
      body: JSON.stringify(payload || {}),
    });
  }

  // Notifications
  async getNotifications(limit = 50, offset = 0): Promise<AppNotification[]> {
    try {
      const data = await this.request(`/notifications?limit=${limit}&offset=${offset}`);
      const list = this.extractList(data);
      return list.map((n: any) => ({
        id: n.id,
        type: n.type || 'info',
        title: n.title || '',
        message: n.message || '',
        isRead: n.isRead ?? false,
        createdAt: n.createdAt || new Date().toISOString(),
        metadata: n.metadata,
      }));
    } catch {
      return [];
    }
  }

  async getUnreadNotificationCount(): Promise<number> {
    try {
      const data = await this.request('/notifications/unread-count');
      return data?.count ?? 0;
    } catch {
      return 0;
    }
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await this.request(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  async markAllNotificationsAsRead(): Promise<void> {
    await this.request('/notifications/read-all', { method: 'PATCH' });
  }

  // Bank / Wallet Receipt Verification (verify.et Integration)
  async verifyReceipt(payload: {
    bank?: string;
    link?: string;
    reference?: string;
    referenceNumber?: string;
    receiptNumber?: string;
    transactionNumber?: string;
    suffix?: string;
    phoneNumber?: string;
    receiptUrl?: string;
    imageBase64?: string;
    file?: File;
  }): Promise<VerifiedReceipt> {
    try {
      if (DEMO_MODE) {
        return demoRequest('/receipts/verify', {
          method: 'POST',
          body: JSON.stringify({ ...payload, file: undefined }),
        }) as VerifiedReceipt;
      }
      if (payload.file) {
        const formData = new FormData();
        formData.append('image', payload.file);
        if (payload.bank) formData.append('bank', payload.bank);
        if (payload.link) formData.append('link', payload.link);
        if (payload.reference) formData.append('reference', payload.reference);
        if (payload.suffix) formData.append('suffix', payload.suffix);
        if (payload.phoneNumber) formData.append('phoneNumber', payload.phoneNumber);

        const authToken = this.getToken();
        const res = await fetch(`${getBaseUrl()}/receipts/verify`, {
          method: 'POST',
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          body: formData,
        });
        const json = await res.json();
        return json.data || json;
      }

      const res = await this.request('/receipts/verify', {
        method: 'POST',
        body: JSON.stringify({
          bank: payload.bank,
          link: payload.link,
          reference: payload.reference,
          referenceNumber: payload.referenceNumber,
          receiptNumber: payload.receiptNumber,
          transactionNumber: payload.transactionNumber,
          suffix: payload.suffix,
          phoneNumber: payload.phoneNumber,
          receiptUrl: payload.receiptUrl,
          imageBase64: payload.imageBase64,
        }),
      });
      return res;
    } catch (err: any) {
      return {
        valid: false,
        status: 'error',
        message: err?.message || 'Failed to verify receipt.',
        bank: payload.bank || 'cbe',
      };
    }
  }

  // Backwards-compatible CBE alias
  async verifyCbeReceipt(payload: {
    link?: string;
    reference?: string;
    receiptNumber?: string;
    suffix?: string;
    imageBase64?: string;
    file?: File;
  }): Promise<VerifiedReceipt> {
    return this.verifyReceipt({ ...payload, bank: 'cbe' });
  }

  async verifyReceiptAndActivate(payload: {
    phone: string;
    bank?: string;
    link?: string;
    reference?: string;
    receiptUrl?: string;
    imageBase64?: string;
    suffix?: string;
  }): Promise<{ success: boolean; message: string; receipt?: VerifiedReceipt; alreadyActive?: boolean }> {
    return this.request('/auth/verify-receipt-activate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export interface VerifiedReceipt {
  valid: boolean;
  status: 'valid' | 'invalid' | 'pending' | 'error' | 'already_used';
  message: string;
  bank: string;
  amount?: number;
  currency?: string;
  senderName?: string;
  receiverName?: string;
  payerAccount?: string;
  receiverAccount?: string;
  reference?: string;
  receiptNumber?: string;
  receiptUrl?: string;
  transactionDate?: string;
  reason?: string;
  requestId?: string;
  alreadyUsed?: boolean;
  raw?: any;
}

export type CbeVerifiedReceipt = VerifiedReceipt;

export const api = new ApiClient();
