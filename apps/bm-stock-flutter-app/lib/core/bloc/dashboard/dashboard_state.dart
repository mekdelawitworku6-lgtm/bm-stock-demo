import 'package:equatable/equatable.dart';
import '../../models/dashboard_stats.dart';
import '../../models/sale_model.dart';
import '../../models/product_model.dart';

class DashboardState extends Equatable {
  final DashboardStats? stats;
  final List<SaleModel> recentSales;
  final List<ProductModel> lowStockProducts;
  final List<ProductModel> expiredProducts;
  final bool isLoading;
  final String? error;

  const DashboardState({
    this.stats,
    this.recentSales = const [],
    this.lowStockProducts = const [],
    this.expiredProducts = const [],
    this.isLoading = false,
    this.error,
  });

  DashboardState copyWith({
    DashboardStats? Function()? stats,
    List<SaleModel>? recentSales,
    List<ProductModel>? lowStockProducts,
    List<ProductModel>? expiredProducts,
    bool? isLoading,
    String? Function()? error,
  }) {
    return DashboardState(
      stats: stats != null ? stats() : this.stats,
      recentSales: recentSales ?? this.recentSales,
      lowStockProducts: lowStockProducts ?? this.lowStockProducts,
      expiredProducts: expiredProducts ?? this.expiredProducts,
      isLoading: isLoading ?? this.isLoading,
      error: error != null ? error() : this.error,
    );
  }

  @override
  List<Object?> get props => [stats, recentSales, lowStockProducts, expiredProducts, isLoading, error];
}
