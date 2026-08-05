/**
 * Regulation Service - BOE and EUR-Lex Integration
 * Searches Spanish (BOE) and European (EUR-Lex) regulations
 *
 * STRIX AI - LUCI Customs Agent
 */

const axios = require('axios');
const logger = require('../config/logger');

// BOE API Configuration
const BOE_API_BASE = 'https://www.boe.es/datosabiertos/api';
const BOE_LEGISLATION_ENDPOINT = '/legislacion-consolidada';

// EUR-Lex Configuration
const EURLEX_CELLAR_BASE = 'https://publications.europa.eu/resource/cellar';
const EURLEX_SEARCH_BASE = 'https://eur-lex.europa.eu/search.html';

// BOE - Normativa aduanera española
const BOE_REGULATIONS = {
  'LGT': {
    id: 'BOE-A-2003-23186',
    title: 'Ley 58/2003, de 17 de diciembre, General Tributaria',
    shortName: 'LGT',
    description: 'Ley General Tributaria - marco jurídico fiscal aplicable a operaciones aduaneras',
    type: 'Ley',
    department: 'Jefatura del Estado',
    date: '2003-12-18'
  },
  'LIVA': {
    id: 'BOE-A-1992-28740',
    title: 'Ley 37/1992, de 28 de diciembre, del Impuesto sobre el Valor Añadido',
    shortName: 'LIVA',
    description: 'Ley del IVA - importaciones, exportaciones y operaciones intracomunitarias',
    type: 'Ley',
    department: 'Jefatura del Estado',
    date: '1992-12-29'
  },
  'LIIE': {
    id: 'BOE-A-1992-28741',
    title: 'Ley 38/1992, de 28 de diciembre, de Impuestos Especiales',
    shortName: 'LIIE',
    description: 'Ley de Impuestos Especiales - alcohol, tabaco, hidrocarburos, electricidad',
    type: 'Ley',
    department: 'Jefatura del Estado',
    date: '1992-12-29'
  },
  'RD_IIEE': {
    id: 'BOE-A-1995-25202',
    title: 'Real Decreto 1165/1995, de 7 de julio, Reglamento de los Impuestos Especiales',
    shortName: 'RD IIEE',
    description: 'Reglamento de Impuestos Especiales - desarrollo de la LIIE',
    type: 'Real Decreto',
    department: 'Ministerio de Economía y Hacienda',
    date: '1995-07-28'
  },
  'RD_IVA': {
    id: 'BOE-A-1992-28925',
    title: 'Real Decreto 1624/1992, de 29 de diciembre, Reglamento del IVA',
    shortName: 'RD IVA',
    description: 'Reglamento del IVA - desarrollo de la LIVA',
    type: 'Real Decreto',
    department: 'Ministerio de Economía y Hacienda',
    date: '1992-12-31'
  },
  'LO_CONTRABANDO': {
    id: 'BOE-A-1995-8606',
    title: 'Ley Orgánica 12/1995, de 12 de diciembre, de Represión del Contrabando',
    shortName: 'LO Contrabando',
    description: 'Ley de represión del contrabando - infracciones y sanciones',
    type: 'Ley Orgánica',
    department: 'Jefatura del Estado',
    date: '1995-12-13'
  },
  'RD_CONTRABANDO': {
    id: 'BOE-A-2014-12820',
    title: 'Real Decreto 1649/1998, Reglamento de la Ley de Contrabando',
    shortName: 'RD Contrabando',
    description: 'Desarrollo reglamentario de la Ley de Contrabando',
    type: 'Real Decreto',
    department: 'Ministerio de Economía y Hacienda',
    date: '1998-07-25'
  },
  'ORDEN_DECLARACIONES': {
    id: 'BOE-A-2023-24840',
    title: 'Orden HFP/1298/2023, modelos de declaración aduanera',
    shortName: 'Orden Declaraciones',
    description: 'Modelos de declaración aduanera H1 a H7 y formularios DUA',
    type: 'Orden',
    department: 'Ministerio de Hacienda y Función Pública',
    date: '2023-12-05'
  },
  'RES_DESPACHO': {
    id: 'BOE-A-2020-17385',
    title: 'Resolución de 18 de diciembre de 2020, procedimientos de despacho aduanero',
    shortName: 'Res Despacho',
    description: 'Procedimientos de despacho aduanero de la AEAT',
    type: 'Resolución',
    department: 'AEAT',
    date: '2020-12-28'
  },
  'RD_FRANQUICIAS': {
    id: 'BOE-A-2008-4938',
    title: 'Real Decreto 1299/2007, Reglamento de Franquicias y Exenciones',
    shortName: 'RD Franquicias',
    description: 'Franquicias y exenciones en régimen de viajeros y otros',
    type: 'Real Decreto',
    department: 'Ministerio de Economía y Hacienda',
    date: '2008-03-19'
  },
  'ORDEN_OEA': {
    id: 'BOE-A-2015-3833',
    title: 'Orden HAP/428/2015, requisitos OEA',
    shortName: 'Orden OEA',
    description: 'Operador Económico Autorizado - requisitos y procedimientos',
    type: 'Orden',
    department: 'Ministerio de Hacienda y Administraciones Públicas',
    date: '2015-03-20'
  },
  'LEY_ADUANAS': {
    id: 'BOE-A-2014-12328',
    title: 'Ley 9/2014, General de Telecomunicaciones (Título VII - Aduanas)',
    shortName: 'Ley Aduanas',
    description: 'Disposiciones aduaneras para equipos de telecomunicaciones',
    type: 'Ley',
    department: 'Jefatura del Estado',
    date: '2014-05-10'
  },
  'RD_GARANTIAS': {
    id: 'BOE-A-2007-22389',
    title: 'Real Decreto 335/2010, Reglamento de Garantías Aduaneras',
    shortName: 'RD Garantías',
    description: 'Garantías aduaneras - constitución, utilización y cancelación',
    type: 'Real Decreto',
    department: 'Ministerio de Economía y Hacienda',
    date: '2010-03-20'
  },
  'ORDEN_TRANSITO': {
    id: 'BOE-A-2021-9512',
    title: 'Orden HFP/532/2021, régimen de tránsito',
    shortName: 'Orden Tránsito',
    description: 'Régimen de tránsito común y comunitario - NCTS',
    type: 'Orden',
    department: 'Ministerio de Hacienda y Función Pública',
    date: '2021-06-01'
  },
  'RES_ADUANA_DIGITALIZADA': {
    id: 'BOE-A-2022-4523',
    title: 'Resolución de 10 de marzo de 2022, Aduana Digitalizada',
    shortName: 'Res Aduana Digital',
    description: 'Sistema de Aduana Digitalizada de la AEAT',
    type: 'Resolución',
    department: 'AEAT',
    date: '2022-03-23'
  }
};

