import 'package:flutter_bloc/flutter_bloc.dart';
import '../../models/shop_model.dart';
import '../../models/warehouse_model.dart';
import '../../services/shop_service.dart';
import '../../services/warehouse_service.dart';
import 'branch_event.dart';
import 'branch_state.dart';

export 'branch_event.dart';
export 'branch_state.dart';

class BranchBloc extends Bloc<BranchEvent, BranchState> {
  final ShopService _shopService = ShopService();
  final WarehouseService _warehouseService = WarehouseService();

  BranchBloc() : super(const BranchState()) {
    on<BranchesLoadRequested>(_onLoad);
    on<ShopAddRequested>(_onAddShop);
    on<ShopUpdateRequested>(_onUpdateShop);
    on<ShopDeleteRequested>(_onDeleteShop);
    on<WarehouseAddRequested>(_onAddWarehouse);
    on<WarehouseUpdateRequested>(_onUpdateWarehouse);
    on<WarehouseDeleteRequested>(_onDeleteWarehouse);
  }

  Future<void> _onLoad(BranchesLoadRequested event, Emitter<BranchState> emit) async {
    emit(state.copyWith(isLoading: true, error: () => null));
    try {
      final companyId = event.companyId;
      final results = await Future.wait([
        _shopService.getAll(companyId: companyId).catchError((_) => <ShopModel>[]),
        _warehouseService.getAll(companyId: companyId).catchError((_) => <WarehouseModel>[]),
      ]);
      emit(state.copyWith(
        shops: results[0].cast(),
        warehouses: results[1].cast(),
        isLoading: false,
      ));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: () => 'Failed to load branches: $e'));
    }
  }

  Future<void> _onAddShop(ShopAddRequested event, Emitter<BranchState> emit) async {
    try {
      await _shopService.create(event.data);
      add(BranchesLoadRequested());
      emit(state.copyWith(lastActionSuccess: () => true));
    } catch (e) {
      emit(state.copyWith(error: () => 'Failed to add shop: $e', lastActionSuccess: () => false));
    }
  }

  Future<void> _onUpdateShop(ShopUpdateRequested event, Emitter<BranchState> emit) async {
    try {
      await _shopService.update(event.id, event.data);
      add(BranchesLoadRequested());
      emit(state.copyWith(lastActionSuccess: () => true));
    } catch (e) {
      emit(state.copyWith(error: () => 'Failed to update shop: $e', lastActionSuccess: () => false));
    }
  }

  Future<void> _onDeleteShop(ShopDeleteRequested event, Emitter<BranchState> emit) async {
    try {
      await _shopService.delete(event.id);
      add(BranchesLoadRequested());
      emit(state.copyWith(lastActionSuccess: () => true));
    } catch (e) {
      emit(state.copyWith(error: () => 'Failed to delete shop: $e', lastActionSuccess: () => false));
    }
  }

  Future<void> _onAddWarehouse(WarehouseAddRequested event, Emitter<BranchState> emit) async {
    try {
      await _warehouseService.create(event.data);
      add(BranchesLoadRequested());
      emit(state.copyWith(lastActionSuccess: () => true));
    } catch (e) {
      emit(state.copyWith(error: () => 'Failed to add warehouse: $e', lastActionSuccess: () => false));
    }
  }

  Future<void> _onUpdateWarehouse(WarehouseUpdateRequested event, Emitter<BranchState> emit) async {
    try {
      await _warehouseService.update(event.id, event.data);
      add(BranchesLoadRequested());
      emit(state.copyWith(lastActionSuccess: () => true));
    } catch (e) {
      emit(state.copyWith(error: () => 'Failed to update warehouse: $e', lastActionSuccess: () => false));
    }
  }

  Future<void> _onDeleteWarehouse(WarehouseDeleteRequested event, Emitter<BranchState> emit) async {
    try {
      await _warehouseService.delete(event.id);
      add(BranchesLoadRequested());
      emit(state.copyWith(lastActionSuccess: () => true));
    } catch (e) {
      emit(state.copyWith(error: () => 'Failed to delete warehouse: $e', lastActionSuccess: () => false));
    }
  }
}
