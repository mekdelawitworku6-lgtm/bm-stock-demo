import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:provider/provider.dart';
import 'package:file_picker/file_picker.dart';
import 'package:excel/excel.dart' as excel_pkg;
import 'package:csv/csv.dart';
import '../../core/providers/branch_provider.dart';
import '../../core/bloc/auth/auth_bloc.dart';
import '../../core/bloc/product/product_bloc.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/product_service.dart';
import '../../core/services/csv_template_builder.dart';
import '../../core/services/bulk_draft_store.dart';
import '../../core/utils/product_status_helper.dart';
import '../../core/widgets/app_toast.dart';
import 'bulk_products_screen.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kRed = Color(0xFFDC2626);
const _kGreen = Color(0xFF16A34A);

const _targetColumns = CsvTemplateBuilder.productHeaders;

class _LocationOption {
  final String id;
  final String name;
  final bool isWarehouse;
  const _LocationOption(
      {required this.id, required this.name, required this.isWarehouse});

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is _LocationOption &&
          id == other.id &&
          isWarehouse == other.isWarehouse;

  @override
  int get hashCode => Object.hash(id, isWarehouse);
}

class ImportProductsScreen extends StatefulWidget {
  const ImportProductsScreen({super.key});

  @override
  State<ImportProductsScreen> createState() => _ImportProductsScreenState();
}

class _ImportProductsScreenState extends State<ImportProductsScreen> {
  String? _fileName;
  List<int>? _fileBytes;
  List<Map<String, dynamic>> _rawRows = [];
  Map<String, String> _columnMap = {};
  List<String> _sourceHeaders = [];
  bool _isParsing = false;
  bool _isImporting = false;
  String? _parseError;
  int _step = 1; // 1: upload, 2: preview + map, 3: validation
  _LocationOption? _selectedLocation;

