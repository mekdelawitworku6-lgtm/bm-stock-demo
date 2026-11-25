import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/blocs/auth/auth_bloc.dart';
import '../../core/blocs/auth/auth_state.dart';
import '../../core/blocs/company/company_bloc.dart';
import '../../core/blocs/company/company_state.dart';
import '../../core/providers/staff_provider.dart';
import '../../core/providers/branch_provider.dart';
import '../../core/models/employee_model.dart';
import '../../core/permissions/app_permissions.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/utils/branch_access_helper.dart';
import '../../core/widgets/app_toast.dart';

enum ModuleAccess { none, view, edit }

class PermissionsScreen extends StatefulWidget {
  final EmployeeModel employee;
  final bool isNewStaff;

  const PermissionsScreen({
    super.key,
    required this.employee,
    this.isNewStaff = false,
  });

  @override
  State<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionsScreenState extends State<PermissionsScreen> {
  late final Map<String, ModuleAccess> _moduleAccess;

  // Branch access: branchId -> {shop: bool, warehouse: bool}
  final Map<String, Map<String, bool>> _branchAccess = {};

  final Set<String> _expandedSections = {};

  bool _isSaving = false;

  static const _sectionLabels = {
    'stock': 'perm_stock',
    'location': 'perm_location',
    'sales': 'perm_sales',
    'products': 'perm_products',
    'admin': 'perm_admin',
  };

  static const _sectionModules = {
    'stock': ModuleKeys.stockGroup,
    'location': ModuleKeys.locationGroup,
    'sales': ModuleKeys.salesGroup,
    'products': ModuleKeys.productGroup,
    'admin': ModuleKeys.adminGroup,
  };

  // Settings is always available to every staff member (view-only) and is not
  // shown as a configurable toggle in the permissions screen.
  static final List<String> _adminConfigurableGroup =
      ModuleKeys.adminGroup.where((m) => m != ModuleKeys.settings).toList();

  static const _coreSectionOrder = ['stock', 'location', 'sales', 'products'];

  static const _sectionIcons = {
    'stock': Icons.inventory_2_outlined,
    'location': Icons.place_outlined,
    'sales': Icons.point_of_sale_outlined,
    'products': Icons.category_outlined,
    'admin': Icons.admin_panel_settings_outlined,
  };

  static const _viewOnlyModules = {
    ModuleKeys.warehouse,
    ModuleKeys.shopStore,
    ModuleKeys.branch,
    ModuleKeys.viewSales,
    ModuleKeys.viewCredit,
    ModuleKeys.viewProducts,
    ModuleKeys.reports,
    ModuleKeys.settings,
  };

  static const Map<String, IconData> _moduleIcons = {
    ModuleKeys.stockIn: Icons.arrow_downward_rounded,
    ModuleKeys.stockOut: Icons.arrow_upward_rounded,
    ModuleKeys.warehouse: Icons.warehouse_outlined,
    ModuleKeys.shopStore: Icons.storefront_outlined,
    ModuleKeys.branch: Icons.account_tree_outlined,
    ModuleKeys.addStore: Icons.add_business_outlined,
    ModuleKeys.addShop: Icons.add_business_outlined,
    ModuleKeys.viewSales: Icons.receipt_long_outlined,
    ModuleKeys.createSale: Icons.add_shopping_cart_outlined,
    ModuleKeys.editSale: Icons.edit_outlined,
    ModuleKeys.viewCredit: Icons.credit_card_outlined,
    ModuleKeys.receiveCreditPayment: Icons.payments_outlined,
    ModuleKeys.viewProducts: Icons.inventory_2_outlined,
    ModuleKeys.addProduct: Icons.add_box_outlined,
    ModuleKeys.editProduct: Icons.edit_note_outlined,
    ModuleKeys.deleteProduct: Icons.delete_outline,
    ModuleKeys.staffManagement: Icons.people_outline,
    ModuleKeys.commission: Icons.percent_outlined,
    ModuleKeys.reports: Icons.bar_chart_outlined,
    ModuleKeys.settings: Icons.settings_outlined,
    ModuleKeys.branchTransfers: Icons.local_shipping_outlined,
    ModuleKeys.companies: Icons.apartment_outlined,
    ModuleKeys.bankAccounts: Icons.account_balance_outlined,
  };

  static const Map<String, String> _moduleTrKey = {
    ModuleKeys.stockIn: 'stock_in',
    ModuleKeys.stockOut: 'stock_out',
    ModuleKeys.warehouse: 'store',
    ModuleKeys.shopStore: 'shop_store',
    ModuleKeys.branch: 'branch_management',
    ModuleKeys.addStore: 'add_warehouse',
    ModuleKeys.addShop: 'add_shop',
    ModuleKeys.viewSales: 'view_sales',
    ModuleKeys.createSale: 'create_sale',
    ModuleKeys.editSale: 'edit_sale',
    ModuleKeys.viewCredit: 'view_credit_perm',
    ModuleKeys.receiveCreditPayment: 'receive_credit_payment',
    ModuleKeys.viewProducts: 'view_products',
    ModuleKeys.addProduct: 'add_product_perm',
    ModuleKeys.editProduct: 'edit_product_perm',
    ModuleKeys.deleteProduct: 'delete_product_perm',
    ModuleKeys.staffManagement: 'staff_management',
    ModuleKeys.commission: 'commission_management',
    ModuleKeys.reports: 'reports',
    ModuleKeys.settings: 'settings',
    ModuleKeys.branchTransfers: 'branch_transfers',
    ModuleKeys.companies: 'companies',
    ModuleKeys.bankAccounts: 'bank_management',
  };

  bool get _isEmployeeAdmin {
    final r = (widget.employee.role ?? '').toLowerCase().trim();
    final j = (widget.employee.jobTitle ?? '').toLowerCase().trim();
    return r == 'company_admin' || r == 'admin' || r == 'super_admin' || j == 'admin' || j.contains('admin');
  }

  static const Map<String, String> _canonicalModuleKeyMap = {
    'stockin': ModuleKeys.stockIn,
    'stockout': ModuleKeys.stockOut,
    'warehouse': ModuleKeys.warehouse,
    'shopstore': ModuleKeys.shopStore,
    'shop/store': ModuleKeys.shopStore,
    'branch': ModuleKeys.branch,
    'addstore': ModuleKeys.addStore,
    'addshop': ModuleKeys.addShop,
    'viewsales': ModuleKeys.viewSales,
    'createsale': ModuleKeys.createSale,
    'editsale': ModuleKeys.editSale,
    'viewcredit': ModuleKeys.viewCredit,
    'receivecreditpayment': ModuleKeys.receiveCreditPayment,
    'viewproducts': ModuleKeys.viewProducts,
    'addproduct': ModuleKeys.addProduct,
    'editproduct': ModuleKeys.editProduct,
    'deleteproduct': ModuleKeys.deleteProduct,
    'staffmanagement': ModuleKeys.staffManagement,
    'commission': ModuleKeys.commission,
    'reports': ModuleKeys.reports,
    'settings': ModuleKeys.settings,
    'branchtransfers': ModuleKeys.branchTransfers,
    'companies': ModuleKeys.companies,
    'bankaccounts': ModuleKeys.bankAccounts,
  };

  static String _canonicalizeKey(String rawKey) {
    final clean = rawKey.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '').toLowerCase();
    return _canonicalModuleKeyMap[clean] ?? rawKey;
  }

