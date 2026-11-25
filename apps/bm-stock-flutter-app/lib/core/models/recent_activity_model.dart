import 'product_model.dart';

import 'sale_model.dart';
import 'transfer_model.dart';



enum RecentActivityType { sale, stockIn, stockOut, productAdded, transfer }



class RecentActivityItem {

  final String id;

  final RecentActivityType type;

  final DateTime occurredAt;

  final SaleModel? sale;

  final ProductModel? product;

  final String productName;

  final int? quantity;

  final String? locationName;

  final String? performedByName;

  final String? reason;

  final String? transactionId;

  final String? productId;

  final String? warehouseId;

  final String? shopId;

  final int? previousQuantity;

  final int? newQuantity;

  final String? referenceNumber;



  const RecentActivityItem({

    required this.id,

    required this.type,

    required this.occurredAt,

    this.sale,

    this.product,

    this.productName = '',

    this.quantity,

    this.locationName,

    this.performedByName,

    this.reason,

    this.transactionId,

    this.productId,

    this.warehouseId,

    this.shopId,

    this.previousQuantity,

    this.newQuantity,

    this.referenceNumber,

  });



  static DateTime _parseDate(dynamic value) {

    if (value == null) return DateTime.fromMillisecondsSinceEpoch(0);

    if (value is DateTime) return value;

    return DateTime.tryParse(value.toString()) ?? DateTime.fromMillisecondsSinceEpoch(0);

  }



  static int? _parseInt(dynamic value) {

    if (value == null) return null;

    if (value is int) return value;

    return int.tryParse(value.toString());

  }



  factory RecentActivityItem.fromSale(SaleModel sale) {

    return RecentActivityItem(

      id: 'sale-${sale.id}',

      type: RecentActivityType.sale,

      occurredAt: _parseDate(sale.createdAt),

      sale: sale,

      productName: sale.items.isNotEmpty ? sale.items.first.productName : '',

    );

  }



  factory RecentActivityItem.fromTransaction(Map<String, dynamic> tx) {

    final typeRaw = tx['type']?.toString() ?? '';

    final type = typeRaw == 'stock_out'

        ? RecentActivityType.stockOut

        : RecentActivityType.stockIn;

    final location = (tx['shopName']?.toString().isNotEmpty == true)

        ? tx['shopName'].toString()

        : tx['warehouseName']?.toString();



    return RecentActivityItem(

      id: 'tx-${tx['id']}',

      type: type,

      occurredAt: _parseDate(tx['createdAt']),

      productName: tx['productName']?.toString() ?? '',

      quantity: _parseInt(tx['quantity']),

      locationName: location,

      performedByName: tx['performedByName']?.toString(),

      reason: tx['reason']?.toString(),

      transactionId: tx['id']?.toString(),

      productId: tx['productId']?.toString(),

      warehouseId: tx['warehouseId']?.toString(),

      shopId: tx['shopId']?.toString(),

      previousQuantity: _parseInt(tx['previousQuantity']),

      newQuantity: _parseInt(tx['newQuantity']),

      referenceNumber: tx['referenceNumber']?.toString(),

    );

  }



  factory RecentActivityItem.fromProduct(ProductModel product) {

    return RecentActivityItem(

      id: 'product-${product.id}',

      type: RecentActivityType.productAdded,

      occurredAt: _parseDate(product.createdAt),

      product: product,

      productName: product.name,

      quantity: product.stockQuantity,

    );

  }



  factory RecentActivityItem.fromTransfer(TransferModel transfer) {
    final rawDate = transfer.createdAtRaw.isNotEmpty ? transfer.createdAtRaw : transfer.createdAt;
    return RecentActivityItem(
      id: 'transfer-${transfer.id}',
      type: RecentActivityType.transfer,
      occurredAt: _parseDate(rawDate),
      productName: transfer.productName,
      quantity: transfer.quantity,
      locationName: '${transfer.fromName} → ${transfer.toName}',
      performedByName: transfer.approvedByName?.isNotEmpty == true
          ? transfer.approvedByName
          : transfer.requestedByName,
      reason: transfer.note,
      transactionId: transfer.id,
    );
  }



  bool get isStockTransaction =>

      type == RecentActivityType.stockIn || type == RecentActivityType.stockOut;

}


