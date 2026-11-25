// CompanyModal.tsx
import {
    useCreateCompaniesMutation,
    useGetCompaniesQuery,
} from "@/lib/Api/CompaniesApi";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import * as Yup from "yup";

interface Company {
  id: string;
  name: string;
  initials: string;
  isActive: boolean;
}

interface CompanyModalProps {
  show: boolean;
  onToggle: () => void;
  companies: Company[];
  activeCompanyId: string | null;
}

const companySchema = Yup.object().shape({
  name: Yup.string()
    .required("Company name is required")
    .min(2, "Company name must be at least 2 characters"),
  address: Yup.string()
    .required("Address is required")
    .min(5, "Address must be at least 5 characters"),
  phoneNumber: Yup.string()
    .required("Phone number is required")
    .matches(/^\+?[\d\s-]{10,}$/, "Invalid phone number format"),
  email: Yup.string().email("Invalid email format").notRequired(),
});

const CompanyModal: React.FC<CompanyModalProps> = ({
  show,
  onToggle,
  companies,
  activeCompanyId,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [createCompany, { isLoading: isCreating }] =
    useCreateCompaniesMutation();

  // Refetch companies when modal opens
  const { refetch, data: companiesData, isLoading: companiesLoading, error: companiesError } = useGetCompaniesQuery(
    { page: 1, limit: 10 },
    { skip: !show }
  );
  
  // Debug logging
  console.log("=== CompanyModal Companies API Debug ===");
  console.log("companiesData:", companiesData);
  console.log("companiesLoading:", companiesLoading);
  console.log("companiesError:", companiesError);
  console.log("========================================");

  useEffect(() => {
    if (show) {
      refetch();
    }
  }, [show, refetch]);

  const handleSwitchCompany = async (companyId: string) => {
    try {
      const authData = await AsyncStorage.getItem("authData");
      if (authData) {
        const parsedData = JSON.parse(authData);
        parsedData.user.company = { id: companyId };
        await AsyncStorage.setItem("authData", JSON.stringify(parsedData));
      }
      onToggle();
    } catch (error) {
      console.error("Failed to save company to AsyncStorage:", error);
      Alert.alert("Error", "Failed to switch company");
    }
  };

  const CompanyItem = ({ company }: { company: Company }) => (
    <View style={styles.companyItem}>
      <View style={styles.companyLeft}>
        <View style={styles.companyAvatar}>
          <Text style={styles.companyAvatarText}>{company.initials}</Text>
        </View>
        <Text style={styles.companyItemName}>{company.name}</Text>
      </View>
      <TouchableOpacity
        style={[
          styles.switchButton,
          company.isActive && styles.activeSwitchButton,
        ]}
        onPress={() => handleSwitchCompany(company.id)}
        disabled={company.isActive}
        accessible
        accessibilityLabel={`Switch to ${company.name}`}
      >
        <Text style={styles.switchButtonText}>
          {company.isActive ? "Active" : "Switch"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const handleAddCompany = async () => {
    try {
      await companySchema.validate(
        { name: companyName, address, phoneNumber, email },
        { abortEarly: false }
      );

      setErrors({});

      const newCompany = await createCompany({
        name: companyName,
        address,
        phoneNumber,
        email,
        description: "",
      }).unwrap();

      setCompanyName("");
      setAddress("");
      setPhoneNumber("");
      setEmail("");
      setShowAddForm(false);
      Alert.alert("Success", "Company created successfully");

      // Store new company as active
      const authData = await AsyncStorage.getItem("authData");
      if (authData) {
        const parsedData = JSON.parse(authData);
        parsedData.user.company = { id: newCompany.id };
        await AsyncStorage.setItem("authData", JSON.stringify(parsedData));
      }
    } catch (error) {
      if (Yup.ValidationError.isError(error)) {
        const newErrors: { [key: string]: string } = {};
        error.inner.forEach((err) => {
          if (err.path) {
            newErrors[err.path] = err.message;
          }
        });
        setErrors(newErrors);
      } else {
        // Extract error message from the API error
        const errorMessage = "Failed to create company";
        Alert.alert("Error", errorMessage);
      }
    }
  };

  return (
    <Modal
      visible={show}
      transparent={true}
      animationType="slide"
      onRequestClose={onToggle}
    >
      <TouchableOpacity 
        style={styles.companyModalOverlay}
        activeOpacity={1}
        onPress={onToggle}
      >
        <TouchableOpacity 
          style={styles.companyModalContent}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.companyModalTitle}>
            {showAddForm ? "Add New Company" : "Switch account"}
          </Text>
          {showAddForm ? (
            <View style={styles.addForm}>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                placeholder="Company Name"
                value={companyName}
                onChangeText={setCompanyName}
                accessible
                accessibilityLabel="Company Name"
              />
              {errors.name && (
                <Text style={styles.errorText}>{errors.name}</Text>
              )}
              <TextInput
                style={[styles.input, errors.address && styles.inputError]}
                placeholder="Address"
                value={address}
                onChangeText={setAddress}
                accessible
                accessibilityLabel="Address"
              />
              {errors.address && (
                <Text style={styles.errorText}>{errors.address}</Text>
              )}
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                placeholder="Email (optional)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                accessible
                accessibilityLabel="Email"
              />
              {errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}
              <TextInput
                style={[styles.input, errors.phoneNumber && styles.inputError]}
                placeholder="Phone Number"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                accessible
                accessibilityLabel="Phone Number"
              />
              {errors.phoneNumber && (
                <Text style={styles.errorText}>{errors.phoneNumber}</Text>
              )}
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.addAccountButton, styles.cancelButton]}
                  onPress={() => {
                    setShowAddForm(false);
                    setErrors({});
                    setCompanyName("");
                    setAddress("");
                    setPhoneNumber("");
                    setEmail("");
                  }}
                  accessible
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.addAccountButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addAccountButton}
                  onPress={handleAddCompany}
                  disabled={isCreating}
                  accessible
                  accessibilityLabel="Create Company"
                >
                  <Text style={styles.addAccountButtonText}>
                    {isCreating ? "Creating..." : "Create"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <ScrollView style={styles.companiesList}>
                {companies.length === 0 ? (
                  <Text style={styles.noCompaniesText}>No companies found</Text>
                ) : (
                  companies.map((company) => (
                    <CompanyItem key={company.id} company={company} />
                  ))
                )}
              </ScrollView>
              <TouchableOpacity
                style={styles.addAccountButton}
                onPress={() => setShowAddForm(true)}
                accessible
                accessibilityLabel="Add New Company"
              >
                <Feather name="plus" size={20} color="white" />
                <Text style={styles.addAccountButtonText}>Add Account</Text>
              </TouchableOpacity>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  companyModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  companyModalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxHeight: "80%",
  },
  companyModalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    marginBottom: 20,
  },
  companiesList: {
    maxHeight: 400,
  },
  companyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  companyLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  companyAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  companyAvatarText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1976D2",
  },
  companyItemName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
  },
  switchButton: {
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  activeSwitchButton: {
    backgroundColor: "#1976D2",
  },
  switchButtonText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  addAccountButton: {
    backgroundColor: "#1976D2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  addAccountButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  addForm: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#F0F0F0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  inputError: {
    borderColor: "#FF4444",
  },
  errorText: {
    color: "#FF4444",
    fontSize: 12,
    marginBottom: 8,
    marginLeft: 4,
  },
  formActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cancelButton: {
    backgroundColor: "#FF4444",
  },
  noCompaniesText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    paddingVertical: 20,
  },
});

export default CompanyModal;