  @override
  void initState() {
    super.initState();
    _moduleAccess = {
      for (final module in [
        ...ModuleKeys.stockGroup,
        ...ModuleKeys.locationGroup,
        ...ModuleKeys.salesGroup,
        ...ModuleKeys.productGroup,
        ...ModuleKeys.adminGroup,
      ])
        module: _isEmployeeAdmin ? _defaultAccessFor(module) : ModuleAccess.none,
    };
    _moduleAccess[ModuleKeys.settings] = ModuleAccess.view;
    _loadInitialPermissionsFromEmployee();
    if (_isEmployeeAdmin) {
      _expandedSections.addAll([..._coreSectionOrder, 'admin']);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrapPermissions());
  }

  Future<void> _bootstrapPermissions() async {
    final companyState = context.read<CompanyBloc>().state;
    final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
    final branchProvider = Provider.of<BranchProvider>(context, listen: false);
    if (branchProvider.shops.isEmpty && branchProvider.warehouses.isEmpty) {
      await branchProvider.loadBranches(companyId: companyId);
    }
    if (!mounted) return;

    _loadInitialPermissions();
    if (widget.isNewStaff) {
      _applyNewStaffDefaults();
    }
    _syncExpandedSections();
    setState(() {});
  }

  void _applyNewStaffDefaults() {
    final employee = widget.employee;
    if (_isEmployeeAdmin) {
      for (final module in [
        ...ModuleKeys.stockGroup,
        ...ModuleKeys.locationGroup,
        ...ModuleKeys.salesGroup,
        ...ModuleKeys.productGroup,
        ...ModuleKeys.adminGroup,
      ]) {
        _moduleAccess[module] = _defaultAccessFor(module);
      }
      final branchProvider = Provider.of<BranchProvider>(context, listen: false);
      for (final shop in branchProvider.shops) {
        _branchAccess[shop.id] = {'shop': true, 'warehouse': false};
      }
      for (final warehouse in branchProvider.warehouses) {
        _branchAccess[warehouse.id] = {'shop': false, 'warehouse': true};
      }
      _expandedSections.addAll([..._coreSectionOrder, 'admin']);
      return;
    }

    if (employee.shopId != null && employee.shopId!.isNotEmpty) {
      _branchAccess[employee.shopId!] = {'shop': true, 'warehouse': false};
    }
    if (employee.warehouseId != null && employee.warehouseId!.isNotEmpty) {
      _branchAccess[employee.warehouseId!] = {'shop': false, 'warehouse': true};
    }
    for (final sectionKey in _coreSectionOrder) {
      _expandedSections.add(sectionKey);
    }
  }

