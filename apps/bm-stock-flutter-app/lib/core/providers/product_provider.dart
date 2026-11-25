import 'package:flutter/foundation.dart';
import '../models/product_model.dart';
import '../services/product_service.dart';

class ProductProvider with ChangeNotifier {
  final ProductService _productService = ProductService();

  List<ProductModel> _products = [];
  List<ProductModel> _lowStockProducts = [];
  List<ProductModel> _expiredProducts = [];
  bool _isLoading = false;
  String? _error;
  String? _lastCompanyId;

  List<ProductModel> get products => _products;
  List<ProductModel> get lowStockProducts => _lowStockProducts;
  List<ProductModel> get expiredProducts => _expiredProducts;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String? get activeCompanyId => _lastCompanyId;

  void clear() {
    _products = [];
    _lastCompanyId = null;
    _error = null;
    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadProducts({String? search, String? category, String? companyId, bool showLoading = true}) async {
    final companyChanged = companyId != _lastCompanyId;
    _lastCompanyId = companyId;

    if (companyChanged) {
      _products = [];
      notifyListeners();
    }

    if (showLoading || _products.isEmpty) {
      _isLoading = true;
      _error = null;
      notifyListeners();
    }

    try {
      _products = await _productService.getAll(search: search, category: category, companyId: companyId);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load products: $e';
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> addProduct(Map<String, dynamic> data) async {
    try {
      if (_lastCompanyId != null) data['companyId'] = _lastCompanyId;
      final newProduct = await _productService.create(data);
      _products.insert(0, newProduct);
      notifyListeners();
      loadProducts(companyId: _lastCompanyId, showLoading: false);
      return true;
    } catch (e) {
      _error = 'Failed to add product: $e';
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateProduct(String id, Map<String, dynamic> data) async {
    try {
      await _productService.update(id, data);
      await loadProducts();
      return true;
    } catch (e) {
      _error = 'Failed to update product: $e';
      notifyListeners();
      return false;
    }
  }

  Future<bool> deleteProduct(String id) async {
    try {
      await _productService.delete(id);
      _products.removeWhere((p) => p.id == id);
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to delete product: $e';
      notifyListeners();
      return false;
    }
  }

  Future<void> loadLowStock() async {
    try {
      _lowStockProducts = await _productService.getLowStock();
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load low stock: $e';
      notifyListeners();
    }
  }

  Future<void> loadExpired() async {
    try {
      _expiredProducts = await _productService.getExpired();
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load expired: $e';
      notifyListeners();
    }
  }

  Future<void> loadStockOverview() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      await Future.wait([loadLowStock(), loadExpired()]);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load stock overview: $e';
      _isLoading = false;
      notifyListeners();
    }
  }
}
