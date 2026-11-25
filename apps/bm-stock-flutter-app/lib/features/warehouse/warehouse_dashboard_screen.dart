import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_response.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/product_model.dart';
import '../stock/stock_in_screen.dart';
import '../stock/stock_out_screen.dart';
import 'warehouse_stock_history_screen.dart';
import '../products/add_product_screen.dart';
import '../products/product_entry_screen.dart';
import '../transfer/transfer_history_screen.dart';
import 'warehouse_product_detail_screen.dart';
import 'package:provider/provider.dart';
import '../../core/providers/branch_provider.dart';
import '../../core/widgets/product_filter_header.dart';
import '../../core/widgets/refreshable_scroll.dart';
import '../../core/widgets/app_toast.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kGreen = Color(0xFF16A34A);
const _kAmber = Color(0xFFD97706);
const _kRed = Color(0xFFDC2626);

class WarehouseDashboardScreen extends StatefulWidget {
  final String warehouseId;
  final String warehouseName;
  const WarehouseDashboardScreen({
    super.key,
    required this.warehouseId,
    required this.warehouseName,
  });

  @override
  State<WarehouseDashboardScreen> createState() => _WarehouseDashboardScreenState();
}

class _WarehouseDashboardScreenState extends State<WarehouseDashboardScreen> {
  final ApiClient _api = ApiClient();
  bool _loading = true;
  Map<String, dynamic>? _dashboard;
  List<dynamic> _products = [];
  String _search = '';
  ItemStatusFilter _statusFilter = ItemStatusFilter.all;
  ProductSortOption _sortOption = ProductSortOption.dateNewest;
  CollectionFilter _collectionFilter = const CollectionFilter();
  int _loadDataToken = 0;
  String? _error;


  double _price(dynamic p) {
    final v = p['price'];
    if (v is num) return v.toDouble();
    return double.tryParse('$v') ?? 0;
  }


  List<dynamic> get _filteredProducts {
    var result = List<dynamic>.from(_products);

    switch (_statusFilter) {
      case ItemStatusFilter.active:
        result = result.where((p) {
          final st = (p['status'] ?? '').toString().toLowerCase();
          return st != 'inactive' && st != 'deleted' && p['isDeleted'] != true;
        }).toList();
        break;
      case ItemStatusFilter.inactive:
        result = result.where((p) {
          final st = (p['status'] ?? '').toString().toLowerCase();
          return st == 'inactive' || st == 'deleted' || p['isDeleted'] == true;
        }).toList();
        break;
      case ItemStatusFilter.all:
        break;
    }

    if (_collectionFilter.group != null && _collectionFilter.group!.isNotEmpty) {
      result = result.where((p) => (p['category'] ?? '').toString() == _collectionFilter.group).toList();
    }
    if (_collectionFilter.brand != null && _collectionFilter.brand!.isNotEmpty) {
      result = result.where((p) {
        final b = (p['brand'] ?? (p['metadata'] is Map ? p['metadata']['brand'] : '') ?? '').toString().toLowerCase();
        return b == _collectionFilter.brand!.toLowerCase();
      }).toList();
    }
    if (_collectionFilter.mark != null && _collectionFilter.mark!.isNotEmpty) {
      result = result.where((p) => (p['mark'] ?? '').toString() == _collectionFilter.mark).toList();
    }
    if (_collectionFilter.branchId != null && _collectionFilter.branchId!.isNotEmpty) {
      result = result.where((p) => (p['warehouseId'] ?? p['shopId'] ?? '').toString() == _collectionFilter.branchId).toList();
    }

    final q = _search.toLowerCase().trim();
    if (q.isNotEmpty) {
      result = result.where((p) {
        final name = (p['name'] ?? '').toString().toLowerCase();
        final sku = (p['sku'] ?? '').toString().toLowerCase();
        final category = (p['category'] ?? '').toString().toLowerCase();
        final brand = (p['brand'] ?? (p['metadata'] is Map ? p['metadata']['brand'] : '') ?? '').toString().toLowerCase();
        final barcode = (p['barcode'] ?? '').toString().toLowerCase();
        return name.contains(q) ||
            sku.contains(q) ||
            category.contains(q) ||
            brand.contains(q) ||
            barcode.contains(q);
      }).toList();
    }

    switch (_sortOption) {
      case ProductSortOption.dateNewest:
        result.sort((a, b) => (b['createdAt'] ?? '').toString().compareTo((a['createdAt'] ?? '').toString()));
        break;
      case ProductSortOption.dateOldest:
        result.sort((a, b) => (a['createdAt'] ?? '').toString().compareTo((b['createdAt'] ?? '').toString()));
        break;
      case ProductSortOption.priceLowHigh:
        result.sort((a, b) => _price(a).compareTo(_price(b)));
        break;
      case ProductSortOption.priceHighLow:
        result.sort((a, b) => _price(b).compareTo(_price(a)));
        break;
      case ProductSortOption.nameAZ:
        result.sort((a, b) => (a['name'] ?? '').toString().toLowerCase().compareTo((b['name'] ?? '').toString().toLowerCase()));
        break;
      case ProductSortOption.nameZA:
        result.sort((a, b) => (b['name'] ?? '').toString().toLowerCase().compareTo((a['name'] ?? '').toString().toLowerCase()));
        break;
    }
    return result;
  }

