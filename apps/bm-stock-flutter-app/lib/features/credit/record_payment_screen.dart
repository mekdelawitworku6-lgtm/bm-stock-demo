import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/bloc/sale/sale_bloc.dart';
import '../../core/bloc/auth/auth_bloc.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/sale_model.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/providers/report_provider.dart';
import '../../core/providers/dashboard_provider.dart';
import '../../core/blocs/company/company_bloc.dart';
import '../../core/blocs/company/company_state.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kRed = Color(0xFFDC2626);
const _kGreen = Color(0xFF16A34A);

class RecordPaymentScreen extends StatefulWidget {
  final String? saleId;
  final List<SaleModel>? sales;
  final String customerName;
  final double amountDue;

  const RecordPaymentScreen({
    super.key,
    this.saleId,
    this.sales,
    required this.customerName,
    required this.amountDue,
  });

  @override
  State<RecordPaymentScreen> createState() => _RecordPaymentScreenState();
}

class _RecordPaymentScreenState extends State<RecordPaymentScreen> {
  String _paymentMethod = 'cash';
  final _amountController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _amountController.text = '';
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final enteredAmount = double.tryParse(_amountController.text) ?? 0;
    final invoiceSubtitle = widget.sales != null && widget.sales!.isNotEmpty
        ? '${widget.sales!.length} invoice${widget.sales!.length > 1 ? 's' : ''}'
        : (widget.saleId != null && widget.saleId!.length >= 8
            ? '${context.tr('invoice')} #${widget.saleId!.substring(0, 8)}'
            : context.tr('invoice'));

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
        title: Text(
          context.tr('pay'),
          style: GoogleFonts.outfit(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: _kInk,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Customer info
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _kBorder),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: _kBlue.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.person_outline, color: _kBlue, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.customerName,
                          style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w600, color: _kInk)),
                        const SizedBox(height: 2),
                        Text(invoiceSubtitle,
                          style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Amount received - red highlighted
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: _kRed.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _kRed.withValues(alpha: 0.2)),
              ),
              child: Column(
                children: [
                  Text(context.tr('amount_received'),
                    style: GoogleFonts.outfit(fontSize: 14, color: _kSlate, fontWeight: FontWeight.w500)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _amountController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(
                      fontSize: 36,
                      fontWeight: FontWeight.bold,
                      color: _kRed,
                    ),
                    decoration: InputDecoration(
                      prefixText: 'ETB ',
                      prefixStyle: GoogleFonts.outfit(
                        fontSize: 36,
                        fontWeight: FontWeight.bold,
                        color: _kRed.withValues(alpha: 0.6),
                      ),
                      border: InputBorder.none,
                      hintText: '0.00',
                      hintStyle: GoogleFonts.outfit(
                        fontSize: 36,
                        fontWeight: FontWeight.bold,
                        color: _kRed.withValues(alpha: 0.3),
                      ),
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 4),
                  Text(context.tr('of_amount_due').replaceAll('{amount}', widget.amountDue.toStringAsFixed(2)),
                    style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
                  if (enteredAmount > widget.amountDue + 0.01) ...[
                    const SizedBox(height: 6),
                    Text(
                      context.tr('amount_exceeds_balance'),
                      style: GoogleFonts.outfit(fontSize: 12, color: _kRed, fontWeight: FontWeight.w500),
                    ),
                  ],
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _QuickAmountBtn(
                        label: 'Full Amount',
                        onTap: () {
                          setState(() => _amountController.text = widget.amountDue.toStringAsFixed(2));
                        },
                      ),
                      const SizedBox(width: 8),
                      _QuickAmountBtn(
                        label: 'Half',
                        onTap: () {
                          setState(() => _amountController.text = (widget.amountDue / 2).toStringAsFixed(2));
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // Payment method
            Text(context.tr('payment_method'),
              style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
            const SizedBox(height: 12),
            Row(
              children: [
                _MethodChip(
                  icon: Icons.money_outlined,
                  label: context.tr('cash'),
                  selected: _paymentMethod == 'cash',
                  onTap: () => setState(() => _paymentMethod = 'cash'),
                ),
                const SizedBox(width: 10),
                _MethodChip(
                  icon: Icons.phone_android_outlined,
                  label: context.tr('mobile_money'),
                  selected: _paymentMethod == 'mobile_money',
                  onTap: () => setState(() => _paymentMethod = 'mobile_money'),
                ),
                const SizedBox(width: 10),
                _MethodChip(
                  icon: Icons.account_balance_outlined,
                  label: context.tr('transfer'),
                  selected: _paymentMethod == 'bank_transfer',
                  onTap: () => setState(() => _paymentMethod = 'bank_transfer'),
                ),
              ],
            ),
            const SizedBox(height: 32),

            // Confirm button
            ElevatedButton(
              onPressed: (_isSubmitting || enteredAmount <= 0 || enteredAmount > widget.amountDue + 0.01) ? null : () async {
                setState(() => _isSubmitting = true);
                try {
                  final userId = context.read<AuthBloc>().user?.id;

                  if (widget.sales != null && widget.sales!.isNotEmpty) {
                    // Bulk payment across multiple customer sales (oldest first)
                    var remainingToPay = enteredAmount;
                    final sortedSales = List<SaleModel>.from(widget.sales!)
                      ..sort((a, b) => a.saleDate.compareTo(b.saleDate));

                    for (final sale in sortedSales) {
                      if (remainingToPay <= 0.001) break;
                      if (sale.remainingBalance <= 0.01) continue;
                      final payAmount = remainingToPay < sale.remainingBalance ? remainingToPay : sale.remainingBalance;
                      final paymentData = <String, dynamic>{
                        'saleId': sale.id,
                        'amount': payAmount,
                        'paymentMethod': _paymentMethod,
                        'transactionType': 'sale',
                      };
                      if (userId != null && userId.isNotEmpty) {
                        paymentData['processedBy'] = userId;
                      }
                      context.read<SaleBloc>().add(SalePaymentApplied(saleId: sale.id, data: paymentData));
                      remainingToPay -= payAmount;
                    }
                  } else if (widget.saleId != null && widget.saleId!.isNotEmpty) {
                    // Single sale payment
                    final paymentData = <String, dynamic>{
                      'saleId': widget.saleId!,
                      'amount': enteredAmount,
                      'paymentMethod': _paymentMethod,
                      'transactionType': 'sale',
                    };
                    if (userId != null && userId.isNotEmpty) {
                      paymentData['processedBy'] = userId;
                    }
                    context.read<SaleBloc>().add(SalePaymentApplied(saleId: widget.saleId!, data: paymentData));
                  }

                  final result = await context.read<SaleBloc>().stream.firstWhere((s) => !s.isLoading);
                  final success = result.lastActionSuccess == true;
                  if (mounted) {
                    showAppToast(
                      context,
                      success ? 'Payment recorded successfully' : 'Payment failed',
                      type: success ? AppToastType.success : AppToastType.error,
                    );
                    if (success) {
                      // Reload report and dashboard data so settled credits update immediately
                      try {
                        final companyState = context.read<CompanyBloc>().state;
                        final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
                        context.read<ReportProvider>().loadAnalytics(companyId: companyId);
                        context.read<DashboardProvider>().loadDashboard(companyId: companyId);
                      } catch (_) {}
                      Navigator.pop(context, true);
                    }
                  }
                } catch (e) {
                  if (mounted) {
                    showAppToast(context, '${context.tr('error')}: $e', type: AppToastType.error);
                  }
                }
                if (mounted) setState(() => _isSubmitting = false);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: _kGreen,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                disabledBackgroundColor: _kGreen.withValues(alpha: 0.5),
              ),
              child: _isSubmitting
                  ? const SizedBox(width: 20, height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(context.tr('confirm_payment'),
                      style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
            ),
          ],
        ),
      ),
    );
  }
}

class _MethodChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _MethodChip({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: selected ? _kBlue.withValues(alpha: 0.08) : Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected ? _kBlue : _kBorder,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Column(
            children: [
              Icon(icon, size: 22, color: selected ? _kBlue : _kSlate),
              const SizedBox(height: 6),
              Text(label,
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                  color: selected ? _kBlue : _kSlate,
                )),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickAmountBtn extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _QuickAmountBtn({required this.label, required this.onTap});

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
