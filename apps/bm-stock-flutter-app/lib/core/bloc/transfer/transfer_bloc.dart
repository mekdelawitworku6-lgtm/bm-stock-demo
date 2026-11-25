import 'package:flutter_bloc/flutter_bloc.dart';
import '../../api/api_exceptions.dart';
import '../../services/transfer_service.dart';
import 'transfer_event.dart';
import 'transfer_state.dart';

export 'transfer_event.dart';
export 'transfer_state.dart';

class TransferBloc extends Bloc<TransferEvent, TransferState> {
  final TransferService _transferService = TransferService();

  TransferBloc() : super(const TransferState()) {
    on<TransfersLoadRequested>(_onLoad);
    on<TransferCreateRequested>(_onCreate);
    on<TransferApproveRequested>(_onApprove);
    on<TransferRejectRequested>(_onReject);
    on<TransferHistoryLoadRequested>(_onLoadHistory);
    on<TransferActionAcknowledged>(_onActionAcknowledged);
  }

  String _message(Object error) {
    if (error is ApiException) return error.message;
    return error.toString().replaceFirst('Exception: ', '');
  }

  void _onActionAcknowledged(TransferActionAcknowledged event, Emitter<TransferState> emit) {
    emit(state.copyWith(lastActionSuccess: () => null, error: () => null, lastCreatedTransferStatus: () => null));
  }

  Future<void> _onLoad(TransfersLoadRequested event, Emitter<TransferState> emit) async {
    emit(state.copyWith(isLoading: true, error: () => null));
    try {
      final transfers = await _transferService.getAll(
        page: event.page,
        limit: event.limit,
        status: event.status,
        type: event.type,
        branchId: event.branchId,
      );
      emit(state.copyWith(transfers: transfers, isLoading: false));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: () => 'Failed to load transfers: ${_message(e)}'));
    }
  }

  Future<void> _onCreate(TransferCreateRequested event, Emitter<TransferState> emit) async {
    emit(state.copyWith(isLoading: true, error: () => null, lastActionSuccess: () => null, lastCreatedTransferStatus: () => null));
    try {
      final created = await _transferService.create(event.data);
      emit(state.copyWith(
        isLoading: false,
        lastActionSuccess: () => true,
        lastCreatedTransferStatus: () => created.status,
      ));
    } catch (e) {
      emit(state.copyWith(
        isLoading: false,
        error: () => _message(e),
        lastActionSuccess: () => false,
      ));
    }
  }

  Future<void> _onApprove(TransferApproveRequested event, Emitter<TransferState> emit) async {
    emit(state.copyWith(isLoading: true, error: () => null, lastActionSuccess: () => null));
    try {
      await _transferService.updateStatus(event.id, {'status': 'approved'});
      emit(state.copyWith(isLoading: false, lastActionSuccess: () => true));
    } catch (e) {
      emit(state.copyWith(
        isLoading: false,
        error: () => _message(e),
        lastActionSuccess: () => false,
      ));
    }
  }

  Future<void> _onReject(TransferRejectRequested event, Emitter<TransferState> emit) async {
    emit(state.copyWith(isLoading: true, error: () => null, lastActionSuccess: () => null));
    try {
      await _transferService.updateStatus(event.id, {
        'status': 'rejected',
        if (event.reason != null && event.reason!.isNotEmpty) 'rejectionReason': event.reason,
      });
      emit(state.copyWith(isLoading: false, lastActionSuccess: () => true));
    } catch (e) {
      emit(state.copyWith(
        isLoading: false,
        error: () => _message(e),
        lastActionSuccess: () => false,
      ));
    }
  }

  Future<void> _onLoadHistory(TransferHistoryLoadRequested event, Emitter<TransferState> emit) async {
    emit(state.copyWith(isLoading: true, error: () => null));
    try {
      final history = await _transferService.getHistory(event.branchId, type: event.type);
      emit(state.copyWith(transferHistory: history, isLoading: false));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: () => 'Failed to load transfer history: ${_message(e)}'));
    }
  }
}
