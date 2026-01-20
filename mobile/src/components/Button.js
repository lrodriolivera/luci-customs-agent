import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

const Button = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  style
}) => {
  const buttonStyles = [
    styles.button,
    styles[variant],
    styles[size],
    disabled && styles.disabled,
    style
  ];

  const textStyles = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    disabled && styles.disabledText
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#FFFFFF' : '#2563EB'}
          size="small"
        />
      ) : (
        <>
          {icon}
          <Text style={textStyles}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    gap: 8
  },
  // Variants
  primary: {
    backgroundColor: '#2563EB'
  },
  secondary: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB'
  },
  success: {
    backgroundColor: '#10B981'
  },
  danger: {
    backgroundColor: '#EF4444'
  },
  warning: {
    backgroundColor: '#F59E0B'
  },
  ghost: {
    backgroundColor: 'transparent'
  },
  // Sizes
  small: {
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  medium: {
    paddingVertical: 12,
    paddingHorizontal: 20
  },
  large: {
    paddingVertical: 16,
    paddingHorizontal: 28
  },
  // Text
  text: {
    fontWeight: '600'
  },
  primaryText: {
    color: '#FFFFFF'
  },
  secondaryText: {
    color: '#374151'
  },
  successText: {
    color: '#FFFFFF'
  },
  dangerText: {
    color: '#FFFFFF'
  },
  warningText: {
    color: '#FFFFFF'
  },
  ghostText: {
    color: '#2563EB'
  },
  smallText: {
    fontSize: 12
  },
  mediumText: {
    fontSize: 14
  },
  largeText: {
    fontSize: 16
  },
  // Disabled
  disabled: {
    opacity: 0.5
  },
  disabledText: {
    opacity: 0.5
  }
});

export default Button;
