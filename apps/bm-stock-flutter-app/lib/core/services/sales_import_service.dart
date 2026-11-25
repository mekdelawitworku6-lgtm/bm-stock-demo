import 'dart:convert';
import 'dart:typed_data';
import 'package:archive/archive.dart';
import 'package:csv/csv.dart';
import 'package:excel/excel.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ImportedSaleRecord {
  final String id;
  final String invoiceNumber;
  final String saleDate;
  final String customerName;
  final String? customerPhone;
  final String productName;
  final int quantity;
  final double unitPrice;
  final double totalAmount;
  final String paymentType; // 'cash' | 'bank_transfer' | 'mobile_money' | 'credit'
  final String locationName;
  final String source; // 'csv' | 'pdf' | 'excel'
  final bool isImported;
  final String? notes;

  ImportedSaleRecord({
    required this.id,
    required this.invoiceNumber,
    required this.saleDate,
    required this.customerName,
    this.customerPhone,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.totalAmount,
    required this.paymentType,
    this.locationName = '',
    required this.source,
    this.isImported = true,
    this.notes,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'invoiceNumber': invoiceNumber,
        'saleDate': saleDate,
        'customerName': customerName,
        'customerPhone': customerPhone,
        'productName': productName,
        'quantity': quantity,
        'unitPrice': unitPrice,
        'totalAmount': totalAmount,
        'paymentType': paymentType,
        'locationName': locationName,
        'source': source,
        'isImported': isImported,
        'notes': notes,
      };

  factory ImportedSaleRecord.fromJson(Map<String, dynamic> json) => ImportedSaleRecord(
        id: json['id']?.toString() ?? '',
        invoiceNumber: json['invoiceNumber']?.toString() ?? '',
        saleDate: json['saleDate']?.toString() ?? '',
        customerName: json['customerName']?.toString() ?? 'Walk-in Customer',
        customerPhone: json['customerPhone']?.toString(),
        productName: json['productName']?.toString() ?? 'General Sale',
        quantity: (json['quantity'] as num?)?.toInt() ?? 1,
        unitPrice: (json['unitPrice'] as num?)?.toDouble() ?? 0.0,
        totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0.0,
        paymentType: json['paymentType']?.toString() ?? 'cash',
        locationName: json['locationName']?.toString() ?? '',
        source: json['source']?.toString() ?? 'csv',
        isImported: json['isImported'] != false,
        notes: json['notes']?.toString(),
      );

  Map<String, dynamic> toSaleJson({String? warehouseId, String? shopId, String? matchedProductId}) {
    return {
      'invoiceNumber': invoiceNumber,
      'customerName': customerName,
      if (customerPhone != null && customerPhone!.isNotEmpty) 'customerPhone': customerPhone,
      'paymentType': paymentType,
      'totalAmount': totalAmount,
      'advancePayment': paymentType == 'credit' ? 0.0 : totalAmount,
      'remainingBalance': paymentType == 'credit' ? totalAmount : 0.0,
      'saleDate': saleDate,
      'status': paymentType == 'credit' ? 'pending' : 'completed',
      'warehouseName': locationName.isNotEmpty ? locationName : 'Main Warehouse',
      'items': [
        {
          'id': 'item-$id',
          'productId': matchedProductId ?? '',
          'productName': productName,
          'quantity': quantity,
          'unitPrice': unitPrice,
          'total': totalAmount,
        }
      ],
      'isImported': true,
      'source': source,
    };
  }
}

class SalesImportService {
  static const String _storageKey = 'bm_imported_sales_records_v1';

