import {
  useCreateCreditPaymentMutation,
  useGetCreditAccountsQuery,
  useGetCreditPaymentsQuery,
  useGetCreditReportsQuery
} from "@/lib/Api/creditApi";
import {
  useCreatePurchasePaymentMutation,
  useGetPurchaseDashboardStatsQuery,
  useGetPurchaseOrdersQuery,
} from "@/lib/Api/purchaseApi";
import { RootState } from "@/lib/store";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useSelector } from "react-redux";
import { COLORS } from "../../../constants/Colors";

interface CreditScreenProps {
  navigation: any;
}

interface CreditItemProps {
  name: string;
  items: string;
  date: string;
  amount: string;
  status: string;
  statusColor: string;
  onPress: () => void;
}

interface DetailRowProps {
  label: string;
  value: string;
  valueStyle?: any;
}

interface CreditAccount {
  id: string;
  name: string;
  items: string;
  date: string;
  amount: string;
  status: string;
  statusColor: string;
  product?: {
    name: string;
    code: string;
    store: string;
  };
  transaction?: {
    quantity: number;
    sellingPrice: number;
    total: number;
    taxExcluded: boolean;
  };
  customer?: {
    name: string;
    phone: string;
  };
  moreDetails?: {
    dateOfSales: string;
    paymentType: string;
    soldBy: string;
    soldAt: string;
  };
  // Payables properties
  supplier?: {
    name: string;
    phoneNumber?: string;
  };
  paymentStatus?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  purchaseItems?: any[];
}

