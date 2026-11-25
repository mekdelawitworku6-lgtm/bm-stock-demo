import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:provider/provider.dart';
import '../../core/bloc/auth/auth_bloc.dart';
import '../../core/bloc/product/product_bloc.dart';
import '../../core/permissions/app_permissions.dart';
import '../../core/providers/branch_provider.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/bulk_draft_store.dart';
import '../../core/services/product_service.dart';
import '../../core/utils/branch_access_helper.dart';
import '../../core/utils/product_status_helper.dart';
import '../../core/widgets/app_toast.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kRed = Color(0xFFDC2626);
const _kGreen = Color(0xFF16A34A);

const _units = [
  'piece', 'kg', 'g', 'mg', 'lb', 'oz',
  'liter', 'ml', 'gal',
  'box', 'pack', 'pair', 'set', 'roll', 'bag', 'bottle', 'can',
];

class _RowData {
  final Map<String, dynamic> data;
  bool selected = false;
  _RowData(this.data);
}

class _LocationOption {
  final String id;
  final String name;
  final bool isWarehouse;
  const _LocationOption({required this.id, required this.name, required this.isWarehouse});

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is _LocationOption && id == other.id && isWarehouse == other.isWarehouse;

  @override
  int get hashCode => Object.hash(id, isWarehouse);
}

class BulkProductsScreen extends StatefulWidget {
  final String? warehouseId;
  final List<Map<String, dynamic>>? initialRows;
  final String? initialLocationId;
  final bool? initialIsWarehouse;
  const BulkProductsScreen({
    super.key,
    this.warehouseId,
    this.initialRows,
    this.initialLocationId,
    this.initialIsWarehouse,
  });

  @override
  State<BulkProductsScreen> createState() => _BulkProductsScreenState();
}

class _BulkProductsScreenState extends State<BulkProductsScreen> {
  List<_RowData> _rows = [];
  bool _saving = false;
  bool _draftLoaded = false;
  final List<TextEditingController> _controllers = [];
  final List<FocusNode> _focusNodes = [];
  bool _disposed = false;
  _LocationOption? _selectedLocation;

  // Searchable picker source data
  final Map<String, List<String>> _categoryOptions = {};
  final Map<String, List<String>> _brandOptions = {};
  final Map<String, String> _supplierNames = {};

  int get _columns => 13;

