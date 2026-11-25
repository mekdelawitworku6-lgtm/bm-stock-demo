import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kAccentBlue = Color(0xFF4F46E5);

enum ItemStatusFilter { all, active, inactive }

enum ProductSortOption {
  dateNewest,
  dateOldest,
  priceLowHigh,
  priceHighLow,
  nameAZ,
  nameZA,
}

class CollectionFilter {
  final String? group;
  final String? brand;
  final String? mark;
  final String? branchId;

  const CollectionFilter({
    this.group,
    this.brand,
    this.mark,
    this.branchId,
  });

  bool get isEmpty => group == null && brand == null && mark == null && branchId == null;

  CollectionFilter copyWith({
    String? group,
    String? brand,
    String? mark,
    String? branchId,
    bool clearGroup = false,
    bool clearBrand = false,
    bool clearMark = false,
    bool clearBranch = false,
  }) {
    return CollectionFilter(
      group: clearGroup ? null : (group ?? this.group),
      brand: clearBrand ? null : (brand ?? this.brand),
      mark: clearMark ? null : (mark ?? this.mark),
      branchId: clearBranch ? null : (branchId ?? this.branchId),
    );
  }
}

class ProductFilterHeader extends StatelessWidget {
  final ItemStatusFilter statusFilter;
  final ProductSortOption sortOption;
  final CollectionFilter collectionFilter;
  final List<String> availableGroups;
  final List<String> availableBrands;
  final List<String> availableMarks;
  final List<Map<String, String>> availableBranches; // [{'id': '...', 'name': '...'}]
  final ValueChanged<ItemStatusFilter> onStatusChanged;
  final ValueChanged<ProductSortOption> onSortChanged;
  final ValueChanged<CollectionFilter> onCollectionChanged;

  const ProductFilterHeader({
    super.key,
    required this.statusFilter,
    required this.sortOption,
    required this.collectionFilter,
    this.availableGroups = const [],
    this.availableBrands = const [],
    this.availableMarks = const [],
    this.availableBranches = const [],
    required this.onStatusChanged,
    required this.onSortChanged,
    required this.onCollectionChanged,
  });


  String _sortLabel(ProductSortOption sort) {
    switch (sort) {
      case ProductSortOption.dateNewest:
        return 'Date Added (Newest to Oldest)';
      case ProductSortOption.dateOldest:
        return 'Date Added (Oldest to Newest)';
      case ProductSortOption.priceLowHigh:
        return 'Price (Low to High)';
      case ProductSortOption.priceHighLow:
        return 'Price (High to Low)';
      case ProductSortOption.nameAZ:
        return 'Name (A-Z)';
      case ProductSortOption.nameZA:
        return 'Name (Z-A)';
    }
  }

