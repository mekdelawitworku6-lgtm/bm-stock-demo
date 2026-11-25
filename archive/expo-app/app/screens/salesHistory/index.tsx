"use client";

import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
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
import { COLORS } from "../../../constants/Colors";
import { useGetSalesHistoryQuery } from "../../../lib/Api/salesApi";

interface SalesHistoryScreenProps {
  navigation: any;
}

const SalesHistoryScreen: React.FC<SalesHistoryScreenProps> = ({
  navigation,
}) => {
  const [activeTab, setActiveTab] = useState("All Sales");
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);

  // Fetch sales data from API
  const { 
    data: salesData, 
    isLoading, 
    error, 
    refetch 
  } = useGetSalesHistoryQuery({
    page: 1,
    limit: 50,
    search: searchText,
    status: activeTab === "All Sales" ? "" : activeTab.toUpperCase(),
  });

  interface SalesItemProps {
    sale: any;
    onPress: (sale: any) => void;
  }

  const SalesItem: React.FC<SalesItemProps> = ({
    sale,
    onPress,
  }) => {
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const getStatusColor = (status: string) => {
      switch (status?.toLowerCase()) {
        case 'completed': return '#4CAF50';
        case 'pending': return '#FFCA28';
        case 'cancelled': return '#F44336';
        default: return '#666';
      }
    };

    // Use the totalAmount from API response instead of calculating
    const totalAmount = parseFloat(sale?.totalAmount || 0);

    return (
    <TouchableOpacity style={styles.salesItem} onPress={onPress}>
      <View style={styles.salesLeft}>
          <Text style={styles.salesName}>
            {sale?.customerName || 'Unknown Customer'}
          </Text>
          <Text style={styles.salesItems}>
            {sale?.warehouseName ? `Warehouse: ${sale.warehouseName}` : 'Location: Unknown'}
          </Text>
          <Text style={styles.salesDate}>
            {formatDate(sale?.saleDate || sale?.createdAt)}
          </Text>
      </View>
      <View style={styles.salesRight}>
          <Text style={styles.salesAmount}>
            ETB {totalAmount.toFixed(2)}
          </Text>
          <Text style={[styles.salesStatus, { color: getStatusColor(sale?.status) }]}>
            {sale?.status?.toUpperCase() || 'UNKNOWN'}
        </Text>
      </View>
    </TouchableOpacity>
  );
  };

  const handleSalesItemPress = (sale: any) => {
    navigation.navigate("SalesDetail", { saleData: sale });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Process sales data from API
  const sales = useMemo(() => {
    if (!salesData?.data?.data) return [];
    return salesData.data.data;
  }, [salesData]);

  const filteredSalesData = useMemo(() => {
    let filtered = sales.filter((sale: any) => {
      const matchesSearch = !searchText || 
        (sale?.customerName?.toLowerCase().includes(searchText.toLowerCase()) ||
         sale?.id?.toLowerCase().includes(searchText.toLowerCase()) ||
         sale?.warehouseName?.toLowerCase().includes(searchText.toLowerCase()));
      
      const matchesStatus = activeTab === "All Sales" || 
        sale?.status?.toLowerCase() === activeTab.toLowerCase();
      
      return matchesSearch && matchesStatus;
    });

    // Sort the filtered data
    filtered.sort((a: any, b: any) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "date":
          comparison = new Date(a.createdAt || a.saleDate).getTime() - new Date(b.createdAt || b.saleDate).getTime();
          break;
        case "amount":
          const amountA = parseFloat(a.totalAmount || 0);
          const amountB = parseFloat(b.totalAmount || 0);
          comparison = amountA - amountB;
          break;
        case "customer":
          const nameA = a.customerName || "";
          const nameB = b.customerName || "";
          comparison = nameA.localeCompare(nameB);
          break;
        case "status":
          const statusA = a.status || "";
          const statusB = b.status || "";
          comparison = statusA.localeCompare(statusB);
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === "desc" ? -comparison : comparison;
    });

    return filtered;
  }, [sales, searchText, activeTab, sortBy, sortOrder]);

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
          <Text style={styles.headerTitle}>Sales History</Text>
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
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text style={styles.filterSortText}>Filter By</Text>
          <Feather name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity 
          style={styles.sortButton}
          onPress={() => setShowSortModal(true)}
        >
          <Text style={styles.filterSortText}>Sort By</Text>
          <Feather name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Sales List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.salesList}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY} />
              <Text style={styles.loadingText}>Loading sales history...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Failed to load sales history</Text>
              <TouchableOpacity style={styles.retryButton} onPress={refetch}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredSalesData.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No sales found</Text>
              <Text style={styles.emptySubtext}>
                {searchText ? 'Try adjusting your search terms' : 'Sales will appear here once you make some transactions'}
              </Text>
            </View>
          ) : (
            filteredSalesData.map((sale: any, index: number) => (
              <React.Fragment key={sale.id || index}>
                <SalesItem
                  sale={sale}
                  onPress={() => handleSalesItemPress(sale)}
                />
                {index < filteredSalesData.length - 1 && (
                  <View style={styles.horizontalDivider} />
                )}
              </React.Fragment>
            ))
          )}
        </View>
      </ScrollView>

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSortModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort Sales</Text>
              <TouchableOpacity onPress={() => setShowSortModal(false)}>
                <Feather name="x" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.sortOptions}>
              {[
                { key: "date", label: "Date" },
                { key: "amount", label: "Amount" },
                { key: "customer", label: "Customer" },
                { key: "status", label: "Status" },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={styles.sortOption}
                  onPress={() => {
                    setSortBy(option.key);
                    setShowSortModal(false);
                  }}
                >
                  <Text style={styles.sortOptionText}>{option.label}</Text>
                  {sortBy === option.key && (
                    <Feather name="check" size={20} color="#1E88E5" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.sortOrderContainer}>
              <TouchableOpacity
                style={[styles.sortOrderButton, sortOrder === "asc" && styles.sortOrderButtonActive]}
                onPress={() => setSortOrder("asc")}
              >
                <Text style={[styles.sortOrderText, sortOrder === "asc" && styles.sortOrderTextActive]}>
                  Ascending
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortOrderButton, sortOrder === "desc" && styles.sortOrderButtonActive]}
                onPress={() => setSortOrder("desc")}
              >
                <Text style={[styles.sortOrderText, sortOrder === "desc" && styles.sortOrderTextActive]}>
                  Descending
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Filter Options */}
      {showFilters && (
        <View style={styles.filterOptions}>
          <Text style={styles.filterTitle}>Filter Options</Text>
          <TouchableOpacity
            style={styles.clearFiltersButton}
            onPress={() => {
              setSearchText("");
              setDateRange({ start: null, end: null });
              setSelectedStatus("all");
            }}
          >
            <Text style={styles.clearFiltersText}>Clear All Filters</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    // backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 40,
    // borderBottomWidth: 1,
    // borderBottomColor: "#F0F0F0",
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
    alignItems: "flex-end",
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
  tabsContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#000",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#999",
  },
  activeTabText: {
    color: "#000",
  },
  scrollView: {
    flex: 1,
  },
  salesList: {
    paddingHorizontal: 16,
  },
  salesItem: {
    // backgroundColor: "white",
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
  salesLeft: {
    flex: 1,
  },
  salesName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
    marginBottom: 2,
  },
  salesItems: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  salesDate: {
    fontSize: 12,
    color: "#666",
  },
  salesRight: {
    alignItems: "flex-end",
  },
  salesAmount: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  salesStatus: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 16,
    color: "#F44336",
    marginBottom: 16,
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
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    paddingHorizontal: 32,
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
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  sortOptions: {
    padding: 20,
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  sortOptionText: {
    fontSize: 16,
    color: "#333",
  },
  sortOrderContainer: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
  },
  sortOrderButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    alignItems: "center",
  },
  sortOrderButtonActive: {
    backgroundColor: "#1E88E5",
    borderColor: "#1E88E5",
  },
  sortOrderText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  sortOrderTextActive: {
    color: "white",
  },
  filterOptions: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  clearFiltersButton: {
    backgroundColor: "#F8F9FA",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  clearFiltersText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
});

export default SalesHistoryScreen;
