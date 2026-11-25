import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { COLORS } from "../../../constants/Colors";
import {
    Commission,
    CommissionFilters,
    useApproveCommissionMutation,
    useGetCommissionsQuery,
    useRejectCommissionMutation
} from "../../../lib/Api/commissionApi";

interface CommissionScreenProps {
  navigation: any;
}

const CommissionScreen: React.FC<CommissionScreenProps> = ({ navigation }) => {
  const [selectedBranch, setSelectedBranch] = useState("All Branches");
  const [filters, setFilters] = useState<CommissionFilters>({
    page: 1,
    limit: 20,
    search: "",
    isApproved: undefined,
  });
  const [refreshing, setRefreshing] = useState(false);

  // API hooks
  const { 
    data: commissionsData, 
    isLoading, 
    error, 
    refetch 
  } = useGetCommissionsQuery(filters);
  
  const [approveCommission] = useApproveCommissionMutation();
  const [rejectCommission] = useRejectCommissionMutation();

  const commissions = commissionsData?.data || [];

  const CommissionItem = ({ commission }: { commission: Commission }) => {
    const handleApprove = async () => {
      try {
        await approveCommission(commission.id).unwrap();
        Alert.alert("Success", "Commission approved successfully");
      } catch (error) {
        Alert.alert("Error", "Failed to approve commission");
      }
    };

    const handleReject = async () => {
      try {
        await rejectCommission(commission.id).unwrap();
        Alert.alert("Success", "Commission rejected successfully");
      } catch (error) {
        Alert.alert("Error", "Failed to reject commission");
      }
    };

    return (
      <View style={styles.commissionItem}>
        <View style={styles.commissionLeft}>
          <Text style={styles.employeeName}>{commission.employee.name}</Text>
          <Text style={styles.employeeEmail}>{commission.employee.phoneNumber}</Text>
          <View style={styles.employeeDetails}>
            <View style={styles.roleTag}>
              <Text style={styles.roleText}>{commission.employee.jobTitle || "Employee"}</Text>
            </View>
            <Text style={styles.branchText}>{commission.product.category}</Text>
          </View>
          <Text style={styles.productName}>{commission.product.name}</Text>
          <Text style={styles.saleInfo}>Invoice: {commission.sale.invoiceNumber}</Text>
        </View>
        <View style={styles.commissionRight}>
          <Text style={styles.commissionAmount}>${commission.commissionAmount}</Text>
          <Text style={styles.commissionRate}>{commission.commissionRate}%</Text>
          <Text style={styles.commissionDate}>{new Date(commission.commissionDate).toLocaleDateString()}</Text>
          <View
            style={[
              styles.statusBadge, 
              commission.isApproved ? styles.approvedBadge : styles.pendingBadge
            ]}
          >
            <Text
              style={[
                styles.statusText, 
                commission.isApproved ? styles.approvedText : styles.pendingText
              ]}
            >
              {commission.isApproved ? "Approved" : "Pending"}
            </Text>
          </View>
          {!commission.isApproved && (
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.approveButton]} 
                onPress={handleApprove}
              >
                <Text style={styles.approveButtonText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, styles.rejectButton]} 
                onPress={handleReject}
              >
                <Text style={styles.rejectButtonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const handleAddCommission = () => {
    // Navigate to add commission screen or show modal
    console.log("Add commission amount");
  };

  const handleBranchPress = () => {
    // Show branch selection modal
    console.log("Branch dropdown pressed");
  };

  const handleReset = () => {
    setFilters({
      page: 1,
      limit: 20,
      search: "",
      isApproved: undefined,
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handleFilterChange = (newFilters: Partial<CommissionFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Commission</Text>
          <View style={styles.addButton} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load commissions</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commission</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddCommission}
        >
          <Text style={styles.addButtonText}>Add commission Amount</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Filter Section */}
        <View style={styles.filterSection}>
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

        {/* Commission List */}
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY} />
              <Text style={styles.loadingText}>Loading commissions...</Text>
            </View>
          ) : commissions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="inbox" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No commissions found</Text>
              <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
            </View>
          ) : (
            <View style={styles.commissionList}>
              {commissions.map((commission) => (
                <CommissionItem
                  key={commission.id}
                  commission={commission}
                />
              ))}
            </View>
          )}
        </ScrollView>
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
    marginLeft: 16,
  },
  addButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "white",
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
  scrollView: {
    flex: 1,
    marginTop: 16,
  },
  commissionList: {
    gap: 12,
  },
  commissionItem: {
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  commissionLeft: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  employeeEmail: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
  },
  employeeDetails: {
    flexDirection: "row",
    alignItems: "center",
  },
  roleTag: {
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  roleText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#666",
  },
  branchText: {
    fontSize: 12,
    color: "#666",
  },
  commissionRight: {
    alignItems: "flex-end",
  },
  commissionAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#F0F0F0",
  },
  paidBadge: {
    backgroundColor: "#4CAF50",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#666",
  },
  paidText: {
    color: "white",
  },
  // New styles for updated components
  productName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginTop: 4,
  },
  saleInfo: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  commissionRate: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  commissionDate: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
  },
  approvedBadge: {
    backgroundColor: "#4CAF50",
  },
  pendingBadge: {
    backgroundColor: "#FF9800",
  },
  approvedText: {
    color: "white",
  },
  pendingText: {
    color: "white",
  },
  actionButtons: {
    flexDirection: "row",
    marginTop: 8,
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 60,
    alignItems: "center",
  },
  approveButton: {
    backgroundColor: "#4CAF50",
  },
  rejectButton: {
    backgroundColor: "#F44336",
  },
  approveButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "500",
  },
  rejectButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "500",
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
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#666",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  errorText: {
    fontSize: 16,
    color: "#F44336",
    marginBottom: 16,
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
    fontWeight: "500",
  },
});

export default CommissionScreen;
