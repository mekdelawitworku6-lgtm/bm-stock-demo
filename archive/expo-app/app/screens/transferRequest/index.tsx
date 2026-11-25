"use client";

import React, { useState } from "react";
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import BranchTransferScreen from "../BranchTransfer";
import RequestItemsScreen from "../RequestItems";

interface TransferRequestScreenProps {
  navigation: any;
}

const TransferRequestScreen: React.FC<TransferRequestScreenProps> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<"transfer" | "request">("transfer");

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "transfer" && styles.activeTab]}
            onPress={() => setActiveTab("transfer")}
          >
            <Text style={[styles.tabText, activeTab === "transfer" && styles.activeTabText]}>
              Branch Transfer
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "request" && styles.activeTab]}
            onPress={() => setActiveTab("request")}
          >
            <Text style={[styles.tabText, activeTab === "request" && styles.activeTabText]}>
              Request Item
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {activeTab === "transfer" ? (
          <BranchTransferScreen navigation={navigation} route={{}} />
        ) : (
          <RequestItemsScreen navigation={navigation} />
        )}
      </View>
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
    paddingTop: 40,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backArrow: {
    fontSize: 24,
    color: "#000",
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#025EA7",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  activeTabText: {
    color: "#025EA7",
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
});

export default TransferRequestScreen;
