import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../core/api/api_client.dart';
import '../../core/bloc/auth/auth_bloc.dart';
import '../../core/bloc/product/product_bloc.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/models/product_model.dart';
import '../../core/models/supplier_model.dart';
import '../../core/models/warehouse_model.dart';
import '../../core/permissions/app_permissions.dart';
import '../../core/services/product_service.dart';
import '../../core/services/supplier_service.dart';
import '../../core/services/warehouse_service.dart';
import '../../core/utils/branch_access_helper.dart';
import '../../core/utils/money_input.dart';
import '../../core/utils/product_status_helper.dart';
import '../../core/widgets/app_toast.dart';
import 'excel_import_dialog.dart';

class AddProductScreen extends StatefulWidget {
  final ProductModel? product;
  final String? warehouseId;

  /// When set, the newly created product is also attached to this shop.
  final String? shopId;
  final String? shopName;

  const AddProductScreen({super.key, this.product, this.warehouseId, this.shopId, this.shopName});

  @override
  State<AddProductScreen> createState() => _AddProductScreenState();
}

class _AddProductScreenState extends State<AddProductScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _skuController;
  late final TextEditingController _priceController;
  late final TextEditingController _costController;
  late final TextEditingController _stockController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _barcodeController;
  late final TextEditingController _minStockController;
  late final TextEditingController _wholesaleController;
  late final TextEditingController _discountController;
  late final TextEditingController _brandController;
  late final TextEditingController _commissionRateController;
  final FocusNode _nameFocusNode = FocusNode();
  bool _isSubmitting = false;
  bool _trackStock = true;
  String _productType = 'product';
  String _unit = 'piece';
  final List<String> _customUnits = [];
  String _status = 'active';
  String _commissionType = 'percent';
  String _discountType = 'percent';
  DateTime? _expiryDate;
  DateTime? _reminderDate;
  List<SupplierModel> _suppliers = [];
  List<WarehouseModel> _warehouses = [];
  List<String> _categories = [];
  List<String> _brands = [];
  String? _category;
  String? _supplierId;
  String? _warehouseId;
  int _itemsAddedCount = 0;

  bool get _isEditing => widget.product != null;

  static const _units = [
    'piece', 'kg', 'g', 'mg', 'lb', 'oz',
    'liter', 'ml', 'gal',
    'box', 'pack', 'pair', 'set', 'roll', 'bag', 'bottle', 'can',
  ];

  @override
  void initState() {
    super.initState();
    final p = widget.product;
    _nameController = TextEditingController(text: p?.name ?? '');
    _category = (p?.category.isNotEmpty ?? false) ? p!.category : null;
    _skuController = TextEditingController(text: p?.sku ?? '');
    _priceController = TextEditingController(text: p != null ? p.price.toString() : '');
    _costController = TextEditingController(text: p != null ? p.cost.toString() : '');
    _stockController = TextEditingController(text: p != null ? p.stockQuantity.toString() : '');
    _descriptionController = TextEditingController(text: p?.description ?? '');
    _barcodeController = TextEditingController(text: p?.barcode ?? '');
    _minStockController = TextEditingController(text: p != null ? p.minStockLevel.toString() : '0');
    _commissionRateController = TextEditingController(text: p != null ? p.commissionRate.toString() : '0');
    _commissionType = p?.commissionType ?? (p?.metadata['commissionType'] as String? ?? 'percent');
    _wholesaleController = TextEditingController(text: p != null ? (p.metadata['wholesale'] ?? '').toString() : '');
    _discountController = TextEditingController(text: p != null ? (p.metadata['discount'] ?? '').toString() : '');
    _discountType = (p?.metadata['discountType'] as String?) ?? 'none';
    _brandController = TextEditingController(text: p != null ? (p.metadata['brand'] ?? '').toString() : '');
    _trackStock = p?.trackStock ?? true;
    _productType = p?.type ?? 'product';
    _unit = p?.unit ?? 'piece';
    if (_unit.isNotEmpty && !_units.contains(_unit)) {
      _customUnits.add(_unit);
    }
    _status = ProductStatusHelper.toUi(p?.status);
    _supplierId = p?.supplierId;
    _warehouseId = widget.shopId != null ? null : widget.warehouseId;
    if (p?.expiryDate != null && p!.expiryDate!.isNotEmpty) {
      try { _expiryDate = DateTime.parse(p.expiryDate!); } catch (_) {}
    }
    if (p?.reminderDate != null && p!.reminderDate!.isNotEmpty) {
      try { _reminderDate = DateTime.parse(p.reminderDate!); } catch (_) {}
    }
    _loadOptions();
  }

  Future<void> _loadOptions() async {
    try {
      final suppliers = await SupplierService().getAll();
      final warehouses = await WarehouseService().getAll();
      if (!mounted) return;
      final authUser = context.read<AuthBloc>().user;
      final accessibleWhs = BranchAccessHelper.accessibleWarehouses(authUser, warehouses);
      setState(() {
        _suppliers = suppliers;
        _warehouses = accessibleWhs;
      });
    } catch (_) {}

    try {
      final categories = await ProductService().getCategories();
      final products = await ProductService().getAll();
      final brandsSet = <String>{};
      for (final p in products) {
        final b = (p.metadata['brand'] ?? '').toString().trim();
        if (b.isNotEmpty) brandsSet.add(b);
      }
      if (!mounted) return;
      setState(() {
        _categories = categories;
        // Keep the current selection visible even if it's brand new.
        if (_category != null && _category!.isNotEmpty && !categories.contains(_category)) {
          _categories = [...categories, _category!];
        }
        _brands = brandsSet.toList()..sort();
        final currentBrand = _brandController.text.trim();
        if (currentBrand.isNotEmpty && !_brands.contains(currentBrand)) {
          _brands.insert(0, currentBrand);
        }
      });
    } catch (_) {}
  }

  Future<void> _createSupplierInline() async {
    final nameController = TextEditingController();
    final contactController = TextEditingController();
    final created = await showDialog<SupplierModel>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(context.tr('supplier'), style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A))),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: InputDecoration(labelText: context.tr('name')),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: contactController,
              decoration: InputDecoration(labelText: context.tr('phone')),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(dialogContext.tr('cancel')),
          ),
          TextButton(
            onPressed: () async {
              if (nameController.text.trim().isEmpty) return;
              try {
                final supplier = await SupplierService().create({
                  'name': nameController.text.trim(),
                  'contact': contactController.text.trim().isEmpty ? '0000000000' : contactController.text.trim(),
                });
                if (!dialogContext.mounted) return;
                Navigator.pop(dialogContext, supplier);
              } catch (_) {
                if (!dialogContext.mounted) return;
                showAppToast(dialogContext, dialogContext.tr('failed_create_supplier'), type: AppToastType.error);
              }
            },
            child: Text(dialogContext.tr('save')),
          ),
        ],
      ),
    );
    if (created != null) {
      setState(() {
        _suppliers = [..._suppliers, created];
        _supplierId = created.id;
      });
    }
  }

  @override
  void dispose() {
    _nameFocusNode.dispose();
    _nameController.dispose();
    _skuController.dispose();
    _priceController.dispose();
    _costController.dispose();
    _stockController.dispose();
    _descriptionController.dispose();
    _barcodeController.dispose();
    _minStockController.dispose();
    _wholesaleController.dispose();
    _discountController.dispose();
    _brandController.dispose();
    _commissionRateController.dispose();
    super.dispose();
  }

  Future<void> _submit({bool continueAdding = false}) async {
    if (!_formKey.currentState!.validate()) return;

    final authUser = context.read<AuthBloc>().user;
    if (authUser != null && !authUser.isAdmin) {
      if (!authUser.canViewModule(ModuleKeys.addProduct) && !authUser.canViewModule(ModuleKeys.products)) {
        showAppToast(context, context.tr('permission_denied'), type: AppToastType.error);
        return;
      }
    }

    final productName = _nameController.text.trim();
    final commRate = _commissionRateController.text.isNotEmpty ? (parseAmount(_commissionRateController.text) ?? 0.0) : 0.0;
    final priceVal = parseAmount(_priceController.text) ?? 0.0;
    if (_commissionType == 'percent' && commRate > 100) {
      showAppToast(context, context.tr('commission_percent_max'), type: AppToastType.error);
      return;
    }
    if (_commissionType == 'fixed' && priceVal > 0 && commRate > priceVal) {
      showAppToast(
        context,
        context.tr('commission_fixed_max_product')
            .replaceAll('{name}', productName.isNotEmpty ? productName : 'Product')
            .replaceAll('{price}', priceVal.toStringAsFixed(2)),
        type: AppToastType.error,
      );
      return;
    }

    setState(() => _isSubmitting = true);
    final data = <String, dynamic>{
      'name': productName,
      'unit': _unit,
      'category': _category?.trim() ?? '',
      'price': parseAmount(_priceController.text) ?? 0,
      'trackStock': _trackStock,
      'type': _productType,
    };

    if (_skuController.text.trim().isNotEmpty) data['sku'] = _skuController.text.trim();
    data['cost'] = _costController.text.isNotEmpty ? (parseAmount(_costController.text) ?? 0) : 0;
    if (_stockController.text.isNotEmpty) data['stockQuantity'] = int.parse(_stockController.text);
    if (_minStockController.text.isNotEmpty) data['minStockLevel'] = int.parse(_minStockController.text);
    if (_commissionRateController.text.isNotEmpty) data['commissionRate'] = parseAmount(_commissionRateController.text) ?? 0;
    data['commissionType'] = _commissionType;
    data['status'] = ProductStatusHelper.toApi(_status);
    if (_descriptionController.text.trim().isNotEmpty) data['description'] = _descriptionController.text.trim();
    if (_barcodeController.text.trim().isNotEmpty) data['barcode'] = _barcodeController.text.trim();
    if (_expiryDate != null) data['expiryDate'] = _expiryDate!.toIso8601String().substring(0, 10);
    if (_supplierId != null) data['supplierId'] = _supplierId;

    final metadata = <String, dynamic>{};
    if (_brandController.text.trim().isNotEmpty) metadata['brand'] = _brandController.text.trim();
    if (_wholesaleController.text.isNotEmpty) metadata['wholesale'] = parseAmount(_wholesaleController.text) ?? 0;
    if (_discountType != 'none' && _discountController.text.isNotEmpty) {
      metadata['discount'] = parseAmount(_discountController.text) ?? 0;
      metadata['discountType'] = _discountType;
    }
    if (metadata.isNotEmpty) data['metadata'] = metadata;
    if (_reminderDate != null) data['reminderDate'] = _reminderDate!.toIso8601String().substring(0, 10);

    // When adding from a specific shop, only assign to that shop
    // When adding from a specific warehouse, only assign to that warehouse
    if (widget.shopId != null) {
      data['shopIds'] = [widget.shopId!];
    } else {
      final warehouseId = _warehouseId ?? widget.warehouseId;
      if (warehouseId != null) {
        data['warehouseIds'] = [warehouseId];
      }
    }

    if (_productType == 'service') {
      data['trackStock'] = false;
      data['stockQuantity'] = 0;
      data['minStockLevel'] = 0;
    }

    if (_isEditing) {
      context.read<ProductBloc>().add(ProductUpdateRequested(id: widget.product!.id, data: data));
    } else {
      context.read<ProductBloc>().add(ProductAddRequested(data: data));
    }

    final state = await context.read<ProductBloc>().stream
        .skip(1)
        .firstWhere((s) => !s.isLoading && (s.lastActionSuccess != null || s.error != null));
    final success = state.lastActionSuccess == true;

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (success) {
      final created = state.lastCreatedProduct;
      final targetWhId = widget.shopId != null ? null : (_warehouseId ?? widget.warehouseId);
      if (continueAdding) {
        if (!_isEditing && widget.shopId != null && created != null) {
          final attached = await _attachToShop(created);
          if (!mounted) return;
          if (!attached) {
            showAppToast(
              context,
              context.tr('product_added_shop_failed')
                  .replaceFirst('{shop}', widget.shopName ?? ''),
              type: AppToastType.error,
            );
          }
        } else if (!_isEditing && targetWhId != null && created != null) {
          await _attachToWarehouse(created, targetWhId);
          if (!mounted) return;
        }

        setState(() {
          _itemsAddedCount++;
          _nameController.clear();
          _skuController.clear();
          _priceController.clear();
          _costController.clear();
          _stockController.clear();
          _descriptionController.clear();
          _barcodeController.clear();
          _minStockController.text = '0';
          _expiryDate = null;
          _reminderDate = null;
        });

        showAppToast(
          context,
          context.tr('product_saved_continue')
              .replaceFirst('{name}', productName)
              .replaceFirst('{count}', '$_itemsAddedCount'),
          type: AppToastType.success,
        );

        _nameFocusNode.requestFocus();
      } else {
        if (!_isEditing && widget.shopId != null && created != null) {
          final attached = await _attachToShop(created);
          if (!mounted) return;
          if (attached) {
            showAppToast(
              context,
              context.tr('product_added_to_shop')
                  .replaceFirst('{shop}', widget.shopName ?? ''),
              type: AppToastType.success,
            );
          } else {
            showAppToast(
              context,
              context.tr('product_added_shop_failed')
                  .replaceFirst('{shop}', widget.shopName ?? ''),
              type: AppToastType.error,
            );
          }
        } else if (!_isEditing && targetWhId != null && created != null) {
          await _attachToWarehouse(created, targetWhId);
          if (!mounted) return;
          showAppToast(context, context.tr('add_product'), type: AppToastType.success);
        } else {
          showAppToast(context, _isEditing ? context.tr('save') : context.tr('add_product'), type: AppToastType.success);
        }
        Navigator.pop(context, true);
      }
    } else {
      showAppToast(context, state.error ?? context.tr('failed_save_product'), type: AppToastType.error);
    }
  }

  Future<bool> _attachToShop(ProductModel created) async {
    final stockQty = int.tryParse(_stockController.text) ?? 0;
    final minStock = int.tryParse(_minStockController.text) ?? 0;
    try {
      await ApiClient().post('/shops/${widget.shopId}/products', body: {
        'productId': created.id,
        'stockQuantity': stockQty,
        'minStockLevel': minStock,
      });
      return true;
    } catch (e) {
      debugPrint('[AddProductScreen] Error attaching product to shop: $e');
      return false;
    }
  }

  Future<bool> _attachToWarehouse(ProductModel created, String targetWarehouseId) async {
    final stockQty = int.tryParse(_stockController.text) ?? 0;
    final minStock = int.tryParse(_minStockController.text) ?? 0;
    try {
      await ApiClient().post('/warehouses/$targetWarehouseId/products', body: {
        'productId': created.id,
        'stockQuantity': stockQty,
        'minStockLevel': minStock,
      });
      return true;
    } catch (e) {
      debugPrint('[AddProductScreen] Error attaching product to warehouse: $e');
      return false;
    }
  }

  Future<void> _pickExpiryDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _expiryDate ?? DateTime.now().add(const Duration(days: 365)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365 * 10)),
    );
    if (picked != null) setState(() => _expiryDate = picked);
  }

  Future<void> _pickReminderDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _reminderDate ?? DateTime.now().add(const Duration(days: 7)),
      firstDate: DateTime.now(),
      lastDate: _expiryDate ?? DateTime.now().add(const Duration(days: 365 * 10)),
    );
    if (picked != null) setState(() => _reminderDate = picked);
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = context.watch<AuthBloc>().user;
    final canImport = currentUser?.canImportProducts ?? false;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF0F172A), size: 20),
          onPressed: () => Navigator.pop(context, _itemsAddedCount > 0),
        ),
        title: Text(_isEditing ? '${context.tr('edit')} ${context.tr('products')}' : (widget.shopId != null ? context.tr('add_product_to_shop') : context.tr('add_product')), style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A))),
        actions: [
          if (!_isEditing && canImport)
            IconButton(
              icon: const Icon(Icons.table_chart_outlined, color: Color(0xFF025EA7), size: 22),
              tooltip: context.tr('import_excel'),
              onPressed: _openExcelImport,
            ),
        ],
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Product Type
              _card(
                children: [
                  Text(context.tr('category'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(child: _typeChip('product', context.tr('products'), Icons.inventory_2_outlined)),
                      const SizedBox(width: 10),
                      Expanded(child: _typeChip('service', context.tr('is_service'), Icons.build_outlined, onSelect: (_) => _showComingSoon())),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Basic Info
              _card(
                sectionIcon: Icons.info_outline,
                sectionTitle: context.tr('basic_information'),
                children: [
                  _field(context.tr('product_name'), _nameController, focusNode: _nameFocusNode, validator: (v) => v!.isEmpty ? context.tr('required') : null),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(child: _categoryField()),
                      const SizedBox(width: 12),
                      Expanded(child: _brandField()),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(child: _field(context.tr('sku'), _skuController)),
                      const SizedBox(width: 12),
                      Expanded(child: _unitField()),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(child: _field(context.tr('barcode'), _barcodeController)),
                      const SizedBox(width: 8),
                      Padding(
                        padding: const EdgeInsets.only(top: 22),
                        child: GestureDetector(
                          onTap: () async {
                            final result = await Navigator.push<String>(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const _BarcodeScanScreen(),
                              ),
                            );
                            if (result != null && result.isNotEmpty) {
                              setState(() => _barcodeController.text = result);
                            }
                          },
                          child: Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: const Color(0xFF025EA7),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.qr_code_scanner_outlined, color: Colors.white, size: 22),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _field('${context.tr('description')} (${context.tr('optional')})', _descriptionController, maxLines: 3),
                ],
              ),
              const SizedBox(height: 12),

              // Pricing
              _card(
                sectionIcon: Icons.payments_outlined,
                sectionTitle: context.tr('pricing'),
                children: [
                  Row(
                    children: [
                      Expanded(child: _field('${context.tr('purchase_price')} (${context.tr('optional')})', _costController, keyboardType: TextInputType.number, inputFormatters: [ThousandsInputFormatter()])),
                      const SizedBox(width: 12),
                      Expanded(child: _field(context.tr('selling_price'), _priceController, keyboardType: TextInputType.number, inputFormatters: [ThousandsInputFormatter()], validator: (v) {
                        if (v!.isEmpty) return context.tr('required');
                        if (parseAmount(v) == null) return context.tr('invalid_number');
                        return null;
                      })),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(child: _field(context.tr('wholesale_price'), _wholesaleController, keyboardType: TextInputType.number, inputFormatters: [ThousandsInputFormatter()])),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(context.tr('discount'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
                            const SizedBox(height: 6),
                            DropdownButtonFormField<String>(
                              value: _discountType,
                              style: GoogleFonts.outfit(fontSize: 14, color: const Color(0xFF0F172A)),
                              decoration: _inputDecoration(context.tr('discount')),
                              items: [
                                DropdownMenuItem(value: 'none', child: Text(context.tr('no_discount'))),
                                const DropdownMenuItem(value: 'percent', child: Text('%')),
                                const DropdownMenuItem(value: 'fixed', child: Text('ETB')),
                              ],
                              onChanged: (val) {
                                if (val != null) {
                                  setState(() {
                                    _discountType = val;
                                    if (val == 'none') _discountController.clear();
                                  });
                                }
                              },
                            ),
                            if (_discountType != 'none') ...[
                              const SizedBox(height: 10),
                              _field(
                                context.tr('amount'),
                                _discountController,
                                keyboardType: TextInputType.number,
                                suffixText: _discountType == 'percent' ? '%' : 'ETB',
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _commissionField(),
                ],
              ),
              const SizedBox(height: 12),

              // Unit + Expiry
              _card(
                sectionIcon: Icons.inventory_2_outlined,
                sectionTitle: context.tr('inventory'),
                children: [
                  Row(
                    children: [
                      Expanded(child: _field(context.tr('stock_quantity'), _stockController, keyboardType: TextInputType.number)),
                      const SizedBox(width: 12),
                      Expanded(child: _field(context.tr('min_stock_level'), _minStockController, keyboardType: TextInputType.number)),
                    ],
                  ),
                  if (widget.shopId != null) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFBFDBFE)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.storefront_rounded, size: 20, color: Color(0xFF025EA7)),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Adding To Shop',
                                  style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF025EA7)),
                                ),
                                Text(
                                  widget.shopName ?? 'This Shop Only',
                                  style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ] else if (widget.warehouseId != null) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFBBF7D0)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.warehouse_rounded, size: 20, color: Color(0xFF16A34A)),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Adding To Warehouse Store',
                                  style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF16A34A)),
                                ),
                                Text(
                                  _warehouses.where((w) => w.id == widget.warehouseId).firstOrNull?.name ?? 'This Warehouse Store Only',
                                  style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ] else ...[
                    _warehouseField(),
                  ],
                  const SizedBox(height: 16),
                  _supplierEl(),
                  if (_productType == 'product') ...[
                    const SizedBox(height: 16),
                    Text(context.tr('expiry_date'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
                    const SizedBox(height: 6),
                    GestureDetector(
                      onTap: _pickExpiryDate,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.calendar_today_outlined, color: Color(0xFF64748B), size: 18),
                            const SizedBox(width: 10),
                            Text(
                              _expiryDate != null
                                  ? '${_expiryDate!.day}/${_expiryDate!.month}/${_expiryDate!.year}'
                                  : context.tr('expiry_date'),
                              style: GoogleFonts.outfit(
                                fontSize: 14,
                                color: _expiryDate != null ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                              ),
                            ),
                            const Spacer(),
                            if (_expiryDate != null)
                              GestureDetector(
                                onTap: () => setState(() => _expiryDate = null),
                                child: const Icon(Icons.clear, color: Color(0xFF64748B), size: 18),
                              ),
                          ],
                        ),
                      ),
                    ),
                    if (_expiryDate != null) ...[
                      const SizedBox(height: 16),
                      Text(context.tr('reminder_date'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
                      const SizedBox(height: 6),
                      GestureDetector(
                        onTap: _pickReminderDate,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.notifications_active_outlined, color: Color(0xFF64748B), size: 18),
                              const SizedBox(width: 10),
                              Text(
                                _reminderDate != null
                                    ? '${_reminderDate!.day}/${_reminderDate!.month}/${_reminderDate!.year}'
                                    : context.tr('select_reminder_date'),
                                style: GoogleFonts.outfit(
                                  fontSize: 14,
                                  color: _reminderDate != null ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                                ),
                              ),
                              const Spacer(),
                              if (_reminderDate != null)
                                GestureDetector(
                                  onTap: () => setState(() => _reminderDate = null),
                                  child: const Icon(Icons.clear, color: Color(0xFF64748B), size: 18),
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        context.tr('sms_reminder_desc'),
                        style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF64748B)),
                      ),
                    ],
                  ],
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: Text(context.tr('track_stock'), style: GoogleFonts.outfit(fontSize: 14, color: const Color(0xFF475569))),
                      ),
                      Switch(
                        value: _trackStock,
                        onChanged: (v) => setState(() => _trackStock = v),
                        activeColor: const Color(0xFF025EA7),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Settings
              _card(
                sectionIcon: Icons.settings_outlined,
                sectionTitle: context.tr('settings_section'),
                children: [
                  Text(context.tr('status'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(child: _typeChip('active', context.tr('active'), Icons.check_circle_outline, onSelect: (v) => setState(() => _status = v))),
                      const SizedBox(width: 10),
                      Expanded(child: _typeChip('inactive', context.tr('inactive'), Icons.remove_circle_outline, onSelect: (v) => setState(() => _status = v))),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),

              if (_itemsAddedCount > 0) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFBBF7D0)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle, color: Color(0xFF16A34A), size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          context.tr('items_added_session').replaceFirst('{count}', '$_itemsAddedCount'),
                          style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF15803D)),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],

              // Excel Import Banner Card
              if (!_isEditing && canImport) ...[
                GestureDetector(
                  onTap: _openExcelImport,
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFBFDBFE)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.table_chart_outlined, color: Color(0xFF025EA7), size: 22),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                context.tr('import_excel'),
                                style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: const Color(0xFF1E40AF)),
                              ),
                              Text(
                                context.tr('excel_import_subtitle'),
                                style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF3B82F6)),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right, color: Color(0xFF025EA7), size: 20),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
              ],

              if (_isEditing)
                SizedBox(
                  height: 52,
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : () => _submit(continueAdding: false),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF025EA7),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                      elevation: 0,
                    ),
                    child: _isSubmitting
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text(context.tr('save'), style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 16)),
                  ),
                )
              else
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 52,
                        child: OutlinedButton(
                          onPressed: _isSubmitting ? null : () => _submit(continueAdding: true),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Color(0xFF025EA7), width: 1.5),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                          ),
                          child: Text(
                            context.tr('add_and_continue'),
                            style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 14, color: const Color(0xFF025EA7)),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: SizedBox(
                        height: 52,
                        child: ElevatedButton(
                          onPressed: _isSubmitting ? null : () => _submit(continueAdding: false),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF025EA7),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                            elevation: 0,
                          ),
                          child: _isSubmitting
                              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : Text(context.tr('add_product'), style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 15)),
                        ),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _typeChip(String value, String label, IconData icon, {void Function(String)? onSelect}) {
    final isStatus = value == 'active' || value == 'inactive';
    final selected = isStatus ? _status == value : _productType == value;
    final color = isStatus && value == 'active' ? const Color(0xFF16A34A) : const Color(0xFF025EA7);
    return GestureDetector(
      onTap: () {
        if (onSelect != null) {
          onSelect(value);
        } else {
          setState(() => _productType = value);
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.1) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? color : const Color(0xFFE2E8F0),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon, size: 18, color: selected ? color : const Color(0xFF64748B)),
                  const SizedBox(width: 6),
                  Text(label, maxLines: 1, style: GoogleFonts.outfit(
                    fontSize: 14, fontWeight: FontWeight.w600,
                    color: selected ? color : const Color(0xFF64748B),
                  )),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _commissionField() {
    final primary = const Color(0xFF025EA7);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(context.tr('commission'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
            const SizedBox(width: 4),
            Text('*', style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFFDC2626))),
          ],
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _commissionType = 'percent'),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: _commissionType == 'percent' ? primary.withValues(alpha: 0.1) : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: _commissionType == 'percent' ? primary : const Color(0xFFE2E8F0),
                      width: _commissionType == 'percent' ? 1.5 : 1,
                    ),
                  ),
                  child: Center(
                    child: Text('${context.tr('commission_percent')} (%)',
                      style: GoogleFonts.outfit(
                        fontSize: 13, fontWeight: FontWeight.w600,
                        color: _commissionType == 'percent' ? primary : const Color(0xFF64748B),
                      )),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _commissionType = 'fixed'),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: _commissionType == 'fixed' ? primary.withValues(alpha: 0.1) : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: _commissionType == 'fixed' ? primary : const Color(0xFFE2E8F0),
                      width: _commissionType == 'fixed' ? 1.5 : 1,
                    ),
                  ),
                  child: Center(
                    child: Text(context.tr('commission_fixed'),
                      style: GoogleFonts.outfit(
                        fontSize: 13, fontWeight: FontWeight.w600,
                        color: _commissionType == 'fixed' ? primary : const Color(0xFF64748B),
                      )),
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        TextFormField(
          controller: _commissionRateController,
          style: GoogleFonts.outfit(fontSize: 14),
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            hintText: _commissionType == 'percent' ? '5' : '25',
            hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 14),
            suffixText: _commissionType == 'percent' ? '%' : 'ETB',
            suffixStyle: GoogleFonts.outfit(color: const Color(0xFF64748B), fontSize: 14),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            errorMaxLines: 2,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF025EA7), width: 1.5)),
            errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFFCA5A5), width: 1.5)),
            focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFDC2626), width: 1.8)),
            errorStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w500, color: const Color(0xFFDC2626)),
          ),
          validator: (v) {
            if (v == null || v.isEmpty || parseAmount(v) == null) {
              return context.tr('fill_in_commission');
            }
            return null;
          },
        ),
      ],
    );
  }

  Widget _card({required List<Widget> children, IconData? sectionIcon, String? sectionTitle}) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (sectionTitle != null) ...[
            Row(
              children: [
                if (sectionIcon != null) ...[
                  Icon(sectionIcon, size: 18, color: const Color(0xFF025EA7)),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: Text(
                    sectionTitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
          ],
          ...children,
        ],
      ),
    );
  }

  List<String> get _unitOptions {
    final combined = <String>{..._units, ..._customUnits};
    if (_unit.isNotEmpty) combined.add(_unit);
    return combined.toList();
  }

  Future<void> _pickNewUnit() async {
    final controller = TextEditingController();
    final newUnit = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(
          'Add Unit of Measurement',
          style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
        ),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Unit Measure',
            hintText: 'e.g. carton, bundle, dozen, sack',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(dialogContext.tr('cancel')),
          ),
          TextButton(
            onPressed: () {
              final value = controller.text.trim();
              if (value.isEmpty) return;
              Navigator.pop(dialogContext, value);
            },
            child: Text(dialogContext.tr('save')),
          ),
        ],
      ),
    );
    if (newUnit != null && newUnit.trim().isNotEmpty && mounted) {
      final formatted = newUnit.trim().toLowerCase();
      setState(() {
        if (!_customUnits.contains(formatted)) _customUnits.add(formatted);
        _unit = formatted;
      });
    }
  }

  Widget _unitField() {
    final unitValue = _unitOptions.contains(_unit) ? _unit : _unitOptions.first;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(context.tr('unit_col'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
            GestureDetector(
              onTap: _pickNewUnit,
              child: Text(
                '+ ${context.tr('add')}',
                style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF025EA7)),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          value: unitValue,
          decoration: _inputDecoration(context.tr('unit_col')),
          isExpanded: true,
          items: [
            ..._unitOptions.map((u) => DropdownMenuItem(value: u, child: Text(u, overflow: TextOverflow.ellipsis))),
            DropdownMenuItem(
              value: '__new_unit__',
              child: Row(
                children: [
                  const Icon(Icons.add, size: 18, color: Color(0xFF025EA7)),
                  const SizedBox(width: 6),
                  Text('Add New Unit...', style: GoogleFonts.outfit(color: const Color(0xFF025EA7), fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
          onChanged: (val) {
            if (val == '__new_unit__') {
              _pickNewUnit();
            } else if (val != null) {
              setState(() => _unit = val);
            }
          },
        ),
      ],
    );
  }

  Widget _categoryField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('${context.tr('category')} (${context.tr('optional')})', style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
        const SizedBox(height: 6),
        DropdownButtonFormField<String?>(
          value: _category != null && _categories.contains(_category) ? _category : null,
          decoration: _inputDecoration(context.tr('category')),
          hint: Text(context.tr('select_category')),
          isExpanded: true,
          items: [
            DropdownMenuItem<String?>(
              value: null,
              child: Text(
                'None (${context.tr('optional')})',
                style: GoogleFonts.outfit(color: const Color(0xFF94A3B8)),
              ),
            ),
            ..._categories.map((c) => DropdownMenuItem<String?>(
              value: c,
              child: Text(c, overflow: TextOverflow.ellipsis),
            )),
            DropdownMenuItem<String?>(
              value: '__new__',
              child: Row(
                children: [
                  const Icon(Icons.add, size: 18, color: Color(0xFF025EA7)),
                  const SizedBox(width: 6),
                  Text(context.tr('create_new_category')),
                ],
              ),
            ),
          ],
          onChanged: (val) {
            if (val == '__new__') {
              _pickNewCategory();
            } else {
              setState(() => _category = val);
            }
          },
          validator: null,
        ),
      ],
    );
  }

  Future<void> _pickNewCategory() async {
    final controller = TextEditingController(text: _category ?? '');
    final newCategory = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(context.tr('create_new_category'), style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A))),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: InputDecoration(
            labelText: context.tr('category'),
            hintText: context.tr('category_name_hint'),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(dialogContext.tr('cancel')),
          ),
          TextButton(
            onPressed: () {
              final value = controller.text.trim();
              if (value.isEmpty) return;
              Navigator.pop(dialogContext, value);
            },
            child: Text(dialogContext.tr('save')),
          ),
        ],
      ),
    );
    if (newCategory != null && newCategory.isNotEmpty && mounted) {
      setState(() {
        if (!_categories.contains(newCategory)) _categories = [..._categories, newCategory];
        _category = newCategory;
      });
    }
  }

  Widget _brandField() {
    final currentBrand = _brandController.text.trim();
    final selectedBrand = currentBrand.isNotEmpty && _brands.contains(currentBrand) ? currentBrand : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(context.tr('brand'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
        const SizedBox(height: 6),
        DropdownButtonFormField<String?>(
          value: selectedBrand,
          decoration: _inputDecoration(context.tr('brand')),
          hint: Text(context.tr('select_brand')),
          isExpanded: true,
          items: [
            ..._brands.map((b) => DropdownMenuItem<String?>(
              value: b,
              child: Text(b, overflow: TextOverflow.ellipsis),
            )),
            DropdownMenuItem<String?>(
              value: '__new__',
              child: Row(
                children: [
                  const Icon(Icons.add, size: 18, color: Color(0xFF025EA7)),
                  const SizedBox(width: 6),
                  Text(context.tr('create_new_brand')),
                ],
              ),
            ),
          ],
          onChanged: (val) {
            if (val == '__new__') {
              _pickNewBrand();
            } else {
              setState(() {
                _brandController.text = val ?? '';
              });
            }
          },
        ),
      ],
    );
  }

  Future<void> _pickNewBrand() async {
    final controller = TextEditingController(text: _brandController.text.trim());
    final newBrand = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(context.tr('create_new_brand'), style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A))),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: InputDecoration(
            labelText: context.tr('brand'),
            hintText: context.tr('brand_name_hint'),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(dialogContext.tr('cancel')),
          ),
          TextButton(
            onPressed: () {
              final value = controller.text.trim();
              if (value.isEmpty) return;
              Navigator.pop(dialogContext, value);
            },
            child: Text(dialogContext.tr('save')),
          ),
        ],
      ),
    );
    if (newBrand != null && newBrand.isNotEmpty && mounted) {
      setState(() {
        if (!_brands.contains(newBrand)) _brands = [..._brands, newBrand];
        _brandController.text = newBrand;
      });
    }
  }

  Widget _warehouseField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(context.tr('warehouse'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
        const SizedBox(height: 6),
        DropdownButtonFormField<String?>(
          value: _warehouseId != null && _warehouses.any((w) => w.id == _warehouseId) ? _warehouseId : null,
          decoration: _inputDecoration(context.tr('warehouse')),
          hint: Text(context.tr('select_warehouse')),
          isExpanded: true,
          items: _warehouses.map((w) => DropdownMenuItem<String?>(
            value: w.id,
            child: Text(w.name),
          )).toList(),
          onChanged: (val) => setState(() => _warehouseId = val),
        ),
      ],
    );
  }

  Widget _supplierEl() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(context.tr('supplier'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
        const SizedBox(height: 6),
        DropdownButtonFormField<String?>(
          value: _supplierId != null && (_suppliers.any((s) => s.id == _supplierId) || _supplierId == '__new__') ? _supplierId : null,
          decoration: _inputDecoration(context.tr('supplier')),
          hint: Text(context.tr('select_supplier')),
          isExpanded: true,
          items: [
            ..._suppliers.map((s) => DropdownMenuItem<String?>(
              value: s.id,
              child: Text(s.name),
            )),
            DropdownMenuItem<String?>(
              value: '__new__',
              child: Text(context.tr('create_new_supplier')),
            ),
          ],
          onChanged: (val) {
            if (val == '__new__') {
              _createSupplierInline();
            } else {
              setState(() => _supplierId = val);
            }
          },
        ),
      ],
    );
  }

  Widget _field(String label, TextEditingController controller,
      {TextInputType? keyboardType, String? Function(String?)? validator, int maxLines = 1, FocusNode? focusNode, List<TextInputFormatter>? inputFormatters, String? suffixText, Widget? labelTrailing}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF475569)),
              ),
            ),
            if (labelTrailing != null) ...[
              const SizedBox(width: 8),
              labelTrailing,
            ],
          ],
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          focusNode: focusNode,
          style: GoogleFonts.outfit(fontSize: 14),
          keyboardType: keyboardType,
          maxLines: maxLines,
          inputFormatters: inputFormatters,
          decoration: InputDecoration(
            hintText: label,
            hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 14),
            suffixText: suffixText,
            suffixStyle: GoogleFonts.outfit(color: const Color(0xFF64748B), fontSize: 14),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            errorMaxLines: 2,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF025EA7), width: 1.5)),
            errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFFCA5A5), width: 1.5)),
            focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFDC2626), width: 1.8)),
            errorStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w500, color: const Color(0xFFDC2626)),
          ),
          validator: validator,
        ),
      ],
    );
  }

  InputDecoration _inputDecoration(String hint, {String? errorText}) {
    final hasError = errorText != null && errorText.isNotEmpty;
    return InputDecoration(
      hintText: hint,
      hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 14),
      filled: true,
      fillColor: hasError ? const Color(0xFFFFF5F5) : Colors.white,
      errorText: errorText,
      errorMaxLines: 2,
      errorStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w500, color: const Color(0xFFDC2626)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(
          color: hasError ? const Color(0xFFFCA5A5) : const Color(0xFFE2E8F0),
          width: hasError ? 1.5 : 1,
        ),
      ),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF025EA7), width: 1.5)),
      errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFFCA5A5), width: 1.5)),
      focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFDC2626), width: 1.8)),
    );
  }

  void _showComingSoon() {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            const Icon(Icons.build_outlined, color: Color(0xFF025EA7), size: 26),
            const SizedBox(width: 8),
            Expanded(child: Text(context.tr('coming_soon'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)))),
          ],
        ),
        content: Text(
          context.tr('coming_soon_service_desc'),
          style: GoogleFonts.outfit(fontSize: 14, color: const Color(0xFF475569)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(dialogContext.tr('ok'), style: GoogleFonts.outfit(color: const Color(0xFF025EA7), fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  Future<void> _openExcelImport() async {
    final result = await ExcelImportDialog.show(context, enableAutoFill: true);
    if (result != null && mounted) {
      setState(() {
        if (result['name'] != null && result['name'].toString().isNotEmpty) {
          _nameController.text = result['name'].toString();
        }
        if (result['category'] != null && result['category'].toString().isNotEmpty) {
          final c = result['category'].toString();
          _category = c;
          if (!_categories.contains(c)) _categories = [..._categories, c];
        }
        if (result['sku'] != null && result['sku'].toString().isNotEmpty) {
          _skuController.text = result['sku'].toString();
        }
        if (result['barcode'] != null && result['barcode'].toString().isNotEmpty) {
          _barcodeController.text = result['barcode'].toString();
        }
        if (result['price'] != null) {
          _priceController.text = result['price'].toString();
        }
        if (result['cost'] != null) {
          _costController.text = result['cost'].toString();
        }
        if (result['stockQuantity'] != null) {
          _stockController.text = result['stockQuantity'].toString();
        }
        if (result['minStockLevel'] != null) {
          _minStockController.text = result['minStockLevel'].toString();
        }
        if (result['description'] != null && result['description'].toString().isNotEmpty) {
          _descriptionController.text = result['description'].toString();
        }
        if (result['unit'] != null && result['unit'].toString().isNotEmpty) {
          final u = result['unit'].toString().toLowerCase().trim();
          if (!_units.contains(u) && !_customUnits.contains(u)) {
            _customUnits.add(u);
          }
          _unit = u;
        }
        if (result['type'] != null && result['type'].toString().isNotEmpty) {
          final t = result['type'].toString().toLowerCase();
          if (t == 'product' || t == 'service') _productType = t;
        }
      });
    }
  }
}

class _BarcodeScanScreen extends StatefulWidget {
  const _BarcodeScanScreen();

  @override
  State<_BarcodeScanScreen> createState() => _BarcodeScanScreenState();
}

class _BarcodeScanScreenState extends State<_BarcodeScanScreen> {
  MobileScannerController? _cameraController;
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    _cameraController = MobileScannerController(
      detectionSpeed: DetectionSpeed.normal,
      facing: CameraFacing.back,
    );
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(context.tr('scan_barcode'), style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w600, color: Colors.white)),
      ),
      body: Stack(
        alignment: Alignment.center,
        children: [
          MobileScanner(
            controller: _cameraController!,
            onDetect: (capture) {
              if (_isProcessing) return;
              final barcode = capture.barcodes.first.rawValue;
              if (barcode == null || barcode.isEmpty) return;
              _isProcessing = true;
              Navigator.pop(context, barcode);
            },
          ),
          Container(
            width: 280,
            height: 280,
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFF025EA7), width: 3),
              borderRadius: BorderRadius.circular(16),
            ),
          ),
          Positioned(
            bottom: 80,
            child: Text(
              context.tr('scan_barcode'),
              style: GoogleFonts.outfit(fontSize: 14, color: Colors.white.withValues(alpha: 0.8)),
            ),
          ),
        ],
      ),
    );
  }
}
