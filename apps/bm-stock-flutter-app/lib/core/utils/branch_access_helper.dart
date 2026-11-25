import 'dart:convert';
import '../models/user_model.dart';
import '../models/shop_model.dart';
import '../models/warehouse_model.dart';
import '../permissions/app_permissions.dart';

/// Resolves which shops/warehouses a user may access based on assignment and branch permissions.
class BranchAccessHelper {
  BranchAccessHelper._();

  static Map<String, Map<String, bool>> _branchMap(UserModel? user) {
    final perms = user?.permissions;
    if (perms == null) return {};
    var branchPerms = perms['branchPermissions'];
    if (branchPerms is String) {
      try {
        branchPerms = json.decode(branchPerms);
      } catch (_) {}
    }
    if (branchPerms is! Map) return {};
    final raw = Map<String, dynamic>.from(branchPerms);
    return raw.map((id, access) {
      if (access is bool) {
        return MapEntry(id, {'shop': access, 'warehouse': access});
      }
      if (access is String) {
        final b = access.toLowerCase() == 'true';
        return MapEntry(id, {'shop': b, 'warehouse': b});
      }
      if (access is! Map) return MapEntry(id, {'shop': false, 'warehouse': false});
      final m = Map<String, dynamic>.from(access);
      return MapEntry(id, {
        'shop': m['shop'] == true || m['shop'] == 'true',
        'warehouse': m['warehouse'] == true || m['warehouse'] == 'true',
      });
    });
  }

  static bool hasAnyShopAccess(UserModel? user) {
    if (user == null || user.isAdmin) return true;
    if (user.shopId != null && user.shopId!.isNotEmpty) return true;
    final map = _branchMap(user);
    if (map.isNotEmpty) {
      return map.values.any((access) => access['shop'] == true);
    }
    return true;
  }

  static bool hasAnyWarehouseAccess(UserModel? user) {
    if (user == null || user.isAdmin) return true;
    if (user.warehouseId != null && user.warehouseId!.isNotEmpty) return true;
    final map = _branchMap(user);
    if (map.isNotEmpty) {
      return map.values.any((access) => access['warehouse'] == true);
    }
    return true;
  }

  static bool canAccessWarehouseTab(UserModel? user) {
    if (user == null || user.isAdmin) return true;
    if (!user.canViewModule(ModuleKeys.warehouse) &&
        !user.canViewModule(ModuleKeys.stockIn) &&
        !user.canViewModule(ModuleKeys.stockOut) &&
        !user.canViewModule(ModuleKeys.stockInOut) &&
        !user.canViewModule(ModuleKeys.addStore)) {
      return false;
    }
    return hasAnyWarehouseAccess(user);
  }

  static bool canAccessShopTab(UserModel? user) {
    if (user == null || user.isAdmin) return true;
    if (!user.canViewModule(ModuleKeys.shopStore) &&
        !user.canViewModule(ModuleKeys.addShop)) {
      return false;
    }
    return hasAnyShopAccess(user);
  }

  static bool canAccessBranchManagement(UserModel? user) {
    if (user == null || user.isAdmin) return true;
    return user.canViewModule(ModuleKeys.branch);
  }

  static bool canAccessBranch(UserModel? user, String branchId, {required bool isWarehouse}) {
    if (user == null || user.isAdmin) return true;

    // 1. Primary assigned branch is ALWAYS accessible
    if (isWarehouse && user.warehouseId != null && user.warehouseId!.isNotEmpty && user.warehouseId == branchId) {
      return true;
    }
    if (!isWarehouse && user.shopId != null && user.shopId!.isNotEmpty && user.shopId == branchId) {
      return true;
    }

    // 2. Check branch permissions map
    final map = _branchMap(user);
    if (map.isNotEmpty) {
      final access = map[branchId];
      if (access == null) return false;
      return isWarehouse ? (access['warehouse'] == true) : (access['shop'] == true);
    }

    // 3. Fallback: If no branch permissions map is defined at all, and no primary branch is assigned, allow access to branches returned by server
    if (isWarehouse && (user.warehouseId == null || user.warehouseId!.isEmpty)) {
      return true;
    }
    if (!isWarehouse && (user.shopId == null || user.shopId!.isEmpty)) {
      return true;
    }

    return false;
  }

  static List<ShopModel> accessibleShops(UserModel? user, List<ShopModel> all) {
    if (user == null || user.isAdmin) return all;
    return all.where((s) => canAccessBranch(user, s.id, isWarehouse: false)).toList();
  }

  static List<WarehouseModel> accessibleWarehouses(UserModel? user, List<WarehouseModel> all) {
    if (user == null || user.isAdmin) return all;
    return all.where((w) => canAccessBranch(user, w.id, isWarehouse: true)).toList();
  }
}
