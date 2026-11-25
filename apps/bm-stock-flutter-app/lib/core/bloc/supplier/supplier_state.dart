import 'package:equatable/equatable.dart';
import '../../models/supplier_model.dart';

class SupplierState extends Equatable {
  final List<SupplierModel> suppliers;
  final bool isLoading;
  final String? error;

  const SupplierState({
    this.suppliers = const [],
    this.isLoading = false,
    this.error,
  });

  SupplierState copyWith({
    List<SupplierModel>? suppliers,
    bool? isLoading,
    String? Function()? error,
  }) {
    return SupplierState(
      suppliers: suppliers ?? this.suppliers,
      isLoading: isLoading ?? this.isLoading,
      error: error != null ? error() : this.error,
    );
  }

  @override
  List<Object?> get props => [suppliers, isLoading, error];
}
