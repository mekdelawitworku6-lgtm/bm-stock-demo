import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/bloc/auth/auth_bloc.dart';
import '../../core/localization/app_localizations.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kGreen = Color(0xFF16A34A);

class ShopProductDetailScreen extends StatefulWidget {
  final String shopId;
  final String productId;
  final String productName;
  const ShopProductDetailScreen({
    super.key,
    required this.shopId,
    required this.productId,
    required this.productName,
  });

  @override
  State<ShopProductDetailScreen> createState() => _ShopProductDetailScreenState();
}

class _ShopProductDetailScreenState extends State<ShopProductDetailScreen> {
  final ApiClient _api = ApiClient();
  bool _loading = true;
  Map<String, dynamic>? _product;
  List<dynamic> _receiveHistory = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _api.get('/shops/${widget.shopId}/with-products'),
        _api.get('/transfers/history/${widget.shopId}', queryParams: {'type': 'shop'}),
      ]);
      if (mounted) {
        final shopData = results[0];
        final products = shopData is List
            ? shopData
            : (shopData is Map ? (shopData['data'] is List ? shopData['data'] as List : []) : []);
        Map<String, dynamic>? foundProd;
        for (final p in products) {
          if (p is Map && p['id'] == widget.productId) {
            foundProd = Map<String, dynamic>.from(p);
            break;
          }
        }
        if (foundProd == null) {
          try {
            final direct = await _api.get('/products/${widget.productId}');
            if (direct is Map<String, dynamic>) {
              foundProd = direct.containsKey('data') && direct['data'] is Map<String, dynamic>
                  ? direct['data'] as Map<String, dynamic>
                  : direct;
            }
          } catch (_) {}
        }
        setState(() {
          _product = foundProd;
          final hist = results[1];
          _receiveHistory = hist is List
              ? hist.where((t) => t['toShopId'] == widget.shopId).toList()
              : [];
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
                    Text(context.tr('receive_history'),
                        style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk)),
                    const SizedBox(height: 12),
                    if (_receiveHistory.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: _kBorder),
                        ),
                        child: Center(
                          child: Text(context.tr('no_receive_history'),
                              style: GoogleFonts.outfit(color: _kSlate)),
                        ),
                      )
                    else
                      ..._receiveHistory.map((t) => _buildReceiveRow(t)),
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

  String _formatPrice(dynamic val) {
    if (val == null) return '0.00';
    final num? n = val is num ? val : num.tryParse(val.toString());
    return (n ?? 0).toStringAsFixed(2);
  }

  Widget _buildInfoSection() {
    final isAdmin = context.read<AuthBloc>().user?.isAdmin ?? false;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        children: [
          if (isAdmin)
            _infoRow(context.tr('purchase_price'), 'ETB ${_formatPrice(_product!['cost'] ?? _product!['costPrice'] ?? _product!['purchasePrice'])}'),
          _infoRow(context.tr('selling_price'), 'ETB ${_formatPrice(_product!['price'] ?? _product!['sellingPrice'])}'),
          _infoRow(context.tr('stock_quantity'), '${_product!['stockQuantity'] ?? 0}'),
          _infoRow(context.tr('min_stock_level'), '${_product!['minStockLevel'] ?? 0}'),
        ],
      ),
    );
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

  Widget _buildReceiveRow(dynamic transfer) {
    final qty = transfer['quantity'] ?? 0;
    final date = transfer['createdAt'] ?? '';
    final from = transfer['fromWarehouseName'] ?? transfer['fromShopName'] ?? 'Unknown';
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
              color: const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.arrow_downward, color: _kGreen, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${context.tr('received_from')} $from',
                    style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: _kInk, fontSize: 14)),
                Text('${context.tr('by')}: $by  |  $date',
                    style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
              ],
            ),
          ),
          Text('+$qty',
              style: GoogleFonts.outfit(
                  fontWeight: FontWeight.bold, fontSize: 16, color: _kGreen)),
        ],
      ),
    );
  }
}
