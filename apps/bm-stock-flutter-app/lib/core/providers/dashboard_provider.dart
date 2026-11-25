import 'package:flutter/foundation.dart';
import '../api/api_exceptions.dart';
import '../models/dashboard_stats.dart';
import '../models/recent_activity_model.dart';
import '../models/sale_model.dart';
import '../models/product_model.dart';
import '../services/sale_service.dart';
import '../services/product_service.dart';
import '../services/inventory_service.dart';
import '../services/transfer_service.dart';
import '../services/sales_import_service.dart';

class DashboardProvider with ChangeNotifier {
  final SaleService _saleService = SaleService();
  final ProductService _productService = ProductService();
  final InventoryService _inventoryService = InventoryService();
  final TransferService _transferService = TransferService();

  DashboardStats? _stats;
  List<SaleModel> _recentSales = [];
  List<RecentActivityItem> _recentActivities = [];  List<ProductModel> _lowStockProducts = [];
  List<ProductModel> _expiredProducts = [];
  bool _isLoading = false;
  String? _error;
  String? _lastCompanyId;

  DashboardStats? get stats => _stats;
  List<SaleModel> get recentSales => _recentSales;
  List<RecentActivityItem> get recentActivities => _recentActivities;  List<ProductModel> get lowStockProducts => _lowStockProducts;
  List<ProductModel> get expiredProducts => _expiredProducts;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String? get activeCompanyId => _lastCompanyId;

