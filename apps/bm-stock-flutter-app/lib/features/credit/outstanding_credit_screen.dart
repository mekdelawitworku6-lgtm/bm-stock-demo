import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/bloc/sale/sale_bloc.dart';
import '../../core/blocs/company/company_bloc.dart';
import '../../core/blocs/company/company_state.dart';
import '../../core/models/dashboard_stats.dart';
import '../../core/models/sale_model.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/providers/dashboard_provider.dart';
import '../../core/providers/report_provider.dart';
import '../../core/services/sale_service.dart';
import '../../core/widgets/app_toast.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kAmber = Color(0xFFD97706);
const _kRed = Color(0xFFDC2626);
const _kGreen = Color(0xFF16A34A);

const _kLoadLimit = 200;

class OutstandingCreditScreen extends StatefulWidget {
  const OutstandingCreditScreen({super.key, this.embedded = false});

  final bool embedded;

  @override
  State<OutstandingCreditScreen> createState() => _OutstandingCreditScreenState();
}

class _OutstandingCreditScreenState extends State<OutstandingCreditScreen> {
  String _searchQuery = '';
  String _filterTab = 'All'; // All, Unpaid, Partially Paid, Fully Paid, Overdue
  String _viewMode = 'invoices'; // 'invoices' or 'customers'

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadCredits();
      _loadDashboardStats();
    });
  }

  void _loadDashboardStats() {
    final companyState = context.read<CompanyBloc>().state;
    final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
    context.read<DashboardProvider>().loadDashboard(companyId: companyId);
  }

  void _loadCredits() {
    context.read<SaleBloc>().add(SalesLoadRequested(limit: _kLoadLimit));
  }

  void _refreshReportData() {
    try {
      final companyState = context.read<CompanyBloc>().state;
      final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
      context.read<ReportProvider>().loadAnalytics(companyId: companyId);
      context.read<DashboardProvider>().loadDashboard(companyId: companyId);
    } catch (_) {}
  }

  void _showPayDialogForCustomer(_CustomerCredit customer) {
    final unpaidSales = customer.sales.where((s) => s.remainingBalance > 0.01).toList();
    if (unpaidSales.isEmpty) return;
    Navigator.pushNamed(context, '/record_payment', arguments: {
      'customerName': customer.name,
      'amountDue': customer.totalOwed,
      'sales': unpaidSales,
    }).then((result) {
      if (result == true) {
        _loadCredits();
        _refreshReportData();
      }
    });
  }

  void _showPayDialogForSale(SaleModel sale) {
    if (sale.remainingBalance <= 0.01) return;
    Navigator.pushNamed(context, '/record_payment', arguments: {
      'saleId': sale.id,
      'customerName': sale.customerName.isNotEmpty ? sale.customerName : 'Walk-in',
      'amountDue': sale.remainingBalance,
    }).then((result) {
      if (result == true) {
        _loadCredits();
        _refreshReportData();
      }
    });
  }

  Future<void> _openCustomerDetails(_CustomerCredit customer) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => CustomerCreditDetailScreen(customerName: customer.name),
      ),
    );
    if (result == true) {
      _loadCredits();
    }
  }

  Future<void> _showSaleDetails(SaleModel sale) async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CreditSaleDetailSheet(sale: sale),
    );
    if (result == true) {
      _loadCredits();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: widget.embedded
            ? null
            : IconButton(
                icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 20),
                onPressed: () => Navigator.pop(context),
              ),
        title: Text(
          context.tr('outstanding_credit'),
          style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: _kSlate, size: 22),
            onPressed: () {
              _loadCredits();
              _loadDashboardStats();
            },
          ),
          IconButton(
            icon: const Icon(Icons.ios_share_outlined, color: _kSlate, size: 22),
            onPressed: () {
              showAppToast(context, context.tr('export_coming_soon'));
            },
          ),
        ],
      ),
      body: BlocBuilder<SaleBloc, SaleState>(
        builder: (context, state) {
          if (state.isLoading && state.sales.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          final allCreditSales = _filterCreditSales(state.sales);

          // Apply Search
          var filteredSales = allCreditSales;
          if (_searchQuery.isNotEmpty) {
            final q = _searchQuery.toLowerCase();
            filteredSales = allCreditSales.where((s) {
              final custMatch = s.customerName.toLowerCase().contains(q);
              final invoiceMatch = s.id.toLowerCase().contains(q) || (s.invoiceNumber?.toLowerCase().contains(q) ?? false);
              final itemMatch = s.items.any((it) =>
                it.productName.toLowerCase().contains(q) || it.brand.toLowerCase().contains(q)
              );
              return custMatch || invoiceMatch || itemMatch;
            }).toList();
          }

          // Apply Filter Tabs
          if (_filterTab == 'Unpaid') {
            filteredSales = filteredSales.where((s) => s.remainingBalance > 0.01 && s.computedAmountPaid <= 0.01).toList();
          } else if (_filterTab == 'Partially Paid') {
            filteredSales = filteredSales.where((s) => s.remainingBalance > 0.01 && s.computedAmountPaid > 0.01).toList();
          } else if (_filterTab == 'Fully Paid') {
            filteredSales = filteredSales.where((s) => s.remainingBalance <= 0.01 || s.isFullyPaid).toList();
          } else if (_filterTab == 'Overdue') {
            filteredSales = filteredSales.where((s) {
              if (s.remainingBalance <= 0.01) return false;
              try {
                final d = DateTime.parse(s.saleDate);
                return DateTime.now().difference(d).inDays > 30;
              } catch (_) {
                return false;
              }
            }).toList();
          }

          // Build Customer Map from the filtered sales
          final customerMap = <String, _CustomerCredit>{};
          for (final sale in filteredSales) {
            final key = sale.customerName.isNotEmpty ? sale.customerName : 'Walk-in';
            if (customerMap.containsKey(key)) {
              customerMap[key]!.totalOwed += sale.remainingBalance;
              customerMap[key]!.totalPaid += sale.computedAmountPaid;
              customerMap[key]!.totalCredit += sale.totalAmount;
              customerMap[key]!.invoiceCount++;
              customerMap[key]!.sales.add(sale);
            } else {
              customerMap[key] = _CustomerCredit(
                name: key,
                totalOwed: sale.remainingBalance,
                totalPaid: sale.computedAmountPaid,
                totalCredit: sale.totalAmount,
                invoiceCount: 1,
                sales: [sale],
              );
            }
          }

          final customers = customerMap.values.toList()
            ..sort((a, b) => b.totalOwed.compareTo(a.totalOwed));

          // Overall metric totals
          final totalOutstanding = allCreditSales.fold<double>(0, (sum, c) => sum + c.remainingBalance);
          final totalPaidAll = allCreditSales.fold<double>(0, (sum, c) => sum + c.computedAmountPaid);

          return Column(
            children: [
              // Search bar
              Container(
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: TextField(
                  style: GoogleFonts.outfit(fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Search by customer, product, brand, or #invoice',
                    hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 13),
                    prefixIcon: const Icon(Icons.search, color: Color(0xFF94A3B8), size: 20),
                    filled: true,
                    fillColor: _kBg,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                  ),
                  onChanged: (v) => setState(() => _searchQuery = v.toLowerCase()),
                ),
              ),

              // Filter Tabs & View Mode Row
              Container(
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Column(
                  children: [
                    // View Mode Switcher: Invoices vs By Customer
                    Row(
                      children: [
                        Expanded(
                          child: Container(
                            height: 36,
                            decoration: BoxDecoration(
                              color: _kBg,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            padding: const EdgeInsets.all(2),
                            child: Row(
                              children: [
                                Expanded(
                                  child: GestureDetector(
                                    onTap: () => setState(() => _viewMode = 'invoices'),
                                    child: Container(
                                      decoration: BoxDecoration(
                                        color: _viewMode == 'invoices' ? Colors.white : Colors.transparent,
                                        borderRadius: BorderRadius.circular(8),
                                        boxShadow: _viewMode == 'invoices'
                                            ? [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4)]
                                            : null,
                                      ),
                                      alignment: Alignment.center,
                                      child: Text(
                                        'All Credits (${filteredSales.length})',
                                        style: GoogleFonts.outfit(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: _viewMode == 'invoices' ? _kBlue : _kSlate,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                                Expanded(
                                  child: GestureDetector(
                                    onTap: () => setState(() => _viewMode = 'customers'),
                                    child: Container(
                                      decoration: BoxDecoration(
                                        color: _viewMode == 'customers' ? Colors.white : Colors.transparent,
                                        borderRadius: BorderRadius.circular(8),
                                        boxShadow: _viewMode == 'customers'
                                            ? [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4)]
                                            : null,
                                      ),
                                      alignment: Alignment.center,
                                      child: Text(
                                        'By Customer (${customers.length})',
                                        style: GoogleFonts.outfit(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: _viewMode == 'customers' ? _kBlue : _kSlate,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    // Status Filter Pills
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: ['All', 'Unpaid', 'Partially Paid', 'Fully Paid', 'Overdue'].map((tab) {
                          final isSelected = _filterTab == tab;
                          return Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: GestureDetector(
                              onTap: () => setState(() => _filterTab = tab),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                decoration: BoxDecoration(
                                  color: isSelected ? _kBlue : Colors.white,
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: isSelected ? _kBlue : _kBorder,
                                  ),
                                ),
                                child: Text(
                                  tab,
                                  style: GoogleFonts.outfit(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                    color: isSelected ? Colors.white : _kSlate,
                                  ),
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ],
                ),
              ),

              // Summary card
              Container(
                margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: _kBlue,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(context.tr('total_due'), style: GoogleFonts.outfit(fontSize: 12, color: Colors.white.withValues(alpha: 0.7))),
                          const SizedBox(height: 2),
                          Text(
                            'ETB ${totalOutstanding.toStringAsFixed(2)}',
                            style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Text(
                                'Collected: ETB ${totalPaidAll.toStringAsFixed(0)}',
                                style: GoogleFonts.outfit(fontSize: 12, color: Colors.white.withValues(alpha: 0.85)),
                              ),
                              Text(' \u00b7 ', style: GoogleFonts.outfit(color: Colors.white.withValues(alpha: 0.5))),
                              Text(
                                '${allCreditSales.length} credits',
                                style: GoogleFonts.outfit(fontSize: 12, color: Colors.white.withValues(alpha: 0.85)),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.account_balance_wallet_outlined, color: Colors.white, size: 26),
                    ),
                  ],
                ),
              ),

              Consumer<DashboardProvider>(
                builder: (context, dash, _) {
                  if (dash.stats == null) return const SizedBox.shrink();
                  return Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                    child: _CreditStatusBreakdownCard(stats: dash.stats!),
                  );
                },
              ),

              // Content List (Invoices view or By Customer view)
              Expanded(
                child: (_viewMode == 'invoices' ? filteredSales.isEmpty : customers.isEmpty)
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.check_circle_outline, size: 56, color: _kGreen.withValues(alpha: 0.5)),
                            const SizedBox(height: 12),
                            Text(context.tr('all_clear'), style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk)),
                            const SizedBox(height: 4),
                            Text('No credits match your filter', style: GoogleFonts.outfit(fontSize: 14, color: _kSlate)),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: () async {
                          _loadCredits();
                          _loadDashboardStats();
                        },
                        child: _viewMode == 'invoices'
                            ? ListView.separated(
                                physics: const AlwaysScrollableScrollPhysics(),
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                                itemCount: filteredSales.length,
                                separatorBuilder: (_, __) => const SizedBox(height: 10),
                                itemBuilder: (_, i) => _CreditInvoiceCard(
                                  sale: filteredSales[i],
                                  onTap: () => _showSaleDetails(filteredSales[i]),
                                  onPay: () => _showPayDialogForSale(filteredSales[i]),
                                ),
                              )
                            : ListView.separated(
                                physics: const AlwaysScrollableScrollPhysics(),
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                                itemCount: customers.length,
                                separatorBuilder: (_, __) => const SizedBox(height: 10),
                                itemBuilder: (_, i) => _CustomerCreditRow(
                                  customer: customers[i],
                                  onTap: () => _openCustomerDetails(customers[i]),
                                  onPay: () => _showPayDialogForCustomer(customers[i]),
                                  onRemind: () async {
                                    context.read<SaleBloc>().add(SaleReminderSent(saleId: customers[i].sales.first.id));
                                    final result = await context.read<SaleBloc>().stream.firstWhere((s) => !s.isLoading);
                                    final success = result.lastActionSuccess == true;
                                    if (mounted) {
                                      showAppToast(
                                        context,
                                        success
                                          ? 'Reminder sent to ${customers[i].name}'
                                          : 'Failed to send reminder',
                                        type: success ? AppToastType.success : AppToastType.error,
                                      );
                                    }
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

List<SaleModel> _filterCreditSales(List<SaleModel> sales) {
  return sales.where((s) =>
    s.isCreditSale ||
    s.paymentType.toLowerCase() == 'credit' ||
    s.remainingBalance > 0.01 ||
    s.advancePayment > 0
  ).toList();
}

String _formatDate(String? raw) {
  if (raw == null || raw.trim().isEmpty) return '-';
  try {
    final dt = DateTime.parse(raw);
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
  } catch (_) {
    return raw;
  }
}

String _formatDateTime(String? raw) {
  if (raw == null || raw.trim().isEmpty) return '-';
  try {
    final dt = DateTime.parse(raw);
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  } catch (_) {
    return raw;
  }
}

class _CustomerCredit {
  String name;
  double totalOwed;
  double totalPaid;
  double totalCredit;
  int invoiceCount;
  List<SaleModel> sales;

  _CustomerCredit({
    required this.name,
    required this.totalOwed,
    this.totalPaid = 0,
    this.totalCredit = 0,
    required this.invoiceCount,
    required this.sales,
  });

  int get daysOutstanding {
    if (sales.isEmpty) return 0;
    final unpaid = sales.where((s) => s.remainingBalance > 0.01).toList();
    if (unpaid.isEmpty) return 0;
    final oldest = unpaid
      .map((s) {
        try { return DateTime.parse(s.saleDate); } catch (_) { return DateTime.now(); }
      })
      .reduce((a, b) => a.isBefore(b) ? a : b);
    return DateTime.now().difference(oldest).inDays;
  }
}

class _CustomerCreditRow extends StatelessWidget {
  final _CustomerCredit customer;
  final VoidCallback onTap;
  final VoidCallback onPay;
  final VoidCallback onRemind;

  const _CustomerCreditRow({
    required this.customer,
    required this.onTap,
    required this.onPay,
    required this.onRemind,
  });

  Color get _avatarColor {
    final hash = customer.name.hashCode;
    final colors = [const Color(0xFFF97316), const Color(0xFF8B5CF6), const Color(0xFF06B6D4), _kBlue, const Color(0xFFEC4899)];
    return colors[hash.abs() % colors.length];
  }

  String get _initials {
    final parts = customer.name.split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    if (parts.isNotEmpty && parts[0].isNotEmpty) return parts[0].substring(0, 1).toUpperCase();
    return '?';
  }

  @override
  Widget build(BuildContext context) {
    final days = customer.daysOutstanding;
    final isOverdue = days > 30;
    final isSevere = days > 60;
    final isFullySettled = customer.totalOwed <= 0.01;

    // Aggregate unique product names across this customer's credit sales
    final productNames = <String>{};
    for (final s in customer.sales) {
      for (final it in s.items) {
        if (it.productName.isNotEmpty) {
          productNames.add(it.productName);
        }
      }
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isFullySettled
                ? _kGreen.withValues(alpha: 0.3)
                : (isSevere ? _kRed.withValues(alpha: 0.3) : isOverdue ? _kAmber.withValues(alpha: 0.3) : _kBorder),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(color: _avatarColor, shape: BoxShape.circle),
                  child: Center(
                    child: Text(_initials, style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              customer.name,
                              style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w600, color: _kInk),
                            ),
                          ),
                          if (isFullySettled)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                              decoration: BoxDecoration(
                                color: _kGreen.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                context.tr('fully_paid'),
                                style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600, color: _kGreen),
                              ),
                            )
                          else if (days > 0)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: (isSevere ? _kRed : isOverdue ? _kAmber : _kSlate).withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                '${days}d',
                                style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w600,
                                  color: isSevere ? _kRed : isOverdue ? _kAmber : _kSlate),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${customer.invoiceCount} credit invoice${customer.invoiceCount > 1 ? 's' : ''}',
                        style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'ETB ${customer.totalOwed.toStringAsFixed(2)}',
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: isFullySettled ? _kGreen : _kRed,
                      ),
                    ),
                    if (customer.totalPaid > 0)
                      Text(
                        'Paid: ETB ${customer.totalPaid.toStringAsFixed(0)}',
                        style: GoogleFonts.outfit(fontSize: 11, color: _kGreen),
                      ),
                  ],
                ),
              ],
            ),

            // Products summary row
            if (productNames.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: _kBg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.inventory_2_outlined, size: 14, color: _kBlue),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Products: ${productNames.take(3).join(', ')}${productNames.length > 3 ? ' +${productNames.length - 3} more' : ''}',
                        style: GoogleFonts.outfit(fontSize: 12, color: _kInk),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: onRemind,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: _kSlate,
                      side: const BorderSide(color: _kBorder),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: Text(context.tr('send_reminder'), style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w500)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton(
                    onPressed: isFullySettled ? null : onPay,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isFullySettled ? _kSlate.withValues(alpha: 0.3) : _kGreen,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      elevation: 0,
                    ),
                    child: Text(
                      isFullySettled ? context.tr('fully_paid') : context.tr('pay'),
                      style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _CreditInvoiceCard extends StatelessWidget {
  final SaleModel sale;
  final VoidCallback onTap;
  final VoidCallback onPay;

  const _CreditInvoiceCard({
    required this.sale,
    required this.onTap,
    required this.onPay,
  });

  String get _invoiceId => sale.invoiceNumber?.isNotEmpty == true
      ? sale.invoiceNumber!
      : (sale.id.length >= 8 ? '#${sale.id.substring(0, 8)}' : '#${sale.id}');

  (Color, String, IconData) _statusInfo(BuildContext context) {
    if (sale.remainingBalance <= 0.01 || sale.isFullyPaid) {
      return (_kGreen, context.tr('fully_paid'), Icons.check_circle_rounded);
    }
    final paidSoFar = sale.computedAmountPaid;
    if (paidSoFar > 0.01) {
      return (_kAmber, context.tr('partially_paid'), Icons.timelapse_rounded);
    }
    return (_kRed, context.tr('not_paid'), Icons.error_outline_rounded);
  }

  @override
  Widget build(BuildContext context) {
    final paidAmount = sale.computedAmountPaid;
    final (statusColor, statusLabel, statusIcon) = _statusInfo(context);
    final isFullyPaid = sale.remainingBalance <= 0.01 || sale.isFullyPaid;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isFullyPaid ? _kGreen.withValues(alpha: 0.3) : _kBorder,
            width: isFullyPaid ? 1.2 : 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row: Customer Name, Status Badge
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: isFullyPaid ? _kGreen.withValues(alpha: 0.1) : _kBlue.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    isFullyPaid ? Icons.verified : Icons.receipt_long,
                    color: isFullyPaid ? _kGreen : _kBlue,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              sale.customerName.isNotEmpty ? sale.customerName : 'Walk-in Customer',
                              style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: _kInk),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Text(_invoiceId, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: _kBlue)),
                          if (sale.customerPhone != null && sale.customerPhone!.isNotEmpty) ...[
                            Text(' \u00b7 ', style: GoogleFonts.outfit(color: _kSlate)),
                            Text(sale.customerPhone!, style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                // Status Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(statusIcon, size: 13, color: statusColor),
                      const SizedBox(width: 4),
                      Text(
                        statusLabel,
                        style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.bold, color: statusColor),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 10),

            // Products Section: What product it was
            if (sale.items.isNotEmpty)
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: _kBg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: _kBorder.withValues(alpha: 0.6)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.shopping_bag_outlined, size: 14, color: _kBlue),
                        const SizedBox(width: 4),
                        Text(
                          '${context.tr('items_purchased')} (${sale.items.length}):',
                          style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: _kInk),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    ...sale.items.take(3).map((item) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Row(
                        children: [
                          Expanded(
                            child: Row(
                              children: [
                                Flexible(
                                  child: Text(
                                    item.productName,
                                    style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w500, color: _kInk),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                if (item.brand.isNotEmpty) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: _kBlue.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      item.brand,
                                      style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w600, color: _kBlue),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${item.quantity} \u00d7 ETB ${item.unitPrice.toStringAsFixed(0)}',
                            style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                          ),
                        ],
                      ),
                    )),
                    if (sale.items.length > 3)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          '+ ${sale.items.length - 3} more product(s)...',
                          style: GoogleFonts.outfit(fontSize: 11, fontStyle: FontStyle.italic, color: _kBlue),
                        ),
                      ),
                  ],
                ),
              ),

            const SizedBox(height: 10),

            // When was it paid / Sale timing info
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: isFullyPaid
                    ? _kGreen.withValues(alpha: 0.08)
                    : (paidAmount > 0 ? _kAmber.withValues(alpha: 0.08) : Colors.grey.withValues(alpha: 0.06)),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(
                    isFullyPaid ? Icons.check_circle_outline : (paidAmount > 0 ? Icons.history : Icons.calendar_today_outlined),
                    size: 14,
                    color: isFullyPaid ? _kGreen : (paidAmount > 0 ? _kAmber : _kSlate),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      isFullyPaid
                          ? 'Fully paid on ${_formatDateTime(sale.lastPaymentDate ?? (sale.updatedAt.isNotEmpty ? sale.updatedAt : sale.saleDate))}${sale.computedLastPaymentAmount > 0 ? ' (Last payment: ETB ${sale.computedLastPaymentAmount.toStringAsFixed(2)})' : ''}'
                          : (paidAmount > 0
                              ? 'Last payment: ETB ${sale.computedLastPaymentAmount.toStringAsFixed(2)} on ${_formatDateTime(sale.lastPaymentDate ?? (sale.updatedAt.isNotEmpty ? sale.updatedAt : sale.saleDate))}'
                              : 'Issued on ${_formatDate(sale.saleDate)}${sale.dueDate != null ? ' · Due: ${_formatDate(sale.dueDate)}' : ''}'),
                      style: GoogleFonts.outfit(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: isFullyPaid ? _kGreen : (paidAmount > 0 ? _kAmber : _kSlate),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 12),

            // Amounts Row: Total, Paid, Due
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _AmountLabel(label: 'Total Credit', amount: sale.totalAmount, color: _kInk),
                _AmountLabel(label: 'Paid Amount', amount: paidAmount, color: _kGreen),
                _AmountLabel(label: 'Remaining Due', amount: sale.remainingBalance, color: isFullyPaid ? _kGreen : _kRed),
              ],
            ),

            const SizedBox(height: 12),

            // Action Buttons: Pay & View Full Details
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onTap,
                    icon: const Icon(Icons.info_outline, size: 16),
                    label: const Text('View Details'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: _kBlue,
                      side: const BorderSide(color: _kBorder),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                ),
                if (!isFullyPaid && sale.canAcceptPayment) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: onPay,
                      icon: const Icon(Icons.payment, size: 16, color: Colors.white),
                      label: Text(context.tr('pay'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _kGreen,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        elevation: 0,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class CustomerCreditDetailScreen extends StatefulWidget {
  final String customerName;
  const CustomerCreditDetailScreen({super.key, required this.customerName});

  @override
  State<CustomerCreditDetailScreen> createState() => _CustomerCreditDetailScreenState();
}

class _CustomerCreditDetailScreenState extends State<CustomerCreditDetailScreen> {
  String _detailFilter = 'All'; // All, Unpaid, Fully Paid

  @override
  Widget build(BuildContext context) {
    final customerName = widget.customerName;

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
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Credit Details',
              style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk),
            ),
            Text(
              customerName,
              style: GoogleFonts.outfit(fontSize: 13, color: _kSlate),
            ),
          ],
        ),
      ),
      body: BlocBuilder<SaleBloc, SaleState>(
        builder: (context, state) {
          if (state.isLoading && state.sales.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          final allCustomerSales = _filterCreditSales(state.sales)
              .where((s) => s.customerName == customerName || (customerName == 'Walk-in' && s.customerName.isEmpty))
              .toList();

          if (allCustomerSales.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle_outline, size: 56, color: _kGreen.withValues(alpha: 0.5)),
                  const SizedBox(height: 12),
                  Text(context.tr('all_clear'), style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk)),
                  const SizedBox(height: 4),
                  Text(context.tr('no_outstanding_credit'), style: GoogleFonts.outfit(fontSize: 14, color: _kSlate)),
                ],
              ),
            );
          }

          final totalOwed = allCustomerSales.fold<double>(0, (sum, s) => sum + s.remainingBalance);
          final totalPaid = allCustomerSales.fold<double>(0, (sum, s) => sum + s.computedAmountPaid);
          final totalCredit = allCustomerSales.fold<double>(0, (sum, s) => sum + s.totalAmount);

          var displaySales = allCustomerSales;
          if (_detailFilter == 'Unpaid') {
            displaySales = allCustomerSales.where((s) => s.remainingBalance > 0.01).toList();
          } else if (_detailFilter == 'Fully Paid') {
            displaySales = allCustomerSales.where((s) => s.remainingBalance <= 0.01 || s.isFullyPaid).toList();
          }

          return RefreshIndicator(
            onRefresh: () async {
              context.read<SaleBloc>().add(SalesLoadRequested(limit: _kLoadLimit));
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                // Summary card
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: _kBlue,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(context.tr('total_due'), style: GoogleFonts.outfit(fontSize: 13, color: Colors.white.withValues(alpha: 0.7))),
                                const SizedBox(height: 4),
                                Text(
                                  'ETB ${totalOwed.toStringAsFixed(2)}',
                                  style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Total Credit: ETB ${totalCredit.toStringAsFixed(0)} · Paid: ETB ${totalPaid.toStringAsFixed(0)}',
                                  style: GoogleFonts.outfit(fontSize: 12, color: Colors.white.withValues(alpha: 0.85)),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            width: 50, height: 50,
                            decoration: BoxDecoration(
                              color: _kAmber.withValues(alpha: 0.25),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Icon(Icons.receipt_long_outlined, color: Colors.white, size: 26),
                          ),
                        ],
                      ),
                      if (totalOwed > 0.01) ...[
                        const SizedBox(height: 14),
                        SizedBox(
                          width: double.infinity,
                          height: 42,
                          child: ElevatedButton.icon(
                            onPressed: () => _recordAllPayments(allCustomerSales, totalOwed),
                            icon: const Icon(Icons.payments_outlined, color: Colors.white, size: 20),
                            label: Text(
                              'Pay All Credits (ETB ${totalOwed.toStringAsFixed(2)})',
                              style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _kGreen,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              elevation: 0,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Filter tabs
                Row(
                  children: ['All', 'Unpaid', 'Fully Paid'].map((tab) {
                    final isSel = _detailFilter == tab;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: GestureDetector(
                        onTap: () => setState(() => _detailFilter = tab),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: isSel ? _kBlue : Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: isSel ? _kBlue : _kBorder),
                          ),
                          child: Text(
                            tab,
                            style: GoogleFonts.outfit(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: isSel ? Colors.white : _kSlate,
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 14),

                // Invoices list
                if (displaySales.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 32),
                    child: Center(
                      child: Text('No credit invoices under this filter', style: GoogleFonts.outfit(color: _kSlate)),
                    ),
                  )
                else
                  ...displaySales.map((sale) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _CreditInvoiceCard(
                      sale: sale,
                      onTap: () => _showSaleDetailSheet(sale),
                      onPay: () => _recordPayment(sale),
                    ),
                  )),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _showSaleDetailSheet(SaleModel sale) async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CreditSaleDetailSheet(sale: sale),
    );
    if (result == true && mounted) {
      context.read<SaleBloc>().add(const SalesLoadRequested(limit: _kLoadLimit));
    }
  }

  Future<void> _recordAllPayments(List<SaleModel> sales, double totalOwed) async {
    final unpaidSales = sales.where((s) => s.remainingBalance > 0.01).toList();
    if (unpaidSales.isEmpty) return;
    final result = await Navigator.pushNamed(context, '/record_payment', arguments: {
      'customerName': widget.customerName,
      'amountDue': totalOwed,
      'sales': unpaidSales,
    });
    if (result == true && mounted) {
      context.read<SaleBloc>().add(const SalesLoadRequested(limit: _kLoadLimit));
    }
  }

  Future<void> _recordPayment(SaleModel sale) async {
    final result = await Navigator.pushNamed(context, '/record_payment', arguments: {
      'saleId': sale.id,
      'customerName': widget.customerName,
      'amountDue': sale.remainingBalance,
    });
    if (result == true && mounted) {
      context.read<SaleBloc>().add(const SalesLoadRequested(limit: _kLoadLimit));
    }
  }
}

class _AmountLabel extends StatelessWidget {
  final String label;
  final double amount;
  final Color color;
  const _AmountLabel({required this.label, required this.amount, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
        const SizedBox(height: 2),
        Text(
          'ETB ${amount.toStringAsFixed(2)}',
          style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: color),
        ),
      ],
    );
  }
}

class _CreditStatusBreakdownCard extends StatelessWidget {
  final DashboardStats stats;
  const _CreditStatusBreakdownCard({required this.stats});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.tr('credit_status'),
            style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: _kInk),
          ),
          const SizedBox(height: 10),
          _creditRow(context.tr('total_credit'), stats.totalCredit, _kInk),
          _creditRow(context.tr('not_paid'), stats.unpaidCredit, _kRed, highlight: stats.unpaidCredit > 0),
          _creditRow(context.tr('partially_paid'), stats.partiallyPaidCredit, _kAmber, highlight: stats.partiallyPaidCredit > 0),
          _creditRow(context.tr('paid'), stats.paidCredit, _kGreen),
          _creditRow(context.tr('overdue_credit'), stats.overdueCredit, _kRed, highlight: stats.overdueCredit > 0),
        ],
      ),
    );
  }

  Widget _creditRow(String label, double amount, Color color, {bool highlight = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
          Text(
            'ETB ${amount.toStringAsFixed(0)}',
            style: GoogleFonts.outfit(
              fontSize: highlight ? 13 : 12,
              fontWeight: highlight ? FontWeight.bold : FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

/// Rich Bottom Sheet showing all details of a credit sale:
/// Customer name, products list with brand, price, qty, line total,
/// whether it's paid fully, when it was paid, and payment history timeline!
class _CreditSaleDetailSheet extends StatefulWidget {
  final SaleModel sale;
  const _CreditSaleDetailSheet({required this.sale});

  @override
  State<_CreditSaleDetailSheet> createState() => _CreditSaleDetailSheetState();
}

class _CreditSaleDetailSheetState extends State<_CreditSaleDetailSheet> {
  final SaleService _saleService = SaleService();
  bool _loadingPayments = true;
  List<Map<String, dynamic>> _paymentHistory = [];

  @override
  void initState() {
    super.initState();
    _loadPaymentHistory();
  }

  Future<void> _loadPaymentHistory() async {
    try {
      final history = await _saleService.getPaymentHistory(widget.sale.id);
      if (mounted) {
        setState(() {
          _paymentHistory = history;
          _loadingPayments = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _loadingPayments = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final sale = widget.sale;
    final isFullyPaid = sale.remainingBalance <= 0.01 || sale.isFullyPaid;
    final paidAmount = sale.computedAmountPaid;
    final invoiceId = sale.invoiceNumber?.isNotEmpty == true
        ? sale.invoiceNumber!
        : (sale.id.length >= 8 ? '#${sale.id.substring(0, 8)}' : '#${sale.id}');

    return Container(
      height: MediaQuery.of(context).size.height * 0.88,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 12, bottom: 8),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: _kBorder,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Credit Invoice Details',
                        style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk),
                      ),
                      Text(invoiceId, style: GoogleFonts.outfit(fontSize: 13, color: _kBlue, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: _kSlate),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),

          const Divider(height: 1, color: _kBorder),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                // Customer Information Card
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: _kBg,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _kBorder),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Customer Information', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: _kInk)),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Icon(Icons.person_outline, size: 16, color: _kSlate),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              sale.customerName.isNotEmpty ? sale.customerName : 'Walk-in Customer',
                              style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk),
                            ),
                          ),
                        ],
                      ),
                      if (sale.customerPhone != null && sale.customerPhone!.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            const Icon(Icons.phone_outlined, size: 16, color: _kSlate),
                            const SizedBox(width: 8),
                            Text(sale.customerPhone!, style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
                          ],
                        ),
                      ],
                      if (sale.shopName != null || sale.warehouseName.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            const Icon(Icons.storefront_outlined, size: 16, color: _kSlate),
                            const SizedBox(width: 8),
                            Text(sale.shopName ?? sale.warehouseName, style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // Payment Status Card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isFullyPaid ? _kGreen.withValues(alpha: 0.08) : _kBg,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: isFullyPaid ? _kGreen.withValues(alpha: 0.3) : _kBorder),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Payment Status', style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: _kInk)),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: isFullyPaid
                                  ? _kGreen
                                  : (paidAmount > 0 ? _kAmber : _kRed),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              isFullyPaid
                                  ? context.tr('fully_paid')
                                  : (paidAmount > 0 ? context.tr('partially_paid') : context.tr('not_paid')),
                              style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _statTile('Total Amount', 'ETB ${sale.totalAmount.toStringAsFixed(2)}', _kInk),
                          _statTile('Amount Paid', 'ETB ${paidAmount.toStringAsFixed(2)}', _kGreen),
                          _statTile('Remaining Due', 'ETB ${sale.remainingBalance.toStringAsFixed(2)}', isFullyPaid ? _kGreen : _kRed),
                        ],
                      ),
                      const Divider(height: 20, color: _kBorder),
                      Row(
                        children: [
                          const Icon(Icons.event_outlined, size: 16, color: _kSlate),
                          const SizedBox(width: 6),
                          Text('Sale Date: ${_formatDate(sale.saleDate)}', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                          if (sale.dueDate != null) ...[
                            Text(' \u00b7 ', style: GoogleFonts.outfit(color: _kSlate)),
                            Text('Due: ${_formatDate(sale.dueDate)}', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: _kRed)),
                          ],
                        ],
                      ),
                      if (paidAmount > 0) ...[
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Icon(isFullyPaid ? Icons.check_circle_rounded : Icons.history_rounded, size: 16, color: isFullyPaid ? _kGreen : _kAmber),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                isFullyPaid
                                    ? 'Fully paid on ${_formatDateTime(sale.lastPaymentDate ?? (sale.updatedAt.isNotEmpty ? sale.updatedAt : sale.saleDate))}${sale.computedLastPaymentAmount > 0 ? ' (Last payment: ETB ${sale.computedLastPaymentAmount.toStringAsFixed(2)})' : ''}'
                                    : 'Last payment: ETB ${sale.computedLastPaymentAmount.toStringAsFixed(2)} on ${_formatDateTime(sale.lastPaymentDate ?? (sale.updatedAt.isNotEmpty ? sale.updatedAt : sale.saleDate))}',
                                style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: isFullyPaid ? _kGreen : _kAmber),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                // Products Breakdown (What product it was)
                Text(
                  'Products Purchased (${sale.items.length})',
                  style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: _kInk),
                ),
                const SizedBox(height: 8),

                if (sale.items.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: _kBg,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(
                      child: Text('No item details recorded', style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
                    ),
                  )
                else
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: _kBorder),
                    ),
                    child: Column(
                      children: [
                        // Table Header
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: const BoxDecoration(
                            color: Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.vertical(top: Radius.circular(11)),
                          ),
                          child: Row(
                            children: [
                              Expanded(flex: 3, child: Text('Product & Brand', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: _kSlate))),
                              Expanded(flex: 1, child: Text('Qty', textAlign: TextAlign.center, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: _kSlate))),
                              Expanded(flex: 2, child: Text('Unit Price', textAlign: TextAlign.right, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: _kSlate))),
                              Expanded(flex: 2, child: Text('Total', textAlign: TextAlign.right, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: _kSlate))),
                            ],
                          ),
                        ),
                        // Items List
                        ...sale.items.map((item) => Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: const BoxDecoration(
                            border: Border(bottom: BorderSide(color: _kBorder, width: 0.6)),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                flex: 3,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item.productName,
                                      style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk),
                                    ),
                                    if (item.brand.isNotEmpty)
                                      Container(
                                        margin: const EdgeInsets.only(top: 2),
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                        decoration: BoxDecoration(
                                          color: _kBlue.withValues(alpha: 0.1),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          'Brand: ${item.brand}',
                                          style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w600, color: _kBlue),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              Expanded(
                                flex: 1,
                                child: Text(
                                  '${item.quantity}',
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.outfit(fontSize: 13, color: _kInk),
                                ),
                              ),
                              Expanded(
                                flex: 2,
                                child: Text(
                                  'ETB ${item.unitPrice.toStringAsFixed(0)}',
                                  textAlign: TextAlign.right,
                                  style: GoogleFonts.outfit(fontSize: 13, color: _kSlate),
                                ),
                              ),
                              Expanded(
                                flex: 2,
                                child: Text(
                                  'ETB ${item.total.toStringAsFixed(2)}',
                                  textAlign: TextAlign.right,
                                  style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: _kInk),
                                ),
                              ),
                            ],
                          ),
                        )),
                      ],
                    ),
                  ),

                const SizedBox(height: 20),

                // Payment History Section: When was it paid & transactions
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      context.tr('payment_history'),
                      style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: _kInk),
                    ),
                    if (_loadingPayments)
                      const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                  ],
                ),
                const SizedBox(height: 8),

                if (_paymentHistory.isEmpty && !_loadingPayments)
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: _kBg,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: _kBorder),
                    ),
                    child: Row(
                      children: [
                        Icon(isFullyPaid ? Icons.info_outline : Icons.pending_actions, size: 18, color: _kSlate),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            isFullyPaid
                                ? 'Initial credit recorded as completed on ${_formatDateTime(sale.saleDate)}'
                                : 'No payment transactions recorded yet.',
                            style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  ..._paymentHistory.map((p) {
                    final pAmt = (p['amount'] is num) ? (p['amount'] as num).toDouble() : (double.tryParse('${p['amount']}') ?? 0.0);
                    final pDate = p['transactionDate'] ?? p['createdAt'] ?? '';
                    final pMethod = (p['paymentMethod'] ?? 'Cash').toString().toUpperCase();
                    final pNotes = p['notes']?.toString();

                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: _kBorder),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 36, height: 36,
                            decoration: BoxDecoration(
                              color: _kGreen.withValues(alpha: 0.1),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.check, color: _kGreen, size: 18),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: _kBlue.withValues(alpha: 0.08),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        pMethod,
                                        style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.bold, color: _kBlue),
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      _formatDateTime(pDate),
                                      style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                                    ),
                                  ],
                                ),
                                if (pNotes != null && pNotes.isNotEmpty) ...[
                                  const SizedBox(height: 2),
                                  Text(pNotes, style: GoogleFonts.outfit(fontSize: 11, color: _kInk)),
                                ],
                              ],
                            ),
                          ),
                          Text(
                            '+ ETB ${pAmt.toStringAsFixed(2)}',
                            style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: _kGreen),
                          ),
                        ],
                      ),
                    );
                  }),

                const SizedBox(height: 24),

                // Pay Button at bottom if still owes money
                if (!isFullyPaid && sale.canAcceptPayment)
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.pop(context);
                        Navigator.pushNamed(context, '/record_payment', arguments: {
                          'saleId': sale.id,
                          'customerName': sale.customerName.isNotEmpty ? sale.customerName : 'Walk-in',
                          'amountDue': sale.remainingBalance,
                        });
                      },
                      icon: const Icon(Icons.payment, color: Colors.white),
                      label: Text(
                        'Record Payment for ETB ${sale.remainingBalance.toStringAsFixed(2)}',
                        style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _kGreen,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _statTile(String label, String value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
        const SizedBox(height: 2),
        Text(value, style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: color)),
      ],
    );
  }
}
