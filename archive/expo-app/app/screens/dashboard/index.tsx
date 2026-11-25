// DashboardScreen.tsx
import { COLORS } from "@/constants/Colors";
import { useGetCommissionsQuery } from "@/lib/Api/commissionApi";
import { useGetCompaniesQuery } from "@/lib/Api/CompaniesApi";
import { useGetCustomersQuery } from "@/lib/Api/customerApi";
import { getDateRange, useGetDashboardSummaryQuery } from "@/lib/Api/dashboardApi";
import {
    useGetExpiredProductsQuery,
    useGetLowStockProductsQuery,
} from "@/lib/Api/productApi";
import { useGetSalesHistoryQuery } from "@/lib/Api/salesApi";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSelector } from "react-redux";
import ErrorMessage from "../../../components/ErrorMessage";
import LoadingSpinner from "../../../components/LoadingSpinner";
import { RootState } from "../../../lib/store";
import CompanyModal from "./CompanyModal";
import FloatingActionPanel from "./FloatingActionPanel";

interface User {
  firstName: string;
  role: string;
  company?: { id: string };
}

interface Company {
  id: string;
  name: string;
}

interface DashboardScreenProps {
  navigation: any;
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trendColor?: string;
  icon?: keyof typeof import('@expo/vector-icons').Feather.glyphMap;
  onPress: () => void;
}

interface ReminderItemProps {
  icon: keyof typeof import('@expo/vector-icons').Feather.glyphMap;
  title: string;
  count: string;
  onPress: () => void;
}

interface SalesItemProps {
  customerName: string;
  time: string;
  amount: string;
  status: string;
  statusColor: string;
}

interface SummaryRowProps {
  label: string;
  amount: string;
  trendIcon?: string;
  trendColor?: string;
}

interface CommissionItemProps {
  commission: any;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const [showFloatingPanel, setShowFloatingPanel] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'sales' | 'commissions'>('sales');
  const [refreshing, setRefreshing] = useState(false);
  
  // Get user info from Redux state
  const { user } = useSelector((state: RootState) => state.auth);

  // Fetch companies from API
  const { data, isLoading, error, refetch: refetchCompanies } = useGetCompaniesQuery({
    page: 1,
    limit: 10,
  });

  // Fetch low stock products
  const { data: lowStockProduct, isLoading: isLowStockLoading, refetch: refetchLowStock } =
    useGetLowStockProductsQuery({ search: "" });

  // Fetch expired products count
  const { data: expiredProducts, isLoading: isExpiredLoading, refetch: refetchExpired } =
    useGetExpiredProductsQuery({ search: "" });

  // Fetch customers
  const { data: customers, isLoading: isCustomerLoading, refetch: refetchCustomers } =
    useGetCustomersQuery({ search: "" });

  // Fetch recent sales (limit to 3 for dashboard)
  const { data: salesData, isLoading: isSalesLoading, refetch: refetchSales } = useGetSalesHistoryQuery({
    page: 1,
    limit: 3,
    search: "",
    status: ""
  });

  // Fetch recent commissions (limit to 3 for dashboard)
  const { data: commissionsData, isLoading: isCommissionsLoading, refetch: refetchCommissions } = useGetCommissionsQuery({
    page: 1,
    limit: 3,
    search: "",
    employeeId: "",
    isApproved: undefined,
    startDate: "",
    endDate: "",
    commissionDate: ""
  });

  // Get data using: startDate = yesterday, endDate = tomorrow
  const dataRange = getDateRange.tomorrow();
  
  // Fetch dashboard summary data (using yesterday to tomorrow range)
  const { data: dashboardSummary, isLoading: isDashboardLoading, error: dashboardError, refetch: refetchDashboard } = useGetDashboardSummaryQuery({
    ...dataRange,
    format: "json"
  });

