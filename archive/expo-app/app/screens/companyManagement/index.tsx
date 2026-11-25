import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import BackButton from "../../../components/BackButton";
import { COLORS } from "../../../constants/Colors";
import {
  useCreateCompaniesMutation,
  useGetCompaniesQuery,
} from "../../../lib/Api/CompaniesApi";

interface CompanyManagementScreenProps {
  navigation: any;
}

interface Company {
  id: string;
  name: string;
  [key: string]: any;
}

const CompanyManagementScreen: React.FC<CompanyManagementScreenProps> = ({
  navigation,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [companyName, setCompanyName] = useState("");

  const {
    data: companiesData,
    isLoading,
    error,
    refetch,
  } = useGetCompaniesQuery({ page: 1, limit: 100, search: "" });

  const [createCompany, { isLoading: creating }] = useCreateCompaniesMutation();

  const companies: Company[] = companiesData?.companies || [];

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (err) {
      console.error("Error refreshing companies:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const openModal = () => {
    setCompanyName("");
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setCompanyName("");
  };

  const handleAddCompany = async () => {
    if (!companyName.trim()) {
      Alert.alert("Error", "Please enter a company name");
      return;
    }

    try {
      await createCompany({ name: companyName.trim() }).unwrap();
      Alert.alert("Success", "Company added successfully");
      closeModal();
    } catch (err: any) {
      console.error("Error creating company:", err);
      Alert.alert(
        "Error",
        err?.data?.message || "Failed to add company. Please try again."
      );
    }
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const CompanyItem = ({ company }: { company: Company }) => (
    <View style={styles.companyItem}>
      <View style={styles.companyLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(company.name)}</Text>
        </View>
        <Text style={styles.companyName}>{company.name}</Text>
      </View>
      <TouchableOpacity
        style={styles.switchButton}
        onPress={() => console.log(`Switch to ${company.name}`)}
      >
        <Text style={styles.switchText}>Switch</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.headerTitle}>Company Management</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.statusText}>Loading companies...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.headerTitle}>Company Management</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.centeredContainer}>
          <Feather name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Failed to load companies</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
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
        <BackButton />
        <Text style={styles.headerTitle}>Company Management</Text>
        <TouchableOpacity style={styles.addButton} onPress={openModal}>
          <Feather name="plus" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Company List */}
      <FlatList
        data={companies}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CompanyItem company={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.centeredContainer}>
            <Feather name="briefcase" size={48} color="#999" />
            <Text style={styles.statusText}>No companies found</Text>
            <TouchableOpacity style={styles.retryButton} onPress={openModal}>
              <Text style={styles.retryButtonText}>Add First Company</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={
          companies.length === 0
            ? { flex: 1 }
            : styles.listContainer
        }
      />

      {/* Add Company Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Company</Text>
              <TouchableOpacity onPress={closeModal}>
                <Feather name="x" size={20} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>
                  Company Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Enter company name"
                  placeholderTextColor="#999"
                  autoFocus
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeModal}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, creating && styles.disabledButton]}
                onPress={handleAddCompany}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>Add Company</Text>
                )}
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
    flex: 1,
    textAlign: "center",
  },
  addButton: {
    backgroundColor: COLORS.PRIMARY,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  companyItem: {
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  companyLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.PRIMARY,
  },
  companyName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
    flex: 1,
  },
  switchButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  switchText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  statusText: {
    fontSize: 16,
    color: "#666",
    marginTop: 16,
    marginBottom: 24,
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#EF4444",
    marginTop: 16,
    marginBottom: 24,
    textAlign: "center",
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
    fontWeight: "600",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    width: "90%",
    maxHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  modalBody: {
    padding: 16,
  },
  formField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
    marginBottom: 8,
  },
  required: {
    color: "#FF4444",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#000",
    backgroundColor: "#F8F9FA",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: COLORS.PRIMARY,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    color: "white",
    fontWeight: "600",
  },
  disabledButton: {
    backgroundColor: "#A0A0A0",
  },
});

export default CompanyManagementScreen;
