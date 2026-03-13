/**
 * Manifest Processing Service
 * Reads a cargo manifest (CSV/Excel), uses AI to classify goods,
 * and generates H7 declarations for each line item.
 */
const logger = require('../config/logger');

class ManifestService {
  constructor() {
    this.aiService = null; // Lazy load
  }

  /**
   * Parse a CSV manifest buffer into structured rows
   * Expected columns (flexible, AI will map):
   * tracking, sender_name, sender_country, recipient_name, recipient_id,
   * recipient_address, recipient_city, recipient_postal,
   * description, quantity, value, weight, origin_country
   */
  parseCSV(buffer, delimiter = ',') {
    const content = buffer.toString('utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    if (lines.length < 2) {
      throw new Error('El manifiesto debe tener al menos una cabecera y una linea de datos');
    }

    // Parse header
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

    // Map common header names to our standard fields
    const headerMap = this._mapHeaders(headers);

    // Parse data rows
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this._parseCSVLine(lines[i], delimiter);
      if (values.length === 0 || values.every(v => !v.trim())) continue;

      const row = {};
      headers.forEach((header, idx) => {
        const mappedField = headerMap[header];
        if (mappedField && idx < values.length) {
          row[mappedField] = values[idx].trim().replace(/^['"]|['"]$/g, '');
        }
      });

      // Auto-assign row number
      row.lineNumber = i;
      rows.push(row);
    }

    return { headers, headerMap, rows, totalRows: rows.length };
  }

  /**
   * Map various header names to standard fields
   */
  _mapHeaders(headers) {
    const mappings = {
      // Tracking
      'tracking': 'tracking', 'awb': 'tracking', 'numero_seguimiento': 'tracking',
      'tracking_number': 'tracking', 'num_seguimiento': 'tracking', 'referencia': 'tracking',
      'hawb': 'tracking', 'shipment_id': 'tracking',

      // Sender
      'sender': 'senderName', 'remitente': 'senderName', 'sender_name': 'senderName',
      'nombre_remitente': 'senderName', 'exportador': 'senderName', 'shipper': 'senderName',
      'sender_country': 'senderCountry', 'pais_remitente': 'senderCountry',
      'pais_origen': 'senderCountry', 'origin': 'senderCountry', 'origen': 'senderCountry',
      'country_of_origin': 'senderCountry',

      // Recipient
      'recipient': 'recipientName', 'destinatario': 'recipientName',
      'recipient_name': 'recipientName', 'nombre_destinatario': 'recipientName',
      'consignee': 'recipientName', 'importador': 'recipientName',
      'recipient_id': 'recipientId', 'nif': 'recipientId', 'nie': 'recipientId',
      'nif_destinatario': 'recipientId', 'dni': 'recipientId', 'tax_id': 'recipientId',
      'direccion': 'recipientAddress', 'address': 'recipientAddress',
      'recipient_address': 'recipientAddress',
      'ciudad': 'recipientCity', 'city': 'recipientCity', 'localidad': 'recipientCity',
      'recipient_city': 'recipientCity', 'ciudad_destinatario': 'recipientCity',
      'codigo_postal': 'recipientPostal', 'cp': 'recipientPostal',
      'postal_code': 'recipientPostal', 'zip': 'recipientPostal',
      'recipient_postal': 'recipientPostal', 'cp_destinatario': 'recipientPostal',

      // Goods
      'description': 'description', 'descripcion': 'description',
      'mercancia': 'description', 'goods': 'description', 'contenido': 'description',
      'goods_description': 'description', 'desc_mercancia': 'description',
      'quantity': 'quantity', 'cantidad': 'quantity', 'qty': 'quantity',
      'unidades': 'quantity', 'piezas': 'quantity',
      'value': 'value', 'valor': 'value', 'valor_eur': 'value',
      'customs_value': 'value', 'valor_declarado': 'value', 'amount': 'value',
      'weight': 'weight', 'peso': 'weight', 'peso_kg': 'weight',
      'gross_weight': 'weight', 'peso_bruto': 'weight',
      'net_weight': 'netWeight', 'peso_neto': 'netWeight',

      // Classification
      'hs_code': 'hsCode', 'taric': 'hsCode', 'codigo_hs': 'hsCode',
      'tariff_code': 'hsCode', 'codigo_taric': 'hsCode', 'arancel': 'hsCode',

      // IOSS
      'ioss': 'iossNumber', 'ioss_number': 'iossNumber', 'numero_ioss': 'iossNumber',
    };

    const result = {};
    headers.forEach(h => {
      const normalized = h.toLowerCase().replace(/[\s\-\.]/g, '_');
      result[h] = mappings[normalized] || mappings[h] || null;
    });
    return result;
  }

  /**
   * Parse a single CSV line handling quoted fields
   */
  _parseCSVLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  /**
   * Use AI to classify goods descriptions into HS codes
   * Processes in batches for efficiency
   */
  async classifyWithAI(rows, batchSize = 10) {
    if (!this.aiService) {
      this.aiService = require('./aiService');
    }

    const results = [];

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      // Build prompt for batch classification
      const descriptions = batch.map((r, idx) =>
        `${i + idx + 1}. "${r.description}" (origen: ${r.senderCountry || 'desconocido'}, valor: ${r.value || '?'} EUR)`
      ).join('\n');

      const prompt = `Clasifica estas mercancias con codigo HS 6 digitos. Responde SOLO JSON array, sin markdown ni explicaciones.

${descriptions}

Formato exacto: [{"line":1,"hsCode":"610910","description_normalized":"Camisetas algodon","eligible_h7":true,"reason":""}]
Si valor>150EUR: eligible_h7=false, reason="Valor supera 150 EUR". Si restringida: eligible_h7=false con razon.`;

      try {
        // Use callClaude directly for structured JSON responses (not askLuci which uses chat system prompt)
        const response = await this.aiService.callClaude(
          'claude-haiku-4-5-20251001',
          'Eres un clasificador aduanero experto. Responde SIEMPRE en formato JSON array valido, sin markdown ni explicaciones.',
          prompt,
          { timeout: 30000 }
        );
        const responseText = response.content || response.message || response;

        // Parse AI response - extract JSON (handle markdown code blocks)
        let textToParse = String(responseText);
        // Remove markdown code blocks if present
        const codeBlockMatch = textToParse.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
          textToParse = codeBlockMatch[1].trim();
        }
        const jsonMatch = textToParse.match(/\[[\s\S]*\]/);
        logger.info(`Manifest AI batch ${i}: response length ${String(responseText).length}, JSON found: ${!!jsonMatch}`);
        if (jsonMatch) {
          const classifications = JSON.parse(jsonMatch[0]);
          logger.info(`Manifest AI batch ${i}: ${classifications.length} items classified, first HS: ${classifications[0]?.hsCode}`);
          results.push(...classifications);
        } else {
          // Fallback: mark as unclassified
          batch.forEach((r, idx) => {
            results.push({
              line: i + idx + 1,
              hsCode: '',
              description_normalized: r.description,
              eligible_h7: parseFloat(r.value) <= 150,
              reason: 'Clasificacion IA no disponible'
            });
          });
        }
      } catch (error) {
        logger.error(`AI classification error batch ${i}: ${error.message}`);
        batch.forEach((r, idx) => {
          results.push({
            line: i + idx + 1,
            hsCode: '',
            description_normalized: r.description,
            eligible_h7: parseFloat(r.value) <= 150,
            reason: 'Error en clasificacion IA'
          });
        });
      }
    }

