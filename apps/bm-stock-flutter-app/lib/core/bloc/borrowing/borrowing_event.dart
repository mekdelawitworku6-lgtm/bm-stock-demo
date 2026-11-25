import 'package:equatable/equatable.dart';

abstract class BorrowingEvent extends Equatable {
  const BorrowingEvent();
  @override
  List<Object?> get props => [];
}

class BorrowingsLoadRequested extends BorrowingEvent {
  final int page;
  final int limit;
  final String? status;
  final String? search;

  const BorrowingsLoadRequested({
    this.page = 1,
    this.limit = 50,
    this.status,
    this.search,
  });

  @override
  List<Object?> get props => [page, limit, status, search];
}

class BorrowingCreateRequested extends BorrowingEvent {
  final Map<String, dynamic> data;
  const BorrowingCreateRequested({required this.data});
  @override
  List<Object?> get props => [data];
}

class BorrowingDetailLoadRequested extends BorrowingEvent {
  final String id;
  const BorrowingDetailLoadRequested({required this.id});
  @override
  List<Object?> get props => [id];
}

class BorrowingUpdateRequested extends BorrowingEvent {
  final String id;
  final Map<String, dynamic> data;
  const BorrowingUpdateRequested({required this.id, required this.data});
  @override
  List<Object?> get props => [id, data];
}
