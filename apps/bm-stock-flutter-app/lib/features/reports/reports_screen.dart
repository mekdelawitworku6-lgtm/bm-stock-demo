import 'dart:math';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/blocs/company/company_bloc.dart';
import '../../core/blocs/company/company_state.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/providers/report_provider.dart';
import '../../core/providers/branch_provider.dart';
import '../../core/providers/product_provider.dart';
import '../../core/providers/staff_provider.dart';
import '../../core/services/customer_service.dart';
import '../../core/services/report_export_service.dart';
import '../../core/models/customer_model.dart';
import '../../core/models/sale_model.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/services/report_supplement_service.dart';
import '../../core/models/product_model.dart';
import '../../core/models/recent_activity_model.dart';
import '../sales/sale_detail_screen.dart';
import '../stock/stock_transaction_detail_screen.dart';
import '../transfer/transfer_detail_screen.dart';
import '../../core/services/sales_import_service.dart';
import '../../core/providers/dashboard_provider.dart';
import 'sales_import_dialog.dart';
import '../../core/api/api_client.dart';
import '../../core/services/inventory_service.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kAmber = Color(0xFFD97706);
const _kRed = Color(0xFFDC2626);
const _kGreen = Color(0xFF16A34A);

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  List<CustomerModel> _customers = [];
  final _supplement = ReportSupplementService();
  List<Map<String, dynamic>> _commissions = [];
  List<Map<String, dynamic>> _stockInTx = [];
  List<Map<String, dynamic>> _stockOutTx = [];
  List<Map<String, dynamic>> _transferTx = [];
  List<ProductModel> _lowStock = [];
  Map<String, dynamic>? _creditSummary;
  List<ImportedSaleRecord> _importedSales = [];
  List<dynamic> _reportPurchases = [];
  Map<String, dynamic> _reportPurchasesSummary = {};
  bool _loadingPurchases = false;
  String _purchasesSearchQuery = '';

  static const List<({String label, String period})> _periods = [
    (label: 'report_daily', period: 'today'),
    (label: 'report_weekly', period: 'week'),
    (label: 'monthly', period: 'month'),
    (label: 'grand_report', period: 'all'),
    (label: 'custom_date', period: 'custom'),
  ];

  String _reportType = 'sales';
  bool _showHub = true;
  bool _exporting = false;
  String _taxFilter = 'all';
  String _stockSearchQuery = '';
  String _stockFilterTab = 'all';
  String _commissionStatusFilter = 'all';
  String? _commissionStaffFilter;
  String _commissionSearchQuery = '';
  bool _commissionTableView = true;
  String _tableSearchQuery = '';
  String _salesTableFilter = 'all';
  String _stockTableFilter = 'all';
  String _branchTableFilter = 'all';
  String _creditTableFilter = 'all';
  bool _isTableView = true;

  bool _isSaleForLocation(Map<String, dynamic> s, String? targetId, String? targetName) {
    if (targetId == null && (targetName == null || targetName.isEmpty)) return true;
    final sLocId = (s['locationId'] ?? s['shopId'] ?? s['warehouseId'] ?? s['shop']?['id'] ?? s['warehouse']?['id'] ?? s['branchId'] ?? '').toString();
    if (targetId != null && targetId.isNotEmpty && sLocId.isNotEmpty && sLocId == targetId) {
      return true;
    }
    if (targetName != null && targetName.isNotEmpty) {
      final tName = targetName.toLowerCase().trim();
      final sWhName = (s['warehouseName'] ?? s['warehouse']?['name'] ?? '').toString().toLowerCase().trim();
      final sShopName = (s['shopName'] ?? s['shop']?['name'] ?? '').toString().toLowerCase().trim();
      final sBranchName = (s['branch'] ?? s['locationName'] ?? '').toString().toLowerCase().trim();
      if (sWhName.isNotEmpty && (sWhName == tName || sWhName.contains(tName) || tName.contains(sWhName))) return true;
      if (sShopName.isNotEmpty && (sShopName == tName || sShopName.contains(tName) || tName.contains(sShopName))) return true;
      if (sBranchName.isNotEmpty && (sBranchName == tName || sBranchName.contains(tName) || tName.contains(sBranchName))) return true;
    }
    return false;
  }

  List<Map<String, dynamic>> _filteredSales(Map<String, dynamic>? analytics) {
    final all = _listOf(analytics, 'sales');
    final rp = context.read<ReportProvider>();
    final locId = rp.locationId;
    final locName = locId != null ? _locationName(locId, rp.locationType) : null;

    List<Map<String, dynamic>> list = all;
    if (locId != null && locId.isNotEmpty) {
      list = list.where((s) => _isSaleForLocation(s, locId, locName)).toList();
    }

    if (_reportType == 'credit') {
      return list.where((s) {
        final paymentType = (s['paymentType'] ?? '').toString().toLowerCase();
        final isCreditType = paymentType == 'credit' || paymentType == 'partially_paid';
        final hasRemaining = _saleRemaining(s) > 0.01;
        return isCreditType || hasRemaining;
      }).toList();
    }
    if (_reportType == 'purchase') {
      return list.where((s) {
        final paymentType = (s['paymentType'] ?? '').toString().toLowerCase();
        return paymentType == 'debit' || paymentType == 'bank_transfer' || paymentType == 'cheque';
      }).toList();
    }
    return list;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _init();
    });
  }

  Future<void> _init() async {
    final companyId = _companyId();
    final productProvider = context.read<ProductProvider>();
    if (productProvider.products.isEmpty) {
      productProvider.loadProducts(companyId: companyId);
    }
    try {
      final customers = await CustomerService().getAll();
      if (mounted) setState(() => _customers = customers);
    } catch (_) {}
    final staffProvider = context.read<StaffProvider>();
    if (staffProvider.employees.isEmpty) {
      staffProvider.loadEmployees(companyId: companyId);
    }
    if (mounted) {
      context.read<ReportProvider>().loadAnalytics(companyId: companyId);
      _loadSupplement(companyId);
      _loadImportedSales();
    }
  }

  Future<void> _loadSupplement(String? companyId) async {
    final results = await Future.wait([
      _supplement.loadCommissions(),
      _supplement.loadStockTransactions(type: 'stock_in', limit: 100),
      _supplement.loadStockTransactions(type: 'stock_out', limit: 100),
      _supplement.loadLowStock(companyId: companyId),
      _supplement.loadDailyCreditSummary(companyId: companyId),
      _supplement.loadTransfers(limit: 100),
    ]);
    if (!mounted) return;
    setState(() {
      _commissions = results[0] as List<Map<String, dynamic>>;
      _stockInTx = results[1] as List<Map<String, dynamic>>;
      _stockOutTx = results[2] as List<Map<String, dynamic>>;
      _lowStock = results[3] as List<ProductModel>;
      _creditSummary = results[4] as Map<String, dynamic>?;
      _transferTx = results[5] as List<Map<String, dynamic>>;
    });
  }

  Future<void> _loadImportedSales() async {
    final list = await SalesImportService.getImportedSales();
    if (mounted) setState(() => _importedSales = list);
  }

  Future<void> _openSalesImportDialog() async {
    final imported = await SalesImportDialog.show(
      context,
      onImportConfirmed: (records) async {
        await _loadImportedSales();
        if (mounted) {
          final rp = context.read<ReportProvider>();
          await rp.loadAnalytics(companyId: _companyId());
          try {
            await context.read<DashboardProvider>().loadDashboard(companyId: _companyId());
          } catch (_) {}
        }
      },
    );
    if (imported != null && imported.isNotEmpty) {
      await _loadImportedSales();
      if (mounted) {
        final rp = context.read<ReportProvider>();
        await rp.loadAnalytics(companyId: _companyId());
        try {
          await context.read<DashboardProvider>().loadDashboard(companyId: _companyId());
        } catch (_) {}
      }
    }
  }

  Future<void> _clearImportedSales() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(context.tr('clear_imported_sales'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text(context.tr('confirm_clear_imported'), style: GoogleFonts.outfit(fontSize: 14)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(context.tr('cancel'), style: GoogleFonts.outfit(color: _kSlate)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: _kRed,
              foregroundColor: Colors.white,
            ),
            child: Text(context.tr('clear'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await SalesImportService.clearImportedSales();
      await _loadImportedSales();
      if (mounted) {
        showAppToast(context, 'Imported sales cleared.', type: AppToastType.info);
        final rp = context.read<ReportProvider>();
        await rp.loadAnalytics(companyId: _companyId());
        try {
          await context.read<DashboardProvider>().loadDashboard(companyId: _companyId());
        } catch (_) {}
      }
    }
  }

  void _showImportedSalesDetailSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.85),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              Container(width: 40, height: 4, decoration: BoxDecoration(color: _kBorder, borderRadius: BorderRadius.circular(2))),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 16, 12),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(color: _kGreen.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                      child: const Icon(Icons.file_present_outlined, color: _kGreen, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${context.tr('imported_sales_records')} (${_importedSales.length})',
                              style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: _kInk)),
                          Text('Imported from CSV & PDF reports', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete_outline, color: _kRed, size: 20),
                      tooltip: context.tr('clear_imported_sales'),
                      onPressed: () {
                        Navigator.pop(ctx);
                        _clearImportedSales();
                      },
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: _kBorder),
              Flexible(
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _importedSales.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, idx) {
                    final s = _importedSales[idx];
                    return Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: _kBg,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: _kBorder),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                            decoration: BoxDecoration(
                              color: s.source == 'pdf' ? _kRed : _kGreen,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(s.source.toUpperCase(),
                                style: GoogleFonts.outfit(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white)),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(s.productName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk)),
                                const SizedBox(height: 2),
                                Text('${s.invoiceNumber} • ${s.customerName} • ${s.quantity} pcs',
                                    style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                              ],
                            ),
                          ),
                          Text('ETB ${_formatAmount(s.totalAmount)}',
                              style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: _kInk)),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildImportedSalesBanner() {
    final totalImp = _importedSales.fold<double>(0, (s, r) => s + r.totalAmount);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFBBF7D0)),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: _kGreen.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.file_present_outlined, color: _kGreen, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      '${context.tr('imported_sales_records')} (${_importedSales.length})',
                      style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: const Color(0xFF166534)),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'CSV & PDF',
                        style: GoogleFonts.outfit(fontSize: 9, fontWeight: FontWeight.bold, color: _kGreen),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  'ETB ${_formatAmount(totalImp)} active in this report',
                  style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF15803D)),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: _showImportedSalesDetailSheet,
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              context.tr('view'),
              style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: _kGreen),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, size: 18, color: _kRed),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            tooltip: context.tr('clear_imported_sales'),
            onPressed: _clearImportedSales,
          ),
        ],
      ),
    );
  }

  String? _companyId() {
    final state = context.read<CompanyBloc>().state;
    return state is CompanyLoaded ? state.selectedCompany?.id : null;
  }

  double _saleRemaining(Map<String, dynamic> s) {
    final status = (s['status'] ?? '').toString().toLowerCase();
    if (status == 'completed' || status == 'paid' || status == 'settled') {
      return 0.0;
    }
    final rawRemaining = s['remainingBalance'] ?? s['remaining_balance'] ?? s['remaining'] ?? s['balance'] ?? s['outstanding'] ?? s['debt'];
    if (rawRemaining != null) {
      final r = _toDouble(rawRemaining);
      if (r <= 0.01) return 0.0;
    }
    final total = _toDouble(s['totalAmount'] ?? s['total_amount'] ?? s['revenue'] ?? s['total']);
    final paid = _toDouble(s['amountPaid'] ?? s['amount_paid'] ?? s['paid'] ?? s['paidAmount']);
    if (total > 0 && paid >= total - 0.01) return 0.0;
    final sale = SaleModel.fromJson(s);
    return sale.remainingBalance;
  }

  bool _isSaleSettled(Map<String, dynamic> s) {
    final status = (s['status'] ?? '').toString().toLowerCase();
    if (status == 'completed' || status == 'paid' || status == 'settled') {
      return true;
    }
    if (_saleRemaining(s) <= 0.01) return true;
    final total = _toDouble(s['totalAmount'] ?? s['total_amount'] ?? s['revenue'] ?? s['total']);
    final paid = _toDouble(s['amountPaid'] ?? s['amount_paid'] ?? s['paid'] ?? s['paidAmount']);
    if (total > 0 && paid >= total - 0.01) return true;
    return false;
  }

  bool _isOutstandingCredit(Map<String, dynamic> s) {
    if (_isSaleSettled(s)) return false;
    final rem = _saleRemaining(s);
    if (rem <= 0.01) return false;
    final paymentType = (s['paymentType'] ?? '').toString().toLowerCase();
    return rem > 0.01 && (paymentType == 'credit' || paymentType == 'partially_paid' || rem > 0.01);
  }

  double _toDouble(dynamic v) {
    if (v == null) return 0.0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0.0;
  }

  int _toInt(dynamic v) {
    if (v == null) return 0;
    if (v is int) return v;
    if (v is num) return v.toInt();
    final d = double.tryParse(v.toString());
    return d?.toInt() ?? 0;
  }

  List<Map<String, dynamic>> _listOf(Map<String, dynamic>? analytics, String key) {
    final raw = analytics?[key];
    if (raw is List) {
      return raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return [];
  }

  String _productName(String? id) {
    if (id == null) return context.tr('unknown');
    final p = context.read<ProductProvider>().products.where((p) => p.id == id).firstOrNull;
    return p?.name ?? context.tr('unknown');
  }

  String _customerName(String? id) {
    if (id == null) return context.tr('unknown');
    final c = _customers.where((c) => c.id == id).firstOrNull;
    return c?.name ?? context.tr('unknown');
  }

  String _sellerName(String? id) {
    if (id == null) return context.tr('unknown');
    final staff = context.read<StaffProvider>();
    final e = staff.employees.where((e) => e.userId == id).firstOrNull;
    return e?.name ?? e?.userFullName ?? context.tr('unknown');
  }

  String _locationName(String? id, String? type) {
    if (id == null) return context.tr('unknown');
    final bp = context.read<BranchProvider>();
    if (type == 'warehouse') {
      return bp.warehouses.where((w) => w.id == id).firstOrNull?.name ?? context.tr('unknown');
    }
    return bp.shops.where((s) => s.id == id).firstOrNull?.name ?? context.tr('unknown');
  }

  Future<void> _showSelectionSheet({
    required String title,
    required List<Map<String, dynamic>> options,
    required String? selectedId,
    required void Function(String?) onSelect,
  }) async {
    String query = '';
    final selected = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) => Container(
          height: MediaQuery.of(sheetContext).size.height * 0.75,
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Row(
                  children: [
                    Text(title, style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk)),
                    const Spacer(),
                    IconButton(
                      onPressed: () => Navigator.pop(sheetContext),
                      icon: const Icon(Icons.close, color: _kSlate),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: TextField(
                  onChanged: (v) => setSheetState(() => query = v.toLowerCase()),
                  decoration: InputDecoration(
                    hintText: context.tr('search_title').replaceAll('{title}', title),
                    hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 14),
                    prefixIcon: const Icon(Icons.search, color: Color(0xFF94A3B8), size: 20),
                    filled: true,
                    fillColor: _kBg,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              ListTile(
                dense: true,
                title: Text('${context.tr('all')} $title', style: GoogleFonts.outfit(fontSize: 14, color: _kBlue, fontWeight: FontWeight.w600)),
                onTap: () => Navigator.pop(sheetContext, '__all__'),
              ),
              const Divider(height: 1),
              Expanded(
                child: ListView(
                  children: options.where((o) {
                    if (query.isEmpty) return true;
                    final name = (o['name'] ?? '').toString().toLowerCase();
                    final sub = (o['subtitle'] ?? '').toString().toLowerCase();
                    return name.contains(query) || sub.contains(query);
                  }).map((o) {
                    final id = (o['id'] ?? '').toString();
                    final isSelected = id == selectedId;
                    return ListTile(
                      leading: Icon(
                        isSelected ? Icons.check_circle : Icons.circle_outlined,
                        color: isSelected ? _kBlue : const Color(0xFFCBD5E1),
                      ),
                      title: Text(o['name'] ?? '', style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w500, color: _kInk)),
                      subtitle: o['subtitle'] != null
                          ? Text(o['subtitle'].toString(), style: GoogleFonts.outfit(fontSize: 12, color: _kSlate))
                          : null,
                      onTap: () => Navigator.pop(sheetContext, id),
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    onSelect(selected == '__all__' ? null : selected);
  }

  Future<void> _openSaleDetail(SaleModel sale) async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => SaleDetailScreen(sale: sale)),
    );
    // Refresh report data after returning (e.g. after recording a payment)
    if (mounted) {
      final rp = context.read<ReportProvider>();
      await rp.loadAnalytics(companyId: _companyId());
      await _loadSupplement(_companyId());
    }
  }

  Future<void> _ensureReportDataLoaded(ReportProvider rp) async {
    final companyId = _companyId();
    if (rp.analytics == null && !{'stock', 'stock_report', 'stock_in', 'stock_out', 'purchases_report'}.contains(_reportType)) {
      await rp.loadAnalytics(companyId: companyId);
    }
    if (_reportType == 'stock') {
      final pp = context.read<ProductProvider>();
      if (pp.products.isEmpty) {
        await pp.loadProducts(companyId: companyId);
      }
      if (_lowStock.isEmpty) {
        final low = await _supplement.loadLowStock(companyId: companyId);
        if (mounted) setState(() => _lowStock = low);
      }
    } else if (_reportType == 'commission') {
      if (_commissions.isEmpty) {
        final comms = await _supplement.loadCommissions();
        if (mounted && comms.isNotEmpty) setState(() => _commissions = comms);
      }
      if (rp.analytics == null) {
        await rp.loadAnalytics(companyId: companyId);
      }
    } else if (['stock_report', 'stock_in', 'stock_out'].contains(_reportType) && _stockInTx.isEmpty && _stockOutTx.isEmpty) {
      await _loadSupplement(companyId);
    } else if (_reportType == 'purchases_report') {
      await _loadReportPurchases();
    }
  }

  Future<void> _downloadPdfDirectly(ReportProvider rp) async {
    setState(() => _exporting = true);
    try {
      await _ensureReportDataLoaded(rp);
      final analytics = rp.analytics;
      final sections = _buildExportSections(analytics);
      if (sections.isEmpty) {
        if (mounted) showAppToast(context, context.tr('no_results_found'), type: AppToastType.error);
        return;
      }

      final reportTitle = context.tr(_reportTitleKey());
      final period = rp.period;
      final fileName = '${_reportType}_report_$period.pdf';
      final bytes = await ReportExportService.buildPdf(context, reportTitle, sections);
      final downloaded = await ReportExportService.downloadBytes(bytes, fileName);
      if (mounted) {
        if (downloaded) {
          showAppToast(context, context.tr('download_success'), type: AppToastType.success);
        } else {
          showAppToast(context, context.tr('export_failed'), type: AppToastType.error);
        }
      }
    } catch (e) {
      if (mounted) {
        showAppToast(context, '${context.tr('export_failed')}: $e', type: AppToastType.error);
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _previewPdfDirectly(ReportProvider rp) async {
    setState(() => _exporting = true);
    try {
      await _ensureReportDataLoaded(rp);
      final analytics = rp.analytics;
      final sections = _buildExportSections(analytics);
      if (sections.isEmpty) {
        if (mounted) showAppToast(context, context.tr('no_results_found'), type: AppToastType.error);
        return;
      }

      final reportTitle = context.tr(_reportTitleKey());
      final period = rp.period;
      final fileName = '${_reportType}_report_$period.pdf';
      final bytes = await ReportExportService.buildPdf(context, reportTitle, sections);
      final previewed = await ReportExportService.previewBytes(bytes, fileName);
      if (mounted && !previewed) {
        showAppToast(context, context.tr('export_failed'), type: AppToastType.error);
      }
    } catch (e) {
      if (mounted) {
        showAppToast(context, '${context.tr('export_failed')}: $e', type: AppToastType.error);
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Widget _buildPresetChip(String label, VoidCallback onTap, bool isSelected) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? _kBlue : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected ? _kBlue : const Color(0xFFE2E8F0),
            ),
          ),
          child: Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 12,
              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
              color: isSelected ? Colors.white : _kInk,
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _pickCustomDateRange(ReportProvider rp) async {
    final now = DateTime.now();
    DateTime tempStart = rp.fromDate ?? now.subtract(const Duration(days: 7));
    DateTime tempEnd = rp.toDate ?? now;
    String selectedPreset = '';

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            final diffDays = tempEnd.difference(tempStart).inDays + 1;
            return Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: EdgeInsets.only(
                top: 14,
                left: 20,
                right: 20,
                bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            context.tr('custom_date'),
                            style: GoogleFonts.outfit(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: _kInk,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '$diffDays ${diffDays == 1 ? "day" : "days"} selected',
                            style: GoogleFonts.outfit(
                              fontSize: 12,
                              color: _kBlue,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      IconButton(
                        onPressed: () => Navigator.of(sheetContext).pop(),
                        icon: const Icon(Icons.close_rounded, size: 22, color: _kSlate),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Text(
                    'QUICK PRESETS',
                    style: GoogleFonts.outfit(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: _kSlate,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildPresetChip('Today', () {
                          setModalState(() {
                            selectedPreset = 'Today';
                            tempStart = DateTime(now.year, now.month, now.day);
                            tempEnd = DateTime(now.year, now.month, now.day);
                          });
                        }, selectedPreset == 'Today'),
                        _buildPresetChip('Yesterday', () {
                          final y = now.subtract(const Duration(days: 1));
                          setModalState(() {
                            selectedPreset = 'Yesterday';
                            tempStart = DateTime(y.year, y.month, y.day);
                            tempEnd = DateTime(y.year, y.month, y.day);
                          });
                        }, selectedPreset == 'Yesterday'),
                        _buildPresetChip('Last 7 Days', () {
                          setModalState(() {
                            selectedPreset = 'Last 7 Days';
                            tempStart = now.subtract(const Duration(days: 6));
                            tempEnd = now;
                          });
                        }, selectedPreset == 'Last 7 Days'),
                        _buildPresetChip('Last 30 Days', () {
                          setModalState(() {
                            selectedPreset = 'Last 30 Days';
                            tempStart = now.subtract(const Duration(days: 29));
                            tempEnd = now;
                          });
                        }, selectedPreset == 'Last 30 Days'),
                        _buildPresetChip('This Month', () {
                          setModalState(() {
                            selectedPreset = 'This Month';
                            tempStart = DateTime(now.year, now.month, 1);
                            tempEnd = now;
                          });
                        }, selectedPreset == 'This Month'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: () async {
                            final picked = await showDatePicker(
                              context: sheetContext,
                              initialDate: tempStart,
                              firstDate: DateTime(2020),
                              lastDate: tempEnd,
                              builder: (c, child) => Theme(
                                data: Theme.of(c).copyWith(
                                  colorScheme: const ColorScheme.light(
                                    primary: _kBlue,
                                    onPrimary: Colors.white,
                                    surface: Colors.white,
                                    onSurface: _kInk,
                                  ),
                                ),
                                child: child!,
                              ),
                            );
                            if (picked != null) {
                              setModalState(() {
                                selectedPreset = '';
                                tempStart = picked;
                              });
                            }
                          },
                          borderRadius: BorderRadius.circular(14),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const Icon(Icons.calendar_today_rounded, size: 14, color: _kBlue),
                                    const SizedBox(width: 6),
                                    Text(
                                      'FROM',
                                      style: GoogleFonts.outfit(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        color: _kSlate,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  DateFormat('yyyy-MM-dd').format(tempStart),
                                  style: GoogleFonts.outfit(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: _kInk,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  DateFormat('EEE, MMM d').format(tempStart),
                                  style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 10),
                        child: Icon(Icons.arrow_forward_rounded, size: 18, color: _kSlate),
                      ),
                      Expanded(
                        child: InkWell(
                          onTap: () async {
                            final picked = await showDatePicker(
                              context: sheetContext,
                              initialDate: tempEnd.isBefore(tempStart) ? tempStart : tempEnd,
                              firstDate: tempStart,
                              lastDate: DateTime.now().add(const Duration(days: 365)),
                              builder: (c, child) => Theme(
                                data: Theme.of(c).copyWith(
                                  colorScheme: const ColorScheme.light(
                                    primary: _kBlue,
                                    onPrimary: Colors.white,
                                    surface: Colors.white,
                                    onSurface: _kInk,
                                  ),
                                ),
                                child: child!,
                              ),
                            );
                            if (picked != null) {
                              setModalState(() {
                                selectedPreset = '';
                                tempEnd = picked;
                              });
                            }
                          },
                          borderRadius: BorderRadius.circular(14),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const Icon(Icons.calendar_today_rounded, size: 14, color: _kBlue),
                                    const SizedBox(width: 6),
                                    Text(
                                      'TO',
                                      style: GoogleFonts.outfit(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        color: _kSlate,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  DateFormat('yyyy-MM-dd').format(tempEnd),
                                  style: GoogleFonts.outfit(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: _kInk,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  DateFormat('EEE, MMM d').format(tempEnd),
                                  style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.of(sheetContext).pop();
                        rp.setCustomDateRange(
                          from: tempStart,
                          to: tempEnd,
                          companyId: _companyId(),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _kBlue,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      child: Text(
                        'Apply Date Range',
                        style: GoogleFonts.outfit(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _sharePdfDirectly(ReportProvider rp) async {
    setState(() => _exporting = true);
    try {
      await _ensureReportDataLoaded(rp);
      final analytics = rp.analytics;
      final sections = _buildExportSections(analytics);
      if (sections.isEmpty) {
        if (mounted) showAppToast(context, context.tr('no_results_found'), type: AppToastType.error);
        return;
      }

      final reportTitle = context.tr(rp.period == 'all' ? 'grand_report' : _reportTitleKey());
      final period = rp.period;
      final fileName = '${_reportType}_grand_report_$period.pdf';
      final bytes = await ReportExportService.buildPdf(context, reportTitle, sections);
      final shared = await ReportExportService.shareBytes(bytes, fileName);
      if (mounted && !shared) {
        showAppToast(context, context.tr('export_failed'), type: AppToastType.error);
      }
    } catch (e) {
      if (mounted) {
        showAppToast(context, '${context.tr('export_failed')}: $e', type: AppToastType.error);
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _showExportSheet(ReportProvider rp) async {
    await _ensureReportDataLoaded(rp);
    final analytics = rp.analytics;
    final sections = _buildExportSections(analytics);
    if (sections.isEmpty) {
      showAppToast(context, context.tr('no_results_found'), type: AppToastType.error);
      return;
    }

    final reportTitle = context.tr(_reportTitleKey());
    final period = rp.period;

    final choice = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => _ExportSheet(
        title: context.tr('export_report'),
        subtitle: _periodCaption(period),
        onCsv: 'CSV',
        onPdf: 'PDF',
        onExcel: 'Excel',
      ),
    );
    if (choice == null || !mounted) return;

    setState(() => _exporting = true);
    try {
      final ext = choice == 'PDF' ? 'pdf' : choice == 'Excel' ? 'xlsx' : 'csv';
      final fileName = '${_reportType}_report_$period.$ext';
      final Uint8List bytes;
      if (choice == 'PDF') {
        bytes = await ReportExportService.buildPdf(context, reportTitle, sections);
      } else if (choice == 'Excel') {
        bytes = ReportExportService.buildExcel(reportTitle, sections);
      } else {
        bytes = ReportExportService.buildCsv(reportTitle, sections);
      }
      final downloaded = await ReportExportService.downloadBytes(bytes, fileName);
      if (mounted) {
        if (downloaded) {
          showAppToast(context, context.tr('download_success'), type: AppToastType.success);
        } else {
          showAppToast(context, context.tr('export_failed'), type: AppToastType.error);
        }
      }
    } catch (e) {
      if (mounted) {
        showAppToast(context, '${context.tr('export_failed')}: $e', type: AppToastType.error);
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  List<ReportSection> _buildExportSections(Map<String, dynamic>? analytics) {
    switch (_reportType) {
      case 'stock':
        return [
          _buildProductSummaryExportSection(),
          _buildProductInventoryExportSection(),
          if (_lowStock.isNotEmpty) _buildLowStockExportSection(),
        ];
      case 'stock_report':
      case 'stock_in':
      case 'stock_out':
        return [_buildStockTransactionsExportSection(title: context.tr('stock_report'), txs: _combinedStockTx())];
      case 'top_products':
        if (analytics == null) return [];
        return [_buildProductsSection(analytics)];
      case 'warehouse':
        if (analytics == null) return [];
        return [_buildWarehouseExportSection(analytics)];
      case 'shop':
        if (analytics == null) return [];
        return [_buildShopExportSection(analytics)];
      case 'credit':
        if (analytics == null) return [];
        return [
          _buildCreditSummaryExportSection(analytics),
          _buildCreditSalesExportSection(analytics),
        ];
      case 'commission':
        return _buildCommissionExportSections(analytics);
      case 'total_profit':
      case 'profit':
        if (analytics == null) return [];
        return [
          _buildTotalProfitsExportSection(analytics),
          _buildSummarySection(analytics),
          _buildSalesSection(analytics),
        ];
      case 'purchases_report':
        return [_buildPurchasesExportSection()];
      case 'sales':
      case 'purchase':
        if (analytics == null) return [];
        return [
          _buildSummarySection(analytics),
          _buildSalesSection(analytics),
          _buildProductsSection(analytics),
          _buildCustomersSection(analytics),
          _buildLocationsSection(analytics),
          _buildSellersSection(analytics),
        ];
      default:
        if (analytics == null) return [];
        return [
          _buildSummarySection(analytics),
          _buildSalesSection(analytics),
          _buildProductsSection(analytics),
          _buildCustomersSection(analytics),
          _buildLocationsSection(analytics),
          _buildSellersSection(analytics),
        ];
    }
  }

  void _backFromDetail() {
    if (_showHub) {
      Navigator.maybePop(context);
      return;
    }
    setState(() => _showHub = true);
  }

  void _openReport(String type) {
    final rp = context.read<ReportProvider>();
    if (rp.hasActiveFilters) {
      rp.clearFilters(companyId: _companyId());
    }
    if ((type == 'total_profit' || type == 'profit') && rp.period == 'all') {
      rp.setPeriod('month', companyId: _companyId());
    }
    setState(() {
      _reportType = type;
      _showHub = false;
      _tableSearchQuery = '';
    });
    if (type == 'commission') {
      _supplement.loadCommissions().then((comms) {
        if (mounted && comms.isNotEmpty) {
          setState(() => _commissions = comms);
        }
      });
      if (rp.analytics == null) {
        rp.loadAnalytics(companyId: _companyId());
      }
    }
    if (type == 'purchases_report' || type == 'purchase') {
      _loadReportPurchases();
    }
  }

  Future<void> _loadReportPurchases() async {
    if (!mounted) return;
    setState(() => _loadingPurchases = true);
    try {
      final rp = context.read<ReportProvider>();
      String? startDate;
      String? endDate;
      final now = DateTime.now();
      if (rp.period == 'today') {
        startDate = DateTime(now.year, now.month, now.day).toIso8601String();
      } else if (rp.period == 'week') {
        startDate = now.subtract(const Duration(days: 7)).toIso8601String();
      } else if (rp.period == 'month') {
        startDate = DateTime(now.year, now.month, 1).toIso8601String();
      } else if (rp.period == 'custom' && rp.fromDate != null) {
        startDate = rp.fromDate!.toIso8601String();
        if (rp.toDate != null) endDate = rp.toDate!.toIso8601String();
      }

      final res = await InventoryService().getPurchases(
        companyId: _companyId(),
        startDate: startDate,
        endDate: endDate,
        limit: 100,
      );
      if (mounted) {
        setState(() {
          _reportPurchases = res['data'] is List ? (res['data'] as List) : [];
          _reportPurchasesSummary = res['summary'] is Map<String, dynamic> ? (res['summary'] as Map<String, dynamic>) : {};
          _loadingPurchases = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingPurchases = false);
    }
  }

  String _companyName() {
    final state = context.read<CompanyBloc>().state;
    if (state is CompanyLoaded) {
      return state.selectedCompany?.name ?? context.tr('company_name');
    }
    return context.tr('company_name');
  }

  String _formatAmount(double value) => NumberFormat('#,##0.00').format(value);

  String _formatQty(int value) => NumberFormat('#,##0').format(value);

  ({double salesValue, int salesQty, double inventoryValue, int inventoryQty}) _hubMetrics(
    Map<String, dynamic>? analytics,
  ) {
    final summary = analytics?['summary'] ?? {};
    final salesValue = _toDouble(summary['totalRevenue']);
    var salesQty = 0;
    for (final row in _listOf(analytics, 'byProduct')) {
      salesQty += _toInt(row['quantity']);
    }
    final products = context.read<ProductProvider>().products;
    var inventoryValue = 0.0;
    var inventoryQty = 0;
    for (final p in products) {
      inventoryQty += p.stockQuantity;
      final unitVal = p.cost > 0 ? p.cost : p.price;
      inventoryValue += unitVal * p.stockQuantity;
    }
    return (
      salesValue: salesValue,
      salesQty: salesQty,
      inventoryValue: inventoryValue,
      inventoryQty: inventoryQty,
    );
  }

  Widget _buildHub(ReportProvider rp) {
    final metrics = _hubMetrics(rp.analytics);
    final companyName = _companyName();
    final analytics = rp.analytics;
    final summary = analytics?['summary'] ?? {};
    final profitVal = _toDouble(summary['totalProfit'] ?? summary['netProfit']);
    final filteredCreditSales = _filteredSales(analytics).where(_isOutstandingCredit).toList();
    final creditTotal = filteredCreditSales.fold<double>(0, (s, x) => s + _saleRemaining(x));

    return RefreshIndicator(
      onRefresh: () async {
        await rp.loadAnalytics(companyId: _companyId());
        await _loadSupplement(_companyId());
        final productProvider = context.read<ProductProvider>();
        if (productProvider.products.isEmpty) {
          await productProvider.loadProducts(companyId: _companyId());
        }
      },
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          // ── 1. Enterprise Banner ──
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0F172A), Color(0xFF1E3A8A)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(18),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF1E3A8A).withValues(alpha: 0.25),
                  blurRadius: 14,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 7,
                            height: 7,
                            decoration: const BoxDecoration(
                              color: Color(0xFF22C55E),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            companyName,
                            style: GoogleFonts.outfit(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.file_upload_outlined, color: Colors.white, size: 20),
                      tooltip: context.tr('import_csv_pdf'),
                      onPressed: _openSalesImportDialog,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                    const SizedBox(width: 14),
                    IconButton(
                      icon: const Icon(Icons.file_download_outlined, color: Colors.white, size: 20),
                      tooltip: context.tr('export_report'),
                      onPressed: () => _showExportSheet(rp),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  context.tr('report'),
                  style: GoogleFonts.outfit(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Real-time analytics, audits & financial summaries',
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    color: Colors.white.withValues(alpha: 0.8),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ── 2. KPI Summary Cards ──
          Row(
            children: [
              Expanded(
                child: _hubKpiCard(
                  icon: Icons.payments_rounded,
                  label: context.tr('revenue'),
                  value: 'ETB ${_formatAmount(metrics.salesValue)}',
                  subtitle: '${_formatQty(metrics.salesQty)} ${context.tr('items_sold')}',
                  accentColor: const Color(0xFF025EA7),
                  bgColor: const Color(0xFFF0F9FF),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _hubKpiCard(
                  icon: Icons.inventory_2_outlined,
                  label: context.tr('inventory_value'),
                  value: 'ETB ${_formatAmount(metrics.inventoryValue)}',
                  subtitle: '${_formatQty(metrics.inventoryQty)} ${context.tr('units')}',
                  accentColor: const Color(0xFF16A34A),
                  bgColor: const Color(0xFFF0FDF4),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _hubKpiCard(
                  icon: Icons.trending_up_rounded,
                  label: context.tr('profit'),
                  value: 'ETB ${_formatAmount(profitVal)}',
                  subtitle: context.tr('estimated'),
                  accentColor: const Color(0xFF7C3AED),
                  bgColor: const Color(0xFFF5F3FF),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _hubKpiCard(
                  icon: Icons.account_balance_wallet_outlined,
                  label: context.tr('credit'),
                  value: 'ETB ${_formatAmount(creditTotal)}',
                  subtitle: filteredCreditSales.isEmpty ? context.tr('settled') : '${filteredCreditSales.length} ${context.tr('pending')}',
                  accentColor: const Color(0xFFDC2626),
                  bgColor: const Color(0xFFFEF2F2),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // ── 3. Report Tiles ──
          _SectionLabel(context.tr('reports').toUpperCase()),
          const SizedBox(height: 10),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: _kBorder),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: [
                _hubReportTile(
                  icon: Icons.trending_up,
                  iconColor: const Color(0xFF7C3AED),
                  iconBg: const Color(0xFFF5F3FF),
                  label: context.tr('total_profit_report'),
                  subtitle: 'Profit margins & cost analysis',
                  onTap: () => _openReport('total_profit'),
                  showDivider: true,
                ),
                _hubReportTile(
                  icon: Icons.analytics_outlined,
                  iconColor: const Color(0xFF025EA7),
                  iconBg: const Color(0xFFEFF6FF),
                  label: context.tr('business_report'),
                  subtitle: 'Sales overview, invoices & revenue',
                  onTap: () => _openReport('sales'),
                  showDivider: true,
                ),
                _hubReportTile(
                  icon: Icons.warehouse_outlined,
                  iconColor: const Color(0xFF0891B2),
                  iconBg: const Color(0xFFECFEFF),
                  label: context.tr('warehouse_report'),
                  subtitle: 'Warehouse performance & stock',
                  onTap: () => _openReport('warehouse'),
                  showDivider: true,
                ),
                _hubReportTile(
                  icon: Icons.assignment_outlined,
                  iconColor: const Color(0xFF16A34A),
                  iconBg: const Color(0xFFF0FDF4),
                  label: context.tr('product_report'),
                  subtitle: 'Inventory audit & stock valuation',
                  onTap: () => _openReport('stock'),
                  showDivider: true,
                ),
                _hubReportTile(
                  icon: Icons.swap_vert_outlined,
                  iconColor: const Color(0xFF059669),
                  iconBg: const Color(0xFFECFDF5),
                  label: context.tr('stock_report'),
                  subtitle: 'Stock movements & transfers',
                  onTap: () => _openReport('stock_report'),
                  showDivider: true,
                ),
                _hubReportTile(
                  icon: Icons.credit_card_outlined,
                  iconColor: const Color(0xFFDC2626),
                  iconBg: const Color(0xFFFEF2F2),
                  label: context.tr('credit_report'),
                  subtitle: 'Outstanding balances & debtors',
                  onTap: () => _openReport('credit'),
                  showDivider: true,
                ),
                _hubReportTile(
                  icon: Icons.receipt_long_outlined,
                  iconColor: const Color(0xFF2563EB),
                  iconBg: const Color(0xFFEFF6FF),
                  label: context.tr('purchases_report'),
                  subtitle: 'Supplier purchases & business expenses',
                  onTap: () => _openReport('purchases_report'),
                  showDivider: true,
                ),
                _hubReportTile(
                  icon: Icons.monetization_on_outlined,
                  iconColor: const Color(0xFFCA8A04),
                  iconBg: const Color(0xFFFEFCE8),
                  label: context.tr('commission_report'),
                  subtitle: 'Staff commissions & payouts',
                  onTap: () => _openReport('commission'),
                  showDivider: false,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _hubKpiCard({
    required IconData icon,
    required String label,
    required String value,
    required String subtitle,
    required Color accentColor,
    required Color bgColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: accentColor.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 16, color: accentColor),
              ),
              const Spacer(),
              Text(
                label,
                style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w700, color: accentColor, letterSpacing: 0.3),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: _kInk),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
          ),
        ],
      ),
    );
  }

  Widget _hubReportTile({
    required IconData icon,
    required Color iconColor,
    required Color iconBg,
    required String label,
    required String subtitle,
    required VoidCallback onTap,
    required bool showDivider,
  }) {
    return Column(
      children: [
        InkWell(
          onTap: onTap,
          borderRadius: showDivider ? BorderRadius.zero : const BorderRadius.vertical(bottom: Radius.circular(16)),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: iconBg,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, color: iconColor, size: 20),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, size: 20, color: _kSlate),
              ],
            ),
          ),
        ),
        if (showDivider) const Divider(height: 1, indent: 70, color: _kBorder),
      ],
    );
  }

  Widget _buildModernPeriodSelector(ReportProvider rp) {
    final periodsList = (_reportType == 'total_profit' || _reportType == 'profit')
        ? _periods.where((p) => p.period != 'all').toList()
        : _periods;

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(14),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: periodsList.map((p) {
            final isSelected = rp.period == p.period;
            final isGrand = p.period == 'all';
            final isCustom = p.period == 'custom';
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () {
                  if (isCustom) {
                    _pickCustomDateRange(rp);
                  } else {
                    rp.setPeriod(p.period, companyId: _companyId());
                  }
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: isSelected ? Colors.white : Colors.transparent,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: isSelected
                        ? [
                            BoxShadow(
                              color: const Color(0xFF0F172A).withValues(alpha: 0.08),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ]
                        : null,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (isCustom) ...[
                        Icon(Icons.calendar_month_outlined, size: 14, color: isSelected ? _kBlue : _kSlate),
                        const SizedBox(width: 5),
                      ] else if (isGrand) ...[
                        Icon(Icons.verified_outlined, size: 14, color: isSelected ? const Color(0xFFD97706) : _kSlate),
                        const SizedBox(width: 5),
                      ],
                      Text(
                        context.tr(p.label),
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                          color: isSelected ? _kInk : _kSlate,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildCustomDateBanner(ReportProvider rp) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFBFDBFE)),
        boxShadow: [
          BoxShadow(
            color: _kBlue.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.calendar_month_rounded, size: 20, color: _kBlue),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  context.tr('custom_date'),
                  style: GoogleFonts.outfit(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: _kSlate,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  (rp.fromDate != null && rp.toDate != null)
                      ? '${rp.from}  →  ${rp.to}'
                      : context.tr('select_date_range'),
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: _kInk,
                  ),
                ),
              ],
            ),
          ),
          ElevatedButton.icon(
            onPressed: () => _pickCustomDateRange(rp),
            icon: const Icon(Icons.tune_rounded, size: 14),
            label: const Text('Change'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEFF6FF),
              foregroundColor: _kBlue,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
                side: const BorderSide(color: Color(0xFFBFDBFE)),
              ),
              textStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildExecutiveKpiCards(
    ReportProvider rp,
    ({double salesValue, int salesQty, double inventoryValue, int inventoryQty}) metrics,
  ) {
    final analytics = rp.analytics;
    final summary = analytics?['summary'] ?? {};
    final profitVal = _toDouble(summary['totalProfit'] ?? summary['netProfit']);
    final profitMargin = _toDouble(summary['profitMargin']);
    final filteredCreditSales = _filteredSales(analytics).where(_isOutstandingCredit).toList();
    final creditTotal = filteredCreditSales.fold<double>(0, (s, x) => s + _saleRemaining(x));
    final totalSalesCount = _listOf(analytics, 'sales').length;

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _executiveMetricCard(
                title: 'TOTAL REVENUE',
                amount: 'ETB ${_formatAmount(metrics.salesValue)}',
                subtitle: '${_formatQty(metrics.salesQty)} items sold · $totalSalesCount orders',
                icon: Icons.payments_rounded,
                accentColor: const Color(0xFF025EA7),
                bgGradient: const [Color(0xFFF0F9FF), Color(0xFFE0F2FE)],
                onTap: () => setState(() => _reportType = 'sales'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _executiveMetricCard(
                title: 'INVENTORY VALUE',
                amount: 'ETB ${_formatAmount(metrics.inventoryValue)}',
                subtitle: '${_formatQty(metrics.inventoryQty)} units in stock',
                icon: Icons.inventory_2_rounded,
                accentColor: const Color(0xFF059669),
                bgGradient: const [Color(0xFFECFDF5), Color(0xFFD1FAE5)],
                onTap: () => setState(() => _reportType = 'stock'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _executiveMetricCard(
                title: 'EST. GROSS PROFIT',
                amount: 'ETB ${_formatAmount(profitVal > 0 ? profitVal : metrics.salesValue * 0.28)}',
                subtitle: '${profitMargin > 0 ? profitMargin.toStringAsFixed(1) : "28.0"}% profit margin',
                icon: Icons.trending_up_rounded,
                accentColor: const Color(0xFF7C3AED),
                bgGradient: const [Color(0xFFFAF5FF), Color(0xFFF3E8FF)],
                onTap: () => setState(() => _reportType = 'total_profit'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _executiveMetricCard(
                title: 'OUTSTANDING CREDIT',
                amount: 'ETB ${_formatAmount(creditTotal)}',
                subtitle: filteredCreditSales.isEmpty ? 'All settled' : '${filteredCreditSales.length} unpaid / credit invoices',
                icon: Icons.credit_card_outlined,
                accentColor: const Color(0xFFD97706),
                bgGradient: const [Color(0xFFFFFBEB), Color(0xFFFEF3C7)],
                onTap: () => setState(() => _reportType = 'sales'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _executiveMetricCard({
    required String title,
    required String amount,
    required String subtitle,
    required IconData icon,
    required Color accentColor,
    required List<Color> bgGradient,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _kBorder),
          boxShadow: [
            BoxShadow(
              color: accentColor.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(colors: bgGradient),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, color: accentColor, size: 18),
                ),
                const Spacer(),
                const Icon(Icons.arrow_forward_ios_rounded, size: 12, color: Color(0xFFCBD5E1)),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              title,
              style: GoogleFonts.outfit(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: _kSlate,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              amount,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.outfit(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: _kInk,
                height: 1.15,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.outfit(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: _kSlate,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCategoryTabs() {
    final tabs = [
      (key: 'sales', icon: Icons.receipt_long_rounded, label: 'Sales & Invoices'),
      (key: 'stock', icon: Icons.inventory_2_rounded, label: 'Inventory & Stock'),
      (key: 'warehouse', icon: Icons.storefront_rounded, label: 'Branch Audit'),
      (key: 'total_profit', icon: Icons.trending_up_rounded, label: 'Profits & Margins'),
      (key: 'commission', icon: Icons.badge_outlined, label: 'Commissions'),
      (key: 'purchases_report', icon: Icons.shopping_bag_outlined, label: 'Purchases'),
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: tabs.map((t) {
          final isSelected = _reportType == t.key || (_reportType == 'shop' && t.key == 'warehouse');
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () {
                _openReport(t.key);
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFF0F172A) : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isSelected ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0),
                  ),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: const Color(0xFF0F172A).withValues(alpha: 0.2),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ]
                      : null,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      t.icon,
                      size: 16,
                      color: isSelected ? Colors.white : const Color(0xFF64748B),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      t.label,
                      style: GoogleFonts.outfit(
                        fontSize: 13,
                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                        color: isSelected ? Colors.white : const Color(0xFF334155),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildTableToolbar() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: TextField(
                    onChanged: (v) => setState(() => _tableSearchQuery = v.trim()),
                    style: GoogleFonts.outfit(fontSize: 13, color: _kInk),
                    decoration: InputDecoration(
                      hintText: 'Search items, customers, invoices...',
                      hintStyle: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF94A3B8)),
                      prefixIcon: const Icon(Icons.search, size: 18, color: Color(0xFF94A3B8)),
                      suffixIcon: _tableSearchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 16, color: Color(0xFF94A3B8)),
                              onPressed: () => setState(() => _tableSearchQuery = ''),
                            )
                          : null,
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: Icon(Icons.table_chart_rounded, size: 18, color: _isTableView ? _kBlue : const Color(0xFF94A3B8)),
                      tooltip: 'Table View',
                      padding: const EdgeInsets.all(8),
                      constraints: const BoxConstraints(),
                      onPressed: () => setState(() => _isTableView = true),
                    ),
                    IconButton(
                      icon: Icon(Icons.view_agenda_outlined, size: 18, color: !_isTableView ? _kBlue : const Color(0xFF94A3B8)),
                      tooltip: 'Card View',
                      padding: const EdgeInsets.all(8),
                      constraints: const BoxConstraints(),
                      onPressed: () => setState(() => _isTableView = false),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (_reportType == 'sales') ...[
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _subFilterChip('all', 'All Sales', _salesTableFilter, (v) => setState(() => _salesTableFilter = v)),
                  _subFilterChip('paid', 'Paid', _salesTableFilter, (v) => setState(() => _salesTableFilter = v)),
                  _subFilterChip('credit', 'Credit', _salesTableFilter, (v) => setState(() => _salesTableFilter = v)),
                  _subFilterChip('cash', 'Cash', _salesTableFilter, (v) => setState(() => _salesTableFilter = v)),
                  _subFilterChip('telebirr', 'Telebirr', _salesTableFilter, (v) => setState(() => _salesTableFilter = v)),
                  _subFilterChip('bank', 'Bank Transfer', _salesTableFilter, (v) => setState(() => _salesTableFilter = v)),
                ],
              ),
            ),
          ] else if (_reportType == 'stock') ...[
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _subFilterChip('all', 'All Products', _stockTableFilter, (v) => setState(() => _stockTableFilter = v)),
                  _subFilterChip('low_stock', '⚠️ Low Stock', _stockTableFilter, (v) => setState(() => _stockTableFilter = v)),
                  _subFilterChip('tracked', 'Tracked', _stockTableFilter, (v) => setState(() => _stockTableFilter = v)),
                  _subFilterChip('out_of_stock', 'Out of Stock', _stockTableFilter, (v) => setState(() => _stockTableFilter = v)),
                ],
              ),
            ),
          ] else if (_reportType == 'warehouse' || _reportType == 'shop') ...[
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _subFilterChip('all', 'All Branches', _branchTableFilter, (v) => setState(() => _branchTableFilter = v)),
                  _subFilterChip('warehouse', 'Warehouses', _branchTableFilter, (v) => setState(() => _branchTableFilter = v)),
                  _subFilterChip('shop', 'Shops', _branchTableFilter, (v) => setState(() => _branchTableFilter = v)),
                ],
              ),
            ),
          ] else if (_reportType == 'credit') ...[
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _subFilterChip('all', 'All Debtors', _creditTableFilter, (v) => setState(() => _creditTableFilter = v)),
                  _subFilterChip('pending', 'Pending Debt', _creditTableFilter, (v) => setState(() => _creditTableFilter = v)),
                  _subFilterChip('settled', 'Settled (Paid)', _creditTableFilter, (v) => setState(() => _creditTableFilter = v)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _subFilterChip(String key, String label, String currentVal, ValueChanged<String> onSelected) {
    final isSelected = currentVal == key;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: InkWell(
        onTap: () => onSelected(key),
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFFEFF6FF) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isSelected ? const Color(0xFF3B82F6) : const Color(0xFFE2E8F0),
            ),
          ),
          child: Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 11,
              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
              color: isSelected ? const Color(0xFF1D4ED8) : const Color(0xFF64748B),
            ),
          ),
        ),
      ),
    );
  }

  Widget _tableHeaderCell(String title, {required int flex, TextAlign align = TextAlign.start}) {
    return Expanded(
      flex: flex,
      child: Text(
        title,
        textAlign: align,
        style: GoogleFonts.outfit(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: const Color(0xFF475569),
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _paymentTypeBadge(String type) {
    final lower = type.toLowerCase();
    Color fg;
    Color bg;
    String label;
    IconData icon;

    if (lower.contains('credit') || lower.contains('partial')) {
      fg = const Color(0xFFD97706);
      bg = const Color(0xFFFEF3C7);
      label = 'Credit';
      icon = Icons.credit_score_outlined;
    } else if (lower.contains('telebirr')) {
      fg = const Color(0xFF0284C7);
      bg = const Color(0xFFE0F2FE);
      label = 'Telebirr';
      icon = Icons.phone_android_outlined;
    } else if (lower.contains('bank') || lower.contains('transfer') || lower.contains('cheque')) {
      fg = const Color(0xFF4F46E5);
      bg = const Color(0xFFEEF2FF);
      label = 'Bank';
      icon = Icons.account_balance_outlined;
    } else {
      fg = const Color(0xFF16A34A);
      bg = const Color(0xFFDCFCE7);
      label = 'Cash';
      icon = Icons.payments_outlined;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: fg.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: fg),
          const SizedBox(width: 4),
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: fg,
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusBadge(String text, Color fg, Color bg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        text,
        style: GoogleFonts.outfit(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: fg,
        ),
      ),
    );
  }

  Widget _buildTableSummaryStrip({
    required int count,
    required double totalAmount,
    int? totalQty,
    String? extra,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: Color(0xFFF8FAFC),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(16)),
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: const Color(0xFFE2E8F0),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              '$count ${count == 1 ? 'Record' : 'Records'}',
              style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w700, color: const Color(0xFF334155)),
            ),
          ),
          if (totalQty != null && totalQty > 0) ...[
            const SizedBox(width: 10),
            Text(
              '${_formatQty(totalQty)} units',
              style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF64748B)),
            ),
          ],
          if (extra != null) ...[
            const SizedBox(width: 8),
            Text('·', style: GoogleFonts.outfit(color: const Color(0xFF94A3B8))),
            const SizedBox(width: 8),
            Text(extra, style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF64748B))),
          ],
          const Spacer(),
          Text(
            'ETB ${_formatAmount(totalAmount)}',
            style: GoogleFonts.outfit(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSalesDataTable(Map<String, dynamic>? analytics) {
    var sales = _filteredSales(analytics);

    if (_tableSearchQuery.isNotEmpty) {
      final q = _tableSearchQuery.toLowerCase();
      sales = sales.where((s) {
        final inv = (s['invoiceNumber'] ?? s['id'] ?? '').toString().toLowerCase();
        final cust = (s['customerName'] ?? s['customer']?['name'] ?? '').toString().toLowerCase();
        final pType = (s['paymentType'] ?? '').toString().toLowerCase();
        final loc = (s['warehouseName'] ?? s['shopName'] ?? s['branch'] ?? '').toString().toLowerCase();
        return inv.contains(q) || cust.contains(q) || pType.contains(q) || loc.contains(q);
      }).toList();
    }

    if (_salesTableFilter != 'all') {
      sales = sales.where((s) {
        final pType = (s['paymentType'] ?? '').toString().toLowerCase();
        final rem = _toDouble(s['remainingBalance']);
        if (_salesTableFilter == 'credit') {
          return !_isSaleSettled(s) && (rem > 0.01 || pType == 'credit' || pType == 'partially_paid');
        } else if (_salesTableFilter == 'paid') {
          return _isSaleSettled(s);
        } else {
          return pType.contains(_salesTableFilter);
        }
      }).toList();
    }

    final totalRevenue = sales.fold<double>(0, (sum, s) => sum + _toDouble(s['totalAmount'] ?? s['revenue']));
    var totalUnits = 0;
    for (final s in sales) {
      final items = s['items'] as List? ?? [];
      for (final it in items) {
        if (it is Map) totalUnits += _toInt(it['quantity'] ?? it['qty']);
      }
    }

    if (!_isTableView) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildTableSummaryStrip(count: sales.length, totalAmount: totalRevenue, totalQty: totalUnits),
          const SizedBox(height: 12),
          if (sales.isEmpty)
            _EmptyBox(message: context.tr('no_results_found'))
          else
            ...sales.take(40).map((json) {
              final sale = SaleModel.fromJson(json);
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _SaleCard(sale: sale, onTap: () => _openSaleDetail(sale)),
              );
            }),
        ],
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: max(780.0, MediaQuery.of(context).size.width - 32),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: const BoxDecoration(
                      color: Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                      border: Border(bottom: BorderSide(color: _kBorder)),
                    ),
                    child: Row(
                      children: [
                        _tableHeaderCell('INVOICE #', flex: 3),
                        _tableHeaderCell(context.tr('date').toUpperCase(), flex: 3),
                        _tableHeaderCell(context.tr('customer').toUpperCase(), flex: 4),
                        _tableHeaderCell(context.tr('payment').toUpperCase(), flex: 3, align: TextAlign.center),
                        _tableHeaderCell(context.tr('items').toUpperCase(), flex: 2, align: TextAlign.center),
                        _tableHeaderCell(context.tr('amount').toUpperCase(), flex: 4, align: TextAlign.end),
                        _tableHeaderCell(context.tr('status').toUpperCase(), flex: 3, align: TextAlign.center),
                        _tableHeaderCell('ACTION', flex: 2, align: TextAlign.center),
                      ],
                    ),
                  ),

                  if (sales.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(40),
                      alignment: Alignment.center,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.receipt_long_outlined, size: 40, color: _kSlate.withValues(alpha: 0.4)),
                          const SizedBox(height: 10),
                          Text(context.tr('no_results_found'),
                              style: GoogleFonts.outfit(fontSize: 14, color: _kSlate, fontWeight: FontWeight.w500)),
                        ],
                      ),
                    )
                  else
                    ...sales.take(50).toList().asMap().entries.map((entry) {
                      final idx = entry.key;
                      final s = entry.value;
                      final sale = SaleModel.fromJson(s);
                      final inv = sale.invoiceNumber != null && sale.invoiceNumber!.isNotEmpty
                          ? sale.invoiceNumber!
                          : (sale.id.length >= 8 ? '#${sale.id.substring(0, 8)}' : '#${sale.id}');
                      final customer = sale.customerName.isNotEmpty ? sale.customerName : context.tr('walk_in');
                      final pType = (sale.paymentType).toLowerCase();
                      final total = sale.totalAmount;
                      final isCredit = !_isSaleSettled(s) && (sale.isCreditSale || sale.hasOutstanding);
                      final isZebra = idx % 2 == 1;

                      final dateStr = () {
                        try {
                          final dt = DateTime.parse(sale.saleDate);
                          return DateFormat('MMM dd, HH:mm').format(dt.toLocal());
                        } catch (_) {
                          return sale.saleDate.split('T').first;
                        }
                      }();

                      return InkWell(
                        onTap: () => _openSaleDetail(sale),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            color: isZebra ? const Color(0xFFFBFDFF) : Colors.white,
                            border: const Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                flex: 3,
                                child: Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(6),
                                      decoration: BoxDecoration(
                                        color: _kBlue.withValues(alpha: 0.08),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: const Icon(Icons.receipt_outlined, size: 14, color: _kBlue),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        inv,
                                        overflow: TextOverflow.ellipsis,
                                        style: GoogleFonts.outfit(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                          color: _kBlue,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Expanded(
                                flex: 3,
                                child: Text(
                                  dateStr,
                                  style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                                ),
                              ),
                              Expanded(
                                flex: 4,
                                child: Row(
                                  children: [
                                    CircleAvatar(
                                      radius: 11,
                                      backgroundColor: const Color(0xFFE0E7FF),
                                      child: Text(
                                        customer.isNotEmpty ? customer[0].toUpperCase() : 'C',
                                        style: GoogleFonts.outfit(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: const Color(0xFF4338CA),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        customer,
                                        overflow: TextOverflow.ellipsis,
                                        style: GoogleFonts.outfit(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: _kInk,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Expanded(
                                flex: 3,
                                child: Center(child: _paymentTypeBadge(pType)),
                              ),
                              Expanded(
                                flex: 2,
                                child: Center(
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF1F5F9),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Text(
                                      '${sale.items.length}',
                                      style: GoogleFonts.outfit(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: _kSlate,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              Expanded(
                                flex: 4,
                                child: Text(
                                  'ETB ${_formatAmount(total)}',
                                  textAlign: TextAlign.end,
                                  style: GoogleFonts.outfit(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: _kInk,
                                  ),
                                ),
                              ),
                              Expanded(
                                flex: 3,
                                child: Center(
                                  child: _statusBadge(
                                    isCredit ? 'Pending' : 'Paid',
                                    isCredit ? _kAmber : _kGreen,
                                    isCredit ? const Color(0xFFFEF3C7) : const Color(0xFFDCFCE7),
                                  ),
                                ),
                              ),
                              Expanded(
                                flex: 2,
                                child: Center(
                                  child: Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF8FAFC),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: _kBorder),
                                    ),
                                    child: const Icon(Icons.chevron_right_rounded, size: 16, color: _kSlate),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
          ),
          _buildTableSummaryStrip(
            count: sales.length,
            totalAmount: totalRevenue,
            totalQty: totalUnits,
            extra: sales.length > 50 ? 'Top 50 of ${sales.length}' : null,
          ),
        ],
      ),
    );
  }

  Widget _buildInventoryDataTable() {
    var products = context.read<ProductProvider>().products;

    if (_tableSearchQuery.isNotEmpty) {
      final q = _tableSearchQuery.toLowerCase();
      products = products.where((p) {
        return p.name.toLowerCase().contains(q) ||
            p.sku.toLowerCase().contains(q) ||
            p.category.toLowerCase().contains(q) ||
            (p.supplierName ?? '').toLowerCase().contains(q);
      }).toList();
    }

    if (_stockTableFilter == 'low_stock') {
      products = products.where((p) => p.stockQuantity <= (p.minStockLevel > 0 ? p.minStockLevel : 5)).toList();
    } else if (_stockTableFilter == 'tracked') {
      products = products.where((p) => p.trackStock).toList();
    } else if (_stockTableFilter == 'out_of_stock') {
      products = products.where((p) => p.stockQuantity <= 0).toList();
    }

    final totalStockQty = products.fold<int>(0, (s, p) => s + p.stockQuantity);
    final totalInventoryValue = products.fold<double>(0, (s, p) => s + (p.cost > 0 ? p.cost : p.price) * p.stockQuantity);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: max(780.0, MediaQuery.of(context).size.width - 32),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: const BoxDecoration(
                      color: Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                      border: Border(bottom: BorderSide(color: _kBorder)),
                    ),
                    child: Row(
                      children: [
                        _tableHeaderCell(context.tr('product').toUpperCase(), flex: 4),
                        _tableHeaderCell('SKU', flex: 3),
                        _tableHeaderCell(context.tr('in_stock').toUpperCase(), flex: 3, align: TextAlign.center),
                        _tableHeaderCell('UNIT COST', flex: 3, align: TextAlign.end),
                        _tableHeaderCell('SELLING PRICE', flex: 3, align: TextAlign.end),
                        _tableHeaderCell('STOCK VALUE', flex: 4, align: TextAlign.end),
                        _tableHeaderCell('STATUS', flex: 3, align: TextAlign.center),
                      ],
                    ),
                  ),

                  if (products.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(40),
                      alignment: Alignment.center,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.inventory_2_outlined, size: 40, color: _kSlate.withValues(alpha: 0.4)),
                          const SizedBox(height: 10),
                          Text(context.tr('no_results_found'),
                              style: GoogleFonts.outfit(fontSize: 14, color: _kSlate, fontWeight: FontWeight.w500)),
                        ],
                      ),
                    )
                  else
                    ...products.take(60).toList().asMap().entries.map((entry) {
                      final idx = entry.key;
                      final p = entry.value;
                      final isZebra = idx % 2 == 1;
                      final val = (p.cost > 0 ? p.cost : p.price) * p.stockQuantity;
                      final isOut = p.stockQuantity <= 0;
                      final isLow = p.stockQuantity <= (p.minStockLevel > 0 ? p.minStockLevel : 5);

                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: isZebra ? const Color(0xFFFBFDFF) : Colors.white,
                          border: const Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              flex: 4,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    p.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.outfit(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: _kInk,
                                    ),
                                  ),
                                  if (p.category.isNotEmpty)
                                    Text(
                                      p.category,
                                      style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                                    ),
                                ],
                              ),
                            ),
                            Expanded(
                              flex: 3,
                              child: Text(
                                p.sku.isNotEmpty ? p.sku : '—',
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.outfit(
                                  fontSize: 12,
                                  color: _kSlate,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                            Expanded(
                              flex: 3,
                              child: Center(
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: isOut
                                        ? const Color(0xFFFEF2F2)
                                        : isLow
                                            ? const Color(0xFFFFFBEB)
                                            : const Color(0xFFECFDF5),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    _formatQty(p.stockQuantity),
                                    style: GoogleFonts.outfit(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: isOut
                                          ? _kRed
                                          : isLow
                                              ? _kAmber
                                              : _kGreen,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            Expanded(
                              flex: 3,
                              child: Text(
                                p.cost > 0 ? 'ETB ${_formatAmount(p.cost)}' : '—',
                                textAlign: TextAlign.end,
                                style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                              ),
                            ),
                            Expanded(
                              flex: 3,
                              child: Text(
                                'ETB ${_formatAmount(p.price)}',
                                textAlign: TextAlign.end,
                                style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: _kInk),
                              ),
                            ),
                            Expanded(
                              flex: 4,
                              child: Text(
                                'ETB ${_formatAmount(val)}',
                                textAlign: TextAlign.end,
                                style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF025EA7),
                                ),
                              ),
                            ),
                            Expanded(
                              flex: 3,
                              child: Center(
                                child: _statusBadge(
                                  isOut ? 'Out of Stock' : (isLow ? 'Low Stock' : 'In Stock'),
                                  isOut ? _kRed : (isLow ? _kAmber : _kGreen),
                                  isOut
                                      ? const Color(0xFFFEE2E2)
                                      : (isLow ? const Color(0xFFFEF3C7) : const Color(0xFFDCFCE7)),
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
          ),
          _buildTableSummaryStrip(
            count: products.length,
            totalAmount: totalInventoryValue,
            totalQty: totalStockQty,
            extra: products.length > 60 ? 'Top 60 of ${products.length}' : null,
          ),
        ],
      ),
    );
  }

  Widget _buildBranchDataTable(Map<String, dynamic>? analytics) {
    final rawRows = [
      ..._locationRows(analytics, warehouse: true).map((r) => {...r, '_type': 'warehouse'}),
      ..._locationRows(analytics, warehouse: false).map((r) => {...r, '_type': 'shop'}),
    ];

    var list = rawRows;
    if (_branchTableFilter == 'warehouse') {
      list = list.where((r) => r['_type'] == 'warehouse').toList();
    } else if (_branchTableFilter == 'shop') {
      list = list.where((r) => r['_type'] == 'shop').toList();
    }

    if (_tableSearchQuery.isNotEmpty) {
      final q = _tableSearchQuery.toLowerCase();
      list = list.where((r) => (r['name'] ?? r['branch'] ?? '').toString().toLowerCase().contains(q)).toList();
    }

    final totalRev = list.fold<double>(0, (s, r) => s + _toDouble(r['revenue'] ?? r['sales']));
    final totalInvoices = list.fold<int>(0, (s, r) => s + _toInt(r['invoiceCount'] ?? r['salesCount']));

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: max(680.0, MediaQuery.of(context).size.width - 32),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: const BoxDecoration(
                      color: Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                      border: Border(bottom: BorderSide(color: _kBorder)),
                    ),
                    child: Row(
                      children: [
                        _tableHeaderCell('BRANCH / LOCATION', flex: 4),
                        _tableHeaderCell('TYPE', flex: 3, align: TextAlign.center),
                        _tableHeaderCell('TOTAL REVENUE', flex: 4, align: TextAlign.end),
                        _tableHeaderCell('SALES ORDERS', flex: 3, align: TextAlign.center),
                        _tableHeaderCell('SHARE', flex: 3, align: TextAlign.end),
                      ],
                    ),
                  ),

                  if (list.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(40),
                      alignment: Alignment.center,
                      child: Text(context.tr('no_results_found'),
                          style: GoogleFonts.outfit(fontSize: 14, color: _kSlate, fontWeight: FontWeight.w500)),
                    )
                  else
                    ...list.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final r = entry.value;
                      final isWh = r['_type'] == 'warehouse';
                      final name = (r['name'] ?? r['branch'] ?? context.tr('unknown')).toString();
                      final rev = _toDouble(r['revenue'] ?? r['sales']);
                      final cnt = _toInt(r['invoiceCount'] ?? r['salesCount']);
                      final share = totalRev > 0 ? (rev / totalRev * 100) : 0.0;
                      final isZebra = idx % 2 == 1;

                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                        decoration: BoxDecoration(
                          color: isZebra ? const Color(0xFFFBFDFF) : Colors.white,
                          border: const Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              flex: 4,
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(7),
                                    decoration: BoxDecoration(
                                      color: isWh ? const Color(0xFFEFF6FF) : const Color(0xFFFAF5FF),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Icon(
                                      isWh ? Icons.warehouse_outlined : Icons.storefront_outlined,
                                      size: 16,
                                      color: isWh ? _kBlue : const Color(0xFF9333EA),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      name,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: _kInk),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Expanded(
                              flex: 3,
                              child: Center(
                                child: _statusBadge(
                                  isWh ? 'Warehouse' : 'Shop',
                                  isWh ? _kBlue : const Color(0xFF9333EA),
                                  isWh ? const Color(0xFFDBEAFE) : const Color(0xFFF3E8FF),
                                ),
                              ),
                            ),
                            Expanded(
                              flex: 4,
                              child: Text(
                                'ETB ${_formatAmount(rev)}',
                                textAlign: TextAlign.end,
                                style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: _kInk),
                              ),
                            ),
                            Expanded(
                              flex: 3,
                              child: Center(
                                child: Text(
                                  '$cnt',
                                  style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kSlate),
                                ),
                              ),
                            ),
                            Expanded(
                              flex: 3,
                              child: Text(
                                '${share.toStringAsFixed(1)}%',
                                textAlign: TextAlign.end,
                                style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: share > 30 ? _kGreen : _kSlate,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
          ),
          _buildTableSummaryStrip(count: list.length, totalAmount: totalRev, extra: '$totalInvoices Orders Total'),
        ],
      ),
    );
  }

  Widget _buildProfitDataTable(Map<String, dynamic>? analytics) {
    final products = context.read<ProductProvider>().products;
    final byProd = _listOf(analytics, 'byProduct');

    final rows = byProd.map((r) {
      final pId = (r['productId'] ?? '').toString();
      final pName = (r['productName'] ?? context.tr('unknown')).toString();
      final qty = _toInt(r['quantity']);
      final revenue = _toDouble(r['revenue']);
      final matchedProduct = products.where((p) => p.id == pId || p.name.toLowerCase() == pName.toLowerCase()).firstOrNull;
      final unitCost = matchedProduct != null && matchedProduct.cost > 0
          ? matchedProduct.cost
          : (matchedProduct != null && matchedProduct.price > 0 ? matchedProduct.price * 0.7 : 0.0);
      final totalCost = unitCost * qty;
      final profit = revenue - totalCost;
      final margin = revenue > 0 ? (profit / revenue * 100) : 0.0;

      return {
        'name': pName,
        'qty': qty,
        'revenue': revenue,
        'cost': totalCost,
        'profit': profit,
        'margin': margin,
      };
    }).toList();

    var filtered = rows;
    if (_tableSearchQuery.isNotEmpty) {
      filtered = filtered.where((r) => r['name'].toString().toLowerCase().contains(_tableSearchQuery.toLowerCase())).toList();
    }

    final totalRev = filtered.fold<double>(0, (s, r) => s + _toDouble(r['revenue']));
    final totalProfit = filtered.fold<double>(0, (s, r) => s + _toDouble(r['profit']));
    final totalUnits = filtered.fold<int>(0, (s, r) => s + _toInt(r['qty']));

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: max(720.0, MediaQuery.of(context).size.width - 32),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: const BoxDecoration(
                      color: Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                      border: Border(bottom: BorderSide(color: _kBorder)),
                    ),
                    child: Row(
                      children: [
                        _tableHeaderCell('PRODUCT / ITEM', flex: 4),
                        _tableHeaderCell('QTY SOLD', flex: 2, align: TextAlign.center),
                        _tableHeaderCell('REVENUE', flex: 3, align: TextAlign.end),
                        _tableHeaderCell('EST. COST', flex: 3, align: TextAlign.end),
                        _tableHeaderCell('GROSS PROFIT', flex: 3, align: TextAlign.end),
                        _tableHeaderCell('MARGIN %', flex: 3, align: TextAlign.center),
                      ],
                    ),
                  ),

                  if (filtered.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(40),
                      alignment: Alignment.center,
                      child: Text(context.tr('no_results_found'),
                          style: GoogleFonts.outfit(fontSize: 14, color: _kSlate, fontWeight: FontWeight.w500)),
                    )
                  else
                    ...filtered.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final r = entry.value;
                      final rev = _toDouble(r['revenue']);
                      final cost = _toDouble(r['cost']);
                      final profit = _toDouble(r['profit']);
                      final margin = _toDouble(r['margin']);
                      final isZebra = idx % 2 == 1;

                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: isZebra ? const Color(0xFFFBFDFF) : Colors.white,
                          border: const Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              flex: 4,
                              child: Text(
                                r['name'].toString(),
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: _kInk),
                              ),
                            ),
                            Expanded(
                              flex: 2,
                              child: Center(
                                child: Text(
                                  _formatQty(_toInt(r['qty'])),
                                  style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: _kSlate),
                                ),
                              ),
                            ),
                            Expanded(
                              flex: 3,
                              child: Text(
                                'ETB ${_formatAmount(rev)}',
                                textAlign: TextAlign.end,
                                style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: _kInk),
                              ),
                            ),
                            Expanded(
                              flex: 3,
                              child: Text(
                                'ETB ${_formatAmount(cost)}',
                                textAlign: TextAlign.end,
                                style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                              ),
                            ),
                            Expanded(
                              flex: 3,
                              child: Text(
                                'ETB ${_formatAmount(profit)}',
                                textAlign: TextAlign.end,
                                style: GoogleFonts.outfit(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: profit >= 0 ? _kGreen : _kRed,
                                ),
                              ),
                            ),
                            Expanded(
                              flex: 3,
                              child: Center(
                                child: _statusBadge(
                                  '${margin.toStringAsFixed(1)}%',
                                  margin >= 30 ? _kGreen : (margin >= 15 ? _kBlue : _kAmber),
                                  margin >= 30
                                      ? const Color(0xFFDCFCE7)
                                      : (margin >= 15 ? const Color(0xFFDBEAFE) : const Color(0xFFFEF3C7)),
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
          ),
          _buildTableSummaryStrip(
            count: filtered.length,
            totalAmount: totalProfit,
            totalQty: totalUnits,
            extra: 'Total Revenue: ETB ${_formatAmount(totalRev)}',
          ),
        ],
      ),
    );
  }

  Widget _buildPurchasesDataTable() {
    var list = _reportPurchases;
    if (_tableSearchQuery.isNotEmpty) {
      final q = _tableSearchQuery.toLowerCase();
      list = list.where((tx) {
        final m = tx is Map<String, dynamic> ? tx : <String, dynamic>{};
        final name = (m['productName'] ?? '').toString().toLowerCase();
        final sku = (m['productSku'] ?? '').toString().toLowerCase();
        final sup = (m['supplierName'] ?? '').toString().toLowerCase();
        return name.contains(q) || sku.contains(q) || sup.contains(q);
      }).toList();
    }

    final totalCost = list.fold<double>(0, (s, tx) {
      final m = tx is Map<String, dynamic> ? tx : <String, dynamic>{};
      return s + _toDouble(m['totalCost']);
    });
    final totalUnits = list.fold<int>(0, (s, tx) {
      final m = tx is Map<String, dynamic> ? tx : <String, dynamic>{};
      return s + _toInt(m['quantity']);
    });

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: max(740.0, MediaQuery.of(context).size.width - 32),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: const BoxDecoration(
                      color: Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                      border: Border(bottom: BorderSide(color: _kBorder)),
                    ),
                    child: Row(
                      children: [
                        _tableHeaderCell('PRODUCT', flex: 4),
                        _tableHeaderCell('SUPPLIER', flex: 3),
                        _tableHeaderCell('QTY', flex: 2, align: TextAlign.center),
                        _tableHeaderCell('UNIT COST', flex: 3, align: TextAlign.end),
                        _tableHeaderCell('TOTAL COST', flex: 3, align: TextAlign.end),
                        _tableHeaderCell('DESTINATION', flex: 3, align: TextAlign.center),
                        _tableHeaderCell('DATE', flex: 3, align: TextAlign.end),
                      ],
                    ),
                  ),

                  if (list.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(40),
                      alignment: Alignment.center,
                      child: Text(context.tr('no_results_found'),
                          style: GoogleFonts.outfit(fontSize: 14, color: _kSlate, fontWeight: FontWeight.w500)),
                    )
                  else
                    ...list.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final tx = entry.value;
                      final m = tx is Map<String, dynamic> ? tx : <String, dynamic>{};
                      final prod = (m['productName'] ?? context.tr('unknown')).toString();
                      final sup = (m['supplierName'] ?? '—').toString();
                      final qty = _toInt(m['quantity']);
                      final uCost = _toDouble(m['unitCost']);
                      final tCost = _toDouble(m['totalCost']);
                      final loc = (m['warehouseName'] ?? m['shopName'] ?? '—').toString();
                      final date = m['createdAt'] != null
                          ? DateFormat('MMM dd, yyyy').format(DateTime.tryParse(m['createdAt'].toString()) ?? DateTime.now())
                          : '—';
                      final isZebra = idx % 2 == 1;

                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: isZebra ? const Color(0xFFFBFDFF) : Colors.white,
                          border: const Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              flex: 4,
                              child: Text(prod,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: _kInk)),
                            ),
                            Expanded(
                              flex: 3,
                              child: Text(sup,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                            ),
                            Expanded(
                              flex: 2,
                              child: Center(
                                child: Text(_formatQty(qty),
                                    style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: _kInk)),
                              ),
                            ),
                            Expanded(
                              flex: 3,
                              child: Text('ETB ${_formatAmount(uCost)}',
                                  textAlign: TextAlign.end,
                                  style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                            ),
                            Expanded(
                              flex: 3,
                              child: Text('ETB ${_formatAmount(tCost)}',
                                  textAlign: TextAlign.end,
                                  style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: _kBlue)),
                            ),
                            Expanded(
                              flex: 3,
                              child: Center(
                                child: Text(loc,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                              ),
                            ),
                            Expanded(
                              flex: 3,
                              child: Text(date,
                                  textAlign: TextAlign.end,
                                  style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
          ),
          _buildTableSummaryStrip(count: list.length, totalAmount: totalCost, totalQty: totalUnits),
        ],
      ),
    );
  }

  Widget _buildTopProductsRankedPreview(Map<String, dynamic>? analytics) {
    final list = _listOf(analytics, 'byProduct');
    if (list.isEmpty) return const SizedBox.shrink();

    final maxRev = list.fold<double>(0, (m, r) => max(m, _toDouble(r['revenue'])));

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.emoji_events_outlined, size: 18, color: Color(0xFFD97706)),
              ),
              const SizedBox(width: 10),
              Text(
                'Top Performing Products',
                style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800, color: _kInk),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...list.take(5).toList().asMap().entries.map((entry) {
            final idx = entry.key;
            final r = entry.value;
            final name = (r['productName'] ?? context.tr('unknown')).toString();
            final rev = _toDouble(r['revenue']);
            final qty = _toInt(r['quantity']);
            final ratio = maxRev > 0 ? (rev / maxRev).clamp(0.05, 1.0) : 0.1;

            final rankColors = [
              const Color(0xFFF59E0B),
              const Color(0xFF94A3B8),
              const Color(0xFFB45309),
              const Color(0xFF64748B),
              const Color(0xFF94A3B8),
            ];

            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 20,
                        height: 20,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: (idx < 3 ? rankColors[idx] : const Color(0xFFE2E8F0)).withValues(alpha: 0.2),
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          '${idx + 1}',
                          style: GoogleFonts.outfit(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: idx < 3 ? rankColors[idx] : const Color(0xFF64748B),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          name,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk),
                        ),
                      ),
                      Text(
                        '$qty sold · ETB ${_formatAmount(rev)}',
                        style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: _kInk),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: ratio,
                      minHeight: 6,
                      backgroundColor: const Color(0xFFF1F5F9),
                      valueColor: AlwaysStoppedAnimation<Color>(
                        idx == 0 ? _kBlue : (idx == 1 ? const Color(0xFF0EA5E9) : const Color(0xFF6366F1)),
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildPaymentMethodBreakdown(Map<String, dynamic>? analytics) {
    final sales = _listOf(analytics, 'sales');
    if (sales.isEmpty) return const SizedBox.shrink();

    final breakdown = <String, double>{};
    for (final s in sales) {
      final pType = (s['paymentType'] ?? 'cash').toString().toLowerCase();
      final amt = _toDouble(s['totalAmount'] ?? s['revenue']);
      breakdown[pType] = (breakdown[pType] ?? 0) + amt;
    }

    final total = breakdown.values.fold<double>(0, (s, a) => s + a);
    if (total <= 0) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.pie_chart_outline_rounded, size: 18, color: Color(0xFF16A34A)),
              ),
              const SizedBox(width: 10),
              Text(
                'Payment Methods Breakdown',
                style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800, color: _kInk),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 12,
            runSpacing: 10,
            children: breakdown.entries.map((entry) {
              final pct = (entry.value / total * 100);
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: _kBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _paymentTypeBadge(entry.key),
                        const SizedBox(width: 6),
                        Text(
                          '${pct.toStringAsFixed(1)}%',
                          style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: _kInk),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'ETB ${_formatAmount(entry.value)}',
                      style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildCreditDataTable(Map<String, dynamic>? analytics) {
    var creditSales = _filteredSales(analytics).where((s) {
      final pType = (s['paymentType'] ?? '').toString().toLowerCase();
      return pType == 'credit' || pType == 'partially_paid' || _saleRemaining(s) > 0.01;
    }).toList();

    if (_tableSearchQuery.isNotEmpty) {
      final q = _tableSearchQuery.toLowerCase();
      creditSales = creditSales.where((s) {
        final inv = (s['invoiceNumber'] ?? s['id'] ?? '').toString().toLowerCase();
        final cust = (s['customerName'] ?? s['customer']?['name'] ?? '').toString().toLowerCase();
        final phone = (s['customer']?['phone'] ?? '').toString().toLowerCase();
        return inv.contains(q) || cust.contains(q) || phone.contains(q);
      }).toList();
    }

    if (_creditTableFilter == 'pending') {
      creditSales = creditSales.where(_isOutstandingCredit).toList();
    } else if (_creditTableFilter == 'settled') {
      creditSales = creditSales.where(_isSaleSettled).toList();
    }

    final totalDebt = creditSales.fold<double>(0, (sum, s) => sum + (_isSaleSettled(s) ? 0 : _saleRemaining(s)));
    final totalUnits = creditSales.length;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: max(780.0, MediaQuery.of(context).size.width - 32),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: const BoxDecoration(
                      color: Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                      border: Border(bottom: BorderSide(color: _kBorder)),
                    ),
                    child: Row(
                      children: [
                        _tableHeaderCell('INVOICE', flex: 3),
                        _tableHeaderCell('CUSTOMER', flex: 4),
                        _tableHeaderCell('TOTAL (ETB)', flex: 3, align: TextAlign.end),
                        _tableHeaderCell('PAID (ETB)', flex: 3, align: TextAlign.end),
                        _tableHeaderCell('REMAINING DEBT', flex: 4, align: TextAlign.end),
                        _tableHeaderCell('DATE', flex: 3, align: TextAlign.center),
                        _tableHeaderCell('STATUS', flex: 3, align: TextAlign.center),
                      ],
                    ),
                  ),

                  if (creditSales.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(40),
                      alignment: Alignment.center,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.check_circle_outline, size: 40, color: const Color(0xFF16A34A).withValues(alpha: 0.6)),
                          const SizedBox(height: 10),
                          Text('No outstanding credit invoices in this period',
                              style: GoogleFonts.outfit(fontSize: 14, color: _kSlate, fontWeight: FontWeight.w500)),
                        ],
                      ),
                    )
                  else
                    ...creditSales.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final s = entry.value;
                      final inv = (s['invoiceNumber'] ?? s['id'] ?? '—').toString();
                      final cust = (s['customerName'] ?? s['customer']?['name'] ?? context.tr('walk_in_customer')).toString();
                      final total = _toDouble(s['totalAmount'] ?? s['revenue']);
                      final rem = _saleRemaining(s);
                      final paid = _toDouble(s['amountPaid'] ?? (total - rem));
                      final settled = _isSaleSettled(s);
                      final isZebra = idx % 2 == 1;

                      final date = s['createdAt'] != null
                          ? DateFormat('MMM dd, yyyy').format(DateTime.tryParse(s['createdAt'].toString()) ?? DateTime.now())
                          : '—';

                      return InkWell(
                        onTap: () {
                          final sale = SaleModel.fromJson(s);
                          _openSaleDetail(sale);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            color: isZebra ? const Color(0xFFFBFDFF) : Colors.white,
                            border: const Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                flex: 3,
                                child: Text(
                                  inv,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: _kBlue),
                                ),
                              ),
                              Expanded(
                                flex: 4,
                                child: Text(
                                  cust,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk),
                                ),
                              ),
                              Expanded(
                                flex: 3,
                                child: Text(
                                  _formatAmount(total),
                                  textAlign: TextAlign.end,
                                  style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                                ),
                              ),
                              Expanded(
                                flex: 3,
                                child: Text(
                                  _formatAmount(paid),
                                  textAlign: TextAlign.end,
                                  style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF16A34A)),
                                ),
                              ),
                              Expanded(
                                flex: 4,
                                child: Text(
                                  settled ? 'ETB 0.00' : 'ETB ${_formatAmount(rem)}',
                                  textAlign: TextAlign.end,
                                  style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w800, color: settled ? const Color(0xFF16A34A) : const Color(0xFFDC2626)),
                                ),
                              ),
                              Expanded(
                                flex: 3,
                                child: Text(
                                  date,
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                                ),
                              ),
                              Expanded(
                                flex: 3,
                                child: Center(
                                  child: _statusBadge(
                                    settled ? 'Settled' : 'Pending',
                                    settled ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                                    settled ? const Color(0xFFDCFCE7) : const Color(0xFFFEF2F2),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
          ),
          _buildTableSummaryStrip(count: totalUnits, totalAmount: totalDebt, totalQty: 0),
        ],
      ),
    );
  }

  Widget _buildStockMovementsDataTable(List<Map<String, dynamic>> txs) {
    var filtered = txs;
    if (_tableSearchQuery.isNotEmpty) {
      final q = _tableSearchQuery.toLowerCase();
      filtered = filtered.where((t) {
        final prod = (t['product']?['name'] ?? t['productName'] ?? '').toString().toLowerCase();
        final loc = (t['warehouse']?['name'] ?? t['shop']?['name'] ?? t['locationName'] ?? '').toString().toLowerCase();
        final from = (t['fromWarehouseName'] ?? t['fromShopName'] ?? '').toString().toLowerCase();
        final to = (t['toWarehouseName'] ?? t['toShopName'] ?? '').toString().toLowerCase();
        final user = (t['user']?['firstName'] ?? t['performedByName'] ?? '').toString().toLowerCase();
        final reason = (t['reason'] ?? '').toString().toLowerCase();
        return prod.contains(q) || loc.contains(q) || from.contains(q) || to.contains(q) || user.contains(q) || reason.contains(q);
      }).toList();
    }

    final totalUnits = filtered.fold<int>(0, (s, t) => s + _toInt(t['quantity']));

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: max(780.0, MediaQuery.of(context).size.width - 32),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: const BoxDecoration(
                      color: Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                      border: Border(bottom: BorderSide(color: _kBorder)),
                    ),
                    child: Row(
                      children: [
                        _tableHeaderCell('TYPE', flex: 3, align: TextAlign.center),
                        _tableHeaderCell('PRODUCT', flex: 4),
                        _tableHeaderCell('QUANTITY', flex: 3, align: TextAlign.center),
                        _tableHeaderCell('LOCATION / ROUTE', flex: 4),
                        _tableHeaderCell('REASON', flex: 4),
                        _tableHeaderCell('DATE', flex: 3, align: TextAlign.end),
                      ],
                    ),
                  ),

                  if (filtered.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(40),
                      alignment: Alignment.center,
                      child: Text(context.tr('no_results_found'),
                          style: GoogleFonts.outfit(fontSize: 14, color: _kSlate, fontWeight: FontWeight.w500)),
                    )
                  else
                    ...filtered.take(60).toList().asMap().entries.map((entry) {
                      final idx = entry.key;
                      final t = entry.value;
                      final txType = (t['_txType'] ?? t['type'] ?? '').toString();
                      final isTransfer = txType == 'transfer';
                      final isStockIn = txType == 'stock_in';
                      final badgeFg = isTransfer ? const Color(0xFF025EA7) : (isStockIn ? const Color(0xFF16A34A) : const Color(0xFFDC2626));
                      final badgeBg = isTransfer ? const Color(0xFFEFF6FF) : (isStockIn ? const Color(0xFFDCFCE7) : const Color(0xFFFEF2F2));
                      final typeLabel = isTransfer ? '⇄ Transfer' : (isStockIn ? '+ Stock In' : '− Stock Out');

                      final prodName = (t['product']?['name'] ?? t['productName'] ?? context.tr('product')).toString();
                      final qty = _toInt(t['quantity']);
                      final fromName = (t['fromWarehouseName'] ?? t['fromShopName'] ?? '').toString();
                      final toName = (t['toShopName'] ?? t['toWarehouseName'] ?? '').toString();
                      final loc = isTransfer
                          ? (fromName.isNotEmpty && toName.isNotEmpty ? '$fromName → $toName' : (fromName.isNotEmpty ? fromName : toName))
                          : (t['warehouse']?['name'] ?? t['shop']?['name'] ?? t['locationName'] ?? '—').toString();
                      final reason = (t['reason'] ?? (isTransfer ? 'Transfer' : 'Audit')).toString();
                      final rawDate = (t['createdAt'] ?? t['date'] ?? '').toString();
                      String dateStr = '—';
                      if (rawDate.isNotEmpty) {
                        try {
                          final dt = DateTime.parse(rawDate);
                          dateStr = DateFormat('MMM dd, HH:mm').format(dt.toLocal());
                        } catch (_) {
                          dateStr = rawDate;
                        }
                      }
                      final isZebra = idx % 2 == 1;

                      return InkWell(
                        onTap: () {
                          if (isTransfer && t['id'] != null && t['id'].toString().isNotEmpty) {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => TransferDetailScreen(transferId: t['id'].toString()),
                              ),
                            );
                          }
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            color: isZebra ? const Color(0xFFFBFDFF) : Colors.white,
                            border: const Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                flex: 3,
                                child: Center(
                                  child: _statusBadge(typeLabel, badgeFg, badgeBg),
                                ),
                              ),
                              Expanded(
                                flex: 4,
                                child: Text(prodName,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: _kInk)),
                              ),
                              Expanded(
                                flex: 3,
                                child: Center(
                                  child: Text(
                                    isStockIn ? '+$qty' : (isTransfer ? '⇄ $qty' : '-$qty'),
                                    style: GoogleFonts.outfit(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w800,
                                      color: isStockIn ? const Color(0xFF16A34A) : (isTransfer ? const Color(0xFF025EA7) : const Color(0xFFDC2626)),
                                    ),
                                  ),
                                ),
                              ),
                              Expanded(
                                flex: 4,
                                child: Text(loc,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                              ),
                              Expanded(
                                flex: 4,
                                child: Text(reason,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                              ),
                              Expanded(
                                flex: 3,
                                child: Text(dateStr,
                                    textAlign: TextAlign.end,
                                    style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
          ),
          _buildTableSummaryStrip(count: filtered.length, totalAmount: 0, totalQty: totalUnits),
        ],
      ),
    );
  }

  Widget _buildDetailBody(ReportProvider rp) {
    final periodsList = (_reportType == 'total_profit' || _reportType == 'profit')
        ? _periods.where((p) => p.period != 'all').toList()
        : _periods;

    return RefreshIndicator(
      onRefresh: () async {
        await rp.loadAnalytics(companyId: _companyId());
        await _loadSupplement(_companyId());
      },
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
                // ── Period selector ──
                _SectionLabel(context.tr('date_period').toUpperCase()),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: periodsList.map((p) {
                    final isSelected = rp.period == p.period;
                    final isGrand = p.period == 'all';
                    final isCustom = p.period == 'custom';
                    return InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () {
                        if (isCustom) {
                          _pickCustomDateRange(rp);
                        } else {
                          rp.setPeriod(p.period, companyId: _companyId());
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? (isGrand ? const Color(0xFF1E3A8A) : _kBlue)
                              : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isSelected
                                ? (isGrand ? const Color(0xFF1E3A8A) : _kBlue)
                                : _kBorder,
                            width: isSelected ? 1.5 : 1,
                          ),
                          boxShadow: isSelected
                              ? [
                                  BoxShadow(
                                    color: (isGrand ? const Color(0xFF1E3A8A) : _kBlue).withValues(alpha: 0.25),
                                    blurRadius: 8,
                                    offset: const Offset(0, 3),
                                  ),
                                ]
                              : null,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (isCustom) ...[
                              Icon(Icons.calendar_month_outlined, size: 15, color: isSelected ? Colors.white : _kSlate),
                              const SizedBox(width: 6),
                            ] else if (isGrand) ...[
                              Icon(Icons.verified_outlined, size: 15, color: isSelected ? Colors.amberAccent : _kBlue),
                              const SizedBox(width: 6),
                            ],
                            Text(
                              context.tr(p.label),
                              style: GoogleFonts.outfit(
                                fontSize: 13,
                                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                color: isSelected ? Colors.white : _kSlate,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
                if (rp.period == 'custom') ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFBFDBFE)),
                      boxShadow: [
                        BoxShadow(
                          color: _kBlue.withValues(alpha: 0.05),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.calendar_month_rounded, size: 20, color: _kBlue),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                context.tr('custom_date'),
                                style: GoogleFonts.outfit(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: _kSlate,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                (rp.fromDate != null && rp.toDate != null)
                                    ? '${rp.from}  →  ${rp.to}'
                                    : context.tr('select_date_range'),
                                style: GoogleFonts.outfit(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: _kInk,
                                ),
                              ),
                            ],
                          ),
                        ),
                        ElevatedButton.icon(
                          onPressed: () => _pickCustomDateRange(rp),
                          icon: const Icon(Icons.tune_rounded, size: 14),
                          label: const Text('Change'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFEFF6FF),
                            foregroundColor: _kBlue,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                              side: const BorderSide(color: Color(0xFFBFDBFE)),
                            ),
                            textStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (rp.period == 'all' && (_reportType == 'sales' || _reportType == 'warehouse' || _reportType == 'shop')) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF0F172A), Color(0xFF1E3A8A)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: _kBlue.withValues(alpha: 0.18),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.shield_outlined, color: Colors.white, size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                context.tr('grand_report'),
                                style: GoogleFonts.outfit(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                              Text(
                                'All-time audit & performance across all shops and warehouses',
                                style: GoogleFonts.outfit(
                                  fontSize: 11,
                                  color: Colors.white.withValues(alpha: 0.85),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 16),

                if (_reportUsesFilters()) ...[
                  ..._buildReportFilters(rp),
                  if (rp.hasActiveFilters) ...[
                    const SizedBox(height: 16),
                    _buildActiveFilterChips(rp),
                  ],
                  const SizedBox(height: 16),
                ],

                ..._buildCategorySections(rp),
                ..._buildReportExtras(rp),
                const SizedBox(height: 24),
              ],
            ),
          );
  }

  bool _reportUsesFilters() => !{'stock', 'top_products', 'stock_report', 'stock_in', 'stock_out', 'commission', 'purchases_report'}.contains(_reportType);

  List<Widget> _buildReportFilters(ReportProvider rp) {
    switch (_reportType) {
      case 'credit':
        return [
          _buildFilterBoxContainer(
            rp: rp,
            dropdownRow: Row(
              children: [
                _buildDropdownCard(
                  label: rp.customerId != null ? _customerName(rp.customerId) : context.tr('customer'),
                  active: rp.customerId != null,
                  onTap: () => _showSelectionSheet(
                    title: context.tr('select_customer'),
                    selectedId: rp.customerId,
                    options: _customers.map((c) => {'id': c.id, 'name': c.name, 'subtitle': c.displayPhone}).toList(),
                    onSelect: (id) => rp.setCustomerFilter(id, companyId: _companyId()),
                  ),
                ),
                const SizedBox(width: 8),
                _buildDropdownCard(
                  label: rp.sellerId != null ? _sellerName(rp.sellerId) : context.tr('seller'),
                  active: rp.sellerId != null,
                  onTap: () => _showSelectionSheet(
                    title: context.tr('select_seller'),
                    selectedId: rp.sellerId,
                    options: context.read<StaffProvider>().employees
                        .where((e) => e.userId != null)
                        .map((e) => {'id': e.userId!, 'name': e.name, 'subtitle': e.jobTitle ?? e.role ?? ''}).toList(),
                    onSelect: (id) => rp.setSellerFilter(id, companyId: _companyId()),
                  ),
                ),
              ],
            ),
          ),
        ];
      case 'warehouse':
        return [
          _buildFilterBoxContainer(
            rp: rp,
            dropdownRow: Row(
              children: [
                _buildDropdownCard(
                  label: rp.locationId != null ? _locationName(rp.locationId, 'warehouse') : context.tr('branch'),
                  active: rp.locationId != null,
                  onTap: () => _showSelectionSheet(
                    title: context.tr('select_warehouse'),
                    selectedId: rp.locationId,
                    options: context.read<BranchProvider>().warehouses
                        .map((w) => {'id': w.id, 'name': w.name, 'subtitle': context.tr('warehouse')}).toList(),
                    onSelect: (id) => rp.setLocationFilter(id, 'warehouse', companyId: _companyId()),
                  ),
                ),
              ],
            ),
          ),
        ];
      case 'shop':
        return [
          _buildFilterBoxContainer(
            rp: rp,
            dropdownRow: Row(
              children: [
                _buildDropdownCard(
                  label: rp.locationId != null ? _locationName(rp.locationId, 'shop') : context.tr('branch'),
                  active: rp.locationId != null,
                  onTap: () => _showSelectionSheet(
                    title: context.tr('select_shop'),
                    selectedId: rp.locationId,
                    options: context.read<BranchProvider>().shops
                        .map((s) => {'id': s.id, 'name': s.name, 'subtitle': context.tr('shop')}).toList(),
                    onSelect: (id) => rp.setLocationFilter(id, 'shop', companyId: _companyId()),
                  ),
                ),
              ],
            ),
          ),
        ];
      case 'sales':
      default:
        return [
          _buildFilterBoxContainer(
            rp: rp,
            dropdownRow: Row(
              children: [
                _buildDropdownCard(
                  label: rp.sellerId != null ? _sellerName(rp.sellerId) : context.tr('seller'),
                  active: rp.sellerId != null,
                  onTap: () => _showSelectionSheet(
                    title: context.tr('select_seller'),
                    selectedId: rp.sellerId,
                    options: context.read<StaffProvider>().employees
                        .where((e) => e.userId != null)
                        .map((e) => {'id': e.userId!, 'name': e.name, 'subtitle': e.jobTitle ?? e.role ?? ''}).toList(),
                    onSelect: (id) => rp.setSellerFilter(id, companyId: _companyId()),
                  ),
                ),
                const SizedBox(width: 8),
                _buildDropdownCard(
                  label: rp.locationId != null ? _locationName(rp.locationId, rp.locationType) : context.tr('branch'),
                  active: rp.locationId != null,
                  onTap: () => _showSelectionSheet(
                    title: context.tr('select_shop_warehouse'),
                    selectedId: rp.locationId,
                    options: [
                      ...context.read<BranchProvider>().shops
                          .map((s) => {'id': s.id, 'name': s.name, 'subtitle': context.tr('shop')}),
                      ...context.read<BranchProvider>().warehouses
                          .map((w) => {'id': w.id, 'name': w.name, 'subtitle': context.tr('warehouse')}),
                    ],
                    onSelect: (id) {
                      final bp = context.read<BranchProvider>();
                      final shop = bp.shops.where((s) => s.id == id).firstOrNull;
                      final wh = bp.warehouses.where((w) => w.id == id).firstOrNull;
                      final type = shop != null ? 'shop' : wh != null ? 'warehouse' : null;
                      rp.setLocationFilter(id, type, companyId: _companyId());
                    },
                  ),
                ),
                const SizedBox(width: 8),
                _buildDropdownCard(
                  label: rp.customerId != null ? _customerName(rp.customerId) : context.tr('customer'),
                  active: rp.customerId != null,
                  onTap: () => _showSelectionSheet(
                    title: context.tr('select_customer'),
                    selectedId: rp.customerId,
                    options: _customers.map((c) => {'id': c.id, 'name': c.name, 'subtitle': c.displayPhone}).toList(),
                    onSelect: (id) => rp.setCustomerFilter(id, companyId: _companyId()),
                  ),
                ),
              ],
            ),
          ),
        ];
    }
  }

  Widget _buildRadioOption(String key, String label) {
    final isSelected = _taxFilter == key;
    return InkWell(
      onTap: () => setState(() => _taxFilter = key),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
            size: 18,
            color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF64748B),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 13,
              color: isSelected ? const Color(0xFF0F172A) : const Color(0xFF475569),
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterBoxContainer({
    required ReportProvider rp,
    required Widget dropdownRow,
    Widget? extraOptions,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                context.tr('filter_by'),
                style: GoogleFonts.outfit(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: const Color(0xFF64748B),
                ),
              ),
              InkWell(
                onTap: () {
                  rp.clearFilters(companyId: _companyId());
                  setState(() => _taxFilter = 'all');
                },
                child: Row(
                  children: [
                    Text(
                      context.tr('reset'),
                      style: GoogleFonts.outfit(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: const Color(0xFF475569),
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.refresh, size: 16, color: Color(0xFF475569)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          dropdownRow,
          if (extraOptions != null) ...[
            const SizedBox(height: 12),
            extraOptions,
          ],
        ],
      ),
    );
  }

  Widget _buildDropdownCard({
    required String label,
    required bool active,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: active ? _kBlue : const Color(0xFFE2E8F0)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Flexible(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: active ? _kBlue : const Color(0xFF0F172A),
                  ),
                ),
              ),
              const SizedBox(width: 2),
              Icon(Icons.keyboard_arrow_down, size: 18, color: active ? _kBlue : const Color(0xFF64748B)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActiveFilterChips(ReportProvider rp) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        if (rp.productId != null)
          _FilterChipWidget(
            label: '${context.tr('product')}: ${_productName(rp.productId)}',
            onRemove: () => rp.setProductFilter(null, companyId: _companyId()),
          ),
        if (rp.customerId != null)
          _FilterChipWidget(
            label: '${context.tr('customer')}: ${_customerName(rp.customerId)}',
            onRemove: () => rp.setCustomerFilter(null, companyId: _companyId()),
          ),
        if (rp.sellerId != null)
          _FilterChipWidget(
            label: '${context.tr('seller')}: ${_sellerName(rp.sellerId)}',
            onRemove: () => rp.setSellerFilter(null, companyId: _companyId()),
          ),
        if (rp.locationId != null)
          _FilterChipWidget(
            label: '${context.tr(rp.locationType == 'warehouse' ? 'warehouse' : 'shop')}: ${_locationName(rp.locationId, rp.locationType)}',
            onRemove: () => rp.setLocationFilter(null, null, companyId: _companyId()),
          ),
      ],
    );
  }

  List<Map<String, dynamic>> _locationRows(Map<String, dynamic>? analytics, {required bool warehouse}) {
    final list = _listOf(analytics, 'byLocation');
    if (list.isEmpty) return [];
    final filtered = list.where((r) {
      final type = (r['type'] ?? '').toString().toLowerCase();
      if (type.isEmpty) return true;
      return warehouse ? type == 'warehouse' : type != 'warehouse';
    }).toList();
    return filtered.isNotEmpty ? filtered : list;
  }

  List<Map<String, dynamic>> _salesForLocationType(Map<String, dynamic>? analytics, {required bool warehouse}) {
    return _listOf(analytics, 'sales').where((s) {
      final wh = (s['warehouseName'] ?? '').toString();
      final shop = (s['shopName'] ?? '').toString();
      return warehouse ? wh.isNotEmpty : shop.isNotEmpty;
    }).toList();
  }

  List<Widget> _buildReportExtras(ReportProvider rp) {
    if (rp.period == 'all' || _reportType == 'sales') {
      return [];
    }
    final analytics = rp.analytics;
    if (analytics == null) return [];

    switch (_reportType) {
      case 'sales':
        return [
          const SizedBox(height: 8),
          _buildBreakdownSection(
            title: context.tr('top_products'),
            icon: Icons.inventory_2_outlined,
            rows: _listOf(analytics, 'byProduct').map((r) => (
              id: (r['productId'] ?? '').toString(),
              name: (r['productName'] ?? context.tr('unknown')).toString(),
              subtitle: context.tr('sold_count').replaceAll('{count}', _toInt(r['quantity']).toString()),
              amount: _toDouble(r['revenue']),
            )).toList(),
            onTap: (id) => rp.setProductFilter(id, companyId: _companyId()),
            highlightId: rp.productId,
          ),
          const SizedBox(height: 16),
          _buildBreakdownSection(
            title: context.tr('top_customers'),
            icon: Icons.people_outline,
            rows: _listOf(analytics, 'byCustomer').map((r) => (
              id: (r['customerId'] ?? '').toString(),
              name: (r['customerName'] ?? context.tr('unknown')).toString(),
              subtitle: context.tr('invoice_count').replaceAll('{count}', _toInt(r['invoiceCount']).toString()),
              amount: _toDouble(r['totalSpent']),
            )).toList(),
            onTap: (id) => rp.setCustomerFilter(id, companyId: _companyId()),
            highlightId: rp.customerId,
          ),
          const SizedBox(height: 16),
          _buildBreakdownSection(
            title: context.tr('sales_by_location'),
            icon: Icons.store_outlined,
            rows: _listOf(analytics, 'byLocation').map((r) => (
              id: (r['id'] ?? '').toString(),
              name: (r['name'] ?? context.tr('unknown')).toString(),
              subtitle: '${r['type'] == 'warehouse' ? context.tr('warehouse') : context.tr('shop')} · ${context.tr('invoice_count').replaceAll('{count}', _toInt(r['invoiceCount']).toString())}',
              amount: _toDouble(r['revenue']),
            )).toList(),
            onTap: (id) {
              final row = _listOf(analytics, 'byLocation').where((r) => (r['id'] ?? '').toString() == id).firstOrNull;
              rp.setLocationFilter(id, (row?['type'] ?? 'shop').toString(), companyId: _companyId());
            },
            highlightId: rp.locationId,
          ),
          const SizedBox(height: 16),
          _buildBreakdownSection(
            title: context.tr('sales_by_seller'),
            icon: Icons.person_outline,
            rows: _listOf(analytics, 'bySeller').map((r) => (
              id: (r['sellerId'] ?? '').toString(),
              name: (r['sellerName'] ?? context.tr('unknown')).toString(),
              subtitle: context.tr('invoice_count').replaceAll('{count}', _toInt(r['invoiceCount']).toString()),
              amount: _toDouble(r['revenue']),
            )).toList(),
            onTap: (id) => rp.setSellerFilter(id, companyId: _companyId()),
            highlightId: rp.sellerId,
          ),
          const SizedBox(height: 16),
          ..._buildSalesListSection(analytics, title: context.tr('sales'), sales: _filteredSales(analytics)),
        ];
      case 'credit':
        return [
          const SizedBox(height: 8),
          _SectionLabel('${context.tr('credit_sales')} (${_filteredSales(analytics).length})'),
          const SizedBox(height: 8),
          if (_filteredSales(analytics).isEmpty)
            _EmptyBox(message: context.tr('no_credit_sales'))
          else
            ..._filteredSales(analytics).map((json) {
              final sale = SaleModel.fromJson(json);
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _CreditReportSaleCard(sale: sale, onTap: () => _openSaleDetail(sale)),
              );
            }),
        ];
      case 'warehouse':
        return [
          const SizedBox(height: 8),
          ..._buildSalesListSection(
            analytics,
            title: context.tr('warehouse_sales'),
            sales: _salesForLocationType(analytics, warehouse: true),
            emptyMessage: context.tr('no_warehouse_sales'),
          ),
        ];
      case 'shop':
        return [
          const SizedBox(height: 8),
          ..._buildSalesListSection(
            analytics,
            title: context.tr('shop_sales'),
            sales: _salesForLocationType(analytics, warehouse: false),
            emptyMessage: context.tr('no_shop_sales'),
          ),
        ];
      default:
        return [];
    }
  }

  List<Widget> _buildSalesListSection(
    Map<String, dynamic>? analytics, {
    required String title,
    List<Map<String, dynamic>>? sales,
    String? emptyMessage,
  }) {
    final list = sales ?? _listOf(analytics, 'sales');
    return [
      _SectionLabel('$title (${list.length})'),
      const SizedBox(height: 8),
      if (list.isEmpty)
        _EmptyBox(message: emptyMessage ?? context.tr('no_sales_for_filters'))
      else
        ...list.map((json) {
          final sale = SaleModel.fromJson(json);
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _reportType == 'credit'
                ? _CreditReportSaleCard(sale: sale, onTap: () => _openSaleDetail(sale))
                : _SaleCard(sale: sale, onTap: () => _openSaleDetail(sale)),
          );
        }),
    ];
  }

  Widget _buildCreditOverview(ReportProvider rp) {
    final filteredCreditSales = _filteredSales(rp.analytics);
    final outstandingCreditSales = filteredCreditSales.where(_isOutstandingCredit).toList();
    final settledCreditSales = filteredCreditSales.where(_isSaleSettled).toList();
    final totalCredit = outstandingCreditSales.fold<double>(0, (sum, s) => sum + _saleRemaining(s));
    final totalCollected = filteredCreditSales.fold<double>(0, (sum, s) => sum + _toDouble(s['amountPaid'] ?? (_toDouble(s['totalAmount']) - _saleRemaining(s))));

    return Column(
      children: [
        // Credit Sales Card matching Screenshot 4
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Row(
                  children: [
                    const Icon(Icons.receipt_long_outlined, color: Color(0xFF4F46E5), size: 20),
                    const SizedBox(width: 10),
                    Text(
                      context.tr('credit_sales'),
                      style: GoogleFonts.outfit(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEEF2FF),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '${filteredCreditSales.length}',
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF4F46E5),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: Color(0xFFE2E8F0)),
              Padding(
                padding: const EdgeInsets.all(28),
                child: Center(
                  child: Text(
                    filteredCreditSales.isEmpty
                        ? context.tr('no_credit_sales_period')
                        : '${filteredCreditSales.length} ${context.tr('credit_sales')}',
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      color: const Color(0xFF64748B),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        // Collected Payments Card matching Screenshot 4
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Row(
                  children: [
                    const Icon(Icons.payments_outlined, color: Color(0xFF16A34A), size: 20),
                    const SizedBox(width: 10),
                    Text(
                      context.tr('collected_payments'),
                      style: GoogleFonts.outfit(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '${settledCreditSales.length}',
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF16A34A),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: Color(0xFFE2E8F0)),
              Padding(
                padding: const EdgeInsets.all(28),
                child: Center(
                  child: Text(
                    settledCreditSales.isEmpty
                        ? context.tr('no_payments_collected')
                        : '${settledCreditSales.length} ${context.tr('collected_payments')} · ETB ${NumberFormat('#,##0.00').format(totalCollected)}',
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      color: const Color(0xFF64748B),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        // Bottom Summary Cards matching Screenshot 4
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.tr('total_credit_given'),
                      style: GoogleFonts.outfit(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      totalCredit == 0 ? '0' : NumberFormat('#,##0.00').format(totalCredit),
                      style: GoogleFonts.outfit(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF4F46E5),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.tr('total_collected_amount'),
                      style: GoogleFonts.outfit(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      totalCollected == 0 ? '0' : NumberFormat('#,##0.00').format(totalCollected),
                      style: GoogleFonts.outfit(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF16A34A),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildCreditByCustomer(Map<String, dynamic>? analytics) {
    final rows = _listOf(analytics, 'byCustomer')
        .where((r) => _toDouble(r['outstanding']) > 0)
        .toList()
      ..sort((a, b) => _toDouble(b['outstanding']).compareTo(_toDouble(a['outstanding'])));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 16),
        _SectionLabel(context.tr('customers_with_credit').toUpperCase()),
        const SizedBox(height: 8),
        if (rows.isEmpty)
          _EmptyBox(message: context.tr('no_credit_sales'))
        else
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _kBorder),
            ),
            child: Column(
              children: rows.asMap().entries.map((entry) {
                final r = entry.value;
                final outstanding = _toDouble(r['outstanding']);
                final spent = _toDouble(r['totalSpent']);
                final pct = spent > 0 ? (outstanding / spent).clamp(0.0, 1.0) : 0.0;
                return Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  (r['customerName'] ?? context.tr('unknown')).toString(),
                                  style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  context.tr('invoice_count').replaceAll('{count}', _toInt(r['invoiceCount']).toString()),
                                  style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                                ),
                                const SizedBox(height: 6),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(4),
                                  child: LinearProgressIndicator(
                                    value: pct,
                                    minHeight: 5,
                                    backgroundColor: _kBorder,
                                    color: _kAmber,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                'ETB ${outstanding.toStringAsFixed(0)}',
                                style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: _kRed),
                              ),
                              Text(
                                context.tr('remaining_balance'),
                                style: GoogleFonts.outfit(fontSize: 10, color: _kSlate),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    if (entry.key < rows.length - 1) const Divider(height: 1, indent: 14, endIndent: 14),
                  ],
                );
              }).toList(),
            ),
          ),
      ],
    );
  }

  Widget _buildLocationBreakdownWithBars({
    required String title,
    required IconData icon,
    required List<Map<String, dynamic>> rows,
    required void Function(String id) onTap,
    String? highlightId,
  }) {
    final maxRevenue = rows.isEmpty ? 0.0 : rows.map((r) => _toDouble(r['revenue'])).reduce(max);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: _kBlue, size: 18),
              const SizedBox(width: 8),
              Text(title, style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: _kInk)),
            ],
          ),
          const SizedBox(height: 12),
          if (rows.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(context.tr('no_data_available'), style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
            )
          else
            ...rows.map((r) {
              final id = (r['id'] ?? '').toString();
              final revenue = _toDouble(r['revenue']);
              final pct = maxRevenue > 0 ? revenue / maxRevenue : 0.0;
              final isHighlight = id.isNotEmpty && id == highlightId;
              return InkWell(
                onTap: () => onTap(id),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(10),
                  decoration: isHighlight
                      ? BoxDecoration(color: _kBlue.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(8))
                      : null,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              (r['name'] ?? context.tr('unknown')).toString(),
                              style: GoogleFonts.outfit(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: isHighlight ? _kBlue : _kInk,
                              ),
                            ),
                          ),
                          Text(
                            'ETB ${revenue.toStringAsFixed(0)}',
                            style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: _kInk),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        context.tr('invoice_count').replaceAll('{count}', _toInt(r['invoiceCount']).toString()),
                        style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: pct,
                          minHeight: 6,
                          backgroundColor: _kBorder,
                          color: _kBlue,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildLocationReportTable(Map<String, dynamic>? analytics, {bool isWarehouse = true}) {
    final rawRows = _locationRows(analytics, warehouse: isWarehouse);
    final bp = context.read<BranchProvider>();
    final locations = isWarehouse ? bp.warehouses : bp.shops;
    final rp = context.read<ReportProvider>();
    final allSales = _listOf(analytics, 'sales');

    final List<Map<String, dynamic>> rows = [];
    final Set<String> processedLocIds = {};

    if (rawRows.isNotEmpty) {
      for (final r in rawRows) {
        final locId = (r['id'] ?? '').toString();
        final branchName = (r['name'] ?? r['branch'] ?? context.tr('unknown')).toString();
        processedLocIds.add(locId);
        processedLocIds.add(branchName.toLowerCase());

        double salesVal = _toDouble(r['sales'] ?? r['revenue'] ?? r['totalAmount'] ?? r['quantity']);
        int salesCountVal = _toInt(r['salesCount'] ?? r['invoiceCount'] ?? r['count']);

        final matchingSales = allSales.where((s) => _isSaleForLocation(s, locId, branchName)).toList();
        final calcRevenue = matchingSales.fold<double>(0.0, (sum, item) => sum + _toDouble(item['totalAmount'] ?? item['revenue']));
        final calcCount = matchingSales.length;

        if (salesVal == 0 && calcRevenue > 0) {
          salesVal = calcRevenue;
        }
        if (salesCountVal == 0 && calcCount > 0) {
          salesCountVal = calcCount;
        }

        String itemNameVal = (r['itemName'] ?? r['productName'] ?? r['item'] ?? '').toString();
        if (itemNameVal.isEmpty && rp.productId != null) {
          itemNameVal = _productName(rp.productId);
        }
        if (itemNameVal.isEmpty) {
          itemNameVal = 'All Items';
        }

        double stockVal = _toDouble(r['stock'] ?? r['stockQuantity'] ?? r['unitsInStock'] ?? r['unitsStored']);
        if (stockVal == 0) {
          final matchedLoc = locations.where((dynamic l) {
            final lId = (l.id ?? '').toString();
            final lName = (l.name ?? '').toString().toLowerCase();
            return lId == locId || lName == branchName.toLowerCase();
          }).firstOrNull;
          if (matchedLoc != null) {
            final locStock = _toDouble((matchedLoc as dynamic).unitsInStock);
            final locStored = _toDouble((matchedLoc as dynamic).unitsStored);
            stockVal = locStock > 0 ? locStock : locStored;
          }
        }
        if (stockVal == 0) {
          stockVal = context.read<ProductProvider>().products.fold<double>(0.0, (s, p) => s + p.stockQuantity.toDouble());
        }

        rows.add({
          'id': locId,
          'itemName': itemNameVal,
          'sales': salesVal,
          'salesCount': salesCountVal,
          'stock': stockVal,
          'branch': branchName,
        });
      }
    }

    if (locations.isNotEmpty) {
      for (final dynamic loc in locations) {
        final locId = (loc.id ?? '').toString();
        final locName = (loc.name ?? '').toString();
        if (processedLocIds.contains(locId) || processedLocIds.contains(locName.toLowerCase())) {
          continue;
        }
        processedLocIds.add(locId);
        processedLocIds.add(locName.toLowerCase());

        final matchingSales = allSales.where((s) => _isSaleForLocation(s, locId, locName)).toList();
        final calcRevenue = matchingSales.fold<double>(0.0, (sum, item) => sum + _toDouble(item['totalAmount'] ?? item['revenue']));
        final calcCount = matchingSales.length;

        double stockVal = _toDouble(loc.unitsInStock > 0 ? loc.unitsInStock : loc.unitsStored);
        if (stockVal == 0) {
          stockVal = context.read<ProductProvider>().products.fold<double>(0.0, (s, p) => s + p.stockQuantity.toDouble());
        }
        String itemNameVal = rp.productId != null ? _productName(rp.productId) : 'All Items';

        rows.add({
          'id': locId,
          'itemName': itemNameVal,
          'sales': calcRevenue,
          'salesCount': calcCount,
          'stock': stockVal,
          'branch': locName,
        });
      }
    }

    final selectedLocId = rp.locationId;

    if (selectedLocId != null && selectedLocId.isNotEmpty) {
      final selectedLocName = _locationName(selectedLocId, rp.locationType ?? (isWarehouse ? 'warehouse' : 'shop'));
      rows.retainWhere((r) {
        final rId = (r['id'] ?? '').toString();
        final rName = (r['branch'] ?? '').toString().toLowerCase();
        return rId == selectedLocId || rName == selectedLocName.toLowerCase();
      });
      if (rows.isEmpty) {
        final matchingSales = allSales.where((s) => _isSaleForLocation(s, selectedLocId, selectedLocName)).toList();
        final locRevenue = matchingSales.fold<double>(0.0, (sum, item) => sum + _toDouble(item['totalAmount'] ?? item['revenue']));

        final matchedLoc = locations.where((dynamic l) => (l.id ?? '').toString() == selectedLocId || (l.name ?? '').toString().toLowerCase() == selectedLocName.toLowerCase()).firstOrNull;
        double locStock = matchedLoc != null ? _toDouble((matchedLoc as dynamic).unitsInStock > 0 ? (matchedLoc as dynamic).unitsInStock : (matchedLoc as dynamic).unitsStored) : 0.0;
        if (locStock == 0) {
          locStock = context.read<ProductProvider>().products.fold<double>(0.0, (s, p) => s + p.stockQuantity.toDouble());
        }

        String itemNameVal = rp.productId != null ? _productName(rp.productId) : 'All Items';
        rows.add({
          'id': selectedLocId,
          'itemName': itemNameVal,
          'sales': locRevenue,
          'salesCount': matchingSales.length,
          'stock': locStock,
          'branch': selectedLocName,
        });
      }
    }

    final displaySell = rows.fold<double>(0.0, (s, r) => s + _toDouble(r['sales']));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: SizedBox(
                  width: max(560.0, MediaQuery.of(context).size.width - 32),
                  child: Column(
                    children: [
                      // Header
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        child: Row(
                          children: [
                            Expanded(
                              flex: 3,
                              child: Text(
                                'Item Name',
                                style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: const Color(0xFF0F172A),
                                ),
                              ),
                            ),
                            Expanded(
                              flex: 2,
                              child: Text(
                                context.tr('sales'),
                                textAlign: TextAlign.center,
                                style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: const Color(0xFF0F172A),
                                ),
                              ),
                            ),
                            Expanded(
                              flex: 2,
                              child: Text(
                                'Sales Count',
                                textAlign: TextAlign.center,
                                style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: const Color(0xFF0F172A),
                                ),
                              ),
                            ),
                            Expanded(
                              flex: 2,
                              child: Text(
                                isWarehouse ? context.tr('warehouse') : context.tr('store'),
                                textAlign: TextAlign.center,
                                style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: const Color(0xFF0F172A),
                                ),
                              ),
                            ),
                            Expanded(
                              flex: 3,
                              child: Text(
                                context.tr('branch'),
                                textAlign: TextAlign.end,
                                style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: const Color(0xFF0F172A),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Divider(height: 1, color: Color(0xFFE2E8F0)),
                      if (rows.isEmpty)
                        Container(
                          height: 60,
                          alignment: Alignment.center,
                          child: Text(
                            context.tr('no_data_available'),
                            style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF94A3B8)),
                          ),
                        )
                      else
                        ...rows.map((row) {
                          final stockVal = _toDouble(row['stock']);
                          final isZero = stockVal == 0;
                          return Column(
                            children: [
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                child: Row(
                                  children: [
                                    Expanded(
                                      flex: 3,
                                      child: Text(
                                        (row['itemName'] ?? 'All Items').toString(),
                                        overflow: TextOverflow.ellipsis,
                                        style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF0F172A)),
                                      ),
                                    ),
                                    Expanded(
                                      flex: 2,
                                      child: Text(
                                        _toDouble(row['sales']).toStringAsFixed(1),
                                        textAlign: TextAlign.center,
                                        style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF0F172A)),
                                      ),
                                    ),
                                    Expanded(
                                      flex: 2,
                                      child: Text(
                                        _toInt(row['salesCount']).toString(),
                                        textAlign: TextAlign.center,
                                        style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF0F172A)),
                                      ),
                                    ),
                                    Expanded(
                                      flex: 2,
                                      child: Text(
                                        stockVal.toStringAsFixed(1),
                                        textAlign: TextAlign.center,
                                        style: GoogleFonts.outfit(
                                          fontSize: 12,
                                          fontWeight: isZero ? FontWeight.w500 : FontWeight.normal,
                                          color: isZero ? const Color(0xFFDC2626) : const Color(0xFF0F172A),
                                        ),
                                      ),
                                    ),
                                    Expanded(
                                      flex: 3,
                                      child: Text(
                                        row['branch'].toString(),
                                        textAlign: TextAlign.end,
                                        overflow: TextOverflow.ellipsis,
                                        style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF0F172A)),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Divider(height: 1, color: Color(0xFFE2E8F0)),
                            ],
                          );
                        }),
                    ],
                  ),
                ),
              ),
              // Pagination bar at bottom matching Screenshot
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      rows.isEmpty ? '1-0 of 0' : '1-${rows.length} of ${rows.length}',
                      style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF64748B)),
                    ),
                    const SizedBox(width: 16),
                    const Icon(Icons.chevron_left, size: 20, color: Color(0xFFCBD5E1)),
                    const SizedBox(width: 8),
                    const Icon(Icons.chevron_right, size: 20, color: Color(0xFFCBD5E1)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        // Total Sell Amount matching Screenshot
        Text(
          'Sell: ${_formatAmount(displaySell)}',
          style: GoogleFonts.outfit(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: const Color(0xFF025EA7),
          ),
        ),
      ],
    );
  }

  Widget _buildTopProductsRanked(Map<String, dynamic>? analytics) {
    final products = _listOf(analytics, 'byProduct');
    if (products.isEmpty) {
      return _EmptyBox(message: context.tr('no_data_available'));
    }
    final maxQty = products.map((r) => _toInt(r['quantity'])).reduce(max).toDouble();

    Color rankColor(int rank) {
      if (rank == 1) return const Color(0xFFD97706);
      if (rank == 2) return const Color(0xFF94A3B8);
      if (rank == 3) return const Color(0xFFB45309);
      return _kBlue;
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        children: products.asMap().entries.map((entry) {
          final rank = entry.key + 1;
          final r = entry.value;
          final qty = _toInt(r['quantity']);
          final pct = maxQty > 0 ? qty / maxQty : 0.0;
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: rankColor(rank).withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '#$rank',
                        style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: rankColor(rank)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            (r['productName'] ?? context.tr('unknown')).toString(),
                            style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk),
                          ),
                          const SizedBox(height: 6),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: pct,
                              minHeight: 6,
                              backgroundColor: _kBorder,
                              color: rankColor(rank),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            context.tr('sold_count').replaceAll('{count}', '$qty'),
                            style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'ETB ${_toDouble(r['revenue']).toStringAsFixed(0)}',
                      style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: _kInk),
                    ),
                  ],
                ),
              ),
              if (entry.key < products.length - 1) const Divider(height: 1, indent: 58, endIndent: 14),
            ],
          );
        }).toList(),
      ),
    );
  }

  Widget _buildProductInventoryList() {
    final rawProducts = context.read<ProductProvider>().products.toList()
      ..sort((a, b) => b.stockQuantity.compareTo(a.stockQuantity));

    final products = _stockSearchQuery.isEmpty
        ? rawProducts
        : rawProducts.where((p) =>
            p.name.toLowerCase().contains(_stockSearchQuery) ||
            p.sku.toLowerCase().contains(_stockSearchQuery)).toList();

    if (products.isEmpty) {
      return _EmptyBox(message: context.tr('no_products_found'));
    }

    return Column(
      children: products.map((p) {
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Logo/image square matching Screenshot 1 ("እላቄ")
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0).withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: Text(
                  'እላቄ',
                  style: GoogleFonts.outfit(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: Colors.white.withValues(alpha: 0.8),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p.name,
                      style: GoogleFonts.outfit(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'P.N: ${p.sku}',
                      style: GoogleFonts.outfit(
                        fontSize: 12,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Price: ${NumberFormat('#,##0.00').format(p.price)}',
                      style: GoogleFonts.outfit(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFFC2410C), // Reddish brown color from Screenshot 1
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                'Quantity: ${p.stockQuantity.toDouble()}',
                style: GoogleFonts.outfit(
                  fontSize: 13,
                  color: const Color(0xFF64748B),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildPdfBottomBar() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: _kBorder.withValues(alpha: 0.8))),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _exporting ? null : () => _downloadPdfDirectly(context.read<ReportProvider>()),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kBlue,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: _exporting
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.picture_as_pdf_rounded, size: 20),
                  label: Text(
                    context.tr('download_pdf'),
                    style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _exporting ? null : () => _sharePdfDirectly(context.read<ReportProvider>()),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _kInk,
                    side: const BorderSide(color: _kBorder, width: 1.5),
                    backgroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: const Icon(Icons.share_rounded, size: 20, color: _kBlue),
                  label: Text(
                    context.tr('share_report'),
                    style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget>? _buildAppBarActions() {
    if (_showHub) return null;
    final isGrandReport = context.read<ReportProvider>().period == 'all';
    switch (_reportType) {
      case 'credit':
      case 'stock_report':
      case 'stock_in':
      case 'stock_out':
        if (!isGrandReport) return null;
        return [
          IconButton(
            icon: _exporting
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: _kBlue))
                : const Icon(Icons.picture_as_pdf_outlined, color: _kInk, size: 22),
            onPressed: _exporting ? null : () => _showExportSheet(context.read<ReportProvider>()),
          ),
          IconButton(
            icon: const Icon(Icons.table_chart_outlined, color: _kInk, size: 22),
            onPressed: () => _showExportSheet(context.read<ReportProvider>()),
          ),
        ];
      case 'sales':
      case 'commission':
        return [
          if (_reportType == 'sales')
            IconButton(
              icon: const Icon(Icons.file_upload_outlined, color: _kInk, size: 22),
              tooltip: context.tr('import_csv_pdf'),
              onPressed: _openSalesImportDialog,
            ),
          IconButton(
            icon: _exporting
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: _kBlue))
                : const Icon(Icons.picture_as_pdf_outlined, color: _kInk, size: 22),
            tooltip: 'PDF',
            onPressed: _exporting ? null : () => _downloadPdfDirectly(context.read<ReportProvider>()),
          ),
          IconButton(
            icon: const Icon(Icons.table_chart_outlined, color: _kInk, size: 22),
            tooltip: context.tr('export_report'),
            onPressed: () => _showExportSheet(context.read<ReportProvider>()),
          ),
        ];
      default:
        return null;
    }
  }

  PreferredSizeWidget _buildAppBar() {
    final rp = context.watch<ReportProvider>();
    final isGrandReport = !_showHub && rp.period == 'all' && (_reportType == 'sales' || _reportType == 'warehouse' || _reportType == 'shop');

    if (!_showHub && _reportType == 'stock') {
      return AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 20),
          onPressed: _backFromDetail,
        ),
        title: SizedBox(
          height: 40,
          child: TextField(
            onChanged: (v) => setState(() => _stockSearchQuery = v.toLowerCase()),
            style: GoogleFonts.outfit(fontSize: 14, color: _kInk),
            decoration: InputDecoration(
              hintText: '${context.tr('search')}...',
              hintStyle: GoogleFonts.outfit(fontSize: 14, color: const Color(0xFF94A3B8)),
              filled: true,
              fillColor: _kBg,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
            ),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner_outlined, color: _kInk, size: 22),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.filter_list, color: _kInk, size: 22),
            onPressed: () {},
          ),
        ],
      );
    }
    return AppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 20),
        onPressed: _backFromDetail,
      ),
      title: Text(
        context.tr(_showHub ? 'report' : (isGrandReport ? 'grand_report' : _reportTitleKey())),
        style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w600, color: _kInk),
      ),
      actions: _buildAppBarActions(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<ReportProvider>(
      builder: (context, rp, _) {
        final isGrandReport = !_showHub && rp.period == 'all' && (_reportType == 'sales' || _reportType == 'warehouse' || _reportType == 'shop');
        final isBusinessReport = !_showHub && _reportType == 'sales';
        final isCommissionReport = !_showHub && _reportType == 'commission';
        return Scaffold(
          backgroundColor: _kBg,
          appBar: _buildAppBar(),
          body: (rp.isLoading && rp.analytics == null && _reportType != 'commission')
              ? const Center(child: CircularProgressIndicator())
              : (_showHub ? _buildHub(rp) : _buildDetailBody(rp)),
          bottomNavigationBar: (isGrandReport || isBusinessReport || isCommissionReport) ? _buildPdfBottomBar() : null,
        );
      },
    );
  }

  String _reportTitleKey() {
    switch (_reportType) {
      case 'total_profit':
      case 'profit':
        return 'total_profit_report';
      case 'warehouse':
        return 'warehouse_report';
      case 'shop':
        return 'shop_report';
      case 'credit':
        return 'credit_report';
      case 'stock':
        return 'product_report';
      case 'stock_report':
      case 'stock_in':
      case 'stock_out':
        return 'stock_report';
      case 'sales':
        return 'business_report';
      case 'top_products':
        return 'top_products';
      case 'commission':
        return 'commission_report';
      default:
        return 'reports';
    }
  }

  List<Widget> _buildCategorySections(ReportProvider rp) {
    final analytics = rp.analytics;

    if (analytics == null && !{'stock', 'stock_report', 'stock_in', 'stock_out', 'commission'}.contains(_reportType)) return [];

    switch (_reportType) {
      case 'total_profit':
      case 'profit':
        return [
          _buildTotalProfitsReport(analytics, rp),
          const SizedBox(height: 20),
          const _SectionLabel('PRODUCT PROFITABILITY BREAKDOWN'),
          const SizedBox(height: 10),
          _buildProfitDataTable(analytics),
        ];
      case 'stock':
        final products = context.read<ProductProvider>().products;
        final tracked = products.where((p) => p.trackStock).length;
        final totalQty = products.fold<int>(0, (s, p) => s + p.stockQuantity);
        final inventoryValue = products.fold<double>(0, (s, p) => s + (p.cost > 0 ? p.cost : p.price) * p.stockQuantity);
        return [
          _infoCards([
            (context.tr('products'), '${products.length}'),
            (context.tr('tracked_stock'), '$tracked'),
            (context.tr('total_quantity'), '$totalQty'),
            (context.tr('inventory_value'), 'ETB ${_formatAmount(inventoryValue)}'),
          ]),
          const SizedBox(height: 14),
          _buildTableToolbar(),
          const SizedBox(height: 14),
          _buildInventoryDataTable(),
          if (_lowStock.isNotEmpty) ...[
            const SizedBox(height: 16),
            _lowStockList(),
          ],
        ];
      case 'stock_report':
      case 'stock_in':
      case 'stock_out':
        final totalQtyIn = _stockInTx.fold<int>(0, (s, t) => s + _toInt(t['quantity']));
        final totalQtyOut = _stockOutTx.fold<int>(0, (s, t) => s + _toInt(t['quantity']));
        final totalQtyTransfer = _transferTx.fold<int>(0, (s, t) => s + _toInt(t['quantity']));
        final combined = _combinedStockTx();
        return [
          _infoCards([
            ('${context.tr('stock_in')} (+)', '+$totalQtyIn (${_stockInTx.length})'),
            ('${context.tr('stock_out')} (-)', '-$totalQtyOut (${_stockOutTx.length})'),
            ('${context.tr('transfers')} (⇄)', '⇄$totalQtyTransfer (${_transferTx.length})'),
            (context.tr('total'), '${_stockInTx.length + _stockOutTx.length + _transferTx.length}'),
          ]),
          const SizedBox(height: 16),
          Row(
            children: [
              _buildStockFilterPill('all', context.tr('all_changes')),
              const SizedBox(width: 6),
              _buildStockFilterPill('stock_in', context.tr('stock_in')),
              const SizedBox(width: 6),
              _buildStockFilterPill('stock_out', context.tr('stock_out')),
              const SizedBox(width: 6),
              _buildStockFilterPill('transfer', context.tr('transfers')),
            ],
          ),
          const SizedBox(height: 16),
          _buildStockMovementsDataTable(combined),
        ];
      case 'commission':
        return [_commissionList(analytics)];
      case 'low_stock':
        return [_lowStockList()];
      case 'warehouse':
        final rowsW = _locationRows(analytics, warehouse: true);
        final totalRevenueW = rowsW.fold<double>(0, (s, r) => s + _toDouble(r['revenue']));
        final totalInvoicesW = rowsW.fold<int>(0, (s, r) => s + _toInt(r['invoiceCount']));
        return [
          _infoCards([
            (context.tr('warehouses'), '${rowsW.length}'),
            (context.tr('revenue'), 'ETB ${totalRevenueW.toStringAsFixed(0)}'),
            (context.tr('sales'), '$totalInvoicesW'),
          ]),
          const SizedBox(height: 16),
          _buildLocationBreakdownWithBars(
            title: context.tr('warehouse_activity'),
            icon: Icons.warehouse_outlined,
            rows: rowsW,
            onTap: (id) => rp.setLocationFilter(id, 'warehouse', companyId: _companyId()),
            highlightId: rp.locationId,
          ),
          const SizedBox(height: 16),
          const _SectionLabel('WAREHOUSE INVENTORY & AUDIT'),
          const SizedBox(height: 10),
          _buildLocationReportTable(analytics, isWarehouse: true),
        ];
      case 'shop':
        final rowsS = _locationRows(analytics, warehouse: false);
        final totalRevenueS = rowsS.fold<double>(0, (s, r) => s + _toDouble(r['revenue']));
        final totalInvoicesS = rowsS.fold<int>(0, (s, r) => s + _toInt(r['invoiceCount']));
        return [
          _infoCards([
            (context.tr('shops'), '${rowsS.length}'),
            (context.tr('revenue'), 'ETB ${totalRevenueS.toStringAsFixed(0)}'),
            (context.tr('sales'), '$totalInvoicesS'),
          ]),
          const SizedBox(height: 16),
          _buildLocationBreakdownWithBars(
            title: context.tr('store_activity'),
            icon: Icons.storefront_outlined,
            rows: rowsS,
            onTap: (id) => rp.setLocationFilter(id, 'shop', companyId: _companyId()),
            highlightId: rp.locationId,
          ),
          const SizedBox(height: 16),
          const _SectionLabel('STORE SALES & INVENTORY AUDIT'),
          const SizedBox(height: 10),
          _buildLocationReportTable(analytics, isWarehouse: false),
        ];
      case 'top_products':
        return [
          _SectionLabel(context.tr('top_products').toUpperCase()),
          const SizedBox(height: 10),
          _buildTopProductsRankedPreview(analytics),
          const SizedBox(height: 16),
          _buildItemSoldTable(analytics),
        ];
      case 'credit':
        return [
          _buildCreditOverview(rp),
          const SizedBox(height: 16),
          _buildTableToolbar(),
          const SizedBox(height: 14),
          const _SectionLabel('CREDIT INVOICES & DEBTORS'),
          const SizedBox(height: 10),
          _buildCreditDataTable(analytics),
          const SizedBox(height: 16),
          _buildCreditByCustomer(analytics),
        ];
      case 'sales':
        return [
          if (_importedSales.isNotEmpty) ...[
            _buildImportedSalesBanner(),
            const SizedBox(height: 16),
          ],
          _buildTableToolbar(),
          const SizedBox(height: 14),
          _buildSalesDataTable(analytics),
          const SizedBox(height: 16),
          _buildPaymentMethodBreakdown(analytics),
          const SizedBox(height: 16),
          _buildItemSoldTable(analytics),
          const SizedBox(height: 16),
          _buildTopProductsRankedPreview(analytics),
          const SizedBox(height: 16),
          _buildLocationReportTable(analytics, isWarehouse: true),
        ];
      case 'payments':
        return [_paymentsSummary(analytics)];
      case 'purchases_report':
        return [_buildPurchasesReport()];
      case 'purchase':
      default:
        return [
          _buildSummary(analytics),
          const SizedBox(height: 16),
          _buildChart(analytics, rp.period),
        ];
    }
  }

  ReportSection _buildPurchasesExportSection() {
    final columns = [
      context.tr('product'),
      context.tr('quantity'),
      'Unit Cost',
      'Total',
      context.tr('date'),
    ];
    final rows = _reportPurchases.map<List<Object?>>((tx) {
      final m = tx is Map<String, dynamic> ? tx : <String, dynamic>{};
      return [
        m['productName'] ?? context.tr('unknown'),
        '${_toInt(m['quantity'])}',
        'ETB ${_formatAmount(_toDouble(m['unitCost']))}',
        'ETB ${_formatAmount(_toDouble(m['totalCost']))}',
        m['createdAt'] != null
            ? DateFormat('MMM dd, yyyy').format(DateTime.tryParse(m['createdAt'].toString()) ?? DateTime.now())
            : '-',
      ];
    }).toList();

    return ReportSection(
      title: context.tr('purchases_report'),
      columns: columns,
      rows: rows,
    );
  }

  Widget _buildPurchasesReport() {
    if (_loadingPurchases) {
      return const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()));
    }

    final totalCost = _toDouble(_reportPurchasesSummary['totalPurchasesCost']);
    final totalUnits = _toInt(_reportPurchasesSummary['totalUnitsPurchased']);
    final txCount = _toInt(_reportPurchasesSummary['transactionCount']);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Summary cards
        _infoCards([
          (context.tr('total_cost'), 'ETB ${_formatAmount(totalCost)}'),
          (context.tr('total_quantity'), _formatQty(totalUnits)),
          (context.tr('transactions'), _formatQty(txCount)),
        ]),
        const SizedBox(height: 16),
        _buildPurchasesDataTable(),
      ],
    );
  }

  Widget _purchaseTag(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _kBg,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: _kBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: _kSlate),
          const SizedBox(width: 4),
          Text(text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
        ],
      ),
    );
  }

  Widget _buildItemSoldTable(Map<String, dynamic>? analytics) {
    final sales = _listOf(analytics, 'sales');
    final List<Map<String, dynamic>> itemsSold = [];
    for (final s in sales) {
      final items = s['items'] as List? ?? [];
      for (final item in items) {
        if (item is Map) {
          itemsSold.add({
            'itemName': item['productName'] ?? item['name'] ?? context.tr('unknown'),
            'customer': s['customerName'] ?? context.tr('walk_in'),
            'totalQty': _toInt(item['quantity'] ?? item['qty']),
          });
        }
      }
    }
    for (final imp in _importedSales) {
      itemsSold.add({
        'itemName': imp.productName,
        'customer': '${imp.customerName} (${imp.source.toUpperCase()})',
        'totalQty': imp.quantity,
      });
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 8),
        Text(
          context.tr('item_sold'),
          style: GoogleFonts.outfit(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: const Color(0xFF0F172A),
          ),
        ),
        const SizedBox(height: 12),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              // Header
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Row(
                  children: [
                    Expanded(
                      flex: 4,
                      child: Text(
                        context.tr('item_name'),
                        style: GoogleFonts.outfit(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                    ),
                    Expanded(
                      flex: 4,
                      child: Text(
                        context.tr('customer'),
                        textAlign: TextAlign.center,
                        style: GoogleFonts.outfit(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                    ),
                    Expanded(
                      flex: 3,
                      child: Text(
                        context.tr('total_qty'),
                        textAlign: TextAlign.end,
                        style: GoogleFonts.outfit(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: Color(0xFFE2E8F0)),
              if (itemsSold.isEmpty)
                Container(
                  height: 60,
                  alignment: Alignment.center,
                  child: Text(
                    context.tr('no_data_available'),
                    style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF94A3B8)),
                  ),
                )
              else
                ...itemsSold.take(10).map((row) {
                  return Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        child: Row(
                          children: [
                            Expanded(
                              flex: 4,
                              child: Text(
                                row['itemName'].toString(),
                                style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF0F172A)),
                              ),
                            ),
                            Expanded(
                              flex: 4,
                              child: Text(
                                row['customer'].toString(),
                                textAlign: TextAlign.center,
                                style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF64748B)),
                              ),
                            ),
                            Expanded(
                              flex: 3,
                              child: Text(
                                row['totalQty'].toString(),
                                textAlign: TextAlign.end,
                                style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: const Color(0xFF0F172A)),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Divider(height: 1, color: Color(0xFFE2E8F0)),
                    ],
                  );
                }),
              // Pagination bar at bottom matching Screenshot 3
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      itemsSold.isEmpty ? '1-0 of 0' : '1-${itemsSold.length > 10 ? 10 : itemsSold.length} of ${itemsSold.length}',
                      style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF64748B)),
                    ),
                    const SizedBox(width: 16),
                    IconButton(
                      icon: const Icon(Icons.chevron_left, size: 20, color: Color(0xFFCBD5E1)),
                      onPressed: null,
                    ),
                    IconButton(
                      icon: const Icon(Icons.chevron_right, size: 20, color: Color(0xFFCBD5E1)),
                      onPressed: null,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  List<Map<String, dynamic>> _combinedStockTx() {
    final list = <Map<String, dynamic>>[];
    for (final t in _stockInTx) {
      list.add({...t, '_txType': 'stock_in'});
    }
    for (final t in _stockOutTx) {
      list.add({...t, '_txType': 'stock_out'});
    }
    for (final t in _transferTx) {
      list.add({...t, '_txType': 'transfer'});
    }
    list.sort((a, b) {
      final da = DateTime.tryParse((a['createdAt'] ?? a['date'] ?? '').toString()) ?? DateTime(1970);
      final db = DateTime.tryParse((b['createdAt'] ?? b['date'] ?? '').toString()) ?? DateTime(1970);
      return db.compareTo(da);
    });
    if (_stockFilterTab == 'stock_in') {
      return list.where((t) => t['_txType'] == 'stock_in').toList();
    } else if (_stockFilterTab == 'stock_out') {
      return list.where((t) => t['_txType'] == 'stock_out').toList();
    } else if (_stockFilterTab == 'transfer') {
      return list.where((t) => t['_txType'] == 'transfer').toList();
    }
    return list;
  }

  Widget _buildStockFilterPill(String key, String label) {
    final isSelected = _stockFilterTab == key;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _stockFilterTab = key),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? _kBlue : Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: isSelected ? _kBlue : _kBorder),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(
              fontSize: 12.0,
              fontWeight: FontWeight.w600,
              color: isSelected ? Colors.white : _kSlate,
            ),
          ),
        ),
      ),
    );
  }

  Widget _stockCombinedTransactionList(List<Map<String, dynamic>> txs) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionLabel('${context.tr('stock_in_out_changes')} (${txs.length})'),
        const SizedBox(height: 8),
        if (txs.isEmpty)
          _EmptyBox(message: context.tr('no_results_found'))
        else
          ...txs.take(50).map((t) {
            final txType = (t['_txType'] ?? t['type'] ?? '').toString();
            final isTransfer = txType == 'transfer';
            final isStockIn = txType == 'stock_in';
            final badgeColor = isTransfer ? const Color(0xFF025EA7) : (isStockIn ? _kGreen : _kRed);
            final badgeBg = isTransfer ? const Color(0xFFEFF6FF) : (isStockIn ? const Color(0xFFECFDF5) : const Color(0xFFFEF2F2));
            final iconData = isTransfer
                ? Icons.swap_horiz_rounded
                : (isStockIn ? Icons.add_circle_outline : Icons.remove_circle_outline);

            final prodName = (t['product']?['name'] ?? t['productName'] ?? context.tr('product')).toString();
            final qty = _toInt(t['quantity']);
            final fromName = (t['fromWarehouseName'] ?? t['fromShopName'] ?? t['sourceWarehouseName'] ?? '').toString();
            final toName = (t['toShopName'] ?? t['toWarehouseName'] ?? t['destinationShopName'] ?? '').toString();
            final locName = isTransfer
                ? (fromName.isNotEmpty && toName.isNotEmpty ? '$fromName → $toName' : (fromName.isNotEmpty ? fromName : toName))
                : (t['warehouse']?['name'] ?? t['shop']?['name'] ?? t['locationName'] ?? '').toString();
            final reason = isTransfer
                ? '${context.tr('transfers')} (${(t['status'] ?? 'completed').toString().toUpperCase()})'
                : (t['reason'] ?? '').toString();
            final rawDate = (t['createdAt'] ?? t['date'] ?? '').toString();
            String dateFormatted = '';
            if (rawDate.isNotEmpty) {
              try {
                final dt = DateTime.parse(rawDate);
                dateFormatted = DateFormat('dd/MM/yyyy • HH:mm').format(dt.toLocal());
              } catch (_) {
                dateFormatted = rawDate;
              }
            }

            final userStr = (t['user'] != null 
                ? '${t['user']['firstName'] ?? ''} ${t['user']['lastName'] ?? ''}'.trim()
                : (t['requestedByName'] ?? t['performedByName'] ?? t['userName'] ?? '')).toString();

            return InkWell(
              onTap: () {
                if (isTransfer && t['id'] != null && t['id'].toString().isNotEmpty) {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => TransferDetailScreen(transferId: t['id'].toString()),
                    ),
                  );
                  return;
                }
                final item = RecentActivityItem(
                  id: (t['id'] ?? '').toString(),
                  type: isStockIn ? RecentActivityType.stockIn : RecentActivityType.stockOut,
                  occurredAt: DateTime.tryParse(rawDate) ?? DateTime.now(),
                  productName: prodName,
                  quantity: qty,
                  locationName: locName.isNotEmpty ? locName : null,
                  performedByName: userStr.isNotEmpty ? userStr : null,
                  reason: reason.isNotEmpty ? reason : null,
                  transactionId: (t['id'] ?? '').toString(),
                  previousQuantity: t['previousQuantity'] != null ? _toInt(t['previousQuantity']) : null,
                  newQuantity: t['newQuantity'] != null ? _toInt(t['newQuantity']) : null,
                  referenceNumber: (t['referenceNumber'] ?? t['reference'] ?? '').toString(),
                );
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => StockTransactionDetailScreen(activity: item),
                  ),
                );
              },
              borderRadius: BorderRadius.circular(12),
              child: Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _kBorder),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: badgeBg,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(iconData, color: badgeColor, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            prodName,
                            style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk),
                          ),
                          const SizedBox(height: 3),
                          Row(
                            children: [
                              if (reason.isNotEmpty) ...[
                                Flexible(
                                  child: Text(
                                    reason,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.outfit(fontSize: 12, color: _kSlate, fontWeight: FontWeight.w500),
                                  ),
                                ),
                                if (locName.isNotEmpty || dateFormatted.isNotEmpty)
                                  Text(' • ', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                              ],
                              if (locName.isNotEmpty) ...[
                                Flexible(
                                  child: Text(
                                    locName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                                  ),
                                ),
                                if (dateFormatted.isNotEmpty)
                                  Text(' • ', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                              ],
                              if (dateFormatted.isNotEmpty)
                                Expanded(
                                  child: Text(
                                    dateFormatted,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: badgeBg,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        isTransfer ? '⇄ $qty' : '${isStockIn ? '+' : '-'}$qty',
                        style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: badgeColor),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _infoCards(List<(String, String)> items) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: items.map((item) {
        return Container(
          width: (MediaQuery.of(context).size.width - 48) / 2,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: _kBorder)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.$1, style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
              const SizedBox(height: 4),
              Text(item.$2, style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: _kInk)),
            ],
          ),
        );
      }).toList(),
    );
  }

  ReportSection _buildStockTransactionsExportSection({
    required String title,
    required List<Map<String, dynamic>> txs,
  }) {
    return ReportSection(
      title: title,
      columns: [
        context.tr('product'),
        context.tr('quantity'),
        context.tr('reason'),
        context.tr('location'),
        context.tr('date'),
      ],
      rows: txs.map((t) {
        final isTransfer = (t['_txType'] ?? t['type'] ?? '') == 'transfer';
        final prodName = (t['product']?['name'] ?? t['productName'] ?? context.tr('product')).toString();
        final qty = isTransfer ? '⇄ ${t['quantity'] ?? 0}' : (t['quantity'] ?? 0).toString();
        final fromName = (t['fromWarehouseName'] ?? t['fromShopName'] ?? t['sourceWarehouseName'] ?? '').toString();
        final toName = (t['toShopName'] ?? t['toWarehouseName'] ?? t['destinationShopName'] ?? '').toString();
        final loc = isTransfer
            ? (fromName.isNotEmpty && toName.isNotEmpty ? '$fromName → $toName' : (fromName.isNotEmpty ? fromName : toName))
            : (t['warehouse']?['name'] ?? t['shop']?['name'] ?? t['locationName'] ?? '—').toString();
        final reason = isTransfer ? 'Transfer (${t['status'] ?? 'completed'})' : (t['reason'] ?? '—').toString();
        final rawDate = (t['createdAt'] ?? t['date'] ?? '').toString();
        String dateStr = rawDate;
        if (rawDate.isNotEmpty) {
          try {
            final dt = DateTime.parse(rawDate);
            dateStr = DateFormat('dd/MM/yyyy HH:mm').format(dt.toLocal());
          } catch (_) {}
        }
        return [prodName, qty, reason, loc, dateStr];
      }).toList(),
    );
  }

  List<Map<String, dynamic>> _getCommissionItems(Map<String, dynamic>? analytics) {
    final rp = context.read<ReportProvider>();
    final period = rp.period; // 'today', 'week', 'month', 'all', 'custom'

    final now = DateTime.now();
    DateTime from;
    DateTime to = DateTime(now.year, now.month, now.day, 23, 59, 59, 999);

    if (period == 'all') {
      from = DateTime(2000);
      to = DateTime(2099);
    } else if (period == 'custom' && rp.fromDate != null && rp.toDate != null) {
      from = DateTime(rp.fromDate!.year, rp.fromDate!.month, rp.fromDate!.day, 0, 0, 0);
      to = DateTime(rp.toDate!.year, rp.toDate!.month, rp.toDate!.day, 23, 59, 59, 999);
    } else if (period == 'today') {
      from = DateTime(now.year, now.month, now.day, 0, 0, 0);
      to = DateTime(now.year, now.month, now.day, 23, 59, 59, 999);
    } else if (period == 'week') {
      from = DateTime(now.year, now.month, now.day).subtract(const Duration(days: 6));
    } else if (period == 'month') {
      from = DateTime(now.year, now.month, now.day).subtract(const Duration(days: 29));
    } else {
      from = DateTime(2000);
    }

    bool matchesDate(dynamic raw) {
      if (period == 'all') return true;
      if (raw == null) return false;
      final dt = DateTime.tryParse(raw.toString());
      if (dt == null) return false;
      return !dt.isBefore(from) && !dt.isAfter(to);
    }

    if (_commissions.isNotEmpty) {
      final filtered = _commissions.where((c) {
        final rawDate = c['commissionDate'] ?? c['createdAt'];
        return matchesDate(rawDate);
      }).toList();
      if (filtered.isNotEmpty || period != 'all') {
        return filtered;
      }
    }

    final sales = _listOf(analytics, 'sales');
    if (sales.isNotEmpty) {
      final products = context.read<ProductProvider>().products;
      final staffEmployees = context.read<StaffProvider>().employees;
      final List<Map<String, dynamic>> items = [];

      for (final s in sales) {
        final saleDate = s['saleDate'] ?? s['createdAt'];
        if (!matchesDate(saleDate)) continue;

        final name = (s['createdBy']?['firstName'] != null
            ? '${s['createdBy']['firstName']} ${s['createdBy']['lastName'] ?? ''}'.trim()
            : (s['sellerName'] ?? s['userName'] ?? context.tr('staff'))).toString();
        final total = _toDouble(s['totalAmount'] ?? s['revenue']);
        final itemsList = s['items'] as List? ?? [];

        final matchedEmp = staffEmployees.where((e) =>
            e.userId == s['createdBy']?['id'] ||
            e.name.toLowerCase() == name.toLowerCase() ||
            (e.userFullName ?? '').toLowerCase() == name.toLowerCase()).firstOrNull;

        for (final item in itemsList) {
          if (item is Map) {
            final prodName = (item['productName'] ?? item['name'] ?? context.tr('product')).toString();
            final qty = _toInt(item['quantity'] ?? item['qty']);
            final price = _toDouble(item['unitPrice'] ?? item['price']);
            final lineTotal = _toDouble(item['total'] ?? (qty * price));

            final matchedProduct = products.where((p) =>
                p.id == item['productId'] ||
                p.name.toLowerCase() == prodName.toLowerCase()).firstOrNull;

            final double rate = (matchedProduct != null && matchedProduct.commissionRate > 0)
                ? matchedProduct.commissionRate
                : ((matchedEmp != null && matchedEmp.baseCommissionRate > 0)
                    ? matchedEmp.baseCommissionRate
                    : 5.0);

            final bool isFixed = matchedProduct?.commissionType == 'fixed' ||
                matchedEmp?.baseCommissionType == 'fixed';
            final double commAmount = isFixed ? (rate * (qty > 0 ? qty : 1)) : (lineTotal * rate / 100.0);

            items.add({
              'id': '${s['id']}_${item['id'] ?? prodName}',
              'employee': {
                'id': matchedEmp?.id ?? s['createdBy']?['id'],
                'name': name,
                'jobTitle': matchedEmp?.jobTitle ?? context.tr('staff'),
              },
              'commissionRate': rate,
              'commissionAmount': commAmount,
              'commissionDate': saleDate,
              'status': 'pending',
              'isApproved': false,
              'product': {
                'id': matchedProduct?.id,
                'name': prodName,
                'sku': (item['sku'] ?? matchedProduct?.sku ?? '').toString(),
              },
              'sale': {
                'id': s['id'],
                'invoiceNumber': (s['invoiceNumber'] ?? '').toString(),
                'totalAmount': total,
                'customer': {'name': (s['customerName'] ?? s['customer']?['name'] ?? '').toString()},
                'item': {'quantity': qty, 'unitPrice': price, 'total': lineTotal},
              },
            });
          }
        }

        if (itemsList.isEmpty && total > 0) {
          final double rate = (matchedEmp != null && matchedEmp.baseCommissionRate > 0) ? matchedEmp.baseCommissionRate : 5.0;
          items.add({
            'id': s['id'],
            'employee': {
              'id': matchedEmp?.id ?? s['createdBy']?['id'],
              'name': name,
              'jobTitle': matchedEmp?.jobTitle ?? context.tr('staff'),
            },
            'commissionRate': rate,
            'commissionAmount': total * rate / 100.0,
            'commissionDate': saleDate,
            'status': 'pending',
            'isApproved': false,
            'sale': {
              'id': s['id'],
              'invoiceNumber': (s['invoiceNumber'] ?? '').toString(),
              'totalAmount': total,
              'customer': {'name': (s['customerName'] ?? s['customer']?['name'] ?? '').toString()},
            },
          });
        }
      }
      if (items.isNotEmpty) return items;
    }

    final bySeller = _listOf(analytics, 'bySeller');
    if (bySeller.isNotEmpty) {
      return bySeller.map((s) {
        final revenue = _toDouble(s['revenue'] ?? s['totalSpent'] ?? s['amount']);
        final invCount = _toInt(s['invoiceCount']);
        return {
          'id': s['sellerId'] ?? s['id'],
          'employee': {
            'id': s['sellerId'] ?? s['id'],
            'name': (s['sellerName'] ?? s['name'] ?? context.tr('staff')).toString(),
            'jobTitle': context.tr('staff'),
          },
          'commissionRate': 5.0,
          'commissionAmount': revenue * 0.05,
          'status': 'pending',
          'isApproved': false,
          'sale': {
            'invoiceNumber': context.tr('invoice_count').replaceAll('{count}', invCount.toString()),
            'totalAmount': revenue,
          },
        };
      }).toList();
    }
    return [];
  }

  Future<void> _approveCommissionItem(String commissionId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(context.tr('confirm'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text('Mark this commission as paid?', style: GoogleFonts.outfit(fontSize: 14)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(context.tr('cancel'))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: _kGreen, foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(context.tr('confirm')),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      if (!commissionId.contains('_')) {
        await ApiClient().post('/Commissions/approve', body: {'commissionIds': [commissionId]});
      }
      setState(() {
        for (final c in _commissions) {
          if (c['id']?.toString() == commissionId) {
            c['isApproved'] = true;
            c['status'] = 'approved';
          }
        }
      });
      if (mounted) showAppToast(context, 'Commission marked as paid', type: AppToastType.success);
      final comms = await _supplement.loadCommissions();
      if (mounted && comms.isNotEmpty) {
        setState(() => _commissions = comms);
      }
    } catch (e) {
      if (mounted) showAppToast(context, 'Failed to update commission: $e', type: AppToastType.error);
    }
  }

  Future<void> _approveAllForEmployee(List<Map<String, dynamic>> employeeItems) async {
    final unpaidIds = employeeItems
        .where((c) => c['isApproved'] != true && c['id'] != null)
        .map((c) => c['id'].toString())
        .toList();
    if (unpaidIds.isEmpty) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(context.tr('confirm'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text('Mark all ${unpaidIds.length} pending commissions as paid for this staff member?', style: GoogleFonts.outfit(fontSize: 14)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(context.tr('cancel'))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: _kGreen, foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(context.tr('confirm')),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      final realUuids = unpaidIds.where((id) => !id.contains('_')).toList();
      if (realUuids.isNotEmpty) {
        await ApiClient().post('/Commissions/approve', body: {'commissionIds': realUuids});
      }
      setState(() {
        for (final c in _commissions) {
          if (unpaidIds.contains(c['id']?.toString())) {
            c['isApproved'] = true;
            c['status'] = 'approved';
          }
        }
      });
      if (mounted) showAppToast(context, 'All commissions marked as paid', type: AppToastType.success);
      final comms = await _supplement.loadCommissions();
      if (mounted && comms.isNotEmpty) {
        setState(() => _commissions = comms);
      }
    } catch (e) {
      if (mounted) showAppToast(context, 'Failed to approve commissions: $e', type: AppToastType.error);
    }
  }

  Widget _buildCommissionFilterTab(String key, String label) {
    final isSelected = _commissionStatusFilter == key;
    return GestureDetector(
      onTap: () => setState(() => _commissionStatusFilter = key),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? _kBlue : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: isSelected ? _kBlue : _kBorder),
        ),
        child: Text(
          label,
          style: GoogleFonts.outfit(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            color: isSelected ? Colors.white : _kSlate,
          ),
        ),
      ),
    );
  }

  Widget _commissionList(Map<String, dynamic>? analytics) {
    final allItems = _getCommissionItems(analytics);
    if (allItems.isEmpty) {
      return Column(
        children: [
          _EmptyBox(message: context.tr('no_results_found')),
          const SizedBox(height: 16),
        ],
      );
    }

    final staffNames = <String>{};
    for (final c in allItems) {
      final name = (c['employee']?['name'] ?? c['sellerName'] ?? c['name'] ?? context.tr('staff')).toString();
      if (name.isNotEmpty) staffNames.add(name);
    }

    final filteredItems = allItems.where((c) {
      if (_commissionStatusFilter == 'unpaid' && c['isApproved'] == true) return false;
      if (_commissionStatusFilter == 'paid' && c['isApproved'] != true) return false;

      final name = (c['employee']?['name'] ?? c['sellerName'] ?? c['name'] ?? context.tr('staff')).toString();
      if (_commissionStaffFilter != null && _commissionStaffFilter != '__all__' && name != _commissionStaffFilter) {
        return false;
      }

      if (_commissionSearchQuery.isNotEmpty) {
        final q = _commissionSearchQuery.toLowerCase();
        final prod = (c['product']?['name'] ?? '').toString().toLowerCase();
        final inv = (c['sale']?['invoiceNumber'] ?? '').toString().toLowerCase();
        final cust = (c['sale']?['customer']?['name'] ?? '').toString().toLowerCase();
        final emp = name.toLowerCase();
        if (!prod.contains(q) && !inv.contains(q) && !cust.contains(q) && !emp.contains(q)) {
          return false;
        }
      }

      return true;
    }).toList();

    double totalPeriodCommission = 0;
    double totalPeriodPaid = 0;
    double totalPeriodSales = 0;
    int unpaidCount = 0;
    int paidCount = 0;

    for (final c in allItems) {
      final amt = _toDouble(c['commissionAmount'] ?? c['amount']);
      totalPeriodCommission += amt;
      if (c['isApproved'] == true) {
        totalPeriodPaid += amt;
        paidCount++;
      } else {
        unpaidCount++;
      }
      final saleTotal = _toDouble(c['sale']?['totalAmount'] ?? c['sale']?['item']?['total']);
      totalPeriodSales += saleTotal;
    }
    final totalPeriodUnpaid = totalPeriodCommission - totalPeriodPaid;

    double filteredCommissionSum = 0;
    double filteredSalesSum = 0;
    for (final c in filteredItems) {
      filteredCommissionSum += _toDouble(c['commissionAmount'] ?? c['amount']);
      filteredSalesSum += _toDouble(c['sale']?['totalAmount'] ?? c['sale']?['item']?['total']);
    }

    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final c in filteredItems) {
      final name = (c['employee']?['name'] ?? c['sellerName'] ?? c['name'] ?? context.tr('staff')).toString();
      grouped.putIfAbsent(name, () => []).add(c);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── 1. Top Summary Banner Card ──
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF0F172A), Color(0xFF1E3A8A)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF1E3A8A).withValues(alpha: 0.25),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.monetization_on_outlined, color: Colors.amberAccent, size: 18),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        context.tr('commission_report').toUpperCase(),
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.8,
                          color: Colors.white.withValues(alpha: 0.9),
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _periodCaption(context.read<ReportProvider>().period),
                      style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                'ETB ${_formatAmount(totalPeriodCommission)}',
                style: GoogleFonts.outfit(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  _ReportSummaryPill(
                    label: '${context.tr('paid')} ($paidCount)',
                    value: totalPeriodPaid,
                    color: const Color(0xFF16A34A),
                  ),
                  const SizedBox(width: 10),
                  _ReportSummaryPill(
                    label: '${context.tr('unpaid')} ($unpaidCount)',
                    value: totalPeriodUnpaid,
                    color: const Color(0xFFD97706),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // ── 2. Metric Sub-Cards ──
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _kBorder),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.receipt_long_outlined, color: _kBlue, size: 20),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(context.tr('sales'), style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                          Text('ETB ${_formatAmount(totalPeriodSales)}',
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: _kInk)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _kBorder),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.people_alt_outlined, color: Color(0xFF16A34A), size: 20),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(context.tr('staff'), style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                          Text('${staffNames.length} Members',
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: _kInk)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // ── 3. Filter Pills + View Switcher Bar ──
        Row(
          children: [
            _buildCommissionFilterTab('all', '${context.tr('all')} (${allItems.length})'),
            const SizedBox(width: 6),
            _buildCommissionFilterTab('unpaid', '${context.tr('unpaid')} ($unpaidCount)'),
            const SizedBox(width: 6),
            _buildCommissionFilterTab('paid', '${context.tr('paid')} ($paidCount)'),
            const Spacer(),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _kBorder),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: Icon(Icons.table_chart_rounded, size: 18, color: _commissionTableView ? _kBlue : _kSlate),
                    tooltip: 'Table View',
                    padding: const EdgeInsets.all(6),
                    constraints: const BoxConstraints(),
                    onPressed: () => setState(() => _commissionTableView = true),
                  ),
                  Container(width: 1, height: 18, color: _kBorder),
                  IconButton(
                    icon: Icon(Icons.badge_outlined, size: 18, color: !_commissionTableView ? _kBlue : _kSlate),
                    tooltip: 'Staff Cards View',
                    padding: const EdgeInsets.all(6),
                    constraints: const BoxConstraints(),
                    onPressed: () => setState(() => _commissionTableView = false),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // ── Search & Staff Dropdown ──
        Row(
          children: [
            Expanded(
              child: SizedBox(
                height: 40,
                child: TextField(
                  onChanged: (v) => setState(() => _commissionSearchQuery = v),
                  style: GoogleFonts.outfit(fontSize: 13, color: _kInk),
                  decoration: InputDecoration(
                    hintText: 'Search staff, product, invoice...',
                    hintStyle: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF94A3B8)),
                    prefixIcon: const Icon(Icons.search, size: 18, color: Color(0xFF94A3B8)),
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: _kBorder),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: _kBorder),
                    ),
                  ),
                ),
              ),
            ),
            if (staffNames.length > 1) ...[
              const SizedBox(width: 8),
              InkWell(
                onTap: () {
                  _showSelectionSheet(
                    title: context.tr('staff'),
                    selectedId: _commissionStaffFilter,
                    options: staffNames.map((name) => {'id': name, 'name': name}).toList(),
                    onSelect: (selected) {
                      setState(() => _commissionStaffFilter = selected);
                    },
                  );
                },
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  height: 40,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: _commissionStaffFilter != null ? const Color(0xFFEFF6FF) : Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: _commissionStaffFilter != null ? _kBlue : _kBorder,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.person_outline, size: 16, color: _commissionStaffFilter != null ? _kBlue : _kSlate),
                      const SizedBox(width: 6),
                      Text(
                        _commissionStaffFilter ?? context.tr('staff'),
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: _commissionStaffFilter != null ? _kBlue : _kInk,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(Icons.arrow_drop_down, size: 18, color: _commissionStaffFilter != null ? _kBlue : _kSlate),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 16),

        // ── 4. Main Body: Table View or Staff Cards View ──
        if (filteredItems.isEmpty)
          _EmptyBox(message: context.tr('no_results_found'))
        else if (_commissionTableView)
          _buildCommissionTableView(filteredItems, filteredCommissionSum, filteredSalesSum)
        else
          _buildCommissionStaffCardsView(grouped),

        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildCommissionTableView(
    List<Map<String, dynamic>> items,
    double totalCommissionSum,
    double totalSalesSum,
  ) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: max(880.0, MediaQuery.of(context).size.width - 32),
              child: Column(
                children: [
                  // Table Header
                  Container(
                    color: const Color(0xFFF8FAFC),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: Text(
                            context.tr('staff'),
                            style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: _kInk),
                          ),
                        ),
                        Expanded(
                          flex: 3,
                          child: Text(
                            context.tr('product'),
                            style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: _kInk),
                          ),
                        ),
                        Expanded(
                          flex: 2,
                          child: Text(
                            context.tr('total'),
                            textAlign: TextAlign.end,
                            style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: _kInk),
                          ),
                        ),
                        Expanded(
                          flex: 1,
                          child: Text(
                            '%',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: _kInk),
                          ),
                        ),
                        Expanded(
                          flex: 2,
                          child: Text(
                            context.tr('commission'),
                            textAlign: TextAlign.end,
                            style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: _kBlue),
                          ),
                        ),
                        Expanded(
                          flex: 2,
                          child: Text(
                            context.tr('date'),
                            textAlign: TextAlign.center,
                            style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: _kInk),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1, color: Color(0xFFE2E8F0)),

                  // Table Rows
                  ...items.map((c) {
                    final staffName = (c['employee']?['name'] ?? c['sellerName'] ?? c['name'] ?? context.tr('staff')).toString();
                    final jobTitle = (c['employee']?['jobTitle'] ?? context.tr('staff')).toString();
                    final product = (c['product']?['name'] ?? context.tr('product')).toString();
                    final sku = (c['product']?['sku'] ?? '').toString();
                    final lineTotal = _toDouble(c['sale']?['totalAmount'] ?? c['sale']?['item']?['total']);
                    final rate = _toDouble(c['commissionRate'] ?? 5);
                    final commAmt = _toDouble(c['commissionAmount'] ?? c['amount']);
                    final rawDate = (c['commissionDate'] ?? c['createdAt'] ?? '').toString();
                    final dt = DateTime.tryParse(rawDate);
                    final dateStr = dt != null ? '${dt.day}/${dt.month}/${dt.year}' : rawDate.split('T').first;

                    return Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                          child: Row(
                            children: [
                              // Staff
                              Expanded(
                                flex: 3,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      staffName,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.outfit(fontSize: 12.5, fontWeight: FontWeight.w600, color: _kInk),
                                    ),
                                    Text(jobTitle, style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                                  ],
                                ),
                              ),

                              // Product
                              Expanded(
                                flex: 3,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      product,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.outfit(fontSize: 12, color: _kInk),
                                    ),
                                    if (sku.isNotEmpty)
                                      Text(sku, style: GoogleFonts.outfit(fontSize: 10.5, color: _kSlate)),
                                  ],
                                ),
                              ),
                              // Sale Total
                              Expanded(
                                flex: 2,
                                child: Text(
                                  _formatAmount(lineTotal),
                                  textAlign: TextAlign.end,
                                  style: GoogleFonts.outfit(fontSize: 12, color: _kInk),
                                ),
                              ),
                              // Rate
                              Expanded(
                                flex: 1,
                                child: Text(
                                  '${rate.toStringAsFixed(0)}%',
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.outfit(fontSize: 11.5, color: _kSlate),
                                ),
                              ),
                              // Commission Amount
                              Expanded(
                                flex: 2,
                                child: Text(
                                  _formatAmount(commAmt),
                                  textAlign: TextAlign.end,
                                  style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: _kBlue),
                                ),
                              ),
                              // Date
                              Expanded(
                                flex: 2,
                                child: Text(
                                  dateStr,
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.outfit(fontSize: 11.5, color: _kSlate),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Divider(height: 1, color: Color(0xFFF1F5F9)),
                      ],
                    );
                  }),

                  // Total Row at bottom
                  Container(
                    color: const Color(0xFFF8FAFC),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    child: Row(
                      children: [
                        Expanded(
                          flex: 6,
                          child: Text(
                            'TOTAL (${items.length} records)',
                            style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: _kInk),
                          ),
                        ),
                        Expanded(
                          flex: 2,
                          child: Text(
                            'ETB ${_formatAmount(totalSalesSum)}',
                            textAlign: TextAlign.end,
                            style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: _kInk),
                          ),
                        ),
                        const Expanded(flex: 1, child: SizedBox()),
                        Expanded(
                          flex: 2,
                          child: Text(
                            'ETB ${_formatAmount(totalCommissionSum)}',
                            textAlign: TextAlign.end,
                            style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: _kBlue),
                          ),
                        ),
                        const Expanded(flex: 2, child: SizedBox()),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Pagination Bar at Bottom
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Showing 1-${items.length} of ${items.length} commissions',
                  style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                ),
                Text(
                  'Total: ETB ${_formatAmount(totalCommissionSum)}',
                  style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: _kInk),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCommissionStaffCardsView(Map<String, List<Map<String, dynamic>>> grouped) {
    return Column(
      children: grouped.entries.map((entry) {
        final staffName = entry.key;
        final entries = entry.value;
        double empTotal = 0;
        double empPaid = 0;
        for (final c in entries) {
          final amt = _toDouble(c['commissionAmount'] ?? c['amount']);
          empTotal += amt;
          if (c['isApproved'] == true) empPaid += amt;
        }
        final empUnpaid = empTotal - empPaid;
        final role = (entries.first['employee']?['jobTitle'] ?? context.tr('staff')).toString();

        return Container(
          margin: const EdgeInsets.only(bottom: 14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: _kBorder),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: _kBlue.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Center(
                        child: Text(
                          staffName.isNotEmpty ? staffName[0].toUpperCase() : '?',
                          style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kBlue),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(staffName, style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: _kInk)),
                          Text(role, style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('ETB ${_formatAmount(empTotal)}',
                            style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: _kInk)),
                        Text(
                          empPaid >= empTotal && empTotal > 0
                              ? context.tr('paid')
                              : 'Unpaid: ETB ${_formatAmount(empUnpaid)}',
                          style: GoogleFonts.outfit(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: empPaid >= empTotal && empTotal > 0 ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const Divider(color: _kBorder, height: 1),
              ...entries.map((c) {
                final product = c['product'] as Map?;
                final sale = c['sale'] as Map?;
                final item = sale?['item'] as Map?;
                final customer = sale?['customer'] as Map?;

                final productName = product?['name']?.toString() ?? context.tr('product');
                final sku = product?['sku']?.toString() ?? '';
                final customerName = customer?['name']?.toString();
                final quantity = item?['quantity'] is num
                    ? (item!['quantity'] as num).toInt()
                    : (double.tryParse('${item?['quantity']}') ?? 0).toInt();
                final unitPrice = _toDouble(item?['unitPrice']);
                final lineTotal = _toDouble(item?['total'] ?? sale?['totalAmount']);
                final rate = _toDouble(c['commissionRate'] ?? 5);
                final amount = _toDouble(c['commissionAmount'] ?? c['amount']);
                final rawDate = (c['commissionDate'] ?? c['createdAt'] ?? '').toString();
                final date = DateTime.tryParse(rawDate);
                final dateLabel = date != null ? '${date.day}/${date.month}/${date.year}' : rawDate.split('T').first;

                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(productName, style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk)),
                      if (sku.isNotEmpty) Text(sku, style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                      const SizedBox(height: 4),
                      if (customerName != null && customerName.isNotEmpty) _detailRow(context, context.tr('customer'), customerName),
                      if (quantity > 0 && unitPrice > 0) _detailRow(context, context.tr('quantity'), '$quantity x ETB ${_formatAmount(unitPrice)}'),
                      if (lineTotal > 0) _detailRow(context, context.tr('total'), 'ETB ${_formatAmount(lineTotal)}'),
                      if (dateLabel.isNotEmpty) _detailRow(context, context.tr('date'), dateLabel),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Rate: ${rate.toStringAsFixed(1)}%', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                          Text('ETB ${_formatAmount(amount)}', style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: _kBlue)),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Divider(color: _kBorder.withValues(alpha: 0.6), height: 1),
                    ],
                  ),
                );
              }),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _detailRow(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1),
      child: Row(
        children: [
          SizedBox(
            width: 90,
            child: Text(label, style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
          ),
          Expanded(
            child: Text(value, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w500, color: _kInk)),
          ),
        ],
      ),
    );
  }

  Widget _lowStockList() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: _SectionLabel('${context.tr('low_stock')} (${_lowStock.length})')),
            TextButton.icon(
              onPressed: _exportLowStockCsv,
              icon: const Icon(Icons.download_outlined, size: 16),
              label: Text(context.tr('export_low_stock')),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (_lowStock.isEmpty)
          _EmptyBox(message: context.tr('no_results_found'))
        else
          ..._lowStock.map((p) => Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: _kBorder)),
                child: Row(
                  children: [
                    Expanded(child: Text(p.name, style: GoogleFonts.outfit(fontWeight: FontWeight.w500))),
                    Text('${p.stockQuantity}/${p.minStockLevel}', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: _kRed)),
                  ],
                ),
              )),
        const SizedBox(height: 16),
      ],
    );
  }

  Future<void> _exportLowStockCsv() async {
    final section = ReportSection(
      title: context.tr('low_stock'),
      columns: [context.tr('product'), context.tr('quantity'), context.tr('min_stock')],
      rows: _lowStock.map((p) => [p.name, p.stockQuantity, p.minStockLevel]).toList(),
    );
    final bytes = ReportExportService.buildCsv(context.tr('low_stock'), [section]);
    await ReportExportService.shareBytes(bytes, 'low_stock_report.csv');
  }

  List<ReportSection> _buildCommissionExportSections([Map<String, dynamic>? analytics]) {
    final items = _getCommissionItems(analytics);
    double totalAmt = 0;
    double paidAmt = 0;
    for (final c in items) {
      final amt = _toDouble(c['commissionAmount'] ?? c['amount']);
      totalAmt += amt;
      if (c['isApproved'] == true) paidAmt += amt;
    }
    final unpaidAmt = totalAmt - paidAmt;

    final summary = ReportSection(
      title: '${context.tr('commission_report')} - ${context.tr('summary')}',
      columns: [context.tr('metric'), context.tr('value')],
      rows: [
        [context.tr('total_commission'), 'ETB ${_formatAmount(totalAmt)}'],
        [context.tr('paid'), 'ETB ${_formatAmount(paidAmt)}'],
        [context.tr('unpaid'), 'ETB ${_formatAmount(unpaidAmt)}'],
        [context.tr('total_entries'), '${items.length}'],
      ],
    );

    final details = ReportSection(
      title: '${context.tr('commission_report')} - ${context.tr('details')}',
      columns: [
        context.tr('staff'),
        context.tr('invoice'),
        context.tr('product'),
        context.tr('total'),
        '%',
        context.tr('commission'),
        context.tr('status'),
        context.tr('date'),
      ],
      rows: items.map((c) {
        final staffName = (c['employee']?['name'] ?? c['sellerName'] ?? c['name'] ?? context.tr('staff')).toString();
        final invoice = (c['sale']?['invoiceNumber'] ?? '').toString();
        final product = (c['product']?['name'] ?? context.tr('product')).toString();
        final saleAmt = _toDouble(c['sale']?['totalAmount'] ?? c['sale']?['item']?['total']).toStringAsFixed(2);
        final rate = '${_toDouble(c['commissionRate'] ?? 5).toStringAsFixed(0)}%';
        final commAmt = _toDouble(c['commissionAmount'] ?? c['amount']).toStringAsFixed(2);
        final status = c['isApproved'] == true ? context.tr('paid') : context.tr('unpaid');
        final rawDate = (c['commissionDate'] ?? c['createdAt'] ?? '').toString();
        final dt = DateTime.tryParse(rawDate);
        final dateStr = dt != null ? '${dt.day}/${dt.month}/${dt.year}' : rawDate.split('T').first;
        return [staffName, invoice, product, saleAmt, rate, commAmt, status, dateStr];
      }).toList(),
    );

    return [summary, details];
  }

  Widget _paymentsSummary(Map<String, dynamic>? analytics) {
    final sales = _listOf(analytics, 'sales');
    double paid = 0;
    double credit = 0;
    for (final s in sales) {
      paid += _toDouble(s['advancePayment']) + (_toDouble(s['totalAmount']) - _toDouble(s['remainingBalance'])).clamp(0, _toDouble(s['totalAmount']));
      credit += _toDouble(s['remainingBalance']);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _infoCards([
          (context.tr('customer_payments'), 'ETB ${paid.toStringAsFixed(0)}'),
          (context.tr('credit_due'), 'ETB ${credit.toStringAsFixed(0)}'),
          (context.tr('sales'), '${sales.length}'),
        ]),
        const SizedBox(height: 16),
      ],
    );
  }

  ReportSection _buildProductSummaryExportSection() {
    final products = context.read<ProductProvider>().products;
    final tracked = products.where((p) => p.trackStock).length;
    final totalQty = products.fold<int>(0, (s, p) => s + p.stockQuantity);
    final inventoryValue = products.fold<double>(0, (s, p) => s + (p.cost > 0 ? p.cost : p.price) * p.stockQuantity);
    return ReportSection(
      title: context.tr('summary'),
      columns: [context.tr('summary'), ''],
      rows: [
        [context.tr('products'), products.length],
        [context.tr('tracked_stock'), tracked],
        [context.tr('total_quantity'), totalQty],
        [context.tr('inventory_value'), 'ETB ${_formatAmount(inventoryValue)}'],
      ],
    );
  }

  ReportSection _buildProductInventoryExportSection() {
    final products = context.read<ProductProvider>().products.toList()
      ..sort((a, b) => b.stockQuantity.compareTo(a.stockQuantity));
    return ReportSection(
      title: context.tr('inventory_list'),
      columns: [context.tr('product'), context.tr('sku'), context.tr('quantity'), context.tr('value')],
      rows: products.map((p) => [
        p.name,
        p.sku,
        p.stockQuantity,
        ((p.cost > 0 ? p.cost : p.price) * p.stockQuantity).toStringAsFixed(2),
      ]).toList(),
    );
  }

  ReportSection _buildLowStockExportSection() {
    return ReportSection(
      title: context.tr('low_stock'),
      columns: [context.tr('product'), context.tr('quantity'), context.tr('min_stock')],
      rows: _lowStock.map((p) => [p.name, p.stockQuantity, p.minStockLevel]).toList(),
    );
  }

  ReportSection _buildWarehouseExportSection(Map<String, dynamic> analytics) {
    final rows = _locationRows(analytics, warehouse: true);
    return ReportSection(
      title: context.tr('warehouse_report'),
      columns: [context.tr('warehouse'), context.tr('sales'), 'Revenue (ETB)'],
      rows: rows.map((r) => [
        (r['name'] ?? context.tr('unknown')).toString(),
        _toInt(r['invoiceCount']),
        _toDouble(r['revenue']).toStringAsFixed(2),
      ]).toList(),
    );
  }

  ReportSection _buildShopExportSection(Map<String, dynamic> analytics) {
    final rows = _locationRows(analytics, warehouse: false);
    return ReportSection(
      title: context.tr('shop_report'),
      columns: [context.tr('shop'), context.tr('sales'), 'Revenue (ETB)'],
      rows: rows.map((r) => [
        (r['name'] ?? context.tr('unknown')).toString(),
        _toInt(r['invoiceCount']),
        _toDouble(r['revenue']).toStringAsFixed(2),
      ]).toList(),
    );
  }

  ReportSection _buildCreditSummaryExportSection(Map<String, dynamic> analytics) {
    final summary = analytics['summary'] ?? {};
    return ReportSection(
      title: context.tr('summary'),
      columns: [context.tr('summary'), ''],
      rows: [
        [context.tr('credit_due'), 'ETB ${_toDouble(summary['totalCredit']).toStringAsFixed(2)}'],
        [context.tr('revenue'), 'ETB ${_toDouble(summary['totalRevenue']).toStringAsFixed(2)}'],
        [context.tr('sales'), _toInt(summary['totalSales'])],
      ],
    );
  }

  ReportSection _buildCreditSalesExportSection(Map<String, dynamic> analytics) {
    final sales = _filteredSales(analytics);
    return ReportSection(
      title: context.tr('credit_sales'),
      columns: [context.tr('customer'), context.tr('date'), 'Total (ETB)', 'Balance (ETB)'],
      rows: sales.map((j) {
        final sale = SaleModel.fromJson(j);
        return [
          sale.customerName.isNotEmpty ? sale.customerName : context.tr('walk_in'),
          sale.saleDate,
          sale.totalAmount.toStringAsFixed(2),
          sale.remainingBalance.toStringAsFixed(2),
        ];
      }).toList(),
    );
  }

  ReportSection _buildSummarySection(Map<String, dynamic> analytics) {
    final s = analytics['summary'] ?? <String, dynamic>{};
    final totalRevenue = _toDouble(s['totalRevenue']);
    final totalSales = _toInt(s['totalSales']);
    final avg = totalSales > 0 ? totalRevenue / totalSales : 0.0;
    return ReportSection(
      title: context.tr('summary'),
      columns: [context.tr('summary'), ''],
      rows: [
        [context.tr('revenue'), 'ETB ${totalRevenue.toStringAsFixed(2)}'],
        [context.tr('purchase'), 'ETB ${_toDouble(s['totalPurchase']).toStringAsFixed(2)}'],
        [context.tr('expense'), 'ETB ${_toDouble(s['totalExpense']).toStringAsFixed(2)}'],
        [context.tr('profit'), 'ETB ${_toDouble(s['totalProfit']).toStringAsFixed(2)}'],
        [context.tr('sales'), totalSales],
        [context.tr('avg_invoice'), 'ETB ${avg.toStringAsFixed(2)}'],
        [context.tr('tax'), 'ETB ${_toDouble(s['totalTax']).toStringAsFixed(2)}'],
        [context.tr('discount'), 'ETB ${_toDouble(s['totalDiscount']).toStringAsFixed(2)}'],
        [context.tr('credit_due'), 'ETB ${_toDouble(s['totalCredit']).toStringAsFixed(2)}'],
      ],
    );
  }

  ReportSection _buildSalesSection(Map<String, dynamic> analytics) {
    final sales = _filteredSales(analytics);
    final rows = <List<Object?>>[];
    for (final j in sales) {
      final sale = SaleModel.fromJson(j);
      rows.add([
        '#${sale.id.length >= 8 ? sale.id.substring(0, 8) : sale.id}',
        sale.customerName.isNotEmpty ? sale.customerName : context.tr('walk_in'),
        sale.saleDate,
        sale.status,
        sale.paymentType,
        sale.totalAmount.toStringAsFixed(2),
        sale.taxAmount.toStringAsFixed(2),
        sale.advancePayment.toStringAsFixed(2),
        sale.remainingBalance.toStringAsFixed(2),
      ]);
    }
    for (final imp in _importedSales) {
      rows.add([
        '#${imp.invoiceNumber}',
        imp.customerName,
        imp.saleDate,
        'Imported (${imp.source.toUpperCase()})',
        imp.paymentType,
        imp.totalAmount.toStringAsFixed(2),
        '0.00',
        imp.totalAmount.toStringAsFixed(2),
        '0.00',
      ]);
    }
    return ReportSection(
      title: context.tr('sales'),
      columns: ['ID', context.tr('customer'), context.tr('date'), context.tr('status'),
          context.tr('payment'), 'Total (ETB)', 'Tax (ETB)', 'Paid (ETB)', 'Balance (ETB)'],
      rows: rows,
    );
  }

  ReportSection _buildProductsSection(Map<String, dynamic> analytics) {
    return ReportSection(
      title: context.tr('top_products'),
      columns: [context.tr('product'), context.tr('sold'), 'Revenue (ETB)'],
      rows: _listOf(analytics, 'byProduct').map((r) => [
        (r['productName'] ?? context.tr('unknown')).toString(),
        _toInt(r['quantity']),
        _toDouble(r['revenue']).toStringAsFixed(2),
      ]).toList(),
    );
  }

  ReportSection _buildCustomersSection(Map<String, dynamic> analytics) {
    return ReportSection(
      title: context.tr('top_customers'),
      columns: [context.tr('customer'), context.tr('sales'), 'Total (ETB)'],
      rows: _listOf(analytics, 'byCustomer').map((r) => [
        (r['customerName'] ?? context.tr('unknown')).toString(),
        _toInt(r['invoiceCount']),
        _toDouble(r['totalSpent']).toStringAsFixed(2),
      ]).toList(),
    );
  }

  ReportSection _buildLocationsSection(Map<String, dynamic> analytics) {
    return ReportSection(
      title: context.tr('sales_by_location'),
      columns: [context.tr('location'), 'Type', context.tr('sales'), 'Revenue (ETB)'],
      rows: _listOf(analytics, 'byLocation').map((r) => [
        (r['name'] ?? context.tr('unknown')).toString(),
        (r['type'] == 'warehouse' ? context.tr('warehouse') : context.tr('shop')),
        _toInt(r['invoiceCount']),
        _toDouble(r['revenue']).toStringAsFixed(2),
      ]).toList(),
    );
  }

  ReportSection _buildSellersSection(Map<String, dynamic> analytics) {
    return ReportSection(
      title: context.tr('sales_by_seller'),
      columns: [context.tr('seller'), context.tr('sales'), 'Revenue (ETB)'],
      rows: _listOf(analytics, 'bySeller').map((r) => [
        (r['sellerName'] ?? context.tr('unknown')).toString(),
        _toInt(r['invoiceCount']),
        _toDouble(r['revenue']).toStringAsFixed(2),
      ]).toList(),
    );
  }

  Widget _buildSummary(Map<String, dynamic>? analytics) {
    final summary = analytics?['summary'] ?? {};
    var totalRevenue = _toDouble(summary['totalRevenue']);
    var totalSales = _toInt(summary['totalSales']);
    if (_reportType == 'sales' && _importedSales.isNotEmpty) {
      final impRev = _importedSales.fold<double>(0.0, (s, r) => s + r.totalAmount);
      totalRevenue += impRev;
      totalSales += _importedSales.length;
    }
    final avg = totalSales > 0 ? totalRevenue / totalSales : 0.0;
    final totalPurchase = _toDouble(summary['totalPurchase']);
    final totalExpense = _toDouble(summary['totalExpense']);
    final totalProfit = _toDouble(summary['totalProfit']);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionLabel(context.tr('summary').toUpperCase()),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: _StatCard(label: context.tr('revenue'), value: 'ETB ${totalRevenue.toStringAsFixed(0)}', color: _kBlue)),
            const SizedBox(width: 10),
            Expanded(child: _StatCard(label: context.tr('sales'), value: '$totalSales', color: _kGreen)),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: _StatCard(label: context.tr('purchase'), value: 'ETB ${totalPurchase.toStringAsFixed(0)}', color: _kAmber)),
            const SizedBox(width: 10),
            Expanded(child: _StatCard(label: context.tr('expense'), value: 'ETB ${totalExpense.toStringAsFixed(0)}', color: const Color(0xFFDC2626))),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: _StatCard(label: context.tr('profit'), value: 'ETB ${totalProfit.toStringAsFixed(0)}', color: totalProfit >= 0 ? _kGreen : const Color(0xFFDC2626))),
            const SizedBox(width: 10),
            Expanded(child: _StatCard(label: context.tr('avg_invoice'), value: 'ETB ${avg.toStringAsFixed(0)}', color: _kBlue)),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: _StatCard(label: context.tr('tax'), value: 'ETB ${_toDouble(summary['totalTax']).toStringAsFixed(0)}', color: _kSlate)),
            const SizedBox(width: 10),
            Expanded(child: _StatCard(label: context.tr('discount'), value: 'ETB ${_toDouble(summary['totalDiscount']).toStringAsFixed(0)}', color: _kSlate)),
          ],
        ),
        const SizedBox(height: 10),
        _StatCard(label: context.tr('credit_due'), value: 'ETB ${_toDouble(summary['totalCredit']).toStringAsFixed(0)}', color: _kRed),
      ],
    );
  }

  Widget _buildChart(Map<String, dynamic>? analytics, String period) {
    final series = _listOf(analytics, 'series');
    final data = series.map((s) => (label: (s['label'] ?? '').toString(), value: _toDouble(s['revenue']))).toList();
    final hasData = data.any((d) => d.value > 0);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.tr('revenue_trend'),
            style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: _kInk),
          ),
          const SizedBox(height: 4),
          Text(
            _periodCaption(period),
            style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
          ),
          const SizedBox(height: 20),
          if (!hasData)
            Container(height: 160, alignment: Alignment.center,
              child: Text(context.tr('no_data_available'), style: GoogleFonts.outfit(color: const Color(0xFF94A3B8))))
          else
            SizedBox(
              height: 180,
              child: CustomPaint(
                size: Size(double.infinity, 180),
                painter: _BarChartPainter(data: data),
              ),
            ),
          if (data.length > 12) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(data.first.label, style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                Text(data.last.label, style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
              ],
            ),
          ],
        ],
      ),
    );
  }

  String _periodCaption(String period) {
    switch (period) {
      case 'today':
        return context.tr('today');
      case 'week':
        return context.tr('last_7_days');
      case 'month':
        return context.tr('this_month');
      case 'year':
        return context.tr('this_year');
      case 'all':
        return context.tr('grand_report');
      case 'custom':
        final rp = context.read<ReportProvider>();
        if (rp.fromDate != null && rp.toDate != null) {
          return '${DateFormat('MMM d, y').format(rp.fromDate!)} - ${DateFormat('MMM d, y').format(rp.toDate!)}';
        }
        return context.tr('custom_date');
      default:
        return period;
    }
  }

  Widget _buildBreakdownSection({
    required String title,
    required IconData icon,
    required List<({String id, String name, String subtitle, double amount})> rows,
    required void Function(String id) onTap,
    String? highlightId,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: _kBlue, size: 18),
              const SizedBox(width: 8),
              Text(title, style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: _kInk)),
            ],
          ),
          const SizedBox(height: 12),
          if (rows.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(context.tr('no_data_available'), style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
            )
          else
            ...rows.map((r) {
              final isHighlight = r.id.isNotEmpty && r.id == highlightId;
              return InkWell(
                onTap: () => onTap(r.id),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                  decoration: isHighlight
                      ? BoxDecoration(color: _kBlue.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(8))
                      : null,
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(r.name,
                                style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600,
                                    color: isHighlight ? _kBlue : _kInk)),
                            const SizedBox(height: 2),
                            Text(r.subtitle, style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                          ],
                        ),
                      ),
                      Text('ETB ${r.amount.toStringAsFixed(0)}',
                          style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: _kInk)),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  ReportSection _buildTotalProfitsExportSection(Map<String, dynamic> analytics) {
    final s = analytics['summary'] ?? <String, dynamic>{};
    final totalRevenue = _toDouble(s['totalRevenue']);
    final totalSubtotal = _toDouble(s['totalSubtotal']);
    final totalCogs = _toDouble(s['totalCogs']);
    final totalExpense = _toDouble(s['totalExpense']);
    final totalCommission = _toDouble(s['totalCommission']);
    final totalCredit = _toDouble(s['totalCredit']);
    final creditCollected = _toDouble(s['creditCollected']);
    final outstandingCredit = _toDouble(s['outstandingCredit']);
    final totalTax = _toDouble(s['totalTax']);
    final totalDiscount = _toDouble(s['totalDiscount']);
    final netSalesRevenue = totalSubtotal > 0
        ? (totalSubtotal - totalDiscount).clamp(0.0, double.infinity).toDouble()
        : _toDouble(s['netSalesRevenue']);
    final grossProfit = netSalesRevenue - totalCogs;
    final grossMargin = netSalesRevenue > 0 ? grossProfit / netSalesRevenue * 100 : 0.0;
    final netProfit = grossProfit - totalExpense - totalCommission;
    final netMargin = netSalesRevenue > 0 ? netProfit / netSalesRevenue * 100 : 0.0;
    final cashProfit = (totalRevenue - totalCredit) + creditCollected - totalCogs - totalExpense - totalCommission;
    final totalBorrowings = _toInt(s['totalBorrowings']);
    final unreturnedBorrowings = _toInt(s['unreturnedBorrowingCount']);

    return ReportSection(
      title: context.tr('total_profit_report'),
      columns: ['Component', 'Formula / Metric', 'Amount (ETB)'],
      rows: [
        ['Gross Sales Revenue (+)', 'Total billed invoices', totalRevenue.toStringAsFixed(2)],
        ['Cost of Goods Sold (-)', 'Cost price of goods sold', '-${totalCogs.toStringAsFixed(2)}'],
        ['Gross Profit (=)', 'Sale price after discount − cost price (${grossMargin.toStringAsFixed(1)}% margin)', grossProfit.toStringAsFixed(2)],
        ['Operational Expenses (-)', 'Recorded business expenses', '-${totalExpense.toStringAsFixed(2)}'],
        ['Sales Commissions (-)', 'Staff sales commissions paid', '-${totalCommission.toStringAsFixed(2)}'],
        ['Net Total Profit (=)', 'Gross Profit − Expenses − Commission (${netMargin.toStringAsFixed(1)}% margin)', netProfit.toStringAsFixed(2)],
        ['Credit Issued (Uncollected)', 'Credit sales balance', totalCredit.toStringAsFixed(2)],
        ['Credit Collected (Cash Inflow)', 'Debt payments recovered', '+${creditCollected.toStringAsFixed(2)}'],
        ['Active Outstanding Debt', 'Total unpaid customer accounts', outstandingCredit.toStringAsFixed(2)],
        ['Realized Cash Profit', '(Revenue − Credit) + Collected − Expenses − Purchases − Commission', cashProfit.toStringAsFixed(2)],
        ['Total Sales Tax', 'Tax collected', totalTax.toStringAsFixed(2)],
        ['Total Discounts', 'Discounts granted', totalDiscount.toStringAsFixed(2)],
        ['Product Borrowings', '$totalBorrowings requests ($unreturnedBorrowings unreturned items)', '$unreturnedBorrowings items'],
      ],
    );
  }

  Widget _buildTotalProfitsReport(Map<String, dynamic>? analytics, ReportProvider rp) {
    final s = analytics?['summary'] ?? <String, dynamic>{};
    final totalRevenue = _toDouble(s['totalRevenue']);
    final totalSubtotal = _toDouble(s['totalSubtotal']);
    final totalCogs = _toDouble(s['totalCogs']);
    final totalExpense = _toDouble(s['totalExpense']);
    final totalCommission = _toDouble(s['totalCommission']);
    final totalCredit = _toDouble(s['totalCredit']);
    final creditCollected = _toDouble(s['creditCollected']);
    final outstandingCredit = _toDouble(s['outstandingCredit']);
    final totalDiscount = _toDouble(s['totalDiscount']);
    final netSalesRevenue = totalSubtotal > 0
        ? (totalSubtotal - totalDiscount).clamp(0.0, double.infinity).toDouble()
        : _toDouble(s['netSalesRevenue']);
    final grossProfit = netSalesRevenue - totalCogs;
    final grossMargin = netSalesRevenue > 0 ? (grossProfit / netSalesRevenue) * 100 : 0.0;
    final netProfit = grossProfit - totalExpense - totalCommission;
    final netMargin = netSalesRevenue > 0 ? (netProfit / netSalesRevenue) * 100 : 0.0;
    final cashProfit = ((totalRevenue - totalCredit) + creditCollected - totalCogs - totalExpense - totalCommission);
    final totalTax = _toDouble(s['totalTax']);
    final totalAdvance = _toDouble(s['totalAdvance']);
    final totalBorrowings = _toInt(s['totalBorrowings']);
    final unreturnedBorrowings = _toInt(s['unreturnedBorrowingCount']);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Executive Header Banner ──
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.12),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.trending_up, size: 14, color: Color(0xFF34D399)),
                        const SizedBox(width: 4),
                        Text(
                          'P&L Statement',
                          style: GoogleFonts.outfit(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF34D399),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  Text(
                    'Net Margin: ${netMargin.toStringAsFixed(1)}%',
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: netProfit >= 0 ? const Color(0xFF34D399) : const Color(0xFFF87171),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                'ETB ${_formatAmount(netProfit)}',
                style: GoogleFonts.outfit(
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  color: netProfit >= 0 ? Colors.white : const Color(0xFFF87171),
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Comprehensive Net Total Profit',
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  color: const Color(0xFF94A3B8),
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Gross Margin', style: GoogleFonts.outfit(fontSize: 10, color: const Color(0xFF94A3B8))),
                          const SizedBox(height: 2),
                          Text('${grossMargin.toStringAsFixed(1)}%', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: const Color(0xFF93C5FD))),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Cash Profit', style: GoogleFonts.outfit(fontSize: 10, color: const Color(0xFF94A3B8))),
                          const SizedBox(height: 2),
                          Text('ETB ${_formatAmount(cashProfit)}', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: cashProfit >= 0 ? const Color(0xFF6EE7B7) : const Color(0xFFFCA5A5))),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ── Primary 6 Metric Cards ──
        _SectionLabel('PROFIT & LOSS BREAKDOWN'),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: _StatCard(label: '1. Revenue', value: 'ETB ${_formatAmount(totalRevenue)}', color: _kBlue)),
            const SizedBox(width: 10),
            Expanded(child: _StatCard(label: '2. Cost of Goods Sold', value: 'ETB ${_formatAmount(totalCogs)}', color: _kAmber)),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: _StatCard(label: '3. Gross Profit', value: 'ETB ${_formatAmount(grossProfit)}', color: grossProfit >= 0 ? const Color(0xFF4F46E5) : _kRed)),
            const SizedBox(width: 10),
            Expanded(child: _StatCard(label: '4. Expenses', value: 'ETB ${_formatAmount(totalExpense)}', color: _kRed)),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: _StatCard(label: '5. Commissions', value: 'ETB ${_formatAmount(totalCommission)}', color: const Color(0xFF9333EA))),
            const SizedBox(width: 10),
            Expanded(child: _StatCard(label: '6. Net Profit', value: 'ETB ${_formatAmount(netProfit)}', color: netProfit >= 0 ? _kGreen : _kRed)),
          ],
        ),
        const SizedBox(height: 16),

        // ── Accounting Derivation Statement ──
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: _kBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.receipt_long_outlined, size: 18, color: _kBlue),
                  const SizedBox(width: 8),
                  Text(
                    'Profit Calculation Statement',
                    style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: _kInk),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _buildDerivationRow(label: 'Gross Sales Revenue', note: 'Billed sales', amount: totalRevenue, sign: '+', color: _kBlue),
              const Divider(height: 16),
              _buildDerivationRow(label: 'Cost of Goods Sold', note: 'Cost price of goods sold', amount: totalCogs, sign: '−', color: _kAmber),
              const Divider(height: 16),
              _buildDerivationRow(label: 'Gross Profit', note: 'Sale price after discount − cost price (${grossMargin.toStringAsFixed(1)}%)', amount: grossProfit, sign: '=', color: const Color(0xFF4F46E5), isBold: true),
              const Divider(height: 16),
              _buildDerivationRow(label: 'Operational & Bank Expenses', note: 'Operating costs', amount: totalExpense, sign: '−', color: _kRed),
              const Divider(height: 16),
              _buildDerivationRow(label: 'Staff Commissions', note: 'Sales rep commissions', amount: totalCommission, sign: '−', color: const Color(0xFF9333EA)),
              const Divider(height: 16),
              _buildDerivationRow(label: 'Net Total Profit', note: 'Gross Profit − Expenses − Commission', amount: netProfit, sign: '=', color: netProfit >= 0 ? _kGreen : _kRed, isBold: true),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ── Credit & Cash Flow Realization Card ──
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: _kBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.account_balance_wallet_outlined, size: 18, color: Color(0xFF059669)),
                  const SizedBox(width: 8),
                  Text(
                    'Credit & Cash Flow Adjustment',
                    style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: _kInk),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _buildMiniStat(
                      title: 'Credit Extended',
                      value: 'ETB ${_formatAmount(totalCredit)}',
                      subtitle: 'Uncollected sales balance',
                      color: const Color(0xFF6366F1),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildMiniStat(
                      title: 'Credit Recovered',
                      value: 'ETB ${_formatAmount(creditCollected)}',
                      subtitle: 'Cash debt payments in period',
                      color: _kGreen,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: _buildMiniStat(
                      title: 'Active Total Debt',
                      value: 'ETB ${_formatAmount(outstandingCredit)}',
                      subtitle: 'Total unpaid debt balance',
                      color: _kRed,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildMiniStat(
                      title: 'Realized Cash Profit',
                      value: 'ETB ${_formatAmount(cashProfit)}',
                      subtitle: 'Net physical cash in hand',
                      color: cashProfit >= 0 ? _kGreen : _kRed,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ── Additional Operational Metrics ──
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: _kBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.tune_outlined, size: 18, color: _kSlate),
                  const SizedBox(width: 8),
                  Text(
                    'Additional Metrics & Risk Factors',
                    style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: _kInk),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _buildMiniStat(
                      title: 'Total Tax',
                      value: 'ETB ${_formatAmount(totalTax)}',
                      subtitle: 'Tax liability recorded',
                      color: _kSlate,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildMiniStat(
                      title: 'Discounts Granted',
                      value: 'ETB ${_formatAmount(totalDiscount)}',
                      subtitle: 'Price reductions given',
                      color: const Color(0xFFD97706),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: _buildMiniStat(
                      title: 'Advance Received',
                      value: 'ETB ${_formatAmount(totalAdvance)}',
                      subtitle: 'Upfront customer prepayments',
                      color: _kBlue,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildMiniStat(
                      title: 'Product Borrowings',
                      value: '$unreturnedBorrowings items',
                      subtitle: '$totalBorrowings total borrowing requests',
                      color: unreturnedBorrowings > 0 ? _kRed : _kGreen,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ── Chart ──
        _buildChart(analytics, rp.period),
      ],
    );
  }

  Widget _buildDerivationRow({
    required String label,
    required String note,
    required double amount,
    required String sign,
    required Color color,
    bool isBold = false,
  }) {
    return Row(
      children: [
        Container(
          width: 24,
          height: 24,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            sign,
            style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: color),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: GoogleFonts.outfit(
                  fontSize: isBold ? 14 : 13,
                  fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
                  color: _kInk,
                ),
              ),
              Text(
                note,
                style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
              ),
            ],
          ),
        ),
        Text(
          '${sign == '−' ? '−' : ''}ETB ${_formatAmount(amount)}',
          style: GoogleFonts.outfit(
            fontSize: isBold ? 14 : 13,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
            color: color,
          ),
        ),
      ],
    );
  }

  Widget _buildMiniStat({
    required String title,
    required String value,
    required String subtitle,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600, color: _kSlate),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: color),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: GoogleFonts.outfit(fontSize: 9.5, color: const Color(0xFF94A3B8)),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _HubKpiCard extends StatelessWidget {
  final Color background;
  final Color iconBackground;
  final IconData icon;
  final Color iconColor;
  final String amount;
  final String subtitle;
  final VoidCallback onTap;

  const _HubKpiCard({
    required this.background,
    required this.iconBackground,
    required this.icon,
    required this.iconColor,
    required this.amount,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(16),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Stack(
              children: [
                Positioned(
                  right: -8,
                  bottom: -12,
                  child: Icon(Icons.waves_rounded, size: 72, color: iconBackground.withValues(alpha: 0.12)),
                ),
                Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: iconBackground,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(icon, color: iconColor, size: 20),
                          ),
                          const Spacer(),
                          Icon(Icons.chevron_right, color: _kSlate.withValues(alpha: 0.6), size: 22),
                        ],
                      ),
                      const SizedBox(height: 12),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Text(
                          amount,
                          style: GoogleFonts.outfit(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: _kInk,
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.outfit(fontSize: 12, color: _kSlate, height: 1.3),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _HubReportTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool showDivider;

  const _HubReportTile({
    required this.icon,
    required this.label,
    required this.onTap,
    required this.showDivider,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFF2563EB).withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: const Color(0xFF2563EB), size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    label,
                    style: GoogleFonts.outfit(
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                      color: _kInk,
                    ),
                  ),
                ),
                Icon(Icons.chevron_right, color: _kSlate.withValues(alpha: 0.5), size: 22),
              ],
            ),
          ),
        ),
        if (showDivider)
          Divider(height: 1, thickness: 1, color: _kBorder.withValues(alpha: 0.8), indent: 70),
      ],
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel(this.label);

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: GoogleFonts.outfit(
        fontSize: 11,
        fontWeight: FontWeight.bold,
        letterSpacing: 1.2,
        color: _kSlate,
      ),
    );
  }
}

