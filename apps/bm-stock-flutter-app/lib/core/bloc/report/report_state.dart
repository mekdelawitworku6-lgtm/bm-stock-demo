import 'package:equatable/equatable.dart';

class ReportState extends Equatable {
  final Map<String, dynamic>? dailyReport;
  final Map<String, dynamic>? monthlyReport;
  final List<Map<String, dynamic>> monthlyReports;
  final bool isLoading;
  final String? error;

  const ReportState({
    this.dailyReport,
    this.monthlyReport,
    this.monthlyReports = const [],
    this.isLoading = false,
    this.error,
  });

  ReportState copyWith({
    Map<String, dynamic>? Function()? dailyReport,
    Map<String, dynamic>? Function()? monthlyReport,
    List<Map<String, dynamic>>? monthlyReports,
    bool? isLoading,
    String? Function()? error,
  }) {
    return ReportState(
      dailyReport: dailyReport != null ? dailyReport() : this.dailyReport,
      monthlyReport: monthlyReport != null ? monthlyReport() : this.monthlyReport,
      monthlyReports: monthlyReports ?? this.monthlyReports,
      isLoading: isLoading ?? this.isLoading,
      error: error != null ? error() : this.error,
    );
  }

  @override
  List<Object?> get props => [dailyReport, monthlyReport, monthlyReports, isLoading, error];
}
