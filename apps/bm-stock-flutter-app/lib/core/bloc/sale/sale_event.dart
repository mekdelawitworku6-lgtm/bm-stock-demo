import 'package:equatable/equatable.dart';

abstract class SaleEvent extends Equatable {
  const SaleEvent();
  @override
  List<Object?> get props => [];
}

class SalesLoadRequested extends SaleEvent {
  final String? status;
  final int limit;
  const SalesLoadRequested({this.status, this.limit = 50});
  @override
  List<Object?> get props => [status, limit];
}

class SaleCreateRequested extends SaleEvent {
  final Map<String, dynamic> data;
  const SaleCreateRequested({required this.data});
  @override
  List<Object?> get props => [data];
}

class SalePaymentApplied extends SaleEvent {
  final String saleId;
  final Map<String, dynamic> data;
  const SalePaymentApplied({required this.saleId, required this.data});
  @override
  List<Object?> get props => [saleId, data];
}

class SaleReminderSent extends SaleEvent {
  final String saleId;
  const SaleReminderSent({required this.saleId});
  @override
  List<Object?> get props => [saleId];
}