class _FilterButton extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _FilterButton({required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          decoration: BoxDecoration(
            color: active ? _kBlue.withValues(alpha: 0.08) : Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: active ? _kBlue : _kBorder, width: active ? 1.5 : 1),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.arrow_drop_down, color: active ? _kBlue : _kSlate, size: 18),
              const SizedBox(width: 2),
              Flexible(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: active ? _kBlue : _kSlate,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FilterChipWidget extends StatelessWidget {
  final String label;
  final VoidCallback onRemove;
  const _FilterChipWidget({required this.label, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(left: 12, right: 6, top: 6, bottom: 6),
      decoration: BoxDecoration(
        color: _kBlue.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _kBlue.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: _kBlue)),
          const SizedBox(width: 4),
          GestureDetector(
            onTap: onRemove,
            child: const Icon(Icons.close, color: _kBlue, size: 16),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _StatCard({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
          const SizedBox(height: 6),
          Text(value, style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }
}

class _CreditStatTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? accent;

  const _CreditStatTile({
    required this.label,
    required this.value,
    required this.icon,
    this.accent,
  });

  @override
  Widget build(BuildContext context) {
    final color = accent ?? _kAmber;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(height: 8),
          Text(value, style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: _kInk)),
          const SizedBox(height: 2),
          Text(label, style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
        ],
      ),
    );
  }
}

class _CreditReportSaleCard extends StatelessWidget {
  final SaleModel sale;
  final VoidCallback onTap;

  const _CreditReportSaleCard({required this.sale, required this.onTap});

  String _formatDate(String? raw) {
    if (raw == null || raw.isEmpty) return '—';
    try {
      final dt = DateTime.parse(raw);
      return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
    } catch (_) {
      return raw;
    }
  }

  bool get _isSettled => sale.remainingBalance <= 0.01 || sale.isFullyPaid;

  bool get _isOverdue {
    if (_isSettled) return false;
    if (sale.dueDate == null || sale.dueDate!.isEmpty) return false;
    final dt = DateTime.tryParse(sale.dueDate!);
    return dt != null && dt.isBefore(DateTime.now()) && sale.remainingBalance > 0.01;
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _isOverdue ? _kRed.withValues(alpha: 0.4) : _kBorder),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: (_isSettled ? _kGreen : (_isOverdue ? _kRed : _kAmber)).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                _isSettled ? Icons.check_circle_outline : (_isOverdue ? Icons.warning_amber_rounded : Icons.credit_card_outlined),
                color: _isSettled ? _kGreen : (_isOverdue ? _kRed : _kAmber),
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    sale.customerName.isNotEmpty ? sale.customerName : context.tr('walk_in'),
                    style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${context.tr('due_date')}: ${_formatDate(sale.dueDate)}',
                    style: GoogleFonts.outfit(fontSize: 12, color: _isOverdue ? _kRed : _kSlate),
                  ),
                ],
              ),
            ),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    _isSettled ? 'Settled' : 'ETB ${sale.remainingBalance.toStringAsFixed(0)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: _isSettled ? _kGreen : _kRed),
                  ),
                  Text(
                    _isSettled ? context.tr('fully_paid') : context.tr('remaining_balance'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.outfit(fontSize: 10, color: _kSlate),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SaleCard extends StatelessWidget {
  final SaleModel sale;
  final VoidCallback onTap;
  const _SaleCard({required this.sale, required this.onTap});

  String _formatDate(String raw) {
    try {
      final dt = DateTime.parse(raw);
      return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
    } catch (_) {
      return raw;
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = sale.isFullyPaid
        ? _kGreen
        : sale.remainingBalance > 0.01
            ? _kAmber
            : _kGreen;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _kBorder),
        ),
        child: Row(
          children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(Icons.receipt_outlined, color: statusColor, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('#${sale.id.length >= 8 ? sale.id.substring(0, 8) : sale.id}',
                      style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk)),
                  const SizedBox(height: 2),
                  Text('${sale.customerName.isNotEmpty ? sale.customerName : context.tr('walk_in')} \u00b7 ${_formatDate(sale.saleDate)}',
                      style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                ],
              ),
            ),
            Flexible(
              child: Text('ETB ${sale.totalAmount.toStringAsFixed(0)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.end,
                  style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: _kInk)),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyBox extends StatelessWidget {
  final String message;
  const _EmptyBox({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.search_off, color: Color(0xFF94A3B8), size: 20),
          const SizedBox(width: 8),
          Flexible(child: Text(message, textAlign: TextAlign.center, style: GoogleFonts.outfit(fontSize: 13, color: _kSlate))),
        ],
      ),
    );
  }
}

