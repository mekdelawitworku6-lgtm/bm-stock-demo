import '../api/api_client.dart';
import '../models/supplier_model.dart';

class SupplierService {
  final ApiClient _api = ApiClient();

  Future<List<SupplierModel>> getAll({String? search}) async {
    final params = <String, String>{};
    if (search != null) params['search'] = search;
    final result = await _api.get('/collections/suppliers', queryParams: params.isNotEmpty ? params : null);
    final data = result is Map ? (result['data'] ?? result) : result;
    final list = data is Map ? (data['data'] ?? []) : data;
    return (list as List).map((e) => SupplierModel.fromJson(e)).toList();
  }

  Future<SupplierModel> create(Map<String, dynamic> data) async {
    final result = await _api.post('/collections/supplier', body: data);
    return SupplierModel.fromJson(result);
  }

  Future<SupplierModel> update(String id, Map<String, dynamic> data) async {
    final result = await _api.put('/collections/supplier/$id', body: data);
    return SupplierModel.fromJson(result);
  }

  Future<void> delete(String id) async {
    await _api.delete('/collections/supplier/$id');
  }
}