  @override
  void initState() {
    super.initState();
    if (widget.initialRows != null && widget.initialRows!.isNotEmpty) {
      _loadInitialRows(widget.initialRows!);
    } else {
      _loadDraft();
    }
    _loadReferenceData();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authBloc = context.read<AuthBloc>();
      final companyId = authBloc.user?.companyId;
      context.read<BranchProvider>().loadBranches(companyId: companyId, showLoading: false);
    });
  }

  void _loadInitialRows(List<Map<String, dynamic>> initial) {
    setState(() {
      _rows = initial.map((e) => _RowData(Map<String, dynamic>.from(e))).toList();
      _syncControllers();
      _draftLoaded = true;
      _persistDraft();
    });
  }

  @override
  void dispose() {
    _disposed = true;
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  Future<void> _loadReferenceData() async {
    try {
      final products = await ProductService().getAll();
      if (_disposed) return;
      final cats = <String, List<String>>{};
      final brands = <String, List<String>>{};
      for (final p in products) {
        if (p.category.isNotEmpty) {
          cats.putIfAbsent(p.category, () => []);
          if (!cats[p.category]!.contains(p.name)) cats[p.category]!.add(p.name);
        }
        final b = (p.metadata['brand'] ?? '').toString().trim();
        if (b.isNotEmpty) {
          brands.putIfAbsent(b, () => []);
          if (!brands[b]!.contains(p.name)) brands[b]!.add(p.name);
        }
      }
      setState(() {
        _categoryOptions.clear();
        _categoryOptions.addAll(cats);
        _brandOptions.clear();
        _brandOptions.addAll(brands);
      });
    } catch (_) {}
  }

  Future<void> _loadDraft() async {
    final draft = await BulkDraftStore.load();
    if (_disposed) return;
    if (draft.isNotEmpty) {
      setState(() {
        _rows = draft.map((e) => _RowData(Map<String, dynamic>.from(e))).toList();
        _syncControllers();
        _draftLoaded = true;
      });
    }
  }

  void _syncControllers() {
    final desiredCount = _rows.length * _columns;
    while (_controllers.length < desiredCount) {
      _controllers.add(TextEditingController());
      _focusNodes.add(FocusNode());
    }
    while (_controllers.length > desiredCount) {
      _controllers.last.dispose();
      _focusNodes.last.dispose();
      _controllers.removeLast();
      _focusNodes.removeLast();
    }
    for (var r = 0; r < _rows.length; r++) {
      for (var c = 0; c < _columns; c++) {
        final val = (_rows[r].data[_colKey(c)] ?? '').toString();
        if (_controller(r, c).text != val) {
          _controller(r, c).text = val;
        }
      }
    }
  }

  TextEditingController _controller(int row, int col) => _controllers[row * _columns + col];

  FocusNode _focus(int row, int col) => _focusNodes[row * _columns + col];

  void _addRow({_RowData? template}) {
    setState(() {
      _rows.add(_RowData(template != null
          ? Map<String, dynamic>.from(template.data)
          : {
              'name': '',
              'sku': '',
              'barcode': '',
              'category': '',
              'brand': '',
              'unit': 'piece',
              'cost': '',
              'price': '',
              'stock': '',
              'minStock': '',
              'expiryDate': '',
              'supplier': '',
              'status': 'active',
            }));
      _syncControllers();
      _persistDraft();
    });
  }

  void _duplicateSelected() {
    final selected = _rows.where((r) => r.selected).toList();
    if (selected.isEmpty) return;
    setState(() {
      for (final r in selected) {
        final copy = _RowData(Map<String, dynamic>.from(r.data));
        copy.selected = false;
        _rows.insert(_rows.indexOf(r) + 1, copy);
      }
      _syncControllers();
      _persistDraft();
    });
  }

  void _deleteSelected() {
    setState(() {
      _rows.removeWhere((r) => r.selected);
      _syncControllers();
      _persistDraft();
    });
  }

  void _selectAll(bool value) {
    setState(() {
      for (final r in _rows) {
        r.selected = value;
      }
    });
  }

  Future<void> _persistDraft() async {
    await BulkDraftStore.save(_rows.map((r) => r.data).toList());
  }

  Future<void> _pasteFromClipboard() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    if (data == null || data.text == null || data.text!.trim().isEmpty) return;
    final text = data.text!.trim();
    final lines = text.split('\n').where((l) => l.trim().isNotEmpty).toList();
    if (lines.isEmpty) return;

    final targetRow = _rows.indexWhere((r) => r.selected) != -1
        ? _rows.indexWhere((r) => r.selected)
        : 0;

    setState(() {
      for (var i = 0; i < lines.length; i++) {
        final cells = lines[i].split('\t');
        final rowIndex = targetRow + i;
        while (rowIndex >= _rows.length) {
          _addRow();
        }
        final row = _rows[rowIndex];
        final mapping = <String, String>{
          'name': cells.length > 0 ? cells[0].trim() : '',
          'sku': cells.length > 1 ? cells[1].trim() : '',
          'barcode': cells.length > 2 ? cells[2].trim() : '',
          'category': cells.length > 3 ? cells[3].trim() : '',
          'brand': cells.length > 4 ? cells[4].trim() : '',
          'unit': cells.length > 5 ? cells[5].trim() : '',
          'cost': cells.length > 6 ? cells[6].trim() : '',
          'price': cells.length > 7 ? cells[7].trim() : '',
          'stock': cells.length > 8 ? cells[8].trim() : '',
          'minStock': cells.length > 9 ? cells[9].trim() : '',
          'expiryDate': cells.length > 10 ? cells[10].trim() : '',
          'supplier': cells.length > 11 ? cells[11].trim() : '',
          'status': cells.length > 12 ? cells[12].trim() : 'active',
        };
        row.data.addAll(mapping);
      }
      _syncControllers();
      _persistDraft();
    });

    showAppToast(context, context.tr('paste_success'), type: AppToastType.success);
  }

  String _autoSku(int row) {
    final timestamp = DateTime.now().millisecondsSinceEpoch.toString().substring(0, 8);
    final random = Random().nextInt(900) + 100;
    return 'PRD-$timestamp$random';
  }

  void _generateSkuForRow(int row) {
    setState(() {
      final sku = _autoSku(row);
      _rows[row].data['sku'] = sku;
      _controller(row, 1).text = sku;
    });
  }

  List<int> _validateRows() {
    final errors = <int>[];
    for (var i = 0; i < _rows.length; i++) {
      final name = (_rows[i].data['name'] ?? '').toString().trim();
      final price = (_rows[i].data['price'] ?? '').toString().trim();
      if (name.isEmpty) {
        errors.add(i);
        continue;
      }
      if (price.isNotEmpty && double.tryParse(price.replaceAll(RegExp(r'[^0-9.]'), '')) == null) {
        errors.add(i);
      }
    }
    return errors;
  }

  Future<void> _saveAll() async {
    final authUser = context.read<AuthBloc>().user;
    if (authUser != null && !authUser.isAdmin) {
      if (!authUser.canViewModule(ModuleKeys.addProduct) && !authUser.canViewModule(ModuleKeys.products)) {
        showAppToast(context, context.tr('permission_denied'), type: AppToastType.error);
        return;
      }
    }

    final errors = _validateRows();
    if (errors.isNotEmpty) {
      showAppToast(context, context.tr('row_errors'), type: AppToastType.error);
      return;
    }

    final validRows = _rows.where((r) => (r.data['name'] ?? '').toString().trim().isNotEmpty).toList();
    if (validRows.isEmpty) {
      showAppToast(context, context.tr('no_rows_to_save'), type: AppToastType.error);
      return;
    }

    setState(() => _saving = true);
    var successCount = 0;

    for (final row in validRows) {
      final data = row.data;
      final payload = <String, dynamic>{
        'name': (data['name'] ?? '').toString().trim(),
        'unit': (data['unit'] ?? '').toString().trim().isEmpty ? 'piece' : (data['unit'] ?? '').toString().trim(),
        'category': (data['category'] ?? '').toString().trim().isEmpty ? 'General' : (data['category'] ?? '').toString().trim(),
        'price': double.tryParse((data['price'] ?? '').toString().replaceAll(RegExp(r'[^0-9.]'), '')) ?? 0,
        'type': 'product',
        'trackStock': true,
      };
      if ((data['sku'] ?? '').toString().trim().isNotEmpty) payload['sku'] = data['sku'].toString().trim();
      if ((data['barcode'] ?? '').toString().trim().isNotEmpty) payload['barcode'] = data['barcode'].toString().trim();
      if ((data['cost'] ?? '').toString().trim().isNotEmpty) {
        payload['cost'] = double.tryParse(data['cost'].toString().replaceAll(RegExp(r'[^0-9.]'), '')) ?? 0;
      }
      if ((data['stock'] ?? '').toString().trim().isNotEmpty) {
        payload['stockQuantity'] = int.tryParse(data['stock'].toString().replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
      }
      if ((data['minStock'] ?? '').toString().trim().isNotEmpty) {
        payload['minStockLevel'] = int.tryParse(data['minStock'].toString().replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
      }
      if ((data['expiryDate'] ?? '').toString().trim().isNotEmpty) {
        payload['expiryDate'] = data['expiryDate'].toString().trim();
      }
      final metadata = <String, dynamic>{};
      if ((data['brand'] ?? '').toString().trim().isNotEmpty) metadata['brand'] = data['brand'].toString().trim();
      if ((data['status'] ?? '').toString().trim().isNotEmpty) {
        payload['status'] = ProductStatusHelper.normalizeImportValue('${data['status'] ?? ''}');
      }
      if (_selectedLocation != null) {
        if (_selectedLocation!.isWarehouse) {
          payload['warehouseIds'] = [_selectedLocation!.id];
        } else {
          payload['shopIds'] = [_selectedLocation!.id];
        }
      } else if (widget.warehouseId != null) {
        payload['warehouseIds'] = [widget.warehouseId];
      }

      try {
        await ProductService().create(payload);
        successCount++;
      } catch (_) {}
    }

    context.read<ProductBloc>().add(const ProductsLoadRequested());
    await BulkDraftStore.clear();
    if (!mounted) return;
    setState(() => _saving = false);

    final locName = _selectedLocation?.name ??
        (widget.warehouseId != null ? 'Warehouse' : context.tr('all_locations'));

    if (successCount > 0) {
      showAppToast(
        context,
        '${context.tr('import_successful').replaceFirst('{count}', '$successCount')} ($locName)',
        type: AppToastType.success,
      );
    } else {
      showAppToast(
        context,
        context.tr('import_failed'),
        type: AppToastType.error,
      );
    }
    Navigator.pop(context, true);
  }

  Future<void> _exportTemplate() async {
    try {
      await _exportCsvTemplate();
      if (!mounted) return;
      showAppToast(context, context.tr('template_downloaded'), type: AppToastType.success);
    } catch (e) {
      if (!mounted) return;
      showAppToast(context, '${context.tr('template_error')}: $e', type: AppToastType.error);
    }
  }

  Future<void> _exportCsvTemplate() async {
    final service = ProductService();
    final headers = ['name', 'sku', 'barcode', 'category', 'brand', 'unit', 'cost', 'price', 'stockQuantity', 'minStockLevel', 'expiryDate', 'supplier', 'status'];
    await service.exportTemplate(headers);
  }

  Future<void> _pickCellOption(int row, int col, List<String> options) async {
    final current = (_rows[row].data[_colKey(col)] ?? '').toString();
    final picked = await _showPickerSheet(
      title: _colLabel(col),
      options: options,
      current: current,
      freeText: true,
    );
    if (picked != null && mounted) {
      setState(() {
        _rows[row].data[_colKey(col)] = picked;
        _controller(row, col).text = picked;
        _persistDraft();
      });
    }
  }

  Future<String?> _showPickerSheet({
    required String title,
    required List<String> options,
    required String current,
    bool freeText = false,
  }) async {
    String query = '';
    final controller = TextEditingController(text: current);
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) => Container(
          height: MediaQuery.of(sheetContext).size.height * 0.7,
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Row(
                  children: [
                    Text(title, style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: _kInk)),
                    const Spacer(),
                    IconButton(onPressed: () => Navigator.pop(sheetContext), icon: const Icon(Icons.close, color: _kSlate)),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: TextField(
                  controller: controller,
                  autofocus: true,
                  onChanged: (v) => setSheetState(() => query = v.toLowerCase()),
                  decoration: InputDecoration(
                    hintText: context.tr('search'),
                    hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 14),
                    prefixIcon: const Icon(Icons.search, color: Color(0xFF94A3B8), size: 20),
                    filled: true,
                    fillColor: _kBg,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              if (freeText)
                ListTile(
                  dense: true,
                  leading: const Icon(Icons.add, color: _kBlue),
                  title: Text(controller.text.trim().isEmpty ? context.tr('type_new') : context.tr('use_value'), style: GoogleFonts.outfit(fontSize: 14, color: _kBlue, fontWeight: FontWeight.w600)),
                  onTap: () => Navigator.pop(sheetContext, controller.text.trim().isEmpty ? null : controller.text.trim()),
                ),
              const SizedBox(height: 4),
              Expanded(
                child: ListView(
                  children: options.where((o) {
                    if (query.isEmpty) return true;
                    return o.toLowerCase().contains(query);
                  }).map((o) {
                    return ListTile(
                      dense: true,
                      leading: Icon(o == current ? Icons.check_circle : Icons.circle_outlined, color: o == current ? _kBlue : const Color(0xFFCBD5E1), size: 20),
                      title: Text(o, style: GoogleFonts.outfit(fontSize: 14, color: _kInk)),
                      onTap: () => Navigator.pop(sheetContext, o),
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    return picked;
  }

  String _colKey(int col) {
    const keys = ['name', 'sku', 'barcode', 'category', 'brand', 'unit', 'cost', 'price', 'stock', 'minStock', 'expiryDate', 'supplier', 'status'];
    return keys[col];
  }

  String _colLabel(int col) {
    const labels = [
      'product_name', 'sku', 'barcode', 'category', 'brand', 'unit_col',
      'purchase_price', 'selling_price', 'stock_quantity', 'min_stock_level',
      'expiry_date', 'supplier', 'status',
    ];
    return context.tr(labels[col]);
  }

  List<String> _unitOptions() => _units;

  bool _isPickerCol(int col) => col == 3 || col == 4 || col == 5 || col == 11 || col == 12;

  Future<void> _pickExpiryDateForRow(int row) async {
    final current = (_rows[row].data['expiryDate'] ?? '').toString().trim();
    DateTime initial = DateTime.now().add(const Duration(days: 365));
    if (current.isNotEmpty) {
      final parsed = DateTime.tryParse(current);
      if (parsed != null) initial = parsed;
    }
    final date = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365 * 10)),
    );
    if (date != null && mounted) {
      final formatted = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
      setState(() {
        _rows[row].data['expiryDate'] = formatted;
        _controller(row, 10).text = formatted;
        _persistDraft();
      });
    }
  }

  Widget _buildLocationHeader() {
    final authUser = context.watch<AuthBloc>().user;
    final branchProvider = context.watch<BranchProvider>();
    final accWarehouses = BranchAccessHelper.accessibleWarehouses(authUser, branchProvider.warehouses);
    final accShops = BranchAccessHelper.accessibleShops(authUser, branchProvider.shops);
    final locations = <_LocationOption>[];
    for (final w in accWarehouses) {
      locations.add(_LocationOption(id: w.id, name: 'Warehouse · ${w.name}', isWarehouse: true));
    }
    for (final s in accShops) {
      locations.add(_LocationOption(id: s.id, name: 'Shop · ${s.name}', isWarehouse: false));
    }

    final effectiveLocId = widget.initialLocationId ?? widget.warehouseId;
    if (effectiveLocId != null && _selectedLocation == null && locations.isNotEmpty) {
      _selectedLocation = locations.where((l) => l.id == effectiveLocId && l.isWarehouse == (widget.initialIsWarehouse ?? (widget.warehouseId != null ? true : true))).firstOrNull ?? locations.first;
    }

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        decoration: BoxDecoration(
          color: _kBg,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: _kBorder),
        ),
        child: Row(
          children: [
            const Icon(Icons.storefront_outlined, color: _kBlue, size: 20),
            const SizedBox(width: 8),
            Text(
              '${context.tr('target_location')}:',
              style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: DropdownButtonHideUnderline(
                child: DropdownButton<_LocationOption?>(
                  isExpanded: true,
                  value: _selectedLocation,
                  hint: Text(context.tr('all_locations'), style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
                  items: [
                    DropdownMenuItem<_LocationOption?>(
                      value: null,
                      child: Text(context.tr('all_locations'), style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
                    ),
                    ...locations.map((loc) => DropdownMenuItem<_LocationOption?>(
                      value: loc,
                      child: Text(loc.name, style: GoogleFonts.outfit(fontSize: 13, color: _kInk, fontWeight: FontWeight.w500)),
                    )),
                  ],
                  onChanged: (val) => setState(() => _selectedLocation = val),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_draftLoaded && _rows.isEmpty) {
      _addRow();
    }
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
        title: Text(context.tr('entry_bulk'), style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
        actions: [
          if (_draftLoaded && _rows.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(context.tr('draft_restored'), style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFFB45309), fontWeight: FontWeight.w600)),
                ),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          _buildLocationHeader(),
          _Toolbar(
            onDeleteSelected: _rows.any((r) => r.selected) ? _deleteSelected : null,
            onDuplicateRow: _rows.any((r) => r.selected) ? _duplicateSelected : null,
            onExportTemplate: _exportTemplate,
            onPaste: _pasteFromClipboard,
          ),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _HeaderRow(
                      onSelectAll: (v) => _selectAll(v),
                      allSelected: _rows.isNotEmpty && _rows.every((r) => r.selected),
                      showSelect: _rows.isNotEmpty,
                    ),
                    ..._rows.asMap().entries.map((entry) {
                      final i = entry.key;
                      final row = entry.value;
                      return _RowWidget(
                        key: ValueKey('row_$i'),
                        rowIndex: i,
                        row: row,
                        controller: (c) => _controller(i, c),
                        focus: (c) => _focus(i, c),
                        onChanged: (col, value) {
                          row.data[_colKey(col)] = value;
                          _persistDraft();
                        },
                        onCellSubmitted: (col) => _handleCellSubmitted(i, col),
                        onToggleSelect: (v) => setState(() => row.selected = v),
                        onPick: (col) => _pickCellOption(i, col, _optionsFor(col)),
                        onPickExpiryDate: (rowIdx) => _pickExpiryDateForRow(rowIdx),
                        onGenerateSku: () => _generateSkuForRow(i),
                        isPickerCol: _isPickerCol,
                      );
                    }),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      child: TextButton.icon(
                        onPressed: () => _addRow(),
                        icon: const Icon(Icons.add, color: _kBlue, size: 20),
                        label: Text(context.tr('add_row'), style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: _kBlue)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: SizedBox(
            width: double.infinity,
            height: 46,
            child: ElevatedButton.icon(
              onPressed: _saving ? null : _saveAll,
              style: ElevatedButton.styleFrom(
                backgroundColor: _kGreen,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: _saving
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.save_outlined, size: 18),
              label: Text(context.tr('save_all'), style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 14)),
            ),
          ),
        ),
      ),
    );
  }

  List<String> _optionsFor(int col) {
    switch (col) {
      case 3: // category
        return _categoryOptions.keys.toList();
      case 4: // brand
        return _brandOptions.keys.toList();
      case 5: // unit
        return _unitOptions();
      case 11: // supplier
        return _supplierNames.values.toList();
      case 12: // status
        return [context.tr('active'), context.tr('inactive')];
      default:
        return [];
    }
  }

  void _handleCellSubmitted(int row, int col) {
    final editableCols = [0, 1, 2, 6, 7, 8, 9, 10];
    final currentIndex = editableCols.indexOf(col);
    if (currentIndex != -1 && currentIndex < editableCols.length - 1) {
      final nextCol = editableCols[currentIndex + 1];
      _focus(row, nextCol).requestFocus();
    } else {
      if (row + 1 < _rows.length) {
        _focus(row + 1, 0).requestFocus();
      } else {
        _addRow();
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_rows.length > row + 1) {
            _focus(row + 1, 0).requestFocus();
          }
        });
      }
    }
  }
}

class _Toolbar extends StatelessWidget {
  final VoidCallback? onDeleteSelected;
  final VoidCallback? onDuplicateRow;
  final VoidCallback onExportTemplate;
  final VoidCallback onPaste;
  const _Toolbar({
    required this.onDeleteSelected,
    required this.onDuplicateRow,
    required this.onExportTemplate,
    required this.onPaste,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _ToolButton(icon: Icons.delete_outline, label: context.tr('delete_selected'), onTap: onDeleteSelected),
            const SizedBox(width: 8),
            _ToolButton(icon: Icons.copy_all_outlined, label: context.tr('duplicate_row'), onTap: onDuplicateRow),
            const SizedBox(width: 8),
            _ToolButton(icon: Icons.download_outlined, label: context.tr('export_template'), onTap: onExportTemplate),
            const SizedBox(width: 8),
            _ToolButton(icon: Icons.content_paste_go, label: context.tr('paste'), onTap: onPaste),
          ],
        ),
      ),
    );
  }
}

class _ToolButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  const _ToolButton({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return Opacity(
      opacity: enabled ? 1 : 0.4,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: _kBg,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: _kBorder),
          ),
          child: Row(
            children: [
              Icon(icon, size: 17, color: _kBlue),
              const SizedBox(width: 6),
              Text(label, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: _kInk)),
            ],
          ),
        ),
      ),
    );
  }
}

