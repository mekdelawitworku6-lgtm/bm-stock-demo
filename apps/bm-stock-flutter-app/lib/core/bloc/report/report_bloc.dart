import 'package:flutter_bloc/flutter_bloc.dart';
import '../../services/sale_service.dart';
import 'report_event.dart';
import 'report_state.dart';

export 'report_event.dart';
export 'report_state.dart';

class ReportBloc extends Bloc<ReportEvent, ReportState> {
  final SaleService _saleService = SaleService();

  ReportBloc() : super(const ReportState()) {
    on<ReportsLoadRequested>(_onLoad);
  }

  Future<void> _onLoad(ReportsLoadRequested event, Emitter<ReportState> emit) async {
    emit(state.copyWith(isLoading: true, error: () => null));
    try {
      final results = await Future.wait([
        _saleService.getDailyReport(date: event.date),
        _saleService.getMonthlyReport(year: event.year, month: event.month),
      ]);

      final dailyReport = results[0] as Map<String, dynamic>?;
      final monthlyReport = results[1] as Map<String, dynamic>?;

      final nowYear = DateTime.now().year;
      final nowMonth = DateTime.now().month;
      final monthlyReports = <Map<String, dynamic>>[];
      for (int i = 5; i >= 0; i--) {
        final dt = DateTime(nowYear, nowMonth - i, 1);
        try {
          final report = await _saleService.getMonthlyReport(year: dt.year, month: dt.month);
          monthlyReports.add(report);
        } catch (_) {}
      }

      emit(state.copyWith(
        dailyReport: () => dailyReport,
        monthlyReport: () => monthlyReport,
        monthlyReports: monthlyReports,
        isLoading: false,
      ));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: () => 'Failed to load reports: $e'));
    }
  }
}
