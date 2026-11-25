import 'package:equatable/equatable.dart';
import '../../models/employee_model.dart';

class StaffState extends Equatable {
  final List<EmployeeModel> employees;
  final bool isLoading;
  final String? error;

  const StaffState({
    this.employees = const [],
    this.isLoading = false,
    this.error,
  });

  StaffState copyWith({
    List<EmployeeModel>? employees,
    bool? isLoading,
    String? Function()? error,
  }) {
    return StaffState(
      employees: employees ?? this.employees,
      isLoading: isLoading ?? this.isLoading,
      error: error != null ? error() : this.error,
    );
  }

  @override
  List<Object?> get props => [employees, isLoading, error];
}
