import '../api/api_client.dart';
import '../api/api_response.dart';
import '../models/transfer_model.dart';

class TransferService {
  final ApiClient _api = ApiClient();

  Future<List<TransferModel>> getAll({
    int page = 1,
    int limit = 10,
    String? status,
    String? type,
    String? branchId,
  }) async {
    final params = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (status != null) params['status'] = status;
    if (type != null) params['type'] = type;
    if (branchId != null) params['branchId'] = branchId;

    final result = await _api.get('/transfers', queryParams: params);
    return parseApiList(result).map((e) => TransferModel.fromJson(e)).toList();
  }

  Future<TransferModel> getById(String id) async {
    final result = await _api.get('/transfers/$id');
    return TransferModel.fromJson(parseApiMap(result));
  }

  Future<TransferModel> create(Map<String, dynamic> data) async {
    final result = await _api.post('/transfers', body: data);
    return TransferModel.fromJson(parseApiMap(result));
  }

  Future<TransferModel> updateStatus(String id, Map<String, dynamic> data) async {
    final result = await _api.patch('/transfers/$id', body: data);
    return TransferModel.fromJson(parseApiMap(result));
  }

  Future<List<TransferModel>> getHistory(String branchId, {String type = 'shop'}) async {
    final result = await _api.get('/transfers/history/$branchId', queryParams: {'type': type});
    return parseApiList(result).map((e) => TransferModel.fromJson(e)).toList();
  }
}