    return results;
  }

  /**
   * Process a full manifest: parse + classify + generate H7 data
   */
  async processManifest(buffer, options = {}) {
    const { delimiter = ',', carrier = 'OTHER', iossNumber = '' } = options;

    // Step 1: Parse CSV
    logger.info('Manifest: Parsing CSV...');
    const parsed = this.parseCSV(buffer, delimiter);
    logger.info(`Manifest: ${parsed.totalRows} rows parsed`);

    // Step 2: Classify with AI
    logger.info('Manifest: Classifying with AI...');
    const classificationsArray = await this.classifyWithAI(parsed.rows);

    // Build lookup by line number for reliable matching
    const classificationsByLine = {};
    classificationsArray.forEach(c => {
      if (c.line) classificationsByLine[c.line] = c;
    });

    // Step 3: Generate H7 declarations data
    const h7Declarations = [];
    const h1Required = [];
    const errors = [];

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      // Match by line number (from AI) or by array position as fallback
      const classification = classificationsByLine[row.lineNumber] || classificationsByLine[i + 1] || classificationsArray[i] || {};
      const value = parseFloat(row.value) || 0;

      // Override eligibility based on value (in case AI missed it)
      if (value > 150 && classification.eligible_h7 !== false) {
        classification.eligible_h7 = false;
        classification.reason = 'Valor supera 150 EUR, requiere H1';
      }

      if (!classification.eligible_h7) {
        h1Required.push({
          lineNumber: row.lineNumber,
          tracking: row.tracking,
          description: row.description,
          value: value,
          reason: classification.reason || 'Requiere declaracion H1'
        });
        continue;
      }

      // Validate required fields
      const rowErrors = [];
      if (!row.tracking) rowErrors.push('Falta tracking number');
      if (!row.description) rowErrors.push('Falta descripcion');
      if (!row.recipientName) rowErrors.push('Falta nombre destinatario');
      if (value <= 0) rowErrors.push('Valor debe ser > 0');

      if (rowErrors.length > 0) {
        errors.push({ lineNumber: row.lineNumber, tracking: row.tracking, errors: rowErrors });
        continue;
      }

      // Build H7 declaration data
      h7Declarations.push({
        lineNumber: row.lineNumber,
        trackingNumber: row.tracking,
        carrier: { code: carrier, name: carrier },
        iossNumber: row.iossNumber || iossNumber || '',
        sender: {
          name: row.senderName || 'REMITENTE DESCONOCIDO',
          address: { country: row.senderCountry || 'CN' }
        },
        recipient: {
          name: row.recipientName,
          taxId: row.recipientId || '',
          address: {
            street: row.recipientAddress || '',
            city: row.recipientCity || '',
            postalCode: row.recipientPostal || '',
            country: 'ES'
          }
        },
        items: [{
          description: classification.description_normalized || row.description,
          taricCode: (classification.hsCode || '000000').substring(0, 6),
          quantity: parseInt(row.quantity) || 1,
          unitValue: value,
          totalValue: value,
          netWeight: parseFloat(row.netWeight || row.weight) || 0.1,
          countryOfOrigin: row.senderCountry || 'CN'
        }],
        totals: {
          intrinsicValue: value,
          shippingCost: 0,
          grossWeight: parseFloat(row.weight) || 0.5,
          packages: 1
        },
        // AI classification metadata
        _aiClassification: classification
      });
    }

    return {
      summary: {
        totalRows: parsed.totalRows,
        h7Ready: h7Declarations.length,
        h1Required: h1Required.length,
        errors: errors.length,
        headers: parsed.headers,
        headerMap: parsed.headerMap
      },
      h7Declarations,
      h1Required,
      errors
    };
  }
}

module.exports = new ManifestService();
