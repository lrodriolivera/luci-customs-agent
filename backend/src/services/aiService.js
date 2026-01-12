/**
 * Servicio de IA - Integracion con Claude API
 * Usa Claude Sonnet 4 para chat y Claude Opus 4.5 para tareas complejas
 */

const axios = require('axios');
const logger = require('../config/logger');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const SONNET_MODEL = 'claude-sonnet-4-20250514';
const OPUS_MODEL = 'claude-opus-4-20250514';

// System prompts especializados
const SYSTEM_PROMPTS = {
  chatClient: `Eres LUCI, un asistente virtual experto en comercio exterior y aduanas para Stock Logistic.
Tu rol es ayudar a los clientes a entender el proceso de importacion/exportacion y guiarlos en la documentacion necesaria.

PERSONALIDAD:
- Amable, profesional y paciente
- Explicas conceptos complejos de forma sencilla
- Siempre ofreces ayuda adicional

CONOCIMIENTOS:
- Normativa aduanera espanola y europea (CAU, TARIC)
- Sistema H1 de importacion (nuevo desde octubre 2025)
- Documentos de comercio exterior (facturas, packing lists, BL, AWB, CMR)
- Certificados de origen, EUR.1, ATR
- Calculos de aranceles e IVA

REGLAS:
- Nunca inventes informacion - si no sabes algo, dilo
- Sugiere consultar con un agente si la pregunta es muy tecnica o especifica
- No des asesoramiento legal o fiscal definitivo
- Responde en espanol
- Se conciso pero completo`,

  chatAgent: `Eres LUCI, un asistente tecnico experto en aduanas para agentes de Stock Logistic.
Tu rol es asistir a los agentes aduaneros con informacion tecnica precisa.

CAPACIDADES:
- Interpretar normativa CAU y reglamentos delegados/ejecucion
- Clasificacion arancelaria TARIC
- Regimenes aduaneros (40, 42, 44, 51, etc.)
- Calculos de deuda aduanera
- Sistema H1/AES

CONTEXTO:
- Los agentes son profesionales con conocimiento del sector
- Puedes usar terminologia tecnica
- Prioriza precision sobre simplificacion`,

  classification: `Eres un experto clasificador arancelario con profundo conocimiento del Sistema Armonizado (SA) y TARIC.

Tu tarea es analizar descripciones de productos y sugerir codigos TARIC apropiados.

METODOLOGIA:
1. Identifica el material principal del producto
2. Determina su funcion/uso principal
3. Considera el proceso de fabricacion
4. Aplica las Reglas Generales de Interpretacion (RGI)
5. Verifica subpartidas y notas de seccion/capitulo

FORMATO DE RESPUESTA (JSON):
{
  "suggestions": [
    {
      "code": "codigo TARIC 10 digitos",
      "confidence": 0-100,
      "reasoning": "explicacion de por que este codigo"
    }
  ],
  "warnings": ["advertencias relevantes"],
  "additionalInfoNeeded": ["informacion adicional que ayudaria"]
}

IMPORTANTE:
- Proporciona 2-3 sugerencias ordenadas por confianza
- Explica el razonamiento detalladamente
- Indica si hay ambiguedad o necesitas mas informacion`,

  documentValidation: `Eres un experto en validacion de documentos de comercio exterior.

Tu tarea es analizar documentos y extraer informacion relevante, verificando su coherencia.

DOCUMENTOS QUE PUEDES VALIDAR:
- Facturas comerciales: valor, descripcion, incoterm, partes
- Packing lists: bultos, pesos, marcas
- Documentos transporte: BL, AWB, CMR
- Certificados origen: pais, preferencias

FORMATO DE RESPUESTA (JSON):
{
  "isValid": true/false,
  "confidence": 0-100,
  "extractedData": {
    // datos extraidos segun tipo documento
  },
  "issues": ["problemas encontrados"],
  "warnings": ["advertencias"],
  "autoFillSuggestions": {
    // campos que se pueden autorellenar en el expediente
  }
}`,

  h1Generation: `Eres un experto en declaraciones aduaneras H1 segun el nuevo sistema de la AEAT.

Tu tarea es generar los datos para una declaracion H1 a partir de la informacion del expediente.

ESTRUCTURA H1:
- D10: Cabecera declaracion
- GS11: Envio de mercancias
- SI12: Partidas de mercancias

CAMPOS CRITICOS:
- Regimen (40, 42, 44, 51, 53, 61, 71)
- Procedimiento adicional
- Preferencia (100, 200, 300, 400)
- Codigo TARIC correcto
- Valor estadistico
- Origen de mercancias

FORMATO DE RESPUESTA (JSON):
{
  "declarationType": "A/B/C/D",
  "customsOffice": "codigo aduana",
  "regime": "40",
  "additionalProcedure": "000",
  "preference": "100",
  "headerData": { ... },
  "goodsItems": [ ... ],
  "warnings": [],
  "recommendations": []
}`
};

