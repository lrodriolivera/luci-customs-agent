/**
 * Expedition Detail Screen
 * Shows detailed information about an expedition
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';

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

// Status configuration
const STATUS_CONFIG = {
  draft: { label: 'Borrador', color: COLORS.gray },
  pending: { label: 'Pendiente', color: COLORS.warning },
  submitted: { label: 'Enviado', color: COLORS.info },
  green: { label: 'Canal Verde', color: COLORS.success },
  yellow: { label: 'Canal Amarillo', color: '#eab308' },
  orange: { label: 'Canal Naranja', color: '#f97316' },
  red: { label: 'Canal Rojo', color: COLORS.error },
  completed: { label: 'Completado', color: COLORS.success },
};

// Info Row Component
function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabel}>
        <Ionicons name={icon} size={18} color={COLORS.gray} />
        <Text style={styles.infoLabelText}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// Section Component
function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

// Document Item Component
function DocumentItem({ name, type, date }) {
  return (
    <TouchableOpacity style={styles.documentItem}>
      <View style={styles.documentIcon}>
        <Ionicons
          name={type === 'pdf' ? 'document-text' : 'image'}
          size={24}
          color={COLORS.primary}
        />
      </View>
      <View style={styles.documentInfo}>
        <Text style={styles.documentName}>{name}</Text>
        <Text style={styles.documentDate}>{date}</Text>
      </View>
      <Ionicons name="download-outline" size={20} color={COLORS.gray} />
    </TouchableOpacity>
  );
}

// Timeline Item Component
function TimelineItem({ title, date, description, isLast }) {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineDot} />
      {!isLast && <View style={styles.timelineLine} />}
      <View style={styles.timelineContent}>
        <Text style={styles.timelineTitle}>{title}</Text>
        <Text style={styles.timelineDate}>{date}</Text>
        {description && <Text style={styles.timelineDescription}>{description}</Text>}
      </View>
    </View>
  );
}

export default function ExpeditionDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { expedition } = route.params;
  const [activeTab, setActiveTab] = useState('info');

  const status = STATUS_CONFIG[expedition.status] || STATUS_CONFIG.draft;

  // Mock documents
  const documents = [
    { name: 'Factura comercial.pdf', type: 'pdf', date: '20/01/2024' },
    { name: 'Bill of Lading.pdf', type: 'pdf', date: '19/01/2024' },
    { name: 'Packing List.pdf', type: 'pdf', date: '19/01/2024' },
    { name: 'Certificado origen.jpg', type: 'image', date: '18/01/2024' },
  ];

  // Mock timeline
  const timeline = [
    { title: 'Expediente creado', date: '18/01/2024 09:30', description: 'Documentacion inicial recibida' },
    { title: 'Clasificacion TARIC', date: '18/01/2024 10:15', description: 'Codigo asignado: 8471.30.00' },
    { title: 'Declaracion generada', date: '19/01/2024 11:00', description: 'H1 preparada para envio' },
    { title: 'Enviada a AEAT', date: '19/01/2024 14:30', description: 'MRN: 24ES0000123456789' },
    { title: 'Asignado canal', date: '19/01/2024 15:00', description: `Canal ${status.label}` },
  ];

  const handleAction = (action) => {
    switch (action) {
      case 'chat':
        navigation.navigate('Chat', { expeditionId: expedition.id });
        break;
      case 'scan':
        navigation.navigate('Escanear', { expeditionId: expedition.id });
        break;
      case 'respond':
        Alert.alert('Responder', 'Funcionalidad de respuesta a requerimiento');
        break;
      default:
        break;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.reference}>{expedition.reference}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${status.color}15` }]}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.clientName}>{expedition.clientName}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['info', 'docs', 'timeline'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'info' ? 'Informacion' : tab === 'docs' ? 'Documentos' : 'Historial'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {/* Info Tab */}
        {activeTab === 'info' && (
          <>
            <Section title="Datos Generales">
              <InfoRow
                icon="globe-outline"
                label="Origen"
                value={expedition.originCountry}
              />
              <InfoRow
                icon="location-outline"
                label="Destino"
                value={expedition.destinationCountry}
              />
              <InfoRow
                icon="cube-outline"
                label="Mercancia"
                value={expedition.goodsDescription}
              />
              <InfoRow
                icon="pricetag-outline"
                label="Codigo TARIC"
                value="8471.30.00"
              />
            </Section>

            <Section title="Valores">
              <InfoRow
                icon="cash-outline"
                label="Valor Aduanero"
                value={expedition.customsValue?.toLocaleString('es-ES', {
                  style: 'currency',
                  currency: 'EUR',
                })}
              />
              <InfoRow
                icon="calculator-outline"
                label="Aranceles"
                value="0% (Preferencia EUR.1)"
              />
              <InfoRow
                icon="receipt-outline"
                label="IVA"
                value={(expedition.customsValue * 0.21).toLocaleString('es-ES', {
                  style: 'currency',
                  currency: 'EUR',
                })}
              />
            </Section>

            <Section title="Declaracion">
              <InfoRow
                icon="document-text-outline"
                label="Tipo"
                value="H1 - Importacion"
              />
              <InfoRow
                icon="barcode-outline"
                label="MRN"
                value="24ES0000123456789"
              />
              <InfoRow
                icon="calendar-outline"
                label="Fecha envio"
                value="19/01/2024 14:30"
              />
            </Section>

            {/* Warning for Orange/Red channel */}
            {['orange', 'red'].includes(expedition.status) && (
              <View style={styles.warningBox}>
                <Ionicons name="alert-circle" size={24} color={COLORS.warning} />
                <View style={styles.warningContent}>
                  <Text style={styles.warningTitle}>Requerimiento Pendiente</Text>
                  <Text style={styles.warningText}>
                    AEAT solicita documentacion adicional. Plazo: 10 dias.
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* Documents Tab */}
        {activeTab === 'docs' && (
          <Section title="Documentos del Expediente">
            {documents.map((doc, index) => (
              <DocumentItem key={index} {...doc} />
            ))}
            <TouchableOpacity style={styles.addDocButton}>
              <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
              <Text style={styles.addDocText}>Agregar documento</Text>
            </TouchableOpacity>
          </Section>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <Section title="Historial del Expediente">
            {timeline.map((item, index) => (
              <TimelineItem
                key={index}
                {...item}
                isLast={index === timeline.length - 1}
              />
            ))}
          </Section>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleAction('chat')}
        >
          <Ionicons name="chatbubble-outline" size={22} color={COLORS.primary} />
          <Text style={styles.actionButtonText}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleAction('scan')}
        >
          <Ionicons name="scan-outline" size={22} color={COLORS.primary} />
          <Text style={styles.actionButtonText}>Escanear</Text>
        </TouchableOpacity>
        {['orange', 'red'].includes(expedition.status) && (
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonPrimary]}
            onPress={() => handleAction('respond')}
          >
            <Ionicons name="send-outline" size={22} color={COLORS.white} />
            <Text style={styles.actionButtonTextPrimary}>Responder</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reference: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clientName: {
    fontSize: 16,
    color: COLORS.gray,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.gray,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  sectionContent: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabelText: {
    fontSize: 14,
    color: COLORS.gray,
    marginLeft: 8,
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  warningContent: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.warning,
  },
  warningText: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 4,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  documentIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: `${COLORS.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  documentName: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  documentDate: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  addDocButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  addDocText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
    marginLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    paddingLeft: 8,
    marginBottom: 4,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    marginTop: 4,
  },
  timelineLine: {
    position: 'absolute',
    left: 13,
    top: 20,
    bottom: -4,
    width: 2,
    backgroundColor: COLORS.grayLight,
  },
  timelineContent: {
    flex: 1,
    marginLeft: 16,
    paddingBottom: 20,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  timelineDate: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  timelineDescription: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 4,
  },
  actionBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayLight,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: `${COLORS.primary}10`,
  },
  actionButtonPrimary: {
    backgroundColor: COLORS.primary,
  },
  actionButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
    marginLeft: 6,
  },
  actionButtonTextPrimary: {
    fontSize: 14,
    color: COLORS.white,
    fontWeight: '500',
    marginLeft: 6,
  },
});
