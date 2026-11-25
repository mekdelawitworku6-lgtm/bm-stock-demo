import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Alert,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    Vibration,
    View,
} from 'react-native';
import SecurityService from '../../../lib/securityService';

interface ChangePinScreenProps {
  navigation: any;
  onPinChanged?: () => void;
}

const ChangePinScreen: React.FC<ChangePinScreenProps> = ({ navigation, onPinChanged }) => {
  const [currentPin, setCurrentPin] = useState<string[]>(["", "", "", ""]);
  const [newPin, setNewPin] = useState<string[]>(["", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState<string[]>(["", "", "", ""]);
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>('current');
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const securityService = SecurityService.getInstance();

  const handleNumberPress = (number: string) => {
    if (isLoading) return;
    
    setErrorMessage("");
    
    if (step === 'current') {
      const newCurrentPin = [...currentPin];
      for (let i = 0; i < newCurrentPin.length; i++) {
        if (!newCurrentPin[i]) {
          newCurrentPin[i] = number;
          break;
        }
      }
      setCurrentPin(newCurrentPin);

      if (newCurrentPin.every((digit) => digit !== "")) {
        verifyCurrentPin(newCurrentPin);
      }
    } else if (step === 'new') {
      const newPinArray = [...newPin];
      for (let i = 0; i < newPinArray.length; i++) {
        if (!newPinArray[i]) {
          newPinArray[i] = number;
          break;
        }
      }
      setNewPin(newPinArray);

      if (newPinArray.every((digit) => digit !== "")) {
        setStep('confirm');
      }
    } else if (step === 'confirm') {
      const newConfirmPin = [...confirmPin];
      for (let i = 0; i < newConfirmPin.length; i++) {
        if (!newConfirmPin[i]) {
          newConfirmPin[i] = number;
          break;
        }
      }
      setConfirmPin(newConfirmPin);

      if (newConfirmPin.every((digit) => digit !== "")) {
        handlePinConfirmation(newPin, newConfirmPin);
      }
    }
  };

  const verifyCurrentPin = async (enteredPin: string[]) => {
    setIsLoading(true);
    try {
      const pinString = enteredPin.join("");
      const isValid = await securityService.verifyPin(pinString);
      
      if (isValid) {
        setStep('new');
        setCurrentPin(["", "", "", ""]);
      } else {
        setErrorMessage("Incorrect current PIN. Please try again.");
        Vibration.vibrate(200);
        setCurrentPin(["", "", "", ""]);
      }
    } catch (error) {
      console.error("PIN verification error:", error);
      setErrorMessage("An error occurred. Please try again.");
      setCurrentPin(["", "", "", ""]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinConfirmation = async (firstPin: string[], secondPin: string[]) => {
    const firstPinString = firstPin.join("");
    const secondPinString = secondPin.join("");
    
    if (firstPinString !== secondPinString) {
      setErrorMessage("PINs do not match. Please try again.");
      Vibration.vibrate(200);
      resetNewPinSetup();
      return;
    }

    setIsLoading(true);
    try {
      const success = await securityService.setPin(firstPinString);
      if (success) {
        Alert.alert(
          "PIN Changed Successfully",
          "Your PIN has been updated successfully.",
          [
            {
              text: "OK",
              onPress: () => {
                onPinChanged?.();
                navigation.goBack();
              }
            }
          ]
        );
      } else {
        setErrorMessage("Failed to update PIN. Please try again.");
        resetNewPinSetup();
      }
    } catch (error) {
      console.error("PIN update error:", error);
      setErrorMessage("An error occurred while updating PIN.");
      resetNewPinSetup();
    } finally {
      setIsLoading(false);
    }
  };

  const resetNewPinSetup = () => {
    setNewPin(["", "", "", ""]);
    setConfirmPin(["", "", "", ""]);
    setStep('new');
  };

  const handleDelete = () => {
    if (isLoading) return;
    
    setErrorMessage("");
    
    if (step === 'current') {
      const newCurrentPin = [...currentPin];
      for (let i = newCurrentPin.length - 1; i >= 0; i--) {
        if (newCurrentPin[i]) {
          newCurrentPin[i] = "";
          break;
        }
      }
      setCurrentPin(newCurrentPin);
    } else if (step === 'new') {
      const newPinArray = [...newPin];
      for (let i = newPinArray.length - 1; i >= 0; i--) {
        if (newPinArray[i]) {
          newPinArray[i] = "";
          break;
        }
      }
      setNewPin(newPinArray);
    } else if (step === 'confirm') {
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
    if (step === 'new') {
      setStep('current');
      setCurrentPin(["", "", "", ""]);
    } else if (step === 'confirm') {
      setStep('new');
      setNewPin(["", "", "", ""]);
      setConfirmPin(["", "", "", ""]);
    } else {
      navigation.goBack();
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

  const getTitle = () => {
    switch (step) {
      case 'current': return 'Enter Current PIN';
      case 'new': return 'Enter New PIN';
      case 'confirm': return 'Confirm New PIN';
      default: return 'Change PIN';
    }
  };

  const getSubtitle = () => {
    switch (step) {
      case 'current': return 'Enter your current PIN to continue';
      case 'new': return 'Enter a new 4-digit PIN';
      case 'confirm': return 'Enter your new PIN again to confirm';
      default: return '';
    }
  };

  const getCurrentPinArray = () => {
    switch (step) {
      case 'current': return currentPin;
      case 'new': return newPin;
      case 'confirm': return confirmPin;
      default: return [];
    }
  };

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
        <Text style={styles.headerTitle}>{getTitle()}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.subtitle}>{getSubtitle()}</Text>

        {/* Error Message */}
        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Verifying...</Text>
          </View>
        )}

        {/* PIN Dots */}
        <View style={styles.pinContainer}>
          {getCurrentPinArray().map((digit, index) => (
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
          <View style={[styles.progressDot, step !== 'current' && styles.progressDotActive]} />
          <View style={[styles.progressDot, step === 'confirm' && styles.progressDotActive]} />
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
  loadingContainer: {
    marginBottom: 20,
  },
  loadingText: {
    color: "#666",
    fontSize: 14,
    textAlign: "center",
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
});

export default ChangePinScreen;
