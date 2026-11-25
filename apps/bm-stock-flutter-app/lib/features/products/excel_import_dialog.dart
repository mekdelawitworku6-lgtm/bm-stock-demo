import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:file_picker/file_picker.dart';
import 'package:excel/excel.dart' as excel_pkg;
import 'package:csv/csv.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:provider/provider.dart';
import '../../core/bloc/auth/auth_bloc.dart';
import '../../core/bloc/product/product_bloc.dart';
import '../../core/providers/branch_provider.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/product_service.dart';
import '../../core/services/csv_template_builder.dart';
import '../../core/services/bulk_draft_store.dart';
import '../../core/widgets/app_toast.dart';
import 'bulk_products_screen.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);

class ExcelImportDialog extends StatefulWidget {
  final bool enableAutoFill;
  const ExcelImportDialog({super.key, this.enableAutoFill = false});

  static Future<Map<String, dynamic>?> show(BuildContext context,
      {bool enableAutoFill = false}) {
    return showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ExcelImportDialog(enableAutoFill: enableAutoFill),
    );
  }

  @override
  State<ExcelImportDialog> createState() => _ExcelImportDialogState();
}

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

class _ExcelImportDialogState extends State<ExcelImportDialog> {
  String? _fileName;
  List<int>? _fileBytes;
  List<Map<String, dynamic>> _parsedRows = [];
  bool _isParsing = false;
  bool _isUploading = false;
  int? _selectedRowIndex;
  String? _parseError;
  _LocationOption? _selectedLocation;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authBloc = context.read<AuthBloc>();
      final companyId = authBloc.user?.companyId;
      context
          .read<BranchProvider>()
          .loadBranches(companyId: companyId, showLoading: false);
    });
  }

  Future<void> _pickFile() async {
    try {
      setState(() {
        _isParsing = true;
        _parseError = null;
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
      final name = file.name;

      if (bytes == null || bytes.isEmpty) {
        setState(() {
          _isParsing = false;
          _parseError = 'Could not read file data.';
        });
        return;
      }

      _fileName = name;
      _fileBytes = bytes;

      final rows = _parseSheet(bytes, name);
      setState(() {
        _parsedRows = rows;
        _isParsing = false;
        _selectedRowIndex = rows.isNotEmpty ? 0 : null;
      });
    } catch (e) {
      setState(() {
        _isParsing = false;
        _parseError = 'Failed to parse file: $e';
      });
    }
  }

  List<Map<String, dynamic>> _parseSheet(List<int> bytes, String filename) {
    final extension = filename.split('.').last.toLowerCase();
    final List<Map<String, dynamic>> items = [];

    if (extension == 'csv') {
      var content = utf8.decode(bytes);
      if (content.startsWith('\uFEFF')) {
        content = content.substring(1);
      }
      content = content.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
      final rawRows = const CsvToListConverter(eol: '\n').convert(content);
      if (rawRows.isEmpty) return items;

      final headers =
          rawRows.first.map((e) => e.toString().trim().toLowerCase()).toList();
      for (int i = 1; i < rawRows.length; i++) {
        final row = rawRows[i];
        if (row.isEmpty || row.every((c) => c.toString().trim().isEmpty))
          continue;
        final map = <String, dynamic>{};
        for (int h = 0; h < headers.length && h < row.length; h++) {
          final header = _normalizeHeader(headers[h]);
          map[header] = row[h]?.toString().trim();
        }
        final item = _cleanRowMap(map);
        if (item != null) items.add(item);
      }
    } else {
      final excel = excel_pkg.Excel.decodeBytes(bytes);
      for (final table in excel.tables.keys) {
        final sheet = excel.tables[table];
        if (sheet == null || sheet.maxRows == 0) continue;

        final headerRow = sheet.rows.first;
        final headers = headerRow
            .map((cell) => cell?.value?.toString().trim().toLowerCase() ?? '')
            .toList();

        for (int i = 1; i < sheet.rows.length; i++) {
          final row = sheet.rows[i];
          if (row.isEmpty ||
              row.every((cell) =>
                  cell?.value == null || cell!.value.toString().trim().isEmpty))
            continue;

          final map = <String, dynamic>{};
          for (int h = 0; h < headers.length && h < row.length; h++) {
            final header = _normalizeHeader(headers[h]);
            map[header] = row[h]?.value?.toString().trim();
          }

          final item = _cleanRowMap(map);
          if (item != null) items.add(item);
        }
        if (items.isNotEmpty) break;
      }
    }

    return items;
  }

  String _normalizeHeader(String header) {
    final h = header.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
    if (h.contains('name') || h.contains('product')) return 'name';
    if (h.contains('cat')) return 'category';
    if (h.contains('unit')) return 'unit';
    if (h.contains('price') || h.contains('sell')) return 'price';
    if (h.contains('cost') || h.contains('buy') || h.contains('purchase'))
      return 'cost';
    if (h.contains('sku')) return 'sku';
    if (h.contains('bar') || h.contains('code')) return 'barcode';
    if (h.contains('stock') || h.contains('qty') || h.contains('quantity'))
      return 'stockQuantity';
    if (h.contains('min')) return 'minStockLevel';
    if (h.contains('desc')) return 'description';
    if (h.contains('type') || h.contains('service')) return 'type';
    return header;
  }

  Map<String, dynamic>? _cleanRowMap(Map<String, dynamic> raw) {
    final name = raw['name']?.toString() ?? '';
    if (name.isEmpty) return null;

    final category = raw['category']?.toString() ?? 'General';
    final unit = raw['unit']?.toString() ?? 'piece';
    final priceStr = raw['price']?.toString() ?? '0';
    final price =
        double.tryParse(priceStr.replaceAll(RegExp(r'[^0-9.]'), '')) ?? 0.0;
    final costStr = raw['cost']?.toString() ?? '0';
    final cost =
        double.tryParse(costStr.replaceAll(RegExp(r'[^0-9.]'), '')) ?? 0.0;
    final stockStr = raw['stockQuantity']?.toString() ?? '0';
    final stock = int.tryParse(stockStr.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
    final minStockStr = raw['minStockLevel']?.toString() ?? '0';
    final minStock =
        int.tryParse(minStockStr.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
    final typeRaw = raw['type']?.toString().toLowerCase() ?? 'product';
    final type = typeRaw.contains('service') ? 'service' : 'product';

    return {
      'name': name,
      'category': category.isEmpty ? 'General' : category,
      'unit': unit.isEmpty ? 'piece' : unit,
      'price': price,
      'cost': cost,
      'stockQuantity': stock,
      'minStockLevel': minStock,
      'sku': raw['sku']?.toString() ?? '',
      'barcode': raw['barcode']?.toString() ?? '',
      'description': raw['description']?.toString() ?? '',
      'type': type,
    };
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

  Future<void> _handleBulkUpload() async {
    if (_parsedRows.isEmpty) return;
    setState(() => _isUploading = true);

    var successCount = 0;
    final errors = <String>[];

    for (var i = 0; i < _parsedRows.length; i++) {
      final row = _parsedRows[i];
      final name = (row['name'] ?? '').toString().trim();
      if (name.isEmpty) {
        errors.add('Row ${i + 1}: missing name');
        continue;
      }
      final payload = <String, dynamic>{
        'name': name,
        'unit': (row['unit'] ?? '').toString().trim().isEmpty
            ? 'piece'
            : (row['unit'] ?? '').toString().trim(),
        'category': (row['category'] ?? '').toString().trim().isEmpty
            ? 'General'
            : (row['category'] ?? '').toString().trim(),
        'price': row['price'] is num
            ? (row['price'] as num).toDouble()
            : double.tryParse('${row['price'] ?? ''}') ?? 0,
        'type': (row['type'] ?? 'product').toString().contains('service')
            ? 'service'
            : 'product',
        'trackStock': true,
      };
      final sku = (row['sku'] ?? '').toString().trim();
      if (sku.isNotEmpty) payload['sku'] = sku;
      final barcode = (row['barcode'] ?? '').toString().trim();
      if (barcode.isNotEmpty) payload['barcode'] = barcode;
      if (row['cost'] is num) payload['cost'] = (row['cost'] as num).toDouble();
      if (row['stockQuantity'] is num)
        payload['stockQuantity'] = (row['stockQuantity'] as num).toInt();
      if (row['minStockLevel'] is num)
        payload['minStockLevel'] = (row['minStockLevel'] as num).toInt();
      final description = (row['description'] ?? '').toString().trim();
      if (description.isNotEmpty) payload['description'] = description;
      if (_selectedLocation != null) {
        if (_selectedLocation!.isWarehouse) {
          payload['warehouseIds'] = [_selectedLocation!.id];
        } else {
          payload['shopIds'] = [_selectedLocation!.id];
        }
      } else {
        final branchProvider =
            Provider.of<BranchProvider>(context, listen: false);
        final wIds = branchProvider.warehouses.map((w) => w.id).toList();
        final sIds = branchProvider.shops.map((s) => s.id).toList();
        if (wIds.isNotEmpty) payload['warehouseIds'] = wIds;
        if (sIds.isNotEmpty) payload['shopIds'] = sIds;
      }

      try {
        await ProductService().create(payload);
        successCount++;
      } catch (e) {
        errors.add('Row ${i + 1}: $e');
      }
    }

    if (!mounted) return;
    setState(() => _isUploading = false);

    context.read<ProductBloc>().add(const ProductsLoadRequested());

    final locName = _selectedLocation?.name ?? context.tr('all_locations');

    if (successCount > 0) {
      showAppToast(
        context,
        '${context.tr('import_successful').replaceFirst('{count}', '$successCount')} ($locName)',
        type: AppToastType.success,
      );
    } else if (successCount == 0 && errors.isNotEmpty) {
      showAppToast(context, '${context.tr('import_failed')}: ${errors.first}',
          type: AppToastType.error);
    }

    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          context.tr('bulk_import_all').replaceFirst(' ({count})', ''),
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: _kInk),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.check_circle_outline,
                    color: Color(0xFF16A34A), size: 24),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    context
                        .tr('import_successful')
                        .replaceFirst('{count}', '$successCount'),
                    style: GoogleFonts.outfit(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: _kInk),
                  ),
                ),
              ],
            ),
            if (errors.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text('Errors:',
                  style: GoogleFonts.outfit(
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFFDC2626))),
              const SizedBox(height: 4),
              Container(
                constraints: const BoxConstraints(maxHeight: 120),
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: errors
                        .map((e) => Text('• $e',
                            style: GoogleFonts.outfit(
                                fontSize: 12, color: const Color(0xFFDC2626))))
                        .toList(),
                  ),
                ),
              ),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context); // close alert
              Navigator.pop(context); // close sheet
            },
            child: Text(context.tr('done'),
                style: GoogleFonts.outfit(
                    color: _kBlue, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Future<void> _openInBulkEntry() async {
    if (_parsedRows.isEmpty) return;
    final rows = _parsedRows
        .map((r) => {
              'name': (r['name'] ?? '').toString(),
              'sku': (r['sku'] ?? '').toString(),
              'barcode': (r['barcode'] ?? '').toString(),
              'category': (r['category'] ?? 'General').toString(),
              'brand': (r['brand'] ?? '').toString(),
              'unit': (r['unit'] ?? 'piece').toString(),
              'cost': (r['cost'] ?? '').toString(),
              'price': (r['price'] ?? '').toString(),
              'stock': (r['stockQuantity'] ?? r['stock'] ?? '').toString(),
              'minStock':
                  (r['minStockLevel'] ?? r['minStock'] ?? '').toString(),
              'expiryDate': (r['expiryDate'] ?? r['expiry'] ?? '').toString(),
              'supplier': (r['supplier'] ?? '').toString(),
              'warehouse': (r['warehouse'] ?? '').toString(),
              'status': (r['status'] ?? 'active').toString(),
            })
        .toList();

    await BulkDraftStore.save(rows);
    if (!mounted) return;
    Navigator.pop(context);
    Navigator.push(
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

  void _handleAutoFill() {
    if (_selectedRowIndex == null || _selectedRowIndex! >= _parsedRows.length)
      return;
    final row = _parsedRows[_selectedRowIndex!];
    Navigator.pop(context, row);
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
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _kBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Row(
        children: [
          const Icon(Icons.storefront_outlined, color: _kBlue, size: 18),
          const SizedBox(width: 8),
          Text(
            '${context.tr('target_location')}:',
            style: GoogleFonts.outfit(
                fontSize: 13, fontWeight: FontWeight.w600, color: _kInk),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<_LocationOption?>(
                isExpanded: true,
                isDense: true,
                value: _selectedLocation,
                hint: Text(context.tr('all_locations'),
                    style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                items: [
                  DropdownMenuItem<_LocationOption?>(
                    value: null,
                    child: Text(context.tr('all_locations'),
                        style:
                            GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                  ),
                  ...locations.map((loc) => DropdownMenuItem<_LocationOption?>(
                        value: loc,
                        child: Text(loc.name,
                            style: GoogleFonts.outfit(
                                fontSize: 12,
                                color: _kInk,
                                fontWeight: FontWeight.w500)),
                      )),
                ],
                onChanged: (val) => setState(() => _selectedLocation = val),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints:
          BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Drag indicator
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: _kBorder,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Title
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: _kBlue.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.table_chart_outlined,
                    color: _kBlue, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.tr('excel_import_title'),
                      style: GoogleFonts.outfit(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: _kInk),
                    ),
                    Text(
                      context.tr('excel_import_subtitle'),
                      style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, color: _kSlate, size: 20),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // File Picker Banner
          GestureDetector(
            onTap: _isParsing || _isUploading ? null : _pickFile,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: _fileBytes != null ? const Color(0xFFF0FDF4) : _kBg,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color:
                      _fileBytes != null ? const Color(0xFF16A34A) : _kBorder,
                  width: _fileBytes != null ? 1.5 : 1,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    _fileBytes != null
                        ? Icons.description_outlined
                        : Icons.cloud_upload_outlined,
                    color:
                        _fileBytes != null ? const Color(0xFF16A34A) : _kBlue,
                    size: 24,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _fileName ?? context.tr('select_excel_file'),
                          style: GoogleFonts.outfit(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: _fileBytes != null
                                ? const Color(0xFF16A34A)
                                : _kInk,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (_parsedRows.isNotEmpty)
                          Text(
                            '${_parsedRows.length} items parsed',
                            style: GoogleFonts.outfit(
                                fontSize: 12, color: const Color(0xFF16A34A)),
                          )
                        else if (_fileName == null)
                          Text(
                            '.xlsx, .xls, .csv',
                            style: GoogleFonts.outfit(
                                fontSize: 12, color: _kSlate),
                          ),
                      ],
                    ),
                  ),
                  ElevatedButton(
                    onPressed: _isParsing || _isUploading ? null : _pickFile,
                    style: ElevatedButton.styleFrom(
                      backgroundColor:
                          _fileBytes != null ? Colors.white : _kBlue,
                      foregroundColor: _fileBytes != null
                          ? const Color(0xFF16A34A)
                          : Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                        side: _fileBytes != null
                            ? const BorderSide(color: Color(0xFF16A34A))
                            : BorderSide.none,
                      ),
                    ),
                    child: Text(_fileBytes != null ? 'Change' : 'Browse',
                        style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
            ),
          ),

          if (_parseError != null) ...[
            const SizedBox(height: 8),
            Text(_parseError!,
                style: GoogleFonts.outfit(
                    fontSize: 12, color: const Color(0xFFDC2626))),
          ],

          const SizedBox(height: 12),

          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.info_outline, color: _kBlue, size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        context.tr('template_headers_info'),
                        style: GoogleFonts.outfit(
                            fontSize: 11, color: const Color(0xFF1E40AF)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton.icon(
                      onPressed: _isParsing || _isUploading
                          ? null
                          : () => _downloadTemplate('csv'),
                      icon: const Icon(Icons.table_view_outlined, size: 16),
                      label: Text(context.tr('export_csv')),
                    ),
                    OutlinedButton.icon(
                      onPressed: _isParsing || _isUploading
                          ? null
                          : () => _downloadTemplate('pdf'),
                      icon: const Icon(Icons.picture_as_pdf_outlined, size: 16),
                      label: Text(context.tr('download_pdf')),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Location picker
          if (_parsedRows.isNotEmpty) ...[
            _buildLocationPicker(),
            const SizedBox(height: 16),
          ],

          // Parsed rows preview header
          if (_parsedRows.isNotEmpty) ...[
            Row(
              children: [
                Text(
                  context
                      .tr('parsed_products')
                      .replaceFirst('{count}', '${_parsedRows.length}'),
                  style: GoogleFonts.outfit(
                      fontSize: 14, fontWeight: FontWeight.w700, color: _kInk),
                ),
                if (widget.enableAutoFill) ...[
                  const Spacer(),
                  Text(
                    context.tr('select_row_to_fill'),
                    style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 8),

            // Rows list
            Flexible(
              child: Container(
                constraints: const BoxConstraints(maxHeight: 220),
                decoration: BoxDecoration(
                  border: Border.all(color: _kBorder),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: _parsedRows.length,
                  separatorBuilder: (_, __) =>
                      const Divider(height: 1, color: _kBorder),
                  itemBuilder: (_, index) {
                    final item = _parsedRows[index];
                    final isSelected = _selectedRowIndex == index;
                    return ListTile(
                      dense: true,
                      selected: isSelected,
                      selectedTileColor: _kBlue.withValues(alpha: 0.08),
                      onTap: widget.enableAutoFill
                          ? () => setState(() => _selectedRowIndex = index)
                          : null,
                      leading: CircleAvatar(
                        radius: 14,
                        backgroundColor: isSelected ? _kBlue : _kBg,
                        child: Text(
                          '${index + 1}',
                          style: GoogleFonts.outfit(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: isSelected ? Colors.white : _kSlate,
                          ),
                        ),
                      ),
                      title: Text(
                        item['name'] ?? '',
                        style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: _kInk),
                      ),
                      subtitle: Text(
                        '${item['category']} · Unit: ${item['unit']} · SKU: ${item['sku']}',
                        style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                      ),
                      trailing: Text(
                        'ETB ${item['price']}',
                        style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: _kBlue),
                      ),
                    );
                  },
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Actions
          if (_isParsing || _isUploading) ...[
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(12),
                    child: CircularProgressIndicator())),
          ] else if (_parsedRows.isNotEmpty) ...[
            Column(
              children: [
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: _openInBulkEntry,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _kBlue,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: const Icon(Icons.edit_note_outlined, size: 22),
                    label: Text(
                      context
                          .tr('edit_in_bulk_entry')
                          .replaceAll('{count}', '${_parsedRows.length}'),
                      style: GoogleFonts.outfit(
                          fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    if (widget.enableAutoFill)
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _selectedRowIndex != null
                              ? _handleAutoFill
                              : null,
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            side: const BorderSide(color: _kBlue, width: 1.5),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12)),
                          ),
                          child: Text(
                            context.tr('auto_fill_form'),
                            style: GoogleFonts.outfit(
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                                color: _kBlue),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                    if (widget.enableAutoFill) const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _handleBulkUpload,
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          side: const BorderSide(color: _kBorder),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        child: Text(
                          context
                              .tr('import_all')
                              .replaceFirst('{count}', '${_parsedRows.length}'),
                          style: GoogleFonts.outfit(
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                              color: _kInk),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
