import { User } from './api';

const parsePerms = (val: any): any => {
  if (!val) return null;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch (_) {
      return null;
    }
  }
  return null;
};

export const isUserOwnerOrAdmin = (user: User | null | undefined): boolean => {
  if (!user) return false;

  // Super Admin always bypasses
  if ((user as any).isSuperAdmin) return true;

  // Root owner of the company
  if ((user as any).isOwner) return true;
  if ((user as any).company?.createdById && user.id === (user as any).company.createdById) return true;

  const roleClean = String(user.role || (user as any).jobTitle || '').toLowerCase().trim();
  const adminRoles = [
    'company_admin',
    'companyadmin',
    'owner',
    'company_owner',
    'super_admin',
    'superadmin',
    'admin',
  ];

  return adminRoles.includes(roleClean);
};

export const hasModulePermission = (
  user: User | null | undefined,
  moduleKey: string,
  requiredLevel: 'view' | 'edit' = 'view'
): boolean => {
  if (!user) return false;
  
  // Root Company Owners and Super Admins bypass permission checks
  if (isUserOwnerOrAdmin(user)) return true;

  const empObj = Array.isArray((user as any).employee)
    ? (user as any).employee[0]
    : Array.isArray((user as any).employees)
    ? (user as any).employees[0]
    : (user as any).employee;

  const userPerms = parsePerms((user as any).permissions);
  const empPerms = parsePerms(empObj?.permissions);

  const mods: Record<string, any> =
    parsePerms((user as any).modulePermissions) ||
    parsePerms(userPerms?.modulePermissions) ||
    parsePerms(empObj?.modulePermissions) ||
    parsePerms(empPerms?.modulePermissions) ||
    {};

  // If no module permissions dictionary exists at all for staff, deny access
  if (Object.keys(mods).length === 0) {
    return false;
  }

  // Case-insensitive key lookup
  let access =
    mods[moduleKey] ??
    mods[moduleKey.toLowerCase()] ??
    mods[moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1)];

  if (access === undefined) {
    const matchedKey = Object.keys(mods).find((k) => k.toLowerCase() === moduleKey.toLowerCase());
    if (matchedKey) {
      access = mods[matchedKey];
    }
  }

  // Legacy module key alias mapping for web frontend <-> backend / mobile parity
  if (access === undefined) {
    const legacyAliases: Record<string, string[]> = {
      warehouse: ['Store', 'warehouses'],
      shopStore: ['Shop', 'shops'],
      viewCredit: ['Credit', 'creditManagement'],
      viewProducts: ['Products', 'products', 'add_product'],
      stockIn: ['Stock In/Out', 'stockInOut', 'stock_in_out'],
      staffManagement: ['Staff & Access', 'staff', 'permission_access'],
      viewSales: ['Customer Management', 'salesAndInvoices', 'sales', 'customer_management'],
      branchTransfers: ['Stock Transfer', 'transfer_request', 'transfers'],
      bankAccounts: ['Bank Accounts', 'bank_accounts'],
      reports: ['Reports', 'reports_analytics'],
      commission: ['Commission', 'commission_management'],
      companies: ['Request more companies', 'request_more_companies'],
      branch: ['add_branch', 'branchManagement'],
      createSale: ['new_sale', 'salesAndInvoices', 'sales'],
      addProduct: ['add_product', 'products'],
    };

    const aliases = legacyAliases[moduleKey] || [];
    for (const alias of aliases) {
      const matched = Object.keys(mods).find((k) => k.toLowerCase() === alias.toLowerCase());
      if (matched) {
        access = mods[matched];
        break;
      }
    }
  }

  if (typeof access === 'boolean') {
    return access;
  }

  const accessClean = String(access ?? 'none').toLowerCase().trim();
  if (!accessClean || accessClean === 'none' || accessClean === 'false') return false;
  if (requiredLevel === 'edit' && accessClean === 'view') return false;

  return true;
};

export const canAccessBranch = (
  user: User | null | undefined,
  branchId: string,
  isWarehouse: boolean
): boolean => {
  if (!user) return false;
  if (isUserOwnerOrAdmin(user)) return true;

  const empObj = Array.isArray((user as any).employee)
    ? (user as any).employee[0]
    : Array.isArray((user as any).employees)
    ? (user as any).employees[0]
    : (user as any).employee;

  // 1. Primary assigned branch is ALWAYS accessible
  const userWhId = (user as any).warehouseId || empObj?.warehouseId;
  const userShId = (user as any).shopId || empObj?.shopId;
  if (isWarehouse && userWhId && userWhId === branchId) return true;
  if (!isWarehouse && userShId && userShId === branchId) return true;

  // 2. Resolve branch permissions map
  const userPerms = parsePerms((user as any).permissions);
  const empPerms = parsePerms(empObj?.permissions);
  const branchPerms =
    parsePerms((user as any).branchPermissions) ||
    parsePerms(userPerms?.branchPermissions) ||
    parsePerms(empObj?.branchPermissions) ||
    parsePerms(empPerms?.branchPermissions) ||
    {};

  if (branchPerms && typeof branchPerms === 'object' && Object.keys(branchPerms).length > 0) {
    const access = branchPerms[branchId];
    if (access !== undefined && access !== null) {
      if (typeof access === 'boolean') return access;
      if (typeof access === 'string') return access.toLowerCase() === 'true';
      if (typeof access === 'object') {
        const flag = isWarehouse ? access.warehouse : access.shop;
        return flag === true || flag === 'true';
      }
    }
    return false;
  }

  // 3. Fallback: If no explicit branch permissions map exists and no specific primary branch is assigned, allow access
  if (isWarehouse && !userWhId) return true;
  if (!isWarehouse && !userShId) return true;

  return false;
};

export const getAccessibleWarehouses = <T extends { id: string }>(
  user: User | null | undefined,
  warehouses: T[]
): T[] => {
  if (!user || isUserOwnerOrAdmin(user)) return warehouses;
  return warehouses.filter((w) => canAccessBranch(user, w.id, true));
};

export const getAccessibleShops = <T extends { id: string }>(
  user: User | null | undefined,
  shops: T[]
): T[] => {
  if (!user || isUserOwnerOrAdmin(user)) return shops;
  return shops.filter((s) => canAccessBranch(user, s.id, false));
};
