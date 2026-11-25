import 'package:equatable/equatable.dart';
import '../../models/customer_model.dart';

class CustomerState extends Equatable {
  final List<CustomerModel> customers;
  final bool isLoading;
  final String? error;

  const CustomerState({
    this.customers = const [],
    this.isLoading = false,
    this.error,
  });

  CustomerState copyWith({
    List<CustomerModel>? customers,
    bool? isLoading,
    String? Function()? error,
  }) {
    return CustomerState(
      customers: customers ?? this.customers,
      isLoading: isLoading ?? this.isLoading,
      error: error != null ? error() : this.error,
    );
  }

  @override
  List<Object?> get props => [customers, isLoading, error];
}