  static Future<List<ImportedSaleRecord>> getImportedSales() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_storageKey);
      if (raw == null || raw.isEmpty) return [];
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        return decoded
            .map((item) => ImportedSaleRecord.fromJson(Map<String, dynamic>.from(item as Map)))
            .toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  static Future<void> saveImportedSales(List<ImportedSaleRecord> sales) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final encoded = jsonEncode(sales.map((s) => s.toJson()).toList());
      await prefs.setString(_storageKey, encoded);
    } catch (_) {}
  }

  static Future<void> addImportedSales(List<ImportedSaleRecord> newSales) async {
    final existing = await getImportedSales();
    final combined = [...existing, ...newSales];
    await saveImportedSales(combined);
  }

  static Future<void> clearImportedSales() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_storageKey);
    } catch (_) {}
  }

  /// Checks if a date correlates with the current date (recorded within 24 hours)
  static bool isSaleWithin24Hours(dynamic dateVal) {
    if (dateVal == null) return false;
    DateTime? targetDate;
    if (dateVal is DateTime) {
      targetDate = dateVal;
    } else if (dateVal is int) {
      targetDate = DateTime.fromMillisecondsSinceEpoch(
        dateVal > 100000000000 ? dateVal : dateVal * 1000,
      );
    } else if (dateVal is String) {
      final s = dateVal.trim();
      if (s.isEmpty) return false;

      final now = DateTime.now();
      final dateOnlyRegExp = RegExp(r'^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$');
      final dmyRegExp = RegExp(r'^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$');
      final match1 = dateOnlyRegExp.firstMatch(s);
      final match2 = dmyRegExp.firstMatch(s);

      if (match1 != null) {
        final y = int.tryParse(match1.group(1)!);
        final m = int.tryParse(match1.group(2)!);
        final d = int.tryParse(match1.group(3)!);
        if (y == now.year && m == now.month && d == now.day) {
          return true;
        }
      } else if (match2 != null) {
        final d = int.tryParse(match2.group(1)!);
        final m = int.tryParse(match2.group(2)!);
        final y = int.tryParse(match2.group(3)!);
        if (y == now.year && m == now.month && d == now.day) {
          return true;
        }
      }

      targetDate = DateTime.tryParse(s);
      if (targetDate == null && s.contains(' ')) {
        targetDate = DateTime.tryParse(s.replaceFirst(' ', 'T'));
      }
    }

    if (targetDate == null) return false;

    final now = DateTime.now();
    final diff = now.difference(targetDate);
    final isWithin24Hours = diff.inHours >= -4 && diff.inHours <= 24 && diff.inMilliseconds <= 24 * 3600 * 1000;
    final isSameDate = targetDate.year == now.year && targetDate.month == now.month && targetDate.day == now.day;

    return isWithin24Hours || isSameDate;
  }

  static Uint8List generateSampleCsv() {
    final now = DateTime.now();
    final rows = [
      [
        'Invoice Number',
        'Date',
        'Customer Name',
        'Customer Phone',
        'Product Name',
        'Quantity',
        'Unit Price',
        'Total Amount',
        'Payment Type',
        'Location',
        'Notes'
      ],
      [
        'INV-2026-001',
        DateFormat('yyyy-MM-dd HH:mm:ss').format(now),
        'Abebe Kebede',
        '0911223344',
        'Cement 50kg Dangote',
        '10',
        '850.00',
        '8500.00',
        'cash',
        'Main Shop',
        "Recorded today (within 24h) - added to Today's Sales"
      ],
      [
        'INV-2026-002',
        DateFormat('yyyy-MM-dd HH:mm:ss').format(now.subtract(const Duration(hours: 2))),
        'Tadesse Alemu',
        '0922334455',
        'Iron Bar 12mm',
        '25',
        '620.00',
        '15500.00',
        'bank_transfer',
        'Central Warehouse',
        "Recorded 2h ago (within 24h) - added to Today's Sales"
      ],
      [
        'INV-2026-003',
        DateFormat('yyyy-MM-dd HH:mm:ss').format(now.subtract(const Duration(days: 2))),
        'Walk-in Customer',
        '',
        'Ceramic Tiles 60x60',
        '40',
        '450.00',
        '18000.00',
        'credit',
        'Main Shop',
        'Historical sale (48h ago) - included in reports only'
      ],
    ];
    final csvStr = const ListToCsvConverter(eol: '\n').convert(rows);
    return Uint8List.fromList(utf8.encode(csvStr));
  }

  static Future<List<ImportedSaleRecord>> parseFile({
    required List<int> bytes,
    required String fileName,
  }) async {
    final ext = fileName.split('.').last.toLowerCase();
    if (ext == 'csv') {
      return parseCsv(bytes, fileName);
    } else if (ext == 'xlsx' || ext == 'xls') {
      return parseExcel(bytes, fileName);
    } else if (ext == 'pdf') {
      return parsePdf(bytes, fileName);
    } else {
      throw Exception('Unsupported file format ($ext). Please choose a CSV, Excel (.xlsx, .xls) or PDF file.');
    }
  }

  static List<ImportedSaleRecord> parseCsv(List<int> bytes, String fileName) {
    var content = utf8.decode(bytes, allowMalformed: true);
    if (content.startsWith('\uFEFF')) {
      content = content.substring(1);
    }
    content = content.replaceAll('\r\n', '\n').replaceAll('\r', '\n');

    final rawRows = const CsvToListConverter(eol: '\n', shouldParseNumbers: false).convert(content);
    if (rawRows.isEmpty) {
      throw Exception('CSV file is empty');
    }

    // Find headers
    int headerIndex = 0;
    while (headerIndex < rawRows.length &&
        rawRows[headerIndex].every((c) => c.toString().trim().isEmpty)) {
      headerIndex++;
    }
    if (headerIndex >= rawRows.length) {
      throw Exception('No header row found in CSV');
    }

    final headers = rawRows[headerIndex].map((h) => _normalizeKey(h.toString())).toList();
    final records = <ImportedSaleRecord>[];

    for (int i = headerIndex + 1; i < rawRows.length; i++) {
      final row = rawRows[i];
      if (row.isEmpty || row.every((c) => c.toString().trim().isEmpty)) continue;

      final map = <String, dynamic>{};
      for (int c = 0; c < headers.length && c < row.length; c++) {
        final key = headers[c];
        if (key.isNotEmpty) {
          map[key] = row[c]?.toString().trim() ?? '';
        }
      }

      final rec = _recordFromMap(map, fileName, i, source: 'csv');
      if (rec != null) {
        records.add(rec);
      }
    }

    if (records.isEmpty) {
      throw Exception('No valid sales records could be extracted from this CSV file. Please check column headers.');
    }

    return records;
  }

  static List<ImportedSaleRecord> parseExcel(List<int> bytes, String fileName) {
    final excel = Excel.decodeBytes(bytes);
    if (excel.tables.isEmpty) {
      throw Exception('Excel workbook contains no sheets');
    }

    final sheetName = excel.tables.keys.first;
    final sheet = excel.tables[sheetName];
    if (sheet == null || sheet.rows.isEmpty) {
      throw Exception('Excel sheet is empty');
    }

    final rawRows = sheet.rows;
    int headerIndex = 0;
    while (headerIndex < rawRows.length &&
        rawRows[headerIndex].every((c) => c?.value?.toString().trim().isEmpty ?? true)) {
      headerIndex++;
    }
    if (headerIndex >= rawRows.length) {
      throw Exception('No header row found in Excel');
    }

    final headers = rawRows[headerIndex]
        .map((cell) => _normalizeKey(cell?.value?.toString() ?? ''))
        .toList();

    final records = <ImportedSaleRecord>[];

    for (int i = headerIndex + 1; i < rawRows.length; i++) {
      final row = rawRows[i];
      if (row.isEmpty || row.every((c) => c?.value?.toString().trim().isEmpty ?? true)) continue;

      final map = <String, dynamic>{};
      for (int c = 0; c < headers.length && c < row.length; c++) {
        final key = headers[c];
        if (key.isNotEmpty) {
          map[key] = row[c]?.value?.toString().trim() ?? '';
        }
      }

      final rec = _recordFromMap(map, fileName, i, source: 'excel');
      if (rec != null) {
        records.add(rec);
      }
    }

    if (records.isEmpty) {
      throw Exception('No valid sales records found in Excel sheet. Please verify columns.');
    }

    return records;
  }

  static List<ImportedSaleRecord> parsePdf(List<int> bytes, String fileName) {
    final textTokens = _extractTextTokensFromPdf(bytes);
    if (textTokens.isEmpty) {
      throw Exception('No readable text streams found in the PDF. Please ensure the PDF is a text document or export as CSV/Excel.');
    }

    final records = <ImportedSaleRecord>[];

    // Join text and break into lines
    final fullText = textTokens.join(' \n ');
    final lines = fullText
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();

    // Match patterns
    final invRegex = RegExp(r'\b(INV[-_A-Za-z0-9]+|BILL[-_0-9]+|SALE[-_0-9]+|#[0-9]{3,}|REC[-_0-9]+)\b', caseSensitive: false);
    final dateRegex = RegExp(r'\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b');
    final amountRegex = RegExp(r'(?:ETB|USD|EUR)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2}))', caseSensitive: false);

    int rowIdx = 1;
    for (int i = 0; i < lines.length; i++) {
      final line = lines[i];

      // Check if line looks like a sale entry
      final invMatch = invRegex.firstMatch(line);
      final dateMatch = dateRegex.firstMatch(line);
      final amtMatches = amountRegex.allMatches(line).toList();

      if (amtMatches.isNotEmpty) {
        // Attempt to extract numbers
        double totalAmount = 0.0;
        double unitPrice = 0.0;
        int qty = 1;

        // Clean numbers
        final numbers = <double>[];
        for (final m in amtMatches) {
          final raw = m.group(1)?.replaceAll(',', '') ?? '';
          final val = double.tryParse(raw);
          if (val != null && val > 0) numbers.add(val);
        }

        if (numbers.isEmpty) continue;

        if (numbers.length >= 3) {
          // Typically: Qty, UnitPrice, TotalAmount
          qty = numbers[0].toInt();
          unitPrice = numbers[1];
          totalAmount = numbers[2];
        } else if (numbers.length == 2) {
          unitPrice = numbers[0];
          totalAmount = numbers[1];
        } else {
          totalAmount = numbers.last;
        }

        if (totalAmount <= 0) continue;

        final inv = invMatch?.group(0) ?? 'PDF-REC-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}-$rowIdx';
        final dateStr = dateMatch?.group(0) ?? DateFormat('yyyy-MM-dd').format(DateTime.now());

        // Extract customer or product from remaining text
        String cleanedText = line
            .replaceAll(invRegex, '')
            .replaceAll(dateRegex, '')
            .replaceAll(amountRegex, '')
            .replaceAll(RegExp(r'[\s,;|]+'), ' ')
            .trim();

        String productName = 'Product Item $rowIdx';
        String customerName = 'Walk-in Customer';

        if (cleanedText.isNotEmpty) {
          final words = cleanedText.split(' ').where((w) => w.length > 1).toList();
          if (words.length >= 2) {
            productName = words.take(words.length > 4 ? 4 : words.length).join(' ');
          } else if (words.isNotEmpty) {
            productName = words.first;
          }
        }

        // Detect payment type
        String payment = 'cash';
        final lineLower = line.toLowerCase();
        if (lineLower.contains('bank') || lineLower.contains('transfer') || lineLower.contains('cbe') || lineLower.contains('boa')) {
          payment = 'bank_transfer';
        } else if (lineLower.contains('telebirr') || lineLower.contains('mobile') || lineLower.contains('mpesa')) {
          payment = 'mobile_money';
        } else if (lineLower.contains('credit') || lineLower.contains('debt') || lineLower.contains('unpaid')) {
          payment = 'credit';
        }

        records.add(ImportedSaleRecord(
          id: 'pdf-imp-$rowIdx-${DateTime.now().millisecondsSinceEpoch}',
          invoiceNumber: inv,
          saleDate: _normalizeDate(dateStr),
          customerName: customerName,
          productName: productName,
          quantity: qty > 0 ? qty : 1,
          unitPrice: unitPrice > 0 ? unitPrice : (totalAmount / (qty > 0 ? qty : 1)),
          totalAmount: totalAmount,
          paymentType: payment,
          source: 'pdf',
          isImported: true,
        ));
        rowIdx++;
      }
    }

    if (records.isEmpty) {
      throw Exception('Could not extract tabular sales entries from PDF. Please check the PDF contents or upload as CSV/Excel.');
    }

    return records;
  }

  static List<String> _extractTextTokensFromPdf(List<int> bytes) {
    final tokens = <String>[];
    final binaryStr = String.fromCharCodes(bytes);

    void extractBtEt(String content) {
      final btRegex = RegExp(r'BT([\s\S]*?)ET');
      for (final match in btRegex.allMatches(content)) {
        final chunk = match.group(1) ?? '';

        // (text) Tj
        final tjRegex = RegExp(r'\(([\s\S]*?)\)\s*Tj');
        for (final m in tjRegex.allMatches(chunk)) {
          final clean = _cleanPdfStr(m.group(1) ?? '');
          if (clean.isNotEmpty) tokens.add(clean);
        }

        // [(text)...] TJ
        final tjArrRegex = RegExp(r'\[([\s\S]*?)\]\s*TJ');
        for (final m in tjArrRegex.allMatches(chunk)) {
          final inner = m.group(1) ?? '';
          final strRegex = RegExp(r'\(([\s\S]*?)\)');
          final parts = <String>[];
          for (final sm in strRegex.allMatches(inner)) {
            final part = _cleanPdfStr(sm.group(1) ?? '');
            if (part.isNotEmpty) parts.add(part);
          }
          final combined = parts.join(' ').trim();
          if (combined.isNotEmpty) tokens.add(combined);
        }

        // (text)' or (text)"
        final quoteRegex = RegExp(r'\(([\s\S]*?)\)\s*[\x27\x22]');
        for (final m in quoteRegex.allMatches(chunk)) {
          final clean = _cleanPdfStr(m.group(1) ?? '');
          if (clean.isNotEmpty) tokens.add(clean);
        }
      }
    }

    // 1. Uncompressed
    extractBtEt(binaryStr);

    // 2. FlateDecode compressed streams
    final streamRegex = RegExp(r'stream\r?\n([\s\S]*?)\r?\nendstream');
    for (final match in streamRegex.allMatches(binaryStr)) {
      final streamRaw = match.group(1) ?? '';
      if (streamRaw.isEmpty) continue;
      try {
        final streamBytes = Uint8List.fromList(streamRaw.codeUnits);
        List<int>? decompressed;
        try {
          decompressed = ZLibDecoder().decodeBytes(streamBytes);
        } catch (_) {
          try {
            decompressed = Inflate(streamBytes).getBytes();
          } catch (_) {}
        }
        if (decompressed != null && decompressed.isNotEmpty) {
          final decompStr = String.fromCharCodes(decompressed);
          extractBtEt(decompStr);
        }
      } catch (_) {}
    }

    return tokens;
  }

  static String _cleanPdfStr(String raw) {
    return raw
        .replaceAll(r'\(', '(')
        .replaceAll(r'\)', ')')
        .replaceAll(r'\\', r'\')
        .replaceAll(r'\r', '')
        .replaceAll(r'\n', ' ')
        .replaceAll(r'\t', ' ')
        .trim();
  }

  static String _normalizeKey(String k) {
    return k.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
  }

  static String _normalizeDate(dynamic val) {
    if (val == null) return DateTime.now().toIso8601String();
    final str = val.toString().trim();
    if (str.isEmpty) return DateTime.now().toIso8601String();
    try {
      final parsed = DateTime.parse(str);
      return parsed.toIso8601String();
    } catch (_) {
      try {
        final parts = str.split(RegExp(r'[-/.]'));
        if (parts.length == 3) {
          if (parts[0].length == 4) {
            // yyyy-mm-dd
            final y = int.parse(parts[0]);
            final m = int.parse(parts[1]);
            final d = int.parse(parts[2]);
            return DateTime(y, m, d).toIso8601String();
          } else if (parts[2].length == 4) {
            // dd-mm-yyyy
            final d = int.parse(parts[0]);
            final m = int.parse(parts[1]);
            final y = int.parse(parts[2]);
            return DateTime(y, m, d).toIso8601String();
          }
        }
      } catch (_) {}
    }
    return DateTime.now().toIso8601String();
  }

  static ImportedSaleRecord? _recordFromMap(
    Map<String, dynamic> map,
    String fileName,
    int rowIndex, {
    required String source,
  }) {
    String getVal(List<String> keys, [String fallback = '']) {
      for (final k in keys) {
        if (map.containsKey(k) && map[k] != null && map[k].toString().trim().isNotEmpty) {
          return map[k].toString().trim();
        }
      }
      return fallback;
    }

    final invoiceNumber = getVal(
      ['invoicenumber', 'invoiceno', 'invoice', 'invno', 'inv', 'billno', 'bill', 'refno', 'referencenumber', 'ref', 'orderno', 'receiptno', 'id'],
      'IMP-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}-$rowIndex',
    );

    final rawDate = getVal(['date', 'saledate', 'createdat', 'timestamp', 'time', 'invoicedate', 'datetime']);
    final saleDate = _normalizeDate(rawDate);

    final customerName = getVal(
      ['customername', 'customer', 'clientname', 'client', 'buyer', 'name', 'customerdetails'],
      'Walk-in Customer',
    );

    final customerPhone = getVal(['customerphone', 'phone', 'phonenumber', 'mobile', 'tel', 'cell']);

    final productName = getVal(
      ['productname', 'product', 'itemname', 'item', 'description', 'itemdescription', 'particulars'],
      'General Product',
    );

    final qtyStr = getVal(['quantity', 'qty', 'count', 'units', 'amountunits', 'pieces', 'pcs'], '1');
    final quantity = int.tryParse(qtyStr.replaceAll(RegExp(r'[^0-9]'), '')) ?? 1;

    final unitPriceStr = getVal(['unitprice', 'price', 'rate', 'unitcost', 'cost'], '0');
    final rawUnitPrice = double.tryParse(unitPriceStr.replaceAll(',', '')) ?? 0.0;

    final totalStr = getVal(['totalamount', 'total', 'amount', 'grandtotal', 'subtotal', 'netamount', 'totalprice'], '0');
    var rawTotal = double.tryParse(totalStr.replaceAll(',', '')) ?? 0.0;

    var unitPrice = rawUnitPrice;
    var totalAmount = rawTotal;

    if (totalAmount <= 0 && unitPrice > 0) {
      totalAmount = unitPrice * (quantity > 0 ? quantity : 1);
    } else if (unitPrice <= 0 && totalAmount > 0 && quantity > 0) {
      unitPrice = totalAmount / quantity;
    }

    if (totalAmount <= 0) {
      return null; // Skip non-monetary or empty rows
    }

    final rawPayment = getVal(['paymenttype', 'payment', 'paymentmethod', 'method', 'mode', 'paytype'], 'cash').toLowerCase();
    String paymentType = 'cash';
    if (rawPayment.contains('credit') || rawPayment.contains('debt') || rawPayment.contains('unpaid')) {
      paymentType = 'credit';
    } else if (rawPayment.contains('bank') || rawPayment.contains('transfer') || rawPayment.contains('cbe') || rawPayment.contains('boa')) {
      paymentType = 'bank_transfer';
    } else if (rawPayment.contains('telebirr') || rawPayment.contains('mobile') || rawPayment.contains('mpesa')) {
      paymentType = 'mobile_money';
    }

    final locationName = getVal(['locationname', 'location', 'branch', 'shop', 'warehouse'], '');

    return ImportedSaleRecord(
      id: '$source-imp-$rowIndex-${DateTime.now().millisecondsSinceEpoch}',
      invoiceNumber: invoiceNumber,
      saleDate: saleDate,
      customerName: customerName,
      customerPhone: customerPhone.isNotEmpty ? customerPhone : null,
      productName: productName,
      quantity: quantity > 0 ? quantity : 1,
      unitPrice: unitPrice,
      totalAmount: totalAmount,
      paymentType: paymentType,
      locationName: locationName,
      source: source,
      isImported: true,
    );
  }
}
