import 'package:equatable/equatable.dart';

abstract class CommissionEvent extends Equatable {
  const CommissionEvent();
  @override
  List<Object?> get props => [];
}

class CommissionsLoadRequested extends CommissionEvent {
  final String? period;
  const CommissionsLoadRequested({this.period});
  @override
  List<Object?> get props => [period];
}

class CommissionsApproveRequested extends CommissionEvent {
  final List<String> commissionIds;
  const CommissionsApproveRequested(this.commissionIds);
  @override
  List<Object?> get props => [commissionIds];
}

class CommissionUpdateRequested extends CommissionEvent {
  final String commissionId;
  final Map<String, dynamic> data;
  const CommissionUpdateRequested(this.commissionId, this.data);
  @override
  List<Object?> get props => [commissionId, data];
}

class CommissionProductFilterChanged extends CommissionEvent {
  final String? productId;
  const CommissionProductFilterChanged(this.productId);
  @override
  List<Object?> get props => [productId];
}
