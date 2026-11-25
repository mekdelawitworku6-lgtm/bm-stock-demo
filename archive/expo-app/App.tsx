import AsyncStorage from "@react-native-async-storage/async-storage";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import ErrorBoundary from "./components/ErrorBoundary";
import NetworkStatus from "./components/NetworkStatus";
import { restoreAuth, setLoading, setNeedsPinSetup, setPinSetup } from "./lib/authSlice";
import { RootState } from "./lib/store";
import { errorHandler } from "./utils/reactNativeErrorHandler";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

import { Feather } from "@expo/vector-icons";
import Entypo from "@expo/vector-icons/Entypo";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

// Import your screens
import AddShopItemScreen from "./app/screens/addShopItem";
import BranchesScreen from "./app/screens/branch";
import CommissionScreen from "./app/screens/commission";
import CompanyManagementScreen from "./app/screens/companyManagement";
import CreditScreen from "./app/screens/credit";
import DashboardScreen from "./app/screens/dashboard";
import ExpireItemsScreen from "./app/screens/expireItems";
import GenerateReportScreen from "./app/screens/generateReport";
import LoginScreen from "./app/screens/login";
// import OnboardingScreen from "./app/screens/OnboardingScreen"; // Adjust the path based on your project structure
import { Provider } from "react-redux";
import BranchTransferScreen from "./app/screens/BranchTransfer";
import ChangePasswordScreen from "./app/screens/changePassword";
import ChangePinScreen from "./app/screens/changePin";
import CustomersScreen from "./app/screens/customer";
import ExpenseMain from "./app/screens/expense/ExpenseMain";
import LowStockProduct from "./app/screens/lowStock";
import NewSalesScreen from "./app/screens/newSales";
import OnboardingScreen from "./app/screens/onBoarding";
import PinScreen from "./app/screens/pin";
import PinSetupScreen from "./app/screens/pinSetup";
import ProductsScreen from "./app/screens/products";
import ProfileScreen from "./app/screens/profile";
import ProfileManagementScreen from "./app/screens/profileManagement";
import PurchaseScreen from "./app/screens/purchase";
import RequestItemsScreen from "./app/screens/RequestItems";
import SalesHistoryScreen from "./app/screens/salesHistory";
import SalesDetailScreen from "./app/screens/salesHistory/salesDetail";
import SecuritySettingsScreen from "./app/screens/securitySettings";
import SettingsScreen from "./app/screens/settings";
import ShopScreen from "./app/screens/shop";
import StaffManagementScreen from "./app/screens/staffManagement";
import StaffManagementDetailScreen from "./app/screens/staffManagementDetails";
import StoreScreen from "./app/screens/storre";
import TransferRequestsScreen from "./app/screens/transferRequests";
import TransferRequestScreen from "./app/screens/transferRequest";
import WarehouseReportScreen from "./app/screens/warehouseReport";
import NotificationsScreen from "./app/screens/notifications";
import { store } from "./lib/store";

