import '../api/api_client.dart';

class InventoryService {
  final _api = ApiClient();

  Future<Map<String, dynamic>> adjustStock({
    required String productId,
    required String type,
    required int quantity,
    String? warehouseId,
    String? shopId,
    String? reason,
    String? referenceNumber,
    double? unitCost,
    String? supplierId,
  }) async {
    final result = await _api.post('/inventory/adjust', body: {
      'type': type,
      'productId': productId,
      'quantity': quantity,
      if (warehouseId != null && warehouseId.isNotEmpty) 'warehouseId': warehouseId,
      if (shopId != null && shopId.isNotEmpty) 'shopId': shopId,
      if (reason != null && reason.isNotEmpty) 'reason': reason,
      if (referenceNumber != null && referenceNumber.isNotEmpty) 'referenceNumber': referenceNumber,
    });
    return result as Map<String, dynamic>;
  }

  Future<List<dynamic>> getTransactions({
    String? productId,
    String? warehouseId,
    String? companyId,
    String? type,
    int page = 1,
    int limit = 20,
  }) async {
    final params = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (productId != null) params['productId'] = productId;
    if (warehouseId != null) params['warehouseId'] = warehouseId;
    if (companyId != null) params['companyId'] = companyId;
    if (type != null) params['type'] = type;

    final result = await _api.get('/inventory/transactions', queryParams: params);

    if (result is Map<String, dynamic> && result.containsKey('data')) {
      return result['data'] as List<dynamic>;
    }
    return result as List<dynamic>;
  }

  /// Returns a map with keys: data (List), summary (Map), total, page, totalPages.
  Future<Map<String, dynamic>> getPurchases({
    String? search,
    String? warehouseId,
    String? shopId,
    String? companyId,
    String? startDate,
    String? endDate,
    int page = 1,
    int limit = 50,
  }) async {
    final params = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (search != null && search.isNotEmpty) params['search'] = search;
    if (warehouseId != null) params['warehouseId'] = warehouseId;
    if (shopId != null) params['shopId'] = shopId;
    if (companyId != null) params['companyId'] = companyId;
    if (startDate != null) params['startDate'] = startDate;
    if (endDate != null) params['endDate'] = endDate;

    final result = await _api.get('/inventory/purchases', queryParams: params);

    if (result is Map<String, dynamic>) {
      return {
        'data': result['data'] ?? [],
        'total': result['total'] ?? 0,
        'page': result['page'] ?? 1,
        'totalPages': result['totalPages'] ?? 1,
        'summary': result['summary'] ?? {
          'totalPurchasesCost': 0,
          'totalUnitsPurchased': 0,
          'transactionCount': 0,
        },
      };
    }
    return {
      'data': [],
      'total': 0,
      'page': 1,
      'totalPages': 1,
      'summary': {'totalPurchasesCost': 0, 'totalUnitsPurchased': 0, 'transactionCount': 0},
    };
  }
}
