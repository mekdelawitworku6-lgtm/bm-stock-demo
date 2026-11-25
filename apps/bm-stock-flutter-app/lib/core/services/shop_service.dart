import '../api/api_client.dart';
import '../api/api_response.dart';
import '../models/shop_model.dart';

class ShopService {
  final ApiClient _api = ApiClient();

  Future<List<ShopModel>> getAll({String? search, String? companyId}) async {
    final params = <String, String>{'limit': '100'};
    if (search != null) params['search'] = search;
    if (companyId != null) params['companyId'] = companyId;
    final result = await _api.get('/shops', queryParams: params.isNotEmpty ? params : null);
    return parseApiList(result).map((e) => ShopModel.fromJson(e)).toList();
  }

  Future<ShopModel> getById(String id) async {
    final result = await _api.get('/shops/$id');
    return ShopModel.fromJson(result);
  }

  Future<ShopModel> create(Map<String, dynamic> data) async {
    final result = await _api.post('/shops', body: data);
    return ShopModel.fromJson(result);
  }

  Future<ShopModel> update(String id, Map<String, dynamic> data) async {
    final result = await _api.put('/shops/$id', body: data);
    return ShopModel.fromJson(result);
  }

  Future<void> delete(String id) async {
    await _api.delete('/shops/$id');
  }
}
