class ModuleKeys {
  ModuleKeys._();

  // Legacy combined modules (backward compatibility)
  static const String products = 'Products';
  static const String salesAndInvoices = 'Sales & Invoices';
  static const String stockInOut = 'Stock In/Out';
  static const String branchTransfers = 'Branch Transfers';
  static const String reports = 'Reports';
  static const String creditManagement = 'Credit Management';
  static const String staffManagement = 'Staff Management';
  static const String settings = 'Settings';
  static const String companies = 'Companies';
  static const String bankAccounts = 'Bank Accounts';

  // Stock
  static const String stockIn = 'Stock In';
  static const String stockOut = 'Stock Out';

  // Location
  static const String warehouse = 'Warehouse';
  static const String shopStore = 'Shop/Store';
  static const String branch = 'Branch';
  static const String addStore = 'Add Store';
  static const String addShop = 'Add Shop';

  // Sales
  static const String viewSales = 'View Sales';
  static const String createSale = 'Create Sale';
  static const String editSale = 'Edit Sale';
  static const String viewCredit = 'View Credit';
  static const String receiveCreditPayment = 'Receive Credit Payment';

  // Products (granular)
  static const String viewProducts = 'View Products';
  static const String addProduct = 'Add Product';
  static const String editProduct = 'Edit Product';
  static const String deleteProduct = 'Delete Product';

  // Admin
  static const String commission = 'Commission';

  static const stockGroup = [stockIn, stockOut];
  static const locationGroup = [warehouse, shopStore, branch, addStore, addShop];
  static const salesGroup = [viewSales, createSale, editSale, viewCredit, receiveCreditPayment];
  static const productGroup = [viewProducts, addProduct, editProduct, deleteProduct];
  static const adminGroup = [staffManagement, commission, reports, settings, branchTransfers, companies, bankAccounts];

  static const coreGroups = {
    'stock': stockGroup,
    'location': locationGroup,
    'sales': salesGroup,
    'products': productGroup,
  };

  /// Count how many modules in [modules] have view or edit access.
  static int countEnabledModules(Map<String, dynamic>? permissions, List<String> modules) {
    final raw = permissions?['modulePermissions'];
    if (raw is! Map) return 0;
    final mp = Map<String, dynamic>.from(raw);
    return modules.where((m) {
      final access = mp[m]?.toString();
      return access == 'view' || access == 'edit';
    }).length;
  }
}
