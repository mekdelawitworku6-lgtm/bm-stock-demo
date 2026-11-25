"use client";

import { useGetCompaniesQuery } from "@/lib/Api/CompaniesApi";
import { useGetEmployeesQuery } from "@/lib/Api/employeeApi";
import { useCreateUserMutation } from "@/lib/Api/userApi";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
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

interface StaffManagementScreenProps {
  navigation: any;
}

interface Employee {
  id: string;
  name: string;
  phoneNumber: string;
  baseCommissionRate: string;
  jobTitle: string | null;
  userFullName: string;
  warehouseName: string;
  createdAt: string;
  updatedAt: string;
}

interface Company {
  id: string;
  name: string;
  warehouses: Warehouse[];
  shops: Shop[];
}

interface Shop {
  id: string;
  name: string;
}

interface Warehouse {
  id: string;
  name: string;
}

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  required?: boolean;
  secureTextEntry?: boolean;
}

const ROLES = ["super_admin", "admin", "manager", "staff"];

const FormField: React.FC<FormFieldProps> = React.memo(
  ({
    label,
    value,
    onChangeText,
    placeholder,
    required = false,
    secureTextEntry = false,
  }) => (
    <View style={styles.formField}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        autoCapitalize="none"
        secureTextEntry={secureTextEntry}
      />
    </View>
  ),
  (prevProps, nextProps) => {
    return (
      prevProps.value === nextProps.value &&
      prevProps.placeholder === nextProps.placeholder &&
      prevProps.required === nextProps.required &&
      prevProps.secureTextEntry === nextProps.secureTextEntry &&
      prevProps.label === nextProps.label
    );
  }
);