  bool get _hasActiveFilters =>
      _statusFilter != ItemStatusFilter.all || !_collectionFilter.isEmpty || _sortOption != ProductSortOption.dateNewest || _search.isNotEmpty;

  void _clearFilters() {
    setState(() {
      _search = '';
      _statusFilter = ItemStatusFilter.all;
      _sortOption = ProductSortOption.dateNewest;
      _collectionFilter = const CollectionFilter();
    });
  }

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final token = ++_loadDataToken;
    setState(() { _loading = true; _error = null; });
    try {
      Map<String, dynamic>? dashResult;
      List<dynamic> prods = [];

      try {
        dashResult = parseApiMap(await _api.get('/warehouses/${widget.warehouseId}/dashboard'));
      } catch (_) {}

      try {
        prods = parseApiList(await _api.get('/warehouses/${widget.warehouseId}/with-products'));
      } catch (_) {}

      if (mounted && token == _loadDataToken) {
        setState(() {
          _dashboard = dashResult;
          _products = prods;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted && token == _loadDataToken) setState(() { _loading = false; _error = '$e'; });
    }
  }

  String _formatValue(dynamic v) {
    final n = (v is num) ? v.toDouble() : (double.tryParse('$v') ?? 0);
    if (n >= 1000000) return 'ETB ${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return 'ETB ${(n / 1000).toStringAsFixed(1)}K';
    return 'ETB ${n.toStringAsFixed(0)}';
  }

  @override
  Widget build(BuildContext context) {
    final filteredProducts = _filteredProducts;

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
        title: Text(widget.warehouseName,
            style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk)),
        actions: [
          IconButton(
            icon: const Icon(Icons.history, color: _kSlate, size: 22),
            tooltip: context.tr('history'),
            onPressed: () => Navigator.push(context, MaterialPageRoute(
              builder: (_) => const TransferHistoryScreen(),
            )),
          ),
          IconButton(
            icon: const Icon(Icons.refresh, color: _kBlue, size: 22),
            onPressed: _loadData,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await Navigator.push(context, MaterialPageRoute(
            builder: (_) => ProductEntryScreen(warehouseId: widget.warehouseId),
          ));
          _loadData();
        },
        backgroundColor: _kBlue,
        icon: const Icon(Icons.add, color: Colors.white, size: 20),
        label: Text(context.tr('add_product'), style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _kBlue))
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                physics: refreshScrollPhysics,
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
                children: [
                  if (_error != null) ...[
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFFECACA)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline, color: _kRed, size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(context.tr('load_failed_pull_to_retry'),
                                style: GoogleFonts.outfit(fontSize: 12, color: _kRed)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  _buildStatsGrid(),
                  const SizedBox(height: 12),
                  _buildStockActions(context),
                  const SizedBox(height: 16),
                  _buildSearchBar(),
                  const SizedBox(height: 12),
                  _buildFilters(),
                  const SizedBox(height: 4),
                  if (filteredProducts.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text('${filteredProducts.length} ${context.tr('products')}',
                          style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                    ),
                  const SizedBox(height: 4),
                  if (filteredProducts.isEmpty)
                    _buildEmptyState()
                  else
                    ...filteredProducts.map((p) => _buildProductCard(p)),
                ],
              ),
            ),
    );
  }

  Widget _buildStockActions(BuildContext context) {
    // Anyone who can reach the warehouse dashboard has warehouse access, so
    // always show the stock in/out buttons. The backend enforces the actual
    // per-endpoint authorization — this is purely a UX concern.
    return Row(
      children: [
        Expanded(
          child: _actionBtn(
            context,
            icon: Icons.add_circle_outline,
            label: context.tr('stock_in'),
            color: _kGreen,
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => StockInScreen(warehouseId: widget.warehouseId)),
            ).then((_) => _loadData()),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _actionBtn(
            context,
            icon: Icons.remove_circle_outline,
            label: context.tr('stock_out'),
            color: _kRed,
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => StockOutScreen(warehouseId: widget.warehouseId)),
            ).then((_) => _loadData()),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _actionBtn(
            context,
            icon: Icons.history,
            label: context.tr('stock_history'),
            color: _kBlue,
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => WarehouseStockHistoryScreen(
                  warehouseId: widget.warehouseId,
                  warehouseName: widget.warehouseName,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _actionBtn(BuildContext context, {required IconData icon, required String label, required Color color, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _kBorder),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 4),
            Text(label, textAlign: TextAlign.center, style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600, color: _kInk)),
          ],
        ),
      ),
    );
  }

  double _toDouble(dynamic v) {
    if (v is num) return v.toDouble();
    return double.tryParse('$v') ?? 0;
  }

  Widget _buildStatsGrid() {
    final totalProducts = _dashboard?['totalProducts'] ?? _products.length;
    final totalQuantity = _dashboard?['totalQuantity'] ??
        _products.fold<int>(0, (sum, p) => sum + ((p['stockQuantity'] as num?)?.toInt() ?? 0));
    final lowStock = _dashboard?['lowStockProducts'] ?? 0;
    final totalSales = _toDouble(_dashboard?['totalSales']);
    final hasSales = totalSales > 0;

    final stats = <Widget>[
      _miniStat(Icons.inventory_2_outlined, '$totalProducts', context.tr('products'), _kBlue),
      _miniStat(Icons.shopping_cart_outlined, '$totalQuantity', context.tr('quantity'), _kGreen),
      if (hasSales)
        _miniStat(Icons.attach_money, _formatValue(totalSales), context.tr('total_sales'), _kBlue),
      _miniStat(Icons.warning_amber_rounded, '$lowStock', context.tr('low_stock'), lowStock > 0 ? _kRed : _kAmber),
    ];

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 1.8,
      children: stats,
    );
  }

  Widget _miniStat(IconData icon, String value, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 6),
          Text(value, style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk)),
          Text(label, style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return TextField(
      onChanged: (v) => setState(() => _search = v),
      style: GoogleFonts.outfit(fontSize: 14),
      decoration: InputDecoration(
        hintText: 'Search by name, brand, SKU, category...',
        hintStyle: GoogleFonts.outfit(color: _kSlate, fontSize: 13),
        prefixIcon: const Icon(Icons.search, color: _kSlate, size: 20),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _kBorder)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _kBorder)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _kBlue, width: 1.5)),
      ),
    );
  }

  Widget _buildFilters() {
    final branchProvider = Provider.of<BranchProvider>(context, listen: false);
    final branches = [
      ...branchProvider.warehouses.map((w) => {'id': w.id, 'name': w.name}),
      ...branchProvider.shops.map((s) => {'id': s.id, 'name': s.name}),
    ];
    final availableBrands = _products
        .map((p) => (p['brand'] ?? (p['metadata'] is Map ? p['metadata']['brand'] : '') ?? '').toString())
        .where((b) => b.isNotEmpty)
        .toSet()
        .toList()
      ..sort();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ProductFilterHeader(
          statusFilter: _statusFilter,
          sortOption: _sortOption,
          collectionFilter: _collectionFilter,
          availableGroups: _products.map((p) => (p['category'] ?? '').toString()).where((c) => c.isNotEmpty).toSet().toList(),
          availableBrands: availableBrands,
          availableMarks: const ['new'],
          availableBranches: branches,
          onStatusChanged: (status) => setState(() => _statusFilter = status),
          onSortChanged: (sort) => setState(() => _sortOption = sort),
          onCollectionChanged: (col) => setState(() => _collectionFilter = col),
        ),
        if (availableBrands.isNotEmpty) ...[
          const SizedBox(height: 10),
          ProductBrandChips(
            brands: availableBrands,
            selectedBrand: _collectionFilter.brand,
            allLabel: context.tr('all_brands'),
            onChanged: (brand) => setState(() {
              _collectionFilter = _collectionFilter.copyWith(
                brand: brand,
                clearBrand: brand == null,
              );
            }),
          ),
        ],
        if (_hasActiveFilters) ...[
          const SizedBox(height: 8),
          GestureDetector(
            onTap: _clearFilters,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                const Icon(Icons.filter_alt_off_outlined, size: 15, color: _kBlue),
                const SizedBox(width: 4),
                Text(context.tr('clear_filters'),
                    style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: _kBlue)),
              ],
            ),
          ),
        ],
      ],
    );
  }


  Widget _buildEmptyState() {
    final msg = _products.isEmpty
        ? context.tr('no_products_in_warehouse')
        : context.tr('no_results_found');
    return Container(
      padding: const EdgeInsets.all(32),
      child: Column(
        children: [
          Icon(Icons.inventory_2_outlined, size: 48, color: _kSlate.withValues(alpha: 0.4)),
          const SizedBox(height: 12),
          Text(msg, textAlign: TextAlign.center,
              style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w500, color: _kSlate)),
          if (_hasActiveFilters) ...[
            const SizedBox(height: 8),
            GestureDetector(
              onTap: _clearFilters,
              child: Text(context.tr('clear_filters'),
                  style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kBlue)),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildProductCard(dynamic product) {
    final name = product['name'] ?? '';
    final sku = product['sku'] ?? '';
    final unit = product['unit'] ?? '';
    final stockQty = product['stockQuantity'] ?? 0;
    final isLow = product['minStockLevel'] != null && stockQty <= product['minStockLevel'] && product['minStockLevel'] > 0;
    final brand = (product['brand'] ?? (product['metadata'] is Map ? product['metadata']['brand'] : '') ?? '').toString();

    return GestureDetector(
      onTap: () async {
        await Navigator.push(context, MaterialPageRoute(
          builder: (_) => WarehouseProductDetailScreen(
            warehouseId: widget.warehouseId,
            productId: product['id'] ?? '',
            productName: name,
          ),
        ));
        _loadData();
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isLow ? _kAmber : _kBorder, width: isLow ? 1.2 : 1),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: isLow ? const Color(0xFFFEF3C7) : _kBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                isLow ? Icons.warning_amber_rounded : Icons.inventory_2_outlined,
                color: isLow ? _kAmber : _kBlue,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: _kInk, fontSize: 14)),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      if (brand.isNotEmpty) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: _kBlue.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            brand,
                            style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.bold, color: _kBlue),
                          ),
                        ),
                        const SizedBox(width: 6),
                      ],
                      Flexible(
                        child: Text('SKU: $sku', maxLines: 1, overflow: TextOverflow.ellipsis, style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                      ),
                      const SizedBox(width: 8),
                      Container(width: 3, height: 3, decoration: BoxDecoration(color: _kSlate, borderRadius: BorderRadius.circular(1.5))),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(unit, maxLines: 1, overflow: TextOverflow.ellipsis, style: GoogleFonts.outfit(fontSize: 11, color: _kSlate)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _kBorder),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.edit_outlined, color: _kBlue, size: 20),
                    tooltip: context.tr('edit'),
                    constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                    padding: EdgeInsets.zero,
                    onPressed: () => _editProduct(product),
                  ),
                  Container(width: 1, height: 20, color: _kBorder),
                  IconButton(
                    icon: const Icon(Icons.delete_outline, color: _kRed, size: 20),
                    tooltip: context.tr('delete_product_perm'),
                    constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                    padding: EdgeInsets.zero,
                    onPressed: () => _confirmRemoveProduct(product),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isLow ? const Color(0xFFFEF3C7) : const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text('Qty: $stockQty',
                      style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600,
                          color: isLow ? _kAmber : _kGreen)),
                ),
                const SizedBox(height: 4),
                const Icon(Icons.chevron_right, color: _kSlate, size: 18),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _editProduct(dynamic product) async {
    final model = ProductModel.fromJson(Map<String, dynamic>.from(product as Map));
    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => AddProductScreen(product: model)),
    );
    if (result == true && mounted) _loadData();
  }

  Future<void> _confirmRemoveProduct(dynamic product) async {
    final name = product['name'] ?? '';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(context.tr('delete_product_perm'),
            style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: _kInk)),
        content: Text('${context.tr('delete')} "$name"?', style: GoogleFonts.outfit(color: _kSlate)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(context.tr('cancel'), style: GoogleFonts.outfit(color: _kSlate)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(context.tr('delete'), style: GoogleFonts.outfit(color: _kRed, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await _api.delete('/warehouses/${widget.warehouseId}/products/${product['id']}');
      if (!mounted) return;
      showAppToast(context, '$name ${context.tr('delete')}', type: AppToastType.success);
      _loadData();
    } catch (e) {
      if (!mounted) return;
      showAppToast(context, context.tr('failed'), type: AppToastType.error);
    }
  }
}
