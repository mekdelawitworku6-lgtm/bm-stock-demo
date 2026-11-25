import 'package:equatable/equatable.dart';

abstract class ProductEvent extends Equatable {
  const ProductEvent();
  @override
  List<Object?> get props => [];
}

class ProductsLoadRequested extends ProductEvent {
  final String? search;
  final String? category;
  const ProductsLoadRequested({this.search, this.category});
  @override
  List<Object?> get props => [search, category];
}

class ProductAddRequested extends ProductEvent {
  final Map<String, dynamic> data;
  const ProductAddRequested({required this.data});
  @override
  List<Object?> get props => [data];
}

class ProductUpdateRequested extends ProductEvent {
  final String id;
  final Map<String, dynamic> data;
  const ProductUpdateRequested({required this.id, required this.data});
  @override
  List<Object?> get props => [id, data];
}

class ProductDeleteRequested extends ProductEvent {
  final String id;
  const ProductDeleteRequested({required this.id});
  @override
  List<Object?> get props => [id];
}

class ProductStockOverviewLoad extends ProductEvent {}

class ProductFindByBarcode extends ProductEvent {
  final String barcode;
  const ProductFindByBarcode({required this.barcode});
  @override
  List<Object?> get props => [barcode];
}

class ProductBulkImportRequested extends ProductEvent {
  final List<int> bytes;
  final String filename;
  const ProductBulkImportRequested({required this.bytes, required this.filename});
  @override
  List<Object?> get props => [bytes, filename];
}
