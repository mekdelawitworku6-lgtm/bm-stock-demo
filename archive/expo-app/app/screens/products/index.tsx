import { Feather } from "@expo/vector-icons";
import { default as React, useCallback, useState } from "react";
import {
    Image,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import BackButton from "../../../components/BackButton";
import ErrorMessage from "../../../components/ErrorMessage";
import LoadingSpinner from "../../../components/LoadingSpinner";
import { COLORS } from "../../../constants/Colors";
import { useGetProductsQuery } from "../../../lib/Api/productApi";
import { useGetShopsQuery } from "../../../lib/Api/shopApi";
import { useGetWarehousesQuery } from "../../../lib/Api/warehouseApi";

interface ProductsScreenProps {
  navigation: any;
  route?: any;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  price: string; // API returns price as string
  stockQuantity: number;
  minStockLevel: number;
  expiryDate?: string;
  image?: string;
  category?: string;
  type?: string;
  status?: string;
}

interface FilterOption {
  id: string;
  name: string;
  type: 'warehouse' | 'shop' | 'status';
}

const ProductsScreen: React.FC<ProductsScreenProps> = ({ navigation, route }) => {
  const [searchText, setSearchText] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'warehouse' | 'shop' | 'lowStock' | 'expired'>('all');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch warehouses and shops for filter options
  const { data: warehousesData } = useGetWarehousesQuery({ page: 1, limit: 100, search: "" });
  const { data: shopsData } = useGetShopsQuery({ page: 1, limit: 100, search: "" });

  // Prepare filter options
  const filterOptions: FilterOption[] = [
    ...(warehousesData?.data?.data?.map((warehouse: any) => ({
      id: warehouse.id,
      name: warehouse.name,
      type: 'warehouse' as const,
    })) || []),
    ...(shopsData?.data?.data?.map((shop: any) => ({
      id: shop.id,
      name: shop.name,
      type: 'shop' as const,
    })) || []),
  ];

  // Build query parameters based on selected filters
  const buildQueryParams = useCallback(() => {
    const params: any = {
      page: 1,
      limit: 50,
      search: searchText,
    };

    switch (selectedFilter) {
      case 'lowStock':
        params.lowStock = true;
        break;
      case 'expired':
        params.expired = true;
        break;
      case 'warehouse':
        // For now, we'll use the general products endpoint
        // The warehouse/shop specific endpoints require special authorization
        break;
      case 'shop':
        // For now, we'll use the general products endpoint
        // The warehouse/shop specific endpoints require special authorization
        break;
    }

    return params;
  }, [selectedFilter, selectedLocation, searchText]);

  // Use appropriate query based on filter
  const queryParams = buildQueryParams();
  
  // Use the general products endpoint for all filters
  const { 
    data: productsData, 
    isLoading, 
    error, 
    refetch 
  } = useGetProductsQuery(queryParams);




  const ProductItem = React.memo<{ product: Product }>(({ product }) => {
    const stockQuantity = Number(product.stockQuantity) || 0;
    const minStockLevel = Number(product.minStockLevel) || 0;
    const isLowStock = stockQuantity <= minStockLevel;
    const isExpired = product.expiryDate && new Date(product.expiryDate) < new Date();
    
    return (
      <TouchableOpacity style={styles.productItem}>
        <View style={styles.productLeft}>
          <Image 
            source={{ 
              uri: product.image || "https://via.placeholder.com/50x50?text=No+Image" 
            }} 
            style={styles.productImage} 
          />
          <View style={styles.productDetails}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productSku}>SKU: {product.sku}</Text>
            {product.barcode && (
              <Text style={styles.productBarcode}>Barcode: {product.barcode}</Text>
            )}
            <View style={styles.productMeta}>
              {product.category && (
                <Text style={styles.productCategory}>{product.category}</Text>
              )}
              {product.type && (
                <Text style={styles.productType}>{product.type}</Text>
              )}
            </View>
          </View>
        </View>
        <View style={styles.productRight}>
          <TouchableOpacity style={styles.menuButton}>
            <Feather name="more-horizontal" size={20} color="#666" />
          </TouchableOpacity>
          <Text style={styles.productPrice}>ETB {parseFloat(product.price || '0').toFixed(2)}</Text>
          <View style={styles.stockContainer}>
            <Text style={[
              styles.productStock,
              isLowStock && styles.lowStockText,
              isExpired && styles.expiredText
            ]}>
              Stock: {stockQuantity}
            </Text>
            {(isLowStock || isExpired) && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>
                  {isExpired ? 'Expired' : 'Low Stock'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  });

  const FilterButton = React.memo<{ 
    title: string; 
    isActive: boolean; 
    onPress: () => void;
    count?: number;
  }>(({ title, isActive, onPress, count }) => (
    <TouchableOpacity 
      style={[styles.filterButton, isActive && styles.activeFilterButton]}
      onPress={onPress}
    >
      <Text style={[styles.filterButtonText, isActive && styles.activeFilterButtonText]}>
        {title}
      </Text>
      {count !== undefined && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  ));

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      await refetch();
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Error refreshing products:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, refetch]);

  const handleFilterChange = useCallback((filter: typeof selectedFilter) => {
    setSelectedFilter(filter);
    setSelectedLocation(null);
    setShowFilterModal(false);
  }, []);

  const handleLocationSelect = useCallback((locationId: string) => {
    setSelectedLocation(locationId);
    setShowFilterModal(false);
  }, []);

  const getFilterTitle = useCallback(() => {
    if (selectedFilter === 'warehouse' && selectedLocation) {
      const warehouse = warehousesData?.data?.data?.find((w: any) => w.id === selectedLocation);
      return warehouse ? `Warehouse: ${warehouse.name}` : 'Select Warehouse';
    }
    if (selectedFilter === 'shop' && selectedLocation) {
      const shop = shopsData?.data?.data?.find((s: any) => s.id === selectedLocation);
      return shop ? `Shop: ${shop.name}` : 'Select Shop';
    }
    return selectedFilter === 'all' ? 'All Products' : 
           selectedFilter === 'lowStock' ? 'Low Stock' :
           selectedFilter === 'expired' ? 'Expired' : 'Filter';
  }, [selectedFilter, selectedLocation, warehousesData, shopsData]);

  const getProductsCount = useCallback(() => {
    // After transformResponse, data structure is: response.data.data
    return productsData?.data?.length || 0;
  }, [productsData]);

  if (isLoading && !refreshing) {
    return <LoadingSpinner message="Loading products..." />;
  }

  // Show error state if there's an error
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.headerTitle}>Products</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading products</Text>
          <Text style={styles.errorDetails}>{JSON.stringify(error, null, 2)}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <BackButton />
          <Text style={styles.headerTitle}>Products</Text>
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Feather
                name="search"
                size={16}
                color="#999"
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search products..."
                placeholderTextColor="#999"
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
          <FilterButton
            title="All"
            isActive={selectedFilter === 'all'}
            onPress={() => handleFilterChange('all')}
            count={getProductsCount()}
          />
          <FilterButton
            title="Warehouse"
            isActive={selectedFilter === 'warehouse'}
            onPress={() => handleFilterChange('warehouse')}
          />
          <FilterButton
            title="Shops"
            isActive={selectedFilter === 'shop'}
            onPress={() => handleFilterChange('shop')}
          />
          <FilterButton
            title="Low Stock"
            isActive={selectedFilter === 'lowStock'}
            onPress={() => handleFilterChange('lowStock')}
          />
          <FilterButton
            title="Expired"
            isActive={selectedFilter === 'expired'}
            onPress={() => handleFilterChange('expired')}
          />
        </ScrollView>
      </View>

      {/* Location Selector */}
      {(selectedFilter === 'warehouse' || selectedFilter === 'shop') && (
        <View style={styles.locationSelector}>
          <TouchableOpacity 
            style={styles.locationButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Text style={styles.locationButtonText}>
              {getFilterTitle()}
            </Text>
            <Feather name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
        </View>
      )}

      {/* Error Handling */}
      {error && (
        <ErrorMessage
          message="Failed to load products. Please try again."
          onRetry={() => refetch()}
        />
      )}

      {/* Products List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.PRIMARY]}
            tintColor={COLORS.PRIMARY}
          />
        }
      >
        <View style={styles.productList}>
          {productsData?.data?.length > 0 ? (
            productsData.data.map((product: Product) => (
              <ProductItem key={product.id} product={product} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Feather name="package" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No products found</Text>
              <Text style={styles.emptyStateSubtext}>
                Try adjusting your search or filters
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Filter Modal */}
      {showFilterModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select {selectedFilter === 'warehouse' ? 'Warehouse' : 'Shop'}
              </Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Feather name="x" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalOptions}>
              {filterOptions
                .filter(option => option.type === selectedFilter)
                .map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={styles.modalOption}
                    onPress={() => handleLocationSelect(option.id)}
                  >
                    <Text style={styles.modalOptionText}>{option.name}</Text>
                    <Feather name="chevron-right" size={16} color="#999" />
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Add Product Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("AddShopItem")}
      >
        <Feather name="plus" size={20} color="white" style={styles.addIcon} />
        <Text style={styles.addButtonText}>Add Product</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginRight: 8,
  },
  searchContainer: {
    flex: 1,
    paddingBottom: 0,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 25,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#000",
    padding: 0,
  },
  filterContainer: {
    backgroundColor: "white",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  filterScrollView: {
    paddingHorizontal: 16,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  activeFilterButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  activeFilterButtonText: {
    color: "white",
  },
  countBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  countText: {
    fontSize: 12,
    color: "white",
    fontWeight: "500",
  },
  locationSelector: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  locationButtonText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  productList: {
    paddingHorizontal: 16,
  },
  productItem: {
    backgroundColor: "white",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  productLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  productImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 2,
  },
  productSku: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  productBarcode: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  productMeta: {
    flexDirection: "row",
    gap: 8,
  },
  productCategory: {
    fontSize: 11,
    color: "#999",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  productType: {
    fontSize: 11,
    color: "#999",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  productRight: {
    alignItems: "flex-end",
  },
  menuButton: {
    padding: 4,
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  stockContainer: {
    alignItems: "flex-end",
  },
  productStock: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  lowStockText: {
    color: "#FF6B35",
  },
  expiredText: {
    color: "#DC2626",
  },
  statusBadge: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  statusText: {
    fontSize: 10,
    color: "white",
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    color: "#666",
    fontWeight: "500",
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 8,
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    width: "80%",
    maxHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  modalOptions: {
    maxHeight: 300,
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalOptionText: {
    fontSize: 16,
    color: "#333",
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.PRIMARY,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  addIcon: {
    marginRight: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#DC2626",
    marginBottom: 16,
    textAlign: "center",
  },
  errorDetails: {
    fontSize: 12,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ProductsScreen;
