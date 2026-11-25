import 'package:flutter_bloc/flutter_bloc.dart';
import '../../services/sale_service.dart';
import 'sale_event.dart';
import 'sale_state.dart';

export 'sale_event.dart';
export 'sale_state.dart';

class SaleBloc extends Bloc<SaleEvent, SaleState> {
  final SaleService _saleService = SaleService();

  SaleBloc() : super(const SaleState()) {
    on<SalesLoadRequested>(_onLoadSales);
    on<SaleCreateRequested>(_onCreateSale);
    on<SalePaymentApplied>(_onApplyPayment);
    on<SaleReminderSent>(_onSendReminder);
  }

  Future<void> _onLoadSales(SalesLoadRequested event, Emitter<SaleState> emit) async {
    emit(state.copyWith(isLoading: true, clearError: true));
    try {
      final sales = await _saleService.getAll(limit: event.limit, status: event.status);
      emit(state.copyWith(isLoading: false, sales: sales));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: 'Failed to load sales: $e'));
    }
  }

  Future<void> _onCreateSale(SaleCreateRequested event, Emitter<SaleState> emit) async {
    emit(state.copyWith(isLoading: true, clearError: true, clearAction: true));
    try {
      await _saleService.create(event.data);
      add(SalesLoadRequested());
      emit(state.copyWith(isLoading: false, lastActionSuccess: true));
    } catch (e) {
      emit(state.copyWith(
        isLoading: false,
        error: 'Failed to create sale: $e',
        lastActionSuccess: false,
      ));
    }
  }

  Future<void> _onApplyPayment(SalePaymentApplied event, Emitter<SaleState> emit) async {
    emit(state.copyWith(isLoading: true, clearError: true, clearAction: true));
    try {
      await _saleService.applyPayment(event.saleId, event.data);
      add(SalesLoadRequested());
      emit(state.copyWith(isLoading: false, lastActionSuccess: true));
    } catch (e) {
      emit(state.copyWith(
        isLoading: false,
        error: 'Failed to apply payment: $e',
        lastActionSuccess: false,
      ));
    }
  }

  Future<void> _onSendReminder(SaleReminderSent event, Emitter<SaleState> emit) async {
    try {
      final success = await _saleService.sendReminder(event.saleId);
      emit(state.copyWith(lastActionSuccess: success, clearAction: true));
    } catch (e) {
      emit(state.copyWith(lastActionSuccess: false, clearAction: true));
    }
  }

  Future<dynamic> getSale(String id) async {
    try {
      return await _saleService.getById(id);
    } catch (_) {
      return null;
    }
  }

  Future<List<Map<String, dynamic>>> getPaymentHistory(String saleId) async {
    try {
      return await _saleService.getPaymentHistory(saleId);
    } catch (_) {
      return [];
    }
  }

  Future<Map<String, dynamic>> findCustomerByPhone(String phone) async {
    try {
      return await _saleService.findCustomerByPhone(phone);
    } catch (_) {
      return {};
    }
  }
}
