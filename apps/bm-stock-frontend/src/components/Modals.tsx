"use client";

import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { X, Tag, Users, Building, Check, Plus, Trash2, CreditCard, Package, Shield, ChevronDown, Lock, Box, Search, Copy, UploadCloud, Smartphone, Building2, CheckCircle2, Image as ImageIcon, ArrowUpRight, Repeat, FileCode, Zap, Pencil, KeyRound, Loader2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useAuth } from '@/context/AuthContext';
import { api, SaleRecord, StaffMember, Shop, Warehouse, Product, Customer, Supplier, Borrowing, BankAccount, ActivityItem } from '@/lib/api';
import { useToast } from '@/components/Toast';
import ReceiptVerificationModal from '@/components/ReceiptVerificationModal';
import { getUserPlanTier, canUseBulkEntry, canUseProductImport, getPlanLimits } from '@/lib/subscriptionPlans';

// 11. Permissions Configuration Modal (Flutter Parity)
interface PermissionsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffMember | null;
  shops?: Shop[];
  warehouses?: Warehouse[];
  onSuccess?: () => void;
  isNewStaff?: boolean;
}

export function PermissionsConfigModal({
  isOpen,
  onClose,
  staff,
  shops = [],
  warehouses = [],
  onSuccess,
  isNewStaff = false,
}: PermissionsConfigModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const [moduleAccess, setModuleAccess] = useState<Record<string, 'none' | 'view' | 'edit'>>({});
  const [branchAccess, setBranchAccess] = useState<Record<string, { shop: boolean; warehouse: boolean }>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    stock: false,
    location: false,
    sales: false,
    products: false,
    admin: false,
  });

  const viewOnlyModules = new Set([
    'warehouse',
    'shopStore',
    'branch',
    'viewSales',
    'viewCredit',
    'viewProducts',
    'reports',
    'settings',
  ]);

  const sectionModules = {
    stock: [
      { key: 'stockIn', label: 'Stock In' },
      { key: 'stockOut', label: 'Stock Out' },
    ],
    location: [
      { key: 'warehouse', label: 'Store (Warehouse)' },
      { key: 'shopStore', label: 'Shop Retail Store' },
      { key: 'branch', label: 'Branch Management' },
    ],
    sales: [
      { key: 'viewSales', label: 'View Sales' },
      { key: 'createSale', label: 'Create Sale POS' },
      { key: 'editSale', label: 'Edit / Cancel Sale' },
      { key: 'viewCredit', label: 'View Credit Records' },
      { key: 'receiveCreditPayment', label: 'Receive Credit Payment' },
    ],
    products: [
      { key: 'viewProducts', label: 'View Products' },
      { key: 'addProduct', label: 'Add Product' },
      { key: 'editProduct', label: 'Edit Product' },
      { key: 'deleteProduct', label: 'Delete Product' },
    ],
    admin: [
      { key: 'staffManagement', label: 'Staff & Access' },
      { key: 'commission', label: 'Commission Management' },
      { key: 'reports', label: 'Reports Hub' },
      { key: 'settings', label: 'System Settings' },
      { key: 'branchTransfers', label: 'Stock Transfers' },
      { key: 'companies', label: 'Company Entities' },
      { key: 'bankAccounts', label: 'Bank Accounts' },
    ],
  };

  useEffect(() => {
    if (isOpen && staff) {
      const initialModules: Record<string, 'none' | 'view' | 'edit'> = {};
      Object.values(sectionModules).flat().forEach((mod) => {
        initialModules[mod.key] = 'none';
      });

      const isAdminStaff =
        ['admin', 'company_admin', 'super_admin'].includes((staff.role || '').toLowerCase()) ||
        (staff.jobTitle || '').toLowerCase() === 'admin';

      // Load from staff.permissions if present
      const existingModules = staff.permissions?.modulePermissions || {};
      Object.keys(existingModules).forEach((k) => {
        const val = existingModules[k];
        if (val === 'view' || val === 'edit' || val === 'none') {
          initialModules[k] = val;
        }
      });

      // For admin staff on initial creation (or with empty perms), select all permissions
      if (isAdminStaff && (isNewStaff || Object.keys(existingModules).length === 0)) {
        Object.values(sectionModules).flat().forEach((mod) => {
          initialModules[mod.key] = viewOnlyModules.has(mod.key) ? 'view' : 'edit';
        });
        setExpandedSections({
          stock: true,
          location: true,
          sales: true,
          products: true,
          admin: true,
        });
      } else if (Object.keys(existingModules).length === 0) {
        // Defaults for regular new staff if no permissions defined yet
        initialModules['viewProducts'] = 'view';
        initialModules['viewSales'] = 'view';
        initialModules['createSale'] = 'edit';
        initialModules['stockIn'] = 'edit';
        initialModules['stockOut'] = 'edit';
      }

      setModuleAccess(initialModules);

      // Load branch permissions
      const initialBranches: Record<string, { shop: boolean; warehouse: boolean }> = {};
      let permsObj = staff.permissions;
      if (typeof permsObj === 'string') {
        try { permsObj = JSON.parse(permsObj); } catch (_) { permsObj = {}; }
      }
      let existingBranches = permsObj?.branchPermissions || (staff as any).branchPermissions || {};
      if (typeof existingBranches === 'string') {
        try { existingBranches = JSON.parse(existingBranches); } catch (_) { existingBranches = {}; }
      }

      if (isAdminStaff && (isNewStaff || Object.keys(existingBranches).length === 0)) {
        shops.forEach((s) => {
          initialBranches[s.id] = { shop: true, warehouse: false };
        });
        warehouses.forEach((w) => {
          initialBranches[w.id] = { shop: false, warehouse: true };
        });
      } else {
        shops.forEach((s) => {
          const ex = existingBranches[s.id];
          const isGranted = ex ? (ex.shop === true || ex.shop === 'true' || ex === true || ex === 'true') : false;
          initialBranches[s.id] = {
            shop: isGranted || (staff.shopId === s.id),
            warehouse: false,
          };
        });

        warehouses.forEach((w) => {
          const ex = existingBranches[w.id];
          const isGranted = ex ? (ex.warehouse === true || ex.warehouse === 'true' || ex === true || ex === 'true') : false;
          initialBranches[w.id] = {
            shop: false,
            warehouse: isGranted || (staff.warehouseId === w.id),
          };
        });
      }

      setBranchAccess(initialBranches);
    }
  }, [isOpen, staff, shops, warehouses, isNewStaff]);

  const isOwnerStaff = (s: any) => {
    return s.isOwner === true;
  };

  if (!isOpen || !staff || isOwnerStaff(staff)) return null;

  const toggleModule = (key: string, enabled: boolean) => {
    const defaultLevel = viewOnlyModules.has(key) ? 'view' : 'edit';
    setModuleAccess((prev) => ({
      ...prev,
      [key]: enabled ? defaultLevel : 'none',
    }));
  };

  const setAccessLevel = (key: string, level: 'view' | 'edit') => {
    setModuleAccess((prev) => ({
      ...prev,
      [key]: level,
    }));
  };

  const toggleGroup = (secKey: keyof typeof sectionModules, enableAll: boolean) => {
    const mods = sectionModules[secKey];
    setModuleAccess((prev) => {
      const next = { ...prev };
      mods.forEach((m) => {
        const defaultLevel = viewOnlyModules.has(m.key) ? 'view' : 'edit';
        next[m.key] = enableAll ? defaultLevel : 'none';
      });
      return next;
    });
    // Automatically expand the dropdown box when group is selected/toggled
    setExpandedSections((prev) => ({ ...prev, [secKey]: true }));
  };

  const toggleBranch = (id: string, field: 'shop' | 'warehouse') => {
    setBranchAccess((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: !prev[id]?.[field],
      },
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.updateStaffPermissions(staff.id, {
        modulePermissions: moduleAccess,
        branchPermissions: branchAccess,
      });
      showToast(`Permissions updated successfully for ${staff.firstName}!`, 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to save permissions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fullNameDisplay = staff.name || `${staff.firstName} ${staff.lastName}`.trim() || 'Staff Member';

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#025EA7] flex items-center justify-center border border-blue-100">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Configure Staff Permissions</h3>
              <p className="text-xs text-slate-500 font-medium">
                Employee: <strong className="text-slate-800">{fullNameDisplay}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isNewStaff && (
          <div className="mb-4 p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>🎉 Staff member added successfully! Configure initial access & permissions below.</span>
            </div>
          </div>
        )}

        {/* Employee Header Card matching Flutter */}
        <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-blue-100 text-[#025EA7] flex items-center justify-center font-bold text-sm border border-blue-200 shadow-xs">
              {fullNameDisplay.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">{fullNameDisplay}</h4>
                <span className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full ${
                  ['admin', 'manager', 'company_admin'].includes((staff.role || '').toLowerCase())
                    ? 'bg-blue-100 text-[#025EA7]'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {staff.role || staff.jobTitle || 'Staff'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                📞 {staff.phone || staff.phoneNumber || 'N/A'} • {staff.shopName ? `Shop: ${staff.shopName}` : staff.warehouseName ? `Warehouse: ${staff.warehouseName}` : 'All Branches'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold text-slate-600 px-2.5 py-1 bg-white border border-slate-200 rounded-lg shadow-xs">
              Auth: {staff.authMethod || 'Password'}
            </span>
          </div>
        </div>

        {/* Branch / Location Permissions */}
        <div className="mb-5 bg-slate-50 rounded-xl p-4 border border-slate-100">
          <div className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Building className="w-4 h-4 text-[#025EA7]" /> Allowed Branch & Location Access
          </div>

          <div className="space-y-2">
            {[...shops.map(s => ({ ...s, type: 'Shop' as const })), ...warehouses.map(w => ({ ...w, type: 'Warehouse' as const }))].length === 0 ? (
              <div className="text-xs text-slate-400">No active branches or stores configured.</div>
            ) : (
              [...shops.map(s => ({ ...s, type: 'Shop' as const })), ...warehouses.map(w => ({ ...w, type: 'Warehouse' as const }))].map((b) => {
                const current = branchAccess[b.id] || { shop: false, warehouse: false };
                const isEnabled = b.type === 'Shop' ? current.shop : current.warehouse;
                const isPrimary = (b.type === 'Shop' && staff.shopId === b.id) || (b.type === 'Warehouse' && staff.warehouseId === b.id);
                return (
                  <div key={b.id} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200/70 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{b.name} ({b.type})</span>
                      {isPrimary && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#025EA7]">
                          Primary
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleBranch(b.id, b.type === 'Shop' ? 'shop' : 'warehouse')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 ${
                        isEnabled ? 'bg-[#025EA7] text-white border-[#025EA7]' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {isEnabled ? '✓ Allowed' : '+ Allow'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* MODULE LEVEL PERMISSIONS — Screenshot Match */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">MODULE LEVEL PERMISSIONS</div>
          </div>

          {(Object.entries(sectionModules) as [keyof typeof sectionModules, typeof sectionModules['stock']][]).map(([secKey, modules]) => {
            const isExpanded = expandedSections[secKey];
            const secTitle = secKey.toUpperCase() + ' GROUP';
            const enabledCount = modules.filter(m => (moduleAccess[m.key] || 'none') !== 'none').length;
            const isAllGroupEnabled = enabledCount === modules.length;

            return (
              <div key={secKey} className="bg-[#F4F7FA] rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
                {/* Header Row — Click anywhere to expand/collapse dropdown box */}
                <div
                  onClick={() => setExpandedSections((prev) => ({ ...prev, [secKey]: !prev[secKey] }))}
                  className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4 text-[#025EA7]" />
                    <span className="font-bold text-xs text-slate-900 uppercase tracking-wider">{secTitle}</span>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-600 font-bold">
                      {enabledCount}/{modules.length} Enabled
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(secKey, !isAllGroupEnabled)}
                      className={`px-3 py-1.5 text-[11px] font-bold rounded-xl border transition-all ${
                        isAllGroupEnabled
                          ? 'bg-[#025EA7] text-white border-[#025EA7] shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50'
                      }`}
                    >
                      {isAllGroupEnabled ? 'Group ON' : 'Group OFF'}
                    </button>
                  </div>
                </div>

                {/* Dropdown Box appears when selected / expanded */}
                {isExpanded && (
                  <div className="p-3.5 space-y-2.5 bg-white border-t border-slate-200/60 animate-fade-in">
                    {modules.map((m) => {
                      const access = moduleAccess[m.key] || 'none';
                      const isEnabled = access !== 'none';
                      return (
                        <div
                          key={m.key}
                          className={`p-3 rounded-xl border transition-all ${
                            isEnabled
                              ? 'bg-blue-50/40 border-blue-200 shadow-sm'
                              : 'bg-slate-50/60 border-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold ${isEnabled ? 'text-slate-900' : 'text-slate-500'}`}>
                              {m.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleModule(m.key, !isEnabled)}
                              className={`px-3 py-1 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1.5 ${
                                isEnabled
                                  ? 'bg-[#025EA7] text-white border-[#025EA7] shadow-sm'
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {isEnabled ? '✓ Enabled' : '+ Enable'}
                            </button>
                          </div>

                          {/* Access Level Dropdown Box appears when selected */}
                          {isEnabled && (
                            <div className="mt-2.5 pt-2.5 border-t border-blue-100/80 flex items-center justify-between gap-2 animate-fade-in">
                              <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                                <span>Access Level:</span>
                              </label>
                              <select
                                value={access}
                                onChange={(e) => setAccessLevel(m.key, e.target.value as 'view' | 'edit')}
                                className="px-2.5 py-1 bg-white border border-blue-200 text-blue-900 rounded-lg text-xs font-bold focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none shadow-sm cursor-pointer"
                              >
                                <option value="view">👁️ View Only</option>
                                <option value="edit">✏️ Full Edit Access</option>
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleSave}
            className="flex-1 py-2.5 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
          >
            {loading ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </div>
  );
}


interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// 1. New Sale POS Modal (Matching Flutter App)
interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export function NewSaleModal({ isOpen, onClose, onSuccess }: ModalProps) {
  const { showToast } = useToast();

  // Data lists
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);

  // Cart & Location
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProdIdToAdd, setSelectedProdIdToAdd] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');

  // Customer State
  const [walkInCustomer, setWalkInCustomer] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [showNewCustForm, setShowNewCustForm] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  // Payment State
  const [paymentType, setPaymentType] = useState<'cash' | 'bank_transfer' | 'mobile_money' | 'credit'>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [selectedBankAcc, setSelectedBankAcc] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [advancePayment, setAdvancePayment] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reminderDays, setReminderDays] = useState(7);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [showCbeVerifier, setShowCbeVerifier] = useState(false);

  // Discount & VAT State
  const [discountType, setDiscountType] = useState<'none' | 'fixed' | 'percentage'>('none');
  const [discountValue, setDiscountValue] = useState('');
  const [withoutVat, setWithoutVat] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const rand = Math.floor(Math.random() * 9000 + 1000);
      setInvoiceNumber(`INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${rand}`);

      async function loadData() {
        try {
          const [pRes, cRes, bRes, wRes, sRes] = await Promise.allSettled([
            api.getProducts(500),
            api.getCustomers(),
            api.getBankAccounts(),
            api.getWarehouses(),
            api.getShops(),
          ]);
          const pList = pRes.status === 'fulfilled' ? pRes.value : [];
          const cList = cRes.status === 'fulfilled' ? cRes.value : [];
          const bList = bRes.status === 'fulfilled' ? bRes.value : [];
          const wList = wRes.status === 'fulfilled' ? wRes.value : [];
          const sList = sRes.status === 'fulfilled' ? sRes.value : [];

          setProducts(pList);
          setCustomers(cList);
          setBankAccounts(bList);
          setWarehouses(wList);
          setShops(sList);
          if (wList.length > 0) setSelectedLocationId(wList[0].id);
          else if (sList.length > 0) setSelectedLocationId(sList[0].id);
        } catch (err) {
          console.error('Error loading POS data:', err);
        }
      }
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!selectedLocationId || !isOpen) return;
    async function fetchLocationProducts() {
      const isWarehouse = warehouses.some((w) => w.id === selectedLocationId);
      const isShop = shops.some((s) => s.id === selectedLocationId);
      try {
        let locProds: Product[] = [];
        if (isWarehouse) {
          locProds = await api.getWarehouseProducts(selectedLocationId);
        } else if (isShop) {
          locProds = await api.getShopProducts(selectedLocationId);
        }
        if (locProds && locProds.length > 0) {
          setProducts(locProds);
        } else {
          const pList = await api.getProducts(500);
          setProducts(pList);
        }
      } catch (err) {
        console.error('Error fetching location products:', err);
      }
    }
    fetchLocationProducts();
  }, [selectedLocationId, warehouses, shops, isOpen]);

  if (!isOpen) return null;

  const handleAddToCart = (prodId: string) => {
    if (!prodId) return;
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;

    if (prod.stockQuantity <= 0) {
      showToast(`Warning: "${prod.name}" is currently out of stock`, 'error');
    }

    setCart((prev) => {
      const idx = prev.findIndex((item) => item.product.id === prodId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].quantity += 1;
        return copy;
      }
      return [...prev, { product: prod, quantity: 1, unitPrice: prod.price || 0 }];
    });
    setSelectedProdIdToAdd('');
  };

  const updateCartQty = (idx: number, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((_, i) => i !== idx));
    } else {
      setCart((prev) => {
        const copy = [...prev];
        copy[idx].quantity = qty;
        return copy;
      });
    }
  };

  const updateCartUnitPrice = (idx: number, priceVal: number) => {
    setCart((prev) => {
      const copy = [...prev];
      copy[idx].unitPrice = priceVal;
      return copy;
    });
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  // Without VAT option: reduces total sales price by 15%
  const vatDeduction = withoutVat ? subtotal * 0.15 : 0;
  const baseAfterVat = Math.max(0, subtotal - vatDeduction);

  let discountAmount = 0;
  const dVal = parseFloat(discountValue) || 0;
  if (discountType === 'percentage') {
    discountAmount = (baseAfterVat * dVal) / 100;
  } else if (discountType === 'fixed') {
    discountAmount = Math.min(dVal, baseAfterVat);
  }

  const grandTotal = Math.max(0, baseAfterVat - discountAmount);
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const receivedCashNum = parseFloat(amountReceived) || 0;
  const changeDue = paymentType === 'cash' ? Math.max(0, receivedCashNum - grandTotal) : 0;

  const advPayNum = parseFloat(advancePayment) || 0;
  const remainingCreditBalance = Math.max(0, grandTotal - advPayNum);

  const handleCompleteSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      setError('Please add at least one product to the sale cart');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      let reminderIsoDate: string | undefined = undefined;
      if (paymentType === 'credit' && dueDate) {
        const due = new Date(dueDate);
        due.setDate(due.getDate() - reminderDays);
        reminderIsoDate = due.toISOString().substring(0, 10);
      }

      await api.createSale({
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: withoutVat ? Math.round(item.unitPrice * 0.85 * 100) / 100 : item.unitPrice,
        })),
        customerId: !walkInCustomer && selectedCustomerId ? selectedCustomerId : undefined,
        warehouseId: warehouses.some((w) => w.id === selectedLocationId) ? selectedLocationId : undefined,
        shopId: shops.some((s) => s.id === selectedLocationId) ? selectedLocationId : undefined,
        paymentType,
        referenceNumber: referenceNumber || undefined,
        receiptImageUrl: receiptImage || undefined,
        advancePayment: advPayNum > 0 ? advPayNum : undefined,
        dueDate: paymentType === 'credit' && dueDate ? dueDate : undefined,
        reminderDate: reminderIsoDate,
        discountType: discountType !== 'none' ? discountType : undefined,
        discountRate: discountType === 'percentage' ? dVal : undefined,
        note: withoutVat ? 'Sale processed without VAT (15% reduction applied)' : undefined,
      });

      setSuccess(true);
      showToast('Sale invoice issued successfully!', 'success');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to process sale');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">New Sales POS</h3>
                <span className="px-2 py-0.5 bg-blue-100 text-[#025EA7] text-[10px] font-bold rounded-md">
                  {invoiceNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500">Real-time stock deduction & billing invoice</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-red-50 text-red-600 text-xs rounded-xl font-medium text-center border border-red-100">
            {error}
          </div>
        )}

        {success ? (
          <div className="py-12 text-center">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>
            <h4 className="text-xl font-bold text-slate-900">Invoice Issued Successfully!</h4>
            <p className="text-xs text-slate-500 mt-1">Total ETB {grandTotal.toLocaleString()} processed.</p>
          </div>
        ) : (
          <form onSubmit={handleCompleteSale} className="space-y-4">
            
            {/* Storage Branch Selector */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-[#025EA7]" /> Selling Location:
              </span>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#025EA7]"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>Warehouse: {w.name}</option>
                ))}
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>Shop: {s.name}</option>
                ))}
              </select>
            </div>

            {/* Customer Section */}
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#025EA7]" /> Customer
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setWalkInCustomer(!walkInCustomer);
                    setSelectedCustomerId('');
                    setShowNewCustForm(false);
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${walkInCustomer ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-600'}`}
                >
                  {walkInCustomer ? '✓ Walk-in Customer' : 'Select Registered Customer'}
                </button>
              </div>

              {!walkInCustomer && (
                <div className="space-y-2">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#025EA7]"
                  >
                    <option value="">Choose registered customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone || 'No phone'}) - Credit: ETB {(c.totalCredit || 0).toLocaleString()}
                      </option>
                    ))}
                  </select>

                  {!showNewCustForm ? (
                    <button
                      type="button"
                      onClick={() => setShowNewCustForm(true)}
                      className="text-xs font-bold text-[#025EA7] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Quick Add New Customer
                    </button>
                  ) : (
                    <div className="p-3 bg-white border border-blue-100 rounded-xl space-y-2 text-xs">
                      <div className="font-bold text-slate-800">New Customer Quick Entry</div>
                      <input
                        type="text"
                        placeholder="Customer Name *"
                        value={newCustName}
                        onChange={(e) => setNewCustName(e.target.value)}
                        className="w-full py-2 px-3 border border-slate-200 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Phone Number"
                        value={newCustPhone}
                        onChange={(e) => setNewCustPhone(e.target.value)}
                        className="w-full py-2 px-3 border border-slate-200 rounded-lg"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cart & Add Products Section */}
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Sale Cart ({totalItemsCount} items)
                </span>
              </div>

              {/* Add Product Dropdown */}
              <div className="flex gap-2">
                <select
                  value={selectedProdIdToAdd}
                  onChange={(e) => {
                    setSelectedProdIdToAdd(e.target.value);
                    handleAddToCart(e.target.value);
                  }}
                  className="flex-1 py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#025EA7]"
                >
                  <option value="">Select product to add to cart...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.stockQuantity}) - ETB {p.price.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cart Items List */}
              {cart.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                  Cart is empty. Select a product above to build invoice.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {cart.map((item, idx) => (
                    <div key={item.product.id} className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 truncate">{item.product.name}</div>
                        <div className="text-[11px] text-slate-500">
                          SKU: {item.product.sku || 'N/A'} • Available: {item.product.stockQuantity}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="w-20">
                          <label className="text-[10px] text-slate-400 block">Unit ETB</label>
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updateCartUnitPrice(idx, parseFloat(e.target.value) || 0)}
                            className="w-full py-1 px-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-right"
                          />
                        </div>

                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                          <button
                            type="button"
                            onClick={() => updateCartQty(idx, item.quantity - 1)}
                            className="w-6 h-6 bg-white rounded font-bold text-slate-700 hover:bg-slate-200"
                          >
                            -
                          </button>
                          <span className="w-7 text-center font-bold">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(idx, item.quantity + 1)}
                            className="w-6 h-6 bg-white rounded font-bold text-slate-700 hover:bg-slate-200"
                          >
                            +
                          </button>
                        </div>

                        <div className="w-20 text-right font-bold text-slate-900">
                          ETB {(item.quantity * item.unitPrice).toLocaleString()}
                        </div>

                        <button
                          type="button"
                          onClick={() => updateCartQty(idx, 0)}
                          className="text-slate-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Section */}
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-100 space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Payment Method</span>
              
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cash', label: 'Cash' },
                  { id: 'bank_transfer', label: 'Bank Transfer' },
                  { id: 'credit', label: 'Credit / Debt' },
                ].map((pm) => {
                  const selected = paymentType === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentType(pm.id as any)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${selected ? 'bg-[#025EA7] text-white border-[#025EA7] shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      {pm.label}
                    </button>
                  );
                })}
              </div>

              {/* Cash specific */}
              {paymentType === 'cash' && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cash Received (ETB)</label>
                    <input
                      type="number"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      placeholder={grandTotal.toString()}
                      className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Change Due</span>
                    <span className="text-sm font-bold text-emerald-600">ETB {changeDue.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Advance Payment - shown for all payment types */}
              {paymentType !== 'credit' && (
                <div className="pt-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Advance / Down Payment (ETB)</label>
                  <input
                    type="number"
                    value={advancePayment}
                    onChange={(e) => setAdvancePayment(e.target.value)}
                    placeholder="0"
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              )}

              {/* Bank Transfer specific */}
              {paymentType === 'bank_transfer' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Select Bank Account</label>
                    <select
                      value={selectedBankAcc}
                      onChange={(e) => setSelectedBankAcc(e.target.value)}
                      className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                    >
                      <option value="">Select company account...</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Transaction Ref #</label>
                    <input
                      type="text"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="TXN-9847201"
                      className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={() => setShowCbeVerifier(true)}
                        className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        <Shield className="w-4 h-4" />
                        Verify Payment Receipt (Official)
                      </button>
                  </div>
                </div>
              )}

              {/* Credit / Debt specific */}
              {paymentType === 'credit' && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Advance (ETB)</label>
                      <input
                        type="number"
                        value={advancePayment}
                        onChange={(e) => setAdvancePayment(e.target.value)}
                        placeholder="0"
                        className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Payment Due Date</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full py-2 px-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">SMS Reminder</label>
                      <select
                        value={reminderDays}
                        onChange={(e) => setReminderDays(parseInt(e.target.value))}
                        className="w-full py-2 px-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                      >
                        <option value={0}>On due date</option>
                        <option value={1}>1 day before</option>
                        <option value={3}>3 days before</option>
                        <option value={7}>1 week before</option>
                        <option value={14}>2 weeks before</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-xs">
                    <span className="font-semibold text-amber-800">Remaining Credit Balance:</span>
                    <span className="font-bold text-amber-900">ETB {remainingCreditBalance.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Receipt Screenshot Uploader */}
              {paymentType === 'bank_transfer' && (
                <div className="pt-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Upload Receipt Screenshot (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptUpload}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#025EA7]"
                  />
                </div>
              )}
            </div>

            {/* VAT Option (Without VAT -15%) */}
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-slate-700 uppercase tracking-wider block">VAT Option:</span>
                <span className="text-[11px] text-slate-500">Sell without VAT invoice to reduce price by 15%</span>
              </div>
              <button
                type="button"
                onClick={() => setWithoutVat(!withoutVat)}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  withoutVat
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20 ring-2 ring-amber-400/40'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <span>{withoutVat ? '✓ Without VAT (-15% Applied)' : 'Without VAT (-15%)'}</span>
              </button>
            </div>

            {/* Discount Calculator */}
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center justify-between gap-3 text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider">Discount:</span>
              <div className="flex items-center gap-2">
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as any)}
                  className="py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                >
                  <option value="none">No Discount</option>
                  <option value="fixed">Flat Amount (ETB)</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
                {discountType !== 'none' && (
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder="0"
                    className="w-20 py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                )}
              </div>
            </div>

            {/* Summary & Submit Bar */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Subtotal ({totalItemsCount} items):</span>
                <span>ETB {subtotal.toLocaleString()}</span>
              </div>
              {withoutVat && (
                <div className="flex justify-between text-xs text-amber-400 font-semibold">
                  <span>Without VAT (-15%):</span>
                  <span>- ETB {vatDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-xs text-emerald-400">
                  <span>Discount:</span>
                  <span>- ETB {discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-white border-t border-slate-800 pt-2">
                <span>Grand Total:</span>
                <span className="text-emerald-400 text-lg">ETB {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {advPayNum > 0 && (
                <>
                  <div className="flex justify-between text-xs text-blue-300">
                    <span>Advance Paid:</span>
                    <span>ETB {advPayNum.toLocaleString()}</span>
                  </div>
                  {remainingCreditBalance > 0 && (
                    <div className="flex justify-between text-xs text-amber-300">
                      <span>Remaining Balance:</span>
                      <span>ETB {remainingCreditBalance.toLocaleString()}</span>
                    </div>
                  )}
                </>
              )}

              <button
                type="submit"
                disabled={loading || cart.length === 0}
                className="w-full py-3.5 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'Complete Sale & Issue Invoice'
                )}
              </button>
            </div>
          </form>
        )}

        <ReceiptVerificationModal
          isOpen={showCbeVerifier}
          onClose={() => setShowCbeVerifier(false)}
          onApplyReceipt={(receipt) => {
            if (receipt.reference || receipt.receiptNumber) {
              setReferenceNumber(receipt.reference || receipt.receiptNumber || '');
            }
            setShowCbeVerifier(false);
            showToast('Receipt verified and reference applied.', 'success');
          }}
        />
      </div>
    </div>
  );
}

// 2. Add Product Modal (Matching Flutter App)
interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialLocationId?: string;
  initialLocationType?: 'warehouse' | 'shop';
  initialEntryMode?: 'single' | 'bulk' | 'import';
  shops?: Shop[];
  warehouses?: Warehouse[];
  product?: Product | null;
}

export function AddProductModal({
  isOpen,
  onClose,
  onSuccess,
  initialLocationId,
  initialLocationType,
  initialEntryMode,
  shops: propShops = [],
  warehouses: propWarehouses = [],
  product = null,
}: AddProductModalProps) {
  const { user } = useAuth();
  const allowBulk = canUseBulkEntry(user);
  const allowImport = canUseProductImport(user);
  const { showToast } = useToast();
  const isEditing = !!product;
  const [entryMode, setEntryMode] = useState<'single' | 'bulk' | 'import'>('single');

  useEffect(() => {
    if (isOpen) {
      setEntryMode(isEditing || !initialEntryMode ? 'single' : initialEntryMode);
    }
  }, [isOpen, isEditing, initialEntryMode]);

  useEffect(() => {
    if (!allowBulk && entryMode === 'bulk') {
      setEntryMode('single');
    }
    if (!allowImport && entryMode === 'import') {
      setEntryMode('single');
    }
  }, [allowBulk, allowImport, entryMode]);
  const [productType, setProductType] = useState<'product' | 'service'>('product');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState('piece');
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [wholesale, setWholesale] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [commissionRate, setCommissionRate] = useState('');
  const [commissionType, setCommissionType] = useState<'percent' | 'fixed'>('percent');
  const [stockQuantity, setStockQuantity] = useState('');
  const [minStockLevel, setMinStockLevel] = useState('0');
  const [warehouseId, setWarehouseId] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [trackStock, setTrackStock] = useState(true);
  const [status, setStatus] = useState('available');

  const [supplierId, setSupplierId] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isCreatingSupplierInline, setIsCreatingSupplierInline] = useState(false);
  const [inlineSupplierName, setInlineSupplierName] = useState('');
  const [inlineSupplierPhone, setInlineSupplierPhone] = useState('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bulk Entry State (Flutter Parity)
  const createEmptyBulkRow = () => ({
    selected: false,
    name: '',
    sku: '',
    barcode: '',
    category: '',
    brand: '',
    unit: 'piece',
    cost: '',
    price: '',
    stockQuantity: '',
    minStockLevel: '0',
    expiryDate: '',
    supplierId: '',
    status: 'available',
    discount: '',
  });

  const [bulkItems, setBulkItems] = useState<Array<{
    selected?: boolean;
    name: string;
    sku: string;
    barcode: string;
    category: string;
    brand: string;
    unit: string;
    cost: string;
    price: string;
    stockQuantity: string;
    minStockLevel: string;
    expiryDate: string;
    supplierId: string;
    status: string;
    discount: string;
  }>>([
    createEmptyBulkRow(),
    createEmptyBulkRow(),
    createEmptyBulkRow(),
  ]);

  // Dynamic Categories State (Flutter Parity & User Custom Categories)
  const [availableCategories, setAvailableCategories] = useState<string[]>([
    'General',
    'Electronics',
    'Foods & Beverages',
    'Apparel & Fashion',
    'Hardware & Tools',
    'Services',
    'Pharmaceuticals',
    'Cosmetics & Beauty',
    'Retail',
  ]);

  const handleAddNewCategoryPrompt = (): string | null => {
    const newCat = window.prompt('Enter new category name:');
    if (newCat && newCat.trim()) {
      const trimmed = newCat.trim();
      if (!availableCategories.includes(trimmed)) {
        setAvailableCategories(prev => [...prev, trimmed]);
      }
      showToast(`Category "${trimmed}" added!`, 'success');
      return trimmed;
    }
    return null;
  };

  const handleRowCategoryChange = (idx: number, val: string) => {
    if (val === '__add_new__') {
      const added = handleAddNewCategoryPrompt();
      if (added) {
        const copy = [...bulkItems];
        copy[idx].category = added;
        setBulkItems(copy);
      }
      return;
    }
    const copy = [...bulkItems];
    copy[idx].category = val;
    setBulkItems(copy);
  };

  // Import File State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedImportRows, setParsedImportRows] = useState<Array<{
    selected?: boolean;
    name: string;
    sku: string;
    barcode: string;
    category: string;
    brand: string;
    unit: string;
    cost: string;
    price: string;
    stockQuantity: string;
    minStockLevel: string;
    expiryDate: string;
    supplierId: string;
    status: string;
    discount: string;
  }>>([]);

  const parseCsvText = (text: string) => {
    let content = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };
    
    const parseLine = (line: string) => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const rawHeaders = parseLine(lines[0]);
    const headers = rawHeaders.map(h => h.trim());
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = parseLine(lines[i]);
      if (cells.length === 0 || cells.every(c => !c)) continue;
      const rowMap: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowMap[h] = cells[idx] || '';
      });
      rows.push(rowMap);
    }
    return { headers, rows };
  };

  const normalizeHeaderKey = (header: string): string => {
    const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (h.includes('name') || h.includes('product') || h.includes('item') || h.includes('title')) return 'name';
    if (h.includes('bar') || h.includes('code')) return 'barcode';
    if (h.includes('brand') || h.includes('make')) return 'brand';
    if (h.includes('cat')) return 'category';
    if (h.includes('unit')) return 'unit';
    if (h.includes('sell') || h.includes('price') || h.includes('rate')) return 'price';
    if (h.includes('cost') || h.includes('buy') || h.includes('purchase')) return 'cost';
    if (h.includes('sku')) return 'sku';
    if (h.includes('stock') || h.includes('qty') || h.includes('opening')) return 'stockQuantity';
    if (h.includes('min')) return 'minStockLevel';
    if (h.includes('expir') || h.includes('exp')) return 'expiryDate';
    if (h.includes('supplier') || h.includes('vendor')) return 'supplierId';
    if (h.includes('status')) return 'status';
    return h;
  };

  const handleFileSelect = (file: File | null) => {
    setImportFile(file);
    if (!file) {
      setParsedImportRows([]);
      return;
    }

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          const parsed = jsonRows.map(raw => {
            const map: Record<string, string> = {};
            Object.keys(raw).forEach(key => {
              const normKey = normalizeHeaderKey(key);
              if (normKey) map[normKey] = String(raw[key] ?? '');
            });
            const statusVal = map['status']?.toLowerCase();
            const status = (statusVal === 'inactive' || statusVal === 'disabled') ? 'inactive' : 'available';

            return {
              selected: false,
              name: map['name'] || String(raw['product_name'] || raw['name'] || raw['product'] || raw['title'] || raw['Product Title*'] || ''),
              sku: map['sku'] || String(raw['sku'] || raw['SKU'] || ''),
              barcode: map['barcode'] || String(raw['barcode'] || raw['Barcode'] || ''),
              category: map['category'] || String(raw['category'] || raw['Category'] || 'General'),
              brand: map['brand'] || String(raw['brand'] || raw['Brand'] || ''),
              unit: map['unit'] || String(raw['unit'] || raw['Unit'] || 'piece'),
              cost: map['cost'] || String(raw['cost'] || raw['Purchase Cost (ETB)'] || ''),
              price: map['price'] || String(raw['price'] || raw['selling_price'] || raw['Selling Price (ETB)*'] || ''),
              stockQuantity: map['stockQuantity'] || String(raw['stock'] || raw['qty'] || raw['Initial Stock Qty'] || ''),
              minStockLevel: map['minStockLevel'] || String(raw['minStock'] || raw['Min Stock Alert'] || '0'),
              expiryDate: map['expiryDate'] || String(raw['expiryDate'] || raw['Expiry Date (YYYY-MM-DD)'] || ''),
              supplierId: map['supplierId'] || '',
              status,
              discount: '',
            };
          }).filter(r => r.name.trim().length > 0 || r.price.trim().length > 0);

          setParsedImportRows(parsed);
          if (parsed.length > 0) {
            showToast(`Parsed ${parsed.length} product(s) from Excel file "${file.name}"!`, 'success');
          } else {
            showToast('Excel file read successfully, but no data rows were found in sheet.', 'info');
          }
        } catch (err: any) {
          showToast('Failed to parse Excel file: ' + (err.message || 'Invalid format'), 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          const { headers, rows } = parseCsvText(text);
          const parsed = rows.map(raw => {
            const map: Record<string, string> = {};
            Object.keys(raw).forEach(key => {
              const normKey = normalizeHeaderKey(key);
              if (normKey) map[normKey] = raw[key];
            });
            const statusVal = map['status']?.toLowerCase();
            const status = (statusVal === 'inactive' || statusVal === 'disabled') ? 'inactive' : 'available';

            return {
              selected: false,
              name: map['name'] || raw['product_name'] || raw['name'] || raw['product'] || raw['title'] || '',
              sku: map['sku'] || raw['sku'] || '',
              barcode: map['barcode'] || raw['barcode'] || '',
              category: map['category'] || raw['category'] || 'General',
              brand: map['brand'] || raw['brand'] || '',
              unit: map['unit'] || raw['unit'] || 'piece',
              cost: map['cost'] || raw['cost'] || '',
              price: map['price'] || raw['price'] || raw['selling_price'] || '',
              stockQuantity: map['stockQuantity'] || raw['stock'] || raw['qty'] || '',
              minStockLevel: map['minStockLevel'] || raw['minStock'] || '0',
              expiryDate: map['expiryDate'] || raw['expiryDate'] || '',
              supplierId: map['supplierId'] || '',
              status,
              discount: '',
            };
          }).filter(r => r.name.trim().length > 0 || r.price.trim().length > 0);

          setParsedImportRows(parsed);
          if (parsed.length > 0) {
            showToast(`Parsed ${parsed.length} product(s) from "${file.name}"!`, 'success');
          } else {
            showToast('File read successfully, but no valid product rows were found.', 'info');
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const handleTransferImportToBulk = () => {
    if (parsedImportRows.length === 0) {
      showToast('No parsed rows to edit in bulk entry mode', 'error');
      return;
    }
    setBulkItems(parsedImportRows);
    setEntryMode('bulk');
    showToast(`Transferred ${parsedImportRows.length} items to Bulk Entry grid!`, 'success');
  };

  useEffect(() => {
    if (isOpen) {
      if (propWarehouses.length > 0) setWarehouses(propWarehouses);
      if (propShops.length > 0) setShops(propShops);

      Promise.all([
        api.getWarehouses(500).catch(() => []),
        api.getShops(500).catch(() => []),
        api.getSuppliers().catch(() => [])
      ]).then(([whRes, shopRes, supRes]) => {
        const allWh = whRes.length > 0 ? whRes : propWarehouses;
        const allShops = shopRes.length > 0 ? shopRes : propShops;
        setWarehouses(allWh);
        setShops(allShops);
        setSuppliers(supRes);
        if (!product && supRes.length > 0) setSupplierId(supRes[0].id);

        if (!product) {
          if (initialLocationId && initialLocationType === 'warehouse' && allWh.some(w => w.id === initialLocationId)) {
            setSelectedLocation(`warehouse:${initialLocationId}`);
            setWarehouseId(initialLocationId);
          } else if (initialLocationId && initialLocationType === 'shop' && allShops.some(s => s.id === initialLocationId)) {
            setSelectedLocation(`shop:${initialLocationId}`);
          } else if (allWh.length > 0) {
            setSelectedLocation(`warehouse:${allWh[0].id}`);
            setWarehouseId(allWh[0].id);
          } else if (allShops.length > 0) {
            setSelectedLocation(`shop:${allShops[0].id}`);
          } else {
            setSelectedLocation('all');
          }
        }
      });
    }
  }, [isOpen, initialLocationId, initialLocationType, propWarehouses, propShops, product]);

  // Prefill form when editing an existing product
  useEffect(() => {
    if (isOpen && product) {
      const meta = product.metadata || {};
      setEntryMode('single');
      setProductType((product.type as 'product' | 'service') || 'product');
      setName(product.name || '');
      setCategory(product.category || '');
      setBrand(meta.brand != null ? String(meta.brand) : '');
      setSku(product.sku || '');
      setUnit(product.unit || 'piece');
      setBarcode(product.barcode || '');
      setDescription(product.description || '');
      setCost(product.cost != null ? String(product.cost) : (product.costPrice != null ? String(product.costPrice) : ''));
      setPrice(product.price != null ? String(product.price) : '');
      setWholesale(meta.wholesale != null ? String(meta.wholesale) : '');
      setDiscount(meta.discount != null ? String(meta.discount) : '');
      setDiscountType(meta.discountType === 'fixed' ? 'fixed' : 'percent');
      setCommissionRate(product.commissionRate != null ? String(product.commissionRate) : '');
      setCommissionType(product.commissionType === 'fixed' ? 'fixed' : 'percent');
      setStockQuantity(product.stockQuantity != null ? String(product.stockQuantity) : '');
      setMinStockLevel(product.minStockLevel != null ? String(product.minStockLevel) : '0');
      setExpiryDate(product.expiryDate ? String(product.expiryDate).substring(0, 10) : '');
      setReminderDate(product.reminderDate ? String(product.reminderDate).substring(0, 10) : '');
      setTrackStock(product.trackStock !== false);
      setStatus(product.status === 'inactive' || product.status === 'disabled' ? 'inactive' : 'available');
      setSupplierId(product.supplierId || '');
      setError(null);
    }
  }, [isOpen, product]);

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setUnit('piece');
    setIsCustomUnit(false);
    setBrand('');
    setSku('');
    setBarcode('');
    setDescription('');
    setCost('');
    setPrice('');
    setWholesale('');
    setDiscount('');
    setDiscountType('percent');
    setCommissionRate('');
    setCommissionType('percent');
    setStockQuantity('');
    setMinStockLevel('0');
    setExpiryDate('');
    setReminderDate('');
    setInlineSupplierName('');
    setInlineSupplierPhone('');
    setIsCreatingSupplierInline(false);
    setBulkItems([
      createEmptyBulkRow(),
      createEmptyBulkRow(),
      createEmptyBulkRow(),
    ]);
    setImportFile(null);
    setParsedImportRows([]);
  };

  const handleSave = async (e: React.FormEvent, continueAdding = false) => {
    e.preventDefault();
    if (!name.trim() || !price) {
      setError('Product title and selling price are required');
      return;
    }
    setError(null);
    setLoading(true);

    let activeSupplierId = supplierId;

    try {
      if ((isCreatingSupplierInline || (!activeSupplierId && suppliers.length === 0)) && inlineSupplierName.trim()) {
        const newSup = await api.createSupplier({
          name: inlineSupplierName.trim(),
          contact: inlineSupplierPhone.trim() || '0000000000',
        });
        activeSupplierId = newSup.id;
        setSuppliers((prev) => [...prev, newSup]);
        setSupplierId(newSup.id);
      }

      if (isEditing && product) {
        await api.updateProduct(product.id, {
          type: productType,
          name: name.trim(),
          category: category.trim(),
          brand,
          sku: sku || undefined,
          unit,
          barcode,
          description,
          cost: cost || '0',
          price,
          wholesale,
          discount: discount || '0',
          discountType,
          commissionRate: commissionRate || '0',
          commissionType,
          stockQuantity: stockQuantity || '0',
          minStockLevel: minStockLevel || '0',
          supplierId: activeSupplierId || undefined,
          expiryDate,
          reminderDate,
          trackStock,
          status,
        });

        showToast(`Product "${name}" updated successfully!`, 'success');
        if (onSuccess) onSuccess();
        onClose();
        resetForm();
        return;
      }

      let targetWarehouseIds: string[] = [];
      let targetShopIds: string[] = [];
      if (initialLocationId && initialLocationType === 'shop') {
        targetShopIds = [initialLocationId];
      } else if (initialLocationId && initialLocationType === 'warehouse') {
        targetWarehouseIds = [initialLocationId];
      } else if (selectedLocation.startsWith('warehouse:')) {
        targetWarehouseIds = [selectedLocation.replace('warehouse:', '')];
      } else if (selectedLocation.startsWith('shop:')) {
        targetShopIds = [selectedLocation.replace('shop:', '')];
      } else if (warehouseId) {
        targetWarehouseIds = [warehouseId];
      }

      await api.createProduct({
        type: productType,
        name: name.trim(),
        category: category.trim(),
        brand,
        sku: sku || `SKU-${Math.floor(Math.random() * 90000 + 10000)}`,
        unit,
        barcode,
        description,
        cost: cost || '0',
        price,
        wholesale,
        discount: discount || '0',
        discountType,
        commissionRate: commissionRate || '0',
        commissionType,
        stockQuantity: stockQuantity || '0',
        minStockLevel: minStockLevel || '0',
        warehouseIds: targetWarehouseIds,
        shopIds: targetShopIds,
        supplierId: activeSupplierId || undefined,
        expiryDate,
        reminderDate,
        trackStock,
        status,
      });

      showToast(`Product "${name}" saved successfully!`, 'success');
      if (onSuccess) onSuccess();

      if (continueAdding) {
        resetForm();
      } else {
        onClose();
        resetForm();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  const generateSkuForRow = (idx: number) => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 900 + 100);
    const newSku = `PRD-${timestamp}${random}`;
    const copy = [...bulkItems];
    copy[idx].sku = newSku;
    setBulkItems(copy);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        showToast('Clipboard is empty', 'error');
        return;
      }
      const lines = text.trim().split('\n').filter(l => l.trim());
      if (lines.length === 0) return;

      const newRows = lines.map(line => {
        const cells = line.split('\t');
        return {
          selected: false,
          name: cells[0]?.trim() || '',
          sku: cells[1]?.trim() || '',
          barcode: cells[2]?.trim() || '',
          category: cells[3]?.trim() || 'General',
          brand: cells[4]?.trim() || '',
          unit: cells[5]?.trim() || 'piece',
          cost: cells[6]?.trim() || '',
          price: cells[7]?.trim() || '',
          stockQuantity: cells[8]?.trim() || '',
          minStockLevel: cells[9]?.trim() || '0',
          expiryDate: cells[10]?.trim() || '',
          supplierId: cells[11]?.trim() || '',
          status: cells[12]?.trim()?.toLowerCase() === 'inactive' ? 'inactive' : 'available',
          discount: cells[13]?.trim() || '',
        };
      });

      setBulkItems(prev => [...prev.filter(r => r.name.trim()), ...newRows]);
      showToast(`Pasted ${newRows.length} product rows from clipboard!`, 'success');
    } catch (err) {
      showToast('Clipboard access denied or empty', 'error');
    }
  };

  const handleExportTemplate = () => {
    const headers = [
      'Product Title*',
      'Category',
      'Brand',
      'Unit',
      'Purchase Cost (ETB)',
      'Selling Price (ETB)*',
      'Initial Stock Qty',
      'Min Stock Alert',
      'Expiry Date (YYYY-MM-DD)',
      'SKU',
      'Barcode',
      'Status'
    ];

    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      ws['!cols'] = headers.map(h => ({ wch: Math.max(String(h).length + 4, 18) }));
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory Template');
      XLSX.writeFile(wb, 'inventory_import_template.xlsx');
      showToast('Downloaded empty Excel template (inventory_import_template.xlsx)!', 'success');
    } catch (err) {
      const formatCell = (val: any) => {
        const s = String(val ?? '');
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      const csvContent = headers.map(formatCell).join(',');

      const encodedUri = 'data:text/csv;charset=utf-8,%EF%BB%BF' + encodeURIComponent(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', 'inventory_import_template.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Downloaded empty template CSV (inventory_import_template.csv)!', 'success');
    }
  };

  const handleDuplicateSelected = () => {
    const selected = bulkItems.filter(i => i.selected);
    if (selected.length === 0) {
      showToast('Select at least one row to duplicate', 'error');
      return;
    }
    const duplicated = selected.map(i => ({ ...i, selected: false, sku: '' }));
    setBulkItems(prev => [...prev, ...duplicated]);
    showToast(`Duplicated ${selected.length} row(s)!`, 'success');
  };

  const handleDeleteSelected = () => {
    const selected = bulkItems.filter(i => i.selected);
    if (selected.length === 0) {
      showToast('Select at least one row to delete', 'error');
      return;
    }
    setBulkItems(prev => prev.filter(i => !i.selected));
    showToast(`Deleted ${selected.length} row(s)!`, 'success');
  };

  const handleSaveBulk = async () => {
    const validItems = bulkItems.filter(b => b.name.trim() && b.price.trim());
    if (validItems.length === 0) {
      setError('Please enter at least one product name and price');
      return;
    }

    setLoading(true);
    setError(null);

    let targetWarehouseIds: string[] = [];
    let targetShopIds: string[] = [];
    if (initialLocationId && initialLocationType === 'shop') {
      targetShopIds = [initialLocationId];
    } else if (initialLocationId && initialLocationType === 'warehouse') {
      targetWarehouseIds = [initialLocationId];
    } else if (selectedLocation.startsWith('warehouse:')) {
      targetWarehouseIds = [selectedLocation.replace('warehouse:', '')];
    } else if (selectedLocation.startsWith('shop:')) {
      targetShopIds = [selectedLocation.replace('shop:', '')];
    } else if (warehouseId) {
      targetWarehouseIds = [warehouseId];
    }

    try {
      let created = 0;
      for (const item of validItems) {
        await api.createProduct({
          type: 'product',
          name: item.name.trim(),
          price: item.price,
          cost: item.cost || '0',
          sku: item.sku || `SKU-${Math.floor(Math.random() * 90000 + 10000)}`,
          barcode: item.barcode || undefined,
          category: item.category || 'General',
          brand: item.brand || undefined,
          unit: item.unit || 'piece',
          stockQuantity: item.stockQuantity || '0',
          minStockLevel: item.minStockLevel || '0',
          expiryDate: item.expiryDate || undefined,
          supplierId: item.supplierId || supplierId || undefined,
          status: item.status || 'available',
          discount: item.discount || '0',
          warehouseIds: targetWarehouseIds,
          shopIds: targetShopIds,
          trackStock: true,
        });
        created++;
      }
      showToast(`Successfully created ${created} products in target storage location!`, 'success');
      if (onSuccess) onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Failed to bulk import products');
    } finally {
      setLoading(false);
    }
  };

  const handleImportSubmit = async () => {
    if (parsedImportRows.length === 0 && !importFile) {
      setError('Please select an Excel or CSV template file');
      return;
    }
    const itemsToImport = parsedImportRows.length > 0 ? parsedImportRows : bulkItems.filter(b => b.name.trim() && b.price.trim());
    if (itemsToImport.length === 0) {
      setError('No valid product rows found to import. Please select a file with valid headers.');
      return;
    }

    setLoading(true);
    setError(null);

    let targetWarehouseIds: string[] = [];
    let targetShopIds: string[] = [];
    if (initialLocationId && initialLocationType === 'shop') {
      targetShopIds = [initialLocationId];
    } else if (initialLocationId && initialLocationType === 'warehouse') {
      targetWarehouseIds = [initialLocationId];
    } else if (selectedLocation.startsWith('warehouse:')) {
      targetWarehouseIds = [selectedLocation.replace('warehouse:', '')];
    } else if (selectedLocation.startsWith('shop:')) {
      targetShopIds = [selectedLocation.replace('shop:', '')];
    } else if (warehouseId) {
      targetWarehouseIds = [warehouseId];
    }

    let targetLocationLabel = 'All Locations';
    if (selectedLocation.startsWith('warehouse:')) {
      const wh = warehouses.find(w => w.id === selectedLocation.replace('warehouse:', ''));
      if (wh) targetLocationLabel = `Warehouse · ${wh.name}`;
    } else if (selectedLocation.startsWith('shop:')) {
      const sh = shops.find(s => s.id === selectedLocation.replace('shop:', ''));
      if (sh) targetLocationLabel = `Shop · ${sh.name}`;
    }

    try {
      let created = 0;
      for (const item of itemsToImport) {
        if (!item.name.trim()) continue;
        await api.createProduct({
          type: 'product',
          name: item.name.trim(),
          price: item.price || '0',
          cost: item.cost || '0',
          sku: item.sku || `SKU-${Math.floor(Math.random() * 90000 + 10000)}`,
          barcode: item.barcode || undefined,
          category: item.category || 'General',
          brand: item.brand || undefined,
          unit: item.unit || 'piece',
          stockQuantity: item.stockQuantity || '0',
          minStockLevel: item.minStockLevel || '0',
          expiryDate: item.expiryDate || undefined,
          supplierId: item.supplierId || supplierId || undefined,
          status: item.status || 'available',
          discount: item.discount || '0',
          warehouseIds: targetWarehouseIds,
          shopIds: targetShopIds,
          trackStock: true,
        });
        created++;
      }
      showToast(`Successfully imported ${created} products into ${targetLocationLabel}!`, 'success');
      if (onSuccess) onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Failed to import products');
    } finally {
      setLoading(false);
    }
  };

  const unitsList = ['piece', 'kg', 'g', 'mg', 'lb', 'oz', 'liter', 'ml', 'gal', 'box', 'pack', 'pair', 'set', 'roll', 'bag', 'bottle', 'can'];
  const categoriesList = ['General', 'Electronics', 'Retail', 'Foods & Beverages', 'Apparel', 'Hardware', 'Services', 'Pharmaceuticals'];

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#025EA7]" />
            <h3 className="text-base font-bold text-slate-900">{isEditing ? 'Edit Product' : 'Add Product to Inventory'}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Entry Mode Switcher (Subscription Plan Tier Restrictions) */}
        {!isEditing && (!allowBulk && !allowImport ? (
          <div className="flex items-center justify-between p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl mb-5 text-xs text-blue-900">
            <div className="flex items-center gap-2 font-bold">
              <Package className="w-4 h-4 text-[#025EA7]" />
              <span>Single Product Entry (Small Business Plan)</span>
            </div>
            <span className="text-[10px] text-blue-700 bg-white px-2.5 py-0.5 rounded-full border border-blue-200 font-medium">
              Bulk entry & importing available on Medium & Large plans
            </span>
          </div>
        ) : allowBulk && !allowImport ? (
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => setEntryMode('single')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                entryMode === 'single' ? 'bg-[#025EA7] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-4 h-4" /> Single Product
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('bulk')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                entryMode === 'bulk' ? 'bg-[#025EA7] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tag className="w-4 h-4" /> Bulk Entry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => setEntryMode('single')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                entryMode === 'single' ? 'bg-[#025EA7] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-4 h-4" /> Single Product
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('bulk')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                entryMode === 'bulk' ? 'bg-[#025EA7] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tag className="w-4 h-4" /> Bulk Entry
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('import')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                entryMode === 'import' ? 'bg-[#025EA7] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UploadCloud className="w-4 h-4" /> Import Excel / PDF
            </button>
          </div>
        ))}

        {error && (
          <div className="mb-4 p-2.5 bg-red-50 text-red-600 text-xs rounded-xl font-medium text-center border border-red-100">
            {error}
          </div>
        )}

        {/* MODE 1: SINGLE PRODUCT ENTRY */}
        {entryMode === 'single' && (
          <form className="space-y-4">
            {/* Product Type Switcher */}
            <div className="flex gap-3 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setProductType('product')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${productType === 'product' ? 'bg-white text-[#025EA7] shadow-sm' : 'text-slate-500'}`}
              >
                Physical Product
              </button>
              <button
                type="button"
                onClick={() => setProductType('service')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${productType === 'service' ? 'bg-white text-[#025EA7] shadow-sm' : 'text-slate-500'}`}
              >
                Service / Non-Inventory
              </button>
            </div>

            {/* Section 1: Basic Information */}
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Basic Information</h4>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Samsung Galaxy S24 Ultra"
                  className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700">Supplier *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingSupplierInline(!isCreatingSupplierInline);
                      if (!isCreatingSupplierInline) setSupplierId('');
                    }}
                    className="text-[11px] font-bold text-[#025EA7] hover:underline flex items-center gap-1"
                  >
                    {isCreatingSupplierInline ? '← Select Existing Supplier' : '+ Create New Supplier'}
                  </button>
                </div>

                {isCreatingSupplierInline ? (
                  <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl space-y-2">
                    <span className="text-[10px] font-bold text-[#025EA7] uppercase block">New Supplier Details</span>
                    <input
                      type="text"
                      required
                      value={inlineSupplierName}
                      onChange={(e) => setInlineSupplierName(e.target.value)}
                      placeholder="Supplier Name (e.g. ABC Wholesalers) *"
                      className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7]"
                    />
                    <input
                      type="text"
                      value={inlineSupplierPhone}
                      onChange={(e) => setInlineSupplierPhone(e.target.value)}
                      placeholder="Phone / Contact Number (Optional)"
                      className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7]"
                    />
                  </div>
                ) : suppliers.length > 0 ? (
                  <select
                    required
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name} {sup.companyName ? `(${sup.companyName})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                    <div className="text-xs text-amber-800 font-medium">
                      ⚠️ No suppliers registered yet. Fill in new supplier details:
                    </div>
                    <input
                      type="text"
                      required
                      value={inlineSupplierName}
                      onChange={(e) => setInlineSupplierName(e.target.value)}
                      placeholder="Supplier Name *"
                      className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                    />
                    <input
                      type="text"
                      value={inlineSupplierPhone}
                      onChange={(e) => setInlineSupplierPhone(e.target.value)}
                      placeholder="Phone / Contact Number (Optional)"
                      className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Category (Optional)</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                  >
                    <option value="">Select Category (Optional)</option>
                    {categoriesList.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Brand</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Samsung"
                    className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-700">Unit of Measurement</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomUnit(!isCustomUnit);
                        if (!isCustomUnit && unitsList.includes(unit)) {
                          setUnit('');
                        } else if (isCustomUnit && !unit) {
                          setUnit('piece');
                        }
                      }}
                      className="text-[10px] font-semibold text-[#025EA7] hover:underline"
                    >
                      {isCustomUnit ? 'Choose from list' : '+ Add custom unit'}
                    </button>
                  </div>
                  {isCustomUnit ? (
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="e.g. bundle, carton, dozen, sack"
                      className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                    />
                  ) : (
                    <select
                      value={unitsList.includes(unit) ? unit : (unit ? unit : '__custom__')}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsCustomUnit(true);
                          setUnit('');
                        } else {
                          setUnit(e.target.value);
                        }
                      }}
                      className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                    >
                      {unitsList.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                      {!unitsList.includes(unit) && unit && (
                        <option value={unit}>{unit}</option>
                      )}
                      <option value="__custom__">+ Add Custom Unit...</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">SKU Code</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Auto-generated if empty"
                    className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Barcode</label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Barcode / EAN string"
                    className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Item specification or notes..."
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                />
              </div>
            </div>

            {/* Section 2: Pricing, Margin & Discount */}
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Pricing & Margin (ETB)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cost Price (Optional)</label>
                  <input
                    type="number"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0"
                    className="w-full py-2.5 px-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Selling Price *</label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="100"
                    className="w-full py-2.5 px-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Wholesale Price</label>
                  <input
                    type="number"
                    value={wholesale}
                    onChange={(e) => setWholesale(e.target.value)}
                    placeholder="90"
                    className="w-full py-2.5 px-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Discount</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder={discountType === 'percent' ? '10' : '50'}
                      className="flex-1 min-w-0 py-2.5 px-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                    />
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
                      className="py-2.5 px-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-[#025EA7] focus:outline-none shrink-0"
                    >
                      <option value="percent">%</option>
                      <option value="fixed">ETB</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Commission Value</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(e.target.value)}
                    placeholder={commissionType === 'percent' ? '5' : '25'}
                    className="flex-1 min-w-0 py-2.5 px-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                  />
                  <select
                    value={commissionType}
                    onChange={(e) => setCommissionType(e.target.value as 'percent' | 'fixed')}
                    className="py-2.5 px-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-[#025EA7] focus:outline-none shrink-0"
                  >
                    <option value="percent">%</option>
                    <option value="fixed">ETB</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Stock Quantity & Expiry */}
            {productType === 'product' && (
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Inventory, Location & Expiry</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Initial Stock Qty</label>
                    <input
                      type="number"
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(e.target.value)}
                      placeholder="0"
                      className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Min Stock Alert Level</label>
                    <input
                      type="number"
                      value={minStockLevel}
                      onChange={(e) => setMinStockLevel(e.target.value)}
                      placeholder="5"
                      className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Storage Location (Warehouse or Shop)</label>
                    {initialLocationId && initialLocationType === 'shop' ? (
                      <div className="py-2.5 px-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-[#025EA7] flex items-center gap-2">
                        <Box className="w-4 h-4 shrink-0 text-[#025EA7]" />
                        <span>Adding to Shop: {shops.find((s) => s.id === initialLocationId)?.name || 'Selected Shop'} (Only)</span>
                      </div>
                    ) : initialLocationId && initialLocationType === 'warehouse' ? (
                      <div className="py-2.5 px-3 bg-green-50 border border-green-200 rounded-xl text-xs font-bold text-green-700 flex items-center gap-2">
                        <Building className="w-4 h-4 shrink-0 text-green-600" />
                        <span>Adding to Warehouse: {warehouses.find((w) => w.id === initialLocationId)?.name || 'Selected Warehouse'} (Only)</span>
                      </div>
                    ) : (
                      <select
                        value={selectedLocation}
                        onChange={(e) => {
                          setSelectedLocation(e.target.value);
                          if (e.target.value.startsWith('warehouse:')) {
                            setWarehouseId(e.target.value.replace('warehouse:', ''));
                          } else {
                            setWarehouseId('');
                          }
                        }}
                        className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                      >
                        <option value="">-- General Catalog (Unassigned) --</option>
                        {warehouses.length > 0 && (
                          <optgroup label="🏬 Warehouses">
                            {warehouses.map((wh) => (
                              <option key={wh.id} value={`warehouse:${wh.id}`}>{wh.name}</option>
                            ))}
                          </optgroup>
                        )}
                        {shops.length > 0 && (
                          <optgroup label="🏪 Retail Shops">
                            {shops.map((sh) => (
                              <option key={sh.id} value={`shop:${sh.id}`}>{sh.name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold text-slate-700">Expiry Date (Optional)</label>
                      {expiryDate && (
                        <button
                          type="button"
                          onClick={() => { setExpiryDate(''); setReminderDate(''); }}
                          className="text-[10px] text-red-500 hover:text-red-700 font-semibold"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Track perishable goods and auto-alert expired items</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold text-slate-700">Expiry Reminder Date (Optional)</label>
                      {reminderDate && (
                        <button
                          type="button"
                          onClick={() => setReminderDate('')}
                          className="text-[10px] text-red-500 hover:text-red-700 font-semibold"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <input
                      type="date"
                      value={reminderDate}
                      onChange={(e) => setReminderDate(e.target.value)}
                      disabled={!expiryDate}
                      max={expiryDate || undefined}
                      className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#025EA7] focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Pre-expiry notification alert date</p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {!isEditing && (
                <button
                  type="button"
                  onClick={(e) => handleSave(e, true)}
                  disabled={loading}
                  className="flex-1 py-3 border border-[#025EA7] text-[#025EA7] font-bold rounded-xl text-xs hover:bg-blue-50 transition-all flex items-center justify-center gap-1.5"
                >
                  Save & Add Another
                </button>
              )}
              <button
                type="button"
                onClick={(e) => handleSave(e, false)}
                disabled={loading}
                className="flex-1 py-3 bg-[#025EA7] text-white font-bold rounded-xl text-xs shadow-md hover:bg-[#014883] transition-all flex items-center justify-center gap-1.5"
              >
                {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Product'}
              </button>
            </div>
          </form>
        )}

        {/* MODE 2: BULK ENTRY TABLE (Flutter App Parity) */}
        {entryMode === 'bulk' && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl text-xs text-blue-900 font-medium flex items-center justify-between gap-2">
              <div>💡 <strong>Bulk Product Entry:</strong> Enter multiple products in table rows below, paste Excel clipboard data, or import template files.</div>
            </div>

            {/* Target Storage Location Specification */}
            <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#025EA7]" /> Storage Location Specification (Warehouse or Shop) *
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => {
                  setSelectedLocation(e.target.value);
                  if (e.target.value.startsWith('warehouse:')) {
                    setWarehouseId(e.target.value.replace('warehouse:', ''));
                  } else {
                    setWarehouseId('');
                  }
                }}
                className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
              >
                <option value="all">🌐 All Warehouses & Shops</option>
                {warehouses.length > 0 && (
                  <optgroup label="🏬 Warehouses">
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={`warehouse:${wh.id}`}>{wh.name}</option>
                    ))}
                  </optgroup>
                )}
                {shops.length > 0 && (
                  <optgroup label="🏪 Retail Shops">
                    {shops.map((sh) => (
                      <option key={sh.id} value={`shop:${sh.id}`}>{sh.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Flutter Toolbar Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-100/80 rounded-2xl border border-slate-200/80">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setBulkItems([...bulkItems, createEmptyBulkRow()])}
                  className="py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-[#025EA7] text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </button>
                <button
                  type="button"
                  onClick={() => handleAddNewCategoryPrompt()}
                  className="py-1.5 px-3 bg-white border border-slate-200 hover:bg-purple-50 text-purple-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                  title="Add custom product category"
                >
                  <Plus className="w-3.5 h-3.5 text-purple-600" /> Add Category
                </button>
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                  title="Paste tabular text from Excel or Google Sheets"
                >
                  <Copy className="w-3.5 h-3.5 text-blue-600" /> Paste Clipboard
                </button>
                <button
                  type="button"
                  onClick={handleExportTemplate}
                  className="py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                  title="Export bulk CSV template file"
                >
                  <FileCode className="w-3.5 h-3.5 text-emerald-600" /> Export Template
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDuplicateSelected}
                  disabled={!bulkItems.some(i => i.selected)}
                  className="py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-40 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                >
                  <Repeat className="w-3.5 h-3.5" /> Duplicate Selected
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={!bulkItems.some(i => i.selected)}
                  className="py-1.5 px-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Selected
                </button>
              </div>
            </div>

            {/* Bulk Entry Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[50vh] shadow-2xs">
              <table className="w-full text-xs text-left min-w-[1100px]">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5 text-center w-10">
                      <input
                        type="checkbox"
                        checked={bulkItems.length > 0 && bulkItems.every(i => i.selected)}
                        onChange={(e) => setBulkItems(bulkItems.map(i => ({ ...i, selected: e.target.checked })))}
                        className="rounded border-slate-300 text-[#025EA7] focus:ring-[#025EA7]"
                      />
                    </th>
                    <th className="p-2.5 w-10">#</th>
                    <th className="p-2.5 min-w-[180px]">Product Title *</th>
                    <th className="p-2.5 min-w-[150px]">Category</th>
                    <th className="p-2.5 min-w-[110px]">Brand</th>
                    <th className="p-2.5 min-w-[90px]">Unit</th>
                    <th className="p-2.5 min-w-[110px]">Cost (Optional)</th>
                    <th className="p-2.5 min-w-[110px]">Selling Price *</th>
                    <th className="p-2.5 min-w-[100px]">Initial Qty</th>
                    <th className="p-2.5 min-w-[100px]">Min Alert</th>
                    <th className="p-2.5 min-w-[120px]">Expiry Date</th>
                    <th className="p-2.5 min-w-[130px]">Supplier</th>
                    <th className="p-2.5 min-w-[100px]">Status</th>
                    <th className="p-2.5 text-center w-12">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium bg-white">
                  {bulkItems.map((item, idx) => (
                    <tr key={idx} className={`hover:bg-blue-50/30 ${item.selected ? 'bg-blue-50/50' : ''}`}>
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!item.selected}
                          onChange={(e) => {
                            const copy = [...bulkItems];
                            copy[idx].selected = e.target.checked;
                            setBulkItems(copy);
                          }}
                          className="rounded border-slate-300 text-[#025EA7] focus:ring-[#025EA7]"
                        />
                      </td>
                      <td className="p-2.5 text-slate-400 font-bold text-center">{idx + 1}</td>
                      
                      {/* Product Title */}
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => {
                            const copy = [...bulkItems];
                            copy[idx].name = e.target.value;
                            setBulkItems(copy);
                          }}
                          placeholder="Product title *"
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                        />
                      </td>

                      {/* Category Dropdown with Add Option */}
                      <td className="p-2">
                        <select
                          value={item.category || 'General'}
                          onChange={(e) => handleRowCategoryChange(idx, e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                        >
                          {availableCategories.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                          <option value="__add_new__">➕ Add New Category...</option>
                        </select>
                      </td>

                      {/* Brand */}
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.brand}
                          onChange={(e) => {
                            const copy = [...bulkItems];
                            copy[idx].brand = e.target.value;
                            setBulkItems(copy);
                          }}
                          placeholder="Brand"
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                        />
                      </td>

                      {/* Unit */}
                      <td className="p-2">
                        <select
                          value={item.unit}
                          onChange={(e) => {
                            const copy = [...bulkItems];
                            copy[idx].unit = e.target.value;
                            setBulkItems(copy);
                          }}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                        >
                          {['piece', 'kg', 'g', 'mg', 'lb', 'oz', 'liter', 'ml', 'gal', 'box', 'pack', 'pair', 'set', 'roll', 'bag', 'bottle', 'can'].map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </td>

                      {/* Purchase Cost */}
                      <td className="p-2">
                        <input
                          type="number"
                          value={item.cost}
                          onChange={(e) => {
                            const copy = [...bulkItems];
                            copy[idx].cost = e.target.value;
                            setBulkItems(copy);
                          }}
                          placeholder="0 (optional)"
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                        />
                      </td>

                      {/* Selling Price */}
                      <td className="p-2">
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => {
                            const copy = [...bulkItems];
                            copy[idx].price = e.target.value;
                            setBulkItems(copy);
                          }}
                          placeholder="0 *"
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                        />
                      </td>

                      {/* Stock Quantity */}
                      <td className="p-2">
                        <input
                          type="number"
                          value={item.stockQuantity}
                          onChange={(e) => {
                            const copy = [...bulkItems];
                            copy[idx].stockQuantity = e.target.value;
                            setBulkItems(copy);
                          }}
                          placeholder="0"
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                        />
                      </td>

                      {/* Min Stock Alert Level */}
                      <td className="p-2">
                        <input
                          type="number"
                          value={item.minStockLevel}
                          onChange={(e) => {
                            const copy = [...bulkItems];
                            copy[idx].minStockLevel = e.target.value;
                            setBulkItems(copy);
                          }}
                          placeholder="0"
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                        />
                      </td>

                      {/* Expiry Date */}
                      <td className="p-2">
                        <input
                          type="date"
                          value={item.expiryDate}
                          onChange={(e) => {
                            const copy = [...bulkItems];
                            copy[idx].expiryDate = e.target.value;
                            setBulkItems(copy);
                          }}
                          className="w-full p-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                        />
                      </td>

                      {/* Supplier */}
                      <td className="p-2">
                        <select
                          value={item.supplierId}
                          onChange={(e) => {
                            const copy = [...bulkItems];
                            copy[idx].supplierId = e.target.value;
                            setBulkItems(copy);
                          }}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                        >
                          <option value="">Default Supplier</option>
                          {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </td>

                      {/* Status */}
                      <td className="p-2">
                        <select
                          value={item.status}
                          onChange={(e) => {
                            const copy = [...bulkItems];
                            copy[idx].status = e.target.value;
                            setBulkItems(copy);
                          }}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                        >
                          <option value="available">Available</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>

                      {/* Delete Action */}
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => setBulkItems(bulkItems.filter((_, i) => i !== idx))}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Footer Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBulkItems([...bulkItems, createEmptyBulkRow()])}
                className="w-full sm:w-auto py-2.5 px-4 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Plus className="w-4 h-4 text-[#025EA7]" /> Add Row
              </button>
              <button
                type="button"
                onClick={handleSaveBulk}
                disabled={loading}
                className="w-full sm:w-auto py-3 px-7 bg-[#025EA7] text-white text-xs font-bold rounded-xl hover:bg-[#014883] shadow-md transition-all active:scale-[0.99]"
              >
                {loading ? 'Saving Products...' : 'Save All Bulk Products'}
              </button>
            </div>
          </div>
        )}

        {/* MODE 3: IMPORT EXCEL / CSV / PDF */}
        {entryMode === 'import' && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs text-emerald-900 flex items-start justify-between gap-3">
              <div>
                <div className="font-bold flex items-center gap-1.5 text-emerald-950 text-xs mb-0.5">
                  <FileCode className="w-4 h-4 text-emerald-600" /> Excel / CSV Template Import
                </div>
                <p className="text-[11px] text-emerald-800">
                  Upload your formatted inventory sheet to import hundreds of items instantly into your selected warehouse or shop.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportTemplate}
                className="py-1.5 px-3 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold shrink-0 transition-colors shadow-2xs flex items-center gap-1"
              >
                <FileCode className="w-3.5 h-3.5 text-emerald-600" /> Template CSV
              </button>
            </div>

            {/* Target Storage Location Selector Box (Flutter Parity) */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-[#025EA7]" />
                <span className="text-xs font-bold text-slate-800">Target Storage Location:</span>
              </div>
              <select
                value={selectedLocation}
                onChange={(e) => {
                  setSelectedLocation(e.target.value);
                  if (e.target.value.startsWith('warehouse:')) {
                    setWarehouseId(e.target.value.replace('warehouse:', ''));
                  }
                }}
                className="py-1.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#025EA7] focus:outline-none min-w-[200px]"
              >
                <option value="all">🌐 All Locations (Warehouses & Shops)</option>
                {warehouses.length > 0 && (
                  <optgroup label="🏬 Warehouses">
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={`warehouse:${wh.id}`}>Warehouse · {wh.name}</option>
                    ))}
                  </optgroup>
                )}
                {shops.length > 0 && (
                  <optgroup label="🏪 Retail Shops">
                    {shops.map((sh) => (
                      <option key={sh.id} value={`shop:${sh.id}`}>Shop · {sh.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* File Dropzone / Banner */}
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center bg-slate-50/50 hover:border-blue-400 transition-colors">
              <UploadCloud className="w-10 h-10 text-[#025EA7] mx-auto mb-2" />
              <div className="text-xs font-bold text-slate-800">
                {importFile ? importFile.name : 'Drag and drop your document file here, or click to browse'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {parsedImportRows.length > 0 ? `${parsedImportRows.length} product items parsed successfully` : 'Supports .csv and tabular text format'}
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                className="hidden"
                id="file-import-input"
              />
              <label
                htmlFor="file-import-input"
                className="mt-3 inline-block py-2 px-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer shadow-sm hover:bg-slate-50"
              >
                {importFile ? 'Change File' : 'Browse File'}
              </label>
            </div>

            {/* Parsed Data Preview Table */}
            {parsedImportRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Parsed Products Preview ({parsedImportRows.length} items)
                  </span>
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Import
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[220px]">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-2 w-8 text-center">#</th>
                        <th className="p-2">Title</th>
                        <th className="p-2">SKU</th>
                        <th className="p-2">Category</th>
                        <th className="p-2">Price (ETB)</th>
                        <th className="p-2">Stock Qty</th>
                        <th className="p-2">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {parsedImportRows.slice(0, 50).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 text-center text-slate-400 font-semibold">{idx + 1}</td>
                          <td className="p-2 font-bold text-slate-800">{row.name || '-'}</td>
                          <td className="p-2 text-slate-600">{row.sku || '-'}</td>
                          <td className="p-2 text-slate-600">{row.category || 'General'}</td>
                          <td className="p-2 font-bold text-[#025EA7]">{row.price || '0'}</td>
                          <td className="p-2 font-semibold text-slate-700">{row.stockQuantity || '0'}</td>
                          <td className="p-2 text-slate-500">{row.unit || 'piece'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleTransferImportToBulk}
                disabled={parsedImportRows.length === 0}
                className="w-full sm:w-auto py-2.5 px-4 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-[#025EA7] rounded-xl text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Tag className="w-4 h-4" /> Edit in Bulk Entry Mode ({parsedImportRows.length})
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-4 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImportSubmit}
                  disabled={loading || (parsedImportRows.length === 0 && !importFile)}
                  className="py-2.5 px-6 bg-[#025EA7] text-white text-xs font-bold rounded-xl hover:bg-[#014883] shadow-md disabled:opacity-40 transition-all"
                >
                  {loading ? 'Importing Products...' : 'Upload & Import Products'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// 3. Staff Modal
interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onOpenPermissions?: (staff: StaffMember, isNew: boolean) => void;
  shops?: Shop[];
  warehouses?: Warehouse[];
}

export function StaffModal({ isOpen, onClose, onSuccess, onOpenPermissions, shops = [], warehouses = [] }: AddStaffModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('Staff');
  const [role, setRole] = useState('user');
  const [authMethod, setAuthMethod] = useState('password');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [branchAssignment, setBranchAssignment] = useState('');

  const staffRoles = [
    { title: 'Staff', role: 'user' },
    { title: 'Manager', role: 'manager' },
    { title: 'Admin', role: 'company_admin' },
    { title: 'Storekeeper', role: 'warehouse_employee' },
  ];

  useEffect(() => {
    if (isOpen) {
      setName('');
      setPhone('');
      setJobTitle('Staff');
      setRole('user');
      setAuthMethod('password');
      setPassword('');
      setPin('');
      setShowPassword(false);
      setBranchAssignment('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const branchOptions = [
    ...shops.map(s => ({ id: `shop:${s.id}`, label: `Shop — ${s.name}`, shopId: s.id, warehouseId: undefined })),
    ...warehouses.map(w => ({ id: `warehouse:${w.id}`, label: `Warehouse — ${w.name}`, shopId: undefined, warehouseId: w.id })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) { showToast('Please enter the staff member name', 'error'); return; }
    const phoneClean = phone.replace(/\D/g, '');
    if (!phoneClean) { showToast('Please enter a phone number', 'error'); return; }
    let normalizedPhone = phoneClean;
    if (/^[79]\d{8}$/.test(normalizedPhone)) {
      normalizedPhone = '0' + normalizedPhone;
    }
    if (!/^0[79]\d{8}$/.test(normalizedPhone)) {
      showToast('Please enter a valid 10-digit Ethiopian phone number (e.g. 09xxxxxxxx or 07xxxxxxxx)', 'error');
      return;
    }
    if (authMethod === 'password' && password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    if (authMethod === 'pin' && pin.length !== 4) { showToast('PIN must be exactly 4 digits', 'error'); return; }
    if (role !== 'company_admin' && !branchAssignment) { showToast('Please assign a store/warehouse branch', 'error'); return; }

    setLoading(true);
    try {
      const phoneNum = normalizedPhone;
      const selected = branchOptions.find(b => b.id === branchAssignment);

      const res = await api.createEmployee({
        name: name.trim(),
        phoneNumber: phoneNum,
        jobTitle,
        role,
        authMethod,
        ...(authMethod === 'password' ? { password } : { pin }),
        ...(selected?.shopId ? { shopId: selected.shopId } : {}),
        ...(selected?.warehouseId ? { warehouseId: selected.warehouseId } : {}),
      });

      const newStaffObj: StaffMember = {
        id: res?.id || `staff-${Date.now()}`,
        name: name.trim(),
        firstName: name.trim().split(' ')[0] || name.trim(),
        lastName: name.trim().split(' ').slice(1).join(' '),
        phone: phoneNum,
        phoneNumber: phoneNum,
        role: role || 'user',
        jobTitle: jobTitle || 'Staff',
        shopId: selected?.shopId,
        shopName: selected?.shopId ? shops.find(s => s.id === selected.shopId)?.name : '',
        warehouseId: selected?.warehouseId,
        warehouseName: selected?.warehouseId ? warehouses.find(w => w.id === selected.warehouseId)?.name : '',
        authMethod: authMethod === 'pin' ? 'PIN' : 'Password',
        assignedPassword: authMethod === 'password' ? password : '',
        assignedPin: authMethod === 'pin' ? pin : '',
        salesAmount: 0,
        isOwner: false,
      };

      showToast('Staff member added successfully!', 'success');
      if (onSuccess) onSuccess();
      onClose();

      if (onOpenPermissions) {
        onOpenPermissions(newStaffObj, true);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to add staff member', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#025EA7] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Add Staff</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter staff member name"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Phone Number *</label>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="09xxxxxxxx"
              maxLength={10}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">10 digits, numbers only (e.g. 09xxxxxxxx or 07xxxxxxxx)</p>
          </div>

          {/* Job Title / Role */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Job Title / Role *</label>
            <select
              value={jobTitle}
              onChange={(e) => {
                const sel = staffRoles.find(r => r.title === e.target.value);
                if (sel) { setJobTitle(sel.title); setRole(sel.role); }
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none"
            >
              {staffRoles.map(r => (
                <option key={r.role} value={r.title}>{r.title}</option>
              ))}
            </select>
          </div>

          {/* Auth Method */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Authentication Method</label>
            <select
              value={authMethod}
              onChange={(e) => setAuthMethod(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none"
            >
              <option value="password">Password Login</option>
              <option value="pin">4-Digit PIN</option>
            </select>
          </div>

          {/* Password or PIN */}
          {authMethod === 'password' ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Password * (min 6 chars)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px] font-bold"
                >
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">4-Digit PIN *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="Enter 4-digit PIN"
                  maxLength={4}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px] font-bold"
                >
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>
          )}

          {/* Branch Assignment */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Assigned Store / Warehouse {role !== 'company_admin' ? '*' : '(Optional)'}
            </label>
            <select
              value={branchAssignment}
              onChange={(e) => setBranchAssignment(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none"
            >
              <option value="">Select branch...</option>
              {branchOptions.map(b => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
            {branchOptions.length === 0 && (
              <p className="text-[10px] text-amber-600 mt-1 font-medium">No stores or warehouses found. Create one first.</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? 'Adding...' : 'Add Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 3b. Edit Staff Modal
interface EditStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  staff: StaffMember | null;
  shops?: Shop[];
  warehouses?: Warehouse[];
}

export function EditStaffModal({ isOpen, onClose, onSuccess, staff, shops = [], warehouses = [] }: EditStaffModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('Staff');
  const [role, setRole] = useState('user');
  const [authMethod, setAuthMethod] = useState('password');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [branchAssignment, setBranchAssignment] = useState('');

  const staffRoles = [
    { title: 'Staff', role: 'user' },
    { title: 'Manager', role: 'manager' },
    { title: 'Admin', role: 'company_admin' },
    { title: 'Storekeeper', role: 'warehouse_employee' },
  ];

  useEffect(() => {
    if (isOpen && staff) {
      setName(staff.name || `${staff.firstName} ${staff.lastName}`.trim());
      let cleanPhone = (staff.phone || staff.phoneNumber || '').replace(/\D/g, '');
      if (cleanPhone.startsWith('251')) cleanPhone = '0' + cleanPhone.slice(3);
      if (/^[79]\d{8}$/.test(cleanPhone)) cleanPhone = '0' + cleanPhone;
      if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);
      setPhone(cleanPhone);
      setJobTitle(staff.jobTitle || 'Staff');
      setRole(staff.role || 'user');
      setAuthMethod(staff.authMethod?.toLowerCase() === 'pin' ? 'pin' : 'password');
      setPassword(staff.assignedPassword || '');
      setPin(staff.assignedPin || '');
      setShowPassword(false);
      setConfirmDelete(false);

      if (staff.shopId) {
        setBranchAssignment(`shop:${staff.shopId}`);
      } else if (staff.warehouseId) {
        setBranchAssignment(`warehouse:${staff.warehouseId}`);
      } else {
        setBranchAssignment('');
      }
    }
  }, [isOpen, staff]);

  if (!isOpen || !staff) return null;

  let permsObj: any = staff.permissions;
  if (typeof permsObj === 'string') {
    try { permsObj = JSON.parse(permsObj); } catch (_) { permsObj = {}; }
  }
  let empBranchPerms = permsObj?.branchPermissions || (staff as any).branchPermissions;
  if (typeof empBranchPerms === 'string') {
    try { empBranchPerms = JSON.parse(empBranchPerms); } catch (_) { empBranchPerms = {}; }
  }
  const hasEmpPerms = empBranchPerms && typeof empBranchPerms === 'object' && Object.keys(empBranchPerms).length > 0;
  let allowedShops = shops;
  let allowedWarehouses = warehouses;
  if (hasEmpPerms) {
    const allowedShopIds = new Set<string>();
    const allowedWarehouseIds = new Set<string>();
    if (staff.shopId) allowedShopIds.add(staff.shopId);
    if (staff.warehouseId) allowedWarehouseIds.add(staff.warehouseId);
    for (const [bId, access] of Object.entries(empBranchPerms)) {
      if (access && typeof access === 'object') {
        if ((access as any).shop === true || (access as any).shop === 'true') allowedShopIds.add(bId);
        if ((access as any).warehouse === true || (access as any).warehouse === 'true') allowedWarehouseIds.add(bId);
      } else if (access === true || access === 'true') {
        allowedShopIds.add(bId);
        allowedWarehouseIds.add(bId);
      }
    }
    if (allowedShopIds.size > 0 || allowedWarehouseIds.size > 0) {
      allowedShops = shops.filter(s => allowedShopIds.has(s.id));
      allowedWarehouses = warehouses.filter(w => allowedWarehouseIds.has(w.id));
    }
  }

  const branchOptions = [
    ...allowedShops.map(s => ({ id: `shop:${s.id}`, label: `Shop — ${s.name}`, shopId: s.id, warehouseId: undefined })),
    ...allowedWarehouses.map(w => ({ id: `warehouse:${w.id}`, label: `Warehouse — ${w.name}`, shopId: undefined, warehouseId: w.id })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) { showToast('Please enter staff member name', 'error'); return; }
    const phoneClean = phone.replace(/\D/g, '');
    if (!phoneClean) { showToast('Please enter a phone number', 'error'); return; }
    let normalizedPhone = phoneClean;
    if (/^[79]\d{8}$/.test(normalizedPhone)) {
      normalizedPhone = '0' + normalizedPhone;
    }
    if (!/^0[79]\d{8}$/.test(normalizedPhone)) {
      showToast('Please enter a valid 10-digit Ethiopian phone number (e.g. 09xxxxxxxx or 07xxxxxxxx)', 'error');
      return;
    }
    if (authMethod === 'password' && password && password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    if (authMethod === 'pin' && pin && pin.length !== 4) { showToast('PIN must be exactly 4 digits', 'error'); return; }

    setLoading(true);
    try {
      const phoneNum = normalizedPhone;
      const selected = branchOptions.find(b => b.id === branchAssignment);

      await api.updateEmployee(staff.id, {
        name: name.trim(),
        phoneNumber: phoneNum,
        jobTitle,
        role,
        authMethod,
        ...(authMethod === 'password' && password ? { password } : {}),
        ...(authMethod === 'pin' && pin ? { pin } : {}),
        ...(selected?.shopId ? { shopId: selected.shopId } : {}),
        ...(selected?.warehouseId ? { warehouseId: selected.warehouseId } : {}),
      });

      showToast('Staff member updated successfully!', 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to update staff member', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteEmployee(staff.id);
      showToast('Staff member removed successfully', 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove staff member', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#025EA7] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Edit Staff Details</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Full Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter staff member name"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Phone Number *</label>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="09xxxxxxxx"
              maxLength={10}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">10 digits, numbers only (e.g. 09xxxxxxxx or 07xxxxxxxx)</p>
          </div>

          {/* Job Title / Role */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Job Title / Role *</label>
            <select
              value={jobTitle}
              onChange={(e) => {
                const sel = staffRoles.find(r => r.title === e.target.value);
                if (sel) { setJobTitle(sel.title); setRole(sel.role); }
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none"
            >
              {staffRoles.map(r => (
                <option key={r.role} value={r.title}>{r.title}</option>
              ))}
            </select>
          </div>

          {/* Auth Method */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Authentication Method</label>
            <select
              value={authMethod}
              onChange={(e) => setAuthMethod(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none"
            >
              <option value="password">Password Login</option>
              <option value="pin">4-Digit PIN</option>
            </select>
          </div>

          {/* Password or PIN */}
          {authMethod === 'password' ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Password (Leave blank to keep unchanged)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px] font-bold"
                >
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">4-Digit PIN (Leave blank to keep unchanged)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="Enter 4-digit PIN"
                  maxLength={4}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px] font-bold"
                >
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>
          )}

          {/* Branch Assignment */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Assigned Store / Warehouse {role !== 'company_admin' ? '*' : '(Optional)'}
            </label>
            <select
              value={branchAssignment}
              onChange={(e) => setBranchAssignment(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-[#025EA7]/20 focus:border-[#025EA7] outline-none"
            >
              <option value="">Select branch...</option>
              {branchOptions.map(b => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </div>

          {confirmDelete ? (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs space-y-2">
              <p className="font-bold text-red-900">Are you sure you want to delete this staff member?</p>
              <p className="text-red-700">This action cannot be undone.</p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-1.5 bg-white border border-red-200 text-slate-700 rounded-lg font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-1.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-xs"
                >
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="px-3.5 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete Staff
              </button>
              <div className="flex gap-2 flex-1 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// 4. Branch Modal
export function BranchModal({ isOpen, onClose, onSuccess }: ModalProps) {
  const { showToast } = useToast();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form fields
  const [branchName, setBranchName] = useState('');
  const [branchLocation, setBranchLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const shps = await api.getShops().catch(() => []);
      setShops(shps);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchBranches();
      setShowAddForm(false);
      setBranchName('');
      setBranchLocation('');
      setError(null);
    }
  }, [isOpen, fetchBranches]);

  if (!isOpen) return null;

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) {
      setError('Please enter a branch name');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.createShop({
        name: branchName.trim(),
        location: branchLocation.trim() || 'Retail Branch',
      });
      showToast(`Branch "${branchName.trim()}" created successfully!`, 'success');

      setBranchName('');
      setBranchLocation('');
      setShowAddForm(false);
      await fetchBranches();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create branch');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Building className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-none">Branch Locations</h3>
              <p className="text-[11px] text-slate-400 font-medium mt-1">
                {shops.length} Retail Shop branch{shops.length !== 1 ? 'es' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!showAddForm && (
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(true);
                  setError(null);
                }}
                className="py-1.5 px-3 bg-[#025EA7] hover:bg-[#014883] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add Branch</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 stroke-[2]" />
            </button>
          </div>
        </div>

        {/* Add Branch Inline Form */}
        {showAddForm && (
          <div className="mb-4 p-4 bg-slate-50 border border-blue-200/80 rounded-2xl animate-fade-in space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-[#025EA7]" />
                <span>Create New Retail Branch</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

            {error && (
              <div className="p-2.5 bg-rose-50 text-rose-700 text-xs rounded-xl font-semibold text-center border border-rose-100">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateBranch} className="space-y-3">
              {/* Branch Name Input */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Branch Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="e.g. shop10 / Bole Branch"
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                />
              </div>

              {/* Location Input */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Location / Address (Optional)
                </label>
                <input
                  type="text"
                  value={branchLocation}
                  onChange={(e) => setBranchLocation(e.target.value)}
                  placeholder="e.g. Bole Medhanialem, Building B"
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
                />
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-[0.99]"
                >
                  {submitting ? 'Creating...' : 'Save Branch'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Branch List */}
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 animate-pulse font-medium">
            Loading branches...
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto pr-1 flex-1">
            <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Retail Shops</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            </div>
            {shops.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 italic bg-slate-50 rounded-2xl border border-slate-100">
                No retail shops registered.
              </div>
            ) : (
              <div className="space-y-2">
                {shops.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 bg-slate-50 hover:bg-blue-50/40 rounded-2xl border border-slate-100 hover:border-blue-200 flex items-center justify-between transition-all group"
                  >
                    <div>
                      <div className="text-xs font-extrabold text-slate-900 group-hover:text-[#025EA7] transition-colors">
                        {s.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                        {s.location || 'Retail Branch'} {s.managerName ? `• Manager: ${s.managerName}` : ''}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-100/80 rounded-lg border border-emerald-200/60">
                      Shop
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center gap-2 pt-4 mt-2 border-t border-slate-100">
          {!showAddForm && (
            <button
              type="button"
              onClick={() => {
                setShowAddForm(true);
                setError(null);
              }}
              className="flex-1 py-2.5 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99]"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Branch</span>
            </button>
          )}
          <button
            onClick={onClose}
            className={`${
              showAddForm ? 'w-full' : 'w-28'
            } py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// 5. Upgrade & Renewal Plan Modal (Payment Proof Verification)
export function UpgradePlanModal({ isOpen, onClose }: ModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<'Telebirr' | 'CBE'>('Telebirr');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [plans, setPlans] = useState<Array<{ id: string; title: string; price: string; amount: number; period: string }>>([
    { id: 'small', title: 'Small Business', price: '7,999', amount: 7999, period: 'small' },
    { id: 'medium', title: 'Medium Business', price: '10,999', amount: 10999, period: 'medium' },
    { id: 'large', title: 'Large Business', price: '15,999', amount: 15999, period: 'large' },
  ]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('large');
  const [companyCount, setCompanyCount] = useState<number>(1);
  const [loadingPlan, setLoadingPlan] = useState<boolean>(false);

  const isSubscriptionExpired =
    user?.status === 'EXPIRED' ||
    (user?.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).getTime() < Date.now() : false);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0] || {
    id: 'large',
    title: 'Large Business',
    amount: 15999,
    period: 'large',
  };

  const totalPrice = (selectedPlan.amount || 0) * companyCount;

  useEffect(() => {
    if (isOpen) {
      setLoadingPlan(true);

      Promise.all([
        api.getPlans().catch(() => []),
        api.getCompanies().catch(() => []),
      ]).then(([apiPlans, companies]) => {
        const numCompanies = Math.max(1, Array.isArray(companies) ? companies.length : 1);
        setCompanyCount(numCompanies);

        if (Array.isArray(apiPlans) && apiPlans.length > 0) {
          const parsed = apiPlans.map((p: any) => ({
            id: p.id || p.period || 'plan',
            title: p.title || 'Plan',
            price: String(p.price || p.amount || 0),
            amount: p.amount || parseInt(String(p.price || 0).replace(/,/g, '')) || 0,
            period: p.period || '1_year',
          }));
          setPlans(parsed);

          // Select matching user plan, or 1-year as default
          const matching = parsed.find(
            (p: any) => p.period === user?.planPeriod || p.id === user?.planId
          );
          if (matching) {
            setSelectedPlanId(matching.id);
          } else {
            const yr = parsed.find((p: any) => String(p.period).includes('year'));
            setSelectedPlanId(yr ? yr.id : parsed[0].id);
          }
        }
      }).finally(() => setLoadingPlan(false));
    } else {
      setSelectedMethod('Telebirr');
      setScreenshotFile(null);
      setScreenshotPreview(null);
      setIsUploading(false);
    }
  }, [isOpen, user?.planPeriod, user?.planId]);

  if (!isOpen) return null;

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} (${text}) copied to clipboard!`, 'success');
  };

  const handleSubmit = async () => {
    if (!screenshotFile) {
      showToast('Please select a payment method and attach the payment screenshot', 'error');
      return;
    }

    setIsUploading(true);
    try {
      let screenshotUrl = '';
      try {
        const res = await api.uploadPaymentProof(screenshotFile);
        screenshotUrl = res.url || '';
      } catch {
        screenshotUrl = `proof_${Date.now()}`;
      }

      const paymentRef = `SUB_${selectedPlan.period.toUpperCase()}_${Date.now()}`;
      await api.renewSubscription({
        phone: user?.phone || '',
        planId: selectedPlan.id,
        planTitle: selectedPlan.title,
        planAmount: totalPrice,
        planPeriod: selectedPlan.period,
        paymentMethod: selectedMethod,
        paymentRef,
        paymentScreenshot: screenshotUrl,
      });

      showToast('Payment proof uploaded! Subscription renewal submitted for admin verification.', 'success');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to submit payment verification request', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-blue-50 text-[#025EA7] rounded-xl flex items-center justify-center font-bold shrink-0">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div className="text-left">
              <h3 className="text-base font-bold text-[#0F2A47]">
                {isSubscriptionExpired ? 'Renew Subscription' : 'Renew or Upgrade Plan'}
              </h3>
              <p className="text-xs text-slate-500">Choose your plan, pay via Telebirr or CBE, and submit proof</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subscription Status Banner */}
        {isSubscriptionExpired ? (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-950 rounded-xl mb-4 text-left flex items-start gap-2.5 shadow-2xs">
            <div className="w-5 h-5 rounded-full bg-rose-200 text-rose-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">!</div>
            <div className="text-xs">
              <span className="font-bold">Subscription Expired: </span>
              <span>Your subscription period has ended. Select a plan below and upload your payment receipt to restore full access.</span>
            </div>
          </div>
        ) : user?.subscriptionExpiresAt ? (
          <div className="p-3 bg-blue-50/70 border border-blue-100 text-blue-950 rounded-xl mb-4 text-left flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Current: <strong className="font-bold text-slate-900">{user.planTitle || 'Active Plan'}</strong></span>
            </div>
            <span className="text-slate-500 text-[11px]">
              Expires: {new Date(user.subscriptionExpiresAt).toLocaleDateString()}
            </span>
          </div>
        ) : null}

        {/* Plan Selection Cards */}
        <div className="mb-4 text-left">
          <label className="block text-xs font-bold text-slate-900 mb-2">Select Subscription Plan</label>
          <div className="grid grid-cols-3 gap-2">
            {plans.map((p) => {
              const isSelected = p.id === selectedPlanId;
              const isYearly = String(p.period).includes('year') || String(p.title).toLowerCase().includes('year');
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`relative p-3 rounded-xl border text-center cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#025EA7] bg-blue-50/50 shadow-xs ring-1 ring-[#025EA7]'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  {(p.id === 'large' || p.period === 'large') && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#025EA7] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider whitespace-nowrap">
                      Includes Web App
                    </span>
                  )}
                  <div>
                    <div className="text-[11px] font-bold text-slate-800 line-clamp-1">{p.title}</div>
                    <div className="text-xs font-extrabold text-[#025EA7] mt-1">
                      ETB {p.amount.toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-500 font-medium">
                    {p.id === 'small' || p.period === 'small' ? (
                      <span>3 Stores • 3 Shops • 3 Staff</span>
                    ) : p.id === 'medium' || p.period === 'medium' ? (
                      <span className="text-emerald-700 font-semibold">5 Stores • 5 Shops • Bulk</span>
                    ) : (
                      <span className="text-indigo-700 font-bold">Unlimited • Full Web App</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Price Calculation Banner */}
        <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Selected: <strong className="text-slate-900">{selectedPlan.title}</strong></span>
            <span className="text-slate-700 font-bold">ETB {loadingPlan ? '...' : selectedPlan.amount.toLocaleString()} / company</span>
          </div>
          <div className="mt-2 pt-2 border-t border-blue-200/50 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Companies to license:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCompanyCount(prev => Math.max(1, prev - 1))}
                className="w-6 h-6 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold flex items-center justify-center hover:bg-slate-100 transition-colors shadow-2xs"
                title="Decrease company count"
              >
                -
              </button>
              <span className="text-xs font-extrabold text-[#025EA7] min-w-[20px] text-center">
                {loadingPlan ? '...' : companyCount}
              </span>
              <button
                type="button"
                onClick={() => setCompanyCount(prev => prev + 1)}
                className="w-6 h-6 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold flex items-center justify-center hover:bg-slate-100 transition-colors shadow-2xs"
                title="Increase company count"
              >
                +
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-blue-200/50">
            <span className="text-xs font-bold text-slate-900">Total Renewal Amount</span>
            <span className="text-base font-extrabold text-[#025EA7]">
              {loadingPlan ? '...' : `ETB ${totalPrice.toLocaleString()}`}
            </span>
          </div>
        </div>

        {/* Payment Method Options */}
        <div className="space-y-2 mb-4 text-left">
          <label className="block text-xs font-bold text-slate-900">Select Payment Method</label>

          {/* Telebirr Card */}
          <div
            onClick={() => setSelectedMethod('Telebirr')}
            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
              selectedMethod === 'Telebirr'
                ? 'bg-blue-50/70 border-[#025EA7] shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100/80 text-[#025EA7] flex items-center justify-center shrink-0 font-bold">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-slate-900">Telebirr</div>
                <div className="text-slate-500 text-[11px]">Name: Possible Tech PLC</div>
                <div className="flex items-center gap-1 text-[#025EA7] font-bold text-[11px] mt-0.5">
                  <span>Phone: 0911578793</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard('0911578793', 'Telebirr Phone');
                    }}
                    className="p-1 hover:bg-blue-100 rounded text-[#025EA7] transition-all"
                    title="Copy Phone Number"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selectedMethod === 'Telebirr' ? 'border-[#025EA7] bg-[#025EA7]' : 'border-slate-300'
            }`}>
              {selectedMethod === 'Telebirr' && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
          </div>

          {/* CBE Card */}
          <div
            onClick={() => setSelectedMethod('CBE')}
            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
              selectedMethod === 'CBE'
                ? 'bg-blue-50/70 border-[#025EA7] shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100/80 text-[#025EA7] flex items-center justify-center shrink-0 font-bold">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-slate-900">CBE (Commercial Bank of Ethiopia)</div>
                <div className="text-slate-500 text-[11px]">Name: Possible Tech PLC</div>
                <div className="flex items-center gap-1 text-[#025EA7] font-bold text-[11px] mt-0.5">
                  <span>Account: 1000301736537</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard('1000301736537', 'CBE Account');
                    }}
                    className="p-1 hover:bg-blue-100 rounded text-[#025EA7] transition-all"
                    title="Copy Account Number"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selectedMethod === 'CBE' ? 'border-[#025EA7] bg-[#025EA7]' : 'border-slate-300'
            }`}>
              {selectedMethod === 'CBE' && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
          </div>
        </div>

        {/* Upload Screenshot Dropzone */}
        <div className="space-y-1.5 mb-5 text-left">
          <label className="block text-xs font-bold text-slate-900">Upload Payment Screenshot *</label>

          <label className={`block relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
            screenshotPreview ? 'border-[#025EA7] bg-blue-50/20' : 'border-slate-300 hover:border-[#025EA7] bg-slate-50/50 hover:bg-slate-50'
          }`}>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />

            {screenshotPreview ? (
              <div className="space-y-2">
                <img
                  src={screenshotPreview}
                  alt="Payment Proof"
                  className="max-h-36 mx-auto rounded-lg object-contain shadow-xs border border-slate-200"
                />
                <div className="text-[11px] font-bold text-[#025EA7] flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{screenshotFile?.name}</span>
                </div>
                <div className="text-[10px] text-slate-400">Click to replace screenshot</div>
              </div>
            ) : (
              <div className="py-2 space-y-1">
                <UploadCloud className="w-7 h-7 text-slate-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-700">Click or drag to upload payment screenshot</div>
                <div className="text-[10px] text-slate-400">PNG, JPG, or JPEG (Max 10MB)</div>
              </div>
            )}
          </label>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isUploading || !screenshotFile}
            onClick={handleSubmit}
            className="flex-1 py-2.5 bg-[#025EA7] hover:bg-[#014883] disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
          >
            {isUploading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Uploading Proof...</span>
              </>
            ) : (
              <span>Submit for Verification</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// 6. Store Detail Modal (Warehouse / Shop Detail View)
interface StoreDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'warehouse' | 'shop';
  item: Warehouse | Shop | null;
  catalogProducts: Product[];
  staffList: StaffMember[];
  onRefresh?: () => void;
  onNavigateToAddProducts?: (
    locationId?: string,
    locationType?: 'warehouse' | 'shop',
    entryMode?: 'single' | 'bulk' | 'import',
  ) => void;
  onEditProduct?: (p: Product) => void;
}

export function StoreDetailModal({
  isOpen,
  onClose,
  type,
  item,
  catalogProducts,
  staffList,
  onRefresh,
  onNavigateToAddProducts,
  onEditProduct,
}: StoreDetailModalProps) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const allowBulk = canUseBulkEntry(user);
  const allowImport = canUseProductImport(user);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProdId, setSelectedProdId] = useState('');
  const [addQty, setAddQty] = useState<number | string>(1);
  const [submitting, setSubmitting] = useState(false);
  const [selectedStoreProduct, setSelectedStoreProduct] = useState<Product | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && item?.id) {
      setLoading(true);
      setSelectedStoreProduct(null);
      setSearch('');
      setBrandFilter(null);
      const fetcher =
        type === 'warehouse'
          ? api.getWarehouseProducts(item.id)
          : api.getShopProducts(item.id);
      fetcher
        .then((res) => setProducts(res))
        .catch(() => setProducts([]))
        .finally(() => setLoading(false));
    }
  }, [isOpen, item?.id, type]);

  if (!isOpen || !item) return null;

  const title = item.name;
  const location = item.location || (type === 'warehouse' ? 'Main Storage' : 'Retail Branch');
  const isWarehouse = type === 'warehouse';

  const brandOf = (p: Product) =>
    String((p.metadata && (p.metadata.brand ?? p.metadata.Brand)) || '').trim();
  const availableBrands = Array.from(new Set(products.map(brandOf).filter(Boolean))).sort();
  const searchTerm = search.trim().toLowerCase();
  const filteredProducts = products.filter((p) => {
    if (brandFilter && brandOf(p).toLowerCase() !== brandFilter.toLowerCase()) return false;
    if (!searchTerm) return true;
    return [p.name, p.sku, p.barcode, p.category, brandOf(p)]
      .some((value) => String(value || '').toLowerCase().includes(searchTerm));
  });

  const handleAttachProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalQty = typeof addQty === 'number' ? addQty : (parseInt(addQty) || 1);
    if (!selectedProdId || finalQty <= 0) return;
    setSubmitting(true);
    try {
      if (isWarehouse) {
        await api.attachProductToWarehouse(item.id, selectedProdId, finalQty);
      } else {
        await api.attachProductToShop(item.id, selectedProdId, finalQty);
      }
      showToast(`Product attached to ${title}!`, 'success');
      setShowAddForm(false);
      setSelectedProdId('');
      setAddQty(1);

      const updated = isWarehouse
        ? await api.getWarehouseProducts(item.id)
        : await api.getShopProducts(item.id);
      setProducts(updated);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to attach product to location', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveProduct = async (p: Product) => {
    if (!window.confirm(`Remove "${p.name}" from this ${type}?`)) return;
    try {
      if (isWarehouse) {
        await api.detachProductFromWarehouse(item.id, p.id);
      } else {
        await api.detachProductFromShop(item.id, p.id);
      }
      showToast(`"${p.name}" removed from ${title}.`, 'success');
      if (selectedStoreProduct?.id === p.id) setSelectedStoreProduct(null);
      const updated = isWarehouse
        ? await api.getWarehouseProducts(item.id)
        : await api.getShopProducts(item.id);
      setProducts(updated);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove product from location', 'error');
    }
  };

  const locationStaff = staffList.filter((s) => {
    if (s.active === false || s.isOwner) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isWarehouse ? 'bg-blue-50 text-[#025EA7]' : 'bg-emerald-50 text-emerald-600'}`}>
              {isWarehouse ? <Building className="w-5 h-5" /> : <Tag className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase ${isWarehouse ? 'bg-blue-100 text-[#025EA7]' : 'bg-emerald-100 text-emerald-700'}`}>
                  {isWarehouse ? 'Warehouse' : 'Retail Shop'}
                </span>
              </div>
              <p className="text-xs text-slate-500">{location} • Manager: {item.managerName || 'Unassigned'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Staff in Location */}
        <div className="mb-5 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#025EA7]" /> Staff Roster in Location
            </span>
            <span className="text-[11px] text-slate-400 font-semibold">{locationStaff.length} Members</span>
          </div>
          {locationStaff.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No specific staff assigned.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {locationStaff.map((st) => (
                <div key={st.id} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>{st.firstName} {st.lastName} ({st.role})</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product Detail Panel */}
        {selectedStoreProduct && (
          <div className="mb-5 p-4 bg-blue-50/70 border border-blue-200/80 rounded-xl animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#025EA7]" /> Product Details
              </h5>
              <button onClick={() => setSelectedStoreProduct(null)} className="text-slate-400 hover:text-slate-600 p-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {[
                ['Name', selectedStoreProduct.name],
                ['SKU', selectedStoreProduct.sku || 'N/A'],
                ['Category', selectedStoreProduct.category || 'General'],
                ['Selling Price', `ETB ${(Number(selectedStoreProduct.price) || 0).toLocaleString()}`],
                ['Cost Price', `ETB ${(Number(selectedStoreProduct.cost ?? (selectedStoreProduct as any).costPrice ?? (selectedStoreProduct as any).purchasePrice) || 0).toLocaleString()}`],
                ['Stock Qty', `${selectedStoreProduct.stockQuantity} ${selectedStoreProduct.unit || 'units'}`],
                ['Min Stock', String(selectedStoreProduct.minStockLevel || 0)],
                ['Unit', selectedStoreProduct.unit || 'piece'],
                ['Status', selectedStoreProduct.status || 'active'],
                ['Barcode', selectedStoreProduct.barcode || 'N/A'],
                ...(selectedStoreProduct.description ? [['Description', selectedStoreProduct.description]] : []),
                ...(selectedStoreProduct.expiryDate ? [['Expiry', selectedStoreProduct.expiryDate]] : []),
                ...(selectedStoreProduct.metadata?.brand ? [['Brand', selectedStoreProduct.metadata.brand as string]] : []),
                ...(selectedStoreProduct.metadata?.wholesale ? [['Wholesale', `ETB ${selectedStoreProduct.metadata.wholesale}`]] : []),
                ...(selectedStoreProduct.metadata?.discount ? [['Discount', `${selectedStoreProduct.metadata.discount} ${selectedStoreProduct.metadata?.discountType === 'fixed' ? 'ETB' : '%'}`]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-blue-100/50 last:border-0">
                  <span className="text-[11px] text-slate-500">{label}</span>
                  <span className="text-[11px] font-bold text-slate-900 text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Products in Location Header */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h4 className="text-sm font-bold text-slate-900">Products & Inventory Quantities</h4>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setAddMenuOpen((v) => !v)}
                className="py-1.5 px-3 bg-[#025EA7] hover:bg-[#014883] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add Product
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {addMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAddMenuOpen(false);
                        onClose();
                        if (onNavigateToAddProducts) onNavigateToAddProducts(item.id, type, 'single');
                      }}
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
                      disabled={!allowBulk}
                      onClick={() => {
                        if (!allowBulk) return;
                        setAddMenuOpen(false);
                        onClose();
                        if (onNavigateToAddProducts) onNavigateToAddProducts(item.id, type, 'bulk');
                      }}
                      className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition ${
                        allowBulk ? 'hover:bg-blue-50' : 'opacity-60 cursor-not-allowed'
                      }`}
                    >
                      {allowBulk ? (
                        <Tag className="w-4 h-4 text-[#7C3AED] mt-0.5 shrink-0" />
                      ) : (
                        <Lock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      )}
                      <span>
                        <span className="block text-xs font-bold text-slate-900">Bulk Entry</span>
                        <span className="block text-[10px] text-slate-500">
                          {allowBulk ? 'Paste rows from a spreadsheet' : 'Requires Medium or Large plan'}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={!allowImport}
                      onClick={() => {
                        if (!allowImport) return;
                        setAddMenuOpen(false);
                        onClose();
                        if (onNavigateToAddProducts) onNavigateToAddProducts(item.id, type, 'import');
                      }}
                      className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition ${
                        allowImport ? 'hover:bg-blue-50' : 'opacity-60 cursor-not-allowed'
                      }`}
                    >
                      {allowImport ? (
                        <UploadCloud className="w-4 h-4 text-[#16A34A] mt-0.5 shrink-0" />
                      ) : (
                        <Lock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      )}
                      <span>
                        <span className="block text-xs font-bold text-slate-900">Import Excel / CSV</span>
                        <span className="block text-[10px] text-slate-500">
                          {allowImport ? 'Upload a file or export the template' : 'Requires Large plan'}
                        </span>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Search & Brand Filter */}
        {!loading && products.length > 0 && (
          <div className="mb-3 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, brand, SKU, category..."
                className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#025EA7] bg-white text-slate-800"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {availableBrands.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setBrandFilter(null)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition ${
                    brandFilter === null
                      ? 'bg-[#025EA7] border-[#025EA7] text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                  }`}
                >
                  All Brands
                </button>
                {availableBrands.map((brand) => {
                  const isSelected = brandFilter?.toLowerCase() === brand.toLowerCase();
                  return (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => setBrandFilter(isSelected ? null : brand)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition ${
                        isSelected
                          ? 'bg-[#025EA7] border-[#025EA7] text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                      }`}
                    >
                      {brand}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Products List */}
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
            Loading product inventory for location...
          </div>
        ) : products.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No products currently stored in this {type}. Click "Add Product" above to assign catalog products.
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No products match your search or brand filter.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {filteredProducts.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedStoreProduct(selectedStoreProduct?.id === p.id ? null : p)}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all group ${
                  selectedStoreProduct?.id === p.id
                    ? 'bg-blue-50 border-[#025EA7] ring-1 ring-blue-200'
                    : 'bg-slate-50 border-slate-100 hover:bg-blue-50/50 hover:border-blue-200'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-[#025EA7] transition-colors flex items-center gap-1.5">
                    {p.name}
                    <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 font-normal">View Details →</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                    {brandOf(p) && (
                      <span className="px-1.5 py-0.5 bg-blue-50 text-[#025EA7] text-[10px] font-bold rounded">
                        {brandOf(p)}
                      </span>
                    )}
                    <span>SKU: {p.sku || 'N/A'} • ETB {p.price.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg">
                    Qty: {p.stockQuantity}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title={`Edit product "${p.name}"`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onEditProduct) {
                          onEditProduct(catalogProducts.find((cp) => cp.id === p.id) ?? p);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-[#025EA7] hover:bg-blue-50 rounded-lg transition"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title={`Remove "${p.name}" from this ${type}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveProduct(p);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// 7. Add Company Modal
export function AddCompanyModal({ isOpen, onClose, onSuccess }: ModalProps) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const newComp = await api.createCompany({
        name: name.trim(),
        phoneNumber: phone.trim() || undefined,
        address: address.trim() || undefined,
        email: email.trim() || undefined,
      });
      showToast(`Company "${name}" registered successfully!`, 'success');
      if (newComp?.id) {
        api.setSelectedCompany(newComp.id, newComp.name || name.trim());
      }
      if (onSuccess) (onSuccess as any)(newComp);
      onClose();
      setName('');
      setPhone('');
      setAddress('');
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-[#025EA7]" />
            <h3 className="text-base font-bold text-slate-900">Add New Company</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 text-red-600 text-xs rounded-xl font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Gelagle Trading PLC"
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0911223344"
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email (Optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@company.et"
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Location / Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Addis Ababa, Bole Road"
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-[#025EA7] text-white font-bold rounded-xl text-xs shadow-sm hover:bg-[#014883] transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? 'Creating...' : 'Create Company'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 8. Company Limit Reached Modal
interface CompanyLimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  allowedCount: number;
  onAddMoreCompanies: () => void;
}

export function CompanyLimitReachedModal({
  isOpen,
  onClose,
  allowedCount,
  onAddMoreCompanies,
}: CompanyLimitReachedModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100 text-center">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
          <Building className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Company Limit Reached</h3>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          You have reached your limit of <strong className="text-slate-800">{allowedCount} company slot(s)</strong> specified in your signup subscription. To register additional business entities, request more company slots or upgrade your plan.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onClose();
              onAddMoreCompanies();
            }}
            className="flex-1 py-2.5 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-sm transition-all"
          >
            Add More Companies
          </button>
        </div>
      </div>
    </div>
  );
}

// 9. Record Credit Payment Modal
interface RecordCreditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  saleId?: string;
  sales?: SaleRecord[];
  customerName?: string;
  invoiceNumber?: string;
  remainingBalance?: number;
}

export function RecordCreditPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  saleId,
  sales = [],
  customerName,
  invoiceNumber,
  remainingBalance = 0,
}: RecordCreditPaymentModalProps) {
  const { showToast } = useToast();
  const [amount, setAmount] = useState('');
  const [isEditingTopAmount, setIsEditingTopAmount] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'mobile_money'>('cash');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAmount(remainingBalance ? remainingBalance.toString() : '');
      setIsEditingTopAmount(false);
      setNotes('');
      setError(null);
    }
  }, [isOpen, remainingBalance]);

  if (!isOpen || (!saleId && sales.length === 0)) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payNum = parseFloat(amount);
    if (!payNum || payNum <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }
    if (payNum > remainingBalance + 0.01) {
      setError(`Payment amount cannot exceed remaining balance of ETB ${remainingBalance.toLocaleString()}`);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      if (sales.length > 0) {
        let remainingToPay = payNum;
        const sortedSales = [...sales].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        for (const sale of sortedSales) {
          if (remainingToPay <= 0.001) break;
          const saleBal = sale.remainingBalance || sale.totalAmount || 0;
          if (saleBal <= 0.01) continue;
          const payAmt = Math.min(remainingToPay, saleBal);
          await api.recordSalePayment(sale.id, {
            amount: payAmt,
            paymentMethod,
            notes: notes.trim() || undefined,
          });
          remainingToPay -= payAmt;
        }
        showToast(`Payment of ETB ${payNum.toLocaleString()} recorded for ${customerName || 'Customer'}!`, 'success');
      } else if (saleId) {
        await api.recordSalePayment(saleId, {
          amount: payNum,
          paymentMethod,
          notes: notes.trim() || undefined,
        });
        showToast(`Payment of ETB ${payNum.toLocaleString()} recorded for invoice #${invoiceNumber || saleId.substring(0, 8)}!`, 'success');
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record credit payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-none">Record Credit Payment</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                {sales.length > 0 ? `Bulk repayment for ${sales.length} invoices` : `Single invoice repayment`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 stroke-[2]" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 text-rose-700 text-xs rounded-2xl font-semibold text-center border border-rose-100">
            {error}
          </div>
        )}

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 mb-5 text-center">
          <div className="text-xs text-slate-500 font-semibold">
            Customer: <strong className="text-slate-900 font-bold">{customerName || 'Customer'}</strong>
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">
            {sales.length > 0 ? `${sales.length} pending invoice(s)` : `Invoice #${invoiceNumber || (saleId ? saleId.substring(0, 8) : 'N/A')}`}
          </div>

          {isEditingTopAmount ? (
            <div className="flex items-center justify-center gap-1.5 mt-2 mb-1">
              <span className="text-rose-600 font-black text-xl">ETB</span>
              <input
                type="number"
                step="0.01"
                autoFocus
                max={remainingBalance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={() => setIsEditingTopAmount(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setIsEditingTopAmount(false);
                  }
                }}
                className="w-48 px-3 py-1 bg-white border-2 border-rose-400 rounded-xl text-center text-rose-600 font-black text-xl focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-inner"
              />
            </div>
          ) : (
            <div
              onClick={() => setIsEditingTopAmount(true)}
              className="group inline-flex items-center justify-center gap-2 cursor-pointer hover:bg-rose-100/60 px-3.5 py-1 rounded-xl transition-all border border-transparent hover:border-rose-200/80 mt-1.5"
              title="Click total amount to edit payment"
            >
              <span className="text-rose-600 font-black text-2xl tracking-tight">
                ETB {(parseFloat(amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <Pencil className="w-4 h-4 text-rose-400 opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all" />
            </div>
          )}

          <div
            onClick={() => setIsEditingTopAmount(true)}
            className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 cursor-pointer hover:text-rose-600 transition-colors flex items-center justify-center gap-1"
          >
            <span>Total Outstanding Due</span>
            <span className="text-[9px] text-rose-500/80 font-normal lowercase">(click amount to edit)</span>
          </div>

          <div className="flex items-center justify-center gap-2 mt-3.5 pt-3 border-t border-slate-200/60">
            <button
              type="button"
              onClick={() => setAmount(remainingBalance.toString())}
              className="px-3.5 py-1.5 bg-white text-[#025EA7] border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-50 active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              Full Amount (ETB {remainingBalance.toLocaleString()})
            </button>
            {remainingBalance > 10 && (
              <button
                type="button"
                onClick={() => setAmount((remainingBalance / 2).toFixed(2))}
                className="px-3.5 py-1.5 bg-white text-[#025EA7] border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-50 active:scale-95 transition-all shadow-xs cursor-pointer"
              >
                Half (50%)
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              Payment Amount (ETB) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400">ETB</span>
              <input
                type="number"
                step="0.01"
                required
                max={remainingBalance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Max: ${remainingBalance}`}
                className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2.5 text-xs font-bold rounded-2xl border transition-all cursor-pointer ${
                  paymentMethod === 'cash' ? 'bg-[#025EA7] text-white border-[#025EA7] shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Cash
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('bank_transfer')}
                className={`py-2.5 text-xs font-bold rounded-2xl border transition-all cursor-pointer ${
                  paymentMethod === 'bank_transfer' ? 'bg-[#025EA7] text-white border-[#025EA7] shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Bank Transfer
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('mobile_money')}
                className={`py-2.5 text-xs font-bold rounded-2xl border transition-all cursor-pointer ${
                  paymentMethod === 'mobile_money' ? 'bg-[#025EA7] text-white border-[#025EA7] shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Telebirr
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              Notes / Transaction Reference (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. CBE Ref #9847201 / Partial repayment"
              className="w-full py-2.5 px-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
            />
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99]"
            >
              {loading ? 'Recording...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 9b. Customer Credit Detail Modal (Matching Flutter Screenshot 2)
interface CustomerCreditDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  sales: SaleRecord[];
  onRecordPayment: (sale: SaleRecord) => void;
  onPayAll: (customerName: string, sales: SaleRecord[], totalOwed: number) => void;
}

export function CustomerCreditDetailModal({
  isOpen,
  onClose,
  customerName,
  sales,
  onRecordPayment,
  onPayAll,
}: CustomerCreditDetailModalProps) {
  if (!isOpen) return null;

  const customerSales = sales.filter((s) => {
    const rem = s.remainingBalance !== undefined ? s.remainingBalance : s.totalAmount || 0;
    if (rem <= 0.01) return false;
    const nameKey = s.customerName || s.customerPhone || (s as any).customer?.name || 'Walk-in Customer';
    return (
      nameKey === customerName ||
      s.customerName === customerName ||
      (s.customerPhone && s.customerPhone === customerName)
    );
  });
  const totalOwed = customerSales.reduce((sum, s) => sum + (s.remainingBalance || 0), 0);

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
            >
              <ChevronDown className="w-4 h-4 rotate-90 stroke-[2.5]" />
            </button>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-none">Credit Details</h3>
              <p className="text-xs text-slate-500 font-semibold mt-1 flex items-center gap-1.5">
                <span>Customer:</span>
                <span className="text-[#025EA7] font-bold">{customerName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 stroke-[2]" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Main Balance Banner Card */}
          <div
            onClick={() => {
              if (totalOwed > 0) {
                onPayAll(customerName, customerSales, totalOwed);
              }
            }}
            className="bg-gradient-to-br from-[#025EA7] via-[#024e8c] to-[#013866] text-white rounded-3xl p-6 shadow-xl relative overflow-hidden cursor-pointer group hover:brightness-105 transition-all"
            title="Click total amount to edit & pay"
          >
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />

            <div className="flex items-start justify-between relative z-10 mb-5">
              <div>
                <span className="text-[11px] font-extrabold text-blue-200 uppercase tracking-wider block mb-1">
                  Total Outstanding Balance
                </span>
                <div className="text-3xl font-black tracking-tight flex items-center gap-2">
                  <span>ETB {totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <Pencil className="w-4.5 h-4.5 text-blue-200 opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                </div>
                <div className="text-xs text-blue-200/90 font-semibold mt-1.5 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-white text-[11px]">
                    {customerSales.length} invoice{customerSales.length !== 1 ? 's' : ''} pending
                  </span>
                  <span className="text-[10px] text-emerald-300 font-normal">(click to edit & pay)</span>
                </div>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-amber-300 flex items-center justify-center shadow-inner">
                <Tag className="w-6 h-6 stroke-[2.5]" />
              </div>
            </div>

            {totalOwed > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPayAll(customerName, customerSales, totalOwed);
                }}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-900/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-white" /> Pay All Credits (ETB {totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2 })})
              </button>
            )}
          </div>

          {/* Invoices Breakdown Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>Invoices Breakdown</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#025EA7]"></span>
              </h4>
            </div>

            {customerSales.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 font-medium">
                No active credit invoices found for this customer.
              </div>
            ) : (
              customerSales.map((s) => {
                const advPaid = s.advancePayment || (s.totalAmount - (s.remainingBalance || 0));
                const dueAmt = s.remainingBalance || 0;
                const isPartially = advPaid > 0 && dueAmt > 0;

                return (
                  <div
                    key={s.id}
                    className="bg-white p-4.5 rounded-2xl border border-slate-200/90 hover:border-blue-300 hover:shadow-md transition-all space-y-3.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#025EA7] flex items-center justify-center font-black text-sm border border-blue-100">
                          #
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-slate-900">
                            #{s.invoiceNumber || s.id.substring(0, 8)}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                            {s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`px-3 py-1 text-[10px] font-extrabold rounded-full border ${
                          isPartially
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {isPartially ? 'Partially Paid' : 'Unpaid Credit'}
                      </span>
                    </div>

                    {/* Summary Numbers Pill */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl text-xs border border-slate-100">
                      <div className="text-center border-r border-slate-200/60 pr-1">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total</div>
                        <div className="font-bold text-slate-900 mt-0.5">ETB {s.totalAmount.toLocaleString()}</div>
                      </div>
                      <div className="text-center border-r border-slate-200/60 px-1">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Paid</div>
                        <div className="font-bold text-emerald-600 mt-0.5">ETB {advPaid.toLocaleString()}</div>
                      </div>
                      <div className="text-center pl-1">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Due</div>
                        <div className="font-bold text-rose-600 mt-0.5">ETB {dueAmt.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Action Pay Button */}
                    <button
                      type="button"
                      onClick={() => onRecordPayment(s)}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-[0.99] cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" /> Pay Invoice (ETB {dueAmt.toLocaleString()})
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 10. Product Detail Modal
interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onEdit?: () => void;
  onDeleted?: () => void;
}

export function ProductDetailModal({ isOpen, onClose, product, onEdit, onDeleted }: ProductDetailModalProps) {
  const { showToast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [dynamicLocations, setDynamicLocations] = useState<Array<{ name: string; quantity: number; type: string }>>([]);

  useEffect(() => {
    if (isOpen && product?.id) {
      api.getProductLocations(product.id).then((res) => {
        const locs: Array<{ name: string; quantity: number; type: string }> = [
          ...(res.warehouses || []).map((w: any) => ({ name: w.name, quantity: w.stockQuantity || 0, type: 'Warehouse' })),
          ...(res.shops || []).map((s: any) => ({ name: s.name, quantity: s.stockQuantity || 0, type: 'Shop' })),
        ];
        setDynamicLocations(locs);
      }).catch(() => {});
    } else {
      setDynamicLocations([]);
    }
  }, [isOpen, product?.id]);

  if (!isOpen || !product) return null;

  const trackStock = product.trackStock ?? true;
  const isLowStock = trackStock && product.stockQuantity <= (product.minStockLevel || 5);
  const isOutOfStock = trackStock && product.stockQuantity <= 0;

  const effectiveLocations = dynamicLocations.length > 0 ? dynamicLocations : (product.locations || []);
  const locationLabel = effectiveLocations.length > 0
    ? effectiveLocations.map((l) => `${l.name}`).join(', ')
    : (product.storeName || 'Unassigned / General Store');

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteProduct(product.id);
      showToast(`Product "${product.name}" removed successfully.`, 'success');
      onDeleted?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove product', 'error');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#025EA7] flex items-center justify-center font-black text-lg border border-blue-100">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{product.name}</h3>
              <p className="text-xs text-slate-400 font-medium">
                Category: <span className="text-slate-700 font-semibold">{product.category || 'General'}</span>
                {(product.metadata?.brand || (product as any).brand) ? (
                  <span className="ml-1 text-[#025EA7] font-semibold">· Brand: {product.metadata?.brand || (product as any).brand}</span>
                ) : null}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stock Status Banner */}
        <div className={`mb-4 p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
          isOutOfStock
            ? 'bg-red-50 text-red-700 border-red-200'
            : isLowStock
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
        }`}>
          <span>Stock Status</span>
          <span className="font-extrabold uppercase text-[11px]">
            {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock Warning' : 'In Stock'}
          </span>
        </div>

        {/* Key Product Information Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[10px] uppercase font-bold text-slate-400">Selling Price</div>
            <div className="text-base font-black text-[#025EA7] mt-0.5">ETB {product.price ? product.price.toLocaleString() : '0.00'}</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[10px] uppercase font-bold text-slate-400">Cost Price</div>
            <div className="text-base font-black text-slate-800 mt-0.5">
              ETB {((product.costPrice ?? product.cost) != null && Number(product.costPrice ?? product.cost) > 0)
                ? Number(product.costPrice ?? product.cost).toLocaleString()
                : '0.00'}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[10px] uppercase font-bold text-slate-400">Stock Quantity</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">{product.stockQuantity} {product.unit || 'units'}</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[10px] uppercase font-bold text-slate-400">Min Stock Level</div>
            <div className="text-sm font-bold text-slate-800 mt-0.5">{product.minStockLevel ?? 5} units</div>
          </div>
        </div>

        {/* Technical Details List */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2.5 text-xs mb-4">
          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500 font-medium">SKU</span>
            <span className="font-bold text-slate-800">{product.sku || 'N/A'}</span>
          </div>

          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500 font-medium">Barcode</span>
            <span className="font-bold text-slate-800">{product.barcode || 'N/A'}</span>
          </div>

          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500 font-medium">Unit</span>
            <span className="font-bold text-slate-800">{product.unit || 'pcs'}</span>
          </div>

          {product.expiryDate && (
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-medium">Expiry Date</span>
              <span className="font-bold text-slate-800">{new Date(product.expiryDate).toLocaleDateString()}</span>
            </div>
          )}

          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500 font-medium">Store / Warehouse Location</span>
            <span className="font-bold text-[#025EA7]">{locationLabel}</span>
          </div>

          {product.supplierName && (
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-medium">Supplier</span>
              <span className="font-bold text-slate-800">{product.supplierName}</span>
            </div>
          )}

          {effectiveLocations && effectiveLocations.length > 0 && (
            <div className="pt-1">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">Branch Location Breakdown</div>
              <div className="space-y-1.5">
                {effectiveLocations.map((loc, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] bg-white p-2 rounded-lg border border-slate-200/60">
                    <span className="font-semibold text-slate-700">{loc.name} ({loc.type})</span>
                    <span className="font-bold text-slate-900">{loc.quantity} units</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {product.description && (
          <div className="mb-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs">
            <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Description</div>
            <p className="text-slate-700 leading-relaxed font-medium">{product.description}</p>
          </div>
        )}

        {confirming && (
          <div className="mb-4 p-4 rounded-xl border border-red-200 bg-red-50">
            <p className="text-xs font-semibold text-red-700 mb-3">
              Are you sure you want to permanently remove <span className="font-black">&quot;{product.name}&quot;</span> from your catalog? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-lg text-xs hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs transition-all"
              >
                {deleting ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-xs transition-all"
          >
            Close Details
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              className="py-2.5 px-4 bg-blue-50 hover:bg-blue-100 text-[#025EA7] font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 border border-blue-200"
            >
              <Pencil className="w-4 h-4" /> Edit
            </button>
          )}
          <button
            onClick={() => setConfirming((v) => !v)}
            className="py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 border border-red-200"
          >
            <Trash2 className="w-4 h-4" /> Remove Product
          </button>
        </div>
      </div>
    </div>
  );
}

// 13. Change Password Modal (Flutter Parity)
export function ChangePasswordModal({ isOpen, onClose }: ModalProps) {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      showToast('Please fill in all password fields', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      showToast('Password updated successfully!', 'success');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to change password', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#025EA7]" />
            <h3 className="text-base font-bold text-slate-900">Change Password</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Current Password *</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">New Password * (min 6 chars)</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password *</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? 'Updating...' : 'Save Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 13b. Change PIN Modal (Company Admin)
export function ChangePinModal({ isOpen, onClose }: ModalProps) {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPin('');
      setConfirmPin('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPin) {
      showToast('Please fill in all fields', 'error');
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      showToast('PIN must be exactly 4 digits', 'error');
      return;
    }
    if (newPin !== confirmPin) {
      showToast('PIN confirmation does not match', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.changeAdminPin({ currentPassword, newPin });
      showToast('Security PIN updated successfully!', 'success');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to update PIN', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#025EA7]" />
            <h3 className="text-base font-bold text-slate-900">Change 4-Digit Security PIN</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Current Account Password *</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">New 4-Digit PIN *</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              required
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="4-digit PIN (e.g. 1234)"
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New 4-Digit PIN *</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              required
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Confirm 4-digit PIN"
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#025EA7] focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? 'Updating...' : 'Save PIN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 14. Delete Account Modal (with Phone OTP Verification for Company Admin)
export function DeleteAccountModal({ isOpen, onClose, user }: ModalProps & { user?: any }) {
  const { showToast } = useToast();
  const [step, setStep] = useState<'confirm_phone' | 'enter_otp'>('confirm_phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setStep('confirm_phone');
      setOtp('');
      const initialPhone = user?.phone || '';
      setPhone(initialPhone);
      setResendCountdown(0);
    }
  }, [isOpen, user]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  if (!isOpen) return null;

  const handleSendOtp = async () => {
    const targetPhone = phone.trim();
    if (!targetPhone) {
      showToast('Please provide your phone number for OTP verification.', 'error');
      return;
    }
    setSendingOtp(true);
    try {
      const res = await api.sendDeleteAccountOtp(targetPhone);
      showToast(res?.message || 'Verification code sent to your phone via SMS.', 'success');
      setStep('enter_otp');
      setResendCountdown(60);
    } catch (err: any) {
      showToast(err.message || 'Failed to send OTP code. Please try again.', 'error');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleDelete = async () => {
    if (!otp.trim() || otp.trim().length < 4) {
      showToast('Please enter the 6-digit verification code sent to your phone.', 'error');
      return;
    }
    setLoading(true);
    try {
      await api.deleteAccount({ otp: otp.trim(), phone: phone.trim() });
      showToast('Account permanently deleted.', 'info');
      api.setToken(null);
      api.setSelectedCompany(null, null);
      localStorage.clear();
      sessionStorage.clear();
      // Clear cookies if any exist
      if (typeof document !== 'undefined') {
        document.cookie.split(';').forEach((c) => {
          document.cookie = c
            .replace(/^ +/, '')
            .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
        });
      }
      // Redirect strictly to the sign-in page only
      window.location.replace('/login');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete account. Invalid or expired OTP.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-red-100 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-red-100">
          <div className="flex items-center gap-2.5 text-red-600">
            <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center border border-red-200">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">Delete Account & Erase Data</h3>
              <p className="text-[11px] text-red-600 font-semibold">Security Verification Required</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 bg-red-50 rounded-2xl border border-red-200 text-xs text-red-800 leading-relaxed font-medium">
          <strong>Permanent Action:</strong> Deleting your Company Admin account will permanently erase your business profile, shops, warehouses, inventory records, and staff accounts.
        </div>

        {step === 'confirm_phone' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Verify Your Registered Phone Number:
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                An SMS verification code (OTP) will be sent to this number to verify your authorization to delete this business account.
              </p>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+251 9... or 09..."
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-slate-900 font-mono"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!phone.trim() || sendingOtp}
                onClick={handleSendOtp}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-1.5"
              >
                {sendingOtp ? 'Sending OTP...' : 'Send Verification OTP'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Enter 6-Digit OTP Code:
                </label>
                <button
                  type="button"
                  onClick={() => setStep('confirm_phone')}
                  className="text-[11px] text-blue-600 hover:underline font-semibold"
                >
                  Change phone
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">
                Sent to <strong className="text-slate-800">{phone}</strong>. Enter code below to confirm deletion:
              </p>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                autoFocus
                className="w-full py-3 px-3 text-center tracking-[0.5em] text-lg font-black bg-red-50/50 border-2 border-red-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-red-900 font-mono"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>Didn&apos;t receive code?</span>
              {resendCountdown > 0 ? (
                <span className="font-semibold text-slate-400">Resend in {resendCountdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sendingOtp}
                  className="text-red-600 hover:underline font-bold"
                >
                  Resend OTP
                </button>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={otp.length < 4 || loading}
                onClick={handleDelete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5"
              >
                {loading ? 'Deleting Account...' : 'Confirm & Delete Account'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 15. Privacy Policy Modal (Flutter Parity)
export function PrivacyPolicyModal({ isOpen, onClose }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#025EA7]" />
            <h3 className="text-base font-bold text-slate-900">Privacy Policy & Data Terms</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
          <p>
            <strong>1. Data Collection:</strong> We collect business profile information (company name, TIN, phone number, location) and inventory transactions solely for facilitating your store inventory management.
          </p>
          <p>
            <strong>2. Data Retention & Protection:</strong> All customer data and transaction logs are stored securely using encrypted cloud database connections.
          </p>
          <p>
            <strong>3. Third-Party Sharing:</strong> BM Stock IMS does not sell or share business information with unauthorized third parties.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
        >
          Close Policy
        </button>
      </div>
    </div>
  );
}

// 16. Record Borrowing Modal (Flutter Parity)
interface RecordBorrowingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  catalogProducts: Product[];
  warehouses: Warehouse[];
  shops: Shop[];
}

export function RecordBorrowingModal({
  isOpen,
  onClose,
  onSuccess,
  catalogProducts,
  warehouses,
  shops,
}: RecordBorrowingModalProps) {
  const { showToast } = useToast();
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [sellerPhone, setSellerPhone] = useState('');
  const [quantityTaken, setQuantityTaken] = useState<number | string>(1);
  const [dateTaken, setDateTaken] = useState(() => new Date().toISOString().split('T')[0]);
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [locationType, setLocationType] = useState<'warehouse' | 'shop'>('warehouse');
  const [locationId, setLocationId] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedProductId('');
      setProductName('');
      setProductCategory('');
      setSellerName('');
      setSellerPhone('');
      setQuantityTaken(1);
      setDateTaken(new Date().toISOString().split('T')[0]);
      setExpectedReturnDate('');
      setLocationType('warehouse');
      setLocationId(warehouses[0]?.id || '');
      setNote('');
      setError(null);
    }
  }, [isOpen, warehouses]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      setError('Product name is required');
      return;
    }
    if (!sellerName.trim()) {
      setError('Taken From (Seller Name) is required');
      return;
    }
    if (!locationId) {
      setError('Please select a receiving location');
      return;
    }
    const numQtyTaken = typeof quantityTaken === 'number' ? quantityTaken : (parseInt(quantityTaken) || 1);
    if (numQtyTaken < 1) {
      setError('Quantity taken must be at least 1');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await api.createBorrowing({
        productName: productName.trim(),
        productCategory: productCategory.trim() || undefined,
        productId: selectedProductId || undefined,
        quantityTaken: numQtyTaken,
        sellerName: sellerName.trim(),
        sellerPhone: sellerPhone.trim() || undefined,
        dateTaken,
        expectedReturnDate: expectedReturnDate || undefined,
        note: note.trim() || undefined,
        warehouseId: locationType === 'warehouse' ? locationId : undefined,
        shopId: locationType === 'shop' ? locationId : undefined,
      });

      showToast(`Borrowing record for "${productName}" created!`, 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record product borrowing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Box className="w-5 h-5 text-[#025EA7]" />
            <h3 className="text-base font-bold text-slate-900">Record Product Borrowing</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-red-50 text-red-600 text-xs rounded-xl font-medium text-center border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Catalog Item (Optional)</label>
            <select
              value={selectedProductId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedProductId(id);
                if (id) {
                  const match = catalogProducts.find((p) => p.id === id);
                  if (match) {
                    setProductName(match.name);
                    setProductCategory(match.category || '');
                  }
                }
              }}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] outline-none"
            >
              <option value="">-- Manual Entry / Pick Product --</option>
              {catalogProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.category || 'General'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Product name"
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category (Optional)</label>
              <input
                type="text"
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value)}
                placeholder="Category"
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Quantity Taken *</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantityTaken(Math.max(1, (typeof quantityTaken === 'number' ? quantityTaken : parseInt(quantityTaken) || 1) - 1))}
                className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-700 text-lg flex items-center justify-center transition-colors"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                required
                value={quantityTaken}
                onChange={(e) => setQuantityTaken(e.target.value === '' ? '' : (parseInt(e.target.value) || ''))}
                className="w-28 py-2 text-center bg-slate-50 border border-slate-200 rounded-xl text-sm font-extrabold text-slate-900 focus:ring-2 focus:ring-[#025EA7] outline-none"
              />
              <button
                type="button"
                onClick={() => setQuantityTaken((typeof quantityTaken === 'number' ? quantityTaken : parseInt(quantityTaken) || 0) + 1)}
                className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-700 text-lg flex items-center justify-center transition-colors"
              >
                +
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Taken From (Seller / Partner) *</label>
              <input
                type="text"
                required
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="Seller name"
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Seller Phone (Optional)</label>
              <input
                type="text"
                value={sellerPhone}
                onChange={(e) => setSellerPhone(e.target.value)}
                placeholder="0911223344"
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date Taken *</label>
              <input
                type="date"
                required
                value={dateTaken}
                onChange={(e) => setDateTaken(e.target.value)}
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Return Date</label>
              <input
                type="date"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Receiving Store Branch *</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  setLocationType('warehouse');
                  setLocationId(warehouses[0]?.id || '');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                  locationType === 'warehouse'
                    ? 'bg-[#025EA7] text-white border-[#025EA7]'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                Warehouse
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocationType('shop');
                  setLocationId(shops[0]?.id || '');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                  locationType === 'shop'
                    ? 'bg-[#025EA7] text-white border-[#025EA7]'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                Retail Shop
              </button>
            </div>

            <select
              required
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#025EA7] outline-none"
            >
              <option value="">Choose location...</option>
              {locationType === 'warehouse'
                ? warehouses.map((w) => <option key={w.id} value={w.id}>Warehouse: {w.name}</option>)
                : shops.map((s) => <option key={s.id} value={s.id}>Shop: {s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes (Optional)</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Additional details about borrowing terms or conditions..."
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#025EA7] outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? 'Recording...' : 'Save Borrowing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 17. Borrowing Detail & Return Modal (Flutter Parity)
interface BorrowingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  borrowing: Borrowing | null;
  onSuccess?: () => void;
}

export function BorrowingDetailModal({
  isOpen,
  onClose,
  borrowing,
  onSuccess,
}: BorrowingDetailModalProps) {
  const { showToast } = useToast();
  const [returnedQty, setReturnedQty] = useState<number | string>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && borrowing) {
      setReturnedQty(borrowing.quantityReturned || 0);
      setError(null);
    }
  }, [isOpen, borrowing]);

  if (!isOpen || !borrowing) return null;

  const isFullyReturned = borrowing.status === 'fully_returned' || borrowing.remainingQuantity <= 0;

  const handleSaveReturned = async (e: React.FormEvent) => {
    e.preventDefault();
    const numReturned = typeof returnedQty === 'number' ? returnedQty : (parseInt(returnedQty) || 0);
    if (numReturned < 0) {
      setError('Returned quantity cannot be negative');
      return;
    }
    if (numReturned > borrowing.quantityTaken) {
      setError(`Returned quantity cannot exceed total quantity taken (${borrowing.quantityTaken})`);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await api.updateBorrowing(borrowing.id, {
        quantityReturned: numReturned,
      });

      showToast(`Returned quantity updated to ${numReturned} units!`, 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update returned quantity');
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = () => {
    switch (borrowing.status) {
      case 'fully_returned':
        return <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-extrabold text-xs rounded-full">Fully Returned</span>;
      case 'partially_returned':
        return <span className="px-3 py-1 bg-amber-100 text-amber-800 font-extrabold text-xs rounded-full">Partially Returned</span>;
      default:
        return <span className="px-3 py-1 bg-blue-100 text-[#025EA7] font-extrabold text-xs rounded-full">Active</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black text-lg border border-amber-100">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{borrowing.productName}</h3>
              <div className="mt-0.5">{statusBadge()}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-red-50 text-red-600 text-xs rounded-xl font-medium text-center border border-red-100">
            {error}
          </div>
        )}

        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2.5 text-xs mb-5">
          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500 font-medium">Taken From (Seller)</span>
            <span className="font-bold text-slate-900">{borrowing.sellerName}</span>
          </div>

          {borrowing.sellerPhone && (
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-medium">Seller Phone</span>
              <span className="font-bold text-slate-800">{borrowing.sellerPhone}</span>
            </div>
          )}

          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500 font-medium">Date Taken</span>
            <span className="font-bold text-slate-800">{borrowing.dateTaken}</span>
          </div>

          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500 font-medium">Expected Return Date</span>
            <span className="font-bold text-slate-800">{borrowing.expectedReturnDate || 'Not specified'}</span>
          </div>

          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500 font-medium">Receiving Location</span>
            <span className="font-bold text-[#025EA7]">{borrowing.warehouseName || borrowing.shopName || 'Store Branch'}</span>
          </div>

          {borrowing.note && (
            <div className="pt-1">
              <span className="text-slate-500 font-medium block mb-1">Notes:</span>
              <p className="p-2 bg-white rounded-lg border border-slate-200/60 text-slate-700 font-medium">{borrowing.note}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5 text-center text-xs">
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl">
            <div className="text-[10px] uppercase font-bold text-slate-400">Qty Taken</div>
            <div className="text-lg font-black text-slate-900 mt-0.5">{borrowing.quantityTaken}</div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-[10px] uppercase font-bold text-slate-400">Qty Returned</div>
            <div className="text-lg font-black text-slate-800 mt-0.5">{borrowing.quantityReturned}</div>
          </div>
          <div className={`p-3 border rounded-xl ${borrowing.remainingQuantity > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <div className="text-[10px] uppercase font-bold text-slate-400">Remaining</div>
            <div className={`text-lg font-black mt-0.5 ${borrowing.remainingQuantity > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {borrowing.remainingQuantity}
            </div>
          </div>
        </div>

        {!isFullyReturned && (
          <form onSubmit={handleSaveReturned} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4 mb-4">
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">Update Returned Quantity</h4>
            
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={(typeof returnedQty === 'number' ? returnedQty : parseInt(returnedQty) || 0) <= 0}
                onClick={() => setReturnedQty(Math.max(0, (typeof returnedQty === 'number' ? returnedQty : parseInt(returnedQty) || 0) - 1))}
                className="w-10 h-10 bg-white hover:bg-slate-100 disabled:opacity-40 rounded-xl font-bold text-slate-800 text-xl border border-slate-200 flex items-center justify-center transition-all shadow-xs"
              >
                -
              </button>
              <input
                type="number"
                min="0"
                max={borrowing.quantityTaken}
                value={returnedQty}
                onChange={(e) => setReturnedQty(e.target.value === '' ? '' : Math.min(borrowing.quantityTaken, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-28 py-2 text-center bg-white border border-slate-200 rounded-xl text-base font-extrabold text-slate-900 focus:ring-2 focus:ring-[#025EA7] outline-none"
              />
              <button
                type="button"
                disabled={(typeof returnedQty === 'number' ? returnedQty : parseInt(returnedQty) || 0) >= borrowing.quantityTaken}
                onClick={() => setReturnedQty(Math.min(borrowing.quantityTaken, (typeof returnedQty === 'number' ? returnedQty : parseInt(returnedQty) || 0) + 1))}
                className="w-10 h-10 bg-white hover:bg-slate-100 disabled:opacity-40 rounded-xl font-bold text-slate-800 text-xl border border-slate-200 flex items-center justify-center transition-all shadow-xs"
              >
                +
              </button>
            </div>

            <div className="text-center text-xs text-slate-500 font-medium">
              New Remaining Balance: <strong className="text-slate-900">{Math.max(0, borrowing.quantityTaken - (typeof returnedQty === 'number' ? returnedQty : parseInt(returnedQty) || 0))} units</strong>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? 'Saving Update...' : 'Save Returned Quantity'}
            </button>
          </form>
        )}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// 15. Add Bank Account Modal (Flutter Parity)
interface AddBankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddBankAccountModal({ isOpen, onClose, onSuccess }: AddBankAccountModalProps) {
  const { showToast } = useToast();
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim() || !accountNumber.trim()) {
      showToast('Bank Name and Account Number are required', 'error');
      return;
    }
    setLoading(true);
    try {
      await api.createBankAccount({
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        initialBalance: parseFloat(initialBalance) || 0,
        note: note.trim(),
      });
      showToast('Bank account created successfully!', 'success');
      setBankName('');
      setAccountNumber('');
      setInitialBalance('');
      setNote('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to add bank account', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h3 className="text-base font-bold text-slate-900">Add Account</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Commercial Bank of Ethiopia"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#025EA7] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Account Number *</label>
            <input
              type="text"
              required
              placeholder="e.g. 1000123456789"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#025EA7] outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Initial Balance (ETB)</label>
            <input
              type="number"
              step="any"
              placeholder="0.00"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#025EA7] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Reason</label>
            <textarea
              rows={3}
              placeholder="Optional notes or account description..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#025EA7] outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? 'Adding...' : '+ Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 16. Add Bank Balance Modal (Flutter Parity)
interface AddBankBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: BankAccount[];
  onSuccess?: () => void;
}

export function AddBankBalanceModal({ isOpen, onClose, accounts = [], onSuccess }: AddBankBalanceModalProps) {
  const { showToast } = useToast();
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(amount);
    if (!selectedAccountId) {
      showToast('Please select a bank account first', 'error');
      return;
    }
    if (!amtNum || amtNum <= 0) {
      showToast('Please enter a valid amount greater than 0', 'error');
      return;
    }
    setLoading(true);
    try {
      await api.addBankBalance({
        bankAccountId: selectedAccountId,
        amount: amtNum,
        note: note.trim(),
      });
      showToast('Balance added successfully!', 'success');
      setAmount('');
      setNote('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to add balance', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h3 className="text-base font-bold text-slate-900">Add Balance</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Bank Account *</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#16A34A] outline-none"
            >
              {accounts.length === 0 ? (
                <option value="">No bank accounts available</option>
              ) : (
                accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bankName} ({acc.accountNumber})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Amount (ETB) *</label>
            <input
              type="number"
              step="any"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#16A34A] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
            <input
              type="text"
              placeholder="Reason / Reference note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#16A34A] outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? 'Adding...' : '+ Add Balance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 17. Add Bank Expense Modal (Flutter Parity)
interface AddBankExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts?: BankAccount[];
  onSuccess?: () => void;
}

export function AddBankExpenseModal({ isOpen, onClose, accounts = [], onSuccess }: AddBankExpenseModalProps) {
  const { showToast } = useToast();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(amount);
    if (!amtNum || amtNum <= 0) {
      showToast('Please enter a valid expense amount greater than 0', 'error');
      return;
    }
    setLoading(true);
    try {
      await api.addBankExpense({
        amount: amtNum,
        reason: reason.trim() || 'Expense',
        bankAccountId: selectedAccountId || undefined,
      });
      showToast('Expense recorded successfully!', 'success');
      setAmount('');
      setReason('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to add expense', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h3 className="text-base font-bold text-slate-900">Add Expense</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Amount (ETB) *</label>
            <input
              type="number"
              step="any"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#025EA7] outline-none"
            />
          </div>

          {accounts.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Deduct From Bank Account (Optional)</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#025EA7] outline-none"
              >
                <option value="">Default primary account</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bankName} ({acc.accountNumber})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Reason</label>
            <textarea
              rows={3}
              placeholder="Describe expense details or reason..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#025EA7] outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? 'Saving...' : '+ Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 18. Commission Config Modal (Flutter Parity)
interface CommissionConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  staff: StaffMember[];
  onSuccess?: () => void;
}

export function CommissionConfigModal({
  isOpen,
  onClose,
  products = [],
  staff = [],
  onSuccess,
}: CommissionConfigModalProps) {
  const { showToast } = useToast();
  const [tabIndex, setTabIndex] = useState<0 | 1>(0);
  const [query, setQuery] = useState('');
  const [productRates, setProductRates] = useState<Record<string, string>>({});
  const [productTypes, setProductTypes] = useState<Record<string, 'percent' | 'fixed'>>({});
  const [staffRates, setStaffRates] = useState<Record<string, string>>({});
  const [staffTypes, setStaffTypes] = useState<Record<string, 'percent' | 'fixed'>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const pMap: Record<string, string> = {};
      const pTypeMap: Record<string, 'percent' | 'fixed'> = {};
      products.forEach((p: any) => {
        pMap[p.id] = (p.commissionRate ?? 5).toString();
        pTypeMap[p.id] = (p.metadata?.commissionType as 'percent' | 'fixed') || 'percent';
      });
      setProductRates(pMap);
      setProductTypes(pTypeMap);

      const sMap: Record<string, string> = {};
      const sTypeMap: Record<string, 'percent' | 'fixed'> = {};
      staff.forEach((s: any) => {
        sMap[s.id] = (s.baseCommissionRate ?? 5).toString();
        sTypeMap[s.id] = (s.permissions?.baseCommissionType as 'percent' | 'fixed') || 'percent';
      });
      setStaffRates(sMap);
      setStaffTypes(sTypeMap);
    }
  }, [isOpen, products, staff]);

  if (!isOpen) return null;

  const filteredProducts = products.filter(
    (p) =>
      !query ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(query.toLowerCase()))
  );

  const filteredStaff = staff.filter(
    (s) => {
      if (s.isOwner) return false;
      return (
        !query ||
        s.firstName.toLowerCase().includes(query.toLowerCase()) ||
        s.lastName.toLowerCase().includes(query.toLowerCase()) ||
        (s.jobTitle && s.jobTitle.toLowerCase().includes(query.toLowerCase()))
      );
    }
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      if (tabIndex === 0) {
        await Promise.all(
          Object.entries(productRates).map(([id, rateStr]) => {
            const rate = parseFloat(rateStr) || 0;
            const type = productTypes[id] || 'percent';
            return api.updateProductCommissionRate(id, rate, type);
          })
        );
      } else {
        await Promise.all(
          Object.entries(staffRates).map(([id, rateStr]) => {
            const rate = parseFloat(rateStr) || 0;
            const type = staffTypes[id] || 'percent';
            return api.updateStaffCommissionRate(id, rate, type);
          })
        );
      }
      showToast('Commission rates updated successfully!', 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to save commission rates', 'error');
    } finally {
      setSaving(false);
    }
  };

  const TypeToggle = ({ value, onChange }: { value: 'percent' | 'fixed'; onChange: (v: 'percent' | 'fixed') => void }) => (
    <div className="flex rounded-lg border border-slate-200 overflow-hidden" style={{ minWidth: 76 }}>
      <button
        type="button"
        onClick={() => onChange('percent')}
        className={`px-2.5 py-1.5 text-[11px] font-bold transition-all ${
          value === 'percent'
            ? 'bg-[#025EA7] text-white'
            : 'bg-white text-slate-500 hover:bg-slate-50'
        }`}
      >
        %
      </button>
      <button
        type="button"
        onClick={() => onChange('fixed')}
        className={`px-2 py-1.5 text-[11px] font-bold transition-all ${
          value === 'fixed'
            ? 'bg-[#025EA7] text-white'
            : 'bg-white text-slate-500 hover:bg-slate-50'
        }`}
      >
        ETB
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Commission Config</h3>
            <p className="text-xs text-slate-500">Configure commission rates per product or staff — choose percentage or fixed ETB amount</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="p-1 bg-slate-100 rounded-xl flex gap-1 mb-3">
          <button
            type="button"
            onClick={() => setTabIndex(0)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              tabIndex === 0 ? 'bg-[#025EA7] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Products ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setTabIndex(1)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              tabIndex === 1 ? 'bg-[#025EA7] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Staff ({staff.length})
          </button>
        </div>

        {/* Search Field */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={tabIndex === 0 ? 'Search products by name or SKU...' : 'Search staff by name or title...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#025EA7] outline-none"
          />
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-2">
          {tabIndex === 0 ? (
            filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">No products found.</div>
            ) : (
              filteredProducts.map((p) => (
                <div key={p.id} className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 truncate">{p.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">SKU: {p.sku || 'N/A'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TypeToggle
                      value={productTypes[p.id] || 'percent'}
                      onChange={(v) => setProductTypes({ ...productTypes, [p.id]: v })}
                    />
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max={productTypes[p.id] === 'fixed' ? undefined : 100}
                      value={productRates[p.id] ?? '5'}
                      onChange={(e) => setProductRates({ ...productRates, [p.id]: e.target.value })}
                      className="w-20 py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center text-slate-900 focus:ring-2 focus:ring-[#025EA7] outline-none"
                    />
                    <span className="font-bold text-slate-600 w-7 text-right">{productTypes[p.id] === 'fixed' ? 'ETB' : '%'}</span>
                  </div>
                </div>
              ))
            )
          ) : filteredStaff.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">No staff members found.</div>
          ) : (
            filteredStaff.map((s) => (
              <div key={s.id} className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 truncate">
                    {s.firstName} {s.lastName}
                  </div>
                  <div className="text-[11px] text-slate-500">{s.jobTitle || s.role || 'Staff'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <TypeToggle
                    value={staffTypes[s.id] || 'percent'}
                    onChange={(v) => setStaffTypes({ ...staffTypes, [s.id]: v })}
                  />
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={staffTypes[s.id] === 'fixed' ? undefined : 100}
                    value={staffRates[s.id] ?? '5'}
                    onChange={(e) => setStaffRates({ ...staffRates, [s.id]: e.target.value })}
                    className="w-20 py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center text-slate-900 focus:ring-2 focus:ring-[#025EA7] outline-none"
                  />
                  <span className="font-bold text-slate-600 w-7 text-right">{staffTypes[s.id] === 'fixed' ? 'ETB' : '%'}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 pt-3 border-t border-slate-100 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex-1 py-2.5 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 12. Manual Payment Modal (Flutter Parity for Company Upgrade & Subscriptions)
interface ManualPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  planTitle: string;
  planPrice: string;
  companyNames: string[];
  planId: string;
  onSuccess: () => void;
}

export function ManualPaymentModal({
  isOpen,
  onClose,
  planTitle,
  planPrice,
  companyNames,
  planId,
  onSuccess,
}: ManualPaymentModalProps) {
  const { showToast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<'Telebirr' | 'CBE'>('Telebirr');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedMethod('Telebirr');
      setScreenshotFile(null);
      setScreenshotPreview(null);
      setIsUploading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} (${text}) copied to clipboard!`, 'success');
  };

  const handleSubmit = async () => {
    if (!screenshotFile) {
      showToast('Please select a payment method and attach the payment screenshot', 'error');
      return;
    }

    setIsUploading(true);
    try {
      let screenshotUrl = '';
      try {
        const res = await api.uploadPaymentProof(screenshotFile);
        screenshotUrl = res.url || '';
      } catch {
        // Fallback placeholder URL if upload endpoint mock
        screenshotUrl = `proof_${Date.now()}`;
      }

      const paymentRef = `GS${Date.now()}`;
      await api.requestLimitUpgrade({
        companyNames,
        planId,
        paymentMethod: selectedMethod,
        paymentRef,
        screenshotUrl,
      });

      showToast('Payment proof uploaded! Company upgrade request submitted for verification.', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to submit payment verification request', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-[#0F2A47]">Make Your Payment</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pay for {planTitle} via Telebirr or CBE, then upload your payment screenshot to verify.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Plan Price Banner */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between mb-4">
          <div>
            <div className="text-xs font-bold text-slate-900">{planTitle}</div>
            <div className="text-[11px] text-slate-500 font-medium">
              Companies requested: <span className="font-semibold text-slate-700">{companyNames.join(', ')}</span>
            </div>
          </div>
          <div className="text-base font-extrabold text-[#025EA7]">
            ETB {planPrice}
          </div>
        </div>

        {/* Payment Method Options */}
        <div className="space-y-2 mb-4">
          <label className="block text-xs font-bold text-slate-900">Select Payment Method</label>

          {/* Telebirr Card */}
          <div
            onClick={() => setSelectedMethod('Telebirr')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
              selectedMethod === 'Telebirr'
                ? 'bg-blue-50/70 border-[#025EA7] shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-[#025EA7] flex items-center justify-center shrink-0 font-bold">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-slate-900">Telebirr</div>
                <div className="text-slate-500 text-[11px]">Name: Possible Tech PLC</div>
                <div className="flex items-center gap-1 text-[#025EA7] font-bold text-[11px] mt-0.5">
                  <span>Phone: 0911578793</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard('0911578793', 'Telebirr Phone');
                    }}
                    className="p-1 hover:bg-blue-100 rounded text-[#025EA7] transition-all"
                    title="Copy Phone Number"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selectedMethod === 'Telebirr' ? 'border-[#025EA7] bg-[#025EA7]' : 'border-slate-300'
            }`}>
              {selectedMethod === 'Telebirr' && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
          </div>

          {/* CBE Card */}
          <div
            onClick={() => setSelectedMethod('CBE')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
              selectedMethod === 'CBE'
                ? 'bg-blue-50/70 border-[#025EA7] shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-[#025EA7] flex items-center justify-center shrink-0 font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-slate-900">CBE (Commercial Bank of Ethiopia)</div>
                <div className="text-slate-500 text-[11px]">Name: Possible Tech PLC</div>
                <div className="flex items-center gap-1 text-[#025EA7] font-bold text-[11px] mt-0.5">
                  <span>Account: 1000301736537</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard('1000301736537', 'CBE Account');
                    }}
                    className="p-1 hover:bg-blue-100 rounded text-[#025EA7] transition-all"
                    title="Copy Account Number"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selectedMethod === 'CBE' ? 'border-[#025EA7] bg-[#025EA7]' : 'border-slate-300'
            }`}>
              {selectedMethod === 'CBE' && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
          </div>
        </div>

        {/* Upload Screenshot Dropzone */}
        <div className="space-y-1.5 mb-5">
          <label className="block text-xs font-bold text-slate-900">Upload Payment Screenshot</label>

          <label className={`block relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
            screenshotPreview ? 'border-[#025EA7] bg-blue-50/20' : 'border-slate-300 hover:border-[#025EA7] bg-slate-50/50 hover:bg-slate-50'
          }`}>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />

            {screenshotPreview ? (
              <div className="space-y-2">
                <img
                  src={screenshotPreview}
                  alt="Payment Proof"
                  className="max-h-40 mx-auto rounded-lg object-contain shadow-xs border border-slate-200"
                />
                <div className="text-[11px] font-bold text-[#025EA7] flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{screenshotFile?.name}</span>
                </div>
                <div className="text-[10px] text-slate-400">Click to replace screenshot</div>
              </div>
            ) : (
              <div className="py-3 space-y-1.5">
                <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-700">Click or drag to upload payment screenshot</div>
                <div className="text-[10px] text-slate-400">PNG, JPG, or JPEG (Max 10MB)</div>
              </div>
            )}
          </label>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isUploading || !screenshotFile}
            onClick={handleSubmit}
            className="flex-1 py-2.5 bg-[#025EA7] hover:bg-[#014883] disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
          >
            {isUploading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Uploading Proof...</span>
              </>
            ) : (
              <span>Submit for Verification</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// 22. Activity Detail Modal
interface ActivityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: ActivityItem | null;
}

export function ActivityDetailModal({ isOpen, onClose, activity }: ActivityDetailModalProps) {
  if (!isOpen || !activity) return null;

  const getActivityTypeDetails = (type: ActivityItem['type']) => {
    switch (type) {
      case 'sale':
        return {
          label: 'Sales Invoice Transaction',
          icon: Tag,
          badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        };
      case 'stockIn':
        return {
          label: 'Inventory Stock In',
          icon: Plus,
          badgeColor: 'bg-blue-100 text-[#025EA7] border-blue-200',
          iconBg: 'bg-blue-50 text-[#025EA7] border-blue-100',
        };
      case 'stockOut':
        return {
          label: 'Inventory Stock Out',
          icon: ArrowUpRight,
          badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
          iconBg: 'bg-rose-50 text-rose-600 border-rose-100',
        };
      case 'borrowing':
        return {
          label: 'Product Borrowing Record',
          icon: Box,
          badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
          iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
        };
      case 'productAdded':
        return {
          label: 'New Product Catalog Entry',
          icon: Package,
          badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
          iconBg: 'bg-purple-50 text-purple-600 border-purple-100',
        };
      case 'transfer':
        return {
          label: 'Stock Transfer Movement',
          icon: Repeat,
          badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
          iconBg: 'bg-teal-50 text-teal-600 border-teal-100',
        };
      default:
        return {
          label: 'Activity Log',
          icon: FileCode,
          badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
          iconBg: 'bg-slate-50 text-slate-600 border-slate-100',
        };
    }
  };

  const info = getActivityTypeDetails(activity.type);
  const IconComp = info.icon;
  const formattedDate = activity.occurredAt
    ? new Date(activity.occurredAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'N/A';

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl ${info.iconBg} flex items-center justify-center border shrink-0`}>
              <IconComp className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400">{info.label}</div>
              <h3 className="text-base font-bold text-slate-900 leading-tight mt-0.5">{activity.title}</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Banner */}
        <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs font-semibold">
          <span className="text-slate-500 font-medium">Activity Status</span>
          <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${info.badgeColor}`}>
            {activity.status}
          </span>
        </div>

        {/* Subtitle / Overview */}
        {activity.subtitle && (
          <div className="mb-4 p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs">
            <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Overview & Reference</div>
            <div className="text-slate-800 font-bold">{activity.subtitle}</div>
          </div>
        )}

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[10px] uppercase font-bold text-slate-400">Amount / Quantity</div>
            <div className="text-sm font-black text-[#025EA7] mt-0.5">{activity.amount}</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[10px] uppercase font-bold text-slate-400">Store / Branch Location</div>
            <div className="text-sm font-bold text-slate-800 mt-0.5">{activity.storeName}</div>
          </div>
        </div>

        {/* Detailed Breakdown List */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2.5 text-xs mb-5">
          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500 font-medium">Customer / Partner</span>
            <span className="font-bold text-slate-800">{activity.customerName}</span>
          </div>

          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500 font-medium">Staff / Salesperson</span>
            <span className="font-bold text-slate-800">{activity.salesPerson}</span>
          </div>

          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500 font-medium">Recorded Date & Time</span>
            <span className="font-bold text-slate-800">{formattedDate}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Activity Reference ID</span>
            <span className="font-mono text-[11px] font-bold text-slate-600">{activity.id}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-xs transition-all"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

export interface RecordPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => Promise<void> | void;
  products?: Product[];
  warehouses?: Warehouse[];
  shops?: Shop[];
}

export function RecordPurchaseModal({
  isOpen,
  onClose,
  onSuccess,
  products = [],
  warehouses = [],
  shops = [],
}: RecordPurchaseModalProps) {
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [locationType, setLocationType] = useState<'warehouse' | 'shop'>('warehouse');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number | string>(1);
  const [unitCost, setUnitCost] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const [catalogProducts, setCatalogProducts] = useState<Product[]>(products);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (products && products.length > 0) {
      setCatalogProducts(products);
    } else if (isOpen) {
      setLoadingProducts(true);
      api.getProducts()
        .then((pList) => {
          if (Array.isArray(pList) && pList.length > 0) {
            setCatalogProducts(pList);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingProducts(false));
    }
  }, [isOpen, products]);

  useEffect(() => {
    if (isOpen) {
      if (warehouses.length > 0) {
        setLocationType('warehouse');
        setSelectedLocationId(warehouses[0].id);
      } else if (shops.length > 0) {
        setLocationType('shop');
        setSelectedLocationId(shops[0].id);
      }
      setSelectedProductId('');
      setQuantity(1);
      setUnitCost('');
      setSupplierName('');
      setExpiryDate('');
      setProductSearch('');
      setReferenceNumber(`PO-${Date.now().toString().slice(-6)}`);
    }
  }, [isOpen, warehouses, shops]);

  if (!isOpen) return null;

  const availableProducts = catalogProducts.length > 0 ? catalogProducts : products;

  const activeProducts = availableProducts.filter((p) => {
    const st = (p.status || '').toLowerCase().trim();
    if (st === 'inactive' || st === 'deleted' || st === 'discontinued') return false;
    if (p.metadata?.isDeleted || p.metadata?.is_deleted || (p as any).deletedAt) return false;
    return true;
  });

  const filteredProducts = activeProducts.filter((p) => {
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase().trim();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    );
  });

  const selectedProduct = activeProducts.find((p) => p.id === selectedProductId);

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = activeProducts.find((p) => p.id === prodId);
    if (prod) {
      if (prod.cost && Number(prod.cost) > 0) {
        setUnitCost(String(prod.cost));
      } else if (prod.price && Number(prod.price) > 0) {
        setUnitCost(String(prod.price));
      } else {
        setUnitCost('');
      }
      setSupplierName((prod as any).supplier?.name || (prod as any).supplierName || '');
      if (prod.expiryDate) {
        try {
          setExpiryDate(new Date(prod.expiryDate).toISOString().slice(0, 10));
        } catch {
          setExpiryDate('');
        }
      } else {
        setExpiryDate('');
      }
    }
  };

  const parsedQty = typeof quantity === 'number' ? quantity : (parseInt(quantity) || 0);
  const parsedCost = parseFloat(unitCost) || 0;
  const totalCost = parsedQty * parsedCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      showToast('Please select a product to record purchase.', 'error');
      return;
    }
    if (parsedQty <= 0) {
      showToast('Purchase quantity must be at least 1.', 'error');
      return;
    }

    setLoading(true);
    try {
      const wId = locationType === 'warehouse' ? (selectedLocationId || warehouses[0]?.id) : undefined;
      const sId = locationType === 'shop' ? (selectedLocationId || shops[0]?.id) : undefined;

      await api.adjustStock({
        productId: selectedProductId,
        type: 'purchase',
        quantity: parsedQty,
        warehouseId: wId,
        shopId: sId,
        reason: supplierName.trim() ? `Purchase from ${supplierName.trim()}` : 'Supplier Purchase',
        referenceNumber: referenceNumber.trim() ? referenceNumber.trim() : undefined,
        unitCost: parsedCost > 0 ? parsedCost : undefined,
      });

      showToast(`Purchase recorded successfully for "${selectedProduct?.name || 'Product'}"!`, 'success');
      if (onSuccess) await onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Failed to record purchase', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center border border-blue-100 text-[#025EA7]">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{t('record_purchase') || 'Record Purchase'} — Add Bought Items</h3>
              <p className="text-xs text-slate-500">Add bought items to inventory stock and track purchase costs</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Location / Storage Destination */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Receiving Destination</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setLocationType('warehouse');
                  if (warehouses.length > 0) setSelectedLocationId(warehouses[0].id);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                  locationType === 'warehouse'
                    ? 'bg-[#025EA7] text-white border-[#025EA7] shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Building className="w-3.5 h-3.5" /> Warehouse Store
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocationType('shop');
                  if (shops.length > 0) setSelectedLocationId(shops[0].id);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                  locationType === 'shop'
                    ? 'bg-[#025EA7] text-white border-[#025EA7] shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Box className="w-3.5 h-3.5" /> Retail Shop
              </button>
            </div>

            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#025EA7]"
            >
              {locationType === 'warehouse' ? (
                warehouses.length === 0 ? (
                  <option value="">No warehouses available</option>
                ) : (
                  warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      Warehouse: {w.name} {w.location ? `(${w.location})` : ''}
                    </option>
                  ))
                )
              ) : (
                shops.length === 0 ? (
                  <option value="">No shops available</option>
                ) : (
                  shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      Shop: {s.name} {s.location ? `(${s.location})` : ''}
                    </option>
                  ))
                )
              )}
            </select>
          </div>

          {/* Product Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Select Product *</label>
            {activeProducts.length > 8 && (
              <div className="relative mb-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search products by name or SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#025EA7]"
                />
              </div>
            )}
            {loadingProducts ? (
              <div className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#025EA7]" />
                Loading catalog products...
              </div>
            ) : activeProducts.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
                No active products in catalog yet. Please add a product first.
              </div>
            ) : (
              <select
                required
                value={selectedProductId}
                onChange={(e) => handleProductChange(e.target.value)}
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#025EA7]"
              >
                <option value="">-- Choose Product to Restock --</option>
                {filteredProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Stock: {p.stockQuantity ?? 0} {p.unit || 'pcs'}) {p.cost ? `— Cost: ETB ${Number(p.cost).toLocaleString()}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quantity & Unit Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Purchase Quantity *</label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, parsedQty - 1))}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-sm transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value === '' ? '' : (parseInt(e.target.value) || ''))}
                  className="w-full py-2 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#025EA7]"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(parsedQty + 1)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-sm transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Unit Cost (ETB)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#025EA7]"
              />
            </div>
          </div>

          {/* Supplier Name & PO Reference */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Name</label>
              <input
                type="text"
                placeholder="e.g. Alazar Trading"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-[#025EA7]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">PO / Reference #</label>
              <input
                type="text"
                placeholder="PO-XXXXXX"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-900 outline-none focus:ring-2 focus:ring-[#025EA7]"
              />
            </div>
          </div>

          {/* Purchase Cost Summary Card */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Purchase Value</div>
              <div className="text-base font-extrabold text-[#025EA7] mt-0.5">
                ETB {totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-700">
                {parsedQty} {selectedProduct?.unit || 'units'}
              </span>
              {parsedCost > 0 && (
                <div className="text-[11px] text-slate-400">
                  @ ETB {parsedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })} / unit
                </div>
              )}
            </div>
          </div>

          {/* Submit & Cancel Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedProductId}
              className="flex-2 py-3 bg-[#025EA7] hover:bg-[#014883] text-white font-bold rounded-xl text-xs shadow-md shadow-blue-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>Recording Purchase...</>
              ) : (
                <>
                  <Tag className="w-4 h-4" /> Record Purchase
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


