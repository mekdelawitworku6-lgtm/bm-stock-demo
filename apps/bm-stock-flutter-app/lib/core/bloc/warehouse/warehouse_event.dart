import 'package:equatable/equatable.dart';

abstract class WarehouseEvent extends Equatable {
  const WarehouseEvent();
  @override
  List<Object?> get props => [];
}

class WarehousesLoadRequested extends WarehouseEvent {}

class WarehouseAddRequested extends WarehouseEvent {
  final Map<String, dynamic> data;
  const WarehouseAddRequested({required this.data});
  @override
  List<Object?> get props => [data];
}

class WarehouseUpdateRequested extends WarehouseEvent {
  final String id;
  final Map<String, dynamic> data;
  const WarehouseUpdateRequested({required this.id, required this.data});
  @override
  List<Object?> get props => [id, data];
}

class WarehouseDeleteRequested extends WarehouseEvent {
  final String id;
  const WarehouseDeleteRequested({required this.id});
  @override
  List<Object?> get props => [id];
}
