import { useGetProductsQuery } from "@/lib/Api/productApi";
import {
    useApprovePurchaseOrderMutation,
    useCreatePurchaseOrderMutation,
    useGetPurchaseDashboardStatsQuery,
    useGetPurchaseOrdersQuery
} from "@/lib/Api/purchaseApi";
import { useGetShopsQuery } from "@/lib/Api/shopApi";
import { useGetSuppliersQuery } from "@/lib/Api/supplierApi";
import { useGetWarehousesQuery } from "@/lib/Api/warehouseApi";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
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

interface PurchaseScreenProps {
  navigation: any;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: {
    id: string;
    name: string;
    phoneNumber?: string;
  };
  totalAmount: number;
  status: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  items: any[];
  paymentStatus: string;
  approvalStatus: string;
  warehouse: any;
}

interface PurchaseItem {
  id: string;
  productId: string;
  product?: {
    id: string;
    name: string;
    cost: string;
  };
  quantity: number;
  unitCost: number;
  totalCost: number;
  notes?: string;
}

interface Supplier {
  id: string;
  name: string;
  contact?: string;
  email?: string;
}

interface Warehouse {
  id: string;
  name: string;
  location?: string;
}

interface Shop {
  id: string;
  name: string;
  location?: string;
}

interface Location {
  id: string;
  name: string;
  type: 'warehouse' | 'shop';
  location?: string;
}

interface Product {
  id: string;
  name: string;
  cost: string;
  sku?: string;
}