// CELEX numbers for common customs regulations
const CAU_REGULATIONS = {
  'CAU_BASE': {
    celex: '32013R0952',
    title: 'Reglamento (UE) n° 952/2013 - Código Aduanero de la Unión',
    shortName: 'CAU',
    description: 'Código principal que regula todas las operaciones aduaneras en la UE'
  },
  'CAU_DA': {
    celex: '32015R2446',
    title: 'Reglamento Delegado (UE) 2015/2446 - Actos delegados CAU',
    shortName: 'DA-CAU',
    description: 'Complementa el CAU con disposiciones detalladas sobre procedimientos'
  },
  'CAU_IA': {
    celex: '32015R2447',
    title: 'Reglamento de Ejecución (UE) 2015/2447 - Actos de ejecución CAU',
    shortName: 'IA-CAU',
    description: 'Normas técnicas y procedimentales para aplicar el CAU'
  },
  'CAU_TDA': {
    celex: '32016R0341',
    title: 'Reglamento Delegado Transitorio (UE) 2016/341',
    shortName: 'TDA-CAU',
    description: 'Disposiciones transitorias hasta implementación completa del CAU'
  },
  'TARIC': {
    celex: '32019R1776',
    title: 'Reglamento de Ejecución (UE) 2019/1776 - TARIC',
    shortName: 'TARIC',
    description: 'Arancel Integrado de las Comunidades Europeas'
  },
  'NOMENCLATURA_COMBINADA': {
    celex: '32023R2364',
    title: 'Reglamento de Ejecución (UE) 2023/2364 - Nomenclatura Combinada 2024',
    shortName: 'NC-2024',
    description: 'Nomenclatura Combinada vigente para clasificación arancelaria'
  },
  'OEA': {
    celex: '32015R2447',
    title: 'Reglamento de Ejecución (UE) 2015/2447 - Título II Cap. 2 (OEA)',
    shortName: 'OEA',
    description: 'Artículos 24-35: Criterios y procedimientos OEA'
  },
  'ORIGEN': {
    celex: '32015R2446',
    title: 'Reglamento Delegado (UE) 2015/2446 - Título II (Origen)',
    shortName: 'ORIGEN',
    description: 'Artículos 37-70: Normas de origen de las mercancías'
  },
  'VALOR': {
    celex: '32015R2446',
    title: 'Reglamento Delegado (UE) 2015/2446 - Título II Cap. 3 (Valor)',
    shortName: 'VALOR',
    description: 'Artículos 71-76: Valor en aduana de las mercancías'
  },
  'ICS2': {
    celex: '32019R1131',
    title: 'Reglamento de Ejecución (UE) 2019/1131 - ICS2',
    shortName: 'ICS2',
    description: 'Sistema de Control de Importaciones - Declaración sumaria de entrada'
  }
};

