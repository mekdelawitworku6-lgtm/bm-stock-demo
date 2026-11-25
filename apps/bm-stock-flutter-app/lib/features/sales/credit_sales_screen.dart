import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/bloc/sale/sale_bloc.dart';
import '../../core/bloc/auth/auth_bloc.dart';
import '../../core/blocs/company/company_bloc.dart';
import '../../core/blocs/company/company_state.dart';
import '../../core/providers/dashboard_provider.dart';
import '../../core/providers/report_provider.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/sale_model.dart';
import '../../core/widgets/app_toast.dart';
import 'sale_detail_screen.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kAmber = Color(0xFFD97706);
const _kGreen = Color(0xFF16A34A);

bool _isWalkIn(String name) {
  final n = name.trim().toLowerCase();
  return n.isEmpty ||
      n == 'walk-in' ||
      n == 'walk-in customer' ||
      n == 'walk in' ||
      n == 'walk in customer' ||
      n == 'default walk-in sale';
}

class CreditSalesScreen extends StatefulWidget {
  const CreditSalesScreen({super.key});

  @override
  State<CreditSalesScreen> createState() => _CreditSalesScreenState();
}

class _CreditSalesScreenState extends State<CreditSalesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SaleBloc>().add(const SalesLoadRequested(limit: 200));
    });
  }

  void _showCollectPaymentDialog(SaleModel sale) {
    final amountController = TextEditingController(text: sale.remainingBalance.toStringAsFixed(2));
    String paymentMethod = 'cash';
    bool isSubmitting = false;

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
                // Sale info
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _kBg,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('#${sale.id.substring(0, 8)}', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk)),
                          Text('ETB ${sale.totalAmount.toStringAsFixed(2)}', style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(context.tr('customer'), style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                          Text(_isWalkIn(sale.customerName) ? context.tr('walk_in') : sale.customerName, style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Outstanding
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(context.tr('amount_due'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk)),
                    Text('ETB ${sale.remainingBalance.toStringAsFixed(2)}', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kAmber)),
                  ],
                ),
                const SizedBox(height: 16),

                // Amount
                Text(context.tr('amount_paid'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
                const SizedBox(height: 6),
                TextField(
                  controller: amountController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w600),
                  decoration: InputDecoration(
                    prefixText: 'ETB ',
                    prefixStyle: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w600, color: _kSlate),
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBlue, width: 1.5)),
                  ),
                ),
                const SizedBox(height: 8),
                // Quick amount buttons
                Row(
                  children: [
                    _QuickAmtBtn(label: 'Full', onTap: () => setDialogState(() => amountController.text = sale.remainingBalance.toStringAsFixed(2))),
                    const SizedBox(width: 6),
                    _QuickAmtBtn(label: 'Half', onTap: () => setDialogState(() => amountController.text = (sale.remainingBalance / 2).toStringAsFixed(2))),
                  ],
                ),
                const SizedBox(height: 16),

                // Payment method
                Text(context.tr('payment_method'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  initialValue: paymentMethod,
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBlue, width: 1.5)),
                  ),
                  items: [
                    DropdownMenuItem(value: 'cash', child: Text(context.tr('cash'))),
                    DropdownMenuItem(value: 'mobile_money', child: Text(context.tr('mobile_money'))),
                    DropdownMenuItem(value: 'bank_transfer', child: Text(context.tr('bank_transfer'))),
                    DropdownMenuItem(value: 'cheque', child: Text(context.tr('cheque'))),
                  ],
                  onChanged: (val) => setDialogState(() => paymentMethod = val!),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(context.tr('cancel'), style: GoogleFonts.outfit(color: _kSlate)),
            ),
            ElevatedButton(
              onPressed: isSubmitting
                  ? null
                  : () async {
                      final amount = double.tryParse(amountController.text) ?? 0;
                      if (amount <= 0) {
                        showAppToast(context, context.tr('required'));
                        return;
                      }
                      if (amount > sale.remainingBalance + 0.01) {
                        showAppToast(context, context.tr('amount_exceeds_balance'), type: AppToastType.error);
                        return;
                      }
                      setDialogState(() => isSubmitting = true);

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
                      final success = result.lastActionSuccess == true;

                      if (context.mounted) {
                        Navigator.pop(ctx);
                        showAppToast(context, success ? context.tr('payment_recorded') : 'Failed to collect payment',
                            type: success ? AppToastType.success : AppToastType.error);
                        if (success) {
                          _refreshSales();
                          final companyState = context.read<CompanyBloc>().state;
                          final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
                          context.read<DashboardProvider>().loadDashboard(companyId: companyId);
                          context.read<ReportProvider>().loadAnalytics(companyId: companyId);
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: _kGreen,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: isSubmitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(context.tr('save'), style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _refreshSales() async {
    context.read<SaleBloc>().add(const SalesLoadRequested(limit: 200));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(context.tr('credit_sales'), style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
      ),
      body: BlocBuilder<SaleBloc, SaleState>(
        builder: (context, state) {
          if (state.isLoading) return const Center(child: CircularProgressIndicator());

          // Filter to show unpaid or partially paid credit sales
          final creditSales = state.sales.where((s) =>
            (s.isCreditSale || s.remainingBalance > 0.01) && s.remainingBalance > 0.01
          ).toList();

          if (creditSales.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle_outline, size: 56, color: _kGreen.withValues(alpha: 0.5)),
                  const SizedBox(height: 12),
                  Text(context.tr('all_caught_up'), style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk)),
                  const SizedBox(height: 4),
                  Text(context.tr('no_results_found'), style: GoogleFonts.outfit(fontSize: 14, color: _kSlate)),
                ],
              ),
            );
          }

          // Calculate totals
          double totalOutstanding = 0;
          for (final s in creditSales) {
            totalOutstanding += s.remainingBalance;
          }

          return Column(
            children: [
              // Summary card
              Container(
                margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: _kAmber.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44, height: 44,
                      decoration: BoxDecoration(
                        color: _kAmber.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.credit_card_outlined, color: _kAmber, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${creditSales.length} ${context.tr('credit')}', style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk)),
                          Text('${context.tr('total')}: ETB ${totalOutstanding.toStringAsFixed(2)}', style: GoogleFonts.outfit(fontSize: 13, color: _kAmber)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Sales list
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _refreshSales,
                  child: ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    itemCount: creditSales.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) => _CreditSaleCard(
                      sale: creditSales[i],
                      onCollectPayment: () => _showCollectPaymentDialog(creditSales[i]),
                      onTap: () async {
                        final result = await Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => SaleDetailScreen(sale: creditSales[i])),
                        );
                        if (result == true) _refreshSales();
                      },
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _CreditSaleCard extends StatelessWidget {
  final SaleModel sale;
  final VoidCallback onCollectPayment;
  final VoidCallback onTap;
  const _CreditSaleCard({required this.sale, required this.onCollectPayment, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final effectiveAdvance = sale.advancePayment > 0 ? sale.advancePayment : (sale.totalAmount - sale.remainingBalance).clamp(0.0, sale.totalAmount);
    final paidPct = sale.totalAmount > 0 ? (effectiveAdvance / sale.totalAmount).clamp(0.0, 1.0) : 0.0;
    final isFullyPaid = sale.remainingBalance <= 0.01;
    final isPartiallyPaid = sale.status == 'partially_paid' || (effectiveAdvance > 0.01 && sale.remainingBalance > 0.01);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: isFullyPaid ? _kGreen.withValues(alpha: 0.3) : (isPartiallyPaid ? _kAmber.withValues(alpha: 0.3) : Colors.red.withValues(alpha: 0.3))),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: _kBlue.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.receipt_outlined, color: _kBlue, size: 20),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('#${sale.id.substring(0, 8)}', style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk)),
                      Text(_isWalkIn(sale.customerName) ? context.tr('walk_in') : sale.customerName, style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('ETB ${sale.totalAmount.toStringAsFixed(0)}', style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk)),
                    const SizedBox(height: 2),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: (isFullyPaid ? _kGreen : (isPartiallyPaid ? _kAmber : Colors.red)).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        isFullyPaid
                            ? context.tr('paid')
                            : (isPartiallyPaid ? context.tr('partially_paid') : context.tr('not_paid')),
                        style: GoogleFonts.outfit(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: isFullyPaid ? _kGreen : (isPartiallyPaid ? _kAmber : Colors.red),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 10),
            // Progress bar
            ClipRRect(
              borderRadius: BorderRadius.circular(3),
              child: LinearProgressIndicator(
                value: paidPct.toDouble(),
                backgroundColor: _kBorder,
                valueColor: AlwaysStoppedAnimation<Color>(isFullyPaid ? _kGreen : _kAmber),
                minHeight: 5,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('${context.tr('amount_paid')}: ETB ${effectiveAdvance.toStringAsFixed(2)}', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                Text('${context.tr('amount_due')}: ETB ${sale.remainingBalance.toStringAsFixed(2)}', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: _kAmber)),
              ],
            ),
            if (!isFullyPaid) ...[
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                height: 36,
                child: ElevatedButton(
                  onPressed: onCollectPayment,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kGreen,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    elevation: 0,
                  ),
                  child: Text(context.tr('pay'), style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _QuickAmtBtn extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _QuickAmtBtn({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: _kBlue.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: _kBlue.withValues(alpha: 0.2)),
        ),
        child: Text(label, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: _kBlue)),
      ),
    );
  }
}
