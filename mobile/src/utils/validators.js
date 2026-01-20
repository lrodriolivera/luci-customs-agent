/**
 * Utility functions for data validation in the mobile app
 */

// ==================== Basic Validators ====================

/**
 * Check if value is empty
 */
export const isEmpty = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

/**
 * Check if value is a valid email
 */
export const isValidEmail = (email) => {
  if (!email) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

/**
 * Check if value is a valid phone number (Spanish format)
 */
export const isValidPhone = (phone) => {
  if (!phone) return false;
  const clean = phone.replace(/[\s-]/g, '');
  // Spanish phone numbers: 9 digits starting with 6, 7, 8, or 9
  const regex = /^[6789]\d{8}$/;
  return regex.test(clean);
};

/**
 * Check if value is a valid NIF/CIF
 */
export const isValidNIF = (nif) => {
  if (!nif) return false;
  const clean = nif.toUpperCase().replace(/[\s-]/g, '');

  // NIF: 8 digits + letter or letter + 7 digits + letter
  const nifRegex = /^(\d{8}[A-Z]|[KLMXYZ]\d{7}[A-Z])$/;
  // CIF: letter + 7 digits + digit/letter
  const cifRegex = /^[ABCDEFGHJNPQRSUVW]\d{7}[A-J0-9]$/;

  return nifRegex.test(clean) || cifRegex.test(clean);
};

/**
 * Check if value is a valid TARIC code
 */
export const isValidTaricCode = (code) => {
  if (!code) return false;
  const clean = code.replace(/\D/g, '');
  // TARIC codes are 8-10 digits
  return clean.length >= 8 && clean.length <= 10;
};

/**
 * Check if value is a valid MRN
 */
export const isValidMRN = (mrn) => {
  if (!mrn) return false;
  // MRN format: 2 digits year + 2 letter country + 12-14 alphanumeric
  const regex = /^\d{2}[A-Z]{2}[A-Z0-9]{12,14}$/;
  return regex.test(mrn.toUpperCase());
};

/**
 * Check if value is a valid EORI
 */
export const isValidEORI = (eori) => {
  if (!eori) return false;
  // EORI: 2 letter country code + up to 15 alphanumeric
  const regex = /^[A-Z]{2}[A-Z0-9]{1,15}$/;
  return regex.test(eori.toUpperCase());
};

// ==================== Number Validators ====================

/**
 * Check if value is a valid positive number
 */
export const isPositiveNumber = (value) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num > 0;
};

/**
 * Check if value is within range
 */
export const isInRange = (value, min, max) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num >= min && num <= max;
};

// ==================== Date Validators ====================

/**
 * Check if date is valid
 */
export const isValidDate = (date) => {
  if (!date) return false;
  const d = new Date(date);
  return !isNaN(d.getTime());
};

/**
 * Check if date is in the past
 */
export const isPastDate = (date) => {
  if (!isValidDate(date)) return false;
  return new Date(date) < new Date();
};

/**
 * Check if date is in the future
 */
export const isFutureDate = (date) => {
  if (!isValidDate(date)) return false;
  return new Date(date) > new Date();
};

/**
 * Check if date is within X days from now
 */
export const isWithinDays = (date, days) => {
  if (!isValidDate(date)) return false;
  const d = new Date(date);
  const now = new Date();
  const futureLimit = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return d <= futureLimit;
};

// ==================== Form Validation ====================

/**
 * Validate a form object against rules
 * @param {Object} data - Form data to validate
 * @param {Object} rules - Validation rules
 * @returns {Object} - { isValid: boolean, errors: { field: message } }
 */
export const validateForm = (data, rules) => {
  const errors = {};

  Object.keys(rules).forEach((field) => {
    const value = data[field];
    const fieldRules = rules[field];

    // Required
    if (fieldRules.required && isEmpty(value)) {
      errors[field] = fieldRules.requiredMessage || 'Este campo es obligatorio';
      return;
    }

    // Skip other validations if empty and not required
    if (isEmpty(value)) return;

    // Min length
    if (fieldRules.minLength && value.length < fieldRules.minLength) {
      errors[field] = `Minimo ${fieldRules.minLength} caracteres`;
      return;
    }

    // Max length
    if (fieldRules.maxLength && value.length > fieldRules.maxLength) {
      errors[field] = `Maximo ${fieldRules.maxLength} caracteres`;
      return;
    }

    // Pattern
    if (fieldRules.pattern && !fieldRules.pattern.test(value)) {
      errors[field] = fieldRules.patternMessage || 'Formato invalido';
      return;
    }

    // Email
    if (fieldRules.email && !isValidEmail(value)) {
      errors[field] = 'Email invalido';
      return;
    }

    // Phone
    if (fieldRules.phone && !isValidPhone(value)) {
      errors[field] = 'Telefono invalido';
      return;
    }

    // NIF
    if (fieldRules.nif && !isValidNIF(value)) {
      errors[field] = 'NIF/CIF invalido';
      return;
    }

    // Custom validator
    if (fieldRules.custom) {
      const customError = fieldRules.custom(value, data);
      if (customError) {
        errors[field] = customError;
      }
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// ==================== Expedition Validation ====================

/**
 * Validate expedition data
 */
export const validateExpedition = (expedition) => {
  return validateForm(expedition, {
    reference: {
      required: true,
      minLength: 3,
      maxLength: 50
    },
    type: {
      required: true,
      custom: (value) => {
        if (!['import', 'export'].includes(value)) {
          return 'Tipo debe ser import o export';
        }
      }
    },
    client: {
      required: true,
      requiredMessage: 'Seleccione un cliente'
    },
    originCountry: {
      required: true,
      minLength: 2,
      maxLength: 2
    },
    customsValue: {
      required: true,
      custom: (value) => {
        if (!isPositiveNumber(value)) {
          return 'Valor debe ser un numero positivo';
        }
      }
    }
  });
};

/**
 * Validate document upload
 */
export const validateDocument = (document) => {
  const errors = {};

  if (!document.uri && !document.file) {
    errors.file = 'Seleccione un archivo';
  }

  if (!document.documentType) {
    errors.documentType = 'Seleccione el tipo de documento';
  }

  // Check file size (max 50MB)
  if (document.size && document.size > 50 * 1024 * 1024) {
    errors.file = 'El archivo supera los 50MB';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
