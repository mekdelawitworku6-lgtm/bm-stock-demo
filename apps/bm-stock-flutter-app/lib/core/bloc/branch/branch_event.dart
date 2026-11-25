import 'package:equatable/equatable.dart';

abstract class BranchEvent extends Equatable {
  const BranchEvent();
  @override
  List<Object?> get props => [];
}

class BranchesLoadRequested extends BranchEvent {
  final String? companyId;
  const BranchesLoadRequested({this.companyId});
  @override
  List<Object?> get props => [companyId];
}

class ShopAddRequested extends BranchEvent {
  final Map<String, dynamic> data;
  const ShopAddRequested({required this.data});
  @override
  List<Object?> get props => [data];
}

class ShopUpdateRequested extends BranchEvent {
  final String id;
  final Map<String, dynamic> data;
  const ShopUpdateRequested({required this.id, required this.data});
  @override
  List<Object?> get props => [id, data];
}

class ShopDeleteRequested extends BranchEvent {
  final String id;
  const ShopDeleteRequested({required this.id});
  @override
  List<Object?> get props => [id];
}

class WarehouseAddRequested extends BranchEvent {
  final Map<String, dynamic> data;
  const WarehouseAddRequested({required this.data});
  @override
  List<Object?> get props => [data];
}

class WarehouseUpdateRequested extends BranchEvent {
  final String id;
  final Map<String, dynamic> data;
  const WarehouseUpdateRequested({required this.id, required this.data});
  @override
  List<Object?> get props => [id, data];
}

class WarehouseDeleteRequested extends BranchEvent {
  final String id;
  const WarehouseDeleteRequested({required this.id});
  @override
  List<Object?> get props => [id];
}
