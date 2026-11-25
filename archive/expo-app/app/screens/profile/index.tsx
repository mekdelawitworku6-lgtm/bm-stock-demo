import { Feather } from "@expo/vector-icons";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useGetProfileQuery, useUpdateProfileMutation } from "../../../lib/Api/userApi";
import { logout } from "../../../lib/authSlice";
import SecurityService from "../../../lib/securityService";
import { persistor, RootState } from "../../../lib/store";

interface ProfileScreenProps {
  navigation: any;
}

interface MenuItemProps {
  iconName: keyof typeof Feather.glyphMap;
  title: string;
  onPress: () => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const [isUpdating, setIsUpdating] = useState(false);

  // API hooks
  const { data: profileData, isLoading: profileLoading, refetch } = useGetProfileQuery(undefined);
  const [updateProfile] = useUpdateProfileMutation();

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            // Clear security data
            const securityService = SecurityService.getInstance();
            await securityService.clearAllSecurityData();
            
            // Dispatch logout action to clear Redux state
            dispatch(logout());

            // Purge persisted store so redux-persist doesn't restore stale auth
            await persistor.purge();

            // Reset navigation stack to Login so user can't navigate back
            navigation.reset({
              index: 0,
              routes: [{ name: "Login" }],
            });
          },
        },
      ]
    );
  };

  const handleMenuPress = (menuItem: string) => {
    console.log(`${menuItem} pressed`);
  };

  const handleRefreshProfile = async () => {
    setIsUpdating(true);
    try {
      await refetch();
      Alert.alert("Success", "Profile refreshed successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to refresh profile. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const MenuItem: React.FC<MenuItemProps> = ({ iconName, title, onPress }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemContent}>
        <Feather
          name={iconName}
          size={20}
          color="#2196F3"
          style={styles.menuIcon}
        />
        <Text style={styles.menuText}>{title}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {profileLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.profileContent}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>PP</Text>
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.profileTextContainer}>
                <View style={styles.profileText}>
                  <Text style={styles.companyName}>
                    {profileData?.company?.name || user?.company?.name || "Company Name"}
                  </Text>
                  <Text style={styles.role}>
                    {profileData?.role || user?.role || "User"}
                  </Text>
                  <Text style={styles.email}>
                    {profileData?.email || user?.email || "user@example.com"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleRefreshProfile}
                  disabled={isUpdating}
                  style={styles.refreshButton}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#2196F3" />
                  ) : (
                    <FontAwesome6
                      name="arrow-rotate-right"
                      size={18}
                      color="#2196F3"
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>{" "}
          </View>{" "}
          <TouchableOpacity
            style={styles.viewProfileButton}
            onPress={() => navigation.navigate("ProfileManagement")}
            activeOpacity={0.7}
          >
            <Text style={styles.viewProfileText}>Manage Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <MenuItem
            iconName="users"
            title="Staff & Roles"
            onPress={() => navigation.navigate("StaffManagement")}
          />
          <MenuItem
            iconName="map-pin"
            title="Locations"
            onPress={() => navigation.navigate("Branch")}
          />
          <MenuItem
            iconName="clipboard"
            title="Stock Transfer"
            onPress={() => handleMenuPress("Stock Transfer")}
          />
          <MenuItem
            iconName="dollar-sign"
            title="Commission"
            onPress={() => navigation.navigate("Commission")}
          />
        </View>

        <View style={styles.menuSection}>
          <MenuItem
            iconName="user"
            title="Profile Management"
            onPress={() => navigation.navigate("ProfileManagement")}
          />
          <MenuItem
            iconName="settings"
            title="App Settings"
            onPress={() => navigation.navigate("Settings")}
          />
          <MenuItem
            iconName="help-circle"
            title="Help & Support"
            onPress={() => handleMenuPress("Help & Support")}
          />
        </View>

        {/* Log Out Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Feather
            name="log-out"
            size={16}
            color="white"
            style={styles.logoutIcon}
          />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>Gelagle Stock v1.0.0</Text>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  profileHeader: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginTop: 50,
    marginBottom: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 1,
  },
  profileContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2196F3",
  },
  profileInfo: {
    flex: 1,
  },
  profileTextContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  profileText: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 2,
  },
  role: {
    fontSize: 13,
    color: "#666",
  },
  doubleArrow: {
    fontSize: 20,
    color: "#666",
  },
  viewProfileButton: {
    backgroundColor: "white",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginTop: 15,
  },
  viewProfileText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
  },
  menuSection: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 1,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F0F0F0",
  },
  menuItemContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuIcon: {
    marginRight: 16,
    width: 20,
  },
  menuText: {
    fontSize: 15,
    color: "#000",
    fontWeight: "500",
  },
  logoutButton: {
    backgroundColor: "#F44336",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 32,
    shadowColor: "#F44336",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600",
    color: "white",
  },
  versionText: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    marginBottom: 32,
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
  email: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 4,
  },
});

export default ProfileScreen;
