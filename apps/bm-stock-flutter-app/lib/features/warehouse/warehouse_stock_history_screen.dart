import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/inventory_service.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kGreen = Color(0xFF16A34A);
const _kRed = Color(0xFFDC2626);

class WarehouseStockHistoryScreen extends StatefulWidget {
  final String warehouseId;
  final String warehouseName;
  const WarehouseStockHistoryScreen({super.key, required this.warehouseId, required this.warehouseName});

  @override
  State<WarehouseStockHistoryScreen> createState() => _WarehouseStockHistoryScreenState();
}

class _WarehouseStockHistoryScreenState extends State<WarehouseStockHistoryScreen> {
  final _service = InventoryService();
  List<dynamic> _transactions = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final rows = await _service.getTransactions(warehouseId: widget.warehouseId, limit: 100);
      if (mounted) setState(() { _transactions = rows; _loading = false; });
    } catch (_) {
      if (mounted) setState(() { _transactions = []; _loading = false; });
    }
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
        title: Text(context.tr('stock_history'), style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _kBlue))
          : RefreshIndicator(
              onRefresh: _load,
              child: _transactions.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        SizedBox(
                          height: MediaQuery.of(context).size.height * 0.4,
                          child: Center(child: Text(context.tr('no_results_found'), style: GoogleFonts.outfit(color: _kSlate))),
                        ),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _transactions.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) => _TxRow(data: _transactions[i]),
                    ),
            ),
    );
  }
}

class _TxRow extends StatelessWidget {
  final Map<String, dynamic> data;
  const _TxRow({required this.data});

  @override
  Widget build(BuildContext context) {
    final type = (data['type'] ?? '').toString();
    final isIn = type.contains('in');
    final qty = data['quantity'] ?? 0;
    final product = data['product'] is Map ? (data['product']['name'] ?? '') : (data['productName'] ?? 'Product');
    final reason = (data['reason'] ?? data['notes'] ?? '').toString();
    final date = (data['createdAt'] ?? '').toString();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Row(
        children: [
          Icon(isIn ? Icons.arrow_downward : Icons.arrow_upward, color: isIn ? _kGreen : _kRed, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$product', style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk)),
                Text('${isIn ? '+' : '-'}$qty${reason.isNotEmpty ? ' · $reason' : ''}',
                    style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
              ],
            ),
          ),
          if (date.isNotEmpty)
            Text(date.length >= 10 ? date.substring(0, 10) : date, style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
        ],
      ),
    );
  }
}
