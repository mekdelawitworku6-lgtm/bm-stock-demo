import { COLORS } from '@/constants/Colors';
import { useGetExpensesQuery } from '@/lib/Api/expenseApi';
import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

interface Expense {
  id: string;
  expenseNumber: string;
  title: string;
  description?: string;
  type: string;
  category: string;
  status: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  expenseDate: string;
  paymentMethod: string;
  vendor?: string;
  receiptNumber?: string;
  isReimbursable: boolean;
  isTaxDeductible: boolean;
  branch?: {
    id: string;
    name: string;
  };
  submittedBy?: {
    id: string;
    name: string;
  };
}

interface ExpenseListProps {
  navigation: any;
  searchText?: string;
  activeTab?: string;
}

const ExpenseItem: React.FC<{ expense: Expense; onPress: () => void }> = ({ expense, onPress }) => {
  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      draft: '#999',
      pending: '#FF9800',
      approved: '#4CAF50',
      rejected: '#F44336',
      paid: '#2196F3',
      cancelled: '#F44336',
    };
    return statusMap[status.toLowerCase()] || '#999';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <TouchableOpacity style={styles.expenseItem} onPress={onPress}>
      <View style={styles.expenseHeader}>
        <View style={styles.expenseTitleContainer}>
          <Text style={styles.expenseTitle} numberOfLines={1}>
            {expense.title}
          </Text>
          <Text style={styles.expenseNumber}>#{expense.expenseNumber}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(expense.status) }]}>
          <Text style={styles.statusText}>{expense.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.expenseDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Amount:</Text>
          <Text style={styles.detailValue}>{formatAmount(expense.totalAmount)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Type:</Text>
          <Text style={styles.detailValue}>{expense.type}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Category:</Text>
          <Text style={styles.detailValue}>{expense.category}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Date:</Text>
          <Text style={styles.detailValue}>{formatDate(expense.expenseDate)}</Text>
        </View>
        {expense.vendor && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vendor:</Text>
            <Text style={styles.detailValue}>{expense.vendor}</Text>
          </View>
        )}
        {expense.branch && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Branch:</Text>
            <Text style={styles.detailValue}>{expense.branch.name}</Text>
          </View>
        )}
      </View>

      <View style={styles.expenseFooter}>
        <View style={styles.paymentMethodContainer}>
          <Feather name="credit-card" size={14} color="#666" />
          <Text style={styles.paymentMethodText}>{expense.paymentMethod}</Text>
        </View>
        <View style={styles.badgesContainer}>
          {expense.isReimbursable && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Reimbursable</Text>
            </View>
          )}
          {expense.isTaxDeductible && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Tax Deductible</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const ExpenseList: React.FC<ExpenseListProps> = ({ navigation, searchText = '', activeTab = 'All' }) => {
  const [refreshing, setRefreshing] = useState(false);

  const { data: expensesData, isLoading, error, refetch } = useGetExpensesQuery({
    page: 1,
    limit: 50,
    search: searchText,
    status: activeTab !== 'All' ? activeTab.toLowerCase() : undefined,
  });

  const expenses = Array.isArray(expensesData?.data?.data) 
    ? expensesData.data.data 
    : [];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handleExpensePress = (expense: Expense) => {
    // Navigate to expense details or edit screen
    navigation.navigate('ExpenseDetails', { expenseId: expense.id });
  };

  const filteredExpenses = expenses.filter((expense: Expense) =>
    searchText
      ? expense.title.toLowerCase().includes(searchText.toLowerCase()) ||
        expense.expenseNumber.toLowerCase().includes(searchText.toLowerCase()) ||
        expense.vendor?.toLowerCase().includes(searchText.toLowerCase())
      : true
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>Loading expenses...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Feather name="alert-circle" size={48} color="#F44336" />
        <Text style={styles.errorText}>Error loading expenses</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (filteredExpenses.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Feather name="receipt" size={48} color="#ccc" />
        <Text style={styles.emptyText}>No expenses found</Text>
        <Text style={styles.emptySubtext}>
          {searchText ? 'Try adjusting your search terms' : 'Expenses will appear here once you add some'}
        </Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('AddExpense')}
        >
          <Text style={styles.createButtonText}>Add Expense</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[COLORS.PRIMARY]}
          tintColor={COLORS.PRIMARY}
        />
      }
    >
      <View style={styles.expenseList}>
        {filteredExpenses.map((expense: Expense, index: number) => (
          <React.Fragment key={expense.id}>
            <ExpenseItem
              expense={expense}
              onPress={() => handleExpensePress(expense)}
            />
            {index < filteredExpenses.length - 1 && (
              <View style={styles.horizontalDivider} />
            )}
          </React.Fragment>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  expenseList: {
    padding: 16,
  },
  expenseItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  expenseTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  expenseNumber: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  expenseDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 12,
    color: '#1f2937',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  expenseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentMethodText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    color: '#374151',
    fontWeight: '500',
  },
  horizontalDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ExpenseList;
