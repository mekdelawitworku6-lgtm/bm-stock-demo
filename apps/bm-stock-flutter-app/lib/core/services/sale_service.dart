import 'package:image_picker/image_picker.dart';
import '../api/api_client.dart';
import '../api/api_response.dart';
import '../models/sale_model.dart';

class SaleService {
  final ApiClient _api = ApiClient();

  Future<List<SaleModel>> getAll({int page = 1, int limit = 20, String? status, String? companyId, String? customerId}) async {
    final params = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (status != null) params['status'] = status;
    if (companyId != null) params['companyId'] = companyId;
    if (customerId != null) params['customerId'] = customerId;
    final result = await _api.get('/sales', queryParams: params);
    return parseApiList(result).map((e) => SaleModel.fromJson(e)).toList();
  }

  Future<SaleModel> getById(String id) async {
    final result = await _api.get('/sales/$id');
    return SaleModel.fromJson(parseApiMap(result));
  }

  Future<SaleModel> create(Map<String, dynamic> data) async {
    final result = await _api.post('/sales', body: data);
    return SaleModel.fromJson(parseApiMap(result));
  }

  Future<String> uploadReceipt(XFile file) async {
    final bytes = await file.readAsBytes();
    final filename = file.name.isNotEmpty ? file.name : 'receipt.jpg';
    final result = await _api.uploadFile('/sales/upload-receipt', bytes, filename);
    if (result is Map && result['url'] is String) {
      return result['url'] as String;
    }
    throw Exception('Upload failed');
  }

  Future<Map<String, dynamic>> getDailyReport({String? date, String? companyId}) async {
    final params = <String, String>{};
    if (date != null) params['date'] = date;
    if (companyId != null) params['companyId'] = companyId;
    return parseApiMap(
      await _api.get('/sales/reports/daily', queryParams: params.isNotEmpty ? params : null),
    );
  }

  Future<Map<String, dynamic>> getMonthlyReport({int? year, int? month, String? companyId}) async {
    final params = <String, String>{};
    if (year != null) params['year'] = year.toString();
    if (month != null) params['month'] = month.toString();
    if (companyId != null) params['companyId'] = companyId;
    return parseApiMap(
      await _api.get('/sales/reports/monthly', queryParams: params.isNotEmpty ? params : null),
    );
  }

  Future<Map<String, dynamic>> getAnalytics({
    String? period,
    String? from,
    String? to,
    String? productId,
    String? customerId,
    String? sellerId,
    String? locationId,
    String? locationType,
    String? companyId,
    int? limit,
  }) async {
    final params = <String, String>{};
    if (period != null) params['period'] = period;
    if (from != null) params['from'] = from;
    if (to != null) params['to'] = to;
    if (productId != null) params['productId'] = productId;
    if (customerId != null) params['customerId'] = customerId;
    if (sellerId != null) params['sellerId'] = sellerId;
    if (locationId != null) params['locationId'] = locationId;
    if (locationType != null) params['locationType'] = locationType;
    if (companyId != null) params['companyId'] = companyId;
    if (limit != null) params['limit'] = limit.toString();
    final result = await _api.get(
      '/sales/reports/analytics',
      queryParams: params.isNotEmpty ? params : null,
    );
    return parseApiMap(result);
  }

  Future<List<SaleModel>> getRecent({int limit = 10, String? companyId}) async {
    final params = <String, String>{'limit': limit.toString(), 'page': '1'};
    if (companyId != null) params['companyId'] = companyId;
    final result = await _api.get('/sales', queryParams: params);
    return parseApiList(result).map((e) => SaleModel.fromJson(e)).toList();
  }

  Future<Map<String, dynamic>> applyPayment(String saleId, Map<String, dynamic> data) async {
    final result = await _api.post('/sales/$saleId/payment', body: data);
    return Map<String, dynamic>.from(result as Map);
  }

  Future<List<Map<String, dynamic>>> getPaymentHistory(String saleId) async {
    final result = await _api.get('/sales/$saleId/payment-history');
    final data = result is Map ? (result['data'] ?? result) : result;
    return (data as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<Map<String, dynamic>> findCustomerByPhone(String phone) async {
    final result = await _api.get('/sales/search/customer-by-phone', queryParams: {'phone': phone});
    return Map<String, dynamic>.from(result as Map);
  }

  Future<bool> sendReminder(String saleId) async {
    try {
      await _api.post('/sales/$saleId/reminder', body: {});
      return true;
    } catch (_) {
      return false;
    }
  }
}
