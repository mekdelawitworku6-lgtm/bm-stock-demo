import '../api/api_client.dart';
import '../api/api_response.dart';
import '../models/product_model.dart';
import 'csv_template_builder.dart';

class ProductService {
  final ApiClient _api = ApiClient();
  static const int _maxPageSize = 100;

  Future<List<ProductModel>> getAll({String? search, String? category, String? companyId, int limit = _maxPageSize}) async {
    return _fetchAllPages('/products', {
      if (search != null) 'search': search,
      if (category != null) 'category': category,
      if (companyId != null) 'companyId': companyId,
    }, limit: limit.clamp(1, _maxPageSize));
  }

  Future<List<ProductModel>> getAllForCompany({String? companyId, String? search}) async {
    return _fetchAllPages('/products', {
      if (search != null) 'search': search,
      if (companyId != null) 'companyId': companyId,
    });
  }

  Future<List<ProductModel>> getByUserLocation({String? search, int limit = _maxPageSize}) async {
    return _fetchAllPages('/products/by-location', {
      if (search != null) 'search': search,
    }, limit: limit.clamp(1, _maxPageSize));
  }

  Future<List<ProductModel>> getByWarehouse(String warehouseId, {String? search, int limit = _maxPageSize}) async {
    return _fetchAllPages('/products/warehouse/$warehouseId', {
      if (search != null) 'search': search,
    }, limit: limit.clamp(1, _maxPageSize));
  }

  Future<List<ProductModel>> getByShop(String shopId, {String? search, int limit = _maxPageSize}) async {
    return _fetchAllPages('/products/shop/$shopId', {
      if (search != null) 'search': search,
    }, limit: limit.clamp(1, _maxPageSize));
  }

  Future<List<ProductModel>> _fetchAllPages(
    String path,
    Map<String, String> params, {
    int limit = _maxPageSize,
  }) async {
    final pageSize = limit.clamp(1, _maxPageSize);
    final all = <ProductModel>[];
    var page = 1;

    while (true) {
      final query = {
        ...params,
        'limit': pageSize.toString(),
        'page': page.toString(),
      };
      final result = await _api.get(path, queryParams: query);
      final list = parseApiList(result).map((e) => ProductModel.fromJson(e)).toList();
      all.addAll(list);
      if (list.length < pageSize) break;
      page++;
      if (page > 50) break;
    }

    return all;
  }

  Future<List<ProductModel>> getRecent({String? companyId, int limit = 10}) async {
    return getAll(companyId: companyId, limit: limit);
  }

  Future<List<ProductModel>> getLowStock({String? companyId}) async {
    final params = <String, String>{};
    if (companyId != null) params['companyId'] = companyId;
    final result = await _api.get('/products/low-stock', queryParams: params.isNotEmpty ? params : null);
    final data = result is Map ? (result['data'] ?? result) : result;
    return (data as List).map((e) => ProductModel.fromJson(e)).toList();
  }

  Future<List<ProductModel>> getExpired({String? companyId}) async {
    final params = <String, String>{};
    if (companyId != null) params['companyId'] = companyId;
    final result = await _api.get('/products/expired', queryParams: params.isNotEmpty ? params : null);
    final data = result is Map ? (result['data'] ?? result) : result;
    return (data as List).map((e) => ProductModel.fromJson(e)).toList();
  }

  Future<List<String>> getCategories({String? companyId}) async {
    final params = <String, String>{};
    if (companyId != null) params['companyId'] = companyId;
    final result = await _api.get('/products/categories', queryParams: params.isNotEmpty ? params : null);
    final data = result is Map ? (result['data'] ?? result) : result;
    return (data as List).map((e) => e.toString()).toList();
  }

  Future<ProductModel?> findByBarcode(String barcode) async {
    try {
      final result = await _api.post('/products/barcode-scan', body: {'barcode': barcode});
      return ProductModel.fromJson(result);
    } catch (_) {
      return null;
    }
  }

  Future<ProductModel> create(Map<String, dynamic> data) async {
    final result = await _api.post('/products', body: data);
    return ProductModel.fromJson(result);
  }

  Future<ProductModel> update(String id, Map<String, dynamic> data) async {
    final result = await _api.patch('/products/$id', body: data);
    return ProductModel.fromJson(result);
  }

  Future<void> delete(String id) async {
    await _api.delete('/products/$id');
  }

  Future<Map<String, dynamic>> bulkImport(List<int> bytes, String filename) async {
    final result = await _api.uploadFile('/products/bulk-import', bytes, filename);
    if (result is Map) {
      return Map<String, dynamic>.from(result);
    }
    return {'success': 0, 'errors': []};
  }

  /// Generates a CSV template file (with header row + one sample row) and shares it.
  Future<void> exportTemplate(List<String> headers, {List<Map<String, dynamic>>? sampleRows}) async {
    final csv = await CsvTemplateBuilder().build(headers, sampleRows: sampleRows);
    await CsvTemplateBuilder().share(csv, 'product_template.csv');
  }
}
