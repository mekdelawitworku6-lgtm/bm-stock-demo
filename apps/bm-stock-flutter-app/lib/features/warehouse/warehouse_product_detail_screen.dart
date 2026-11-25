import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/bloc/auth/auth_bloc.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/widgets/app_toast.dart';
import '../transfer/create_transfer_screen.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kGreen = Color(0xFF16A34A);
const _kAmber = Color(0xFFD97706);
const _kRed = Color(0xFFDC2626);

class WarehouseProductDetailScreen extends StatefulWidget {
  final String warehouseId;
  final String productId;
  final String productName;
  const WarehouseProductDetailScreen({
    super.key,
    required this.warehouseId,
    required this.productId,
    required this.productName,
  });

  @override
  State<WarehouseProductDetailScreen> createState() => _WarehouseProductDetailScreenState();
}

class _WarehouseProductDetailScreenState extends State<WarehouseProductDetailScreen> {
  final ApiClient _api = ApiClient();
  bool _loading = true;
  Map<String, dynamic>? _product;
  List<dynamic> _transferHistory = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }
  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _api.get('/warehouses/${widget.warehouseId}/products/${widget.productId}'),
        _api.get('/transfers/history/${widget.warehouseId}', queryParams: {'type': 'warehouse'}),
      ]);
      if (mounted) {
        final data = results[0];
        Map<String, dynamic>? resolvedProd;
        if (data is Map<String, dynamic>) {
          if (data['products'] is List && (data['products'] as List).isNotEmpty) {
            final wp = (data['products'] as List).first;
            if (wp is Map) {
              final prodMap = wp['product'] is Map
                  ? Map<String, dynamic>.from(wp['product'] as Map)
                  : Map<String, dynamic>.from(wp);
              prodMap['stockQuantity'] = wp['stockQuantity'] ?? wp['quantity'] ?? prodMap['stockQuantity'] ?? 0;
              prodMap['minStockLevel'] = wp['minStockLevel'] ?? prodMap['minStockLevel'] ?? 0;
              prodMap['warehouseProductId'] = wp['warehouseProductId'] ?? wp['id'];
              resolvedProd = prodMap;
            }
          } else if (data['id'] == widget.productId || data['price'] != null) {
            resolvedProd = data;
          }
        }
        if (resolvedProd == null) {
          try {
            final direct = await _api.get('/products/${widget.productId}');
            if (direct is Map<String, dynamic>) {
              resolvedProd = direct.containsKey('data') && direct['data'] is Map<String, dynamic>
                  ? direct['data'] as Map<String, dynamic>
                  : direct;
            }
          } catch (_) {}
        }
        setState(() {
          _product = resolvedProd;
          final hist = results[1];
          _transferHistory = hist is List ? hist : [];
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
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
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(widget.productName,
            style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _kBlue))
          : _product == null
              ? Center(child: Text(context.tr('product_not_found'), style: GoogleFonts.outfit(color: _kSlate)))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _buildProductHeader(),
                    const SizedBox(height: 16),
                    _buildInfoSection(),
                    const SizedBox(height: 20),
                    Text(context.tr('transfer_history'),
                        style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk)),
                    const SizedBox(height: 12),
                    if (_transferHistory.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: _kBorder),
                        ),
                        child: Center(
                          child: Text(context.tr('no_transfer_history'),
                              style: GoogleFonts.outfit(color: _kSlate)),
                        ),
                      )
                    else
                      ..._transferHistory.take(20).map((t) => _buildTransferRow(t)),
                  ],
                ),
    );
  }

  Widget _buildProductHeader() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: _kBg,
              borderRadius: BorderRadius.circular(14),
            ),
            child: _product!['imageUrl'] != null
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Image.network(_product!['imageUrl'], fit: BoxFit.cover),
                  )
                : const Icon(Icons.inventory_2_outlined, color: _kBlue, size: 32),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_product!['name'] ?? '',
                    style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk)),
                const SizedBox(height: 4),
                Text('SKU: ${_product!['sku'] ?? ''}',
                    style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
                const SizedBox(height: 2),
                Text('${_product!['category'] ?? ''}  |  ${_product!['unit'] ?? ''}',
                    style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        children: [
          if (context.read<AuthBloc>().user?.isAdmin ?? false)
            _infoRow(context.tr('purchase_price'), 'ETB ${_formatPrice(_product!['cost'] ?? _product!['costPrice'] ?? _product!['purchasePrice'])}'),
          _infoRow(context.tr('selling_price'), 'ETB ${_formatPrice(_product!['price'] ?? _product!['sellingPrice'])}'),
          _infoRow(context.tr('stock_quantity'), '${_product!['stockQuantity'] ?? 0}'),
          _infoRow(context.tr('min_stock_level'), '${_product!['minStockLevel'] ?? 0}'),
          if (_product!['description'] != null && _product!['description'].toString().isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(_product!['description'],
                    style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
              ),
            ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _showStockAdjustDialog(),
                  icon: const Icon(Icons.tune, size: 16, color: _kBlue),
                  label: Text(context.tr('adjust_stock'), style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: _kBlue, fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: _kBlue),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.push(context, MaterialPageRoute(
                    builder: (_) => CreateTransferScreen(fromWarehouseId: widget.warehouseId),
                  )).then((_) => _loadData()),
                  icon: const Icon(Icons.swap_horiz, size: 16, color: _kGreen),
                  label: Text(context.tr('transfer'), style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: _kGreen, fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: _kGreen),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showStockAdjustDialog() {
    final controller = TextEditingController();
    String type = 'stock_in';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(ctx.tr('adjust_stock'), style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk)),
                  const SizedBox(height: 4),
                  Text(_product!['name'] ?? '', style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setModalState(() => type = 'stock_in'),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: type == 'stock_in' ? const Color(0xFFF0FDF4) : Colors.white,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: type == 'stock_in' ? _kGreen : _kBorder, width: type == 'stock_in' ? 1.5 : 1),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.add_circle_outline, size: 16, color: type == 'stock_in' ? _kGreen : _kSlate),
                                const SizedBox(width: 6),
                                Text(ctx.tr('stock_in'), style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: type == 'stock_in' ? _kGreen : _kSlate, fontSize: 13)),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setModalState(() => type = 'stock_out'),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: type == 'stock_out' ? const Color(0xFFFEF2F2) : Colors.white,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: type == 'stock_out' ? _kRed : _kBorder, width: type == 'stock_out' ? 1.5 : 1),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.remove_circle_outline, size: 16, color: type == 'stock_out' ? _kRed : _kSlate),
                                const SizedBox(width: 6),
                                Text(ctx.tr('stock_out'), style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: type == 'stock_out' ? _kRed : _kSlate, fontSize: 13)),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: controller,
                    keyboardType: TextInputType.number,
                    style: GoogleFonts.outfit(fontSize: 14),
                    decoration: InputDecoration(
                      hintText: ctx.tr('enter_quantity'),
                      hintStyle: GoogleFonts.outfit(color: _kSlate, fontSize: 14),
                      filled: true,
                      fillColor: _kBg,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBorder)),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _kBlue, width: 1.5)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () async {
                        final qty = int.tryParse(controller.text);
                        if (qty == null || qty <= 0) return;
                        Navigator.pop(ctx);
                        await _adjustStock(type, qty);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _kBlue,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: Text(ctx.tr('confirm'), style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold)),
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

  Future<void> _adjustStock(String type, int quantity) async {
    try {
      await _api.post('/inventory/adjust', body: {
        'productId': widget.productId,
        'warehouseId': widget.warehouseId,
        'type': type,
        'quantity': quantity,
      });
      if (mounted) {
        showAppToast(context, type == 'stock_in' ? 'Stock increased by $quantity' : 'Stock decreased by $quantity',
            type: type == 'stock_in' ? AppToastType.success : AppToastType.error);
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        showAppToast(context, '${context.tr('failed')}: $e', type: AppToastType.error);
      }
    }
  }

  String _formatPrice(dynamic val) {
    if (val == null) return '0.00';
    final num? n = val is num ? val : num.tryParse(val.toString());
    return (n ?? 0).toStringAsFixed(2);
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.outfit(fontSize: 14, color: _kSlate)),
          Text(value, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kInk)),
        ],
      ),
    );
  }

  Widget _buildTransferRow(dynamic transfer) {
    final isOut = transfer['fromWarehouseId'] == widget.warehouseId;
    final branch = isOut ? (transfer['toShopName'] ?? '') : (transfer['fromShopName'] ?? '');
    final qty = transfer['quantity'] ?? 0;
    final date = transfer['createdAt'] ?? '';
    final by = transfer['requestedByName'] ?? '';

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
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: isOut ? const Color(0xFFFFF7ED) : const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              isOut ? Icons.arrow_upward : Icons.arrow_downward,
              color: isOut ? _kAmber : _kGreen,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${isOut ? context.tr('sent_to') : context.tr('received_from')} $branch',
                    style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: _kInk, fontSize: 14)),
                Text('${context.tr('by')}: $by  |  $date',
                    style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
              ],
            ),
          ),
          Text('${isOut ? '-' : '+'}$qty',
              style: GoogleFonts.outfit(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: isOut ? _kAmber : _kGreen)),
        ],
      ),
    );
  }
}
