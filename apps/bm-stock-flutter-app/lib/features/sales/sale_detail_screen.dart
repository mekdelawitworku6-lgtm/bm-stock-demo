import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/bloc/sale/sale_bloc.dart';
import '../../core/bloc/auth/auth_bloc.dart';
import '../../core/blocs/company/company_bloc.dart';
import '../../core/blocs/company/company_state.dart';
import '../../core/providers/dashboard_provider.dart';
import '../../core/providers/report_provider.dart';
import '../../core/api/api_client.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/sale_model.dart';
import '../../core/widgets/app_toast.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kGreen = Color(0xFF16A34A);
const _kAmber = Color(0xFFD97706);
const _kRed = Color(0xFFDC2626);

class SaleDetailScreen extends StatefulWidget {
  final SaleModel sale;
  const SaleDetailScreen({super.key, required this.sale});

  @override
  State<SaleDetailScreen> createState() => _SaleDetailScreenState();
}

class _SaleDetailScreenState extends State<SaleDetailScreen> {
  SaleModel? _sale;
  List<Map<String, dynamic>> _paymentHistory = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _sale = widget.sale;
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    final bloc = context.read<SaleBloc>();
    final fresh = await bloc.getSale(widget.sale.id);
    var history = await bloc.getPaymentHistory(widget.sale.id);
    if (fresh is SaleModel) _sale = fresh;

    // Fallback: if server returned empty history but sale has recorded payments, synthesize history rows
    if (history.isEmpty && _sale != null) {
      final sale = _sale!;
      final advAmt = sale.advancePayment;
      final paidTotal = sale.computedAmountPaid;
      if (paidTotal > 0) {
        if (advAmt > 0 && paidTotal > advAmt + 0.01) {
          history = [
            {
              'amount': advAmt,
              'paymentMethod': sale.paymentType,
              'notes': 'Advance payment',
              'transactionDate': sale.saleDate,
              'transactionType': 'sale',
            },
            {
              'amount': paidTotal - advAmt,
              'paymentMethod': sale.paymentType,
              'notes': 'Repayment',
              'transactionDate': sale.saleDate,
              'transactionType': 'sale',
            },
          ];
        } else if (advAmt > 0) {
          history = [
            {
              'amount': advAmt,
              'paymentMethod': sale.paymentType,
              'notes': 'Advance payment',
              'transactionDate': sale.saleDate,
              'transactionType': 'sale',
            }
          ];
        } else {
          history = [
            {
              'amount': paidTotal,
              'paymentMethod': sale.paymentType,
              'notes': 'Initial payment',
              'transactionDate': sale.saleDate,
              'transactionType': 'sale',
            }
          ];
        }
      }
    }

