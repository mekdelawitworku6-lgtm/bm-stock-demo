"use client";

import { useCreateExpenseMutation } from "@/lib/Api/expenseApi";
import { useGetWarehousesQuery } from "@/lib/Api/warehouseApi";
import { Feather } from "@expo/vector-icons";
import type React from "react";
import { useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface ExpenseData {
  title: string;
  description: string;
  type: "operational" | "capital" | "administrative";
  category: "fixed_cost" | "variable_cost" | "one_time" | "recurring";
  amount: number;
  taxRate: number;
  expenseDate: string;
  dueDate: string;
  paymentMethod: "cash" | "card" | "bank_transfer" | "check" | "digital_wallet";
  vendor: string;
  receiptNumber: string;
  referenceNumber: string;
  notes: string;
  recurrence:
    | "one_time"
    | "daily"
    | "weekly"
    | "monthly"
    | "quarterly"
    | "yearly";
  isReimbursable: boolean;
  isTaxDeductible: boolean;
  costCenter: string;
  project: string;
  department: string;
  branchId: string;
  metadata: Record<string, any>;
}

interface Warehouse {
  id: string;
  name: string;
}

const ExpenseScreen = ({ navigation }: { navigation: any }) => {
  const [formData, setFormData] = useState<ExpenseData>({
    title: "",
    description: "",
    type: "operational",
    category: "fixed_cost",
    amount: 0,
    taxRate: 0,
    expenseDate: new Date().toISOString(),
    dueDate: new Date().toISOString(),
    paymentMethod: "cash",
    vendor: "",
    receiptNumber: "",
    referenceNumber: "",
    notes: "",
    recurrence: "one_time",
    isReimbursable: false,
    isTaxDeductible: true,
    costCenter: "",
    project: "",
    department: "",
    branchId: "",
    metadata: {},
  });

  const [showModal, setShowModal] = useState(false);
  const [selectedField, setSelectedField] = useState<keyof ExpenseData | null>(
    null
  );
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);
  const [animatedHeight] = useState(new Animated.Value(0));

  const [createExpense] = useCreateExpenseMutation();
  const { data: warehousesData, isLoading: isWarehousesLoading } =
    useGetWarehousesQuery({ page: 1, limit: 100, search: "" });

  const typeOptions = [
    { label: "Operational", value: "operational" },
    { label: "Capital", value: "capital" },
    { label: "Administrative", value: "administrative" },
  ];

  const categoryOptions = [
    { label: "Fixed Cost", value: "fixed_cost" },
    { label: "Variable Cost", value: "variable_cost" },
    { label: "One Time", value: "one_time" },
    { label: "Recurring", value: "recurring" },
  ];

  const paymentOptions = [
    { label: "Cash", value: "cash" },
    { label: "Card", value: "card" },
    { label: "Bank Transfer", value: "bank_transfer" },
    { label: "Check", value: "check" },
    { label: "Digital Wallet", value: "digital_wallet" },
  ];

  const recurrenceOptions = [
    { label: "One Time", value: "one_time" },
    { label: "Daily", value: "daily" },
    { label: "Weekly", value: "weekly" },
    { label: "Monthly", value: "monthly" },
    { label: "Quarterly", value: "quarterly" },
    { label: "Yearly", value: "yearly" },
  ];

  const branchOptions =
    warehousesData?.data?.map((warehouse: Warehouse) => ({
      label: warehouse.name,
      value: warehouse.id,
    })) || [];

  const updateField = (field: keyof ExpenseData, value: any) => {
    console.log(`Updating ${field} to:`, value); // Debug log
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      Alert.alert("Error", "Please enter an expense title");
      return;
    }
    if (formData.amount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    if (!formData.branchId) {
      Alert.alert("Error", "Please select a branch");
      return;
    }

    try {
      await createExpense(formData).unwrap();
      Alert.alert("Success", "Expense recorded successfully");
      setFormData({
        title: "",
        description: "",
        type: "operational",
        category: "fixed_cost",
        amount: 0,
        taxRate: 0,
        expenseDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        paymentMethod: "cash",
        vendor: "",
        receiptNumber: "",
        referenceNumber: "",
        notes: "",
        recurrence: "one_time",
        isReimbursable: false,
        isTaxDeductible: true,
        costCenter: "",
        project: "",
        department: "",
        branchId: "",
        metadata: {},
      });
    } catch (error) {
      Alert.alert("Error", "Failed to record expense");
      console.error("Error creating expense:", error);
    }
  };

  const toggleAdvancedSection = () => {
    const toValue = isAdvancedExpanded ? 0 : 1;
    setIsAdvancedExpanded(!isAdvancedExpanded);

    Animated.timing(animatedHeight, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const openModal = (field: keyof ExpenseData) => {
    setSelectedField(field);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedField(null);
  };

  const selectOption = (value: string) => {
    if (selectedField) {
      updateField(selectedField, value);
    }
    closeModal();
  };

  const getOptions = () => {
    switch (selectedField) {
      case "type":
        return typeOptions;
      case "category":
        return categoryOptions;
      case "paymentMethod":
        return paymentOptions;
      case "recurrence":
        return recurrenceOptions;
      case "branchId":
        return branchOptions;
      default:
        return [];
    }
  };

  const getModalTitle = () => {
    switch (selectedField) {
      case "type":
        return "Select Type";
      case "category":
        return "Select Category";
      case "paymentMethod":
        return "Select Payment Method";
      case "recurrence":
        return "Select Recurrence";
      case "branchId":
        return "Select Branch";
      default:
        return "Select Option";
    }
  };

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
        <Text style={styles.headerTitle}>Add Expense</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.section}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Branch</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => openModal("branchId")}
              accessible
              accessibilityLabel="Select branch"
            >
              <Text
                style={[
                  styles.dropdownText,
                  !formData.branchId && styles.placeholderText,
                ]}
              >
                {isWarehousesLoading
                  ? "Loading..."
                  : branchOptions.find((opt) => opt.value === formData.branchId)
                      ?.label || "Select Branch"}
              </Text>
              <Feather name="chevron-down" size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Expense Title *</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(text) => updateField("title", text)}
              placeholder="What did you spend on?"
              placeholderTextColor="#9ca3af"
              accessible
              accessibilityLabel="Expense title"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => updateField("description", text)}
              placeholder="Brief description (optional)"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={2}
              accessible
              accessibilityLabel="Description"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Amount *</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={formData.amount.toString()}
                onChangeText={(text) =>
                  updateField("amount", Number.parseFloat(text) || 0)
                }
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                accessible
                accessibilityLabel="Amount"
              />
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.advancedToggle}
          onPress={toggleAdvancedSection}
          accessible
          accessibilityLabel="Toggle advanced options"
        >
          <View style={styles.advancedToggleContent}>
            <Feather name="settings" size={20} color="#6b7280" />
            <Text style={styles.advancedToggleText}>Advanced Options</Text>
          </View>
          <Animated.View
            style={{
              transform: [
                {
                  rotate: animatedHeight.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "180deg"],
                  }),
                },
              ],
            }}
          >
            <Feather name="chevron-down" size={20} color="#6b7280" />
          </Animated.View>
        </TouchableOpacity>

        {isAdvancedExpanded && (
          <Animated.View
            style={[
              styles.advancedSection,
              {
                opacity: animatedHeight,
                transform: [
                  {
                    translateY: animatedHeight.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Categorization */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Categorization</Text>

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>Type</Text>
                  <TouchableOpacity
                    style={styles.dropdown}
                    onPress={() => openModal("type")}
                    accessible
                    accessibilityLabel="Select type"
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        !formData.type && styles.placeholderText,
                      ]}
                    >
                      {typeOptions.find((opt) => opt.value === formData.type)
                        ?.label || "Select Type"}
                    </Text>
                    <Feather name="chevron-down" size={18} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                <View
                  style={[styles.inputGroup, styles.flex1, styles.marginLeft]}
                >
                  <Text style={styles.label}>Category</Text>
                  <TouchableOpacity
                    style={styles.dropdown}
                    onPress={() => openModal("category")}
                    accessible
                    accessibilityLabel="Select category"
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        !formData.category && styles.placeholderText,
                      ]}
                    >
                      {categoryOptions.find(
                        (opt) => opt.value === formData.category
                      )?.label || "Select Category"}
                    </Text>
                    <Feather name="chevron-down" size={18} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tax Rate (%)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.taxRate.toString()}
                  onChangeText={(text) =>
                    updateField("taxRate", Number.parseFloat(text) || 0)
                  }
                  placeholder="0"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  accessible
                  accessibilityLabel="Tax rate"
                />
              </View>
            </View>

            {/* Payment Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Details</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Payment Method</Text>
                <TouchableOpacity
                  style={styles.dropdown}
                  onPress={() => openModal("paymentMethod")}
                  accessible
                  accessibilityLabel="Select payment method"
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      !formData.paymentMethod && styles.placeholderText,
                    ]}
                  >
                    {paymentOptions.find(
                      (opt) => opt.value === formData.paymentMethod
                    )?.label || "Select Payment Method"}
                  </Text>
                  <Feather name="chevron-down" size={18} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Vendor</Text>
                <TextInput
                  style={styles.input}
                  value={formData.vendor}
                  onChangeText={(text) => updateField("vendor", text)}
                  placeholder="Enter vendor name"
                  placeholderTextColor="#9ca3af"
                  accessible
                  accessibilityLabel="Vendor"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>Receipt #</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.receiptNumber}
                    onChangeText={(text) => updateField("receiptNumber", text)}
                    placeholder="Receipt number"
                    placeholderTextColor="#9ca3af"
                    accessible
                    accessibilityLabel="Receipt number"
                  />
                </View>

                <View
                  style={[styles.inputGroup, styles.flex1, styles.marginLeft]}
                >
                  <Text style={styles.label}>Reference #</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.referenceNumber}
                    onChangeText={(text) =>
                      updateField("referenceNumber", text)
                    }
                    placeholder="Reference number"
                    placeholderTextColor="#9ca3af"
                    accessible
                    accessibilityLabel="Reference number"
                  />
                </View>
              </View>
            </View>

            {/* Organization */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Organization</Text>

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>Cost Center</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.costCenter}
                    onChangeText={(text) => updateField("costCenter", text)}
                    placeholder="Cost center"
                    placeholderTextColor="#9ca3af"
                    accessible
                    accessibilityLabel="Cost center"
                  />
                </View>

                <View
                  style={[styles.inputGroup, styles.flex1, styles.marginLeft]}
                >
                  <Text style={styles.label}>Department</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.department}
                    onChangeText={(text) => updateField("department", text)}
                    placeholder="Department"
                    placeholderTextColor="#9ca3af"
                    accessible
                    accessibilityLabel="Department"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>Project</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.project}
                    onChangeText={(text) => updateField("project", text)}
                    placeholder="Project name"
                    placeholderTextColor="#9ca3af"
                    accessible
                    accessibilityLabel="Project"
                  />
                </View>
              </View>
            </View>

            {/* Additional Settings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Additional Settings</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Recurrence</Text>
                <TouchableOpacity
                  style={styles.dropdown}
                  onPress={() => openModal("recurrence")}
                  accessible
                  accessibilityLabel="Select recurrence"
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      !formData.recurrence && styles.placeholderText,
                    ]}
                  >
                    {recurrenceOptions.find(
                      (opt) => opt.value === formData.recurrence
                    )?.label || "Select Recurrence"}
                  </Text>
                  <Feather name="chevron-down" size={18} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.switchContainer}>
                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <Text style={styles.switchLabel}>Reimbursable</Text>
                    <Text style={styles.switchDescription}>
                      Can this expense be reimbursed?
                    </Text>
                  </View>
                  <Switch
                    value={formData.isReimbursable}
                    onValueChange={(value) =>
                      updateField("isReimbursable", value)
                    }
                    trackColor={{ false: "#e5e7eb", true: "#3b82f6" }}
                    thumbColor="#ffffff"
                    accessible
                    accessibilityLabel="Reimbursable switch"
                  />
                </View>

                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <Text style={styles.switchLabel}>Tax Deductible</Text>
                    <Text style={styles.switchDescription}>
                      Is this expense tax deductible?
                    </Text>
                  </View>
                  <Switch
                    value={formData.isTaxDeductible}
                    onValueChange={(value) =>
                      updateField("isTaxDeductible", value)
                    }
                    trackColor={{ false: "#e5e7eb", true: "#3b82f6" }}
                    thumbColor="#ffffff"
                    accessible
                    accessibilityLabel="Tax deductible switch"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.notes}
                  onChangeText={(text) => updateField("notes", text)}
                  placeholder="Additional notes or comments"
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                  accessible
                  accessibilityLabel="Notes"
                />
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <View style={styles.fixedButtonContainer}>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          accessible
          accessibilityLabel="Record expense"
        >
          <Text style={styles.submitButtonText}>Record Expense</Text>
          <Feather name="check" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Dropdown Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{getModalTitle()}</Text>
            <TouchableOpacity onPress={closeModal}>
              <Feather name="x" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={getOptions()}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => selectOption(item.value)}
                accessible
                accessibilityLabel={`Select ${item.label}`}
              >
                <Text style={styles.optionText}>{item.label}</Text>
                {formData[selectedField as keyof ExpenseData] ===
                  item.value && (
                  <Feather name="check" size={16} color="#007AFF" />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              selectedField === "branchId" && isWarehousesLoading ? (
                <Text style={styles.loadingText}>Loading branches...</Text>
              ) : (
                <Text style={styles.noDataText}>No options available</Text>
              )
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingTop: 32,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
    textAlign: "center",
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 8,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    marginHorizontal: 0,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  advancedToggleContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  advancedToggleText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginLeft: 12,
  },
  advancedSection: {
    backgroundColor: "#ffffff",
    marginHorizontal: 0,
    marginTop: 8,
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: "#1f2937",
    backgroundColor: "#ffffff",
  },
  amountContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: "700",
    color: "#3b82f6",
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  marginLeft: {
    marginLeft: 12,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
  },
  dropdownText: {
    fontSize: 16,
    color: "#1f2937",
  },
  placeholderText: {
    color: "#9ca3af",
  },
  switchContainer: {
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  switchInfo: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
  switchDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 2,
  },
  fixedButtonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: "#f8fafc",
  },
  submitButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginRight: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
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
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
  },
  optionItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1f2937",
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
});

export default ExpenseScreen;
