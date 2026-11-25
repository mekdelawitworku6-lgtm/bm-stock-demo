import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:provider/provider.dart';
import '../../core/bloc/product/product_bloc.dart';
import '../../core/bloc/auth/auth_bloc.dart';
import '../../core/bloc/company/company_bloc.dart';
import '../../core/models/user_model.dart';
import '../../core/providers/branch_provider.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/inventory_service.dart';
import '../../core/services/product_service.dart';
import '../../core/models/product_model.dart';
import '../../core/utils/branch_access_helper.dart';
import '../../core/utils/stock_scan_helper.dart';
import '../../core/widgets/app_toast.dart';

class _StockLocation {
  final String id;
  final String name;
  final bool isWarehouse;
  const _StockLocation({required this.id, required this.name, required this.isWarehouse});

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is _StockLocation && id == other.id && isWarehouse == other.isWarehouse;

  @override
  int get hashCode => Object.hash(id, isWarehouse);
}

class StockInScreen extends StatefulWidget {
  final String? warehouseId;
  final String? shopId;
  const StockInScreen({super.key, this.warehouseId, this.shopId});

  @override
  State<StockInScreen> createState() => _StockInScreenState();
}

class _StockInScreenState extends State<StockInScreen> {
  final _quantityController = TextEditingController(text: '1');
  final _inventoryService = InventoryService();
  final _productService = ProductService();
  ProductModel? _selectedProduct;
  bool _isSubmitting = false;
  bool _isScanMode = false;
  String _selectedReason = 'Restocking';

  _StockLocation? _selectedLocation;
  List<ProductModel> _locationProducts = [];
  bool _locationsLoaded = false;
  bool _isLoadingProducts = false;

  static const _reasons = ['Restocking', 'Return', 'Damaged Return', 'Correction', 'Other'];

  String _reasonLabel(String reason) {
    switch (reason) {
      case 'Restocking':
        return context.tr('reason_restocking');
      case 'Return':
        return context.tr('reason_return');
      case 'Damaged Return':
        return context.tr('reason_damaged_return');
      case 'Correction':
        return context.tr('reason_correction');
      default:
        return context.tr('reason_other');
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ProductBloc>().add(const ProductsLoadRequested());
      _ensureBranchesLoaded();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_locationsLoaded) {
      _locationsLoaded = true;
      _ensureBranchesLoaded();
    }
  }

  Future<void> _ensureBranchesLoaded() async {
    final branchProvider = Provider.of<BranchProvider>(context, listen: false);
    final user = context.read<AuthBloc>().user;
    final companyState = context.read<CompanyBloc>().state;
    final companyId = (companyState is CompanyLoaded ? companyState.selectedCompany?.id : null) ?? user?.companyId;

    try {
      await branchProvider
          .loadBranches(companyId: companyId, showLoading: false)
          .timeout(const Duration(seconds: 8));
    } catch (_) {}
  }

