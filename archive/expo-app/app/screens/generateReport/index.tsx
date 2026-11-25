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

interface GenerateReportScreenProps {
  navigation: any;
}

const GenerateReportScreen: React.FC<GenerateReportScreenProps> = ({
  navigation,
}) => {
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState("");
  const [fromDate, setFromDate] = useState("07 May 2025");
  const [toDate, setToDate] = useState("07 Aug 2025");

  const ReportItem = ({ icon, title, onPress }) => (
    <TouchableOpacity style={styles.reportItem} onPress={onPress}>
      <View style={styles.reportLeft}>
        <View style={styles.reportIcon}>
          <Feather name={icon} size={18} color={COLORS.PRIMARY} />
        </View>
        <Text style={styles.reportTitle}>{title}</Text>
      </View>
      <Feather name="chevron-right" size={20} color="#666" />
    </TouchableOpacity>
  );

  const CustomizeOption = ({ title, onPress, showLoading = false }) => (
    <TouchableOpacity style={styles.customizeOption} onPress={onPress}>
      <Text style={styles.customizeOptionText}>{title}</Text>
      {showLoading && <Text style={styles.loadingText}>(slow loading)</Text>}
      <Feather name="chevron-right" size={20} color="#666" />
    </TouchableOpacity>
  );

  const handleReportPress = (reportType: string) => {
    if (reportType === "Warehouse report") {
      setSelectedReportType(reportType);
      setShowCustomizeModal(true);
    } else {
      // Handle other report types
      console.log(`Opening ${reportType}`);
    }
  };

  const handleSearch = () => {
    setShowCustomizeModal(false);
    // Navigate to the filter/results screen based on selected report type
    if (selectedReportType === "Warehouse report") {
      navigation.navigate("WarehouseReportFilter");
    }
  };

  const handleQuickOption = (option: string) => {
    setShowCustomizeModal(false);
    // Navigate directly with the selected option
    navigation.navigate("WarehouseReportFilter", {
      reportType: selectedReportType,
      timeOption: option,
    });
  };

  const reports = [
    { icon: "package", title: "Warehouse report" },
    { icon: "shopping-bag", title: "Shop report" },
    { icon: "briefcase", title: "Business report" },
    { icon: "credit-card", title: "Credit report" },
    { icon: "box", title: "Product report" },
    { icon: "star", title: "Top Product" },
  ];

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
        <Text style={styles.headerTitle}>Report</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Generate Report Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Generate Report</Text>

          {/* Stats Cards */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total amount sold</Text>
              <View style={styles.statRow}>
                <Text style={styles.statValue}>$1,250</Text>
                <Feather name="trending-up" size={16} color="#4CAF50" />
              </View>
              <Text style={styles.statSubtext}>12 Total Qty sold</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>0.00</Text>
              <View style={styles.statRow}>
                <Text style={styles.statValue}>0.00</Text>
                <Feather name="trending-down" size={16} color="#FF5722" />
              </View>
              <Text style={styles.statSubtext}>912 Total Qty sold</Text>
            </View>
          </View>

          {/* Reports List */}
          <View style={styles.reportsList}>
            {reports.map((report, index) => (
              <ReportItem
                key={index}
                icon={report.icon}
                title={report.title}
                onPress={() => handleReportPress(report.title)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Customize Report Modal */}
      <Modal
        visible={showCustomizeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCustomizeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Customize report</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowCustomizeModal(false)}
              >
                <Feather name="x" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              <CustomizeOption
                title="Today"
                onPress={() => handleQuickOption("Today")}
              />
              <CustomizeOption
                title="Yesterday"
                onPress={() => handleQuickOption("Yesterday")}
              />
              <CustomizeOption
                title="Last 7 days"
                onPress={() => handleQuickOption("Last 7 days")}
              />
              <CustomizeOption
                title="Current month"
                onPress={() => handleQuickOption("Current month")}
              />
              <CustomizeOption
                title="Grand Report"
                showLoading={true}
                onPress={() => handleQuickOption("Grand Report")}
              />

              {/* Date Range */}
              <View style={styles.dateRange}>
                <View style={styles.dateInput}>
                  <Text style={styles.dateLabel}>From</Text>
                  <TextInput
                    style={styles.dateField}
                    value={fromDate}
                    onChangeText={setFromDate}
                    placeholder="Select date"
                  />
                </View>
                <View style={styles.dateInput}>
                  <Text style={styles.dateLabel}>To</Text>
                  <TextInput
                    style={styles.dateField}
                    value={toDate}
                    onChangeText={setToDate}
                    placeholder="Select date"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.searchButton}
                onPress={handleSearch}
              >
                <Text style={styles.searchButtonText}>Search</Text>
              </TouchableOpacity>
            </ScrollView>
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    flex: 1,
    textAlign: "center",
  },
  headerRight: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: "white",
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: "row",
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    padding: 12,
    borderRadius: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginRight: 8,
  },
  statSubtext: {
    fontSize: 10,
    color: "#999",
  },
  reportsList: {
    gap: 1,
  },
  reportItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  reportLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  reportIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0F8FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  reportTitle: {
    fontSize: 15,
    color: "#000",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
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
  closeButton: {
    padding: 4,
  },
  modalScrollView: {
    paddingHorizontal: 20,
  },
  customizeOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  customizeOptionText: {
    fontSize: 16,
    color: "#000",
    flex: 1,
  },
  loadingText: {
    fontSize: 12,
    color: "#666",
    marginRight: 8,
  },
  dateRange: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 20,
  },
  dateInput: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  dateField: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#000",
  },
  searchButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 20,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});

export default GenerateReportScreen;
