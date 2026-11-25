import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/recent_activity_model.dart';

const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kGreen = Color(0xFF16A34A);
const _kRed = Color(0xFFDC2626);

class StockTransactionDetailScreen extends StatelessWidget {
  final RecentActivityItem activity;

  const StockTransactionDetailScreen({super.key, required this.activity});

  String _title(BuildContext context) {
    switch (activity.type) {
      case RecentActivityType.stockOut:
        return context.tr('stock_out');
      case RecentActivityType.stockIn:
      default:
        return context.tr('stock_in');
    }
  }

  Color _accentColor() {
    return activity.type == RecentActivityType.stockOut ? _kRed : _kGreen;
  }

  IconData _icon() {
    return activity.type == RecentActivityType.stockOut
        ? Icons.indeterminate_check_box_outlined
        : Icons.add_box_outlined;
  }

  String _formatDateTime(DateTime date) {
    final local = date.toLocal();
    final h = local.hour.toString().padLeft(2, '0');
    final m = local.minute.toString().padLeft(2, '0');
    return '${local.day.toString().padLeft(2, '0')}/${local.month.toString().padLeft(2, '0')}/${local.year} $h:$m';
  }

  @override
  Widget build(BuildContext context) {
    final accent = _accentColor();
    final qtyPrefix = activity.type == RecentActivityType.stockOut ? '-' : '+';

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
          context.tr('stock_transaction_detail'),
          style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: accent.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(_icon(), color: accent, size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _title(context),
                        style: GoogleFonts.outfit(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: accent,
                        ),
                      ),
                      Text(
                        activity.productName.isNotEmpty ? activity.productName : '--',
                        style: GoogleFonts.outfit(fontSize: 14, color: _kInk),
                      ),
                      Text(
                        _formatDateTime(activity.occurredAt),
                        style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                      ),
                    ],
                  ),
                ),
                if (activity.quantity != null)
                  Text(
                    '$qtyPrefix${activity.quantity}',
                    style: GoogleFonts.outfit(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: accent,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _infoCard(context, accent, qtyPrefix),
        ],
      ),
    );
  }

  Widget _infoCard(BuildContext context, Color accent, String qtyPrefix) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        children: [
          _row(context.tr('product_name'), activity.productName.isNotEmpty ? activity.productName : '--'),
          if (activity.quantity != null)
            _row(context.tr('quantity'), '$qtyPrefix${activity.quantity}', valueColor: accent, bold: true),
          if (activity.previousQuantity != null)
            _row(context.tr('previous_quantity'), '${activity.previousQuantity}'),
          if (activity.newQuantity != null)
            _row(context.tr('new_quantity'), '${activity.newQuantity}'),
          if (activity.locationName != null && activity.locationName!.isNotEmpty)
            _row(context.tr('store'), activity.locationName!),
          if (activity.performedByName != null && activity.performedByName!.isNotEmpty)
            _row(context.tr('salesperson'), activity.performedByName!),
          if (activity.reason != null && activity.reason!.isNotEmpty)
            _row(context.tr('reason'), activity.reason!),
          if (activity.referenceNumber != null && activity.referenceNumber!.isNotEmpty)
            _row(context.tr('reference'), activity.referenceNumber!),
        ],
      ),
    );
  }

  Widget _row(String label, String value, {Color? valueColor, bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 2,
            child: Text(label, style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
          ),
          Expanded(
            flex: 3,
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: GoogleFonts.outfit(
                fontSize: 13,
                fontWeight: bold ? FontWeight.w700 : FontWeight.w600,
                color: valueColor ?? _kInk,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