  void _syncExpandedSections() {
    _expandedSections.clear();
    for (final sectionKey in [..._coreSectionOrder, 'admin']) {
      final modules =
          sectionKey == 'admin' ? _adminConfigurableGroup : _sectionModules[sectionKey]!;
      if (_sectionEnabledCount(modules) > 0) {
        _expandedSections.add(sectionKey);
      }
    }
    if (_expandedSections.isEmpty && _coreSectionOrder.isNotEmpty) {
      _expandedSections.add(_coreSectionOrder.first);
    }
  }

  ModuleAccess _defaultAccessFor(String module) {
    return _viewOnlyModules.contains(module) ? ModuleAccess.view : ModuleAccess.edit;
  }

  bool _isModuleEnabled(String module) {
    return (_moduleAccess[module] ?? ModuleAccess.none) != ModuleAccess.none;
  }

  int _sectionEnabledCount(List<String> modules) {
    return modules.where(_isModuleEnabled).length;
  }

  void _setModuleEnabled(String module, bool enabled) {
    _moduleAccess[module] = enabled ? _defaultAccessFor(module) : ModuleAccess.none;
  }

  void _setSectionEnabled(String sectionKey, List<String> modules, bool enabled) {
    setState(() {
      if (enabled) {
        _expandedSections.add(sectionKey);
        for (final module in modules) {
          if (!_isModuleEnabled(module)) {
            _setModuleEnabled(module, true);
          }
        }
      } else {
        for (final module in modules) {
          _setModuleEnabled(module, false);
        }
      }
    });
  }

  String _enabledSummary(List<String> modules) {
    return context.tr('perm_items_enabled').replaceAll('{enabled}', '${_sectionEnabledCount(modules)}').replaceAll('{total}', '${modules.length}');
  }

