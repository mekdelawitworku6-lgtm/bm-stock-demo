import 'package:equatable/equatable.dart';
import '../../models/product_model.dart';

class ProductState extends Equatable {
  final List<ProductModel> products;
  final List<ProductModel> lowStockProducts;
  final List<ProductModel> expiredProducts;
  final ProductModel? foundProduct;
  final ProductModel? lastCreatedProduct;
  final bool isLoading;
  final String? error;
  final bool? lastActionSuccess;
  final Map<String, dynamic>? bulkImportResult;

  const ProductState({
    this.products = const [],
    this.lowStockProducts = const [],
    this.expiredProducts = const [],
    this.foundProduct,
    this.lastCreatedProduct,
    this.isLoading = false,
    this.error,
    this.lastActionSuccess,
    this.bulkImportResult,
  });

  ProductState copyWith({
    List<ProductModel>? products,
    List<ProductModel>? lowStockProducts,
    List<ProductModel>? expiredProducts,
    ProductModel? Function()? foundProduct,
    ProductModel? Function()? lastCreatedProduct,
    bool? isLoading,
    String? error,
    bool? lastActionSuccess,
    Map<String, dynamic>? Function()? bulkImportResult,
    bool clearError = false,
    bool clearAction = false,
  }) {
    return ProductState(
      products: products ?? this.products,
      lowStockProducts: lowStockProducts ?? this.lowStockProducts,
      expiredProducts: expiredProducts ?? this.expiredProducts,
      foundProduct: foundProduct != null ? foundProduct() : this.foundProduct,
      lastCreatedProduct:
          lastCreatedProduct != null ? lastCreatedProduct() : this.lastCreatedProduct,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? (clearError ? null : this.error),
      lastActionSuccess: lastActionSuccess ?? (clearAction ? null : this.lastActionSuccess),
      bulkImportResult: bulkImportResult != null ? bulkImportResult() : this.bulkImportResult,
    );
  }

  @override
  List<Object?> get props => [products, lowStockProducts, expiredProducts, foundProduct, lastCreatedProduct, isLoading, error, lastActionSuccess, bulkImportResult];
}
