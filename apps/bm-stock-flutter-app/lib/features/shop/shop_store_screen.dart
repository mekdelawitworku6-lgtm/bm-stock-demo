import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:provider/provider.dart';
import '../../core/providers/branch_provider.dart';
import '../../core/widgets/product_filter_header.dart';
import '../../core/bloc/product/product_bloc.dart';
import '../../core/models/product_model.dart';
import '../products/product_detail_screen.dart';
import '../../core/localization/app_localizations.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kGreen = Color(0xFF16A34A);
const _kAmber = Color(0xFFD97706);
const _kRed = Color(0xFFDC2626);

class ShopStoreScreen extends StatefulWidget {
  const ShopStoreScreen({super.key});

  @override
  State<ShopStoreScreen> createState() => _ShopStoreScreenState();
}

class _ShopStoreScreenState extends State<ShopStoreScreen> {
  String _searchQuery = '';
  ItemStatusFilter _statusFilter = ItemStatusFilter.all;
  ProductSortOption _sortOption = ProductSortOption.dateNewest;
  CollectionFilter _collectionFilter = const CollectionFilter();
  String? _selectedBrand;
  String _stockStatusFilter = 'all'; // all, in_stock, low_stock, out_of_stock
  bool _groupByBrand = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ProductBloc>().add(ProductsLoadRequested());
    });
  }

  void _showFilterDetailsSheet(List<ProductModel> allProducts) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _ProductDetailsFilterSheet(
        products: allProducts,
        selectedBrand: _selectedBrand ?? _collectionFilter.brand,
        selectedCategory: _collectionFilter.group,
        stockStatus: _stockStatusFilter,
        onApply: (brand, category, stockStatus) {
          setState(() {
            _selectedBrand = brand;
            _stockStatusFilter = stockStatus;
            _collectionFilter = _collectionFilter.copyWith(
              brand: brand,
              clearBrand: brand == null,
              group: category,
              clearGroup: category == null,
            );
          });
        },
      ),
    );
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
        title: Text(
          context.tr('shop_store'),
          style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk),
        ),
        actions: [
          IconButton(
            tooltip: _groupByBrand ? 'Flat View' : context.tr('group_by_brand'),
            icon: Icon(
              _groupByBrand ? Icons.view_headline : Icons.branding_watermark_outlined,
              color: _groupByBrand ? _kBlue : _kSlate,
              size: 22,
            ),
            onPressed: () => setState(() => _groupByBrand = !_groupByBrand),
          ),
          IconButton(
            tooltip: context.tr('filter_by_details'),
            icon: const Icon(Icons.tune, color: _kBlue, size: 22),
            onPressed: () {
              final prods = context.read<ProductBloc>().state.products;
              _showFilterDetailsSheet(prods);
            },
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final result = await Navigator.pushNamed(context, '/add_product');
          if (result == true && mounted) {
            context.read<ProductBloc>().add(ProductsLoadRequested());
          }
        },
        backgroundColor: _kBlue,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add, size: 20),
        label: Text(context.tr('add_product'), style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 14)),
      ),
      body: BlocBuilder<ProductBloc, ProductState>(
        builder: (context, state) {
          final allProducts = state.products;

          // Compute available brands
          final availableBrands = allProducts
              .map((p) => p.brand)
              .where((b) => b.isNotEmpty)
              .toSet()
              .toList()
            ..sort();

          final availableGroups = allProducts
              .map((p) => p.category)
              .where((c) => c.isNotEmpty)
              .toSet()
              .toList()
            ..sort();

          // Filtering
          var products = List<ProductModel>.from(allProducts);

          // 1. Status Filter (active / inactive / all)
          switch (_statusFilter) {
            case ItemStatusFilter.active:
              products = products.where((p) => !p.isInactiveOrDeleted).toList();
              break;
            case ItemStatusFilter.inactive:
              products = products.where((p) => p.isInactiveOrDeleted).toList();
              break;
            case ItemStatusFilter.all:
              break;
          }

          // 2. Collection Group / Category Filter
          if (_collectionFilter.group != null && _collectionFilter.group!.isNotEmpty) {
            products = products.where((p) => p.category.toLowerCase() == _collectionFilter.group!.toLowerCase()).toList();
          }

          // 3. Brand Filter (Collection Filter or Quick Brand Selection)
          final activeBrand = _selectedBrand ?? _collectionFilter.brand;
          if (activeBrand != null && activeBrand.isNotEmpty) {
            products = products.where((p) => p.brand.toLowerCase() == activeBrand.toLowerCase()).toList();
          }

          // 4. Mark Filter
          if (_collectionFilter.mark != null && _collectionFilter.mark!.isNotEmpty) {
            final m = _collectionFilter.mark!.toLowerCase();
            if (m == 'new') {
              products = products.where((p) {
                if (p.metadata['mark']?.toString().toLowerCase() == 'new') return true;
                try {
                  final cd = DateTime.parse(p.createdAt);
                  return DateTime.now().difference(cd).inDays <= 14;
                } catch (_) {
                  return false;
                }
              }).toList();
            }
          }

          // 5. Branch Filter
          if (_collectionFilter.branchId != null && _collectionFilter.branchId!.isNotEmpty) {
            products = products.where((p) =>
              p.metadata['shopId'] == _collectionFilter.branchId ||
              p.metadata['warehouseId'] == _collectionFilter.branchId ||
              p.supplierId == _collectionFilter.branchId
            ).toList();
          }

          // 6. Stock Status Filter
          if (_stockStatusFilter == 'in_stock') {
            products = products.where((p) => p.stockQuantity > 0).toList();
          } else if (_stockStatusFilter == 'low_stock') {
            products = products.where((p) => p.isLowStock && p.stockQuantity > 0).toList();
          } else if (_stockStatusFilter == 'out_of_stock') {
            products = products.where((p) => p.stockQuantity <= 0 && p.type != 'service').toList();
          }

          // 7. Search Query
          if (_searchQuery.isNotEmpty) {
            final q = _searchQuery.toLowerCase();
            products = products.where((p) =>
              p.name.toLowerCase().contains(q) ||
              p.sku.toLowerCase().contains(q) ||
              p.category.toLowerCase().contains(q) ||
              p.brand.toLowerCase().contains(q) ||
              (p.description?.toLowerCase().contains(q) ?? false)
            ).toList();
          }

          // 8. Sorting
          switch (_sortOption) {
            case ProductSortOption.dateNewest:
              products.sort((a, b) => b.createdAt.compareTo(a.createdAt));
              break;
            case ProductSortOption.dateOldest:
              products.sort((a, b) => a.createdAt.compareTo(b.createdAt));
              break;
            case ProductSortOption.priceLowHigh:
              products.sort((a, b) => a.price.compareTo(b.price));
              break;
            case ProductSortOption.priceHighLow:
              products.sort((a, b) => b.price.compareTo(a.price));
              break;
            case ProductSortOption.nameAZ:
              products.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
              break;
            case ProductSortOption.nameZA:
              products.sort((a, b) => b.name.toLowerCase().compareTo(a.name.toLowerCase()));
              break;
          }

          return Column(
            children: [
              // Search bar
              Container(
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: TextField(
                  style: GoogleFonts.outfit(fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Search products by name, brand, SKU, category...',
                    hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 13),
                    prefixIcon: const Icon(Icons.search, color: Color(0xFF94A3B8), size: 20),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18, color: _kSlate),
                            onPressed: () => setState(() => _searchQuery = ''),
                          )
                        : null,
                    filled: true,
                    fillColor: _kBg,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                  ),
                  onChanged: (v) => setState(() => _searchQuery = v.toLowerCase()),
                ),
              ),

              // Product filter bar
              ProductFilterHeader(
                statusFilter: _statusFilter,
                sortOption: _sortOption,
                collectionFilter: _collectionFilter,
                availableGroups: availableGroups,
                availableBrands: availableBrands,
                availableMarks: const ['new'],
                availableBranches: [
                  ...Provider.of<BranchProvider>(context, listen: false).warehouses.map((w) => {'id': w.id, 'name': w.name}),
                  ...Provider.of<BranchProvider>(context, listen: false).shops.map((s) => {'id': s.id, 'name': s.name}),
                ],
                onStatusChanged: (status) => setState(() => _statusFilter = status),
                onSortChanged: (sort) => setState(() => _sortOption = sort),
                onCollectionChanged: (col) => setState(() {
                  _collectionFilter = col;
                  _selectedBrand = col.brand;
                }),
              ),

              // Brand Quick Filter Chips Row (Must list with each brand in the flutter app)
              if (availableBrands.isNotEmpty)
                Container(
                  color: Colors.white,
                  padding: const EdgeInsets.fromLTRB(16, 2, 16, 10),
                  child: SizedBox(
                    height: 32,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        _BrandChip(
                          label: context.tr('all_brands'),
                          count: allProducts.length,
                          isSelected: activeBrand == null || activeBrand.isEmpty,
                          onTap: () => setState(() {
                            _selectedBrand = null;
                            _collectionFilter = _collectionFilter.copyWith(clearBrand: true);
                          }),
                        ),
                        ...availableBrands.map((b) {
                          final count = allProducts.where((p) => p.brand.toLowerCase() == b.toLowerCase()).length;
                          final isSelected = activeBrand != null && activeBrand.toLowerCase() == b.toLowerCase();
                          return _BrandChip(
                            label: b,
                            count: count,
                            isSelected: isSelected,
                            onTap: () => setState(() {
                              _selectedBrand = isSelected ? null : b;
                              _collectionFilter = _collectionFilter.copyWith(
                                brand: isSelected ? null : b,
                                clearBrand: isSelected,
                              );
                            }),
                          );
                        }),
                      ],
                    ),
                  ),
                ),

              // Active filter indicators bar
              if (activeBrand != null || _collectionFilter.group != null || _stockStatusFilter != 'all')
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  color: const Color(0xFFF1F5F9),
                  child: Row(
                    children: [
                      const Icon(Icons.filter_list, size: 14, color: _kBlue),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'Filtered by: ${[
                            if (activeBrand != null) 'Brand: $activeBrand',
                            if (_collectionFilter.group != null) 'Category: ${_collectionFilter.group}',
                            if (_stockStatusFilter != 'all') 'Stock: ${_stockStatusFilter.replaceAll('_', ' ')}',
                          ].join(' \u00b7 ')} (${products.length} found)',
                          style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w500, color: _kInk),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      GestureDetector(
                        onTap: () => setState(() {
                          _selectedBrand = null;
                          _stockStatusFilter = 'all';
                          _collectionFilter = const CollectionFilter();
                        }),
                        child: Text(
                          'Clear',
                          style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: _kBlue),
                        ),
                      ),
                    ],
                  ),
                ),

              // Product list or Grouped by Brand
              Expanded(
                child: state.isLoading
                    ? const Center(child: CircularProgressIndicator())
                    : products.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.storefront_outlined, size: 56, color: _kSlate.withValues(alpha: 0.4)),
                                const SizedBox(height: 12),
                                Text(context.tr('no_products_found'), style: GoogleFonts.outfit(fontSize: 16, color: _kSlate)),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: () async {
                              context.read<ProductBloc>().add(ProductsLoadRequested());
                            },
                            child: _groupByBrand
                                ? _buildGroupedByBrandView(products)
                                : ListView.separated(
                                    physics: const AlwaysScrollableScrollPhysics(),
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                    itemCount: products.length,
                                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                                    itemBuilder: (_, i) => _ProductRow(
                                      product: products[i],
                                      onTap: () => Navigator.push(
                                        context,
                                        MaterialPageRoute(builder: (_) => ProductDetailScreen(product: products[i])),
                                      ),
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

  Widget _buildGroupedByBrandView(List<ProductModel> products) {
    // Group products by brand
    final grouped = <String, List<ProductModel>>{};
    for (final p in products) {
      final b = p.brand.isNotEmpty ? p.brand : 'Other / Generic';
      grouped.putIfAbsent(b, () => []).add(p);
    }

    final brandsList = grouped.keys.toList()..sort((a, b) {
      if (a.startsWith('Other')) return 1;
      if (b.startsWith('Other')) return -1;
      return a.compareTo(b);
    });

    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: brandsList.length,
      itemBuilder: (context, idx) {
        final brandName = brandsList[idx];
        final brandProducts = grouped[brandName]!;

        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Brand Section Header
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: _kBorder),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: _kBlue.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        brandName.isNotEmpty ? brandName[0].toUpperCase() : '?',
                        style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: _kBlue),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        brandName,
                        style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: _kInk),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: _kBg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: _kBorder),
                      ),
                      child: Text(
                        '${brandProducts.length} item${brandProducts.length != 1 ? 's' : ''}',
                        style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600, color: _kSlate),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 6),
              // Products under this brand
              ...brandProducts.map((p) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: _ProductRow(
                  product: p,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => ProductDetailScreen(product: p)),
                  ),
                ),
              )),
            ],
          ),
        );
      },
    );
  }
}

