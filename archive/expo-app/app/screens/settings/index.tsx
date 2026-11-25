import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useDispatch } from "react-redux";
import { COLORS } from "../../../constants/Colors";
import { useGetSettingsQuery, useUpdateSettingsMutation } from "../../../lib/Api/userApi";
import { logout } from "../../../lib/authSlice";
import { persistor } from "../../../lib/store";

interface SettingsScreenProps {
  navigation: any;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const dispatch = useDispatch();
  const [companyName, setCompanyName] = useState("My Company");
  const [email, setEmail] = useState("user@example.com");
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // API hooks
  const { data: settingsData, isLoading: settingsLoading } = useGetSettingsQuery();
  const [updateSettings] = useUpdateSettingsMutation();

  // Load settings from API
  useEffect(() => {
    if (settingsData) {
      setCompanyName(settingsData.companyName || "My Company");
      setEmail(settingsData.email || "user@example.com");
      setPushNotifications(settingsData.pushNotifications ?? true);
      setEmailNotifications(settingsData.emailNotifications ?? true);
    }
  }, [settingsData]);

  const ToggleSwitch = ({ value, onToggle }) => (
    <TouchableOpacity
      style={[styles.toggle, value && styles.toggleActive]}
      onPress={onToggle}
    >
      <View style={[styles.toggleThumb, value && styles.toggleThumbActive]} />
    </TouchableOpacity>
  );

  const handleSaveProfile = async () => {
    if (!companyName.trim()) {
      Alert.alert("Error", "Please enter a company name");
      return;
    }

    setIsSaving(true);
    try {
      await updateSettings({
        companyName: companyName.trim(),
        email: email.trim(),
        pushNotifications,
        emailNotifications,
      }).unwrap();
      
      Alert.alert("Success", "Settings saved successfully!");
    } catch (error: any) {
      console.error("Settings update error:", error);
      Alert.alert(
        "Error", 
        error?.data?.message || "Failed to save settings. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = () => {
    Alert.alert(
      "Change Password",
      "Password change functionality will be implemented soon.",
      [{ text: "OK" }]
    );
  };

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
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

      {settingsLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
        {/* Company Profile Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather
              name="grid"
              size={20}
              color="#000"
              style={styles.sectionIcon}
            />
            <Text style={styles.sectionTitle}>Company Profile</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Company Name</Text>
            <TextInput
              style={styles.textInput}
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="Enter company name"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.disabledButton]}
            onPress={handleSaveProfile}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.saveButtonText}>Save Profile</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Account Settings Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather
              name="user"
              size={20}
              color="#000"
              style={styles.sectionIcon}
            />
            <Text style={styles.sectionTitle}>Account Settings</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter email"
              keyboardType="email-address"
            />
          </View>

          <TouchableOpacity
            style={styles.changePasswordButton}
            onPress={handleChangePassword}
          >
            <Text style={styles.changePasswordText}>Change Password</Text>
          </TouchableOpacity>
        </View>

        {/* Notification Settings Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather
              name="bell"
              size={20}
              color="#000"
              style={styles.sectionIcon}
            />
            <Text style={styles.sectionTitle}>Notification Settings</Text>
          </View>

          <View style={styles.notificationItem}>
            <View style={styles.notificationLeft}>
              <Text style={styles.notificationTitle}>Push Notifications</Text>
              <Text style={styles.notificationSubtitle}>
                Get notified about important events
              </Text>
            </View>
            <ToggleSwitch
              value={pushNotifications}
              onToggle={() => setPushNotifications(!pushNotifications)}
            />
          </View>

          <View style={styles.notificationItem}>
            <View style={styles.notificationLeft}>
              <Text style={styles.notificationTitle}>Email Notifications</Text>
              <Text style={styles.notificationSubtitle}>
                Receive summary emails
              </Text>
            </View>
            <ToggleSwitch
              value={emailNotifications}
              onToggle={() => setEmailNotifications(!emailNotifications)}
            />
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather
              name="lock"
              size={20}
              color="#000"
              style={styles.sectionIcon}
            />
            <Text style={styles.sectionTitle}>Security</Text>
          </View>

          <TouchableOpacity 
            style={styles.securityButton} 
            onPress={() => navigation.navigate("SecuritySettings")}
          >
            <View style={styles.securityButtonLeft}>
              <Feather name="shield" size={16} color="#666" />
              <Text style={styles.securityButtonText}>Security Settings</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
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
  section: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionIcon: {
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: "#000",
    backgroundColor: "#F8F9FA",
  },
  saveButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  changePasswordButton: {
    backgroundColor: "#F0F0F0",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  changePasswordText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  notificationLeft: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
    marginBottom: 4,
  },
  notificationSubtitle: {
    fontSize: 12,
    color: "#666",
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
  logoutButton: {
    backgroundColor: "#FF5722",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  securityButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 16,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
  },
  securityButtonLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  securityButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    marginLeft: 8,
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
  disabledButton: {
    backgroundColor: "#ccc",
  },
});

export default SettingsScreen;