  @override
  void initState() {
    super.initState();
    _initColumnMap();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authBloc = context.read<AuthBloc>();
      final companyId = authBloc.user?.companyId;
      context
          .read<BranchProvider>()
          .loadBranches(companyId: companyId, showLoading: false);
    });
  }

  void _initColumnMap() {
    _columnMap = {
      for (final c in _targetColumns) c: '',
    };
  }

  Future<void> _pickFile() async {
    try {
      setState(() {
        _isParsing = true;
        _parseError = null;
        _step = 1;
      });
      final result = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['xlsx', 'xls', 'csv'],
        withData: true,
      );
      if (result == null || result.files.isEmpty) {
        setState(() => _isParsing = false);
        return;
      }
      final file = result.files.first;
      final bytes = file.bytes;
      if (bytes == null || bytes.isEmpty) {
        setState(() {
          _isParsing = false;
          _parseError = 'Could not read file data.';
        });
        return;
      }

      final parsed = _parseSheet(bytes, file.name);
      if (parsed.rows.isEmpty) {
        setState(() {
          _fileName = file.name;
          _fileBytes = bytes;
          _rawRows = [];
          _sourceHeaders = [];
          _isParsing = false;
          _parseError =
              'No product data rows found in "${file.name}". Please ensure your file has data rows below the header line.';
          _step = 1;
        });
        return;
      }
      setState(() {
        _fileName = file.name;
        _fileBytes = bytes;
        _rawRows = parsed.rows;
        _sourceHeaders = parsed.headers;
        _isParsing = false;
        _autoMapColumns();
        _step = 2;
      });
    } catch (e) {
      setState(() {
        _isParsing = false;
        _parseError = 'Failed to parse file: $e';
      });
    }
  }

  _ParseResult _parseSheet(List<int> bytes, String filename) {
    final extension = filename.split('.').last.toLowerCase();
    final rows = <Map<String, dynamic>>[];
    final headers = <String>[];

    if (extension == 'csv') {
      var content = utf8.decode(bytes);
      if (content.startsWith('\uFEFF')) {
        content = content.substring(1);
      }
      content = content.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
      final rawRows = const CsvToListConverter(eol: '\n').convert(content);
      if (rawRows.isEmpty) return _ParseResult([], []);
      headers.addAll(rawRows.first.map((e) => e.toString().trim()).toList());
      for (int i = 1; i < rawRows.length; i++) {
        final row = rawRows[i];
        if (row.isEmpty || row.every((c) => c.toString().trim().isEmpty))
          continue;
        final map = <String, dynamic>{};
        for (int h = 0; h < headers.length && h < row.length; h++) {
          map[headers[h]] = row[h]?.toString().trim();
        }
        rows.add(map);
      }
    } else {
      final excel = excel_pkg.Excel.decodeBytes(bytes);
      for (final table in excel.tables.keys) {
        final sheet = excel.tables[table];
        if (sheet == null || sheet.maxRows == 0) continue;
        final headerRow = sheet.rows.first;
        headers.addAll(headerRow
            .map((cell) => cell?.value?.toString().trim() ?? '')
            .toList());
        for (int i = 1; i < sheet.rows.length; i++) {
          final row = sheet.rows[i];
          if (row.isEmpty ||
              row.every((cell) =>
                  cell?.value == null || cell!.value.toString().trim().isEmpty))
            continue;
          final map = <String, dynamic>{};
          for (int h = 0; h < headers.length && h < row.length; h++) {
            map[headers[h]] = row[h]?.value?.toString().trim();
          }
          rows.add(map);
        }
        if (rows.isNotEmpty) break;
      }
    }
    return _ParseResult(headers, rows);
  }

  void _autoMapColumns() {
    _initColumnMap();
    for (var i = 0; i < _sourceHeaders.length; i++) {
      final h = _normalizeHeader(_sourceHeaders[i]);
      if (_columnMap[h]?.isEmpty ?? true) {
        _columnMap[h] = _sourceHeaders[i];
      }
    }
    setState(() {});
  }

  String _normalizeHeader(String header) {
    final h = header.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
    if (h.contains('name') ||
        h.contains('product') ||
        h.contains('item') ||
        h.contains('title')) return 'name';
    if (h.contains('bar') || h.contains('code')) return 'barcode';
    if (h.contains('brand') || h.contains('make')) return 'brand';
    if (h.contains('cat')) return 'category';
    if (h.contains('unit')) return 'unit';
    if (h.contains('sell') || h.contains('price') || h.contains('rate'))
      return 'price';
    if (h.contains('cost') || h.contains('buy') || h.contains('purchase'))
      return 'cost';
    if (h.contains('sku')) return 'sku';
    if (h.contains('stock') || h.contains('qty') || h.contains('opening'))
      return 'stock';
    if (h.contains('min')) return 'minStock';
    if (h.contains('expir') || h.contains('exp')) return 'expiryDate';
    if (h.contains('warehouse') || h.contains('location')) return 'warehouse';
    if (h.contains('supplier') || h.contains('vendor')) return 'supplier';
    if (h.contains('status')) return 'status';
    return h;
  }

  List<Map<String, dynamic>> _mappedRows() {
    return _rawRows.map((raw) {
      final out = <String, dynamic>{};
      for (final col in _targetColumns) {
        final source = _columnMap[col];
        out[col] =
            (source != null && source.isNotEmpty) ? raw[source] ?? '' : '';
      }
      if ((out['name'] ?? '').toString().trim().isEmpty) {
        out['name'] =
            raw['product_name'] ?? raw['name'] ?? raw['product'] ?? '';
      }
      if ((out['price'] ?? '').toString().trim().isEmpty) {
        out['price'] =
            raw['price'] ?? raw['selling_price'] ?? raw['rate'] ?? '';
      }
      return out;
    }).toList();
  }

  Future<void> _openInBulkEntry() async {
    final rows = _mappedRows();
    if (rows.isEmpty) {
      showAppToast(context, context.tr('no_rows_to_save'),
          type: AppToastType.error);
      return;
    }
    await BulkDraftStore.save(rows);
    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => BulkProductsScreen(
          initialRows: rows,
          initialLocationId: _selectedLocation?.id,
          initialIsWarehouse: _selectedLocation?.isWarehouse,
        ),
      ),
    );
  }

  Map<int, List<String>> _validateRows(List<Map<String, dynamic>> rows) {
    final errors = <int, List<String>>{};
    for (var i = 0; i < rows.length; i++) {
      final row = rows[i];
      final rowErrors = <String>[];
      if ((row['name'] ?? '').toString().trim().isEmpty) {
        rowErrors.add(context.tr('name_required'));
      }
      final price = (row['price'] ?? '').toString().trim();
      if (price.isNotEmpty &&
          double.tryParse(price.replaceAll(RegExp(r'[^0-9.]'), '')) == null) {
        rowErrors.add(context.tr('price_invalid'));
      }
      final stock = (row['stock'] ?? '').toString().trim();
      if (stock.isNotEmpty &&
          int.tryParse(stock.replaceAll(RegExp(r'[^0-9]'), '')) == null) {
        rowErrors.add(context.tr('stock_invalid'));
      }
      if (rowErrors.isNotEmpty) errors[i] = rowErrors;
    }
    return errors;
  }

  Future<void> _importAll() async {
    final rows = _mappedRows();
    final errors = _validateRows(rows);
    if (errors.isNotEmpty) {
      showAppToast(context, context.tr('row_errors'), type: AppToastType.error);
      setState(() => _step = 3);
      return;
    }

    setState(() => _isImporting = true);
    var success = 0;
    for (final row in rows) {
      final name = (row['name'] ?? '').toString().trim();
      if (name.isEmpty) continue;
      final payload = <String, dynamic>{
        'name': name,
        'unit': (row['unit'] ?? '').toString().trim().isEmpty
            ? 'piece'
            : (row['unit'] ?? '').toString().trim(),
        'category': (row['category'] ?? '').toString().trim().isEmpty
            ? 'General'
            : (row['category'] ?? '').toString().trim(),
        'price': double.tryParse((row['price'] ?? '')
                .toString()
                .replaceAll(RegExp(r'[^0-9.]'), '')) ??
            0,
        'type': 'product',
        'trackStock': true,
      };
      if ((row['sku'] ?? '').toString().trim().isNotEmpty)
        payload['sku'] = row['sku'].toString().trim();
      if ((row['barcode'] ?? '').toString().trim().isNotEmpty)
        payload['barcode'] = row['barcode'].toString().trim();
      if ((row['cost'] ?? '').toString().trim().isNotEmpty) {
        payload['cost'] = double.tryParse(
                row['cost'].toString().replaceAll(RegExp(r'[^0-9.]'), '')) ??
            0;
      }
      if ((row['stock'] ?? '').toString().trim().isNotEmpty) {
        payload['stockQuantity'] = int.tryParse(
                row['stock'].toString().replaceAll(RegExp(r'[^0-9]'), '')) ??
            0;
      }
      if ((row['minStock'] ?? '').toString().trim().isNotEmpty) {
        payload['minStockLevel'] = int.tryParse(
                row['minStock'].toString().replaceAll(RegExp(r'[^0-9]'), '')) ??
            0;
      }
      final metadata = <String, dynamic>{};
      if ((row['brand'] ?? '').toString().trim().isNotEmpty)
        metadata['brand'] = row['brand'].toString().trim();
      if ((row['status'] ?? '').toString().trim().isNotEmpty) {
        payload['status'] =
            ProductStatusHelper.normalizeImportValue('${row['status'] ?? ''}');
      }
      if (metadata.isNotEmpty) payload['metadata'] = metadata;
      if (_selectedLocation != null) {
        if (_selectedLocation!.isWarehouse) {
          payload['warehouseIds'] = [_selectedLocation!.id];
        } else {
          payload['shopIds'] = [_selectedLocation!.id];
        }
      }
      try {
        await ProductService().create(payload);
        success++;
      } catch (_) {}
    }

    context.read<ProductBloc>().add(const ProductsLoadRequested());
    if (!mounted) return;
    setState(() => _isImporting = false);

    final locName = _selectedLocation?.name ?? context.tr('all_locations');

    if (success > 0) {
      showAppToast(
        context,
        '${context.tr('import_successful').replaceFirst('{count}', '$success')} ($locName)',
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

  Future<void> _downloadTemplate(String format) async {
    try {
      final builder = const CsvTemplateBuilder();
      if (format == 'pdf') {
        await builder.downloadProductPdf(context);
      } else {
        await builder.downloadProductCsv();
      }
      if (!mounted) return;
      showAppToast(context, context.tr('template_downloaded'),
          type: AppToastType.success);
    } catch (e) {
      if (!mounted) return;
      showAppToast(context, '${context.tr('template_error')}: $e',
          type: AppToastType.error);
    }
  }

  Widget _buildLocationPicker() {
    final branchProvider = context.watch<BranchProvider>();
    final locations = <_LocationOption>[];
    for (final w in branchProvider.warehouses) {
      locations.add(_LocationOption(
          id: w.id, name: 'Warehouse · ${w.name}', isWarehouse: true));
    }
    for (final s in branchProvider.shops) {
      locations.add(_LocationOption(
          id: s.id, name: 'Shop · ${s.name}', isWarehouse: false));
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.storefront_outlined, color: _kBlue, size: 20),
              const SizedBox(width: 8),
              Text(
                context.tr('target_location'),
                style: GoogleFonts.outfit(
                    fontSize: 14, fontWeight: FontWeight.bold, color: _kInk),
              ),
            ],
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<_LocationOption?>(
            initialValue: _selectedLocation,
            decoration: InputDecoration(
              filled: true,
              fillColor: _kBg,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: _kBorder)),
              enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: _kBorder)),
            ),
            items: [
              DropdownMenuItem<_LocationOption?>(
                value: null,
                child: Text(context.tr('all_locations'),
                    style: GoogleFonts.outfit(fontSize: 13, color: _kSlate)),
              ),
              ...locations.map((loc) => DropdownMenuItem<_LocationOption?>(
                    value: loc,
                    child: Text(loc.name,
                        style: GoogleFonts.outfit(
                            fontSize: 13,
                            color: _kInk,
                            fontWeight: FontWeight.w500)),
                  )),
            ],
            onChanged: (val) => setState(() => _selectedLocation = val),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;
    final canImport = user?.canImportProducts ?? false;

    if (!canImport) {
      return Scaffold(
        backgroundColor: _kBg,
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new, color: _kInk, size: 20),
            onPressed: () => Navigator.pop(context),
          ),
          title: Text(context.tr('entry_import'),
              style: GoogleFonts.outfit(
                  fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(20)),
                  child: const Icon(Icons.lock_outline, color: _kBlue, size: 36),
                ),
                const SizedBox(height: 18),
                Text('Large Business Plan Exclusive',
                    style: GoogleFonts.outfit(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: _kInk)),
                const SizedBox(height: 8),
                Text(
                  'Importing products from PDF, Excel, and CSV is exclusively available on the Large Business Plan (15,999 ETB). Upgrade your plan to unlock bulk import tools.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(fontSize: 13, color: _kSlate),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => Navigator.pushNamed(context, '/choose_plan',
                      arguments: {'upgrade': true}),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kBlue,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24, vertical: 12),
                  ),
                  child: Text('Upgrade to Large Plan',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ),
      );
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
        title: Text(context.tr('entry_import'),
            style: GoogleFonts.outfit(
                fontSize: 20, fontWeight: FontWeight.bold, color: _kInk)),
        actions: [
          PopupMenuButton<String>(
            tooltip: context.tr('download_template'),
            onSelected: _downloadTemplate,
            child: Container(
              margin: const EdgeInsets.only(right: 12),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: _kBlue.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _kBlue.withValues(alpha: 0.35)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.download_outlined, color: _kBlue, size: 18),
                  const SizedBox(width: 6),
                  Text(
                    context.tr('download_template'),
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: _kBlue,
                    ),
                  ),
                ],
              ),
            ),
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'csv',
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.table_view_outlined, color: _kBlue),
                  title: Text(context.tr('export_csv')),
                ),
              ),
              PopupMenuItem(
                value: 'pdf',
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading:
                      const Icon(Icons.picture_as_pdf_outlined, color: _kBlue),
                  title: Text(context.tr('download_pdf')),
                ),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          if (_step > 1) _StepIndicator(step: _step),
          Expanded(
            child: _isParsing
                ? const Center(child: CircularProgressIndicator())
                : ListView(
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.all(20),
                    children: [
                      _UploadBanner(
                        fileName: _fileName,
                        parsedCount: _rawRows.length,
                        onTap: _pickFile,
                      ),
                      if (_parseError != null) ...[
                        const SizedBox(height: 12),
                        Text(_parseError!,
                            style:
                                GoogleFonts.outfit(fontSize: 12, color: _kRed)),
                      ],
                      if (_step >= 2 && _rawRows.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        _buildLocationPicker(),
                        const SizedBox(height: 20),
                        _ColumnMappingSection(
                          sourceHeaders: _sourceHeaders,
                          columnMap: _columnMap,
                          onMap: (col) => _pickSourceFor(col),
                        ),
                        const SizedBox(height: 20),
                        _PreviewSection(
                          rows: _mappedRows(),
                          errors:
                              _step == 3 ? _validateRows(_mappedRows()) : {},
                        ),
                        const SizedBox(height: 20),
                        _ImportButton(
                          count: _rawRows.length,
                          importing: _isImporting,
                          onImport: _importAll,
                          onEditInBulk: _openInBulkEntry,
                        ),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Future<void> _pickSourceFor(String targetCol) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(context.tr('map_to') + ': ${context.tr(targetCol)}',
                style: GoogleFonts.outfit(
                    fontSize: 16, fontWeight: FontWeight.bold, color: _kInk)),
            const SizedBox(height: 4),
            Text(context.tr('map_hint'),
                style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
            const SizedBox(height: 12),
            ListTile(
              dense: true,
              title: Text(context.tr('dont_import'),
                  style: GoogleFonts.outfit(
                      fontSize: 14,
                      color: _kBlue,
                      fontWeight: FontWeight.w600)),
              onTap: () => Navigator.pop(sheetContext, ''),
            ),
            ..._sourceHeaders.map((h) => ListTile(
                  dense: true,
                  title: Text(h,
                      style: GoogleFonts.outfit(fontSize: 14, color: _kInk)),
                  onTap: () => Navigator.pop(sheetContext, h),
                )),
          ],
        ),
      ),
    );
    if (picked != null && mounted) {
      setState(() => _columnMap[targetCol] = picked);
    }
  }
}