  void clear() {
    _stats = null;
    _recentSales = [];
    _recentActivities = [];    _lowStockProducts = [];
    _expiredProducts = [];
    _lastCompanyId = null;
    _error = null;
    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadDashboard({String? companyId}) async {
    final companyChanged = companyId != _lastCompanyId;
    _lastCompanyId = companyId;

    if (companyChanged) {
      clear();
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      debugPrint('[Dashboard] Loading dashboard with companyId=$companyId');

      Map<String, dynamic> report = {};
      List<SaleModel> recentSales = [];
      List<RecentActivityItem> recentActivities = [];
      List<ProductModel> lowStockProducts = [];
      List<ProductModel> expiredProducts = [];

      try {
        report = await _saleService.getDailyReport(companyId: companyId);
        debugPrint('[Dashboard] Daily report: $report');
      } catch (e) {
        debugPrint('[Dashboard] Error loading daily report: $e');
      }

      try {
        recentSales = await _saleService.getRecent(limit: 10, companyId: companyId);
        debugPrint('[Dashboard] Recent sales count: ${recentSales.length}');
      } catch (e) {
        debugPrint('[Dashboard] Error loading recent sales: $e');
      }

      try {
        List<RecentActivityItem> salesActivities = [];
        List<RecentActivityItem> stockInActivities = [];
        List<RecentActivityItem> stockOutActivities = [];
        List<RecentActivityItem> productActivities = [];
        List<RecentActivityItem> transferActivities = [];

        try {
          salesActivities = recentSales.map(RecentActivityItem.fromSale).toList();
        } catch (e) {
          debugPrint('[Dashboard] Error mapping sales activities: $e');
        }

        try {
          final stockIn = await _inventoryService.getTransactions(
            type: 'stock_in',
            companyId: companyId,
            limit: 10,
          );
          stockInActivities = stockIn
              .whereType<Map>()
              .map((e) => RecentActivityItem.fromTransaction(Map<String, dynamic>.from(e)))
              .toList();
        } catch (e) {
          debugPrint('[Dashboard] Error loading stock-in activities: $e');
        }

        try {
          final stockOut = await _inventoryService.getTransactions(
            type: 'stock_out',
            companyId: companyId,
            limit: 10,
          );
          stockOutActivities = stockOut
              .whereType<Map>()
              .map((e) => RecentActivityItem.fromTransaction(Map<String, dynamic>.from(e)))
              .toList();
        } catch (e) {
          debugPrint('[Dashboard] Error loading stock-out activities: $e');
        }

        try {
          final recentProducts = await _productService.getRecent(companyId: companyId, limit: 10);
          productActivities = recentProducts.map(RecentActivityItem.fromProduct).toList();
        } catch (e) {
          debugPrint('[Dashboard] Error loading product activities: $e');
        }

        try {
          final recentTransfers = await _transferService.getAll(
            status: 'completed',
            limit: 10,
          );
          transferActivities = recentTransfers.map(RecentActivityItem.fromTransfer).toList();
          debugPrint('[Dashboard] Recent transfers count: ${transferActivities.length}');
        } catch (e) {
          debugPrint('[Dashboard] Error loading transfer activities: $e');
        }

        recentActivities = [
          ...salesActivities,
          ...stockInActivities,
          ...stockOutActivities,
          ...productActivities,
          ...transferActivities,
        ]..sort((a, b) => b.occurredAt.compareTo(a.occurredAt));

        if (recentActivities.length > 15) {
          recentActivities = recentActivities.sublist(0, 15);
        }
        debugPrint('[Dashboard] Recent activities count: ${recentActivities.length}');
      } catch (e) {
        debugPrint('[Dashboard] Error loading recent activities: $e');
        recentActivities = recentSales.map(RecentActivityItem.fromSale).toList();
      }

      try {
        lowStockProducts = await _productService.getLowStock(companyId: companyId);
        debugPrint('[Dashboard] Low stock count: ${lowStockProducts.length}');
      } catch (e) {
        debugPrint('[Dashboard] Error loading low stock: $e');
      }

      try {
        expiredProducts = await _productService.getExpired(companyId: companyId);
        debugPrint('[Dashboard] Expired count: ${expiredProducts.length}');
      } catch (e) {
        debugPrint('[Dashboard] Error loading expired products: $e');
      }

      int toInt(dynamic v) {
        if (v == null) return 0;
        if (v is int) return v;
        if (v is num) return v.toInt();
        return int.tryParse(v.toString()) ?? 0;
      }

      double toDouble(dynamic v) {
        if (v == null) return 0.0;
        if (v is num) return v.toDouble();
        return double.tryParse(v.toString()) ?? 0.0;
      }

      _recentSales = recentSales;
      _recentActivities = recentActivities;
      _lowStockProducts = lowStockProducts;
      _expiredProducts = expiredProducts;

      double importedTotal = 0.0;
      int importedCount = 0;
      double importedTodayTotal = 0.0;
      int importedTodayCount = 0;
      try {
        final importedList = await SalesImportService.getImportedSales();
        importedTotal = importedList.fold<double>(0.0, (sum, r) => sum + r.totalAmount);
        importedCount = importedList.length;
        final importedToday = importedList.where((r) => SalesImportService.isSaleWithin24Hours(r.saleDate)).toList();
        importedTodayTotal = importedToday.fold<double>(0.0, (sum, r) => sum + r.totalAmount);
        importedTodayCount = importedToday.length;
        debugPrint('[Dashboard] Found ${importedToday.length} imported sales within 24h totaling ETB $importedTodayTotal (total imported: $importedCount totaling ETB $importedTotal)');
      } catch (e) {
        debugPrint('[Dashboard] Error checking imported sales: $e');
      }

      final todaySales = toDouble(report['todayRevenue'] ?? report['totalRevenue']) + importedTodayTotal;
      final todayInvoices = toInt(report['todaySales'] ?? report['totalSales']) + importedTodayCount;
      final totalSales = toDouble(report['allTimeRevenue'] ?? report['totalRevenue']) + importedTotal;
      final totalInvoices = toInt(report['allTimeSales'] ?? report['totalSales']) + importedCount;
      debugPrint('[Dashboard] Final totalSales=$totalSales, totalInvoices=$totalInvoices, todaySales=$todaySales, todayInvoices=$todayInvoices');

      _stats = DashboardStats(
        totalSales: totalSales,
        totalInvoices: totalInvoices,
        todaySales: todaySales,
        todayInvoices: todayInvoices,
        productsCredit: toInt(report['creditSales']),
        creditCustomers: toInt(report['creditCustomers']),
        totalOutstandingCredit: toDouble(report['totalOutstandingCredit']),
        creditCustomersWithBalance: toInt(report['creditCustomersWithBalance']),
        totalCredit: toDouble(report['totalCredit']),
        unpaidCredit: toDouble(report['unpaidCredit']),
        partiallyPaidCredit: toDouble(report['partiallyPaidCredit']),
        paidCredit: toDouble(report['paidCredit']),
        overdueCredit: toDouble(report['overdueCredit']),
        lowStockCount: _lowStockProducts.length,
        expiredCount: _expiredProducts.length,
      );

      debugPrint('[Dashboard] Stats loaded: todaySales=${_stats!.todaySales}, todayInvoices=${_stats!.todayInvoices}');

      _isLoading = false;
      notifyListeners();
    } on UnauthorizedException {
      _error = 'Session expired. Please login again.';
      _isLoading = false;
      notifyListeners();
    } catch (e, stackTrace) {
      debugPrint('[Dashboard] CATCH ERROR: $e');
      debugPrint('[Dashboard] Stack trace: $stackTrace');
      _error = 'Failed to load dashboard: $e';
      _isLoading = false;
      notifyListeners();
    }
  }


}
