/**
 * Notifications Screen
 * Shows push notifications and alerts
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  primary: '#6366f1',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  white: '#ffffff',
  gray: '#64748b',
  grayLight: '#f1f5f9',
  text: '#1e293b',
  background: '#f8fafc',
};

// Notification types configuration
const NOTIFICATION_TYPES = {
  requirement: { icon: 'document-text', color: COLORS.warning },
  channel: { icon: 'git-branch', color: COLORS.info },
  deadline: { icon: 'time', color: COLORS.error },
  completed: { icon: 'checkmark-circle', color: COLORS.success },
  message: { icon: 'chatbubble', color: COLORS.primary },
};

// Mock notifications
const MOCK_NOTIFICATIONS = [
  {
    id: '1',
    type: 'requirement',
    title: 'Nuevo requerimiento AEAT',
    message: 'Se ha recibido un requerimiento documental para el expediente EXP-2024-0089',
    time: 'Hace 2 horas',
    read: false,
  },
  {
    id: '2',
    type: 'channel',
    title: 'Canal asignado',
    message: 'El expediente EXP-2024-0088 ha sido asignado a Canal Verde',
    time: 'Hace 4 horas',
    read: false,
  },
  {
    id: '3',
    type: 'deadline',
    title: 'Plazo proximo a vencer',
    message: 'La garantia del expediente EXP-2024-0085 vence en 3 dias',
    time: 'Hace 6 horas',
    read: true,
  },
  {
    id: '4',
    type: 'completed',
    title: 'Expediente completado',
    message: 'El expediente EXP-2024-0084 ha sido despachado correctamente',
    time: 'Ayer',
    read: true,
  },
  {
    id: '5',
    type: 'message',
    title: 'Mensaje de cliente',
    message: 'Importaciones Garcia S.L. ha enviado documentacion adicional',
    time: 'Ayer',
    read: true,
  },
];

// Notification Item Component
function NotificationItem({ notification, onPress }) {
  const config = NOTIFICATION_TYPES[notification.type] || NOTIFICATION_TYPES.message;

  return (
    <TouchableOpacity
      style={[styles.notificationItem, !notification.read && styles.notificationUnread]}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${config.color}15` }]}>
        <Ionicons name={config.icon} size={22} color={config.color} />
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, !notification.read && styles.titleUnread]}>
            {notification.title}
          </Text>
          {!notification.read && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.message} numberOfLines={2}>
          {notification.message}
        </Text>
        <Text style={styles.time}>{notification.time}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // In real app, fetch notifications from API
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={styles.container}>
      {/* Header Actions */}
      {unreadCount > 0 && (
        <View style={styles.headerActions}>
          <Text style={styles.unreadText}>{unreadCount} sin leer</Text>
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.markAllText}>Marcar todas como leidas</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notifications List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationItem
            notification={item}
            onPress={() => markAsRead(item.id)}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color={COLORS.grayLight} />
            <Text style={styles.emptyText}>No hay notificaciones</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  unreadText: {
    fontSize: 14,
    color: COLORS.gray,
  },
  markAllText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  notificationUnread: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
    flex: 1,
  },
  titleUnread: {
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginLeft: 8,
  },
  message: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
    marginBottom: 6,
  },
  time: {
    fontSize: 12,
    color: COLORS.gray,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.gray,
    marginTop: 16,
  },
});
