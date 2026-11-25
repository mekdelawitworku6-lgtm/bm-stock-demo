import '../api/api_client.dart';

class ExpenseService {
  final _api = ApiClient();

  /// Records a purchase/expense. This does NOT create products or change stock.
  Future<Map<String, dynamic>> createExpense({
    required String itemName,
    String? category,
    int quantity = 1,
    double unitCost = 0,
    double? totalCost,
    String? supplierName,
    String? referenceNumber,
    String? note,
    String? warehouseId,
    String? shopId,
  }) async {
    final result = await _api.post('/expenses', body: {
      'itemName': itemName,
      'category': category,
      'quantity': quantity,
      'unitCost': unitCost,
      'totalCost': totalCost ?? quantity * unitCost,
      if (supplierName != null && supplierName.isNotEmpty) 'supplierName': supplierName,
      if (referenceNumber != null && referenceNumber.isNotEmpty) 'referenceNumber': referenceNumber,
      if (note != null && note.isNotEmpty) 'note': note,
      if (warehouseId != null && warehouseId.isNotEmpty) 'warehouseId': warehouseId,
      if (shopId != null && shopId.isNotEmpty) 'shopId': shopId,
    });
    return result is Map ? Map<String, dynamic>.from(result) : <String, dynamic>{};
  }

  /// Returns a map with keys: data (List), summary (Map), total, page, totalPages.
  Future<Map<String, dynamic>> getExpenses({
    String? search,
    String? warehouseId,
    String? shopId,
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
    if (startDate != null) params['startDate'] = startDate;
    if (endDate != null) params['endDate'] = endDate;

    final result = await _api.get('/expenses', queryParams: params);

    if (result is Map) {
      return {
        'data': result['data'] ?? [],
        'total': result['total'] ?? 0,
        'page': result['page'] ?? 1,
        'totalPages': result['totalPages'] ?? 1,
        'summary': result['summary'] ?? {
          'totalExpenseAmount': 0,
          'totalUnits': 0,
          'recordCount': 0,
        },
      };
    }
    return {
      'data': [],
      'total': 0,
      'page': 1,
      'totalPages': 1,
      'summary': {'totalExpenseAmount': 0, 'totalUnits': 0, 'recordCount': 0},
    };
  }
}