const PurchaseScreen: React.FC<PurchaseScreenProps> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState("All");
  const [searchText, setSearchText] = useState("");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseOrder | null>(null);

  // Purchase form state
  const [supplierId, setSupplierId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [locationType, setLocationType] = useState<'warehouse' | 'shop'>('warehouse');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [paymentTermsDays, setPaymentTermsDays] = useState("30");
  const [isUrgent, setIsUrgent] = useState(false);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [supplierSearchText, setSupplierSearchText] = useState("");

  // API hooks
  const { data: purchaseData, isLoading, error, refetch } = useGetPurchaseOrdersQuery({
    page: 1,
    limit: 50,
    status: activeTab !== "All" ? activeTab.toLowerCase() : undefined,
  });

  const { data: statsData, isLoading: isLoadingStats } = useGetPurchaseDashboardStatsQuery({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const [approvePurchaseOrder, { isLoading: isApproving }] = useApprovePurchaseOrderMutation();
  const [createPurchaseOrder, { isLoading: isCreating }] = useCreatePurchaseOrderMutation();

  // Form data API hooks
  const { data: suppliersData, isLoading: suppliersLoading, error: suppliersError } = useGetSuppliersQuery({ page: 1, limit: 100 });
  const { data: warehousesData, isLoading: warehousesLoading, error: warehousesError } = useGetWarehousesQuery({ page: 1, limit: 100 });
  const { data: shopsData, isLoading: shopsLoading, error: shopsError } = useGetShopsQuery({ page: 1, limit: 100 });
  const { data: productsData, isLoading: productsLoading, error: productsError } = useGetProductsQuery({ page: 1, limit: 100 });


  // Process API data
  const purchaseOrders = Array.isArray(purchaseData?.data?.data) 
    ? purchaseData.data.data 
    : [];
  const stats = statsData?.data || {};

  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      draft: '#999',
      pending: '#FF9800',
      approved: '#4CAF50',
      rejected: '#F44336',
      ordered: '#2196F3',
      partially_received: '#FFCA28',
      fully_received: '#4CAF50',
      closed: '#666',
      cancelled: '#F44336',
    };
    return statusMap[status.toLowerCase()] || '#999';
  };

  const handlePurchasePress = (purchase: PurchaseOrder) => {
    setSelectedPurchase(purchase);
    setShowDetailsModal(true);
  };

  const handleApprove = async () => {
    if (!selectedPurchase) return;

    try {
      await approvePurchaseOrder({
        id: selectedPurchase.id,
        approvalNotes: 'Approved from mobile app',
      }).unwrap();

      Alert.alert('Success', 'Purchase order approved successfully');
      setShowDetailsModal(false);
      refetch();
    } catch (error) {
      console.error('Approval error:', error);
      Alert.alert('Error', 'Failed to approve purchase order');
    }
  };

  // Form helper functions
  const suppliers = Array.isArray(suppliersData?.data?.data) ? suppliersData.data.data : [];
  const warehouses = Array.isArray(warehousesData?.data) ? warehousesData.data : [];
  const shops = Array.isArray(shopsData?.data) ? shopsData.data : [];
  const products = Array.isArray(productsData?.data) ? productsData.data : [];
  
  // Combine warehouses and shops into locations
  const locations: Location[] = [
    ...warehouses.map(w => ({ ...w, type: 'warehouse' as const })),
    ...shops.map(s => ({ ...s, type: 'shop' as const }))
  ];

  const addItem = () => {
    const newItem: PurchaseItem = {
      id: Date.now().toString(),
      productId: "", // Will be set when user selects a product
      product: undefined,
      quantity: 1,
      unitCost: 0,
      totalCost: 0,
      notes: "",
    };
    setItems(prev => [...prev, newItem]);
  };

  const removeItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  const updateItem = (itemId: string, field: keyof PurchaseItem, value: any) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitCost') {
          updatedItem.totalCost = updatedItem.quantity * updatedItem.unitCost;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const calculateTotal = () => {
    return items.reduce((total, item) => total + item.totalCost, 0);
  };

  const resetForm = () => {
    setSupplierId("");
    setLocationId("");
    setLocationType('warehouse');
    setExpectedDeliveryDate("");
    setPaymentTermsDays("30");
    setIsUrgent(false);
    setNotes("");
    setItems([]);
    setSupplierSearchText("");
  };

  const handleCreatePurchase = async () => {
    // Check if there are any items with valid productId
    const validItems = items.filter(item => item.productId && item.productId.trim() !== '');
    
    if (!supplierId || !locationId || validItems.length === 0) {
      Alert.alert('Missing information', [
        !supplierId ? '• Select a supplier' : null,
        !locationId ? '• Select a location' : null,
        validItems.length === 0 ? '• Add at least one item and choose a product' : null,
      ].filter(Boolean).join('\n') || 'Please fill in all required fields');
      return;
    }

    try {
      const purchaseData = {
        purchaseType: "stock_purchase", // Default to stock_purchase
        supplierId,
        warehouseId: locationType === 'warehouse' ? locationId : undefined,
        shopId: locationType === 'shop' ? locationId : undefined,
        orderDate: new Date().toISOString().split('T')[0], // Use current date
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        paymentTermsDays: parseInt(paymentTermsDays),
        isUrgent,
        notes: notes || undefined,
        items: items
          .filter(item => item.productId && item.productId.trim() !== '') // Only include items with valid productId
          .map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            notes: item.notes || undefined,
          })),
      };

      await createPurchaseOrder(purchaseData).unwrap();
      
      Alert.alert('Success', 'Purchase order created successfully');
      setShowCreateModal(false);
      resetForm();
      refetch();
    } catch (error) {
      console.error('Create purchase error:', error);
      Alert.alert('Error', 'Failed to create purchase order');
    }
  };

  const PurchaseItem = ({ purchase }: { purchase: PurchaseOrder }) => (
    <TouchableOpacity 
      style={styles.purchaseItem} 
      onPress={() => handlePurchasePress(purchase)}
    >
      <View style={styles.purchaseLeft}>
        <Text style={styles.purchasePO}>{purchase.poNumber}</Text>
        <Text style={styles.purchaseSupplier}>
          {purchase.supplier?.name || 'No Supplier'}
        </Text>
        <Text style={styles.purchaseDate}>
          {new Date(purchase.orderDate).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.purchaseRight}>
        <Text style={styles.purchaseAmount}>
          ${(parseFloat(purchase.totalAmount) || 0).toFixed(2)}
        </Text>
        <Text style={[styles.purchaseStatus, { color: getStatusColor(purchase.status) }]}>
          {purchase.status.replace('_', ' ').toUpperCase()}
        </Text>
        <Text style={styles.purchaseItems}>
          {purchase.items?.length || 0} items
        </Text>
      </View>
    </TouchableOpacity>
  );

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
          <Text style={styles.headerTitle}>Purchase Orders</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Feather name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Feather name="search" size={16} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search purchase orders..."
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
      </View>

      {/* Stats Card */}
      {!isLoadingStats && (
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Purchase Summary</Text>
          <View style={styles.statsContent}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total Orders</Text>
              <Text style={styles.statValue}>{stats.totalOrders || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total Spent</Text>
              <Text style={styles.statValue}>
                ${(parseFloat(stats.totalAmount) || 0).toFixed(2)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Pending</Text>
              <Text style={styles.statValue}>{stats.pendingOrders || 0}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScrollView}
      >
        <View style={styles.tabsContainer}>
          {['All', 'Pending', 'Approved', 'Ordered', 'Received'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Purchase Orders List */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.purchaseList}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY} />
              <Text style={styles.loadingText}>Loading purchase orders...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Error loading purchase orders</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : purchaseOrders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="shopping-cart" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No purchase orders found</Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Text style={styles.createButtonText}>Create Purchase Order</Text>
              </TouchableOpacity>
            </View>
          ) : (
            purchaseOrders
              .filter((order: PurchaseOrder) =>
                searchText
                  ? order.poNumber.toLowerCase().includes(searchText.toLowerCase()) ||
                    order.supplier?.name.toLowerCase().includes(searchText.toLowerCase())
                  : true
              )
              .map((order: PurchaseOrder) => (
                <PurchaseItem key={order.id} purchase={order} />
              ))
          )}
        </View>
      </ScrollView>

      {/* Purchase Details Modal */}
      <Modal
        visible={showDetailsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Purchase Order Details</Text>
              <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                <Feather name="x" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              {selectedPurchase && (
                <>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailPO}>{selectedPurchase.poNumber}</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Status</Text>
                      <Text
                        style={[
                          styles.detailBadge,
                          { backgroundColor: getStatusColor(selectedPurchase.status) },
                        ]}
                      >
                        {selectedPurchase.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Supplier Information</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Name</Text>
                      <Text style={styles.detailValue}>
                        {selectedPurchase.supplier?.name || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Phone</Text>
                      <Text style={styles.detailValue}>
                        {selectedPurchase.supplier?.phoneNumber || 'N/A'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Order Information</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Order Date</Text>
                      <Text style={styles.detailValue}>
                        {new Date(selectedPurchase.orderDate).toLocaleDateString()}
                      </Text>
                    </View>
                    {selectedPurchase.expectedDeliveryDate && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Expected Delivery</Text>
                        <Text style={styles.detailValue}>
                          {new Date(selectedPurchase.expectedDeliveryDate).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Warehouse</Text>
                      <Text style={styles.detailValue}>
                        {selectedPurchase.warehouse?.name || 'N/A'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Payment Information</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Total Amount</Text>
                      <Text style={styles.detailValueBold}>
                        ${(parseFloat(selectedPurchase.totalAmount) || 0).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Payment Status</Text>
                      <Text style={styles.detailValue}>
                        {selectedPurchase.paymentStatus?.toUpperCase() || 'UNPAID'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Approval Status</Text>
                      <Text style={styles.detailValue}>
                        {selectedPurchase.approvalStatus?.toUpperCase() || 'PENDING'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>
                      Items ({selectedPurchase.items?.length || 0})
                    </Text>
                    {selectedPurchase.items?.map((item, index) => (
                      <View key={index} style={styles.itemRow}>
                        <View style={styles.itemLeft}>
                          <Text style={styles.itemName}>
                            {item.product?.name || 'Product'}
                          </Text>
                          <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                        </View>
                        <Text style={styles.itemPrice}>
                          ${(parseFloat(item.totalCost) || 0).toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              {selectedPurchase?.approvalStatus === 'pending' && (
                <TouchableOpacity
                  style={styles.approveButton}
                  onPress={handleApprove}
                  disabled={isApproving}
                >
                  <Text style={styles.approveButtonText}>
                    {isApproving ? 'Approving...' : 'Approve Order'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowDetailsModal(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Purchase Order Modal */}
      <Modal
        visible={showCreateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Purchase Order</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Feather name="x" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScrollView}>
              {/* Supplier Selection */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Supplier *</Text>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setShowSupplierModal(true)}
                >
                  <Text style={[styles.selectButtonText, !supplierId && styles.placeholderText]}>
                    {supplierId ? suppliers.find(s => s.id === supplierId)?.name : 'Select Supplier'}
                  </Text>
                  <Feather name="chevron-down" size={16} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Location Selection (Warehouse/Shop) */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Location *</Text>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setShowLocationModal(true)}
                  disabled={warehousesLoading || shopsLoading}
                >
                  <Text style={[styles.selectButtonText, !locationId && styles.placeholderText]}>
                    {warehousesLoading || shopsLoading 
                      ? 'Loading locations...' 
                      : locationId 
                        ? locations.find(l => l.id === locationId)?.name 
                        : 'Select Location'
                    }
                  </Text>
                  <Feather name="chevron-down" size={16} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Expected Delivery Date */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Expected Delivery Date</Text>
                <TextInput
                  style={styles.textInput}
                  value={expectedDeliveryDate}
                  onChangeText={setExpectedDeliveryDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              {/* Payment Terms */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Payment Terms (Days)</Text>
                <TextInput
                  style={styles.textInput}
                  value={paymentTermsDays}
                  onChangeText={setPaymentTermsDays}
                  keyboardType="numeric"
                  placeholder="30"
                />
              </View>

              {/* Urgent Order */}
              <View style={styles.formSection}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setIsUrgent(!isUrgent)}
                >
                  <View style={[styles.checkbox, isUrgent && styles.checkboxChecked]}>
                    {isUrgent && <Feather name="check" size={16} color="white" />}
                  </View>
                  <Text style={styles.checkboxLabel}>Urgent Order</Text>
                </TouchableOpacity>
              </View>

              {/* Notes */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Notes</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Additional notes..."
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Items Section */}
              <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.formLabel}>Items *</Text>
                  <TouchableOpacity style={styles.addItemButton} onPress={addItem}>
                    <Feather name="plus" size={16} color="white" />
                    <Text style={styles.addItemText}>Add Item</Text>
                  </TouchableOpacity>
                </View>

                {items.map((item, index) => (
                  <View key={item.id} style={styles.itemContainer}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemNumber}>Item {index + 1}</Text>
                      <TouchableOpacity onPress={() => removeItem(item.id)}>
                        <Feather name="trash-2" size={16} color="#F44336" />
                      </TouchableOpacity>
                    </View>

                    {/* Product Selection */}
                    <TouchableOpacity
                      style={styles.selectButton}
                      onPress={() => {
                        setSelectedItemId(item.id);
                        setShowProductModal(true);
                      }}
                    >
                      <Text style={[styles.selectButtonText, !item.productId && styles.placeholderText]}>
                        {item.productId ? products.find(p => p.id === item.productId)?.name : 'Select Product'}
                      </Text>
                      <Feather name="chevron-down" size={16} color="#666" />
                    </TouchableOpacity>

                    <View style={styles.itemRow}>
                      <View style={styles.itemField}>
                        <Text style={styles.itemLabel}>Quantity</Text>
                        <TextInput
                          style={styles.itemInput}
                          value={item.quantity.toString()}
                          onChangeText={(value) => updateItem(item.id, 'quantity', parseInt(value) || 0)}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.itemField}>
                        <Text style={styles.itemLabel}>Unit Cost</Text>
                        <TextInput
                          style={styles.itemInput}
                          value={item.unitCost.toString()}
                          onChangeText={(value) => updateItem(item.id, 'unitCost', parseFloat(value) || 0)}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    <View style={styles.itemTotal}>
                      <Text style={styles.itemTotalLabel}>Total: ${item.totalCost.toFixed(2)}</Text>
                    </View>
                  </View>
                ))}

                {items.length > 0 && (
                  <View style={styles.totalContainer}>
                    <Text style={styles.totalLabel}>Order Total: ${calculateTotal().toFixed(2)}</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreatePurchase}
                disabled={isCreating}
              >
                <Text style={styles.createButtonText}>
                  {isCreating ? 'Creating...' : 'Create Purchase Order'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.closeButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Supplier Selection Modal */}
      <Modal
        visible={showSupplierModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSupplierModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.selectionModal}>
            <View style={styles.selectionHeader}>
              <Text style={styles.selectionTitle}>Select Supplier</Text>
              <TouchableOpacity onPress={() => setShowSupplierModal(false)}>
                <Feather name="x" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Feather name="search" size={16} color="#999" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search suppliers..."
                  placeholderTextColor="#999"
                  value={supplierSearchText}
                  onChangeText={setSupplierSearchText}
                />
              </View>
            </View>
            
            <FlatList
              data={suppliers.filter(supplier => 
                supplier.name.toLowerCase().includes(supplierSearchText.toLowerCase())
              )}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.selectionItem}
                  onPress={() => {
                    setSupplierId(item.id);
                    setShowSupplierModal(false);
                    setSupplierSearchText("");
                  }}
                >
                  <Text style={styles.selectionItemText}>{item.name}</Text>
                  {item.contact && (
                    <Text style={styles.selectionItemSubtext}>{item.contact}</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Location Selection Modal (Warehouses & Shops) */}
      <Modal
        visible={showLocationModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLocationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.selectionModal}>
            <View style={styles.selectionHeader}>
              <Text style={styles.selectionTitle}>Select Location</Text>
              <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                <Feather name="x" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            {warehousesLoading || shopsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.PRIMARY} />
                <Text style={styles.loadingText}>Loading locations...</Text>
              </View>
            ) : (
              <FlatList
                data={locations}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.selectionItem}
                    onPress={() => {
                      setLocationId(item.id);
                      setLocationType(item.type);
                      setShowLocationModal(false);
                    }}
                  >
                    <View style={styles.selectionItemContent}>
                      <Text style={styles.selectionItemText}>{item.name}</Text>
                      <Text style={styles.selectionItemSubtext}>
                        {item.type === 'warehouse' ? '🏢 Warehouse' : '🏪 Shop'}
                        {item.location && ` • ${item.location}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Product Selection Modal */}
      <Modal
        visible={showProductModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowProductModal(false);
          setSelectedItemId(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.selectionModal}>
            <View style={styles.selectionHeader}>
              <Text style={styles.selectionTitle}>Select Product</Text>
              <TouchableOpacity onPress={() => {
                setShowProductModal(false);
                setSelectedItemId(null);
              }}>
                <Feather name="x" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            {products.length === 0 ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>
                  {productsLoading ? 'Loading products...' : 'No products available'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={products}
                keyExtractor={(item) => item.id}
                renderItem={({ item: product }) => (
                <TouchableOpacity
                  style={styles.selectionItem}
                  onPress={() => {
                    if (selectedItemId) {
                      setItems(prevItems => prevItems.map(purchaseItem => {
                        if (purchaseItem.id !== selectedItemId) return purchaseItem;
                        const unitCost = parseFloat(product.cost) || 0;
                        return {
                          ...purchaseItem,
                          productId: product.id,
                          product: {
                            id: product.id,
                            name: product.name,
                            cost: product.cost,
                          },
                          unitCost,
                          totalCost: unitCost * purchaseItem.quantity,
                        };
                      }));
                    }
                    setShowProductModal(false);
                    setSelectedItemId(null);
                  }}
                >
                  <Text style={styles.selectionItemText}>{product.name}</Text>
                  <Text style={styles.selectionItemSubtext}>Cost: ${product.cost}</Text>
                </TouchableOpacity>
              )}
            />
            )}
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
    justifyContent: "space-between",
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  addButton: {
    backgroundColor: COLORS.PRIMARY,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  statsCard: {
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
  statsTitle: {
    fontSize: 16,
    color: "rgba(255,255,255,1)",
    marginBottom: 16,
    fontWeight: "600",
  },
  statsContent: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
  tabsScrollView: {
    maxHeight: 50,
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
  },
  activeTab: {
    backgroundColor: COLORS.PRIMARY,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  activeTabText: {
    color: "white",
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  purchaseList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  purchaseItem: {
    backgroundColor: "white",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  purchaseLeft: {
    flex: 1,
  },
  purchasePO: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    marginBottom: 2,
  },
  purchaseSupplier: {
    fontSize: 13,
    color: "#666",
    marginBottom: 2,
  },
  purchaseDate: {
    fontSize: 12,
    color: "#999",
  },
  purchaseRight: {
    alignItems: "flex-end",
  },
  purchaseAmount: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  purchaseStatus: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  purchaseItems: {
    fontSize: 11,
    color: "#999",
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
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    marginTop: 16,
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
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
  },
  modalScrollView: {
    maxHeight: 500,
  },
  detailSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  detailPO: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: "#666",
  },
  detailValue: {
    fontSize: 14,
    color: "#000",
    fontWeight: "500",
  },
  detailValueBold: {
    fontSize: 16,
    color: "#000",
    fontWeight: "600",
  },
  detailBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    color: "white",
    fontSize: 12,
    fontWeight: "600",
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
  modalActions: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  approveButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  approveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  closeButton: {
    backgroundColor: "#F0F0F0",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  comingSoonContainer: {
    padding: 40,
    alignItems: "center",
  },
  comingSoonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
    textAlign: "center",
  },
  comingSoonSubtext: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  // Form styles
  formScrollView: {
    maxHeight: 600,
    paddingHorizontal: 20,
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  radioGroup: {
    flexDirection: "row",
    gap: 12,
  },
  radioOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#F8F9FA",
  },
  radioSelected: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  radioText: {
    fontSize: 14,
    color: "#666",
  },
  radioTextSelected: {
    color: "white",
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#F8F9FA",
  },
  selectButtonText: {
    fontSize: 16,
    color: "#000",
    flex: 1,
  },
  placeholderText: {
    color: "#999",
  },
  textInput: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#F8F9FA",
    fontSize: 16,
    color: "#000",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#F8F9FA",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  checkboxLabel: {
    fontSize: 16,
    color: "#000",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  addItemButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addItemText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  itemContainer: {
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  itemNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  itemRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  itemField: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  itemInput: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "white",
    fontSize: 14,
    color: "#000",
  },
  itemTotal: {
    alignItems: "flex-end",
  },
  itemTotalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  totalContainer: {
    backgroundColor: COLORS.PRIMARY,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
  // Selection modal styles
  selectionModal: {
    backgroundColor: "white",
    borderRadius: 16,
    width: "90%",
    maxHeight: "70%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  selectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  selectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  selectionItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  selectionItemText: {
    fontSize: 16,
    color: "#000",
    marginBottom: 4,
  },
  selectionItemContent: {
    flex: 1,
  },
  selectionItemSubtext: {
    fontSize: 14,
    color: "#666",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});

export default PurchaseScreen;

