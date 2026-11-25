import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/blocs/company/company_bloc.dart';
import '../../core/blocs/company/company_state.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/sale_model.dart';
import '../../core/providers/sale_provider.dart';
import 'sale_detail_screen.dart';
import '../../core/widgets/refreshable_scroll.dart';

class SalesHistoryScreen extends StatefulWidget {
  const SalesHistoryScreen({super.key});

  @override
  State<SalesHistoryScreen> createState() => _SalesHistoryScreenState();
}

class _SalesHistoryScreenState extends State<SalesHistoryScreen> {
  String? _statusFilter;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final companyState = context.read<CompanyBloc>().state;
      final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
      final saleProvider = Provider.of<SaleProvider>(context, listen: false);
      if (saleProvider.activeCompanyId != companyId) {
        saleProvider.loadSales(companyId: companyId);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF0F172A), size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(context.tr('sales_history'), style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A))),
      ),
      body: Column(
        children: [
          // Search bar
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: TextField(
              style: GoogleFonts.outfit(fontSize: 14),
              decoration: InputDecoration(
                hintText: context.tr('search'),
                hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 14),
                prefixIcon: const Icon(Icons.search, color: Color(0xFF94A3B8), size: 20),
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
              onChanged: (v) => setState(() => _searchQuery = v.toLowerCase()),
            ),
          ),

          // Filter chips
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: SizedBox(
              height: 36,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _FilterChip(label: context.tr('all'), selected: _statusFilter == null, onTap: () => _applyFilter(null)),
                  _FilterChip(label: context.tr('paid'), selected: _statusFilter == 'completed', onTap: () => _applyFilter('completed')),
                  _FilterChip(label: context.tr('pending'), selected: _statusFilter == 'pending', onTap: () => _applyFilter('pending')),
                  _FilterChip(label: context.tr('partially_paid'), selected: _statusFilter == 'partially_paid', onTap: () => _applyFilter('partially_paid')),
                  _FilterChip(label: context.tr('cancel'), selected: _statusFilter == 'cancelled', onTap: () => _applyFilter('cancelled')),
                ],
              ),
            ),
          ),
          Expanded(
            child: Consumer<SaleProvider>(
              builder: (context, provider, _) {
                var sales = provider.sales;

                // Client-side search filter
                if (_searchQuery.isNotEmpty) {
                  sales = sales.where((s) =>
                    s.customerName.toLowerCase().contains(_searchQuery) ||
                    s.id.toLowerCase().contains(_searchQuery) ||
                    s.id.substring(0, s.id.length > 8 ? 8 : s.id.length).toLowerCase().contains(_searchQuery)
                  ).toList();
                }

                Future<void> onRefresh() {
                  final companyState2 = context.read<CompanyBloc>().state;
                  final companyId = companyState2 is CompanyLoaded ? companyState2.selectedCompany?.id : null;
                  return provider.loadSales(companyId: companyId);
                }

                if (sales.isEmpty) {
                  return RefreshIndicator(
                    onRefresh: onRefresh,
                    child: refreshableScrollChild(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.receipt_long_outlined, size: 56, color: const Color(0xFF64748B).withValues(alpha: 0.4)),
                          const SizedBox(height: 12),
                          Text(context.tr('no_results_found'), style: GoogleFonts.outfit(fontSize: 16, color: const Color(0xFF64748B))),
                        ],
                      ),
                    ),
                  );
                }

                return RefreshIndicator(
                  onRefresh: onRefresh,
                  child: ListView.builder(
                    physics: refreshScrollPhysics,
                    padding: const EdgeInsets.all(16),
                    itemCount: sales.length,
                    itemBuilder: (context, index) {
                      final sale = sales[index];
                      final isCredit = sale.hasOutstanding;

                      return GestureDetector(
                        onTap: () async {
                          final result = await Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => SaleDetailScreen(sale: sale)),
                          );
                          if (result == true && mounted) {
                            final companyState3 = context.read<CompanyBloc>().state;
                            final companyId = companyState3 is CompanyLoaded ? companyState3.selectedCompany?.id : null;
                            provider.loadSales(companyId: companyId);
                          }
                        },
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 40, height: 40,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF025EA7).withValues(alpha: 0.08),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(Icons.receipt_outlined, color: Color(0xFF025EA7), size: 20),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '#${sale.id.substring(0, 8)}',
                                      style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '${(sale.customerName.isEmpty || sale.customerName.toLowerCase().contains("walk-in") || sale.customerName.toLowerCase().contains("walk in")) ? context.tr("walk_in") : sale.customerName} · ETB ${sale.totalAmount.toStringAsFixed(2)}',
                                      style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF64748B)),
                                    ),
                                    if (sale.remainingBalance > 0) ...[
                                      const SizedBox(height: 2),
                                      Text(
                                        'Balance: ETB ${sale.remainingBalance.toStringAsFixed(2)}',
                                        style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFFD97706)),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              Builder(
                                builder: (context) {
                                  final key = sale.creditStatusKey();
                                  final badgeColor = key == 'paid'
                                      ? const Color(0xFF16A34A)
                                      : (key == 'partially_paid'
                                          ? const Color(0xFFD97706)
                                          : const Color(0xFFDC2626));
                                  final badgeText = key == 'paid'
                                      ? context.tr('paid')
                                      : (key == 'partially_paid'
                                          ? context.tr('partially_paid')
                                          : context.tr('credit'));
                                  return Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: badgeColor.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(20),
                                      border: Border.all(
                                        color: badgeColor.withValues(alpha: 0.3),
                                        width: 0.8,
                                      ),
                                    ),
                                    child: Text(
                                      badgeText,
                                      style: GoogleFonts.outfit(
                                        fontSize: 12, fontWeight: FontWeight.w600,
                                        color: badgeColor,
                                      ),
                                    ),
                                  );
                                },
                              ),
                              const SizedBox(width: 4),
                              Icon(Icons.chevron_right, color: const Color(0xFF64748B).withValues(alpha: 0.5), size: 20),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),

          SafeArea(
            top: false,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF025EA7).withValues(alpha: 0.05),
                border: const Border(top: BorderSide(color: Color(0xFFE2E8F0))),
              ),
              child: Consumer<SaleProvider>(
                builder: (context, provider, _) {
                  var sales = provider.sales;
                  if (_searchQuery.isNotEmpty) {
                    sales = sales.where((s) =>
                      s.customerName.toLowerCase().contains(_searchQuery) ||
                      s.id.toLowerCase().contains(_searchQuery) ||
                      s.id.substring(0, s.id.length > 8 ? 8 : s.id.length).toLowerCase().contains(_searchQuery)
                    ).toList();
                  }
                  return _buildSalesSummary(sales);
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSalesSummary(List<SaleModel> sales) {
    final totalQty = sales.fold<int>(
      0,
      (sum, s) => sum + s.items.fold<int>(0, (a, it) => a + it.quantity),
    );
    final totalPrice = sales.fold<double>(0, (sum, s) => sum + s.totalAmount);
    final locations = <String>{
      for (final s in sales)
        if (s.shopName != null && s.shopName!.isNotEmpty) s.shopName!,
      for (final s in sales)
        if (s.warehouseName.isNotEmpty) s.warehouseName,
    }.join(', ');

    return Row(
      children: [
        _summaryStat(context.tr('total_quantity'), '$totalQty'),
        _summaryDivider(),
        _summaryStat(context.tr('total'), 'ETB ${totalPrice.toStringAsFixed(2)}'),
        _summaryDivider(),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                context.tr('location'),
                style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF94A3B8)),
              ),
              const SizedBox(height: 2),
              Text(
                locations.isEmpty ? '-' : locations,
                textAlign: TextAlign.end,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: const Color(0xFF0F172A)),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _summaryStat(String label, String value) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label, style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF94A3B8))),
          const SizedBox(height: 2),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A)),
          ),
        ],
      ),
    );
  }

  Widget _summaryDivider() {
    return Container(
      width: 1,
      height: 32,
      margin: const EdgeInsets.symmetric(horizontal: 12),
      color: const Color(0xFFE2E8F0),
    );
  }

  void _applyFilter(String? status) {
    setState(() => _statusFilter = status);
    final companyState = context.read<CompanyBloc>().state;
    final companyId = companyState is CompanyLoaded ? companyState.selectedCompany?.id : null;
    Provider.of<SaleProvider>(context, listen: false).loadSales(companyId: companyId, status: status);
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _FilterChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF025EA7) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? const Color(0xFF025EA7) : const Color(0xFFE2E8F0)),
        ),
        child: Text(
          label,
          style: GoogleFonts.outfit(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: selected ? Colors.white : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }
}