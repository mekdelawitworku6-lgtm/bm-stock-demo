"use client";

import {
    useCreateCustomerMutation,
    useGetCustomersQuery,
} from "@/lib/Api/customerApi";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
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

const CustomersScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [searchText, setSearchText] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phoneNumber: "",
    address: "",
  });
  const [createCustomer] = useCreateCustomerMutation();
  const { data: customers, isLoading, refetch } = useGetCustomersQuery({
    search: searchText,
  });

  // console.log("customer list", customers);

  const handleCreateCustomer = async () => {
    try {
      await createCustomer({
        name: newCustomer.name,
        phoneNumber: newCustomer.phoneNumber,
        address: newCustomer.address,
        status: "active",
        creditLimit: 0,
        currentCreditBalance: 0,
        creditRating: "no_rating",
        paymentTermsDays: 30,
        isCreditApproved: false,
        creditApprovedDate: "2025-09-10T13:40:26.362Z",
        interestRate: 0,
        allowCreditSales: false,
        creditNotes: "string",
        metadata: {},
      });
      setShowCreateModal(false);
      setNewCustomer({ name: "", phoneNumber: "", address: "" });
      // Refetch the customer list to show the new customer
      refetch();
    } catch (error) {
      console.error("Error creating customer:", error);
    }
  };

  const CustomerItem = ({ name, phoneNumber, address }) => (
    <TouchableOpacity style={styles.customerItem}>
      <View style={styles.customerLeft}>
        <Text style={styles.customerName}>{name}</Text>
        <Text style={styles.customerPhone}>
          {" "}
          <Feather name="phone" /> {phoneNumber}
        </Text>
        <Text style={styles.customerAddress}> {address}</Text>
      </View>
      <View style={styles.customerRight}>
        <Text style={styles.customerStatus}>Active</Text>
      </View>
    </TouchableOpacity>
  );

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
        <Text style={styles.headerTitle}>Customers</Text>
        <View style={styles.headerSpacer} />{" "}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Feather name="user-plus" size={16} color="white" />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchInputContainer}>
          <Feather
            name="search"
            size={16}
            color="#999"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search customers..."
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
      </View>

      {/* Section header with customer count and actions */}
      {/* <View style={styles.sectionHeader}>
        <View style={styles.sectionInfo}>
          <Text style={styles.sectionTitle}>All Customers</Text>
          <Text style={styles.customerCount}>
            {customers ? customers.length : 0} customers
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Feather name="plus" size={16} color="white" />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View> */}

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.customerListContainer}>
          {customers &&
            customers.map((customer, index) => (
              <React.Fragment key={index}>
                <CustomerItem
                  name={customer.name}
                  phoneNumber={customer.phoneNumber}
                  address={customer.address}
                />
                {index < customers.length - 1 && (
                  <View style={styles.horizontalDivider} />
                )}
              </React.Fragment>
            ))}
        </View>
      </ScrollView>

      <Modal
        visible={showCreateModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCreateModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Customer</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Feather name="x" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              <View style={styles.formSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
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
                  <Text style={styles.inputLabel}>Phone Number</Text>
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
                    placeholder="Enter address"
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
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleCreateCustomer}
              >
                <Text style={styles.saveButtonText}>Save Customer</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 16,
  },
  backButton: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginLeft: 12,
    flex: 1,
  },
  headerSpacer: { width: 32 },
  searchSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: "#000", padding: 0 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  sectionInfo: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  customerCount: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  addButton: {
    backgroundColor: COLORS.PRIMARY,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 6,
  },
  scrollView: { flex: 1 },
  customerListContainer: {
    backgroundColor: "white",
    marginTop: 1,
  },
  customerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  customerLeft: { flex: 1 },
  customerName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
    marginBottom: 4,
  },
  customerPhone: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
  },
  customerAddress: { fontSize: 12, color: "#666" },
  customerRight: { alignItems: "flex-end" },
  customerStatus: { fontSize: 11, fontWeight: "600", color: "#4CAF50" },
  horizontalDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginLeft: 16,
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
    flex: 1,
  },
  closeButton: { padding: 4 },
  modalScrollView: { maxHeight: 400 },
  formSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  formSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#000",
  },
  modalActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  saveButton: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});

export default CustomersScreen;