class _HeaderRow extends StatelessWidget {
  final void Function(bool) onSelectAll;
  final bool allSelected;
  final bool showSelect;
  const _HeaderRow({
    required this.onSelectAll,
    required this.allSelected,
    required this.showSelect,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      color: _kBlue.withValues(alpha: 0.06),
      padding: const EdgeInsets.only(right: 12),
      child: Row(
        children: [
          if (showSelect)
            SizedBox(
              width: 44,
              child: Checkbox(
                value: allSelected,
                activeColor: _kBlue,
                onChanged: (v) => onSelectAll(v ?? false),
              ),
            ),
          ..._HeaderCell.list(context),
        ],
      ),
    );
  }
}

class _HeaderCell extends StatelessWidget {
  final String label;
  final double width;
  const _HeaderCell(this.label, this.width);

  static List<Widget> list(BuildContext context) {
    const widths = [180.0, 130.0, 140.0, 140.0, 140.0, 110.0, 120.0, 120.0, 120.0, 120.0, 140.0, 160.0, 110.0];
    const keys = [
      'product_name', 'sku', 'barcode', 'category', 'brand', 'unit_col',
      'purchase_price', 'selling_price', 'stock_quantity', 'min_stock_level',
      'expiry_date', 'supplier', 'status',
    ];
    return List.generate(keys.length, (i) => _HeaderCell(context.tr(keys[i]), widths[i]));
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: 44,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Align(
          alignment: Alignment.centerLeft,
          child: Text(
            label,
            style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.3, color: _kBlue),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ),
    );
  }
}

