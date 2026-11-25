import '../api/api_client.dart';

class BankAccountService {
  final ApiClient _api = ApiClient();

  Future<List<dynamic>> getAccounts({String? companyId}) async {
    final params = <String, String>{};
    if (companyId != null) params['companyId'] = companyId;
    final result = await _api.get('/bank/accounts', queryParams: params.isNotEmpty ? params : null);
    final data = result is Map ? (result['data'] ?? result) : result;
    if (data is List) return data;
    return [];
  }

  Future<dynamic> createAccount(Map<String, dynamic> data) async {
    final result = await _api.post('/bank/accounts', body: data);
    return result is Map ? (result['data'] ?? result) : result;
  }

  Future<dynamic> addBalance(Map<String, dynamic> data) async {
    final result = await _api.post('/bank/add-balance', body: data);
    return result is Map ? (result['data'] ?? result) : result;
  }

  Future<List<dynamic>> getExpenses({String? companyId}) async {
    final params = <String, String>{};
    if (companyId != null) params['companyId'] = companyId;
    final result = await _api.get('/bank/expenses', queryParams: params.isNotEmpty ? params : null);
    final data = result is Map ? (result['data'] ?? result) : result;
    if (data is List) return data;
    return [];
  }

  Future<dynamic> createExpense(Map<String, dynamic> data) async {
    final result = await _api.post('/bank/expenses', body: data);
    return result is Map ? (result['data'] ?? result) : result;
  }

  Future<Map<String, dynamic>> getSummary({String? companyId}) async {
    final params = <String, String>{};
    if (companyId != null) params['companyId'] = companyId;
    final result = await _api.get('/bank/summary', queryParams: params.isNotEmpty ? params : null);
    final data = result is Map ? (result['data'] ?? result) : result;
    if (data is Map<String, dynamic>) return data;
    return Map<String, dynamic>.from(data as Map);
  }
}
