import '../api/api_client.dart';
import '../models/product_model.dart';
import 'inventory_service.dart';
import 'product_service.dart';
import 'sale_service.dart';

/// Loads supplementary datasets for the reports screen.
class ReportSupplementService {
  final _api = ApiClient();
  final _inventory = InventoryService();
  final _products = ProductService();
  final _sales = SaleService();

  Future<List<Map<String, dynamic>>> loadCommissions() async {
    try {
      final res = await _api.get('/Commissions', queryParams: {'limit': '100'});
      final data = res is Map ? res['data'] ?? res : res;
      if (data is List && data.isNotEmpty) {
        return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
      }
    } catch (_) {}
    try {
      final pendingRes = await _api.get('/Commissions/pending');
      final data = pendingRes is Map ? pendingRes['data'] ?? pendingRes : pendingRes;
      if (data is List && data.isNotEmpty) {
        return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<List<Map<String, dynamic>>> loadStockTransactions({String? type, int limit = 100}) async {
    try {
      final rows = await _inventory.getTransactions(type: type, limit: limit);
      return rows.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    } catch (_) {}
    return [];
  }

  Future<List<ProductModel>> loadLowStock({String? companyId}) async {
    try {
      final all = await _products.getAllForCompany(companyId: companyId);
      return all.where((p) => p.trackStock && p.minStockLevel > 0 && p.stockQuantity <= p.minStockLevel).toList();
    } catch (_) {}
    return [];
  }

  Future<Map<String, dynamic>?> loadDailyCreditSummary({String? companyId}) async {
    try {
      return await _sales.getDailyReport(companyId: companyId);
    } catch (_) {}
    return null;
  }

  Future<List<Map<String, dynamic>>> loadTransfers({int limit = 100}) async {
    try {
      final res = await _api.get('/transfers', queryParams: {'limit': limit.toString()});
      final data = res is Map ? res['data'] ?? res : res;
      if (data is List) {
        return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
      }
    } catch (_) {}
    return [];
  }
}
