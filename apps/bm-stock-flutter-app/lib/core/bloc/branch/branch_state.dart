import 'package:equatable/equatable.dart';
import '../../models/shop_model.dart';
import '../../models/warehouse_model.dart';

class BranchState extends Equatable {
  final List<ShopModel> shops;
  final List<WarehouseModel> warehouses;
  final bool isLoading;
  final String? error;
  final bool? lastActionSuccess;

  List<dynamic> get branches => [...shops, ...warehouses];

  const BranchState({
    this.shops = const [],
    this.warehouses = const [],
    this.isLoading = false,
    this.error,
    this.lastActionSuccess,
  });

  BranchState copyWith({
    List<ShopModel>? shops,
    List<WarehouseModel>? warehouses,
    bool? isLoading,
    String? Function()? error,
    bool? Function()? lastActionSuccess,
  }) {
    return BranchState(
      shops: shops ?? this.shops,
      warehouses: warehouses ?? this.warehouses,
      isLoading: isLoading ?? this.isLoading,
      error: error != null ? error() : this.error,
      lastActionSuccess: lastActionSuccess != null ? lastActionSuccess() : this.lastActionSuccess,
    );
  }

  @override
  List<Object?> get props => [shops, warehouses, isLoading, error, lastActionSuccess];
}
