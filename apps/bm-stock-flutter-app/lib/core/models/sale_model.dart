class SaleItemModel {
  final String id;
  final String productId;
  final String productName;
  final String brand;
  final int quantity;
  final double unitPrice;
  final double total;

  SaleItemModel({
    required this.id,
    required this.productId,
    required this.productName,
    this.brand = '',
    required this.quantity,
    required this.unitPrice,
    required this.total,
  });

  factory SaleItemModel.fromJson(Map<String, dynamic> json) {
    return SaleItemModel(
      id: json['id']?.toString() ?? '',
      productId: json['productId']?.toString() ?? '',
      productName: json['productName']?.toString() ?? '',
      brand: json['brand']?.toString() ?? '',
      quantity: _toInt(json['quantity']),
      unitPrice: _toDouble(json['unitPrice']),
      total: _toDouble(json['total']),
    );
  }

  static int _toInt(dynamic v) {
    if (v == null) return 0;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString()) ?? 0;
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0.0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0.0;
  }
}

class SaleModel {
  final String id;
  final String? customerId;
  final String? invoiceNumber;
  final double totalAmount;
  final double taxAmount;
  final double subtotal;
  final double discountAmount;
  final double advancePayment;
  final double amountPaid;
  final double remainingBalance;
  final String saleDate;
  final String? dueDate;
  final String paymentType;
  final String status;
  final String? note;
  final String? receiptImageUrl;
  final String customerName;
  final String? customerPhone;
  final String warehouseName;
  final String? shopName;
  final String? salespersonName;
  final List<SaleItemModel> items;
  final double? lastPaymentAmount;
  final String? lastPaymentDate;
  final String createdAt;
  final String updatedAt;

  SaleModel({
    required this.id,
    this.customerId,
    this.invoiceNumber,
    required this.totalAmount,
    required this.taxAmount,
    this.subtotal = 0,
    this.discountAmount = 0,
    required this.advancePayment,
    this.amountPaid = 0,
    this.lastPaymentAmount,
    this.lastPaymentDate,
    required this.remainingBalance,
    required this.saleDate,
    this.dueDate,
    required this.paymentType,
    required this.status,
    this.note,
    this.receiptImageUrl,
    required this.customerName,
    this.customerPhone,
    required this.warehouseName,
    this.shopName,
    this.salespersonName,
    this.items = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  bool get isCreditSale => paymentType.toLowerCase() == 'credit';
  bool get hasOutstanding => remainingBalance > 0.01 && !_statusMeansPaid;
  bool get isFullyPaid => !hasOutstanding;
  bool get canAcceptPayment => hasOutstanding && status.toLowerCase() != 'cancelled';

  bool get _statusMeansPaid {
    final s = status.trim().toLowerCase().replaceAll(' ', '_');
    return const {
      'completed',
      'complete',
      'paid',
      'fully_paid',
      'settled',
      'closed',
    }.contains(s);
  }

  String creditStatusKey() {
    if (hasOutstanding) {
      final paidSoFar = amountPaid > 0.01
          ? amountPaid
          : (advancePayment > 0.01 ? advancePayment : (totalAmount - remainingBalance));
      if (paidSoFar > 0.01) {
        return 'partially_paid';
      }
      return 'not_paid';
    }
    return 'paid';
  }

  double get computedAmountPaid =>
      amountPaid > 0 ? amountPaid : _toDouble((totalAmount - remainingBalance).clamp(0, totalAmount));

  double get computedLastPaymentAmount {
    if (lastPaymentAmount != null && lastPaymentAmount! > 0) {
      return lastPaymentAmount!;
    }
    if (amountPaid > 0) return amountPaid;
    if (advancePayment > 0) return advancePayment;
    return _toDouble((totalAmount - remainingBalance).clamp(0, totalAmount));
  }

  factory SaleModel.fromJson(Map<String, dynamic> json) {
    final itemsJson = json['items'];
    final items = itemsJson is List
        ? itemsJson.map((e) => SaleItemModel.fromJson(Map<String, dynamic>.from(e as Map))).toList()
        : <SaleItemModel>[];

    final total = _toDouble(json['totalAmount'] ?? json['total_amount'] ?? json['revenue'] ?? json['total']);
    final paid = _toDouble(json['amountPaid'] ?? json['amount_paid'] ?? json['paid'] ?? json['paidAmount'] ?? json['paid_amount'] ?? json['collectedAmount']);
    final advance = _toDouble(json['advancePayment'] ?? json['advance_payment'] ?? json['advance'] ?? json['downPayment']);
    final rawRemaining = json['remainingBalance'] ?? json['remaining_balance'] ?? json['remaining'] ?? json['balance'] ?? json['outstanding'] ?? json['debt'];
    var remaining = _toDouble(rawRemaining);
    final status = (json['status']?.toString() ?? 'pending').toLowerCase();
    final normalizedStatus = status.trim().replaceAll(' ', '_');
    if (const {'completed', 'complete', 'paid', 'fully_paid', 'settled', 'closed'}.contains(normalizedStatus)) {
      remaining = 0;
    } else if (total > 0 && (paid > advance ? paid : advance) >= total - 0.01) {
      remaining = 0;
    } else if (rawRemaining != null && remaining <= 0.01) {
      remaining = 0;
    } else if (remaining < 0) {
      remaining = 0;
    }
    final resolvedPaid = paid > 0
        ? paid
        : _toDouble((total - remaining).clamp(0, total));

    return SaleModel(
      id: json['id'] ?? '',
      customerId: json['customerId']?.toString(),
      invoiceNumber: json['invoiceNumber']?.toString(),
      totalAmount: total,
      taxAmount: _toDouble(json['taxAmount']),
      subtotal: _toDouble(json['subtotal']),
      discountAmount: _toDouble(json['discountAmount']),
      advancePayment: advance,
      amountPaid: resolvedPaid,
      lastPaymentAmount: json['lastPaymentAmount'] != null ? _toDouble(json['lastPaymentAmount']) : null,
      lastPaymentDate: json['lastPaymentDate']?.toString(),
      remainingBalance: remaining,
      saleDate: json['saleDate']?.toString() ?? '',
      dueDate: json['dueDate']?.toString(),
      paymentType: json['paymentType']?.toString() ?? '',
      status: remaining <= 0.01 && status != 'cancelled' ? 'completed' : (json['status']?.toString() ?? 'pending'),
      note: json['note']?.toString(),
      receiptImageUrl: json['receiptImageUrl']?.toString(),
      customerName: json['customerName']?.toString() ?? '',
      customerPhone: json['customerPhone']?.toString(),
      warehouseName: json['warehouseName']?.toString() ?? '',
      shopName: json['shopName']?.toString(),
      salespersonName: json['salespersonName']?.toString(),
      items: items,
      createdAt: json['createdAt']?.toString() ?? '',
      updatedAt: json['updatedAt']?.toString() ?? '',
    );
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0.0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0.0;
  }
}
