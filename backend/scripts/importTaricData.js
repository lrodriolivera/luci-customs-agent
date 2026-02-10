#!/usr/bin/env node

/**
 * Script para importar datos TARIC de la Comision Europea a MongoDB
 *
 * Fuentes de datos:
 * 1. API REST TARIC UE: https://ec.europa.eu/taxation_customs/dds2/taric/
 * 2. Archivos descargables en formato XML
 * 3. Datos pre-procesados incluidos
 *
 * Uso:
 *   node scripts/importTaricData.js [--chapters=01,02,03] [--full] [--update-only]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('../src/config/logger');

// Importar modelo
const TaricCode = require('../src/models/TaricCode');

// Configuracion
const CONFIG = {
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/luci-customs',

  // API TARIC UE - Nomenclatura Combinada
  taricApiBase: 'https://ec.europa.eu/taxation_customs/dds2/taric/',

  // API Access2Markets (mas moderna)
  access2MarketsApi: 'https://trade.ec.europa.eu/access-to-markets/api/v1/',

  // Batch size para inserts
  batchSize: 100,

  // Delay entre requests para no sobrecargar la API
  requestDelay: 500
};

// Datos pre-procesados de capitulos TARIC (base)
const TARIC_CHAPTERS = [
  { code: '01', description: { es: 'Animales vivos', en: 'Live animals' } },
  { code: '02', description: { es: 'Carne y despojos comestibles', en: 'Meat and edible meat offal' } },
  { code: '03', description: { es: 'Pescados, crustaceos y moluscos', en: 'Fish, crustaceans and molluscs' } },
  { code: '04', description: { es: 'Leche, huevos, miel', en: 'Dairy, eggs, honey' } },
  { code: '05', description: { es: 'Productos de origen animal', en: 'Products of animal origin' } },
  { code: '06', description: { es: 'Plantas vivas y floricultura', en: 'Live plants and floriculture' } },
  { code: '07', description: { es: 'Legumbres, hortalizas, raices', en: 'Vegetables, roots and tubers' } },
  { code: '08', description: { es: 'Frutas y frutos comestibles', en: 'Edible fruits and nuts' } },
  { code: '09', description: { es: 'Cafe, te, yerba mate y especias', en: 'Coffee, tea, mate and spices' } },
  { code: '10', description: { es: 'Cereales', en: 'Cereals' } },
  { code: '11', description: { es: 'Productos de la molineria', en: 'Milling products' } },
  { code: '12', description: { es: 'Semillas oleaginosas', en: 'Oil seeds and oleaginous fruits' } },
  { code: '13', description: { es: 'Gomas, resinas', en: 'Lac, gums, resins' } },
  { code: '14', description: { es: 'Materias trenzables', en: 'Vegetable plaiting materials' } },
  { code: '15', description: { es: 'Grasas y aceites', en: 'Animal or vegetable fats and oils' } },
  { code: '16', description: { es: 'Preparaciones de carne', en: 'Preparations of meat or fish' } },
  { code: '17', description: { es: 'Azucares y articulos de confiteria', en: 'Sugars and sugar confectionery' } },
  { code: '18', description: { es: 'Cacao y sus preparaciones', en: 'Cocoa and cocoa preparations' } },
  { code: '19', description: { es: 'Preparaciones de cereales', en: 'Preparations of cereals' } },
  { code: '20', description: { es: 'Preparaciones de legumbres', en: 'Preparations of vegetables' } },
  { code: '21', description: { es: 'Preparaciones alimenticias diversas', en: 'Miscellaneous edible preparations' } },
  { code: '22', description: { es: 'Bebidas, liquidos alcoholicos', en: 'Beverages, spirits and vinegar' } },
  { code: '23', description: { es: 'Residuos de industrias alimentarias', en: 'Food industry residues' } },
  { code: '24', description: { es: 'Tabaco y sucedaneos', en: 'Tobacco and manufactured substitutes' } },
  { code: '25', description: { es: 'Sal, azufre, tierras, piedras', en: 'Salt, sulphur, earths and stone' } },
  { code: '26', description: { es: 'Minerales, escorias', en: 'Ores, slag and ash' } },
  { code: '27', description: { es: 'Combustibles minerales', en: 'Mineral fuels, oils' } },
  { code: '28', description: { es: 'Productos quimicos inorganicos', en: 'Inorganic chemicals' } },
  { code: '29', description: { es: 'Productos quimicos organicos', en: 'Organic chemicals' } },
  { code: '30', description: { es: 'Productos farmaceuticos', en: 'Pharmaceutical products' } },
  { code: '31', description: { es: 'Abonos', en: 'Fertilisers' } },
  { code: '32', description: { es: 'Extractos curtientes, tintas', en: 'Tanning or dyeing extracts' } },
  { code: '33', description: { es: 'Aceites esenciales, perfumeria', en: 'Essential oils, perfumery' } },
  { code: '34', description: { es: 'Jabones, ceras', en: 'Soap, waxes, candles' } },
  { code: '35', description: { es: 'Materias albuminoideas', en: 'Albuminoidal substances' } },
  { code: '36', description: { es: 'Polvoras y explosivos', en: 'Explosives, matches' } },
  { code: '37', description: { es: 'Productos fotograficos', en: 'Photographic goods' } },
  { code: '38', description: { es: 'Productos quimicos diversos', en: 'Miscellaneous chemical products' } },
  { code: '39', description: { es: 'Plasticos y sus manufacturas', en: 'Plastics and articles thereof' } },
  { code: '40', description: { es: 'Caucho y sus manufacturas', en: 'Rubber and articles thereof' } },
  { code: '41', description: { es: 'Pieles y cueros', en: 'Raw hides and skins, leather' } },
  { code: '42', description: { es: 'Manufacturas de cuero', en: 'Articles of leather' } },
  { code: '43', description: { es: 'Peleteria y confecciones', en: 'Furskins and artificial fur' } },
  { code: '44', description: { es: 'Madera y manufacturas', en: 'Wood and articles of wood' } },
  { code: '45', description: { es: 'Corcho y manufacturas', en: 'Cork and articles of cork' } },
  { code: '46', description: { es: 'Manufacturas de esparteria', en: 'Manufactures of straw' } },
  { code: '47', description: { es: 'Pasta de madera', en: 'Pulp of wood' } },
  { code: '48', description: { es: 'Papel y carton', en: 'Paper and paperboard' } },
  { code: '49', description: { es: 'Productos editoriales', en: 'Printed books, newspapers' } },
  { code: '50', description: { es: 'Seda', en: 'Silk' } },
  { code: '51', description: { es: 'Lana y pelo fino', en: 'Wool, fine animal hair' } },
  { code: '52', description: { es: 'Algodon', en: 'Cotton' } },
  { code: '53', description: { es: 'Otras fibras textiles vegetales', en: 'Other vegetable textile fibres' } },
  { code: '54', description: { es: 'Filamentos sinteticos', en: 'Man-made filaments' } },
  { code: '55', description: { es: 'Fibras sinteticas discontinuas', en: 'Man-made staple fibres' } },
  { code: '56', description: { es: 'Guata, fieltro, cordeleria', en: 'Wadding, felt, cordage' } },
  { code: '57', description: { es: 'Alfombras', en: 'Carpets and textile floor coverings' } },
  { code: '58', description: { es: 'Tejidos especiales', en: 'Special woven fabrics' } },
  { code: '59', description: { es: 'Telas impregnadas', en: 'Impregnated, coated textile fabrics' } },
  { code: '60', description: { es: 'Tejidos de punto', en: 'Knitted or crocheted fabrics' } },
  { code: '61', description: { es: 'Prendas de vestir de punto', en: 'Knitted or crocheted apparel' } },
  { code: '62', description: { es: 'Prendas de vestir no de punto', en: 'Apparel not knitted' } },
  { code: '63', description: { es: 'Otros articulos textiles', en: 'Other textile articles' } },
  { code: '64', description: { es: 'Calzado', en: 'Footwear' } },
  { code: '65', description: { es: 'Sombreros', en: 'Headgear' } },
  { code: '66', description: { es: 'Paraguas, bastones', en: 'Umbrellas, walking-sticks' } },
  { code: '67', description: { es: 'Plumas y flores artificiales', en: 'Prepared feathers, artificial flowers' } },
  { code: '68', description: { es: 'Manufacturas de piedra', en: 'Articles of stone, cement' } },
  { code: '69', description: { es: 'Productos ceramicos', en: 'Ceramic products' } },
  { code: '70', description: { es: 'Vidrio y manufacturas', en: 'Glass and glassware' } },
  { code: '71', description: { es: 'Perlas, piedras preciosas', en: 'Pearls, precious stones' } },
  { code: '72', description: { es: 'Fundicion, hierro y acero', en: 'Iron and steel' } },
  { code: '73', description: { es: 'Manufacturas de fundicion', en: 'Articles of iron or steel' } },
  { code: '74', description: { es: 'Cobre y manufacturas', en: 'Copper and articles thereof' } },
  { code: '75', description: { es: 'Niquel y manufacturas', en: 'Nickel and articles thereof' } },
  { code: '76', description: { es: 'Aluminio y manufacturas', en: 'Aluminium and articles thereof' } },
  { code: '78', description: { es: 'Plomo y manufacturas', en: 'Lead and articles thereof' } },
  { code: '79', description: { es: 'Cinc y manufacturas', en: 'Zinc and articles thereof' } },
  { code: '80', description: { es: 'Estano y manufacturas', en: 'Tin and articles thereof' } },
  { code: '81', description: { es: 'Otros metales comunes', en: 'Other base metals' } },
  { code: '82', description: { es: 'Herramientas y cuchilleria', en: 'Tools, cutlery' } },
  { code: '83', description: { es: 'Manufacturas diversas de metal', en: 'Miscellaneous articles of base metal' } },
  { code: '84', description: { es: 'Maquinas y aparatos mecanicos', en: 'Nuclear reactors, boilers, machinery' } },
  { code: '85', description: { es: 'Maquinas y aparatos electricos', en: 'Electrical machinery and equipment' } },
  { code: '86', description: { es: 'Vehiculos ferroviarios', en: 'Railway or tramway locomotives' } },
  { code: '87', description: { es: 'Vehiculos automoviles', en: 'Vehicles other than railway' } },
  { code: '88', description: { es: 'Aeronaves, vehiculos espaciales', en: 'Aircraft, spacecraft' } },
  { code: '89', description: { es: 'Barcos', en: 'Ships, boats' } },
  { code: '90', description: { es: 'Instrumentos opticos y medicos', en: 'Optical, medical instruments' } },
  { code: '91', description: { es: 'Relojeria', en: 'Clocks and watches' } },
  { code: '92', description: { es: 'Instrumentos musicales', en: 'Musical instruments' } },
  { code: '93', description: { es: 'Armas y municiones', en: 'Arms and ammunition' } },
  { code: '94', description: { es: 'Muebles, iluminacion', en: 'Furniture, bedding, lighting' } },
  { code: '95', description: { es: 'Juguetes y articulos de deporte', en: 'Toys, games and sports equipment' } },
  { code: '96', description: { es: 'Manufacturas diversas', en: 'Miscellaneous manufactured articles' } },
  { code: '97', description: { es: 'Objetos de arte y antiguedades', en: 'Works of art, antiques' } },
  { code: '98', description: { es: 'Disposiciones especiales', en: 'Special provisions' } },
  { code: '99', description: { es: 'Reservado', en: 'Reserved' } }
];

// Datos de codigos TARIC comunes expandidos (los mas usados en importacion)
const EXPANDED_TARIC_CODES = [
  // Capitulo 61 - Textiles de punto
  { code: '6109100010', description: { es: 'T-shirts y camisetas de algodon, para hombres o ninos', en: 'T-shirts of cotton, for men or boys' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 } },
  { code: '6109100090', description: { es: 'T-shirts y camisetas de algodon, para mujeres o ninas', en: 'T-shirts of cotton, for women or girls' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 } },
  { code: '6109901000', description: { es: 'T-shirts de fibras sinteticas', en: 'T-shirts of man-made fibres' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 } },
  { code: '6110201000', description: { es: 'Jerseys de algodon', en: 'Jerseys of cotton' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 } },
  { code: '6110301000', description: { es: 'Jerseys de fibras sinteticas', en: 'Jerseys of man-made fibres' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 } },

  // Capitulo 62 - Textiles no de punto
  { code: '6203421000', description: { es: 'Pantalones de algodon para hombre', en: 'Mens trousers of cotton' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 } },
  { code: '6203429000', description: { es: 'Pantalones de algodon para ninos', en: 'Boys trousers of cotton' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 } },
  { code: '6204621100', description: { es: 'Pantalones de algodon para mujer', en: 'Womens trousers of cotton' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 } },
  { code: '6205200000', description: { es: 'Camisas de algodon para hombre', en: 'Mens shirts of cotton' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 } },

  // Capitulo 64 - Calzado
  { code: '6402910000', description: { es: 'Calzado con suela y parte superior de caucho o plastico', en: 'Footwear with outer soles and uppers of rubber or plastics' }, duties: { thirdCountry: 17 }, vat: { applicable: 21 } },
  { code: '6403510000', description: { es: 'Calzado con suela de cuero y parte superior de cuero', en: 'Footwear with outer soles and uppers of leather' }, duties: { thirdCountry: 8 }, vat: { applicable: 21 } },
  { code: '6403999100', description: { es: 'Otro calzado de cuero para hombre', en: 'Other leather footwear for men' }, duties: { thirdCountry: 8 }, vat: { applicable: 21 } },
  { code: '6404110000', description: { es: 'Calzado de deporte con suela de caucho', en: 'Sports footwear with rubber soles' }, duties: { thirdCountry: 16.9 }, vat: { applicable: 21 } },

  // Capitulo 84 - Maquinaria
  { code: '8471300000', description: { es: 'Ordenadores portatiles', en: 'Portable automatic data processing machines' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },
  { code: '8471410000', description: { es: 'Ordenadores de escritorio', en: 'Desktop computers' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },
  { code: '8471490000', description: { es: 'Otros sistemas de procesamiento de datos', en: 'Other data processing machines' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },
  { code: '8471701000', description: { es: 'Discos duros', en: 'Hard disk drives' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },
  { code: '8471800000', description: { es: 'Otras unidades de maquinas de procesamiento de datos', en: 'Other units of automatic data processing machines' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },
  { code: '8443321000', description: { es: 'Impresoras', en: 'Printers' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },

  // Capitulo 85 - Equipos electricos
  { code: '8517120000', description: { es: 'Telefonos moviles', en: 'Telephones for cellular networks' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },
  { code: '8517620000', description: { es: 'Aparatos de telecomunicacion', en: 'Telecommunication apparatus' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },
  { code: '8518210000', description: { es: 'Altavoces individuales', en: 'Single loudspeakers' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },
  { code: '8518300000', description: { es: 'Auriculares', en: 'Headphones and earphones' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },
  { code: '8523512000', description: { es: 'Memorias USB', en: 'USB flash drives' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },
  { code: '8525801100', description: { es: 'Camaras de television', en: 'Television cameras' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },
  { code: '8528720000', description: { es: 'Televisores en color', en: 'Colour television receivers' }, duties: { thirdCountry: 14 }, vat: { applicable: 21 } },
  { code: '8528729200', description: { es: 'Monitores LCD/LED', en: 'LCD/LED monitors' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },
  { code: '8544429000', description: { es: 'Cables electricos', en: 'Electric conductors' }, duties: { thirdCountry: 3.3 }, vat: { applicable: 21 } },

  // Capitulo 87 - Vehiculos
  { code: '8703220000', description: { es: 'Automoviles hasta 1500cc', en: 'Motor vehicles up to 1500cc' }, duties: { thirdCountry: 10 }, vat: { applicable: 21 } },
  { code: '8703230000', description: { es: 'Automoviles 1500-3000cc', en: 'Motor vehicles 1500-3000cc' }, duties: { thirdCountry: 10 }, vat: { applicable: 21 } },
  { code: '8703240000', description: { es: 'Automoviles mas de 3000cc', en: 'Motor vehicles exceeding 3000cc' }, duties: { thirdCountry: 10 }, vat: { applicable: 21 } },
  { code: '8711200000', description: { es: 'Motocicletas 50-250cc', en: 'Motorcycles 50-250cc' }, duties: { thirdCountry: 8 }, vat: { applicable: 21 } },
  { code: '8712000000', description: { es: 'Bicicletas', en: 'Bicycles' }, duties: { thirdCountry: 14 }, vat: { applicable: 21 } },

  // Capitulo 94 - Muebles
  { code: '9401610000', description: { es: 'Asientos tapizados con armazon de madera', en: 'Upholstered seats with wooden frames' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },
  { code: '9401710000', description: { es: 'Asientos tapizados con armazon de metal', en: 'Upholstered seats with metal frames' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },
  { code: '9403300000', description: { es: 'Muebles de madera de oficina', en: 'Wooden office furniture' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },
  { code: '9403400000', description: { es: 'Muebles de madera de cocina', en: 'Wooden kitchen furniture' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 } },
  { code: '9403500000', description: { es: 'Muebles de madera de dormitorio', en: 'Wooden bedroom furniture' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },
  { code: '9403600000', description: { es: 'Otros muebles de madera', en: 'Other wooden furniture' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },
  { code: '9403700000', description: { es: 'Muebles de plastico', en: 'Furniture of plastics' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },

  // Capitulo 95 - Juguetes
  { code: '9503001000', description: { es: 'Triciclos, coches de pedales', en: 'Tricycles, scooters, pedal cars' }, duties: { thirdCountry: 4.7 }, vat: { applicable: 21 } },
  { code: '9503002100', description: { es: 'Munecas que representan seres humanos', en: 'Dolls representing human beings' }, duties: { thirdCountry: 4.7 }, vat: { applicable: 21 } },
  { code: '9503003000', description: { es: 'Trenes electricos', en: 'Electric trains' }, duties: { thirdCountry: 4.7 }, vat: { applicable: 21 } },
  { code: '9504200000', description: { es: 'Articulos de billar', en: 'Billiard articles' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 } },
  { code: '9504301000', description: { es: 'Videojuegos y consolas', en: 'Video games and consoles' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 } },
  { code: '9506110000', description: { es: 'Esquis', en: 'Skis' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 } },
  { code: '9506620000', description: { es: 'Balones', en: 'Balls' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 } }
];

// Utilidades
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeCode(code) {
  return code.replace(/[\s.]/g, '').padEnd(10, '0').substring(0, 10);
}

function parseCodeBreakdown(code) {
  const normalized = normalizeCode(code);
  return {
    chapter: normalized.substring(0, 2),
    heading: normalized.substring(0, 4),
    subheading: normalized.substring(0, 6),
    cnCode: normalized.substring(0, 8),
    taricCode: normalized.substring(0, 10)
  };
}

function extractKeywords(text) {
  if (!text) return [];
  const stopWords = ['de', 'la', 'el', 'los', 'las', 'y', 'o', 'en', 'con', 'para', 'por', 'a', 'del', 'the', 'of', 'and', 'or', 'for', 'with'];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word))
    .slice(0, 15);
}

// Funciones principales
async function connectToMongoDB() {
  try {
    await mongoose.connect(CONFIG.mongoUri);
    logger.info('Conectado a MongoDB');
  } catch (error) {
    logger.error('Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

async function importChapters() {
  logger.info('Importando capitulos TARIC...');

  let imported = 0;
  let updated = 0;

  for (const chapter of TARIC_CHAPTERS) {
    try {
      const code = chapter.code.padEnd(10, '0');

      const result = await TaricCode.findOneAndUpdate(
        { code },
        {
          code,
          description: chapter.description,
          breakdown: parseCodeBreakdown(code),
          level: 2,
          isLeaf: false,
          isActive: true,
          keywords: extractKeywords(chapter.description.es),
          lastUpdated: new Date()
        },
        { upsert: true, new: true }
      );

      if (result.isNew) imported++;
      else updated++;

    } catch (error) {
      logger.error(`Error importando capitulo ${chapter.code}:`, error.message);
    }
  }

  logger.info(`Capitulos: ${imported} importados, ${updated} actualizados`);
  return { imported, updated };
}

async function importExpandedCodes() {
  logger.info('Importando codigos TARIC expandidos...');

  let imported = 0;
  let updated = 0;

  for (const taric of EXPANDED_TARIC_CODES) {
    try {
      const code = normalizeCode(taric.code);
      const breakdown = parseCodeBreakdown(code);

      const result = await TaricCode.findOneAndUpdate(
        { code },
        {
          code,
          description: taric.description,
          breakdown,
          level: 10,
          parent: breakdown.cnCode,
          duties: taric.duties,
          vat: taric.vat,
          supplementaryUnit: taric.supplementaryUnit || { required: true, type: 'p/st', description: 'Numero de articulos' },
          isLeaf: true,
          isActive: true,
          keywords: extractKeywords(taric.description.es),
          lastUpdated: new Date()
        },
        { upsert: true, new: true }
      );

      if (result.isNew) imported++;
      else updated++;

    } catch (error) {
      logger.error(`Error importando codigo ${taric.code}:`, error.message);
    }
  }

  logger.info(`Codigos expandidos: ${imported} importados, ${updated} actualizados`);
  return { imported, updated };
}

/**
 * Intentar obtener datos de la API Access2Markets de la UE
 */