  void _openCollectionBottomSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _CollectionBottomSheet(
        initialFilter: collectionFilter,
        availableGroups: availableGroups,
        availableBrands: availableBrands,
        availableMarks: availableMarks,
        availableBranches: availableBranches,
        onApply: onCollectionChanged,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          // Filter Popup
          Expanded(
            child: PopupMenuButton<ItemStatusFilter>(
              initialValue: statusFilter,
              onSelected: onStatusChanged,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              itemBuilder: (context) => [
                PopupMenuItem(
                  value: ItemStatusFilter.all,
                  child: Row(
                    children: [
                      Text('All items', style: GoogleFonts.outfit(fontSize: 13, color: _kInk)),
                      if (statusFilter == ItemStatusFilter.all) ...[
                        const Spacer(),
                        const Icon(Icons.check, size: 16, color: _kBlue),
                      ]
                    ],
                  ),
                ),
                PopupMenuItem(
                  value: ItemStatusFilter.active,
                  child: Row(
                    children: [
                      Text('Active items', style: GoogleFonts.outfit(fontSize: 13, color: _kInk)),
                      if (statusFilter == ItemStatusFilter.active) ...[
                        const Spacer(),
                        const Icon(Icons.check, size: 16, color: _kBlue),
                      ]
                    ],
                  ),
                ),
                PopupMenuItem(
                  value: ItemStatusFilter.inactive,
                  child: Row(
                    children: [
                      Text('Inactive items', style: GoogleFonts.outfit(fontSize: 13, color: _kInk)),
                      if (statusFilter == ItemStatusFilter.inactive) ...[
                        const Spacer(),
                        const Icon(Icons.check, size: 16, color: _kBlue),
                      ]
                    ],
                  ),
                ),
              ],
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: statusFilter != ItemStatusFilter.all ? _kBlue.withValues(alpha: 0.08) : Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: statusFilter != ItemStatusFilter.all ? _kBlue : _kBorder),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('Filter', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w500, color: statusFilter != ItemStatusFilter.all ? _kBlue : _kSlate)),
                    const SizedBox(width: 4),
                    Icon(Icons.tune, size: 14, color: statusFilter != ItemStatusFilter.all ? _kBlue : _kSlate),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Sort By Popup
          Expanded(
            child: PopupMenuButton<ProductSortOption>(
              initialValue: sortOption,
              onSelected: onSortChanged,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              itemBuilder: (context) => ProductSortOption.values.map((s) {
                return PopupMenuItem(
                  value: s,
                  child: Row(
                    children: [
                      Expanded(child: Text(_sortLabel(s), style: GoogleFonts.outfit(fontSize: 13, color: _kInk))),
                      if (sortOption == s) ...[
                        const SizedBox(width: 8),
                        const Icon(Icons.check, size: 16, color: _kBlue),
                      ]
                    ],
                  ),
                );
              }).toList(),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: sortOption != ProductSortOption.dateNewest ? _kBlue.withValues(alpha: 0.08) : Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: sortOption != ProductSortOption.dateNewest ? _kBlue : _kBorder),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('Sort by', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w500, color: sortOption != ProductSortOption.dateNewest ? _kBlue : _kSlate)),
                    const SizedBox(width: 4),
                    Icon(Icons.swap_vert, size: 14, color: sortOption != ProductSortOption.dateNewest ? _kBlue : _kSlate),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Collection BottomSheet Trigger
          Expanded(
            child: GestureDetector(
              onTap: () => _openCollectionBottomSheet(context),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: !collectionFilter.isEmpty ? _kBlue.withValues(alpha: 0.08) : Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: !collectionFilter.isEmpty ? _kBlue : _kBorder),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('Collection', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w500, color: !collectionFilter.isEmpty ? _kBlue : _kSlate)),
                    const SizedBox(width: 4),
                    Icon(Icons.style_outlined, size: 14, color: !collectionFilter.isEmpty ? _kBlue : _kSlate),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Horizontal row of quick brand filter chips. Shows "All Brands" plus one
/// chip per brand with a tap-to-toggle selection.
class ProductBrandChips extends StatelessWidget {
  final List<String> brands;
  final String? selectedBrand;
  final String allLabel;
  final ValueChanged<String?> onChanged;

  const ProductBrandChips({
    super.key,
    required this.brands,
    required this.selectedBrand,
    required this.onChanged,
    this.allLabel = 'All Brands',
  });

  @override
  Widget build(BuildContext context) {
    if (brands.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 34,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _BrandFilterChip(
            label: allLabel,
            isSelected: selectedBrand == null || selectedBrand!.isEmpty,
            onTap: () => onChanged(null),
          ),
          ...brands.map((b) {
            final isSelected = selectedBrand != null && selectedBrand!.toLowerCase() == b.toLowerCase();
            return _BrandFilterChip(
              label: b,
              isSelected: isSelected,
              onTap: () => onChanged(isSelected ? null : b),
            );
          }),
        ],
      ),
    );
  }
}