  Future<void> _updateProductsForLocation(_StockLocation? location) async {
    if (location == null) return;
    if (mounted) setState(() => _isLoadingProducts = true);
    try {
      final List<ProductModel> locProds;
      if (location.isWarehouse) {
        locProds = await _productService.getByWarehouse(location.id).timeout(const Duration(seconds: 8));
      } else {
        locProds = await _productService.getByShop(location.id).timeout(const Duration(seconds: 8));
      }

      final activeLocProds = locProds.where((p) => !p.isInactiveOrDeleted).toList();

      if (mounted) {
        setState(() {
          _locationProducts = activeLocProds;
          if (_selectedProduct != null) {
            final match = activeLocProds.where((p) => p.id == _selectedProduct!.id).firstOrNull;
            _selectedProduct = match ?? _selectedProduct;
          } else if (activeLocProds.isNotEmpty) {
            _selectedProduct = activeLocProds.first;
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _locationProducts = [];
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isLoadingProducts = false);
      }
    }
  }

  List<_StockLocation> _getLocations(UserModel? user, BranchProvider branchProvider) {
    final locations = <_StockLocation>[];
    final seen = <String>{};

    void addWarehouse(String id, String name) {
      if (_isValidUuid(id) && seen.add('w:$id')) {
        locations.add(_StockLocation(id: id, name: name, isWarehouse: true));
      }
    }

    void addShop(String id, String name) {
      if (_isValidUuid(id) && seen.add('s:$id')) {
        locations.add(_StockLocation(id: id, name: name, isWarehouse: false));
      }
    }

    if (_isValidUuid(widget.warehouseId)) {
      final w = branchProvider.warehouses.where((w) => w.id == widget.warehouseId).firstOrNull;
      addWarehouse(widget.warehouseId!, w?.name ?? 'Store');
    }
    if (_isValidUuid(widget.shopId)) {
      final s = branchProvider.shops.where((s) => s.id == widget.shopId).firstOrNull;
      addShop(widget.shopId!, s?.name ?? 'Shop');
    }
    if (_isValidUuid(user?.warehouseId)) {
      final w = branchProvider.warehouses.where((w) => w.id == user!.warehouseId).firstOrNull;
      addWarehouse(user!.warehouseId!, w?.name ?? 'Store');
    }
    if (_isValidUuid(user?.shopId)) {
      final s = branchProvider.shops.where((s) => s.id == user!.shopId).firstOrNull;
      addShop(user!.shopId!, s?.name ?? 'Shop');
    }

    for (final w in BranchAccessHelper.accessibleWarehouses(user, branchProvider.warehouses)) {
      addWarehouse(w.id, w.name);
    }
    for (final s in BranchAccessHelper.accessibleShops(user, branchProvider.shops)) {
      addShop(s.id, s.name);
    }

    return locations;
  }

  @override
  void dispose() {
    _quantityController.dispose();
    super.dispose();
  }

  void _incrementQty() {
    final current = int.tryParse(_quantityController.text) ?? 0;
    _quantityController.text = (current + 1).toString();
  }

  void _decrementQty() {
    final current = int.tryParse(_quantityController.text) ?? 0;
    if (current > 1) {
      _quantityController.text = (current - 1).toString();
    }
  }

  bool _isValidUuid(String? id) {
    if (id == null || id.isEmpty) return false;
    return RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$').hasMatch(id);
  }

  Future<void> _submit() async {
    if (_selectedProduct == null || _quantityController.text.isEmpty) return;

    setState(() => _isSubmitting = true);

    try {
      final qty = int.parse(_quantityController.text);
      if (qty <= 0) {
        showAppToast(context, context.tr('quantity_greater_than_zero'));
        setState(() => _isSubmitting = false);
        return;
      }

      final user = context.read<AuthBloc>().user;
      final branchProvider = Provider.of<BranchProvider>(context, listen: false);

      String? wId = _selectedLocation?.isWarehouse == true ? _selectedLocation?.id : (_isValidUuid(widget.warehouseId) ? widget.warehouseId : null);
      String? sId = _selectedLocation?.isWarehouse == false ? _selectedLocation?.id : (_isValidUuid(widget.shopId) ? widget.shopId : null);

      if (wId == null && sId == null) {
        if (_isValidUuid(user?.warehouseId)) {
          wId = user?.warehouseId;
        } else if (_isValidUuid(user?.shopId)) {
          sId = user?.shopId;
        } else if (branchProvider.warehouses.isNotEmpty) {
          wId = branchProvider.warehouses.first.id;
        } else if (branchProvider.shops.isNotEmpty) {
          sId = branchProvider.shops.first.id;
        }
      }

      await _inventoryService.adjustStock(
        productId: _selectedProduct!.id,
        type: 'stock_in',
        quantity: qty,
        warehouseId: wId,
        shopId: sId,
        reason: _selectedReason,
      );

      if (mounted) {
        context.read<ProductBloc>().add(const ProductsLoadRequested());
        showAppToast(context, context.tr('stock_in_success'), type: AppToastType.success);
        Navigator.pop(context, true);
      }
    } catch (e) {
      setState(() => _isSubmitting = false);
      showAppToast(context, '${context.tr('failed')}: $e', type: AppToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthBloc>().user;
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF0F172A), size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(context.tr('stock_in'), style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A))),
      ),
      body: Consumer<BranchProvider>(
        builder: (context, branchProvider, child) {
          final availableLocations = _getLocations(user, branchProvider);
          final currentLocation = availableLocations.any((l) => l == _selectedLocation)
              ? _selectedLocation
              : availableLocations.firstOrNull;

          if (currentLocation != null && currentLocation != _selectedLocation) {
            _selectedLocation = currentLocation;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) _updateProductsForLocation(currentLocation);
            });
          }