class _BrandChip extends StatelessWidget {
  final String label;
  final int count;
  final bool isSelected;
  final VoidCallback onTap;

  const _BrandChip({
    required this.label,
    required this.count,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? _kBlue : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isSelected ? _kBlue : _kBorder),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isSelected ? Colors.white : _kInk,
              ),
            ),
            const SizedBox(width: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: isSelected ? Colors.white.withValues(alpha: 0.25) : const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$count',
                style: GoogleFonts.outfit(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: isSelected ? Colors.white : _kSlate,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductRow extends StatelessWidget {
  final ProductModel product;
  final VoidCallback onTap;
  const _ProductRow({required this.product, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final isService = product.type == 'service';
    final stockBadge = _getStockBadge(context, product);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _kBorder),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 4,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: Row(
          children: [
            // Blue square icon / initial
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: isService ? const Color(0xFF8B5CF6) : _kBlue,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                isService ? Icons.build_outlined : Icons.inventory_2_outlined,
                color: Colors.white,
                size: 22,
              ),
            ),
            const SizedBox(width: 12),

            // Product info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: _kInk),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      // Brand Tag (Prominently listed with each brand)
                      if (product.brand.isNotEmpty) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: _kBlue.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            product.brand,
                            style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.bold, color: _kBlue),
                          ),
                        ),
                        const SizedBox(width: 6),
                      ],
                      Expanded(
                        child: Text(
                          '${product.sku.isNotEmpty ? product.sku : 'SKU: -'} · ${product.category}',
                          style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(width: 8),

            // Price + badge
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  'ETB ${product.price.toStringAsFixed(2)}',
                  style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: _kInk),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: stockBadge.color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    isService ? stockBadge.label : '${product.stockQuantity} ${stockBadge.label}',
                    style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.bold, color: stockBadge.color),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  _StockBadge _getStockBadge(BuildContext context, ProductModel product) {
    if (product.type == 'service') {
      return _StockBadge(context.tr('service'), const Color(0xFF8B5CF6));
    }
    if (product.stockQuantity == 0) {
      return _StockBadge(context.tr('out_of_stock'), _kRed);
    }
    if (product.isLowStock) {
      return _StockBadge(context.tr('low_stock'), _kAmber);
    }
    return _StockBadge(context.tr('in_stock'), _kGreen);
  }
}

