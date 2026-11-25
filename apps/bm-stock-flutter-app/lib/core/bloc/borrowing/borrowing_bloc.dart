import 'package:flutter_bloc/flutter_bloc.dart';
import '../../services/borrowing_service.dart';
import 'borrowing_event.dart';
import 'borrowing_state.dart';

export 'borrowing_event.dart';
export 'borrowing_state.dart';

class BorrowingBloc extends Bloc<BorrowingEvent, BorrowingState> {
  final BorrowingService _service = BorrowingService();

  BorrowingBloc() : super(const BorrowingState()) {
    on<BorrowingsLoadRequested>(_onLoad);
    on<BorrowingCreateRequested>(_onCreate);
    on<BorrowingDetailLoadRequested>(_onLoadDetail);
    on<BorrowingUpdateRequested>(_onUpdate);
  }

  Future<void> _onLoad(BorrowingsLoadRequested event, Emitter<BorrowingState> emit) async {
    emit(state.copyWith(isLoading: true, error: () => null, lastActionSuccess: () => null));
    try {
      final records = await _service.getAll(
        page: event.page,
        limit: event.limit,
        status: event.status,
        search: event.search,
      );
      emit(state.copyWith(records: records, isLoading: false, lastActionSuccess: () => null));
    } catch (e) {
      emit(state.copyWith(
        isLoading: false,
        error: () => 'Failed to load borrowings: $e',
        lastActionSuccess: () => null,
      ));
    }
  }

  Future<void> _onCreate(BorrowingCreateRequested event, Emitter<BorrowingState> emit) async {
    emit(state.copyWith(isLoading: true, error: () => null, lastActionSuccess: () => null));
    try {
      await _service.create(event.data);
      final records = await _service.getAll();
      emit(state.copyWith(
        records: records,
        isLoading: false,
        lastActionSuccess: () => true,
      ));
    } catch (e) {
      emit(state.copyWith(
        isLoading: false,
        error: () => 'Failed to create borrowing: $e',
        lastActionSuccess: () => false,
      ));
    }
  }

  Future<void> _onLoadDetail(
    BorrowingDetailLoadRequested event,
    Emitter<BorrowingState> emit,
  ) async {
    emit(state.copyWith(isLoading: true, error: () => null));
    try {
      final record = await _service.getById(event.id);
      emit(state.copyWith(selected: record, isLoading: false));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: () => 'Failed to load record: $e'));
    }
  }

  Future<void> _onUpdate(BorrowingUpdateRequested event, Emitter<BorrowingState> emit) async {
    emit(state.copyWith(isLoading: true, error: () => null, lastActionSuccess: () => null));
    try {
      final updated = await _service.update(event.id, event.data);
      final records = await _service.getAll();
      emit(state.copyWith(
        selected: updated,
        records: records,
        isLoading: false,
        lastActionSuccess: () => true,
      ));
    } catch (e) {
      emit(state.copyWith(
        isLoading: false,
        error: () => 'Failed to update borrowing: $e',
        lastActionSuccess: () => false,
      ));
    }
  }
}