class RegulationService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Search BOE (Boletín Oficial del Estado)
   * Uses the legislacion-consolidada API endpoint
   * @param {Object} params - Search parameters
   * @param {string} params.query - Search query (will filter results client-side)
   * @param {string} params.dateFrom - Start date (YYYYMMDD format)
   * @param {string} params.dateTo - End date (YYYYMMDD format)
   * @param {number} params.limit - Max results
   */
  async searchBOE(params = {}) {
    try {
      const { query, dateFrom, dateTo, limit = 50 } = params;

      // Build search URL - BOE API uses specific parameters
      const urlParams = new URLSearchParams();
      urlParams.append('limit', Math.min(limit, 100).toString());

      // Add date filters if provided
      if (dateFrom) {
        urlParams.append('from', dateFrom.replace(/-/g, ''));
      }
      if (dateTo) {
        urlParams.append('to', dateTo.replace(/-/g, ''));
      }

      const searchUrl = `${BOE_API_BASE}${BOE_LEGISLATION_ENDPOINT}?${urlParams.toString()}`;
      logger.info(`BOE search URL: ${searchUrl}`);

      const response = await axios.get(searchUrl, {
        headers: {
          'Accept': 'application/json'
        },
        timeout: 20000
      });

      // Process BOE response and filter by query if provided
      let results = this.parseBOEResponse(response.data, 100);

      // Client-side filtering by query (BOE API doesn't support text search well)
      if (query) {
        const queryLower = query.toLowerCase();
        results = results.filter(item =>
          item.title?.toLowerCase().includes(queryLower) ||
          item.department?.toLowerCase().includes(queryLower) ||
          item.summary?.toLowerCase().includes(queryLower)
        );
      }

      return {
        source: 'BOE',
        query: query,
        totalResults: results.length,
        results: results.slice(0, limit),
        fromAPI: true
      };

    } catch (error) {
      logger.error('Error searching BOE:', error.message);

      // Return curated customs-related BOE results as fallback
      return this.getCuratedBOEResults(params.query);
    }
  }

  /**
   * Parse BOE API response (legislacion-consolidada format)
   */
  parseBOEResponse(data, limit) {
    const results = [];

    if (!data || !data.data) {
      return results;
    }

    const items = Array.isArray(data.data) ? data.data : [data.data];

    for (const item of items.slice(0, limit)) {
      // Format date from YYYYMMDD to YYYY-MM-DD
      const formatDate = (d) => {
        if (!d || d.length !== 8) return d;
        return `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`;
      };

      results.push({
        id: item.identificador,
        title: item.titulo,
        type: item.rango?.texto || 'Disposición',
        date: formatDate(item.fecha_publicacion),
        department: item.departamento?.texto,
        summary: `${item.rango?.texto || ''} ${item.numero_oficial || ''} - ${item.ambito?.texto || ''}`.trim(),
        url: item.url_html_consolidada || item.url_eli || `https://www.boe.es/buscar/act.php?id=${item.identificador}`,
        pdfUrl: item.url_eli ? `${item.url_eli}/pdf` : null,
        htmlUrl: item.url_html_consolidada,
        eliUrl: item.url_eli,
        vigente: item.vigencia_agotada === 'N',
        source: 'BOE'
      });
    }

    return results;
  }

  /**
   * Get curated BOE results for customs-related searches
   */
  getCuratedBOEResults(query) {
    const curatedResults = [
      {
        id: 'BOE-A-2014-12329',
        title: 'Ley 58/2003, de 17 de diciembre, General Tributaria',
        type: 'Ley',
        date: '2003-12-18',
        department: 'Jefatura del Estado',
        summary: 'Ley General Tributaria - normativa fiscal aplicable a aduanas',
        url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2003-23186',
        htmlUrl: 'https://www.boe.es/buscar/act.php?id=BOE-A-2003-23186',
        vigente: true,
        source: 'BOE'
      },
      {
        id: 'BOE-A-1995-25202',
        title: 'Real Decreto 1165/1995, de 7 de julio, Reglamento de los Impuestos Especiales',
        type: 'Real Decreto',
        date: '1995-07-28',
        department: 'Ministerio de Economía y Hacienda',
        summary: 'Reglamento de Impuestos Especiales - bebidas alcohólicas, tabaco, hidrocarburos',
        url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1995-25202',
        htmlUrl: 'https://www.boe.es/buscar/act.php?id=BOE-A-1995-25202',
        vigente: true,
        source: 'BOE'
      },
      {
        id: 'BOE-A-1992-28740',
        title: 'Ley 37/1992, de 28 de diciembre, del Impuesto sobre el Valor Añadido',
        type: 'Ley',
        date: '1992-12-29',
        department: 'Jefatura del Estado',
        summary: 'Ley del IVA - importaciones y operaciones aduaneras',
        url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740',
        htmlUrl: 'https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740',
        vigente: true,
        source: 'BOE'
      },
      {
        id: 'BOE-A-2023-24840',
        title: 'Orden HFP/1298/2023, de 27 de noviembre, modelos de declaración aduanera',
        type: 'Orden',
        date: '2023-12-05',
        department: 'Ministerio de Hacienda y Función Pública',
        summary: 'Modelos de declaración aduanera - formularios H1, H7',
        url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2023-24840',
        htmlUrl: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2023-24840',
        vigente: true,
        source: 'BOE'
      },
      {
        id: 'BOE-A-2020-17385',
        title: 'Resolución de 18 de diciembre de 2020, sobre el despacho aduanero',
        type: 'Resolución',
        date: '2020-12-28',
        department: 'Agencia Estatal de Administración Tributaria',
        summary: 'Procedimientos de despacho aduanero AEAT',
        url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2020-17385',
        htmlUrl: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2020-17385',
        vigente: true,
        source: 'BOE'
      }
    ];

    // Filter by query if provided
    let results = curatedResults;
    if (query) {
      const queryLower = query.toLowerCase();
      results = curatedResults.filter(item =>
        item.title.toLowerCase().includes(queryLower) ||
        item.summary.toLowerCase().includes(queryLower) ||
        item.department.toLowerCase().includes(queryLower)
      );
    }

    return {
      source: 'BOE',
      query: query,
      totalResults: results.length,
      results: results,
      curated: true,
      note: 'Resultados curados de normativa aduanera española'
    };
  }

  /**
   * Search EUR-Lex for European regulations
   * @param {Object} params - Search parameters
   * @param {string} params.query - Search query
   * @param {string} params.type - Document type (regulation, directive, decision)
   * @param {string} params.year - Year filter
   */
  async searchEURLex(params = {}) {
    try {
      const { query, type, year, limit = 20 } = params;

      // For common CAU regulations, return from our catalog first
      const catalogResults = this.searchCAUCatalog(query);
      if (catalogResults.length > 0) {
        return {
          source: 'EUR-Lex',
          query: query,
          totalResults: catalogResults.length,
          results: catalogResults,
          fromCatalog: true
        };
      }

      // EUR-Lex has a REST API through CELLAR
      // For searches, we'll use a simplified approach
      const searchUrl = this.buildEURLexSearchUrl(query, type, year);

      logger.info(`EUR-Lex search: ${query}`);

      // Note: EUR-Lex SPARQL endpoint would be more comprehensive
      // but requires more complex queries. For now, we'll use web scraping fallback
      const response = await axios.get(searchUrl, {
        headers: {
          'Accept': 'text/html'
        },
        timeout: 15000
      });

      // Parse results from HTML (simplified)
      const results = this.parseEURLexHTML(response.data, limit);

      return {
        source: 'EUR-Lex',
        query: query,
        totalResults: results.length,
        results: results
      };

    } catch (error) {
      logger.error('Error searching EUR-Lex:', error.message);

      // Return mock/catalog data
      return this.getMockEURLexResults(params.query);
    }
  }

  /**
   * Search CAU catalog for common regulations
   */
  searchCAUCatalog(query) {
    const results = [];
    const queryLower = query?.toLowerCase() || '';

    for (const [key, reg] of Object.entries(CAU_REGULATIONS)) {
      if (
        key.toLowerCase().includes(queryLower) ||
        reg.title.toLowerCase().includes(queryLower) ||
        reg.shortName.toLowerCase().includes(queryLower) ||
        reg.celex.includes(query)
      ) {
        results.push({
          id: reg.celex,
          celex: reg.celex,
          title: reg.title,
          shortName: reg.shortName,
          type: 'Reglamento UE',
          url: `https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:${reg.celex}`,
          pdfUrl: `https://eur-lex.europa.eu/legal-content/ES/TXT/PDF/?uri=CELEX:${reg.celex}`,
          source: 'EUR-Lex'
        });
      }
    }

    return results;
  }

  /**
   * Build EUR-Lex search URL
   */
  buildEURLexSearchUrl(query, type, year) {
    const params = new URLSearchParams({
      'lang': 'es',
      'text': query || '',
      'qid': Date.now().toString()
    });

    if (type) {
      params.append('type', type);
    }

    if (year) {
      params.append('DD_YEAR', year);
    }

    return `${EURLEX_SEARCH_BASE}?${params.toString()}`;
  }

  /**
   * Parse EUR-Lex HTML response (simplified)
   */
  parseEURLexHTML(html, limit) {
    // This is a simplified parser - in production, consider using cheerio
    const results = [];

    // Extract CELEX numbers and titles using regex
    const celexPattern = /CELEX[:\s]*([\d\w]+)/g;
    const matches = html.match(celexPattern) || [];

    for (const match of matches.slice(0, limit)) {
      const celex = match.replace(/CELEX[:\s]*/, '');
      results.push({
        id: celex,
        celex: celex,
        title: `Documento CELEX: ${celex}`,
        type: 'Documento UE',
        url: `https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:${celex}`,
        pdfUrl: `https://eur-lex.europa.eu/legal-content/ES/TXT/PDF/?uri=CELEX:${celex}`,
        source: 'EUR-Lex'
      });
    }

    return results;
  }

  /**
   * Get full document content
   * @param {string} source - 'BOE' or 'EUR-Lex'
   * @param {string} id - Document identifier
   */
  async getDocumentContent(source, id) {
    const cacheKey = `${source}:${id}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      let content;

      if (source === 'BOE') {
        content = await this.getBOEDocument(id);
      } else if (source === 'EUR-Lex') {
        content = await this.getEURLexDocument(id);
      } else {
        throw new Error('Fuente no válida');
      }

      // Cache result
      this.cache.set(cacheKey, {
        data: content,
        timestamp: Date.now()
      });

      return content;

    } catch (error) {
      logger.error(`Error getting document ${id} from ${source}:`, error.message);
      throw new Error(`Error obteniendo documento: ${error.message}`);
    }
  }

  /**
   * Get BOE document content
   */
  async getBOEDocument(id) {
    try {
      // Try to get HTML version first
      const htmlUrl = `https://www.boe.es/buscar/act.php?id=${id}`;
      const response = await axios.get(htmlUrl, { timeout: 15000 });

      // Extract text content from HTML (simplified)
      const textContent = this.extractTextFromHTML(response.data);

      return {
        id: id,
        source: 'BOE',
        url: htmlUrl,
        content: textContent,
        contentType: 'html',
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error fetching BOE document ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Get EUR-Lex document content
   */
  async getEURLexDocument(celex) {
    try {
      // Get HTML version
      const htmlUrl = `https://eur-lex.europa.eu/legal-content/ES/TXT/HTML/?uri=CELEX:${celex}`;
      const response = await axios.get(htmlUrl, { timeout: 20000 });

      // Extract text content
      const textContent = this.extractTextFromHTML(response.data);

      return {
        id: celex,
        celex: celex,
        source: 'EUR-Lex',
        url: htmlUrl,
        content: textContent,
        contentType: 'html',
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error fetching EUR-Lex document ${celex}:`, error.message);
      throw error;
    }
  }

  /**
   * Extract text from HTML (simplified)
   */
  extractTextFromHTML(html) {
    // Remove scripts and styles
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    // Remove HTML tags but keep content
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Search specific article within a regulation
   * @param {string} celex - CELEX number
   * @param {string} article - Article number
   */
  async searchArticle(celex, article) {
    try {
      const doc = await this.getDocumentContent('EUR-Lex', celex);

      // Search for article pattern
      const articlePatterns = [
        new RegExp(`Artículo\\s*${article}[^0-9]`, 'gi'),
        new RegExp(`Art\\.?\\s*${article}[^0-9]`, 'gi')
      ];

      let found = false;
      let excerpt = '';

      for (const pattern of articlePatterns) {
        // OJO: String.match con flag /g devuelve un array de coincidencias SIN
        // propiedad .index, por lo que "match.index !== undefined" era siempre
        // falso y searchArticle NUNCA encontraba nada (found:false para todo
        // articulo, incluso existiendo). Se usa RegExp.exec, que si expone .index.
        const match = pattern.exec(doc.content);
        if (match && match.index !== undefined) {
          found = true;
          // Extract surrounding text (context)
          const start = Math.max(0, match.index - 100);
          const end = Math.min(doc.content.length, match.index + 2000);
          excerpt = doc.content.substring(start, end);
          break;
        }
      }

      return {
        celex: celex,
        article: article,
        found: found,
        excerpt: excerpt,
        url: `https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:${celex}#${article}`
      };

    } catch (error) {
      logger.error(`Error searching article ${article} in ${celex}:`, error.message);
      throw error;
    }
  }

  /**
   * Get CAU regulations catalog
   */
  getCAUCatalog() {
    return Object.entries(CAU_REGULATIONS).map(([key, reg]) => ({
      key: key,
      ...reg,
      url: `https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:${reg.celex}`,
      pdfUrl: `https://eur-lex.europa.eu/legal-content/ES/TXT/PDF/?uri=CELEX:${reg.celex}`
    }));
  }

  /**
   * Get BOE regulations catalog
   */
  getBOECatalog() {
    return Object.entries(BOE_REGULATIONS).map(([key, reg]) => ({
      key: key,
      ...reg,
      url: `https://www.boe.es/buscar/act.php?id=${reg.id}`,
      pdfUrl: `https://www.boe.es/boe/dias/${reg.date?.replace(/-/g, '/')}/${reg.id.replace('BOE-A-', 'BOE-A-')}.pdf`,
      htmlUrl: `https://www.boe.es/buscar/act.php?id=${reg.id}`,
      source: 'BOE'
    }));
  }

  /**
   * EUR-Lex catalog results (uses local catalog + web search fallback)
   */
  getMockEURLexResults(query) {
    const catalogResults = this.searchCAUCatalog(query);

    if (catalogResults.length > 0) {
      return {
        source: 'EUR-Lex',
        query: query,
        totalResults: catalogResults.length,
        results: catalogResults,
        fromCatalog: true
      };
    }

    return {
      source: 'EUR-Lex',
      query: query,
      totalResults: 5,
      results: [
        {
          id: '32013R0952',
          celex: '32013R0952',
          title: 'Reglamento (UE) n° 952/2013 - Código Aduanero de la Unión (CAU)',
          shortName: 'CAU',
          type: 'Reglamento UE',
          url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952',
          pdfUrl: 'https://eur-lex.europa.eu/legal-content/ES/TXT/PDF/?uri=CELEX:32013R0952',
          source: 'EUR-Lex'
        },
        {
          id: '32015R2446',
          celex: '32015R2446',
          title: 'Reglamento Delegado (UE) 2015/2446 - Actos delegados CAU',
          shortName: 'DA-CAU',
          type: 'Reglamento Delegado UE',
          url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32015R2446',
          pdfUrl: 'https://eur-lex.europa.eu/legal-content/ES/TXT/PDF/?uri=CELEX:32015R2446',
          source: 'EUR-Lex'
        },
        {
          id: '32015R2447',
          celex: '32015R2447',
          title: 'Reglamento de Ejecución (UE) 2015/2447 - Actos de ejecución CAU',
          shortName: 'IA-CAU',
          type: 'Reglamento de Ejecución UE',
          url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32015R2447',
          pdfUrl: 'https://eur-lex.europa.eu/legal-content/ES/TXT/PDF/?uri=CELEX:32015R2447',
          source: 'EUR-Lex'
        }
      ],
      isMock: true
    };
  }

  /**
   * Combined search across both sources
   */
  async searchAll(query, options = {}) {
    try {
      const [boeResults, eurlexResults] = await Promise.allSettled([
        this.searchBOE({ query, ...options }),
        this.searchEURLex({ query, ...options })
      ]);

      return {
        query: query,
        boe: boeResults.status === 'fulfilled' ? boeResults.value : { error: boeResults.reason?.message, results: [] },
        eurlex: eurlexResults.status === 'fulfilled' ? eurlexResults.value : { error: eurlexResults.reason?.message, results: [] },
        totalResults: (boeResults.value?.results?.length || 0) + (eurlexResults.value?.results?.length || 0)
      };
    } catch (error) {
      logger.error('Error in combined search:', error.message);
      throw error;
    }
  }
}

module.exports = new RegulationService();