class _StockBadge {
  final String label;
  final Color color;
  const _StockBadge(this.label, this.color);
}

/// Detailed filter sheet allowing users to filter products by specific details:
/// Brand, Category, Stock status (In Stock, Low Stock, Out of Stock).
class _ProductDetailsFilterSheet extends StatefulWidget {
  final List<ProductModel> products;
  final String? selectedBrand;
  final String? selectedCategory;
  final String stockStatus;
  final void Function(String? brand, String? category, String stockStatus) onApply;

  const _ProductDetailsFilterSheet({
    required this.products,
    this.selectedBrand,
    this.selectedCategory,
    required this.stockStatus,
    required this.onApply,
  });

  @override
  State<_ProductDetailsFilterSheet> createState() => _ProductDetailsFilterSheetState();
}

class _ProductDetailsFilterSheetState extends State<_ProductDetailsFilterSheet> {
  late String? _brand;
  late String? _category;
  late String _stock;

  @override
  void initState() {
    super.initState();
    _brand = widget.selectedBrand;
    _category = widget.selectedCategory;
    _stock = widget.stockStatus;
  }

  @override
  Widget build(BuildContext context) {
    final brands = widget.products.map((p) => p.brand).where((b) => b.isNotEmpty).toSet().toList()..sort();
    final categories = widget.products.map((p) => p.category).where((c) => c.isNotEmpty).toSet().toList()..sort();

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.close, color: _kInk),
                onPressed: () => Navigator.pop(context),
              ),
              Expanded(
                child: Text(
                  'Filter by Product Details',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(fontSize: 17, fontWeight: FontWeight.bold, color: _kInk),
                ),
              ),
              TextButton(
                onPressed: () {
                  setState(() {
                    _brand = null;
                    _category = null;
                    _stock = 'all';
                  });
                },
                child: Text('Reset', style: GoogleFonts.outfit(color: _kBlue, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const Divider(height: 1),
          const SizedBox(height: 14),

          // Brand Filter Section
          Text('Filter by Brand', style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: _kInk)),
          const SizedBox(height: 8),
          if (brands.isEmpty)
            Text('No brands found', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate))
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _filterChip('All Brands', _brand == null, () => setState(() => _brand = null)),
                ...brands.map((b) => _filterChip(b, _brand?.toLowerCase() == b.toLowerCase(), () {
                  setState(() => _brand = (_brand?.toLowerCase() == b.toLowerCase()) ? null : b);
                })),
              ],
            ),

          const SizedBox(height: 18),

          // Category Filter Section
          Text('Filter by Category', style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: _kInk)),
          const SizedBox(height: 8),
          if (categories.isEmpty)
            Text('No categories found', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate))
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _filterChip('All Categories', _category == null, () => setState(() => _category = null)),
                ...categories.map((c) => _filterChip(c, _category?.toLowerCase() == c.toLowerCase(), () {
                  setState(() => _category = (_category?.toLowerCase() == c.toLowerCase()) ? null : c);
                })),
              ],
            ),

          const SizedBox(height: 18),

          // Stock Status Section
          Text('Stock Status', style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: _kInk)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _filterChip('All', _stock == 'all', () => setState(() => _stock = 'all')),
              _filterChip('In Stock', _stock == 'in_stock', () => setState(() => _stock = 'in_stock')),
              _filterChip('Low Stock', _stock == 'low_stock', () => setState(() => _stock = 'low_stock')),
              _filterChip('Out of Stock', _stock == 'out_of_stock', () => setState(() => _stock = 'out_of_stock')),
            ],
          ),

          const SizedBox(height: 24),

          // Apply Button
          ElevatedButton(
            onPressed: () {
              widget.onApply(_brand, _category, _stock);
              Navigator.pop(context);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: _kBlue,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              elevation: 0,
            ),
            child: Text('Apply Filters', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String label, bool isSelected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? _kBlue : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: isSelected ? _kBlue : _kBorder),
        ),
        child: Text(
          label,
          style: GoogleFonts.outfit(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: isSelected ? Colors.white : _kInk,
          ),
        ),
      ),
    );
  }
}
