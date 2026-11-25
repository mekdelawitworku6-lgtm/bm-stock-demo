class BorrowingModel {
  final String id;
  final String productName;
  final String? productCategory;
  final String? productId;
  final int quantityTaken;
  final int quantityReturned;
  final int remainingQuantity;
  final String sellerName;
  final String? sellerPhone;
  final String dateTaken;
  final String? expectedReturnDate;
  final String? note;
  final String? warehouseId;
  final String? warehouseName;
  final String? shopId;
  final String? shopName;
  final String status;
  final String? recordedByName;
  final String createdAt;
  final String updatedAt;

  BorrowingModel({
    required this.id,
    required this.productName,
    this.productCategory,
    this.productId,
    required this.quantityTaken,
    required this.quantityReturned,
    required this.remainingQuantity,
    required this.sellerName,
    this.sellerPhone,
    required this.dateTaken,
    this.expectedReturnDate,
    this.note,
    this.warehouseId,
    this.warehouseName,
    this.shopId,
    this.shopName,
    required this.status,
    this.recordedByName,
    required this.createdAt,
    required this.updatedAt,
  });

  factory BorrowingModel.fromJson(Map<String, dynamic> json) {
    final taken = json['quantityTaken'] is int
        ? json['quantityTaken'] as int
        : int.tryParse('${json['quantityTaken']}') ?? 0;
    final returned = json['quantityReturned'] is int
        ? json['quantityReturned'] as int
        : int.tryParse('${json['quantityReturned']}') ?? 0;
    final remaining = json['remainingQuantity'] is int
        ? json['remainingQuantity'] as int
        : (taken - returned).clamp(0, taken);

    return BorrowingModel(
      id: json['id']?.toString() ?? '',
      productName: json['productName']?.toString() ?? '',
      productCategory: json['productCategory']?.toString(),
      productId: json['productId']?.toString(),
      quantityTaken: taken,
      quantityReturned: returned,
      remainingQuantity: remaining,
      sellerName: json['sellerName']?.toString() ?? '',
      sellerPhone: json['sellerPhone']?.toString(),
      dateTaken: json['dateTaken']?.toString() ?? '',
      expectedReturnDate: json['expectedReturnDate']?.toString(),
      note: json['note']?.toString(),
      warehouseId: json['warehouseId']?.toString(),
      warehouseName: json['warehouseName']?.toString(),
      shopId: json['shopId']?.toString(),
      shopName: json['shopName']?.toString(),
      status: json['status']?.toString() ?? 'active',
      recordedByName: json['recordedByName']?.toString(),
      createdAt: json['createdAt']?.toString() ?? '',
      updatedAt: json['updatedAt']?.toString() ?? '',
    );
  }

  String get locationName => warehouseName ?? shopName ?? '--';

  String get statusLabel {
    switch (status) {
      case 'partially_returned':
        return 'partially_returned';
      case 'fully_returned':
        return 'fully_returned';
      default:
        return 'active';
    }
  }

  bool get isFullyReturned => status == 'fully_returned' || remainingQuantity <= 0;
}
