"use client";

import { COLORS } from "@/constants/Colors";
import { useLoginMutation } from "@/lib/Api/authApi";
import { useCreateCustomerMutation, useGetCustomersQuery } from "@/lib/Api/customerApi";
import { useGetProductsQuery } from "@/lib/Api/productApi";
import { useCreateSalesMutation } from "@/lib/Api/salesApi";
import { useGetShopsQuery } from "@/lib/Api/shopApi";
import { useGetWarehousesQuery, useGetWarehouseWithProductsQuery } from "@/lib/Api/warehouseApi";
import { Feather } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import {
    Alert,
    FlatList,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSelector } from "react-redux";

interface Item {
  id: string;
  productId: string;
  product: string;
  quantity: number;
  price: number;
}

interface Customer {
  id: string;
  name: string;
  phoneNumber: string;
  address: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Product {
  id: string;
  name: string;
  price: string;
  barcode: string;
  category: string;
  cost: string;
  createdAt: string;
  description: string;
  expiryDate: string;
  imageUrl: string;
  isExpired: boolean;
  metadata: { brand: string; model: string };
  minStockLevel: number;
  profitMargin: number;
  sku: string;
  status: string;
  stockQuantity: number;
  taxRate: string;
  trackStock: boolean;
  type: string;
  unit: string;
  updatedAt: string;
}

interface Warehouse {
  id: string;
  name: string;
  description: string;
}

interface Shop {
  id: string;
  name: string;
  description: string;
}

interface LocationItem {
  id: string;
  name: string;
  description: string;
  type: 'warehouse' | 'shop';
}

const NewSalesScreen = ({ navigation }: { navigation: any }) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(null);
  const [items, setItems] = useState<Item[]>([
    {
      id: Date.now().toString(),
      productId: "",
      product: "",
      quantity: 0,
      price: 0,
    },
  ]);
  const [advancePayment, setAdvancePayment] = useState("");
  const [total, setTotal] = useState("ETB 0.00");
  const [showProductModal, setShowProductModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1);
  
