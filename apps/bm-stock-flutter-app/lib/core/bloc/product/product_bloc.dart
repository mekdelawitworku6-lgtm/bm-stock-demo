import 'package:flutter_bloc/flutter_bloc.dart';
import '../../services/product_service.dart';
import 'product_event.dart';
import 'product_state.dart';

export 'product_event.dart';
export 'product_state.dart';

class ProductBloc extends Bloc<ProductEvent, ProductState> {
  final ProductService _productService = ProductService();

  ProductBloc() : super(const ProductState()) {
    on<ProductsLoadRequested>(_onLoadProducts);
    on<ProductAddRequested>(_onAddProduct);
    on<ProductUpdateRequested>(_onUpdateProduct);
    on<ProductDeleteRequested>(_onDeleteProduct);
    on<ProductStockOverviewLoad>(_onLoadStockOverview);
    on<ProductFindByBarcode>(_onFindByBarcode);
    on<ProductBulkImportRequested>(_onBulkImport);
  }

  Future<void> _onLoadProducts(ProductsLoadRequested event, Emitter<ProductState> emit) async {
    emit(state.copyWith(isLoading: true, clearError: true));
    try {
      final products = await _productService.getAll(search: event.search, category: event.category);
      emit(state.copyWith(isLoading: false, products: products));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: 'Failed to load products: $e'));
    }
  }

  Future<void> _onAddProduct(ProductAddRequested event, Emitter<ProductState> emit) async {
    emit(state.copyWith(isLoading: true, clearError: true, lastCreatedProduct: () => null));
    try {
      final created = await _productService.create(event.data);
      add(const ProductsLoadRequested());
      emit(state.copyWith(
        isLoading: false,
        lastActionSuccess: true,
        lastCreatedProduct: () => created,
        clearAction: true,
      ));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: 'Failed to add product: $e', lastActionSuccess: false, clearAction: true));
    }
  }

  Future<void> _onUpdateProduct(ProductUpdateRequested event, Emitter<ProductState> emit) async {
    emit(state.copyWith(isLoading: true, clearError: true));
    try {
      await _productService.update(event.id, event.data);
      add(const ProductsLoadRequested());
      emit(state.copyWith(isLoading: false, lastActionSuccess: true, clearAction: true));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: 'Failed to update product: $e', lastActionSuccess: false, clearAction: true));
    }
  }

  Future<void> _onDeleteProduct(ProductDeleteRequested event, Emitter<ProductState> emit) async {
    emit(state.copyWith(isLoading: true, clearError: true, lastActionSuccess: null));
    try {
      await _productService.delete(event.id);
      final updatedProducts = state.products.where((p) => p.id != event.id).toList();
      emit(state.copyWith(
        isLoading: false,
        products: updatedProducts,
        lastActionSuccess: true,
        clearAction: true,
      ));
    } catch (e) {
      emit(state.copyWith(
        isLoading: false,
        error: 'Failed to delete product: $e',
        lastActionSuccess: false,
        clearAction: true,
      ));
    }
  }

  Future<void> _onLoadStockOverview(ProductStockOverviewLoad event, Emitter<ProductState> emit) async {
    emit(state.copyWith(isLoading: true, clearError: true));
    try {
      final results = await Future.wait([
        _productService.getLowStock(),
        _productService.getExpired(),
      ]);
      emit(state.copyWith(
        isLoading: false,
        lowStockProducts: results[0],
        expiredProducts: results[1],
      ));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: 'Failed to load stock overview: $e'));
    }
  }

  Future<void> _onFindByBarcode(ProductFindByBarcode event, Emitter<ProductState> emit) async {
    emit(state.copyWith(isLoading: true, clearError: true, foundProduct: () => null));
    try {
      final product = await _productService.findByBarcode(event.barcode);
      emit(state.copyWith(isLoading: false, foundProduct: () => product));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: 'Lookup failed: $e'));
    }
  }

  Future<void> _onBulkImport(ProductBulkImportRequested event, Emitter<ProductState> emit) async {
    emit(state.copyWith(isLoading: true, clearError: true, bulkImportResult: () => null));
    try {
      final res = await _productService.bulkImport(event.bytes, event.filename);
      add(const ProductsLoadRequested());
      emit(state.copyWith(isLoading: false, lastActionSuccess: true, bulkImportResult: () => res));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: 'Bulk import failed: $e', lastActionSuccess: false));
    }
  }
}
