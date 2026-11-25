import 'package:equatable/equatable.dart';

abstract class DashboardEvent extends Equatable {
  const DashboardEvent();
  @override
  List<Object?> get props => [];
}

class DashboardLoadRequested extends DashboardEvent {
  final String? companyId;
  const DashboardLoadRequested({this.companyId});
  @override
  List<Object?> get props => [companyId];
}
