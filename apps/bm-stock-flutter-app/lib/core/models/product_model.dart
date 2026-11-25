class ProductModel {
  final String id;
  final String type;
  final String name;
  final String? description;
  final String sku;
  final String? barcode;
  final String category;
  final String unit;
  final double price;
  final double cost;
  final double profitMargin;
  final int stockQuantity;
  final int minStockLevel;
  final String? reminderDate;
  final String? supplierId;
  final String? supplierName;
  final bool isExpired;
  final String? expiryDate;
  final String status;
  final double taxRate;
  final double commissionRate;
  final String commissionType;
  final bool trackStock;
  final Map<String, dynamic> metadata;
  final String? imageUrl;
  final String createdAt;
  final String updatedAt;

  ProductModel({
    required this.id,
    required this.type,
    required this.name,
    this.description,
    required this.sku,
    this.barcode,
    required this.category,
    required this.unit,
    required this.price,
    required this.cost,
    required this.profitMargin,
    required this.stockQuantity,
    required this.minStockLevel,
    this.reminderDate,
    this.supplierId,
    this.supplierName,
    required this.isExpired,
    this.expiryDate,
    required this.status,
    required this.taxRate,
    required this.commissionRate,
    this.commissionType = 'percent',
    required this.trackStock,
    this.metadata = const {},
    this.imageUrl,
    required this.createdAt,
    required this.updatedAt,
  });

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    final meta = json['metadata'] is Map ? Map<String, dynamic>.from(json['metadata'] as Map) : <String, dynamic>{};
    if (json['brand'] != null && json['brand'].toString().trim().isNotEmpty && meta['brand'] == null) {
      meta['brand'] = json['brand'].toString().trim();
    }

    return ProductModel(
      id: json['id'] ?? '',
      type: json['type'] ?? 'product',
      name: json['name'] ?? '',
      description: json['description'],
      sku: json['sku'] ?? '',
      barcode: json['barcode'],
      category: json['category'] ?? '',
      unit: json['unit'] ?? '',
      price: _toDouble(json['price'] ?? json['sellingPrice']),
      cost: _toDouble(json['cost'] ?? json['costPrice'] ?? json['purchasePrice']),
      profitMargin: _toDouble(json['profitMargin']),
      stockQuantity: json['stockQuantity'] is num
          ? (json['stockQuantity'] as num).toInt()
          : (json['quantity'] is num
              ? (json['quantity'] as num).toInt()
              : (int.tryParse('${json['stockQuantity'] ?? json['quantity'] ?? 0}') ?? 0)),
      minStockLevel: json['minStockLevel'] is num
          ? (json['minStockLevel'] as num).toInt()
          : (int.tryParse('${json['minStockLevel'] ?? 0}') ?? 0),
      reminderDate: json['reminderDate'],
      supplierId: json['supplierId'],
      supplierName: json['supplierName'],
      isExpired: json['isExpired'] ?? false,
      expiryDate: json['expiryDate'],
      status: json['status'] ?? 'available',
      taxRate: _toDouble(json['taxRate']),
      commissionRate: _toDouble(json['commissionRate']),
      commissionType: (json['commissionType'] as String?) ?? (json['metadata'] is Map && json['metadata']['commissionType'] is String ? json['metadata']['commissionType'] as String : 'percent'),
      trackStock: json['trackStock'] ?? true,
      metadata: meta,
      imageUrl: json['imageUrl'],
      createdAt: json['createdAt'] ?? '',
      updatedAt: json['updatedAt'] ?? '',
    );
  }

  String get brand {
    final b = metadata['brand'] ?? metadata['Brand'];
    if (b != null && b.toString().trim().isNotEmpty) return b.toString().trim();
    return '';
  }

  bool get isLowStock => stockQuantity <= minStockLevel;

  bool get calculatedIsExpired {
    if (isExpired) return true;
    if (expiryDate != null && expiryDate!.trim().isNotEmpty) {
      try {
        final exp = DateTime.parse(expiryDate!.trim());
        final today = DateTime.now();
        final expDay = DateTime(exp.year, exp.month, exp.day);
        final nowDay = DateTime(today.year, today.month, today.day);
        return expDay.isBefore(nowDay) || expDay.isAtSameMomentAs(nowDay);
      } catch (_) {}
    }
    return false;
  }

  bool get isCloseToExpiry {
    if (calculatedIsExpired) return true;
    if (expiryDate != null && expiryDate!.trim().isNotEmpty) {
      try {
        final exp = DateTime.parse(expiryDate!.trim());
        final now = DateTime.now();
        final diff = exp.difference(now).inDays;
        if (diff <= 30) return true;
      } catch (_) {}
    }
    if (reminderDate != null && reminderDate!.trim().isNotEmpty) {
      try {
        final rem = DateTime.parse(reminderDate!.trim());
        final now = DateTime.now();
        if (!rem.isAfter(now)) return true;
      } catch (_) {}
    }
    return false;
  }

  int? get daysUntilExpiry {
    if (expiryDate != null && expiryDate!.trim().isNotEmpty) {
      try {
        final exp = DateTime.parse(expiryDate!.trim());
        final today = DateTime.now();
        final expDay = DateTime(exp.year, exp.month, exp.day);
        final nowDay = DateTime(today.year, today.month, today.day);
        return expDay.difference(nowDay).inDays;
      } catch (_) {}
    }
    return null;
  }

  bool get isInactiveOrDeleted {
    final st = status.toLowerCase().trim();
    if (st == 'inactive' || st == 'deleted' || st == 'discontinued' || st == 'unavailable') return true;
    if (metadata['isDeleted'] == true || metadata['is_deleted'] == true || metadata['deletedAt'] != null) return true;
    return false;
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0.0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0.0;
  }
}
