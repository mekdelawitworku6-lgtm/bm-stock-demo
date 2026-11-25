import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/api_client.dart';
import '../api/api_response.dart';
import '../models/company_model.dart';

class CompanyProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<CompanyModel> _companies = [];
  CompanyModel? _selectedCompany;
  bool _isLoading = false;
  String? _error;

  List<CompanyModel> get companies => _companies;
  CompanyModel? get selectedCompany => _selectedCompany;
  bool get isLoading => _isLoading;
  String? get error => _error;

  CompanyProvider() {
    _loadFromPrefs();
  }

  void clear() {
    debugPrint('[CompanyProvider] clear');
    _companies = [];
    _selectedCompany = null;
    _isLoading = false;
    _error = null;
    SharedPreferences.getInstance().then((prefs) {
      prefs.remove('companies');
      prefs.remove('selected_company_id');
    });
    _isLoading = false;
    notifyListeners();
  }

  Future<void> _loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final companiesJson = prefs.getString('companies');
    final selectedId = prefs.getString('selected_company_id');
    if (companiesJson != null) {
      final list = (json.decode(companiesJson) as List)
          .map((e) => CompanyModel.fromJson(e))
          .toList();
      _companies = list;
      if (selectedId != null) {
        _selectedCompany = list.where((c) => c.id == selectedId).firstOrNull;
      }
      if (_selectedCompany == null && list.isNotEmpty) {
        _selectedCompany = list.first;
      }
      notifyListeners();
    }
  }

  Future<void> _saveToPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
        'companies', json.encode(_companies.map((c) => c.toJson()).toList()));
    if (_selectedCompany != null) {
      await prefs.setString('selected_company_id', _selectedCompany!.id);
    }
  }

  void selectCompany(CompanyModel company) {
    if (_selectedCompany?.id == company.id) return;
    _selectedCompany = company;
    _saveToPrefs();
    notifyListeners();
  }

  Future<void> loadCompanies({bool showLoading = true}) async {
    debugPrint('[CompanyProvider] loadCompanies start, companies=${_companies.length}');
    final isInitialLoad = _companies.isEmpty;
    if (showLoading && isInitialLoad) {
      _isLoading = true;
      _error = null;
      notifyListeners();
    }

    try {
      final result = await _api.get('/companies', queryParams: {'limit': '100'});
      final fetched = _parseCompanyList(result);
      debugPrint('[CompanyProvider] loadCompanies fetched ${fetched.length} companies');
      final selectedId = _selectedCompany?.id;

      // Merge newly fetched companies while retaining locally created ones not yet returned
      final updatedList = <CompanyModel>[...fetched];
      for (final localCompany in _companies) {
        if (localCompany.id.isNotEmpty &&
            !updatedList.any((c) => c.id == localCompany.id)) {
          updatedList.insert(0, localCompany);
        }
      }
      _companies = updatedList;

      if (selectedId != null) {
        _selectedCompany =
            _companies.where((c) => c.id == selectedId).firstOrNull ??
                _selectedCompany;
      } else if (_companies.isNotEmpty) {
        _selectedCompany = _companies.first;
      } else {
        _selectedCompany = null;
      }
      _saveToPrefs();
      _isLoading = false;
      debugPrint('[CompanyProvider] loadCompanies done, companies=${_companies.length}, selected=${_selectedCompany?.name}');
      notifyListeners();
    } catch (e) {
      debugPrint('[CompanyProvider] loadCompanies error: $e');
      _error = 'Failed to load companies: $e';
      _isLoading = false;
      notifyListeners();
    }
  }

  List<CompanyModel> _parseCompanyList(dynamic result) {
    return parseApiList(result)
        .map((e) => CompanyModel.fromJson(e))
        .where((c) => c.id.isNotEmpty && c.name.isNotEmpty)
        .toList();
  }

  Future<bool> addCompany(Map<String, dynamic> data) async {
    _error = null;

    try {
      final body = {
        'name': (data['name'] ?? '').toString().trim(),
        'address': (data['address'] ?? 'Not specified').toString().trim(),
        if (data['email'] != null) 'email': data['email'],
        if (data['phoneNumber'] != null) 'phoneNumber': data['phoneNumber'],
      };

      final result = await _api.post('/companies', body: body);
      final payload = parseApiMap(result);
      final company = CompanyModel.fromJson(payload);
      if (company.id.isEmpty || company.name.isEmpty) {
        throw Exception('Invalid company response from server');
      }

      _companies.removeWhere((c) => c.id == company.id);
      _companies.insert(0, company);
      _selectedCompany = company;
      await _saveToPrefs();
      notifyListeners();

      await loadCompanies(showLoading: false);
      _selectedCompany = _companies
              .where((c) => c.id == company.id)
              .firstOrNull ??
          company;
      await _saveToPrefs();
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to add company: $e';
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateCompany(String id, Map<String, dynamic> data) async {
    try {
      await _api.put('/companies/$id', body: data);
      final index = _companies.indexWhere((c) => c.id == id);
      if (index != -1) {
        _companies[index] = CompanyModel.fromJson({...data, 'id': id});
        if (_selectedCompany?.id == id) {
          _selectedCompany = _companies[index];
        }
        _saveToPrefs();
        notifyListeners();
      }
      return true;
    } catch (e) {
      _error = 'Failed to update company: $e';
      notifyListeners();
      return false;
    }
  }

  Future<bool> deleteCompany(String id) async {
    try {
      await _api.delete('/companies/$id');
      _companies.removeWhere((c) => c.id == id);
      if (_selectedCompany?.id == id) {
        _selectedCompany = _companies.isNotEmpty ? _companies.first : null;
      }
      _saveToPrefs();
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to delete company: $e';
      notifyListeners();
      return false;
    }
  }
}
