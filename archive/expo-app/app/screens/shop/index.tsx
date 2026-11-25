import { Feather } from "@expo/vector-icons";
import { default as React, useEffect, useState } from "react";
import {
    Alert,
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
import { useSelector } from "react-redux";
import BackButton from "../../../components/BackButton";
import { COLORS } from "../../../constants/Colors";
import { useDetachProductFromShopMutation, useGetShopByIdQuery, useGetShopsWithProductsQuery } from "../../../lib/Api/shopApi";
import { RootState } from "../../../lib/store";

interface ShopScreenProps {
  navigation: any;
  route?: any;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stockQuantity: number;
  imageUrl?: string;
  category?: string;
  description?: string;
}

interface Shop {
  id: string;
  name: string;
  location: string;
  warehouseName?: string;
  companyName: string;
  products?: Product[];
}

const ShopScreen: React.FC<ShopScreenProps> = ({ navigation, route }) => {
  const [searchText, setSearchText] = useState("");
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const { user } = useSelector((state: RootState) => state.auth);
  
  const [detachProduct, { isLoading: detaching }] = useDetachProductFromShopMutation();
  
  // Get shops with products
  const { 
    data: shopsData, 
    isLoading: shopsLoading, 
    error: shopsError,
    refetch: refetchShops 
  } = useGetShopsWithProductsQuery({
    page: 1,
    limit: 100,
    search: searchText,
  });

  // Get specific shop details if a shop is selected
  const { 
    data: shopDetails, 
    isLoading: shopDetailsLoading 
  } = useGetShopByIdQuery(
    { id: selectedShop?.id || '', search: searchText },
    { skip: !selectedShop?.id }
  );

  const shops: Shop[] = shopsData?.data || [];
  const currentShop = shopDetails || selectedShop;
  const products: Product[] = currentShop?.products || [];

  // Set the first shop as selected by default
  useEffect(() => {
    if (shops.length > 0 && !selectedShop) {
      setSelectedShop(shops[0]);
    }
  }, [shops, selectedShop]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchShops();
    } catch (error) {
      console.error('Error refreshing shops:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDetachProduct = async (product: Product) => {
    if (!selectedShop) return;

    Alert.alert(
      "Remove Product",
      `Are you sure you want to remove "${product.name}" from this shop?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await detachProduct({
                shopId: selectedShop.id,
                productId: product.id,
              }).unwrap();
              Alert.alert("Success", "Product removed from shop successfully");
              refetchShops();
            } catch (error: any) {
              console.error('Error detaching product:', error);
              Alert.alert("Error", error?.data?.message || "Failed to remove product");
            }
          },
        },
      ]
    );
  };

  const ProductItem = ({ product }: { product: Product }) => (
    <TouchableOpacity 
      style={styles.productItem}
      onPress={() => {
        // Navigate to product details or edit screen
        Alert.alert(
          "Product Details",
          `Name: ${product.name}\nSKU: ${product.sku}\nPrice: $${product.price}\nStock: ${product.stockQuantity}`,
          [{ text: "OK" }]
        );
      }}
    >
      <View style={styles.productLeft}>
        <Image 
          source={{ 
            uri: product.imageUrl || "https://picsum.photos/seed/" + product.id + "/100/100" 
          }} 
          style={styles.productImage} 
        />
        <View style={styles.productDetails}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productPn}>SKU: {product.sku}</Text>
          <Text style={styles.productStore}>
            {product.category ? `Category: ${product.category}` : 'No category'}
          </Text>
        </View>
      </View>
      <View style={styles.productRight}>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => {
            Alert.alert(
              "Product Actions",
              "What would you like to do?",
              [
                { text: "View Details", onPress: () => {
                  Alert.alert(
                    "Product Details",
                    `Name: ${product.name}\nSKU: ${product.sku}\nPrice: $${product.price}\nStock: ${product.stockQuantity}\nCategory: ${product.category || 'N/A'}\nDescription: ${product.description || 'N/A'}`,
                    [{ text: "OK" }]
                  );
                }},
                { text: "Edit Product", onPress: () => {
                  // Navigate to edit product screen
                  Alert.alert("Info", "Edit product functionality will be implemented");
                }},
                { text: "Remove from Shop", onPress: () => handleDetachProduct(product) },
                { text: "Cancel", style: "cancel" }
              ]
            );
          }}
        >
          <Feather name="more-horizontal" size={20} color="#666" />
        </TouchableOpacity>
        <Text style={styles.productQuantity}>Qty: {product.stockQuantity}</Text>
        <Text style={styles.productPrice}>${product.price}</Text>
      </View>
    </TouchableOpacity>
  );

  const ShopSelector = () => (
    <View style={styles.shopSelector}>
      <Text style={styles.shopSelectorLabel}>Current Shop:</Text>
      <TouchableOpacity 
        style={styles.shopSelectorButton}
        onPress={() => {
          Alert.alert(
            "Select Shop",
            "Choose a shop to view its products",
            shops.map(shop => ({
              text: shop.name,
              onPress: () => setSelectedShop(shop)
            })).concat([{ text: "Cancel", style: "cancel" }])
          );
        }}
      >
        <Text style={styles.shopSelectorText}>
          {selectedShop ? selectedShop.name : "Select Shop"}
        </Text>
        <Feather name="chevron-down" size={16} color="#666" />
      </TouchableOpacity>
    </View>
  );

  if (shopsLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <BackButton />
            <Text style={styles.headerTitle}>Shop</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading shops...</Text>
        </View>
      </View>
    );
  }

  if (shopsError) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <BackButton />
            <Text style={styles.headerTitle}>Shop</Text>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Failed to load shops</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
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
          <Text style={styles.headerTitle}>Shop</Text>
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

      {/* Shop Selector */}
      <ShopSelector />

      {/* Filter and Sort */}
      <View style={styles.filterSortContainer}>
        <TouchableOpacity style={styles.filterButton}>
          <Text style={styles.filterSortText}>Filter By</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.sortButton}>
          <Text style={styles.filterSortText}>Sort By</Text>
        </TouchableOpacity>
      </View>

      {/* Product List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.productList}>
          {products.length > 0 ? (
            products.map((product) => (
              <ProductItem key={product.id} product={product} />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Feather name="package" size={48} color="#999" />
              <Text style={styles.emptyText}>
                {selectedShop ? 'No products in this shop' : 'Select a shop to view products'}
              </Text>
              {selectedShop && (
                <TouchableOpacity 
                  style={styles.addProductButton}
                  onPress={() => navigation.navigate("AddShopItem", {
                    preSelectedLocation: {
                      id: selectedShop.id,
                      name: selectedShop.name,
                      type: "shop" as const
                    }
                  })}
                >
                  <Text style={styles.addProductButtonText}>Add Product</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Item Button */}
      {selectedShop && (
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("AddShopItem", {
          preSelectedLocation: {
              id: selectedShop.id,
              name: selectedShop.name,
            type: "shop" as const
          }
        })}
      >
        <Feather name="plus" size={20} color="white" style={styles.addIcon} />
        <Text style={styles.addButtonText}>Add item to shop</Text>
      </TouchableOpacity>
      )}
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
  backButton: {
    padding: 4,
    marginRight: 8,
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
  filterSortContainer: {
    backgroundColor: "white",
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 8,
  },
  filterButton: {
    flex: 1,
  },
  sortButton: {
    flex: 1,
    alignItems: "flex-end",
  },
  divider: {
    width: 1,
    backgroundColor: "#E0E0E0",
    marginHorizontal: 16,
  },
  filterSortText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
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
  productPn: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  productStore: {
    fontSize: 12,
    color: "#666",
  },
  productRight: {
    alignItems: "flex-end",
  },
  menuButton: {
    padding: 4,
    marginBottom: 8,
  },
  productQuantity: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  productPrice: {
    fontSize: 14,
    color: COLORS.PRIMARY,
    fontWeight: "600",
    marginTop: 2,
  },
  shopSelector: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  shopSelectorLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  shopSelectorButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  shopSelectorText: {
    fontSize: 16,
    color: "#000",
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: "#EF4444",
    marginTop: 16,
    marginBottom: 24,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    marginTop: 16,
    textAlign: "center",
  },
  addProductButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  addProductButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  addButtonContainer: {
    padding: 16,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  addButton: {
    backgroundColor: COLORS.PRIMARY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 8,
  },
  addIcon: {
    marginRight: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
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
});

export default ShopScreen;