  // Transform API data to match CompanyModal expected format
  const companies = useMemo(
    () =>
      data?.companies?.map((company: Company) => ({
        id: company.id,
        name: company.name,
        initials: company.name
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase())
          .join("")
          .slice(0, 2),
        isActive: company.id === activeCompanyId,
      })) || [],
    [data, activeCompanyId]
  );

  // Set active company from user data
  useEffect(() => {
    if (user?.company?.id) {
      setActiveCompanyId(user.company.id);
    }
  }, [user]);

  // Set default active company when data loads
  useEffect(() => {
    if (data?.companies?.length && !activeCompanyId) {
      setActiveCompanyId(data.companies[0].id);
    }
  }, [data, activeCompanyId]);

  const StatCard = React.memo<StatCardProps>(({ title, value, subtitle, trendColor, icon, onPress }) => (
    <TouchableOpacity
      style={styles.statCard}
      onPress={onPress}
      accessible
      accessibilityLabel={title}
    >
      <Text style={styles.statTitle}>{title}</Text>
      <View style={styles.statValueContainer}>
        <Text style={styles.statValue}>{value}</Text>
        {icon && (
          <Feather
            name={icon}
            size={20}
            color={COLORS.PRIMARY}
            style={styles.statIcon}
          />
        )}
      </View>
      {subtitle && (
        <Text style={[styles.statSubtitle, { color: trendColor }]}>
          {subtitle}
        </Text>
      )}
    </TouchableOpacity>
  ));

  const ReminderItem = React.memo<ReminderItemProps>(({ icon, title, count, onPress }) => (
    <TouchableOpacity
      style={styles.reminderItem}
      onPress={onPress}
      accessible
      accessibilityLabel={`${title} ${count}`}
    >
      <View style={styles.reminderLeft}>
        <Feather
          name={icon}
          size={20}
          color="#666"
          style={styles.reminderIcon}
        />
        <Text style={styles.reminderTitle}>{title}</Text>
      </View>
      <View style={styles.reminderRight}>
        <Text style={styles.reminderCount}>{count}</Text>
        <Feather name="chevron-right" size={16} color="#999" />
      </View>
    </TouchableOpacity>
  ));

  const SalesItem = React.memo<SalesItemProps>(({ customerName, time, amount, status, statusColor }) => (
    <View style={styles.salesItem}>
      <View style={styles.salesLeft}>
        {/* <View style={styles.salesAvatar}>
          <Text style={styles.salesAvatarText}>{name.charAt(0)}</Text>
        </View> */}
        <View>
          <Text style={styles.salesName}>{customerName}</Text>
          <Text style={styles.salesTime}>{time}</Text>
        </View>
      </View>
      <View style={styles.salesRight}>
        <Text style={styles.salesAmount}>{amount}</Text>
        <View
          style={[
            styles.salesStatusContainer,
            { backgroundColor: statusColor },
          ]}
        >
          <Text style={styles.salesStatus}>{status}</Text>
        </View>
      </View>
    </View>
  ));

  const SummaryRow = React.memo<SummaryRowProps>(({ label, amount, trendIcon, trendColor }) => (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <View style={styles.summaryRight}>
        {trendIcon && (
          <Text style={[styles.trendIcon, { color: trendColor }]}>
            {trendIcon}
          </Text>
        )}
        <Text style={[styles.summaryAmount, { color: trendColor }]}>
          {amount}
        </Text>
      </View>
    </View>
  ));

  const CommissionItem = React.memo<CommissionItemProps>(({ commission }) => {
    if (!commission || !commission.employee || !commission.product) {
      return null;
    }

    return (
      <View style={styles.commissionItem}>
        <View style={styles.commissionLeft}>
          <View>
            <Text style={styles.commissionEmployeeName}>
              {commission.employee.name || "Unknown Employee"}
            </Text>
            <Text style={styles.commissionProductName}>
              {commission.product.name || "Unknown Product"}
            </Text>
            <Text style={styles.commissionTime}>
              {formatDate(commission.commissionDate)}
            </Text>
          </View>
        </View>
        <View style={styles.commissionRight}>
          <Text style={styles.commissionAmount}>
            ETB {parseFloat(commission.commissionAmount || 0).toFixed(2)}
          </Text>
          <View
            style={[
              styles.commissionStatusContainer,
              { backgroundColor: commission.isApproved ? "#E8F5E9" : "#FFF3E0" },
            ]}
          >
            <Text style={styles.commissionStatus}>
              {commission.isApproved ? "Approved" : "Pending"}
            </Text>
          </View>
        </View>
      </View>
    );
  });

  // Helper function to format sales data
  const formatSalesData = useCallback((sales: any[]) => {
    if (!sales || !Array.isArray(sales)) return [];
    
    return sales.map((sale) => ({
      id: sale.id,
      customerName: sale.customerName || "Unknown Customer",
      amount: `ETB ${parseFloat(sale.totalAmount || 0).toFixed(2)}`,
      time: formatDate(sale.createdAt),
      status: sale.status || "completed",
      statusColor: getStatusColor(sale.status)
    }));
  }, []);

  // Helper function to format dates as "01 Sep, 2025"
  const formatDate = useCallback((dateString: any) => {
    if (!dateString) return "Unknown Date";
    
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    
    return `${day} ${month}, ${year}`;
  }, []);

  // Helper function to get status color
  const getStatusColor = useCallback((status: any) => {
    switch (status) {
      case 'completed':
        return "#E8F5E9";
      case 'pending':
        return "#FFF3E0";
      case 'cancelled':
        return "#FFEBEE";
      default:
        return "#E8F5E9";
    }
  }, []);

  const handleFloatingAction = useCallback((action: string) => {
    setShowFloatingPanel(false);
    console.log(`${action} pressed`);
  }, []);

  const toggleFloatingPanel = useCallback(() => {
    setShowFloatingPanel(!showFloatingPanel);
  }, [showFloatingPanel]);

  const toggleCompanyModal = useCallback(() => {
    setShowCompanyModal(!showCompanyModal);
  }, [showCompanyModal]);

  const handleHistoryTabChange = useCallback((tab: 'sales' | 'commissions') => {
    setActiveHistoryTab(tab);
  }, []);

  // Handle pull-to-refresh
  const onRefresh = useCallback(async () => {
    if (refreshing) return; // Prevent multiple simultaneous refreshes
    
    setRefreshing(true);
    try {
      // Refetch all dashboard data
      await Promise.all([
        refetchCompanies(),
        refetchLowStock(),
        refetchExpired(),
        refetchCustomers(),
        refetchSales(),
        refetchCommissions(),
        refetchDashboard(),
      ]);
      
      // Add a small delay to show the refresh animation
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
    } finally {
      setRefreshing(false);
    }
  }, [
    refreshing,
    refetchCompanies,
    refetchLowStock,
    refetchExpired,
    refetchCustomers,
    refetchSales,
    refetchCommissions,
    refetchDashboard,
  ]);

  const activeCompany = companies.find((c: any) => c.isActive) || companies[0];

  // Show loading spinner if companies are loading (but not during refresh)
  if (isLoading && !refreshing) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.PRIMARY]}
            tintColor={COLORS.PRIMARY}
            title="Pull to refresh"
            titleColor="#666"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image
              source={require("@/assets/images/Logo/gelagle_logo_horizontal.png")}
              resizeMode="contain"
              style={styles.logoIcon}
            />
            <View style={styles.userInfoContainer}>
              <Text style={styles.userName}>
                {user?.firstName || "User"}
              </Text>
              <Text style={styles.headerSubtitle}>
                {user?.role || "Role"}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.notificationIcon}
              accessible
              accessibilityLabel="Notifications"
              onPress={() => navigation.navigate("Notifications")}
            >
              <Feather name="bell" size={20} color="#333" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.companyButton}
              onPress={toggleCompanyModal}
              accessible
              accessibilityLabel="Select Company"
            >
              <Text style={styles.companyButtonText}>
                {isLoading
                  ? "Loading..."
                  : activeCompany?.name || "Select Company"}
              </Text>
              <Feather name="chevron-down" size={16} color="white" />
            </TouchableOpacity>
            {refreshing && (
              <View style={styles.refreshIndicator}>
                <Feather name="refresh-cw" size={16} color={COLORS.PRIMARY} />
              </View>
            )}
          </View>
        </View>

        {/* Error Handling */}
        {error && (
          <ErrorMessage
            message="Failed to load companies. Please try again."
            onRetry={() => {
              // Refetch companies - this will be handled by RTK Query automatically
              console.log("Retrying companies fetch...");
            }}
          />
        )}

        {/* Dashboard Error Handling */}
        {dashboardError && (
          <ErrorMessage
            message="Failed to load dashboard data. Please try again."
            onRetry={() => {
              console.log("Retrying dashboard fetch...");
            }}
          />
        )}

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <StatCard
              title="Today's Sales"
              value={
                isDashboardLoading 
                  ? "Loading..." 
                  : `$${dashboardSummary?.data?.sales?.totalRevenue?.toLocaleString() || 0}`
              }
              subtitle={`${dashboardSummary?.data?.sales?.totalSales || 0} transactions`}
              trendColor="#4CAF50"
              icon="dollar-sign"
              onPress={() => navigation.navigate("salesHistory")}
            />
            <StatCard
              title="Total Products"
              value={
                isDashboardLoading 
                  ? "Loading..." 
                  : dashboardSummary?.data?.inventory?.totalProducts?.toString() || "0"
              }
              subtitle={`$${dashboardSummary?.data?.inventory?.totalStockValue?.toLocaleString() || 0} value`}
              trendColor="#2196F3"
              icon="package"
              onPress={() => navigation.navigate("Products")}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              title="Expired Items"
              value={
                isDashboardLoading 
                  ? "Loading..." 
                  : dashboardSummary?.data?.inventory?.expiredItems?.toString() || "0"
              }
              icon="alert-triangle"
              onPress={() => navigation.navigate("ExpireItems")}
            />
            <StatCard
              title="Low Stock"
              value={
                isDashboardLoading 
                  ? "Loading..." 
                  : dashboardSummary?.data?.inventory?.lowStockItems?.toString() || "0"
              }
              icon="trending-down"
              onPress={() => navigation.navigate("LowStock")}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              title="Transfer Requests"
              value="View All"
              subtitle="Manage transfers"
              trendColor="#FF9800"
              icon="truck"
              onPress={() => navigation.navigate("TransferRequests")}
            />
            <StatCard
              title="Branch Transfer"
              value="Create New"
              subtitle="Transfer items"
              trendColor="#9C27B0"
              icon="shuffle"
              onPress={() => navigation.navigate("BranchTransfer")}
            />
          </View>
        </View>

        {/* Low Stock Reminder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Low stock Reminder</Text>
          <View style={styles.reminderContainer}>
            <ReminderItem
              icon="package"
              title="Low in stock"
              count={
                isLowStockLoading
                  ? "Loading..."
                  : `${lowStockProduct?.length || 0} items`
              }
              onPress={() => navigation.navigate("LowStock")}
            />
          </View>
        </View>

        {/* History */}
        <View style={styles.history}>
          {/* <Text style={styles.historyTitle}>History</Text> */}
          <View style={styles.historyTabs}>
            <TouchableOpacity 
              style={[styles.historyTab, activeHistoryTab === 'sales' && styles.activeTab]}
              onPress={() => handleHistoryTabChange('sales')}
            >
              <Text style={[styles.historyTabText, activeHistoryTab === 'sales' && styles.activeTabText]}>
                Sales
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.historyTab, activeHistoryTab === 'commissions' && styles.activeTab]}
              onPress={() => handleHistoryTabChange('commissions')}
            >
              <Text style={[styles.historyTabText, activeHistoryTab === 'commissions' && styles.activeTabText]}>
                Commissions
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Sales/Commissions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {activeHistoryTab === 'sales' ? 'Recent Sales' : 'Recent Commissions'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (activeHistoryTab === 'sales') {
                  navigation.navigate("salesHistory");
                } else if (activeHistoryTab === 'commissions') {
                  navigation.navigate("commission");
                }
              }}
              accessible
              accessibilityLabel={`View All ${activeHistoryTab}`}
            >
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {activeHistoryTab === 'sales' && (
            <View style={styles.salesContainer}>
              {isSalesLoading ? (
                <Text style={styles.loadingText}>Loading sales...</Text>
              ) : formatSalesData(salesData?.data?.data).length > 0 ? (
                formatSalesData(salesData?.data?.data).slice(0, 3).map((sale) => (
                  <SalesItem
                    key={sale.id}
                    customerName={sale.customerName}
                    time={sale.time}
                    amount={sale.amount}
                    status={sale.status}
                    statusColor={sale.statusColor}
                  />
                ))
              ) : (
                <Text style={styles.noDataText}>No recent sales found</Text>
              )}
            </View>
          )}

          {activeHistoryTab === 'commissions' && (
            <View style={styles.commissionsContainer}>
              {isCommissionsLoading ? (
                <Text style={styles.loadingText}>Loading commissions...</Text>
              ) : commissionsData?.data && Array.isArray(commissionsData?.data) && commissionsData?.data.length > 0 ? (
                commissionsData?.data.slice(0, 3).map((commission) => (
                  <CommissionItem
                    key={commission.id}
                    commission={commission}
                  />
                ))
              ) : (
                <Text style={styles.noDataText}>No recent commissions found</Text>
              )}
            </View>
          )}
        </View>
        {/* Inventory Summary */}
        <TouchableOpacity
          style={styles.section}
          onPress={() => navigation.navigate("GenerateReport")}
          accessible
          accessibilityLabel="Inventory Summary"
        >
          <Text style={styles.sectionTitle}>Inventory summary</Text>
          <View style={styles.inventoryContainer}>
            <View style={styles.inventoryItem}>
              <Text style={styles.inventoryLabel}>Total Products</Text>
              <Text style={styles.inventoryValue}>
                {isDashboardLoading 
                  ? "Loading..." 
                  : dashboardSummary?.data?.inventory?.totalProducts?.toString() || "0"
                }
              </Text>
            </View>
            <View style={styles.inventoryDivider} />
            <View style={styles.inventoryItem}>
              <Text style={styles.inventoryLabel}>Stock Value</Text>
              <Text style={styles.inventoryValue}>
                {isDashboardLoading 
                  ? "Loading..." 
                  : `$${dashboardSummary?.data?.inventory?.totalStockValue?.toLocaleString() || 0}`
                }
              </Text>
            </View>
          </View>
        </TouchableOpacity>


        {/* Today's Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Summary</Text>
          <View style={styles.summaryContainer}>
            <SummaryRow 
              label="Total Sales" 
              amount={
                isDashboardLoading 
                  ? "Loading..." 
                  : `$${dashboardSummary?.data?.sales?.totalRevenue?.toLocaleString() || 0}`
              } 
            />
            <SummaryRow 
              label="Total Transactions" 
              amount={
                isDashboardLoading 
                  ? "Loading..." 
                  : dashboardSummary?.data?.sales?.totalSales?.toString() || "0"
              } 
            />
            <SummaryRow 
              label="Average Sale" 
              amount={
                isDashboardLoading 
                  ? "Loading..." 
                  : `$${dashboardSummary?.data?.sales?.averageSaleAmount?.toFixed(2) || 0}`
              } 
            />
            <SummaryRow
              label="Total Expenses"
              amount={
                isDashboardLoading 
                  ? "Loading..." 
                  : `$${dashboardSummary?.data?.expenses?.totalAmount?.toLocaleString() || 0}`
              }
              trendColor="#DC2626"
            />
            <View style={styles.summaryDivider} />
            <SummaryRow
              label="Net Profit"
              amount={
                isDashboardLoading 
                  ? "Loading..." 
                  : `$${((dashboardSummary?.data?.sales?.totalRevenue || 0) - (dashboardSummary?.data?.expenses?.totalAmount || 0)).toLocaleString()}`
              }
              trendColor="#4CAF50"
            />
            <View style={styles.IncomeExpenceRow}>
              <View style={styles.IncomeExpenceItems}>
                <Feather name="arrow-up" size={16} color="#16A34A" />
                <Text style={styles.IncomeExpenceTitle}>Income</Text>
                <Text style={styles.IncomeExpenceAmount}>
                  {isDashboardLoading 
                    ? "Loading..." 
                    : `$${dashboardSummary?.data?.sales?.totalRevenue?.toLocaleString() || 0}`
                  }
                </Text>
              </View>
              <View style={styles.IncomeExpenceItems}>
                <Feather name="arrow-down" size={16} color="#DC2626" />
                <Text style={styles.IncomeExpenceTitle}>Expense</Text>
                <Text style={styles.IncomeExpenceAmount}>
                  {isDashboardLoading 
                    ? "Loading..." 
                    : `$${dashboardSummary?.data?.expenses?.totalAmount?.toLocaleString() || 0}`
                  }
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      <FloatingActionPanel
        show={showFloatingPanel}
        onToggle={toggleFloatingPanel}
        onAction={handleFloatingAction}
      />

      <CompanyModal
        show={showCompanyModal}
        onToggle={toggleCompanyModal}
        companies={companies}
        activeCompanyId={activeCompanyId}
      />
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 40,
  },
  headerLeft: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  logoIcon: {
    height: 40,
    width: 150,
    marginRight: 10,
  },
  userInfoContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  userName: {
    fontSize: 16,
    color: "#666",
    fontWeight: "bold",
    marginRight: 8,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.SUCCESS_TEXT,
    backgroundColor: COLORS.SUCCESS,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  notificationIcon: {
    marginRight: 10,
    padding: 8,
  },
  companyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1976D2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  companyButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
    marginRight: 5,
  },
  refreshIndicator: {
    marginLeft: 8,
    padding: 4,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: "#FFEEEE",
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    color: "#FF4444",
    fontSize: 14,
    textAlign: "center",
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statTitle: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
  },
  statValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  statIcon: {
    marginLeft: 8,
  },
  statSubtitle: {
    fontSize: 11,
    fontWeight: "500",
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 16,
    backgroundColor: "white",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  viewAllText: {
    fontSize: 14,
    color: COLORS.PRIMARY,
    fontWeight: "500",
  },
  reminderContainer: {},
  reminderItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  reminderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  reminderIcon: {
    marginRight: 12,
  },
  reminderTitle: {
    fontSize: 15,
    color: "#000",
    fontWeight: "500",
  },
  reminderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  reminderCount: {
    fontSize: 14,
    color: "#666",
    marginRight: 8,
  },
  inventoryContainer: {
    flexDirection: "row",
  },
  inventoryItem: {
    flex: 1,
    padding: 16,
    alignItems: "center",
  },
  inventoryDivider: {
    width: 2,
    backgroundColor: COLORS.PRIMARY,
    marginVertical: 16,
  },
  inventoryLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
  },
  inventoryValue: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
  },
  history: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
  },
  historyTabs: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  historyTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: COLORS.BACKGROUND,
  },
  historyTabText: {
    fontSize: 14,
    color: COLORS.SUBTEXT,
    fontWeight: "500",
  },
  activeTabText: {
    color: COLORS.SUBTEXT,
  },
  salesContainer: {},
  commissionsContainer: {},
  loadingText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    paddingVertical: 20,
  },
  noDataText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    paddingVertical: 20,
  },
  salesItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  salesLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  salesName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
    marginBottom: 2,
  },
  salesTime: {
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
  salesStatusContainer: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  salesStatus: {
    fontSize: 12,
    fontWeight: "500",
    color: "#000",
  },
  commissionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  commissionLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  commissionEmployeeName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
    marginBottom: 2,
  },
  commissionProductName: {
    fontSize: 13,
    color: "#666",
    marginBottom: 2,
  },
  commissionTime: {
    fontSize: 12,
    color: "#999",
  },
  commissionRight: {
    alignItems: "flex-end",
  },
  commissionAmount: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  commissionStatusContainer: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  commissionStatus: {
    fontSize: 12,
    fontWeight: "500",
    color: "#000",
  },
  summaryContainer: {
    backgroundColor: "white",
    borderRadius: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: "#666",
  },
  summaryRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  trendIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: "500",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginVertical: 8,
  },
  IncomeExpenceRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    paddingVertical: 16,
    backgroundColor: COLORS.LIGHTBACKGROUND,
    borderRadius: 16,
    marginVertical: 16,
  },
  IncomeExpenceItems: {
    flexDirection: "column",
    alignItems: "center",
  },
  IncomeExpenceTitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  IncomeExpenceAmount: {
    fontSize: 18,
    fontWeight: "500",
    color: "#000",
  },
  bottomSpacing: {
    height: 100,
  },
});

export default DashboardScreen;