async function fetchFromEUApi(chapter) {
  try {
    // La API de Access2Markets requiere autenticacion en algunos casos
    // Probamos primero con el endpoint publico de nomenclatura
    const url = `https://trade.ec.europa.eu/access-to-markets/api/v1/nomenclatures/taric/chapters/${chapter}`;

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'es'
      }
    });

    if (response.data) {
      return response.data;
    }
  } catch (error) {
    // API puede no estar disponible publicamente, esto es esperado
    logger.debug(`API UE no disponible para capitulo ${chapter}: ${error.message}`);
  }

  return null;
}

/**
 * Importar datos desde archivo JSON local si existe
 */
async function importFromLocalFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      logger.warn(`Archivo local no encontrado: ${filePath}`);
      return null;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    logger.info(`Cargando datos desde archivo local: ${filePath}`);

    let imported = 0;
    let updated = 0;

    for (const item of data) {
      try {
        const code = normalizeCode(item.code);
        const breakdown = parseCodeBreakdown(code);
        const level = code.replace(/0+$/, '').length;

        const result = await TaricCode.findOneAndUpdate(
          { code },
          {
            code,
            description: item.description || { es: item.description_es, en: item.description_en },
            breakdown,
            level: level <= 2 ? 2 : level <= 4 ? 4 : level <= 6 ? 6 : level <= 8 ? 8 : 10,
            parent: level > 2 ? breakdown.heading.padEnd(10, '0') : null,
            duties: item.duties || { thirdCountry: 0 },
            vat: item.vat || { applicable: 21 },
            isLeaf: item.isLeaf !== undefined ? item.isLeaf : true,
            isActive: true,
            keywords: extractKeywords(item.description?.es || item.description_es),
            lastUpdated: new Date()
          },
          { upsert: true, new: true }
        );

        if (result.isNew) imported++;
        else updated++;

      } catch (error) {
        logger.error(`Error importando item:`, error.message);
      }
    }

    return { imported, updated };

  } catch (error) {
    logger.error('Error leyendo archivo local:', error);
    return null;
  }
}

