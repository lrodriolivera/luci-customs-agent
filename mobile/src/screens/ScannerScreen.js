/**
 * Scanner Screen
 * Document scanning with camera and OCR
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const COLORS = {
  primary: '#6366f1',
  success: '#22c55e',
  white: '#ffffff',
  gray: '#64748b',
  grayLight: '#f1f5f9',
  text: '#1e293b',
  background: '#000000',
};

// Document type options
const DOCUMENT_TYPES = [
  { key: 'invoice', label: 'Factura', icon: 'receipt-outline' },
  { key: 'bl', label: 'B/L', icon: 'boat-outline' },
  { key: 'packing', label: 'Packing List', icon: 'list-outline' },
  { key: 'certificate', label: 'Certificado', icon: 'ribbon-outline' },
  { key: 'other', label: 'Otro', icon: 'document-outline' },
];

export default function ScannerScreen() {
  const [hasPermission, setHasPermission] = useState(null);
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [capturedImage, setCapturedImage] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [selectedType, setSelectedType] = useState('invoice');
  const [showTypeModal, setShowTypeModal] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: true,
        });
        setCapturedImage(photo);
      } catch (error) {
        Alert.alert('Error', 'No se pudo capturar la imagen');
      }
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0]);
    }
  };

  const processImage = async () => {
    if (!capturedImage?.base64) return;

    setProcessing(true);
    try {
      // In real app, send to backend for OCR
      // const result = await api.documents.scan(capturedImage.base64);

      // Mock extracted data for demo
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setExtractedData({
        type: selectedType,
        confidence: 0.92,
        fields: {
          'Numero Factura': 'INV-2024-0089',
          'Fecha': '15/01/2024',
          'Proveedor': 'Tech Components Ltd.',
          'Importe Total': '45.000,00 EUR',
          'Incoterm': 'CIF Barcelona',
          'Descripcion': 'Componentes electronicos',
        },
      });
    } catch (error) {
      Alert.alert('Error', 'No se pudo procesar el documento');
    } finally {
      setProcessing(false);
    }
  };

  const confirmAndSave = () => {
    Alert.alert(
      'Documento Guardado',
      'El documento ha sido procesado y guardado correctamente.',
      [
        {
          text: 'Escanear otro',
          onPress: () => {
            setCapturedImage(null);
            setExtractedData(null);
          },
        },
        {
          text: 'Finalizar',
          style: 'default',
        },
      ]
    );
  };

  const resetCapture = () => {
    setCapturedImage(null);
    setExtractedData(null);
  };

  // Permission states
  if (hasPermission === null) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.permissionText}>Solicitando permiso de camara...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-off-outline" size={64} color={COLORS.gray} />
        <Text style={styles.permissionText}>
          Se requiere permiso de camara para escanear documentos
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={pickImage}>
          <Text style={styles.permissionButtonText}>Seleccionar de galeria</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Preview captured image
  if (capturedImage) {
    return (
      <View style={styles.container}>
        {/* Image Preview */}
        <Image source={{ uri: capturedImage.uri }} style={styles.previewImage} />

        {/* Document Type Selector */}
        <View style={styles.typeSelector}>
          <Text style={styles.typeSelectorLabel}>Tipo de documento:</Text>
          <TouchableOpacity
            style={styles.typeSelectorButton}
            onPress={() => setShowTypeModal(true)}
          >
            <Ionicons
              name={DOCUMENT_TYPES.find((t) => t.key === selectedType)?.icon}
              size={20}
              color={COLORS.primary}
            />
            <Text style={styles.typeSelectorText}>
              {DOCUMENT_TYPES.find((t) => t.key === selectedType)?.label}
            </Text>
            <Ionicons name="chevron-down" size={20} color={COLORS.gray} />
          </TouchableOpacity>
        </View>

        {/* Extracted Data */}
        {extractedData && (
          <View style={styles.extractedData}>
            <View style={styles.extractedHeader}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
              <Text style={styles.extractedTitle}>Datos Extraidos</Text>
              <Text style={styles.confidenceText}>
                {Math.round(extractedData.confidence * 100)}% confianza
              </Text>
            </View>
            {Object.entries(extractedData.fields).map(([key, value]) => (
              <View key={key} style={styles.extractedRow}>
                <Text style={styles.extractedLabel}>{key}:</Text>
                <Text style={styles.extractedValue}>{value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.previewActionSecondary} onPress={resetCapture}>
            <Ionicons name="refresh" size={24} color={COLORS.primary} />
            <Text style={styles.previewActionSecondaryText}>Repetir</Text>
          </TouchableOpacity>

          {!extractedData ? (
            <TouchableOpacity
              style={styles.previewActionPrimary}
              onPress={processImage}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="scan" size={24} color={COLORS.white} />
                  <Text style={styles.previewActionPrimaryText}>Procesar</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.previewActionPrimary} onPress={confirmAndSave}>
              <Ionicons name="checkmark" size={24} color={COLORS.white} />
              <Text style={styles.previewActionPrimaryText}>Guardar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Document Type Modal */}
        <Modal visible={showTypeModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Tipo de Documento</Text>
              {DOCUMENT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.modalOption,
                    selectedType === type.key && styles.modalOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedType(type.key);
                    setShowTypeModal(false);
                  }}
                >
                  <Ionicons
                    name={type.icon}
                    size={24}
                    color={selectedType === type.key ? COLORS.primary : COLORS.gray}
                  />
                  <Text
                    style={[
                      styles.modalOptionText,
                      selectedType === type.key && styles.modalOptionTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                  {selectedType === type.key && (
                    <Ionicons name="checkmark" size={24} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowTypeModal(false)}
              >
                <Text style={styles.modalCloseText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // Camera View
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
      >
        {/* Scanner Frame Overlay */}
        <View style={styles.overlay}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.scanHint}>
            Alinea el documento dentro del marco
          </Text>
        </View>

        {/* Camera Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setFlash(flash === 'off' ? 'on' : 'off')}
          >
            <Ionicons
              name={flash === 'off' ? 'flash-off' : 'flash'}
              size={24}
              color={COLORS.white}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={pickImage}>
            <Ionicons name="images" size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 32,
  },
  permissionText: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '500',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: '85%',
    aspectRatio: 1.4,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: COLORS.white,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scanHint: {
    color: COLORS.white,
    fontSize: 14,
    marginTop: 24,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 48,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
  },
  previewImage: {
    flex: 1,
    resizeMode: 'contain',
  },
  typeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  typeSelectorLabel: {
    fontSize: 14,
    color: COLORS.gray,
  },
  typeSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.grayLight,
  },
  typeSelectorText: {
    fontSize: 14,
    color: COLORS.text,
    marginHorizontal: 8,
  },
  extractedData: {
    backgroundColor: COLORS.white,
    padding: 16,
    maxHeight: '40%',
  },
  extractedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  extractedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 8,
    flex: 1,
  },
  confidenceText: {
    fontSize: 12,
    color: COLORS.success,
  },
  extractedRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  extractedLabel: {
    fontSize: 13,
    color: COLORS.gray,
    width: 120,
  },
  extractedValue: {
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
    fontWeight: '500',
  },
  previewActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: COLORS.white,
  },
  previewActionSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.grayLight,
  },
  previewActionSecondaryText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '500',
    marginLeft: 8,
  },
  previewActionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  previewActionPrimaryText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '500',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
  },
  modalOptionActive: {
    backgroundColor: `${COLORS.primary}10`,
  },
  modalOptionText: {
    fontSize: 16,
    color: COLORS.text,
    marginLeft: 12,
    flex: 1,
  },
  modalOptionTextActive: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  modalClose: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  modalCloseText: {
    fontSize: 16,
    color: COLORS.gray,
  },
});
