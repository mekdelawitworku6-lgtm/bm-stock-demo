import 'package:equatable/equatable.dart';
import '../../models/borrowing_model.dart';

class BorrowingState extends Equatable {
  final List<BorrowingModel> records;
  final BorrowingModel? selected;
  final bool isLoading;
  final String? error;
  final bool? lastActionSuccess;

  const BorrowingState({
    this.records = const [],
    this.selected,
    this.isLoading = false,
    this.error,
    this.lastActionSuccess,
  });

  BorrowingState copyWith({
    List<BorrowingModel>? records,
    BorrowingModel? selected,
    bool? isLoading,
    String? Function()? error,
    bool? Function()? lastActionSuccess,
  }) {
    return BorrowingState(
      records: records ?? this.records,
      selected: selected ?? this.selected,
      isLoading: isLoading ?? this.isLoading,
      error: error != null ? error() : this.error,
      lastActionSuccess:
          lastActionSuccess != null ? lastActionSuccess() : this.lastActionSuccess,
    );
  }

  @override
  List<Object?> get props => [records, selected, isLoading, error, lastActionSuccess];
}
