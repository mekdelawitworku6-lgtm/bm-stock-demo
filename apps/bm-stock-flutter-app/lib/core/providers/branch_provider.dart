import 'package:flutter/foundation.dart';
import '../models/shop_model.dart';
import '../models/warehouse_model.dart';
import '../services/shop_service.dart';
import '../services/warehouse_service.dart';

class BranchProvider with ChangeNotifier {
  final ShopService _shopService = ShopService();
  final WarehouseService _warehouseService = WarehouseService();

  List<ShopModel> _shops = [];
  List<WarehouseModel> _warehouses = [];
  bool _isLoading = false;
  String? _error;
  String? _lastCompanyId;

  List<ShopModel> get shops => _shops;
  List<WarehouseModel> get warehouses => _warehouses;
  List<dynamic> get branches => [..._shops, ..._warehouses];
  bool get isLoading => _isLoading;
  String? get error => _error;
  String? get activeCompanyId => _lastCompanyId;

  void clear() {
    _shops = [];
    _warehouses = [];
    _lastCompanyId = null;
    _error = null;
    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadBranches({String? companyId, bool showLoading = true}) async {
    final companyChanged = companyId != _lastCompanyId;
    _lastCompanyId = companyId;

    if (companyChanged) {
      _shops = [];
      _warehouses = [];
      notifyListeners();
    }

    final isInitialLoad = _shops.isEmpty && _warehouses.isEmpty;
    if (showLoading && isInitialLoad) {
      _isLoading = true;
      _error = null;
      notifyListeners();
    }

    try {
      final results = await Future.wait([
        _shopService.getAll(companyId: companyId).catchError((e) {
          debugPrint('Error fetching shops: $e');
          return <ShopModel>[];
        }),
        _warehouseService.getAll(companyId: companyId).catchError((e) {
          debugPrint('Error fetching warehouses: $e');
          return <WarehouseModel>[];
        }),
      ]);
      
      final fetchedShops = results[0] as List<ShopModel>;
      final fetchedWarehouses = results[1] as List<WarehouseModel>;

      if (companyChanged) {
        _shops = fetchedShops;
        _warehouses = fetchedWarehouses;
      } else {
        _shops = _mergeById(fetchedShops, _shops, (item) => item.id);
        _warehouses = _mergeById(fetchedWarehouses, _warehouses, (item) => item.id);
      }
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load branches: $e';
      _isLoading = false;
      notifyListeners();
    }
  }

  List<T> _mergeById<T>(List<T> fetched, List<T> local, String Function(T) idOf) {
    final merged = <T>[...fetched];
    for (final item in local) {
      if (!merged.any((existing) => idOf(existing) == idOf(item))) {
        merged.insert(0, item);
      }
    }
    return merged;
  }

  Future<bool> addShop(Map<String, dynamic> data) async {
    try {
      if (_lastCompanyId != null) data['companyId'] = _lastCompanyId;
      final newShop = await _shopService.create(data);
      _shops.removeWhere((s) => s.id == newShop.id);
      _shops.insert(0, newShop);
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to add shop: $e';
      notifyListeners();
      rethrow;
    }
  }

  Future<bool> updateShop(String id, Map<String, dynamic> data) async {
    try {
      final updated = await _shopService.update(id, data);
      final index = _shops.indexWhere((s) => s.id == id);
      if (index != -1) {
        _shops[index] = updated;
      } else {
        _shops.insert(0, updated);
      }
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to update shop: $e';
      notifyListeners();
      rethrow;
    }
  }

  Future<bool> deleteShop(String id) async {
    try {
      await _shopService.delete(id);
      _shops.removeWhere((s) => s.id == id);
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to delete shop: $e';
      notifyListeners();
      rethrow;
    }
  }

  Future<bool> addWarehouse(Map<String, dynamic> data) async {
    try {
      if (_lastCompanyId != null) data['companyId'] = _lastCompanyId;
      final newWarehouse = await _warehouseService.create(data);
      _warehouses.removeWhere((w) => w.id == newWarehouse.id);
      _warehouses.insert(0, newWarehouse);
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to add warehouse: $e';
      notifyListeners();
      rethrow;
    }
  }

  Future<bool> updateWarehouse(String id, Map<String, dynamic> data) async {
    try {
      final updated = await _warehouseService.update(id, data);
      final index = _warehouses.indexWhere((w) => w.id == id);
      if (index != -1) {
        _warehouses[index] = updated;
      } else {
        _warehouses.insert(0, updated);
      }
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to update warehouse: $e';
      notifyListeners();
      rethrow;
    }
  }

  Future<bool> deleteWarehouse(String id) async {
    try {
      await _warehouseService.delete(id);
      _warehouses.removeWhere((w) => w.id == id);
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to delete warehouse: $e';
      notifyListeners();
      rethrow;
    }
  }
}