class _ParseResult {
  final List<String> headers;
  final List<Map<String, dynamic>> rows;
  const _ParseResult(this.headers, this.rows);
}

class _StepIndicator extends StatelessWidget {
  final int step;
  const _StepIndicator({required this.step});

  @override
  Widget build(BuildContext context) {
    const labels = ['upload', 'preview', 'validation'];
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: List.generate(3, (i) {
          final isActive = i + 1 <= step;
          return Expanded(
            child: Row(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isActive ? _kBlue : _kBg,
                    border: Border.all(color: isActive ? _kBlue : _kBorder),
                  ),
                  child: Center(
                    child: isActive
                        ? const Icon(Icons.check, color: Colors.white, size: 14)
                        : Text('${i + 1}',
                            style: GoogleFonts.outfit(
                                fontSize: 12, color: _kSlate)),
                  ),
                ),
                const SizedBox(width: 6),
                Text(context.tr(labels[i]),
                    style: GoogleFonts.outfit(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: isActive ? _kBlue : _kSlate)),
                if (i < 2) ...[
                  Expanded(
                    child: Container(
                      height: 2,
                      margin: const EdgeInsets.symmetric(horizontal: 8),
                      color: i + 1 < step ? _kBlue : _kBorder,
                    ),
                  ),
                ],
              ],
            ),
          );
        }),
      ),
    );
  }
}

