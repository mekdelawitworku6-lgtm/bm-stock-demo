import '../api/api_client.dart';
import '../api/api_response.dart';
import '../models/borrowing_model.dart';

class BorrowingService {
  final ApiClient _api = ApiClient();

  Future<List<BorrowingModel>> getAll({
    int page = 1,
    int limit = 50,
    String? status,
    String? search,
    String? warehouseId,
    String? shopId,
  }) async {
    final params = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (status != null && status.isNotEmpty) params['status'] = status;
    if (search != null && search.isNotEmpty) params['search'] = search;
    if (warehouseId != null) params['warehouseId'] = warehouseId;
    if (shopId != null) params['shopId'] = shopId;

    final result = await _api.get('/borrowings', queryParams: params);
    return parseApiList(result).map(BorrowingModel.fromJson).toList();
  }

  Future<BorrowingModel> getById(String id) async {
    final result = await _api.get('/borrowings/$id');
    return BorrowingModel.fromJson(parseApiMap(result));
  }

  Future<BorrowingModel> create(Map<String, dynamic> data) async {
    final result = await _api.post('/borrowings', body: data);
    return BorrowingModel.fromJson(parseApiMap(result));
  }

  Future<BorrowingModel> update(String id, Map<String, dynamic> data) async {
    final result = await _api.patch('/borrowings/$id', body: data);
    return BorrowingModel.fromJson(parseApiMap(result));
  }
}
