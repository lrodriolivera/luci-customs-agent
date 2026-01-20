import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const Badge = ({ label, variant = 'default', size = 'medium', icon }) => {
  return (
    <View style={[styles.badge, styles[variant], styles[size]]}>
      {icon}
      <Text style={[styles.text, styles[`${variant}Text`], styles[`${size}Text`]]}>
        {label}
      </Text>
    </View>
  );
};

// Specialized status badge component
export const StatusBadge = ({ status }) => {
  const statusConfig = {
    // Expedition statuses
    draft: { label: 'Borrador', variant: 'default' },
    pending_documents: { label: 'Pendiente Docs', variant: 'warning' },
    documents_complete: { label: 'Docs Completos', variant: 'info' },
    in_process: { label: 'En Proceso', variant: 'primary' },
    submitted: { label: 'Presentado', variant: 'info' },
    green_channel: { label: 'Canal Verde', variant: 'success' },
    orange_channel: { label: 'Canal Naranja', variant: 'warning' },
    red_channel: { label: 'Canal Rojo', variant: 'danger' },
    released: { label: 'Levante', variant: 'success' },
    completed: { label: 'Completado', variant: 'success' },
    cancelled: { label: 'Cancelado', variant: 'default' },
    // General
    active: { label: 'Activo', variant: 'success' },
    inactive: { label: 'Inactivo', variant: 'default' },
    urgent: { label: 'Urgente', variant: 'danger' },
    new: { label: 'Nuevo', variant: 'primary' }
  };

  const config = statusConfig[status] || { label: status, variant: 'default' };

  return <Badge label={config.label} variant={config.variant} />;
};

// Channel badge
export const ChannelBadge = ({ channel }) => {
  const channelConfig = {
    green: { label: 'Verde', variant: 'success' },
    orange: { label: 'Naranja', variant: 'warning' },
    red: { label: 'Rojo', variant: 'danger' },
    yellow: { label: 'Amarillo', variant: 'warning' }
  };

  const config = channelConfig[channel] || { label: channel, variant: 'default' };

  return <Badge label={config.label} variant={config.variant} />;
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    gap: 4
  },
  // Variants
  default: {
    backgroundColor: '#F3F4F6'
  },
  primary: {
    backgroundColor: '#DBEAFE'
  },
  success: {
    backgroundColor: '#D1FAE5'
  },
  warning: {
    backgroundColor: '#FEF3C7'
  },
  danger: {
    backgroundColor: '#FEE2E2'
  },
  info: {
    backgroundColor: '#E0E7FF'
  },
  // Sizes
  small: {
    paddingVertical: 2,
    paddingHorizontal: 6
  },
  medium: {
    paddingVertical: 4,
    paddingHorizontal: 10
  },
  large: {
    paddingVertical: 6,
    paddingHorizontal: 14
  },
  // Text
  text: {
    fontWeight: '500'
  },
  defaultText: {
    color: '#6B7280'
  },
  primaryText: {
    color: '#2563EB'
  },
  successText: {
    color: '#059669'
  },
  warningText: {
    color: '#D97706'
  },
  dangerText: {
    color: '#DC2626'
  },
  infoText: {
    color: '#4F46E5'
  },
  smallText: {
    fontSize: 10
  },
  mediumText: {
    fontSize: 12
  },
  largeText: {
    fontSize: 14
  }
});

export default Badge;
