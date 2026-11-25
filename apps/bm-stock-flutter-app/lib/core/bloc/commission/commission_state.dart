import 'package:equatable/equatable.dart';

class CommissionState extends Equatable {
  final List<Map<String, dynamic>> commissions;
  final List<Map<String, dynamic>> products;
  final String? selectedProductId;
  final String period;
  final bool isLoading;
  final String? error;
  final String? notice;

  const CommissionState({
    this.commissions = const [],
    this.products = const [],
    this.selectedProductId,
    this.period = 'Week',
    this.isLoading = false,
    this.error,
    this.notice,
  });

  /// Commissions filtered by the selected product and period.
  List<Map<String, dynamic>> filterCommissions(String period) {
    var list = commissions;
    if (selectedProductId != null && selectedProductId!.isNotEmpty) {
      list = list
          .where((c) => c['product']?['id']?.toString() == selectedProductId)
          .toList();
    }
    final start = _periodStart(period);
    if (start != null) {
      list = list.where((c) {
        final date = DateTime.tryParse(
          c['commissionDate']?.toString() ?? c['createdAt']?.toString() ?? '',
        );
        return date != null && !date.isBefore(start);
      }).toList();
    }
    return list;
  }

  DateTime? _periodStart(String period) {
    final now = DateTime.now();
    switch (period) {
      case 'Week':
        final monday = now.subtract(Duration(days: now.weekday - 1));
        return DateTime(monday.year, monday.month, monday.day);
      case 'Month':
        return DateTime(now.year, now.month, 1);
      case 'Quarter':
        final qStartMonth = ((now.month - 1) ~/ 3) * 3 + 1;
        return DateTime(now.year, qStartMonth, 1);
      default:
        return null;
    }
  }

  CommissionState copyWith({
    List<Map<String, dynamic>>? commissions,
    List<Map<String, dynamic>>? products,
    String? selectedProductId,
    bool clearSelectedProductId = false,
    String? period,
    bool? isLoading,
    String? Function()? error,
    String? Function()? notice,
  }) {
    return CommissionState(
      commissions: commissions ?? this.commissions,
      products: products ?? this.products,
      selectedProductId: clearSelectedProductId
          ? null
          : selectedProductId ?? this.selectedProductId,
      period: period ?? this.period,
      isLoading: isLoading ?? this.isLoading,
      error: error != null ? error() : this.error,
      notice: notice != null ? notice() : this.notice,
    );
  }

  @override
  List<Object?> get props =>
      [commissions, products, selectedProductId, period, isLoading, error, notice];
}
