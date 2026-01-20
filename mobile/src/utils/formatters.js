/**
 * Utility functions for formatting data in the mobile app
 */

// ==================== Date Formatters ====================

/**
 * Format date to Spanish locale
 */
export const formatDate = (date, options = {}) => {
  if (!date) return '-';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';

  const defaultOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  };

  return d.toLocaleDateString('es-ES', { ...defaultOptions, ...options });
};

/**
 * Format date and time
 */
export const formatDateTime = (date) => {
  if (!date) return '-';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';

  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Format relative time (e.g., "hace 5 minutos")
 */
export const formatRelativeTime = (date) => {
  if (!date) return '';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const diff = now - d;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Ahora';
  if (minutes < 60) return `hace ${minutes}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 7) return `hace ${days}d`;

  return formatDate(date);
};

/**
 * Format time remaining (countdown)
 */
export const formatTimeRemaining = (deadline) => {
  if (!deadline) return null;

  const d = new Date(deadline);
  if (isNaN(d.getTime())) return null;

  const now = new Date();
  const diff = d - now;

  if (diff <= 0) return { expired: true, text: 'Vencido' };

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) {
    return {
      expired: false,
      text: `${days}d ${remainingHours}h`,
      urgent: days <= 1
    };
  }

  return {
    expired: false,
    text: `${hours}h`,
    urgent: hours <= 4
  };
};

// ==================== Number Formatters ====================

/**
 * Format currency value
 */
export const formatCurrency = (value, currency = 'EUR') => {
  if (value === null || value === undefined) return '-';

  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '-';

  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numValue);
};

/**
 * Format number with thousands separator
 */
export const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined) return '-';

  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '-';

  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(numValue);
};

/**
 * Format percentage
 */
export const formatPercent = (value, decimals = 1) => {
  if (value === null || value === undefined) return '-';

  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '-';

  return `${numValue.toFixed(decimals)}%`;
};

/**
 * Format weight (kg)
 */
export const formatWeight = (value, unit = 'kg') => {
  if (value === null || value === undefined) return '-';

  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '-';

  return `${formatNumber(numValue, 2)} ${unit}`;
};

// ==================== String Formatters ====================

/**
 * Truncate text with ellipsis
 */
export const truncate = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Capitalize first letter
 */
export const capitalize = (text) => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Format MRN (Movement Reference Number)
 */
export const formatMRN = (mrn) => {
  if (!mrn) return '-';
  // MRN format: 22ES1234567890AB1
  return mrn;
};

/**
 * Format TARIC code with dots
 */
export const formatTaricCode = (code) => {
  if (!code) return '-';
  const clean = code.replace(/\D/g, '');
  if (clean.length < 4) return code;

  // Format: 1234.56.78.90
  const parts = [];
  parts.push(clean.substring(0, 4));
  if (clean.length > 4) parts.push(clean.substring(4, 6));
  if (clean.length > 6) parts.push(clean.substring(6, 8));
  if (clean.length > 8) parts.push(clean.substring(8, 10));

  return parts.join('.');
};

/**
 * Format NIF/CIF
 */
export const formatNIF = (nif) => {
  if (!nif) return '-';
  return nif.toUpperCase();
};

// ==================== File Size Formatters ====================

/**
 * Format file size
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';

  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

// ==================== Status Formatters ====================

/**
 * Get status label in Spanish
 */
export const getStatusLabel = (status) => {
  const labels = {
    draft: 'Borrador',
    pending_documents: 'Pendiente Docs',
    documents_complete: 'Docs Completos',
    in_process: 'En Proceso',
    submitted: 'Presentado',
    green_channel: 'Canal Verde',
    orange_channel: 'Canal Naranja',
    red_channel: 'Canal Rojo',
    released: 'Levante',
    completed: 'Completado',
    cancelled: 'Cancelado',
    active: 'Activo',
    inactive: 'Inactivo'
  };

  return labels[status] || status;
};

/**
 * Get channel label in Spanish
 */
export const getChannelLabel = (channel) => {
  const labels = {
    green: 'Verde',
    orange: 'Naranja',
    red: 'Rojo',
    yellow: 'Amarillo'
  };

  return labels[channel] || channel;
};

/**
 * Get document type label
 */
export const getDocumentTypeLabel = (type) => {
  const labels = {
    INVOICE: 'Factura Comercial',
    PACKING_LIST: 'Packing List',
    BL: 'Conocimiento de Embarque',
    AWB: 'Air Waybill',
    EUR1: 'EUR.1',
    FORM_A: 'Form A',
    ATR: 'ATR',
    ORIGIN_CERT: 'Certificado de Origen',
    PHYTO: 'Certificado Fitosanitario',
    HEALTH: 'Certificado Sanitario',
    AUTHORIZATION: 'Autorizacion de Despacho',
    OTHER: 'Otro'
  };

  return labels[type] || type;
};
