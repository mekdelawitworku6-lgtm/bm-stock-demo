import React, { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import ErrorBoundary from './ErrorBoundary';

interface ScreenErrorBoundaryProps {
  children: ReactNode;
  screenName?: string;
}

const ScreenErrorBoundary: React.FC<ScreenErrorBoundaryProps> = ({ 
  children, 
  screenName = 'Unknown Screen' 
}) => {
  const handleError = (error: Error, errorInfo: any) => {
    console.error(`Error in ${screenName}:`, error, errorInfo);
    
    // You can add additional error reporting logic here
    // For example, send to crash reporting service
  };

  return (
    <ErrorBoundary 
      onError={handleError}
      showDetails={__DEV__} // Show error details in development
    >
      <View style={styles.container}>
        {children}
      </View>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default ScreenErrorBoundary;
