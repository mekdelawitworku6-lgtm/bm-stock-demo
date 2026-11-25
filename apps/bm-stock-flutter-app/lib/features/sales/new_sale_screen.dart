import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/bloc/sale/sale_bloc.dart';
import '../../core/blocs/company/company_bloc.dart';
import '../../core/blocs/company/company_state.dart';
import '../../core/bloc/auth/auth_bloc.dart';
import '../../core/bloc/product/product_bloc.dart';
import '../../core/providers/branch_provider.dart';
import '../../core/providers/bank_account_provider.dart';
import '../../core/services/customer_service.dart';
import '../../core/services/product_service.dart';
import '../../core/services/sale_service.dart';
import '../../core/models/customer_model.dart';
import '../../core/models/product_model.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/permissions/app_permissions.dart';
import '../../core/utils/branch_access_helper.dart';
import '../../core/utils/phone_util.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/widgets/barcode_scan_screen.dart';
import '../customers/add_customer_screen.dart';

class NewSaleScreen extends StatefulWidget {
  final ProductModel? initialProduct;
  const NewSaleScreen({super.key, this.initialProduct});

  @override
  State<NewSaleScreen> createState() => _NewSaleScreenState();
}

class _NewSaleScreenState extends State<NewSaleScreen> {
  final _customerService = CustomerService();
  final _productService = ProductService();
  final _saleService = SaleService();
  final _picker = ImagePicker();

  final _advanceController = TextEditingController();
  final _referenceController = TextEditingController();
  final _dueDateController = TextEditingController();
  final _discountValueController = TextEditingController();
  final _newCustomerNameController = TextEditingController();
  final _newCustomerPhoneController = TextEditingController();
  final _newCustomerAddressController = TextEditingController();

  List<CustomerModel> _customers = [];
  List<ProductModel> _products = [];
  List<_CartItem> _cart = [];
  bool _isLoading = true;
  bool _isSubmitting = false;

  // Customer
  String? _selectedCustomerId;
  String _selectedCustomerName = 'Walk-in Customer';
  bool _showNewCustomerForm = false;
  bool _walkInCustomer = true; // Default to walk-in for speed

  // Location
  List<_SaleLocation> _availableLocations = [];
  _SaleLocation? _selectedLocation;

  // Payment & Discount
  String _paymentType = 'cash';
  String _discountType = 'none';
  bool _withoutVat = false; // Without VAT (-15%)
  int _reminderDaysBefore = 7;

  static const _reminderOptions = [0, 1, 3, 7, 10, 14];

  // Receipt / transaction screenshot
  XFile? _receiptImage;
  Uint8List? _receiptImageBytes;
  String? _receiptImageUrl;
  bool _uploadingReceipt = false;

  // Auto-generated metadata
  late String _invoiceNumber;
  late String _saleDate;
  String _salespersonName = '';
  String _branchName = '';

  static const _paymentOptions = [
    _PayOpt('cash', 'cash', Icons.payments_outlined),
    _PayOpt('bank_transfer', 'bank_transfer', Icons.account_balance_outlined),
    _PayOpt('credit', 'credit', Icons.credit_score_outlined),
  ];

  @override
  void initState() {
    super.initState();
    _invoiceNumber = _generateInvoice();
    _saleDate = _formatDate(DateTime.now());
    if (widget.initialProduct != null) {
      _cart.add(_CartItem(product: widget.initialProduct!, quantity: 1));
    }
    _loadData();
  }

