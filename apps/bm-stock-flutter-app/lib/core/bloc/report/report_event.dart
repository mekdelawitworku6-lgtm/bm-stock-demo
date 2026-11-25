import 'package:equatable/equatable.dart';

abstract class ReportEvent extends Equatable {
  const ReportEvent();
  @override
  List<Object?> get props => [];
}

class ReportsLoadRequested extends ReportEvent {
  final String? date;
  final int? year;
  final int? month;
  const ReportsLoadRequested({this.date, this.year, this.month});
  @override
  List<Object?> get props => [date, year, month];
}
