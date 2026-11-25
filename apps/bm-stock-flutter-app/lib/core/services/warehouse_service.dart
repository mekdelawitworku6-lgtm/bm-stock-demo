import '../api/api_client.dart';
import '../api/api_response.dart';
import '../models/warehouse_model.dart';

class WarehouseService {
  final ApiClient _api = ApiClient();

  Future<List<WarehouseModel>> getAll({String? search, String? companyId}) async {
    final params = <String, String>{'limit': '100'};
    if (search != null) params['search'] = search;
    if (companyId != null) params['companyId'] = companyId;
    final result = await _api.get('/warehouses', queryParams: params.isNotEmpty ? params : null);
    return parseApiList(result).map((e) => WarehouseModel.fromJson(e)).toList();
  }

  Future<WarehouseModel> getById(String id) async {
    final result = await _api.get('/warehouses/$id');
    return WarehouseModel.fromJson(result);
  }

  Future<WarehouseModel> create(Map<String, dynamic> data) async {
    final result = await _api.post('/warehouses', body: data);
    return WarehouseModel.fromJson(result);
  }

  Future<WarehouseModel> update(String id, Map<String, dynamic> data) async {
    final result = await _api.put('/warehouses/$id', body: data);
    return WarehouseModel.fromJson(result);
  }

  Future<void> delete(String id) async {
    await _api.delete('/warehouses/$id');
  }
}
