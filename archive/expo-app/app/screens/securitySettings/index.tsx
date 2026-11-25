import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SecurityService from '../../../lib/securityService';

interface SecuritySettingsScreenProps {
  navigation: any;
}

const SecuritySettingsScreen: React.FC<SecuritySettingsScreenProps> = ({ navigation }) => {
  const [settings, setSettings] = useState({
    pinEnabled: false,
    biometricEnabled: false,
    sessionTimeout: 30,
  });
  const [biometricInfo, setBiometricInfo] = useState({
    isAvailable: false,
    hasHardware: false,
    supportedTypes: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  const securityService = SecurityService.getInstance();

  useEffect(() => {
    loadSecuritySettings();
  }, []);

  const loadSecuritySettings = async () => {
    try {
      setIsLoading(true);
      const [securitySettings, biometricData] = await Promise.all([
        securityService.getSecuritySettings(),
        securityService.getBiometricInfo(),
      ]);

      setSettings({
        pinEnabled: securitySettings.pinEnabled,
        biometricEnabled: securitySettings.biometricEnabled,
        sessionTimeout: securitySettings.sessionTimeout,
      });

      setBiometricInfo(biometricData);
    } catch (error) {
      console.error('Error loading security settings:', error);
      Alert.alert('Error', 'Failed to load security settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinToggle = async (enabled: boolean) => {
    if (enabled) {
      // Show PIN setup screen
      navigation.navigate('PinSetup', {
        onSetupComplete: () => {
          setSettings(prev => ({ ...prev, pinEnabled: true }));
        }
      });
    } else {
      Alert.alert(
        'Disable PIN',
        'Are you sure you want to disable PIN security? This will make your app less secure.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              const success = await securityService.clearPin();
              if (success) {
                setSettings(prev => ({ ...prev, pinEnabled: false }));
                Alert.alert('Success', 'PIN has been disabled');
              } else {
                Alert.alert('Error', 'Failed to disable PIN');
              }
            }
          }
        ]
      );
    }
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    if (enabled && !biometricInfo.isAvailable) {
      Alert.alert(
        'Biometric Not Available',
        'Biometric authentication is not available on this device or not set up.',
        [{ text: 'OK' }]
      );
      return;
    }

    const success = await securityService.setBiometricEnabled(enabled);
    if (success) {
      setSettings(prev => ({ ...prev, biometricEnabled: enabled }));
      Alert.alert(
        'Success',
        enabled ? 'Biometric authentication enabled' : 'Biometric authentication disabled'
      );
    } else {
      Alert.alert('Error', 'Failed to update biometric settings');
    }
  };

  const handleSessionTimeoutChange = (timeout: number) => {
    Alert.alert(
      'Session Timeout',
      'Select session timeout duration',
      [
        { text: '15 minutes', onPress: () => updateSessionTimeout(15) },
        { text: '30 minutes', onPress: () => updateSessionTimeout(30) },
        { text: '1 hour', onPress: () => updateSessionTimeout(60) },
        { text: '2 hours', onPress: () => updateSessionTimeout(120) },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const updateSessionTimeout = async (timeout: number) => {
    const success = await securityService.setSessionTimeout(timeout);
    if (success) {
      setSettings(prev => ({ ...prev, sessionTimeout: timeout }));
    } else {
      Alert.alert('Error', 'Failed to update session timeout');
    }
  };

  const handleChangePin = () => {
    if (!settings.pinEnabled) {
      Alert.alert('Error', 'PIN is not enabled');
      return;
    }

    navigation.navigate('ChangePin', {
      onPinChanged: () => {
        Alert.alert('Success', 'PIN has been changed successfully');
      }
    });
  };

  const formatSessionTimeout = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} minutes`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}`;
      } else {
        return `${hours}h ${remainingMinutes}m`;
      }
    }
  };

  const SettingItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    rightComponent 
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightComponent?: React.ReactNode;
  }) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingLeft}>
        <Feather name={icon as any} size={20} color="#666" style={styles.settingIcon} />
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightComponent || (onPress && <Feather name="chevron-right" size={20} color="#ccc" />)}
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading security settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Security Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* PIN Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PIN Security</Text>
          
          <SettingItem
            icon="lock"
            title="Enable PIN"
            subtitle="Secure your app with a 4-digit PIN"
            rightComponent={
              <Switch
                value={settings.pinEnabled}
                onValueChange={handlePinToggle}
                trackColor={{ false: "#E0E0E0", true: "#1E88E5" }}
                thumbColor={settings.pinEnabled ? "#fff" : "#f4f3f4"}
              />
            }
          />

          {settings.pinEnabled && (
            <SettingItem
              icon="key"
              title="Change PIN"
              subtitle="Update your current PIN"
              onPress={handleChangePin}
            />
          )}
        </View>

        {/* Biometric Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Biometric Security</Text>
          
          <SettingItem
            icon="smartphone"
            title="Enable Biometric"
            subtitle={
              biometricInfo.isAvailable 
                ? "Use fingerprint or face recognition" 
                : "Biometric authentication not available"
            }
            rightComponent={
              <Switch
                value={settings.biometricEnabled}
                onValueChange={handleBiometricToggle}
                disabled={!biometricInfo.isAvailable}
                trackColor={{ false: "#E0E0E0", true: "#1E88E5" }}
                thumbColor={settings.biometricEnabled ? "#fff" : "#f4f3f4"}
              />
            }
          />

          {biometricInfo.isAvailable && (
            <View style={styles.biometricInfo}>
              <Text style={styles.biometricInfoText}>
                Supported: {biometricInfo.supportedTypes.map(type => {
                  switch (type) {
                    case 1: return 'Fingerprint';
                    case 2: return 'Face ID';
                    case 3: return 'Iris';
                    default: return 'Biometric';
                  }
                }).join(', ')}
              </Text>
            </View>
          )}
        </View>

        {/* Session Management Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session Management</Text>
          
          <SettingItem
            icon="clock"
            title="Session Timeout"
            subtitle={`Auto-lock after ${formatSessionTimeout(settings.sessionTimeout)}`}
            onPress={() => handleSessionTimeoutChange(settings.sessionTimeout)}
          />
        </View>

        {/* Security Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security Information</Text>
          
          <View style={styles.infoItem}>
            <Feather name="shield" size={20} color="#4CAF50" style={styles.infoIcon} />
            <Text style={styles.infoText}>
              Your PIN is encrypted and stored securely on your device
            </Text>
          </View>
          
          <View style={styles.infoItem}>
            <Feather name="lock" size={20} color="#4CAF50" style={styles.infoIcon} />
            <Text style={styles.infoText}>
              Biometric data never leaves your device
            </Text>
          </View>
          
          <View style={styles.infoItem}>
            <Feather name="clock" size={20} color="#4CAF50" style={styles.infoIcon} />
            <Text style={styles.infoText}>
              Session timeout helps protect your data when the app is idle
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 40,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    backgroundColor: 'white',
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
    width: 20,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  biometricInfo: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  biometricInfoText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default SecuritySettingsScreen;