const StaffManagementScreen: React.FC<StaffManagementScreenProps> = ({
  navigation,
}) => {
  const [addStaffModalVisible, setAddStaffModalVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [shopId, setShopId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [companyModalVisible, setCompanyModalVisible] = useState(false);
  const [shopModalVisible, setShopModalVisible] = useState(false);
  const [warehouseModalVisible, setWarehouseModalVisible] = useState(false);

  const {
    data: employeesData,
    isLoading: isLoadingEmployees,
    error,
  } = useGetEmployeesQuery({
    page: 1,
    limit: 10,
    search: "",
  });
  const { data: companiesData, isLoading: isLoadingCompanies } =
    useGetCompaniesQuery({
      page: 1,
      limit: 100,
      search: "",
    });
  const [createEmployee, { isLoading: isCreatingEmployee }] =
    useCreateUserMutation();

  const employees: Employee[] = employeesData || [];
  const companies: Company[] = companiesData?.companies || [];

  const selectedCompany = useMemo(() => {
    return companies.find((company) => company.id === companyId);
  }, [companies, companyId]);

  const shops: Shop[] = useMemo(() => {
    return selectedCompany?.shops || [];
  }, [selectedCompany]);

  const warehouses: Warehouse[] = useMemo(() => {
    return selectedCompany?.warehouses || [];
  }, [selectedCompany]);

  const selectRole = useCallback((selectedRole: string) => {
    console.log("Selected role:", selectedRole);
    setRole(selectedRole);
    setRoleModalVisible(false);
  }, []);

  const selectCompany = useCallback((id: string) => {
    console.log("Selected company ID:", id);
    setCompanyId(id);
    setShopId("");
    setWarehouseId("");
    setCompanyModalVisible(false);
  }, []);

  const selectShop = useCallback((id: string) => {
    console.log("Selected shop ID:", id);
    setShopId(id);
    setShopModalVisible(false);
  }, []);

  const selectWarehouse = useCallback((id: string) => {
    console.log("Selected warehouse ID:", id);
    setWarehouseId(id);
    setWarehouseModalVisible(false);
  }, []);

  const handleAddStaff = useCallback(async () => {
    if (
      !email ||
      !firstName ||
      !lastName ||
      !password ||
      !phone ||
      !companyId
    ) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    const payload = {
      email,
      firstName,
      lastName,
      password,
      phone,
      role: role || undefined,
      companyId,
      shopId: shopId || undefined,
      warehouseId: warehouseId || undefined,
      jobTitle: jobTitle || undefined,
    };

    console.log("Sending payload:", payload);

    try {
      await createEmployee(payload).unwrap();
      Alert.alert("Success", "Staff member added successfully");
      setAddStaffModalVisible(false);
      setEmail("");
      setFirstName("");
      setLastName("");
      setPassword("");
      setPhone("");
      setRole("");
      setCompanyId("");
      setShopId("");
      setWarehouseId("");
      setJobTitle("");
    } catch (err: any) {
      console.error("API Error:", err);
      Alert.alert("Error", err?.data?.message || "Failed to add staff member");
    }
  }, [
    email,
    firstName,
    lastName,
    password,
    phone,
    role,
    companyId,
    shopId,
    warehouseId,
    jobTitle,
    createEmployee,
  ]);

  const handleCancel = useCallback(() => {
    setAddStaffModalVisible(false);
    setEmail("");
    setFirstName("");
    setLastName("");
    setPassword("");
    setPhone("");
    setRole("");
    setCompanyId("");
    setShopId("");
    setWarehouseId("");
    setJobTitle("");
  }, []);

  const renderStaffItem = ({ item: employee }: { item: Employee }) => (
    <View>
      {" "}
      <View style={styles.staffItem}>
        <View style={styles.staffLeft}>
          <Text style={styles.staffName}>{employee.name}</Text>
          <Text style={styles.staffEmail}>{employee.phoneNumber}</Text>
          <View style={styles.staffDetails}>
            <View style={styles.roleTag}>
              <Text style={styles.roleText}>
                {employee.jobTitle || "Staff"}
              </Text>
            </View>
            <Text style={styles.branchText}>
              {employee.warehouseName || "No Branch"}
            </Text>
          </View>
        </View>
        <View style={styles.staffActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              navigation.navigate("StaffManagementDetail", { staff: employee })
            }
          >
            <Feather name="edit-2" size={16} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              Alert.alert(
                "Delete Staff",
                `Are you sure you want to delete ${employee.name}?`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => console.log(`Delete ${employee.name}`),
                  },
                ]
              )
            }
          >
            <Feather name="trash-2" size={16} color="#666" />
          </TouchableOpacity>
          {/* <View style={styles.divider} /> */}
        </View>
      </View>{" "}
      <View style={styles.divider} />{" "}
    </View>
  );

  if (isLoadingEmployees) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <Text style={styles.loadingText}>Loading staff...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <Text style={styles.errorText}>Error loading staff</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Staff Management</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setAddStaffModalVisible(true)}
          >
            <Feather
              name="user-plus"
              size={16}
              color="white"
              style={styles.addIcon}
            />
            <Text style={styles.addButtonText}>Add Staff</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Staff List */}
      <FlatList
        data={employees}
        renderItem={renderStaffItem}
        keyExtractor={(item) => item.id}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.staffList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="users" size={48} color="#999" />
            <Text style={styles.emptyText}>No staff members found</Text>
            <Text style={styles.emptySubtext}>
              Add your first staff member to get started
            </Text>
          </View>
        }
      />

      {/* Add Staff Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addStaffModalVisible}
        onRequestClose={() => setAddStaffModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Staff</Text>
              <TouchableOpacity onPress={() => setAddStaffModalVisible(false)}>
                <Feather name="x" size={20} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formContainer}>
                <FormField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter email"
                  required
                />
                <FormField
                  label="First Name"
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Enter first name"
                  required
                />
                <FormField
                  label="Last Name"
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Enter last name"
                  required
                />
                <FormField
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  required
                  secureTextEntry
                />
                <FormField
                  label="Phone"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Enter phone number"
                  required
                />
                <FormField
                  label="Job Title"
                  value={jobTitle}
                  onChangeText={setJobTitle}
                  placeholder="Enter job title"
                />

                {/* Company Dropdown */}
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>
                    Company<Text style={styles.required}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdownButton,
                      isLoadingCompanies && styles.disabledInput,
                    ]}
                    onPress={() => {
                      console.log("Opening company modal");
                      setCompanyModalVisible(true);
                    }}
                    disabled={isLoadingCompanies}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        !companyId && styles.placeholderText,
                      ]}
                    >
                      {companyId && companies?.length
                        ? companies.find((c) => c.id === companyId)?.name ||
                          "Select company"
                        : "Select company"}
                    </Text>
                    <Feather name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>

                {/* Role Dropdown */}
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Role</Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdownButton,
                      !companyId && styles.disabledInput,
                    ]}
                    onPress={() => {
                      if (!companyId) return;
                      console.log("Opening role modal");
                      setRoleModalVisible(true);
                    }}
                    disabled={!companyId}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        !role && styles.placeholderText,
                      ]}
                    >
                      {role || "Select role"}
                    </Text>
                    <Feather name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>

                {/* Shop Dropdown */}
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Shop</Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdownButton,
                      (!companyId || shops.length === 0) &&
                        styles.disabledInput,
                    ]}
                    onPress={() => {
                      if (!companyId || shops.length === 0) return;
                      console.log("Opening shop modal");
                      setShopModalVisible(true);
                    }}
                    disabled={!companyId || shops.length === 0}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        !shopId && styles.placeholderText,
                      ]}
                    >
                      {shopId && shops?.length
                        ? shops.find((s) => s.id === shopId)?.name ||
                          "Select shop"
                        : "Select shop"}
                    </Text>
                    <Feather name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>

                {/* Warehouse Dropdown */}
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Warehouse</Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdownButton,
                      (!companyId || warehouses.length === 0) &&
                        styles.disabledInput,
                    ]}
                    onPress={() => {
                      if (!companyId || warehouses.length === 0) return;
                      console.log("Opening warehouse modal");
                      setWarehouseModalVisible(true);
                    }}
                    disabled={!companyId || warehouses.length === 0}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        !warehouseId && styles.placeholderText,
                      ]}
                    >
                      {warehouseId && warehouses?.length
                        ? warehouses.find((w) => w.id === warehouseId)?.name ||
                          "Select warehouse"
                        : "Select warehouse"}
                    </Text>
                    <Feather name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={handleCancel}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.submitButton,
                      isCreatingEmployee && styles.disabledButton,
                    ]}
                    onPress={handleAddStaff}
                    disabled={isCreatingEmployee}
                  >
                    {isCreatingEmployee ? (
                      <Feather name="loader" size={20} color="white" />
                    ) : (
                      <Text style={styles.submitButtonText}>Add Staff</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Company Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={companyModalVisible}
          onRequestClose={() => {
            console.log("Closing company modal");
            setCompanyModalVisible(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Company</Text>
                <TouchableOpacity
                  onPress={() => {
                    console.log("Closing company modal via close button");
                    setCompanyModalVisible(false);
                  }}
                >
                  <Feather name="x" size={20} color="#000" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={companies}
                keyExtractor={(item) => item.id}
                renderItem={({ item: company }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      console.log("Company option pressed:", company.id);
                      selectCompany(company.id);
                    }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.modalItemText}>{company.name}</Text>
                    {companyId === company.id && (
                      <Feather name="check" size={16} color={COLORS.PRIMARY} />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  isLoadingCompanies ? (
                    <Text style={styles.loadingText}>Loading companies...</Text>
                  ) : (
                    <Text style={styles.noDataText}>
                      No companies available
                    </Text>
                  )
                }
              />
            </View>
          </View>
        </Modal>

        {/* Role Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={roleModalVisible}
          onRequestClose={() => {
            console.log("Closing role modal");
            setRoleModalVisible(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Role</Text>
                <TouchableOpacity
                  onPress={() => {
                    console.log("Closing role modal via close button");
                    setRoleModalVisible(false);
                  }}
                >
                  <Feather name="x" size={20} color="#000" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={ROLES}
                keyExtractor={(item) => item}
                renderItem={({ item: roleOption }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      console.log("Role option pressed:", roleOption);
                      selectRole(roleOption);
                    }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.modalItemText}>{roleOption}</Text>
                    {role === roleOption && (
                      <Feather name="check" size={16} color={COLORS.PRIMARY} />
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>

        {/* Shop Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={shopModalVisible}
          onRequestClose={() => {
            console.log("Closing shop modal");
            setShopModalVisible(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Shop</Text>
                <TouchableOpacity
                  onPress={() => {
                    console.log("Closing shop modal via close button");
                    setShopModalVisible(false);
                  }}
                >
                  <Feather name="x" size={20} color="#000" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={shops}
                keyExtractor={(item) => item.id}
                renderItem={({ item: shop }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      console.log("Shop option pressed:", shop.id);
                      selectShop(shop.id);
                    }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.modalItemText}>{shop.name}</Text>
                    {shopId === shop.id && (
                      <Feather name="check" size={16} color={COLORS.PRIMARY} />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.noDataText}>
                    {companyId
                      ? "No shops available for this company"
                      : "Select a company first"}
                  </Text>
                }
              />
            </View>
          </View>
        </Modal>

        {/* Warehouse Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={warehouseModalVisible}
          onRequestClose={() => {
            console.log("Closing warehouse modal");
            setWarehouseModalVisible(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Warehouse</Text>
                <TouchableOpacity
                  onPress={() => {
                    console.log("Closing warehouse modal via close button");
                    setWarehouseModalVisible(false);
                  }}
                >
                  <Feather name="x" size={20} color="#000" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={warehouses}
                keyExtractor={(item) => item.id}
                renderItem={({ item: warehouse }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      console.log("Warehouse option pressed:", warehouse.id);
                      selectWarehouse(warehouse.id);
                    }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.modalItemText}>{warehouse.name}</Text>
                    {warehouseId === warehouse.id && (
                      <Feather name="check" size={16} color={COLORS.PRIMARY} />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.noDataText}>
                    {companyId
                      ? "No warehouses available for this company"
                      : "Select a company first"}
                  </Text>
                }
              />
            </View>
          </View>
        </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  loadingText: {
    fontSize: 16,
    color: "#64748B",
    fontWeight: "500",
    textAlign: "center",
    paddingVertical: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  errorText: {
    fontSize: 16,
    color: "#EF4444",
    fontWeight: "500",
    textAlign: "center",
    paddingVertical: 20,
  },
  divider: {
    height: 1,
    width: "100%",
    color: "#E2E8F0",
  },
  header: {
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
    marginLeft: 16,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: "white",
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
  },
  addButton: {
    backgroundColor: "#3B82F6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addIcon: {
    marginRight: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  scrollView: {
    flex: 1,
  },
  staffList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  staffItem: {
    // backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 12,
    borderRadius: 12,
    // shadowColor: "#000",
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.08,
    // shadowRadius: 8,
    // elevation: 3,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  staffLeft: {
    flex: 1,
  },
  staffName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 6,
  },
  staffEmail: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 10,
    fontWeight: "500",
  },
  staffDetails: {
    flexDirection: "row",
    alignItems: "center",
  },
  roleTag: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    marginRight: 10,
  },
  roleText: {
    fontSize: 11,
    fontWeight: "600",
    color: "white",
  },
  branchText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  staffActions: {
    flexDirection: "row",
  },
  actionButton: {
    padding: 10,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    width: "92%",
    maxHeight: "85%",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
  },
  formContainer: {
    paddingBottom: 20,
  },
  formField: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 10,
  },
  required: {
    color: "#EF4444",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1E293B",
    backgroundColor: "#FAFBFC",
    fontWeight: "500",
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FAFBFC",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 1,
  },
  dropdownText: {
    fontSize: 16,
    color: "#1E293B",
    flex: 1,
    fontWeight: "500",
  },
  placeholderText: {
    color: "#94A3B8",
  },
  disabledInput: {
    backgroundColor: "#F1F5F9",
    borderColor: "#CBD5E1",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  cancelButton: {
    backgroundColor: "#F1F5F9",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748B",
  },
  submitButton: {
    backgroundColor: "#3B82F6",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  disabledButton: {
    backgroundColor: "#CBD5E1",
  },
  modalItem: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalItemText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1E293B",
  },
  noDataText: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    paddingVertical: 20,
    fontWeight: "500",
  },
});

export default StaffManagementScreen;
