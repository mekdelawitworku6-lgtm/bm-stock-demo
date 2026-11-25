"use client";

import { Feather } from "@expo/vector-icons";
import type React from "react";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../../../constants/Colors";

interface SalesDetailScreenProps {
  navigation: any;
  route: {
    params: {
      saleData: any;
    };
  };
}

const SalesDetailScreen: React.FC<SalesDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { saleData } = route.params;
  const [returnAmount, setReturnAmount] = useState("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const DetailRow = ({ label, value, valueStyle = {} }) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueStyle]}>{value}</Text>
    </View>
  );

  const generatePDFContent = () => {
    const currentDate = new Date().toLocaleDateString();
    const invoiceNumber = `INV-${Date.now()}`;

    return {
      invoiceNumber,
      date: currentDate,
      company: {
        name: "Your Business Name",
        address: "123 Business Street, City, Country",
        phone: "+1 (555) 123-4567",
        email: "info@yourbusiness.com",
      },
      customer: {
        name: saleData?.customer?.name || "N/A",
        phone: saleData?.customer?.phone || "N/A",
      },
      items: [
        {
          name: saleData?.product?.name || "N/A",
          code: saleData?.product?.code || "N/A",
          quantity: saleData?.transaction?.quantity || 0,
          unitPrice: saleData?.transaction?.sellingPrice || 0,
          total: saleData?.transaction?.total || 0,
        },
      ],
      summary: {
        subtotal: saleData?.transaction?.total || 0,
        tax: saleData?.transaction?.taxExcluded
          ? 0
          : (saleData?.transaction?.total || 0) * 0.15,
        total: saleData?.transaction?.total || 0,
      },
      paymentDetails: {
        method: saleData?.moreDetails?.paymentType || "N/A",
        soldBy: saleData?.moreDetails?.soldBy || "N/A",
        soldAt: saleData?.moreDetails?.soldAt || "N/A",
        dateOfSale: saleData?.moreDetails?.dateOfSales || "N/A",
      },
    };
  };

  const handlePrintInvoice = async () => {
    try {
      setIsGeneratingPDF(true);

      // Generate PDF content
      const pdfData = generatePDFContent();

      // Simulate PDF generation process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // In a real React Native app, you would use libraries like:
      // - react-native-html-to-pdf
      // - react-native-pdf-lib
      // - @react-native-async-storage/async-storage for local storage
      // - react-native-share for sharing the PDF

      console.log("[v0] PDF Data Generated:", pdfData);

      // Mock PDF generation success
      Alert.alert(
        "PDF Generated Successfully",
        `Invoice ${pdfData.invoiceNumber} has been generated and saved to your device.\n\nCustomer: ${pdfData.customer.name}\nTotal: $${pdfData.summary.total}\nDate: ${pdfData.date}`,
        [
          { text: "Share PDF", onPress: () => handleSharePDF(pdfData) },
          { text: "OK" },
        ]
      );
    } catch (error) {
      console.error("[v0] PDF Generation Error:", error);
      Alert.alert("Error", "Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSharePDF = (pdfData) => {
    // In a real app, this would use react-native-share
    Alert.alert(
      "Share Invoice",
      "Choose how you'd like to share the invoice:",
      [
        { text: "Email", onPress: () => console.log("[v0] Share via Email") },
        {
          text: "WhatsApp",
          onPress: () => console.log("[v0] Share via WhatsApp"),
        },
        {
          text: "Save to Files",
          onPress: () => console.log("[v0] Save to Files"),
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleReturn = () => {
    if (!returnAmount || Number.parseFloat(returnAmount) <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid return amount.");
      return;
    }

    Alert.alert(
      "Confirm Return",
      `Are you sure you want to return $${returnAmount}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => {
            Alert.alert("Success", "Return processed successfully.");
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleItemReturned = () => {
    Alert.alert(
      "Mark as Returned",
      "Are you sure you want to mark this item as returned?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "destructive",
          onPress: () => {
            Alert.alert("Success", "Item marked as returned.");
            navigation.goBack();
          },
        },
      ]
    );
  };

  const totalAmount = saleData?.transaction?.total || 0;
  const totalReturned = 0; // This would come from your backend
  const totalRemaining = totalAmount - totalReturned;

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
        <Text style={styles.headerTitle}>Sales details</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Product Information */}
        <View style={styles.section}>
          <Text style={styles.productName}>
            {saleData?.product?.name || "N/A"}
          </Text>
          <Text style={styles.productCode}>
            {saleData?.product?.code || "N/A"}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Show current price</Text>
            <Text style={styles.priceValue}>
              {saleData?.product?.store || "N/A"}
            </Text>
          </View>
        </View>

        {/* Transaction Details */}
        <View style={styles.section}>
          <View style={styles.transactionRow}>
            <View style={styles.transactionLeft}>
              <Text style={styles.quantityLabel}>Quantity</Text>
              <Text style={styles.quantityValue}>
                {saleData?.transaction?.quantity || "0"}
              </Text>
            </View>
            <View style={styles.transactionRight}>
              <Text style={styles.sellingPriceLabel}>Selling price</Text>
              <Text style={styles.sellingPriceValue}>
                {saleData?.transaction?.sellingPrice || "0.0"}
              </Text>
            </View>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>
              {saleData?.transaction?.total || "0"}
            </Text>
          </View>
          <View style={styles.taxRow}>
            <View style={styles.radioButton}>
              <View style={styles.radioOuter}>
                <View
                  style={[
                    styles.radioInner,
                    saleData?.transaction?.taxExcluded && {
                      backgroundColor: COLORS.PRIMARY,
                    },
                  ]}
                />
              </View>
            </View>
            <Text style={styles.taxLabel}>
              {saleData?.transaction?.taxExcluded
                ? "Tax excluded"
                : "Tax included"}
            </Text>
          </View>
        </View>

        {/* Customer Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer details</Text>
          <DetailRow
            label="Customer name"
            value={saleData?.customer?.name || "N/A"}
          />
          <DetailRow
            label="Customer phone"
            value={saleData?.customer?.phone || "N/A"}
          />
        </View>

        {/* More Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More details</Text>
          <DetailRow
            label="Date of sales"
            value={saleData?.moreDetails?.dateOfSales || "N/A"}
          />
          <DetailRow
            label="Payment type"
            value={saleData?.moreDetails?.paymentType || "N/A"}
          />
          <DetailRow
            label="Sold By"
            value={saleData?.moreDetails?.soldBy || "N/A"}
          />
          <DetailRow
            label="Sold At"
            value={saleData?.moreDetails?.soldAt || "N/A"}
          />
        </View>

        {/* Credit Return Section */}
        <View style={styles.section}>
          <View style={styles.creditReturnHeader}>
            <Text style={styles.sectionTitle}>Credit return</Text>
            <Feather name="chevron-right" size={20} color="#666" />
          </View>

          <View style={styles.creditReturnDetails}>
            <DetailRow
              label="Total Amount:"
              value={`ETB${totalAmount.toFixed(2)}`}
              valueStyle={styles.amountValue}
            />
            <DetailRow
              label="Total Returned:"
              value={`ETB${totalReturned.toFixed(2)}`}
              valueStyle={[styles.amountValue, { color: "#FF4444" }]}
            />
            <DetailRow
              label="Total Remaining:"
              value={`ETB${totalRemaining.toFixed(2)}`}
              valueStyle={[styles.amountValue, { color: COLORS.PRIMARY }]}
            />
          </View>

          <View style={styles.returnAmountSection}>
            <Text style={styles.returnAmountLabel}>Return Amount</Text>
            <View style={styles.returnInputContainer}>
              <TextInput
                style={styles.returnInput}
                placeholder="Enter amount to return"
                placeholderTextColor="#999"
                value={returnAmount}
                onChangeText={setReturnAmount}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={styles.returnButton}
                onPress={handleReturn}
              >
                <Text style={styles.returnButtonText}>Return</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Bottom spacing for fixed buttons */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Fixed Action Buttons */}
      <View style={styles.fixedActionButtons}>
        <TouchableOpacity
          style={[
            styles.printButton,
            isGeneratingPDF && styles.printButtonDisabled,
          ]}
          onPress={handlePrintInvoice}
          disabled={isGeneratingPDF}
        >
          {isGeneratingPDF ? (
            <>
              <Feather
                name="loader"
                size={20}
                color="white"
                style={[styles.buttonIcon, styles.spinningIcon]}
              />
              <Text style={styles.printButtonText}>Generating PDF...</Text>
            </>
          ) : (
            <>
              <Feather
                name="printer"
                size={20}
                color="white"
                style={styles.buttonIcon}
              />
              <Text style={styles.printButtonText}>Print Invoice</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.itemReturnedButton}
          onPress={handleItemReturned}
        >
          <Text style={styles.itemReturnedButtonText}>
            The item is returned
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
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
    marginRight: 28, // Compensate for back button width
  },
  headerRight: {
    width: 28, // Same width as back button for centering
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140, // Space for fixed buttons
  },
  section: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productName: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  productCode: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    fontSize: 14,
    color: "#000",
  },
  priceValue: {
    fontSize: 14,
    color: "#666",
  },
  transactionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  transactionLeft: {
    flex: 1,
  },
  transactionRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  quantityLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  sellingPriceLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  sellingPriceValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
  },
  taxRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  radioButton: {
    marginRight: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "transparent",
  },
  taxLabel: {
    fontSize: 14,
    color: "#000",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: "#666",
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: "#000",
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
  },
  creditReturnHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  creditReturnDetails: {
    marginBottom: 20,
  },
  amountValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  returnAmountSection: {
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingTop: 16,
  },
  returnAmountLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
    marginBottom: 12,
  },
  returnInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  returnInput: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#000",
  },
  returnButton: {
    backgroundColor: "#FF6B6B",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  returnButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  bottomSpacing: {
    height: 20,
  },
  fixedActionButtons: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    gap: 12,
  },
  printButton: {
    backgroundColor: COLORS.PRIMARY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: COLORS.PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  printButtonDisabled: {
    backgroundColor: "#B0B0B0",
    shadowOpacity: 0.1,
  },
  spinningIcon: {
    // In a real app, you'd add rotation animation here
  },
  buttonIcon: {
    marginRight: 8,
  },
  printButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  itemReturnedButton: {
    backgroundColor: "#FF4444",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#FF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  itemReturnedButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});

export default SalesDetailScreen;