          return BlocBuilder<ProductBloc, ProductState>(
            builder: (context, state) {
              final activeLocationProducts = _locationProducts.where((p) => !p.isInactiveOrDeleted).toList();
              // Merge location products with all catalog products so the dropdown is never empty
              final allCatalogProducts = state.products.where((p) => !p.isInactiveOrDeleted).toList();

              final uniqueProducts = <String, ProductModel>{};
              // Location products take priority (they have accurate stock for this location)
              for (final p in activeLocationProducts) {
                if (p.id.isNotEmpty) uniqueProducts[p.id] = p;
              }
              // Add any catalog products not yet at this location
              for (final p in allCatalogProducts) {
                if (p.id.isNotEmpty && !uniqueProducts.containsKey(p.id)) {
                  uniqueProducts[p.id] = p;
                }
              }
              final productList = uniqueProducts.values.toList();

              final selectedProductId = productList.any((p) => p.id == _selectedProduct?.id)
                  ? _selectedProduct?.id
                  : productList.firstOrNull?.id;

              if (_selectedProduct == null || (selectedProductId != null && _selectedProduct?.id != selectedProductId)) {
                _selectedProduct = productList.where((p) => p.id == selectedProductId).firstOrNull;
              }

              return SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Segmented pill: Manual / Scan
                    _SegmentedPill(
                      options: [context.tr('manual'), context.tr('scan')],
                      selected: _isScanMode ? context.tr('scan') : context.tr('manual'),
                      onSelected: (val) => setState(() => _isScanMode = val == context.tr('scan')),
                    ),
                    const SizedBox(height: 20),

                    // Location Selector (Warehouse or Shop)
                    _SectionCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            context.tr('location'),
                            style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF0F172A)),
                          ),
                          const SizedBox(height: 10),
                          if (branchProvider.isLoading && availableLocations.isEmpty) ...[
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 12),
                              child: Row(
                                children: [
                                  SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                                  SizedBox(width: 12),
                                  Text('Loading locations...'),
                                ],
                              ),
                            ),
                          ] else if (availableLocations.isEmpty) ...[
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              child: Text(
                                context.tr('no_branches_found'),
                                style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF64748B)),
                              ),
                            ),
                          ] else ...[
                            DropdownButtonFormField<_StockLocation>(
                              initialValue: currentLocation,
                              decoration: _inputDecoration(context.tr('select_shop_warehouse')),
                              items: availableLocations.map((loc) => DropdownMenuItem<_StockLocation>(
                                value: loc,
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      loc.isWarehouse ? Icons.warehouse_outlined : Icons.storefront_outlined,
                                      size: 18,
                                      color: const Color(0xFF025EA7),
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      '${loc.name} (${loc.isWarehouse ? context.tr('store') : context.tr('shop')})',
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.outfit(fontSize: 13.5, fontWeight: FontWeight.w500),
                                    ),
                                  ],
                                ),
                              )).toList(),
                              onChanged: (loc) {
                                if (loc != null) {
                                  setState(() {
                                    _selectedLocation = loc;
                                    _selectedProduct = null;
                                    _locationProducts = [];
                                  });
                                  _updateProductsForLocation(loc);
                                }
                              },
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    _SectionCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(context.tr('products'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF0F172A))),
                          const SizedBox(height: 10),
                          Builder(builder: (context) {
                            if (_isScanMode) {
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  OutlinedButton.icon(
                                    onPressed: () async {
                                      final product = await pickProductByScan(context);
                                      if (product != null && mounted) {
                                        final match = productList.where((p) => p.id == product.id).firstOrNull;
                                        setState(() => _selectedProduct = match ?? product);
                                      }
                                    },
                                    icon: const Icon(Icons.qr_code_scanner),
                                    label: Text(context.tr('scan_barcode')),
                                  ),
                                  if (_selectedProduct != null) ...[
                                    const SizedBox(height: 10),
                                    Text(
                                      '${_selectedProduct!.name} (${context.tr('stock')}: ${_selectedProduct!.stockQuantity})',
                                      style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600),
                                    ),
                                  ],
                                ],
                              );
                            }

                            if (_isLoadingProducts) {
                              return const Padding(
                                padding: EdgeInsets.symmetric(vertical: 12),
                                child: Row(
                                  children: [
                                    SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                                    SizedBox(width: 12),
                                    Text('Loading products...'),
                                  ],
                                ),
                              );
                            }

                            if (productList.isEmpty) {
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                child: Text(
                                  context.tr('no_results_found'),
                                  style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF64748B)),
                                ),
                              );
                            }

                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                DropdownButtonFormField<String>(
                                  initialValue: selectedProductId,
                                  decoration: _inputDecoration(context.tr('select_category')),
                                  items: productList.map((p) => DropdownMenuItem<String>(
                                    value: p.id,
                                    child: Text('${p.name} (${context.tr('stock')}: ${p.stockQuantity})'),
                                  )).toList(),
                                  onChanged: (val) {
                                    if (val != null) {
                                      setState(() {
                                        _selectedProduct = productList.firstWhere((p) => p.id == val);
                                      });
                                    }
                                  },
                                ),
                                if (_selectedProduct != null) ...[
                                  const SizedBox(height: 10),
                                  Text(
                                    '${context.tr('stock')}: ${_selectedProduct!.stockQuantity}',
                                    style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF64748B)),
                                  ),
                                ],
                              ],
                            );
                          }),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Quantity stepper
                    _SectionCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(context.tr('quantity'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF0F172A))),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              _StepperButton(
                                icon: Icons.remove,
                                onTap: _decrementQty,
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: TextField(
                                  controller: _quantityController,
                                  textAlign: TextAlign.center,
                                  keyboardType: TextInputType.number,
                                  style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
                                  decoration: InputDecoration(
                                    filled: true,
                                    fillColor: const Color(0xFFF8FAFC),
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(10),
                                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                    ),
                                    enabledBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(10),
                                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                    ),
                                    focusedBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(10),
                                      borderSide: const BorderSide(color: Color(0xFF025EA7), width: 1.5),
                                    ),
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 16),
                              _StepperButton(
                                icon: Icons.add,
                                onTap: _incrementQty,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Reason chips
                    _SectionCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(context.tr('reason'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF0F172A))),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: _reasons.map((reason) {
                              final isSelected = _selectedReason == reason;
                              return GestureDetector(
                                onTap: () => setState(() => _selectedReason = reason),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: isSelected ? const Color(0xFF025EA7) : const Color(0xFFF8FAFC),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                      color: isSelected ? const Color(0xFF025EA7) : const Color(0xFFE2E8F0),
                                    ),
                                  ),
                                  child: Text(
                                    _reasonLabel(reason),
                                    style: GoogleFonts.outfit(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                      color: isSelected ? Colors.white : const Color(0xFF64748B),
                                    ),
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Submit button
                    ElevatedButton(
                      onPressed: _isSubmitting ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF025EA7),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                      ),
                      child: _isSubmitting
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : Text(context.tr('stock_in'), style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  InputDecoration _inputDecoration(String label) {
    return InputDecoration(
      labelText: label,
      labelStyle: GoogleFonts.outfit(color: const Color(0xFF64748B)),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFF025EA7), width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    );
  }
}

class _SegmentedPill extends StatelessWidget {
  final List<String> options;
  final String selected;
  final ValueChanged<String> onSelected;

  const _SegmentedPill({
    required this.options,
    required this.selected,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: options.map((option) {
          final isSelected = selected == option;
          return Expanded(
            child: GestureDetector(
              onTap: () => onSelected(option),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFF025EA7) : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  option,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: isSelected ? Colors.white : const Color(0xFF64748B),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final Widget child;
  const _SectionCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: child,
    );
  }
}

class _StepperButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _StepperButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Icon(icon, color: const Color(0xFF025EA7), size: 20),
      ),
    );
  }
}