class _RowWidget extends StatelessWidget {
  final int rowIndex;
  final _RowData row;
  final TextEditingController Function(int) controller;
  final FocusNode Function(int) focus;
  final void Function(int, String) onChanged;
  final void Function(int) onCellSubmitted;
  final void Function(bool) onToggleSelect;
  final void Function(int) onPick;
  final void Function(int) onPickExpiryDate;
  final VoidCallback onGenerateSku;
  final bool Function(int) isPickerCol;
  const _RowWidget({
    super.key,
    required this.rowIndex,
    required this.row,
    required this.controller,
    required this.focus,
    required this.onChanged,
    required this.onCellSubmitted,
    required this.onToggleSelect,
    required this.onPick,
    required this.onPickExpiryDate,
    required this.onGenerateSku,
    required this.isPickerCol,
  });

  @override
  Widget build(BuildContext context) {
    final nameError = (row.data['name'] ?? '').toString().trim().isEmpty;
    final priceError = (row.data['price'] ?? '').toString().trim().isNotEmpty &&
        double.tryParse((row.data['price'] ?? '').toString().replaceAll(RegExp(r'[^0-9.]'), '')) == null;

    return Container(
      decoration: BoxDecoration(
        color: row.selected ? _kBlue.withValues(alpha: 0.05) : Colors.white,
        border: Border(bottom: BorderSide(color: _kBorder)),
      ),
      height: 48,
      child: Row(
        children: [
          SizedBox(
            width: 44,
            child: Checkbox(
              value: row.selected,
              activeColor: _kBlue,
              onChanged: (v) => onToggleSelect(v ?? false),
            ),
          ),
          _EditableCell(
            controller: controller(0),
            focusNode: focus(0),
            width: 180,
            hint: context.tr('product_name'),
            isError: nameError,
            errorText: nameError ? context.tr('required') : null,
            textInputAction: TextInputAction.next,
            onChanged: (v) => onChanged(0, v),
            onSubmitted: (_) => onCellSubmitted(0),
          ),
          _EditableCell(
            controller: controller(1),
            focusNode: focus(1),
            width: 130,
            hint: context.tr('sku'),
            textInputAction: TextInputAction.next,
            onChanged: (v) => onChanged(1, v),
            onSubmitted: (_) => onCellSubmitted(1),
            trailing: IconButton(
              icon: const Icon(Icons.auto_awesome, size: 14, color: _kBlue),
              tooltip: context.tr('auto_sku'),
              onPressed: onGenerateSku,
            ),
          ),
          _EditableCell(
            controller: controller(2),
            focusNode: focus(2),
            width: 140,
            hint: context.tr('barcode'),
            textInputAction: TextInputAction.next,
            onChanged: (v) => onChanged(2, v),
            onSubmitted: (_) => onCellSubmitted(2),
          ),
          _PickerCell(controller: controller(3), focus: focus(3), width: 140, onTap: () => onPick(3)),
          _PickerCell(controller: controller(4), focus: focus(4), width: 140, onTap: () => onPick(4)),
          _PickerCell(controller: controller(5), focus: focus(5), width: 110, onTap: () => onPick(5)),
          _EditableCell(
            controller: controller(6),
            focusNode: focus(6),
            width: 120,
            hint: context.tr('purchase_price'),
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.next,
            onChanged: (v) => onChanged(6, v),
            onSubmitted: (_) => onCellSubmitted(6),
          ),
          _EditableCell(
            controller: controller(7),
            focusNode: focus(7),
            width: 120,
            hint: context.tr('selling_price'),
            keyboardType: TextInputType.number,
            isError: priceError,
            errorText: priceError ? context.tr('invalid_number') : null,
            textInputAction: TextInputAction.next,
            onChanged: (v) => onChanged(7, v),
            onSubmitted: (_) => onCellSubmitted(7),
          ),
          _EditableCell(
            controller: controller(8),
            focusNode: focus(8),
            width: 120,
            hint: context.tr('stock_quantity'),
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.next,
            onChanged: (v) => onChanged(8, v),
            onSubmitted: (_) => onCellSubmitted(8),
          ),
          _EditableCell(
            controller: controller(9),
            focusNode: focus(9),
            width: 120,
            hint: context.tr('min_stock_level'),
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.next,
            onChanged: (v) => onChanged(9, v),
            onSubmitted: (_) => onCellSubmitted(9),
          ),
          _EditableCell(
            controller: controller(10),
            focusNode: focus(10),
            width: 140,
            hint: 'YYYY-MM-DD',
            textInputAction: TextInputAction.done,
            onChanged: (v) => onChanged(10, v),
            onSubmitted: (_) => onCellSubmitted(10),
            trailing: IconButton(
              icon: const Icon(Icons.calendar_month, size: 16, color: _kBlue),
              tooltip: context.tr('expiry_date'),
              onPressed: () => onPickExpiryDate(rowIndex),
            ),
          ),
          _PickerCell(controller: controller(11), focus: focus(11), width: 160, onTap: () => onPick(11)),
          _PickerCell(controller: controller(12), focus: focus(12), width: 110, onTap: () => onPick(12)),
        ],
      ),
    );
  }
}

