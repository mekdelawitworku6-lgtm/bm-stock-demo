import 'package:equatable/equatable.dart';
import '../../models/sale_model.dart';

class SaleState extends Equatable {
  final List<SaleModel> sales;
  final bool isLoading;
  final String? error;
  final bool? lastActionSuccess;

  const SaleState({
    this.sales = const [],
    this.isLoading = false,
    this.error,
    this.lastActionSuccess,
  });

  SaleState copyWith({
    List<SaleModel>? sales,
    bool? isLoading,
    String? error,
    bool? lastActionSuccess,
    bool clearError = false,
    bool clearAction = false,
  }) {
    return SaleState(
      sales: sales ?? this.sales,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? (clearError ? null : this.error),
      lastActionSuccess: lastActionSuccess ?? (clearAction ? null : this.lastActionSuccess),
    );
  }

  @override
  List<Object?> get props => [sales, isLoading, error, lastActionSuccess];
}