const NotFoundScreen = () => (
  <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
    <Text>Page Not Found</Text>
  </View>
);

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "#8E8E93",
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Store"
        component={StoreScreen}
        options={{
          tabBarLabel: "Store",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="storefront-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Shop"
        component={ShopScreen}
        options={{
          tabBarLabel: "Shop",
          tabBarIcon: ({ color, size }) => (
            <Entypo name="shop" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Credit"
        component={CreditScreen}
        options={{
          tabBarLabel: "Credit",
          tabBarIcon: ({ color, size }) => (
            <Feather name="credit-card" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={ProfileScreen}
        options={{
          tabBarLabel: "More",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="dots-horizontal-circle-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Global error handler for React Native
const setupGlobalErrorHandling = () => {
  // In React Native, we don't have window.addEventListener
  // Instead, we rely on ErrorBoundary and try-catch blocks
  console.log('Global error handling setup for React Native');
  
  // Set up global error handler for React Native
  const originalConsoleError = console.error;
  console.error = (...args) => {
    // Log the error
    originalConsoleError.apply(console, args);
    
    // Log to our error handler if it's an Error object
    if (args.length > 0 && args[0] instanceof Error) {
      errorHandler.logError(args[0], null, 'Console');
    }
  };
};

// Main App component that uses Redux hooks
function AppContent() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const dispatch = useDispatch();
  const { isAuthenticated, isLoading, isPinSetup, needsPinSetup } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    // Setup global error handling
    setupGlobalErrorHandling();

    const initializeApp = async () => {
      try {
        // Check onboarding status first
        const onboardingValue = await AsyncStorage.getItem("hasSeenOnboarding");
        const hasSeenOnboardingValue = onboardingValue === "true";
        setHasSeenOnboarding(hasSeenOnboardingValue);

        // Check for stored auth data
        const authData = await AsyncStorage.getItem("authData");
        
        if (authData) {
          const parsedAuthData = JSON.parse(authData);
          dispatch(restoreAuth(parsedAuthData));
          
          // Check PIN setup status
          const SecurityService = (await import("./lib/securityService")).default;
          const securityService = SecurityService.getInstance();
          const settings = await securityService.getSecuritySettings();
          
          if (settings.pinEnabled) {
            dispatch(setPinSetup(true));
          } else {
            dispatch(setNeedsPinSetup(true));
          }
        }

        dispatch(setLoading(false));
        setIsInitialized(true);
      } catch (error) {
        console.error("Error initializing app:", error);
        errorHandler.logError(error as Error, null, 'AppInitialization');
        dispatch(setLoading(false));
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, [dispatch]);

  // Hide splash screen when app is ready
  const onLayoutRootView = useCallback(async () => {
    if (isInitialized && !isLoading && hasSeenOnboarding !== null) {
      await SplashScreen.hideAsync();
    }
  }, [isInitialized, isLoading, hasSeenOnboarding]);

  // Show loading screen while initializing
  if (!isInitialized || isLoading || hasSeenOnboarding === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "white" }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 16, fontSize: 16, color: "#666" }}>Loading...</Text>
      </View>
    );
  }

  // Determine initial route based on auth and onboarding status
  const getInitialRoute = () => {
    if (!hasSeenOnboarding) {
      return "OnboardingScreen";
    }
    if (isAuthenticated) {
      if (needsPinSetup) {
        return "PinSetup";
      }
      if (isPinSetup) {
        return "PinScreen";
      }
      return "Main";
    }
    return "Login";
  };

  const initialRoute = getInitialRoute();

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      onLayout={onLayoutRootView}
    >
      <NetworkStatus />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="OnboardingScreen" component={OnboardingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="PinScreen" component={PinScreen} />
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen name="NotFound" component={NotFoundScreen} />
          <Stack.Screen name="AddShopItem" component={AddShopItemScreen} />
          <Stack.Screen
            name="CompanyManagement"
            component={CompanyManagementScreen}
          />
          <Stack.Screen
            name="StaffManagement"
            component={StaffManagementScreen}
          />
          <Stack.Screen
            name="StaffManagementDetail"
            component={StaffManagementDetailScreen}
          />
          <Stack.Screen name="Branch" component={BranchesScreen} />
          <Stack.Screen name="salesHistory" component={SalesHistoryScreen} />
          <Stack.Screen name="SalesDetail" component={SalesDetailScreen} />
          <Stack.Screen name="ExpireItems" component={ExpireItemsScreen} />
          <Stack.Screen
            name="GenerateReport"
            component={GenerateReportScreen}
          />
          <Stack.Screen
            name="WarehouseReport"
            component={WarehouseReportScreen}
          />

          {/* {AsyncStorageDebugger()} */}

          <Stack.Screen name="AppSettings" component={SettingsScreen} />
          <Stack.Screen name="Commission" component={CommissionScreen} />
          <Stack.Screen name="NewSales" component={NewSalesScreen} />
          <Stack.Screen name="Customer" component={CustomersScreen} />
          <Stack.Screen name="LowStock" component={LowStockProduct} />
          <Stack.Screen name="Expense" component={ExpenseMain} />
          <Stack.Screen
            name="BranchTransfer"
            component={BranchTransferScreen}
          />
          <Stack.Screen
            name="TransferRequests"
            component={TransferRequestsScreen}
          />
          <Stack.Screen name="RequestItems" component={RequestItemsScreen} />
          <Stack.Screen name="ProfileManagement" component={ProfileManagementScreen} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
          <Stack.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
          <Stack.Screen name="PinSetup" component={PinSetupScreen} />
          <Stack.Screen name="ChangePin" component={ChangePinScreen} />
          <Stack.Screen name="Products" component={ProductsScreen} />
          <Stack.Screen name="Purchase" component={PurchaseScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="TransferRequest" component={TransferRequestScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </KeyboardAvoidingView>
  );
}

// Main App component that provides Redux store
function App() {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <AppContent />
      </Provider>
    </ErrorBoundary>
  );
}

export default App;
