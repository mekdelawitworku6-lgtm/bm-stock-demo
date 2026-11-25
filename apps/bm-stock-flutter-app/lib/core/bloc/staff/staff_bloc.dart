import 'package:flutter_bloc/flutter_bloc.dart';
import '../../services/employee_service.dart';
import 'staff_event.dart';
import 'staff_state.dart';

export 'staff_event.dart';
export 'staff_state.dart';

class StaffBloc extends Bloc<StaffEvent, StaffState> {
  final EmployeeService _employeeService = EmployeeService();

  StaffBloc() : super(const StaffState()) {
    on<StaffLoadRequested>(_onLoad);
    on<StaffAddRequested>(_onAdd);
    on<StaffUpdateRequested>(_onUpdate);
    on<StaffDeleteRequested>(_onDelete);
  }

  Future<void> _onLoad(StaffLoadRequested event, Emitter<StaffState> emit) async {
    emit(state.copyWith(isLoading: true, error: () => null));
    try {
      final employees = await _employeeService.getAll();
      emit(state.copyWith(employees: employees, isLoading: false));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: () => 'Failed to load employees: $e'));
    }
  }

  Future<void> _onAdd(StaffAddRequested event, Emitter<StaffState> emit) async {
    try {
      await _employeeService.create(event.data);
      add(StaffLoadRequested());
    } catch (e) {
      emit(state.copyWith(error: () => 'Failed to add employee: $e'));
    }
  }

  Future<void> _onUpdate(StaffUpdateRequested event, Emitter<StaffState> emit) async {
    try {
      await _employeeService.update(event.id, event.data);
      add(StaffLoadRequested());
    } catch (e) {
      emit(state.copyWith(error: () => 'Failed to update employee: $e'));
    }
  }

  Future<void> _onDelete(StaffDeleteRequested event, Emitter<StaffState> emit) async {
    try {
      await _employeeService.delete(event.id);
      final updated = state.employees.where((e) => e.id != event.id).toList();
      emit(state.copyWith(employees: updated));
    } catch (e) {
      emit(state.copyWith(error: () => 'Failed to delete employee: $e'));
    }
  }
}
