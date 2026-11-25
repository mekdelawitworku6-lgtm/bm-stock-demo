import 'package:equatable/equatable.dart';
import '../../models/transfer_model.dart';

class TransferState extends Equatable {
  final List<TransferModel> transfers;
  final List<TransferModel> transferHistory;
  final TransferModel? selectedTransfer;
  final bool isLoading;
  final String? error;
  final bool? lastActionSuccess;
  final String? lastCreatedTransferStatus;

  const TransferState({
    this.transfers = const [],
    this.transferHistory = const [],
    this.selectedTransfer,
    this.isLoading = false,
    this.error,
    this.lastActionSuccess,
    this.lastCreatedTransferStatus,
  });

  TransferState copyWith({
    List<TransferModel>? transfers,
    List<TransferModel>? transferHistory,
    TransferModel? Function()? selectedTransfer,
    bool? isLoading,
    String? Function()? error,
    bool? Function()? lastActionSuccess,
    String? Function()? lastCreatedTransferStatus,
  }) {
    return TransferState(
      transfers: transfers ?? this.transfers,
      transferHistory: transferHistory ?? this.transferHistory,
      selectedTransfer: selectedTransfer != null ? selectedTransfer() : this.selectedTransfer,
      isLoading: isLoading ?? this.isLoading,
      error: error != null ? error() : this.error,
      lastActionSuccess: lastActionSuccess != null ? lastActionSuccess() : this.lastActionSuccess,
      lastCreatedTransferStatus: lastCreatedTransferStatus != null
          ? lastCreatedTransferStatus()
          : this.lastCreatedTransferStatus,
    );
  }

  @override
  List<Object?> get props => [
        transfers,
        transferHistory,
        selectedTransfer,
        isLoading,
        error,
        lastActionSuccess,
        lastCreatedTransferStatus,
      ];
}
