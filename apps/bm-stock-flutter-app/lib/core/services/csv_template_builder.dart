import 'dart:convert';
import 'package:csv/csv.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'report_export_service.dart';

class CsvTemplateBuilder {
  const CsvTemplateBuilder();

  static const productHeaders = <String>[
    'name',
    'sku',
    'barcode',
    'category',
    'brand',
    'unit',
    'cost',
    'price',
    'stock',
    'minStock',
    'expiryDate',
    'supplier',
    'warehouse',
    'status',
  ];

  static const productSampleRows = <Map<String, dynamic>>[
    {
      'name': 'Sample Product',
      'sku': 'PRD-SAMPLE-001',
      'barcode': '123456789',
      'category': 'General',
      'brand': 'Acme',
      'unit': 'piece',
      'cost': '10',
      'price': '25',
      'stock': '50',
      'minStock': '5',
      'supplier': '',
      'warehouse': '',
      'status': 'active',
    },
  ];

  Future<String> build(List<String> headers,
      {List<Map<String, dynamic>>? sampleRows}) async {
    final rows = <List<dynamic>>[
      headers,
      if (sampleRows != null)
        ...sampleRows.map((r) => headers.map((h) => r[h] ?? '').toList()),
    ];
    return const ListToCsvConverter().convert(rows);
  }

  Future<void> share(String csv, String filename) async {
    await _deliver(Uint8List.fromList(utf8.encode('\uFEFF$csv')), filename);
  }

  Future<void> downloadProductCsv() async {
    final csv = await build(productHeaders, sampleRows: productSampleRows);
    await share(csv, 'product_template.csv');
  }

  Future<void> downloadProductPdf(BuildContext context) async {
    final rows = productSampleRows
        .map((row) =>
            productHeaders.map<Object?>((header) => row[header] ?? '').toList())
        .toList();
    final bytes = await ReportExportService.buildPdf(
      context,
      'Product Import Template',
      [
        ReportSection(
          title: 'Products',
          columns: productHeaders,
          rows: rows,
        ),
      ],
      blueHeader: false,
    );
    await _deliver(bytes, 'product_template.pdf');
  }

  Future<void> _deliver(Uint8List bytes, String filename) async {
    final success = kIsWeb
        ? await ReportExportService.downloadBytes(bytes, filename)
        : await ReportExportService.shareBytes(bytes, filename);
    if (!success) {
      throw StateError('Unable to deliver $filename');
    }
  }
}
