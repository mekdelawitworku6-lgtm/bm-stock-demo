import 'package:flutter_bloc/flutter_bloc.dart';
import '../../api/api_client.dart';
import '../../api/api_response.dart';
import 'commission_event.dart';
import 'commission_state.dart';

export 'commission_event.dart';
export 'commission_state.dart';

class CommissionBloc extends Bloc<CommissionEvent, CommissionState> {
  final ApiClient _api = ApiClient();

  CommissionBloc() : super(const CommissionState()) {
    on<CommissionsLoadRequested>(_onLoad);
    on<CommissionsApproveRequested>(_onApprove);
    on<CommissionUpdateRequested>(_onUpdate);
    on<CommissionProductFilterChanged>(_onProductFilter);
  }

  Future<void> _onLoad(CommissionsLoadRequested event, Emitter<CommissionState> emit) async {
    emit(state.copyWith(isLoading: true, error: () => null));
    try {
      final response = await _api.get('/Commissions', queryParams: {'limit': '100'});
      final commissions = parseApiList(response);
      final products = _deriveProducts(commissions);
      final keepSelection = state.selectedProductId != null &&
          products.any((p) => p['id']?.toString() == state.selectedProductId);
      emit(state.copyWith(
        commissions: commissions,
        products: products,
        period: event.period ?? state.period,
        clearSelectedProductId: !keepSelection,
        isLoading: false,
      ));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: () => 'Failed to load commissions: $e'));
    }
  }

  Future<void> _onApprove(CommissionsApproveRequested event, Emitter<CommissionState> emit) async {
    try {
      await _api.post('/Commissions/approve', body: {'commissionIds': event.commissionIds});
      emit(state.copyWith(notice: () => 'Commissions marked as paid'));
      add(const CommissionsLoadRequested());
    } catch (e) {
      emit(state.copyWith(notice: () => 'Failed to approve commissions: $e'));
    }
  }

  Future<void> _onUpdate(CommissionUpdateRequested event, Emitter<CommissionState> emit) async {
    try {
      await _api.patch('/Commissions/${event.commissionId}', body: event.data);
      emit(state.copyWith(notice: () => 'Commission updated'));
      add(const CommissionsLoadRequested());
    } catch (e) {
      emit(state.copyWith(notice: () => 'Failed to update commission: $e'));
    }
  }

  void _onProductFilter(CommissionProductFilterChanged event, Emitter<CommissionState> emit) {
    emit(state.copyWith(
      selectedProductId: event.productId,
      clearSelectedProductId: event.productId == null,
    ));
  }

  List<Map<String, dynamic>> _deriveProducts(List<Map<String, dynamic>> commissions) {
    final map = <String, Map<String, dynamic>>{};
    for (final c in commissions) {
      final product = c['product'];
      if (product is Map) {
        final id = product['id']?.toString();
        if (id != null && id.isNotEmpty && !map.containsKey(id)) {
          map[id] = Map<String, dynamic>.from(product);
        }
      }
    }
    return map.values.toList();
  }
}
