import { useGetLowStockProductsQuery } from "@/lib/Api/productApi";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
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
import { COLORS } from "../../../constants/Colors";

interface LowStockProductProps {
  navigation: any;
}

const LowStockProduct: React.FC<LowStockProductProps> = ({ navigation }) => {
  const [searchText, setSearchText] = useState("");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const { data: LowStockProduct, isLoading } = useGetLowStockProductsQuery({
    search: searchText,
  });

  console.log("low stock Products Data:", LowStockProduct);

  //   const getStatus = (expiryDate) => {
  //     const today = new Date();
  //     const expiry = new Date(expiryDate);
  //     const daysToExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  //     if (daysToExpiry < 0) {
  //       return { status: "EXPIRED", color: "#F44336" };
  //     } else if (daysToExpiry <= 30) {
  //       return { status: "NEARING EXPIRATION", color: "#FFCA28" };
  //     } else {
  //       return { status: "AVAILABLE", color: "#4CAF50" };
  //     }
  //   };

  const LowStock = ({ name, partNumber, store, quantity, image }) => (
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
        {/* <TouchableOpacity style={styles.moreButton} onPress={onMore}>
          <Feather name="more-horizontal" size={20} color="#666" />
        </TouchableOpacity> */}
        <Text style={styles.itemQuantity}>Qty: {quantity}</Text>
      </View>
    </View>
  );

  const handleExpireItemPress = (item) => {
    setSelectedItem(item);
    setShowDetailsModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setSelectedItem(null);
  };

  const DetailRow = ({ label, value, valueStyle = {} }) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueStyle]}>{value}</Text>
    </View>
  );

  const handleViewDetails = () => {
    console.log("View Details pressed");
    // Handle view details logic
  };

  const handleDisposeItem = () => {
    console.log("Dispose Item pressed");
    // Handle dispose item logic
    handleCloseModal();
  };

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
          <Text style={styles.headerTitle}>Low Stock</Text>
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
      </View>

      <View style={styles.filterSortContainer}>
        <TouchableOpacity style={styles.filterButton}>
          <Text style={styles.filterSortText}>Filter By</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.sortButton}>
          <Text style={styles.filterSortText}>Sort By</Text>
        </TouchableOpacity>
      </View>

      {/* Expired Items List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.expireList}>
          {LowStockProduct &&
            LowStockProduct.map((item, index) => {
              return (
                <React.Fragment key={index}>
                  <LowStock
                    key={item.id}
                    name={item.name}
                    partNumber={item.sku || "N/A"}
                    store={item.store || "Main Store"} // Adjust based on your API response
                    quantity={item.quantity || 0} // Add quantity field if tracked
                    image={item.imageUrl}
                    // onMore={() => handleItemMore(item)}
                  />
                  {index < LowStockProduct.length - 1 && (
                    <View style={styles.horizontalDivider} />
                  )}
                </React.Fragment>
              );
            })}
        </View>
      </ScrollView>

      {/* Details Modal */}
      <Modal
        visible={showDetailsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Item Details</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleCloseModal}
              >
                <Feather name="x" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              <View style={styles.section}>
                <Text style={styles.productName}>{selectedItem?.name}</Text>
                <Text style={styles.productCode}>{selectedItem?.sku}</Text>
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Details</Text>
                <DetailRow
                  label="Batch Number"
                  value={selectedItem?.barcode || "N/A"}
                />
                <DetailRow label="Quantity" value={"N/A"} />
                <DetailRow
                  label="Cost Price"
                  value={`$${selectedItem?.cost}`}
                />
                <DetailRow
                  label="Total Cost"
                  value={`$${selectedItem?.cost}`}
                />{" "}
                {/* Simplified, no quantity */}
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>More Details</Text>
                <DetailRow
                  label="Date Received"
                  value={selectedItem?.createdAt.split("T")[0]}
                />
                <DetailRow
                  label="Supplier"
                  value={selectedItem?.metadata?.brand || "N/A"}
                />
                <DetailRow label="Stored At" value={selectedItem?.category} />
                <DetailRow
                  label="Expiry Date"
                  value={selectedItem?.expiryDate}
                />
              </View>
            </ScrollView>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.printButton}
                onPress={handleViewDetails}
              >
                <Feather
                  name="eye"
                  size={20}
                  color="white"
                  style={styles.buttonIcon}
                />
                <Text style={styles.printButtonText}>View Details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.returnButton}
                onPress={handleDisposeItem}
              >
                <Text style={styles.returnButtonText}>Dispose Item</Text>
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
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 40,
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
  },
  sortButton: {
    flex: 1,
    // alignItems: "flex-end",
  },
  divider: {
    width: 2,
    backgroundColor: COLORS.LIGHTGRAY,
    marginHorizontal: 16,
  },
  horizontalDivider: {
    height: 1,
    backgroundColor: "#E0E0E0",
    marginHorizontal: 16,
  },
  filterSortText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  expireList: {
    paddingHorizontal: 16,
  },
  expireItem: {
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
  expireLeft: {
    flex: 1,
  },
  expireName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
    marginBottom: 2,
  },
  expireQuantity: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  expireDate: {
    fontSize: 12,
    color: "#666",
  },
  expireRight: {
    alignItems: "flex-end",
  },
  expireStatus: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    width: "100%",
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    flex: 1,
    textAlign: "center",
    marginRight: 24,
  },
  closeButton: {
    padding: 4,
  },
  modalScrollView: {
    maxHeight: 500,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  productName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  productCode: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    fontSize: 14,
    color: "#000",
  },
  priceValue: {
    fontSize: 14,
    color: "#666",
  },
  transactionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  transactionLeft: {
    flex: 1,
  },
  transactionRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  quantityLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  sellingPriceLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  sellingPriceValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: "#666",
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: "#000",
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
  },
  actionButtons: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  printButton: {
    backgroundColor: COLORS.PRIMARY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  printButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  returnButton: {
    backgroundColor: "#FF4444",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  returnButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
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
});

export default LowStockProduct;