class _EditableCell extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final double width;
  final String hint;
  final String? errorText;
  final bool isError;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final void Function(String)? onChanged;
  final void Function(String)? onSubmitted;
  final Widget? trailing;
  const _EditableCell({
    required this.controller,
    required this.focusNode,
    required this.width,
    required this.hint,
    this.errorText,
    this.isError = false,
    this.keyboardType,
    this.textInputAction,
    this.onChanged,
    this.onSubmitted,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: 48,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                focusNode: focusNode,
                keyboardType: keyboardType,
                textInputAction: textInputAction,
                onSubmitted: onSubmitted,
                style: GoogleFonts.outfit(fontSize: 12, color: _kInk),
                decoration: InputDecoration(
                  isDense: true,
                  hintText: hint,
                  hintStyle: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF94A3B8)),
                  filled: true,
                  fillColor: isError ? const Color(0xFFFEF2F2) : _kBg,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: isError ? _kRed : _kBorder, width: isError ? 1.5 : 1),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: isError ? _kRed : _kBorder, width: isError ? 1.5 : 1),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: _kBlue, width: 1.5),
                  ),
                ),
                onChanged: onChanged,
              ),
            ),
            if (trailing != null) trailing!,
          ],
        ),
      ),
    );
  }
}

class _PickerCell extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focus;
  final double width;
  final VoidCallback onTap;
  const _PickerCell({required this.controller, required this.focus, required this.width, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: 48,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            decoration: BoxDecoration(
              color: _kBg,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: _kBorder),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    controller.text.isEmpty ? context.tr('select') : controller.text,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.outfit(
                      fontSize: 12,
                      color: controller.text.isEmpty ? const Color(0xFF94A3B8) : _kInk,
                    ),
                  ),
                ),
                const Icon(Icons.arrow_drop_down, color: _kSlate, size: 18),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
