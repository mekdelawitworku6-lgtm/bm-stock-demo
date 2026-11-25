import 'package:equatable/equatable.dart';

abstract class CustomerEvent extends Equatable {
  const CustomerEvent();
  @override
  List<Object?> get props => [];
}

class CustomersLoadRequested extends CustomerEvent {
  final String? search;
  const CustomersLoadRequested({this.search});
  @override
  List<Object?> get props => [search];
}

class CustomerAddRequested extends CustomerEvent {
  final Map<String, dynamic> data;
  const CustomerAddRequested({required this.data});
  @override
  List<Object?> get props => [data];
}

class CustomerUpdateRequested extends CustomerEvent {
  final String id;
  final Map<String, dynamic> data;
  const CustomerUpdateRequested({required this.id, required this.data});
  @override
  List<Object?> get props => [id, data];
}

class CustomerDeleteRequested extends CustomerEvent {
  final String id;
  const CustomerDeleteRequested({required this.id});
  @override
  List<Object?> get props => [id];
}
