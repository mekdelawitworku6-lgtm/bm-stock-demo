import 'package:equatable/equatable.dart';
import '../../models/warehouse_model.dart';

class WarehouseState extends Equatable {
  final List<WarehouseModel> warehouses;
  final bool isLoading;
  final String? error;
  final bool? lastActionSuccess;

  const WarehouseState({
    this.warehouses = const [],
    this.isLoading = false,
    this.error,
    this.lastActionSuccess,
  });

  WarehouseState copyWith({
    List<WarehouseModel>? warehouses,
    bool? isLoading,
    String? Function()? error,
    bool? Function()? lastActionSuccess,
  }) {
    return WarehouseState(
      warehouses: warehouses ?? this.warehouses,
      isLoading: isLoading ?? this.isLoading,
      error: error != null ? error() : this.error,
      lastActionSuccess: lastActionSuccess != null ? lastActionSuccess() : this.lastActionSuccess,
    );
  }

  @override
  List<Object?> get props => [warehouses, isLoading, error, lastActionSuccess];
}