  void _loadInitialPermissionsFromEmployee() {
    final perms = widget.employee.permissions;
    if (perms != null) {
      if (perms['modulePermissions'] != null) {
        final Map<String, dynamic> modules = Map<String, dynamic>.from(perms['modulePermissions']);
        modules.forEach((rawKey, value) {
          final key = _canonicalizeKey(rawKey.toString());
          final access = ModuleAccess.values.firstWhere(
            (e) => e.name == value.toString(),
            orElse: () => ModuleAccess.none,
          );
          if (access != ModuleAccess.none || !_isEmployeeAdmin) {
            _moduleAccess[key] = access;
          }
        });
        _moduleAccess[ModuleKeys.settings] = ModuleAccess.view;
        final legacyStock = modules[ModuleKeys.stockInOut]?.toString();
        if (legacyStock == 'view' || legacyStock == 'edit') {
          final access = legacyStock == 'edit' ? ModuleAccess.edit : ModuleAccess.view;
          if (_moduleAccess[ModuleKeys.stockIn] == ModuleAccess.none) {
            _moduleAccess[ModuleKeys.stockIn] = access;
          }
          if (_moduleAccess[ModuleKeys.stockOut] == ModuleAccess.none) {
            _moduleAccess[ModuleKeys.stockOut] = access;
          }
        }
        final legacyProducts = modules[ModuleKeys.products]?.toString();
        if (legacyProducts == 'view' || legacyProducts == 'edit') {
          final access = legacyProducts == 'edit' ? ModuleAccess.edit : ModuleAccess.view;
          for (final key in ModuleKeys.productGroup) {
            if (_moduleAccess[key] == ModuleAccess.none) _moduleAccess[key] = access;
          }
        }
        final legacySales = modules[ModuleKeys.salesAndInvoices]?.toString();
        if (legacySales == 'view' || legacySales == 'edit') {
          final access = legacySales == 'edit' ? ModuleAccess.edit : ModuleAccess.view;
          for (final key in [ModuleKeys.viewSales, ModuleKeys.createSale, ModuleKeys.editSale]) {
            if (_moduleAccess[key] == ModuleAccess.none) _moduleAccess[key] = access;
          }
        }
        final legacyCredit = modules[ModuleKeys.creditManagement]?.toString();
        if (legacyCredit == 'view' || legacyCredit == 'edit') {
          final access = legacyCredit == 'edit' ? ModuleAccess.edit : ModuleAccess.view;
          for (final key in [ModuleKeys.viewCredit, ModuleKeys.receiveCreditPayment]) {
            if (_moduleAccess[key] == ModuleAccess.none) _moduleAccess[key] = access;
          }
        }
      }

      if (perms['branchPermissions'] != null) {
        final Map<String, dynamic> branches = Map<String, dynamic>.from(perms['branchPermissions']);
        branches.forEach((branchId, accessMap) {
          if (accessMap is Map) {
            _branchAccess[branchId] = {
              'shop': accessMap['shop'] == true || accessMap['shop'] == 'true',
              'warehouse': accessMap['warehouse'] == true || accessMap['warehouse'] == 'true',
            };
          } else if (accessMap == true || accessMap == 'true') {
            _branchAccess[branchId] = {
              'shop': true,
              'warehouse': true,
            };
          }
        });
      }
    }

    final empShopId = widget.employee.shopId;
    if (empShopId != null && empShopId.isNotEmpty) {
      if (!_branchAccess.containsKey(empShopId)) {
        _branchAccess[empShopId] = {'shop': true, 'warehouse': false};
      }
    }
    final empWhId = widget.employee.warehouseId;
    if (empWhId != null && empWhId.isNotEmpty) {
      if (!_branchAccess.containsKey(empWhId)) {
        _branchAccess[empWhId] = {'shop': false, 'warehouse': true};
      }
    }
  }

  void _loadInitialPermissions() {
    _loadInitialPermissionsFromEmployee();

    final branchProvider = Provider.of<BranchProvider>(context, listen: false);
    final isAdmin = _isEmployeeAdmin;
    for (final shop in branchProvider.shops) {
      if (!_branchAccess.containsKey(shop.id) || (isAdmin && widget.isNewStaff)) {
        final isAssigned = isAdmin || widget.employee.shopId == shop.id;
        _branchAccess[shop.id] = {'shop': isAssigned, 'warehouse': false};
      }
    }
    for (final warehouse in branchProvider.warehouses) {
      if (!_branchAccess.containsKey(warehouse.id) || (isAdmin && widget.isNewStaff)) {
        final isAssigned = isAdmin || widget.employee.warehouseId == warehouse.id;
        _branchAccess[warehouse.id] = {'shop': false, 'warehouse': isAssigned};
      }
    }
  }

  Map<String, dynamic> _buildPermissionsPayload() {
    final modulePerms = <String, String>{};
    // Settings is always accessible (view) to every staff member.
    _moduleAccess[ModuleKeys.settings] = ModuleAccess.view;
    _moduleAccess.forEach((module, access) {
      modulePerms[module] = access.name;
    });

    final branchPerms = <String, dynamic>{};
    _branchAccess.forEach((branchId, access) {
      branchPerms[branchId] = access;
    });

    return {
      'modulePermissions': modulePerms,
      'branchPermissions': branchPerms,
    };
  }

