import { Feather } from '@expo/vector-icons';
import React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableOpacityProps,
    ViewStyle,
} from 'react-native';
import { COLORS } from '../constants/Colors';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle;
}

const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'medium',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  disabled,
  ...props
}) => {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      ...(fullWidth && { width: '100%' }),
    };

    // Size styles
    const sizeStyles: { [key: string]: ViewStyle } = {
      small: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        minHeight: 36,
      },
      medium: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 48,
      },
      large: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        minHeight: 56,
      },
    };

    // Variant styles
    const variantStyles: { [key: string]: ViewStyle } = {
      primary: {
        backgroundColor: COLORS.PRIMARY,
        borderWidth: 0,
      },
      secondary: {
        backgroundColor: '#6B7280',
        borderWidth: 0,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: COLORS.PRIMARY,
      },
      danger: {
        backgroundColor: '#EF4444',
        borderWidth: 0,
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...(disabled && {
        backgroundColor: '#9CA3AF',
        borderColor: '#9CA3AF',
      }),
    };
  };

  const getTextStyle = (): any => {
    const baseStyle = {
      fontWeight: '600',
      textAlign: 'center' as const,
    };

    const sizeStyles: { [key: string]: any } = {
      small: { fontSize: 14 },
      medium: { fontSize: 16 },
      large: { fontSize: 18 },
    };

    const variantStyles: { [key: string]: any } = {
      primary: { color: 'white' },
      secondary: { color: 'white' },
      outline: { color: COLORS.PRIMARY },
      danger: { color: 'white' },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...(disabled && { color: 'white' }),
    };
  };

  const renderIcon = () => {
    if (!icon || loading) return null;

    const iconSize = size === 'small' ? 16 : size === 'large' ? 20 : 18;
    const iconColor = variant === 'outline' ? COLORS.PRIMARY : 'white';

    return (
      <Feather
        name={icon}
        size={iconSize}
        color={iconColor}
        style={[
          iconPosition === 'left' ? styles.iconLeft : styles.iconRight,
          { marginLeft: iconPosition === 'right' ? 8 : 0 },
          { marginRight: iconPosition === 'left' ? 8 : 0 },
        ]}
      />
    );
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' ? COLORS.PRIMARY : 'white'}
        />
      ) : (
        <>
          {iconPosition === 'left' && renderIcon()}
          <Text style={getTextStyle()}>{title}</Text>
          {iconPosition === 'right' && renderIcon()}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});

export default Button;
