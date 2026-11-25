import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    Vibration,
    View,
} from "react-native";
import { useDispatch } from 'react-redux';
import { setUser } from '../../../lib/authSlice';
import SecurityService from '../../../lib/securityService';

interface PinScreenProps {
  navigation: any;
}

const PinScreen: React.FC<PinScreenProps> = ({ navigation }) => {
  const dispatch = useDispatch();
  const [pin, setPin] = useState<string[]>(["", "", "", ""]);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const securityService = SecurityService.getInstance();

  useEffect(() => {
    initializeSecurity();
  }, []);

  const initializeSecurity = async () => {
    try {
      setIsLoading(true);
      console.log('Initializing PIN screen...');
      
      const biometricInfo = await securityService.getBiometricInfo();
      const settings = await securityService.getSecuritySettings();
      
      console.log('Biometric info:', biometricInfo);
      console.log('Security settings:', settings);
      
      setIsBiometricAvailable(biometricInfo.isAvailable);
      
      // Check if session is still valid
      const isSessionValid = await securityService.isSessionValid();
      console.log('Session valid:', isSessionValid);
      
      // Check if user is authenticated (has auth data)
      const authData = await AsyncStorage.getItem('authData');
      console.log('Auth data exists:', !!authData);
      
      if (isSessionValid && authData) {
        const parsedAuthData = JSON.parse(authData);
        console.log('Auto-navigating to Main with valid session');
        dispatch(setUser(parsedAuthData.user));
        navigation.replace('Main');
        return;
      }
      
      // If user is authenticated but session expired, still allow PIN entry
      if (authData && !isSessionValid) {
        console.log('User authenticated but session expired, allowing PIN entry');
        // Don't auto-navigate, let user enter PIN
      }
      
      // Auto-authenticate with biometric if enabled and available
      if (settings.biometricEnabled && biometricInfo.isAvailable) {
        console.log('Auto-triggering biometric auth');
        handleBiometricAuth();
      }
    } catch (error) {
      console.error('Error initializing security:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNumberPress = (number: string) => {
    if (isLocked) return;
    
    const newPin = [...pin];
    for (let i = 0; i < newPin.length; i++) {
      if (!newPin[i]) {
        newPin[i] = number;
        break;
      }
    }
    setPin(newPin);

    // Check if PIN is complete
    const updatedPin = [...newPin];
    if (updatedPin.every((digit) => digit !== "")) {
      verifyPin(updatedPin.join(""));
    }
  };

  const handleDelete = () => {
    if (isLocked) return;
    
    const newPin = [...pin];
    for (let i = newPin.length - 1; i >= 0; i--) {
      if (newPin[i]) {
        newPin[i] = "";
        break;
      }
    }
    setPin(newPin);
  };

  const verifyPin = async (enteredPin: string) => {
    try {
      setIsAuthenticating(true);
      setErrorMessage("");
      
      const isValid = await securityService.verifyPinAndUpdateSession(enteredPin);
      
      if (isValid) {
        // PIN is correct
        const authData = await AsyncStorage.getItem('authData');
        if (authData) {
          const parsedAuthData = JSON.parse(authData);
          dispatch(setUser(parsedAuthData.user));
          navigation.replace('Main');
        }
        setAttempts(0);
        setPin(["", "", "", ""]);
      } else {
        // PIN is incorrect
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setPin(["", "", "", ""]);
        Vibration.vibrate(200);
        setErrorMessage(`Invalid PIN. ${3 - newAttempts} attempts remaining.`);
        
        if (newAttempts >= 3) {
          setIsLocked(true);
          setErrorMessage("Account locked. Too many failed attempts.");
          Alert.alert(
            'Account Locked',
            'Too many failed attempts. Please try again later.',
            [{ text: 'OK' }]
          );
          setTimeout(() => {
            setIsLocked(false);
            setAttempts(0);
            setErrorMessage("");
          }, 30000); // Lock for 30 seconds
        }
      }
    } catch (error) {
      console.error('PIN verification error:', error);
      setErrorMessage('Failed to verify PIN. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleBiometricAuth = async () => {
    if (isAuthenticating) return;
    
    setIsAuthenticating(true);
    setErrorMessage("");
    
    try {
      const success = await securityService.authenticateWithBiometric();
      
      if (success) {
        const authData = await AsyncStorage.getItem('authData');
        if (authData) {
          const parsedAuthData = JSON.parse(authData);
          dispatch(setUser(parsedAuthData.user));
          navigation.replace('Main');
        }
      } else {
        setErrorMessage("Biometric authentication failed. Please use PIN.");
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      setErrorMessage('Biometric authentication failed. Please use PIN.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleFingerprint = () => {
    if (isBiometricAvailable && !isAuthenticating) {
      handleBiometricAuth();
    }
  };

  const renderKeypadButton = (
    value: string | number,
    onPress: () => void,
    isSpecial = false
  ) => (
    <TouchableOpacity
      key={value.toString()}
      style={[styles.keypadButton, isSpecial && styles.specialButton]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {value === "fingerprint" ? (
        <Text style={styles.fingerprintIcon}>👆</Text>
      ) : value === "delete" ? (
        <Text style={styles.deleteIcon}>⌫</Text>
      ) : (
        <Text style={[styles.keypadText, isSpecial && styles.specialText]}>
          {value}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Logo Section */}
      <View style={styles.logoContainer}>
        <View style={styles.logoIcon}>
          <View style={styles.cube} />
        </View>
        <Text style={styles.logoText}>
          <Text style={styles.gelagle}>Gelagle</Text>
          {"\n"}
          <Text style={styles.stock}>Stock</Text>
        </Text>
      </View>

      <Text style={styles.slogan}>All in one inventory management</Text>

      {/* PIN Dots */}
      <View style={styles.pinContainer}>
        {pin.map((digit, index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              digit ? styles.pinDotFilled : styles.pinDotEmpty,
              isLocked && styles.pinDotLocked,
            ]}
          />
        ))}
      </View>

      {/* Status Messages */}
      {isLocked && (
        <Text style={styles.lockedText}>
          Account locked. Try again in 30 seconds.
        </Text>
      )}

      {/* Error Message */}
      {errorMessage && !isLocked && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Loading Indicator */}
      {(isLoading || isAuthenticating) && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E88E5" />
          <Text style={styles.loadingText}>
            {isAuthenticating ? "Authenticating..." : "Loading..."}
          </Text>
        </View>
      )}
      
      {attempts > 0 && !isLocked && (
        <Text style={styles.attemptsText}>
          {3 - attempts} attempts remaining
        </Text>
      )}

      {isBiometricAvailable && (
        <Text style={styles.biometricText}>
          Use biometric authentication or enter your PIN
        </Text>
      )}

      {/* Keypad */}
      <View style={styles.keypad}>
        <View style={styles.keypadRow}>
          {renderKeypadButton("1", () => handleNumberPress("1"))}
          {renderKeypadButton("2", () => handleNumberPress("2"))}
          {renderKeypadButton("3", () => handleNumberPress("3"))}
        </View>
        <View style={styles.keypadRow}>
          {renderKeypadButton("4", () => handleNumberPress("4"))}
          {renderKeypadButton("5", () => handleNumberPress("5"))}
          {renderKeypadButton("6", () => handleNumberPress("6"))}
        </View>
        <View style={styles.keypadRow}>
          {renderKeypadButton("7", () => handleNumberPress("7"))}
          {renderKeypadButton("8", () => handleNumberPress("8"))}
          {renderKeypadButton("9", () => handleNumberPress("9"))}
        </View>
        <View style={styles.keypadRow}>
          {renderKeypadButton("delete", handleDelete, true)}
          {renderKeypadButton("0", () => handleNumberPress("0"))}
          {isBiometricAvailable ? 
            renderKeypadButton("fingerprint", handleFingerprint, true) : 
            <View style={styles.keypadButton} />
          }
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  logoIcon: {
    width: 32,
    height: 32,
    backgroundColor: "#1E88E5",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cube: {
    width: 16,
    height: 16,
    backgroundColor: "white",
    borderRadius: 2,
  },
  logoText: {
    fontSize: 24,
    fontWeight: "bold",
    lineHeight: 28,
  },
  gelagle: {
    color: "#1E88E5",
  },
  stock: {
    color: "#1E88E5",
  },
  slogan: {
    fontSize: 14,
    color: "#666",
    marginBottom: 40,
    textAlign: "center",
  },
  pinContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 40,
    gap: 16,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  pinDotEmpty: {
    borderColor: "#E0E0E0",
    backgroundColor: "transparent",
  },
  pinDotFilled: {
    borderColor: "#1E88E5",
    backgroundColor: "#1E88E5",
  },
  keypad: {
    width: "100%",
    alignItems: "center",
  },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "80%",
    marginBottom: 20,
  },
  keypadButton: {
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 30,
  },
  specialButton: {
    backgroundColor: "#F5F5F5",
  },
  keypadText: {
    fontSize: 24,
    fontWeight: "400",
    color: "#333",
  },
  specialText: {
    fontSize: 18,
    color: "#666",
  },
  fingerprintIcon: {
    fontSize: 24,
  },
  deleteIcon: {
    fontSize: 20,
    color: "#666",
  },
  lockedText: {
    fontSize: 14,
    color: "#FF5722",
    textAlign: "center",
    marginBottom: 16,
    fontWeight: "500",
  },
  attemptsText: {
    fontSize: 14,
    color: "#FF9800",
    textAlign: "center",
    marginBottom: 16,
    fontWeight: "500",
  },
  biometricText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  pinDotLocked: {
    borderColor: "#FF5722",
    backgroundColor: "#FF5722",
  },
  errorContainer: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  errorText: {
    color: "#F44336",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },
  loadingContainer: {
    marginTop: 16,
    marginBottom: 8,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    color: "#666",
    fontSize: 14,
    textAlign: "center",
  },
});

export default PinScreen;
