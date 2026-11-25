import 'dart:convert';
import '../permissions/app_permissions.dart';

class UserModel {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String role;
  final String status;
  final String? phone;
  final String? companyId;
  final String? shopId;
  final String? warehouseId;
  final String? employeeId;
  final String? employeeName;
  final String? companyName;
  final int? numCompanies;
  final bool pushNotificationsEnabled;
  final bool emailNotificationsEnabled;
  final Map<String, dynamic>? permissions;
  final String? planTitle;
  final double? planAmount;
  final String? planPeriod;
  final String? paymentStatus;
  final String? subscriptionStartDate;
  final String? subscriptionExpiresAt;
  final String? subscriptionPaymentDate;
  final String? subscriptionNextPaymentDate;
  final bool hasPin;

  UserModel({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    required this.status,
    this.phone,
    this.companyId,
    this.shopId,
    this.warehouseId,
    this.employeeId,
    this.employeeName,
    this.companyName,
    this.numCompanies,
    this.pushNotificationsEnabled = true,
    this.emailNotificationsEnabled = true,
    this.permissions,
    this.planTitle,
    this.planAmount,
    this.planPeriod,
    this.paymentStatus,
    this.subscriptionStartDate,
    this.subscriptionExpiresAt,
    this.subscriptionPaymentDate,
    this.subscriptionNextPaymentDate,
    this.hasPin = false,
  });

  static Map<String, dynamic>? _parsePermissions(dynamic raw) {
    if (raw == null) return null;
    if (raw is Map) return Map<String, dynamic>.from(raw);
    if (raw is String) {
      try {
        final decoded = json.decode(raw);
        if (decoded is Map) return Map<String, dynamic>.from(decoded);
      } catch (_) {}
    }
    return null;
  }

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final emp = json['employee'] is Map ? (json['employee'] as Map) : null;
    final empShop = emp != null && emp['shop'] is Map ? (emp['shop'] as Map) : null;
    final empWh = emp != null && emp['warehouse'] is Map ? (emp['warehouse'] as Map) : null;
    final fallbackShopId = emp?['shopId']?.toString() ?? empShop?['id']?.toString();
    final fallbackWhId = emp?['warehouseId']?.toString() ?? empWh?['id']?.toString();