class _UploadBanner extends StatelessWidget {
  final String? fileName;
  final int parsedCount;
  final VoidCallback onTap;
  const _UploadBanner(
      {required this.fileName, required this.parsedCount, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _kBorder),
        ),
        child: Column(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: _kBlue.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(
                  fileName != null
                      ? Icons.description_outlined
                      : Icons.cloud_upload_outlined,
                  color: _kBlue,
                  size: 32),
            ),
            const SizedBox(height: 12),
            Text(
              fileName ?? context.tr('select_excel_file'),
              style: GoogleFonts.outfit(
                  fontSize: 16, fontWeight: FontWeight.bold, color: _kInk),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            Text(
              parsedCount > 0
                  ? context
                      .tr('parsed_products')
                      .replaceFirst('{count}', '$parsedCount')
                  : '.xlsx, .xls, .csv',
              style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: onTap,
              style: ElevatedButton.styleFrom(
                backgroundColor: fileName != null ? _kBg : _kBlue,
                foregroundColor: fileName != null ? _kInk : Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              icon: Icon(fileName != null ? Icons.refresh : Icons.folder_open,
                  size: 18),
              label: Text(
                  fileName != null
                      ? context.tr('change_file')
                      : context.tr('browse_file'),
                  style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }
}

class _ColumnMappingSection extends StatelessWidget {
  final List<String> sourceHeaders;
  final Map<String, String> columnMap;
  final void Function(String) onMap;
  const _ColumnMappingSection({
    required this.sourceHeaders,
    required this.columnMap,
    required this.onMap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.tr('column_mapping'),
              style: GoogleFonts.outfit(
                  fontSize: 15, fontWeight: FontWeight.bold, color: _kInk)),
          const SizedBox(height: 4),
          Text(context.tr('map_hint'),
              style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
          const SizedBox(height: 12),
          ..._targetColumns.map((col) {
            final mapped = columnMap[col];
            final autoMatched = mapped != null &&
                mapped.isNotEmpty &&
                _isAutoMatched(col, mapped);
            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: InkWell(
                onTap: () => onMap(col),
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: _kBg,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                        color: autoMatched
                            ? _kGreen
                            : (mapped != null && mapped.isNotEmpty
                                ? _kBlue
                                : _kBorder)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(context.tr(col),
                            style: GoogleFonts.outfit(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: _kInk)),
                      ),
                      Text(
                        mapped != null && mapped.isNotEmpty
                            ? mapped
                            : context.tr('select'),
                        style: GoogleFonts.outfit(
                            fontSize: 13,
                            color: mapped != null && mapped.isNotEmpty
                                ? _kBlue
                                : _kSlate),
                      ),
                      const SizedBox(width: 8),
                      Icon(Icons.arrow_drop_down, color: _kSlate, size: 20),
                    ],
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  bool _isAutoMatched(String col, String mapped) {
    final normalized =
        mapped.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
    if (col == 'name')
      return normalized.contains('name') || normalized.contains('product');
    if (col == 'barcode')
      return normalized.contains('bar') || normalized.contains('code');
    if (col == 'price')
      return normalized.contains('sell') || normalized.contains('price');
    if (col == 'cost')
      return normalized.contains('cost') || normalized.contains('purchase');
    if (col == 'stock')
      return normalized.contains('stock') || normalized.contains('qty');
    return normalized.contains(col);
  }
}

class _PreviewSection extends StatelessWidget {
  final List<Map<String, dynamic>> rows;
  final Map<int, List<String>> errors;
  const _PreviewSection({required this.rows, required this.errors});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(context.tr('data_preview'),
                  style: GoogleFonts.outfit(
                      fontSize: 15, fontWeight: FontWeight.bold, color: _kInk)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: errors.isEmpty
                      ? _kGreen.withValues(alpha: 0.1)
                      : _kRed.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  errors.isEmpty
                      ? context.tr('valid')
                      : context.tr('has_errors'),
                  style: GoogleFonts.outfit(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: errors.isEmpty ? _kGreen : _kRed),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 36,
                  color: _kBlue.withValues(alpha: 0.06),
                  child: Row(
                    children: [
                      _previewHeader(context.tr('row_no'), 60),
                      ..._targetColumns
                          .map((c) => _previewHeader(context.tr(c), 120)),
                    ],
                  ),
                ),
                ...rows.asMap().entries.map((entry) {
                  final i = entry.key;
                  final row = entry.value;
                  final hasError = errors.containsKey(i);
                  return Container(
                    height: 40,
                    color: hasError
                        ? const Color(0xFFFEF2F2)
                        : (i.isEven ? _kBg : Colors.white),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 60,
                          child: Center(
                            child: Text('${i + 1}',
                                style: GoogleFonts.outfit(
                                    fontSize: 11,
                                    color: hasError ? _kRed : _kSlate)),
                          ),
                        ),
                        ..._targetColumns.map((c) {
                          final val = (row[c] ?? '').toString();
                          return SizedBox(
                            width: 120,
                            child: Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 8),
                              child: Text(
                                val,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.outfit(
                                    fontSize: 11,
                                    color: hasError ? _kRed : _kInk),
                              ),
                            ),
                          );
                        }),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
          if (errors.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(context.tr('fix_errors_hint'),
                style: GoogleFonts.outfit(fontSize: 12, color: _kRed)),
            const SizedBox(height: 4),
            ...errors.entries.take(5).map((e) => Text(
                  'Row ${e.key + 1}: ${e.value.join(', ')}',
                  style: GoogleFonts.outfit(fontSize: 11, color: _kRed),
                )),
          ],
        ],
      ),
    );
  }

  Widget _previewHeader(String label, double width) {
    return SizedBox(
      width: width,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        child: Text(label,
            style: GoogleFonts.outfit(
                fontSize: 10, fontWeight: FontWeight.bold, color: _kBlue),
            maxLines: 1,
            overflow: TextOverflow.ellipsis),
      ),
    );
  }
}

class _ImportButton extends StatelessWidget {
  final int count;
  final bool importing;
  final VoidCallback onImport;
  final VoidCallback onEditInBulk;
  const _ImportButton({
    required this.count,
    required this.importing,
    required this.onImport,
    required this.onEditInBulk,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          height: 50,
          child: ElevatedButton.icon(
            onPressed: importing ? null : onEditInBulk,
            style: ElevatedButton.styleFrom(
              backgroundColor: _kBlue,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            icon: const Icon(Icons.edit_note_outlined, size: 22),
            label: Text(
              context.tr('edit_in_bulk_entry').replaceAll('{count}', '$count'),
              style:
                  GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 14),
            ),
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          height: 46,
          child: OutlinedButton.icon(
            onPressed: importing ? null : onImport,
            style: OutlinedButton.styleFrom(
              foregroundColor: _kInk,
              side: const BorderSide(color: _kBorder),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            icon: importing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: _kBlue))
                : const Icon(Icons.upload_file, size: 18),
            label: Text(
              context.tr('import_all').replaceFirst('{count}', '$count'),
              style:
                  GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 13),
            ),
          ),
        ),
      ],
    );
  }
}