  Future<void> _savePermissions() async {
    setState(() => _isSaving = true);
    try {
      final data = _buildPermissionsPayload();

      final staffProvider = Provider.of<StaffProvider>(context, listen: false);
      final success = await staffProvider.updateEmployee(widget.employee.id, data);

      if (mounted) {
        showAppToast(context, success ? context.tr('permissions_saved') : context.tr('permissions_save_failed'),
            type: success ? AppToastType.success : AppToastType.error);
        if (success) Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        showAppToast(context, '${context.tr('error')}: ${e.toString()}', type: AppToastType.error);
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  // ── initials helper ──────────────────────────────────────────────────────
  String _initials(String name) {
    if (name.isEmpty) return '?';
    final parts = name.trim().split(' ');
    if (parts.length > 1) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return name.substring(0, name.length > 1 ? 2 : 1).toUpperCase();
  }

  // ── permission chip (branch access) ──────────────────────────────────────
  Widget _branchChip({
    required String label,
    required bool active,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF1D5C96) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: active ? const Color(0xFF1D5C96) : const Color(0xFFE2E8F0),
            width: active ? 1.5 : 1,
          ),
          boxShadow: active
              ? [
                  BoxShadow(
                    color: const Color(0xFF1D5C96).withValues(alpha: 0.2),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  )
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              active ? Icons.check_circle_rounded : Icons.add_circle_outline_rounded,
              size: 14,
              color: active ? Colors.white : const Color(0xFF64748B),
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: active ? Colors.white : const Color(0xFF64748B),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildPermissionSections(BuildContext context) {
    return [
      if (widget.isNewStaff)
        Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFF0FDF4),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFBBF7D0)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.person_add_alt_1_outlined, color: Color(0xFF16A34A), size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  context.tr('configure_permissions_new_staff'),
                  style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF166534), height: 1.4),
                ),
              ),
            ],
          ),
        ),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFEFF6FF),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFBFDBFE)),
        ),
        child: Text(
          context.tr('permissions_configure_desc'),
          style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF475569), height: 1.4),
        ),
      ),
      const SizedBox(height: 16),
      ..._coreSectionOrder.map((sectionKey) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _buildPermissionSectionCard(sectionKey, _sectionModules[sectionKey]!),
          )),
      const SizedBox(height: 8),
      _buildPermissionSectionCard('admin', _adminConfigurableGroup),
    ];
  }

  Widget _buildPermissionSectionCard(String sectionKey, List<String> modules) {
    final isExpanded = _expandedSections.contains(sectionKey);
    final enabledCount = _sectionEnabledCount(modules);
    final sectionEnabled = enabledCount > 0;
    final sectionIcon = _sectionIcons[sectionKey] ?? Icons.folder_outlined;
    final sectionLabel = context.tr(_sectionLabels[sectionKey] ?? sectionKey);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: sectionEnabled ? const Color(0xFFBFDBFE) : const Color(0xFFE2E8F0),
        ),
        boxShadow: sectionEnabled
            ? [
                BoxShadow(
                  color: const Color(0xFF1D5C96).withValues(alpha: 0.06),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ]
            : null,
      ),
      child: Column(
        children: [
          InkWell(
            borderRadius: BorderRadius.vertical(
              top: const Radius.circular(16),
              bottom: Radius.circular(isExpanded ? 0 : 16),
            ),
            onTap: () {
              setState(() {
                if (isExpanded) {
                  _expandedSections.remove(sectionKey);
                } else {
                  _expandedSections.add(sectionKey);
                }
              });
            },
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: sectionEnabled ? const Color(0xFFEFF6FF) : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      sectionIcon,
                      color: sectionEnabled ? const Color(0xFF1D5C96) : const Color(0xFF64748B),
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          sectionLabel,
                          style: GoogleFonts.outfit(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF0F172A),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _enabledSummary(modules),
                          style: GoogleFonts.outfit(
                            fontSize: 12,
                            color: sectionEnabled ? const Color(0xFF1D5C96) : const Color(0xFF94A3B8),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Switch.adaptive(
                    value: sectionEnabled,
                    activeThumbColor: Colors.white,
                    activeTrackColor: const Color(0xFF1D5C96),
                    onChanged: (value) => _setSectionEnabled(sectionKey, modules, value),
                  ),
                  Icon(
                    isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                    color: const Color(0xFF94A3B8),
                  ),
                ],
              ),
            ),
          ),
          if (isExpanded) ...[
            const Divider(height: 1, color: Color(0xFFF1F5F9)),
            ...modules.asMap().entries.map((entry) {
              final idx = entry.key;
              final module = entry.value;
              final isLast = idx == modules.length - 1;
              return _buildModulePermissionRow(module, showDivider: !isLast);
            }),
          ],
        ],
      ),
    );
  }

  Widget _buildModulePermissionRow(String module, {required bool showDivider}) {
    final enabled = _isModuleEnabled(module);
    final access = _moduleAccess[module] ?? ModuleAccess.none;
    final icon = _moduleIcons[module] ?? Icons.circle_outlined;
    final moduleLabel = context.tr(_moduleTrKey[module] ?? module);
    final supportsViewEdit = !_viewOnlyModules.contains(module) &&
        module != ModuleKeys.createSale &&
        module != ModuleKeys.addProduct &&
        module != ModuleKeys.deleteProduct &&
        module != ModuleKeys.receiveCreditPayment;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              Icon(icon, color: enabled ? const Color(0xFF1D5C96) : const Color(0xFFCBD5E1), size: 18),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      moduleLabel,
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: enabled ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                      ),
                    ),
                    if (enabled && access == ModuleAccess.view)
                      Text(
                        context.tr('view'),
                        style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF64748B)),
                      )
                    else if (enabled && access == ModuleAccess.edit)
                      Text(
                        context.tr('edit'),
                        style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF64748B)),
                      ),
                  ],
                ),
              ),
              Switch.adaptive(
                value: enabled,
                activeThumbColor: Colors.white,
                activeTrackColor: const Color(0xFF1D5C96),
                onChanged: (value) {
                  setState(() => _setModuleEnabled(module, value));
                },
              ),
            ],
          ),
        ),
        if (enabled && supportsViewEdit)
          Padding(
            padding: const EdgeInsets.only(left: 46, right: 16, bottom: 10),
            child: Row(
              children: [
                _accessLevelChip(
                  label: context.tr('view'),
                  active: access == ModuleAccess.view,
                  onTap: () => setState(() => _moduleAccess[module] = ModuleAccess.view),
                ),
                const SizedBox(width: 8),
                _accessLevelChip(
                  label: context.tr('edit'),
                  active: access == ModuleAccess.edit,
                  onTap: () => setState(() => _moduleAccess[module] = ModuleAccess.edit),
                ),
              ],
            ),
          ),
        if (showDivider) const Divider(height: 1, indent: 46, endIndent: 16, color: Color(0xFFF1F5F9)),
      ],
    );
  }

  Widget _accessLevelChip({
    required String label,
    required bool active,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF1D5C96) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: active ? const Color(0xFF1D5C96) : const Color(0xFFE2E8F0)),
        ),
        child: Text(
          label,
          style: GoogleFonts.outfit(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: active ? Colors.white : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  Widget _buildEmployeeHeaderCard(
    EmployeeModel employee,
    bool isHighlighted,
    String roleLabel,
  ) {
    final assignedLocation = (employee.shopName?.trim().isNotEmpty ?? false)
        ? employee.shopName!.trim()
        : ((employee.warehouseName?.trim().isNotEmpty ?? false)
            ? employee.warehouseName!.trim()
            : context.tr('unassigned'));

    final int allowedBranchesCount = _branchAccess.values
        .where((access) => (access['shop'] ?? false) || (access['warehouse'] ?? false))
        .length;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: const BoxDecoration(
              color: Color(0xFF1D5C96),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                _initials(employee.name),
                style: GoogleFonts.outfit(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  employee.name,
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: isHighlighted ? const Color(0xFF1D5C96) : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        roleLabel,
                        style: GoogleFonts.outfit(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: isHighlighted ? Colors.white : const Color(0xFF64748B),
                        ),
                      ),
                    ),
                    Text(
                      assignedLocation,
                      style: GoogleFonts.outfit(
                        fontSize: 13,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                    if (allowedBranchesCount > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFBFDBFE)),
                        ),
                        child: Text(
                          '$allowedBranchesCount ${context.tr('allowed')}',
                          style: GoogleFonts.outfit(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF1D5C96),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBranchAccessSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          context.tr('branch_access').toUpperCase(),
          style: GoogleFonts.outfit(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.2,
            color: const Color(0xFF94A3B8),
          ),
        ),
        const SizedBox(height: 10),
        Consumer<BranchProvider>(
          builder: (_, branchProvider, __) {
            final allBranchesRaw = <Map<String, dynamic>>[];
            for (final shop in branchProvider.shops) {
              allBranchesRaw.add({'id': shop.id, 'name': shop.name, 'type': 'Shop'});
            }
            for (final wh in branchProvider.warehouses) {
              allBranchesRaw.add({'id': wh.id, 'name': wh.name, 'type': 'Warehouse'});
            }

            // For non-admin (staff) users, only show branches they have access to
            final authState = context.read<AuthBloc>().state;
            final currentUser = authState is AuthAuthenticated ? authState.user : null;
            final isCurrentUserAdmin = currentUser?.isAdmin ?? false;

            final allBranches = isCurrentUserAdmin
                ? allBranchesRaw
                : allBranchesRaw.where((branch) {
                    final branchId = branch['id'] as String;
                    final isWarehouse = branch['type'] == 'Warehouse';
                    return BranchAccessHelper.canAccessBranch(currentUser, branchId, isWarehouse: isWarehouse);
                  }).toList();

            if (allBranches.isEmpty) {
              return Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Text(
                  context.tr('no_branches_found'),
                  style: GoogleFonts.outfit(color: const Color(0xFF64748B)),
                ),
              );
            }

            return Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: allBranches.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final branch = entry.value;
                  final branchId = branch['id'] as String;
                  final branchName = branch['name'] as String;
                  final branchType = branch['type'] as String;
                  final isAssignedShop = widget.employee.shopId == branchId;
                  final isAssignedWarehouse = widget.employee.warehouseId == branchId;
                  final access = _branchAccess[branchId] ?? {
                    'shop': isAssignedShop,
                    'warehouse': isAssignedWarehouse,
                  };
                  final bool isAllowed = branchType == 'Shop'
                      ? (access['shop'] ?? false)
                      : (access['warehouse'] ?? false);
                  final isLast = idx == allBranches.length - 1;

                  return Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        child: Row(
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(
                                branchType == 'Shop'
                                    ? Icons.storefront_outlined
                                    : Icons.warehouse_outlined,
                                color: const Color(0xFF1D5C96),
                                size: 18,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    branchName,
                                    style: GoogleFonts.outfit(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500,
                                      color: const Color(0xFF0F172A),
                                    ),
                                  ),
                                  Text(
                                    (branchType == 'Shop' ? context.tr('shop') : context.tr('warehouse')) +
                                        (isAssignedShop || isAssignedWarehouse ? ' • ${context.tr('primary')}' : ''),
                                    style: GoogleFonts.outfit(
                                      fontSize: 11,
                                      fontWeight: (isAssignedShop || isAssignedWarehouse) ? FontWeight.w600 : FontWeight.normal,
                                      color: (isAssignedShop || isAssignedWarehouse) ? const Color(0xFF1D5C96) : const Color(0xFF94A3B8),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _branchChip(
                                  label: isAllowed
                                      ? context.tr('allowed')
                                      : context.tr('allow_access'),
                                  active: isAllowed,
                                  onTap: () {
                                    setState(() {
                                      if (branchType == 'Shop') {
                                        _branchAccess[branchId] = {
                                          'shop': !isAllowed,
                                          'warehouse': false,
                                        };
                                      } else {
                                        _branchAccess[branchId] = {
                                          'shop': false,
                                          'warehouse': !isAllowed,
                                        };
                                      }
                                    });
                                  },
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      if (!isLast)
                        const Divider(
                            height: 1, indent: 16, endIndent: 16, color: Color(0xFFF1F5F9)),
                    ],
                  );
                }).toList(),
              ),
            );
          },
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final employee = widget.employee;
    final isManager = employee.jobTitle?.toLowerCase().contains('manager') ?? false;
    final isAdmin = employee.jobTitle?.toLowerCase() == 'admin';
    final isHighlighted = isManager || isAdmin;
    final roleLabel = employee.jobTitle?.isNotEmpty == true ? employee.jobTitle! : context.tr('role_staff');

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8FAFC),
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF0F172A), size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              context.tr('permissions_access'),
              style: GoogleFonts.outfit(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: const Color(0xFF0F172A),
              ),
            ),
            Text(
              employee.name,
              style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF64748B)),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16.0),
            child: SizedBox(
              height: 36,
              child: ElevatedButton(
                onPressed: _isSaving ? null : _savePermissions,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1D5C96),
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: _isSaving
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : Text(
                        context.tr('save'),
                        style: GoogleFonts.outfit(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
              ),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildEmployeeHeaderCard(employee, isHighlighted, roleLabel),
          const SizedBox(height: 16),
          ..._buildPermissionSections(context),
          const SizedBox(height: 8),
          _buildBranchAccessSection(),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}
