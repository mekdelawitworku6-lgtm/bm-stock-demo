import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import '../services/sale_service.dart';

class ReportProvider with ChangeNotifier {
  final SaleService _saleService = SaleService();

  Map<String, dynamic>? _dailyReport;
  Map<String, dynamic>? _monthlyReport;
  List<Map<String, dynamic>> _monthlyReports = []; // for chart
  Map<String, dynamic>? _analytics;
  bool _isLoading = false;
  String? _error;
  String? _lastCompanyId;

  // Filter state
  String _period = 'month';
  DateTime? _fromDate;
  DateTime? _toDate;
  String? _productId;
  String? _customerId;
  String? _sellerId;
  String? _locationId;
  String? _locationType;

  Map<String, dynamic>? get dailyReport => _dailyReport;
  Map<String, dynamic>? get monthlyReport => _monthlyReport;
  List<Map<String, dynamic>> get monthlyReports => _monthlyReports;
  Map<String, dynamic>? get analytics => _analytics;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String? get activeCompanyId => _lastCompanyId;

  String get period => _period;
  DateTime? get fromDate => _fromDate;
  DateTime? get toDate => _toDate;
  String? get from => _fromDate != null ? DateFormat('yyyy-MM-dd').format(_fromDate!) : null;
  String? get to => _toDate != null ? DateFormat('yyyy-MM-dd').format(_toDate!) : null;
  String? get productId => _productId;
  String? get customerId => _customerId;
  String? get sellerId => _sellerId;
  String? get locationId => _locationId;
  String? get locationType => _locationType;

  bool get hasActiveFilters =>
      _productId != null ||
      _customerId != null ||
      _sellerId != null ||
      _locationId != null ||
      (_period == 'custom' && (_fromDate != null || _toDate != null));

  void clear() {
    _dailyReport = null;
    _monthlyReport = null;
    _monthlyReports = [];
    _analytics = null;
    _period = 'month';
    _fromDate = null;
    _toDate = null;
    _productId = null;
    _customerId = null;
    _sellerId = null;
    _locationId = null;
    _locationType = null;
    _lastCompanyId = null;
    _error = null;
    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadReports({String? companyId}) async {
    final companyChanged = companyId != _lastCompanyId;
    _lastCompanyId = companyId;

    if (companyChanged) {
      _dailyReport = null;
      _monthlyReport = null;
      _monthlyReports = [];
      notifyListeners();
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        _saleService.getDailyReport(companyId: companyId),
        _saleService.getMonthlyReport(companyId: companyId),
      ]);
      _dailyReport = results[0] as Map<String, dynamic>?;
      _monthlyReport = results[1] as Map<String, dynamic>?;

      // Load last 6 months for chart
      final nowYear = DateTime.now().year;
      final nowMonth = DateTime.now().month;
      _monthlyReports = [];
      for (int i = 5; i >= 0; i--) {
        final dt = DateTime(nowYear, nowMonth - i, 1);
        try {
          final report = await _saleService.getMonthlyReport(
            year: dt.year,
            month: dt.month,
            companyId: companyId,
          );
          _monthlyReports.add(report);
        } catch (_) {}
      }

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load reports: $e';
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadAnalytics({String? companyId}) async {
    _lastCompanyId = companyId;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _analytics = await _saleService.getAnalytics(
        period: _period,
        from: _period == 'custom' ? from : null,
        to: _period == 'custom' ? to : null,
        productId: _productId,
        customerId: _customerId,
        sellerId: _sellerId,
        locationId: _locationId,
        locationType: _locationType,
        companyId: companyId,
        limit: 200,
      );
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load reports: $e';
      _isLoading = false;
      notifyListeners();
    }
  }

  void setPeriod(String period, {String? companyId}) {
    if (_period == period && period != 'custom') return;
    _period = period;
    loadAnalytics(companyId: companyId);
  }

  void setCustomDateRange({DateTime? from, DateTime? to, String? companyId}) {
    _period = 'custom';
    _fromDate = from;
    _toDate = to;
    loadAnalytics(companyId: companyId);
  }

  void setProductFilter(String? productId, {String? companyId}) {
    if (_productId == productId) return;
    _productId = productId;
    loadAnalytics(companyId: companyId);
  }

  void setCustomerFilter(String? customerId, {String? companyId}) {
    if (_customerId == customerId) return;
    _customerId = customerId;
    loadAnalytics(companyId: companyId);
  }

  void setSellerFilter(String? sellerId, {String? companyId}) {
    if (_sellerId == sellerId) return;
    _sellerId = sellerId;
    loadAnalytics(companyId: companyId);
  }

  void setLocationFilter(String? locationId, String? locationType, {String? companyId}) {
    if (_locationId == locationId && _locationType == locationType) return;
    _locationId = locationId;
    _locationType = locationType;
    loadAnalytics(companyId: companyId);
  }

  void clearFilters({String? companyId}) {
    if (!hasActiveFilters && _period == 'month' && _fromDate == null && _toDate == null) return;
    _productId = null;
    _customerId = null;
    _sellerId = null;
    _locationId = null;
    _locationType = null;
    _fromDate = null;
    _toDate = null;
    loadAnalytics(companyId: companyId);
  }
}
