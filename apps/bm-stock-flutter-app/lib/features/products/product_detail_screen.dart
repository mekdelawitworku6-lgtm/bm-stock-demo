import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/bloc/product/product_bloc.dart';
import '../../core/bloc/auth/auth_bloc.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/product_model.dart';
import '../../core/utils/product_status_helper.dart';
import '../../core/widgets/app_toast.dart';
import 'add_product_screen.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);

class ProductDetailScreen extends StatelessWidget {
  final ProductModel product;
  const ProductDetailScreen({super.key, required this.product});

  @override
  Widget build(BuildContext context) {
    final isLowStock = product.isLowStock && product.trackStock;
    final profit = product.price - product.cost;
    final isAdmin = context.read<AuthBloc>().user?.isAdmin ?? false;

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
        title: Text(context.tr('product_details'), style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: _kSlate),
            onSelected: (val) async {
              if (val == 'edit') {
                final result = await Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => AddProductScreen(product: product)),
                );
                if (result == true && context.mounted) Navigator.pop(context);
              } else if (val == 'delete') {
                _showDeleteDialog(context);
              }
            },
            itemBuilder: (_) => [
              PopupMenuItem(value: 'edit', child: Text(context.tr('edit'), style: GoogleFonts.outfit())),
              PopupMenuItem(
                value: 'delete',
                child: Text(context.tr('delete'), style: GoogleFonts.outfit(color: const Color(0xFFDC2626))),
              ),
            ],
          ),
        ],
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _kBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: _kBlue.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Center(
                          child: Text(
                            product.name.isNotEmpty ? product.name[0].toUpperCase() : '?',
                            style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.bold, color: _kBlue),
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              product.name,
                              style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              product.brand.isNotEmpty ? '${product.category} · Brand: ${product.brand}' : product.category,
                              style: GoogleFonts.outfit(fontSize: 13, color: _kSlate),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (product.description != null && product.description!.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text(
                      product.description!,
                      style: GoogleFonts.outfit(fontSize: 14, color: _kSlate, height: 1.4),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Price & Stock row
            Row(
              children: [
                _InfoCard(
                  title: context.tr('selling_price'),
                  value: 'ETB ${product.price.toStringAsFixed(2)}',
                  color: _kBlue,
                ),
                if (isAdmin) ...[
                  const SizedBox(width: 12),
                  _InfoCard(
                    title: context.tr('purchase_price'),
                    value: 'ETB ${product.cost.toStringAsFixed(2)}',
                    color: _kSlate,
                  ),
                ],
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _InfoCard(
                  title: context.tr('stock'),
                  value: product.stockQuantity.toString(),
                  color: isLowStock ? const Color(0xFFD97706) : _kInk,
                ),
                if (isAdmin) ...[
                  const SizedBox(width: 12),
                  _InfoCard(
                    title: context.tr('gross_profit'),
                    value: 'ETB ${profit.toStringAsFixed(2)}',
                    color: profit >= 0 ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 12),

            // Details card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _kBorder),
              ),
              child: Column(
                children: [
                  _DetailRow(label: context.tr('sku'), value: product.sku),
                  if (product.brand.isNotEmpty) _DetailRow(label: context.tr('brand'), value: product.brand),
                  if (product.barcode != null) _DetailRow(label: context.tr('barcode'), value: product.barcode!),
                  _DetailRow(label: 'Unit', value: product.unit),
                  _DetailRow(label: 'Type', value: product.type),
                  _DetailRow(label: context.tr('tax'), value: '${product.taxRate}%'),
                  _DetailRow(label: context.tr('min_stock_level'), value: product.minStockLevel.toString()),
                  _DetailRow(label: context.tr('track_stock'), value: product.trackStock ? 'Yes' : 'No'),
                  _DetailRow(
                    label: context.tr('status'),
                    value: ProductStatusHelper.toUi(product.status) == 'inactive'
                        ? context.tr('inactive')
                        : context.tr('active'),
                  ),
                  if (product.expiryDate != null) _DetailRow(label: context.tr('expiry_date'), value: product.expiryDate!),
                  _DetailRow(label: context.tr('date'), value: _formatDate(product.createdAt)),
                  _DetailRow(label: context.tr('date'), value: _formatDate(product.updatedAt), showDivider: false),
                ],
              ),
            ),
            const SizedBox(height: 20),
            TextButton.icon(
              onPressed: () => _showDeleteDialog(context),
              icon: const Icon(Icons.delete_outline, color: Color(0xFFDC2626), size: 20),
              label: Text(
                context.tr('delete'),
                style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: const Color(0xFFDC2626)),
              ),
              style: TextButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626).withValues(alpha: 0.06),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: Color(0x33DC2626))),
              ),
            ),
          ],
        ),
      ),
    );
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

  void _showDeleteDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(context.tr('delete_product_perm'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: _kInk)),
        content: Text(
          '${context.tr('delete')} "${product.name}"?',
          style: GoogleFonts.outfit(color: _kSlate),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(context.tr('cancel'), style: GoogleFonts.outfit(color: _kSlate)),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              context.read<ProductBloc>().add(ProductDeleteRequested(id: product.id));
              final state = await context.read<ProductBloc>().stream
                  .skip(1)
                  .firstWhere((s) => !s.isLoading && s.lastActionSuccess != null);
              final success = state.lastActionSuccess == true;
              if (context.mounted) {
                showAppToast(
                  context,
                  success ? context.tr('product_removed_success') : (state.error ?? context.tr('failed')),
                  type: success ? AppToastType.success : AppToastType.error,
                );
                if (success) Navigator.pop(context);
              }
            },
            child: Text(context.tr('delete'), style: GoogleFonts.outfit(color: const Color(0xFFDC2626), fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final String title;
  final String value;
  final Color color;

  const _InfoCard({required this.title, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _kBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
            const SizedBox(height: 4),
            Text(
              value,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: color),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final bool showDivider;

  const _DetailRow({required this.label, required this.value, this.showDivider = true});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Text(
                  label,
                  style: GoogleFonts.outfit(fontSize: 14, color: _kSlate),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 12),
              Flexible(
                child: Text(
                  value,
                  textAlign: TextAlign.right,
                  style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w500, color: _kInk),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
        if (showDivider) Divider(height: 1, color: _kBorder.withValues(alpha: 0.6)),
      ],
    );
  }
}
