#!/usr/bin/env node

/**
 * Generate comprehensive TARIC dataset with REAL EU Common Customs Tariff duty rates (2024-2026)
 *
 * This script contains HARDCODED real TARIC data for the most important import chapters.
 * No external API calls are made - all data is embedded.
 *
 * Sources: EU Combined Nomenclature (Reg. EU 2023/2364), TARIC database,
 * DG TAXUD Access2Markets, Spanish VAT Law 37/1992.
 *
 * Usage:
 *   node scripts/generateTaricData.js [--json-only] [--output=path]
 *
 * Options:
 *   --json-only   Only generate the JSON file, do not import to MongoDB
 *   --output=path Custom output path for the JSON file
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// ============================================================================
// TARIC DATA - REAL EU MFN DUTY RATES
// ============================================================================

const TARIC_DATA = [

  // =========================================================================
  // CHAPTER 02 - MEAT AND EDIBLE MEAT OFFAL
  // =========================================================================
  { code: '0201100000', description: { es: 'Carcasas y medias carcasas de bovino, frescas o refrigeradas', en: 'Carcases and half-carcases of bovine animals, fresh or chilled' }, duties: { thirdCountry: 12.8 }, vat: { applicable: 10 }, specificDuty: { amount: 176.8, unit: 'EUR/100 kg' } },
  { code: '0201201000', description: { es: 'Cuartos delanteros de bovino, sin deshuesar', en: 'Unseparated or separated forequarters of bovine' }, duties: { thirdCountry: 12.8 }, vat: { applicable: 10 }, specificDuty: { amount: 141.4, unit: 'EUR/100 kg' } },
  { code: '0201203000', description: { es: 'Cuartos traseros de bovino, sin deshuesar', en: 'Unseparated or separated hindquarters of bovine' }, duties: { thirdCountry: 12.8 }, vat: { applicable: 10 }, specificDuty: { amount: 212.2, unit: 'EUR/100 kg' } },
  { code: '0201300000', description: { es: 'Carne deshuesada de bovino, fresca o refrigerada', en: 'Boneless meat of bovine animals, fresh or chilled' }, duties: { thirdCountry: 12.8 }, vat: { applicable: 10 }, specificDuty: { amount: 303.4, unit: 'EUR/100 kg' } },
  { code: '0202100000', description: { es: 'Carcasas y medias carcasas de bovino, congeladas', en: 'Carcases and half-carcases of bovine animals, frozen' }, duties: { thirdCountry: 12.8 }, vat: { applicable: 10 }, specificDuty: { amount: 176.8, unit: 'EUR/100 kg' } },
  { code: '0202300000', description: { es: 'Carne deshuesada de bovino, congelada', en: 'Boneless meat of bovine animals, frozen' }, duties: { thirdCountry: 12.8 }, vat: { applicable: 10 }, specificDuty: { amount: 221.1, unit: 'EUR/100 kg' } },
  { code: '0203110000', description: { es: 'Carcasas y medias carcasas de porcino, frescas o refrigeradas', en: 'Carcases and half-carcases of swine, fresh or chilled' }, duties: { thirdCountry: 53.6 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0203120000', description: { es: 'Jamones y paletas de porcino, sin deshuesar, frescos', en: 'Hams and cuts of swine, with bone in, fresh or chilled' }, duties: { thirdCountry: 77.8 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0203190000', description: { es: 'Las demas carnes de porcino, frescas o refrigeradas', en: 'Other meat of swine, fresh or chilled' }, duties: { thirdCountry: 86.9 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0207110000', description: { es: 'Gallos y gallinas enteros, frescos o refrigerados', en: 'Fowls of species Gallus domesticus, not cut, fresh or chilled' }, duties: { thirdCountry: 26.2 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0207130000', description: { es: 'Trozos y despojos de gallo o gallina, frescos o refrigerados', en: 'Cuts and offal of fowls, fresh or chilled' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: { amount: 102.4, unit: 'EUR/100 kg' } },
  { code: '0207140000', description: { es: 'Trozos y despojos de gallo o gallina, congelados', en: 'Cuts and offal of fowls, frozen' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: { amount: 102.4, unit: 'EUR/100 kg' } },

  // =========================================================================
  // CHAPTER 03 - FISH, CRUSTACEANS AND MOLLUSCS
  // =========================================================================
  { code: '0301110000', description: { es: 'Peces ornamentales de agua dulce, vivos', en: 'Live ornamental freshwater fish' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0302110000', description: { es: 'Truchas frescas o refrigeradas', en: 'Trout, fresh or chilled' }, duties: { thirdCountry: 8 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0302130000', description: { es: 'Salmones del Pacifico, frescos o refrigerados', en: 'Pacific salmon, fresh or chilled' }, duties: { thirdCountry: 2 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0302140000', description: { es: 'Salmon del Atlantico, fresco o refrigerado', en: 'Atlantic salmon, fresh or chilled' }, duties: { thirdCountry: 2 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0302210000', description: { es: 'Fletanes frescos o refrigerados', en: 'Halibut, fresh or chilled' }, duties: { thirdCountry: 8 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0302310000', description: { es: 'Atunes blancos frescos o refrigerados', en: 'Albacore or longfinned tunas, fresh or chilled' }, duties: { thirdCountry: 22 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0302410000', description: { es: 'Arenques frescos o refrigerados', en: 'Herrings, fresh or chilled' }, duties: { thirdCountry: 15 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0303110000', description: { es: 'Salmones rojos congelados', en: 'Sockeye salmon, frozen' }, duties: { thirdCountry: 2 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0304410000', description: { es: 'Filetes de salmon del Pacifico, frescos o refrigerados', en: 'Fresh or chilled fillets of Pacific salmon' }, duties: { thirdCountry: 2 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0306171000', description: { es: 'Gambas congeladas', en: 'Shrimps and prawns, frozen' }, duties: { thirdCountry: 12 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0307110000', description: { es: 'Ostras vivas, frescas o refrigeradas', en: 'Oysters, live, fresh or chilled' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0307210000', description: { es: 'Vieiras vivas, frescas o refrigeradas', en: 'Scallops, live, fresh or chilled' }, duties: { thirdCountry: 8 }, vat: { applicable: 10 }, specificDuty: null },

  // =========================================================================
  // CHAPTER 04 - DAIRY PRODUCE, EGGS, HONEY
  // =========================================================================
  { code: '0401100000', description: { es: 'Leche sin concentrar ni azucarar, hasta 1% materia grasa', en: 'Milk not concentrated, fat content not exceeding 1%' }, duties: { thirdCountry: 13.8 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0401200000', description: { es: 'Leche sin concentrar, 1-6% materia grasa', en: 'Milk not concentrated, fat content 1-6%' }, duties: { thirdCountry: 18.8 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0401400000', description: { es: 'Leche sin concentrar, 6-21% materia grasa', en: 'Milk not concentrated, fat content 6-21%' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: { amount: 57.5, unit: 'EUR/100 kg' } },
  { code: '0402100000', description: { es: 'Leche en polvo hasta 1.5% materia grasa', en: 'Milk in powder, fat content not exceeding 1.5%' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: { amount: 125.4, unit: 'EUR/100 kg' } },
  { code: '0402210000', description: { es: 'Leche en polvo sin azucarar, mas de 1.5% materia grasa', en: 'Milk in powder, not sweetened, fat >1.5%' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: { amount: 135.7, unit: 'EUR/100 kg' } },
  { code: '0403100000', description: { es: 'Yogur', en: 'Yogurt' }, duties: { thirdCountry: 20.5 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0405100000', description: { es: 'Mantequilla', en: 'Butter' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: { amount: 189.6, unit: 'EUR/100 kg' } },
  { code: '0406100000', description: { es: 'Queso fresco sin fermentar', en: 'Fresh unfermented cheese' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: { amount: 185.2, unit: 'EUR/100 kg' } },
  { code: '0406200000', description: { es: 'Queso rallado o en polvo', en: 'Grated or powdered cheese' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: { amount: 188.2, unit: 'EUR/100 kg' } },
  { code: '0406900000', description: { es: 'Los demas quesos', en: 'Other cheese' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: { amount: 167.1, unit: 'EUR/100 kg' } },
  { code: '0407110000', description: { es: 'Huevos fecundados de gallina para incubar', en: 'Fertilized eggs of hens for incubation' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: { amount: 3.5, unit: 'EUR/100 pcs' } },
  { code: '0407210000', description: { es: 'Huevos frescos de gallina', en: 'Fresh eggs of hens' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: { amount: 30.4, unit: 'EUR/100 kg' } },
  { code: '0409000000', description: { es: 'Miel natural', en: 'Natural honey' }, duties: { thirdCountry: 17.3 }, vat: { applicable: 10 }, specificDuty: null },

  // =========================================================================
  // CHAPTER 07 - VEGETABLES, ROOTS AND TUBERS
  // =========================================================================
  { code: '0701100000', description: { es: 'Patatas para siembra', en: 'Seed potatoes' }, duties: { thirdCountry: 4.5 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0701900000', description: { es: 'Patatas frescas o refrigeradas (excepto para siembra)', en: 'Fresh or chilled potatoes (excl. seed)' }, duties: { thirdCountry: 11.5 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0702000000', description: { es: 'Tomates frescos o refrigerados', en: 'Tomatoes, fresh or chilled' }, duties: { thirdCountry: 8.8 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0703100000', description: { es: 'Cebollas y chalotes frescos o refrigerados', en: 'Onions and shallots, fresh or chilled' }, duties: { thirdCountry: 9.6 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0703200000', description: { es: 'Ajos frescos o refrigerados', en: 'Garlic, fresh or chilled' }, duties: { thirdCountry: 9.6 }, vat: { applicable: 4 }, specificDuty: { amount: 120, unit: 'EUR/100 kg' } },
  { code: '0704100000', description: { es: 'Coliflores y brecoles frescos', en: 'Cauliflowers and broccoli, fresh or chilled' }, duties: { thirdCountry: 9.6 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0704900000', description: { es: 'Coles, repollos y similares frescos', en: 'Cabbages, kohlrabi, kale, fresh or chilled' }, duties: { thirdCountry: 12 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0705110000', description: { es: 'Lechugas repolladas frescas', en: 'Cabbage lettuce, fresh or chilled' }, duties: { thirdCountry: 10.4 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0706100000', description: { es: 'Zanahorias y nabos frescos', en: 'Carrots and turnips, fresh or chilled' }, duties: { thirdCountry: 13.6 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0707000000', description: { es: 'Pepinos y pepinillos frescos', en: 'Cucumbers and gherkins, fresh or chilled' }, duties: { thirdCountry: 12.8 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0708100000', description: { es: 'Guisantes frescos o refrigerados', en: 'Peas, fresh or chilled' }, duties: { thirdCountry: 8 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0708200000', description: { es: 'Judias verdes frescas o refrigeradas', en: 'Beans, fresh or chilled' }, duties: { thirdCountry: 10.4 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0709200000', description: { es: 'Esparragos frescos o refrigerados', en: 'Asparagus, fresh or chilled' }, duties: { thirdCountry: 10.2 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0709300000', description: { es: 'Berenjenas frescas o refrigeradas', en: 'Aubergines (eggplants), fresh or chilled' }, duties: { thirdCountry: 12.8 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0709400000', description: { es: 'Apio fresco o refrigerado (excepto apionabo)', en: 'Celery other than celeriac, fresh or chilled' }, duties: { thirdCountry: 12.8 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0709510000', description: { es: 'Setas del genero Agaricus, frescas', en: 'Mushrooms of genus Agaricus, fresh or chilled' }, duties: { thirdCountry: 12.8 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0709600000', description: { es: 'Pimientos del genero Capsicum o Pimenta, frescos', en: 'Peppers of genus Capsicum or Pimenta, fresh' }, duties: { thirdCountry: 7.2 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0709700000', description: { es: 'Espinacas frescas o refrigeradas', en: 'Spinach, fresh or chilled' }, duties: { thirdCountry: 10.4 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0709930000', description: { es: 'Calabazas frescas o refrigeradas', en: 'Pumpkins, squash and gourds, fresh or chilled' }, duties: { thirdCountry: 12.8 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0710100000', description: { es: 'Patatas congeladas', en: 'Potatoes, frozen' }, duties: { thirdCountry: 14.4 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0710400000', description: { es: 'Maiz dulce congelado', en: 'Sweet corn, frozen' }, duties: { thirdCountry: 5.1 }, vat: { applicable: 4 }, specificDuty: { amount: 9.4, unit: 'EUR/100 kg' } },

  // =========================================================================
  // CHAPTER 08 - EDIBLE FRUITS AND NUTS
  // =========================================================================
  { code: '0801110000', description: { es: 'Cocos desecados', en: 'Desiccated coconuts' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0801120000', description: { es: 'Cocos con la cascara interna', en: 'Coconuts in the inner shell' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0801190000', description: { es: 'Los demas cocos frescos', en: 'Other fresh coconuts' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0801210000', description: { es: 'Nueces del Brasil con cascara', en: 'Brazil nuts in shell' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0801310000', description: { es: 'Nueces de caju con cascara', en: 'Cashew nuts in shell' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0801320000', description: { es: 'Nueces de caju sin cascara', en: 'Cashew nuts, shelled' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0802110000', description: { es: 'Almendras con cascara', en: 'Almonds in shell' }, duties: { thirdCountry: 5.6 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0802120000', description: { es: 'Almendras sin cascara', en: 'Almonds, shelled' }, duties: { thirdCountry: 3.5 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0802210000', description: { es: 'Avellanas con cascara', en: 'Hazelnuts in shell' }, duties: { thirdCountry: 3.2 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0802220000', description: { es: 'Avellanas sin cascara', en: 'Hazelnuts, shelled' }, duties: { thirdCountry: 3.2 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0802310000', description: { es: 'Nueces de nogal con cascara', en: 'Walnuts in shell' }, duties: { thirdCountry: 4 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0802320000', description: { es: 'Nueces de nogal sin cascara', en: 'Walnuts, shelled' }, duties: { thirdCountry: 5.1 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0802410000', description: { es: 'Castanas con cascara', en: 'Chestnuts in shell' }, duties: { thirdCountry: 5.6 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0802510000', description: { es: 'Pistachos con cascara', en: 'Pistachios in shell' }, duties: { thirdCountry: 1.6 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0803101000', description: { es: 'Platanos frescos', en: 'Fresh plantains' }, duties: { thirdCountry: 16 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0803901000', description: { es: 'Bananas frescas', en: 'Fresh bananas' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: { amount: 114, unit: 'EUR/1000 kg' } },
  { code: '0804100000', description: { es: 'Datiles frescos o secos', en: 'Dates, fresh or dried' }, duties: { thirdCountry: 7.7 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '0804300000', description: { es: 'Pinas tropicales frescas o secas', en: 'Pineapples, fresh or dried' }, duties: { thirdCountry: 5.8 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0804400000', description: { es: 'Aguacates frescos o secos', en: 'Avocados, fresh or dried' }, duties: { thirdCountry: 5.1 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0804500000', description: { es: 'Guayabas, mangos y mangostanes frescos', en: 'Guavas, mangoes and mangosteens, fresh or dried' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0805100020', description: { es: 'Naranjas dulces frescas', en: 'Fresh sweet oranges' }, duties: { thirdCountry: 16 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0805100080', description: { es: 'Las demas naranjas frescas', en: 'Other fresh oranges' }, duties: { thirdCountry: 16 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0805210000', description: { es: 'Mandarinas frescas o secas', en: 'Mandarins, fresh or dried' }, duties: { thirdCountry: 16 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0805220000', description: { es: 'Clementinas frescas', en: 'Clementines, fresh or dried' }, duties: { thirdCountry: 16 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0805400000', description: { es: 'Pomelos y toronjas frescos', en: 'Grapefruit, fresh or dried' }, duties: { thirdCountry: 1.5 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0805500000', description: { es: 'Limones y limas frescos', en: 'Lemons and limes, fresh or dried' }, duties: { thirdCountry: 6.4 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0806100000', description: { es: 'Uvas frescas', en: 'Fresh grapes' }, duties: { thirdCountry: 8 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0807110000', description: { es: 'Sandias frescas', en: 'Watermelons, fresh' }, duties: { thirdCountry: 8.8 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0807190000', description: { es: 'Melones frescos (excepto sandias)', en: 'Melons (excl. watermelons), fresh' }, duties: { thirdCountry: 8.8 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0808100000', description: { es: 'Manzanas frescas', en: 'Apples, fresh' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: { amount: 3.8, unit: 'EUR/100 kg' } },
  { code: '0808300000', description: { es: 'Peras frescas', en: 'Pears, fresh' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: { amount: 3.8, unit: 'EUR/100 kg' } },
  { code: '0809100000', description: { es: 'Albaricoques frescos', en: 'Apricots, fresh' }, duties: { thirdCountry: 20 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0809210000', description: { es: 'Cerezas acidas frescas', en: 'Sour cherries, fresh' }, duties: { thirdCountry: 12 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0809290000', description: { es: 'Las demas cerezas frescas', en: 'Other cherries, fresh' }, duties: { thirdCountry: 12 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0809300000', description: { es: 'Melocotones, incluidos los griñones y nectarinas', en: 'Peaches including nectarines' }, duties: { thirdCountry: 17.6 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0809400000', description: { es: 'Ciruelas y endrinas frescas', en: 'Plums and sloes, fresh' }, duties: { thirdCountry: 6.4 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0810100000', description: { es: 'Fresas frescas', en: 'Strawberries, fresh' }, duties: { thirdCountry: 11.2 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0810200000', description: { es: 'Frambuesas, zarzamoras y moras frescas', en: 'Raspberries, blackberries, mulberries, fresh' }, duties: { thirdCountry: 8.8 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0810300000', description: { es: 'Grosellas y uva espina frescas', en: 'Blackcurrants, redcurrants and gooseberries, fresh' }, duties: { thirdCountry: 8.8 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0810400000', description: { es: 'Arandanos rojos y azules frescos', en: 'Cranberries and blueberries, fresh' }, duties: { thirdCountry: 3.2 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0810500000', description: { es: 'Kiwis frescos', en: 'Kiwifruit, fresh' }, duties: { thirdCountry: 8.8 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0810600000', description: { es: 'Duriones frescos', en: 'Durians, fresh' }, duties: { thirdCountry: 8.8 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '0810900000', description: { es: 'Las demas frutas u otros frutos frescos', en: 'Other fruit, fresh' }, duties: { thirdCountry: 8.8 }, vat: { applicable: 4 }, specificDuty: null },

  // =========================================================================
  // CHAPTER 22 - BEVERAGES, SPIRITS AND VINEGAR
  // =========================================================================
  { code: '2201100000', description: { es: 'Agua mineral y agua gaseada', en: 'Mineral water and aerated water' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '2201900000', description: { es: 'Las demas aguas sin azucarar', en: 'Other water, unsweetened' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '2202100000', description: { es: 'Agua con azucar u otro edulcorante', en: 'Water with added sugar or sweetener' }, duties: { thirdCountry: 9.6 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '2202910000', description: { es: 'Cerveza sin alcohol', en: 'Non-alcoholic beer' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: { amount: 0.72, unit: 'EUR/100 l' } },
  { code: '2203000100', description: { es: 'Cerveza de malta en recipientes de mas de 10 litros', en: 'Beer made from malt, in containers >10 litres' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '2203000900', description: { es: 'Cerveza de malta en recipientes de 10 litros o menos', en: 'Beer made from malt, in containers <=10 litres' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '2204210600', description: { es: 'Vino con DOP en recipientes de 2 litros o menos', en: 'Wine with PDO in containers of 2 litres or less' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: { amount: 32, unit: 'EUR/hl' } },
  { code: '2204210700', description: { es: 'Vino blanco con DOP en recipientes de 2 litros o menos', en: 'White wine with PDO in containers of 2 litres or less' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: { amount: 32, unit: 'EUR/hl' } },
  { code: '2204210800', description: { es: 'Los demas vinos con DOP en recipientes de 2 litros o menos', en: 'Other wine with PDO in containers of 2 litres or less' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: { amount: 32, unit: 'EUR/hl' } },
  { code: '2208201200', description: { es: 'Cognac en recipientes de 2 litros o menos', en: 'Cognac in containers of 2 litres or less' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: { amount: 0, unit: 'EUR/hl pure alc.' } },
  { code: '2208301100', description: { es: 'Whisky bourbon', en: 'Bourbon whiskey' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '2208401100', description: { es: 'Ron en recipientes de 2 litros o menos', en: 'Rum in containers of 2 litres or less' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },

  // =========================================================================
  // CHAPTER 27 - MINERAL FUELS, MINERAL OILS
  // =========================================================================
  { code: '2709000000', description: { es: 'Aceites crudos de petroleo o de mineral bituminoso', en: 'Petroleum oils, crude' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '2710121100', description: { es: 'Gasolinas con plomo para motores', en: 'Motor spirit (gasoline), leaded' }, duties: { thirdCountry: 4.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '2710124100', description: { es: 'Gasolinas sin plomo con octanaje >= 95', en: 'Motor spirit (gasoline), unleaded, octane >= 95' }, duties: { thirdCountry: 4.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '2710124500', description: { es: 'Gasolinas sin plomo con octanaje >= 98', en: 'Motor spirit (gasoline), unleaded, octane >= 98' }, duties: { thirdCountry: 4.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '2710192100', description: { es: 'Gasoleo (diesel)', en: 'Gas oils (diesel)' }, duties: { thirdCountry: 3.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '2710194300', description: { es: 'Fueloil pesado con contenido de azufre <= 1%', en: 'Heavy fuel oil, sulphur content <= 1%' }, duties: { thirdCountry: 3.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '2710199900', description: { es: 'Los demas aceites de petroleo', en: 'Other petroleum oils' }, duties: { thirdCountry: 3.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '2711110000', description: { es: 'Gas natural licuado (GNL)', en: 'Liquefied natural gas (LNG)' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '2711210000', description: { es: 'Gas natural en estado gaseoso', en: 'Natural gas in gaseous state' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '2713200000', description: { es: 'Betun de petroleo', en: 'Petroleum bitumen' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },

  // =========================================================================
  // CHAPTER 30 - PHARMACEUTICAL PRODUCTS
  // =========================================================================
  { code: '3001200000', description: { es: 'Extractos de glandulas u otros organos para usos opoterapicos', en: 'Extracts of glands for organotherapeutic uses' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '3002120000', description: { es: 'Antisueros y demas fracciones de la sangre', en: 'Antisera and other blood fractions' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '3002130000', description: { es: 'Productos inmunologicos sin mezclar', en: 'Immunological products, unmixed' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '3002150000', description: { es: 'Productos inmunologicos mezclados', en: 'Immunological products, mixed' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '3003100000', description: { es: 'Medicamentos con penicilinas o derivados, sin dosificar', en: 'Medicaments containing penicillins, not in doses' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '3003200000', description: { es: 'Medicamentos con antibioticos, sin dosificar', en: 'Medicaments containing antibiotics, not in doses' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '3004100000', description: { es: 'Medicamentos con penicilinas o derivados, dosificados', en: 'Medicaments containing penicillins, in doses' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '3004200000', description: { es: 'Medicamentos con antibioticos, dosificados', en: 'Medicaments containing antibiotics, in doses' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '3004390000', description: { es: 'Medicamentos con hormonas, dosificados', en: 'Medicaments containing hormones, in doses' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '3004500000', description: { es: 'Medicamentos con vitaminas o provitaminas, dosificados', en: 'Medicaments containing vitamins or provitamins, in doses' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '3004900000', description: { es: 'Los demas medicamentos dosificados', en: 'Other medicaments in doses' }, duties: { thirdCountry: 0 }, vat: { applicable: 4 }, specificDuty: null },
  { code: '3005100000', description: { es: 'Apositos y articulos analogos con capa adhesiva', en: 'Adhesive dressings and similar articles' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },

  // =========================================================================
  // CHAPTER 33 - ESSENTIAL OILS, PERFUMERY, COSMETICS
  // =========================================================================
  { code: '3301120000', description: { es: 'Aceite esencial de naranja', en: 'Essential oil of orange' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3301130000', description: { es: 'Aceite esencial de limon', en: 'Essential oil of lemon' }, duties: { thirdCountry: 2.3 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3301190000', description: { es: 'Los demas aceites esenciales de agrios', en: 'Other essential oils of citrus fruits' }, duties: { thirdCountry: 2.3 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3301250000', description: { es: 'Aceites esenciales de otras mentas', en: 'Essential oils of other mints' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3302100000', description: { es: 'Mezclas de sustancias odoriferantes para industria alimentaria', en: 'Mixtures of odoriferous substances for food industry' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3303001000', description: { es: 'Perfumes y aguas de tocador', en: 'Perfumes and toilet waters' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3304100000', description: { es: 'Preparaciones de maquillaje para labios', en: 'Lip make-up preparations' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3304200000', description: { es: 'Preparaciones de maquillaje para ojos', en: 'Eye make-up preparations' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3304300000', description: { es: 'Preparaciones para manicuras y pedicuras', en: 'Manicure or pedicure preparations' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3304990000', description: { es: 'Las demas preparaciones de belleza', en: 'Other beauty preparations' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3305100000', description: { es: 'Champues', en: 'Shampoos' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3305300000', description: { es: 'Lacas para el cabello', en: 'Hair lacquers' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3305900000', description: { es: 'Las demas preparaciones capilares', en: 'Other hair preparations' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3306100000', description: { es: 'Dentifricos (pasta de dientes)', en: 'Dentifrices (toothpaste)' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3307100000', description: { es: 'Preparaciones para afeitar', en: 'Pre-shave, shaving or after-shave preparations' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },

  // =========================================================================
  // CHAPTER 39 - PLASTICS AND ARTICLES THEREOF
  // =========================================================================
  { code: '3901100000', description: { es: 'Polietileno de densidad inferior a 0.94, en formas primarias', en: 'Polyethylene with density < 0.94, in primary forms' }, duties: { thirdCountry: 6.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3901200000', description: { es: 'Polietileno de densidad >= 0.94, en formas primarias', en: 'Polyethylene with density >= 0.94, in primary forms' }, duties: { thirdCountry: 6.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3902100000', description: { es: 'Polipropileno en formas primarias', en: 'Polypropylene in primary forms' }, duties: { thirdCountry: 6.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3903110000', description: { es: 'Poliestireno expansible en formas primarias', en: 'Expansible polystyrene in primary forms' }, duties: { thirdCountry: 6.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3904100000', description: { es: 'Policloruro de vinilo (PVC) sin mezclar, en formas primarias', en: 'PVC not mixed, in primary forms' }, duties: { thirdCountry: 6.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3907610000', description: { es: 'Tereftalato de polietileno (PET) con viscosidad >= 78 ml/g', en: 'PET with viscosity number >= 78 ml/g' }, duties: { thirdCountry: 6.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3917320000', description: { es: 'Tubos de plastico sin reforzar ni combinar, sin accesorios', en: 'Plastic tubes, not reinforced, without fittings' }, duties: { thirdCountry: 6.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3919100000', description: { es: 'Placas autoadhesivas de plastico en rollos de anchura <= 20 cm', en: 'Self-adhesive plastic sheets in rolls <= 20 cm wide' }, duties: { thirdCountry: 6.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3920200000', description: { es: 'Placas de polimeros de propileno', en: 'Sheets of polymers of propylene' }, duties: { thirdCountry: 6.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3923100000', description: { es: 'Cajas, cajones y articulos similares de plastico', en: 'Boxes, cases and similar articles of plastics' }, duties: { thirdCountry: 6.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3923210000', description: { es: 'Sacos y bolsas de polimeros de etileno', en: 'Sacks and bags of polymers of ethylene' }, duties: { thirdCountry: 6.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3923300000', description: { es: 'Bombonas, botellas y frascos de plastico', en: 'Carboys, bottles and flasks of plastics' }, duties: { thirdCountry: 6.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3924100000', description: { es: 'Vajilla y articulos de cocina de plastico', en: 'Tableware and kitchenware of plastics' }, duties: { thirdCountry: 6.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3926200000', description: { es: 'Prendas de vestir y complementos de plastico', en: 'Articles of apparel of plastics' }, duties: { thirdCountry: 6.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '3926909700', description: { es: 'Las demas manufacturas de plastico', en: 'Other articles of plastics' }, duties: { thirdCountry: 6.5 }, vat: { applicable: 21 }, specificDuty: null },

  // =========================================================================
  // CHAPTER 44 - WOOD AND ARTICLES OF WOOD
  // =========================================================================
  { code: '4401110000', description: { es: 'Lena de coniferas', en: 'Fuel wood of coniferous wood' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '4403110000', description: { es: 'Madera en bruto de coniferas tratada con pintura', en: 'Coniferous wood in the rough, treated with paint' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '4407110000', description: { es: 'Madera aserrada de pino', en: 'Sawn or chipped wood of pine' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '4407190000', description: { es: 'Madera aserrada de otras coniferas', en: 'Sawn or chipped wood of other coniferous' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '4407210000', description: { es: 'Madera aserrada de mahogany', en: 'Sawn or chipped wood of mahogany' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '4407290000', description: { es: 'Madera aserrada de otras maderas tropicales', en: 'Sawn or chipped tropical wood, other' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '4410110000', description: { es: 'Tableros de particulas de madera', en: 'Particle board of wood' }, duties: { thirdCountry: 7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '4411120000', description: { es: 'Tableros de fibra de densidad media (MDF) de espesor <= 5 mm', en: 'Medium density fibreboard (MDF) thickness <= 5 mm' }, duties: { thirdCountry: 7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '4411130000', description: { es: 'Tableros de fibra MDF de espesor 5-9 mm', en: 'MDF thickness > 5 mm but <= 9 mm' }, duties: { thirdCountry: 7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '4411140000', description: { es: 'Tableros de fibra MDF de espesor > 9 mm', en: 'MDF thickness > 9 mm' }, duties: { thirdCountry: 7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '4415100000', description: { es: 'Cajones y cajas de madera', en: 'Cases, boxes and crates of wood' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '4415200000', description: { es: 'Paletas y plataformas de carga de madera', en: 'Pallets, box pallets of wood' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '4418200000', description: { es: 'Puertas y sus marcos de madera', en: 'Doors and their frames of wood' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },

  // =========================================================================
  // CHAPTER 61 - ARTICLES OF APPAREL, KNITTED OR CROCHETED
  // =========================================================================
  { code: '6101200000', description: { es: 'Abrigos y similares de algodon, de punto, para hombres', en: 'Mens overcoats of cotton, knitted' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6101300000', description: { es: 'Abrigos y similares de fibras sinteticas, de punto, para hombres', en: 'Mens overcoats of man-made fibres, knitted' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6102200000', description: { es: 'Abrigos y similares de algodon, de punto, para mujeres', en: 'Womens overcoats of cotton, knitted' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6103420000', description: { es: 'Pantalones de algodon de punto para hombres', en: 'Mens trousers of cotton, knitted' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6103430000', description: { es: 'Pantalones de fibras sinteticas de punto para hombres', en: 'Mens trousers of man-made fibres, knitted' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6104420000', description: { es: 'Vestidos de algodon de punto', en: 'Dresses of cotton, knitted' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6104440000', description: { es: 'Vestidos de fibras artificiales de punto', en: 'Dresses of artificial fibres, knitted' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6104620000', description: { es: 'Pantalones de algodon de punto para mujeres', en: 'Womens trousers of cotton, knitted' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6104630000', description: { es: 'Pantalones de fibras sinteticas de punto para mujeres', en: 'Womens trousers of man-made fibres, knitted' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6105100000', description: { es: 'Camisas de punto de algodon para hombres', en: 'Mens shirts of cotton, knitted' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6105200000', description: { es: 'Camisas de punto de fibras sinteticas para hombres', en: 'Mens shirts of man-made fibres, knitted' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6106100000', description: { es: 'Blusas de punto de algodon para mujeres', en: 'Womens blouses of cotton, knitted' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6109100010', description: { es: 'T-shirts y camisetas de algodon, para hombres o ninos', en: 'T-shirts of cotton, for men or boys' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6109100090', description: { es: 'T-shirts y camisetas de algodon, para mujeres o ninas', en: 'T-shirts of cotton, for women or girls' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6109901000', description: { es: 'T-shirts de fibras sinteticas', en: 'T-shirts of man-made fibres' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6110201000', description: { es: 'Jerseys y sueteres de algodon, de punto', en: 'Jerseys, pullovers of cotton, knitted' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6110301000', description: { es: 'Jerseys y sueteres de fibras sinteticas, de punto', en: 'Jerseys, pullovers of man-made fibres, knitted' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6110901000', description: { es: 'Jerseys y sueteres de lana, de punto', en: 'Jerseys, pullovers of wool, knitted' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6111200000', description: { es: 'Prendas de vestir de punto de algodon para bebes', en: 'Babies garments of cotton, knitted' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6115100000', description: { es: 'Medias y pantys de punto con compresion progresiva', en: 'Graduated compression hosiery, knitted' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },

  // =========================================================================
  // CHAPTER 62 - ARTICLES OF APPAREL, NOT KNITTED
  // =========================================================================
  { code: '6201120000', description: { es: 'Abrigos de algodon para hombres', en: 'Mens overcoats of cotton' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6201130000', description: { es: 'Abrigos de fibras sinteticas para hombres', en: 'Mens overcoats of man-made fibres' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6202120000', description: { es: 'Abrigos de algodon para mujeres', en: 'Womens overcoats of cotton' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6203110000', description: { es: 'Trajes de lana para hombres', en: 'Mens suits of wool' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6203120000', description: { es: 'Trajes de fibras sinteticas para hombres', en: 'Mens suits of man-made fibres' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6203421000', description: { es: 'Pantalones de algodon para hombre', en: 'Mens trousers of cotton' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6203429000', description: { es: 'Pantalones de algodon para ninos', en: 'Boys trousers of cotton' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6203431000', description: { es: 'Pantalones de fibras sinteticas para hombre', en: 'Mens trousers of man-made fibres' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6204120000', description: { es: 'Trajes sastre de algodon para mujeres', en: 'Womens suits of cotton' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6204420000', description: { es: 'Vestidos de algodon para mujeres', en: 'Womens dresses of cotton' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6204520000', description: { es: 'Faldas de algodon para mujeres', en: 'Womens skirts of cotton' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6204621100', description: { es: 'Pantalones vaqueros (jeans) de algodon para mujer', en: 'Womens jeans trousers of cotton' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6205200000', description: { es: 'Camisas de algodon para hombre', en: 'Mens shirts of cotton' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6205300000', description: { es: 'Camisas de fibras sinteticas para hombre', en: 'Mens shirts of man-made fibres' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6206300000', description: { es: 'Blusas de algodon para mujeres', en: 'Womens blouses of cotton' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6207110000', description: { es: 'Calzoncillos de algodon para hombres', en: 'Mens underpants of cotton' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6208110000', description: { es: 'Combinaciones y enaguas de fibras sinteticas', en: 'Slips and petticoats of man-made fibres' }, duties: { thirdCountry: 12 }, vat: { applicable: 21 }, specificDuty: null },

  // =========================================================================
  // CHAPTER 64 - FOOTWEAR
  // =========================================================================
  { code: '6401100000', description: { es: 'Calzado impermeable con puntera metalica de proteccion', en: 'Waterproof footwear with metal toe-cap' }, duties: { thirdCountry: 17 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6401920000', description: { es: 'Calzado impermeable que cubra el tobillo sin cubrir la rodilla', en: 'Waterproof footwear covering ankle but not knee' }, duties: { thirdCountry: 17 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6401990000', description: { es: 'Otro calzado impermeable', en: 'Other waterproof footwear' }, duties: { thirdCountry: 17 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6402910000', description: { es: 'Calzado con suela y parte superior de caucho o plastico, que cubra el tobillo', en: 'Footwear of rubber or plastics, covering the ankle' }, duties: { thirdCountry: 17 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6402990000', description: { es: 'Otro calzado con suela y parte superior de caucho o plastico', en: 'Other footwear of rubber or plastics' }, duties: { thirdCountry: 17 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6403510000', description: { es: 'Calzado con suela de cuero, que cubra el tobillo', en: 'Footwear with leather soles, covering the ankle' }, duties: { thirdCountry: 8 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6403590000', description: { es: 'Otro calzado con suela de cuero', en: 'Other footwear with leather soles' }, duties: { thirdCountry: 8 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6403911000', description: { es: 'Calzado con suela de caucho y parte superior de cuero, que cubra el tobillo', en: 'Footwear with rubber soles and leather upper, covering ankle' }, duties: { thirdCountry: 8 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6403999100', description: { es: 'Otro calzado de cuero para hombre', en: 'Other leather footwear for men' }, duties: { thirdCountry: 8 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6404110000', description: { es: 'Calzado de deporte con suela de caucho o plastico y parte superior textil', en: 'Sports footwear with rubber or plastic soles and textile upper' }, duties: { thirdCountry: 16.9 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6404190000', description: { es: 'Otro calzado con suela de caucho o plastico y parte superior textil', en: 'Other footwear with rubber or plastic soles and textile upper' }, duties: { thirdCountry: 17 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6405100000', description: { es: 'Calzado con parte superior de cuero natural o regenerado', en: 'Footwear with uppers of leather or composition leather' }, duties: { thirdCountry: 8 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '6405200000', description: { es: 'Calzado con parte superior de materia textil', en: 'Footwear with uppers of textile materials' }, duties: { thirdCountry: 17 }, vat: { applicable: 21 }, specificDuty: null },

  // =========================================================================
  // CHAPTER 73 - ARTICLES OF IRON OR STEEL
  // =========================================================================
  { code: '7304110000', description: { es: 'Tubos de acero inoxidable sin soldadura para oleoductos', en: 'Seamless stainless steel tubes for pipelines' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '7306300000', description: { es: 'Tubos de hierro o acero no aleado soldados de seccion circular', en: 'Welded tubes of non-alloy steel, circular cross-section' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '7307110000', description: { es: 'Accesorios de tuberia de fundicion no maleable', en: 'Cast fittings of non-malleable cast iron' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '7308900000', description: { es: 'Construcciones y partes de construcciones de hierro o acero', en: 'Structures and parts of structures of iron or steel' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '7310100000', description: { es: 'Depositos de hierro o acero de capacidad >= 50 litros', en: 'Iron or steel tanks, capacity >= 50 litres' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '7310290000', description: { es: 'Depositos de hierro o acero de capacidad < 50 litros', en: 'Iron or steel tanks, capacity < 50 litres' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '7312100000', description: { es: 'Cables de hierro o acero no aislados electricamente', en: 'Stranded wire, ropes and cables of iron or steel' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '7318120000', description: { es: 'Tornillos de hierro o acero para madera', en: 'Wood screws of iron or steel' }, duties: { thirdCountry: 3.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '7318150000', description: { es: 'Otros tornillos y pernos de hierro o acero', en: 'Other screws and bolts of iron or steel' }, duties: { thirdCountry: 3.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '7318160000', description: { es: 'Tuercas de hierro o acero', en: 'Nuts of iron or steel' }, duties: { thirdCountry: 3.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '7321110000', description: { es: 'Aparatos de coccion y calientaplatos de gas', en: 'Cooking appliances and plate warmers, for gas fuel' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '7323930000', description: { es: 'Articulos de uso domestico de acero inoxidable', en: 'Table, kitchen articles of stainless steel' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '7326909800', description: { es: 'Las demas manufacturas de hierro o acero', en: 'Other articles of iron or steel' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 }, specificDuty: null },

  // =========================================================================
  // CHAPTER 84 - NUCLEAR REACTORS, BOILERS, MACHINERY
  // =========================================================================
  { code: '8414510000', description: { es: 'Ventiladores de mesa, suelo, pared, techo, con motor electrico <= 125 W', en: 'Table, floor, wall, ceiling fans with electric motor <= 125 W' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8415100000', description: { es: 'Acondicionadores de aire de pared o ventana', en: 'Window or wall air conditioning machines' }, duties: { thirdCountry: 2.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8418100000', description: { es: 'Combinaciones de refrigerador y congelador con puertas exteriores separadas', en: 'Combined refrigerator-freezers with separate doors' }, duties: { thirdCountry: 2.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8418210000', description: { es: 'Refrigeradores domesticos de compresion', en: 'Household compression-type refrigerators' }, duties: { thirdCountry: 2.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8418300000', description: { es: 'Congeladores horizontales de capacidad <= 800 litros', en: 'Chest freezers, capacity <= 800 litres' }, duties: { thirdCountry: 2.5 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8422110000', description: { es: 'Lavavajillas domesticos', en: 'Household dishwashing machines' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8443321000', description: { es: 'Impresoras', en: 'Printers' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8443322000', description: { es: 'Telefax', en: 'Facsimile machines' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8450110000', description: { es: 'Lavadoras domesticas automaticas de capacidad <= 10 kg', en: 'Household automatic washing machines, capacity <= 10 kg' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8450120000', description: { es: 'Lavadoras domesticas automaticas de capacidad > 10 kg', en: 'Household automatic washing machines, capacity > 10 kg' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8451210000', description: { es: 'Secadoras de ropa de capacidad <= 10 kg', en: 'Drying machines, capacity <= 10 kg' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8467210000', description: { es: 'Taladros de todo tipo', en: 'Drills of all kinds' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8471300000', description: { es: 'Ordenadores portatiles (notebooks, laptops, tablets)', en: 'Portable automatic data processing machines (laptops, tablets)' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8471410000', description: { es: 'Ordenadores de escritorio', en: 'Desktop computers' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8471490000', description: { es: 'Otros sistemas de procesamiento de datos presentados en forma de sistemas', en: 'Other data processing systems presented as systems' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8471600000', description: { es: 'Unidades de entrada o salida de datos (teclados, ratones, escaneres)', en: 'Input or output units (keyboards, mice, scanners)' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8471701000', description: { es: 'Discos duros (HDD y SSD)', en: 'Hard disk drives (HDD and SSD)' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8471800000', description: { es: 'Otras unidades de maquinas de procesamiento de datos', en: 'Other units of automatic data processing machines' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8473300000', description: { es: 'Partes y accesorios de maquinas de procesamiento de datos', en: 'Parts and accessories of data processing machines' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8479890000', description: { es: 'Las demas maquinas y aparatos mecanicos con funcion propia', en: 'Other machines and mechanical appliances with individual function' }, duties: { thirdCountry: 1.7 }, vat: { applicable: 21 }, specificDuty: null },

  // =========================================================================
  // CHAPTER 85 - ELECTRICAL MACHINERY AND EQUIPMENT
  // =========================================================================
  { code: '8501100000', description: { es: 'Motores electricos de potencia <= 37.5 W', en: 'Electric motors of output <= 37.5 W' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8504400000', description: { es: 'Convertidores estaticos (inversores, cargadores)', en: 'Static converters (inverters, chargers)' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8506500000', description: { es: 'Pilas de litio', en: 'Lithium cells and batteries' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8507600000', description: { es: 'Acumuladores electricos de iones de litio', en: 'Lithium-ion accumulators' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8508110000', description: { es: 'Aspiradoras con motor electrico incorporado, de potencia <= 1500 W', en: 'Vacuum cleaners with motor, power <= 1500 W' }, duties: { thirdCountry: 1.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8509400000', description: { es: 'Trituradoras y mezcladoras de alimentos electrodomesticas', en: 'Food grinders and mixers, domestic' }, duties: { thirdCountry: 2.2 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8510100000', description: { es: 'Maquinillas de afeitar electricas', en: 'Electric shavers' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8516100000', description: { es: 'Calentadores electricos de agua instantaneos o de acumulacion', en: 'Electric instantaneous or storage water heaters' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8516400000', description: { es: 'Planchas electricas', en: 'Electric smoothing irons' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8516600000', description: { es: 'Hornos, cocinas y placas de coccion electricas', en: 'Electric ovens, cooking plates and boiling rings' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8516710000', description: { es: 'Aparatos electricos para la preparacion de cafe o te', en: 'Electric coffee or tea makers' }, duties: { thirdCountry: 2.2 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8516790000', description: { es: 'Los demas aparatos electrotermicos para uso domestico', en: 'Other electro-thermic domestic appliances' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8517120000', description: { es: 'Telefonos moviles (celulares) y de otras redes inalambricas', en: 'Telephones for cellular networks or other wireless networks' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8517180000', description: { es: 'Los demas telefonos (VoIP, etc.)', en: 'Other telephones (VoIP, etc.)' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8517620000', description: { es: 'Aparatos para recepcion, conversion y transmision de voz/datos (routers, switches)', en: 'Machines for reception, conversion, transmission of voice/data (routers, switches)' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8518100000', description: { es: 'Microfonos y sus soportes', en: 'Microphones and their stands' }, duties: { thirdCountry: 2 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8518210000', description: { es: 'Altavoces individuales montados en cajas', en: 'Single loudspeakers mounted in enclosures' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8518300000', description: { es: 'Auriculares (headphones, earphones, earbuds)', en: 'Headphones, earphones and earbuds' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8519810000', description: { es: 'Aparatos de reproduccion de sonido sin grabacion (reproductores MP3, etc.)', en: 'Sound reproducing apparatus without recording' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8521900000', description: { es: 'Los demas aparatos de grabacion o reproduccion de video', en: 'Other video recording or reproducing apparatus' }, duties: { thirdCountry: 14 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8523512000', description: { es: 'Dispositivos de almacenamiento permanente de datos (memorias USB, tarjetas SD)', en: 'Solid-state non-volatile storage devices (USB, SD cards)' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8525801100', description: { es: 'Camaras digitales de television', en: 'Digital television cameras' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8525802000', description: { es: 'Camaras digitales fotograficas', en: 'Digital cameras (photographic)' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8528720000', description: { es: 'Aparatos receptores de television en color (televisores)', en: 'Colour television receivers' }, duties: { thirdCountry: 14 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8528729200', description: { es: 'Monitores LCD/LED sin sintonizador de TV', en: 'LCD/LED monitors without TV tuner' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8536500000', description: { es: 'Interruptores para circuitos electricos <= 1000 V', en: 'Switches for electrical circuits <= 1000 V' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8536690000', description: { es: 'Clavijas y tomas de corriente <= 1000 V', en: 'Plugs and sockets <= 1000 V' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8539500000', description: { es: 'Lamparas y tubos de diodos emisores de luz (LED)', en: 'Light-emitting diode (LED) lamps' }, duties: { thirdCountry: 4.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8541400000', description: { es: 'Dispositivos semiconductores fotosensibles (paneles solares)', en: 'Photosensitive semiconductor devices (solar panels)' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8542310000', description: { es: 'Procesadores y controladores electronicos (chips, CPU, GPU)', en: 'Electronic processors and controllers (chips, CPU, GPU)' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8544429000', description: { es: 'Cables y conductores electricos para tension <= 1000 V', en: 'Electric conductors for voltage <= 1000 V' }, duties: { thirdCountry: 3.3 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8544700000', description: { es: 'Cables de fibra optica', en: 'Optical fibre cables' }, duties: { thirdCountry: 3.5 }, vat: { applicable: 21 }, specificDuty: null },

  // =========================================================================
  // CHAPTER 87 - VEHICLES OTHER THAN RAILWAY
  // =========================================================================
  { code: '8703210000', description: { es: 'Automoviles de turismo de encendido por chispa, hasta 1000 cc', en: 'Motor vehicles, spark-ignition, up to 1000 cc' }, duties: { thirdCountry: 10 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8703220000', description: { es: 'Automoviles de turismo de encendido por chispa, 1000-1500 cc', en: 'Motor vehicles, spark-ignition, 1000-1500 cc' }, duties: { thirdCountry: 10 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8703230000', description: { es: 'Automoviles de turismo de encendido por chispa, 1500-3000 cc', en: 'Motor vehicles, spark-ignition, 1500-3000 cc' }, duties: { thirdCountry: 10 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8703240000', description: { es: 'Automoviles de turismo de encendido por chispa, mas de 3000 cc', en: 'Motor vehicles, spark-ignition, exceeding 3000 cc' }, duties: { thirdCountry: 10 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8703310000', description: { es: 'Automoviles diesel, hasta 1500 cc', en: 'Motor vehicles, diesel, up to 1500 cc' }, duties: { thirdCountry: 10 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8703320000', description: { es: 'Automoviles diesel, 1500-2500 cc', en: 'Motor vehicles, diesel, 1500-2500 cc' }, duties: { thirdCountry: 10 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8703330000', description: { es: 'Automoviles diesel, mas de 2500 cc', en: 'Motor vehicles, diesel, exceeding 2500 cc' }, duties: { thirdCountry: 10 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8703800000', description: { es: 'Vehiculos con motor electrico unicamente para propulsion', en: 'Motor vehicles with only electric motor for propulsion' }, duties: { thirdCountry: 10 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8704210000', description: { es: 'Vehiculos para el transporte de mercancias diesel, peso <= 5 t', en: 'Goods transport vehicles, diesel, gross weight <= 5 t' }, duties: { thirdCountry: 22 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8704220000', description: { es: 'Vehiculos para el transporte de mercancias diesel, peso 5-20 t', en: 'Goods transport vehicles, diesel, gross weight 5-20 t' }, duties: { thirdCountry: 22 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8711200000', description: { es: 'Motocicletas con motor de 50-250 cc', en: 'Motorcycles with engine 50-250 cc' }, duties: { thirdCountry: 8 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8711300000', description: { es: 'Motocicletas con motor de 250-500 cc', en: 'Motorcycles with engine 250-500 cc' }, duties: { thirdCountry: 6 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8711500000', description: { es: 'Motocicletas con motor de mas de 800 cc', en: 'Motorcycles with engine exceeding 800 cc' }, duties: { thirdCountry: 6 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8712000000', description: { es: 'Bicicletas y demas velocipedos sin motor', en: 'Bicycles and other cycles, not motorised' }, duties: { thirdCountry: 14 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '8714990000', description: { es: 'Partes y accesorios de bicicletas', en: 'Parts and accessories of bicycles' }, duties: { thirdCountry: 4.7 }, vat: { applicable: 21 }, specificDuty: null },

  // =========================================================================
  // CHAPTER 90 - OPTICAL, MEDICAL INSTRUMENTS
  // =========================================================================
  { code: '9001500000', description: { es: 'Lentes de otras materias para gafas', en: 'Spectacle lenses of other materials' }, duties: { thirdCountry: 2.9 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '9003110000', description: { es: 'Monturas de gafas de plastico', en: 'Spectacle frames of plastics' }, duties: { thirdCountry: 2.2 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '9003190000', description: { es: 'Monturas de gafas de otros materiales', en: 'Spectacle frames of other materials' }, duties: { thirdCountry: 2.2 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '9004100000', description: { es: 'Gafas de sol', en: 'Sunglasses' }, duties: { thirdCountry: 2.9 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '9018110000', description: { es: 'Electrocardiografos', en: 'Electrocardiographs' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '9018310000', description: { es: 'Jeringas con o sin aguja', en: 'Syringes, with or without needles' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '9018390000', description: { es: 'Cateteres, canulas e instrumentos similares', en: 'Catheters, cannulae and similar instruments' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '9018500000', description: { es: 'Los demas instrumentos y aparatos de oftalmologia', en: 'Other ophthalmic instruments and appliances' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '9018900000', description: { es: 'Los demas instrumentos y aparatos de medicina', en: 'Other instruments and appliances for medicine' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '9019100000', description: { es: 'Aparatos de mecanoterapia y masaje', en: 'Mechano-therapy and massage apparatus' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '9021100000', description: { es: 'Articulos y aparatos de ortopedia', en: 'Orthopaedic appliances' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '9021290000', description: { es: 'Protesis dentales', en: 'Dental prostheses' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '9022140000', description: { es: 'Aparatos de rayos X para uso medico', en: 'X-ray apparatus for medical use' }, duties: { thirdCountry: 0 }, vat: { applicable: 10 }, specificDuty: null },
  { code: '9027800000', description: { es: 'Los demas instrumentos y aparatos de analisis fisico o quimico', en: 'Other instruments for physical or chemical analysis' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },

  // =========================================================================
  // CHAPTER 94 - FURNITURE, BEDDING, LIGHTING
  // =========================================================================
  { code: '9401300000', description: { es: 'Asientos giratorios de altura ajustable', en: 'Swivel seats with variable height adjustment' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '9401410000', description: { es: 'Asientos transformables en cama (sofa-cama)', en: 'Seats convertible into beds (sofa-beds)' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '9401610000', description: { es: 'Asientos tapizados con armazon de madera', en: 'Upholstered seats with wooden frames' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '9401710000', description: { es: 'Asientos tapizados con armazon de metal', en: 'Upholstered seats with metal frames' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '9401800000', description: { es: 'Los demas asientos', en: 'Other seats' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '9403200000', description: { es: 'Muebles de metal distintos de oficina', en: 'Other metal furniture' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '9403300000', description: { es: 'Muebles de madera de los tipos utilizados en oficinas', en: 'Wooden office furniture' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '9403400000', description: { es: 'Muebles de madera de los tipos utilizados en cocinas', en: 'Wooden kitchen furniture' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '9403500000', description: { es: 'Muebles de madera de los tipos utilizados en dormitorios', en: 'Wooden bedroom furniture' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '9403600000', description: { es: 'Los demas muebles de madera', en: 'Other wooden furniture' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '9403700000', description: { es: 'Muebles de plastico', en: 'Furniture of plastics' }, duties: { thirdCountry: 0 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '9403900000', description: { es: 'Partes de muebles', en: 'Parts of furniture' }, duties: { thirdCountry: 2.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '9404210000', description: { es: 'Colchones de caucho o plastico celulares', en: 'Mattresses of cellular rubber or plastics' }, duties: { thirdCountry: 3.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '9404290000', description: { es: 'Colchones de otras materias', en: 'Mattresses of other materials' }, duties: { thirdCountry: 3.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '9405110000', description: { es: 'Lamparas de techo diseñadas para ser usadas unicamente con LED', en: 'Chandeliers designed for use solely with LED' }, duties: { thirdCountry: 4.7 }, vat: { applicable: 21 }, specificDuty: null },
  { code: '9405210000', description: { es: 'Lamparas de mesa o escritorio diseñadas para LED', en: 'Table or desk lamps designed for LED' }, duties: { thirdCountry: 4.7 }, vat: { applicable: 21 }, specificDuty: null },
];


// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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

function extractKeywords(descEs, descEn) {
  const stopWords = new Set([
    'de', 'la', 'el', 'los', 'las', 'y', 'o', 'en', 'con', 'para', 'por',
    'a', 'del', 'al', 'un', 'una', 'que', 'su', 'sus', 'sin', 'mas', 'u',
    'the', 'of', 'and', 'or', 'for', 'with', 'in', 'to', 'not', 'other',
    'than', 'excl', 'including', 'les', 'des', 'demas', 'otros', 'otras',
    'tipo', 'tipos', 'excepto', 'incluidos', 'incluidas'
  ]);

  const text = `${descEs || ''} ${descEn || ''}`;
  return [...new Set(
    text
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents for search
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
  )].slice(0, 20);
}

function determineLevel(code) {
  const clean = normalizeCode(code);
  // Check trailing zeros to determine level
  if (clean.endsWith('00000000')) return 2;  // chapter
  if (clean.endsWith('000000')) return 4;    // heading
  if (clean.endsWith('0000')) return 6;      // subheading
  if (clean.endsWith('00')) return 8;        // CN
  return 10;                                  // TARIC
}


// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const jsonOnly = args.includes('--json-only');
  const outputArg = args.find(a => a.startsWith('--output='));
  const outputPath = outputArg
    ? outputArg.split('=')[1]
    : path.join(__dirname, '..', 'data', 'taric-generated.json');

  console.log('\n============================================================');
  console.log('  TARIC DATA GENERATOR');
  console.log('  EU Common Customs Tariff 2024-2026 - Hardcoded Real Rates');
  console.log('============================================================\n');

  // Enrich each entry with breakdown, level, keywords
  const enriched = TARIC_DATA.map(item => {
    const code = normalizeCode(item.code);
    const breakdown = parseCodeBreakdown(code);
    const level = determineLevel(code);
    const keywords = extractKeywords(item.description.es, item.description.en);

    return {
      code,
      description: item.description,
      breakdown,
      level,
      parent: level > 2 ? breakdown.chapter.padEnd(10, '0') : null,
      duties: {
        thirdCountry: item.duties.thirdCountry,
        ...(item.specificDuty ? {
          specific: {
            amount: item.specificDuty.amount,
            unit: item.specificDuty.unit
          }
        } : {})
      },
      vat: {
        standard: 21,
        reduced: 10,
        superReduced: 4,
        applicable: item.vat.applicable
      },
      supplementaryUnit: { required: false },
      isLeaf: true,
      isActive: true,
      keywords,
      lastUpdated: new Date().toISOString()
    };
  });

  // Count by chapter
  const chapterCounts = {};
  enriched.forEach(item => {
    const ch = item.breakdown.chapter;
    chapterCounts[ch] = (chapterCounts[ch] || 0) + 1;
  });

  console.log(`Total codes generated: ${enriched.length}`);
  console.log(`Chapters covered: ${Object.keys(chapterCounts).length}\n`);
  console.log('Codes per chapter:');
  Object.entries(chapterCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([ch, count]) => {
      console.log(`  Chapter ${ch}: ${count} codes`);
    });

  // Save JSON file
  const outputDir = path.dirname(outputPath);
  if (!require('fs').existsSync(outputDir)) {
    require('fs').mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(enriched, null, 2), 'utf8');
  console.log(`\nJSON file saved to: ${outputPath}`);

  if (jsonOnly) {
    console.log('\n--json-only flag set. Skipping MongoDB import.');
    console.log('============================================================\n');
    return;
  }

  // MongoDB import
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/luci-customs';

  console.log(`\nConnecting to MongoDB: ${mongoUri.replace(/\/\/[^@]+@/, '//***@')}...`);

  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');
  } catch (err) {
    console.error(`Failed to connect to MongoDB: ${err.message}`);
    console.error('Run with --json-only to skip MongoDB import.');
    process.exit(1);
  }

  const TaricCode = require('../src/models/TaricCode');

  let upserted = 0;
  let updated = 0;
  let errors = 0;

  for (const item of enriched) {
    try {
      const result = await TaricCode.findOneAndUpdate(
        { code: item.code },
        {
          code: item.code,
          description: item.description,
          breakdown: item.breakdown,
          level: item.level,
          parent: item.parent,
          duties: item.duties,
          vat: item.vat,
          'supplementaryUnit.required': false,
          isLeaf: item.isLeaf,
          isActive: item.isActive,
          keywords: item.keywords,
          lastUpdated: new Date()
        },
        { upsert: true, new: true, rawResult: true }
      );

      if (result.lastErrorObject?.updatedExisting) {
        updated++;
      } else {
        upserted++;
      }
    } catch (err) {
      errors++;
      console.error(`  Error upserting ${item.code}: ${err.message}`);
    }
  }

  // Final DB statistics
  const totalCodes = await TaricCode.countDocuments();
  const leafCodes = await TaricCode.countDocuments({ isLeaf: true });

  console.log('\n============================================================');
  console.log('  IMPORT SUMMARY');
  console.log('============================================================');
  console.log(`  New codes inserted:  ${upserted}`);
  console.log(`  Existing updated:    ${updated}`);
  console.log(`  Errors:              ${errors}`);
  console.log('------------------------------------------------------------');
  console.log(`  Total codes in DB:   ${totalCodes}`);
  console.log(`  Leaf codes in DB:    ${leafCodes}`);
  console.log('============================================================\n');

  await mongoose.disconnect();
  console.log('MongoDB disconnected. Done.\n');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
