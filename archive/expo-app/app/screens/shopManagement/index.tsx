import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    Alert,
    FlatList,
    Modal,
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
import {
    useCreateShopMutation,
    useDeleteShopMutation,
    useGetShopsQuery,
    useUpdateShopMutation
} from "../../../lib/Api/shopApi";
import { RootState } from "../../../lib/store";

interface ShopManagementScreenProps {
  navigation: any;
  route?: any;
}

interface Shop {
  id: string;
  name: string;
  location: string;
  warehouseName?: string;
  companyName: string;
  createdAt: string;
  updatedAt: string;
}

const ShopManagementScreen: React.FC<ShopManagementScreenProps> = ({ navigation }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [shopName, setShopName] = useState("");
  const [shopLocation, setShopLocation] = useState("");
  const [warehouseId, setWarehouseId] = useState("");

  const { user } = useSelector((state: RootState) => state.auth);

  const { 
    data: shopsData, 
    isLoading, 
    error, 
    refetch 
  } = useGetShopsQuery({
    page: 1,
    limit: 100,
    search: "",
  });

  const [createShop, { isLoading: creating }] = useCreateShopMutation();
  const [updateShop, { isLoading: updating }] = useUpdateShopMutation();
  const [deleteShop, { isLoading: deleting }] = useDeleteShopMutation();

  const shops: Shop[] = shopsData?.data || [];

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (error) {
      console.error('Error refreshing shops:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const resetForm = () => {
    setShopName("");
    setShopLocation("");
    setWarehouseId("");
    setEditingShop(null);
  };

  const openModal = (shop?: Shop) => {
    if (shop) {
      setEditingShop(shop);
      setShopName(shop.name);
      setShopLocation(shop.location);
      setWarehouseId(shop.warehouseName || "");
    } else {
      resetForm();
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!shopName.trim() || !shopLocation.trim()) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    const shopData = {
      name: shopName.trim(),
      location: shopLocation.trim(),
      companyId: user?.companyId || user?.company?.id,
      ...(warehouseId && { warehouseId }),
    };

    try {
      if (editingShop) {
        await updateShop({ id: editingShop.id, data: shopData }).unwrap();
        Alert.alert("Success", "Shop updated successfully");
      } else {
        await createShop(shopData).unwrap();
        Alert.alert("Success", "Shop created successfully");
      }
      closeModal();
      refetch();
    } catch (error: any) {
      console.error('Error saving shop:', error);
      Alert.alert("Error", error?.data?.message || "Failed to save shop");
    }
  };

  const handleDelete = (shop: Shop) => {
    Alert.alert(
      "Delete Shop",
      `Are you sure you want to delete "${shop.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteShop(shop.id).unwrap();
              Alert.alert("Success", "Shop deleted successfully");
              refetch();
            } catch (error: any) {
              console.error('Error deleting shop:', error);
              Alert.alert("Error", error?.data?.message || "Failed to delete shop");
            }
          },
        },
      ]
    );
  };

  const ShopItem = ({ shop }: { shop: Shop }) => (
    <View style={styles.shopItem}>
      <View style={styles.shopInfo}>
        <Text style={styles.shopName}>{shop.name}</Text>
        <Text style={styles.shopLocation}>
          <Feather name="map-pin" size={12} color="#666" /> {shop.location}
        </Text>
        {shop.warehouseName && (
          <Text style={styles.warehouseName}>
            <Feather name="home" size={12} color="#666" /> {shop.warehouseName}
          </Text>
        )}
        <Text style={styles.companyName}>
          <Feather name="building" size={12} color="#666" /> {shop.companyName}
        </Text>
      </View>
      <View style={styles.shopActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openModal(shop)}
        >
          <Feather name="edit-2" size={16} color={COLORS.PRIMARY} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDelete(shop)}
        >
          <Feather name="trash-2" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.headerTitle}>Shop Management</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading shops...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.headerTitle}>Shop Management</Text>
          <View style={styles.headerRight} />
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
        <BackButton />
        <Text style={styles.headerTitle}>Shop Management</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => openModal()}
        >
          <Feather name="plus" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Shops List */}
      <FlatList
        data={shops}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ShopItem shop={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="shopping-bag" size={48} color="#999" />
            <Text style={styles.emptyText}>No shops found</Text>
            <TouchableOpacity
              style={styles.addFirstButton}
              onPress={() => openModal()}
            >
              <Text style={styles.addFirstButtonText}>Add First Shop</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={styles.listContainer}
      />

      {/* Add/Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingShop ? "Edit Shop" : "Add New Shop"}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Feather name="x" size={20} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>
                  Shop Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={shopName}
                  onChangeText={setShopName}
                  placeholder="Enter shop name"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>
                  Location <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={shopLocation}
                  onChangeText={setShopLocation}
                  placeholder="Enter shop location"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Warehouse (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={warehouseId}
                  onChangeText={setWarehouseId}
                  placeholder="Enter warehouse ID"
                  placeholderTextColor="#999"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeModal}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (creating || updating) && styles.disabledButton,
                ]}
                onPress={handleSave}
                disabled={creating || updating}
              >
                <Text style={styles.saveButtonText}>
                  {creating || updating ? "Saving..." : editingShop ? "Update" : "Create"}
                </Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    flex: 1,
    textAlign: "center",
    marginRight: 32,
  },
  headerRight: {
    width: 32,
  },
  addButton: {
    backgroundColor: COLORS.PRIMARY,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    padding: 16,
  },
  shopItem: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  shopLocation: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  warehouseName: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  companyName: {
    fontSize: 14,
    color: "#666",
  },
  shopActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F8F9FA",
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
    marginBottom: 24,
    textAlign: "center",
  },
  addFirstButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    width: "90%",
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  modalBody: {
    padding: 16,
  },
  formField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
    marginBottom: 8,
  },
  required: {
    color: "#FF4444",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#000",
    backgroundColor: "#F8F9FA",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: COLORS.PRIMARY,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    color: "white",
    fontWeight: "600",
  },
  disabledButton: {
    backgroundColor: "#A0A0A0",
  },
});

export default ShopManagementScreen;




