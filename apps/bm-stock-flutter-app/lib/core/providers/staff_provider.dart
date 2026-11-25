import 'package:flutter/foundation.dart';
import '../models/employee_model.dart';
import '../services/employee_service.dart';

class StaffProvider with ChangeNotifier {
  final EmployeeService _employeeService = EmployeeService();

  List<EmployeeModel> _employees = [];
  bool _isLoading = false;
  String? _error;
  String? _lastCompanyId;

  List<EmployeeModel> get employees => _employees;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String? get activeCompanyId => _lastCompanyId;

  void clear() {
    _employees = [];
    _lastCompanyId = null;
    _error = null;
    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadEmployees({String? companyId, bool showLoading = true}) async {
    final companyChanged = companyId != _lastCompanyId;
    _lastCompanyId = companyId;

    if (companyChanged) {
      _employees = [];
      notifyListeners();
    }

    final isInitialLoad = _employees.isEmpty;
    if (showLoading && isInitialLoad) {
      _isLoading = true;
      _error = null;
      notifyListeners();
    }

    try {
      final fetched = await _employeeService.getAll(companyId: companyId);
      _employees = companyChanged ? fetched : _mergeEmployees(fetched, _employees);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load employees: $e';
      _isLoading = false;
      notifyListeners();
    }
  }

  List<EmployeeModel> _mergeEmployees(
    List<EmployeeModel> fetched,
    List<EmployeeModel> local,
  ) {
    final merged = <EmployeeModel>[...fetched];
    for (final employee in local) {
      if (!merged.any((e) => e.id == employee.id)) {
        merged.insert(0, employee);
      }
    }
    return merged;
  }

  Future<EmployeeModel?> addEmployee(Map<String, dynamic> data) async {
    try {
      if (_lastCompanyId != null) data['companyId'] = _lastCompanyId;
      final newEmployee = await _employeeService.create(data);
      _employees.removeWhere((e) => e.id == newEmployee.id);
      _employees.insert(0, newEmployee);
      notifyListeners();
      // Also re-fetch from server in background to stay in sync
      loadEmployees(companyId: _lastCompanyId, showLoading: false);
      return newEmployee;
    } catch (e) {
      _error = 'Failed to add employee: $e';
      notifyListeners();
      rethrow;
    }
  }

  Future<bool> updateEmployee(String id, Map<String, dynamic> data) async {
    try {
      final updated = await _employeeService.update(id, data);
      final index = _employees.indexWhere((e) => e.id == id);
      if (index != -1) {
        _employees[index] = updated;
      } else {
        _employees.insert(0, updated);
      }
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to update employee: $e';
      notifyListeners();
      rethrow;
    }
  }

  Future<bool> deleteEmployee(String id) async {
    try {
      await _employeeService.delete(id);
      _employees.removeWhere((e) => e.id == id);
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to delete employee: $e';
      notifyListeners();
      rethrow;
    }
  }
}