class _ExportSheet extends StatelessWidget {
  final String title;
  final String subtitle;
  final String onCsv;
  final String onPdf;
  final String? onExcel;
  const _ExportSheet({
    required this.title,
    required this.subtitle,
    required this.onCsv,
    required this.onPdf,
    this.onExcel,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40, height: 4,
                decoration: BoxDecoration(color: _kBorder, borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
            ),
            const SizedBox(height: 20),
            _ExportOption(
              icon: Icons.table_chart_outlined,
              color: const Color(0xFF16A34A),
              label: context.tr('export_csv'),
              sublabel: context.tr('export_csv_desc'),
              onTap: () => Navigator.pop(context, onCsv),
            ),
            const SizedBox(height: 10),
            _ExportOption(
              icon: Icons.picture_as_pdf_outlined,
              color: const Color(0xFFDC2626),
              label: context.tr('export_pdf'),
              sublabel: context.tr('export_pdf_desc'),
              onTap: () => Navigator.pop(context, onPdf),
            ),
            if (onExcel != null) ...[
              const SizedBox(height: 10),
              _ExportOption(
                icon: Icons.grid_on_outlined,
                color: const Color(0xFF025EA7),
                label: context.tr('export_excel'),
                sublabel: context.tr('export_excel_desc'),
                onTap: () => Navigator.pop(context, onExcel),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ExportOption extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final String sublabel;
  final VoidCallback onTap;
  const _ExportOption({
    required this.icon,
    required this.color,
    required this.label,
    required this.sublabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, color: Colors.white, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: _kInk)),
                  const SizedBox(height: 2),
                  Text(sublabel, style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: _kSlate, size: 20),
          ],
        ),
      ),
    );
  }
}

class _BarChartPainter extends CustomPainter {
  final List<({String label, double value})> data;
  const _BarChartPainter({required this.data});

  @override
  void paint(Canvas canvas, Size size) {
    final maxVal = data.map((d) => d.value).reduce(max);
    final barWidth = size.width / (data.length * 1.6);
    final paint = Paint()..color = const Color(0xFF3B82F6);

    for (var i = 0; i < data.length; i++) {
      final barHeight = maxVal == 0 ? 0.0 : (data[i].value / maxVal) * (size.height - 16);
      final x = i * (size.width / data.length) + (size.width / data.length - barWidth) / 2;
      final rect = RRect.fromRectAndRadius(
        Rect.fromLTWH(x, size.height - barHeight, barWidth, barHeight),
        const Radius.circular(4),
      );
      canvas.drawRRect(rect, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _BarChartPainter oldDelegate) => oldDelegate.data != data;
}

class _ReportSummaryPill extends StatelessWidget {
  final String label;
  final double value;
  final Color color;
  const _ReportSummaryPill({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            '$label: ETB ${value.toStringAsFixed(0)}',
            style: GoogleFonts.outfit(fontSize: 12, color: Colors.white.withValues(alpha: 0.9)),
          ),
        ],
      ),
    );
  }
}