const CreditScreen: React.FC<CreditScreenProps> = ({ navigation }) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const [activeTab, setActiveTab] = useState("Receivables");
  const [searchText, setSearchText] = useState("");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<CreditAccount | null>(null);
  const [viewMode, setViewMode] = useState<"transaction" | "person">("transaction");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [showCreditPaymentModal, setShowCreditPaymentModal] = useState(false);
  const [creditPaymentAmount, setCreditPaymentAmount] = useState("");
  const [creditPaymentMethod, setCreditPaymentMethod] = useState("cash");
  const [creditPaymentNotes, setCreditPaymentNotes] = useState("");

  // API hooks
  const { data: creditAccountsData, isLoading: isLoadingAccounts, error: accountsError, refetch: refetchAccounts } = useGetCreditAccountsQuery({
    page: 1,
    limit: 50,
    search: searchText,
  });

  const { data: creditReportsData, isLoading: isLoadingReports } = useGetCreditReportsQuery({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    type: 'summary'
  });

  const [createCreditPayment, { isLoading: isCreatingPayment }] = useCreateCreditPaymentMutation();
  const [createPurchasePayment, { isLoading: isCreatingPurchasePayment }] = useCreatePurchasePaymentMutation();

  // Credit payments query - now using correct endpoint
  const { data: creditPaymentsData, isLoading: isLoadingPayments, error: creditPaymentsError } = useGetCreditPaymentsQuery(
    { creditAccountId: selectedCredit?.id || '', page: 1, limit: 10 },
    { skip: !selectedCredit?.id }
  );

  // Payables API hooks
  const { data: purchaseData, isLoading: isLoadingPurchases, error: purchaseError, refetch: refetchPurchases } = useGetPurchaseOrdersQuery({
    page: 1,
    limit: 50,
  });

  const { data: purchaseStatsData, isLoading: isLoadingPurchaseStats } = useGetPurchaseDashboardStatsQuery({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  // Auto-refresh credit list when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Refetch credit accounts when screen comes into focus
      if (refetchAccounts) {
        refetchAccounts();
      }
      // Also refetch purchase orders for payables
      if (refetchPurchases) {
        refetchPurchases();
      }
    }, [refetchAccounts, refetchPurchases])
  );

  // Process API data - handle the nested response structure
  // API returns: { success: true, data: { data: [...], total: 0, page: 1 } }
  const creditAccounts = Array.isArray(creditAccountsData?.data?.data) 
    ? creditAccountsData.data.data.filter((account: any) => {
        // Filter out fully paid credits
        const status = account.status?.toLowerCase();
        return status !== 'fully_paid' && status !== 'fully paid';
      })
    : [];
  const reports = creditReportsData?.data || {};

  const CreditItem: React.FC<CreditItemProps> = ({
    name,
    items,
    date,
    amount,
    status,
    statusColor,
    onPress,
  }) => (
    <TouchableOpacity style={styles.creditItem} onPress={onPress}>
      <View style={styles.creditLeft}>
        <Text style={styles.creditName}>{name}</Text>
        <Text style={styles.creditItems}>{items}</Text>
        <Text style={styles.creditDate}>{date}</Text>
      </View>
      <View style={styles.creditRight}>
        <Text style={styles.creditAmount}>{amount}</Text>
        <Text style={[styles.creditStatus, { color: statusColor }]}>
          {status}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Transform API data to match the expected format
  const transformCreditAccount = (account: any) => {
    // Determine status based on backend data
    // Status enum: pending, approved, active, partially_paid, fully_paid, overdue, written_off, cancelled
    let status = 'active';
    let statusDisplay = 'ACTIVE';
    
    if (account.isOverdue) {
      status = 'overdue';
      statusDisplay = 'OVERDUE';
    } else if (account.status === 'fully_paid') {
      status = 'paid';
      statusDisplay = 'PAID';
    } else if (account.status === 'partially_paid') {
      status = 'partial';
      statusDisplay = 'PARTIAL';
    } else if (account.status === 'pending') {
      status = 'pending';
      statusDisplay = 'PENDING';
    } else if (account.status === 'cancelled') {
      status = 'cancelled';
      statusDisplay = 'CANCELLED';
    }
    
    const statusColor = 
      status === 'overdue' ? '#F44336' :
      status === 'partial' ? '#FFCA28' :
      status === 'paid' ? '#4CAF50' : 
      status === 'pending' ? '#FF9800' :
      status === 'cancelled' ? '#999' : '#2196F3';
    
    // Get customer name from customer object
    const customerName = account.customer?.name || 'Unknown Customer';
    const customerPhone = account.customer?.phoneNumber || account.customer?.phone || 'N/A';
    
    // Get seller name from createdBy object
    const sellerName = account.createdBy 
      ? `${account.createdBy.firstName || ''} ${account.createdBy.lastName || ''}`.trim()
      : 'N/A';
    
    return {
      id: account.id,
      name: customerName,
      items: `Credit #${account.creditNumber || account.id.slice(0, 8)}`,
      date: account.issueDate ? new Date(account.issueDate).toLocaleDateString() : 
            (account.createdAt ? new Date(account.createdAt).toLocaleDateString() : 'N/A'),
      amount: `$${(parseFloat(account.remainingBalance || account.totalAmount || 0)).toFixed(2)}`,
      status: statusDisplay,
      statusColor,
      product: {
        name: account.description || 'Credit Sale',
        code: account.creditNumber || 'N/A',
        store: `Payment Terms: ${account.paymentTermsDays || 0} days`,
      },
      transaction: {
        quantity: 1,
        sellingPrice: account.principalAmount || 0,
        total: account.totalAmount || 0,
        taxExcluded: false,
      },
      customer: {
        name: customerName,
        phone: customerPhone,
      },
      moreDetails: {
        dateOfSales: account.issueDate ? new Date(account.issueDate).toLocaleString() : 
                     (account.createdAt ? new Date(account.createdAt).toLocaleString() : 'N/A'),
        paymentType: `Credit (${account.type || 'receivable'})`,
        soldBy: sellerName,
        soldAt: account.issueDate ? new Date(account.issueDate).toLocaleDateString() : 'N/A',
      },
    };
  };

  const receivablesData = creditAccounts.map(transformCreditAccount);

  // Group credits by person for person view
  const groupCreditsByPerson = (credits: any[]) => {
    const grouped = credits.reduce((acc, credit) => {
      const customerName = credit.customer?.name || 'Unknown Customer';
      if (!acc[customerName]) {
        acc[customerName] = {
          customerName,
          totalAmount: 0,
          totalPaid: 0,
          remainingBalance: 0,
          creditCount: 0,
          credits: [],
          status: 'active',
          lastCreditDate: null,
        };
      }
      
      const amount = parseFloat(credit.amount.replace('$', '').replace(',', '')) || 0;
      const paidAmount = (credit.transaction?.total || 0) - amount;
      
      acc[customerName].totalAmount += credit.transaction?.total || 0;
      acc[customerName].totalPaid += paidAmount;
      acc[customerName].remainingBalance += amount;
      acc[customerName].creditCount += 1;
      acc[customerName].credits.push(credit);
      
      // Update last credit date
      const creditDate = new Date(credit.moreDetails?.dateOfSales || credit.date);
      if (!acc[customerName].lastCreditDate || creditDate > acc[customerName].lastCreditDate) {
        acc[customerName].lastCreditDate = creditDate;
      }
      
      return acc;
    }, {});
    
    return Object.values(grouped).map((group: any) => ({
      id: group.customerName,
      name: group.customerName,
      items: `${group.creditCount} credit${group.creditCount > 1 ? 's' : ''}`,
      date: group.lastCreditDate ? group.lastCreditDate.toLocaleDateString() : 'N/A',
      amount: `$${group.remainingBalance.toFixed(2)}`,
      status: group.remainingBalance > 0 ? 'ACTIVE' : 'PAID',
      statusColor: group.remainingBalance > 0 ? '#2196F3' : '#4CAF50',
      totalAmount: group.totalAmount,
      totalPaid: group.totalPaid,
      remainingBalance: group.remainingBalance,
      creditCount: group.creditCount,
      credits: group.credits,
    }));
  };

  const personCreditsData = groupCreditsByPerson(receivablesData);
  
  // Process payables data
  const purchaseOrders = Array.isArray(purchaseData?.data?.data) 
    ? purchaseData.data.data 
    : [];
  const purchaseStats = purchaseStatsData?.data || {};

  // Transform purchase orders to payables format
  const transformPayable = (purchase: any) => {
    const isUnpaid = purchase.paymentStatus === 'unpaid' || purchase.paymentStatus === 'partial';
    const statusColor = isUnpaid ? '#F44336' : '#4CAF50';
    
    return {
      id: purchase.id,
      name: purchase.supplier?.name || 'Unknown Supplier',
      items: `PO #${purchase.poNumber || purchase.id.slice(0, 8)}`,
      date: purchase.orderDate ? new Date(purchase.orderDate).toLocaleDateString() : 'N/A',
      amount: `$${(parseFloat(purchase.totalAmount) || 0).toFixed(2)}`,
      status: isUnpaid ? 'UNPAID' : 'PAID',
      statusColor,
      supplier: purchase.supplier,
      totalAmount: purchase.totalAmount,
      paymentStatus: purchase.paymentStatus,
      orderDate: purchase.orderDate,
      expectedDeliveryDate: purchase.expectedDeliveryDate,
      purchaseItems: purchase.items || [],
    };
  };

  const payablesData = purchaseOrders
    .filter((purchase: any) => 
      purchase.paymentStatus === 'unpaid' || purchase.paymentStatus === 'partial'
    )
    .map(transformPayable);

  const displayData = activeTab === "Receivables" 
    ? (viewMode === "person" ? personCreditsData : receivablesData)
    : payablesData;

  const handleCreditItemPress = (item: CreditAccount) => {
    setSelectedCredit(item);
    setShowDetailsModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setSelectedCredit(null);
  };

  const DetailRow: React.FC<DetailRowProps> = ({ label, value, valueStyle = {} }) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueStyle]}>{value}</Text>
    </View>
  );


  const handlePrintInvoice = () => {
    // PDF functionality removed for now
    Alert.alert('Info', 'PDF download feature is temporarily disabled');
  };

  const handleMakeCreditPayment = () => {
    if (!selectedCredit) return;
    
    // Check if credit is fully paid
    if (selectedCredit.status === 'fully_paid' || selectedCredit.status === 'Fully Paid') {
      Alert.alert('Info', 'This credit is already fully paid');
      return;
    }
    
    setCreditPaymentAmount(selectedCredit.amount.replace('$', ''));
    setShowCreditPaymentModal(true);
  };

  const handleCreditPaymentSubmit = async () => {
    if (!selectedCredit || !creditPaymentAmount) return;
    
    // Check user role before attempting payment
    const userRole = user?.role?.toLowerCase();
    const allowedRoles = ['super_admin', 'company_admin', 'manager', 'shop_employee', 'user'];
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      alert(`Access Denied: Your role (${userRole || 'Unknown'}) does not have permission to record credit payments. Required roles: ${allowedRoles.join(', ')}. Please contact your administrator.`);
      return;
    }
    
    try {
      await createCreditPayment({
        creditAccountId: selectedCredit.id,
        data: {
          amount: parseFloat(creditPaymentAmount),
          paymentMethod: creditPaymentMethod,
          notes: creditPaymentNotes || `Payment for ${selectedCredit.items}`,
        },
      }).unwrap();
      
      alert('Payment recorded successfully!');
      setShowCreditPaymentModal(false);
      setCreditPaymentAmount("");
      setCreditPaymentNotes("");
      handleCloseModal();
      if (refetchAccounts) {
        refetchAccounts();
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      
      // Handle specific error cases
      if (error?.status === 403) {
        alert('Access Denied: You do not have permission to record credit payments. Please contact your administrator.');
      } else if (error?.status === 404) {
        alert('Credit account not found. Please refresh and try again.');
      } else if (error?.status === 400) {
        alert('Invalid payment data. Please check the amount and try again.');
      } else if (error?.data?.message) {
        alert(`Payment failed: ${error.data.message}`);
      } else {
        alert('Failed to record payment. Please try again.');
      }
    }
  };

  const handleMakePayment = () => {
    if (!selectedCredit) return;
    setPaymentAmount(selectedCredit.amount.replace('$', ''));
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async () => {
    if (!selectedCredit || !paymentAmount) return;
    
    // Check user role before attempting payment
    const userRole = user?.role?.toLowerCase();
    const allowedRoles = ['super_admin', 'company_admin', 'manager', 'shop_employee', 'user'];
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      alert(`Access Denied: Your role (${userRole || 'Unknown'}) does not have permission to record purchase payments. Required roles: ${allowedRoles.join(', ')}. Please contact your administrator.`);
      return;
    }
    
    try {
      await createPurchasePayment({
        purchaseOrderId: selectedCredit.id,
        data: {
          amount: parseFloat(paymentAmount),
          paymentMethod: paymentMethod,
          notes: `Payment for ${selectedCredit.items}`,
        },
      }).unwrap();
      
      alert('Payment recorded successfully!');
      setShowPaymentModal(false);
      setPaymentAmount("");
      handleCloseModal();
      if (refetchPurchases) {
        refetchPurchases();
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      
      // Handle specific error cases
      if (error?.status === 403) {
        alert('Access Denied: You do not have permission to record purchase payments. Please contact your administrator.');
      } else if (error?.status === 404) {
        alert('Purchase order not found. Please refresh and try again.');
      } else if (error?.status === 400) {
        alert('Invalid payment data. Please check the amount and try again.');
      } else if (error?.data?.message) {
        alert(`Payment failed: ${error.data.message}`);
      } else {
        alert('Failed to record payment. Please try again.');
      }
    }
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
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Credit</Text>
            <Text style={styles.roleIndicator}>
              {user?.role ? `(${user.role})` : '(No Role)'}
            </Text>
          </View>
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
          <TouchableOpacity
            style={styles.viewToggleButton}
            onPress={() => setViewMode(viewMode === "transaction" ? "person" : "transaction")}
          >
            <Text style={styles.viewToggleText}>
              {viewMode === "transaction" ? "By Person" : "By Transaction"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>
          {activeTab === "Receivables" ? "Credit Summary" : "Payables Summary"}
        </Text>
        <View style={styles.summaryContent}>
          {activeTab === "Receivables" ? (
            <>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Outstanding</Text>
            <Text style={styles.summaryValue}>
              ${(parseFloat(reports.totalRemainingBalance) || 0).toFixed(2)}
            </Text>
            <Text style={styles.summarySubLabel}>
              {reports.totalCredits || 0} credits
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Paid</Text>
            <Text style={styles.summaryValue}>
              ${(parseFloat(reports.totalPaidAmount) || 0).toFixed(2)}
            </Text>
            <Text style={styles.summarySubLabel}>
              {(parseFloat(reports.averagePaymentPercentage) || 0).toFixed(1)}% paid
            </Text>
          </View>
            </>
          ) : (
            <>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Unpaid</Text>
                <Text style={styles.summaryValue}>
                  ${payablesData.reduce((sum: number, payable: any) => sum + (parseFloat(payable.amount.replace('$', '')) || 0), 0).toFixed(2)}
                </Text>
                <Text style={styles.summarySubLabel}>
                  {payablesData.length} unpaid orders
                </Text>
        </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Orders</Text>
                <Text style={styles.summaryValue}>
                  ${(parseFloat(purchaseStats.totalAmount) || 0).toFixed(2)}
                </Text>
                <Text style={styles.summarySubLabel}>
                  {purchaseStats.totalOrders || 0} orders
                </Text>
              </View>
            </>
          )}
        </View>
        {activeTab === "Receivables" && reports.overdueCredits > 0 && (
          <View style={styles.overdueWarning}>
            <Feather name="alert-circle" size={16} color="#F44336" />
            <Text style={styles.overdueText}>
              {reports.overdueCredits} overdue ({(parseFloat(reports.totalOverdueAmount) || 0).toFixed(2)} $)
            </Text>
          </View>
        )}
        {activeTab === "Payables" && payablesData.length > 0 && (
          <View style={styles.overdueWarning}>
            <Feather name="alert-circle" size={16} color="#F44336" />
            <Text style={styles.overdueText}>
              {payablesData.length} unpaid purchase orders
            </Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "Receivables" && styles.activeTab]}
          onPress={() => setActiveTab("Receivables")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "Receivables" && styles.activeTabText,
            ]}
          >
            Receivables
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "Payables" && styles.activeTab]}
          onPress={() => setActiveTab("Payables")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "Payables" && styles.activeTabText,
            ]}
          >
            Payables
          </Text>
        </TouchableOpacity>
      </View>

      {/* Credit List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.creditList}>
          {activeTab === "Receivables" ? (
            isLoadingAccounts ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY} />
              <Text style={styles.loadingText}>Loading credit accounts...</Text>
            </View>
          ) : accountsError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Error loading credit accounts</Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => refetchAccounts && refetchAccounts()}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
            ) : displayData.length === 0 ? (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {viewMode === "person" ? "No customer credits found" : "No credit accounts found"}
                </Text>
            </View>
          ) : (
              displayData.map((item: any, index: number) => (
              <CreditItem
                key={item.id || index}
                name={item.name}
                items={item.items}
                date={item.date}
                amount={item.amount}
                status={item.status}
                statusColor={item.statusColor}
                onPress={() => handleCreditItemPress(item)}
              />
            ))
            )
          ) : (
            isLoadingPurchases ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.PRIMARY} />
                <Text style={styles.loadingText}>Loading purchase orders...</Text>
              </View>
            ) : purchaseError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Error loading purchase orders</Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => refetchPurchases && refetchPurchases()}
              >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : displayData.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No unpaid purchase orders found</Text>
              </View>
            ) : (
              displayData.map((item: any, index: number) => (
                <CreditItem
                  key={item.id || index}
                  name={item.name}
                  items={item.items}
                  date={item.date}
                  amount={item.amount}
                  status={item.status}
                  statusColor={item.statusColor}
                  onPress={() => handleCreditItemPress(item)}
                />
              ))
            )
          )}
        </View>
      </ScrollView>

      {/* Credit Details Modal */}
      <Modal
        visible={showDetailsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {activeTab === "Receivables" ? "Credit Details" : "Payable Details"}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleCloseModal}
              >
                <Feather name="x" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={false}
            >
              {activeTab === "Receivables" ? (
                <>
              {/* Credit Information */}
              <View style={styles.section}>
                <Text style={styles.productName}>
                  {selectedCredit?.product?.name || "N/A"}
                </Text>
                <Text style={styles.productCode}>
                      {selectedCredit?.product?.code || "N/A"}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Status</Text>
                  <Text style={[styles.priceValue, { color: selectedCredit?.statusColor }]}>
                    {selectedCredit?.status || "N/A"}
                  </Text>
                </View>
              </View>

              {/* Payment Details */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Payment Information</Text>
                <DetailRow
                  label="Principal Amount"
                      value={`$${(parseFloat(selectedCredit?.transaction?.sellingPrice?.toString() || '0') || 0).toFixed(2)}`}
                />
                <DetailRow
                  label="Total Amount"
                      value={`$${(parseFloat(selectedCredit?.transaction?.total?.toString() || '0') || 0).toFixed(2)}`}
                  valueStyle={{ fontWeight: "600" }}
                />
                <DetailRow
                  label="Amount Due"
                  value={selectedCredit?.amount || "$0.00"}
                  valueStyle={{ fontWeight: "600", color: "#F44336" }}
                />
                <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>{selectedCredit?.product?.store || "Payment Terms"}</Text>
                </View>
              </View>

              {/* Customer Details */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Customer details</Text>
                <DetailRow
                  label="Customer name"
                      value={selectedCredit?.customer?.name || "N/A"}
                />
                <DetailRow
                  label="Customer phone"
                      value={selectedCredit?.customer?.phone || "N/A"}
                />
              </View>

              {/* More Details */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>More details</Text>
                <DetailRow
                  label="Date of sales"
                      value={selectedCredit?.moreDetails?.dateOfSales || "N/A"}
                />
                <DetailRow
                  label="Payment type"
                      value={selectedCredit?.moreDetails?.paymentType || "N/A"}
                />
                <DetailRow
                  label="Sold By"
                      value={selectedCredit?.moreDetails?.soldBy || "N/A"}
                />
                <DetailRow
                  label="Sold At"
                      value={selectedCredit?.moreDetails?.soldAt || "N/A"}
                />
              </View>

                  {/* Payment History */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment History</Text>
                    {isLoadingPayments ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color={COLORS.PRIMARY} />
                        <Text style={styles.loadingText}>Loading payment history...</Text>
                      </View>
                    ) : creditPaymentsError ? (
                      <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>Unable to load payment history</Text>
                        <Text style={styles.errorSubText}>
                          Payment history may not be available for this credit account.
                        </Text>
                      </View>
                    ) : creditPaymentsData?.data?.data && creditPaymentsData.data.data.length > 0 ? (
                      creditPaymentsData.data.data.map((payment: any, index: number) => (
                        <View key={index} style={styles.paymentHistoryItem as any}>
                          <View style={styles.paymentHistoryRow as any}>
                            <Text style={styles.paymentHistoryDate as any}>
                              {new Date(payment.createdAt).toLocaleDateString()}
                            </Text>
                            <Text style={styles.paymentHistoryAmount as any}>
                              ${(parseFloat(payment.amount) || 0).toFixed(2)}
                            </Text>
                          </View>
                          <Text style={styles.paymentHistoryMethod as any}>
                            {payment.paymentMethod?.toUpperCase() || 'N/A'}
                          </Text>
                          {payment.notes && (
                            <Text style={styles.paymentHistoryNotes as any}>
                              {payment.notes}
                            </Text>
                          )}
                        </View>
                      ))
                    ) : (
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No payment history available</Text>
                      </View>
                    )}
                  </View>
                </>
              ) : (
                <>
                  {/* Purchase Order Information */}
                  <View style={styles.section}>
                    <Text style={styles.productName}>
                      {selectedCredit?.items || "Purchase Order"}
                    </Text>
                    <Text style={styles.productCode}>
                      {selectedCredit?.items || "N/A"}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Status</Text>
                      <Text style={[styles.priceValue, { color: selectedCredit?.statusColor }]}>
                        {selectedCredit?.status || "N/A"}
                      </Text>
                    </View>
                  </View>

                  {/* Payment Details */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Information</Text>
                    <DetailRow
                      label="Total Amount"
                      value={selectedCredit?.amount || "$0.00"}
                      valueStyle={{ fontWeight: "600" }}
                    />
                    <DetailRow
                      label="Payment Status"
                      value={selectedCredit?.paymentStatus?.toUpperCase() || "UNPAID"}
                      valueStyle={{ fontWeight: "600", color: selectedCredit?.statusColor }}
                    />
                    <DetailRow
                      label="Order Date"
                      value={selectedCredit?.orderDate ? new Date(selectedCredit.orderDate).toLocaleDateString() : "N/A"}
                    />
                    {selectedCredit?.expectedDeliveryDate && (
                      <DetailRow
                        label="Expected Delivery"
                        value={new Date(selectedCredit.expectedDeliveryDate).toLocaleDateString()}
                      />
                    )}
                  </View>

                  {/* Supplier Details */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Supplier details</Text>
                    <DetailRow
                      label="Supplier name"
                      value={selectedCredit?.supplier?.name || "N/A"}
                    />
                    <DetailRow
                      label="Supplier phone"
                      value={selectedCredit?.supplier?.phoneNumber || "N/A"}
                    />
                  </View>

                  {/* Items Details */}
                  {selectedCredit?.purchaseItems && selectedCredit.purchaseItems.length > 0 && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>
                        Items ({selectedCredit.purchaseItems.length})
                      </Text>
                      {selectedCredit.purchaseItems.map((item: any, index: number) => (
                        <View key={index} style={styles.itemRow as any}>
                          <View style={styles.itemLeft as any}>
                            <Text style={styles.itemName as any}>
                              {item.product?.name || 'Product'}
                            </Text>
                            <Text style={styles.itemQty as any}>Qty: {item.quantity}</Text>
                          </View>
                          <Text style={styles.itemPrice as any}>
                            ${(parseFloat(item.totalCost) || 0).toFixed(2)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {activeTab === "Receivables" ? (
                <>
              <TouchableOpacity
                style={[
                  styles.returnButton,
                  (!user?.role || !['super_admin', 'company_admin', 'manager', 'shop_employee', 'user'].includes(user.role.toLowerCase()) || 
                   selectedCredit?.status === 'fully_paid' || selectedCredit?.status === 'Fully Paid') && (styles as any).disabledButton
                ]}
                onPress={handleMakeCreditPayment}
                disabled={!user?.role || !['super_admin', 'company_admin', 'manager', 'shop_employee', 'user'].includes(user.role.toLowerCase()) ||
                         selectedCredit?.status === 'fully_paid' || selectedCredit?.status === 'Fully Paid'}
              >
                <Text style={[
                  styles.returnButtonText,
                  (!user?.role || !['super_admin', 'company_admin', 'manager', 'shop_employee', 'user'].includes(user.role.toLowerCase()) ||
                   selectedCredit?.status === 'fully_paid' || selectedCredit?.status === 'Fully Paid') && (styles as any).disabledButtonText
                ]}>
                      Pay Credit
                </Text>
              </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.printButton}
                    onPress={handlePrintInvoice}
                  >
                    <Feather
                      name="printer"
                      size={20}
                      color="white"
                      style={styles.buttonIcon}
                    />
                    <Text style={styles.printButtonText}>Print Purchase Order</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.returnButton,
                      (!user?.role || !['super_admin', 'company_admin', 'manager', 'shop_employee', 'user'].includes(user.role.toLowerCase())) && (styles as any).disabledButton
                    ]}
                    onPress={handleMakePayment}
                    disabled={!user?.role || !['super_admin', 'company_admin', 'manager', 'shop_employee', 'user'].includes(user.role.toLowerCase())}
                  >
                    <Text style={[
                      styles.returnButtonText,
                      (!user?.role || !['super_admin', 'company_admin', 'manager', 'shop_employee', 'user'].includes(user.role.toLowerCase())) && (styles as any).disabledButtonText
                    ]}>
                      Make Payment
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Make Payment</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Feather name="x" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={styles.paymentForm as any}>
              <View style={styles.inputGroup as any}>
                <Text style={styles.inputLabel as any}>Amount</Text>
                <TextInput
                  style={styles.inputField as any}
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  placeholder="Enter payment amount"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup as any}>
                <Text style={styles.inputLabel as any}>Payment Method</Text>
                <View style={styles.radioGroup as any}>
                  <TouchableOpacity
                    style={styles.radioOption as any}
                    onPress={() => setPaymentMethod("cash")}
                  >
                    <View style={styles.paymentRadioButton as any}>
                      <View style={[
                        styles.paymentRadioOuter as any,
                        paymentMethod === "cash" && styles.paymentRadioOuterSelected as any
                      ]}>
                        {paymentMethod === "cash" && <View style={styles.paymentRadioInner as any} />}
                      </View>
                    </View>
                    <Text style={styles.radioLabel as any}>Cash</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.radioOption as any}
                    onPress={() => setPaymentMethod("bank_transfer")}
                  >
                    <View style={styles.paymentRadioButton as any}>
                      <View style={[
                        styles.paymentRadioOuter as any,
                        paymentMethod === "bank_transfer" && styles.paymentRadioOuterSelected as any
                      ]}>
                        {paymentMethod === "bank_transfer" && <View style={styles.paymentRadioInner as any} />}
                      </View>
                    </View>
                    <Text style={styles.radioLabel as any}>Bank Transfer</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.radioOption as any}
                    onPress={() => setPaymentMethod("check")}
                  >
                    <View style={styles.paymentRadioButton as any}>
                      <View style={[
                        styles.paymentRadioOuter as any,
                        paymentMethod === "check" && styles.paymentRadioOuterSelected as any
                      ]}>
                        {paymentMethod === "check" && <View style={styles.paymentRadioInner as any} />}
                      </View>
                    </View>
                    <Text style={styles.radioLabel as any}>Check</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.actionButtons as any}>
              <TouchableOpacity
                style={styles.cancelButton as any}
                onPress={() => setShowPaymentModal(false)}
              >
                <Text style={styles.cancelButtonText as any}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitButton as any}
                onPress={handlePaymentSubmit}
                disabled={isCreatingPurchasePayment || !paymentAmount}
              >
                <Text style={styles.submitButtonText as any}>
                  {isCreatingPurchasePayment ? 'Processing...' : 'Submit Payment'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Credit Payment Modal */}
      <Modal
        visible={showCreditPaymentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCreditPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Make Credit Payment</Text>
              <TouchableOpacity onPress={() => setShowCreditPaymentModal(false)}>
                <Feather name="x" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={styles.paymentForm as any}>
              <View style={styles.inputGroup as any}>
                <Text style={styles.inputLabel as any}>Amount</Text>
                <TextInput
                  style={styles.inputField as any}
                  value={creditPaymentAmount}
                  onChangeText={setCreditPaymentAmount}
                  placeholder="Enter payment amount"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup as any}>
                <Text style={styles.inputLabel as any}>Payment Method</Text>
                <View style={styles.radioGroup as any}>
                  <TouchableOpacity
                    style={styles.radioOption as any}
                    onPress={() => setCreditPaymentMethod("cash")}
                  >
                    <View style={styles.paymentRadioButton as any}>
                      <View style={[
                        styles.paymentRadioOuter as any,
                        creditPaymentMethod === "cash" && styles.paymentRadioOuterSelected as any
                      ]}>
                        {creditPaymentMethod === "cash" && <View style={styles.paymentRadioInner as any} />}
                      </View>
                    </View>
                    <Text style={styles.radioLabel as any}>Cash</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.radioOption as any}
                    onPress={() => setCreditPaymentMethod("bank_transfer")}
                  >
                    <View style={styles.paymentRadioButton as any}>
                      <View style={[
                        styles.paymentRadioOuter as any,
                        creditPaymentMethod === "bank_transfer" && styles.paymentRadioOuterSelected as any
                      ]}>
                        {creditPaymentMethod === "bank_transfer" && <View style={styles.paymentRadioInner as any} />}
                      </View>
                    </View>
                    <Text style={styles.radioLabel as any}>Bank Transfer</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.radioOption as any}
                    onPress={() => setCreditPaymentMethod("check")}
                  >
                    <View style={styles.paymentRadioButton as any}>
                      <View style={[
                        styles.paymentRadioOuter as any,
                        creditPaymentMethod === "check" && styles.paymentRadioOuterSelected as any
                      ]}>
                        {creditPaymentMethod === "check" && <View style={styles.paymentRadioInner as any} />}
                      </View>
                    </View>
                    <Text style={styles.radioLabel as any}>Check</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup as any}>
                <Text style={styles.inputLabel as any}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.inputField as any, { height: 80, textAlignVertical: 'top' }]}
                  value={creditPaymentNotes}
                  onChangeText={setCreditPaymentNotes}
                  placeholder="Enter payment notes..."
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>

            <View style={styles.actionButtons as any}>
             

              <TouchableOpacity
                style={styles.submitButton }
                onPress={handleCreditPaymentSubmit as any}
                disabled={isCreatingPayment || !creditPaymentAmount}
              >
                <Text style={styles.submitButtonText as any}>
                  {/* {!isCreatingPayment ? 'Submit Payment' : 'Processing...'} */}
                  Submit Payment
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
    backgroundColor: "#F9FAFB",
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
  headerTitleContainer: {
    flexDirection: "column",
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  roleIndicator: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
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
  viewToggleButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  viewToggleText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  summaryCard: {
    backgroundColor: COLORS.PRIMARY,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  summaryTitle: {
    fontSize: 16,
    color: "rgba(255,255,255,1)",
    marginBottom: 16,
    fontWeight: "600",
  },
  summaryContent: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "600",
    color: "white",
  },
  summarySubLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  overdueWarning: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },
  overdueText: {
    fontSize: 13,
    color: "#FFE5E5",
    marginLeft: 8,
    fontWeight: "500",
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
  creditList: {
    paddingHorizontal: 16,
  },
  creditItem: {
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
  creditLeft: {
    flex: 1,
  },
  creditName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
    marginBottom: 2,
  },
  creditItems: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  creditDate: {
    fontSize: 12,
    color: "#666",
  },
  creditRight: {
    alignItems: "flex-end",
  },
  creditAmount: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  creditStatus: {
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
  taxRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  radioButton: {
    marginRight: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "transparent",
  },
  taxLabel: {
    fontSize: 14,
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
  disabledButton: {
    backgroundColor: "#CCCCCC",
    opacity: 0.6,
  },
  disabledButtonText: {
    color: "#999999",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
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
    paddingHorizontal: 20,
    paddingVertical: 10,
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
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  itemLeft: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
    marginBottom: 2,
  },
  itemQty: {
    fontSize: 12,
    color: "#666",
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  paymentForm: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  inputField: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#000",
    backgroundColor: "#F8F9FA",
  },
  radioGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 120,
  },
  paymentRadioButton: {
    marginRight: 8,
  },
  paymentRadioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  paymentRadioOuterSelected: {
    borderColor: COLORS.PRIMARY,
  },
  paymentRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.PRIMARY,
  },
  radioLabel: {
    fontSize: 14,
    color: "#000",
  },
  cancelButton: {
    backgroundColor: "#F0F0F0",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  submitButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    flex: 1,
    marginLeft: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  paymentHistoryItem: {
    backgroundColor: "#F8F9FA",
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.PRIMARY,
  },
  paymentHistoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  paymentHistoryDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  paymentHistoryAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.PRIMARY,
  },
  paymentHistoryMethod: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  paymentHistoryNotes: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },
  errorSubText: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
    textAlign: "center",
  },
  downloadReceiptButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
  },
  downloadReceiptText: {
    fontSize: 12,
    color: COLORS.PRIMARY,
    marginLeft: 6,
    fontWeight: "600",
  },
});

export default CreditScreen;
