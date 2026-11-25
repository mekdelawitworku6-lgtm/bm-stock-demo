import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/customer_model.dart';
import '../../core/models/sale_model.dart';
import '../../core/services/customer_service.dart';
import '../../core/services/report_export_service.dart';
import '../../core/services/sale_service.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/widgets/refreshable_scroll.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kRed = Color(0xFFDC2626);
const _kGreen = Color(0xFF16A34A);

class CustomerReportScreen extends StatefulWidget {
  final CustomerModel customer;

  const CustomerReportScreen({super.key, required this.customer});

  @override
  State<CustomerReportScreen> createState() => _CustomerReportScreenState();
}

class _CustomerReportScreenState extends State<CustomerReportScreen> {
  final _customerService = CustomerService();
  final _saleService = SaleService();

  late CustomerModel _customer;
  List<SaleModel> _sales = [];
  final Map<String, List<Map<String, dynamic>>> _paymentHistory = {};
  bool _loading = true;
  bool _exporting = false;

  @override
  void initState() {
    super.initState();
    _customer = widget.customer;
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final customer = await _customerService.getById(_customer.id);
      final sales = await _saleService.getAll(customerId: _customer.id, limit: 300);
      final history = <String, List<Map<String, dynamic>>>{};
      for (final sale in sales.where((s) => s.paymentType == 'credit' || s.remainingBalance > 0)) {
        try {
          history[sale.id] = await _saleService.getPaymentHistory(sale.id);
        } catch (_) {
          history[sale.id] = [];
        }
      }
      if (!mounted) return;
      setState(() {
        _customer = customer;
        _sales = sales;
        _paymentHistory
          ..clear()
          ..addAll(history);
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  double get _totalSales => _sales.fold(0.0, (s, sale) => s + sale.totalAmount);

  double get _paidAmount => _sales.fold(0.0, (s, sale) => s + sale.advancePayment + (sale.totalAmount - sale.remainingBalance).clamp(0, sale.totalAmount));

  double get _creditTotal => _sales.where((s) => s.paymentType == 'credit' || s.remainingBalance > 0).fold(0.0, (s, sale) => s + sale.totalAmount);

  double get _remaining => _sales.fold(0.0, (s, sale) => s + sale.remainingBalance);

  List<Map<String, dynamic>> get _allPayments {
    final list = <Map<String, dynamic>>[];
    for (final entry in _paymentHistory.entries) {
      for (final p in entry.value) {
        list.add({...p, 'saleId': entry.key});
      }
    }
    list.sort((a, b) {
      final da = DateTime.tryParse('${a['transactionDate'] ?? a['createdAt'] ?? ''}') ?? DateTime(1970);
      final db = DateTime.tryParse('${b['transactionDate'] ?? b['createdAt'] ?? ''}') ?? DateTime(1970);
      return db.compareTo(da);
    });
    return list;
  }

  Future<void> _export(String format) async {
    setState(() => _exporting = true);
    try {
      final sections = <ReportSection>[
        ReportSection(
          title: context.tr('customer'),
          columns: [context.tr('field'), context.tr('value')],
          rows: [
            [context.tr('name'), _customer.name],
            [context.tr('phone_number'), _customer.displayPhone],
            [context.tr('address'), _customer.address ?? '—'],
          ],
        ),
        ReportSection(
          title: context.tr('summary'),
          columns: [context.tr('summary'), 'ETB'],
          rows: [
            [context.tr('sales'), _totalSales.toStringAsFixed(2)],
            [context.tr('paid'), _paidAmount.toStringAsFixed(2)],
            [context.tr('credit'), _creditTotal.toStringAsFixed(2)],
            [context.tr('remaining_balance'), _remaining.toStringAsFixed(2)],
          ],
        ),
        ReportSection(
          title: context.tr('sales'),
          columns: [context.tr('date'), context.tr('invoice'), context.tr('amount'), context.tr('status')],
          rows: _sales.map((s) => [s.saleDate, s.invoiceNumber ?? s.id.substring(0, 8), s.totalAmount.toStringAsFixed(2), s.status]).toList(),
        ),
        ReportSection(
          title: context.tr('payment_history'),
          columns: [context.tr('date'), context.tr('amount'), 'Sale ID'],
          rows: _allPayments.map((p) => [
            '${p['transactionDate'] ?? p['createdAt'] ?? ''}',
            '${p['amount'] ?? p['paymentAmount'] ?? 0}',
            '${p['saleId'] ?? ''}',
          ]).toList(),
        ),
      ];

      final fileName = 'customer_report_${_customer.name.replaceAll(' ', '_')}.$format';
      final Uint8List bytes;
      if (format == 'pdf') {
        bytes = await ReportExportService.buildPdf(context, '${context.tr('customer_report')} — ${_customer.name}', sections);
      } else if (format == 'xlsx') {
        bytes = ReportExportService.buildExcel('Customer Report', sections);
      } else {
        bytes = ReportExportService.buildCsv('Customer Report', sections);
      }
      await ReportExportService.shareBytes(bytes, fileName);
    } catch (e) {
      if (mounted) showAppToast(context, '${context.tr('export_failed')}: $e', type: AppToastType.error);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _showExport() async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: ['PDF', 'Excel', 'CSV'].map((f) => ListTile(
            title: Text(f, style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
            onTap: () => Navigator.pop(context, f.toLowerCase() == 'excel' ? 'xlsx' : f.toLowerCase()),
          )).toList(),
        ),
      ),
    );
    if (choice != null) await _export(choice);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(context.tr('customer_report'), style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk)),
        actions: [
          IconButton(
            onPressed: _exporting ? null : _showExport,
            icon: _exporting
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.ios_share, color: _kBlue),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                physics: refreshScrollPhysics,
                padding: const EdgeInsets.all(16),
                children: [
                  _card(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_customer.name, style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
                        const SizedBox(height: 4),
                        Text(_customer.displayPhone, style: GoogleFonts.outfit(color: _kSlate)),
                        if (_customer.address != null && _customer.address!.isNotEmpty)
                          Text(_customer.address!, style: GoogleFonts.outfit(color: _kSlate, fontSize: 13)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(child: _metric(context.tr('sales'), 'ETB ${_totalSales.toStringAsFixed(0)}', _kBlue)),
                      const SizedBox(width: 8),
                      Expanded(child: _metric(context.tr('paid'), 'ETB ${_paidAmount.toStringAsFixed(0)}', _kGreen)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(child: _metric(context.tr('credit'), 'ETB ${_creditTotal.toStringAsFixed(0)}', _kSlate)),
                      const SizedBox(width: 8),
                      Expanded(child: _metric(context.tr('remaining_balance'), 'ETB ${_remaining.toStringAsFixed(0)}', _kRed)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(context.tr('sales'), style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: _kInk)),
                  const SizedBox(height: 8),
                  if (_sales.isEmpty)
                    Text(context.tr('no_results_found'), style: GoogleFonts.outfit(color: _kSlate))
                  else
                    ..._sales.map((s) => _card(
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(s.invoiceNumber ?? '#${s.id.substring(0, 8)}', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                                    Text(s.saleDate, style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                                  ],
                                ),
                              ),
                              Text('ETB ${s.totalAmount.toStringAsFixed(2)}', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
                            ],
                          ),
                        )),
                  const SizedBox(height: 16),
                  Text(context.tr('payment_history'), style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: _kInk)),
                  const SizedBox(height: 8),
                  if (_allPayments.isEmpty)
                    Text(context.tr('no_results_found'), style: GoogleFonts.outfit(color: _kSlate))
                  else
                    ..._allPayments.map((p) => _card(
                          child: Row(
                            children: [
                              Expanded(child: Text('${p['transactionDate'] ?? p['createdAt'] ?? ''}', style: GoogleFonts.outfit(fontSize: 13))),
                              Text('ETB ${p['amount'] ?? p['paymentAmount'] ?? 0}', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: _kGreen)),
                            ],
                          ),
                        )),
                ],
              ),
            ),
    );
  }

  Widget _card({required Widget child}) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: _kBorder)),
      child: child,
    );
  }

  Widget _metric(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: _kBorder)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
          const SizedBox(height: 4),
          Text(value, style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }
}
