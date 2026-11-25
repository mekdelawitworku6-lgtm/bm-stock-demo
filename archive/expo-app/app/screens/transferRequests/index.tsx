"use client";

import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSelector } from "react-redux";
import { useGetBranchTransfersQuery, useUpdateTransferStatusMutation } from "../../../lib/Api/transferApi";
import { RootState } from "../../../lib/store";

interface TransferRequest {
  id: string;
  transferNumber: string;
  type: string;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled' | 'rejected';
  sourceWarehouseName?: string;
  sourceShopName?: string;
  destinationWarehouseName?: string;
  destinationShopName?: string;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    productSku: string;
    quantity: number;
    notes?: string;
  }>;
  notes?: string;
  rejectionReason?: string;
  createdByName: string;
  createdById: string;
  approvedByName?: string;
  approvedById?: string;
  createdAt: string;
  updatedAt: string;
}

const TransferRequestsScreen = ({ navigation }: { navigation: any }) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRequest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'in_transit' | 'completed' | 'cancelled' | 'rejected'>('pending');

  // API hooks
  const { 
    data: transfersData, 
    isLoading, 
    refetch 
  } = useGetBranchTransfersQuery({ 
    page: 1, 
    limit: 50, 
    status: selectedStatus === 'pending' ? undefined : selectedStatus,
    branchId: undefined 
  });

  const [updateTransferStatus, { isLoading: isUpdating }] = useUpdateTransferStatusMutation();

  const transfers: TransferRequest[] = transfersData?.data || [];
  
  // Check if user can approve (source location responsible person)
  const canApproveTransfer = (transfer: TransferRequest) => {
    // User should be responsible person at the source location
    // This would need to be determined based on user's assigned locations/roles
    // For now, we'll show approval for company_admin as a placeholder
    return user?.role === 'company_admin';
  };

  // Check if user can complete (destination location personnel)
  const canCompleteTransfer = (transfer: TransferRequest) => {
    // User should be personnel at the destination location
    // This would need to be determined based on user's assigned locations/roles
    // For now, we'll show completion for company_admin as a placeholder
    return user?.role === 'company_admin';
  };

  const handleStatusFilter = (status: typeof selectedStatus) => {
    setSelectedStatus(status);
  };

  const handleTransferPress = (transfer: TransferRequest) => {
    setSelectedTransfer(transfer);
    setShowDetailsModal(true);
  };

  const handleApprove = () => {
    setShowDetailsModal(false);
    setShowApprovalModal(true);
  };

  const handleReject = () => {
    setShowDetailsModal(false);
    setShowRejectionModal(true);
  };

  const handleComplete = () => {
    setShowDetailsModal(false);
    setShowCompletionModal(true);
  };

  const confirmApproval = async () => {
    if (!selectedTransfer) return;

    try {
      await updateTransferStatus({
        id: selectedTransfer.id,
        status: 'in_transit'
      }).unwrap();

      Alert.alert("Success", "Transfer approved! Items are now in transit.");
      setShowApprovalModal(false);
      setSelectedTransfer(null);
      refetch();
    } catch (error: any) {
      console.error("Approval error:", error);
      Alert.alert("Error", error?.data?.message || "Failed to approve transfer");
    }
  };

  const confirmCompletion = async () => {
    if (!selectedTransfer) return;

    try {
      await updateTransferStatus({
        id: selectedTransfer.id,
        status: 'completed'
      }).unwrap();

      Alert.alert("Success", "Transfer completed! Items have been received.");
      setShowApprovalModal(false);
      setSelectedTransfer(null);
      refetch();
    } catch (error: any) {
      console.error("Completion error:", error);
      Alert.alert("Error", error?.data?.message || "Failed to complete transfer");
    }
  };

  const confirmRejection = async () => {
    if (!selectedTransfer || !rejectionReason.trim()) {
      Alert.alert("Error", "Please provide a rejection reason");
      return;
    }

    try {
      await updateTransferStatus({
        id: selectedTransfer.id,
        status: 'rejected'
      }).unwrap();

      Alert.alert("Success", "Transfer rejected successfully!");
      setShowRejectionModal(false);
      setSelectedTransfer(null);
      setRejectionReason("");
      refetch();
    } catch (error: any) {
      console.error("Rejection error:", error);
      Alert.alert("Error", error?.data?.message || "Failed to reject transfer");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FFA500';
      case 'in_transit': return '#007AFF';
      case 'completed': return '#34C759';
      case 'rejected': return '#FF3B30';
      case 'cancelled': return '#8E8E93';
      default: return '#8E8E93';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return 'clock';
      case 'in_transit': return 'truck';
      case 'completed': return 'check-circle';
      case 'rejected': return 'x-circle';
      case 'cancelled': return 'minus-circle';
      default: return 'help-circle';
    }
  };

  const renderTransferItem = ({ item }: { item: TransferRequest }) => (
    <TouchableOpacity
      style={styles.transferItem}
      onPress={() => handleTransferPress(item)}
    >
      <View style={styles.transferHeader}>
        <View style={styles.transferInfo}>
          <Text style={styles.transferNumber}>{item.transferNumber}</Text>
          <Text style={styles.transferType}>
            {item.sourceWarehouseName || item.sourceShopName} → {item.destinationWarehouseName || item.destinationShopName}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Feather name={getStatusIcon(item.status)} size={12} color="#fff" />
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      
      <View style={styles.transferDetails}>
        <Text style={styles.itemCount}>{item.items.length} item(s)</Text>
        <Text style={styles.createdBy}>By: {item.createdByName}</Text>
        <Text style={styles.createdAt}>
          {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString()}
        </Text>
      </View>

      {item.notes && (
        <Text style={styles.notes} numberOfLines={2}>
          📝 {item.notes}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderTransferDetails = () => (
    <Modal visible={showDetailsModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
              <Feather name="x" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Transfer Details</Text>
            <View style={{ width: 24 }} />
          </View>

          {selectedTransfer && (
            <ScrollView style={styles.detailsContent}>
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Transfer Information</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Transfer Number:</Text>
                  <Text style={styles.detailValue}>{selectedTransfer.transferNumber}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type:</Text>
                  <Text style={styles.detailValue}>{selectedTransfer.type.replace(/_/g, ' ').toUpperCase()}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedTransfer.status) }]}>
                    <Feather name={getStatusIcon(selectedTransfer.status)} size={12} color="#fff" />
                    <Text style={styles.statusText}>{selectedTransfer.status.toUpperCase()}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Locations</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>From:</Text>
                  <Text style={styles.detailValue}>{selectedTransfer.sourceWarehouseName || selectedTransfer.sourceShopName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>To:</Text>
                  <Text style={styles.detailValue}>{selectedTransfer.destinationWarehouseName || selectedTransfer.destinationShopName}</Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Items</Text>
                {selectedTransfer.items.map((item, index) => (
                  <View key={index} style={styles.itemRow}>
                    <Text style={styles.itemName}>{item.productName}</Text>
                    <Text style={styles.itemSku}>SKU: {item.productSku}</Text>
                    <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                  </View>
                ))}
              </View>

              {selectedTransfer.notes && (
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Notes</Text>
                  <Text style={styles.notesText}>{selectedTransfer.notes}</Text>
                </View>
              )}

              {selectedTransfer.rejectionReason && (
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Rejection Reason</Text>
                  <Text style={styles.rejectionText}>{selectedTransfer.rejectionReason}</Text>
                </View>
              )}

              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Timeline</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Created:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedTransfer.createdAt).toLocaleString()} by {selectedTransfer.createdByName}
                  </Text>
                </View>
                {selectedTransfer.approvedByName && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Approved:</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedTransfer.updatedAt).toLocaleString()} by {selectedTransfer.approvedByName}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          {/* Action buttons based on transfer status and user permissions */}
          {selectedTransfer?.status === 'pending' && canApproveTransfer(selectedTransfer) && (
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={handleReject}
              >
                <Feather name="x" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={handleApprove}
              >
                <Feather name="check" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Approve</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {selectedTransfer?.status === 'in_transit' && canCompleteTransfer(selectedTransfer) && (
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.completeButton]}
                onPress={handleComplete}
              >
                <Feather name="check-circle" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Mark as Received</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderApprovalModal = () => (
    <Modal visible={showApprovalModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowApprovalModal(false)}>
              <Feather name="x" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Approve Transfer</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.confirmationContent}>
            <Feather name="check-circle" size={64} color="#34C759" style={styles.confirmationIcon} />
            <Text style={styles.confirmationTitle}>Approve Transfer?</Text>
            <Text style={styles.confirmationText}>
              As the responsible person at the source location, are you sure you want to approve this transfer? The items will be moved to "In Transit" status and can be received by the destination personnel.
            </Text>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => setShowApprovalModal(false)}
            >
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={confirmApproval}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="check" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Approve</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderRejectionModal = () => (
    <Modal visible={showRejectionModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowRejectionModal(false)}>
              <Feather name="x" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Reject Transfer</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.rejectionContent}>
            <Feather name="x-circle" size={64} color="#FF3B30" style={styles.confirmationIcon} />
            <Text style={styles.confirmationTitle}>Reject Transfer?</Text>
            <Text style={styles.confirmationText}>
              As the responsible person at the source location, please provide a reason for rejecting this transfer request.
            </Text>
            
            <TextInput
              style={styles.rejectionInput}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="Enter rejection reason..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => setShowRejectionModal(false)}
            >
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={confirmRejection}
              disabled={isUpdating || !rejectionReason.trim()}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="x" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Reject</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderCompletionModal = () => (
    <Modal visible={showCompletionModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCompletionModal(false)}>
              <Feather name="x" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Complete Transfer</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.confirmationContent}>
            <Feather name="package" size={64} color="#007AFF" style={styles.confirmationIcon} />
            <Text style={styles.confirmationTitle}>Mark as Received?</Text>
            <Text style={styles.confirmationText}>
              As personnel at the destination location, confirm that you have received all items from this transfer. This will mark the transfer as completed.
            </Text>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => setShowCompletionModal(false)}
            >
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={confirmCompletion}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="check-circle" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Mark as Received</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transfer Requests</Text>
        <View style={styles.workflowBadge}>
          <Text style={styles.workflowBadgeText}>APPROVE → COMPLETE</Text>
        </View>
      </View>

      {/* Status Filter */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['pending', 'in_transit', 'completed', 'rejected', 'cancelled'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                selectedStatus === status && styles.filterButtonActive
              ]}
              onPress={() => handleStatusFilter(status as typeof selectedStatus)}
            >
              <Feather 
                name={getStatusIcon(status)} 
                size={16} 
                color={selectedStatus === status ? "#fff" : getStatusColor(status)} 
              />
              <Text style={[
                styles.filterButtonText,
                selectedStatus === status && styles.filterButtonTextActive
              ]}>
                {status.replace('_', ' ').toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Transfer List */}
      <FlatList
        data={transfers}
        keyExtractor={(item) => item.id}
        renderItem={renderTransferItem}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="inbox" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No transfers found</Text>
            <Text style={styles.emptySubtext}>
              {selectedStatus === 'pending' 
                ? 'No pending transfer requests' 
                : `No ${selectedStatus} transfers`}
            </Text>
          </View>
        }
        contentContainerStyle={transfers.length === 0 ? styles.emptyListContainer : undefined}
      />

      {/* Modals */}
      {renderTransferDetails()}
      {renderApprovalModal()}
      {renderRejectionModal()}
      {renderCompletionModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e1e5e9",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  workflowBadge: {
    backgroundColor: "#34C759",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  workflowBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  filterContainer: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e5e9",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e1e5e9",
  },
  filterButtonActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  filterButtonText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "500",
    color: "#666",
  },
  filterButtonTextActive: {
    color: "#fff",
  },
  transferItem: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  transferHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  transferInfo: {
    flex: 1,
  },
  transferNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  transferType: {
    fontSize: 14,
    color: "#666",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 4,
  },
  transferDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  itemCount: {
    fontSize: 12,
    color: "#666",
  },
  createdBy: {
    fontSize: 12,
    color: "#666",
  },
  createdAt: {
    fontSize: 12,
    color: "#999",
  },
  notes: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e5e9",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  detailsContent: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
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
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
    flex: 2,
    textAlign: "right",
  },
  itemRow: {
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  itemSku: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  itemQuantity: {
    fontSize: 12,
    color: "#007AFF",
    marginTop: 2,
  },
  notesText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  rejectionText: {
    fontSize: 14,
    color: "#FF3B30",
    lineHeight: 20,
  },
  confirmationContent: {
    padding: 20,
    alignItems: "center",
  },
  confirmationIcon: {
    marginBottom: 16,
  },
  confirmationTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  confirmationText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  rejectionContent: {
    padding: 20,
    alignItems: "center",
  },
  rejectionInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e1e5e9",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#333",
    marginTop: 16,
    minHeight: 80,
  },
  modalActions: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  approveButton: {
    backgroundColor: "#34C759",
  },
  rejectButton: {
    backgroundColor: "#FF3B30",
  },
  completeButton: {
    backgroundColor: "#007AFF",
  },
  cancelButton: {
    backgroundColor: "#8E8E93",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default TransferRequestsScreen;