    return UserModel(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      firstName: json['firstName'] ?? '',
      lastName: json['lastName'] ?? '',
      role: json['role'] ?? 'USER',
      status: json['status'] ?? 'ACTIVE',
      phone: json['phone'],
      hasPin: json['hasPin'] == true || json['pin'] != null,
      companyId:
          json['companyId']?.toString() ?? json['company']?['id']?.toString(),
      shopId: json['shopId']?.toString() ??
          json['shop']?['id']?.toString() ??
          fallbackShopId,
      warehouseId: json['warehouseId']?.toString() ??
          json['warehouse']?['id']?.toString() ??
          fallbackWhId,
      employeeId: json['employeeId']?.toString() ?? emp?['id']?.toString(),
      employeeName: json['employeeName']?.toString() ?? emp?['name']?.toString(),
      companyName: json['companyName']?.toString() ??
          json['company']?['name']?.toString(),
      numCompanies: _toInt(json['numCompanies']),
      pushNotificationsEnabled: json['pushNotificationsEnabled'] ?? true,
      emailNotificationsEnabled: json['emailNotificationsEnabled'] ?? true,
      permissions: () {
        final parsed = _parsePermissions(json['permissions']) ??
            _parsePermissions(emp?['permissions']) ??
            (json['employees'] is List && (json['employees'] as List).isNotEmpty && (json['employees'] as List)[0] is Map
                ? _parsePermissions(((json['employees'] as List)[0] as Map)['permissions'])
                : null);
        final map = parsed != null ? Map<String, dynamic>.from(parsed) : <String, dynamic>{};
        final rootBranch = _parsePermissions(json['branchPermissions']) ?? _parsePermissions(emp?['branchPermissions']);
        if (rootBranch != null && !map.containsKey('branchPermissions')) {
          map['branchPermissions'] = rootBranch;
        }
        return map.isNotEmpty ? map : null;
      }(),
      planTitle: json['planTitle']?.toString(),
      planAmount: _toDouble(json['planAmount']),
      planPeriod: json['planPeriod']?.toString(),
      paymentStatus: json['paymentStatus']?.toString(),
      subscriptionStartDate: json['subscriptionStartDate']?.toString(),
      subscriptionExpiresAt: json['subscriptionExpiresAt']?.toString(),
      subscriptionPaymentDate: json['subscriptionPaymentDate']?.toString(),
      subscriptionNextPaymentDate:
          json['subscriptionNextPaymentDate']?.toString(),
    );
  }

  static int? _toInt(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString());
  }

  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    if (value is double) return value;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString());
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'firstName': firstName,
      'lastName': lastName,
      'role': role,
      'status': status,
      'phone': phone,
      'companyId': companyId,
      'shopId': shopId,
      'warehouseId': warehouseId,
      'employeeId': employeeId,
      'companyName': companyName,
      'numCompanies': numCompanies,
      'pushNotificationsEnabled': pushNotificationsEnabled,
      'emailNotificationsEnabled': emailNotificationsEnabled,
      'permissions': permissions,
      'planTitle': planTitle,
      'planAmount': planAmount,
      'planPeriod': planPeriod,
      'paymentStatus': paymentStatus,
      'subscriptionStartDate': subscriptionStartDate,
      'subscriptionExpiresAt': subscriptionExpiresAt,
      'subscriptionPaymentDate': subscriptionPaymentDate,
      'subscriptionNextPaymentDate': subscriptionNextPaymentDate,
      'hasPin': hasPin,
    };
  }

  UserModel copyWith({
    String? firstName,
    String? lastName,
    String? companyName,
    int? numCompanies,
    String? planTitle,
    double? planAmount,
    String? planPeriod,
    String? paymentStatus,
    String? subscriptionStartDate,
    String? subscriptionExpiresAt,
    String? subscriptionPaymentDate,
    String? subscriptionNextPaymentDate,
    bool? pushNotificationsEnabled,
    bool? emailNotificationsEnabled,
    bool? hasPin,
  }) {
    return UserModel(
      id: id,
      email: email,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      role: role,
      status: status,
      phone: phone,
      hasPin: hasPin ?? this.hasPin,
      companyId: companyId,
      shopId: shopId,
      warehouseId: warehouseId,
      employeeId: employeeId,
      companyName: companyName ?? this.companyName,
      numCompanies: numCompanies ?? this.numCompanies,
      planTitle: planTitle ?? this.planTitle,
      planAmount: planAmount ?? this.planAmount,
      planPeriod: planPeriod ?? this.planPeriod,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      subscriptionStartDate:
          subscriptionStartDate ?? this.subscriptionStartDate,
      subscriptionExpiresAt:
          subscriptionExpiresAt ?? this.subscriptionExpiresAt,
      subscriptionPaymentDate:
          subscriptionPaymentDate ?? this.subscriptionPaymentDate,
      subscriptionNextPaymentDate:
          subscriptionNextPaymentDate ?? this.subscriptionNextPaymentDate,
      pushNotificationsEnabled:
          pushNotificationsEnabled ?? this.pushNotificationsEnabled,
      emailNotificationsEnabled:
          emailNotificationsEnabled ?? this.emailNotificationsEnabled,
    );
  }

  String get fullName {
    if (employeeName != null && employeeName!.trim().isNotEmpty) {
      return employeeName!.trim();
    }
    final name = '$firstName $lastName'.trim();
    return name.isNotEmpty ? name : 'User';
  }

  static const _adminRoles = {'super_admin', 'admin', 'company_admin'};

  bool get isAdmin => _adminRoles.contains(role.toLowerCase());

  bool get isCompanyAdmin => role.toLowerCase() == 'company_admin';

  Map<String, dynamic> get modulePermissions {
    final perms = permissions;
    if (perms == null || perms['modulePermissions'] is! Map) return const {};
    return Map<String, dynamic>.from(perms['modulePermissions'] as Map);
  }

  String accessForModule(String module) {
    final direct = modulePermissions[module]?.toString().toLowerCase();
    if (direct == 'edit') return 'edit';

    // Normalize module key by removing spaces, underscores, slashes, hyphens
    final cleanTarget = module.toLowerCase().replaceAll(RegExp(r'[\s_/\-]'), '');

    var best = direct == 'view' ? 'view' : 'none';

    for (final entry in modulePermissions.entries) {
      final cleanKey = entry.key.toLowerCase().replaceAll(RegExp(r'[\s_/\-]'), '');
      if (cleanKey == cleanTarget) {
        final val = entry.value?.toString().toLowerCase();
        if (val == 'edit') return 'edit';
        if (val == 'view') best = 'view';
      }
    }

    // Common alias mappings
    final aliases = <String, List<String>>{
      'warehouse': ['store', 'warehouses'],
      'shopstore': ['shop', 'retail', 'shops'],
      'stockin': ['stockinout', 'stock_in_out'],
      'stockout': ['stockinout', 'stock_in_out'],
      'viewsales': ['sales', 'newsale', 'salesandinvoices'],
      'createsale': ['newsale', 'sales', 'salesandinvoices'],
      'viewproducts': ['products', 'addproduct'],
      'viewcredit': ['credit', 'creditmanagement'],
      'staffmanagement': ['staff', 'permissionaccess'],
    };

    final mapped = aliases[cleanTarget] ?? [];
    for (final alt in mapped) {
      final cleanAlt = alt.replaceAll(RegExp(r'[\s_/\-]'), '');
      for (final entry in modulePermissions.entries) {
        final cleanKey = entry.key.toLowerCase().replaceAll(RegExp(r'[\s_/\-]'), '');
        if (cleanKey == cleanAlt) {
          final val = entry.value?.toString().toLowerCase();
          if (val == 'edit') return 'edit';
          if (val == 'view') best = 'view';
        }
      }
    }

    return best;
  }

  bool canViewModule(String module) {
    if (isAdmin) return true;
    final access = accessForModule(module);
    if (access == 'view' || access == 'edit') return true;

    // Legacy fallbacks
    if (module == ModuleKeys.stockIn || module == ModuleKeys.stockOut) {
      final legacy = accessForModule(ModuleKeys.stockInOut);
      return legacy == 'view' || legacy == 'edit';
    }
    if (module == ModuleKeys.viewProducts ||
        module == ModuleKeys.addProduct ||
        module == ModuleKeys.editProduct ||
        module == ModuleKeys.deleteProduct) {
      final legacy = accessForModule(ModuleKeys.products);
      return legacy == 'view' || legacy == 'edit';
    }
    if (module == ModuleKeys.viewSales ||
        module == ModuleKeys.createSale ||
        module == ModuleKeys.editSale) {
      final legacy = accessForModule(ModuleKeys.salesAndInvoices);
      return legacy == 'view' || legacy == 'edit';
    }
    if (module == ModuleKeys.viewCredit ||
        module == ModuleKeys.receiveCreditPayment) {
      final legacy = accessForModule(ModuleKeys.creditManagement);
      return legacy == 'view' || legacy == 'edit';
    }
    if (module == ModuleKeys.shopStore ||
        module == ModuleKeys.warehouse ||
        module == ModuleKeys.branch) {
      return accessForModule(ModuleKeys.branchTransfers) != 'none' ||
          accessForModule(ModuleKeys.settings) != 'none';
    }
    return false;
  }

  bool canEditModule(String module) {
    if (isAdmin) return true;
    if (accessForModule(module) == 'edit') return true;

    if (module == ModuleKeys.stockIn || module == ModuleKeys.stockOut) {
      return accessForModule(ModuleKeys.stockInOut) == 'edit';
    }
    if (module == ModuleKeys.addProduct ||
        module == ModuleKeys.editProduct ||
        module == ModuleKeys.deleteProduct) {
      return accessForModule(ModuleKeys.products) == 'edit';
    }
    if (module == ModuleKeys.createSale || module == ModuleKeys.editSale) {
      return accessForModule(ModuleKeys.salesAndInvoices) == 'edit';
    }
    if (module == ModuleKeys.receiveCreditPayment) {
      return accessForModule(ModuleKeys.creditManagement) == 'edit';
    }
    return false;
  }

  bool get isStaffRole => !isAdmin && role == 'user';

  bool get isSuperAdmin => role == 'super_admin';

  String get planTier {
    if (isSuperAdmin) return 'large';
    final raw = (planPeriod ?? planTitle ?? '').toLowerCase().trim();
    if (raw == 'trial' ||
        raw.contains('trial') ||
        raw.contains('free') ||
        raw.contains('14_day') ||
        raw.contains('14-day') ||
        raw.contains('two_week') ||
        raw.contains('2_week')) {
      return 'trial';
    }
    if (raw == 'large' || raw.contains('large') || raw.contains('15999') || raw.contains('15,999') || raw.contains('14999') || raw == '1_year' || raw.contains('1 year')) {
      return 'large';
    }
    if (raw == 'medium' || raw.contains('medium') || raw.contains('10999') || raw.contains('10,999') || raw.contains('9999') || raw == '6_months' || raw.contains('6 month')) {
      return 'medium';
    }
    if (raw == 'small' || raw.contains('small') || raw.contains('7999') || raw.contains('7,999') || raw.contains('6999') || raw == '1_month' || raw.contains('1 month')) {
      return 'small';
    }
    final amt = (planAmount ?? 0).toInt();
    if (amt >= 15000) return 'large';
    if (amt >= 10000) return 'medium';
    return 'small';
  }

  int get maxStores {
    if (isSuperAdmin || planTier == 'large') return 999999;
    if (planTier == 'medium') return 5;
    return 1;
  }

  int get maxWarehouses {
    if (isSuperAdmin || planTier == 'large') return 999999;
    if (planTier == 'medium') return 5;
    return 1;
  }

  int get maxStaff {
    if (isSuperAdmin || planTier == 'large') return 999999;
    if (planTier == 'medium') return 5;
    return 1;
  }

  bool get canUseBorrowing => isSuperAdmin || planTier == 'large' || planTier == 'trial';
  bool get canUseCommission => isSuperAdmin || planTier == 'large' || planTier == 'trial';
  bool get canBulkAddProducts => isSuperAdmin || planTier == 'medium' || planTier == 'large' || planTier == 'trial';
  bool get canImportProducts => isSuperAdmin || planTier == 'large';
  bool get canAccessWebApp => isSuperAdmin || planTier == 'large';
}
