import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import { Alert } from "react-native";

// Function to retrieve and log all AsyncStorage content
const checkAsyncStorageContent = async () => {
  try {
    // Get all keys stored in AsyncStorage
    const keys = await AsyncStorage.getAllKeys();

    if (keys.length === 0) {
      Alert.alert("AsyncStorage", "No data found in AsyncStorage");
      console.log("No data in AsyncStorage");
      return;
    }

    // Get all key-value pairs
    const items = await AsyncStorage.multiGet(keys);

    // Log and display the content
    console.log("AsyncStorage Content:");
    items.forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });

    // Optionally show content in an alert
    const content = items.map(([key, value]) => `${key}: ${value}`).join("\n");
    Alert.alert("AsyncStorage Content", content);
  } catch (error) {
    console.error("Error reading AsyncStorage:", error);
    Alert.alert("Error", "Failed to read AsyncStorage content");
  }
};

// Example usage in a component
const AsyncStorageDebugger = () => {
  useEffect(() => {
    checkAsyncStorageContent();
  }, []);

  return null; // This component doesn't render anything
};

export default AsyncStorageDebugger;
