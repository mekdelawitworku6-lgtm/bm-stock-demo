import 'package:equatable/equatable.dart';

abstract class SupplierEvent extends Equatable {
  const SupplierEvent();
  @override
  List<Object?> get props => [];
}

class SuppliersLoadRequested extends SupplierEvent {
  final String? search;
  const SuppliersLoadRequested({this.search});
  @override
  List<Object?> get props => [search];
}

class SupplierAddRequested extends SupplierEvent {
  final Map<String, dynamic> data;
  const SupplierAddRequested({required this.data});
  @override
  List<Object?> get props => [data];
}

class SupplierUpdateRequested extends SupplierEvent {
  final String id;
  final Map<String, dynamic> data;
  const SupplierUpdateRequested({required this.id, required this.data});
  @override
  List<Object?> get props => [id, data];
}

class SupplierDeleteRequested extends SupplierEvent {
  final String id;
  const SupplierDeleteRequested({required this.id});
  @override
  List<Object?> get props => [id];
}
