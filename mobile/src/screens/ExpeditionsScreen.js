/**
 * Expeditions List Screen
 * Shows list of expeditions with filtering and search
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../services/api';

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

// Status badge configuration
const STATUS_CONFIG = {
  draft: { label: 'Borrador', color: COLORS.gray, icon: 'document-outline' },
  pending: { label: 'Pendiente', color: COLORS.warning, icon: 'time-outline' },
  submitted: { label: 'Enviado', color: COLORS.info, icon: 'send-outline' },
  green: { label: 'Verde', color: COLORS.success, icon: 'checkmark-circle-outline' },
  yellow: { label: 'Amarillo', color: '#eab308', icon: 'alert-outline' },
  orange: { label: 'Naranja', color: '#f97316', icon: 'document-attach-outline' },
  red: { label: 'Rojo', color: COLORS.error, icon: 'search-outline' },
  completed: { label: 'Completado', color: COLORS.success, icon: 'checkmark-done-outline' },
};

// Filter Chip Component
function FilterChip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Expedition Card Component
function ExpeditionCard({ expedition, onPress }) {
  const status = STATUS_CONFIG[expedition.status] || STATUS_CONFIG.draft;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardReference}>{expedition.reference}</Text>
        <View style={[styles.statusBadge, { backgroundColor: `${status.color}15` }]}>
          <Ionicons name={status.icon} size={14} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <Text style={styles.cardClient}>{expedition.clientName}</Text>

      <View style={styles.cardDetails}>
        <View style={styles.cardDetailItem}>
          <Ionicons name="globe-outline" size={14} color={COLORS.gray} />
          <Text style={styles.cardDetailText}>
            {expedition.originCountry} → {expedition.destinationCountry}
          </Text>
        </View>
        <View style={styles.cardDetailItem}>
          <Ionicons name="cube-outline" size={14} color={COLORS.gray} />
          <Text style={styles.cardDetailText}>{expedition.goodsDescription}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.cardDate}>
          {new Date(expedition.createdAt).toLocaleDateString('es-ES')}
        </Text>
        <Text style={styles.cardValue}>
          {expedition.customsValue?.toLocaleString('es-ES', {
            style: 'currency',
            currency: 'EUR',
          })}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ExpeditionsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expeditions, setExpeditions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const filters = [
    { key: 'all', label: 'Todos' },
    { key: 'pending', label: 'Pendientes' },
    { key: 'submitted', label: 'Enviados' },
    { key: 'completed', label: 'Completados' },
  ];

  const loadExpeditions = async () => {
    try {
      // In real app, fetch from API
      // const data = await api.expeditions.list({ status: activeFilter });

      // Mock data for demo
      setExpeditions([
        {
          id: '1',
          reference: 'EXP-2024-0089',
          clientName: 'Importaciones Garcia S.L.',
          originCountry: 'CN',
          destinationCountry: 'ES',
          goodsDescription: 'Componentes electronicos',
          customsValue: 45000,
          status: 'orange',
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          reference: 'EXP-2024-0088',
          clientName: 'Tech Solutions Madrid',
          originCountry: 'US',
          destinationCountry: 'ES',
          goodsDescription: 'Servidores y equipos de red',
          customsValue: 125000,
          status: 'green',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: '3',
          reference: 'EXP-2024-0087',
          clientName: 'Textiles Barcelona',
          originCountry: 'BD',
          destinationCountry: 'ES',
          goodsDescription: 'Prendas de vestir algodon',
          customsValue: 32000,
          status: 'pending',
          createdAt: new Date(Date.now() - 172800000).toISOString(),
        },
        {
          id: '4',
          reference: 'EXP-2024-0086',
          clientName: 'Muebles Valencia S.A.',
          originCountry: 'VN',
          destinationCountry: 'ES',
          goodsDescription: 'Mobiliario de madera',
          customsValue: 78000,
          status: 'red',
          createdAt: new Date(Date.now() - 259200000).toISOString(),
        },
        {
          id: '5',
          reference: 'EXP-2024-0085',
          clientName: 'Quimicos del Norte',
          originCountry: 'DE',
          destinationCountry: 'ES',
          goodsDescription: 'Productos quimicos industriales',
          customsValue: 56000,
          status: 'completed',
          createdAt: new Date(Date.now() - 345600000).toISOString(),
        },
      ]);
    } catch (error) {
      console.error('Error loading expeditions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpeditions();
  }, [activeFilter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadExpeditions();
    setRefreshing(false);
  }, []);

  const filteredExpeditions = expeditions.filter((exp) => {
    const matchesSearch =
      exp.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.clientName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      activeFilter === 'all' ||
      (activeFilter === 'pending' && ['pending', 'draft'].includes(exp.status)) ||
      (activeFilter === 'submitted' && ['submitted', 'green', 'yellow', 'orange', 'red'].includes(exp.status)) ||
      (activeFilter === 'completed' && exp.status === 'completed');

    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar expediente..."
            placeholderTextColor={COLORS.gray}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.gray} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        {filters.map((filter) => (
          <FilterChip
            key={filter.key}
            label={filter.label}
            active={activeFilter === filter.key}
            onPress={() => setActiveFilter(filter.key)}
          />
        ))}
      </View>

      {/* Expeditions List */}
      <FlatList
        data={filteredExpeditions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ExpeditionCard
            expedition={item}
            onPress={() => navigation.navigate('ExpeditionDetail', { expedition: item })}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={64} color={COLORS.grayLight} />
            <Text style={styles.emptyText}>No hay expedientes</Text>
          </View>
        }
      />

      {/* FAB - New Expedition */}
      <TouchableOpacity style={styles.fab}>
        <Ionicons name="add" size={28} color={COLORS.white} />
      </TouchableOpacity>
    </View>
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
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: COLORS.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.grayLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: COLORS.text,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.grayLight,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: COLORS.gray,
  },
  filterChipTextActive: {
    color: COLORS.white,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardReference: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  cardClient: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 8,
  },
  cardDetails: {
    marginBottom: 8,
  },
  cardDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardDetailText: {
    fontSize: 13,
    color: COLORS.gray,
    marginLeft: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.grayLight,
    paddingTop: 8,
    marginTop: 4,
  },
  cardDate: {
    fontSize: 12,
    color: COLORS.gray,
  },
  cardValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.gray,
    marginTop: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
