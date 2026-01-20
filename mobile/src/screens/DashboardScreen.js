/**
 * Dashboard Screen
 * Main home screen with KPIs and quick actions
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const COLORS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
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

// Stat Card Component
function StatCard({ title, value, icon, color, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.statCard, { borderLeftColor: color }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.statIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Quick Action Button
function QuickAction({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// Alert Item
function AlertItem({ type, message, time }) {
  const getAlertStyle = () => {
    switch (type) {
      case 'urgent':
        return { color: COLORS.error, icon: 'alert-circle', bg: '#fef2f2' };
      case 'warning':
        return { color: COLORS.warning, icon: 'warning', bg: '#fffbeb' };
      case 'info':
        return { color: COLORS.info, icon: 'information-circle', bg: '#eff6ff' };
      default:
        return { color: COLORS.gray, icon: 'ellipse', bg: COLORS.grayLight };
    }
  };

  const style = getAlertStyle();

  return (
    <View style={[styles.alertItem, { backgroundColor: style.bg }]}>
      <Ionicons name={style.icon} size={20} color={style.color} />
      <View style={styles.alertContent}>
        <Text style={styles.alertMessage}>{message}</Text>
        <Text style={styles.alertTime}>{time}</Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    pendingExpeditions: 0,
    activeDeclarations: 0,
    pendingRequirements: 0,
    upcomingDeadlines: 0,
  });
  const [alerts, setAlerts] = useState([]);

  const loadDashboard = async () => {
    try {
      // In real app, fetch from API
      // const data = await api.analytics.getDashboard();

      // Mock data for demo
      setStats({
        pendingExpeditions: 12,
        activeDeclarations: 8,
        pendingRequirements: 3,
        upcomingDeadlines: 5,
      });

      setAlerts([
        { type: 'urgent', message: 'Requerimiento AEAT pendiente - EXP-2024-0089', time: 'Hace 2h' },
        { type: 'warning', message: 'Plazo de garantia proximo a vencer', time: 'Hace 4h' },
        { type: 'info', message: 'Nueva declaracion H1 generada', time: 'Hace 6h' },
      ]);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola, {user?.name || 'Usuario'}</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => navigation.navigate('Perfil', { screen: 'Notifications' })}
        >
          <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>3</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          title="Expedientes Pendientes"
          value={stats.pendingExpeditions}
          icon="folder-outline"
          color={COLORS.primary}
          onPress={() => navigation.navigate('Expedientes')}
        />
        <StatCard
          title="Declaraciones Activas"
          value={stats.activeDeclarations}
          icon="document-text-outline"
          color={COLORS.success}
        />
        <StatCard
          title="Requerimientos"
          value={stats.pendingRequirements}
          icon="alert-circle-outline"
          color={COLORS.warning}
        />
        <StatCard
          title="Plazos Proximos"
          value={stats.upcomingDeadlines}
          icon="time-outline"
          color={COLORS.error}
        />
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acciones Rapidas</Text>
        <View style={styles.quickActionsGrid}>
          <QuickAction
            icon="scan-outline"
            label="Escanear"
            color={COLORS.primary}
            onPress={() => navigation.navigate('Escanear')}
          />
          <QuickAction
            icon="add-circle-outline"
            label="Nuevo Exp."
            color={COLORS.success}
            onPress={() => navigation.navigate('Expedientes')}
          />
          <QuickAction
            icon="chatbubble-outline"
            label="Chat LUCI"
            color={COLORS.info}
            onPress={() => navigation.navigate('Chat')}
          />
          <QuickAction
            icon="search-outline"
            label="Clasificar"
            color={COLORS.warning}
            onPress={() => {}}
          />
        </View>
      </View>

      {/* Recent Alerts */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Alertas Recientes</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>Ver todas</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.alertsList}>
          {alerts.map((alert, index) => (
            <AlertItem key={index} {...alert} />
          ))}
        </View>
      </View>

      {/* Channel Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Circuitos Hoy</Text>
        <View style={styles.channelSummary}>
          <View style={styles.channelItem}>
            <View style={[styles.channelDot, { backgroundColor: COLORS.success }]} />
            <Text style={styles.channelLabel}>Verde</Text>
            <Text style={styles.channelValue}>15</Text>
          </View>
          <View style={styles.channelItem}>
            <View style={[styles.channelDot, { backgroundColor: COLORS.warning }]} />
            <Text style={styles.channelLabel}>Amarillo</Text>
            <Text style={styles.channelValue}>3</Text>
          </View>
          <View style={styles.channelItem}>
            <View style={[styles.channelDot, { backgroundColor: '#f97316' }]} />
            <Text style={styles.channelLabel}>Naranja</Text>
            <Text style={styles.channelValue}>2</Text>
          </View>
          <View style={styles.channelItem}>
            <View style={[styles.channelDot, { backgroundColor: COLORS.error }]} />
            <Text style={styles.channelLabel}>Rojo</Text>
            <Text style={styles.channelValue}>0</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.white,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  date: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  statCard: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    margin: '1%',
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statTitle: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    color: COLORS.primary,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAction: {
    alignItems: 'center',
    width: '23%',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    color: COLORS.text,
    textAlign: 'center',
  },
  alertsList: {
    gap: 8,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  alertContent: {
    flex: 1,
    marginLeft: 12,
  },
  alertMessage: {
    fontSize: 14,
    color: COLORS.text,
  },
  alertTime: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  channelSummary: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  channelItem: {
    flex: 1,
    alignItems: 'center',
  },
  channelDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  channelLabel: {
    fontSize: 12,
    color: COLORS.gray,
  },
  channelValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 2,
  },
});
