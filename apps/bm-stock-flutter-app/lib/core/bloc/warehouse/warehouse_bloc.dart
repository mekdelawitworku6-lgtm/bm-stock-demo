import 'package:flutter_bloc/flutter_bloc.dart';
import '../../services/warehouse_service.dart';
import 'warehouse_event.dart';
import 'warehouse_state.dart';

export 'warehouse_event.dart';
export 'warehouse_state.dart';

class WarehouseBloc extends Bloc<WarehouseEvent, WarehouseState> {
  final WarehouseService _warehouseService = WarehouseService();

  WarehouseBloc() : super(const WarehouseState()) {
    on<WarehousesLoadRequested>(_onLoad);
    on<WarehouseAddRequested>(_onAdd);
    on<WarehouseUpdateRequested>(_onUpdate);
    on<WarehouseDeleteRequested>(_onDelete);
  }

  Future<void> _onLoad(WarehousesLoadRequested event, Emitter<WarehouseState> emit) async {
    emit(state.copyWith(isLoading: true, error: () => null));
    try {
      final warehouses = await _warehouseService.getAll();
      emit(state.copyWith(warehouses: warehouses, isLoading: false));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: () => 'Failed to load warehouses: $e'));
    }
  }

  Future<void> _onAdd(WarehouseAddRequested event, Emitter<WarehouseState> emit) async {
    try {
      await _warehouseService.create(event.data);
      add(WarehousesLoadRequested());
      emit(state.copyWith(lastActionSuccess: () => true));
    } catch (e) {
      emit(state.copyWith(error: () => 'Failed to add warehouse: $e', lastActionSuccess: () => false));
    }
  }

  Future<void> _onUpdate(WarehouseUpdateRequested event, Emitter<WarehouseState> emit) async {
    try {
      await _warehouseService.update(event.id, event.data);
      add(WarehousesLoadRequested());
      emit(state.copyWith(lastActionSuccess: () => true));
    } catch (e) {
      emit(state.copyWith(error: () => 'Failed to update warehouse: $e', lastActionSuccess: () => false));
    }
  }

  Future<void> _onDelete(WarehouseDeleteRequested event, Emitter<WarehouseState> emit) async {
    try {
      await _warehouseService.delete(event.id);
      add(WarehousesLoadRequested());
      emit(state.copyWith(lastActionSuccess: () => true));
    } catch (e) {
      emit(state.copyWith(error: () => 'Failed to delete warehouse: $e', lastActionSuccess: () => false));
    }
  }
}
