import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_response.dart';
import '../../core/bloc/auth/auth_bloc.dart';
import '../../core/localization/app_localizations.dart';
import 'package:provider/provider.dart';
import '../../core/providers/branch_provider.dart';
import '../../core/models/product_model.dart';
import '../../core/widgets/product_filter_header.dart';
import '../products/add_product_screen.dart';
import '../products/product_entry_screen.dart';
import 'shop_product_detail_screen.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/widgets/refreshable_scroll.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kGreen = Color(0xFF16A34A);
const _kRed = Color(0xFFDC2626);

class ShopDashboardScreen extends StatefulWidget {
  final String shopId;
  final String shopName;
  const ShopDashboardScreen({
    super.key,
    required this.shopId,
    required this.shopName,
  });

  @override
  State<ShopDashboardScreen> createState() => _ShopDashboardScreenState();
}

class _ShopDashboardScreenState extends State<ShopDashboardScreen> {
  final ApiClient _api = ApiClient();
  bool _loading = true;
  Map<String, dynamic>? _dashboard;
  List<Map<String, dynamic>> _products = [];
  String _search = '';
  ItemStatusFilter _statusFilter = ItemStatusFilter.all;
  ProductSortOption _sortOption = ProductSortOption.dateNewest;
  CollectionFilter _collectionFilter = const CollectionFilter();
  String? _error;
  int _loadDataToken = 0;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final token = ++_loadDataToken;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      Map<String, dynamic>? dashResult;
      List<Map<String, dynamic>> prods = [];

      try {
        dashResult = parseApiMap(await _api.get('/shops/${widget.shopId}/dashboard'));
      } catch (_) {}

      try {
        prods = parseApiList(await _api.get('/shops/${widget.shopId}/with-products'));
      } catch (_) {}