    if (mounted) {
      setState(() {
        _paymentHistory = history;
        _loading = false;
      });
    }
  }

  void _showPaymentDialog() {
    final sale = _sale!;
    final amountController = TextEditingController();
    String paymentMethod = 'cash';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Text(context.tr('pay'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: _kInk)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: _kBg, borderRadius: BorderRadius.circular(10)),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(context.tr('amount_due'), style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
                      Text('ETB ${sale.remainingBalance.toStringAsFixed(2)}',
                          style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: _kRed)),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: amountController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    hintText: '0.00',
                    prefixText: 'ETB ',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: paymentMethod,
                  items: [
                    DropdownMenuItem(value: 'cash', child: Text(context.tr('cash'))),
                    DropdownMenuItem(value: 'mobile_money', child: Text(context.tr('mobile_money'))),
                    DropdownMenuItem(value: 'bank_transfer', child: Text(context.tr('bank_transfer'))),
                  ],
                  onChanged: (val) => setDialogState(() => paymentMethod = val!),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: Text(context.tr('cancel'))),
            TextButton(
              onPressed: () async {
                final amount = double.tryParse(amountController.text) ?? 0;
                if (amount <= 0) return;
                Navigator.pop(ctx);
                final userId = context.read<AuthBloc>().user?.id;
                final paymentData = <String, dynamic>{
                  'saleId': sale.id,
                  'amount': amount,
                  'paymentMethod': paymentMethod,
                  'transactionType': 'sale',
                };
                if (userId != null && userId.isNotEmpty) {
                  paymentData['processedBy'] = userId;
                }
                context.read<SaleBloc>().add(SalePaymentApplied(saleId: sale.id, data: paymentData));
                final result = await context.read<SaleBloc>().stream.firstWhere((s) => !s.isLoading);
                if (mounted) {
                  showAppToast(context, result.lastActionSuccess == true ? context.tr('payment_recorded') : context.tr('error'),
                      type: result.lastActionSuccess == true ? AppToastType.success : AppToastType.error);
                  if (result.lastActionSuccess == true) {
                    _refresh();
                    final companyState = context.read<CompanyBloc>().state;
                    final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
                    context.read<DashboardProvider>().loadDashboard(companyId: companyId);
                    context.read<ReportProvider>().loadAnalytics(companyId: companyId);
                  }
                }
              },
              child: Text(context.tr('pay'), style: GoogleFonts.outfit(color: _kBlue, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _sendReminder() async {
    context.read<SaleBloc>().add(SaleReminderSent(saleId: _sale!.id));
    final result = await context.read<SaleBloc>().stream.firstWhere((s) => !s.isLoading);
    if (mounted) {
      showAppToast(context, result.lastActionSuccess == true ? context.tr('reminder_sent') : context.tr('error'),
          type: result.lastActionSuccess == true ? AppToastType.success : AppToastType.error);
    }
  }

  String _formatCustomerName(BuildContext context, String customerName) {
    final name = customerName.trim();
    if (name.isEmpty ||
        name.toLowerCase() == 'walk-in' ||
        name.toLowerCase() == 'walk-in customer' ||
        name.toLowerCase() == 'walk in' ||
        name.toLowerCase() == 'walk in customer' ||
        name.toLowerCase() == 'default walk-in sale') {
      return context.tr('walk_in');
    }
    return name;
  }

  String _creditStatusLabel(BuildContext context, SaleModel sale) {
    switch (sale.creditStatusKey()) {
      case 'partially_paid':
        return context.tr('partially_paid');
      case 'paid':
        return context.tr('paid');
      default:
        return context.tr('not_paid');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _sale == null) {
      return Scaffold(
        backgroundColor: _kBg,
        appBar: AppBar(backgroundColor: Colors.white, title: Text(context.tr('sale_details'))),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final sale = _sale!;
    final invoiceRef = sale.invoiceNumber ?? sale.id.substring(0, 8).toUpperCase();

    return Scaffold(
      backgroundColor: _kBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 20),
          onPressed: () => Navigator.pop(context, true),
        ),
        title: Text(context.tr('sale_details'), style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
        actions: [
          IconButton(
            icon: const Icon(Icons.copy_outlined, color: _kSlate, size: 20),
            onPressed: () {
              Clipboard.setData(ClipboardData(text: invoiceRef));
              showAppToast(context, context.tr('invoice_id_copied'));
            },
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _refresh,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _sectionCard(
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(child: Text(invoiceRef, style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk))),
                              _statusBadge(_creditStatusLabel(context, sale), sale.creditStatusKey()),
                            ],
                          ),
                          const SizedBox(height: 12),
                          _infoRow(context.tr('date'), _formatDate(sale.saleDate)),
                          if (sale.dueDate != null && sale.dueDate!.isNotEmpty)
                            _infoRow(context.tr('due_date'), _formatDate(sale.dueDate!)),
                          if (sale.shopName != null && sale.shopName!.isNotEmpty)
                            _infoRow(context.tr('shop'), sale.shopName!)
                          else if (sale.warehouseName.isNotEmpty)
                            _infoRow(context.tr('warehouse'), sale.warehouseName),
                          if (sale.salespersonName != null && sale.salespersonName!.isNotEmpty)
                            _infoRow(context.tr('salesperson'), sale.salespersonName!),
                          _infoRow(context.tr('customer'), _formatCustomerName(context, sale.customerName)),
                          if (sale.customerPhone != null && sale.customerPhone!.isNotEmpty)
                            _infoRow(context.tr('phone'), sale.customerPhone!),
                          _infoRow(context.tr('payment_method'), sale.paymentType.replaceAll('_', ' ')),
                          if (sale.advancePayment > 0)
                            _infoRow(context.tr('advance_payment'), 'ETB ${sale.advancePayment.toStringAsFixed(2)}'),
                          if (sale.remainingBalance > 0)
                            _infoRow(context.tr('remaining_balance'), 'ETB ${sale.remainingBalance.toStringAsFixed(2)}'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (sale.items.isNotEmpty) ...[
                      _sectionCard(
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(context.tr('products'), style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: _kInk)),
                            const SizedBox(height: 12),
                            ...sale.items.map((item) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(item.productName, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600)),
                                        Text('${item.quantity} x ETB ${item.unitPrice.toStringAsFixed(2)}', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                                      ],
                                    ),
                                  ),
                                  Text('ETB ${item.total.toStringAsFixed(2)}', style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600)),
                                ],
                              ),
                            )),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    _sectionCard(
                      Column(
                        children: [
                          if (sale.subtotal > 0) ...[
                            _moneyRow(context.tr('subtotal'), sale.subtotal, _kInk),
                            const SizedBox(height: 8),
                          ],
                          if (sale.discountAmount > 0) ...[
                            _moneyRow(context.tr('discount'), sale.discountAmount, _kGreen),
                            const SizedBox(height: 8),
                          ],
                          _moneyRow(context.tr('total'), sale.totalAmount, _kInk, bold: true),
                          const SizedBox(height: 8),
                          if (sale.advancePayment > 0) ...[
                            _moneyRow(context.tr('advance_payment'), sale.advancePayment, _kBlue),
                            const SizedBox(height: 8),
                          ],
                          _moneyRow(context.tr('amount_paid'), sale.computedAmountPaid, _kGreen),
                          const SizedBox(height: 8),
                          _moneyRow(context.tr('remaining_balance'), sale.remainingBalance, sale.remainingBalance > 0 ? _kRed : _kInk, bold: sale.remainingBalance > 0),
                        ],
                      ),
                    ),
                    if (sale.receiptImageUrl != null && sale.receiptImageUrl!.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      _sectionCard(
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(context.tr('transaction_receipt'), style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 8),
                            Image.network(ApiClient().resolveMediaUrl(sale.receiptImageUrl!), fit: BoxFit.contain),
                          ],
                        ),
                      ),
                    ],
                    if (sale.canAcceptPayment) ...[
                      const SizedBox(height: 12),
                      SizedBox(
                        height: 48,
                        child: ElevatedButton.icon(
                          onPressed: _showPaymentDialog,
                          icon: const Icon(Icons.payment, color: Colors.white, size: 20),
                          label: Text(context.tr('pay'), style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: Colors.white)),
                          style: ElevatedButton.styleFrom(backgroundColor: _kGreen, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), elevation: 0),
                        ),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        onPressed: _sendReminder,
                        icon: const Icon(Icons.notifications_outlined, size: 18),
                        label: Text(context.tr('send_reminder')),
                      ),
                    ],
                    const SizedBox(height: 16),
                    _sectionCard(
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(context.tr('payment_history'), style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: _kInk)),
                          const SizedBox(height: 12),
                          if (_paymentHistory.isEmpty)
                            Text(context.tr('no_results_found'), style: GoogleFonts.outfit(fontSize: 14, color: _kSlate))
                          else
                            ..._paymentHistory.map((p) => _paymentRow(p)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _sectionCard(Widget child) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: _kBorder)),
      child: child,
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 110, child: Text(label, style: GoogleFonts.outfit(fontSize: 13, color: _kSlate))),
          Expanded(child: Text(value, style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w500, color: _kInk))),
        ],
      ),
    );
  }

  Widget _moneyRow(String label, double amount, Color color, {bool bold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: GoogleFonts.outfit(fontSize: 14, color: _kSlate)),
        Text('ETB ${amount.toStringAsFixed(2)}', style: GoogleFonts.outfit(fontSize: bold ? 16 : 14, fontWeight: bold ? FontWeight.bold : FontWeight.w600, color: color)),
      ],
    );
  }

  Widget _statusBadge(String label, String statusKey) {
    final color = statusKey == 'paid' ? _kGreen : statusKey == 'partially_paid' ? _kAmber : _kRed;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20), border: Border.all(color: color.withValues(alpha: 0.3))),
      child: Text(label, style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
    );
  }

  Widget _paymentRow(Map<String, dynamic> data) {
    final amount = (data['amount'] is num) ? (data['amount'] as num).toDouble() : double.tryParse('${data['amount']}') ?? 0;
    final method = (data['paymentMethod'] ?? '').toString().replaceAll('_', ' ');
    final date = '${data['transactionDate'] ?? data['createdAt'] ?? ''}';
    final notes = (data['notes'] ?? '').toString().trim();
    final processedByName = (data['processedByName'] ?? '').toString().trim();

    final isRepayment = notes.toLowerCase().contains('repay') || data['transactionType'] == 'repayment';
    final isAdvance = notes.toLowerCase().contains('advance');

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _kBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: _kGreen.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle_rounded, size: 18, color: _kGreen),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'ETB ${amount.toStringAsFixed(2)}',
                      style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: _kInk),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        if (method.isNotEmpty)
                          Text(
                            method.toUpperCase(),
                            style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600, color: _kSlate),
                          ),
                        if (notes.isNotEmpty) ...[
                          if (method.isNotEmpty)
                            Text(' • ', style: GoogleFonts.outfit(color: _kSlate)),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                            decoration: BoxDecoration(
                              color: (isRepayment ? _kBlue : isAdvance ? _kAmber : _kSlate).withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              notes,
                              style: GoogleFonts.outfit(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: isRepayment ? _kBlue : isAdvance ? _kAmber : _kSlate,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Divider(height: 1, color: _kBorder),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.access_time_rounded, size: 14, color: _kSlate),
                  const SizedBox(width: 5),
                  Text(
                    _formatDateTime(date),
                    style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w500, color: _kSlate),
                  ),
                ],
              ),
              if (processedByName.isNotEmpty)
                Row(
                  children: [
                    const Icon(Icons.person_outline, size: 14, color: _kSlate),
                    const SizedBox(width: 4),
                    Text(
                      processedByName,
                      style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                    ),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatDateTime(String date) {
    if (date.isEmpty) return '--';
    try {
      final dt = DateTime.parse(date).toLocal();
      final day = dt.day.toString().padLeft(2, '0');
      final month = dt.month.toString().padLeft(2, '0');
      final year = dt.year;
      final hourNum = dt.hour;
      final ampm = hourNum >= 12 ? 'PM' : 'AM';
      final hour12 = hourNum % 12 == 0 ? 12 : hourNum % 12;
      final minute = dt.minute.toString().padLeft(2, '0');
      return '$day/$month/$year $hour12:$minute $ampm';
    } catch (_) {
      return date;
    }
  }

  String _formatDate(String date) {
    if (date.isEmpty) return '--';
    try {
      final dt = DateTime.parse(date);
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return date;
    }
  }
}
