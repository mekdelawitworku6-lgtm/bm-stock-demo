import 'package:equatable/equatable.dart';

abstract class TransferEvent extends Equatable {
  const TransferEvent();
  @override
  List<Object?> get props => [];
}

class TransfersLoadRequested extends TransferEvent {
  final int page;
  final int limit;
  final String? status;
  final String? type;
  final String? branchId;
  const TransfersLoadRequested({
    this.page = 1,
    this.limit = 10,
    this.status,
    this.type,
    this.branchId,
  });
  @override
  List<Object?> get props => [page, limit, status, type, branchId];
}

class TransferCreateRequested extends TransferEvent {
  final Map<String, dynamic> data;
  const TransferCreateRequested({required this.data});
  @override
  List<Object?> get props => [data];
}

class TransferApproveRequested extends TransferEvent {
  final String id;
  const TransferApproveRequested({required this.id});
  @override
  List<Object?> get props => [id];
}

class TransferRejectRequested extends TransferEvent {
  final String id;
  final String? reason;
  const TransferRejectRequested({required this.id, this.reason});
  @override
  List<Object?> get props => [id, reason];
}

class TransferActionAcknowledged extends TransferEvent {}

class TransferHistoryLoadRequested extends TransferEvent {
  final String branchId;
  final String type;
  const TransferHistoryLoadRequested({required this.branchId, this.type = 'shop'});
  @override
  List<Object?> get props => [branchId, type];
}
