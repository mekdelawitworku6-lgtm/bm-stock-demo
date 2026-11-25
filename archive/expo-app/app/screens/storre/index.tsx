"use client";

// Removed generic products query - now using warehouse-specific endpoint
import {
    useGetBranchTransfersQuery,
} from "@/lib/Api/transferApi";
import {
    useGetWarehousesQuery,
    useGetWarehouseWithProductsQuery,
} from "@/lib/Api/warehouseApi";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type React from "react";
import { useEffect, useState } from "react";
import {
    Image,
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSelector } from "react-redux";
import { COLORS } from "../../../constants/Colors";
import { RootState } from "../../../lib/store";

const SELECTED_STORE_KEY = 'selectedStore';

interface StoreScreenProps {
  navigation: any;
}

const StoreScreen: React.FC<StoreScreenProps> = ({ navigation }) => {
  // Get user from Redux store
  const { user } = useSelector((state: RootState) => state.auth);
  
  const [searchText, setSearchText] = useState("");
  const [showSelectBranches, setShowSelectBranches] = useState(false);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [showItemActions, setShowItemActions] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState(5);
  const [selectedBranches, setSelectedBranches] = useState<any[]>([]);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showStoreSelector, setShowStoreSelector] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("All Items");
  const [selectedSort, setSelectedSort] = useState("Name A-Z");
  const [selectedStore, setSelectedStore] = useState("");
  
  // Transfer functionality states
  const [showTransferHistory, setShowTransferHistory] = useState(false);
  const [transferItems, setTransferItems] = useState<any[]>([]);

  const { data: warehouses, isLoading: isWarehousesLoading } =
    useGetWarehousesQuery({ page: 1, limit: 10, search: "" });

  // Get the selected warehouse ID
  const selectedWarehouseId = warehouses?.data?.find((w: any) => w.name === selectedStore)?.id;

  // Use warehouse-specific endpoint with products
  const { data: warehouseWithProducts, isLoading: isWarehouseLoading } =
    useGetWarehouseWithProductsQuery({
      id: selectedWarehouseId || "",
      page: 1,
      limit: 10,
      search: searchText,
    }, {
      skip: !selectedWarehouseId // Skip query if no warehouse is selected
    });

  // Transfer history query
  const { data: transferHistory, isLoading: isTransferHistoryLoading } = 
    useGetBranchTransfersQuery({ page: 1, limit: 10, status: undefined, branchId: undefined });

  const filterOptions = [
    "All Items",
    "In Stock",
    "Low Stock",
    "Out of Stock",
    "Expired",
    "Near Expiry",
  ];

  const sortOptions = [
    "Name A-Z",
    "Name Z-A",
    "Quantity High-Low",
    "Quantity Low-High",
    "Recently Added",
    "Price High-Low",
    "Price Low-High",
  ];

  const storeOptions = warehouses && warehouses.data && Array.isArray(warehouses.data) && warehouses.success !== false
    ? warehouses.data.map((wh: any) => wh.name)
    : [];

  // Load saved store selection on component mount
  useEffect(() => {
    const loadSelectedStore = async () => {
      try {
        const savedStore = await AsyncStorage.getItem(SELECTED_STORE_KEY);
        if (savedStore) {
          setSelectedStore(savedStore);
        }
      } catch (error) {
        console.error('Error loading selected store:', error);
      }
    };
    loadSelectedStore();
  }, []);

  // Set first available store as default if no store is selected
  useEffect(() => {
    if (!selectedStore && storeOptions.length > 0) {
      setSelectedStore(storeOptions[0]);
    }
  }, [storeOptions, selectedStore]);

  // Use warehouse products as store items
  // The products are directly in warehouseWithProducts.products, not in .data.products
  const storeItems = warehouseWithProducts?.products || [];
  const isLoading = isWarehouseLoading;
  const error = null; // Handle error from warehouse query if needed

  // Check if there's an authentication error
  const hasAuthError = warehouses?.success === false && warehouses?.message?.includes('Unauthorized');

  // Debug logging
  console.log("=== STORE SCREEN DEBUG ===");
  console.log("Selected store:", selectedStore);
  console.log("Selected warehouse ID:", selectedWarehouseId);
  console.log("Warehouses data:", warehouses);
  console.log("Warehouse with products:", warehouseWithProducts);
  console.log("Store items:", storeItems);
  console.log("Store items count:", storeItems.length);
  console.log("Is loading:", isLoading);
  console.log("Store options:", storeOptions);
  console.log("Has auth error:", hasAuthError);
  console.log("Warehouses response:", warehouses);
  console.log("=========================");

  const StoreItem = ({ name, partNumber, store, quantity, image, onMore, onTransfer, item }: {
    name: string;
    partNumber: string;
    store: string;
    quantity: number;
    image: string;
    onMore: () => void;
    onTransfer: (item: any) => void;
    item: any;
  }) => (
    <View style={styles.storeItem}>
      <View style={styles.itemLeft}>
        <View style={styles.itemImage}>
          <Image source={{ uri: image }} style={styles.productImage} />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{name}</Text>
          <Text style={styles.itemPartNumber}>{partNumber}</Text>
          <Text style={styles.itemStore}>{store || "Main Store"}</Text>
        </View>
      </View>
      <View style={styles.itemRight}>
        <TouchableOpacity 
          style={styles.transferButton} 
          onPress={() => onTransfer(item)}
        >
          <Feather name="arrow-right" size={16} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.moreButton} onPress={onMore}>
          <Feather name="more-horizontal" size={20} color="#666" />
        </TouchableOpacity>
        <Text style={styles.itemQuantity}>Qty: {quantity}</Text>
      </View>
    </View>
  );

  const handleAddItem = () => {
    // Get the current selected warehouse information
    let currentLocation = null;
    
    if (selectedStore) {
      const warehouse = warehouses?.data?.find((w: any) => w.name === selectedStore);
      if (warehouse) {
        currentLocation = {
          id: warehouse.id,
          name: warehouse.name,
          type: "warehouse" as const
        };
      }
    }

    navigation.navigate("AddShopItem", {
      preSelectedLocation: currentLocation
    });
  };

  const handleItemMore = (item: any) => {
    setSelectedItem(item);
    setShowItemActions(true);
  };

  // Transfer functionality handlers
  const handleInitiateTransfer = (item: any) => {
    // Navigate to BranchTransfer page with item data
    navigation.navigate('BranchTransfer', { 
      preSelectedItem: item,
      sourceStore: selectedStore 
    });
  };

  const handleViewTransferHistory = () => {
    setShowTransferHistory(true);
  };

  const handleFilterSelect = (filter: string) => {
    setSelectedFilter(filter);
    setShowFilterModal(false);
  };

  const handleSortSelect = (sort: string) => {
    setSelectedSort(sort);
    setShowSortModal(false);
  };

  const handleStoreSelect = async (store: string) => {
    setSelectedStore(store);
    setShowStoreSelector(false);
    
    // Save the selected store to AsyncStorage
    try {
      await AsyncStorage.setItem(SELECTED_STORE_KEY, store);
    } catch (error) {
      console.error('Error saving selected store:', error);
    }
  };

  const handleBranchSelect = (branch: any) => {
    setSelectedBranches((prev: any[]) =>
      prev.includes(branch)
        ? prev.filter((b) => b !== branch)
        : [...prev, branch]
    );
  };

  const handleContinueToQuantity = () => {
    setShowSelectBranches(false);
    setShowQuantityModal(true);
  };

  const handleQuantityChange = () => {
    setShowQuantityModal(false);
    // Add logic to save quantity to the selected branches if needed
  };

  // const branches = [
  //   {
  //     name: "Main Branch",
  //     address: "123 Main Street, City",
  //     staff: "5 staff",
  //     type: "Warehouse",
  //   },
  //   {
  //     name: "Downtown Warehouse",
  //     address: "456 County Ave, City",
  //     staff: "3 staff",
  //     type: "Warehouse",
  //   },
  //   {
  //     name: "East Side Shop",
  //     address: "789 East Blvd, City",
  //     staff: "2 staff",
  //     type: "Shop",
  //   },
  // ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.storeSelector}
            onPress={() => setShowStoreSelector(true)}
          >
            <Text style={styles.headerTitle}>{selectedStore || "Select Store"}</Text>
            <Feather name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
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
                placeholder="Search"
                placeholderTextColor="#999"
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.transferHistoryButton}
            onPress={handleViewTransferHistory}
          >
            <Feather name="clock" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter and Sort */}
      <View style={styles.filterSortContainer}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
        >
          <Text style={styles.filterSortText}>Filter By</Text>
          <Feather name="chevron-down" size={14} color="#666" />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setShowSortModal(true)}
        >
          <Text style={styles.filterSortText}>Sort By</Text>
          <Feather name="chevron-down" size={14} color="#666" />
        </TouchableOpacity>
      </View>

      {(selectedFilter !== "All Items" || selectedSort !== "Name A-Z") && (
        <View style={styles.activeFiltersContainer}>
          {selectedFilter !== "All Items" && (
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterText}>
                Filter: {selectedFilter}
              </Text>
              <TouchableOpacity onPress={() => setSelectedFilter("All Items")}>
                <Feather name="x" size={14} color="#666" />
              </TouchableOpacity>
            </View>
          )}
          {selectedSort !== "Name A-Z" && (
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterText}>Sort: {selectedSort}</Text>
              <TouchableOpacity onPress={() => setSelectedSort("Name A-Z")}>
                <Feather name="x" size={14} color="#666" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Store Items List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.itemsList}>
          {hasAuthError ? (
            <View style={styles.noItemsContainer}>
              <Text style={styles.errorText}>Authentication Error</Text>
              <Text style={styles.noItemsSubtext}>Please log in again to access warehouse data</Text>
            </View>
          ) : !selectedStore ? (
            <Text style={styles.loadingText}>Please select a store first</Text>
          ) : isLoading ? (
            <Text style={styles.loadingText}>Loading products from {selectedStore}...</Text>
          ) : error ? (
            <Text style={styles.errorText}>Error loading items from {selectedStore}</Text>
          ) : storeItems.length > 0 ? (
            storeItems.map((item: any, index: number) => (
              <View key={item.id || index}>
                <StoreItem
                  name={item.name || "Unknown Product"}
                  partNumber={item.sku || "N/A"}
                  store={selectedStore}
                  quantity={item.stockQuantity || 0}
                  image={item.imageUrl || "https://via.placeholder.com/50"}
                  onMore={() => handleItemMore(item)}
                  onTransfer={handleInitiateTransfer}
                  item={item}
                />
                {index < storeItems.length - 1 && (
                  <View style={styles.itemDivider} />
                )}
              </View>
            ))
          ) : (
            <View style={styles.noItemsContainer}>
              <Text style={styles.noItemsText}>No items found in {selectedStore}</Text>
              <Text style={styles.noItemsSubtext}>Try selecting a different store or add some items</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Item Button */}
      <View style={styles.addItemContainer}>
        <TouchableOpacity style={styles.addItemButton} onPress={handleAddItem}>
          <Feather name="plus" size={20} color="white" style={styles.addIcon} />
          <Text style={styles.addItemText}>Add Item to store</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showStoreSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStoreSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowStoreSelector(false)}>
                <Feather name="x" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select Store</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.optionsList}>
              {storeOptions.map((store: string, index: number) => (
                <TouchableOpacity
                  key={index}
                  style={styles.optionItem}
                  onPress={() => handleStoreSelect(store)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedStore === store && styles.selectedOptionText,
                    ]}
                  >
                    {store}
                  </Text>
                  {selectedStore === store && (
                    <Feather name="check" size={20} color={COLORS.PRIMARY} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Feather name="x" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Filter By</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.optionsList}>
              {filterOptions.map((filter, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.optionItem}
                  onPress={() => handleFilterSelect(filter)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedFilter === filter && styles.selectedOptionText,
                    ]}
                  >
                    {filter}
                  </Text>
                  {selectedFilter === filter && (
                    <Feather name="check" size={20} color={COLORS.PRIMARY} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSortModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSortModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowSortModal(false)}>
                <Feather name="x" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Sort By</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.optionsList}>
              {sortOptions.map((sort, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.optionItem}
                  onPress={() => handleSortSelect(sort)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedSort === sort && styles.selectedOptionText,
                    ]}
                  >
                    {sort}
                  </Text>
                  {selectedSort === sort && (
                    <Feather name="check" size={20} color={COLORS.PRIMARY} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Select Branches Modal */}
      <Modal
        visible={showSelectBranches}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSelectBranches(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowSelectBranches(false)}>
                <Feather name="arrow-left" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Item</Text>
              <TouchableOpacity>
                <Feather name="search" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Select Branches</Text>

            <View style={styles.allLocationsHeader}>
              <Text style={styles.allLocationsText}>All Locations</Text>
              <TouchableOpacity style={styles.addBranchButton}>
                <Feather name="plus" size={16} color="white" />
                <Text style={styles.addBranchText}>Add Branch</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.branchList}>
              {warehouses?.data && warehouses.data.length > 0 ? warehouses.data.map((branch: any, index: number) => (
                <View key={index} style={styles.branchItem}>
                  <TouchableOpacity
                    style={[
                      styles.branchCheckbox,
                      selectedBranches.includes(branch.name) &&
                        styles.branchCheckboxSelected,
                    ]}
                    onPress={() => handleBranchSelect(branch.name)}
                  >
                    {selectedBranches.includes(branch.name) && (
                      <Feather name="check" size={16} color="white" />
                    )}
                  </TouchableOpacity>
                  <View style={styles.branchInfo}>
                    <Text style={styles.branchName}>{branch.name}</Text>
                    <Text style={styles.branchAddress}>{branch.location || branch.description || "Warehouse"}</Text>
                    <Text style={styles.branchStaff}>
                      Warehouse • {branch.companyName || "Company"}
                    </Text>
                  </View>
                  <View style={styles.branchActions}>
                    <TouchableOpacity style={styles.branchActionButton}>
                      <Feather name="edit-2" size={16} color="#666" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.branchActionButton}>
                      <Feather name="trash-2" size={16} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>
              )) : (
                <Text style={styles.loadingText}>Loading branches...</Text>
              )}
            </ScrollView>

            {selectedBranches.length > 0 && (
              <TouchableOpacity
                style={styles.continueButton}
                onPress={handleContinueToQuantity}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Quantity Modal */}
      <Modal
        visible={showQuantityModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowQuantityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowQuantityModal(false)}>
                <Feather name="arrow-left" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Item</Text>
              <TouchableOpacity>
                <Feather name="search" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>All Locations</Text>

            <View style={styles.quantitySection}>
              <Text style={styles.quantityLabel}>How many Quantity</Text>
              <View style={styles.quantitySelector}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => setQuantity(Math.max(0, quantity - 1))}
                >
                  <Feather name="minus" size={20} color="#666" />
                </TouchableOpacity>
                <TextInput
                  style={styles.quantityValue}
                  value={quantity.toString()}
                  onChangeText={(text) =>
                    setQuantity(Number.parseInt(text) || 0)
                  }
                  keyboardType="number-pad"
                  textAlign="center"
                />
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => setQuantity(quantity + 1)}
                >
                  <Feather name="plus" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.expirySection}>
              <Text style={styles.expiryLabel}>Select Expiry date</Text>
              <Text style={styles.optionalText}>Optional &gt;</Text>
            </View>

            <View style={styles.supplierSection}>
              <Text style={styles.supplierLabel}>Supplier</Text>
              <TouchableOpacity style={styles.supplierDropdown}>
                <Text style={styles.supplierText}>Select &gt;</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowQuantityModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleQuantityChange}
              >
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Item Actions Modal */}
      <Modal
        visible={showItemActions}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowItemActions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowItemActions(false)}>
                <Feather name="arrow-left" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Credit</Text>
              <TouchableOpacity>
                <Feather name="search" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterContainer}>
              <TouchableOpacity style={styles.filterButton}>
                <Text style={styles.filterText}>Filter By</Text>
                <Feather name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.sortButton}>
                <Text style={styles.sortText}>Sort By</Text>
                <Feather name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.itemActionsContainer}>
              <TouchableOpacity style={styles.actionItem}>
                <Feather name="check-circle" size={20} color="#666" />
                <Text style={styles.actionText}>Update stock safely</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionItem}>
                <Feather name="clock" size={20} color="#666" />
                <Text style={styles.actionText}>Item history</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionItem}>
                <Feather name="log-in" size={20} color="#666" />
                <Text style={styles.actionText}>Stock in</Text>
                <TouchableOpacity 
                  style={styles.transferButton}
                  onPress={() => {
                    setShowItemActions(false);
                    handleInitiateTransfer(selectedItem);
                  }}
                >
                  <Text style={styles.transferText}>Transfer to Branch</Text>
                  <Feather name="shuffle" size={16} color="#666" />
                </TouchableOpacity>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionItem}>
                <Feather name="log-out" size={20} color="#666" />
                <Text style={styles.actionText}>Stock out</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionItem}>
                <Text style={styles.actionText}>Show product details</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.deleteButton}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* Transfer History Modal */}
      <Modal
        visible={showTransferHistory}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTransferHistory(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowTransferHistory(false)}>
                <Feather name="x" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Transfer History</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.transferHistoryList}>
              {isTransferHistoryLoading ? (
                <Text style={styles.loadingText}>Loading transfer history...</Text>
              ) : transferHistory?.data && Array.isArray(transferHistory.data) && transferHistory.data.length > 0 ? (
                transferHistory.data.map((transfer) => (
                  <View key={transfer.id} style={styles.transferHistoryItem}>
                    <View style={styles.transferInfo}>
                      <Text style={styles.transferStatus}>{transfer.status}</Text>
                      <Text style={styles.transferDate}>
                        {transfer.createdAt ? new Date(transfer.createdAt).toLocaleDateString() : 'Unknown date'}
                      </Text>
                    </View>
                    <Text style={styles.transferNotes}>{transfer.notes || 'No notes'}</Text>
                    <Text style={styles.transferItems}>
                      {transfer.items && Array.isArray(transfer.items) ? transfer.items.length : 0} item(s)
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noItemsText}>No transfer history found</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 40,
    backgroundColor: "white",
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
    paddingVertical: 4,
    marginLeft: 25,
    borderWidth: 1,
    borderColor: "#E0E0E0",
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
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  sortButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    width: 2,
    backgroundColor: "#E0E0E0",
    marginHorizontal: 16,
  },
  filterSortText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  itemsList: {
    backgroundColor: "white",
    marginHorizontal: 16,
    borderRadius: 8,
    paddingVertical: 8,
  },
  storeItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginHorizontal: 16,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  itemImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#F0F8FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  productImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 2,
  },
  itemPartNumber: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  itemStore: {
    fontSize: 12,
    color: "#666",
  },
  itemRight: {
    alignItems: "flex-end",
  },
  moreButton: {
    padding: 4,
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 12,
    color: "#666",
  },
  addItemContainer: {
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
  addItemButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  addIcon: {
    marginRight: 8,
  },
  addItemText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    flex: 1,
    textAlign: "center",
  },
  filterContainer: {
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  filterText: {
    fontSize: 14,
    color: "#000",
    marginRight: 4,
  },
  sortText: {
    fontSize: 14,
    color: "#000",
    marginRight: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  allLocationsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  allLocationsText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  addBranchButton: {
    backgroundColor: COLORS.PRIMARY,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addBranchText: {
    fontSize: 12,
    fontWeight: "500",
    color: "white",
    marginLeft: 4,
  },
  branchItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  branchCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  branchCheckboxSelected: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  branchInfo: {
    flex: 1,
  },
  branchStaff: {
    fontSize: 11,
    color: "#999",
  },
  branchActions: {
    flexDirection: "row",
  },
  branchActionButton: {
    padding: 8,
    marginLeft: 4,
  },
  continueButton: {
    backgroundColor: COLORS.PRIMARY,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  quantitySection: {
    alignItems: "center",
    paddingVertical: 20,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
    marginBottom: 16,
  },
  quantitySelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quantityValue: {
    fontSize: 24,
    fontWeight: "600",
    color: "#000",
    marginHorizontal: 24,
    minWidth: 60,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  expirySection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  expiryLabel: {
    fontSize: 14,
    color: "#000",
  },
  optionalText: {
    fontSize: 12,
    color: "#666",
  },
  supplierSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  supplierLabel: {
    fontSize: 14,
    color: "#000",
  },
  supplierDropdown: {
    paddingVertical: 4,
  },
  supplierText: {
    fontSize: 12,
    color: "#666",
  },
  actionButtonsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#F0F0F0",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: COLORS.PRIMARY,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  itemActionsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  actionText: {
    fontSize: 15,
    color: "#000",
    marginLeft: 12,
    flex: 1,
  },
  transferText: {
    fontSize: 12,
    color: "#666",
    marginRight: 4,
  },
  deleteButton: {
    backgroundColor: "#FF5722",
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  loadingText: {
    textAlign: "center",
    padding: 16,
    color: "#666",
  },
  errorText: {
    textAlign: "center",
    padding: 16,
    color: "#FF4444",
  },
  noItemsContainer: {
    alignItems: "center",
    padding: 32,
  },
  noItemsText: {
    textAlign: "center",
    padding: 16,
    color: "#999",
    fontSize: 16,
    fontWeight: "500",
  },
  noItemsSubtext: {
    textAlign: "center",
    color: "#666",
    fontSize: 14,
    marginTop: 8,
  },
  storeSelector: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  activeFiltersContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexWrap: "wrap",
    gap: 8,
  },
  activeFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  activeFilterText: {
    fontSize: 12,
    color: "#1976D2",
    fontWeight: "500",
  },
  optionsList: {
    maxHeight: 400,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  optionText: {
    fontSize: 16,
    color: "#000",
  },
  selectedOptionText: {
    color: COLORS.PRIMARY,
    fontWeight: "600",
  },
  
  // Transfer functionality styles
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  transferHistoryButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F0F8FF",
  },
  transferButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F0F8FF",
    marginRight: 8,
  },
  transferItemInfo: {
    padding: 16,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    margin: 16,
  },
  transferItemName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  transferItemSku: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  transferItemQuantity: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  transferForm: {
    padding: 16,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
    marginTop: 8,
  },
  branchList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  branchOption: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F8F9FA",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  selectedBranchOption: {
    backgroundColor: "#E3F2FD",
    borderColor: "#007AFF",
  },
  branchName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  branchAddress: {
    fontSize: 14,
    color: "#666",
  },
  transferQuantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
  },
  transferQuantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F8FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  transferQuantityInput: {
    width: 80,
    height: 40,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 8,
    marginHorizontal: 16,
  },
  transferHistoryList: {
    maxHeight: 400,
    padding: 16,
  },
  transferHistoryItem: {
    padding: 16,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    marginBottom: 12,
  },
  transferInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  transferStatus: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
    textTransform: "capitalize",
  },
  transferDate: {
    fontSize: 12,
    color: "#666",
  },
  transferNotes: {
    fontSize: 14,
    color: "#000",
    marginBottom: 4,
  },
  transferItems: {
    fontSize: 12,
    color: "#666",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },
  confirmButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 12,
  },
  confirmButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});

export default StoreScreen;
