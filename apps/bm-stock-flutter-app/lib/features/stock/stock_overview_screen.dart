import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/bloc/product/product_bloc.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/report_export_service.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/models/product_model.dart';
import '../products/product_detail_screen.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kRed = Color(0xFFDC2626);
const _kAmber = Color(0xFFD97706);

class StockOverviewScreen extends StatefulWidget {
  const StockOverviewScreen({super.key});

  @override
  State<StockOverviewScreen> createState() => _StockOverviewScreenState();
}

class _StockOverviewScreenState extends State<StockOverviewScreen> {
  int _selectedTab = 0;
  bool _exporting = false;

  Future<void> _exportLowStock(List<ProductModel> products) async {
    if (products.isEmpty) return;
    setState(() => _exporting = true);
    try {
      final bytes = ReportExportService.buildCsv(
        context.tr('low_stock'),
        [
          ReportSection(
            title: context.tr('low_stock'),
            columns: ['Name', 'SKU', 'Stock', 'Min Stock', 'Price'],
            rows: products
                .map((p) => [p.name, p.sku, p.stockQuantity, p.minStockLevel, p.price.toStringAsFixed(2)])
                .toList(),
          ),
        ],
      );
      await ReportExportService.shareBytes(bytes, 'low_stock_${DateTime.now().millisecondsSinceEpoch}.csv');
      if (mounted) showAppToast(context, context.tr('export_report'), type: AppToastType.success);
    } catch (e) {
      if (mounted) showAppToast(context, '${context.tr('export_failed')}: $e', type: AppToastType.error);
    }
    if (mounted) setState(() => _exporting = false);
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ProductBloc>().add(ProductStockOverviewLoad());
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
          icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(context.tr('stock_overview'), style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
        actions: [
          BlocBuilder<ProductBloc, ProductState>(
            builder: (context, state) {
              if (_selectedTab != 0) return const SizedBox.shrink();
              return IconButton(
                icon: _exporting
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.download_outlined, color: _kBlue),
                tooltip: context.tr('export_low_stock'),
                onPressed: _exporting ? null : () => _exportLowStock(state.lowStockProducts),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Tab bar
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _TabChip(
                  label: context.tr('low_stock'),
                  isSelected: _selectedTab == 0,
                  onTap: () => setState(() => _selectedTab = 0),
                ),
                const SizedBox(width: 8),
                _TabChip(
                  label: context.tr('expired'),
                  isSelected: _selectedTab == 1,
                  onTap: () => setState(() => _selectedTab = 1),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Content
          Expanded(
            child: BlocBuilder<ProductBloc, ProductState>(
              builder: (context, state) {
                if (state.isLoading) return const Center(child: CircularProgressIndicator());

                final items = _selectedTab == 0 ? state.lowStockProducts : state.expiredProducts;

                if (items.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _selectedTab == 0 ? Icons.inventory_2_outlined : Icons.event_busy_outlined,
                          size: 56,
                          color: _kSlate.withValues(alpha: 0.4),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          context.tr('no_results_found'),
                          style: GoogleFonts.outfit(fontSize: 16, color: _kSlate),
                        ),
                      ],
                    ),
                  );
                }

                return RefreshIndicator(
                  onRefresh: () async { context.read<ProductBloc>().add(ProductStockOverviewLoad()); },
                  child: ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) => _StockItemCard(
                      product: items[i],
                      isExpired: _selectedTab == 1,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => ProductDetailScreen(product: items[i])),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _TabChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;
  const _TabChip({required this.label, required this.isSelected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? _kBlue.withValues(alpha: 0.1) : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: isSelected ? _kBlue.withValues(alpha: 0.3) : _kBorder),
        ),
        child: Text(
          label,
          style: GoogleFonts.outfit(
            fontSize: 14,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
            color: isSelected ? _kBlue : _kSlate,
          ),
        ),
      ),
    );
  }
}

class _StockItemCard extends StatelessWidget {
  final ProductModel product;
  final bool isExpired;
  final VoidCallback onTap;
  const _StockItemCard({required this.product, required this.isExpired, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final badgeColor = isExpired ? _kRed : _kAmber;
    final badgeText = isExpired ? context.tr('expired').toUpperCase() : context.tr('low_stock').toUpperCase();
    final badgeIcon = isExpired ? Icons.event_busy : Icons.warning_amber_rounded;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: badgeColor.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(
                color: badgeColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(badgeIcon, color: badgeColor, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.name, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk)),
                  const SizedBox(height: 2),
                  if (isExpired && product.expiryDate != null)
                    Text('${context.tr('expiry_date')}: ${_fmtDate(product.expiryDate!)}', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate))
                  else
                    Text('${context.tr('quantity')}: ${product.stockQuantity} / ${context.tr('min')}: ${product.minStockLevel}', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: badgeColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(badgeText, style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w600, color: badgeColor)),
            ),
          ],
        ),
      ),
    );
  }

  String _fmtDate(String date) {
    try {
      final dt = DateTime.parse(date);
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return date;
    }
  }
}
