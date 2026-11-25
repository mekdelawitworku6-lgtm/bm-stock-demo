import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../../../constants/Colors";

interface StaffManagementDetailScreenProps {
  navigation: any;
  route?: any;
}

const StaffManagementDetailScreen: React.FC<
  StaffManagementDetailScreenProps
> = ({ navigation, route }) => {
  const { staff } = route?.params || {
    staff: { name: "John Doe", email: "john@example.com" },
  };

  const [permissions, setPermissions] = useState({
    manageItem: true,
    manageAttribute: false,
    managePartner: true,
    manageLocation: false,
    stockIn: true,
    stockOut: true,
    adjust: false,
    moveStock: true,
    manageStockInDraft: false,
    manageStockOutDraft: false,
    type: true,
    brand: false,
  });

  const PermissionItem = ({
    icon,
    title,
    enabled,
    onToggle,
    iconColor = COLORS.PRIMARY,
  }) => (
    <TouchableOpacity style={styles.permissionItem} onPress={onToggle}>
      <View style={styles.permissionLeft}>
        <Feather
          name={icon}
          size={20}
          color={iconColor}
          style={styles.permissionIcon}
        />
        <Text style={styles.permissionTitle}>{title}</Text>
      </View>
      <TouchableOpacity
        style={[styles.toggle, enabled && styles.toggleActive]}
        onPress={onToggle}
      >
        <View
          style={[styles.toggleThumb, enabled && styles.toggleThumbActive]}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const handleSave = () => {
    console.log("Save permissions", permissions);
    navigation.goBack();
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const togglePermission = (key: string) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Staff Management</Text>
        <View style={styles.headerActions}>
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

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Staff Info */}
        <View style={styles.staffInfo}>
          <View style={styles.staffLeft}>
            <Text style={styles.staffName}>{staff.name}</Text>
            <Text style={styles.staffEmail}>{staff.email}</Text>
            <View style={styles.staffTags}>
              <View style={styles.adminTag}>
                <Text style={styles.adminText}>Admin</Text>
              </View>
              <Text style={styles.branchText}>Main Branch</Text>
            </View>
          </View>
          <View style={styles.staffActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Feather name="edit-2" size={16} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Feather name="trash-2" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Feature Access Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather
              name="settings"
              size={16}
              color="#666"
              style={styles.sectionIcon}
            />
            <View>
              <Text style={styles.sectionTitle}>FEATURE ACCESS</Text>
              <Text style={styles.sectionSubtitle}>1 of 2 available</Text>
            </View>
          </View>

          <PermissionItem
            icon="package"
            title="Manage item"
            enabled={permissions.manageItem}
            onToggle={() => togglePermission("manageItem")}
          />
          <PermissionItem
            icon="tag"
            title="Manage attribute"
            enabled={permissions.manageAttribute}
            onToggle={() => togglePermission("manageAttribute")}
          />
          <PermissionItem
            icon="users"
            title="Manage partner"
            enabled={permissions.managePartner}
            onToggle={() => togglePermission("managePartner")}
          />
          <PermissionItem
            icon="map-pin"
            title="Manage location"
            enabled={permissions.manageLocation}
            onToggle={() => togglePermission("manageLocation")}
          />
          <PermissionItem
            icon="trending-up"
            title="Stock in"
            enabled={permissions.stockIn}
            onToggle={() => togglePermission("stockIn")}
          />
          <PermissionItem
            icon="trending-down"
            title="Stock out"
            enabled={permissions.stockOut}
            onToggle={() => togglePermission("stockOut")}
          />
          <PermissionItem
            icon="refresh-cw"
            title="Adjust"
            enabled={permissions.adjust}
            onToggle={() => togglePermission("adjust")}
          />
          <PermissionItem
            icon="shuffle"
            title="Move stock"
            enabled={permissions.moveStock}
            onToggle={() => togglePermission("moveStock")}
          />
          <PermissionItem
            icon="file-text"
            title="Manage stock in draft"
            enabled={permissions.manageStockInDraft}
            onToggle={() => togglePermission("manageStockInDraft")}
          />
          <PermissionItem
            icon="file-text"
            title="Manage stock out draft"
            enabled={permissions.manageStockOutDraft}
            onToggle={() => togglePermission("manageStockOutDraft")}
          />
        </View>

        {/* Item Attribute Access Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather
              name="tag"
              size={16}
              color="#666"
              style={styles.sectionIcon}
            />
            <View>
              <Text style={styles.sectionTitle}>ITEM ATTRIBUTE ACCESS</Text>
              <Text style={styles.sectionSubtitle}>1 of 2 available</Text>
            </View>
          </View>

          <PermissionItem
            icon="type"
            title="Type"
            enabled={permissions.type}
            onToggle={() => togglePermission("type")}
          />
          <PermissionItem
            icon="award"
            title="Brand"
            enabled={permissions.brand}
            onToggle={() => togglePermission("brand")}
          />
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
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
    // backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    // paddingVertical: 12,
    paddingTop: 40,
    // borderBottomWidth: 1,
    // borderBottomColor: "#F0F0F0",
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
  scrollView: {
    flex: 1,
  },
  staffInfo: {
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    // borderBottomWidth: 1,
    // borderBottomColor: "#F0F0F0",
    margin: 16,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  staffLeft: {
    flex: 1,
  },
  staffName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  staffEmail: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
  },
  staffTags: {
    flexDirection: "row",
    alignItems: "center",
  },
  adminTag: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  adminText: {
    fontSize: 10,
    fontWeight: "500",
    color: "white",
  },
  branchText: {
    fontSize: 12,
    color: "#666",
  },
  staffActions: {
    flexDirection: "row",
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  section: {
    backgroundColor: "white",
    marginTop: 8,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  permissionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F8F9FA",
  },
  permissionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  permissionIcon: {
    marginRight: 12,
  },
  permissionTitle: {
    fontSize: 15,
    color: "#000",
    fontWeight: "400",
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: COLORS.PRIMARY,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
  },
  actionButtons: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  saveButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  cancelButton: {
    backgroundColor: "transparent",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#666",
  },
});

export default StaffManagementDetailScreen;