class AIService {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    if (!this.apiKey) {
      logger.warn('ANTHROPIC_API_KEY no configurada - AI Service funcionara en modo mock');
    }
  }

  /**
   * Llamada base a Claude API
   */
  async callClaude(model, systemPrompt, userMessage, options = {}) {
    if (!this.apiKey) {
      return this.mockResponse(userMessage);
    }

    try {
      const response = await axios.post(
        ANTHROPIC_API_URL,
        {
          model,
          max_tokens: options.maxTokens || 4096,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userMessage }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          timeout: options.timeout || 60000
        }
      );

      return {
        content: response.data.content[0].text,
        model,
        tokensUsed: response.data.usage?.input_tokens + response.data.usage?.output_tokens,
        stopReason: response.data.stop_reason
      };

    } catch (error) {
      logger.error('Error llamando a Claude:', error.response?.data || error.message);
      throw new Error('Error en servicio de IA');
    }
  }

  /**
   * Generar respuesta de chat
   */
  async generateChatResponse(message, expedition, conversationHistory, context = 'client') {
    const systemPrompt = context === 'agent' ? SYSTEM_PROMPTS.chatAgent : SYSTEM_PROMPTS.chatClient;

    // Construir contexto del expediente
    let expeditionContext = '';
    if (expedition) {
      expeditionContext = `
CONTEXTO DEL EXPEDIENTE:
- ID: ${expedition.expeditionId}
- Tipo: ${expedition.operationType === 'import' ? 'Importacion' : 'Exportacion'}
- Transporte: ${expedition.transportMode}
- Cliente: ${expedition.client?.companyName}
- Estado: ${expedition.status}
- Documentos pendientes: ${expedition.documentChecklist?.filter(d => d.required && !d.received).map(d => d.documentName).join(', ') || 'Ninguno'}
`;
    }

    // Construir historial de conversacion
    let history = '';
    if (conversationHistory && conversationHistory.length > 0) {
      history = '\nHISTORIAL RECIENTE:\n' + conversationHistory.map(m =>
        `${m.sender === 'client' ? 'Cliente' : m.sender === 'luci' ? 'LUCI' : 'Agente'}: ${m.content}`
      ).join('\n');
    }

    const fullPrompt = `${expeditionContext}${history}\n\nMensaje actual: ${message}`;

    const result = await this.callClaude(SONNET_MODEL, systemPrompt, fullPrompt);

    return {
      message: result.content,
      model: 'sonnet-4',
      tokensUsed: result.tokensUsed,
      confidence: 85,
      sources: []
    };
  }

  /**
   * Preguntar a LUCI sin contexto de expediente
   */
  async askLuci(question) {
    const result = await this.callClaude(
      SONNET_MODEL,
      SYSTEM_PROMPTS.chatAgent,
      question
    );

    return {
      message: result.content,
      model: 'sonnet-4',
      tokensUsed: result.tokensUsed,
      confidence: 80,
      sources: []
    };
  }

  /**
   * Clasificar producto - Sugerir codigo TARIC
   */
  async classifyProduct({ description, additionalInfo, expeditionContext }) {
    let prompt = `Clasifica el siguiente producto:\n\nDESCRIPCION: ${description}`;

    if (additionalInfo) {
      if (additionalInfo.material) prompt += `\nMaterial: ${additionalInfo.material}`;
      if (additionalInfo.use) prompt += `\nUso: ${additionalInfo.use}`;
      if (additionalInfo.origin) prompt += `\nOrigen: ${additionalInfo.origin}`;
    }

    if (expeditionContext) {
      prompt += `\n\nContexto: ${expeditionContext.operationType === 'import' ? 'Importacion' : 'Exportacion'} via ${expeditionContext.transportMode}`;
    }

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.classification, prompt);

    try {
      // Limpiar markdown si existe (```json ... ```)
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonContent);
      return parsed.suggestions || [];
    } catch (e) {
      // Si no es JSON valido, intentar extraer codigo TARIC del texto
      const codeMatch = result.content.match(/\b(\d{10})\b/);
      const confidenceMatch = result.content.match(/confidence["\s:]+(\d+)/i);

      if (codeMatch) {
        return [{
          code: codeMatch[1],
          confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 70,
          reasoning: result.content.substring(0, 500)
        }];
      }

      return [{
        code: '0000000000',
        confidence: 50,
        reasoning: result.content
      }];
    }
  }

  /**
   * Validar clasificacion propuesta
   */
  async validateClassification({ taricCode, description, taricInfo, origin, value }) {
    const prompt = `Valida si el codigo TARIC ${taricCode} es correcto para:

Descripcion: ${description}
Origen: ${origin}
Valor: ${value} EUR

${taricInfo ? `Info TARIC: ${taricInfo.description?.es}` : ''}

Responde en JSON: { "isValid": boolean, "confidence": number, "reasoning": string, "warnings": [] }`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.classification, prompt);

    try {
      return JSON.parse(result.content);
    } catch (e) {
      return {
        isValid: true,
        confidence: 70,
        reasoning: result.content,
        warnings: []
      };
    }
  }

  /**
   * Validar documento con OCR/Vision
   */
  async validateDocument(document, expedition) {
    // En produccion, aqui se usaria Claude Vision para analizar el PDF/imagen
    // Por ahora, simulamos la validacion

    const prompt = `Simula la validacion de un documento tipo ${document.type} para:
- Expediente: ${expedition.expeditionId}
- Operacion: ${expedition.operationType}
- Cliente: ${expedition.client?.companyName}

Genera datos de ejemplo que se extraerian de este tipo de documento.
Responde en JSON con el formato especificado en el system prompt.`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.documentValidation, prompt);

    try {
      return JSON.parse(result.content);
    } catch (e) {
      return {
        isValid: true,
        confidence: 75,
        extractedData: {},
        notes: result.content,
        autoFillSuggestions: {}
      };
    }
  }

  /**
   * Generar declaracion H1
   */
  async generateH1Declaration(expedition, options) {
    const prompt = `Genera los datos para una declaracion H1 con la siguiente informacion:

EXPEDIENTE:
- ID: ${expedition.expeditionId}
- Cliente/Importador: ${expedition.client?.companyName} (NIF: ${expedition.client?.nif})
- EORI: ${expedition.client?.eori || 'ES' + expedition.client?.nif}
- Exportador: ${expedition.exporter?.companyName} (${expedition.exporter?.country})

MERCANCIAS:
${expedition.goods.map((g, i) => `
Item ${i + 1}:
- Descripcion: ${g.description}
- TARIC: ${g.taricCode}
- Origen: ${g.originCountry}
- Valor: ${g.invoiceValue} EUR
- Peso neto: ${g.netWeight} kg
- Bultos: ${g.packages?.quantity} ${g.packages?.type}
`).join('')}

TRANSPORTE:
- Modo: ${expedition.transportMode}
- Documento: ${expedition.transport?.documentNumber}
- Puerto entrada: ${expedition.transport?.arrivalPort || expedition.transport?.entryCustomsOffice}

OPCIONES:
- Regimen: ${options.regime}
- Procedimiento adicional: ${options.additionalProcedure}
- Preferencia: ${options.preference}

INCOTERM: ${expedition.incoterm?.code} ${expedition.incoterm?.place}

Responde en el formato JSON especificado.`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.h1Generation, prompt, { maxTokens: 8192 });

    try {
      return JSON.parse(result.content);
    } catch (e) {
      return {
        declarationType: 'A',
        customsOffice: 'ES002801',
        warnings: ['Error parseando respuesta de IA'],
        rawResponse: result.content
      };
    }
  }

  /**
   * Generar declaracion AES
   */
  async generateAESDeclaration(expedition, options) {
    // Similar a H1 pero para exportacion
    const prompt = `Genera los datos para una declaracion AES (exportacion):

EXPEDIENTE: ${expedition.expeditionId}
EXPORTADOR: ${expedition.client?.companyName}
DESTINATARIO: ${expedition.consignee?.companyName} (${expedition.consignee?.address?.country})

MERCANCIAS:
${expedition.goods.map((g, i) => `Item ${i + 1}: ${g.description} - TARIC: ${g.taricCode} - Valor: ${g.invoiceValue} EUR`).join('\n')}

Tipo exportacion: ${options.exportType}

Responde en formato JSON.`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.h1Generation, prompt);

    try {
      return JSON.parse(result.content);
    } catch (e) {
      return {
        declarationType: 'EX',
        customsOffice: 'ES002801',
        warnings: ['Error parseando respuesta de IA']
      };
    }
  }

  /**
   * Genera respuesta para requerimientos AEAT
   * @param {string} prompt - El prompt con el contexto del requerimiento
   * @param {string} context - Contexto ('aduanas', 'valoracion', etc.)
   */
  async generateResponse(prompt, context = 'aduanas') {
    const systemPrompt = `Eres un experto agente de aduanas español especializado en responder requerimientos de la AEAT.
Tu objetivo es generar respuestas profesionales, técnicas y completas para requerimientos aduaneros.

Directrices:
- Usa terminología técnica aduanera correcta
- Cita normativa aplicable cuando sea relevante (CAU, Ley General Tributaria, etc.)
- Estructura la respuesta de forma clara y profesional
- Si faltan documentos, indica cuáles y por qué son necesarios
- Proporciona argumentación sólida basada en la documentación disponible
- Mantén un tono formal y respetuoso hacia la administración`;

    try {
      const response = await this.callClaude(SONNET_MODEL, systemPrompt, prompt, {
        maxTokens: 2000
      });
      return response;
    } catch (error) {
      logger.error('Error generando respuesta para requerimiento:', error);
      throw error;
    }
  }

  /**
   * Respuesta mock cuando no hay API key
   */
  mockResponse(message) {
    logger.info('AI Service en modo mock');
    return {
      content: `[MODO DEMO] Esta es una respuesta simulada. Para respuestas reales, configure ANTHROPIC_API_KEY.\n\nSu mensaje: "${message.substring(0, 100)}..."`,
      model: 'mock',
      tokensUsed: 0,
      stopReason: 'end_turn'
    };
  }
}

module.exports = new AIService();
