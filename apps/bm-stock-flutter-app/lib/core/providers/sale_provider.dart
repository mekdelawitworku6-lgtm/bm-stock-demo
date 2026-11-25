import 'package:flutter/foundation.dart';
import '../models/sale_model.dart';
import '../services/sale_service.dart';

class SaleProvider with ChangeNotifier {
  final SaleService _saleService = SaleService();

  List<SaleModel> _sales = [];
  bool _isLoading = false;
  String? _error;

  List<SaleModel> get sales => _sales;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String? _lastCompanyId;
  String? get activeCompanyId => _lastCompanyId;

  void clear() {
    _sales = [];
    _lastCompanyId = null;
    _error = null;
    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadSales({String? status, String? companyId}) async {
    final companyChanged = companyId != _lastCompanyId;
    _lastCompanyId = companyId;

    if (companyChanged) {
      _sales = [];
      notifyListeners();
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _sales = await _saleService.getAll(limit: 50, status: status, companyId: companyId);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load sales: $e';
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> createSale(Map<String, dynamic> data) async {
    try {
      await _saleService.create(data);
      await loadSales();
      return true;
    } catch (e) {
      _error = 'Failed to create sale: $e';
      notifyListeners();
      return false;
    }
  }

  Future<SaleModel?> getSale(String id) async {
    try {
      return await _saleService.getById(id);
    } catch (e) {
      _error = 'Failed to load sale: $e';
      notifyListeners();
      return null;
    }
  }

  Future<bool> applyPayment(String saleId, Map<String, dynamic> data) async {
    try {
      await _saleService.applyPayment(saleId, data);
      await loadSales();
      return true;
    } catch (e) {
      _error = 'Failed to apply payment: $e';
      notifyListeners();
      return false;
    }
  }

  Future<List<Map<String, dynamic>>> getPaymentHistory(String saleId) async {
    try {
      return await _saleService.getPaymentHistory(saleId);
    } catch (e) {
      return [];
    }
  }

  Future<Map<String, dynamic>> findCustomerByPhone(String phone) async {
    try {
      return await _saleService.findCustomerByPhone(phone);
    } catch (e) {
      return {};
    }
  }

  Future<bool> sendReminder(String saleId) async {
    try {
      return await _saleService.sendReminder(saleId);
    } catch (e) {
      return false;
    }
  }
}