  String _formatDate(DateTime d) {
    final months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    final h = d.hour > 12 ? d.hour - 12 : (d.hour == 0 ? 12 : d.hour);
    final ampm = d.hour >= 12 ? 'PM' : 'AM';
    return '${d.day.toString().padLeft(2, '0')} ${months[d.month - 1]} ${d.year}, ${h.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')} $ampm';
  }

  String _formatIsoDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  String _reminderOptionLabel(int daysBefore) {
    switch (daysBefore) {
      case 0:
        return context.tr('on_due_date');
      case 1:
        return context.tr('1_day_before_due');
      case 3:
        return context.tr('3_days_before_due');
      case 7:
        return context.tr('1_week_before_due');
      case 10:
        return context.tr('10_days_before_due');
      case 14:
        return context.tr('2_weeks_before_due');
      default:
        return context.tr('days_before_due').replaceAll('{count}', '$daysBefore');
    }
  }

  DateTime? _parsedDueDate() {
    final text = _dueDateController.text.trim();
    if (text.isEmpty) return null;
    return DateTime.tryParse(text);
  }

  DateTime? _computedReminderDate() {
    final due = _parsedDueDate();
    if (due == null) return null;
    return due.subtract(Duration(days: _reminderDaysBefore));
  }

  String _formatDisplayDate(DateTime d) => '${d.day}/${d.month}/${d.year}';

  String _generateInvoice() {
    final now = DateTime.now();
    final rand = Random().nextInt(9000) + 1000;
    return 'INV-${now.year}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}-$rand';
  }

  bool _isValidUuid(String? id) {
    if (id == null || id.isEmpty) return false;
    return RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$').hasMatch(id);
  }

  @override
  void dispose() {
    _advanceController.dispose();
    _referenceController.dispose();
    _dueDateController.dispose();
    _discountValueController.dispose();
    _newCustomerNameController.dispose();
    _newCustomerPhoneController.dispose();
    _newCustomerAddressController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    if (!mounted) return;
    setState(() => _isLoading = true);
    try {
      final user = context.read<AuthBloc>().user;
      final companyState = context.read<CompanyBloc>().state;
      final companyId = (companyState is CompanyLoaded ? companyState.selectedCompany?.id : null) ?? user?.companyId;
      final branchProvider = context.read<BranchProvider>();
      if (branchProvider.warehouses.isEmpty || branchProvider.shops.isEmpty) {
        await branchProvider.loadBranches(companyId: companyId, showLoading: false);
      }
      if (user != null) {
        _salespersonName = user.fullName;
      }

      _availableLocations = _buildAvailableLocations(user, branchProvider);
      _selectedLocation = _pickDefaultLocation(user, _availableLocations);
      _branchName = _selectedLocation?.name ?? 'Branch';

      _products = await _loadProductsForLocation(_selectedLocation);

      final customers = await _customerService.getAll();
      if (mounted) _customers = customers;
    } catch (_) {}
    if (mounted) setState(() => _isLoading = false);
  }

  List<_SaleLocation> _buildAvailableLocations(dynamic user, BranchProvider branchProvider) {
    final locations = <_SaleLocation>[];
    final seen = <String>{};

    void addWarehouse(String id, String name) {
      if (_isValidUuid(id) && seen.add('warehouse:$id')) {
        locations.add(_SaleLocation(id: id, name: name, isWarehouse: true));
      }
    }

    void addShop(String id, String name) {
      if (_isValidUuid(id) && seen.add('shop:$id')) {
        locations.add(_SaleLocation(id: id, name: name, isWarehouse: false));
      }
    }

    if (user != null) {
      if (_isValidUuid(user.warehouseId)) {
        final w = branchProvider.warehouses.where((w) => w.id == user.warehouseId).firstOrNull;
        addWarehouse(user.warehouseId!, w?.name ?? 'Warehouse');
      }
      if (_isValidUuid(user.shopId)) {
        final s = branchProvider.shops.where((s) => s.id == user.shopId).firstOrNull;
        addShop(user.shopId!, s?.name ?? 'Shop');
      }
    }

    for (final w in BranchAccessHelper.accessibleWarehouses(user, branchProvider.warehouses)) {
      addWarehouse(w.id, w.name);
    }
    for (final s in BranchAccessHelper.accessibleShops(user, branchProvider.shops)) {
      addShop(s.id, s.name);
    }

    return locations;
  }

  _SaleLocation? _pickDefaultLocation(dynamic user, List<_SaleLocation> locations) {
    if (locations.isEmpty) return null;
    if (user?.warehouseId != null) {
      final match = locations.where((l) => l.isWarehouse && l.id == user!.warehouseId).firstOrNull;
      if (match != null) return match;
    }
    if (user?.shopId != null) {
      final match = locations.where((l) => !l.isWarehouse && l.id == user!.shopId).firstOrNull;
      if (match != null) return match;
    }
    return locations.first;
  }

  Future<List<ProductModel>> _loadProductsForLocation(_SaleLocation? location) async {
    final user = context.read<AuthBloc>().user;
    final companyState = context.read<CompanyBloc>().state;
    final companyId = (companyState is CompanyLoaded ? companyState.selectedCompany?.id : null) ?? user?.companyId;

    if (location != null) {
      try {
        if (location.isWarehouse) {
          return await _productService.getByWarehouse(location.id);
        } else {
          return await _productService.getByShop(location.id);
        }
      } catch (e) {
        debugPrint('[NewSale] Location products failed: $e');
      }
    }

    try {
      final locProducts = await _productService.getByUserLocation();
      if (locProducts.isNotEmpty) return locProducts;
    } catch (e) {
      debugPrint('[NewSale] User location products failed: $e');
    }

    return await _productService.getAllForCompany(companyId: companyId);
  }

  Future<void> _refreshProducts() async {
    final products = await _loadProductsForLocation(_selectedLocation);
    if (mounted) setState(() => _products = products);
  }

  bool get _canViewStock {
    final user = context.read<AuthBloc>().user;
    if (user == null) return false;
    return user.isAdmin ||
        user.canViewModule(ModuleKeys.stockIn) ||
        user.canViewModule(ModuleKeys.stockOut) ||
        user.canViewModule(ModuleKeys.stockInOut);
  }

  bool _canAddProduct(ProductModel product) {
    if (product.type == 'service' || !product.trackStock) return true;
    return product.stockQuantity > 0;
  }

  int _maxQuantity(ProductModel product) {
    if (product.type == 'service' || !product.trackStock) return 999999;
    return product.stockQuantity > 0 ? product.stockQuantity : 1;
  }

  Future<void> _editSelectedCustomer() async {
    if (_selectedCustomerId != null) {
      CustomerModel? customer;
      try {
        customer = _customers.firstWhere((c) => c.id == _selectedCustomerId);
      } catch (_) {
        try {
          customer = await _customerService.getById(_selectedCustomerId!);
        } catch (_) {
          customer = null;
        }
      }
      if (customer == null || !mounted) return;

      final result = await Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => AddCustomerScreen(customer: customer)),
      );
      if (result == true && mounted) {
        final customers = await _customerService.getAll();
        final updated = customers.where((c) => c.id == _selectedCustomerId).firstOrNull;
        setState(() {
          _customers = customers;
          if (updated != null) {
            _selectedCustomerName = updated.name;
          }
        });
      }
      return;
    }

    setState(() {
      _showNewCustomerForm = true;
      if (_newCustomerNameController.text.isEmpty) {
        _newCustomerNameController.text = _selectedCustomerName;
      }
    });
  }

  Future<void> _onLocationChanged(_SaleLocation location) async {
    setState(() {
      _selectedLocation = location;
      _branchName = location.name;
      _cart = [];
    });
    setState(() => _isLoading = true);
    try {
      _products = await _loadProductsForLocation(location);
    } catch (_) {}
    if (mounted) setState(() => _isLoading = false);
  }

  void _addToCart(ProductModel product, [double? customUnitPrice]) {
    if (!_canAddProduct(product)) {
      showAppToast(context, context.tr('out_of_stock'), type: AppToastType.error);
      return;
    }
    setState(() {
      final maxQty = _maxQuantity(product);
      final existing = _cart.indexWhere((item) => item.product.id == product.id);
      if (existing >= 0) {
        final item = _cart[existing];
        if (item.quantity < maxQty) {
          _cart[existing] = _CartItem(
            product: item.product,
            quantity: item.quantity + 1,
            unitPrice: customUnitPrice ?? item.unitPrice,
          );
        } else {
          showAppToast(context, context.tr('insufficient_stock'), type: AppToastType.error);
        }
      } else {
        _cart.add(_CartItem(product: product, quantity: 1, unitPrice: customUnitPrice));
      }
    });
  }

  void _updateCartQuantity(int index, int qty) {
    setState(() {
      if (qty <= 0) {
        _cart.removeAt(index);
      } else {
        final item = _cart[index];
        final maxQty = _maxQuantity(item.product);
        _cart[index] = _CartItem(
          product: item.product,
          quantity: qty.clamp(1, maxQty),
          unitPrice: item.unitPrice,
        );
      }
    });
  }

  void _updateCartUnitPrice(int index, double newUnitPrice) {
    setState(() {
      if (index >= 0 && index < _cart.length) {
        final item = _cart[index];
        _cart[index] = _CartItem(
          product: item.product,
          quantity: item.quantity,
          unitPrice: newUnitPrice.clamp(0, double.infinity),
        );
      }
    });
  }

  void _showEditUnitPriceDialog(int index, _CartItem item) {
    final priceCtrl = TextEditingController(text: item.unitPrice.toStringAsFixed(2));
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.only(top: 2),
              child: Icon(Icons.edit_note, color: Color(0xFF025EA7)),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Tooltip(
                message: item.product.name,
                child: Text(
                  '${context.tr('edit')} ${item.product.name}',
                  style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A), height: 1.25),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Default Price: ETB ${item.product.price.toStringAsFixed(2)} / ${item.product.unit}',
              style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF64748B)),
            ),
            const SizedBox(height: 12),
            Text(
              'Unit Price (ETB)',
              style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: const Color(0xFF334155)),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: priceCtrl,
              autofocus: true,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold),
              decoration: _inputDeco(
                'Enter price',
                prefix: const Padding(
                  padding: EdgeInsets.only(left: 12, right: 6),
                  child: Text('ETB ', style: TextStyle(color: Color(0xFF025EA7), fontWeight: FontWeight.bold)),
                ),
              ),
            ),
            const SizedBox(height: 10),
            TextButton.icon(
              onPressed: () {
                priceCtrl.text = item.product.price.toStringAsFixed(2);
              },
              icon: const Icon(Icons.restore, size: 14, color: Color(0xFF025EA7)),
              label: Text('Reset to Default', style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF025EA7))),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(context.tr('cancel'), style: GoogleFonts.outfit(color: const Color(0xFF64748B))),
          ),
          ElevatedButton(
            onPressed: () {
              final val = double.tryParse(priceCtrl.text.trim());
              if (val != null && val >= 0) {
                _updateCartUnitPrice(index, val);
              }
              Navigator.pop(ctx);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF025EA7),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: Text(context.tr('save'), style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  void _removeFromCart(int index) {
    setState(() => _cart.removeAt(index));
  }

  // Camera Barcode Scanning
  Future<void> _scanBarcode() async {
    final code = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (_) => const BarcodeScanScreen()),
    );

    if (code == null || code.isEmpty || !mounted) return;

    // 1. Search product in local loaded list
    final matchingProduct = _products.where((p) {
      return (p.barcode != null && p.barcode!.toLowerCase() == code.toLowerCase()) ||
          p.sku.toLowerCase() == code.toLowerCase();
    }).firstOrNull;

    if (matchingProduct != null) {
      _addToCart(matchingProduct);
      showAppToast(context, '${matchingProduct.name} ${context.tr('added_to_cart')}', type: AppToastType.success);
      return;
    }

    // 2. Try searching via barcode-scan backend endpoint
    try {
      final product = await _productService.findByBarcode(code);
      if (product != null && mounted) {
        _addToCart(product);
        showAppToast(context, '${product.name} ${context.tr('added_to_cart')}', type: AppToastType.success);
      } else if (mounted) {
        showAppToast(context, '${context.tr('no_products_found')}: $code', type: AppToastType.error);
      }
    } catch (e) {
      if (mounted) {
        showAppToast(context, '${context.tr('no_products_found')}: $code', type: AppToastType.error);
      }
    }
  }

  double get _subtotal => _cart.fold(0, (sum, item) => sum + item.totalPrice);
  double get _vatDeduction => _withoutVat ? (_subtotal * 0.15) : 0.0;
  double get _baseAfterVat => (_subtotal - _vatDeduction).clamp(0.0, double.infinity);

  double get _discountAmount {
    if (_discountType == 'none') return 0;
    final val = double.tryParse(_discountValueController.text) ?? 0;
    if (_discountType == 'percentage') return (_baseAfterVat * val) / 100;
    return val.clamp(0, _baseAfterVat);
  }

  double get _grandTotal => (_baseAfterVat - _discountAmount).clamp(0, double.infinity);
  int get _totalItems => _cart.fold(0, (sum, item) => sum + item.quantity);

  double get _rawAdvanceInput {
    final text = _advanceController.text.trim();
    return double.tryParse(text) ?? 0;
  }

  double get _advancePayment => _rawAdvanceInput;

  double get _remainingBalance => (_grandTotal - _advancePayment).clamp(0, double.infinity);

  bool get _hasPaymentOrDiscountSummary {
    return _rawAdvanceInput > 0 ||
        _withoutVat ||
        (_discountType != 'none' && _discountAmount > 0);
  }

  String get _locationLabel {
    if (_selectedLocation == null) return _branchName;
    return '${_selectedLocation!.isWarehouse ? 'Warehouse' : 'Shop'} · ${_selectedLocation!.name}';
  }

  InputDecoration _inputDeco(String hint, {Widget? prefix, Widget? suffix, String? errorText}) {
    final hasError = errorText != null && errorText.isNotEmpty;
    return InputDecoration(
      hintText: hint,
      hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 13.5),
      prefixIcon: prefix,
      suffixIcon: suffix,
      filled: true,
      fillColor: hasError ? const Color(0xFFFFF5F5) : const Color(0xFFF8FAFC),
      errorText: errorText,
      errorMaxLines: 2,
      errorStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w500, color: const Color(0xFFDC2626)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(
          color: hasError ? const Color(0xFFFCA5A5) : const Color(0xFFE2E8F0),
          width: hasError ? 1.5 : 1,
        ),
      ),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF025EA7), width: 1.5)),
      errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFFCA5A5), width: 1.5)),
      focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFDC2626), width: 1.8)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: _buildAppBar(),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF025EA7)))
          : SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildHeaderMetaCard(),
                  const SizedBox(height: 14),
                  _buildCustomerSection(),
                  const SizedBox(height: 14),
                  _buildAddProductBanner(),
                  const SizedBox(height: 14),
                  _buildCartSection(),
                  const SizedBox(height: 14),
                  _buildPaymentSection(),
                  const SizedBox(height: 14),
                  _buildDiscountSection(),
                  const SizedBox(height: 14),
                  _buildReceiptSection(),
                  const SizedBox(height: 14),
                ],
              ),
            ),
      // ── Sticky Sales Summary Bar at the bottom (User requested) ──────────
      bottomNavigationBar: _isLoading ? null : _buildStickySalesSummaryBar(),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: Colors.white,
      elevation: 0.5,
      scrolledUnderElevation: 1,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF0F172A), size: 19),
        onPressed: () => Navigator.pop(context),
      ),
      titleSpacing: 0,
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.tr('new_sale'),
            style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
          ),
          Text(
            _invoiceNumber,
            style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w500, color: const Color(0xFF64748B)),
          ),
        ],
      ),
      actions: [
        // Camera Barcode Scanner Action Button
        IconButton(
          onPressed: _scanBarcode,
          tooltip: context.tr('scan_barcode'),
          icon: Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
              color: const Color(0xFF025EA7).withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.qr_code_scanner, color: Color(0xFF025EA7), size: 20),
          ),
        ),
        const SizedBox(width: 8),
      ],
    );
  }

  Widget _buildHeaderMetaCard() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              _infoBadge(Icons.calendar_today_outlined, _saleDate),
              const SizedBox(width: 10),
              _infoBadge(Icons.person_outline, _salespersonName.isNotEmpty ? _salespersonName : context.tr('salesperson')),
            ],
          ),
          if (_availableLocations.length > 1) ...[
            const SizedBox(height: 10),
            DropdownButtonFormField<_SaleLocation>(
              value: _selectedLocation,
              decoration: _inputDeco(context.tr('select_branch'),
                prefix: const Icon(Icons.storefront_outlined, size: 18, color: Color(0xFF025EA7)),
              ),
              items: _availableLocations
                  .map((loc) => DropdownMenuItem(
                        value: loc,
                        child: Text(
                          '${loc.isWarehouse ? 'Warehouse' : 'Shop'} · ${loc.name}',
                          style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w500),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ))
                  .toList(),
              onChanged: (loc) {
                if (loc != null) _onLocationChanged(loc);
              },
            ),
          ] else ...[
            const SizedBox(height: 8),
            Row(
              children: [
                _infoBadge(Icons.storefront, _branchName, isFull: true),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _infoBadge(IconData icon, String label, {bool isFull = false}) {
    final child = Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        mainAxisSize: isFull ? MainAxisSize.max : MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: const Color(0xFF025EA7)),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              label,
              style: GoogleFonts.outfit(fontSize: 11.5, fontWeight: FontWeight.w500, color: const Color(0xFF475569)),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
    return isFull ? Expanded(child: child) : Expanded(child: child);
  }

  // ── Customer Selection Card ───────────────────────────────────────────────
  Widget _buildCustomerSection() {
    final isWalkInActive = _walkInCustomer ||
        _selectedCustomerName == 'Walk-in Customer' ||
        _selectedCustomerName == context.tr('walk_in_customer');

    return _sectionCard(
      title: context.tr('customer'),
      icon: Icons.person_add_alt_1_outlined,
      action: GestureDetector(
        onTap: () {
          final walkInCust = _customers.where((c) =>
            c.name.toLowerCase().contains('walk-in') ||
            c.name.toLowerCase().contains('walk in')
          ).firstOrNull;
          setState(() {
            _walkInCustomer = true;
            _selectedCustomerId = walkInCust?.id;
            _selectedCustomerName = context.tr('walk_in_customer');
            _showNewCustomerForm = false;
          });
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: isWalkInActive ? const Color(0xFF16A34A) : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isWalkInActive ? const Color(0xFF16A34A) : const Color(0xFFCBD5E1),
              width: 1.2,
            ),
            boxShadow: isWalkInActive
                ? [
                    BoxShadow(
                      color: const Color(0xFF16A34A).withValues(alpha: 0.25),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.directions_walk,
                size: 14,
                color: isWalkInActive ? Colors.white : const Color(0xFF64748B),
              ),
              const SizedBox(width: 4),
              Text(
                context.tr('walk_in'),
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: isWalkInActive ? Colors.white : const Color(0xFF475569),
                ),
              ),
              if (isWalkInActive) ...[
                const SizedBox(width: 4),
                const Icon(Icons.check, size: 13, color: Colors.white),
              ],
            ],
          ),
        ),
      ),
      child: isWalkInActive
          ? Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFBBF7D0)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: const BoxDecoration(
                      color: Color(0xFFDCFCE7),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.directions_walk, color: Color(0xFF16A34A), size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          context.tr('walk_in_customer'),
                          style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
                        ),
                        Text(
                          context.tr('default_walk_in_sale'),
                          style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF16A34A)),
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () => setState(() {
                      _walkInCustomer = false;
                      _selectedCustomerId = null;
                      _selectedCustomerName = '';
                      _showNewCustomerForm = false;
                    }),
                    child: Text(
                      context.tr('change'),
                      style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF025EA7)),
                    ),
                  ),
                ],
              ),
            )
          : _selectedCustomerName.isNotEmpty && !_showNewCustomerForm
              ? Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFBBF7D0)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: const BoxDecoration(
                          color: Color(0xFFDCFCE7),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.check_circle_outline, color: Color(0xFF16A34A), size: 18),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_selectedCustomerName, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF0F172A))),
                            if (_selectedCustomerId == null)
                              Text(context.tr('new_customer_will_be_created'), style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF16A34A))),
                          ],
                        ),
                      ),
                      TextButton(
                        onPressed: () => setState(() {
                          _walkInCustomer = false;
                          _selectedCustomerId = null;
                          _selectedCustomerName = '';
                          _showNewCustomerForm = false;
                          _newCustomerNameController.clear();
                          _newCustomerPhoneController.clear();
                          _newCustomerAddressController.clear();
                        }),
                        child: Text(
                          context.tr('change'),
                          style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF025EA7)),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.edit_outlined, size: 18, color: Color(0xFF025EA7)),
                        tooltip: context.tr('edit'),
                        onPressed: _editSelectedCustomer,
                      ),
                    ],
                  ),
                )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Search Existing Customer trigger (Primary)
                InkWell(
                  onTap: _showCustomerPicker,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.search, color: Color(0xFF025EA7), size: 18),
                        const SizedBox(width: 10),
                        Text(
                          context.tr('search_name_phone'),
                          style: GoogleFonts.outfit(fontSize: 13.5, color: const Color(0xFF64748B)),
                        ),
                        const Spacer(),
                        const Icon(Icons.chevron_right, color: Color(0xFF94A3B8), size: 20),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),

                // Create New Customer trigger button
                if (!_showNewCustomerForm)
                  OutlinedButton.icon(
                    onPressed: () => setState(() => _showNewCustomerForm = true),
                    icon: const Icon(Icons.person_add, size: 16, color: Color(0xFF025EA7)),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFF025EA7)),
                      padding: const EdgeInsets.symmetric(vertical: 11),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    label: Text(
                      context.tr('create_new_customer'),
                      style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: const Color(0xFF025EA7)),
                    ),
                  ),

                // Form to create new customer
                if (_showNewCustomerForm) ...[
                  const SizedBox(height: 6),
                  TextField(
                    controller: _newCustomerNameController,
                    style: GoogleFonts.outfit(fontSize: 14),
                    textInputAction: TextInputAction.next,
                    decoration: _inputDeco('${context.tr('customer_name_label')} *',
                      prefix: const Icon(Icons.person_outline, size: 18, color: Color(0xFF94A3B8)),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _newCustomerPhoneController,
                    style: GoogleFonts.outfit(fontSize: 14),
                    keyboardType: TextInputType.phone,
                    textInputAction: TextInputAction.next,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(10),
                    ],
                    decoration: _inputDeco(context.tr('phone_optional'),
                      prefix: const Icon(Icons.phone_outlined, size: 18, color: Color(0xFF94A3B8)),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _newCustomerAddressController,
                    style: GoogleFonts.outfit(fontSize: 14),
                    textInputAction: TextInputAction.done,
                    decoration: _inputDeco(context.tr('address_optional'),
                      prefix: const Icon(Icons.location_on_outlined, size: 18, color: Color(0xFF94A3B8)),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => setState(() {
                            _showNewCustomerForm = false;
                            _newCustomerNameController.clear();
                            _newCustomerPhoneController.clear();
                            _newCustomerAddressController.clear();
                          }),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Color(0xFFE2E8F0)),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          child: Text(context.tr('cancel'), style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF64748B))),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        flex: 2,
                        child: ElevatedButton(
                          onPressed: () {
                            final name = _newCustomerNameController.text.trim();
                            if (name.isEmpty) {
                              showAppToast(context, context.tr('customer_name_required'), type: AppToastType.error);
                              return;
                            }
                            final phone = _newCustomerPhoneController.text.trim();
                            if (!PhoneUtil.isValidOptionalEthiopian(phone)) {
                              showAppToast(context, context.tr('invalid_phone'), type: AppToastType.error);
                              return;
                            }
                            setState(() {
                              _selectedCustomerName = name;
                              _showNewCustomerForm = false;
                              _walkInCustomer = false;
                            });
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF025EA7),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          child: Text(context.tr('add_customer'), style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white)),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
    );
  }

  // ── Product Add Banner ───────────────────────────────────────────────────
  Widget _buildAddProductBanner() {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF025EA7), Color(0xFF0284C7)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF025EA7).withValues(alpha: 0.25),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => _showProductPicker(),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.add_shopping_cart, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        context.tr('add_products'),
                        style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      Text(
                        context.tr('search_product_sku'),
                        style: GoogleFonts.outfit(fontSize: 12, color: Colors.white.withValues(alpha: 0.85)),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: _scanBarcode,
                  icon: const Icon(Icons.qr_code_scanner, color: Colors.white, size: 22),
                  tooltip: context.tr('scan_barcode'),
                ),
                const Icon(Icons.arrow_forward_ios, color: Colors.white, size: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Cart Section Cards ────────────────────────────────────────────────────
  Widget _buildCartSection() {
    return _sectionCard(
      title: '${context.tr('sale_items')} (${_cart.length})',
      icon: Icons.shopping_bag_outlined,
      action: _cart.isNotEmpty
          ? TextButton(
              onPressed: () => setState(() => _cart.clear()),
              child: Text(
                context.tr('clear_all'),
                style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFFDC2626)),
              ),
            )
          : null,
      child: _cart.isEmpty
          ? Container(
              padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  const Icon(Icons.remove_shopping_cart_outlined, size: 36, color: Color(0xFF94A3B8)),
                  const SizedBox(height: 8),
                  Text(
                    context.tr('no_items_in_cart'),
                    style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w500, color: const Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    context.tr('tap_add_products_hint'),
                    style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF94A3B8)),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            )
          : Column(
              children: _cart.asMap().entries.map((entry) {
                final i = entry.key;
                final item = entry.value;
                return _buildCartItemCard(i, item);
              }).toList(),
            ),
    );
  }

  Widget _buildCartItemCard(int index, _CartItem item) {
    final maxQty = _maxQuantity(item.product);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Product Avatar / Thumbnail
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: const Color(0xFF025EA7).withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.inventory_2_outlined, color: Color(0xFF025EA7), size: 20),
          ),
          const SizedBox(width: 12),

          // Name, Stock & Unit Price
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Tooltip(
                  message: item.product.name,
                  child: Text(
                    item.product.name,
                    style: GoogleFonts.outfit(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF0F172A),
                      height: 1.25,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(height: 4),
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    InkWell(
                      onTap: () => _showEditUnitPriceDialog(index, item),
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFF025EA7).withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFF025EA7).withValues(alpha: 0.2)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'ETB ${item.unitPrice.toStringAsFixed(2)} / ${item.product.unit}',
                              style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF025EA7)),
                            ),
                            const SizedBox(width: 4),
                            const Icon(Icons.edit_outlined, size: 13, color: Color(0xFF025EA7)),
                          ],
                        ),
                      ),
                    ),
                    if (_canViewStock)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: item.product.stockQuantity > 0 ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '${item.product.stockQuantity} in stock',
                          style: GoogleFonts.outfit(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: item.product.stockQuantity > 0 ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),

                // Inline Quantity Stepper + Line Total
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _InlineQuantityControl(
                      quantity: item.quantity,
                      maxQuantity: maxQty,
                      compact: true,
                      onMaxExceeded: () {
                        showAppToast(context, context.tr('insufficient_stock'), type: AppToastType.error);
                      },
                      onChanged: (qty) => _updateCartQuantity(index, qty),
                    ),
                    Text(
                      'ETB ${item.totalPrice.toStringAsFixed(2)}',
                      style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: const Color(0xFF025EA7)),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Delete Icon
          IconButton(
            icon: const Icon(Icons.delete_outline, size: 18, color: Color(0xFFDC2626)),
            onPressed: () => _removeFromCart(index),
            tooltip: context.tr('delete'),
          ),
        ],
      ),
    );
  }

  // ── Payment Section ───────────────────────────────────────────────────────
  Widget _buildPaymentSection() {
    return _sectionCard(
      title: context.tr('payment'),
      icon: Icons.account_balance_wallet_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Payment method choices grid/wrap
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _paymentOptions.map((opt) {
              final selected = _paymentType == opt.value;
              return InkWell(
                onTap: () => setState(() => _paymentType = opt.value),
                borderRadius: BorderRadius.circular(10),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: selected ? const Color(0xFF025EA7).withValues(alpha: 0.1) : Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: selected ? const Color(0xFF025EA7) : const Color(0xFFE2E8F0),
                      width: selected ? 1.5 : 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(opt.icon, size: 16, color: selected ? const Color(0xFF025EA7) : const Color(0xFF64748B)),
                      const SizedBox(width: 6),
                      Text(
                        context.tr(opt.labelKey),
                        style: GoogleFonts.outfit(
                          fontSize: 13,
                          fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                          color: selected ? const Color(0xFF025EA7) : const Color(0xFF475569),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),

          // ── Advance Payment (shown for all payment types) ───────────────
          const SizedBox(height: 14),
          TextField(
            controller: _advanceController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            style: GoogleFonts.outfit(fontSize: 14),
            decoration: _inputDeco(
              context.tr('advance_payment'),
              prefix: const Padding(padding: EdgeInsets.only(left: 12, right: 4), child: Text('ETB ', style: TextStyle(color: Color(0xFF64748B)))),
            ),
            onChanged: (_) => setState(() {}),
          ),
          if (_paymentType != 'credit' && _rawAdvanceInput > 0) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFED7AA)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(context.tr('remaining_balance'), style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFFD97706), fontWeight: FontWeight.w600)),
                  Text('ETB ${(_grandTotal - _rawAdvanceInput).clamp(0, double.infinity).toStringAsFixed(2)}', style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFFD97706), fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ],

          // ── Bank Transfer Details ──────────────────────────────────────────
          if (_paymentType == 'bank_transfer') ...[
            const SizedBox(height: 14),
            TextField(
              controller: _referenceController,
              style: GoogleFonts.outfit(fontSize: 14),
              decoration: _inputDeco(
                context.tr('bank_name_reference'),
                prefix: const Icon(
                  Icons.account_balance,
                  size: 18,
                  color: Color(0xFF025EA7),
                ),
              ),
            ),
          ],

          // ── Credit Sale Options ───────────────────────────────────────────
          if (_paymentType == 'credit') ...[
            const SizedBox(height: 14),
            Text(
              context.tr('due_date'),
              style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF475569)),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _dueDateController,
              readOnly: true,
              style: GoogleFonts.outfit(fontSize: 14),
              decoration: _inputDeco(
                context.tr('due_date'),
                prefix: const Icon(Icons.calendar_month, size: 18, color: Color(0xFF025EA7)),
                suffix: const Icon(Icons.arrow_drop_down, color: Color(0xFF94A3B8)),
              ),
              onTap: () async {
                final date = await showDatePicker(
                  context: context,
                  initialDate: DateTime.now().add(const Duration(days: 30)),
                  firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                );
                if (date != null) {
                  setState(() => _dueDateController.text = _formatIsoDate(date));
                }
              },
            ),
            const SizedBox(height: 8),

            // Quick Due Date Shortcuts
            Row(
              children: [
                _dueDateShortcutChip('7 Days', 7),
                const SizedBox(width: 6),
                _dueDateShortcutChip('14 Days', 14),
                const SizedBox(width: 6),
                _dueDateShortcutChip('30 Days', 30),
              ],
            ),
            const SizedBox(height: 12),

            DropdownButtonFormField<int>(
              initialValue: _reminderDaysBefore,
              decoration: _inputDeco(
                context.tr('credit_reminder_timing'),
                prefix: const Icon(Icons.notifications_active_outlined, size: 18, color: Color(0xFF025EA7)),
              ),
              items: _reminderOptions
                  .map((days) => DropdownMenuItem(
                        value: days,
                        child: Text(_reminderOptionLabel(days), style: GoogleFonts.outfit(fontSize: 13.5)),
                      ))
                  .toList(),
              onChanged: _parsedDueDate() == null
                  ? null
                  : (val) => setState(() => _reminderDaysBefore = val ?? 7),
            ),
            if (_computedReminderDate() != null) ...[
              const SizedBox(height: 6),
              Text(
                context.tr('credit_reminder_hint').replaceAll('{date}', _formatDisplayDate(_computedReminderDate()!)),
                style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF64748B)),
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _dueDateShortcutChip(String label, int days) {
    return Expanded(
      child: OutlinedButton(
        onPressed: () {
          final target = DateTime.now().add(Duration(days: days));
          setState(() {
            _dueDateController.text = _formatIsoDate(target);
          });
        },
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: Color(0xFFE2E8F0)),
          padding: const EdgeInsets.symmetric(vertical: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        child: Text(label, style: GoogleFonts.outfit(fontSize: 11.5, color: const Color(0xFF025EA7), fontWeight: FontWeight.w600)),
      ),
    );
  }

  // ── Discount & VAT Section ───────────────────────────────────────────────
  Widget _buildDiscountSection() {
    return _sectionCard(
      title: context.tr('discount'),
      icon: Icons.local_offer_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Without VAT (-15%) Toggle Button
          InkWell(
            onTap: () => setState(() => _withoutVat = !_withoutVat),
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: _withoutVat ? const Color(0xFFF59E0B).withValues(alpha: 0.12) : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: _withoutVat ? const Color(0xFFF59E0B) : const Color(0xFFE2E8F0),
                  width: _withoutVat ? 1.5 : 1,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    _withoutVat ? Icons.check_circle : Icons.percent_outlined,
                    size: 18,
                    color: _withoutVat ? const Color(0xFFD97706) : const Color(0xFF64748B),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _withoutVat ? 'Without VAT (-15% Applied)' : 'Without VAT (-15%)',
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: _withoutVat ? const Color(0xFFB45309) : const Color(0xFF1E293B),
                          ),
                        ),
                        Text(
                          'Reduce total sales price by 15%',
                          style: GoogleFonts.outfit(
                            fontSize: 11,
                            color: const Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Switch(
                    value: _withoutVat,
                    activeThumbColor: const Color(0xFFD97706),
                    activeTrackColor: const Color(0xFFFDE68A),
                    onChanged: (val) => setState(() => _withoutVat = val),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _discountType,
                  decoration: _inputDeco(context.tr('discount')),
                  items: [
                    DropdownMenuItem(value: 'none', child: Text(context.tr('no_discount'), style: GoogleFonts.outfit(fontSize: 13))),
                    DropdownMenuItem(value: 'percentage', child: Text(context.tr('percentage_discount'), style: GoogleFonts.outfit(fontSize: 13))),
                    DropdownMenuItem(value: 'fixed', child: Text(context.tr('fixed_amount_discount'), style: GoogleFonts.outfit(fontSize: 13))),
                  ],
                  onChanged: (val) => setState(() => _discountType = val ?? 'none'),
                ),
              ),
              if (_discountType != 'none') ...[
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _discountValueController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    style: GoogleFonts.outfit(fontSize: 14),
                    decoration: _inputDeco(_discountType == 'percentage' ? 'e.g. 10 %' : 'e.g. 50 ETB'),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  // ── Receipt Section ───────────────────────────────────────────────────────
  Widget _buildReceiptSection() {
    return _sectionCard(
      title: context.tr('receipt_screenshot'),
      icon: Icons.receipt_long_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.tr('attach_receipt_hint'),
            style: GoogleFonts.outfit(fontSize: 12.5, color: const Color(0xFF64748B)),
          ),
          const SizedBox(height: 10),
          if (_receiptImage != null)
            Stack(
              children: [
                Container(
                  height: 160,
                  width: double.infinity,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Image.memory(_receiptImageBytes!, fit: BoxFit.contain, gaplessPlayback: true),
                ),
                Positioned(
                  top: 8,
                  right: 8,
                  child: GestureDetector(
                    onTap: () => setState(() {
                      _receiptImage = null;
                      _receiptImageBytes = null;
                      _receiptImageUrl = null;
                    }),
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.6), shape: BoxShape.circle),
                      child: const Icon(Icons.close, size: 16, color: Colors.white),
                    ),
                  ),
                ),
                if (_uploadingReceipt)
                  Positioned.fill(
                    child: Container(
                      color: Colors.black.withValues(alpha: 0.3),
                      child: const Center(child: CircularProgressIndicator(color: Colors.white)),
                    ),
                  ),
              ],
            )
          else
            Container(
              height: 90,
              width: double.infinity,
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: _uploadingReceipt ? null : _showReceiptSourceSheet,
                child: _uploadingReceipt
                    ? const Center(child: CircularProgressIndicator(color: Color(0xFF025EA7)))
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.cloud_upload_outlined, size: 26, color: Color(0xFF025EA7)),
                          const SizedBox(height: 4),
                          Text(
                            context.tr('tap_to_attach_receipt'),
                            style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w500, color: const Color(0xFF475569)),
                          ),
                        ],
                      ),
              ),
            ),
          if (_receiptImageUrl != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.cloud_done, size: 16, color: Color(0xFF16A34A)),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(context.tr('receipt_uploaded'), style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF16A34A))),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  // ── STICKY SALES SUMMARY BAR (Pinned at bottom) ──────────────────────────
  Widget _buildStickySalesSummaryBar() {
    final canSubmit = _cart.isNotEmpty && !_isSubmitting;

    return Container(
      padding: EdgeInsets.fromLTRB(16, 10, 16, MediaQuery.of(context).padding.bottom + 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle / toggle sheet trigger
          GestureDetector(
            onTap: _showSummaryDetailsSheet,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFCBD5E1),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Visible Products Summary Box in the bottom panel ────────────
          if (_cart.isNotEmpty || _hasPaymentOrDiscountSummary) _buildBottomProductsSummary(),

          // Total Items, Subtotal, Discount & Grand Total Row
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: _showSummaryDetailsSheet,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              context.tr('grand_total'),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF64748B)),
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(Icons.info_outline, size: 14, color: Color(0xFF94A3B8)),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'ETB ${_grandTotal.toStringAsFixed(2)}',
                        style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
                      ),
                      if (_advancePayment > 0) ...[
                        const SizedBox(height: 2),
                        Text(
                          'Advance: ETB ${_advancePayment.toStringAsFixed(2)} · Bal: ETB ${_remainingBalance.toStringAsFixed(2)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF025EA7)),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              ElevatedButton(
                onPressed: canSubmit ? _submitSale : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF025EA7),
                  disabledBackgroundColor: const Color(0xFFCBD5E1),
                  elevation: 2,
                  padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: _isSubmitting
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Row(
                        children: [
                          Text(
                            context.tr('complete_sale'),
                            style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                          const SizedBox(width: 8),
                          const Icon(Icons.arrow_forward, size: 18, color: Colors.white),
                        ],
                      ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBottomProductsSummary() {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.shopping_cart_outlined, size: 16, color: Color(0xFF025EA7)),
              const SizedBox(width: 6),
              Text(
                context.tr('sale_items'),
                style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFF025EA7).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '$_totalItems ${context.tr('items')}',
                  style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.bold, color: const Color(0xFF025EA7)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 110),
            child: SingleChildScrollView(
              child: Column(
                children: _cart.map((item) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2.5),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE2E8F0),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            '${item.quantity}x',
                            style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF334155)),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Tooltip(
                            message: item.product.name,
                            child: Text(
                              item.product.name,
                              style: GoogleFonts.outfit(fontSize: 12.5, color: const Color(0xFF1E293B), height: 1.25),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'ETB ${item.totalPrice.toStringAsFixed(2)}',
                          style: GoogleFonts.outfit(fontSize: 12.5, fontWeight: FontWeight.w600, color: const Color(0xFF0F172A)),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          const Divider(height: 14),
          _summaryRow(context.tr('subtotal'), 'ETB ${_subtotal.toStringAsFixed(2)}'),
          if (_discountType != 'none' && _discountAmount > 0)
            _summaryRow(
              '${context.tr('discount')}${_discountType == 'percentage' ? ' (${_discountValueController.text.trim()}%)' : ''}',
              '-ETB ${_discountAmount.toStringAsFixed(2)}',
              color: const Color(0xFF16A34A),
            ),
          if (_paymentType == 'credit' || _advancePayment > 0) ...[
            _summaryRow(
              context.tr('advance_payment'),
              'ETB ${_advancePayment.toStringAsFixed(2)}',
              color: const Color(0xFF025EA7),
            ),
            _summaryRow(
              context.tr('remaining_balance'),
              'ETB ${_remainingBalance.toStringAsFixed(2)}',
              color: _remainingBalance > 0 ? const Color(0xFFD97706) : const Color(0xFF16A34A),
            ),
          ],
        ],
      ),
    );
  }

  void _showSummaryDetailsSheet() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 16),
            Text(context.tr('order_summary'), style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A))),
            const SizedBox(height: 14),
            _summaryRow(context.tr('total_quantity'), '$_totalItems'),
            _summaryRow(context.tr('subtotal'), 'ETB ${_subtotal.toStringAsFixed(2)}'),
            if (_withoutVat)
              _summaryRow(
                'Without VAT (-15%)',
                '-ETB ${_vatDeduction.toStringAsFixed(2)}',
                color: const Color(0xFFD97706),
              ),
            if (_discountType != 'none' && _discountAmount > 0)
              _summaryRow(
                '${context.tr('discount')}${_discountType == 'percentage' ? ' (${_discountValueController.text.trim()}%)' : ''}',
                '-ETB ${_discountAmount.toStringAsFixed(2)}',
                color: const Color(0xFF16A34A),
              ),
            _summaryRow(context.tr('location'), _locationLabel),
            if (_paymentType == 'credit' || _rawAdvanceInput > 0) ...[
              _summaryRow(
                context.tr('advance_payment'),
                'ETB ${_rawAdvanceInput.toStringAsFixed(2)}',
                color: const Color(0xFF025EA7),
              ),
              _summaryRow(
                context.tr('remaining_balance'),
                'ETB ${(_grandTotal - _rawAdvanceInput).clamp(0, double.infinity).toStringAsFixed(2)}',
                color: (_grandTotal - _rawAdvanceInput) > 0 ? const Color(0xFFD97706) : const Color(0xFF16A34A),
              ),
            ],
            const Divider(height: 24),
            Row(
              children: [
                Text(context.tr('grand_total'), style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A))),
                const Spacer(),
                Text('ETB ${_grandTotal.toStringAsFixed(2)}', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF025EA7))),
              ],
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _summaryRow(String label, String value, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text(label, style: GoogleFonts.outfit(fontSize: 13.5, color: const Color(0xFF64748B))),
          const Spacer(),
          Text(value, style: GoogleFonts.outfit(fontSize: 13.5, fontWeight: FontWeight.w600, color: color ?? const Color(0xFF0F172A))),
        ],
      ),
    );
  }

  // ── Modals & Pickers ──────────────────────────────────────────────────────
  Future<void> _showReceiptSourceSheet() async {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Text(context.tr('attach_receipt'), style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A))),
            const SizedBox(height: 12),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined, color: Color(0xFF025EA7)),
              title: Text(context.tr('choose_from_gallery'), style: GoogleFonts.outfit(fontSize: 14)),
              onTap: () {
                Navigator.pop(ctx);
                _pickReceipt(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined, color: Color(0xFF025EA7)),
              title: Text(context.tr('take_a_photo'), style: GoogleFonts.outfit(fontSize: 14)),
              onTap: () {
                Navigator.pop(ctx);
                _pickReceipt(ImageSource.camera);
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Future<void> _pickReceipt(ImageSource source) async {
    try {
      final file = await _picker.pickImage(source: source, maxWidth: 1600, imageQuality: 80);
      if (file == null || !mounted) return;
      final bytes = await file.readAsBytes();
      setState(() {
        _receiptImage = file;
        _receiptImageBytes = bytes;
        _receiptImageUrl = null;
      });
      await _uploadReceipt(file);
    } catch (e) {
      if (mounted) {
        showAppToast(context, '${context.tr('failed_pick_image')}: $e', type: AppToastType.error);
      }
    }
  }

  Future<void> _uploadReceipt(XFile file) async {
    setState(() => _uploadingReceipt = true);
    try {
      final url = await _saleService.uploadReceipt(file);
      if (mounted) setState(() => _receiptImageUrl = url);
    } catch (e) {
      if (mounted) {
        showAppToast(context, '${context.tr('upload_failed_retry')}: $e', type: AppToastType.error);
      }
    } finally {
      if (mounted) setState(() => _uploadingReceipt = false);
    }
  }

  Future<void> _submitSale() async {
    if (_discountType != 'none') {
      final enteredValue = double.tryParse(_discountValueController.text) ?? 0;
      if (enteredValue > 0) {
        final enteredIsPercent = _discountType == 'percentage';
        String? exceededFor;
        if (enteredIsPercent) {
          // A percentage discount is applied per item, so each item's entered
          // rate must not exceed that product's own discount cap. Caps are
          // scaled by quantity: a 1000 ETB cap on 4 units allows 4 x 1000.
          for (final item in _cart) {
            final cap = double.tryParse(item.product.metadata['discount']?.toString() ?? '0') ?? 0;
            if (cap <= 0) continue;
            final capIsPercent = (item.product.metadata['discountType'] as String?) != 'fixed';
            final maxAmount = capIsPercent ? (item.totalPrice * cap) / 100 : cap * item.quantity;
            final enteredAmount = (item.totalPrice * enteredValue) / 100;
            if (enteredAmount > maxAmount) {
              exceededFor = item.product.name;
              break;
            }
          }
        } else {
          // A fixed (ETB) discount applies once to the whole sale, so it may be
          // at most the sum of every product's allowed cap (converted to ETB),
          // each cap scaled by the quantity being sold.
          double allowedTotal = 0;
          for (final item in _cart) {
            final cap = double.tryParse(item.product.metadata['discount']?.toString() ?? '0') ?? 0;
            if (cap <= 0) continue;
            final capIsPercent = (item.product.metadata['discountType'] as String?) != 'fixed';
            allowedTotal += capIsPercent ? (item.totalPrice * cap) / 100 : cap * item.quantity;
          }
          if (enteredValue > allowedTotal) {
            showAppToast(
              context,
              '${context.tr('discount')} $enteredValue ETB ${context.tr('discount_exceeds_allowed_total')}',
              type: AppToastType.error,
            );
            return;
          }
        }
        if (exceededFor != null) {
          showAppToast(
            context,
            '${context.tr('discount')} $enteredValue% ${context.tr('exceeds_product_discount')} $exceededFor',
            type: AppToastType.error,
          );
          return;
        }
      }
    }

    if (_selectedCustomerId == null && _selectedCustomerName.isNotEmpty && !_walkInCustomer) {
      try {
        final payload = <String, dynamic>{
          'name': _selectedCustomerName,
          'address': _newCustomerAddressController.text.trim().isEmpty
              ? null
              : _newCustomerAddressController.text.trim(),
        };
        final phone = _newCustomerPhoneController.text.trim();
        if (phone.isNotEmpty) payload['phoneNumber'] = PhoneUtil.toTenDigit(phone);

        final newCust = await _customerService.create(payload);
        _selectedCustomerId = newCust.id;
        _customers.add(newCust);
      } catch (e) {
        if (mounted) {
          showAppToast(context, '${context.tr('failed_create_customer')}: $e', type: AppToastType.error);
        }
        return;
      }
    }

    if (!mounted) return;

    setState(() => _isSubmitting = true);

    final payload = <String, dynamic>{
      'items': _cart.map((item) => {
        'productId': item.product.id,
        'quantity': item.quantity,
        'unitPrice': _withoutVat ? (item.unitPrice * 0.85) : item.unitPrice,
      }).toList(),
      'paymentType': _paymentType,
    };
    if (_withoutVat) {
      payload['note'] = 'Sale processed without VAT (15% reduction applied)';
    }

    if (_isValidUuid(_selectedCustomerId)) {
      payload['customerId'] = _selectedCustomerId;
    }

    final authBloc = context.read<AuthBloc>();
    final user = authBloc.user;
    if (_isValidUuid(user?.id)) payload['createdBy'] = user!.id;

    if (_selectedLocation != null) {
      if (_selectedLocation!.isWarehouse) {
        payload['warehouseId'] = _selectedLocation!.id;
      } else {
        payload['shopId'] = _selectedLocation!.id;
      }
    } else {
      final branchProvider = context.read<BranchProvider>();
      String? shopId = _isValidUuid(user?.shopId) ? user!.shopId : null;
      shopId ??= branchProvider.shops.where((s) => _isValidUuid(s.id)).firstOrNull?.id;

      String? warehouseId = _isValidUuid(user?.warehouseId) ? user!.warehouseId : null;
      warehouseId ??= branchProvider.warehouses.where((w) => _isValidUuid(w.id)).firstOrNull?.id;

      if (shopId != null) {
        payload['shopId'] = shopId;
      } else if (warehouseId != null) {
        payload['warehouseId'] = warehouseId;
      }
    }

    final advancePaid = _rawAdvanceInput;
    if (advancePaid > 0) {
      payload['advancePayment'] = advancePaid;
    }
    if (_paymentType == 'credit') {
      payload['paymentType'] = 'credit';
      final dueDate = _parsedDueDate() ?? DateTime.now().add(const Duration(days: 30));
      payload['dueDate'] = dueDate.toIso8601String();
      final reminder = _computedReminderDate() ?? dueDate.subtract(Duration(days: _reminderDaysBefore));
      payload['reminderDate'] = reminder.toIso8601String();
    }
    if (_paymentType == 'bank_transfer' && _referenceController.text.isNotEmpty) {
      payload['referenceNumber'] = _referenceController.text.trim();
    }
    if (_discountType != 'none') {
      payload['discountType'] = _discountType == 'percentage' ? 'percentage' : 'fixed';
      payload['discountRate'] = double.tryParse(_discountValueController.text) ?? 0;
    }

    if (_receiptImage != null) {
      if (_receiptImageUrl == null) {
        try {
          _receiptImageUrl = await _saleService.uploadReceipt(_receiptImage!);
        } catch (e) {
          if (mounted) {
            showAppToast(context, '${context.tr('receipt_upload_failed')}: $e', type: AppToastType.error);
          }
          setState(() => _isSubmitting = false);
          return;
        }
      }
      payload['receiptImageUrl'] = _receiptImageUrl;
    }

    if (!mounted) return;

    try {
      final saleBloc = context.read<SaleBloc>();
      saleBloc.add(SaleCreateRequested(data: payload));
      final result = await saleBloc.stream.firstWhere((s) => !s.isLoading);
      if (!mounted) return;
      if (result.lastActionSuccess == true) {
        context.read<BankAccountProvider>().addSaleIncome(_grandTotal);
        context.read<ProductBloc>().add(const ProductsLoadRequested());
        if (_selectedLocation != null) {
          final loaded = await _loadProductsForLocation(_selectedLocation);
          if (mounted) _products = loaded;
        }
        if (mounted) {
          showAppToast(context, context.tr('sale_completed'), type: AppToastType.success);
          Navigator.pop(context);
        }
      } else {
        showAppToast(context, result.error ?? context.tr('failed_create_sale'), type: AppToastType.error);
      }
    } catch (e) {
      if (mounted) showAppToast(context, '${context.tr('error')}: $e', type: AppToastType.error);
    }
    if (mounted) setState(() => _isSubmitting = false);
  }

  Future<void> _showCustomerPicker() async {
    try {
      final customers = await _customerService.getAll();
      if (!mounted) return;
      setState(() => _customers = customers);
    } catch (_) {}
    if (!mounted) return;
    final searchCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            final q = searchCtrl.text.toLowerCase();
            final filtered = _customers.where((c) {
              final phone = c.phoneNumber ?? '';
              return c.name.toLowerCase().contains(q) || phone.toLowerCase().contains(q);
            }).toList();
            return DraggableScrollableSheet(
              initialChildSize: 0.75, minChildSize: 0.4, maxChildSize: 0.95, expand: false,
              builder: (_, scrollCtrl) => Column(
                children: [
                  Container(margin: const EdgeInsets.only(top: 10), width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(2))),
                  Padding(padding: const EdgeInsets.fromLTRB(20, 14, 20, 0), child: Text(context.tr('select_customer'), style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)))),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                    child: TextField(
                      controller: searchCtrl, autofocus: true, style: GoogleFonts.outfit(fontSize: 14),
                      decoration: _inputDeco(context.tr('search_name_phone'), prefix: const Icon(Icons.search, color: Color(0xFF94A3B8), size: 20)),
                      onChanged: (_) => setModalState(() {}),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: filtered.isEmpty
                        ? Center(child: Text(context.tr('no_customers_found'), style: GoogleFonts.outfit(color: const Color(0xFF94A3B8))))
                        : ListView.separated(
                            controller: scrollCtrl, itemCount: filtered.length,
                            separatorBuilder: (_, __) => const Divider(height: 1, indent: 20, endIndent: 20),
                            itemBuilder: (_, i) {
                              final c = filtered[i];
                              return ListTile(
                                contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                                leading: CircleAvatar(
                                  radius: 18,
                                  backgroundColor: const Color(0xFFF1F5F9),
                                  child: Text(c.name.isNotEmpty ? c.name[0].toUpperCase() : '?',
                                      style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF64748B))),
                                ),
                                title: Text(c.name, style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w500, color: const Color(0xFF0F172A))),
                                subtitle: Text(c.displayPhone, style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF64748B))),
                                onTap: () {
                                  setState(() {
                                    _selectedCustomerId = c.id;
                                    _selectedCustomerName = c.name;
                                    _showNewCustomerForm = false;
                                    _walkInCustomer = false;
                                  });
                                  Navigator.pop(ctx);
                                },
                              );
                            },
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

  Future<void> _showProductPicker() async {
    await _refreshProducts();
    if (!mounted) return;
    final searchCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            final q = searchCtrl.text.toLowerCase();
            final filtered = _products.where((p) {
              return p.name.toLowerCase().contains(q) || p.sku.toLowerCase().contains(q) || p.barcode?.toLowerCase().contains(q) == true;
            }).toList();
            return DraggableScrollableSheet(
              initialChildSize: 0.85, minChildSize: 0.5, maxChildSize: 0.95, expand: false,
              builder: (_, scrollCtrl) => Column(
                children: [
                  Container(margin: const EdgeInsets.only(top: 10), width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(2))),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
                    child: Row(
                      children: [
                        Text(context.tr('add_products'), style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A))),
                        const Spacer(),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF025EA7),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          onPressed: () => Navigator.pop(ctx),
                          child: Text(_cart.isEmpty ? context.tr('close') : '${context.tr('done')} (${_cart.length})', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                    child: TextField(
                      controller: searchCtrl, autofocus: true, style: GoogleFonts.outfit(fontSize: 14),
                      decoration: _inputDeco(context.tr('search_name_sku_barcode'),
                        prefix: const Icon(Icons.search, color: Color(0xFF94A3B8), size: 20),
                        suffix: IconButton(
                          icon: const Icon(Icons.qr_code_scanner, color: Color(0xFF025EA7), size: 20),
                          onPressed: () {
                            Navigator.pop(ctx);
                            _scanBarcode();
                          },
                        ),
                      ),
                      onChanged: (_) => setModalState(() {}),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: filtered.isEmpty
                        ? Center(child: Text(context.tr('no_products_found'), style: GoogleFonts.outfit(color: const Color(0xFF94A3B8))))
                        : ListView.separated(
                            controller: scrollCtrl, itemCount: filtered.length,
                            separatorBuilder: (_, __) => const Divider(height: 1, indent: 20, endIndent: 20),
                            itemBuilder: (_, i) {
                              final p = filtered[i];
                              final cartIndex = _cart.indexWhere((item) => item.product.id == p.id);
                              final item = cartIndex >= 0 ? _cart[cartIndex] : null;

                              return ListTile(
                                isThreeLine: true,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                                horizontalTitleGap: 12,
                                onTap: _canAddProduct(p) && item == null
                                    ? () {
                                        _addToCart(p);
                                        setModalState(() {});
                                        setState(() {});
                                      }
                                    : null,
                                leading: Container(
                                  width: 42, height: 42,
                                  decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(10)),
                                  child: const Icon(Icons.inventory_2_outlined, color: Color(0xFF025EA7), size: 22),
                                ),
                                title: Tooltip(
                                  message: p.name,
                                  child: Text(
                                    p.name,
                                    style: GoogleFonts.outfit(
                                      fontSize: 14.5,
                                      fontWeight: FontWeight.w600,
                                      color: const Color(0xFF0F172A),
                                      height: 1.25,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                subtitle: Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Wrap(
                                        crossAxisAlignment: WrapCrossAlignment.center,
                                        spacing: 6,
                                        runSpacing: 4,
                                        children: [
                                          Text.rich(
                                            TextSpan(
                                              children: [
                                                TextSpan(text: '${p.unit}  ·  ', style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF64748B))),
                                                TextSpan(text: 'ETB ${p.price.toStringAsFixed(2)}', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF025EA7))),
                                              ],
                                            ),
                                          ),
                                          if (_canViewStock)
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: p.stockQuantity > 0 ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2),
                                                borderRadius: BorderRadius.circular(4),
                                              ),
                                              child: Text(
                                                '${p.stockQuantity} in stock',
                                                style: GoogleFonts.outfit(
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.w600,
                                                  color: p.stockQuantity > 0 ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                                                ),
                                              ),
                                            ),
                                        ],
                                      ),
                                      if (p.sku.isNotEmpty) ...[
                                        const SizedBox(height: 2),
                                        Text(
                                          'SKU: ${p.sku}',
                                          style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF94A3B8)),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                trailing: _canAddProduct(p)
                                    ? (item != null
                                        ? _InlineQuantityControl(
                                            quantity: item.quantity,
                                            maxQuantity: _maxQuantity(p),
                                            compact: true,
                                            onMaxExceeded: () {
                                              showAppToast(context, context.tr('insufficient_stock'), type: AppToastType.error);
                                            },
                                            onChanged: (qty) {
                                              if (qty <= 0) {
                                                _removeFromCart(cartIndex);
                                              } else {
                                                _updateCartQuantity(cartIndex, qty);
                                              }
                                              setModalState(() {});
                                              setState(() {});
                                            },
                                          )
                                        : ElevatedButton.icon(
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: const Color(0xFFF1F5F9),
                                              foregroundColor: const Color(0xFF025EA7),
                                              elevation: 0,
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                                            ),
                                            icon: const Icon(Icons.add, size: 16),
                                            label: Text(context.tr('add'), style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600)),
                                            onPressed: () {
                                              _addToCart(p);
                                              setModalState(() {});
                                              setState(() {});
                                            },
                                          ))
                                    : null,
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    ).then((_) {
      if (mounted) setState(() {});
    });
  }

  Widget _sectionCard({required String title, required IconData icon, Widget? action, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: const Color(0xFF025EA7)),
              const SizedBox(width: 8),
              Text(
                title,
                style: GoogleFonts.outfit(fontSize: 14.5, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
              ),
              if (action != null) ...[
                const Spacer(),
                action,
              ],
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _SaleLocation {
  final String id;
  final String name;
  final bool isWarehouse;

  const _SaleLocation({required this.id, required this.name, required this.isWarehouse});

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is _SaleLocation && id == other.id && isWarehouse == other.isWarehouse;

  @override
  int get hashCode => Object.hash(id, isWarehouse);
}

class _InlineQuantityControl extends StatefulWidget {
  final int quantity;
  final int maxQuantity;
  final ValueChanged<int> onChanged;
  final bool compact;
  final VoidCallback? onMaxExceeded;

  const _InlineQuantityControl({
    required this.quantity,
    required this.maxQuantity,
    required this.onChanged,
    this.compact = false,
    this.onMaxExceeded,
  });

  @override
  State<_InlineQuantityControl> createState() => _InlineQuantityControlState();
}

class _InlineQuantityControlState extends State<_InlineQuantityControl> {
  late TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: '${widget.quantity}');
  }

  @override
  void didUpdateWidget(_InlineQuantityControl oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.quantity != oldWidget.quantity && _controller.text != '${widget.quantity}') {
      _controller.text = '${widget.quantity}';
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _apply(int qty) {
    if (qty <= 0) {
      widget.onChanged(0);
      return;
    }
    if (qty > widget.maxQuantity) {
      widget.onMaxExceeded?.call();
    }
    widget.onChanged(qty.clamp(1, widget.maxQuantity));
  }

  void _commitField() {
    final parsed = int.tryParse(_controller.text.trim());
    if (parsed != null) {
      _apply(parsed);
    } else if (_controller.text.trim().isNotEmpty) {
      _controller.text = '${widget.quantity}';
    }
  }

  @override
  Widget build(BuildContext context) {
    final btnSize = widget.compact ? 32.0 : 38.0;
    final fieldWidth = widget.compact ? 42.0 : 48.0;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        _QtyButton(
          icon: Icons.remove,
          size: btnSize,
          onTap: () => _apply(widget.quantity - 1),
        ),
        const SizedBox(width: 4),
        SizedBox(
          width: fieldWidth,
          height: btnSize,
          child: TextField(
            controller: _controller,
            textAlign: TextAlign.center,
            keyboardType: TextInputType.number,
            style: GoogleFonts.outfit(
              fontSize: widget.compact ? 13 : 15,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF0F172A),
            ),
            decoration: InputDecoration(
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 6),
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF025EA7), width: 1.5)),
            ),
            onChanged: (value) {
              final parsed = int.tryParse(value.trim());
              if (parsed != null && parsed > 0) {
                _apply(parsed);
              }
            },
            onSubmitted: (_) => _commitField(),
            onEditingComplete: _commitField,
            onTapOutside: (_) => _commitField(),
          ),
        ),
        const SizedBox(width: 4),
        _QtyButton(
          icon: Icons.add,
          size: btnSize,
          onTap: () => _apply(widget.quantity + 1),
        ),
      ],
    );
  }
}

class _QtyButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final double size;

  const _QtyButton({required this.icon, required this.onTap, required this.size});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF025EA7).withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: SizedBox(
          width: size,
          height: size,
          child: Icon(icon, size: size * 0.5, color: const Color(0xFF025EA7)),
        ),
      ),
    );
  }
}

class _CartItem {
  final ProductModel product;
  final int quantity;
  final double unitPrice;

  _CartItem({
    required this.product,
    required this.quantity,
    double? unitPrice,
  }) : unitPrice = unitPrice ?? product.price;

  double get totalPrice => unitPrice * quantity;
}

class _PayOpt {
  final String value;
  final String labelKey;
  final IconData icon;
  const _PayOpt(this.value, this.labelKey, this.icon);
}
