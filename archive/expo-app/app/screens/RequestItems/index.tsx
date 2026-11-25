"use client";

import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { COLORS } from "../../../constants/Colors";
import { useCreateRequestMutation, useGetMyRequestsQuery } from "../../../lib/Api/requestApi";
import { useGetShopsQuery } from "../../../lib/Api/shopApi";
import { useGetWarehousesQuery } from "../../../lib/Api/warehouseApi";

interface Branch {
  id: string;
  name: string;
  type?: string;
}

interface Priority {
  id: string;
  label: string;
  color: string;
}

interface RecentRequest {
  id: string;
  itemName: string;
  quantity: number;
  fromBranch: string;
  toBranch: string;
  status: "pending" | "approved" | "in_transit" | "completed" | "rejected";
  date: string;
}

const RequestItemsScreen = ({ navigation }: { navigation: any }) => {
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [requestFrom, setRequestFrom] = useState<Branch | null>(null);
  const [deliverTo, setDeliverTo] = useState<Branch | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Modal states
  const [showRequestFromModal, setShowRequestFromModal] = useState(false);
  const [showDeliverToModal, setShowDeliverToModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);

  // API hooks
  const { data: warehousesData, isLoading: warehousesLoading } = useGetWarehousesQuery({
    page: 1,
    limit: 100,
    search: "",
  });
  
  const { data: shopsData, isLoading: shopsLoading } = useGetShopsQuery({
    page: 1,
    limit: 100,
    search: "",
  });

  const [createRequest, { isLoading: isCreatingRequest }] = useCreateRequestMutation();
  
  const { data: myRequestsData, isLoading: requestsLoading, refetch } = useGetMyRequestsQuery({
    page: 1,
    limit: 10,
    status: "",
  });

  // Combine warehouses and shops into branches
  const branches: Branch[] = [
    ...(Array.isArray(warehousesData?.data) ? warehousesData.data.map((warehouse: any) => ({
      id: warehouse.id,
      name: warehouse.name,
      type: "warehouse"
    })) : []),
    ...(Array.isArray(shopsData?.data) ? shopsData.data.map((shop: any) => ({
      id: shop.id,
      name: shop.name,
      type: "shop"
    })) : [])
  ];

  const priorities: Priority[] = [
    { id: "1", label: "Low", color: "#10B981" },
    { id: "2", label: "Medium", color: "#F59E0B" },
    { id: "3", label: "High", color: "#EF4444" },
    { id: "4", label: "Urgent", color: "#DC2626" },
  ];

  // Process recent requests from API
  const recentRequests: RecentRequest[] = myRequestsData?.data?.map((request: any) => ({
    id: request.id,
    itemName: request.itemName || request.description,
    quantity: request.quantity,
    fromBranch: request.fromBranch?.name || "Unknown",
    toBranch: request.toBranch?.name || "Unknown",
    status: request.status || "pending",
    date: request.createdAt ? new Date(request.createdAt).toLocaleDateString() : "Unknown",
  })) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#F59E0B";
      case "approved":
        return "#10B981";
      case "in_transit":
        return "#3B82F6";
      case "completed":
        return "#6B7280";
      case "rejected":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "approved":
        return "Approved";
      case "in_transit":
        return "In Transit";
      case "completed":
        return "Completed";
      case "rejected":
        return "Rejected";
      default:
        return status;
    }
  };

  const handleSubmitRequest = async () => {
    if (!itemName.trim()) {
      Alert.alert("Error", "Please enter item name");
      return;
    }
    if (!quantity.trim()) {
      Alert.alert("Error", "Please enter quantity");
      return;
    }
    if (!requestFrom) {
      Alert.alert("Error", "Please select source branch");
      return;
    }
    if (!deliverTo) {
      Alert.alert("Error", "Please select destination branch");
      return;
    }

    try {
      const requestData = {
        itemName: itemName.trim(),
        quantity: parseInt(quantity),
        fromBranchId: requestFrom.id,
        toBranchId: deliverTo.id,
        priority: priority?.label?.toLowerCase() || "medium",
        notes: additionalNotes.trim(),
        status: "pending",
        requestedBy: "current-user-id", // This should come from auth context
      };

      await createRequest(requestData).unwrap();
      
      Alert.alert(
        "Success", 
        "Item request submitted successfully! It will be reviewed and processed.",
        [
          {
            text: "OK",
            onPress: () => {
              // Reset form
              setItemName("");
              setQuantity("");
              setRequestFrom(null);
              setDeliverTo(null);
              setPriority(null);
              setAdditionalNotes("");
              // Refresh the recent requests
              refetch();
            }
          }
        ]
      );
    } catch (error: any) {
      console.error("Request creation error:", error);
      Alert.alert(
        "Error", 
        error?.data?.message || "Failed to submit request. Please try again."
      );
    }
  };

  const renderBranchModal = (
    visible: boolean,
    onClose: () => void,
    onSelect: (branch: Branch) => void,
    title: string
  ) => (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
          {warehousesLoading || shopsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY} />
              <Text style={styles.loadingText}>Loading branches...</Text>
            </View>
          ) : (
            <FlatList
              data={branches}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                  <Text style={styles.branchType}>{item.type?.toUpperCase()}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No branches available</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );

  const renderPriorityModal = () => (
    <Modal visible={showPriorityModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Priority</Text>
            <TouchableOpacity onPress={() => setShowPriorityModal(false)}>
              <Feather name="x" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={priorities}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  setPriority(item);
                  setShowPriorityModal(false);
                }}
              >
                <View style={styles.priorityItem}>
                  <View
                    style={[
                      styles.priorityDot,
                      { backgroundColor: item.color },
                    ]}
                  />
                  <Text style={styles.modalItemText}>{item.label}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Items</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* New Item Request Form */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>New Item Request</Text>

          {/* Item Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Item Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter item name"
              placeholderTextColor="#9CA3AF"
              value={itemName}
              onChangeText={setItemName}
            />
          </View>

          {/* Quantity */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Quantity <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter quantity needed"
              placeholderTextColor="#9CA3AF"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
            />
          </View>

          {/* Request From */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Request From <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowRequestFromModal(true)}
            >
              <Text
                style={[
                  styles.dropdownText,
                  !requestFrom && styles.placeholder,
                ]}
              >
                {requestFrom ? requestFrom.name : "Select source branch"}
              </Text>
              <Feather name="chevron-down" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Deliver To */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Deliver To <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowDeliverToModal(true)}
            >
              <Text
                style={[styles.dropdownText, !deliverTo && styles.placeholder]}
              >
                {deliverTo ? deliverTo.name : "Select destination branch"}
              </Text>
              <Feather name="chevron-down" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Priority */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Priority</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowPriorityModal(true)}
            >
              <View style={styles.priorityDisplay}>
                {priority && (
                  <View
                    style={[
                      styles.priorityDot,
                      { backgroundColor: priority.color },
                    ]}
                  />
                )}
                <Text
                  style={[styles.dropdownText, !priority && styles.placeholder]}
                >
                  {priority ? priority.label : "Select priority"}
                </Text>
              </View>
              <Feather name="chevron-down" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Additional Notes */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Additional Notes</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Enter any additional notes..."
              placeholderTextColor="#9CA3AF"
              value={additionalNotes}
              onChangeText={setAdditionalNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isCreatingRequest && styles.disabledButton]}
            onPress={handleSubmitRequest}
            disabled={isCreatingRequest}
          >
            {isCreatingRequest ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="check" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.submitButtonText}>
              {isCreatingRequest ? "Submitting..." : "Submit Request"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Requests */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Requests</Text>
          {requestsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY} />
              <Text style={styles.loadingText}>Loading requests...</Text>
            </View>
          ) : recentRequests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No recent requests</Text>
              <Text style={styles.emptySubtext}>Your submitted requests will appear here</Text>
            </View>
          ) : (
            recentRequests.map((request) => (
              <View key={request.id} style={styles.requestItem}>
                <View style={styles.requestHeader}>
                  <Text style={styles.requestTitle}>
                    {request.itemName} - {request.quantity} units
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(request.status) },
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {getStatusLabel(request.status)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.requestDetails}>
                  From: {request.fromBranch} → {request.toBranch}
                </Text>
                <Text style={styles.requestDate}>Date: {request.date}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      {renderBranchModal(
        showRequestFromModal,
        () => setShowRequestFromModal(false),
        setRequestFrom,
        "Select Source Branch"
      )}
      {renderBranchModal(
        showDeliverToModal,
        () => setShowDeliverToModal(false),
        setDeliverTo,
        "Select Destination Branch"
      )}
      {renderPriorityModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    marginTop: 24,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  formSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  required: {
    color: "#EF4444",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  dropdownText: {
    fontSize: 16,
    color: "#111827",
  },
  placeholder: {
    color: "#9CA3AF",
  },
  priorityDisplay: {
    flexDirection: "row",
    alignItems: "center",
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingVertical: 16,
    marginTop: 10,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: 8,
  },
  recentSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  requestItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  requestDetails: {
    fontSize: 14,
    color: "#6B7280",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  modalItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalItemText: {
    fontSize: 16,
    color: "#111827",
  },
  priorityItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
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
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginTop: 8,
  },
  branchType: {
    fontSize: 10,
    color: COLORS.PRIMARY,
    fontWeight: "600",
    marginTop: 2,
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  requestDate: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
});

export default RequestItemsScreen;
