import 'package:flutter/foundation.dart';
import '../models/customer_model.dart';
import '../services/customer_service.dart';

class CustomerProvider with ChangeNotifier {
  final CustomerService _customerService = CustomerService();

  List<CustomerModel> _customers = [];
  bool _isLoading = false;
  String? _error;

  List<CustomerModel> get customers => _customers;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> loadCustomers({String? search}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _customers = await _customerService.getAll(search: search);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load customers: $e';
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> addCustomer(Map<String, dynamic> data) async {
    try {
      await _customerService.create(data);
      await loadCustomers();
      return true;
    } catch (e) {
      _error = 'Failed to add customer: $e';
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateCustomer(String id, Map<String, dynamic> data) async {
    try {
      await _customerService.update(id, data);
      await loadCustomers();
      return true;
    } catch (e) {
      _error = 'Failed to update customer: $e';
      notifyListeners();
      return false;
    }
  }

  Future<bool> deleteCustomer(String id) async {
    try {
      await _customerService.delete(id);
      _customers.removeWhere((c) => c.id == id);
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to delete customer: $e';
      notifyListeners();
      return false;
    }
  }
}
