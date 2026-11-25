import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface WarehouseReportScreenProps {
  navigation: any;
  route?: any;
}

const WarehouseReportScreen: React.FC<WarehouseReportScreenProps> = ({
  navigation,
  route,
}) => {
  const [selectedBranch, setSelectedBranch] = useState("Branch");
  const { reportType, timeOption } = route?.params || {};

  const reportData = [
    { itemName: "Cement", sales: "Batty", store: "hayahulet" },
    { itemName: "Cement", sales: "Batty", store: "hayahulet" },
  ];

  const TableRow = ({ itemName, sales, store, isHeader = false }) => (
    <View style={[styles.tableRow, isHeader && styles.tableHeader]}>
      <Text
        style={[
          styles.tableCell,
          styles.itemNameCell,
          isHeader && styles.headerText,
        ]}
      >
        {itemName}
      </Text>
      <Text
        style={[
          styles.tableCell,
          styles.salesCell,
          isHeader && styles.headerText,
        ]}
      >
        {sales}
      </Text>
      <Text
        style={[
          styles.tableCell,
          styles.storeCell,
          isHeader && styles.headerText,
        ]}
      >
        {store}
      </Text>
    </View>
  );

  const handleBranchPress = () => {
    // Handle branch dropdown
    console.log("Branch dropdown pressed");
  };

  const handleReset = () => {
    // Handle reset filters
    console.log("Reset filters");
  };

  const handleRefresh = () => {
    // Handle refresh data
    console.log("Refresh data");
  };

  const handlePreviewPDF = () => {
    // Handle PDF preview
    console.log("Preview PDF");
  };

  const handleSharePDF = () => {
    // Handle PDF sharing
    console.log("Share PDF");
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Warehouse report</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.content}>
        {/* Filter Section */}
        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Filter By</Text>

          <View style={styles.filterRow}>
            <TouchableOpacity
              style={styles.branchDropdown}
              onPress={handleBranchPress}
            >
              <Text style={styles.branchText}>{selectedBranch}</Text>
              <Feather name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
            >
              <Feather name="refresh-cw" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Table Section */}
        <View style={styles.tableSection}>
          {/* Table Header */}
          <TableRow
            itemName="Item name"
            sales="Sales"
            store="Store"
            isHeader={true}
          />

          {/* Table Data */}
          {reportData.map((item, index) => (
            <TableRow
              key={index}
              itemName={item.itemName}
              sales={item.sales}
              store={item.store}
            />
          ))}

          {/* Pagination */}
          <View style={styles.pagination}>
            <Text style={styles.paginationText}>2 - 0 of 2</Text>
          </View>
        </View>

        {/* Spacer to push buttons to bottom */}
        <View style={styles.spacer} />

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.previewButton}
            onPress={handlePreviewPDF}
          >
            <Feather name="file-text" size={20} color="#666" />
            <Text style={styles.previewText}>Preview PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shareButton} onPress={handleSharePDF}>
            <Feather name="share" size={20} color="#666" />
            <Text style={styles.shareText}>Share PDF</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    flex: 1,
    textAlign: "center",
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  filterSection: {
    backgroundColor: "white",
    padding: 16,
    marginTop: 16,
    borderRadius: 8,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  branchDropdown: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "white",
  },
  branchText: {
    fontSize: 14,
    color: "#000",
  },
  resetButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    backgroundColor: "white",
  },
  resetText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  refreshButton: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    backgroundColor: "white",
  },
  tableSection: {
    backgroundColor: "white",
    marginTop: 16,
    borderRadius: 8,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  tableHeader: {
    backgroundColor: "#F8F9FA",
  },
  tableCell: {
    fontSize: 14,
    color: "#000",
  },
  headerText: {
    fontWeight: "600",
    color: "#666",
    fontSize: 13,
  },
  itemNameCell: {
    flex: 2,
  },
  salesCell: {
    flex: 1.5,
    textAlign: "center",
  },
  storeCell: {
    flex: 1.5,
    textAlign: "right",
  },
  pagination: {
    alignItems: "center",
    paddingVertical: 16,
    backgroundColor: "white",
  },
  paginationText: {
    fontSize: 12,
    color: "#666",
  },
  spacer: {
    flex: 1,
  },
  actionButtons: {
    flexDirection: "row",
    paddingVertical: 20,
    paddingBottom: 30,
    gap: 12,
  },
  previewButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  previewText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
    fontWeight: "500",
  },
  shareButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  shareText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
    fontWeight: "500",
  },
});

export default WarehouseReportScreen;