      if (mounted && token == _loadDataToken) {
        setState(() {
          _dashboard = dashResult;
          _products = prods;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted && token == _loadDataToken) {
        setState(() {
          _loading = false;
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  List<Map<String, dynamic>> get _filteredProducts {
    var result = List<Map<String, dynamic>>.from(_products);

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
      result = result.where((p) => (p['shopId'] ?? p['warehouseId'] ?? '').toString() == _collectionFilter.branchId).toList();
    }

    if (_search.isNotEmpty) {
      final q = _search.toLowerCase().trim();
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

    double getPrice(dynamic p) {
      final v = p['price'];
      if (v is num) return v.toDouble();
      return double.tryParse('$v') ?? 0;
    }

    switch (_sortOption) {
      case ProductSortOption.dateNewest:
        result.sort((a, b) => (b['createdAt'] ?? '').toString().compareTo((a['createdAt'] ?? '').toString()));
        break;
      case ProductSortOption.dateOldest:
        result.sort((a, b) => (a['createdAt'] ?? '').toString().compareTo((b['createdAt'] ?? '').toString()));
        break;
      case ProductSortOption.priceLowHigh:
        result.sort((a, b) => getPrice(a).compareTo(getPrice(b)));
        break;
      case ProductSortOption.priceHighLow:
        result.sort((a, b) => getPrice(b).compareTo(getPrice(a)));
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

  @override
  Widget build(BuildContext context) {
    final filteredProducts = _filteredProducts;
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
        title: Text(widget.shopName,
            style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: _kBlue),
            onPressed: _loadData,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _kBlue))
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                physics: refreshScrollPhysics,
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) ...[
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(
                        _error!,
                        style: GoogleFonts.outfit(color: _kRed, fontSize: 13),
                      ),
                    ),
                  ],
                  _buildStatsGrid(),
                  const SizedBox(height: 20),
                  _buildProductListHeader(filteredProducts.length),
                  const SizedBox(height: 12),
                  _buildSearchBar(),
                  const SizedBox(height: 12),
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
                  const SizedBox(height: 12),
                  if (filteredProducts.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 32),
                      child: Center(
                        child: Text(
                          context.tr('no_products_found'),
                          style: GoogleFonts.outfit(fontSize: 15, color: _kSlate),
                        ),
                      ),
                    )
                  else
                    ...filteredProducts.map((p) => _buildProductCard(p)),
                ],
              ),
            ),
      floatingActionButton: _canManage
          ? FloatingActionButton.extended(
              onPressed: () async {
                final result = await Navigator.push<bool>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => ProductEntryScreen(
                      shopId: widget.shopId,
                      shopName: widget.shopName,
                    ),
                  ),
                );
                if (result == true && mounted) _loadData();
              },
              backgroundColor: _kBlue,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add, size: 20),
              label: Text(
                context.tr('add_product'),
                style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 14),
              ),
            )
          : null,
    );
  }

  bool get _canManage {
    final authState = context.read<AuthBloc>().state;
    return authState is AuthAuthenticated && authState.user.isAdmin;
  }

  Widget _buildStatsGrid() {
    final totalProducts = _dashboard?['totalProducts'] ?? 0;
    final currentStock = _dashboard?['currentStock'] ?? 0;
    final lowStock = _dashboard?['lowStockProducts'] ?? 0;

    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 0.95,
      children: [
        _miniStat(Icons.inventory_2_outlined, '$totalProducts', context.tr('products'), _kBlue),
        _miniStat(Icons.shopping_cart_outlined, '$currentStock', context.tr('quantity'), _kGreen),
        _miniStat(Icons.warning_amber_rounded, '$lowStock', context.tr('low_stock'), _kRed),
      ],
    );
  }

  Widget _miniStat(IconData icon, String value, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
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
          Text(value,
              style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: _kInk)),
          Text(label,
              style: GoogleFonts.outfit(fontSize: 10, color: _kSlate),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }

  Widget _buildProductListHeader(int count) {
    return Text('${context.tr('products')} ($count)',
        style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk));
  }

  Widget _buildSearchBar() {
    return TextField(
      onChanged: (v) => setState(() => _search = v),
      decoration: InputDecoration(
        hintText: 'Search by name, brand, SKU, category...',
        hintStyle: GoogleFonts.outfit(color: _kSlate, fontSize: 13),
        prefixIcon: const Icon(Icons.search, color: _kSlate, size: 20),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _kBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _kBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _kBlue, width: 2),
        ),
      ),
    );
  }

  Widget _buildProductCard(dynamic product) {
    final name = product['name'] ?? '';
    final sku = product['sku'] ?? '';
    final category = product['category'] ?? '';
    final price = product['price'] ?? 0;
    final stockQty = product['stockQuantity'];
    final qty = stockQty is num ? stockQty.toInt() : (int.tryParse('$stockQty') ?? 0);
    final brand = (product['brand'] ?? (product['metadata'] is Map ? product['metadata']['brand'] : '') ?? '').toString();

    return GestureDetector(
      onTap: () {
        Navigator.push(context, MaterialPageRoute(
          builder: (_) => ShopProductDetailScreen(
            shopId: widget.shopId,
            productId: product['id'] ?? '',
            productName: name,
          ),
        ));
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _kBorder),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: _kBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.inventory_2_outlined, color: _kBlue, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name,
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: _kInk, fontSize: 15)),
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
                      Expanded(
                        child: Text('SKU: $sku  |  $category',
                            style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text('${context.tr('unit_price')}: ETB ${price is num ? price.toStringAsFixed(2) : price}',
                      style: GoogleFonts.outfit(fontSize: 12, color: _kSlate, fontWeight: FontWeight.w500)),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: qty > 0 ? _kGreen.withValues(alpha: 0.12) : _kRed.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '${context.tr('quantity')}: $qty',
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: qty > 0 ? _kGreen : _kRed,
                ),
              ),
            ),
            const SizedBox(width: 8),
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
            const Icon(Icons.chevron_right, color: _kSlate),
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
      await _api.delete('/shops/${widget.shopId}/products/${product['id']}');
      if (!mounted) return;
      showAppToast(context, '$name ${context.tr('delete')}', type: AppToastType.success);
      _loadData();
    } catch (e) {
      if (!mounted) return;
      showAppToast(context, context.tr('failed'), type: AppToastType.error);
    }
  }
}
