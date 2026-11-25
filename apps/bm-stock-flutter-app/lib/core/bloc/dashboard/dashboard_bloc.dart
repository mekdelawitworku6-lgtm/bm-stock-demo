import 'package:flutter_bloc/flutter_bloc.dart';
import '../../api/api_exceptions.dart';
import '../../services/sale_service.dart';
import '../../services/product_service.dart';
import '../../models/dashboard_stats.dart';
import 'dashboard_event.dart';
import 'dashboard_state.dart';

export 'dashboard_event.dart';
export 'dashboard_state.dart';

class DashboardBloc extends Bloc<DashboardEvent, DashboardState> {
  final SaleService _saleService = SaleService();
  final ProductService _productService = ProductService();

  DashboardBloc() : super(const DashboardState()) {
    on<DashboardLoadRequested>(_onLoad);
  }

  Future<void> _onLoad(DashboardLoadRequested event, Emitter<DashboardState> emit) async {
    emit(state.copyWith(isLoading: true, error: () => null));
    try {
      final results = await Future.wait([
        _saleService.getDailyReport(companyId: event.companyId),
        _saleService.getRecent(limit: 10, companyId: event.companyId),
        _productService.getLowStock(companyId: event.companyId),
        _productService.getExpired(companyId: event.companyId),
      ]);

      final report = results[0] as Map<String, dynamic>;
      final recentSales = results[1] as List<dynamic>;
      final lowStock = results[2] as List<dynamic>;
      final expired = results[3] as List<dynamic>;

      final creditSales = report['creditSales'] ?? 0;
      final creditCustomers = report['creditCustomers'] ?? 0;

      emit(state.copyWith(
        isLoading: false,
        stats: () => DashboardStats(
          totalSales: (report['allTimeRevenue'] ?? report['totalRevenue'] ?? 0).toDouble(),
          totalInvoices: report['allTimeSales'] ?? report['totalSales'] ?? 0,
          todaySales: (report['todayRevenue'] ?? report['totalRevenue'] ?? 0).toDouble(),
          todayInvoices: report['todaySales'] ?? report['totalSales'] ?? 0,
          productsCredit: creditSales,
          creditCustomers: creditCustomers,
          lowStockCount: lowStock.length,
          expiredCount: expired.length,
        ),
        recentSales: recentSales.cast(),
        lowStockProducts: lowStock.cast(),
        expiredProducts: expired.cast(),
      ));
    } on UnauthorizedException {
      emit(state.copyWith(isLoading: false, error: () => 'Session expired. Please login again.'));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: () => 'Failed to load dashboard: $e'));
    }
  }
}
