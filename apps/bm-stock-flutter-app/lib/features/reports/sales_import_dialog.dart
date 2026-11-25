import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/providers/branch_provider.dart';
import '../../core/providers/product_provider.dart';
import '../../core/services/file_download.dart' as fd;
import '../../core/services/sale_service.dart';
import '../../core/services/sales_import_service.dart';
import '../../core/widgets/app_toast.dart';

const _kBlue = Color(0xFF025EA7);
const _kInk = Color(0xFF0F172A);
const _kSlate = Color(0xFF64748B);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);
const _kGreen = Color(0xFF16A34A);
const _kRed = Color(0xFFDC2626);
const _kAmber = Color(0xFFD97706);

class SalesImportDialog extends StatefulWidget {
  final Future<void> Function(List<ImportedSaleRecord> records)? onImportConfirmed;

  const SalesImportDialog({
    super.key,
    this.onImportConfirmed,
  });

  static Future<List<ImportedSaleRecord>?> show(
    BuildContext context, {
    Future<void> Function(List<ImportedSaleRecord> records)? onImportConfirmed,
  }) {
    return showModalBottomSheet<List<ImportedSaleRecord>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => SalesImportDialog(onImportConfirmed: onImportConfirmed),
    );
  }

  @override
  State<SalesImportDialog> createState() => _SalesImportDialogState();
}

class _SalesImportDialogState extends State<SalesImportDialog> {
  bool _isParsing = false;
  bool _isImporting = false;
  String? _errorMessage;

  String? _selectedFileName;
  int? _selectedFileSize;
  String? _selectedFileType;
  List<ImportedSaleRecord> _parsedRecords = [];

