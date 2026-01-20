import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import { StatusBadge, ChannelBadge } from './Badge';

const ExpeditionCard = ({ expedition, onPress }) => {
  const {
    reference,
    type,
    status,
    channel,
    client,
    originCountry,
    destinationCountry,
    customsValue,
    currency = 'EUR',
    mrn,
    createdAt,
    deadline
  } = expedition;

  const isImport = type === 'import';
  const isUrgent = deadline && new Date(deadline) < new Date(Date.now() + 24 * 60 * 60 * 1000);

  return (
    <Card onPress={onPress} variant="default">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.referenceRow}>
            <Ionicons
              name={isImport ? 'arrow-down-circle' : 'arrow-up-circle'}
              size={20}
              color={isImport ? '#2563EB' : '#10B981'}
            />
            <Text style={styles.reference}>{reference}</Text>
          </View>
          {mrn && <Text style={styles.mrn}>MRN: {mrn}</Text>}
        </View>
        <View style={styles.badges}>
          <StatusBadge status={status} />
          {channel && <ChannelBadge channel={channel} />}
        </View>
      </View>

      {/* Client */}
      <View style={styles.section}>
        <Ionicons name="business-outline" size={16} color="#6B7280" />
        <Text style={styles.client} numberOfLines={1}>{client?.name || 'Sin cliente'}</Text>
      </View>

      {/* Route */}
      <View style={styles.section}>
        <Ionicons name="location-outline" size={16} color="#6B7280" />
        <Text style={styles.route}>
          {originCountry} <Ionicons name="arrow-forward" size={12} color="#9CA3AF" /> {destinationCountry || 'ES'}
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.value}>
          <Text style={styles.valueLabel}>Valor</Text>
          <Text style={styles.valueAmount}>
            {customsValue?.toLocaleString('es-ES')} {currency}
          </Text>
        </View>
        <View style={styles.dateSection}>
          {isUrgent && (
            <View style={styles.urgentBadge}>
              <Ionicons name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.urgentText}>Urgente</Text>
            </View>
          )}
          {deadline && (
            <Text style={styles.deadline}>
              {new Date(deadline).toLocaleDateString('es-ES')}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  headerLeft: {
    flex: 1
  },
  referenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  reference: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827'
  },
  mrn: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    marginLeft: 26
  },
  badges: {
    flexDirection: 'row',
    gap: 6
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  client: {
    fontSize: 14,
    color: '#374151',
    flex: 1
  },
  route: {
    fontSize: 14,
    color: '#374151'
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6'
  },
  value: {},
  valueLabel: {
    fontSize: 11,
    color: '#6B7280',
    textTransform: 'uppercase'
  },
  valueAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827'
  },
  dateSection: {
    alignItems: 'flex-end'
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4
  },
  urgentText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500'
  },
  deadline: {
    fontSize: 12,
    color: '#6B7280'
  }
});

export default ExpeditionCard;
