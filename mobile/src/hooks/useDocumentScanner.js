import { useState, useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import api from '../services/api';

/**
 * Hook for document scanning and upload functionality
 */
const useDocumentScanner = (expeditionId) => {
  const [scanning, setScanning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [lastScannedDocument, setLastScannedDocument] = useState(null);

  // Request camera permissions
  const requestCameraPermission = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso requerido',
        'Necesitamos acceso a la camara para escanear documentos.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Configuracion',
            onPress: () => Linking.openSettings()
          }
        ]
      );
      return false;
    }
    return true;
  }, []);

  // Scan document with camera
  const scanWithCamera = useCallback(async (options = {}) => {
    const {
      allowsEditing = true,
      quality = 0.8
    } = options;

    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return null;

    try {
      setScanning(true);
      setError(null);

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing,
        quality,
        base64: true
      });

      if (result.canceled) {
        return null;
      }

      const asset = result.assets[0];
      setLastScannedDocument({
        uri: asset.uri,
        type: 'image',
        width: asset.width,
        height: asset.height
      });

      return asset;
    } catch (err) {
      setError(err.message || 'Error al escanear documento');
      console.error('Error scanning document:', err);
      return null;
    } finally {
      setScanning(false);
    }
  }, [requestCameraPermission]);

  // Pick image from gallery
  const pickFromGallery = useCallback(async (options = {}) => {
    const {
      allowsMultipleSelection = false,
      quality = 0.8
    } = options;

    try {
      setScanning(true);
      setError(null);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection,
        quality
      });

      if (result.canceled) {
        return null;
      }

      const asset = result.assets[0];
      setLastScannedDocument({
        uri: asset.uri,
        type: 'image'
      });

      return asset;
    } catch (err) {
      setError(err.message || 'Error al seleccionar imagen');
      console.error('Error picking image:', err);
      return null;
    } finally {
      setScanning(false);
    }
  }, []);

  // Pick document (PDF, etc.)
  const pickDocument = useCallback(async (options = {}) => {
    const {
      type = ['application/pdf', 'image/*']
    } = options;

    try {
      setScanning(true);
      setError(null);

      const result = await DocumentPicker.getDocumentAsync({
        type,
        copyToCacheDirectory: true
      });

      if (result.canceled) {
        return null;
      }

      const asset = result.assets[0];
      setLastScannedDocument({
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType,
        size: asset.size
      });

      return asset;
    } catch (err) {
      setError(err.message || 'Error al seleccionar documento');
      console.error('Error picking document:', err);
      return null;
    } finally {
      setScanning(false);
    }
  }, []);

  // Upload document to server
  const uploadDocument = useCallback(async (document, metadata = {}) => {
    if (!document || !expeditionId) {
      setError('Documento o expediente no especificado');
      return null;
    }

    try {
      setUploading(true);
      setProgress(0);
      setError(null);

      const formData = new FormData();

      // Add file
      const uri = document.uri;
      const filename = document.name || uri.split('/').pop();
      const type = document.mimeType || document.type || 'application/octet-stream';

      formData.append('file', {
        uri,
        name: filename,
        type
      });

      // Add metadata
      formData.append('expeditionId', expeditionId);
      formData.append('documentType', metadata.documentType || 'OTHER');
      if (metadata.description) {
        formData.append('description', metadata.description);
      }

      const response = await api.uploadDocument(formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setProgress(percentCompleted);
        }
      });

      setProgress(100);

      return response.data;
    } catch (err) {
      setError(err.message || 'Error al subir documento');
      console.error('Error uploading document:', err);
      throw err;
    } finally {
      setUploading(false);
    }
  }, [expeditionId]);

  // Scan and upload in one step
  const scanAndUpload = useCallback(async (metadata = {}) => {
    const scanned = await scanWithCamera();
    if (scanned) {
      return await uploadDocument(scanned, metadata);
    }
    return null;
  }, [scanWithCamera, uploadDocument]);

  // Show document source picker
  const showSourcePicker = useCallback(() => {
    return new Promise((resolve) => {
      Alert.alert(
        'Seleccionar documento',
        'Elige de donde obtener el documento',
        [
          {
            text: 'Camara',
            onPress: async () => {
              const result = await scanWithCamera();
              resolve(result);
            }
          },
          {
            text: 'Galeria',
            onPress: async () => {
              const result = await pickFromGallery();
              resolve(result);
            }
          },
          {
            text: 'Archivos',
            onPress: async () => {
              const result = await pickDocument();
              resolve(result);
            }
          },
          {
            text: 'Cancelar',
            style: 'cancel',
            onPress: () => resolve(null)
          }
        ]
      );
    });
  }, [scanWithCamera, pickFromGallery, pickDocument]);

  return {
    scanning,
    uploading,
    progress,
    error,
    lastScannedDocument,
    scanWithCamera,
    pickFromGallery,
    pickDocument,
    uploadDocument,
    scanAndUpload,
    showSourcePicker,
    clearError: () => setError(null)
  };
};

export default useDocumentScanner;
