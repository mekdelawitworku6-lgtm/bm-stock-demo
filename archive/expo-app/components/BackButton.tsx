import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { useAppNavigation } from '../hooks/useNavigation';

interface BackButtonProps {
  onPress?: () => void;
  style?: ViewStyle;
  color?: string;
  size?: number;
  showExitConfirmation?: boolean;
}

const BackButton: React.FC<BackButtonProps> = ({
  onPress,
  style,
  color = '#000',
  size = 24,
  showExitConfirmation = false,
}) => {
  const { goBack } = useAppNavigation({ showExitConfirmation });

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      goBack();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={handlePress}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Feather name="arrow-left" size={size} color={color} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 4,
    marginRight: 8,
  },
});

export default BackButton;
