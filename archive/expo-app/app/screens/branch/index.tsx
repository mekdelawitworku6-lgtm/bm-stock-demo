import { useGetCompaniesQuery } from "@/lib/Api/CompaniesApi";
import { useLoginMutation } from "@/lib/Api/authApi";
import {
    useCreateShopMutation,
    useGetShopsQuery,
} from "@/lib/Api/shopApi";
import {
    useCreateWarehouseMutation,
    useGetWarehousesQuery,
} from "@/lib/Api/warehouseApi";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
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
import { useSelector } from "react-redux";
import { COLORS } from "../../../constants/Colors";

interface BranchesScreenProps {
  navigation: any;
}

interface Company {
  id: string;
  name: string;
  employees: Employee[];
}

interface Employee {
  id: string;
  name: string;
}

const BranchesScreen: React.FC<BranchesScreenProps> = ({ navigation }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [companyModalVisible, setCompanyModalVisible] = useState(false);
  const [employeeModalVisible, setEmployeeModalVisible] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [address, setAddress] = useState("");
  const [branchType, setBranchType] = useState("Shop");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );

  const [createWarehouse, { isLoading: isCreatingWarehouse }] =
    useCreateWarehouseMutation();
  const [createShop, { isLoading: isCreatingShop }] = useCreateShopMutation();
  
  // Test login mutation
  const [testLogin, { isLoading: isTestLoggingIn }] = useLoginMutation();

  const { data: warehousesData, isLoading: isFetchingWarehouses } = useGetWarehousesQuery({
    page: 1,
    limit: 10,
    search: "",
  });

  const { data: shopsData, isLoading: isFetchingShops } = useGetShopsQuery({
    page: 1,
    limit: 10,
    search: "",
  });

  const warehouses = warehousesData?.data?.data || [];
  const shops = shopsData?.data?.data || [];
  const branchesData = [
    ...warehouses.map((w: any) => ({ ...w, type: 'Warehouse' })),
    ...shops.map((s: any) => ({ ...s, type: 'Shop' }))
  ];

  const { data: companiesData, isLoading: companiesLoading, error: companiesError } =
    useGetCompaniesQuery({
      page: 1,
      limit: 10,
      search: "",
    });
  
  // Debug logging
  console.log("=== Companies API Debug ===");
  console.log("companiesData:", companiesData);
  console.log("companiesLoading:", companiesLoading);
  console.log("companiesError:", companiesError);
  console.log("========================");
  
  // Debug authentication state
  const authState = useSelector((state: any) => state.auth);
  console.log("=== Auth State Debug ===");
  console.log("isAuthenticated:", authState.isAuthenticated);
  console.log("token:", authState.token ? "Token present" : "No token");
  console.log("user:", authState.user);
  console.log("========================");
  
  const companies: Company[] = companiesData?.companies || [];

  const BranchItem = ({ name, location, type, onEdit, onDelete }: { name: string; location: string; type: string; onEdit: () => void; onDelete: () => void }) => (
    <View style={styles.branchItem}>
      <View style={styles.branchLeft}>
        <View style={styles.branchIcon}>
          <Feather name="map-pin" size={20} color={COLORS.PRIMARY} />
        </View>
        <View style={styles.branchInfo}>
          <Text style={styles.branchName}>{name}</Text>
          <Text style={styles.branchAddress}>{location}</Text>
          <View style={styles.branchDetails}>
            <View style={styles.typeTag}>
              <Text style={styles.typeText}>{type || "N/A"}</Text>
            </View>
            <Text style={styles.staffCount}>N/A</Text>
          </View>
        </View>
      </View>
      <View style={styles.branchActions}>
        <TouchableOpacity style={styles.actionButton} onPress={onEdit}>
          <Feather name="edit-2" size={16} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onDelete}>
          <Feather name="trash-2" size={16} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const handleSaveBranch = async () => {
    if (!branchName || !address || !selectedCompany) {
      Alert.alert(
        "Error",
        "Please fill in all required fields, including company"
      );
      return;
    }

    try {
      const branchData = {
        name: branchName,
        location: address,
        companyId: selectedCompany.id,
        managerId: selectedEmployee?.id || null, // Optional
        // type: branchType.toLowerCase(), // Include type in the request
      };

      const shopData = {
        name: branchName,
        location: address,
        companyId: selectedCompany.id,
      };

      if (branchType === "Warehouse") {
        await createWarehouse(branchData).unwrap();
      } else {
        await createShop(shopData).unwrap();
      }

      setModalVisible(false);
      setBranchName("");
      setAddress("");
      setBranchType("Shop");
      setSelectedCompany(null);
      setSelectedEmployee(null);
      Alert.alert("Success", `${branchType} added successfully`);
    } catch (error: any) {
      console.error(`Create ${branchType} Error:`, error);
      Alert.alert("Error", error?.data?.message || `Failed to add ${branchType.toLowerCase()}`);
    }
  };

  const selectCompany = (company: Company) => {
    console.log("Selected company:", company);
    setSelectedCompany(company);
    setSelectedEmployee(null); // Reset employee when company changes
    setCompanyModalVisible(false);
  };

  const selectEmployee = (employee: Employee) => {
    console.log("Selected employee:", employee);
    setSelectedEmployee(employee);
    setEmployeeModalVisible(false);
  };

  const handleTestLogin = async () => {
    try {
      console.log("Testing login with john@gmail.com...");
      const response = await testLogin({ 
        email: "john@gmail.com", 
        password: "password" 
      }).unwrap();
      console.log("Test login successful:", response);
      Alert.alert("Success", "Login test successful!");
    } catch (error: any) {
      console.error("Test login failed:", error);
      Alert.alert("Error", error?.data?.message || "Login test failed");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Branches</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerIcon}
            onPress={handleTestLogin}
            disabled={isTestLoggingIn}
          >
            <Feather name="log-in" size={20} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Feather name="search" size={20} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Feather name="bell" size={20} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Feather name="user" size={20} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* All Locations Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>All Locations</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            console.log("Opening add branch modal");
            setModalVisible(true);
          }}
        >
          <Feather name="plus" size={16} color="white" style={styles.addIcon} />
          <Text style={styles.addButtonText}>Add Branch</Text>
        </TouchableOpacity>
      </View>

      {/* Branches List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.branchesList}>
          {((isFetchingWarehouses || isFetchingShops) ? [] : branchesData).map((branch, index) => (
            <BranchItem
              key={`${branch.type}-${index}`}
              name={branch.name}
              location={branch.location}
              type={branch.type || "N/A"}
              onEdit={() => console.log(`Edit ${branch.name}`)}
              onDelete={() => console.log(`Delete ${branch.name}`)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Add New Branch Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          setSelectedCompany(null);
          setSelectedEmployee(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Branch</Text>
              <TouchableOpacity
                onPress={() => {
                  console.log("Closing add branch modal");
                  setModalVisible(false);
                  setSelectedCompany(null);
                  setSelectedEmployee(null);
                }}
              >
                <Feather name="x" size={20} color="#000" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter branch name"
              value={branchName}
              onChangeText={setBranchName}
              autoCapitalize="none"
              editable={!(isCreatingWarehouse || isCreatingShop)}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Enter branch address"
              value={address}
              onChangeText={setAddress}
              autoCapitalize="none"
              editable={!(isCreatingWarehouse || isCreatingShop)}
            />
            <TouchableOpacity
              style={[styles.modalInput, (isCreatingWarehouse || isCreatingShop) && styles.disabledInput]}
              onPress={() => {
                console.log(
                  "Opening company modal, current state:",
                  companyModalVisible
                );
                setCompanyModalVisible(true);
              }}
              disabled={isCreatingWarehouse || isCreatingShop}
            >
              <Text
                style={[
                  styles.modalInputText,
                  !selectedCompany && styles.placeholderText,
                ]}
              >
                {selectedCompany ? selectedCompany.name : "Select company"}
              </Text>
              <Feather name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalInput,
                !selectedCompany || (isCreatingWarehouse || isCreatingShop) ? styles.disabledInput : {},
              ]}
              onPress={() => {
                if (selectedCompany) {
                  console.log(
                    "Opening employee modal, employees:",
                    selectedCompany.employees
                  );
                  setEmployeeModalVisible(true);
                }
              }}
              disabled={!selectedCompany || isCreatingWarehouse || isCreatingShop}
            >
              <Text
                style={[
                  styles.modalInputText,
                  !selectedEmployee && styles.placeholderText,
                ]}
              >
                {selectedEmployee
                  ? selectedEmployee.name
                  : "Select responsible personnel"}
              </Text>
              <Feather name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
            <View style={styles.typeContainer}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  branchType === "Shop" && styles.typeButtonSelected,
                ]}
                onPress={() => setBranchType("Shop")}
                disabled={isCreatingWarehouse || isCreatingShop}
              >
                <Text style={styles.typeButtonText}>Shop</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  branchType === "Warehouse" && styles.typeButtonSelected,
                ]}
                onPress={() => setBranchType("Warehouse")}
                disabled={isCreatingWarehouse || isCreatingShop}
              >
                <Text style={styles.typeButtonText}>Warehouse</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[
                styles.modalSaveButton,
                (isCreatingWarehouse || isCreatingShop) && styles.disabledButton,
              ]}
              onPress={handleSaveBranch}
              disabled={isCreatingWarehouse || isCreatingShop}
            >
              {(isCreatingWarehouse || isCreatingShop) ? (
                <Feather name="loader" size={20} color="white" />
              ) : (
                <Text style={styles.modalSaveText}>Save</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => {
                console.log("Closing add branch modal via cancel");
                setModalVisible(false);
                setSelectedCompany(null);
                setSelectedEmployee(null);
              }}
              disabled={isCreatingWarehouse || isCreatingShop}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Company Selection Modal */}
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
                  style={styles.companyItem}
                  onPress={() => selectCompany(company)}
                >
                  <Text style={styles.companyName}>{company.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                companiesLoading ? (
                  <Text style={styles.loadingText}>Loading companies...</Text>
                ) : (
                  <Text style={styles.noDataText}>No companies available</Text>
                )
              }
            />
          </View>
        </View>
      </Modal>

      {/* Employee Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={employeeModalVisible}
        onRequestClose={() => {
          console.log("Closing employee modal");
          setEmployeeModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select Responsible Personnel
              </Text>
              <TouchableOpacity
                onPress={() => {
                  console.log("Closing employee modal via close button");
                  setEmployeeModalVisible(false);
                }}
              >
                <Feather name="x" size={20} color="#000" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={selectedCompany?.employees || []}
              keyExtractor={(item) => item.id}
              renderItem={({ item: employee }) => (
                <TouchableOpacity
                  style={styles.companyItem}
                  onPress={() => selectEmployee(employee)}
                >
                  <Text style={styles.companyName}>{employee.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.noDataText}>
                  {selectedCompany
                    ? "No employees available"
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  headerActions: {
    flexDirection: "row",
  },
  headerIcon: {
    marginLeft: 16,
    padding: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "white",
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  addButton: {
    backgroundColor: COLORS.PRIMARY,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addIcon: {
    marginRight: 6,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "white",
  },
  scrollView: {
    flex: 1,
  },
  branchesList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  branchItem: {
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  branchLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  branchIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F8FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  branchInfo: {
    flex: 1,
  },
  branchName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  branchAddress: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
  },
  branchDetails: {
    flexDirection: "row",
    alignItems: "center",
  },
  typeTag: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  typeText: {
    fontSize: 10,
    fontWeight: "500",
    color: "white",
  },
  staffCount: {
    fontSize: 12,
    color: "#666",
  },
  branchActions: {
    flexDirection: "row",
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    width: "80%",
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 4,
    paddingHorizontal: 12,
    marginBottom: 16,
    fontSize: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalInputText: {
    fontSize: 16,
    color: "#000",
    flex: 1,
  },
  placeholderText: {
    color: "#666",
  },
  disabledInput: {
    backgroundColor: "#F0F0F0",
    borderColor: "#A0A0A0",
  },
  typeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: "#D3D3D3",
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 4,
  },
  typeButtonSelected: {
    backgroundColor: "#000",
  },
  typeButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  modalSaveButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  modalSaveText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  modalCancelButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCancelText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledButton: {
    backgroundColor: "#A0A0A0",
  },
  companyItem: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  companyName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    paddingVertical: 16,
  },
  noDataText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    paddingVertical: 16,
  },
});

export default BranchesScreen;
