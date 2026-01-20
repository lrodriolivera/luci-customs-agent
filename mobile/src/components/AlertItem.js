import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AlertItem = ({ alert, onPress, onDismiss }) => {
  const {
    type = 'info',
    title,
    message,
    timestamp,
    read = false,
    expeditionRef
  } = alert;

  const typeConfig = {
    info: {
      icon: 'information-circle',
      color: '#2563EB',
      bgColor: '#DBEAFE'
    },
    success: {
      icon: 'checkmark-circle',
      color: '#059669',
      bgColor: '#D1FAE5'
    },
    warning: {
      icon: 'warning',
      color: '#D97706',
      bgColor: '#FEF3C7'
    },
    error: {
      icon: 'alert-circle',
      color: '#DC2626',
      bgColor: '#FEE2E2'
    },
    deadline: {
      icon: 'time',
      color: '#7C3AED',
      bgColor: '#EDE9FE'
    },
    channel: {
      icon: 'git-branch',
      color: '#0891B2',
      bgColor: '#CFFAFE'
    },
    document: {
      icon: 'document-text',
      color: '#059669',
      bgColor: '#D1FAE5'
    }
  };

  const config = typeConfig[type] || typeConfig.info;

  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Ahora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  return (
    <TouchableOpacity
      style={[styles.container, !read && styles.unread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: config.bgColor }]}>
        <Ionicons name={config.icon} size={24} color={config.color} />
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, !read && styles.unreadTitle]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.time}>{formatTime(timestamp)}</Text>
        </View>

        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>

        {expeditionRef && (
          <View style={styles.expeditionRef}>
            <Ionicons name="folder-outline" size={12} color="#6B7280" />
            <Text style={styles.expeditionRefText}>{expeditionRef}</Text>
          </View>
        )}
      </View>

      {onDismiss && (
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
        >
          <Ionicons name="close" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

// Empty state for notifications
export const EmptyAlerts = () => {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>Sin notificaciones</Text>
      <Text style={styles.emptyText}>
        No tienes notificaciones pendientes
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  unread: {
    backgroundColor: '#F8FAFC'
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  content: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  title: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    marginRight: 8
  },
  unreadTitle: {
    fontWeight: '600',
    color: '#111827'
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF'
  },
  message: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18
  },
  expeditionRef: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4
  },
  expeditionRefText: {
    fontSize: 12,
    color: '#6B7280'
  },
  dismissButton: {
    padding: 8,
    marginLeft: 8,
    marginRight: -8
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8
  }
});

export default AlertItem;