class _BrandFilterChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _BrandFilterChip({
    required this.label,
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

class _CollectionBottomSheet extends StatefulWidget {
  final CollectionFilter initialFilter;
  final List<String> availableGroups;
  final List<String> availableBrands;
  final List<String> availableMarks;
  final List<Map<String, String>> availableBranches;
  final ValueChanged<CollectionFilter> onApply;

  const _CollectionBottomSheet({
    required this.initialFilter,
    required this.availableGroups,
    required this.availableBrands,
    required this.availableMarks,
    required this.availableBranches,
    required this.onApply,
  });

  @override
  State<_CollectionBottomSheet> createState() => _CollectionBottomSheetState();
}

class _CollectionBottomSheetState extends State<_CollectionBottomSheet> {
  late CollectionFilter _currentFilter;

  @override
  void initState() {
    super.initState();
    _currentFilter = widget.initialFilter;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header: Close icon + Title
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.close, color: _kInk, size: 22),
                onPressed: () => Navigator.pop(context),
              ),
              Expanded(
                child: Text(
                  'Collection',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk),
                ),
              ),
              const SizedBox(width: 44), // Balance spacing
            ],
          ),
          const SizedBox(height: 16),

          Flexible(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Group Section
                  Text('Group', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: _kInk)),
                  const SizedBox(height: 8),
                  if (widget.availableGroups.isEmpty)
                    Text('No groups', style: GoogleFonts.outfit(fontSize: 13, color: _kSlate))
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: widget.availableGroups.map((g) {
                        final isSelected = _currentFilter.group == g;
                        return GestureDetector(
                          onTap: () {
                            setState(() {
                              _currentFilter = _currentFilter.copyWith(
                                group: isSelected ? null : g,
                                clearGroup: isSelected,
                              );
                            });
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color: isSelected ? _kAccentBlue : const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              g,
                              style: GoogleFonts.outfit(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: isSelected ? Colors.white : _kInk,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  const SizedBox(height: 20),

                  // Brand Section
                  Text('Brand', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: _kInk)),
                  const SizedBox(height: 8),
                  if (widget.availableBrands.isEmpty)
                    Text('No brands', style: GoogleFonts.outfit(fontSize: 13, color: _kSlate))
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: widget.availableBrands.map((b) {
                        final isSelected = _currentFilter.brand == b;
                        return GestureDetector(
                          onTap: () {
                            setState(() {
                              _currentFilter = _currentFilter.copyWith(
                                brand: isSelected ? null : b,
                                clearBrand: isSelected,
                              );
                            });
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color: isSelected ? _kAccentBlue : const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              b,
                              style: GoogleFonts.outfit(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: isSelected ? Colors.white : _kInk,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  const SizedBox(height: 20),

                  // Mark Section
                  Text('Mark', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: _kInk)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: (widget.availableMarks.isNotEmpty ? widget.availableMarks : ['new']).map((m) {
                      final isSelected = _currentFilter.mark == m;
                      return GestureDetector(
                        onTap: () {
                          setState(() {
                            _currentFilter = _currentFilter.copyWith(
                              mark: isSelected ? null : m,
                              clearMark: isSelected,
                            );
                          });
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: isSelected ? _kAccentBlue : const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            m,
                            style: GoogleFonts.outfit(
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              color: isSelected ? Colors.white : _kInk,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),

                  // Branch Section
                  Text('Branch', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: _kInk)),
                  const SizedBox(height: 8),
                  if (widget.availableBranches.isEmpty)
                    Text('No branches', style: GoogleFonts.outfit(fontSize: 13, color: _kSlate))
                  else
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: widget.availableBranches.map((b) {
                        final id = b['id'] ?? '';
                        final name = b['name'] ?? 'Branch';
                        final isSelected = _currentFilter.branchId == id;
                        return GestureDetector(
                          onTap: () {
                            setState(() {
                              _currentFilter = _currentFilter.copyWith(
                                branchId: isSelected ? null : id,
                                clearBranch: isSelected,
                              );
                            });
                          },
                          child: Container(
                            width: (MediaQuery.of(context).size.width - 50) / 2,
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            decoration: BoxDecoration(
                              color: isSelected ? _kAccentBlue : const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              name,
                              textAlign: TextAlign.center,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.outfit(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: isSelected ? Colors.white : _kInk,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),

          // Bottom Action Row: Reset & Search
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    onPressed: () {
                      setState(() {
                        _currentFilter = const CollectionFilter();
                      });
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEEF2FF),
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                    ),
                    child: Text(
                      'Reset',
                      style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w600, color: _kAccentBlue),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    onPressed: () {
                      widget.onApply(_currentFilter);
                      Navigator.pop(context);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _kAccentBlue,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                    ),
                    child: Text(
                      'Search',
                      style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
