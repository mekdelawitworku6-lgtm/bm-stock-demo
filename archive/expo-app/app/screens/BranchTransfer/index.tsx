"use client";

import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSelector } from "react-redux";
import { COLORS } from "../../../constants/Colors";
import { useGetProductsQuery } from "../../../lib/Api/productApi";
import { useGetShopsQuery } from "../../../lib/Api/shopApi";
import { useCreateBranchTransferMutation } from "../../../lib/Api/transferApi";
import { useGetWarehousesQuery } from "../../../lib/Api/warehouseApi";
import { RootState } from "../../../lib/store";

interface Branch {
  id: string;
  name: string;
  location: string;
  type?: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
}

interface TransferItem {
  id: string;
  productId: string;
  quantity: number;
}

const BranchTransferScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  // Get user from Redux store
  const { user } = useSelector((state: RootState) => state.auth);
  
  // Get pre-selected item data from navigation params
  const { preSelectedItem, sourceStore } = route.params || {};
  
  const [fromBranch, setFromBranch] = useState<Branch | null>(null);
  const [toBranch, setToBranch] = useState<Branch | null>(null);
  const [transferItems, setTransferItems] = useState<TransferItem[]>(() => {
    // If we have a pre-selected item, initialize with it
    if (preSelectedItem) {
      return [{
        id: "1",
        productId: preSelectedItem.id,
        quantity: 1,
      }];
    }
    return [{ id: "1", productId: "", quantity: 0 }];
  });
  const [notes, setNotes] = useState("");

  // Modal states
  const [showFromBranchModal, setShowFromBranchModal] = useState(false);
  const [showToBranchModal, setShowToBranchModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);

  // API hooks
  const { data: warehousesData, isLoading: warehousesLoading } = useGetWarehousesQuery({
    page: 1,
    limit: 100,
    search: "",
  });
  
  const { data: shopsData, isLoading: shopsLoading } = useGetShopsQuery({
    page: 1,
    limit: 100,
    search: "",
  });

  const { data: productsData, isLoading: productsLoading } = useGetProductsQuery({
    page: 1,
    limit: 100,
    search: "",
  });

  const [createTransfer, { isLoading: isCreatingTransfer }] = useCreateBranchTransferMutation();

  // Combine warehouses and shops into branches (like in newSales page)
  const branches: Branch[] = [
    ...(warehousesData?.data?.map((warehouse: any) => ({
      id: warehouse.id,
      name: warehouse.name,
      location: warehouse.location || warehouse.description || "Warehouse",
      type: "warehouse" as const
    })) || []),
    ...(shopsData?.data?.data?.map((shop: any) => ({
      id: shop.id,
      name: shop.name,
      location: shop.location || "Shop",
      type: "shop" as const
    })) || [])
  ];

  // Auto-select source branch if sourceStore is provided
  React.useEffect(() => {
    if (sourceStore && branches.length > 0 && !fromBranch) {
      const sourceBranch = branches.find(branch => branch.name === sourceStore);
      if (sourceBranch) {
        setFromBranch(sourceBranch);
      }
    }
  }, [sourceStore, branches, fromBranch]);

  // Only show products with stock > 0
  const products: Product[] = (productsData?.data || [])
    .filter((product: any) => product.stockQuantity > 0)
    .map((product: any) => ({
      id: product.id,
      name: product.name,
      sku: product.sku || product.barcode || "N/A",
      currentStock: product.stockQuantity || 0,
    }));

  const addProduct = () => {
    const newItem: TransferItem = {
      id: Date.now().toString(),
      productId: "",
      quantity: 0,
    };
    setTransferItems([...transferItems, newItem]);
  };

  const removeProduct = (itemId: string) => {
    if (transferItems.length > 1) {
      setTransferItems(transferItems.filter((item) => item.id !== itemId));
    }
  };

  const updateProductQuantity = (itemId: string, quantity: number) => {
    setTransferItems(
      transferItems.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  const selectProduct = (itemIndex: number, productId: string) => {
    const updatedItems = [...transferItems];
    updatedItems[itemIndex].productId = productId;
    setTransferItems(updatedItems);
    setShowProductModal(false);
  };

  const getSelectedProduct = (productId: string) => {
    return products.find((p) => p.id === productId);
  };

  // Helper function to determine transfer type
  const determineTransferType = (fromBranch: Branch, toBranch: Branch): 'warehouse_to_warehouse' | 'warehouse_to_shop' | 'shop_to_warehouse' | 'shop_to_shop' => {
    if (fromBranch.type === 'warehouse' && toBranch.type === 'warehouse') {
      return 'warehouse_to_warehouse';
    } else if (fromBranch.type === 'warehouse' && toBranch.type === 'shop') {
      return 'warehouse_to_shop';
    } else if (fromBranch.type === 'shop' && toBranch.type === 'warehouse') {
      return 'shop_to_warehouse';
    } else {
      return 'shop_to_shop';
    }
  };

  // Helper function to get error message
  const getErrorMessage = (error: any): string => {
    if (error?.data?.message) {
      return error.data.message;
    }
    switch (error?.status) {
      case 400: return "Invalid transfer data. Please check your inputs.";
      case 403: return "You don't have permission to create this transfer.";
      case 404: return "Branch or product not found.";
      case 409: return "Insufficient stock for the requested items.";
      default: return "Transfer failed. Please try again.";
    }
  };

  const completeTransfer = async () => {
    if (!fromBranch || !toBranch) {
      Alert.alert(
        "Error",
        "Please select both source and destination branches"
      );
      return;
    }

    if (fromBranch.id === toBranch.id) {
      Alert.alert(
        "Error",
        "Source and destination branches cannot be the same"
      );
      return;
    }

    const validItems = transferItems.filter(
      (item) => item.productId && item.quantity > 0
    );
    if (validItems.length === 0) {
      Alert.alert("Error", "Please add at least one product with quantity");
      return;
    }

    try {
      const transferType = determineTransferType(fromBranch, toBranch);
      
      // Validate user is authenticated
      if (!user?.id) {
        Alert.alert("Error", "You must be logged in to create a transfer");
        return;
      }

      const transferData = {
        type: transferType,
        sourceWarehouseId: fromBranch.type === 'warehouse' ? fromBranch.id : undefined,
        sourceShopId: fromBranch.type === 'shop' ? fromBranch.id : undefined,
        destinationWarehouseId: toBranch.type === 'warehouse' ? toBranch.id : undefined,
        destinationShopId: toBranch.type === 'shop' ? toBranch.id : undefined,
        items: validItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        notes: notes,
      };

      await createTransfer(transferData).unwrap();
      
      Alert.alert(
        "Success", 
        "Transfer request created successfully! It will be reviewed and approved.",
        [
          {
            text: "OK",
            onPress: () => {
              // Reset form
              setFromBranch(null);
              setToBranch(null);
              setTransferItems([{ id: "1", productId: "", quantity: 0 }]);
              setNotes("");
              navigation.goBack();
            }
          }
        ]
      );
    } catch (error: any) {
      console.error("Transfer creation error:", error);
      Alert.alert(
        "Error", 
        getErrorMessage(error)
      );
    }
  };

  const renderBranchModal = (
    visible: boolean,
    onClose: () => void,
    onSelect: (branch: Branch) => void,
    title: string
  ) => (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          {warehousesLoading || shopsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY} />
              <Text style={styles.loadingText}>Loading branches...</Text>
            </View>
          ) : (
            <FlatList
              data={branches}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                >
                  <View>
                    <Text style={styles.modalItemName}>{item.name}</Text>
                    <Text style={styles.modalItemLocation}>{item.location}</Text>
                    <Text style={styles.branchType}>{item.type?.toUpperCase()}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No branches available</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );

  const renderProductModal = () => (
    <Modal visible={showProductModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Product</Text>
            <TouchableOpacity onPress={() => setShowProductModal(false)}>
              <Feather name="x" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          {productsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY} />
              <Text style={styles.loadingText}>Loading products...</Text>
            </View>
          ) : (
            <FlatList
              data={products}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => selectProduct(selectedItemIndex, item.id)}
                >
                  <View style={styles.productInfo}>
                    <Text style={styles.modalItemName}>{item.name}</Text>
                    <Text style={styles.modalItemLocation}>SKU: {item.sku}</Text>
                    <Text style={styles.stockText}>
                      Stock: {item.currentStock}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No products available</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Branch Transfer</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Transfer Details Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="repeat" size={20} color="#007AFF" />
            <Text style={styles.sectionTitle}>Transfer Details</Text>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>From Branch</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowFromBranchModal(true)}
            >
              <Text
                style={[
                  styles.dropdownText,
                  !fromBranch && styles.placeholderText,
                ]}
              >
                {fromBranch ? fromBranch.name : "Select source branch"}
              </Text>
              <Feather name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>To Branch</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowToBranchModal(true)}
            >
              <Text
                style={[
                  styles.dropdownText,
                  !toBranch && styles.placeholderText,
                ]}
              >
                {toBranch ? toBranch.name : "Select destination branch"}
              </Text>
              <Feather name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Pre-selected Item Info */}
        {preSelectedItem && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="info" size={20} color="#007AFF" />
              <Text style={styles.sectionTitle}>Transferring Selected Item</Text>
            </View>
            <View style={styles.preSelectedInfo}>
              <Text style={styles.preSelectedInfoText}>
                You are transferring "{preSelectedItem.name}" from {sourceStore || 'selected store'}.
              </Text>
            </View>
          </View>
        )}

        {/* Items to Transfer Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="plus" size={20} color="#007AFF" />
            <Text style={styles.sectionTitle}>Items to Transfer</Text>
          </View>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderText}>Product</Text>
            <Text style={styles.tableHeaderText}>Qty</Text>
            <View style={styles.tableHeaderAction} />
          </View>

          {/* Transfer Items */}
          {transferItems.map((item, index) => {
            const selectedProduct = getSelectedProduct(item.productId);
            const isPreSelected = preSelectedItem && item.productId === preSelectedItem.id;
            
            return (
              <View key={item.id} style={styles.tableRow}>
                <TouchableOpacity
                  style={[
                    styles.productDropdown,
                    isPreSelected && styles.disabledDropdown
                  ]}
                  onPress={() => {
                    if (!isPreSelected) {
                      setSelectedItemIndex(index);
                      setShowProductModal(true);
                    }
                  }}
                  disabled={isPreSelected}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      !selectedProduct && styles.placeholderText,
                      isPreSelected && styles.preSelectedText,
                    ]}
                  >
                    {selectedProduct ? selectedProduct.name : "Select product"}
                  </Text>
                  {!isPreSelected && <Feather name="chevron-down" size={16} color="#666" />}
                  {isPreSelected && <Feather name="lock" size={16} color="#007AFF" />}
                </TouchableOpacity>

                <TextInput
                  style={styles.quantityInput}
                  value={item.quantity > 0 ? item.quantity.toString() : ""}
                  onChangeText={(text) =>
                    updateProductQuantity(item.id, Number.parseInt(text) || 0)
                  }
                  placeholder="0"
                  keyboardType="numeric"
                />

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => removeProduct(item.id)}
                  disabled={transferItems.length === 1 || isPreSelected}
                >
                  <Feather
                    name="trash-2"
                    size={18}
                    color={(transferItems.length === 1 || isPreSelected) ? "#ccc" : "#ff4444"}
                  />
                </TouchableOpacity>
              </View>
            );
          })}

          {!preSelectedItem && (
            <TouchableOpacity
              style={styles.addProductButton}
              onPress={addProduct}
            >
              <Feather name="plus" size={20} color="#007AFF" />
              <Text style={styles.addProductText}>Add Product</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Notes Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="file-text" size={20} color="#007AFF" />
            <Text style={styles.sectionTitle}>Notes (Optional)</Text>
          </View>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any additional notes for this transfer..."
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.completeButton, isCreatingTransfer && styles.disabledButton]}
          onPress={completeTransfer}
          disabled={isCreatingTransfer}
        >
          {isCreatingTransfer ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name="check" size={20} color="#fff" />
          )}
          <Text style={styles.completeButtonText}>
            {isCreatingTransfer ? "Creating Transfer..." : "Complete Transfer"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modals */}
      {renderBranchModal(
        showFromBranchModal,
        () => setShowFromBranchModal(false),
        setFromBranch,
        "Select Source Branch"
      )}
      {renderBranchModal(
        showToBranchModal,
        () => setShowToBranchModal(false),
        setToBranch,
        "Select Destination Branch"
      )}
      {renderProductModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e1e5e9",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginLeft: 8,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e1e5e9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: "#fff",
  },
  dropdownText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  placeholderText: {
    color: "#999",
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e5e9",
    marginBottom: 8,
  },
  tableHeaderText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    flex: 1,
  },
  tableHeaderAction: {
    width: 40,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 8,
  },
  productDropdown: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e1e5e9",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginRight: 8,
    backgroundColor: "#fff",
  },
  quantityInput: {
    width: 60,
    borderWidth: 1,
    borderColor: "#e1e5e9",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 10,
    textAlign: "center",
    fontSize: 16,
    marginRight: 8,
    backgroundColor: "#fff",
  },
  deleteButton: {
    padding: 8,
    width: 40,
    alignItems: "center",
  },
  addProductButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#007AFF",
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 8,
    backgroundColor: "#f0f8ff",
  },
  addProductText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "500",
    marginLeft: 8,
  },
  bottomContainer: {
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e1e5e9",
  },
  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 16,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e5e9",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  modalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },
  modalItemLocation: {
    fontSize: 14,
    color: "#666",
  },
  productInfo: {
    flex: 1,
  },
  stockText: {
    fontSize: 12,
    color: "#007AFF",
    marginTop: 2,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: "#e1e5e9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#fff",
    minHeight: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  branchType: {
    fontSize: 10,
    color: "#007AFF",
    fontWeight: "600",
    marginTop: 2,
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  disabledDropdown: {
    backgroundColor: "#f8f9fa",
    borderColor: "#e1e5e9",
  },
  preSelectedText: {
    color: "#007AFF",
    fontWeight: "500",
  },
  preSelectedInfo: {
    backgroundColor: "#f0f8ff",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
  },
  preSelectedInfoText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
});

export default BranchTransferScreen;
