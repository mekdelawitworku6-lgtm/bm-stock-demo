import 'package:flutter_bloc/flutter_bloc.dart';
import '../../services/supplier_service.dart';
import 'supplier_event.dart';
import 'supplier_state.dart';

export 'supplier_event.dart';
export 'supplier_state.dart';

class SupplierBloc extends Bloc<SupplierEvent, SupplierState> {
  final SupplierService _supplierService = SupplierService();

  SupplierBloc() : super(const SupplierState()) {
    on<SuppliersLoadRequested>(_onLoad);
    on<SupplierAddRequested>(_onAdd);
    on<SupplierUpdateRequested>(_onUpdate);
    on<SupplierDeleteRequested>(_onDelete);
  }

  Future<void> _onLoad(SuppliersLoadRequested event, Emitter<SupplierState> emit) async {
    emit(state.copyWith(isLoading: true, error: () => null));
    try {
      final suppliers = await _supplierService.getAll(search: event.search);
      emit(state.copyWith(suppliers: suppliers, isLoading: false));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: () => 'Failed to load suppliers: $e'));
    }
  }

  Future<void> _onAdd(SupplierAddRequested event, Emitter<SupplierState> emit) async {
    try {
      await _supplierService.create(event.data);
      add(SuppliersLoadRequested());
    } catch (e) {
      emit(state.copyWith(error: () => 'Failed to add supplier: $e'));
    }
  }

  Future<void> _onUpdate(SupplierUpdateRequested event, Emitter<SupplierState> emit) async {
    try {
      await _supplierService.update(event.id, event.data);
      add(SuppliersLoadRequested());
    } catch (e) {
      emit(state.copyWith(error: () => 'Failed to update supplier: $e'));
    }
  }

  Future<void> _onDelete(SupplierDeleteRequested event, Emitter<SupplierState> emit) async {
    try {
      await _supplierService.delete(event.id);
      final updated = state.suppliers.where((s) => s.id != event.id).toList();
      emit(state.copyWith(suppliers: updated));
    } catch (e) {
      emit(state.copyWith(error: () => 'Failed to delete supplier: $e'));
    }
  }
}
