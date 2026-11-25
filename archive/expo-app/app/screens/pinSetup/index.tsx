import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    Vibration,
    View,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { completePinSetup } from '../../../lib/authSlice';
import SecurityService from '../../../lib/securityService';

interface PinSetupScreenProps {
  navigation: any;
  onSetupComplete?: () => void;
}

const PinSetupScreen: React.FC<PinSetupScreenProps> = ({ navigation, onSetupComplete }) => {
  const [pin, setPin] = useState<string[]>(["", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState<string[]>(["", "", "", ""]);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showBiometricOption, setShowBiometricOption] = useState(false);
  const [biometricInfo, setBiometricInfo] = useState({
    isAvailable: false,
    hasHardware: false,
    supportedTypes: [],
  });
  const dispatch = useDispatch();

  const securityService = SecurityService.getInstance();

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const biometricData = await securityService.getBiometricInfo();
      setBiometricInfo(biometricData);
    } catch (error) {
      console.error('Error checking biometric availability:', error);
    }
  };

  const handleNumberPress = (number: string) => {
    if (isLoading) return;
    
    setErrorMessage("");
    
    if (!isConfirming) {
      const newPin = [...pin];
      for (let i = 0; i < newPin.length; i++) {
        if (!newPin[i]) {
          newPin[i] = number;
          break;
        }
      }
      setPin(newPin);

      if (newPin.every((digit) => digit !== "")) {
        setIsConfirming(true);
      }
    } else {
      const newConfirmPin = [...confirmPin];
      for (let i = 0; i < newConfirmPin.length; i++) {
        if (!newConfirmPin[i]) {
          newConfirmPin[i] = number;
          break;
        }
      }
      setConfirmPin(newConfirmPin);

      if (newConfirmPin.every((digit) => digit !== "")) {
        handlePinConfirmation(pin, newConfirmPin);
      }
    }
  };

  const handlePinConfirmation = async (firstPin: string[], secondPin: string[]) => {
    const firstPinString = firstPin.join("");
    const secondPinString = secondPin.join("");
    
    if (firstPinString !== secondPinString) {
      setErrorMessage("PINs do not match. Please try again.");
      Vibration.vibrate(200);
      resetPinSetup();
      return;
    }

    setIsLoading(true);
    try {
      const success = await securityService.setPin(firstPinString);
      if (success) {
        // Update Redux state to mark PIN setup as complete
        dispatch(completePinSetup());
        
        // Show biometric option if available
        if (biometricInfo.isAvailable) {
          setShowBiometricOption(true);
        } else {
          Alert.alert(
            "PIN Set Successfully",
            "Your PIN has been set. You can now use it to secure your app.",
            [
              {
                text: "OK",
                onPress: () => {
                  onSetupComplete?.();
                  navigation.navigate("Main");
                }
              }
            ]
          );
        }
      } else {
        setErrorMessage("Failed to set PIN. Please try again.");
        resetPinSetup();
      }
    } catch (error) {
      console.error("PIN setup error:", error);
      setErrorMessage("An error occurred while setting PIN.");
      resetPinSetup();
    } finally {
      setIsLoading(false);
    }
  };

  const resetPinSetup = () => {
    setPin(["", "", "", ""]);
    setConfirmPin(["", "", "", ""]);
    setIsConfirming(false);
  };

  const handleDelete = () => {
    if (isLoading) return;
    
    setErrorMessage("");
    
    if (!isConfirming) {
      const newPin = [...pin];
      for (let i = newPin.length - 1; i >= 0; i--) {
        if (newPin[i]) {
          newPin[i] = "";
          break;
        }
      }
      setPin(newPin);
    } else {
      const newConfirmPin = [...confirmPin];
      for (let i = newConfirmPin.length - 1; i >= 0; i--) {
        if (newConfirmPin[i]) {
          newConfirmPin[i] = "";
          break;
        }
      }
      setConfirmPin(newConfirmPin);
    }
  };

  const handleBack = () => {
    if (isConfirming) {
      resetPinSetup();
    } else {
      navigation.goBack();
    }
  };

  const handleEnableBiometric = async () => {
    try {
      const success = await securityService.setBiometricEnabled(true);
      if (success) {
        Alert.alert(
          "Biometric Enabled",
          "Biometric authentication has been enabled. You can now use fingerprint or face recognition to unlock your app.",
          [
            {
              text: "OK",
              onPress: () => {
                onSetupComplete?.();
                navigation.navigate("Main");
              }
            }
          ]
        );
      } else {
        Alert.alert("Error", "Failed to enable biometric authentication");
      }
    } catch (error) {
      console.error("Error enabling biometric:", error);
      Alert.alert("Error", "Failed to enable biometric authentication");
    }
  };

  const handleSkipBiometric = () => {
    Alert.alert(
      "PIN Set Successfully",
      "Your PIN has been set. You can enable biometric authentication later in settings.",
      [
        {
          text: "OK",
          onPress: () => {
            onSetupComplete?.();
            navigation.navigate("Main");
          }
        }
      ]
    );
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
      disabled={isLoading}
    >
      {value === "delete" ? (
        <Feather name="delete" size={20} color="#666" />
      ) : (
        <Text style={[styles.keypadText, isSpecial && styles.specialText]}>
          {value}
        </Text>
      )}
    </TouchableOpacity>
  );

  const currentPin = isConfirming ? confirmPin : pin;
  const title = showBiometricOption ? "Enable Biometric?" : (isConfirming ? "Confirm PIN" : "Set PIN");
  const subtitle = showBiometricOption 
    ? "Would you like to enable biometric authentication for faster access?"
    : (isConfirming 
      ? "Enter your PIN again to confirm" 
      : "Enter a 4-digit PIN to secure your app");

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
        >
          <Feather name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* Error Message */}
        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {showBiometricOption ? (
          /* Biometric Option */
          <View style={styles.biometricContainer}>
            <View style={styles.biometricIcon}>
              <Feather name="smartphone" size={48} color="#1E88E5" />
            </View>
            <Text style={styles.biometricTitle}>Biometric Authentication</Text>
            <Text style={styles.biometricDescription}>
              Use your fingerprint or face recognition for faster and more secure access to your app.
            </Text>
            
            <View style={styles.biometricButtons}>
              <TouchableOpacity
                style={styles.biometricButton}
                onPress={handleEnableBiometric}
              >
                <Text style={styles.biometricButtonText}>Enable Biometric</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkipBiometric}
              >
                <Text style={styles.skipButtonText}>Skip for Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* PIN Setup */
          <>
            {/* PIN Dots */}
            <View style={styles.pinContainer}>
              {currentPin.map((digit, index) => (
                <View
                  key={index}
                  style={[
                    styles.pinDot,
                    digit ? styles.pinDotFilled : styles.pinDotEmpty,
                  ]}
                />
              ))}
            </View>

            {/* Progress Indicator */}
            <View style={styles.progressContainer}>
              <View style={[styles.progressDot, isConfirming && styles.progressDotActive]} />
              <View style={[styles.progressDot, isConfirming && styles.progressDotActive]} />
            </View>

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
                <View style={styles.keypadButton} />
                {renderKeypadButton("0", () => handleNumberPress("0"))}
                {renderKeypadButton("delete", handleDelete, true)}
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 40,
  },
  errorContainer: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  errorText: {
    color: "#F44336",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },
  pinContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
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
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 40,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E0E0E0",
  },
  progressDotActive: {
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
  biometricContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  biometricIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F0F8FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  biometricTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
    textAlign: "center",
  },
  biometricDescription: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  biometricButtons: {
    width: "100%",
    paddingHorizontal: 20,
  },
  biometricButton: {
    backgroundColor: "#1E88E5",
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  biometricButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  skipButton: {
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  skipButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
});

export default PinSetupScreen;
