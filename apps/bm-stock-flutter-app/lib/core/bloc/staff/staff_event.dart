import 'package:equatable/equatable.dart';

abstract class StaffEvent extends Equatable {
  const StaffEvent();
  @override
  List<Object?> get props => [];
}

class StaffLoadRequested extends StaffEvent {}

class StaffAddRequested extends StaffEvent {
  final Map<String, dynamic> data;
  const StaffAddRequested({required this.data});
  @override
  List<Object?> get props => [data];
}

class StaffUpdateRequested extends StaffEvent {
  final String id;
  final Map<String, dynamic> data;
  const StaffUpdateRequested({required this.id, required this.data});
  @override
  List<Object?> get props => [id, data];
}

class StaffDeleteRequested extends StaffEvent {
  final String id;
  const StaffDeleteRequested({required this.id});
  @override
  List<Object?> get props => [id];
}
