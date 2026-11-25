import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export interface SecuritySettings {
  pinEnabled: boolean;
  biometricEnabled: boolean;
  pin: string | null;
  sessionTimeout: number; // in minutes
  lastUnlockTime: number;
}

export interface BiometricInfo {
  isAvailable: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
  hasHardware: boolean;
}

class SecurityService {
  private static instance: SecurityService;
  private readonly PIN_KEY = 'user_pin';
  private readonly BIOMETRIC_KEY = 'biometric_enabled';
  private readonly SESSION_TIMEOUT_KEY = 'session_timeout';
  private readonly LAST_UNLOCK_KEY = 'last_unlock_time';

  private constructor() {}

  static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  // PIN Management
  async setPin(pin: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(this.PIN_KEY, pin);
      return true;
    } catch (error) {
      console.error('Error setting PIN:', error);
      return false;
    }
  }

  async getPin(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(this.PIN_KEY);
    } catch (error) {
      console.error('Error getting PIN:', error);
      return null;
    }
  }

  async verifyPin(enteredPin: string): Promise<boolean> {
    try {
      const storedPin = await this.getPin();
      return storedPin === enteredPin;
    } catch (error) {
      console.error('Error verifying PIN:', error);
      return false;
    }
  }

  async clearPin(): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(this.PIN_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing PIN:', error);
      return false;
    }
  }

  // Biometric Management
  async getBiometricInfo(): Promise<BiometricInfo> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isAvailable = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      return {
        isAvailable: hasHardware && isAvailable,
        supportedTypes,
        hasHardware,
      };
    } catch (error) {
      console.error('Error getting biometric info:', error);
      return {
        isAvailable: false,
        supportedTypes: [],
        hasHardware: false,
      };
    }
  }

  async authenticateWithBiometric(): Promise<boolean> {
    try {
      const biometricInfo = await this.getBiometricInfo();
      if (!biometricInfo.isAvailable) {
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access the app',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
      });

      return result.success;
    } catch (error) {
      console.error('Error with biometric authentication:', error);
      return false;
    }
  }

  async setBiometricEnabled(enabled: boolean): Promise<boolean> {
    try {
      await AsyncStorage.setItem(this.BIOMETRIC_KEY, enabled.toString());
      return true;
    } catch (error) {
      console.error('Error setting biometric preference:', error);
      return false;
    }
  }

  async isBiometricEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(this.BIOMETRIC_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error getting biometric preference:', error);
      return false;
    }
  }

  // Session Management
  async setSessionTimeout(minutes: number): Promise<boolean> {
    try {
      await AsyncStorage.setItem(this.SESSION_TIMEOUT_KEY, minutes.toString());
      return true;
    } catch (error) {
      console.error('Error setting session timeout:', error);
      return false;
    }
  }

  async getSessionTimeout(): Promise<number> {
    try {
      const timeout = await AsyncStorage.getItem(this.SESSION_TIMEOUT_KEY);
      return timeout ? parseInt(timeout, 10) : 30; // Default 30 minutes
    } catch (error) {
      console.error('Error getting session timeout:', error);
      return 30;
    }
  }

  async updateLastUnlockTime(): Promise<void> {
    try {
      const currentTime = Date.now();
      await AsyncStorage.setItem(this.LAST_UNLOCK_KEY, currentTime.toString());
    } catch (error) {
      console.error('Error updating last unlock time:', error);
    }
  }

  async getLastUnlockTime(): Promise<number> {
    try {
      const lastUnlock = await AsyncStorage.getItem(this.LAST_UNLOCK_KEY);
      return lastUnlock ? parseInt(lastUnlock, 10) : 0;
    } catch (error) {
      console.error('Error getting last unlock time:', error);
      return 0;
    }
  }

  async isSessionValid(): Promise<boolean> {
    try {
      const lastUnlock = await this.getLastUnlockTime();
      const sessionTimeout = await this.getSessionTimeout();
      const currentTime = Date.now();
      const timeoutMs = sessionTimeout * 60 * 1000; // Convert minutes to milliseconds

      return (currentTime - lastUnlock) < timeoutMs;
    } catch (error) {
      console.error('Error checking session validity:', error);
      return false;
    }
  }

  // Security Settings
  async getSecuritySettings(): Promise<SecuritySettings> {
    try {
      const pin = await this.getPin();
      const biometricEnabled = await this.isBiometricEnabled();
      const sessionTimeout = await this.getSessionTimeout();
      const lastUnlockTime = await this.getLastUnlockTime();

      return {
        pinEnabled: !!pin,
        biometricEnabled,
        pin,
        sessionTimeout,
        lastUnlockTime,
      };
    } catch (error) {
      console.error('Error getting security settings:', error);
      return {
        pinEnabled: false,
        biometricEnabled: false,
        pin: null,
        sessionTimeout: 30,
        lastUnlockTime: 0,
      };
    }
  }

  // Authentication Methods
  async authenticate(): Promise<{ success: boolean; method: 'pin' | 'biometric' | 'none' }> {
    try {
      const settings = await this.getSecuritySettings();
      
      // Check if session is still valid
      if (await this.isSessionValid()) {
        return { success: true, method: 'none' };
      }

      // Try biometric first if enabled
      if (settings.biometricEnabled) {
        const biometricInfo = await this.getBiometricInfo();
        if (biometricInfo.isAvailable) {
          const biometricSuccess = await this.authenticateWithBiometric();
          if (biometricSuccess) {
            await this.updateLastUnlockTime();
            return { success: true, method: 'biometric' };
          }
        }
      }

      // Fall back to PIN if available
      if (settings.pinEnabled) {
        return { success: false, method: 'pin' }; // PIN verification should be handled by UI
      }

      return { success: false, method: 'none' };
    } catch (error) {
      console.error('Error during authentication:', error);
      return { success: false, method: 'none' };
    }
  }

  async verifyPinAndUpdateSession(pin: string): Promise<boolean> {
    try {
      const isValid = await this.verifyPin(pin);
      if (isValid) {
        await this.updateLastUnlockTime();
      }
      return isValid;
    } catch (error) {
      console.error('Error verifying PIN and updating session:', error);
      return false;
    }
  }

  // Clear all security data
  async clearAllSecurityData(): Promise<boolean> {
    try {
      await this.clearPin();
      await AsyncStorage.removeItem(this.BIOMETRIC_KEY);
      await AsyncStorage.removeItem(this.SESSION_TIMEOUT_KEY);
      await AsyncStorage.removeItem(this.LAST_UNLOCK_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing security data:', error);
      return false;
    }
  }
}

export default SecurityService;
