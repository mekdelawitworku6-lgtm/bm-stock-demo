import '../api/api_client.dart';
import '../models/customer_model.dart';

class CustomerService {
  final ApiClient _api = ApiClient();

  Future<List<CustomerModel>> getAll({String? search}) async {
    final params = <String, String>{};
    if (search != null) params['search'] = search;
    final result = await _api.get('/customers', queryParams: params.isNotEmpty ? params : null);
    final data = result is Map ? (result['data'] ?? result) : result;
    return (data as List).map((e) => CustomerModel.fromJson(e)).toList();
  }

  Future<CustomerModel> getById(String id) async {
    final result = await _api.get('/customers/$id');
    return CustomerModel.fromJson(result);
  }

  Future<CustomerModel> create(Map<String, dynamic> data) async {
    final result = await _api.post('/customers', body: data);
    return CustomerModel.fromJson(result);
  }

  Future<CustomerModel> update(String id, Map<String, dynamic> data) async {
    final result = await _api.put('/customers/$id', body: data);
    return CustomerModel.fromJson(result);
  }

  Future<void> delete(String id) async {
    await _api.delete('/customers/$id');
  }
}
