import 'package:flutter/foundation.dart';
import '../models/supplier_model.dart';
import '../services/supplier_service.dart';

class SupplierProvider with ChangeNotifier {
  final SupplierService _supplierService = SupplierService();

  List<SupplierModel> _suppliers = [];
  bool _isLoading = false;
  String? _error;

  List<SupplierModel> get suppliers => _suppliers;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> loadSuppliers({String? search}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _suppliers = await _supplierService.getAll(search: search);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load suppliers: $e';
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> addSupplier(Map<String, dynamic> data) async {
    try {
      await _supplierService.create(data);
      await loadSuppliers();
      return true;
    } catch (e) {
      _error = 'Failed to add supplier: $e';
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateSupplier(String id, Map<String, dynamic> data) async {
    try {
      await _supplierService.update(id, data);
      await loadSuppliers();
      return true;
    } catch (e) {
      _error = 'Failed to update supplier: $e';
      notifyListeners();
      return false;
    }
  }

  Future<bool> deleteSupplier(String id) async {
    try {
      await _supplierService.delete(id);
      _suppliers.removeWhere((s) => s.id == id);
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to delete supplier: $e';
      notifyListeners();
      return false;
    }
  }
}
