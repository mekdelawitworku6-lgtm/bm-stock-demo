import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNetwork } from '../hooks/useNetwork';

interface NetworkStatusProps {
  showWhenOnline?: boolean;
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({ 
  showWhenOnline = false 
}) => {
  const { isOnline, isConnected, type } = useNetwork();

  // Don't show anything if online and showWhenOnline is false
  if (isOnline && !showWhenOnline) {
    return null;
  }

  const getStatusInfo = () => {
    if (!isConnected) {
      return {
        icon: 'wifi-off',
        text: 'No Internet Connection',
        color: '#FF4444',
        backgroundColor: '#FFEBEE',
      };
    }
    
    if (!isOnline) {
      return {
        icon: 'alert-triangle',
        text: 'Limited Connectivity',
        color: '#FF9800',
        backgroundColor: '#FFF3E0',
      };
    }
    
    if (showWhenOnline) {
      return {
        icon: 'wifi',
        text: `Connected via ${type || 'Unknown'}`,
        color: '#4CAF50',
        backgroundColor: '#E8F5E9',
      };
    }
    
    return null;
  };

  const statusInfo = getStatusInfo();
  
  if (!statusInfo) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: statusInfo.backgroundColor }]}>
      <Feather name={statusInfo.icon} size={16} color={statusInfo.color} />
      <Text style={[styles.text, { color: statusInfo.color }]}>
        {statusInfo.text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
});

export default NetworkStatus;
