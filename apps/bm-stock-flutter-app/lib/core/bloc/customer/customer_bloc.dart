import 'package:flutter_bloc/flutter_bloc.dart';
import '../../services/customer_service.dart';
import 'customer_event.dart';
import 'customer_state.dart';

export 'customer_event.dart';
export 'customer_state.dart';

class CustomerBloc extends Bloc<CustomerEvent, CustomerState> {
  final CustomerService _customerService = CustomerService();

  CustomerBloc() : super(const CustomerState()) {
    on<CustomersLoadRequested>(_onLoad);
    on<CustomerAddRequested>(_onAdd);
    on<CustomerUpdateRequested>(_onUpdate);
    on<CustomerDeleteRequested>(_onDelete);
  }

  Future<void> _onLoad(CustomersLoadRequested event, Emitter<CustomerState> emit) async {
    emit(state.copyWith(isLoading: true, error: () => null));
    try {
      final customers = await _customerService.getAll(search: event.search);
      emit(state.copyWith(customers: customers, isLoading: false));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: () => 'Failed to load customers: $e'));
    }
  }

  Future<void> _onAdd(CustomerAddRequested event, Emitter<CustomerState> emit) async {
    try {
      await _customerService.create(event.data);
      add(CustomersLoadRequested());
    } catch (e) {
      emit(state.copyWith(error: () => 'Failed to add customer: $e'));
    }
  }

  Future<void> _onUpdate(CustomerUpdateRequested event, Emitter<CustomerState> emit) async {
    try {
      await _customerService.update(event.id, event.data);
      add(CustomersLoadRequested());
    } catch (e) {
      emit(state.copyWith(error: () => 'Failed to update customer: $e'));
    }
  }

  Future<void> _onDelete(CustomerDeleteRequested event, Emitter<CustomerState> emit) async {
    try {
      await _customerService.delete(event.id);
      final updated = state.customers.where((c) => c.id != event.id).toList();
      emit(state.copyWith(customers: updated));
    } catch (e) {
      emit(state.copyWith(error: () => 'Failed to delete customer: $e'));
    }
  }
}