  String? _targetLocationId;
  String? _targetLocationType; // 'shop' or 'warehouse'
  String _targetPaymentFallback = 'cash';
  bool _syncToDatabase = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final bp = context.read<BranchProvider>();
      if (bp.shops.isNotEmpty) {
        _targetLocationId = bp.shops.first.id;
        _targetLocationType = 'shop';
      } else if (bp.warehouses.isNotEmpty) {
        _targetLocationId = bp.warehouses.first.id;
        _targetLocationType = 'warehouse';
      }
      setState(() {});
    });
  }

  Future<void> _pickFile({List<String>? allowedExtensions}) async {
    setState(() {
      _isParsing = true;
      _errorMessage = null;
    });

    try {
      final result = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: allowedExtensions ?? ['csv', 'xlsx', 'xls', 'pdf'],
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
          _errorMessage = 'Could not read file data. Please select another file.';
        });
        return;
      }

      final records = await SalesImportService.parseFile(
        bytes: bytes,
        fileName: file.name,
      );

      final ext = file.name.split('.').last.toUpperCase();

      setState(() {
        _selectedFileName = file.name;
        _selectedFileSize = bytes.length;
        _selectedFileType = ext;
        _parsedRecords = records;
        _isParsing = false;
        _errorMessage = null;
      });
    } catch (e) {
      setState(() {
        _isParsing = false;
        _errorMessage = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _downloadSampleCsv() async {
    try {
      final bytes = SalesImportService.generateSampleCsv();
      final downloaded = await fd.downloadBytes(
        bytes,
        'sales_import_sample_template.csv',
        'text/csv',
      );
      if (downloaded && mounted) {
        showAppToast(context, 'Sample CSV downloaded successfully!', type: AppToastType.success);
      }
    } catch (e) {
      if (mounted) {
        showAppToast(context, 'Failed to download sample CSV: $e', type: AppToastType.error);
      }
    }
  }

  Future<void> _confirmImport() async {
    if (_parsedRecords.isEmpty) return;

    setState(() => _isImporting = true);

    try {
      // 1. If user enabled syncing with backend database, attempt to push matched records
      if (_syncToDatabase) {
        final products = context.read<ProductProvider>().products;
        final saleService = SaleService();

        for (final r in _parsedRecords) {
          // Find matching product by name (case-insensitive)
          final matchedProduct = products.where((p) {
            return p.name.trim().toLowerCase() == r.productName.trim().toLowerCase();
          }).firstOrNull;

          if (matchedProduct != null) {
            try {
              final payload = <String, dynamic>{
                'items': [
                  {
                    'productId': matchedProduct.id,
                    'quantity': r.quantity,
                    'unitPrice': r.unitPrice > 0 ? r.unitPrice : matchedProduct.price,
                  }
                ],
                'paymentType': r.paymentType,
                'saleDate': r.saleDate,
                'note': 'Imported from ${r.source.toUpperCase()} (${r.invoiceNumber})',
              };

              if (_targetLocationType == 'warehouse' && _targetLocationId != null) {
                payload['warehouseId'] = _targetLocationId;
              } else if (_targetLocationType == 'shop' && _targetLocationId != null) {
                payload['shopId'] = _targetLocationId;
              }

              await saleService.create(payload);
            } catch (_) {
              // Ignore individual row network sync error; still preserve in report records
            }
          }
        }
      }

      // 2. Persist locally to SharedPreferences for reports screen aggregation
      await SalesImportService.addImportedSales(_parsedRecords);

      // 3. Callback to parent screen if provided
      if (widget.onImportConfirmed != null) {
        await widget.onImportConfirmed!(_parsedRecords);
      }

      if (mounted) {
        showAppToast(
          context,
          context.tr('sales_imported_success').replaceAll('{count}', '${_parsedRecords.length}'),
          type: AppToastType.success,
        );
        Navigator.pop(context, _parsedRecords);
      }
    } catch (e) {
      if (mounted) {
        showAppToast(context, 'Import failed: $e', type: AppToastType.error);
      }
    } finally {
      if (mounted) setState(() => _isImporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final maxHeight = media.size.height * 0.90;

    return Container(
      constraints: BoxConstraints(maxHeight: maxHeight),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle bar
            const SizedBox(height: 12),
            Container(
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: _kBorder,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 14),

            // Top Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: _kBlue.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.file_upload_outlined, color: _kBlue, size: 22),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          context.tr('import_csv_pdf'),
                          style: GoogleFonts.outfit(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: _kInk,
                          ),
                        ),
                        Text(
                          _parsedRecords.isNotEmpty
                              ? '${_parsedRecords.length} transactions ready to review'
                              : 'Select CSV, Excel or PDF sales report',
                          style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: _kSlate),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            const Divider(color: _kBorder, height: 24),

            // Content body
            Flexible(
              child: _isParsing
                  ? _buildLoadingState()
                  : _parsedRecords.isNotEmpty
                      ? _buildPreviewState()
                      : _buildPickState(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadingState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 48),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(color: _kBlue),
            const SizedBox(height: 16),
            Text(
              'Parsing sales file...',
              style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w600, color: _kInk),
            ),
            const SizedBox(height: 6),
            Text(
              'Extracting transactions, quantities, and totals',
              style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPickState() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_errorMessage != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _kRed.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _kRed.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: _kRed, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: GoogleFonts.outfit(fontSize: 12, color: _kRed, fontWeight: FontWeight.w500),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          Text(
            'CHOOSE IMPORT SOURCE',
            style: GoogleFonts.outfit(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.8,
              color: _kSlate,
            ),
          ),
          const SizedBox(height: 12),

          // CSV / Excel Option Card
          _OptionCard(
            icon: Icons.table_chart_outlined,
            iconBg: _kGreen.withValues(alpha: 0.12),
            iconColor: _kGreen,
            title: context.tr('import_from_csv'),
            subtitle: context.tr('import_from_csv_desc'),
            badgeText: 'RECOMMENDED',
            badgeColor: _kGreen,
            onTap: () => _pickFile(allowedExtensions: ['csv', 'xlsx', 'xls']),
          ),
          const SizedBox(height: 12),

          // PDF Option Card
          _OptionCard(
            icon: Icons.picture_as_pdf_outlined,
            iconBg: _kRed.withValues(alpha: 0.12),
            iconColor: _kRed,
            title: context.tr('import_from_pdf'),
            subtitle: context.tr('import_from_pdf_desc'),
            badgeText: 'PDF REPORT',
            badgeColor: _kRed,
            onTap: () => _pickFile(allowedExtensions: ['pdf']),
          ),
          const SizedBox(height: 12),

          // Download Template Card
          _OptionCard(
            icon: Icons.file_download_outlined,
            iconBg: _kBlue.withValues(alpha: 0.12),
            iconColor: _kBlue,
            title: context.tr('download_sample_csv'),
            subtitle: context.tr('download_sample_csv_desc'),
            badgeText: 'TEMPLATE',
            badgeColor: _kBlue,
            onTap: _downloadSampleCsv,
          ),
          const SizedBox(height: 20),

          // Universal file selector button
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _pickFile(),
              icon: const Icon(Icons.folder_open_outlined, size: 18),
              label: Text(
                'Browse All Files (.csv, .xlsx, .pdf)',
                style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: _kInk,
                side: const BorderSide(color: _kBorder),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPreviewState() {
    final totalAmount = _parsedRecords.fold<double>(0, (sum, r) => sum + r.totalAmount);
    final totalQty = _parsedRecords.fold<int>(0, (sum, r) => sum + r.quantity);

    final bp = context.watch<BranchProvider>();
    final locations = [
      ...bp.shops.map((s) => {'id': s.id, 'name': s.name, 'type': 'shop', 'label': '${s.name} (Shop)'}),
      ...bp.warehouses.map((w) => {'id': w.id, 'name': w.name, 'type': 'warehouse', 'label': '${w.name} (Warehouse)'}),
    ];

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            children: [
              // File Info Pill
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _kBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _kBorder),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: _selectedFileType == 'PDF' ? _kRed : _kGreen,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        _selectedFileType ?? 'FILE',
                        style: GoogleFonts.outfit(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _selectedFileName ?? 'Sales File',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk),
                          ),
                          if (_selectedFileSize != null)
                            Text(
                              '${(_selectedFileSize! / 1024).toStringAsFixed(1)} KB • ${_parsedRecords.length} records parsed',
                              style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                            ),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: () => setState(() {
                        _parsedRecords = [];
                        _selectedFileName = null;
                        _errorMessage = null;
                      }),
                      child: Text(
                        'Change',
                        style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: _kBlue),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Summary Stats Row
              Row(
                children: [
                  Expanded(
                    child: _MetricBadge(
                      label: 'RECORDS',
                      value: '${_parsedRecords.length}',
                      color: _kBlue,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _MetricBadge(
                      label: 'TOTAL REVENUE',
                      value: 'ETB ${NumberFormat('#,##0').format(totalAmount)}',
                      color: _kGreen,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _MetricBadge(
                      label: 'TOTAL QTY',
                      value: '$totalQty pcs',
                      color: _kAmber,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Configuration Card
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _kBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'IMPORT SETTINGS',
                      style: GoogleFonts.outfit(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.6,
                        color: _kSlate,
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Destination Location
                    if (locations.isNotEmpty) ...[
                      Row(
                        children: [
                          const Icon(Icons.storefront_outlined, size: 16, color: _kSlate),
                          const SizedBox(width: 6),
                          Text('Target Branch:', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                          const SizedBox(width: 10),
                          Expanded(
                            child: DropdownButtonHideUnderline(
                              child: DropdownButton<String>(
                                isDense: true,
                                isExpanded: true,
                                value: _targetLocationId,
                                style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: _kInk),
                                items: locations.map((loc) {
                                  return DropdownMenuItem<String>(
                                    value: loc['id'],
                                    child: Text(loc['label']!),
                                  );
                                }).toList(),
                                onChanged: (val) {
                                  if (val == null) return;
                                  final match = locations.firstWhere((l) => l['id'] == val);
                                  setState(() {
                                    _targetLocationId = val;
                                    _targetLocationType = match['type'];
                                  });
                                },
                              ),
                            ),
                          ),
                        ],
                      ),
                      const Divider(height: 16, color: _kBorder),
                    ],

                    // Payment Method Fallback
                    Row(
                      children: [
                        const Icon(Icons.payment_outlined, size: 16, color: _kSlate),
                        const SizedBox(width: 6),
                        Text('Payment Fallback:', style: GoogleFonts.outfit(fontSize: 12, color: _kSlate)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              isDense: true,
                              isExpanded: true,
                              value: _targetPaymentFallback,
                              style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: _kInk),
                              items: const [
                                DropdownMenuItem(value: 'cash', child: Text('Cash')),
                                DropdownMenuItem(value: 'bank_transfer', child: Text('Bank Transfer')),
                                DropdownMenuItem(value: 'mobile_money', child: Text('Mobile Money')),
                                DropdownMenuItem(value: 'credit', child: Text('Credit')),
                              ],
                              onChanged: (val) {
                                if (val != null) setState(() => _targetPaymentFallback = val);
                              },
                            ),
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 16, color: _kBorder),

                    // Sync to Database switch
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      title: Text(
                        context.tr('sync_to_database'),
                        style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: _kInk),
                      ),
                      subtitle: Text(
                        'Automatically link rows matching products to inventory',
                        style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                      ),
                      value: _syncToDatabase,
                      activeThumbColor: _kBlue,
                      onChanged: (val) => setState(() => _syncToDatabase = val),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Preview Table Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'PARSED TRANSACTIONS (${_parsedRecords.length})',
                    style: GoogleFonts.outfit(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.6,
                      color: _kSlate,
                    ),
                  ),
                  Text(
                    'Showing first 30',
                    style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // List of parsed transactions
              ..._parsedRecords.take(30).map((r) {
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: _kBorder),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: _kBlue.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.receipt_outlined, color: _kBlue, size: 18),
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
                                    r.productName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: _kInk),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: (r.paymentType == 'credit' ? _kAmber : _kGreen).withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    r.paymentType.toUpperCase(),
                                    style: GoogleFonts.outfit(
                                      fontSize: 9,
                                      fontWeight: FontWeight.bold,
                                      color: r.paymentType == 'credit' ? _kAmber : _kGreen,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 3),
                            Row(
                              children: [
                                Text(
                                  '${r.invoiceNumber} • ${r.customerName}',
                                  style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                                ),
                                const Spacer(),
                                Text(
                                  '${r.quantity} pcs @ ETB ${r.unitPrice.toStringAsFixed(0)}',
                                  style: GoogleFonts.outfit(fontSize: 11, color: _kSlate),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        'ETB ${NumberFormat('#,##0').format(r.totalAmount)}',
                        style: GoogleFonts.outfit(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: _kInk,
                        ),
                      ),
                    ],
                  ),
                );
              }),
              const SizedBox(height: 16),
            ],
          ),
        ),

        // Bottom Action Bar
        Container(
          padding: const EdgeInsets.all(16),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: _kBorder)),
          ),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _isImporting ? null : () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _kSlate,
                    side: const BorderSide(color: _kBorder),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(
                    'Cancel',
                    style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton.icon(
                  onPressed: _isImporting ? null : _confirmImport,
                  icon: _isImporting
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.check_circle_outline, size: 20),
                  label: Text(
                    _isImporting ? 'Importing...' : 'Confirm & Import (${_parsedRecords.length})',
                    style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kBlue,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _OptionCard extends StatelessWidget {
  final IconData icon;
  final Color iconBg;
  final Color iconColor;
  final String title;
  final String subtitle;
  final String? badgeText;
  final Color? badgeColor;
  final VoidCallback onTap;

  const _OptionCard({
    required this.icon,
    required this.iconBg,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    this.badgeText,
    this.badgeColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _kBorder),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: iconColor, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          title,
                          style: GoogleFonts.outfit(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: _kInk,
                          ),
                        ),
                      ),
                      if (badgeText != null) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: (badgeColor ?? _kBlue).withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            badgeText!,
                            style: GoogleFonts.outfit(
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              color: badgeColor ?? _kBlue,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: GoogleFonts.outfit(fontSize: 12, color: _kSlate),
                  ),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_ios, size: 14, color: _kSlate),
          ],
        ),
      ),
    );
  }
}

class _MetricBadge extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _MetricBadge({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 9,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.outfit(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: _kInk,
            ),
          ),
        ],
      ),
    );
  }
}
