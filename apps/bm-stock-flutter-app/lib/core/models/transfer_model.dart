class TransferModel {
  final String id;
  final String type;
  final String status;
  final int quantity;
  final String? note;
  final String? rejectionReason;
  final String productId;
  final String productName;
  final String productSku;
  final String? fromWarehouseId;
  final String? fromWarehouseName;
  final String? toWarehouseId;
  final String? toWarehouseName;
  final String? fromShopId;
  final String? fromShopName;
  final String? toShopId;
  final String? toShopName;
  final String requestedById;
  final String requestedByName;
  final String? approvedById;
  final String? approvedByName;
  final String createdAt;
  final String updatedAt;
  final String createdAtRaw;

  TransferModel({
    required this.id,
    required this.type,
    required this.status,
    required this.quantity,
    this.note,
    this.rejectionReason,
    required this.productId,
    required this.productName,
    required this.productSku,
    this.fromWarehouseId,
    this.fromWarehouseName,
    this.toWarehouseId,
    this.toWarehouseName,
    this.fromShopId,
    this.fromShopName,
    this.toShopId,
    this.toShopName,
    required this.requestedById,
    required this.requestedByName,
    this.approvedById,
    this.approvedByName,
    required this.createdAt,
    required this.updatedAt,
    this.createdAtRaw = '',
  });

  static String _asString(dynamic value) {
    if (value == null) return '';
    if (value is String) return value;
    return value.toString();
  }

  static int _asInt(dynamic value) {
    if (value is int) return value;
    return int.tryParse('$value') ?? 0;
  }

  factory TransferModel.fromJson(Map<String, dynamic> json) {
    final rawCreatedAt = _asString(json['createdAt']);
    final rawUpdatedAt = _asString(json['updatedAt']);
    return TransferModel(
      id: _asString(json['id']),
      type: _asString(json['type']),
      status: _asString(json['status']).isEmpty ? 'pending' : _asString(json['status']),
      quantity: _asInt(json['quantity']),
      note: json['note']?.toString(),
      rejectionReason: json['rejectionReason']?.toString(),
      productId: _asString(json['productId']),
      productName: _asString(json['productName']),
      productSku: _asString(json['productSku']),
      fromWarehouseId: json['fromWarehouseId']?.toString(),
      fromWarehouseName: json['fromWarehouseName']?.toString(),
      toWarehouseId: json['toWarehouseId']?.toString(),
      toWarehouseName: json['toWarehouseName']?.toString(),
      fromShopId: json['fromShopId']?.toString(),
      fromShopName: json['fromShopName']?.toString(),
      toShopId: json['toShopId']?.toString(),
      toShopName: json['toShopName']?.toString(),
      requestedById: _asString(json['requestedById']),
      requestedByName: _asString(json['requestedByName']),
      approvedById: json['approvedById']?.toString(),
      approvedByName: json['approvedByName']?.toString(),
      createdAt: _formatDate(rawCreatedAt),
      updatedAt: _formatDate(rawUpdatedAt),
      createdAtRaw: rawCreatedAt,
    );
  }

  static String _formatDate(dynamic value) {
    if (value == null) return '';
    if (value is String) {
      final parsed = DateTime.tryParse(value);
      if (parsed != null) {
        return '${parsed.year}-${parsed.month.toString().padLeft(2, '0')}-${parsed.day.toString().padLeft(2, '0')} '
            '${parsed.hour.toString().padLeft(2, '0')}:${parsed.minute.toString().padLeft(2, '0')}';
      }
      return value;
    }
    return value.toString();
  }

  String get fromName => fromWarehouseName ?? fromShopName ?? 'Unknown';
  String get toName => toWarehouseName ?? toShopName ?? 'Unknown';

  bool get isPending => status == 'pending';
  bool get isCompleted => status == 'completed';
  bool get isRejected => status == 'rejected';
}