  // New customer creation states
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phoneNumber: "",
    address: "",
  });

  const { data: customersData, isLoading: customersLoading, refetch: refetchCustomers } =
    useGetCustomersQuery({ search: phoneNumber });
  const { data: warehousesData, isLoading: warehouseLoading } =
    useGetWarehousesQuery({ page: 1, limit: 10, search: "" });
  const { data: shopsData, isLoading: shopsLoading } =
    useGetShopsQuery({ page: 1, limit: 10, search: "" });
  const { data: productsData, isLoading: productsLoading } =
    useGetProductsQuery({ page: 1, limit: 10, search: "" });
  
  // Warehouse products query - only fetch when a warehouse is selected
  const { data: warehouseProductsData, isLoading: warehouseProductsLoading } =
    useGetWarehouseWithProductsQuery(
      { id: selectedLocation?.id || "" },
      { skip: !selectedLocation || selectedLocation.type !== 'warehouse' }
    );

    console.log("warehouseProductsData", warehouseProductsData);
  
  const [createSales] = useCreateSalesMutation();
  const [createCustomer] = useCreateCustomerMutation();
  
  // Test login mutation
  const [testLogin, { isLoading: isTestLoggingIn }] = useLoginMutation();

  const customers: Customer[] = customersData || [];
  const warehouses: Warehouse[] = warehousesData?.data || [];
  const shops: Shop[] = shopsData?.data || [];
  
  // Debug logging
  console.log("=== New Sales API Debug ===");
  console.log("warehousesData:", warehousesData);
  console.log("shopsData:", shopsData);
  console.log("warehouses:", warehouses);
  console.log("shops:", shops);
  console.log("warehouseLoading:", warehouseLoading);
  console.log("shopsLoading:", shopsLoading);
  console.log("==========================");
  
  // Debug authentication state
  const authState = useSelector((state: any) => state.auth);
  console.log("=== Auth State Debug ===");
  console.log("isAuthenticated:", authState.isAuthenticated);
  console.log("token:", authState.token ? "Token present" : "No token");
  console.log("user:", authState.user);
  console.log("========================");
  
  // Use warehouse products when warehouse is selected, otherwise use all products
  // This ensures that when a warehouse location is selected, only products from that warehouse are available
  // When no location is selected, products array is empty to disable product selection
  // Filter out products with 0 stock
  const products: Product[] = selectedLocation?.type === 'warehouse' 
    ? ((warehouseProductsData as any)?.products || []).filter((product: Product) => product.stockQuantity > 0)
    : selectedLocation?.type === 'shop'
    ? (productsData || []).filter((product: Product) => product.stockQuantity > 0)
    : []; // Empty array when no location is selected

    console.log("products", products);

  // Combine warehouses and shops into a single list
  const locations: LocationItem[] = [
    ...warehouses.map(warehouse => ({
      id: warehouse.id,
      name: warehouse.name,
      description: warehouse.description,
      type: 'warehouse' as const
    })),
    ...shops.map(shop => ({
      id: shop.id,
      name: shop.name,
      description: shop.description,
      type: 'shop' as const
    }))
  ];

  // Calculate total and unpaid amount dynamically
  const calculateTotal = useMemo(() => {
    const total = items.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );
    return `ETB ${total.toFixed(2)}`;
  }, [items]);

  const calculateUnpaidAmount = useMemo(() => {
    const total = items.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );
    const advancePaymentValue = parseFloat(advancePayment) || 0;
    const unpaidAmount = total - advancePaymentValue;
    return `ETB ${unpaidAmount.toFixed(2)}`;
  }, [items, advancePayment]);

  const openProductModal = useCallback((index: number) => {
    setSelectedItemIndex(index);
    setShowProductModal(true);
  }, []);

  const openLocationModal = useCallback(() => {
    setShowLocationModal(true);
  }, []);

  const selectCustomer = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    setPhoneNumber(customer.phoneNumber);
  }, []);

  const changeCustomer = useCallback(() => {
    setSelectedCustomer(null);
    setPhoneNumber("");
  }, []);

  const handleCreateNewCustomer = useCallback(() => {
    setNewCustomer({
      name: "",
      phoneNumber: phoneNumber,
      address: "",
    });
    setShowCreateCustomerModal(true);
  }, [phoneNumber]);

  const createNewCustomer = useCallback(async () => {
    if (!newCustomer.name.trim() || !newCustomer.phoneNumber.trim()) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    try {
      const response = await createCustomer({
        name: newCustomer.name,
        phoneNumber: newCustomer.phoneNumber,
        address: newCustomer.address,
      }).unwrap();
      
      console.log("Customer creation response:", response);
      
      // Handle different response structures
      const createdCustomer = response.data || response;
      
      // Ensure the customer has the required structure
      const customerData: Customer = {
        id: createdCustomer.id,
        name: createdCustomer.name,
        phoneNumber: createdCustomer.phoneNumber,
        address: createdCustomer.address || "",
        status: createdCustomer.status || "active",
        createdAt: createdCustomer.createdAt || new Date().toISOString(),
        updatedAt: createdCustomer.updatedAt || new Date().toISOString(),
      };
      
      setSelectedCustomer(customerData);
      setShowCreateCustomerModal(false);
      setNewCustomer({ name: "", phoneNumber: "", address: "" });
      
      // Refresh the customer list
      await refetchCustomers();
    } catch (error) {
      console.error("Customer creation error:", error);
      Alert.alert("Error", "Failed to create customer");
    }
  }, [newCustomer, createCustomer, refetchCustomers]);

  const selectProduct = useCallback(
    (product: Product) => {
      setItems((prevItems) =>
        prevItems.map((item, index) =>
          index === selectedItemIndex
            ? {
                ...item,
                productId: product.id,
                product: product.name,
                price: parseFloat(product.price),
              }
            : item
        )
      );
      setShowProductModal(false);
    },
    [selectedItemIndex]
  );

  const selectLocation = useCallback((location: LocationItem) => {
    setSelectedLocation(location);
    setShowLocationModal(false);
  }, []);

  const handleQuantityChange = useCallback(
    (itemIndex: number, quantity: string) => {
      const newQuantity = parseInt(quantity) || 0;
      setItems((prevItems) =>
        prevItems.map((item, index) =>
          index === itemIndex ? { ...item, quantity: newQuantity } : item
        )
      );
    },
    []
  );

  // Helper function to check if quantity exceeds stock
  const isQuantityExceedingStock = useCallback((item: Item) => {
    const product = products.find(p => p.id === item.productId);
    return product && item.quantity > product.stockQuantity;
  }, [products]);

  const handlePriceChange = useCallback(
    (itemIndex: number, price: string) => {
      const newPrice = parseFloat(price.replace("ETB ", "")) || 0;
      setItems((prevItems) =>
        prevItems.map((item, index) =>
          index === itemIndex ? { ...item, price: newPrice } : item
        )
      );
    },
    []
  );

  const addItem = useCallback(() => {
    setItems((prevItems) => [
      ...prevItems,
      {
        id: Date.now().toString(),
        productId: "",
        product: "",
        quantity: 0,
        price: 0,
      },
    ]);
  }, []);

  const completeSale = useCallback(async () => {
    if (
      !selectedCustomer ||
      !selectedCustomer.id ||
      !selectedLocation ||
      items.some((item) => !item.productId || item.quantity <= 0)
    ) {
      Alert.alert(
        "Error",
        "Please select a customer, location, and fill all item fields with valid products and quantities"
      );
      return;
    }

    // Check stock availability for each item
    const stockErrors: string[] = [];
    items.forEach((item) => {
      const product = products.find(p => p.id === item.productId);
      if (product && item.quantity > product.stockQuantity) {
        stockErrors.push(`${product.name}: Available ${product.stockQuantity}, Requested ${item.quantity}`);
      }
    });

    if (stockErrors.length > 0) {
      Alert.alert(
        "Insufficient Stock",
        `The following items have insufficient stock:\n\n${stockErrors.join('\n')}`
      );
      return;
    }

    try {
      const createdBy = "f0400d6e-2c7b-452a-b70d-330346c2e2a6"; // Hardcoded user ID
      const advancePaymentValue = parseFloat(advancePayment) || 0;

      const saleData: any = {
        customerId: selectedCustomer.id,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.price,
          discountAmount: 0,
          notes: "notes",
        })),
        paymentType: "cash",
        saleDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        note: "string",
        terms: "string",
        referenceNumber: "string",
        advancePayment: advancePaymentValue,
        discountType: "fixed",
        discountRate: 0,
        createdBy,
      };

      // Debug logging
      console.log("Selected Customer:", selectedCustomer);
      console.log("Customer ID:", selectedCustomer.id);

      // Add warehouse or shop ID based on selection
      if (selectedLocation.type === 'warehouse') {
        saleData.warehouseId = selectedLocation.id;
      } else if (selectedLocation.type === 'shop') {
        saleData.shopId = selectedLocation.id;
      }

      console.log("Sale Data:", saleData);
      await createSales(saleData).unwrap();
      
      const unpaidAmount = parseFloat(advancePayment) > 0 ? parseFloat(calculateTotal.replace("ETB ", "")) - parseFloat(advancePayment) : 0;
      const successMessage = unpaidAmount > 0 
        ? `Sale completed for ${selectedCustomer.name} from ${selectedLocation.name} (${selectedLocation.type}) with total ${calculateTotal}. Unpaid amount (ETB ${unpaidAmount.toFixed(2)}) has been automatically created as a credit account.`
        : `Sale completed for ${selectedCustomer.name} from ${selectedLocation.name} (${selectedLocation.type}) with total ${calculateTotal}`;
      
      Alert.alert("Success", successMessage);
      navigation.goBack();
    } catch (error: any) {
      console.error("Sale Error:", error);
      
      // Extract error message from the error response
      let errorMessage = "An error occurred while processing the sale";
      
      if (error?.data?.message) {
        errorMessage = error.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      Alert.alert("Sale Failed", errorMessage);
    }
  }, [
    selectedCustomer,
    selectedLocation,
    items,
    advancePayment,
    calculateTotal,
    createSales,
    navigation,
  ]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Sale</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Customer & Location Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer & Location</Text>
          {selectedCustomer ? (
            <View style={styles.customerSelectedContainer}>
              <View style={styles.customerSelectedInfo}>
                <Text style={styles.customerName}>{selectedCustomer.name}</Text>
                <Text style={styles.customerPhone}>
                  {selectedCustomer.phoneNumber}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.changeCustomerButton}
                onPress={changeCustomer}
              >
                <Text style={styles.changeCustomerText}>Change Customer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TextInput
              style={styles.phoneInput}
              value={phoneNumber}
              onChangeText={(text) => {
                setPhoneNumber(text);
                setSelectedCustomer(null);
              }}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
              placeholderTextColor="#9ca3af"
            />
          )}
          {phoneNumber && !selectedCustomer && (
            <View style={styles.customerSuggestions}>
              {customersLoading ? (
                <Text style={styles.loadingText}>Loading...</Text>
              ) : customers.length === 0 ? (
                <View>
                  <Text style={styles.noDataText}>No customers found</Text>
                  <TouchableOpacity
                    style={styles.createCustomerButton}
                    onPress={handleCreateNewCustomer}
                  >
                    <Feather name="plus" size={16} color="#6b7280" />
                    <Text style={styles.createCustomerText}>Create New Customer</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={customers}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item: customer }) => (
                    <TouchableOpacity
                      style={styles.customerItem}
                      onPress={() => selectCustomer(customer)}
                    >
                      <Text style={styles.customerName}>{customer.name}</Text>
                      <Text style={styles.customerPhone}>
                        {customer.phoneNumber}
                      </Text>
                    </TouchableOpacity>
                  )}
                  nestedScrollEnabled={true}
                  style={styles.customerList}
                />
              )}
            </View>
          )}
          {/* Location Selection */}
          <TouchableOpacity
            style={[styles.productSelector, styles.warehouseSelector]}
            onPress={openLocationModal}
          >
            <Text
              style={[
                styles.productText,
                !selectedLocation && styles.placeholderText,
              ]}
            >
              {selectedLocation ? `${selectedLocation.name} (${selectedLocation.type})` : "Select warehouse or shop"}
            </Text>
            <Feather name="chevron-down" size={20} color="#6b7280" />
          </TouchableOpacity>
          
          {/* Credit Information */}
          <View style={styles.creditInfoContainer}>
            <Text style={styles.creditInfoText}>
              💡 Any unpaid amount will automatically be created as a credit account for the customer
            </Text>
          </View>
        </View>

        {/* Items Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          {items.map((item, index) => (
            <View key={item.id} style={styles.itemContainer}>
              <TouchableOpacity
                style={[
                  styles.productSelector,
                  !selectedLocation && styles.disabledSelector
                ]}
                onPress={() => selectedLocation && openProductModal(index)}
                disabled={!selectedLocation}
              >
                <Text
                  style={[
                    styles.productText,
                    !item.product && styles.placeholderText,
                    !selectedLocation && styles.disabledText,
                  ]}
                >
                  {item.product || (selectedLocation ? "Select product" : "Select location first")}
                </Text>
                <Feather 
                  name="chevron-down" 
                  size={20} 
                  color={selectedLocation ? "#6b7280" : "#d1d5db"} 
                />
              </TouchableOpacity>

              <View style={styles.inputRow}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Qty</Text>
                  <TextInput
                    style={[
                      styles.quantityInput,
                      isQuantityExceedingStock(item) && styles.quantityInputError
                    ]}
                    value={item.quantity.toString()}
                    onChangeText={(text) => handleQuantityChange(index, text)}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor="#9ca3af"
                  />
                  {isQuantityExceedingStock(item) && (
                    <Text style={styles.stockWarningText}>
                      Exceeds available stock
                    </Text>
                  )}
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Price</Text>
                  <TextInput
                    style={styles.quantityInput}
                    value={item.price > 0 ? `ETB ${item.price.toFixed(2)}` : ""}
                    onChangeText={(text) => handlePriceChange(index, text)}
                    placeholder="ETB 0.00"
                    keyboardType="numeric"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>

              {item.quantity > 0 && item.price > 0 && (
                <View style={styles.itemTotalContainer}>
                  <Text style={styles.itemTotal}>
                    ETB {(item.quantity * item.price).toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          ))}

          <TouchableOpacity style={styles.addItemButton} onPress={addItem}>
            <Feather name="plus" size={20} color="#6b7280" />
            <Text style={styles.addItemText}>Add item</Text>
          </TouchableOpacity>
        </View>

        {/* Advance Payment and Total Section */}
        <View style={styles.section}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Advance Payment</Text>
            <TextInput
              style={styles.quantityInput}
              value={advancePayment}
              onChangeText={setAdvancePayment}
              placeholder="ETB 0.00"
              keyboardType="numeric"
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{calculateTotal}</Text>
          </View>
          <View style={[styles.summaryRow, styles.unpaidRow]}>
            <Text style={styles.unpaidLabel}>Unpaid Amount</Text>
            <Text style={[styles.unpaidValue, parseFloat(advancePayment) > 0 && styles.unpaidAmountPositive]}>
              {calculateUnpaidAmount}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Complete Sale Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.completeSaleButton}
          onPress={completeSale}
        >
          <Text style={styles.completeSaleText}>Complete Sale</Text>
        </TouchableOpacity>
      </View>

      {/* Product Selection Modal */}
      <Modal
        visible={showProductModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProductModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowProductModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalContainer}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>Select Product</Text>
                {selectedLocation?.type === 'warehouse' && (
                  <Text style={styles.modalSubtitle}>
                    Products from {selectedLocation.name}
                  </Text>
                )}
                {selectedLocation?.type === 'shop' && (
                  <Text style={styles.modalSubtitle}>
                    All available products
                  </Text>
                )}
                {!selectedLocation && (
                  <Text style={styles.modalSubtitle}>
                    Please select a location first
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowProductModal(false)}>
                <Feather name="x" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={products}
              keyExtractor={(item) => item.id}
              renderItem={({ item: product }) => (
                <TouchableOpacity
                  style={styles.productItem}
                  onPress={() => selectProduct(product)}
                >
                  <View style={styles.productInfoContainer}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <View style={styles.productDetailsRow}>
                      <Text style={styles.productPrice}>ETB {product.price}</Text>
                      <View style={[
                        styles.stockBadge,
                        product.stockQuantity <= product.minStockLevel ? styles.lowStockBadge : styles.goodStockBadge
                      ]}>
                        <Text style={[
                          styles.stockText,
                          product.stockQuantity <= product.minStockLevel ? styles.lowStockText : styles.goodStockText
                        ]}>
                          Stock: {product.stockQuantity}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                !selectedLocation ? (
                  <Text style={styles.noDataText}>
                    Please select a location first to view products
                  </Text>
                ) : (productsLoading || warehouseProductsLoading) ? (
                  <Text style={styles.loadingText}>
                    {selectedLocation?.type === 'warehouse' ? 'Loading warehouse products...' : 'Loading products...'}
                  </Text>
                ) : (
                  <Text style={styles.noDataText}>
                    {selectedLocation?.type === 'warehouse' ? 'No products available in this warehouse' : 'No products available'}
                  </Text>
                )
              }
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Location Selection Modal */}
      <Modal
        visible={showLocationModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLocationModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLocationModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalContainer}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Location</Text>
              <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                <Feather name="x" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={locations}
              keyExtractor={(item) => item.id}
              renderItem={({ item: location }) => (
                <TouchableOpacity
                  style={styles.productItem}
                  onPress={() => selectLocation(location)}
                >
                  <View style={styles.locationItemContainer}>
                    <Text style={styles.productName}>{location.name}</Text>
                    <View style={styles.locationTag}>
                      <Text style={styles.locationTagText}>{location.type}</Text>
                    </View>
                  </View>
                  <Text style={styles.productPrice}>
                    <Feather 
                      name={location.type === 'warehouse' ? "map-pin" : "shopping-bag"} 
                      size={14} 
                      color="#6b7280" 
                    />{" "}
                    {location.description}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                (warehouseLoading || shopsLoading) ? (
                  <Text style={styles.loadingText}>Loading locations...</Text>
                ) : (
                  <Text style={styles.noDataText}>No locations available</Text>
                )
              }
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Create Customer Modal */}
      <Modal
        visible={showCreateCustomerModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateCustomerModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCreateCustomerModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalContainer}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Customer</Text>
              <TouchableOpacity onPress={() => setShowCreateCustomerModal(false)}>
                <Feather name="x" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              <View style={styles.formSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter customer name"
                    value={newCustomer.name}
                    onChangeText={(text) =>
                      setNewCustomer({ ...newCustomer, name: text })
                    }
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone Number *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter phone number"
                    value={newCustomer.phoneNumber}
                    onChangeText={(text) =>
                      setNewCustomer({ ...newCustomer, phoneNumber: text })
                    }
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter customer address"
                    value={newCustomer.address}
                    onChangeText={(text) =>
                      setNewCustomer({ ...newCustomer, address: text })
                    }
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCreateCustomerModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createButton}
                onPress={createNewCustomer}
              >
                <Text style={styles.createButtonText}>Create Customer</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 16,
  },
  phoneInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2937",
    backgroundColor: "white",
    flex: 1,
  },
  customerSelectedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  customerSelectedInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1f2937",
  },
  customerPhone: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 2,
  },
  changeCustomerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
  },
  changeCustomerText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  customerSuggestions: {
    marginTop: 8,
    backgroundColor: "white",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    maxHeight: 192,
    marginBottom: 12,
  },
  customerItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  customerList: {
    maxHeight: 180,
  },
  warehouseSelector: {
    marginTop: 12,
  },
  itemContainer: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  productSelector: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    marginBottom: 12,
  },
  disabledSelector: {
    backgroundColor: "#f9fafb",
    borderColor: "#e5e7eb",
  },
  productText: {
    fontSize: 16,
    color: "#1f2937",
  },
  placeholderText: {
    color: "#9ca3af",
  },
  disabledText: {
    color: "#d1d5db",
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#1f2937",
    backgroundColor: "white",
  },
  quantityInputError: {
    borderColor: "#ef4444",
    backgroundColor: "#fef2f2",
  },
  stockWarningText: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
    fontWeight: "500",
  },
  itemTotalContainer: {
    alignItems: "flex-end",
    marginTop: 8,
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
  addItemButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    borderStyle: "dashed",
    gap: 8,
  },
  addItemText: {
    fontSize: 16,
    color: "#6b7280",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
  },
  unpaidRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  unpaidLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
  },
  unpaidValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#EF4444",
  },
  unpaidAmountPositive: {
    color: "#10B981",
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: "#f9fafb",
  },
  completeSaleButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  completeSaleText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    width: "90%",
    elevation: 5,
    maxHeight: "75%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 2,
  },
  productItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  productInfoContainer: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1f2937",
    marginBottom: 4,
  },
  productDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  productPrice: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  goodStockBadge: {
    backgroundColor: "#d1fae5",
  },
  lowStockBadge: {
    backgroundColor: "#fee2e2",
  },
  stockText: {
    fontSize: 12,
    fontWeight: "500",
  },
  goodStockText: {
    color: "#065f46",
  },
  lowStockText: {
    color: "#991b1b",
  },
  loadingText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    paddingVertical: 16,
  },
  noDataText: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    paddingVertical: 16,
  },
  createCustomerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  createCustomerText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  locationItemContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationTag: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  locationTagText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
    textTransform: "capitalize",
  },
  modalScrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  formSection: {
    paddingVertical: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#1f2937",
    backgroundColor: "white",
  },
  modalFooter: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#6b7280",
    fontWeight: "500",
  },
  createButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
    alignItems: "center",
  },
  createButtonText: {
    fontSize: 16,
    color: "white",
    fontWeight: "600",
  },
  creditInfoContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.PRIMARY,
  },
  creditInfoText: {
    fontSize: 14,
    color: "#0369a1",
    fontWeight: "500",
  },
});

export default NewSalesScreen;
