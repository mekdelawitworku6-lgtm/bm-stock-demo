import '../api/api_client.dart';
import '../api/api_response.dart';
import '../models/employee_model.dart';

class EmployeeService {
  final ApiClient _api = ApiClient();

  Future<List<EmployeeModel>> getAll({String? search, String? companyId}) async {
    final params = <String, String>{'limit': '100'};
    if (search != null) params['search'] = search;
    if (companyId != null) params['companyId'] = companyId;
    final result = await _api.get('/employees', queryParams: params.isNotEmpty ? params : null);
    return parseApiList(result).map((e) => EmployeeModel.fromJson(e)).toList();
  }

  Future<EmployeeModel> getById(String id) async {
    final result = await _api.get('/employees/$id');
    return EmployeeModel.fromJson(result);
  }

  Future<EmployeeModel> create(Map<String, dynamic> data) async {
    final result = await _api.post('/employees', body: data);
    return EmployeeModel.fromJson(result);
  }

  Future<EmployeeModel> update(String id, Map<String, dynamic> data) async {
    final result = await _api.put('/employees/$id', body: data);
    return EmployeeModel.fromJson(result);
  }

  Future<void> delete(String id) async {
    await _api.delete('/employees/$id');
  }
}