/**
 * Funcion principal de importacion
 */
async function runImport(options = {}) {
  const { chapters, full, updateOnly } = options;

  console.log('\n========================================');
  console.log('  IMPORTADOR DE DATOS TARIC');
  console.log('  Comision Europea - Nomenclatura Combinada');
  console.log('========================================\n');

  await connectToMongoDB();

  const stats = {
    chaptersImported: 0,
    chaptersUpdated: 0,
    codesImported: 0,
    codesUpdated: 0,
    errors: 0
  };

  // 1. Importar capitulos base
  const chapterResult = await importChapters();
  stats.chaptersImported += chapterResult.imported;
  stats.chaptersUpdated += chapterResult.updated;

  // 2. Importar codigos expandidos
  const expandedResult = await importExpandedCodes();
  stats.codesImported += expandedResult.imported;
  stats.codesUpdated += expandedResult.updated;

  // 3. Intentar importar desde archivo local si existe
  const localDataPath = path.join(__dirname, '../data/taric-codes.json');
  if (fs.existsSync(localDataPath)) {
    const localResult = await importFromLocalFile(localDataPath);
    if (localResult) {
      stats.codesImported += localResult.imported;
      stats.codesUpdated += localResult.updated;
    }
  }

  // 4. Si se solicita importacion completa, intentar API de la UE
  if (full) {
    logger.info('Intentando importacion completa desde API UE...');

    const targetChapters = chapters ? chapters.split(',') : TARIC_CHAPTERS.map(c => c.code);

    for (const chapter of targetChapters) {
      try {
        const apiData = await fetchFromEUApi(chapter);
        if (apiData) {
          logger.info(`Datos obtenidos de API UE para capitulo ${chapter}`);
          // Procesar datos de la API
        }
        await delay(CONFIG.requestDelay);
      } catch (error) {
        logger.warn(`No se pudo obtener datos de API para capitulo ${chapter}`);
        stats.errors++;
      }
    }
  }

  // Resumen final
  console.log('\n========================================');
  console.log('  RESUMEN DE IMPORTACION');
  console.log('========================================');
  console.log(`  Capitulos importados: ${stats.chaptersImported}`);
  console.log(`  Capitulos actualizados: ${stats.chaptersUpdated}`);
  console.log(`  Codigos importados: ${stats.codesImported}`);
  console.log(`  Codigos actualizados: ${stats.codesUpdated}`);
  console.log(`  Errores: ${stats.errors}`);
  console.log('========================================\n');

  // Estadisticas finales de la BD
  const totalCodes = await TaricCode.countDocuments();
  const leafCodes = await TaricCode.countDocuments({ isLeaf: true });

  console.log(`  Total codigos en BD: ${totalCodes}`);
  console.log(`  Codigos finales (hoja): ${leafCodes}`);
  console.log('========================================\n');

  await mongoose.disconnect();
  logger.info('Importacion completada');

  return stats;
}

// Parsear argumentos de linea de comandos
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (const arg of args) {
    if (arg.startsWith('--chapters=')) {
      options.chapters = arg.split('=')[1];
    } else if (arg === '--full') {
      options.full = true;
    } else if (arg === '--update-only') {
      options.updateOnly = true;
    }
  }

  return options;
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const options = parseArgs();
  runImport(options)
    .then(() => process.exit(0))
    .catch(error => {
      logger.error('Error en importacion:', error);
      process.exit(1);
    });
}

module.exports = { runImport };
