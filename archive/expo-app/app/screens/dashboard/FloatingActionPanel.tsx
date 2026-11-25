import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "../../../constants/Colors";

const FloatingActionPanel = ({ show, onToggle, onAction }) => {
  const navigation = useNavigation();

  const FloatingActionItem = ({ icon, title, onPress }) => (
    <TouchableOpacity style={styles.floatingActionItem} onPress={onPress}>
      <View style={styles.floatingActionIcon}>
        <Feather name={icon} size={20} color={COLORS.PRIMARY} />
      </View>
      <Text style={styles.floatingActionText}>{title}</Text>
    </TouchableOpacity>
  );

  const handleNavigate = (screenName: string) => {
    navigation.navigate("Main", { screen: screenName }); // Navigate to the stack screen via Main tab
  };

  return (
    <>
      <TouchableOpacity style={styles.fab} onPress={onToggle}>
        <Feather name={show ? "x" : "plus"} size={30} color="white" />
      </TouchableOpacity>
      <Modal
        visible={show}
        transparent={true}
        animationType="fade"
        onRequestClose={onToggle}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={onToggle}
        >
          <View style={styles.floatingPanel}>
            <View style={styles.floatingPanelContent}>
              <View style={styles.floatingActionsRow}>
                <FloatingActionItem
                  icon="shopping-cart"
                  title="New Sale"
                  // onPress={() => handleNavigate("NewSales")}
                  onPress={() => navigation.navigate("NewSales")}
                />
                <FloatingActionItem
                  icon="package"
                  title="New Purchase"
                  onPress={() => navigation.navigate("Purchase")}
                />
              </View>
              <View style={styles.floatingActionsRow}>
                <FloatingActionItem
                  icon="plus-square"
                  title="Add Product"
                  onPress={() => navigation.navigate("AddShopItem")}
                />
                <FloatingActionItem
                  icon="plus-square"
                  title="Add Service"
                  onPress={() => onAction("Add Service")}
                />
              </View>
              <View style={styles.floatingActionsRow}>
                <FloatingActionItem
                  icon="clipboard"
                  title="Branch Transfer"
                  onPress={() => navigation.navigate("BranchTransfer")}
                />
                <FloatingActionItem
                  icon="dollar-sign"
                  title="Add Expense"
                  onPress={() => navigation.navigate("Expense")}
                />
              </View>
              <View style={styles.floatingActionsRow}>
                <FloatingActionItem
                  icon="users"
                  title="Staff"
                  onPress={() => navigation.navigate("StaffManagement")}
                />
                <FloatingActionItem
                  icon="box"
                  title="Request Items"
                  onPress={() => navigation.navigate("RequestItems")}
                />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 30,
    right: 16,
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: COLORS.TEXT,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.61)",
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
  floatingPanel: {
    position: "absolute",
    bottom: 120,
    right: 16,
    alignItems: "center",
    zIndex: 500,
  },
  floatingPanelContent: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  floatingActionsRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  floatingActionItem: {
    alignItems: "center",
    marginHorizontal: 8,
    width: 100,
    backgroundColor: "rgb(255, 255, 255)",
    opacity: 0.9,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  floatingActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  floatingActionText: {
    fontSize: 12,
    color: "#333",
    textAlign: "center",
    fontWeight: "500",
  },
});

export default FloatingActionPanel;
