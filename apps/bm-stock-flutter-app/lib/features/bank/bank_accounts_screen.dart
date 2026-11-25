import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/blocs/company/company_bloc.dart';
import '../../core/blocs/company/company_state.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/providers/bank_account_provider.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/widgets/refreshable_scroll.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kRed = Color(0xFFDC2626);
const _kGreen = Color(0xFF16A34A);

class BankAccountsScreen extends StatefulWidget {
  const BankAccountsScreen({super.key});

  @override
  State<BankAccountsScreen> createState() => _BankAccountsScreenState();
}

class _BankAccountsScreenState extends State<BankAccountsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final companyState = context.read<CompanyBloc>().state;
      final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
      context.read<BankAccountProvider>().loadData(companyId: companyId);
    });
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
          icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Bank Accounts',
          style: GoogleFonts.outfit(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: _kInk,
          ),
        ),
      ),
      body: Consumer<BankAccountProvider>(
        builder: (context, provider, _) {
          Future<void> onRefresh() async {
            final companyState = context.read<CompanyBloc>().state;
            final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
            await provider.loadData(companyId: companyId);
          }

          return RefreshIndicator(
            onRefresh: onRefresh,
            child: SingleChildScrollView(
              physics: refreshScrollPhysics,
              padding: const EdgeInsets.all(16.0),
              child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildTotalBalanceCard(provider),
                const SizedBox(height: 12),
                _buildActionButtons(context),
                const SizedBox(height: 20),
                _buildYourAccountsSection(provider),
                const SizedBox(height: 20),
                _buildSummaryHeader(context),
                const SizedBox(height: 12),
                _buildSummaryBox(provider),
                const SizedBox(height: 12),
                _buildIncomeExpensesRow(provider),
                const SizedBox(height: 30),
              ],
            ),
          ),
        );
        },
      ),
    );
  }

  Widget _buildTotalBalanceCard(BankAccountProvider provider) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E60AA),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1E60AA).withValues(alpha: 0.25),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.tr('total_sales'),
            style: GoogleFonts.outfit(
              fontSize: 13,
              fontWeight: FontWeight.w400,
              color: Colors.white.withValues(alpha: 0.8),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Text(
                provider.isBalanceVisible
                    ? 'ETB ${provider.totalBalance.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}'
                    : 'ETB ••••••',
                style: GoogleFonts.outfit(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 10),
              GestureDetector(
                onTap: () => provider.toggleBalanceVisibility(),
                child: Icon(
                  provider.isBalanceVisible
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  color: Colors.white.withValues(alpha: 0.8),
                  size: 20,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: SizedBox(
            height: 48,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: _kBlue,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              icon: const Icon(Icons.add, size: 18),
              label: Text(
                'Add Account',
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              onPressed: () => _showAddAccountModal(context),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: SizedBox(
            height: 48,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              icon: const Icon(Icons.account_balance_wallet_outlined, size: 18),
              label: Text(
                'Add Balance',
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              onPressed: () => _showAddBalanceModal(context),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildYourAccountsSection(BankAccountProvider provider) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Bank Accounts',
          style: GoogleFonts.outfit(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: _kInk,
          ),
        ),
        const SizedBox(height: 10),
        if (provider.accounts.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _kBorder),
            ),
            child: Text(
              context.tr('no_results_found'),
              style: GoogleFonts.outfit(color: _kSlate, fontSize: 13),
              textAlign: TextAlign.center,
            ),
          )
        else
          ...provider.accounts.map((acc) {
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _kBorder),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: const BoxDecoration(
                      color: _kBlue,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        'Bank',
                        style: GoogleFonts.outfit(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          acc.bankName,
                          style: GoogleFonts.outfit(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: _kInk,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          acc.accountNumber,
                          style: GoogleFonts.outfit(
                            fontSize: 12,
                            color: _kSlate,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    provider.isBalanceVisible
                        ? 'ETB ${acc.currentBalance.toStringAsFixed(0)}'
                        : '••••',
                    style: GoogleFonts.outfit(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: _kBlue,
                    ),
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }

  Widget _buildSummaryHeader(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          context.tr('reports'),
          style: GoogleFonts.outfit(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: _kInk,
          ),
        ),
        ElevatedButton.icon(
          style: ElevatedButton.styleFrom(
            backgroundColor: _kBlue,
            foregroundColor: Colors.white,
            elevation: 0,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
          ),
          icon: const Icon(Icons.add, size: 16),
          label: Text(
            'Add Expense',
            style: GoogleFonts.outfit(
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          onPressed: () => _showAddExpenseModal(context),
        ),
      ],
    );
  }

  Widget _buildSummaryBox(BankAccountProvider provider) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.tr('reports'),
            style: GoogleFonts.outfit(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: _kInk,
            ),
          ),
          const SizedBox(height: 14),
          _summaryItem(context.tr('total_sales'), 'ETB ${provider.todaySales.toStringAsFixed(2)}', _kInk),
          const SizedBox(height: 10),
          _summaryItem(context.tr('products'), 'ETB ${provider.productSales.toStringAsFixed(2)}', _kInk),
          const SizedBox(height: 10),
          _summaryItem(context.tr('commission'), 'ETB ${provider.commission.toStringAsFixed(2)}', _kRed),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12.0),
            child: Divider(height: 1, color: _kBorder),
          ),
          _summaryItem(context.tr('gross_profit'), 'ETB ${provider.netProfit.toStringAsFixed(2)}', _kGreen, isBold: true, fontSize: 17),
        ],
      ),
    );
  }

  Widget _summaryItem(String label, String value, Color valueColor, {bool isBold = false, double fontSize = 14}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: GoogleFonts.outfit(
            fontSize: fontSize,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
            color: isBold ? _kInk : _kSlate,
          ),
        ),
        Text(
          value,
          style: GoogleFonts.outfit(
            fontSize: fontSize,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
            color: valueColor,
          ),
        ),
      ],
    );
  }

  Widget _buildIncomeExpensesRow(BankAccountProvider provider) {
    return Row(
      children: [
        Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFDCFCE7)),
            ),
            child: Column(
              children: [
                const Icon(Icons.north_east_rounded, color: _kGreen, size: 20),
                const SizedBox(height: 6),
                Text(
                  context.tr('total_revenue'),
                  style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                ),
                const SizedBox(height: 2),
                Text(
                  'ETB ${provider.todaySales.toStringAsFixed(2)}',
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: _kInk,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFFEE2E2)),
            ),
            child: Column(
              children: [
                const Icon(Icons.south_east_rounded, color: _kRed, size: 20),
                const SizedBox(height: 6),
                Text(
                  context.tr('total_sales'),
                  style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                ),
                const SizedBox(height: 2),
                Text(
                  'ETB ${provider.totalExpenses.toStringAsFixed(2)}',
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: _kInk,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  void _showAddAccountModal(BuildContext context) {
    final bankNameCtrl = TextEditingController();
    final accountNumCtrl = TextEditingController();
    final balanceCtrl = TextEditingController();
    final noteCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Add Account',
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: _kInk,
                ),
              ),
              const SizedBox(height: 16),
              _modalTextField('Bank Name', bankNameCtrl),
              const SizedBox(height: 12),
              _modalTextField('Account Number', accountNumCtrl, keyboardType: TextInputType.number),
              const SizedBox(height: 12),
              _modalTextField('Initial Balance', balanceCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
              const SizedBox(height: 12),
              _modalTextField('Notes / Reason', noteCtrl, maxLines: 3),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kBlue,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  icon: const Icon(Icons.add, size: 18),
                  label: Text(
                    'Add Account',
                    style: GoogleFonts.outfit(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  onPressed: () {
                    final bankName = bankNameCtrl.text.trim();
                    final accountNum = accountNumCtrl.text.trim();
                    final balance = double.tryParse(balanceCtrl.text) ?? 0.0;
                    if (bankName.isEmpty || accountNum.isEmpty) {
                      showAppToast(context, context.tr('bank_name_account_required'));
                      return;
                    }
                    final companyState = context.read<CompanyBloc>().state;
                    final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
                    context.read<BankAccountProvider>().addBankAccount(
                      bankName: bankName,
                      accountNumber: accountNum,
                      initialBalance: balance,
                      note: noteCtrl.text.trim(),
                      companyId: companyId,
                    );
                    Navigator.pop(ctx);
                    showAppToast(context, context.tr('save'), type: AppToastType.success);
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showAddBalanceModal(BuildContext context) {
    final amountCtrl = TextEditingController();
    final noteCtrl = TextEditingController();
    final provider = context.read<BankAccountProvider>();

    if (provider.accounts.isEmpty) {
      showAppToast(context, context.tr('add_bank_account_first'));
      return;
    }

    String selectedAccountId = provider.accounts.first.id;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Add Balance',
                    style: GoogleFonts.outfit(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: _kInk,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Select Bank Account',
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: _kInk,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: _kBorder),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: selectedAccountId,
                        isExpanded: true,
                        items: provider.accounts.map((acc) {
                          return DropdownMenuItem<String>(
                            value: acc.id,
                            child: Text(
                              '${acc.bankName} (${acc.accountNumber})',
                              style: GoogleFonts.outfit(fontSize: 14, color: _kInk),
                            ),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) {
                            setModalState(() => selectedAccountId = val);
                          }
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _modalTextField('Amount', amountCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
                  const SizedBox(height: 12),
                  _modalTextField('Notes', noteCtrl),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF16A34A),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      icon: const Icon(Icons.add, size: 18),
                      label: Text(
                        'Add Balance',
                        style: GoogleFonts.outfit(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      onPressed: () async {
                        final amount = double.tryParse(amountCtrl.text) ?? 0.0;
                        if (amount <= 0) {
                          showAppToast(ctx, context.tr('enter_valid_amount'));
                          return;
                        }
                        Navigator.pop(ctx);
                        try {
                          final companyState = context.read<CompanyBloc>().state;
                          final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
                          await context.read<BankAccountProvider>().addBalance(
                            bankAccountId: selectedAccountId,
                            amount: amount,
                            note: noteCtrl.text.trim(),
                            companyId: companyId,
                          );
                          if (mounted) {
                            showAppToast(context, context.tr('save'), type: AppToastType.success);
                          }
                        } catch (e) {
                          if (mounted) {
                            showAppToast(context, '${context.tr('failed_add_balance')}: $e', type: AppToastType.error);
                          }
                        }
                      },
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

  void _showAddExpenseModal(BuildContext context) {
    final amountCtrl = TextEditingController();
    final reasonCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Add Expense',
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: _kInk,
                ),
              ),
              const SizedBox(height: 16),
              _modalTextField('Amount', amountCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
              const SizedBox(height: 12),
              _modalTextField('Notes / Reason', reasonCtrl, maxLines: 3),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kBlue,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  icon: const Icon(Icons.add, size: 18),
                  label: Text(
                    'Add Expense',
                    style: GoogleFonts.outfit(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  onPressed: () async {
                    final amount = double.tryParse(amountCtrl.text) ?? 0.0;
                    final reason = reasonCtrl.text.trim().isEmpty ? 'Expense' : reasonCtrl.text.trim();
                    if (amount <= 0) {
                      showAppToast(ctx, context.tr('enter_valid_amount'));
                      return;
                    }
                    Navigator.pop(ctx);
                    try {
                      final companyState = context.read<CompanyBloc>().state;
                      final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
                      await context.read<BankAccountProvider>().addExpense(
                        amount: amount,
                        reason: reason,
                        companyId: companyId,
                      );
                      if (mounted) {
                        showAppToast(context, context.tr('save'), type: AppToastType.success);
                      }
                    } catch (e) {
                      if (mounted) {
                        showAppToast(context, '${context.tr('failed_add_expense')}: $e', type: AppToastType.error);
                      }
                    }
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _modalTextField(String label, TextEditingController controller, {TextInputType? keyboardType, int maxLines = 1}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.outfit(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: _kInk,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          maxLines: maxLines,
          style: GoogleFonts.outfit(fontSize: 14, color: _kInk),
          decoration: InputDecoration(
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBlue, width: 1.5)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
        ),
      ],
    );
  }
}
