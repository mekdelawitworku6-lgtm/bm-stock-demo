import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/bloc/product/product_bloc.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/product_model.dart';
import 'product_detail_screen.dart';
import 'product_entry_screen.dart';
import 'add_product_screen.dart';
import 'excel_import_dialog.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/widgets/refreshable_scroll.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);

class ProductListScreen extends StatefulWidget {
  const ProductListScreen({super.key});

  @override
  State<ProductListScreen> createState() => _ProductListScreenState();
}

class _ProductListScreenState extends State<ProductListScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';
  String? _selectedCategory;
  String? _selectedBrand;
  String? _listFilter;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is Map && args['filter'] is String) {
      _listFilter = args['filter'] as String;
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ProductBloc>().add(ProductsLoadRequested());
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<ProductModel> _filtered(List<ProductModel> list) {
    var result = list;
    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      result = result.where((p) =>
        p.name.toLowerCase().contains(q) ||
        p.sku.toLowerCase().contains(q) ||
        p.category.toLowerCase().contains(q) ||
        p.brand.toLowerCase().contains(q)
      ).toList();
    }
    if (_listFilter == 'low_stock') {
      result = result.where((p) => p.minStockLevel > 0 && p.stockQuantity <= p.minStockLevel).toList();
    } else if (_listFilter == 'expired' || _listFilter == 'to_be_expired' || _listFilter == 'close_to_expiry') {
      result = result.where((p) => p.calculatedIsExpired || p.isCloseToExpiry).toList();
    }
    if (_selectedCategory != null && _selectedCategory!.isNotEmpty) {
      result = result.where((p) => p.category == _selectedCategory).toList();
    }
    if (_selectedBrand != null && _selectedBrand!.isNotEmpty) {
      result = result.where((p) => p.brand.toLowerCase() == _selectedBrand!.toLowerCase()).toList();
    }
    return result;
  }

  List<String> _categories(List<ProductModel> list) {
    final cats = list.map((p) => p.category).where((c) => c.isNotEmpty).toSet().toList();
    cats.sort();
    return cats;
  }

  List<String> _brands(List<ProductModel> list) {
    final brands = list.map((p) => p.brand).where((b) => b.isNotEmpty).toSet().toList();
    brands.sort();
    return brands;
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
        title: Text(context.tr('products'), style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
        actions: [
          IconButton(
            icon: const Icon(Icons.table_chart_outlined, color: _kBlue, size: 22),
            tooltip: context.tr('import_excel'),
            onPressed: () {
              ExcelImportDialog.show(context, enableAutoFill: false);
            },
          ),
          IconButton(
            icon: const Icon(Icons.add, color: _kBlue, size: 24),
            onPressed: () async {
              final result = await Navigator.push(context, MaterialPageRoute(builder: (_) => const ProductEntryScreen()));
              if (result == true && mounted) {
                context.read<ProductBloc>().add(ProductsLoadRequested());
              }
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Column(
              children: [
                TextField(
                  controller: _searchController,
                  style: GoogleFonts.outfit(fontSize: 14),
                  decoration: InputDecoration(
                    hintText: context.tr('search_products'),
                    hintStyle: GoogleFonts.outfit(color: _kSlate, fontSize: 14),
                    prefixIcon: const Icon(Icons.search, color: _kSlate, size: 20),
                    suffixIcon: _searchQuery.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, color: _kSlate, size: 18),
                          onPressed: () {
                            _searchController.clear();
                            setState(() => _searchQuery = '');
                          },
                        )
                      : null,
                    filled: true,
                    fillColor: _kBg,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                  ),
                  onChanged: (v) => setState(() => _searchQuery = v.trim()),
                ),
                const SizedBox(height: 8),
                BlocBuilder<ProductBloc, ProductState>(
                  builder: (context, state) {
                    final cats = _categories(state.products);
                    final brands = _brands(state.products);
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (cats.isNotEmpty)
                          SizedBox(
                            height: 32,
                            child: ListView(
                              scrollDirection: Axis.horizontal,
                              children: [
                                _CategoryChip(
                                  label: context.tr('all'),
                                  selected: _selectedCategory == null,
                                  onTap: () => setState(() => _selectedCategory = null),
                                ),
                                ...cats.map((c) => _CategoryChip(
                                  label: c,
                                  selected: _selectedCategory == c,
                                  onTap: () => setState(() => _selectedCategory = c),
                                )),
                              ],
                            ),
                          ),
                        if (brands.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          SizedBox(
                            height: 30,
                            child: ListView(
                              scrollDirection: Axis.horizontal,
                              children: [
                                _CategoryChip(
                                  label: context.tr('all_brands'),
                                  selected: _selectedBrand == null,
                                  onTap: () => setState(() => _selectedBrand = null),
                                ),
                                ...brands.map((b) => _CategoryChip(
                                  label: b,
                                  selected: _selectedBrand == b,
                                  onTap: () => setState(() => _selectedBrand = (_selectedBrand == b ? null : b)),
                                )),
                              ],
                            ),
                          ),
                        ],
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
          if (_listFilter != null)
            Container(
              margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: (_listFilter == 'expired' || _listFilter == 'to_be_expired' || _listFilter == 'close_to_expiry')
                    ? const Color(0xFFFEF2F2)
                    : const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: (_listFilter == 'expired' || _listFilter == 'to_be_expired' || _listFilter == 'close_to_expiry')
                      ? const Color(0xFFFCA5A5)
                      : const Color(0xFFFCD34D),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.filter_alt,
                    size: 16,
                    color: (_listFilter == 'expired' || _listFilter == 'to_be_expired' || _listFilter == 'close_to_expiry')
                        ? const Color(0xFFDC2626)
                        : const Color(0xFFD97706),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      (_listFilter == 'expired' || _listFilter == 'to_be_expired' || _listFilter == 'close_to_expiry')
                          ? context.tr('expiry_close_products')
                          : context.tr('low_stock'),
                      style: GoogleFonts.outfit(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: (_listFilter == 'expired' || _listFilter == 'to_be_expired' || _listFilter == 'close_to_expiry')
                            ? const Color(0xFFDC2626)
                            : const Color(0xFFD97706),
                      ),
                    ),
                  ),
                  InkWell(
                    onTap: () => setState(() => _listFilter = null),
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(context.tr('all'), style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: _kSlate)),
                          const SizedBox(width: 4),
                          const Icon(Icons.close, size: 14, color: _kSlate),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          Expanded(
            child: BlocBuilder<ProductBloc, ProductState>(
              builder: (context, state) {
                if (state.isLoading) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (state.error != null) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(state.error!, style: GoogleFonts.outfit(color: const Color(0xFFDC2626))),
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: () => context.read<ProductBloc>().add(ProductsLoadRequested()),
                          child: Text(context.tr('retry'), style: GoogleFonts.outfit(color: _kBlue, fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                  );
                }
                final filtered = _filtered(state.products);
                if (filtered.isEmpty) {
                  return RefreshIndicator(
                    onRefresh: () async { context.read<ProductBloc>().add(ProductsLoadRequested()); },
                    child: refreshableScrollChild(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.inventory_2_outlined, size: 56, color: _kSlate.withValues(alpha: 0.4)),
                          const SizedBox(height: 12),
                          Text(
                            _searchQuery.isEmpty && _selectedCategory == null ? context.tr('no_products_yet') : context.tr('no_results_found'),
                            style: GoogleFonts.outfit(fontSize: 16, color: _kSlate),
                          ),
                        ],
                      ),
                    ),
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async { context.read<ProductBloc>().add(ProductsLoadRequested()); },
                  child: ListView.separated(
                    physics: refreshScrollPhysics,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) => _ProductCard(
                      product: filtered[i],
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => ProductDetailScreen(product: filtered[i])),
                      ),
                      onEdit: () async {
                        final result = await Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => AddProductScreen(product: filtered[i])),
                        );
                        if (result == true && context.mounted) {
                          context.read<ProductBloc>().add(ProductsLoadRequested());
                        }
                      },
                      onRemove: () => _confirmRemoveProduct(context, filtered[i]),
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

  Future<void> _confirmRemoveProduct(BuildContext context, ProductModel product) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          context.tr('delete_product_perm'),
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: _kInk),
        ),
        content: Text(
          '${context.tr('delete')} "${product.name}"?',
          style: GoogleFonts.outfit(color: _kSlate),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(context.tr('cancel'), style: GoogleFonts.outfit(color: _kSlate)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(
              context.tr('delete_product_perm'),
              style: GoogleFonts.outfit(color: const Color(0xFFDC2626), fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    context.read<ProductBloc>().add(ProductDeleteRequested(id: product.id));
    final state = await context.read<ProductBloc>().stream
        .skip(1)
        .firstWhere((s) => !s.isLoading && s.lastActionSuccess != null);

    if (!context.mounted) return;
    if (state.lastActionSuccess == true) {
      showAppToast(context, context.tr('product_removed_success'), type: AppToastType.success);
    } else {
      showAppToast(context, state.error ?? context.tr('failed'), type: AppToastType.error);
    }
  }
}

class _CategoryChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _CategoryChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? _kBlue : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? _kBlue : _kBorder),
        ),
        child: Text(
          label,
          style: GoogleFonts.outfit(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: selected ? Colors.white : _kSlate,
          ),
        ),
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  final ProductModel product;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final VoidCallback onRemove;

  const _ProductCard({
    required this.product,
    required this.onTap,
    required this.onEdit,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final isLowStock = product.isLowStock && product.trackStock;
    final isExpired = product.calculatedIsExpired;
    final isClose = !isExpired && product.isCloseToExpiry;

    return GestureDetector(
      onTap: onTap,
      child: Container(
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
                color: _kBlue.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  product.name.isNotEmpty ? product.name[0].toUpperCase() : '?',
                  style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kBlue),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          product.name,
                          style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w600, color: _kInk),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (isLowStock)
                        _Badge(text: context.tr('low'), color: const Color(0xFFD97706)),
                      if (isExpired) ...[
                        const SizedBox(width: 4),
                        _Badge(text: context.tr('expired'), color: const Color(0xFFDC2626)),
                      ] else if (isClose) ...[
                        const SizedBox(width: 4),
                        _Badge(
                          text: product.daysUntilExpiry != null
                              ? '${product.daysUntilExpiry}d'
                              : context.tr('close_to_expiry'),
                          color: const Color(0xFFD97706),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      if (product.brand.isNotEmpty) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
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
                          '${product.category} · SKU: ${product.sku}',
                          style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          'ETB ${product.price.toStringAsFixed(2)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kBlue),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          '${context.tr('stock')}: ${product.stockQuantity}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.outfit(fontSize: 12, color: isLowStock ? const Color(0xFFD97706) : _kSlate),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
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
                        onPressed: onEdit,
                      ),
                      Container(width: 1, height: 20, color: _kBorder),
                      IconButton(
                        icon: const Icon(Icons.delete_outline, color: Color(0xFFDC2626), size: 20),
                        tooltip: context.tr('delete_product_perm'),
                        constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                        padding: EdgeInsets.zero,
                        onPressed: onRemove,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 4),
                Icon(Icons.chevron_right, color: _kSlate.withValues(alpha: 0.5), size: 20),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final String text;
  final Color color;
  const _Badge({required this.text, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(text, style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
    );
  }
}
