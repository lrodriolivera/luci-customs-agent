/**
 * Netherlands DECO/DMS specific validation rules
 */

// IOSS format: IM followed by country code (2) + digits (up to 12) e.g., IMNL000000123
const IOSS_REGEX = /^IM[A-Z]{2}\d{1,12}$/;

// NL EORI format: NL + 9 digits or NL + KvK number
const NL_EORI_REGEX = /^NL\d{9,12}$/;

// Excise goods HS chapters that cannot use H7/DECO
const EXCISE_HS_CHAPTERS = ['22', '24', '27', '29', '33', '34', '36', '38'];

// Restricted goods chapters (need full declaration, not H7)
const RESTRICTED_HS_CHAPTERS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '12', '13', '14', '15', '28', '29', '30', '31', '36', '37', '38', '84', '85', '87', '90', '93'];

class NLValidation {

  /**
   * Validate DECO H7 declaration data
   * Returns { valid, errors, warnings }
   */
  static validateDECO(data) {
    const errors = [];
    const warnings = [];

    // 1. Max value check (150 EUR)
    if (data.items) {
      data.items.forEach((item, idx) => {
        const value = parseFloat(item.customsValue || item.statisticalValue || 0);
        if (value > 150) {
          errors.push(`Item ${idx + 1}: Valor ${value} EUR supera el maximo de 150 EUR para DECO H7. Use DMS H1.`);
        }
        if (value <= 0) {
          errors.push(`Item ${idx + 1}: Valor debe ser mayor que 0`);
        }
      });

      // Total consignment value check
      const totalValue = data.items.reduce((sum, i) => sum + parseFloat(i.customsValue || 0), 0);
      if (totalValue > 150) {
        errors.push(`Valor total del envio (${totalValue.toFixed(2)} EUR) supera 150 EUR. Use DMS H1.`);
      }
    }

    // 2. HS code must be 6 digits for H7
    if (data.items) {
      data.items.forEach((item, idx) => {
        const code = (item.commodityCode || '').replace(/\s/g, '');
        if (code.length < 6) {
          errors.push(`Item ${idx + 1}: Codigo HS debe tener al menos 6 digitos (tiene ${code.length})`);
        }
        if (code.length > 6) {
          warnings.push(`Item ${idx + 1}: DECO usa 6 digitos HS. Se truncara '${code}' a '${code.substring(0, 6)}'`);
        }

        // Check excise goods
        const chapter = code.substring(0, 2);
        if (EXCISE_HS_CHAPTERS.includes(chapter)) {
          errors.push(`Item ${idx + 1}: Capitulo HS ${chapter} es producto sujeto a impuestos especiales (excise). No se puede usar DECO H7.`);
        }

        // Warn on restricted goods
        if (RESTRICTED_HS_CHAPTERS.includes(chapter)) {
          warnings.push(`Item ${idx + 1}: Capitulo HS ${chapter} puede requerir permisos adicionales. Verifique restricciones.`);
        }
      });
    }

    // 3. Validate IOSS format
    if (data.iossNumber) {
      if (!IOSS_REGEX.test(data.iossNumber)) {
        errors.push(`Numero IOSS '${data.iossNumber}' no tiene formato valido (esperado: IMxx + digitos, ej: IMNL000000123)`);
      }
    }

    // 4. EORI validation
    if (data.declarant?.eori) {
      if (data.declarant.eori.startsWith('NL') && !NL_EORI_REGEX.test(data.declarant.eori)) {
        warnings.push(`EORI declarante '${data.declarant.eori}' no parece tener formato NL estandar (NL + 9-12 digitos)`);
      }
    } else {
      errors.push('EORI del declarante es obligatorio');
    }

    // 5. Required fields
    if (!data.declarant?.eori) errors.push('EORI declarante obligatorio');
    if (!data.exporter?.name) errors.push('Nombre del exportador obligatorio');
    if (!data.exporter?.country) errors.push('Pais del exportador obligatorio');
    if (!data.transport?.documentRef) errors.push('Referencia documento transporte obligatoria');
    if (!data.items || data.items.length === 0) errors.push('Al menos un articulo requerido');

    // 6. DECO-specific limits
    if (data.items && data.items.length > 99) {
      errors.push(`DECO permite maximo 99 articulos por declaracion (tiene ${data.items.length})`);
    }

    // 7. Country of dispatch cannot be NL or EU member
    if (data.exporter?.country === 'NL') {
      errors.push('Pais de expedicion no puede ser NL para importacion');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      declarationType: 'H7',
      system: 'DECO'
    };
  }

  /**
   * Validate DMS H1 declaration data
   */
  static validateDMS(data) {
    const errors = [];
    const warnings = [];

    if (!data.declarant?.eori) errors.push('EORI declarante obligatorio');
    if (!data.exporter?.name) errors.push('Datos exportador obligatorios');
    if (!data.importer?.eori) errors.push('EORI importador obligatorio');
    if (!data.items || data.items.length === 0) errors.push('Al menos un articulo requerido');
    if (!data.customsOffice) warnings.push('Aduana de entrada no especificada, se usara Rotterdam por defecto');

    // TARIC code should be 8-10 digits for H1
    data.items?.forEach((item, idx) => {
      const code = (item.commodityCode || '').replace(/\s/g, '');
      if (code.length < 8) {
        errors.push(`Item ${idx + 1}: DMS H1 requiere codigo TARIC de 8-10 digitos (tiene ${code.length})`);
      }
    });

    // Guarantee required for certain procedures
    if (!data.guarantee && data.totalCustomsValue > 5000) {
      warnings.push('Declaraciones >5.000 EUR normalmente requieren garantia');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      declarationType: 'H1',
      system: 'DMS 4.0'
    };
  }

  /**
   * Validate IOSS number format
   */
  static isValidIOSS(ioss) {
    return IOSS_REGEX.test(ioss);
  }

  /**
   * Check if goods can use DECO H7 (not excise/restricted)
   */
  static canUseDECO(hsCode, value) {
    const chapter = (hsCode || '').substring(0, 2);
    if (EXCISE_HS_CHAPTERS.includes(chapter)) return { allowed: false, reason: 'Producto sujeto a impuestos especiales' };
    if (parseFloat(value) > 150) return { allowed: false, reason: 'Valor supera 150 EUR' };
    return { allowed: true };
  }
}

module.exports = NLValidation;
