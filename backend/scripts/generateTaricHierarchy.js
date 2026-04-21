#!/usr/bin/env node

/**
 * Generate COMPLETE TARIC hierarchy for tree browser navigation
 *
 * Levels: Chapter (2-digit) → Heading (4-digit) → Subheading (6-digit) → TARIC (10-digit)
 *
 * This script populates ALL ~1,200 headings (4-digit) for all 98 chapters,
 * plus ~2,000 subheadings (6-digit) for priority chapters.
 *
 * Source: EU Harmonized System 2024, Combined Nomenclature (Reg. EU 2023/2364)
 *
 * Usage: node scripts/generateTaricHierarchy.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const TaricCode = require('../src/models/TaricCode');

// ============================================================================
// ALL HEADINGS (4-digit) - COMPLETE HARMONIZED SYSTEM
// ============================================================================

const ALL_HEADINGS = [

  // =========================================================================
  // CHAPTER 01 - ANIMALES VIVOS / LIVE ANIMALS
  // =========================================================================
  { code: '0101', description: { es: 'Caballos, asnos, mulos y burdeganos, vivos', en: 'Live horses, asses, mules and hinnies' } },
  { code: '0102', description: { es: 'Animales vivos de la especie bovina', en: 'Live bovine animals' } },
  { code: '0103', description: { es: 'Animales vivos de la especie porcina', en: 'Live swine' } },
  { code: '0104', description: { es: 'Animales vivos de las especies ovina o caprina', en: 'Live sheep and goats' } },
  { code: '0105', description: { es: 'Gallos, gallinas, patos, gansos, pavos y pintadas, vivos', en: 'Live poultry' } },
  { code: '0106', description: { es: 'Los demas animales vivos', en: 'Other live animals' } },

  // =========================================================================
  // CHAPTER 02 - CARNE Y DESPOJOS COMESTIBLES / MEAT
  // =========================================================================
  { code: '0201', description: { es: 'Carne de animales de la especie bovina, fresca o refrigerada', en: 'Meat of bovine animals, fresh or chilled' } },
  { code: '0202', description: { es: 'Carne de animales de la especie bovina, congelada', en: 'Meat of bovine animals, frozen' } },
  { code: '0203', description: { es: 'Carne de animales de la especie porcina, fresca, refrigerada o congelada', en: 'Meat of swine, fresh, chilled or frozen' } },
  { code: '0204', description: { es: 'Carne de animales de las especies ovina o caprina, fresca, refrigerada o congelada', en: 'Meat of sheep or goats, fresh, chilled or frozen' } },
  { code: '0205', description: { es: 'Carne de animales de las especies caballar, asnal o mular, fresca, refrigerada o congelada', en: 'Meat of horses, asses, mules or hinnies, fresh, chilled or frozen' } },
  { code: '0206', description: { es: 'Despojos comestibles de animales de las especies bovina, porcina, ovina, caprina, caballar', en: 'Edible offal of bovine, swine, sheep, goats, horses' } },
  { code: '0207', description: { es: 'Carne y despojos comestibles de aves de la partida 0105, frescos, refrigerados o congelados', en: 'Meat and edible offal of poultry, fresh, chilled or frozen' } },
  { code: '0208', description: { es: 'Las demas carnes y despojos comestibles, frescos, refrigerados o congelados', en: 'Other meat and edible meat offal, fresh, chilled or frozen' } },
  { code: '0209', description: { es: 'Tocino sin partes magras y grasa de cerdo o de ave sin fundir', en: 'Pig fat and poultry fat, not rendered' } },
  { code: '0210', description: { es: 'Carne y despojos comestibles, salados, en salmuera, secos o ahumados', en: 'Meat and edible meat offal, salted, dried or smoked' } },

  // =========================================================================
  // CHAPTER 03 - PESCADOS, CRUSTACEOS / FISH
  // =========================================================================
  { code: '0301', description: { es: 'Peces vivos', en: 'Live fish' } },
  { code: '0302', description: { es: 'Pescado fresco o refrigerado, excepto filetes', en: 'Fish, fresh or chilled, excluding fillets' } },
  { code: '0303', description: { es: 'Pescado congelado, excepto filetes', en: 'Fish, frozen, excluding fillets' } },
  { code: '0304', description: { es: 'Filetes y demas carne de pescado, frescos, refrigerados o congelados', en: 'Fish fillets and other fish meat, fresh, chilled or frozen' } },
  { code: '0305', description: { es: 'Pescado seco, salado o en salmuera; pescado ahumado', en: 'Fish, dried, salted or in brine; smoked fish' } },
  { code: '0306', description: { es: 'Crustaceos, incluso pelados, vivos, frescos, refrigerados o congelados', en: 'Crustaceans, live, fresh, chilled or frozen' } },
  { code: '0307', description: { es: 'Moluscos, incluso separados de sus valvas', en: 'Molluscs, whether in shell or not' } },
  { code: '0308', description: { es: 'Invertebrados acuaticos, excepto crustaceos y moluscos', en: 'Aquatic invertebrates other than crustaceans and molluscs' } },
  { code: '0309', description: { es: 'Harinas, polvo y pellets de pescado, crustaceos o moluscos aptos para consumo humano', en: 'Flours, meals and pellets of fish, crustaceans, fit for human consumption' } },

  // =========================================================================
  // CHAPTER 04 - LECHE, HUEVOS, MIEL / DAIRY, EGGS, HONEY
  // =========================================================================
  { code: '0401', description: { es: 'Leche y nata, sin concentrar, sin adicion de azucar', en: 'Milk and cream, not concentrated, not sweetened' } },
  { code: '0402', description: { es: 'Leche y nata, concentradas o con adicion de azucar', en: 'Milk and cream, concentrated or sweetened' } },
  { code: '0403', description: { es: 'Suero de mantequilla, leche cuajada, yogur, kefir', en: 'Buttermilk, curdled milk, yogurt, kephir' } },
  { code: '0404', description: { es: 'Lactosuero; productos constituidos por componentes naturales de la leche', en: 'Whey; products consisting of natural milk constituents' } },
  { code: '0405', description: { es: 'Mantequilla y demas materias grasas de la leche', en: 'Butter and other fats and oils derived from milk' } },
  { code: '0406', description: { es: 'Quesos y requeson', en: 'Cheese and curd' } },
  { code: '0407', description: { es: 'Huevos de ave con cascara, frescos, conservados o cocidos', en: 'Birds eggs, in shell, fresh, preserved or cooked' } },
  { code: '0408', description: { es: 'Huevos de ave sin cascara y yemas, frescos, secos o cocidos', en: 'Birds eggs, not in shell, and yolks' } },
  { code: '0409', description: { es: 'Miel natural', en: 'Natural honey' } },
  { code: '0410', description: { es: 'Productos comestibles de origen animal no expresados ni comprendidos en otra parte', en: 'Edible products of animal origin, not elsewhere specified' } },

  // =========================================================================
  // CHAPTER 05 - PRODUCTOS DE ORIGEN ANIMAL / ANIMAL PRODUCTS
  // =========================================================================
  { code: '0501', description: { es: 'Cabello en bruto, incluso lavado o desgrasado', en: 'Human hair, unworked' } },
  { code: '0502', description: { es: 'Cerdas de cerdo o jabali; pelo de tejon y demas pelos para cepilleria', en: 'Pigs, hogs or boar bristles; badger hair and other brush making hair' } },
  { code: '0504', description: { es: 'Tripas, vejigas y estomagos de animales, excepto de pescado', en: 'Guts, bladders and stomachs of animals, other than fish' } },
  { code: '0505', description: { es: 'Pieles y demas partes de ave, con sus plumas o plumon', en: 'Skins and other parts of birds, with feathers or down' } },
  { code: '0506', description: { es: 'Huesos y nucleos corneos, en bruto, desgrasados o desgelatinizados', en: 'Bones and horn-cores, unworked, defatted' } },
  { code: '0507', description: { es: 'Marfil, concha, ballenas, cuernos, astas, cascos, pezunas, unas y garras, en bruto', en: 'Ivory, tortoise-shell, whalebone, horns, antlers, hooves, nails, claws' } },
  { code: '0508', description: { es: 'Coral y materias similares; conchas y caparazones de moluscos', en: 'Coral and similar materials; shells of molluscs' } },
  { code: '0510', description: { es: 'Ambar gris, castoreo, algalia y almizcle; cantaridas', en: 'Ambergris, castoreum, civet and musk; cantharides' } },
  { code: '0511', description: { es: 'Productos de origen animal no expresados ni comprendidos en otra parte', en: 'Animal products not elsewhere specified; dead animals' } },

  // =========================================================================
  // CHAPTER 06 - PLANTAS VIVAS / LIVE PLANTS
  // =========================================================================
  { code: '0601', description: { es: 'Bulbos, cebollas, tuberculos, raices y bulbos tuberosos, turiones y rizomas, en reposo vegetativo', en: 'Bulbs, tubers, tuberous roots, corms, crowns and rhizomes, dormant' } },
  { code: '0602', description: { es: 'Las demas plantas vivas, incluidas sus raices; micelios', en: 'Other live plants, including roots; mushroom spawn' } },
  { code: '0603', description: { es: 'Flores y capullos cortados para ramos o adornos, frescos, secos o blanqueados', en: 'Cut flowers and flower buds for bouquets or ornamental purposes' } },
  { code: '0604', description: { es: 'Follaje, hojas, ramas y demas partes de plantas, sin flores ni capullos', en: 'Foliage, branches and other parts of plants, without flowers or buds' } },

  // =========================================================================
  // CHAPTER 07 - HORTALIZAS / VEGETABLES
  // =========================================================================
  { code: '0701', description: { es: 'Patatas frescas o refrigeradas', en: 'Potatoes, fresh or chilled' } },
  { code: '0702', description: { es: 'Tomates frescos o refrigerados', en: 'Tomatoes, fresh or chilled' } },
  { code: '0703', description: { es: 'Cebollas, chalotes, ajos, puerros y demas hortalizas aliaceas', en: 'Onions, shallots, garlic, leeks and other alliaceous vegetables' } },
  { code: '0704', description: { es: 'Coles, coliflores, brecoles, coles rizadas y productos comestibles similares del genero Brassica', en: 'Cabbages, cauliflowers, kohlrabi, kale and similar edible brassicas' } },
  { code: '0705', description: { es: 'Lechugas y achicorias, frescas o refrigeradas', en: 'Lettuce and chicory, fresh or chilled' } },
  { code: '0706', description: { es: 'Zanahorias, nabos, remolachas para ensalada, salsifies, apionabos, rabanos y raices comestibles similares', en: 'Carrots, turnips, salad beetroot, salsify, celeriac, radishes' } },
  { code: '0707', description: { es: 'Pepinos y pepinillos, frescos o refrigerados', en: 'Cucumbers and gherkins, fresh or chilled' } },
  { code: '0708', description: { es: 'Hortalizas de vaina, aunque esten desvainadas, frescas o refrigeradas', en: 'Leguminous vegetables, shelled or unshelled, fresh or chilled' } },
  { code: '0709', description: { es: 'Las demas hortalizas, frescas o refrigeradas', en: 'Other vegetables, fresh or chilled' } },
  { code: '0710', description: { es: 'Hortalizas, aunque esten cocidas en agua o vapor, congeladas', en: 'Vegetables, uncooked or cooked by steaming or boiling, frozen' } },
  { code: '0711', description: { es: 'Hortalizas conservadas provisionalmente, pero todavia impropias para consumo inmediato', en: 'Vegetables provisionally preserved, but unsuitable for immediate consumption' } },
  { code: '0712', description: { es: 'Hortalizas secas, incluidas las cortadas en trozos o rodajas', en: 'Dried vegetables, whole, cut, sliced, broken or in powder' } },
  { code: '0713', description: { es: 'Hortalizas de vaina secas desvainadas, aunque esten mondadas o partidas', en: 'Dried leguminous vegetables, shelled' } },
  { code: '0714', description: { es: 'Raices de mandioca, arrurruz o salep; aguaturmas; batatas y raices similares', en: 'Manioc, arrowroot, salep, Jerusalem artichokes, sweet potatoes' } },

  // =========================================================================
  // CHAPTER 08 - FRUTAS / FRUITS
  // =========================================================================
  { code: '0801', description: { es: 'Cocos, nueces del Brasil y nueces de caju, frescos o secos', en: 'Coconuts, Brazil nuts and cashew nuts, fresh or dried' } },
  { code: '0802', description: { es: 'Los demas frutos de cascara frescos o secos', en: 'Other nuts, fresh or dried' } },
  { code: '0803', description: { es: 'Bananas, incluidos los platanos, frescos o secos', en: 'Bananas, including plantains, fresh or dried' } },
  { code: '0804', description: { es: 'Datiles, higos, pinas, aguacates, guayabas, mangos y mangostanes, frescos o secos', en: 'Dates, figs, pineapples, avocados, guavas, mangoes and mangosteens' } },
  { code: '0805', description: { es: 'Agrios frescos o secos', en: 'Citrus fruit, fresh or dried' } },
  { code: '0806', description: { es: 'Uvas, frescas o secas, incluidas las pasas', en: 'Grapes, fresh or dried' } },
  { code: '0807', description: { es: 'Melones, sandias y papayas, frescos', en: 'Melons, watermelons and papaws (papayas), fresh' } },
  { code: '0808', description: { es: 'Manzanas, peras y membrillos, frescos', en: 'Apples, pears and quinces, fresh' } },
  { code: '0809', description: { es: 'Albaricoques, cerezas, melocotones, ciruelas y endrinas, frescos', en: 'Apricots, cherries, peaches, plums and sloes, fresh' } },
  { code: '0810', description: { es: 'Las demas frutas u otros frutos, frescos', en: 'Other fruit, fresh' } },
  { code: '0811', description: { es: 'Frutas y otros frutos, sin cocer o cocidos en agua o vapor, congelados', en: 'Fruit and nuts, uncooked or cooked, frozen' } },
  { code: '0812', description: { es: 'Frutas y otros frutos, conservados provisionalmente', en: 'Fruit and nuts, provisionally preserved' } },
  { code: '0813', description: { es: 'Frutas y otros frutos, secos, excepto los de las partidas 0801 a 0806', en: 'Fruit, dried, other than that of headings 0801 to 0806' } },
  { code: '0814', description: { es: 'Cortezas de agrios, de melones o de sandias, frescas, congeladas, secas', en: 'Peel of citrus fruit or melons, fresh, frozen, dried' } },

  // =========================================================================
  // CHAPTER 09 - CAFE, TE, ESPECIAS / COFFEE, TEA, SPICES
  // =========================================================================
  { code: '0901', description: { es: 'Cafe, incluso tostado o descafeinado; cascara y cascarilla de cafe; sucedaneos del cafe', en: 'Coffee, whether or not roasted or decaffeinated; coffee husks and skins; coffee substitutes' } },
  { code: '0902', description: { es: 'Te, incluso aromatizado', en: 'Tea, whether or not flavoured' } },
  { code: '0903', description: { es: 'Yerba mate', en: 'Mate' } },
  { code: '0904', description: { es: 'Pimienta del genero Piper; frutos de los generos Capsicum o Pimenta, secos, triturados o pulverizados', en: 'Pepper; dried, crushed or ground fruits of the genus Capsicum or Pimenta' } },
  { code: '0905', description: { es: 'Vainilla', en: 'Vanilla' } },
  { code: '0906', description: { es: 'Canela y flores de canelero', en: 'Cinnamon and cinnamon-tree flowers' } },
  { code: '0907', description: { es: 'Clavos (frutos enteros, clavillos y pedunculos)', en: 'Cloves (whole fruit, cloves and stems)' } },
  { code: '0908', description: { es: 'Nuez moscada, macis, amomos y cardamomos', en: 'Nutmeg, mace and cardamoms' } },
  { code: '0909', description: { es: 'Semillas de anis, badiana, hinojo, cilantro, comino o alcaravea; bayas de enebro', en: 'Seeds of anise, badian, fennel, coriander, cumin or caraway; juniper berries' } },
  { code: '0910', description: { es: 'Jengibre, azafran, curcuma, tomillo, hojas de laurel, curry y demas especias', en: 'Ginger, saffron, turmeric, thyme, bay leaves, curry and other spices' } },

  // =========================================================================
  // CHAPTER 10 - CEREALES / CEREALS
  // =========================================================================
  { code: '1001', description: { es: 'Trigo y morcajo (tranquillon)', en: 'Wheat and meslin' } },
  { code: '1002', description: { es: 'Centeno', en: 'Rye' } },
  { code: '1003', description: { es: 'Cebada', en: 'Barley' } },
  { code: '1004', description: { es: 'Avena', en: 'Oats' } },
  { code: '1005', description: { es: 'Maiz', en: 'Maize (corn)' } },
  { code: '1006', description: { es: 'Arroz', en: 'Rice' } },
  { code: '1007', description: { es: 'Sorgo de grano', en: 'Grain sorghum' } },
  { code: '1008', description: { es: 'Alforfon, mijo y alpiste; los demas cereales', en: 'Buckwheat, millet and canary seeds; other cereals' } },

  // =========================================================================
  // CHAPTER 11 - PRODUCTOS DE LA MOLINERIA / MILLING PRODUCTS
  // =========================================================================
  { code: '1101', description: { es: 'Harina de trigo o de morcajo', en: 'Wheat or meslin flour' } },
  { code: '1102', description: { es: 'Harina de cereales, excepto de trigo o de morcajo', en: 'Cereal flours other than of wheat or meslin' } },
  { code: '1103', description: { es: 'Grañones, semola y pellets, de cereales', en: 'Cereal groats, meal and pellets' } },
  { code: '1104', description: { es: 'Granos de cereales trabajados de otro modo; germenes de cereales', en: 'Cereal grains otherwise worked; germ of cereals' } },
  { code: '1105', description: { es: 'Harina, semola, polvo, copos, granulos y pellets, de patata', en: 'Flour, meal, powder, flakes, granules and pellets of potatoes' } },
  { code: '1106', description: { es: 'Harina, semola y polvo de las hortalizas de la partida 0713, de sagu o de las raices de la partida 0714', en: 'Flour, meal and powder of dried leguminous vegetables, of sago or of roots of heading 0714' } },
  { code: '1107', description: { es: 'Malta, incluso tostada', en: 'Malt, whether or not roasted' } },
  { code: '1108', description: { es: 'Almidon y fecula; inulina', en: 'Starches; inulin' } },
  { code: '1109', description: { es: 'Gluten de trigo, incluso seco', en: 'Wheat gluten, whether or not dried' } },

  // =========================================================================
  // CHAPTER 12 - SEMILLAS OLEAGINOSAS / OIL SEEDS
  // =========================================================================
  { code: '1201', description: { es: 'Habas de soja, incluso quebrantadas', en: 'Soya beans, whether or not broken' } },
  { code: '1202', description: { es: 'Cacahuetes sin tostar ni cocer de otro modo', en: 'Ground-nuts, not roasted or otherwise cooked' } },
  { code: '1203', description: { es: 'Copra', en: 'Copra' } },
  { code: '1204', description: { es: 'Semillas de lino, incluso quebrantadas', en: 'Linseed, whether or not broken' } },
  { code: '1205', description: { es: 'Semillas de nabo o de colza, incluso quebrantadas', en: 'Rape or colza seeds, whether or not broken' } },
  { code: '1206', description: { es: 'Semillas de girasol, incluso quebrantadas', en: 'Sunflower seeds, whether or not broken' } },
  { code: '1207', description: { es: 'Las demas semillas y frutos oleaginosos, incluso quebrantados', en: 'Other oil seeds and oleaginous fruits, whether or not broken' } },
  { code: '1208', description: { es: 'Harina de semillas o de frutos oleaginosos, excepto la harina de mostaza', en: 'Flours and meals of oil seeds or oleaginous fruits' } },
  { code: '1209', description: { es: 'Semillas, frutos y esporas, para siembra', en: 'Seeds, fruit and spores, of a kind used for sowing' } },
  { code: '1210', description: { es: 'Conos de lupulo frescos o secos; lupulino', en: 'Hop cones, fresh or dried; lupulin' } },
  { code: '1211', description: { es: 'Plantas, partes de plantas, semillas y frutos utilizados en perfumeria, medicina o como insecticidas', en: 'Plants and parts of plants used in perfumery, pharmacy or for insecticidal purposes' } },
  { code: '1212', description: { es: 'Algarrobas, algas, remolacha azucarera y caña de azucar, frescas, refrigeradas, congeladas o secas', en: 'Locust beans, seaweeds, sugar beet and sugar cane' } },
  { code: '1213', description: { es: 'Paja y cascabillo de cereales, en bruto, incluso picados', en: 'Cereal straw and husks, unprepared' } },
  { code: '1214', description: { es: 'Nabos forrajeros, remolachas forrajeras, raices forrajeras, heno, alfalfa', en: 'Swedes, mangolds, fodder roots, hay, lucerne (alfalfa)' } },

  // =========================================================================
  // CHAPTER 13 - GOMAS, RESINAS / LAC, GUMS, RESINS
  // =========================================================================
  { code: '1301', description: { es: 'Goma laca; gomas, resinas, gomorresinas y oleorresinas naturales', en: 'Lac; natural gums, resins, gum-resins and oleoresins' } },
  { code: '1302', description: { es: 'Jugos y extractos vegetales; materias pecticas; agar-agar y demas mucilagos', en: 'Vegetable saps and extracts; pectic substances; agar-agar and other mucilages' } },

  // =========================================================================
  // CHAPTER 14 - MATERIAS TRENZABLES / VEGETABLE PLAITING MATERIALS
  // =========================================================================
  { code: '1401', description: { es: 'Materias vegetales de las especies utilizadas principalmente en cesteria o esparteria', en: 'Vegetable materials of a kind used primarily for plaiting' } },
  { code: '1404', description: { es: 'Productos vegetales no expresados ni comprendidos en otra parte', en: 'Vegetable products not elsewhere specified or included' } },

  // =========================================================================
  // CHAPTER 15 - GRASAS Y ACEITES / FATS AND OILS
  // =========================================================================
  { code: '1501', description: { es: 'Grasa de cerdo y grasa de ave, excepto las de las partidas 0209 o 1503', en: 'Pig fat and poultry fat, other than that of heading 0209 or 1503' } },
  { code: '1502', description: { es: 'Grasa de animales de las especies bovina, ovina o caprina', en: 'Fats of bovine animals, sheep or goats' } },
  { code: '1503', description: { es: 'Estearina solar, aceite de manteca de cerdo, oleoestearina, oleomargarina', en: 'Lard stearin, lard oil, oleostearin, oleo-oil and tallow oil' } },
  { code: '1504', description: { es: 'Grasas y aceites, y sus fracciones, de pescado o de mamiferos marinos', en: 'Fats and oils and their fractions, of fish or marine mammals' } },
  { code: '1505', description: { es: 'Grasa de lana y sustancias grasas derivadas, incluida la lanolina', en: 'Wool grease and fatty substances derived therefrom, including lanolin' } },
  { code: '1506', description: { es: 'Las demas grasas y aceites animales, y sus fracciones', en: 'Other animal fats and oils and their fractions' } },
  { code: '1507', description: { es: 'Aceite de soja y sus fracciones', en: 'Soya-bean oil and its fractions' } },
  { code: '1508', description: { es: 'Aceite de cacahuete y sus fracciones', en: 'Ground-nut oil and its fractions' } },
  { code: '1509', description: { es: 'Aceite de oliva y sus fracciones', en: 'Olive oil and its fractions' } },
  { code: '1510', description: { es: 'Los demas aceites y sus fracciones obtenidos exclusivamente de aceituna', en: 'Other oils and their fractions, obtained solely from olives' } },
  { code: '1511', description: { es: 'Aceite de palma y sus fracciones', en: 'Palm oil and its fractions' } },
  { code: '1512', description: { es: 'Aceites de girasol, cartamo o algodon, y sus fracciones', en: 'Sunflower-seed, safflower or cotton-seed oil, and their fractions' } },
  { code: '1513', description: { es: 'Aceites de coco, de palmiste o de babasu, y sus fracciones', en: 'Coconut, palm kernel or babassu oil, and their fractions' } },
  { code: '1514', description: { es: 'Aceites de nabo, de colza o de mostaza, y sus fracciones', en: 'Rape, colza or mustard oil, and their fractions' } },
  { code: '1515', description: { es: 'Las demas grasas y aceites vegetales fijos, y sus fracciones', en: 'Other fixed vegetable fats and oils, and their fractions' } },
  { code: '1516', description: { es: 'Grasas y aceites, animales o vegetales, y sus fracciones, parcial o totalmente hidrogenados', en: 'Animal or vegetable fats and oils, hydrogenated' } },
  { code: '1517', description: { es: 'Margarina; mezclas o preparaciones alimenticias de grasas o aceites', en: 'Margarine; edible mixtures or preparations of animal or vegetable fats' } },
  { code: '1518', description: { es: 'Grasas y aceites animales o vegetales cocidos, oxidados, deshidratados, sulfurados, soplados', en: 'Animal or vegetable fats and oils, chemically modified' } },
  { code: '1520', description: { es: 'Glicerol en bruto; aguas y lejias glicerinosas', en: 'Glycerol, crude; glycerol waters and glycerol lyes' } },
  { code: '1521', description: { es: 'Ceras vegetales, ceras de abejas o de otros insectos y esperma de ballena', en: 'Vegetable waxes, beeswax, other insect waxes and spermaceti' } },
  { code: '1522', description: { es: 'Degras; residuos del tratamiento de grasas o ceras', en: 'Degras; residues resulting from the treatment of fatty substances or waxes' } },

  // =========================================================================
  // CHAPTER 16 - PREPARACIONES DE CARNE / PREPARATIONS OF MEAT
  // =========================================================================
  { code: '1601', description: { es: 'Embutidos y productos similares de carne, despojos o sangre', en: 'Sausages and similar products, of meat, offal or blood' } },
  { code: '1602', description: { es: 'Las demas preparaciones y conservas de carne, despojos o sangre', en: 'Other prepared or preserved meat, offal or blood' } },
  { code: '1603', description: { es: 'Extractos y jugos de carne, pescado, crustaceos o moluscos', en: 'Extracts and juices of meat, fish, crustaceans or molluscs' } },
  { code: '1604', description: { es: 'Preparaciones y conservas de pescado; caviar y sus sucedaneos', en: 'Prepared or preserved fish; caviar and caviar substitutes' } },
  { code: '1605', description: { es: 'Crustaceos, moluscos y demas invertebrados acuaticos, preparados o conservados', en: 'Crustaceans, molluscs and other aquatic invertebrates, prepared or preserved' } },

  // =========================================================================
  // CHAPTER 17 - AZUCARES / SUGARS
  // =========================================================================
  { code: '1701', description: { es: 'Azucar de caña o de remolacha y sacarosa quimicamente pura, en estado solido', en: 'Cane or beet sugar and chemically pure sucrose, in solid form' } },
  { code: '1702', description: { es: 'Los demas azucares, incluidas la lactosa, maltosa, glucosa y fructosa', en: 'Other sugars, including lactose, maltose, glucose and fructose' } },
  { code: '1703', description: { es: 'Melaza procedente de la extraccion o del refinado del azucar', en: 'Molasses resulting from the extraction or refining of sugar' } },
  { code: '1704', description: { es: 'Articulos de confiteria sin cacao, incluido el chocolate blanco', en: 'Sugar confectionery not containing cocoa, including white chocolate' } },

  // =========================================================================
  // CHAPTER 18 - CACAO / COCOA
  // =========================================================================
  { code: '1801', description: { es: 'Cacao en grano, entero o partido, crudo o tostado', en: 'Cocoa beans, whole or broken, raw or roasted' } },
  { code: '1802', description: { es: 'Cascara, cascarilla, peliculas y demas residuos de cacao', en: 'Cocoa shells, husks, skins and other cocoa waste' } },
  { code: '1803', description: { es: 'Pasta de cacao, incluso desgrasada', en: 'Cocoa paste, whether or not defatted' } },
  { code: '1804', description: { es: 'Manteca, grasa y aceite de cacao', en: 'Cocoa butter, fat and oil' } },
  { code: '1805', description: { es: 'Cacao en polvo sin adicion de azucar ni otro edulcorante', en: 'Cocoa powder, not containing added sugar or other sweetening matter' } },
  { code: '1806', description: { es: 'Chocolate y demas preparaciones alimenticias que contengan cacao', en: 'Chocolate and other food preparations containing cocoa' } },

  // =========================================================================
  // CHAPTER 19 - PREPARACIONES DE CEREALES / PREPARATIONS OF CEREALS
  // =========================================================================
  { code: '1901', description: { es: 'Extracto de malta; preparaciones alimenticias de harina, semola, almidon o extracto de malta', en: 'Malt extract; food preparations of flour, groats, meal, starch or malt extract' } },
  { code: '1902', description: { es: 'Pastas alimenticias, incluso cocidas o rellenas', en: 'Pasta, whether or not cooked or stuffed' } },
  { code: '1903', description: { es: 'Tapioca y sus sucedaneos preparados con fecula, en copos, grumos, granos perlados', en: 'Tapioca and substitutes therefor prepared from starch' } },
  { code: '1904', description: { es: 'Productos a base de cereales obtenidos por inflado o tostado; cereales en grano precocidos', en: 'Prepared foods obtained by the swelling or roasting of cereals' } },
  { code: '1905', description: { es: 'Productos de panaderia, pasteleria o galleteria', en: 'Bread, pastry, cakes, biscuits and other bakers wares' } },

  // =========================================================================
  // CHAPTER 20 - PREPARACIONES DE HORTALIZAS / PREPARATIONS OF VEGETABLES
  // =========================================================================
  { code: '2001', description: { es: 'Hortalizas, frutas u otros frutos y demas partes comestibles de plantas, preparados o conservados en vinagre', en: 'Vegetables, fruit, nuts and other edible parts of plants, prepared or preserved by vinegar' } },
  { code: '2002', description: { es: 'Tomates preparados o conservados, excepto en vinagre', en: 'Tomatoes, prepared or preserved otherwise than by vinegar' } },
  { code: '2003', description: { es: 'Setas y demas hongos y trufas, preparados o conservados, excepto en vinagre', en: 'Mushrooms and truffles, prepared or preserved otherwise than by vinegar' } },
  { code: '2004', description: { es: 'Las demas hortalizas preparadas o conservadas, excepto en vinagre, congeladas', en: 'Other vegetables prepared or preserved, frozen' } },
  { code: '2005', description: { es: 'Las demas hortalizas preparadas o conservadas, excepto en vinagre, sin congelar', en: 'Other vegetables prepared or preserved, not frozen' } },
  { code: '2006', description: { es: 'Hortalizas, frutas u otros frutos o sus cortezas y demas partes de plantas, confitados con azucar', en: 'Vegetables, fruit, nuts, fruit-peel and other parts of plants, preserved by sugar' } },
  { code: '2007', description: { es: 'Confituras, jaleas y mermeladas, pures y pastas de frutas u otros frutos', en: 'Jams, fruit jellies, marmalades, fruit or nut puree and pastes' } },
  { code: '2008', description: { es: 'Frutas u otros frutos y demas partes comestibles de plantas, preparados o conservados de otro modo', en: 'Fruit, nuts and other edible parts of plants, otherwise prepared or preserved' } },
  { code: '2009', description: { es: 'Jugos de frutas u otros frutos, incluido el mosto de uva, o de hortalizas, sin fermentar', en: 'Fruit juices and vegetable juices, unfermented' } },

  // =========================================================================
  // CHAPTER 21 - PREPARACIONES ALIMENTICIAS DIVERSAS / MISCELLANEOUS EDIBLE PREPARATIONS
  // =========================================================================
  { code: '2101', description: { es: 'Extractos, esencias y concentrados de cafe, te o yerba mate; preparaciones a base de estos productos', en: 'Extracts, essences and concentrates of coffee, tea or mate; preparations' } },
  { code: '2102', description: { es: 'Levaduras, vivas o muertas; los demas microorganismos monocelulares muertos', en: 'Yeasts, active or inactive; other single-cell micro-organisms, dead' } },
  { code: '2103', description: { es: 'Preparaciones para salsas y salsas preparadas; condimentos y sazonadores compuestos', en: 'Sauces and preparations therefor; mixed condiments and seasonings' } },
  { code: '2104', description: { es: 'Preparaciones para sopas, potajes o caldos; sopas, potajes o caldos preparados', en: 'Soups and broths and preparations therefor' } },
  { code: '2105', description: { es: 'Helados, incluso con cacao', en: 'Ice cream and other edible ice, whether or not containing cocoa' } },
  { code: '2106', description: { es: 'Preparaciones alimenticias no expresadas ni comprendidas en otra parte', en: 'Food preparations not elsewhere specified or included' } },

  // =========================================================================
  // CHAPTER 22 - BEBIDAS / BEVERAGES
  // =========================================================================
  { code: '2201', description: { es: 'Agua, incluidas el agua mineral natural o artificial y la gaseada', en: 'Waters, including natural or artificial mineral waters and aerated waters' } },
  { code: '2202', description: { es: 'Agua, incluidas el agua mineral y la gaseada, con adicion de azucar u otro edulcorante', en: 'Waters, including mineral and aerated waters, containing added sugar' } },
  { code: '2203', description: { es: 'Cerveza de malta', en: 'Beer made from malt' } },
  { code: '2204', description: { es: 'Vino de uvas frescas, incluido el encabezado; mosto de uva', en: 'Wine of fresh grapes, including fortified wines; grape must' } },
  { code: '2205', description: { es: 'Vermut y demas vinos de uvas frescas preparados con plantas o sustancias aromaticas', en: 'Vermouth and other wine of fresh grapes flavoured with plants or aromatic substances' } },
  { code: '2206', description: { es: 'Las demas bebidas fermentadas; mezclas de bebidas fermentadas', en: 'Other fermented beverages; mixtures of fermented beverages' } },
  { code: '2207', description: { es: 'Alcohol etilico sin desnaturalizar con grado alcoholico volumetrico >= 80%', en: 'Undenatured ethyl alcohol of an alcoholic strength >= 80% vol' } },
  { code: '2208', description: { es: 'Alcohol etilico sin desnaturalizar con grado < 80% vol; aguardientes, licores y demas bebidas espirituosas', en: 'Undenatured ethyl alcohol < 80% vol; spirits, liqueurs and other spirituous beverages' } },
  { code: '2209', description: { es: 'Vinagre y sucedaneos del vinagre obtenidos a partir del acido acetico', en: 'Vinegar and substitutes for vinegar obtained from acetic acid' } },

  // =========================================================================
  // CHAPTER 23 - RESIDUOS INDUSTRIAS ALIMENTARIAS / FOOD INDUSTRY RESIDUES
  // =========================================================================
  { code: '2301', description: { es: 'Harina, polvo y pellets, de carne, despojos, pescado o crustaceos, impropios para consumo humano', en: 'Flours, meals and pellets, of meat or fish, unfit for human consumption' } },
  { code: '2302', description: { es: 'Salvados, moyuelos y demas residuos del cernido, molienda u otros tratamientos de cereales', en: 'Bran, sharps and other residues of the sifting, milling or working of cereals' } },
  { code: '2303', description: { es: 'Residuos de la industria del almidon y residuos similares', en: 'Residues of starch manufacture and similar residues' } },
  { code: '2304', description: { es: 'Tortas y demas residuos solidos de la extraccion del aceite de soja', en: 'Oil-cake and other solid residues from extraction of soyabean oil' } },
  { code: '2305', description: { es: 'Tortas y demas residuos solidos de la extraccion del aceite de cacahuete', en: 'Oil-cake and other solid residues from extraction of ground-nut oil' } },
  { code: '2306', description: { es: 'Tortas y demas residuos solidos de la extraccion de grasas o aceites vegetales', en: 'Oil-cake and other solid residues from extraction of vegetable fats or oils' } },
  { code: '2307', description: { es: 'Lias o heces de vino; tartaro bruto', en: 'Wine lees; argol' } },
  { code: '2308', description: { es: 'Materias vegetales y desperdicios vegetales, residuos y subproductos vegetales utilizados para alimentacion animal', en: 'Vegetable materials and waste, used in animal feeding' } },
  { code: '2309', description: { es: 'Preparaciones del tipo de las utilizadas para la alimentacion de los animales', en: 'Preparations of a kind used in animal feeding' } },

  // =========================================================================
  // CHAPTER 24 - TABACO / TOBACCO
  // =========================================================================
  { code: '2401', description: { es: 'Tabaco en rama o sin elaborar; desperdicios de tabaco', en: 'Unmanufactured tobacco; tobacco refuse' } },
  { code: '2402', description: { es: 'Cigarros, puros, cigarritos y cigarrillos, de tabaco o de sucedaneos del tabaco', en: 'Cigars, cheroots, cigarillos and cigarettes, of tobacco or of tobacco substitutes' } },
  { code: '2403', description: { es: 'Los demas tabacos y sucedaneos del tabaco, elaborados; tabaco homogeneizado o reconstituido', en: 'Other manufactured tobacco and tobacco substitutes; homogenised or reconstituted tobacco' } },

  // =========================================================================
  // CHAPTER 25 - SAL, AZUFRE, TIERRAS / SALT, SULPHUR, EARTHS, STONE
  // =========================================================================
  { code: '2501', description: { es: 'Sal, incluidas la de mesa y la desnaturalizada, y cloruro de sodio puro', en: 'Salt, including table and denatured salt, and pure sodium chloride' } },
  { code: '2502', description: { es: 'Piritas de hierro sin tostar', en: 'Unroasted iron pyrites' } },
  { code: '2503', description: { es: 'Azufre de cualquier clase, excepto el sublimado, el precipitado y el coloidal', en: 'Sulphur of all kinds, other than sublimed, precipitated and colloidal sulphur' } },
  { code: '2504', description: { es: 'Grafito natural', en: 'Natural graphite' } },
  { code: '2505', description: { es: 'Arenas naturales de cualquier clase, incluso coloreadas', en: 'Natural sands of all kinds, whether or not coloured' } },
  { code: '2506', description: { es: 'Cuarzo, incluidas las arenas cuarzosas; cuarcita', en: 'Quartz, including quartzite sands; quartzite' } },
  { code: '2507', description: { es: 'Caolin y demas arcillas caolinicas', en: 'Kaolin and other kaolinic clays' } },
  { code: '2508', description: { es: 'Las demas arcillas, andalucita, cianita y silimanita; mullita', en: 'Other clays, andalusite, kyanite and sillimanite; mullite' } },
  { code: '2509', description: { es: 'Creta', en: 'Chalk' } },
  { code: '2510', description: { es: 'Fosfatos de calcio naturales, fosfatos aluminocalcicos naturales y cretas fosfatadas', en: 'Natural calcium phosphates, natural aluminium calcium phosphates and phosphatic chalk' } },
  { code: '2511', description: { es: 'Sulfato de bario natural (baritina); carbonato de bario natural (witherita)', en: 'Natural barium sulphate (barytes); natural barium carbonate (witherite)' } },
  { code: '2512', description: { es: 'Harinas siliceas fosiles y demas tierras siliceas analogas', en: 'Siliceous fossil meals and similar siliceous earths' } },
  { code: '2513', description: { es: 'Piedra pomez; esmeril; corindon natural, granate natural y demas abrasivos naturales', en: 'Pumice stone; emery; natural corundum, natural garnet and other natural abrasives' } },
  { code: '2514', description: { es: 'Pizarra, incluso desbastada o simplemente troceada, por aserrado o de otro modo', en: 'Slate, whether or not roughly trimmed or merely cut' } },
  { code: '2515', description: { es: 'Marmol, travertinos, ecaussines y demas piedras calizas de talla o de construccion', en: 'Marble, travertine, ecaussine and other calcareous monumental or building stone' } },
  { code: '2516', description: { es: 'Granito, porfido, basalto, arenisca y demas piedras de talla o de construccion', en: 'Granite, porphyry, basalt, sandstone and other monumental or building stone' } },
  { code: '2517', description: { es: 'Cantos, grava, piedras machacadas, para hormigon, balasto, gravas y pedernal', en: 'Pebbles, gravel, broken or crushed stone, for concrete aggregates' } },
  { code: '2518', description: { es: 'Dolomita, incluso sinterizada o calcinada', en: 'Dolomite, whether or not calcined or sintered' } },
  { code: '2519', description: { es: 'Carbonato de magnesio natural (magnesita); magnesia electrofundida', en: 'Natural magnesium carbonate (magnesite); fused magnesia' } },
  { code: '2520', description: { es: 'Yeso natural; anhidrita; yeso fraguable', en: 'Gypsum; anhydrite; plasters' } },
  { code: '2521', description: { es: 'Castinas; piedras para la fabricacion de cal o de cemento', en: 'Limestone flux; limestone and other calcareous stone, for the manufacture of lime or cement' } },
  { code: '2522', description: { es: 'Cal viva, cal apagada y cal hidraulica', en: 'Quicklime, slaked lime and hydraulic lime' } },
  { code: '2523', description: { es: 'Cementos hidraulicos, incluidos los cementos sin pulverizar o clinker', en: 'Portland cement, aluminous cement, slag cement and similar hydraulic cements' } },
  { code: '2524', description: { es: 'Amianto (asbesto)', en: 'Asbestos' } },
  { code: '2525', description: { es: 'Mica, incluida la exfoliada en laminillas irregulares; desperdicios de mica', en: 'Mica, including splittings; mica waste' } },
  { code: '2526', description: { es: 'Esteatita natural, incluso desbastada o simplemente troceada; talco', en: 'Natural steatite, whether or not roughly trimmed; talc' } },
  { code: '2528', description: { es: 'Boratos naturales y sus concentrados; acido borico natural', en: 'Natural borates and concentrates thereof; natural boric acid' } },
  { code: '2529', description: { es: 'Feldespato; leucita; nefelina y nefelina sienita; espato fluor', en: 'Feldspar; leucite; nepheline and nepheline syenite; fluorspar' } },
  { code: '2530', description: { es: 'Materias minerales no expresadas ni comprendidas en otra parte', en: 'Mineral substances not elsewhere specified or included' } },

  // =========================================================================
  // CHAPTER 26 - MINERALES / ORES, SLAG AND ASH
  // =========================================================================
  { code: '2601', description: { es: 'Minerales de hierro y sus concentrados, incluidas las piritas de hierro tostadas', en: 'Iron ores and concentrates, including roasted iron pyrites' } },
  { code: '2602', description: { es: 'Minerales de manganeso y sus concentrados', en: 'Manganese ores and concentrates' } },
  { code: '2603', description: { es: 'Minerales de cobre y sus concentrados', en: 'Copper ores and concentrates' } },
  { code: '2604', description: { es: 'Minerales de niquel y sus concentrados', en: 'Nickel ores and concentrates' } },
  { code: '2605', description: { es: 'Minerales de cobalto y sus concentrados', en: 'Cobalt ores and concentrates' } },
  { code: '2606', description: { es: 'Minerales de aluminio y sus concentrados', en: 'Aluminium ores and concentrates' } },
  { code: '2607', description: { es: 'Minerales de plomo y sus concentrados', en: 'Lead ores and concentrates' } },
  { code: '2608', description: { es: 'Minerales de cinc y sus concentrados', en: 'Zinc ores and concentrates' } },
  { code: '2609', description: { es: 'Minerales de estaño y sus concentrados', en: 'Tin ores and concentrates' } },
  { code: '2610', description: { es: 'Minerales de cromo y sus concentrados', en: 'Chromium ores and concentrates' } },
  { code: '2611', description: { es: 'Minerales de wolframio y sus concentrados', en: 'Tungsten ores and concentrates' } },
  { code: '2612', description: { es: 'Minerales de uranio o de torio y sus concentrados', en: 'Uranium or thorium ores and concentrates' } },
  { code: '2613', description: { es: 'Minerales de molibdeno y sus concentrados', en: 'Molybdenum ores and concentrates' } },
  { code: '2614', description: { es: 'Minerales de titanio y sus concentrados', en: 'Titanium ores and concentrates' } },
  { code: '2615', description: { es: 'Minerales de niobio, tantalio, vanadio o circonio, y sus concentrados', en: 'Niobium, tantalum, vanadium or zirconium ores and concentrates' } },
  { code: '2616', description: { es: 'Minerales de los metales preciosos y sus concentrados', en: 'Precious metal ores and concentrates' } },
  { code: '2617', description: { es: 'Los demas minerales y sus concentrados', en: 'Other ores and concentrates' } },
  { code: '2618', description: { es: 'Escorias granuladas de la siderurgia', en: 'Granulated slag from the manufacture of iron or steel' } },
  { code: '2619', description: { es: 'Escorias y demas desperdicios de la siderurgia', en: 'Slag, dross and other waste from the manufacture of iron or steel' } },
  { code: '2620', description: { es: 'Escorias, cenizas y residuos que contengan metales, arsenico o sus compuestos', en: 'Slag, ash and residues containing metals, arsenic or their compounds' } },
  { code: '2621', description: { es: 'Las demas escorias y cenizas, incluidas las cenizas de algas', en: 'Other slag and ash, including seaweed ash (kelp)' } },

  // =========================================================================
  // CHAPTER 27 - COMBUSTIBLES MINERALES / MINERAL FUELS
  // =========================================================================
  { code: '2701', description: { es: 'Hullas; briquetas, ovoides y combustibles solidos similares, obtenidos de la hulla', en: 'Coal; briquettes, ovoids and similar solid fuels manufactured from coal' } },
  { code: '2702', description: { es: 'Lignitos, incluso aglomerados, excepto el azabache', en: 'Lignite, whether or not agglomerated, excluding jet' } },
  { code: '2703', description: { es: 'Turba, incluida la turba para cama de animales, incluso aglomerada', en: 'Peat, including peat litter, whether or not agglomerated' } },
  { code: '2704', description: { es: 'Coques y semicoques de hulla, lignito o turba, incluso aglomerados', en: 'Coke and semi-coke of coal, of lignite or of peat' } },
  { code: '2705', description: { es: 'Gas de hulla, gas de agua, gas pobre y gases similares', en: 'Coal gas, water gas, producer gas and similar gases' } },
  { code: '2706', description: { es: 'Alquitranes de hulla, de lignito o de turba y demas alquitranes minerales', en: 'Tar distilled from coal, from lignite or from peat' } },
  { code: '2707', description: { es: 'Aceites y demas productos de la destilacion de los alquitranes de hulla de alta temperatura', en: 'Oils and other products of the distillation of high-temperature coal tar' } },
  { code: '2708', description: { es: 'Brea y coque de brea de alquitran de hulla o de otros alquitranes minerales', en: 'Pitch and pitch coke, obtained from coal tar or from other mineral tars' } },
  { code: '2709', description: { es: 'Aceites crudos de petroleo o de mineral bituminoso', en: 'Petroleum oils and oils obtained from bituminous minerals, crude' } },
  { code: '2710', description: { es: 'Aceites de petroleo o de mineral bituminoso, excepto los crudos', en: 'Petroleum oils and oils obtained from bituminous minerals, other than crude' } },
  { code: '2711', description: { es: 'Gas de petroleo y demas hidrocarburos gaseosos', en: 'Petroleum gases and other gaseous hydrocarbons' } },
  { code: '2712', description: { es: 'Vaselina; parafina, cera de petroleo microcristalina', en: 'Petroleum jelly; paraffin wax, micro-crystalline petroleum wax' } },
  { code: '2713', description: { es: 'Coque de petroleo, betun de petroleo y demas residuos de los aceites de petroleo', en: 'Petroleum coke, petroleum bitumen and other residues of petroleum oils' } },
  { code: '2714', description: { es: 'Betunes y asfaltos naturales; asfaltitas y rocas asfalticas', en: 'Bitumen and asphalt, natural; bituminous or oil-shale and tar sands' } },
  { code: '2715', description: { es: 'Mezclas bituminosas a base de asfalto o de betun naturales', en: 'Bituminous mixtures based on natural asphalt or natural bitumen' } },
  { code: '2716', description: { es: 'Energia electrica', en: 'Electrical energy' } },

  // =========================================================================
  // CHAPTER 28 - PRODUCTOS QUIMICOS INORGANICOS / INORGANIC CHEMICALS
  // =========================================================================
  { code: '2801', description: { es: 'Fluor, cloro, bromo y yodo', en: 'Fluorine, chlorine, bromine and iodine' } },
  { code: '2802', description: { es: 'Azufre sublimado o precipitado; azufre coloidal', en: 'Sulphur, sublimed or precipitated; colloidal sulphur' } },
  { code: '2803', description: { es: 'Carbono (negros de humo y otras formas de carbono)', en: 'Carbon (carbon blacks and other forms of carbon)' } },
  { code: '2804', description: { es: 'Hidrogeno, gases nobles y demas elementos no metalicos', en: 'Hydrogen, rare gases and other non-metals' } },
  { code: '2805', description: { es: 'Metales alcalinos o alcalinoterreos; metales de las tierras raras', en: 'Alkali or alkaline-earth metals; rare-earth metals' } },
  { code: '2806', description: { es: 'Cloruro de hidrogeno (acido clorhidrico); acido clorosulfurico', en: 'Hydrogen chloride (hydrochloric acid); chlorosulphuric acid' } },
  { code: '2807', description: { es: 'Acido sulfurico; oleum', en: 'Sulphuric acid; oleum' } },
  { code: '2808', description: { es: 'Acido nitrico; acidos sulfonitricos', en: 'Nitric acid; sulphonitric acids' } },
  { code: '2809', description: { es: 'Pentaoxido de difosforo; acido fosforico; acidos polifosforicos', en: 'Diphosphorus pentaoxide; phosphoric acid; polyphosphoric acids' } },
  { code: '2810', description: { es: 'Oxidos de boro; acidos boricos', en: 'Oxides of boron; boric acids' } },
  { code: '2811', description: { es: 'Los demas acidos inorganicos y los demas compuestos oxigenados inorganicos de los elementos no metalicos', en: 'Other inorganic acids and other inorganic oxygen compounds of non-metals' } },
  { code: '2812', description: { es: 'Halogenuros y oxihalogenuros de los elementos no metalicos', en: 'Halides and halide oxides of non-metals' } },
  { code: '2813', description: { es: 'Sulfuros de los elementos no metalicos; trisulfuro de fosforo comercial', en: 'Sulphides of non-metals; commercial phosphorus trisulphide' } },
  { code: '2814', description: { es: 'Amoniaco anhidro o en disolucion acuosa', en: 'Ammonia, anhydrous or in aqueous solution' } },
  { code: '2815', description: { es: 'Hidroxido de sodio (sosa caustica); hidroxido de potasio (potasa caustica); peroxidos de sodio o de potasio', en: 'Sodium hydroxide (caustic soda); potassium hydroxide (caustic potash)' } },
  { code: '2816', description: { es: 'Hidroxido y peroxido de magnesio; oxidos, hidroxidos y peroxidos de estroncio o de bario', en: 'Hydroxide and peroxide of magnesium; oxides, hydroxides and peroxides of strontium or barium' } },
  { code: '2817', description: { es: 'Oxido de cinc; peroxido de cinc', en: 'Zinc oxide; zinc peroxide' } },
  { code: '2818', description: { es: 'Corindon artificial; oxido de aluminio; hidroxido de aluminio', en: 'Artificial corundum; aluminium oxide; aluminium hydroxide' } },
  { code: '2819', description: { es: 'Oxidos e hidroxidos de cromo', en: 'Chromium oxides and hydroxides' } },
  { code: '2820', description: { es: 'Oxidos de manganeso', en: 'Manganese oxides' } },
  { code: '2821', description: { es: 'Oxidos e hidroxidos de hierro; tierras colorantes con un contenido de hierro >= 70%', en: 'Iron oxides and hydroxides; earth colours containing >= 70% combined iron' } },
  { code: '2822', description: { es: 'Oxidos e hidroxidos de cobalto; oxidos de cobalto comerciales', en: 'Cobalt oxides and hydroxides; commercial cobalt oxides' } },
  { code: '2823', description: { es: 'Oxidos de titanio', en: 'Titanium oxides' } },
  { code: '2824', description: { es: 'Oxidos de plomo; minio y minio anaranjado', en: 'Lead oxides; red lead and orange lead' } },
  { code: '2825', description: { es: 'Hidrazina e hidroxilamina y sus sales inorganicas; las demas bases inorganicas; los demas oxidos, hidroxidos y peroxidos de metales', en: 'Hydrazine and hydroxylamine and their inorganic salts; other inorganic bases; other metal oxides, hydroxides and peroxides' } },
  { code: '2826', description: { es: 'Fluoruros; fluorosilicatos, fluoroaluminatos y demas sales complejas de fluor', en: 'Fluorides; fluorosilicates, fluoroaluminates and other complex fluorine salts' } },
  { code: '2827', description: { es: 'Cloruros, oxicloruros e hidroxicloruros; bromuros y oxibromuros; yoduros y oxiyoduros', en: 'Chlorides, chloride oxides and hydroxides; bromides and oxides; iodides and oxides' } },
  { code: '2828', description: { es: 'Hipocloritos; hipoclorito de calcio comercial; cloritos; hipobromitos', en: 'Hypochlorites; commercial calcium hypochlorite; chlorites; hypobromites' } },
  { code: '2829', description: { es: 'Cloratos y percloratos; bromatos y perbromatos; yodatos y peryodatos', en: 'Chlorates and perchlorates; bromates and perbromates; iodates and periodates' } },
  { code: '2830', description: { es: 'Sulfuros; polisulfuros, aunque no sean de constitucion quimica definida', en: 'Sulphides; polysulphides, whether or not chemically defined' } },
  { code: '2831', description: { es: 'Ditionitos y sulfoxilatos', en: 'Dithionites and sulphoxylates' } },
  { code: '2832', description: { es: 'Sulfitos; tiosulfatos', en: 'Sulphites; thiosulphates' } },
  { code: '2833', description: { es: 'Sulfatos; alumbres; peroxosulfatos (persulfatos)', en: 'Sulphates; alums; peroxosulphates (persulphates)' } },
  { code: '2834', description: { es: 'Nitritos; nitratos', en: 'Nitrites; nitrates' } },
  { code: '2835', description: { es: 'Fosfinatos (hipofosfitos), fosfonatos (fosfitos) y fosfatos; polifosfatos', en: 'Phosphinates (hypophosphites), phosphonates (phosphites) and phosphates; polyphosphates' } },
  { code: '2836', description: { es: 'Carbonatos; peroxocarbonatos (percarbonatos); carbonato de amonio comercial', en: 'Carbonates; peroxocarbonates (percarbonates); commercial ammonium carbonate' } },
  { code: '2837', description: { es: 'Cianuros, oxicianuros y cianuros complejos', en: 'Cyanides, cyanide oxides and complex cyanides' } },
  { code: '2839', description: { es: 'Silicatos; silicatos de los metales alcalinos comerciales', en: 'Silicates; commercial alkali metal silicates' } },
  { code: '2840', description: { es: 'Boratos; peroxoboratos (perboratos)', en: 'Borates; peroxoborates (perborates)' } },
  { code: '2841', description: { es: 'Sales de los acidos oxometalicos o peroxometalicos', en: 'Salts of oxometallic or peroxometallic acids' } },
  { code: '2842', description: { es: 'Las demas sales de los acidos o peroxoacidos inorganicos, excepto los aziduros', en: 'Other salts of inorganic acids or peroxoacids, excluding azides' } },
  { code: '2843', description: { es: 'Metales preciosos en estado coloidal; compuestos inorganicos u organicos de metales preciosos; amalgamas', en: 'Colloidal precious metals; inorganic or organic compounds of precious metals; amalgams' } },
  { code: '2844', description: { es: 'Elementos quimicos radiactivos e isotopos radiactivos y sus compuestos', en: 'Radioactive chemical elements and radioactive isotopes and their compounds' } },
  { code: '2845', description: { es: 'Isotopos, excepto los de la partida 2844; sus compuestos inorganicos u organicos', en: 'Isotopes other than those of heading 2844; compounds, inorganic or organic' } },
  { code: '2846', description: { es: 'Compuestos inorganicos u organicos de los metales de las tierras raras, del itrio o del escandio', en: 'Compounds, inorganic or organic, of rare-earth metals, of yttrium or of scandium' } },
  { code: '2847', description: { es: 'Peroxido de hidrogeno (agua oxigenada), incluso solidificado con urea', en: 'Hydrogen peroxide, whether or not solidified with urea' } },
  { code: '2849', description: { es: 'Carburos, aunque no sean de constitucion quimica definida', en: 'Carbides, whether or not chemically defined' } },
  { code: '2850', description: { es: 'Hidruros, nitruros, aziduros, siliciuros y boruros, aunque no sean de constitucion quimica definida', en: 'Hydrides, nitrides, azides, silicides and borides' } },
  { code: '2852', description: { es: 'Compuestos inorganicos u organicos de mercurio, aunque no sean de constitucion quimica definida', en: 'Inorganic or organic compounds of mercury' } },
  { code: '2853', description: { es: 'Los demas compuestos inorganicos; aire liquido; aire comprimido; amalgamas', en: 'Other inorganic compounds; liquid air; compressed air; amalgams' } },

  // =========================================================================
  // CHAPTER 29 - PRODUCTOS QUIMICOS ORGANICOS / ORGANIC CHEMICALS
  // =========================================================================
  { code: '2901', description: { es: 'Hidrocarburos aciclicos', en: 'Acyclic hydrocarbons' } },
  { code: '2902', description: { es: 'Hidrocarburos ciclicos', en: 'Cyclic hydrocarbons' } },
  { code: '2903', description: { es: 'Derivados halogenados de los hidrocarburos', en: 'Halogenated derivatives of hydrocarbons' } },
  { code: '2904', description: { es: 'Derivados sulfonados, nitrados o nitrosados de los hidrocarburos', en: 'Sulphonated, nitrated or nitrosated derivatives of hydrocarbons' } },
  { code: '2905', description: { es: 'Alcoholes aciclicos y sus derivados halogenados, sulfonados, nitrados o nitrosados', en: 'Acyclic alcohols and their halogenated, sulphonated, nitrated or nitrosated derivatives' } },
  { code: '2906', description: { es: 'Alcoholes ciclicos y sus derivados halogenados, sulfonados, nitrados o nitrosados', en: 'Cyclic alcohols and their halogenated, sulphonated, nitrated or nitrosated derivatives' } },
  { code: '2907', description: { es: 'Fenoles; fenoles-alcoholes', en: 'Phenols; phenol-alcohols' } },
  { code: '2908', description: { es: 'Derivados halogenados, sulfonados, nitrados o nitrosados de los fenoles o de los fenoles-alcoholes', en: 'Halogenated, sulphonated, nitrated or nitrosated derivatives of phenols' } },
  { code: '2909', description: { es: 'Eteres, eteres-alcoholes, eteres-fenoles, eteres-alcoholes-fenoles, peroxidos de alcoholes y de eteres', en: 'Ethers, ether-alcohols, ether-phenols, peroxides of alcohols and ethers' } },
  { code: '2910', description: { es: 'Epoxidos, epoxialcoholes, epoxifenoles y epoxieteres, con tres atomos en el ciclo, y sus derivados', en: 'Epoxides, epoxyalcohols, epoxyphenols and epoxyethers, with a three-membered ring' } },
  { code: '2911', description: { es: 'Acetales y semiacetales, incluso con otras funciones oxigenadas, y sus derivados', en: 'Acetals and hemiacetals, whether or not with other oxygen function' } },
  { code: '2912', description: { es: 'Aldehidos, incluso con otras funciones oxigenadas; polimeros ciclicos de los aldehidos; paraformaldehido', en: 'Aldehydes, whether or not with other oxygen function; cyclic polymers of aldehydes; paraformaldehyde' } },
  { code: '2913', description: { es: 'Derivados halogenados, sulfonados, nitrados o nitrosados de los productos de la partida 2912', en: 'Halogenated, sulphonated, nitrated or nitrosated derivatives of products of heading 2912' } },
  { code: '2914', description: { es: 'Cetonas y quinonas, incluso con otras funciones oxigenadas, y sus derivados', en: 'Ketones and quinones, whether or not with other oxygen function, and their derivatives' } },
  { code: '2915', description: { es: 'Acidos monocarboxilicos aciclicos saturados y sus anhidridos, halogenuros, peroxidos y peroxiacidos', en: 'Saturated acyclic monocarboxylic acids and their anhydrides, halides, peroxides and peroxyacids' } },
  { code: '2916', description: { es: 'Acidos monocarboxilicos aciclicos no saturados y ciclicos; sus anhidridos, halogenuros, peroxidos', en: 'Unsaturated acyclic and cyclic monocarboxylic acids; their anhydrides, halides, peroxides' } },
  { code: '2917', description: { es: 'Acidos policarboxilicos, sus anhidridos, halogenuros, peroxidos y peroxiacidos; sus derivados', en: 'Polycarboxylic acids, their anhydrides, halides, peroxides and peroxyacids; their derivatives' } },
  { code: '2918', description: { es: 'Acidos carboxilicos con funciones oxigenadas suplementarias y sus derivados', en: 'Carboxylic acids with additional oxygen function and their derivatives' } },
  { code: '2919', description: { es: 'Esteres fosforicos y sus sales, incluidos los lactofosfatos; sus derivados', en: 'Phosphoric esters and their salts, including lactophosphates; their derivatives' } },
  { code: '2920', description: { es: 'Esteres de los demas acidos inorganicos de los no metales y sus sales; sus derivados', en: 'Esters of other inorganic acids of non-metals and their salts; their derivatives' } },
  { code: '2921', description: { es: 'Compuestos con funcion amina', en: 'Amine-function compounds' } },
  { code: '2922', description: { es: 'Compuestos aminados con funciones oxigenadas', en: 'Amino-compounds with oxygen function' } },
  { code: '2923', description: { es: 'Sales e hidroxidos de amonio cuaternario; lecitinas y demas fosfoaminolipidos', en: 'Quaternary ammonium salts and hydroxides; lecithins and other phosphoaminolipids' } },
  { code: '2924', description: { es: 'Compuestos con funcion carboxiamida; compuestos con funcion amida del acido carbonico', en: 'Carboxyamide-function compounds; amide-function compounds of carbonic acid' } },
  { code: '2925', description: { es: 'Compuestos con funcion carboximida o con funcion imina', en: 'Carboxyimide-function compounds and imine-function compounds' } },
  { code: '2926', description: { es: 'Compuestos con funcion nitrilo', en: 'Nitrile-function compounds' } },
  { code: '2927', description: { es: 'Compuestos diazoicos, azoicos o azoxi', en: 'Diazo-, azo- or azoxy-compounds' } },
  { code: '2928', description: { es: 'Derivados organicos de la hidrazina o de la hidroxilamina', en: 'Organic derivatives of hydrazine or of hydroxylamine' } },
  { code: '2929', description: { es: 'Compuestos con otras funciones nitrogenadas', en: 'Compounds with other nitrogen function' } },
  { code: '2930', description: { es: 'Tiocompuestos organicos', en: 'Organo-sulphur compounds' } },
  { code: '2931', description: { es: 'Los demas compuestos organo-inorganicos', en: 'Other organo-inorganic compounds' } },
  { code: '2932', description: { es: 'Compuestos heterociclicos con heteroatomo(s) de oxigeno exclusivamente', en: 'Heterocyclic compounds with oxygen hetero-atom(s) only' } },
  { code: '2933', description: { es: 'Compuestos heterociclicos con heteroatomo(s) de nitrogeno exclusivamente', en: 'Heterocyclic compounds with nitrogen hetero-atom(s) only' } },
  { code: '2934', description: { es: 'Acidos nucleicos y sus sales; los demas compuestos heterociclicos', en: 'Nucleic acids and their salts; other heterocyclic compounds' } },
  { code: '2935', description: { es: 'Sulfonamidas', en: 'Sulphonamides' } },
  { code: '2936', description: { es: 'Provitaminas y vitaminas, naturales o reproducidas por sintesis, y sus derivados', en: 'Provitamins and vitamins, natural or reproduced by synthesis, and their derivatives' } },
  { code: '2937', description: { es: 'Hormonas, prostaglandinas, tromboxanos y leucotrienos, naturales o reproducidos por sintesis', en: 'Hormones, prostaglandins, thromboxanes and leukotrienes, natural or reproduced by synthesis' } },
  { code: '2938', description: { es: 'Glucosidos, naturales o reproducidos por sintesis, sus sales, eteres, esteres y demas derivados', en: 'Glycosides, natural or reproduced by synthesis, their salts, ethers, esters and other derivatives' } },
  { code: '2939', description: { es: 'Alcaloides vegetales, naturales o reproducidos por sintesis, sus sales, eteres, esteres y derivados', en: 'Vegetable alkaloids, natural or reproduced by synthesis, their salts, ethers, esters and derivatives' } },
  { code: '2940', description: { es: 'Azucares quimicamente puros, excepto la sacarosa, lactosa, maltosa, glucosa y fructosa', en: 'Sugars, chemically pure, other than sucrose, lactose, maltose, glucose and fructose' } },
  { code: '2941', description: { es: 'Antibioticos', en: 'Antibiotics' } },
  { code: '2942', description: { es: 'Los demas compuestos organicos', en: 'Other organic compounds' } },

  // =========================================================================
  // CHAPTER 30 - PRODUCTOS FARMACEUTICOS / PHARMACEUTICAL PRODUCTS
  // =========================================================================
  { code: '3001', description: { es: 'Glandulas y demas organos para usos opoterapicos, desecados; extractos de glandulas u organos', en: 'Glands and other organs for organo-therapeutic uses, dried; extracts of glands or organs' } },
  { code: '3002', description: { es: 'Sangre humana; sangre animal; antisueros, demas fracciones de sangre y productos inmunologicos; vacunas', en: 'Human blood; animal blood; antisera, other blood fractions and immunological products; vaccines' } },
  { code: '3003', description: { es: 'Medicamentos constituidos por productos mezclados entre si, sin dosificar ni acondicionar para venta al por menor', en: 'Medicaments consisting of mixed products, not in measured doses or retail packing' } },
  { code: '3004', description: { es: 'Medicamentos constituidos por productos mezclados o sin mezclar, dosificados o acondicionados para venta al por menor', en: 'Medicaments consisting of mixed or unmixed products, in measured doses or retail packing' } },
  { code: '3005', description: { es: 'Guatas, gasas, vendas y articulos analogos impregnados o recubiertos de sustancias farmaceuticas', en: 'Wadding, gauze, bandages and similar articles, impregnated with pharmaceutical substances' } },
  { code: '3006', description: { es: 'Preparaciones y articulos farmaceuticos: catgut, botiquines, cementos para obturacion dental', en: 'Pharmaceutical goods: sterile surgical catgut, first-aid boxes, dental cements' } },

  // =========================================================================
  // CHAPTER 31 - ABONOS / FERTILISERS
  // =========================================================================
  { code: '3101', description: { es: 'Abonos de origen animal o vegetal, incluso mezclados entre si o tratados quimicamente', en: 'Animal or vegetable fertilisers, whether or not mixed together or chemically treated' } },
  { code: '3102', description: { es: 'Abonos minerales o quimicos nitrogenados', en: 'Mineral or chemical fertilisers, nitrogenous' } },
  { code: '3103', description: { es: 'Abonos minerales o quimicos fosfatados', en: 'Mineral or chemical fertilisers, phosphatic' } },
  { code: '3104', description: { es: 'Abonos minerales o quimicos potasicos', en: 'Mineral or chemical fertilisers, potassic' } },
  { code: '3105', description: { es: 'Abonos minerales o quimicos, con dos o tres de los elementos fertilizantes: nitrogeno, fosforo y potasio', en: 'Mineral or chemical fertilisers containing two or three of the fertilising elements' } },

  // =========================================================================
  // CHAPTER 32 - EXTRACTOS CURTIENTES, TINTAS / TANNING, DYEING EXTRACTS
  // =========================================================================
  { code: '3201', description: { es: 'Extractos curtientes de origen vegetal; taninos y sus sales, eteres, esteres y demas derivados', en: 'Tanning extracts of vegetable origin; tannins and their salts, ethers, esters and other derivatives' } },
  { code: '3202', description: { es: 'Productos curtientes organicos sinteticos; productos curtientes inorganicos; preparaciones curtientes', en: 'Synthetic organic tanning substances; inorganic tanning substances; tanning preparations' } },
  { code: '3203', description: { es: 'Materias colorantes de origen vegetal o animal, incluidos los extractos tintoreos', en: 'Colouring matter of vegetable or animal origin, including dyeing extracts' } },
  { code: '3204', description: { es: 'Materias colorantes organicas sinteticas; preparaciones a base de materias colorantes organicas sinteticas', en: 'Synthetic organic colouring matter; preparations based on synthetic organic colouring matter' } },
  { code: '3205', description: { es: 'Lacas colorantes; preparaciones a base de lacas colorantes', en: 'Colour lakes; preparations based on colour lakes' } },
  { code: '3206', description: { es: 'Las demas materias colorantes; preparaciones; productos inorganicos utilizados como luminoforos', en: 'Other colouring matter; preparations; inorganic products used as luminophores' } },
  { code: '3207', description: { es: 'Pigmentos, opacificantes y colores preparados, composiciones vitrificables, engobes', en: 'Prepared pigments, opacifiers and colours, vitrifiable enamels and glazes, engobes' } },
  { code: '3208', description: { es: 'Pinturas y barnices a base de polimeros sinteticos o naturales modificados, dispersos o disueltos en medio no acuoso', en: 'Paints and varnishes based on synthetic or chemically modified natural polymers, in a non-aqueous medium' } },
  { code: '3209', description: { es: 'Pinturas y barnices a base de polimeros sinteticos o naturales modificados, dispersos o disueltos en medio acuoso', en: 'Paints and varnishes based on synthetic or chemically modified natural polymers, in an aqueous medium' } },
  { code: '3210', description: { es: 'Las demas pinturas y barnices; pigmentos al agua preparados para el acabado del cuero', en: 'Other paints and varnishes; prepared water pigments for finishing leather' } },
  { code: '3211', description: { es: 'Secativos preparados', en: 'Prepared driers' } },
  { code: '3212', description: { es: 'Pigmentos dispersos en medios no acuosos, en forma liquida o pastosa; tintas de imprenta', en: 'Pigments dispersed in non-aqueous media, in liquid or paste form; printing ink' } },
  { code: '3213', description: { es: 'Colores para la pintura artistica, la enseñanza, la pintura de rotulos', en: 'Artists, students or signboard painters colours' } },
  { code: '3214', description: { es: 'Masilla, cementos de resina y demas mastiques; plastes de relleno', en: 'Glaziers putty, grafting putty, resin cements, caulking compounds and other mastics' } },
  { code: '3215', description: { es: 'Tintas de imprimir, tintas de escribir o de dibujar y demas tintas, incluso concentradas o solidas', en: 'Printing ink, writing or drawing ink and other inks, whether or not concentrated or solid' } },

  // =========================================================================
  // CHAPTER 33 - ACEITES ESENCIALES, PERFUMERIA / ESSENTIAL OILS, PERFUMERY
  // =========================================================================
  { code: '3301', description: { es: 'Aceites esenciales, desterpenados o no; resinoides; oleorresinas de extraccion', en: 'Essential oils, whether or not terpeneless; resinoids; extracted oleoresins' } },
  { code: '3302', description: { es: 'Mezclas de sustancias odoriferas y mezclas a base de una o varias de estas sustancias', en: 'Mixtures of odoriferous substances and mixtures based on one or more of these substances' } },
  { code: '3303', description: { es: 'Perfumes y aguas de tocador', en: 'Perfumes and toilet waters' } },
  { code: '3304', description: { es: 'Preparaciones de belleza, maquillaje y cuidado de la piel', en: 'Beauty or make-up preparations and preparations for the care of the skin' } },
  { code: '3305', description: { es: 'Preparaciones capilares', en: 'Preparations for use on the hair' } },
  { code: '3306', description: { es: 'Preparaciones para higiene bucal o dental, incluidos los polvos y cremas para la adherencia de dentaduras', en: 'Preparations for oral or dental hygiene, including denture fixative pastes and powders' } },
  { code: '3307', description: { es: 'Preparaciones para afeitar; desodorantes; preparaciones para el baño; depilatorios', en: 'Pre-shave, shaving or after-shave preparations; deodorants; bath preparations; depilatories' } },

  // =========================================================================
  // CHAPTER 34 - JABONES, CERAS / SOAP, WAXES
  // =========================================================================
  { code: '3401', description: { es: 'Jabon; productos y preparaciones organicos tensoactivos para el lavado de la piel', en: 'Soap; organic surface-active products for washing the skin' } },
  { code: '3402', description: { es: 'Agentes de superficie organicos (excepto el jabon); preparaciones tensoactivas, para lavar y de limpieza', en: 'Organic surface-active agents (other than soap); washing and cleaning preparations' } },
  { code: '3403', description: { es: 'Preparaciones lubricantes y preparaciones para el tratamiento de materias textiles, cueros, peleteria', en: 'Lubricating preparations and preparations for treating textiles, leather, furskins' } },
  { code: '3404', description: { es: 'Ceras artificiales y ceras preparadas', en: 'Artificial waxes and prepared waxes' } },
  { code: '3405', description: { es: 'Betunes y cremas para el calzado, encausticos, abrillantadores para carrocerias, vidrios o metales', en: 'Polishes and creams for footwear, furniture, floors, coachwork, glass or metal' } },
  { code: '3406', description: { es: 'Velas, cirios y articulos similares', en: 'Candles, tapers and the like' } },
  { code: '3407', description: { es: 'Pastas para modelar; ceras para odontologia; demas preparaciones para odontologia a base de yeso', en: 'Modelling pastes; dental wax; other dental preparations with a basis of plaster' } },

  // =========================================================================
  // CHAPTER 35 - MATERIAS ALBUMINOIDEAS / ALBUMINOIDAL SUBSTANCES
  // =========================================================================
  { code: '3501', description: { es: 'Caseina, caseinatos y demas derivados de la caseina; colas de caseina', en: 'Casein, caseinates and other casein derivatives; casein glues' } },
  { code: '3502', description: { es: 'Albuminas, albuminatos y demas derivados de las albuminas', en: 'Albumins, albuminates and other albumin derivatives' } },
  { code: '3503', description: { es: 'Gelatinas y sus derivados; ictiocola; las demas colas de origen animal', en: 'Gelatin and its derivatives; isinglass; other glues of animal origin' } },
  { code: '3504', description: { es: 'Peptonas y sus derivados; las demas materias proteicas y sus derivados', en: 'Peptones and their derivatives; other protein substances and their derivatives' } },
  { code: '3505', description: { es: 'Dextrina y demas almidones y feculas modificados; colas a base de almidon', en: 'Dextrins and other modified starches; glues based on starches' } },
  { code: '3506', description: { es: 'Colas y demas adhesivos preparados; productos de cualquier clase utilizados como colas o adhesivos', en: 'Prepared glues and other prepared adhesives' } },
  { code: '3507', description: { es: 'Enzimas; enzimas preparadas no expresadas ni comprendidas en otra parte', en: 'Enzymes; prepared enzymes not elsewhere specified or included' } },

  // =========================================================================
  // CHAPTER 36 - POLVORAS Y EXPLOSIVOS / EXPLOSIVES
  // =========================================================================
  { code: '3601', description: { es: 'Polvoras propulsivas', en: 'Propellent powders' } },
  { code: '3602', description: { es: 'Explosivos preparados, excepto la polvora', en: 'Prepared explosives, other than propellent powders' } },
  { code: '3603', description: { es: 'Mechas de seguridad; cordones detonantes; cebos y capsulas fulminantes; inflamadores; detonadores electricos', en: 'Safety fuses; detonating fuses; percussion or detonating caps; igniters; electric detonators' } },
  { code: '3604', description: { es: 'Articulos para fuegos artificiales, cohetes de señales, cohetes granifugos y similares', en: 'Fireworks, signalling flares, rain rockets, fog signals and other pyrotechnic articles' } },
  { code: '3605', description: { es: 'Fosforos (cerillas), excepto los articulos de pirotecnia de la partida 3604', en: 'Matches, other than pyrotechnic articles of heading 3604' } },
  { code: '3606', description: { es: 'Ferrocerio y demas aleaciones piroforicas; articulos de materias inflamables', en: 'Ferro-cerium and other pyrophoric alloys; articles of combustible materials' } },

  // =========================================================================
  // CHAPTER 37 - PRODUCTOS FOTOGRAFICOS / PHOTOGRAPHIC GOODS
  // =========================================================================
  { code: '3701', description: { es: 'Placas y peliculas planas fotograficas, sensibilizadas, sin impresionar', en: 'Photographic plates and film in the flat, sensitised, unexposed' } },
  { code: '3702', description: { es: 'Peliculas fotograficas en rollos, sensibilizadas, sin impresionar', en: 'Photographic film in rolls, sensitised, unexposed' } },
  { code: '3703', description: { es: 'Papel, carton y textiles, fotograficos, sensibilizados, sin impresionar', en: 'Photographic paper, paperboard and textiles, sensitised, unexposed' } },
  { code: '3704', description: { es: 'Placas, peliculas, papel, carton y textiles, fotograficos, impresionados pero sin revelar', en: 'Photographic plates, film, paper, paperboard and textiles, exposed but not developed' } },
  { code: '3705', description: { es: 'Placas y peliculas fotograficas, impresionadas y reveladas, excepto las cinematograficas', en: 'Photographic plates and film, exposed and developed, other than cinematographic film' } },
  { code: '3706', description: { es: 'Peliculas cinematograficas, impresionadas y reveladas', en: 'Cinematographic film, exposed and developed' } },
  { code: '3707', description: { es: 'Preparaciones quimicas para uso fotografico; productos sin mezclar para uso fotografico', en: 'Chemical preparations for photographic uses; unmixed products for photographic uses' } },

  // =========================================================================
  // CHAPTER 38 - PRODUCTOS QUIMICOS DIVERSOS / MISCELLANEOUS CHEMICAL PRODUCTS
  // =========================================================================
  { code: '3801', description: { es: 'Grafito artificial; grafito coloidal o semicoloidal; preparaciones a base de grafito', en: 'Artificial graphite; colloidal or semi-colloidal graphite; preparations based on graphite' } },
  { code: '3802', description: { es: 'Carbones activados; materias minerales naturales activadas; negros de origen animal', en: 'Activated carbon; activated natural mineral products; animal black' } },
  { code: '3803', description: { es: 'Tall oil, incluso refinado', en: 'Tall oil, whether or not refined' } },
  { code: '3804', description: { es: 'Lejias residuales de la fabricacion de pasta de celulosa, incluso concentradas', en: 'Residual lyes from the manufacture of wood pulp, whether or not concentrated' } },
  { code: '3805', description: { es: 'Esencias de trementina, de madera de pino o de pasta celulosica al sulfato y demas esencias terpenicas', en: 'Gum, wood or sulphate turpentine and other terpenic oils' } },
  { code: '3806', description: { es: 'Colofonias y acidos resinicos, y sus derivados; esencia y aceites de colofonia', en: 'Rosin and resin acids, and derivatives thereof; rosin spirit and rosin oils' } },
  { code: '3807', description: { es: 'Alquitranes de madera; aceites de alquitran de madera; creosota de madera', en: 'Wood tar; wood tar oils; wood creosote' } },
  { code: '3808', description: { es: 'Insecticidas, raticidas, fungicidas, herbicidas, productos antigerminantes y reguladores del crecimiento', en: 'Insecticides, rodenticides, fungicides, herbicides, anti-sprouting products and plant-growth regulators' } },
  { code: '3809', description: { es: 'Aprestos y productos de acabado, aceleradores de tintura o fijacion de materias colorantes', en: 'Finishing agents, dye carriers to accelerate the dyeing or fixing of dyestuffs' } },
  { code: '3810', description: { es: 'Preparaciones para el decapado de metales; fundentes y demas preparaciones auxiliares para soldar', en: 'Pickling preparations for metal surfaces; soldering, brazing or welding fluxes' } },
  { code: '3811', description: { es: 'Preparaciones antidetonantes, inhibidores de oxidacion, aditivos peptizantes y demas aditivos para aceites minerales', en: 'Anti-knock preparations, oxidation inhibitors, gum inhibitors and other additives for mineral oils' } },
  { code: '3812', description: { es: 'Aceleradores de vulcanizacion preparados; plastificantes compuestos para caucho o plastico', en: 'Prepared rubber accelerators; compound plasticisers for rubber or plastics' } },
  { code: '3813', description: { es: 'Preparaciones y cargas para aparatos extintores; granadas y bombas extintoras', en: 'Preparations and charges for fire-extinguishers; charged fire-extinguishing grenades' } },
  { code: '3814', description: { es: 'Disolventes y diluyentes organicos compuestos; preparaciones para quitar pinturas o barnices', en: 'Organic composite solvents and thinners; prepared paint or varnish removers' } },
  { code: '3815', description: { es: 'Iniciadores y aceleradores de reaccion y preparaciones cataliticas', en: 'Reaction initiators, accelerators and catalytic preparations' } },
  { code: '3816', description: { es: 'Cementos, morteros, hormigones y preparaciones similares, refractarios', en: 'Refractory cements, mortars, concretes and similar compositions' } },
  { code: '3817', description: { es: 'Mezclas de alquilbencenos y mezclas de alquilnaftalenos', en: 'Mixed alkylbenzenes and mixed alkylnaphthalenes' } },
  { code: '3818', description: { es: 'Elementos quimicos dopados para uso en electronica, en discos, obleas o formas analogas', en: 'Chemical elements doped for use in electronics, in discs, wafers or similar forms' } },
  { code: '3819', description: { es: 'Liquidos para frenos hidraulicos y demas liquidos preparados para transmisiones hidraulicas', en: 'Hydraulic brake fluids and other prepared liquids for hydraulic transmission' } },
  { code: '3820', description: { es: 'Preparaciones anticongelantes y liquidos preparados para descongelar', en: 'Anti-freezing preparations and prepared de-icing fluids' } },
  { code: '3821', description: { es: 'Medios de cultivo preparados para el desarrollo o mantenimiento de microorganismos', en: 'Prepared culture media for the development or maintenance of micro-organisms' } },
  { code: '3822', description: { es: 'Reactivos de diagnostico o de laboratorio sobre cualquier soporte', en: 'Diagnostic or laboratory reagents on a backing' } },
  { code: '3823', description: { es: 'Acidos grasos monocarboxilicos industriales; aceites acidos del refinado', en: 'Industrial monocarboxylic fatty acids; acid oils from refining' } },
  { code: '3824', description: { es: 'Aglutinantes preparados para moldes o nucleos de fundicion; productos quimicos y preparaciones de la industria quimica', en: 'Prepared binders for foundry moulds; chemical products and preparations of the chemical industry' } },
  { code: '3825', description: { es: 'Productos residuales de la industria quimica o de las industrias conexas', en: 'Residual products of the chemical or allied industries' } },
  { code: '3826', description: { es: 'Biodiesel y sus mezclas, sin aceites de petroleo o de mineral bituminoso o con un contenido < 70% en peso', en: 'Biodiesel and mixtures thereof, not containing or containing < 70% by weight of petroleum oils' } },

  // =========================================================================
  // CHAPTER 39 - PLASTICOS / PLASTICS
  // =========================================================================
  { code: '3901', description: { es: 'Polimeros de etileno en formas primarias', en: 'Polymers of ethylene, in primary forms' } },
  { code: '3902', description: { es: 'Polimeros de propileno o de otras olefinas, en formas primarias', en: 'Polymers of propylene or of other olefins, in primary forms' } },
  { code: '3903', description: { es: 'Polimeros de estireno en formas primarias', en: 'Polymers of styrene, in primary forms' } },
  { code: '3904', description: { es: 'Polimeros de cloruro de vinilo o de otras olefinas halogenadas, en formas primarias', en: 'Polymers of vinyl chloride or of other halogenated olefins, in primary forms' } },
  { code: '3905', description: { es: 'Polimeros de acetato de vinilo o de otros esteres vinilicos, en formas primarias', en: 'Polymers of vinyl acetate or of other vinyl esters, in primary forms' } },
  { code: '3906', description: { es: 'Polimeros acrilicos en formas primarias', en: 'Acrylic polymers in primary forms' } },
  { code: '3907', description: { es: 'Poliacetales, los demas poliéteres y resinas epoxi, en formas primarias; policarbonatos, resinas alquidicas', en: 'Polyacetals, other polyethers and epoxide resins, in primary forms; polycarbonates, alkyd resins' } },
  { code: '3908', description: { es: 'Poliamidas en formas primarias', en: 'Polyamides in primary forms' } },
  { code: '3909', description: { es: 'Resinas aminicas, resinas fenolicas y poliuretanos, en formas primarias', en: 'Amino-resins, phenolic resins and polyurethanes, in primary forms' } },
  { code: '3910', description: { es: 'Siliconas en formas primarias', en: 'Silicones in primary forms' } },
  { code: '3911', description: { es: 'Resinas de petroleo, resinas de cumarona-indeno, politerpenos, polisulfuros, polisulfonas y demas productos', en: 'Petroleum resins, coumarone-indene resins, polyterpenes, polysulphides, polysulphones' } },
  { code: '3912', description: { es: 'Celulosa y sus derivados quimicos, no expresados ni comprendidos en otra parte, en formas primarias', en: 'Cellulose and its chemical derivatives, not elsewhere specified, in primary forms' } },
  { code: '3913', description: { es: 'Polimeros naturales y polimeros naturales modificados, en formas primarias', en: 'Natural polymers and modified natural polymers, in primary forms' } },
  { code: '3914', description: { es: 'Intercambiadores de iones a base de polimeros de las partidas 3901 a 3913, en formas primarias', en: 'Ion-exchangers based on polymers of headings 3901 to 3913, in primary forms' } },
  { code: '3915', description: { es: 'Desechos, desperdicios y recortes, de plastico', en: 'Waste, parings and scrap, of plastics' } },
  { code: '3916', description: { es: 'Monofilamentos cuya dimension transversal sea > 1 mm, barras, varillas y perfiles, de plastico', en: 'Monofilament > 1 mm cross-section, rods, sticks and profile shapes, of plastics' } },
  { code: '3917', description: { es: 'Tubos y accesorios de tuberia, de plastico', en: 'Tubes, pipes and hoses, and fittings therefor, of plastics' } },
  { code: '3918', description: { es: 'Revestimientos de plastico para suelos, incluso autoadhesivos; revestimientos para paredes o techos', en: 'Floor coverings of plastics; wall or ceiling coverings of plastics' } },
  { code: '3919', description: { es: 'Placas, laminas, hojas, cintas, tiras y demas formas planas, autoadhesivas, de plastico', en: 'Self-adhesive plates, sheets, film, foil, tape, strip and other flat shapes, of plastics' } },
  { code: '3920', description: { es: 'Las demas placas, laminas, hojas y tiras, de plastico no celular', en: 'Other plates, sheets, film, foil and strip, of plastics, not cellular' } },
  { code: '3921', description: { es: 'Las demas placas, laminas, hojas y tiras, de plastico', en: 'Other plates, sheets, film, foil and strip, of plastics' } },
  { code: '3922', description: { es: 'Bañeras, duchas, fregaderos, lavabos, bides, inodoros y sus asientos y tapas, cisternas, de plastico', en: 'Baths, shower-baths, sinks, wash-basins, bidets, lavatory pans, seats and covers, of plastics' } },
  { code: '3923', description: { es: 'Articulos para el transporte o envasado, de plastico; tapones, tapas, capsulas y demas dispositivos de cierre', en: 'Articles for the conveyance or packing of goods, of plastics; stoppers, lids, caps' } },
  { code: '3924', description: { es: 'Vajilla y demas articulos de uso domestico y articulos de higiene o tocador, de plastico', en: 'Tableware, kitchenware, other household articles and hygienic or toilet articles, of plastics' } },
  { code: '3925', description: { es: 'Articulos para la construccion, de plastico, no expresados ni comprendidos en otra parte', en: 'Builders ware of plastics, not elsewhere specified or included' } },
  { code: '3926', description: { es: 'Las demas manufacturas de plastico y manufacturas de las demas materias de las partidas 3901 a 3914', en: 'Other articles of plastics and articles of other materials of headings 3901 to 3914' } },

  // =========================================================================
  // CHAPTER 40 - CAUCHO / RUBBER
  // =========================================================================
  { code: '4001', description: { es: 'Caucho natural, balata, gutapercha, guayule, chicle y gomas naturales analogas', en: 'Natural rubber, balata, gutta-percha, guayule, chicle and similar natural gums' } },
  { code: '4002', description: { es: 'Caucho sintetico y caucho facticio derivado de los aceites, en formas primarias o en placas, hojas o tiras', en: 'Synthetic rubber and factice derived from oils, in primary forms or in plates, sheets or strip' } },
  { code: '4003', description: { es: 'Caucho regenerado en formas primarias o en placas, hojas o tiras', en: 'Reclaimed rubber in primary forms or in plates, sheets or strip' } },
  { code: '4004', description: { es: 'Desechos, desperdicios y recortes, de caucho sin endurecer, incluso en polvo o en granulos', en: 'Waste, parings and scrap of unhardened rubber and powders and granules obtained therefrom' } },
  { code: '4005', description: { es: 'Caucho mezclado sin vulcanizar, en formas primarias o en placas, hojas o tiras', en: 'Compounded rubber, unvulcanised, in primary forms or in plates, sheets or strip' } },
  { code: '4006', description: { es: 'Las demas formas y articulos de caucho sin vulcanizar', en: 'Other forms and articles of unvulcanised rubber' } },
  { code: '4007', description: { es: 'Hilos y cuerdas, de caucho vulcanizado', en: 'Vulcanised rubber thread and cord' } },
  { code: '4008', description: { es: 'Placas, hojas, tiras, varillas y perfiles, de caucho vulcanizado sin endurecer', en: 'Plates, sheets, strip, rods and profile shapes, of vulcanised rubber other than hard rubber' } },
  { code: '4009', description: { es: 'Tubos de caucho vulcanizado sin endurecer, incluso con sus accesorios', en: 'Tubes, pipes and hoses, of vulcanised rubber other than hard rubber' } },
  { code: '4010', description: { es: 'Correas transportadoras o de transmision, de caucho vulcanizado', en: 'Conveyor or transmission belts or belting, of vulcanised rubber' } },
  { code: '4011', description: { es: 'Neumaticos nuevos de caucho', en: 'New pneumatic tyres, of rubber' } },
  { code: '4012', description: { es: 'Neumaticos recauchutados o usados, de caucho; bandajes macizos o huecos', en: 'Retreaded or used pneumatic tyres of rubber; solid or cushion tyres' } },
  { code: '4013', description: { es: 'Camaras de aire, de caucho', en: 'Inner tubes, of rubber' } },
  { code: '4014', description: { es: 'Articulos de higiene o de farmacia, de caucho vulcanizado sin endurecer', en: 'Hygienic or pharmaceutical articles of vulcanised rubber other than hard rubber' } },
  { code: '4015', description: { es: 'Prendas de vestir, guantes, mitones y manoplas y demas complementos de vestir, de caucho vulcanizado', en: 'Articles of apparel and clothing accessories, of vulcanised rubber' } },
  { code: '4016', description: { es: 'Las demas manufacturas de caucho vulcanizado sin endurecer', en: 'Other articles of vulcanised rubber other than hard rubber' } },
  { code: '4017', description: { es: 'Caucho endurecido en cualquier forma; manufacturas de caucho endurecido', en: 'Hard rubber in all forms; articles of hard rubber' } },

  // =========================================================================
  // CHAPTER 41 - CUEROS / RAW HIDES AND SKINS, LEATHER
  // =========================================================================
  { code: '4101', description: { es: 'Cueros y pieles en bruto, de bovino o de equino', en: 'Raw hides and skins of bovine or equine animals' } },
  { code: '4102', description: { es: 'Cueros y pieles en bruto, de ovino', en: 'Raw skins of sheep or lambs' } },
  { code: '4103', description: { es: 'Los demas cueros y pieles en bruto', en: 'Other raw hides and skins' } },
  { code: '4104', description: { es: 'Cueros y pieles curtidos o crust, de bovino o de equino, depilados', en: 'Tanned or crust hides and skins of bovine or equine animals, without hair on' } },
  { code: '4105', description: { es: 'Pieles curtidas o crust, de ovino, depiladas', en: 'Tanned or crust skins of sheep or lambs, without wool on' } },
  { code: '4106', description: { es: 'Cueros y pieles depilados de los demas animales y pieles de animales sin pelo, curtidos o crust', en: 'Tanned or crust hides and skins of other animals, without hair on' } },
  { code: '4107', description: { es: 'Cueros preparados despues del curtido o del secado y cueros y pieles apergaminados, de bovino o equino', en: 'Leather further prepared after tanning or crusting, of bovine or equine animals' } },
  { code: '4112', description: { es: 'Cueros preparados despues del curtido o del secado y cueros apergaminados, de ovino, depilados', en: 'Leather further prepared after tanning or crusting, of sheep or lamb, without wool on' } },
  { code: '4113', description: { es: 'Cueros preparados despues del curtido o del secado y cueros apergaminados, de los demas animales', en: 'Leather further prepared after tanning or crusting, of other animals' } },
  { code: '4114', description: { es: 'Cueros y pieles agamuzados; cueros y pieles charolados y sus imitaciones de cueros o pieles chapados', en: 'Chamois leather; patent leather and patent laminated leather; metallised leather' } },
  { code: '4115', description: { es: 'Cuero regenerado a base de cuero o fibras de cuero; recortes y demas desperdicios de cuero', en: 'Composition leather with a basis of leather or leather fibre; parings and other waste of leather' } },

  // =========================================================================
  // CHAPTER 42 - MANUFACTURAS DE CUERO / ARTICLES OF LEATHER
  // =========================================================================
  { code: '4201', description: { es: 'Articulos de talabarteria o guarnicioneria para todos los animales, de cualquier materia', en: 'Saddlery and harness for any animal, of any material' } },
  { code: '4202', description: { es: 'Baules, maletas, maletines, carteras, estuches, fundas y continentes similares', en: 'Trunks, suit-cases, vanity-cases, briefcases, school satchels and similar containers' } },
  { code: '4203', description: { es: 'Prendas y complementos de vestir, de cuero natural o cuero regenerado', en: 'Articles of apparel and clothing accessories, of leather or of composition leather' } },
  { code: '4205', description: { es: 'Las demas manufacturas de cuero natural o cuero regenerado', en: 'Other articles of leather or of composition leather' } },
  { code: '4206', description: { es: 'Manufacturas de tripa, de vejigas o de tendones', en: 'Articles of gut (other than silkworm gut), of goldbeaters skin, of bladders or of tendons' } },

  // =========================================================================
  // CHAPTER 43 - PELETERIA / FURSKINS
  // =========================================================================
  { code: '4301', description: { es: 'Peleteria en bruto, incluidas las cabezas, colas, patas y demas trozos utilizables en peleteria', en: 'Raw furskins, including heads, tails, paws and other pieces usable in furriery' } },
  { code: '4302', description: { es: 'Peleteria curtida o adobada, incluidas las cabezas, colas, patas y demas trozos', en: 'Tanned or dressed furskins, including heads, tails, paws and other pieces or cuttings' } },
  { code: '4303', description: { es: 'Prendas y complementos de vestir y demas articulos de peleteria', en: 'Articles of apparel, clothing accessories and other articles of furskin' } },
  { code: '4304', description: { es: 'Peleteria facticia o artificial y articulos de peleteria facticia o artificial', en: 'Artificial fur and articles thereof' } },

  // =========================================================================
  // CHAPTER 44 - MADERA / WOOD
  // =========================================================================
  { code: '4401', description: { es: 'Leña; madera en plaquitas o particulas; aserrin, desperdicios y desechos de madera', en: 'Fuel wood; wood in chips or particles; sawdust, wood waste and scrap' } },
  { code: '4402', description: { es: 'Carbon vegetal, incluido el de cascaras o de huesos', en: 'Wood charcoal, including shell or nut charcoal' } },
  { code: '4403', description: { es: 'Madera en bruto, incluso descortezada, desalburada o escuadrada', en: 'Wood in the rough, whether or not stripped of bark or sapwood, or roughly squared' } },
  { code: '4404', description: { es: 'Flejes de madera; rodrigones hendidos; estacas y estaquillas de madera, apuntadas', en: 'Hoopwood; split poles; piles, pickets and stakes of wood, pointed' } },
  { code: '4405', description: { es: 'Lana de madera; harina de madera', en: 'Wood wool; wood flour' } },
  { code: '4406', description: { es: 'Traviesas de madera para vias ferreas o similares', en: 'Railway or tramway sleepers (cross-ties) of wood' } },
  { code: '4407', description: { es: 'Madera aserrada o desbastada longitudinalmente, cortada o desenrollada, de espesor > 6 mm', en: 'Wood sawn or chipped lengthwise, sliced or peeled, of a thickness > 6 mm' } },
  { code: '4408', description: { es: 'Hojas para chapado y contrachapado y para maderas estratificadas, de espesor <= 6 mm', en: 'Sheets for veneering, sheets for plywood, of a thickness <= 6 mm' } },
  { code: '4409', description: { es: 'Madera perfilada longitudinalmente en una o varias caras, cantos o extremos', en: 'Wood continuously shaped along any of its edges, ends or faces' } },
  { code: '4410', description: { es: 'Tableros de particulas, tableros llamados oriented strand board y tableros similares', en: 'Particle board, oriented strand board (OSB) and similar board' } },
  { code: '4411', description: { es: 'Tableros de fibra de madera u otras materias leñosas', en: 'Fibreboard of wood or other ligneous materials' } },
  { code: '4412', description: { es: 'Madera contrachapada, madera chapada y madera estratificada similar', en: 'Plywood, veneered panels and similar laminated wood' } },
  { code: '4413', description: { es: 'Madera densificada en bloques, tablas, tiras o perfiles', en: 'Densified wood, in blocks, plates, strips or profile shapes' } },
  { code: '4414', description: { es: 'Marcos de madera para cuadros, fotografias, espejos u objetos similares', en: 'Wooden frames for paintings, photographs, mirrors or similar objects' } },
  { code: '4415', description: { es: 'Cajones, cajas, jaulas, tambores y envases similares, de madera; carretes para cables, de madera', en: 'Packing cases, boxes, crates, drums and similar packings, of wood; cable-drums, of wood' } },
  { code: '4416', description: { es: 'Barriles, cubas, tinas y demas manufacturas de toneleria, y sus partes, de madera', en: 'Casks, barrels, vats, tubs and other coopers products and parts thereof, of wood' } },
  { code: '4417', description: { es: 'Herramientas, monturas y mangos de herramientas, monturas de cepillos, mangos de escobas, de madera', en: 'Tools, tool bodies, tool handles, broom or brush bodies and handles, of wood' } },
  { code: '4418', description: { es: 'Obras y piezas de carpinteria para construcciones, incluidos los tableros celulares', en: 'Builders joinery and carpentry of wood, including cellular wood panels' } },
  { code: '4419', description: { es: 'Articulos de mesa o de cocina, de madera', en: 'Tableware and kitchenware, of wood' } },
  { code: '4420', description: { es: 'Marqueteria y taracea; cofrecillos y estuches para joyeria u orfebreria y manufacturas similares, de madera', en: 'Wood marquetry and inlaid wood; caskets and cases for jewellery or cutlery and similar articles, of wood' } },
  { code: '4421', description: { es: 'Las demas manufacturas de madera', en: 'Other articles of wood' } },

  // =========================================================================
  // CHAPTER 45 - CORCHO / CORK
  // =========================================================================
  { code: '4501', description: { es: 'Corcho natural en bruto o simplemente preparado; desperdicios de corcho; corcho triturado, granulado o pulverizado', en: 'Natural cork, raw or simply prepared; waste cork; crushed, granulated or ground cork' } },
  { code: '4502', description: { es: 'Corcho natural, descortezado o simplemente escuadrado, o en bloques, placas, hojas o tiras', en: 'Natural cork, debacked or roughly squared, or in blocks, plates, sheets or strip' } },
  { code: '4503', description: { es: 'Manufacturas de corcho natural', en: 'Articles of natural cork' } },
  { code: '4504', description: { es: 'Corcho aglomerado y manufacturas de corcho aglomerado', en: 'Agglomerated cork and articles of agglomerated cork' } },

  // =========================================================================
  // CHAPTER 46 - MANUFACTURAS DE ESPARTERIA / MANUFACTURES OF STRAW
  // =========================================================================
  { code: '4601', description: { es: 'Trenzas y articulos similares, de materia trenzable, incluso ensamblados en tiras', en: 'Plaits and similar products of plaiting materials, whether or not assembled into strips' } },
  { code: '4602', description: { es: 'Articulos de cesteria obtenidos directamente en su forma con materia trenzable', en: 'Basketwork, wickerwork and other articles, made directly to shape from plaiting materials' } },

  // =========================================================================
  // CHAPTER 47 - PASTA DE MADERA / WOOD PULP
  // =========================================================================
  { code: '4701', description: { es: 'Pasta mecanica de madera', en: 'Mechanical wood pulp' } },
  { code: '4702', description: { es: 'Pasta quimica de madera para disolver', en: 'Chemical wood pulp, dissolving grades' } },
  { code: '4703', description: { es: 'Pasta quimica de madera a la sosa o al sulfato, excepto la pasta para disolver', en: 'Chemical wood pulp, soda or sulphate, other than dissolving grades' } },
  { code: '4704', description: { es: 'Pasta quimica de madera al bisulfito, excepto la pasta para disolver', en: 'Chemical wood pulp, sulphite, other than dissolving grades' } },
  { code: '4705', description: { es: 'Pasta de madera obtenida por la combinacion de un tratamiento mecanico y de un tratamiento quimico', en: 'Wood pulp obtained by a combination of mechanical and chemical pulping processes' } },
  { code: '4706', description: { es: 'Pasta de fibras obtenidas de papel o carton reciclado o de las demas materias fibrosas celulosicas', en: 'Pulps of fibres derived from recovered paper or paperboard or of other fibrous cellulosic material' } },
  { code: '4707', description: { es: 'Papel o carton para reciclar (desperdicios y desechos)', en: 'Recovered (waste and scrap) paper or paperboard' } },

  // =========================================================================
  // CHAPTER 48 - PAPEL Y CARTON / PAPER AND PAPERBOARD
  // =========================================================================
  { code: '4801', description: { es: 'Papel prensa en bobinas o en hojas', en: 'Newsprint, in rolls or sheets' } },
  { code: '4802', description: { es: 'Papel y carton sin estucar ni recubrir, del tipo de los utilizados para escribir, imprimir u otros fines graficos', en: 'Uncoated paper and paperboard, for writing, printing or other graphic purposes' } },
  { code: '4803', description: { es: 'Papel del tipo utilizado para papel higienico, toallitas, servilletas, en bobinas o en hojas', en: 'Toilet or facial tissue stock, towel or napkin stock, in rolls or sheets' } },
  { code: '4804', description: { es: 'Papel y carton Kraft, sin estucar ni recubrir, en bobinas o en hojas', en: 'Uncoated kraft paper and paperboard, in rolls or sheets' } },
  { code: '4805', description: { es: 'Los demas papeles y cartones, sin estucar ni recubrir, en bobinas o en hojas', en: 'Other uncoated paper and paperboard, in rolls or sheets' } },
  { code: '4806', description: { es: 'Papel y carton sulfurizados, papel resistente a las grasas, papel vegetal, papel cristal', en: 'Vegetable parchment, greaseproof papers, tracing papers, glassine and other glazed transparent papers' } },
  { code: '4807', description: { es: 'Papel y carton obtenidos por pegado de hojas planas, sin estucar ni recubrir en la superficie', en: 'Composite paper and paperboard, not surface-coated or impregnated' } },
  { code: '4808', description: { es: 'Papel y carton corrugados, incluso perforados, rizados, gofrados o perforados', en: 'Paper and paperboard, corrugated, creped, crinkled, embossed or perforated' } },
  { code: '4809', description: { es: 'Papel carbon, papel autocopia y demas papeles para copiar o transferir', en: 'Carbon paper, self-copy paper and other copying or transfer papers' } },
  { code: '4810', description: { es: 'Papel y carton estucados por una o las dos caras con caolin u otras sustancias inorganicas', en: 'Paper and paperboard, coated on one or both sides with kaolin or other inorganic substances' } },
  { code: '4811', description: { es: 'Papel, carton, guata de celulosa y napa de fibras de celulosa, estucados, recubiertos, impregnados', en: 'Paper, paperboard, cellulose wadding and webs of cellulose fibres, coated, impregnated' } },
  { code: '4812', description: { es: 'Bloques y placas, filtrantes, de pasta de papel', en: 'Filter blocks, slabs and plates, of paper pulp' } },
  { code: '4813', description: { es: 'Papel de fumar, incluso cortado al tamaño adecuado, en librillos o en tubos', en: 'Cigarette paper, whether or not cut to size or in the form of booklets or tubes' } },
  { code: '4814', description: { es: 'Papel para decorar y revestimientos similares de paredes; papeles para vidrieras', en: 'Wallpaper and similar wall coverings; window transparencies of paper' } },
  { code: '4816', description: { es: 'Papel carbon, papel autocopia y demas papeles para copiar o transferir, estenciles completos y planchas offset, de papel', en: 'Carbon paper, self-copy paper and other copying or transfer papers, complete stencils, offset plates, of paper' } },
  { code: '4817', description: { es: 'Sobres, sobres-carta, tarjetas postales sin ilustrar y tarjetas para correspondencia, de papel o carton', en: 'Envelopes, letter cards, plain postcards and correspondence cards, of paper or paperboard' } },
  { code: '4818', description: { es: 'Papel higienico y papel similar, guata de celulosa, para uso domestico o sanitario', en: 'Toilet paper; handkerchiefs, cleansing tissues, towels, of paper pulp' } },
  { code: '4819', description: { es: 'Cajas, sacos, bolsas y demas envases, de papel, carton, guata de celulosa o napa de fibras de celulosa', en: 'Cartons, boxes, cases, bags and other packing containers, of paper, paperboard' } },
  { code: '4820', description: { es: 'Libros registro, libros de contabilidad, talonarios, agendas, memorandums, bloques memorandums', en: 'Registers, account books, note books, order books, receipt books, diaries' } },
  { code: '4821', description: { es: 'Etiquetas de todas clases, de papel o carton, incluso impresas', en: 'Paper or paperboard labels of all kinds, whether or not printed' } },
  { code: '4822', description: { es: 'Bobinas, carretes, canillas y soportes analogos, de pasta de papel, papel o carton', en: 'Bobbins, spools, cops and similar supports of paper pulp, paper or paperboard' } },
  { code: '4823', description: { es: 'Los demas papeles, cartones, guata de celulosa y napa de fibras de celulosa, cortados en formato; los demas articulos de pasta de papel', en: 'Other paper, paperboard, cellulose wadding and webs of cellulose fibres, cut to size or shape' } },

  // =========================================================================
  // CHAPTER 49 - PRODUCTOS EDITORIALES / PRINTED BOOKS, NEWSPAPERS
  // =========================================================================
  { code: '4901', description: { es: 'Libros, folletos e impresos similares, incluso en hojas sueltas', en: 'Printed books, brochures, leaflets and similar printed matter' } },
  { code: '4902', description: { es: 'Diarios y publicaciones periodicas, impresos, incluso ilustrados o con publicidad', en: 'Newspapers, journals and periodicals, whether or not illustrated or containing advertising' } },
  { code: '4903', description: { es: 'Albumes o libros de estampas y cuadernos para dibujar o colorear, para niños', en: 'Childrens picture, drawing or colouring books' } },
  { code: '4904', description: { es: 'Musica manuscrita o impresa, incluso con ilustraciones o encuadernada', en: 'Music, printed or in manuscript, whether or not bound or illustrated' } },
  { code: '4905', description: { es: 'Manufacturas cartograficas de todas clases, incluidos los mapas murales, planos topograficos y globos', en: 'Maps and hydrographic or similar charts of all kinds, including atlases and topographical plans' } },
  { code: '4906', description: { es: 'Planos y dibujos originales hechos a mano, de arquitectura, ingenieria, industriales, comerciales', en: 'Plans and drawings for architectural, engineering, industrial, commercial, topographical purposes' } },
  { code: '4907', description: { es: 'Sellos de correos, timbres fiscales y analogos, sin obliterar; papel timbrado; billetes de banco', en: 'Unused postage, revenue or similar stamps; stamp-impressed paper; banknotes' } },
  { code: '4908', description: { es: 'Calcomanias de cualquier clase', en: 'Transfers (decalcomanias)' } },
  { code: '4909', description: { es: 'Tarjetas postales impresas o ilustradas; tarjetas impresas con felicitaciones o comunicaciones personales', en: 'Printed or illustrated postcards; printed cards bearing personal greetings' } },
  { code: '4910', description: { es: 'Calendarios de cualquier clase, impresos, incluidos los tacos de calendario', en: 'Calendars of any kind, printed, including calendar blocks' } },
  { code: '4911', description: { es: 'Los demas impresos, incluidas las estampas, grabados y fotografias', en: 'Other printed matter, including printed pictures and photographs' } },

  // =========================================================================
  // CHAPTER 50 - SEDA / SILK
  // =========================================================================
  { code: '5001', description: { es: 'Capullos de seda aptos para el devanado', en: 'Silkworm cocoons suitable for reeling' } },
  { code: '5002', description: { es: 'Seda cruda (sin torcer)', en: 'Raw silk (not thrown)' } },
  { code: '5003', description: { es: 'Desperdicios de seda, incluidos los capullos no aptos para el devanado', en: 'Silk waste, including cocoons unsuitable for reeling' } },
  { code: '5004', description: { es: 'Hilados de seda (excepto los hilados de desperdicios de seda) sin acondicionar para la venta al por menor', en: 'Silk yarn, other than yarn spun from silk waste, not put up for retail sale' } },
  { code: '5005', description: { es: 'Hilados de desperdicios de seda sin acondicionar para la venta al por menor', en: 'Yarn spun from silk waste, not put up for retail sale' } },
  { code: '5006', description: { es: 'Hilados de seda o de desperdicios de seda, acondicionados para la venta al por menor', en: 'Silk yarn and yarn spun from silk waste, put up for retail sale' } },
  { code: '5007', description: { es: 'Tejidos de seda o de desperdicios de seda', en: 'Woven fabrics of silk or of silk waste' } },

  // =========================================================================
  // CHAPTER 51 - LANA / WOOL
  // =========================================================================
  { code: '5101', description: { es: 'Lana sin cardar ni peinar', en: 'Wool, not carded or combed' } },
  { code: '5102', description: { es: 'Pelo fino u ordinario, sin cardar ni peinar', en: 'Fine or coarse animal hair, not carded or combed' } },
  { code: '5103', description: { es: 'Desperdicios de lana o de pelo fino u ordinario, incluidos los desperdicios de hilados', en: 'Waste of wool or of fine or coarse animal hair, including yarn waste' } },
  { code: '5104', description: { es: 'Hilachas de lana o de pelo fino u ordinario', en: 'Garnetted stock of wool or of fine or coarse animal hair' } },
  { code: '5105', description: { es: 'Lana y pelo fino u ordinario, cardados o peinados', en: 'Wool and fine or coarse animal hair, carded or combed' } },
  { code: '5106', description: { es: 'Hilados de lana cardada sin acondicionar para la venta al por menor', en: 'Yarn of carded wool, not put up for retail sale' } },
  { code: '5107', description: { es: 'Hilados de lana peinada sin acondicionar para la venta al por menor', en: 'Yarn of combed wool, not put up for retail sale' } },
  { code: '5108', description: { es: 'Hilados de pelo fino, cardado o peinado, sin acondicionar para la venta al por menor', en: 'Yarn of fine animal hair, carded or combed, not put up for retail sale' } },
  { code: '5109', description: { es: 'Hilados de lana o pelo fino, acondicionados para la venta al por menor', en: 'Yarn of wool or of fine animal hair, put up for retail sale' } },
  { code: '5110', description: { es: 'Hilados de pelo ordinario o de crin, incluso entorchados', en: 'Yarn of coarse animal hair or of horsehair, whether or not gimped' } },
  { code: '5111', description: { es: 'Tejidos de lana cardada o pelo fino cardado', en: 'Woven fabrics of carded wool or of carded fine animal hair' } },
  { code: '5112', description: { es: 'Tejidos de lana peinada o pelo fino peinado', en: 'Woven fabrics of combed wool or of combed fine animal hair' } },
  { code: '5113', description: { es: 'Tejidos de pelo ordinario o de crin', en: 'Woven fabrics of coarse animal hair or of horsehair' } },

  // =========================================================================
  // CHAPTER 52 - ALGODON / COTTON
  // =========================================================================
  { code: '5201', description: { es: 'Algodon sin cardar ni peinar', en: 'Cotton, not carded or combed' } },
  { code: '5202', description: { es: 'Desperdicios de algodon, incluidos los desperdicios de hilados y las hilachas', en: 'Cotton waste, including yarn waste and garnetted stock' } },
  { code: '5203', description: { es: 'Algodon cardado o peinado', en: 'Cotton, carded or combed' } },
  { code: '5204', description: { es: 'Hilo de coser de algodon, incluso acondicionado para la venta al por menor', en: 'Cotton sewing thread, whether or not put up for retail sale' } },
  { code: '5205', description: { es: 'Hilados de algodon (excepto el hilo de coser) con un contenido de algodon >= 85%, sin acondicionar para venta al por menor', en: 'Cotton yarn (other than sewing thread) containing >= 85% cotton, not for retail sale' } },
  { code: '5206', description: { es: 'Hilados de algodon (excepto el hilo de coser) con un contenido de algodon < 85%, sin acondicionar para venta al por menor', en: 'Cotton yarn (other than sewing thread) containing < 85% cotton, not for retail sale' } },
  { code: '5207', description: { es: 'Hilados de algodon (excepto el hilo de coser), acondicionados para la venta al por menor', en: 'Cotton yarn (other than sewing thread) put up for retail sale' } },
  { code: '5208', description: { es: 'Tejidos de algodon con un contenido de algodon >= 85%, de peso <= 200 g/m2', en: 'Woven fabrics of cotton, containing >= 85% cotton, weighing <= 200 g/m2' } },
  { code: '5209', description: { es: 'Tejidos de algodon con un contenido de algodon >= 85%, de peso > 200 g/m2', en: 'Woven fabrics of cotton, containing >= 85% cotton, weighing > 200 g/m2' } },
  { code: '5210', description: { es: 'Tejidos de algodon con un contenido de algodon < 85%, mezclado con fibras sinteticas o artificiales, <= 200 g/m2', en: 'Woven fabrics of cotton, containing < 85% cotton, mixed with man-made fibres, <= 200 g/m2' } },
  { code: '5211', description: { es: 'Tejidos de algodon con un contenido de algodon < 85%, mezclado con fibras sinteticas o artificiales, > 200 g/m2', en: 'Woven fabrics of cotton, containing < 85% cotton, mixed with man-made fibres, > 200 g/m2' } },
  { code: '5212', description: { es: 'Los demas tejidos de algodon', en: 'Other woven fabrics of cotton' } },

  // =========================================================================
  // CHAPTER 53 - OTRAS FIBRAS VEGETALES / OTHER VEGETABLE TEXTILE FIBRES
  // =========================================================================
  { code: '5301', description: { es: 'Lino en bruto o trabajado, pero sin hilar; estopas y desperdicios de lino', en: 'Flax, raw or processed but not spun; flax tow and waste' } },
  { code: '5302', description: { es: 'Cañamo en bruto o trabajado, pero sin hilar; estopas y desperdicios de cañamo', en: 'True hemp, raw or processed but not spun; tow and waste of true hemp' } },
  { code: '5303', description: { es: 'Yute y demas fibras textiles del liber, en bruto o trabajadas, pero sin hilar', en: 'Jute and other textile bast fibres, raw or processed but not spun' } },
  { code: '5305', description: { es: 'Coco, abaca, ramio y demas fibras textiles vegetales, en bruto o trabajadas, pero sin hilar', en: 'Coconut, abaca, ramie and other vegetable textile fibres, raw or processed but not spun' } },
  { code: '5306', description: { es: 'Hilados de lino', en: 'Flax yarn' } },
  { code: '5307', description: { es: 'Hilados de yute o de las demas fibras textiles del liber de la partida 5303', en: 'Yarn of jute or of other textile bast fibres of heading 5303' } },
  { code: '5308', description: { es: 'Hilados de las demas fibras textiles vegetales; hilados de papel', en: 'Yarn of other vegetable textile fibres; paper yarn' } },
  { code: '5309', description: { es: 'Tejidos de lino', en: 'Woven fabrics of flax' } },
  { code: '5310', description: { es: 'Tejidos de yute o de las demas fibras textiles del liber de la partida 5303', en: 'Woven fabrics of jute or of other textile bast fibres of heading 5303' } },
  { code: '5311', description: { es: 'Tejidos de las demas fibras textiles vegetales; tejidos de hilados de papel', en: 'Woven fabrics of other vegetable textile fibres; woven fabrics of paper yarn' } },

  // =========================================================================
  // CHAPTER 54 - FILAMENTOS SINTETICOS / MAN-MADE FILAMENTS
  // =========================================================================
  { code: '5401', description: { es: 'Hilo de coser de filamentos sinteticos o artificiales', en: 'Sewing thread of man-made filaments' } },
  { code: '5402', description: { es: 'Hilados de filamentos sinteticos (excepto el hilo de coser) sin acondicionar para venta al por menor', en: 'Synthetic filament yarn (other than sewing thread), not put up for retail sale' } },
  { code: '5403', description: { es: 'Hilados de filamentos artificiales (excepto el hilo de coser) sin acondicionar para venta al por menor', en: 'Artificial filament yarn (other than sewing thread), not put up for retail sale' } },
  { code: '5404', description: { es: 'Monofilamentos sinteticos de 67 decitex o mas y cuya mayor dimension de la seccion transversal no exceda de 1 mm', en: 'Synthetic monofilament of 67 decitex or more with a cross-sectional dimension <= 1 mm' } },
  { code: '5405', description: { es: 'Monofilamentos artificiales de 67 decitex o mas y cuya mayor dimension de la seccion transversal no exceda de 1 mm', en: 'Artificial monofilament of 67 decitex or more with a cross-sectional dimension <= 1 mm' } },
  { code: '5406', description: { es: 'Hilados de filamentos sinteticos o artificiales, acondicionados para la venta al por menor', en: 'Man-made filament yarn, put up for retail sale' } },
  { code: '5407', description: { es: 'Tejidos de hilados de filamentos sinteticos', en: 'Woven fabrics of synthetic filament yarn' } },
  { code: '5408', description: { es: 'Tejidos de hilados de filamentos artificiales', en: 'Woven fabrics of artificial filament yarn' } },

  // =========================================================================
  // CHAPTER 55 - FIBRAS SINTETICAS DISCONTINUAS / MAN-MADE STAPLE FIBRES
  // =========================================================================
  { code: '5501', description: { es: 'Cables de filamentos sinteticos', en: 'Synthetic filament tow' } },
  { code: '5502', description: { es: 'Cables de filamentos artificiales', en: 'Artificial filament tow' } },
  { code: '5503', description: { es: 'Fibras sinteticas discontinuas, sin cardar, peinar ni transformar de otro modo para la hilatura', en: 'Synthetic staple fibres, not carded, combed or otherwise processed for spinning' } },
  { code: '5504', description: { es: 'Fibras artificiales discontinuas, sin cardar, peinar ni transformar de otro modo para la hilatura', en: 'Artificial staple fibres, not carded, combed or otherwise processed for spinning' } },
  { code: '5505', description: { es: 'Desperdicios de fibras sinteticas o artificiales, incluidas las borras, los desperdicios de hilados y las hilachas', en: 'Waste of man-made staple fibres, including noils, yarn waste and garnetted stock' } },
  { code: '5506', description: { es: 'Fibras sinteticas discontinuas, cardadas, peinadas o transformadas de otro modo para la hilatura', en: 'Synthetic staple fibres, carded, combed or otherwise processed for spinning' } },
  { code: '5507', description: { es: 'Fibras artificiales discontinuas, cardadas, peinadas o transformadas de otro modo para la hilatura', en: 'Artificial staple fibres, carded, combed or otherwise processed for spinning' } },
  { code: '5508', description: { es: 'Hilo de coser de fibras sinteticas o artificiales discontinuas', en: 'Sewing thread of man-made staple fibres' } },
  { code: '5509', description: { es: 'Hilados de fibras sinteticas discontinuas (excepto el hilo de coser), sin acondicionar para venta al por menor', en: 'Yarn of synthetic staple fibres (other than sewing thread), not for retail sale' } },
  { code: '5510', description: { es: 'Hilados de fibras artificiales discontinuas (excepto el hilo de coser), sin acondicionar para venta al por menor', en: 'Yarn of artificial staple fibres (other than sewing thread), not for retail sale' } },
  { code: '5511', description: { es: 'Hilados de fibras sinteticas o artificiales discontinuas, acondicionados para la venta al por menor', en: 'Yarn of man-made staple fibres, put up for retail sale' } },
  { code: '5512', description: { es: 'Tejidos de fibras sinteticas discontinuas con un contenido de estas fibras >= 85%', en: 'Woven fabrics of synthetic staple fibres, containing >= 85% of such fibres' } },
  { code: '5513', description: { es: 'Tejidos de fibras sinteticas discontinuas con un contenido < 85%, mezclados con algodon, <= 170 g/m2', en: 'Woven fabrics of synthetic staple fibres, < 85%, mixed with cotton, <= 170 g/m2' } },
  { code: '5514', description: { es: 'Tejidos de fibras sinteticas discontinuas con un contenido < 85%, mezclados con algodon, > 170 g/m2', en: 'Woven fabrics of synthetic staple fibres, < 85%, mixed with cotton, > 170 g/m2' } },
  { code: '5515', description: { es: 'Los demas tejidos de fibras sinteticas discontinuas', en: 'Other woven fabrics of synthetic staple fibres' } },
  { code: '5516', description: { es: 'Tejidos de fibras artificiales discontinuas', en: 'Woven fabrics of artificial staple fibres' } },

  // =========================================================================
  // CHAPTER 56 - GUATA, FIELTRO / WADDING, FELT
  // =========================================================================
  { code: '5601', description: { es: 'Guata de materia textil y articulos de guata; fibras textiles de longitud <= 5 mm', en: 'Wadding of textile materials and articles thereof; textile fibres <= 5 mm (flock)' } },
  { code: '5602', description: { es: 'Fieltro, incluso impregnado, recubierto, revestido o estratificado', en: 'Felt, whether or not impregnated, coated, covered or laminated' } },
  { code: '5603', description: { es: 'Tela sin tejer, incluso impregnada, recubierta, revestida o estratificada', en: 'Nonwovens, whether or not impregnated, coated, covered or laminated' } },
  { code: '5604', description: { es: 'Hilos y cuerdas de caucho, recubiertos de textiles; hilados textiles, tiras recubiertas de caucho o plastico', en: 'Rubber thread and cord, textile covered; textile yarn, strip, impregnated with rubber or plastics' } },
  { code: '5605', description: { es: 'Hilados metalicos e hilados metalizados', en: 'Metallised yarn, whether or not gimped' } },
  { code: '5606', description: { es: 'Hilados entorchados, tiras y formas similares de las partidas 5404 o 5405, entorchadas', en: 'Gimped yarn; strip and the like of heading 5404 or 5405, gimped' } },
  { code: '5607', description: { es: 'Cordeles, cuerdas y cordajes, esten o no trenzados, incluso impregnados o recubiertos de caucho o plastico', en: 'Twine, cordage, ropes and cables, whether or not plaited or braided' } },
  { code: '5608', description: { es: 'Redes de mallas anudadas, en paño o en pieza, fabricadas con cordeles, cuerdas o cordajes', en: 'Knotted netting of twine, cordage or rope; made up fishing nets and other made up nets' } },
  { code: '5609', description: { es: 'Articulos de hilados, tiras o formas similares de las partidas 5404 o 5405, cordeles, cuerdas o cordajes', en: 'Articles of yarn, strip or the like of heading 5404 or 5405, twine, cordage, rope or cables' } },

  // =========================================================================
  // CHAPTER 57 - ALFOMBRAS / CARPETS
  // =========================================================================
  { code: '5701', description: { es: 'Alfombras de nudo de materias textiles, incluso confeccionadas', en: 'Carpets and other textile floor coverings, knotted' } },
  { code: '5702', description: { es: 'Alfombras y demas revestimientos para el suelo, de materia textil, tejidos, excepto los de mechon insertado', en: 'Carpets and other textile floor coverings, woven, not tufted or flocked' } },
  { code: '5703', description: { es: 'Alfombras y demas revestimientos para el suelo, de materia textil, con mechon insertado', en: 'Carpets and other textile floor coverings, tufted' } },
  { code: '5704', description: { es: 'Alfombras y demas revestimientos para el suelo, de fieltro, excepto los de mechon insertado', en: 'Carpets and other textile floor coverings, of felt, not tufted or flocked' } },
  { code: '5705', description: { es: 'Las demas alfombras y revestimientos para el suelo, de materia textil', en: 'Other carpets and other textile floor coverings' } },

  // =========================================================================
  // CHAPTER 58 - TEJIDOS ESPECIALES / SPECIAL WOVEN FABRICS
  // =========================================================================
  { code: '5801', description: { es: 'Terciopelo y felpa, excepto los de punto, y tejidos de chenilla', en: 'Woven pile fabrics and chenille fabrics, other than fabrics of heading 5802 or 5806' } },
  { code: '5802', description: { es: 'Tejidos con bucles del tipo toalla, excepto los productos de la partida 5806; superficies textiles con mechon insertado', en: 'Terry towelling and similar woven terry fabrics; tufted textile fabrics' } },
  { code: '5803', description: { es: 'Tejidos de gasa de vuelta, excepto los productos de la partida 5806', en: 'Gauze, other than narrow fabrics of heading 5806' } },
  { code: '5804', description: { es: 'Tul, tul-Loss y tejidos de mallas anudadas; encajes en pieza, en tiras o en aplicaciones', en: 'Tulles and other net fabrics; lace in the piece, in strips or in motifs' } },
  { code: '5805', description: { es: 'Tapiceria tejida a mano (tipo Gobelinos, Flandes, Aubusson, Beauvais y similares) y tapiceria de aguja', en: 'Hand-woven tapestries of the type Gobelins, Flanders, Aubusson, Beauvais and similar' } },
  { code: '5806', description: { es: 'Cintas, excepto los articulos de la partida 5807; cintas sin trama, de hilados o fibras paralelizados y aglutinados', en: 'Narrow woven fabrics; narrow fabrics consisting of warp without weft assembled by means of an adhesive' } },
  { code: '5807', description: { es: 'Etiquetas, escudos y articulos similares, de materia textil, en pieza, en cintas o recortados, sin bordar', en: 'Labels, badges and similar articles of textile materials, not embroidered' } },
  { code: '5808', description: { es: 'Trenzas en pieza; articulos de pasamaneria y articulos ornamentales analogos, en pieza, sin bordar', en: 'Braids in the piece; ornamental trimmings in the piece, not embroidered' } },
  { code: '5809', description: { es: 'Tejidos de hilos de metal y tejidos de hilados metalicos o de hilados textiles metalizados de la partida 5605', en: 'Woven fabrics of metal thread and woven fabrics of metallised yarn of heading 5605' } },
  { code: '5810', description: { es: 'Bordados en pieza, en tiras o en aplicaciones', en: 'Embroidery in the piece, in strips or in motifs' } },
  { code: '5811', description: { es: 'Productos textiles acolchados en pieza, constituidos por una o varias capas de materia textil', en: 'Quilted textile products in the piece, composed of one or more layers of textile materials' } },

  // =========================================================================
  // CHAPTER 59 - TELAS IMPREGNADAS / IMPREGNATED TEXTILES
  // =========================================================================
  { code: '5901', description: { es: 'Telas recubiertas de cola o de materias amilaceas, del tipo de las utilizadas para encuadernacion', en: 'Textile fabrics coated with gum or amylaceous substances, for book covers' } },
  { code: '5902', description: { es: 'Napas tramadas para neumaticos fabricadas con hilados de alta tenacidad de nailon o poliester', en: 'Tyre cord fabric of high-tenacity yarn of nylon or other polyamides, polyesters' } },
  { code: '5903', description: { es: 'Telas impregnadas, recubiertas, revestidas o estratificadas con plastico', en: 'Textile fabrics impregnated, coated, covered or laminated with plastics' } },
  { code: '5904', description: { es: 'Linoleos, incluso cortados; revestimientos para el suelo sobre soporte de materia textil', en: 'Linoleum, whether or not cut to shape; floor coverings on a textile base' } },
  { code: '5905', description: { es: 'Revestimientos de materia textil para paredes', en: 'Textile wall coverings' } },
  { code: '5906', description: { es: 'Telas cauchutadas, excepto las de la partida 5902', en: 'Rubberised textile fabrics, other than those of heading 5902' } },
  { code: '5907', description: { es: 'Las demas telas impregnadas, recubiertas o revestidas; lienzos pintados para decoraciones de teatro', en: 'Textile fabrics otherwise impregnated, coated or covered; painted canvas for theatre scenery' } },
  { code: '5908', description: { es: 'Mechas de materia textil tejida, trenzada o de punto, para lamparas, hornillos, mecheros, velas', en: 'Textile wicks, woven, plaited or knitted, for lamps, stoves, lighters, candles' } },
  { code: '5909', description: { es: 'Mangueras para bombas y tubos similares, de materia textil, incluso con armadura o accesorios de otras materias', en: 'Textile hosepiping and similar textile tubing, with or without lining or accessories' } },
  { code: '5910', description: { es: 'Correas transportadoras o de transmision, de materia textil, incluso impregnadas, recubiertas o estratificadas', en: 'Transmission or conveyor belts or belting, of textile material' } },
  { code: '5911', description: { es: 'Productos y articulos textiles para usos tecnicos', en: 'Textile products and articles, for technical uses' } },

  // =========================================================================
  // CHAPTER 60 - TEJIDOS DE PUNTO / KNITTED OR CROCHETED FABRICS
  // =========================================================================
  { code: '6001', description: { es: 'Terciopelo, felpa y tejidos con bucles de punto, incluidos los tejidos de punto de pelo largo', en: 'Pile fabrics, including long pile fabrics and terry fabrics, knitted or crocheted' } },
  { code: '6002', description: { es: 'Tejidos de punto de anchura <= 30 cm, con un contenido de hilados de elastomeros o de hilos de caucho >= 5%', en: 'Knitted or crocheted fabrics of a width <= 30 cm, containing >= 5% elastomeric yarn or rubber thread' } },
  { code: '6003', description: { es: 'Tejidos de punto de anchura <= 30 cm, excepto los de las partidas 6001 o 6002', en: 'Knitted or crocheted fabrics of a width <= 30 cm, other than those of heading 6001 or 6002' } },
  { code: '6004', description: { es: 'Tejidos de punto de anchura > 30 cm, con un contenido de hilados de elastomeros o de hilos de caucho >= 5%', en: 'Knitted or crocheted fabrics of a width > 30 cm, containing >= 5% elastomeric yarn or rubber thread' } },
  { code: '6005', description: { es: 'Tejidos de punto por urdimbre, excepto los de las partidas 6001 a 6004', en: 'Warp knit fabrics, other than those of headings 6001 to 6004' } },
  { code: '6006', description: { es: 'Los demas tejidos de punto', en: 'Other knitted or crocheted fabrics' } },

  // =========================================================================
  // CHAPTER 61 - PRENDAS DE VESTIR DE PUNTO / ARTICLES OF APPAREL, KNITTED
  // =========================================================================
  { code: '6101', description: { es: 'Abrigos, chaquetones, capas, anoraks y articulos similares, de punto, para hombres o niños', en: 'Mens or boys overcoats, car-coats, capes, cloaks, anoraks, knitted or crocheted' } },
  { code: '6102', description: { es: 'Abrigos, chaquetones, capas, anoraks y articulos similares, de punto, para mujeres o niñas', en: 'Womens or girls overcoats, car-coats, capes, cloaks, anoraks, knitted or crocheted' } },
  { code: '6103', description: { es: 'Trajes, conjuntos, chaquetas, pantalones y shorts, de punto, para hombres o niños', en: 'Mens or boys suits, ensembles, jackets, blazers, trousers, shorts, knitted' } },
  { code: '6104', description: { es: 'Trajes sastre, conjuntos, chaquetas, vestidos, faldas, pantalones y shorts, de punto, para mujeres o niñas', en: 'Womens or girls suits, ensembles, jackets, dresses, skirts, trousers, shorts, knitted' } },
  { code: '6105', description: { es: 'Camisas de punto, para hombres o niños', en: 'Mens or boys shirts, knitted or crocheted' } },
  { code: '6106', description: { es: 'Blusas, camisas y camisetas de punto, para mujeres o niñas', en: 'Womens or girls blouses, shirts and shirt-blouses, knitted or crocheted' } },
  { code: '6107', description: { es: 'Calzoncillos, pijamas, albornoces de baño y articulos similares, de punto, para hombres o niños', en: 'Mens or boys underpants, briefs, nightshirts, pyjamas, bathrobes, knitted' } },
  { code: '6108', description: { es: 'Combinaciones, enaguas, bragas, camisones, pijamas, saltos de cama y articulos similares, de punto, para mujeres', en: 'Womens or girls slips, petticoats, briefs, panties, nightdresses, pyjamas, knitted' } },
  { code: '6109', description: { es: 'Camisetas de todo tipo, de punto', en: 'T-shirts, singlets and other vests, knitted or crocheted' } },
  { code: '6110', description: { es: 'Sueteres, pullovers, cardigans, chalecos y articulos similares, de punto', en: 'Jerseys, pullovers, cardigans, waistcoats and similar articles, knitted' } },
  { code: '6111', description: { es: 'Prendas y complementos de vestir, de punto, para bebes', en: 'Babies garments and clothing accessories, knitted or crocheted' } },
  { code: '6112', description: { es: 'Conjuntos de abrigo para entrenamiento o deporte, monos y conjuntos de esqui, bañadores, de punto', en: 'Track suits, ski suits, swimwear, knitted or crocheted' } },
  { code: '6113', description: { es: 'Prendas de vestir confeccionadas con tejidos de punto de las partidas 5903, 5906 o 5907', en: 'Garments made up of knitted or crocheted fabrics of heading 5903, 5906 or 5907' } },
  { code: '6114', description: { es: 'Las demas prendas de vestir, de punto', en: 'Other garments, knitted or crocheted' } },
  { code: '6115', description: { es: 'Calzas, panties, leotardos, medias, calcetines y demas articulos de calceteria, de punto', en: 'Pantyhose, tights, stockings, socks and other hosiery, knitted or crocheted' } },
  { code: '6116', description: { es: 'Guantes, mitones y manoplas, de punto', en: 'Gloves, mittens and mitts, knitted or crocheted' } },
  { code: '6117', description: { es: 'Los demas complementos de vestir confeccionados, de punto; partes de prendas o de complementos de vestir, de punto', en: 'Other made-up clothing accessories, knitted; knitted parts of garments or of clothing accessories' } },

  // =========================================================================
  // CHAPTER 62 - PRENDAS DE VESTIR, NO DE PUNTO / ARTICLES OF APPAREL, NOT KNITTED
  // =========================================================================
  { code: '6201', description: { es: 'Abrigos, chaquetones, capas, anoraks y articulos similares, para hombres o niños, excepto los de la partida 6203', en: 'Mens or boys overcoats, car-coats, capes, cloaks, anoraks, not knitted' } },
  { code: '6202', description: { es: 'Abrigos, chaquetones, capas, anoraks y articulos similares, para mujeres o niñas, excepto los de la partida 6204', en: 'Womens or girls overcoats, car-coats, capes, cloaks, anoraks, not knitted' } },
  { code: '6203', description: { es: 'Trajes, conjuntos, chaquetas, pantalones y shorts, para hombres o niños', en: 'Mens or boys suits, ensembles, jackets, blazers, trousers, bib and brace overalls, shorts' } },
  { code: '6204', description: { es: 'Trajes sastre, conjuntos, chaquetas, vestidos, faldas, pantalones y shorts, para mujeres o niñas', en: 'Womens or girls suits, ensembles, jackets, dresses, skirts, trousers, shorts' } },
  { code: '6205', description: { es: 'Camisas para hombres o niños', en: 'Mens or boys shirts' } },
  { code: '6206', description: { es: 'Blusas, camisas y camisetas, para mujeres o niñas', en: 'Womens or girls blouses, shirts and shirt-blouses' } },
  { code: '6207', description: { es: 'Camisetas interiores, calzoncillos, pijamas, albornoces y articulos similares, para hombres o niños', en: 'Mens or boys singlets, underpants, briefs, nightshirts, pyjamas, bathrobes' } },
  { code: '6208', description: { es: 'Camisetas interiores, combinaciones, enaguas, bragas, camisones, pijamas, para mujeres o niñas', en: 'Womens or girls singlets, slips, petticoats, briefs, panties, nightdresses, pyjamas' } },
  { code: '6209', description: { es: 'Prendas y complementos de vestir, para bebes', en: 'Babies garments and clothing accessories' } },
  { code: '6210', description: { es: 'Prendas de vestir confeccionadas con productos de las partidas 5602, 5603, 5903, 5906 o 5907', en: 'Garments made up of fabrics of heading 5602, 5603, 5903, 5906 or 5907' } },
  { code: '6211', description: { es: 'Conjuntos de abrigo para entrenamiento o deporte, monos y conjuntos de esqui, bañadores', en: 'Track suits, ski suits and swimwear; other garments' } },
  { code: '6212', description: { es: 'Sostenes, fajas, corses, tirantes, ligas y articulos similares, y sus partes', en: 'Brassieres, girdles, corsets, braces, suspenders, garters and similar articles' } },
  { code: '6213', description: { es: 'Pañuelos de bolsillo', en: 'Handkerchiefs' } },
  { code: '6214', description: { es: 'Chales, pañuelos de cuello, bufandas, mantillas, velos y articulos similares', en: 'Shawls, scarves, mufflers, mantillas, veils and the like' } },
  { code: '6215', description: { es: 'Corbatas y lazos similares', en: 'Ties, bow ties and cravats' } },
  { code: '6216', description: { es: 'Guantes, mitones y manoplas', en: 'Gloves, mittens and mitts' } },
  { code: '6217', description: { es: 'Los demas complementos de vestir confeccionados; partes de prendas o de complementos de vestir', en: 'Other made-up clothing accessories; parts of garments or of clothing accessories' } },

  // =========================================================================
  // CHAPTER 63 - OTROS ARTICULOS TEXTILES / OTHER MADE UP TEXTILE ARTICLES
  // =========================================================================
  { code: '6301', description: { es: 'Mantas', en: 'Blankets and travelling rugs' } },
  { code: '6302', description: { es: 'Ropa de cama, de mesa, de tocador o de cocina', en: 'Bed linen, table linen, toilet linen and kitchen linen' } },
  { code: '6303', description: { es: 'Visillos y cortinas; guardamalletas y doseles', en: 'Curtains, interior blinds, curtain or bed valances' } },
  { code: '6304', description: { es: 'Los demas articulos de tapiceria, excepto los de la partida 9404', en: 'Other furnishing articles, excluding those of heading 9404' } },
  { code: '6305', description: { es: 'Sacos y talegas para envasar', en: 'Sacks and bags, of a kind used for the packing of goods' } },
  { code: '6306', description: { es: 'Toldos de cualquier clase; tiendas; velas para embarcaciones; articulos de campamento', en: 'Tarpaulins, awnings and sunblinds; tents; sails; camping goods' } },
  { code: '6307', description: { es: 'Los demas articulos confeccionados, incluidos los patrones para prendas de vestir', en: 'Other made-up articles, including dress patterns' } },
  { code: '6308', description: { es: 'Juegos constituidos por piezas de tejido e hilados para la confeccion de alfombras, tapiceria, manteles o servilletas', en: 'Sets consisting of woven fabric and yarn for making up into rugs, tapestries, tablecloths, serviettes' } },
  { code: '6309', description: { es: 'Articulos de prenderia', en: 'Worn clothing and other worn articles' } },
  { code: '6310', description: { es: 'Trapos, cordeles, cuerdas y cordajes, de materia textil, en desperdicios o en articulos inservibles', en: 'Used or new rags, scrap twine, cordage, rope and cables and worn out articles of textile materials' } },

  // =========================================================================
  // CHAPTER 64 - CALZADO / FOOTWEAR
  // =========================================================================
  { code: '6401', description: { es: 'Calzado impermeable con suela y parte superior de caucho o plastico', en: 'Waterproof footwear with outer soles and uppers of rubber or of plastics' } },
  { code: '6402', description: { es: 'Los demas calzados con suela y parte superior de caucho o plastico', en: 'Other footwear with outer soles and uppers of rubber or plastics' } },
  { code: '6403', description: { es: 'Calzado con suela de caucho, plastico, cuero natural o regenerado y parte superior de cuero natural', en: 'Footwear with outer soles of rubber, plastics, leather and uppers of leather' } },
  { code: '6404', description: { es: 'Calzado con suela de caucho, plastico, cuero natural o regenerado y parte superior de materia textil', en: 'Footwear with outer soles of rubber, plastics, leather and uppers of textile materials' } },
  { code: '6405', description: { es: 'Los demas calzados', en: 'Other footwear' } },
  { code: '6406', description: { es: 'Partes de calzado, incluidas las partes superiores fijadas a las palmillas distintas de la suela; plantillas', en: 'Parts of footwear; removable in-soles, heel cushions; gaiters, leggings' } },

  // =========================================================================
  // CHAPTER 65 - SOMBREROS / HEADGEAR
  // =========================================================================
  { code: '6501', description: { es: 'Cascos sin forma ni acabado, platos y cilindros, aunque esten cortados en el sentido de la altura, de fieltro', en: 'Hat-forms, hat bodies and hoods of felt, neither blocked to shape nor with made brims' } },
  { code: '6502', description: { es: 'Cascos para sombreros, trenzados o fabricados por union de tiras de cualquier materia, sin forma ni acabado', en: 'Hat-shapes, plaited or made by assembling strips of any material, neither blocked nor with made brims' } },
  { code: '6504', description: { es: 'Sombreros y demas tocados, trenzados o fabricados por union de tiras de cualquier materia', en: 'Hats and other headgear, plaited or made by assembling strips of any material' } },
  { code: '6505', description: { es: 'Sombreros y demas tocados, de punto o confeccionados con encaje, fieltro u otro producto textil', en: 'Hats and other headgear, knitted or crocheted, or made up from lace, felt or other textile fabric' } },
  { code: '6506', description: { es: 'Los demas sombreros y tocados, incluso guarnecidos', en: 'Other headgear, whether or not lined or trimmed' } },
  { code: '6507', description: { es: 'Desudadores, forros, fundas, armaduras, viseras y barboquejos, para sombreros y demas tocados', en: 'Headbands, linings, covers, hat foundations, hat frames, peaks and chinstraps' } },

  // =========================================================================
  // CHAPTER 66 - PARAGUAS / UMBRELLAS
  // =========================================================================
  { code: '6601', description: { es: 'Paraguas, sombrillas y quitasoles, incluidos los paraguas baston, los quitasoles toldo', en: 'Umbrellas and sun umbrellas, including walking-stick umbrellas, garden umbrellas' } },
  { code: '6602', description: { es: 'Bastones, bastones asiento, latigos, fustas y articulos similares', en: 'Walking-sticks, seat-sticks, whips, riding-crops and the like' } },
  { code: '6603', description: { es: 'Partes, guarniciones y accesorios para los articulos de las partidas 6601 o 6602', en: 'Parts, trimmings and accessories of articles of heading 6601 or 6602' } },

  // =========================================================================
  // CHAPTER 67 - PLUMAS / PREPARED FEATHERS
  // =========================================================================
  { code: '6701', description: { es: 'Pieles y demas partes de ave con sus plumas o plumon, plumas, partes de plumas, plumon y articulos de estas materias', en: 'Skins and other parts of birds with their feathers, feathers, parts of feathers, down' } },
  { code: '6702', description: { es: 'Flores, follaje y frutos artificiales y sus partes; articulos confeccionados con flores, follaje o frutos artificiales', en: 'Artificial flowers, foliage and fruit and parts thereof; articles made of artificial flowers, foliage or fruit' } },
  { code: '6703', description: { es: 'Cabello peinado, afinado, blanqueado o preparado de otra forma; lana, pelo y demas materias textiles', en: 'Human hair, dressed, thinned, bleached or otherwise worked; wool or other animal hair' } },
  { code: '6704', description: { es: 'Pelucas, barbas, cejas, pestañas, mechones y articulos analogos, de cabello, pelo o materia textil', en: 'Wigs, false beards, eyebrows and eyelashes, switches and the like, of human or animal hair or textiles' } },

  // =========================================================================
  // CHAPTER 68 - MANUFACTURAS DE PIEDRA / ARTICLES OF STONE, CEMENT
  // =========================================================================
  { code: '6801', description: { es: 'Adoquines, encintados y losas para pavimentos, de piedra natural', en: 'Setts, curbstones and flagstones, of natural stone' } },
  { code: '6802', description: { es: 'Piedras de talla o de construccion trabajadas y sus manufacturas; cubos, dados y articulos similares para mosaicos', en: 'Worked monumental or building stone and articles thereof; mosaic cubes' } },
  { code: '6803', description: { es: 'Pizarra natural trabajada y manufacturas de pizarra natural o aglomerada', en: 'Worked slate and articles of slate or of agglomerated slate' } },
  { code: '6804', description: { es: 'Muelas y articulos similares para moler, desfibrar, triturar, afilar, pulir, rectificar, cortar o trocear', en: 'Millstones, grindstones, grinding wheels and the like, for grinding, sharpening, polishing, cutting' } },
  { code: '6805', description: { es: 'Abrasivos naturales o artificiales, en polvo o en granulos, con soporte de materia textil, papel o carton', en: 'Natural or artificial abrasive powder or grain, on a base of textile material, paper or paperboard' } },
  { code: '6806', description: { es: 'Lana de escoria, de roca y lanas minerales similares; vermiculita dilatada, arcillas dilatadas', en: 'Slag wool, rock wool and similar mineral wools; exfoliated vermiculite, expanded clays' } },
  { code: '6807', description: { es: 'Manufacturas de asfalto o de productos similares', en: 'Articles of asphalt or of similar material' } },
  { code: '6808', description: { es: 'Paneles, placas, losetas, bloques y articulos similares, de fibra vegetal, de paja o de viruta, plaquitas, particulas, aserrin', en: 'Panels, boards, tiles, blocks and similar articles of vegetable fibre, of straw, of shavings' } },
  { code: '6809', description: { es: 'Manufacturas de yeso o de preparaciones a base de yeso', en: 'Articles of plaster or of compositions based on plaster' } },
  { code: '6810', description: { es: 'Manufacturas de cemento, hormigon o piedra artificial, incluso armadas', en: 'Articles of cement, of concrete or of artificial stone' } },
  { code: '6811', description: { es: 'Manufacturas de amiantocemento, celulosacemento o similares', en: 'Articles of asbestos-cement, of cellulose fibre-cement or the like' } },
  { code: '6812', description: { es: 'Amianto (asbesto) en fibras trabajado; mezclas a base de amianto o a base de amianto y carbonato de magnesio', en: 'Fabricated asbestos fibres; mixtures with a basis of asbestos or with a basis of asbestos and magnesium carbonate' } },
  { code: '6813', description: { es: 'Guarniciones de friccion sin montar, para frenos, embragues o cualquier organo de frotamiento', en: 'Friction material and articles thereof, not mounted, for brakes, clutches or the like' } },
  { code: '6814', description: { es: 'Mica trabajada y manufacturas de mica, incluida la mica aglomerada o reconstituida', en: 'Worked mica and articles of mica, including agglomerated or reconstituted mica' } },
  { code: '6815', description: { es: 'Manufacturas de piedra o de otras materias minerales, no expresadas ni comprendidas en otra parte', en: 'Articles of stone or of other mineral substances, not elsewhere specified' } },

  // =========================================================================
  // CHAPTER 69 - PRODUCTOS CERAMICOS / CERAMIC PRODUCTS
  // =========================================================================
  { code: '6901', description: { es: 'Ladrillos, placas, baldosas y demas piezas ceramicas de harinas siliceas fosiles o de tierras siliceas analogas', en: 'Bricks, blocks, tiles and other ceramic goods of siliceous fossil meals or of similar siliceous earths' } },
  { code: '6902', description: { es: 'Ladrillos, placas, baldosas y piezas ceramicas analogas de construccion, refractarios', en: 'Refractory bricks, blocks, tiles and similar refractory ceramic constructional goods' } },
  { code: '6903', description: { es: 'Los demas articulos ceramicos refractarios', en: 'Other refractory ceramic goods' } },
  { code: '6904', description: { es: 'Ladrillos de construccion, bovedillas, cubrevigas y articulos similares, de ceramica', en: 'Ceramic building bricks, flooring blocks, support or filler tiles' } },
  { code: '6905', description: { es: 'Tejas, elementos de chimenea, conductos de humo, ornamentos arquitectonicos y demas articulos ceramicos de construccion', en: 'Roofing tiles, chimney-pots, cowls, chimney liners, architectural ornaments and other ceramic constructional goods' } },
  { code: '6906', description: { es: 'Tubos, canalones y accesorios de tuberia, de ceramica', en: 'Ceramic pipes, conduits, guttering and pipe fittings' } },
  { code: '6907', description: { es: 'Placas y baldosas, de ceramica, para pavimentacion o revestimiento', en: 'Ceramic flags and paving, hearth or wall tiles' } },
  { code: '6909', description: { es: 'Aparatos y articulos para usos quimicos o demas usos tecnicos, de ceramica; abrevaderos, recipientes de ceramica para la economia rural', en: 'Ceramic wares for laboratory, chemical or other technical uses; ceramic troughs, tubs' } },
  { code: '6910', description: { es: 'Fregaderos, lavabos, columnas de lavabo, bañeras, bides, inodoros, cisternas y articulos analogos, de ceramica', en: 'Ceramic sinks, wash basins, wash basin pedestals, baths, bidets, water closet pans' } },
  { code: '6911', description: { es: 'Vajilla y demas articulos de uso domestico, higiene o tocador, de porcelana', en: 'Tableware, kitchenware, other household articles and toilet articles, of porcelain or china' } },
  { code: '6912', description: { es: 'Vajilla y demas articulos de uso domestico, higiene o tocador, de ceramica, excepto de porcelana', en: 'Ceramic tableware, kitchenware, other household and toilet articles, other than of porcelain or china' } },
  { code: '6913', description: { es: 'Estatuillas y demas articulos para adorno, de ceramica', en: 'Statuettes and other ornamental ceramic articles' } },
  { code: '6914', description: { es: 'Las demas manufacturas de ceramica', en: 'Other ceramic articles' } },

  // =========================================================================
  // CHAPTER 70 - VIDRIO / GLASS
  // =========================================================================
  { code: '7001', description: { es: 'Desperdicios y desechos de vidrio; vidrio en masa', en: 'Cullet and other waste and scrap of glass; glass in the mass' } },
  { code: '7002', description: { es: 'Vidrio en bolas, barras, varillas o tubos, sin trabajar', en: 'Glass in balls, rods or tubes, unworked' } },
  { code: '7003', description: { es: 'Vidrio colado o laminado, en placas, hojas o perfiles, incluso con capa absorbente, reflectante o antirreflectante', en: 'Cast glass and rolled glass, in sheets or profiles' } },
  { code: '7004', description: { es: 'Vidrio estirado o soplado, en hojas, incluso con capa absorbente, reflectante o antirreflectante', en: 'Drawn glass and blown glass, in sheets' } },
  { code: '7005', description: { es: 'Vidrio flotado y vidrio desbastado o pulido por una o las dos caras, en placas u hojas', en: 'Float glass and surface ground or polished glass, in sheets' } },
  { code: '7006', description: { es: 'Vidrio de las partidas 7003, 7004 o 7005, curvado, biselado, grabado, taladrado, esmaltado o trabajado', en: 'Glass of heading 7003, 7004 or 7005, bent, edge-worked, engraved, drilled, enamelled or otherwise worked' } },
  { code: '7007', description: { es: 'Vidrio de seguridad: vidrio templado o contrachapado (estratificado)', en: 'Safety glass, consisting of toughened (tempered) or laminated glass' } },
  { code: '7008', description: { es: 'Vidrieras aislantes de paredes multiples', en: 'Multiple-walled insulating units of glass' } },
  { code: '7009', description: { es: 'Espejos de vidrio, incluso enmarcados, incluidos los espejos retrovisores', en: 'Glass mirrors, whether or not framed, including rear-view mirrors' } },
  { code: '7010', description: { es: 'Bombonas, botellas, frascos, tarros, bocales, envases tubulares y demas recipientes para el transporte o envasado, de vidrio', en: 'Carboys, bottles, flasks, jars, pots, phials and other containers, of glass' } },
  { code: '7011', description: { es: 'Ampollas y envolturas tubulares, abiertas, y sus partes, de vidrio, sin guarniciones', en: 'Glass envelopes, open, and glass parts thereof, without fittings' } },
  { code: '7013', description: { es: 'Articulos de vidrio para servicio de mesa, cocina, tocador, baño, oficina, adorno de interiores', en: 'Glassware of a kind used for table, kitchen, toilet, office, indoor decoration' } },
  { code: '7014', description: { es: 'Vidrio para señalizacion y elementos de optica de vidrio, excepto los de la partida 7015, sin trabajar opticamente', en: 'Signalling glassware and optical elements of glass, not optically worked' } },
  { code: '7015', description: { es: 'Vidrios de relojeria y vidrios analogos, vidrios de gafas, incluso correctoras, curvados, combados', en: 'Clock or watch glasses and similar glasses, glasses for non-corrective or corrective spectacles' } },
  { code: '7016', description: { es: 'Adoquines, baldosas, ladrillos, placas, tejas y demas articulos de vidrio prensado o moldeado', en: 'Paving blocks, slabs, bricks, squares, tiles and other articles of pressed or moulded glass' } },
  { code: '7017', description: { es: 'Articulos de vidrio para laboratorio, higiene o farmacia, incluso graduados o calibrados', en: 'Laboratory, hygienic or pharmaceutical glassware, whether or not graduated or calibrated' } },
  { code: '7018', description: { es: 'Cuentas de vidrio, imitaciones de perlas, de piedras preciosas o semipreciosas y articulos similares de abalorio', en: 'Glass beads, imitation pearls, imitation precious or semi-precious stones and similar glass smallwares' } },
  { code: '7019', description: { es: 'Fibras de vidrio, incluida la lana de vidrio, y manufacturas de estas materias', en: 'Glass fibres, including glass wool, and articles thereof' } },
  { code: '7020', description: { es: 'Las demas manufacturas de vidrio', en: 'Other articles of glass' } },

  // =========================================================================
  // CHAPTER 71 - PERLAS, PIEDRAS PRECIOSAS / PEARLS, PRECIOUS STONES
  // =========================================================================
  { code: '7101', description: { es: 'Perlas finas (naturales) o cultivadas, incluso trabajadas o clasificadas', en: 'Pearls, natural or cultured, whether or not worked or graded' } },
  { code: '7102', description: { es: 'Diamantes, incluso trabajados, sin montar ni engarzar', en: 'Diamonds, whether or not worked, but not mounted or set' } },
  { code: '7103', description: { es: 'Piedras preciosas o semipreciosas, naturales, incluso trabajadas o clasificadas', en: 'Precious stones and semi-precious stones, natural, whether or not worked or graded' } },
  { code: '7104', description: { es: 'Piedras preciosas o semipreciosas, sinteticas o reconstituidas', en: 'Synthetic or reconstructed precious or semi-precious stones' } },
  { code: '7105', description: { es: 'Polvo de piedras preciosas o semipreciosas, naturales o sinteticas', en: 'Dust and powder of natural or synthetic precious or semi-precious stones' } },
  { code: '7106', description: { es: 'Plata, incluida la plata dorada y la platinada, en bruto, semilabrada o en polvo', en: 'Silver, including silver plated with gold or platinum, unwrought, semi-manufactured or in powder form' } },
  { code: '7107', description: { es: 'Chapado de plata sobre metal comun, en bruto o semilabrado', en: 'Base metals clad with silver, not further worked than semi-manufactured' } },
  { code: '7108', description: { es: 'Oro, incluido el oro platinado, en bruto, semilabrado o en polvo', en: 'Gold, including gold plated with platinum, unwrought, semi-manufactured or in powder form' } },
  { code: '7109', description: { es: 'Chapado de oro sobre metal comun o sobre plata, en bruto o semilabrado', en: 'Base metals or silver, clad with gold, not further worked than semi-manufactured' } },
  { code: '7110', description: { es: 'Platino, en bruto, semilabrado o en polvo', en: 'Platinum, unwrought, semi-manufactured or in powder form' } },
  { code: '7111', description: { es: 'Chapado de platino sobre metal comun, plata u oro, en bruto o semilabrado', en: 'Base metals, silver or gold, clad with platinum, not further worked than semi-manufactured' } },
  { code: '7112', description: { es: 'Desperdicios y desechos de metal precioso o de chapado de metal precioso', en: 'Waste and scrap of precious metal or of metal clad with precious metal' } },
  { code: '7113', description: { es: 'Articulos de joyeria y sus partes, de metal precioso o de chapado de metal precioso', en: 'Articles of jewellery and parts thereof, of precious metal or of metal clad with precious metal' } },
  { code: '7114', description: { es: 'Articulos de orfebreria y sus partes, de metal precioso o de chapado de metal precioso', en: 'Articles of goldsmiths or silversmiths wares and parts thereof, of precious metal' } },
  { code: '7115', description: { es: 'Las demas manufacturas de metal precioso o de chapado de metal precioso', en: 'Other articles of precious metal or of metal clad with precious metal' } },
  { code: '7116', description: { es: 'Manufacturas de perlas finas (naturales) o cultivadas, de piedras preciosas o semipreciosas', en: 'Articles of natural or cultured pearls, precious or semi-precious stones' } },
  { code: '7117', description: { es: 'Bisuteria', en: 'Imitation jewellery' } },
  { code: '7118', description: { es: 'Monedas', en: 'Coin' } },

  // =========================================================================
  // CHAPTER 72 - FUNDICION, HIERRO Y ACERO / IRON AND STEEL
  // =========================================================================
  { code: '7201', description: { es: 'Fundicion en bruto y fundicion especular, en lingotes, bloques o demas formas primarias', en: 'Pig iron and spiegeleisen in pigs, blocks or other primary forms' } },
  { code: '7202', description: { es: 'Ferroaleaciones', en: 'Ferro-alloys' } },
  { code: '7203', description: { es: 'Productos ferreos obtenidos por reduccion directa de minerales de hierro y demas productos ferreos esponjosos', en: 'Ferrous products obtained by direct reduction of iron ore and other spongy ferrous products' } },
  { code: '7204', description: { es: 'Desperdicios y desechos de fundicion, hierro o acero; lingotes de chatarra de hierro o acero', en: 'Ferrous waste and scrap; remelting scrap ingots of iron or steel' } },
  { code: '7205', description: { es: 'Granallas y polvo de fundicion en bruto, de fundicion especular, de hierro o acero', en: 'Granules and powders, of pig iron, spiegeleisen, iron or steel' } },
  { code: '7206', description: { es: 'Hierro y acero sin alear, en lingotes o demas formas primarias', en: 'Iron and non-alloy steel in ingots or other primary forms' } },
  { code: '7207', description: { es: 'Productos intermedios de hierro o acero sin alear', en: 'Semi-finished products of iron or non-alloy steel' } },
  { code: '7208', description: { es: 'Productos laminados planos de hierro o acero sin alear, de anchura >= 600 mm, laminados en caliente', en: 'Flat-rolled products of iron or non-alloy steel, >= 600 mm wide, hot-rolled' } },
  { code: '7209', description: { es: 'Productos laminados planos de hierro o acero sin alear, de anchura >= 600 mm, laminados en frio', en: 'Flat-rolled products of iron or non-alloy steel, >= 600 mm wide, cold-rolled' } },
  { code: '7210', description: { es: 'Productos laminados planos de hierro o acero sin alear, de anchura >= 600 mm, chapados o revestidos', en: 'Flat-rolled products of iron or non-alloy steel, >= 600 mm wide, clad, plated or coated' } },
  { code: '7211', description: { es: 'Productos laminados planos de hierro o acero sin alear, de anchura < 600 mm, sin chapar ni revestir', en: 'Flat-rolled products of iron or non-alloy steel, < 600 mm wide, not clad, plated or coated' } },
  { code: '7212', description: { es: 'Productos laminados planos de hierro o acero sin alear, de anchura < 600 mm, chapados o revestidos', en: 'Flat-rolled products of iron or non-alloy steel, < 600 mm wide, clad, plated or coated' } },
  { code: '7213', description: { es: 'Alambrón de hierro o acero sin alear', en: 'Bars and rods, hot-rolled, in irregularly wound coils, of iron or non-alloy steel' } },
  { code: '7214', description: { es: 'Barras de hierro o acero sin alear, simplemente forjadas, laminadas en caliente o extrudidas', en: 'Other bars and rods of iron or non-alloy steel, simply forged, hot-rolled or extruded' } },
  { code: '7215', description: { es: 'Las demas barras de hierro o acero sin alear', en: 'Other bars and rods of iron or non-alloy steel' } },
  { code: '7216', description: { es: 'Perfiles de hierro o acero sin alear', en: 'Angles, shapes and sections of iron or non-alloy steel' } },
  { code: '7217', description: { es: 'Alambre de hierro o acero sin alear', en: 'Wire of iron or non-alloy steel' } },
  { code: '7218', description: { es: 'Acero inoxidable en lingotes o demas formas primarias; productos intermedios de acero inoxidable', en: 'Stainless steel in ingots or other primary forms; semi-finished products of stainless steel' } },
  { code: '7219', description: { es: 'Productos laminados planos de acero inoxidable, de anchura >= 600 mm', en: 'Flat-rolled products of stainless steel, of a width of >= 600 mm' } },
  { code: '7220', description: { es: 'Productos laminados planos de acero inoxidable, de anchura < 600 mm', en: 'Flat-rolled products of stainless steel, of a width of < 600 mm' } },
  { code: '7221', description: { es: 'Alambrón de acero inoxidable', en: 'Bars and rods, hot-rolled, in irregularly wound coils, of stainless steel' } },
  { code: '7222', description: { es: 'Barras y perfiles, de acero inoxidable', en: 'Other bars and rods of stainless steel; angles, shapes and sections of stainless steel' } },
  { code: '7223', description: { es: 'Alambre de acero inoxidable', en: 'Wire of stainless steel' } },
  { code: '7224', description: { es: 'Los demas aceros aleados en lingotes o demas formas primarias; productos intermedios de los demas aceros aleados', en: 'Other alloy steel in ingots or other primary forms; semi-finished products of other alloy steel' } },
  { code: '7225', description: { es: 'Productos laminados planos de los demas aceros aleados, de anchura >= 600 mm', en: 'Flat-rolled products of other alloy steel, of a width of >= 600 mm' } },
  { code: '7226', description: { es: 'Productos laminados planos de los demas aceros aleados, de anchura < 600 mm', en: 'Flat-rolled products of other alloy steel, of a width of < 600 mm' } },
  { code: '7227', description: { es: 'Alambrón de los demas aceros aleados', en: 'Bars and rods, hot-rolled, in irregularly wound coils, of other alloy steel' } },
  { code: '7228', description: { es: 'Barras y perfiles, de los demas aceros aleados; barras huecas para perforacion', en: 'Other bars and rods of other alloy steel; angles, shapes and sections; hollow drill bars and rods' } },
  { code: '7229', description: { es: 'Alambre de los demas aceros aleados', en: 'Wire of other alloy steel' } },

  // =========================================================================
  // CHAPTER 73 - MANUFACTURAS DE FUNDICION, HIERRO O ACERO
  // =========================================================================
  { code: '7301', description: { es: 'Tablestacas de hierro o acero; perfiles de hierro o acero obtenidos por soldadura', en: 'Sheet piling of iron or steel; welded angles, shapes and sections, of iron or steel' } },
  { code: '7302', description: { es: 'Material de construccion de vias ferreas, de fundicion, hierro o acero: carriles, contracarriles', en: 'Railway or tramway track construction material of iron or steel: rails, switch blades' } },
  { code: '7303', description: { es: 'Tubos y perfiles huecos, de fundicion', en: 'Tubes, pipes and hollow profiles, of cast iron' } },
  { code: '7304', description: { es: 'Tubos y perfiles huecos, sin soldadura, de hierro o acero', en: 'Tubes, pipes and hollow profiles, seamless, of iron or steel' } },
  { code: '7305', description: { es: 'Los demas tubos de hierro o acero, de seccion circular y diametro exterior > 406.4 mm, soldados', en: 'Other tubes and pipes, of circular cross-section, external diameter > 406.4 mm, of iron or steel' } },
  { code: '7306', description: { es: 'Los demas tubos y perfiles huecos de hierro o acero, soldados, remachados o cerrados de modo similar', en: 'Other tubes, pipes and hollow profiles, of iron or steel, welded, riveted or similarly closed' } },
  { code: '7307', description: { es: 'Accesorios de tuberia de hierro o acero', en: 'Tube or pipe fittings, of iron or steel' } },
  { code: '7308', description: { es: 'Construcciones y sus partes, de fundicion, hierro o acero; chapas, barras, perfiles, tubos y similares para la construccion', en: 'Structures and parts of structures, of iron or steel; plates, rods, angles, shapes, sections, tubes' } },
  { code: '7309', description: { es: 'Depositos, cisternas, cubas y recipientes similares para cualquier materia, de fundicion, hierro o acero, > 300 l', en: 'Reservoirs, tanks, vats and similar containers, of iron or steel, > 300 l' } },
  { code: '7310', description: { es: 'Depositos, barriles, tambores, bidones, latas o botes, cajas y recipientes similares, de fundicion, hierro o acero, <= 300 l', en: 'Tanks, casks, drums, cans, boxes and similar containers, of iron or steel, <= 300 l' } },
  { code: '7311', description: { es: 'Recipientes para gas comprimido o licuado, de fundicion, hierro o acero', en: 'Containers for compressed or liquefied gas, of iron or steel' } },
  { code: '7312', description: { es: 'Cables, trenzas, eslingas y articulos similares, de hierro o acero, sin aislamiento electrico', en: 'Stranded wire, ropes, cables, plaited bands, slings, of iron or steel, not electrically insulated' } },
  { code: '7313', description: { es: 'Alambre de puas, de hierro o acero; alambre torcido, incluso con puas, de hierro o acero', en: 'Barbed wire of iron or steel; twisted hoop or single flat wire, barbed or not, of iron or steel' } },
  { code: '7314', description: { es: 'Telas metalicas, incluidas las telas continuas o sin fin, redes y rejas, de alambre de hierro o acero', en: 'Cloth, grill, netting and fencing, of iron or steel wire' } },
  { code: '7315', description: { es: 'Cadenas y sus partes, de fundicion, hierro o acero', en: 'Chain and parts thereof, of iron or steel' } },
  { code: '7316', description: { es: 'Anclas, rezones y sus partes, de fundicion, hierro o acero', en: 'Anchors, grapnels and parts thereof, of iron or steel' } },
  { code: '7317', description: { es: 'Puntas, clavos, chinchetas, grapas apuntadas, onduladas o biseladas, y articulos similares, de fundicion, hierro o acero', en: 'Nails, tacks, drawing pins, corrugated nails, staples, of iron or steel' } },
  { code: '7318', description: { es: 'Tornillos, pernos, tuercas, tirafondos, escarpias roscadas, remaches, pasadores, clavijas, chavetas, arandelas, de hierro o acero', en: 'Screws, bolts, nuts, coach screws, screw hooks, rivets, cotters, cotter-pins, washers, of iron or steel' } },
  { code: '7319', description: { es: 'Agujas de coser, de tejer, pasacintas, ganchillos, punzones para bordar y articulos similares, de hierro o acero', en: 'Sewing needles, knitting needles, bodkins, crochet hooks, embroidery stilettos, of iron or steel' } },
  { code: '7320', description: { es: 'Muelles y hojas para muelles, de hierro o acero', en: 'Springs and leaves for springs, of iron or steel' } },
  { code: '7321', description: { es: 'Estufas, calderas con hogar, cocinas, barbacoas, braseros, hornillos de gas, calientaplatos, de fundicion, hierro o acero', en: 'Stoves, ranges, grates, cookers, barbecues, braziers, gas-rings, plate warmers, of iron or steel' } },
  { code: '7322', description: { es: 'Radiadores para calefaccion central, de fundicion, hierro o acero; generadores y distribuidores de aire caliente', en: 'Radiators for central heating, of iron or steel; air heaters and hot-air distributors' } },
  { code: '7323', description: { es: 'Articulos de uso domestico y sus partes, de fundicion, hierro o acero; lana de hierro o acero', en: 'Table, kitchen or other household articles and parts thereof, of iron or steel; iron or steel wool' } },
  { code: '7324', description: { es: 'Articulos de higiene o tocador, y sus partes, de fundicion, hierro o acero', en: 'Sanitary ware and parts thereof, of iron or steel' } },
  { code: '7325', description: { es: 'Las demas manufacturas moldeadas de fundicion, hierro o acero', en: 'Other cast articles of iron or steel' } },
  { code: '7326', description: { es: 'Las demas manufacturas de hierro o acero', en: 'Other articles of iron or steel' } },

  // =========================================================================
  // CHAPTER 74 - COBRE / COPPER
  // =========================================================================
  { code: '7401', description: { es: 'Matas de cobre; cobre de cementacion (cobre precipitado)', en: 'Copper mattes; cement copper (precipitated copper)' } },
  { code: '7402', description: { es: 'Cobre sin refinar; anodos de cobre para refinado electrolitico', en: 'Unrefined copper; copper anodes for electrolytic refining' } },
  { code: '7403', description: { es: 'Cobre refinado y aleaciones de cobre, en bruto', en: 'Refined copper and copper alloys, unwrought' } },
  { code: '7404', description: { es: 'Desperdicios y desechos, de cobre', en: 'Copper waste and scrap' } },
  { code: '7405', description: { es: 'Aleaciones madre de cobre', en: 'Master alloys of copper' } },
  { code: '7406', description: { es: 'Polvo y escamillas, de cobre', en: 'Copper powders and flakes' } },
  { code: '7407', description: { es: 'Barras y perfiles, de cobre', en: 'Copper bars, rods and profiles' } },
  { code: '7408', description: { es: 'Alambre de cobre', en: 'Copper wire' } },
  { code: '7409', description: { es: 'Chapas y tiras, de cobre, de espesor > 0.15 mm', en: 'Copper plates, sheets and strip, of a thickness > 0.15 mm' } },
  { code: '7410', description: { es: 'Hojas y tiras, delgadas, de cobre, de espesor <= 0.15 mm', en: 'Copper foil, of a thickness <= 0.15 mm' } },
  { code: '7411', description: { es: 'Tubos de cobre', en: 'Copper tubes and pipes' } },
  { code: '7412', description: { es: 'Accesorios de tuberia de cobre', en: 'Copper tube or pipe fittings' } },
  { code: '7413', description: { es: 'Cables, trenzas y articulos similares, de cobre, sin aislamiento electrico', en: 'Stranded wire, cables, plaited bands and the like, of copper, not electrically insulated' } },
  { code: '7415', description: { es: 'Puntas, clavos, chinchetas, grapas apuntadas y articulos similares, de cobre, o con espiga de hierro o acero y cabeza de cobre', en: 'Nails, tacks, drawing pins, staples and similar articles, of copper or of iron or steel with heads of copper' } },
  { code: '7418', description: { es: 'Articulos de uso domestico, higiene o tocador, y sus partes, de cobre; esponjas, estropajos de cobre', en: 'Table, kitchen or other household articles, sanitary ware and parts thereof, of copper' } },
  { code: '7419', description: { es: 'Las demas manufacturas de cobre', en: 'Other articles of copper' } },

  // =========================================================================
  // CHAPTER 75 - NIQUEL / NICKEL
  // =========================================================================
  { code: '7501', description: { es: 'Matas de niquel, sinters de oxidos de niquel y demas productos intermedios de la metalurgia del niquel', en: 'Nickel mattes, nickel oxide sinters and other intermediate products of nickel metallurgy' } },
  { code: '7502', description: { es: 'Niquel en bruto', en: 'Unwrought nickel' } },
  { code: '7503', description: { es: 'Desperdicios y desechos, de niquel', en: 'Nickel waste and scrap' } },
  { code: '7504', description: { es: 'Polvo y escamillas, de niquel', en: 'Nickel powders and flakes' } },
  { code: '7505', description: { es: 'Barras, perfiles y alambre, de niquel', en: 'Nickel bars, rods, profiles and wire' } },
  { code: '7506', description: { es: 'Chapas, tiras y hojas, de niquel', en: 'Nickel plates, sheets, strip and foil' } },
  { code: '7507', description: { es: 'Tubos y accesorios de tuberia, de niquel', en: 'Nickel tubes, pipes and tube or pipe fittings' } },
  { code: '7508', description: { es: 'Las demas manufacturas de niquel', en: 'Other articles of nickel' } },

  // =========================================================================
  // CHAPTER 76 - ALUMINIO / ALUMINIUM
  // =========================================================================
  { code: '7601', description: { es: 'Aluminio en bruto', en: 'Unwrought aluminium' } },
  { code: '7602', description: { es: 'Desperdicios y desechos, de aluminio', en: 'Aluminium waste and scrap' } },
  { code: '7603', description: { es: 'Polvo y escamillas, de aluminio', en: 'Aluminium powders and flakes' } },
  { code: '7604', description: { es: 'Barras y perfiles, de aluminio', en: 'Aluminium bars, rods and profiles' } },
  { code: '7605', description: { es: 'Alambre de aluminio', en: 'Aluminium wire' } },
  { code: '7606', description: { es: 'Chapas y tiras, de aluminio, de espesor > 0.2 mm', en: 'Aluminium plates, sheets and strip, of a thickness > 0.2 mm' } },
  { code: '7607', description: { es: 'Hojas y tiras, delgadas, de aluminio, de espesor <= 0.2 mm', en: 'Aluminium foil, of a thickness <= 0.2 mm' } },
  { code: '7608', description: { es: 'Tubos de aluminio', en: 'Aluminium tubes and pipes' } },
  { code: '7609', description: { es: 'Accesorios de tuberia, de aluminio', en: 'Aluminium tube or pipe fittings' } },
  { code: '7610', description: { es: 'Construcciones y sus partes, de aluminio; chapas, barras, perfiles, tubos y similares de aluminio', en: 'Aluminium structures and parts of structures; aluminium plates, rods, profiles, tubes' } },
  { code: '7611', description: { es: 'Depositos, cisternas, cubas y recipientes similares, de aluminio, > 300 l', en: 'Aluminium reservoirs, tanks, vats and similar containers, > 300 l' } },
  { code: '7612', description: { es: 'Depositos, barriles, tambores, bidones, latas, botes, cajas y recipientes similares, de aluminio, <= 300 l', en: 'Aluminium casks, drums, cans, boxes and similar containers, <= 300 l' } },
  { code: '7613', description: { es: 'Recipientes para gas comprimido o licuado, de aluminio', en: 'Aluminium containers for compressed or liquefied gas' } },
  { code: '7614', description: { es: 'Cables, trenzas y similares, de aluminio, sin aislamiento electrico', en: 'Stranded wire, cables, plaited bands and the like, of aluminium, not electrically insulated' } },
  { code: '7615', description: { es: 'Articulos de uso domestico, higiene o tocador, y sus partes, de aluminio; esponjas, estropajos de aluminio', en: 'Table, kitchen or household articles, sanitary ware and parts thereof, of aluminium' } },
  { code: '7616', description: { es: 'Las demas manufacturas de aluminio', en: 'Other articles of aluminium' } },

  // =========================================================================
  // CHAPTER 78 - PLOMO / LEAD
  // =========================================================================
  { code: '7801', description: { es: 'Plomo en bruto', en: 'Unwrought lead' } },
  { code: '7802', description: { es: 'Desperdicios y desechos, de plomo', en: 'Lead waste and scrap' } },
  { code: '7804', description: { es: 'Chapas, hojas y tiras, de plomo; polvo y escamillas de plomo', en: 'Lead plates, sheets, strip and foil; lead powders and flakes' } },
  { code: '7806', description: { es: 'Las demas manufacturas de plomo', en: 'Other articles of lead' } },

  // =========================================================================
  // CHAPTER 79 - CINC / ZINC
  // =========================================================================
  { code: '7901', description: { es: 'Cinc en bruto', en: 'Unwrought zinc' } },
  { code: '7902', description: { es: 'Desperdicios y desechos, de cinc', en: 'Zinc waste and scrap' } },
  { code: '7903', description: { es: 'Polvo y escamillas, de cinc', en: 'Zinc dust and powders and flakes' } },
  { code: '7904', description: { es: 'Barras, perfiles y alambre, de cinc', en: 'Zinc bars, rods, profiles and wire' } },
  { code: '7905', description: { es: 'Chapas, hojas y tiras, de cinc', en: 'Zinc plates, sheets, strip and foil' } },
  { code: '7907', description: { es: 'Las demas manufacturas de cinc', en: 'Other articles of zinc' } },

  // =========================================================================
  // CHAPTER 80 - ESTAÑO / TIN
  // =========================================================================
  { code: '8001', description: { es: 'Estaño en bruto', en: 'Unwrought tin' } },
  { code: '8002', description: { es: 'Desperdicios y desechos, de estaño', en: 'Tin waste and scrap' } },
  { code: '8003', description: { es: 'Barras, perfiles y alambre, de estaño', en: 'Tin bars, rods, profiles and wire' } },
  { code: '8007', description: { es: 'Las demas manufacturas de estaño', en: 'Other articles of tin' } },

  // =========================================================================
  // CHAPTER 81 - OTROS METALES COMUNES / OTHER BASE METALS
  // =========================================================================
  { code: '8101', description: { es: 'Volframio (tungsteno) y sus manufacturas, incluidos los desperdicios y desechos', en: 'Tungsten (wolfram) and articles thereof, including waste and scrap' } },
  { code: '8102', description: { es: 'Molibdeno y sus manufacturas, incluidos los desperdicios y desechos', en: 'Molybdenum and articles thereof, including waste and scrap' } },
  { code: '8103', description: { es: 'Tantalio y sus manufacturas, incluidos los desperdicios y desechos', en: 'Tantalum and articles thereof, including waste and scrap' } },
  { code: '8104', description: { es: 'Magnesio y sus manufacturas, incluidos los desperdicios y desechos', en: 'Magnesium and articles thereof, including waste and scrap' } },
  { code: '8105', description: { es: 'Matas de cobalto y demas productos intermedios de la metalurgia del cobalto; cobalto y sus manufacturas', en: 'Cobalt mattes and other intermediate products of cobalt metallurgy; cobalt and articles thereof' } },
  { code: '8106', description: { es: 'Bismuto y sus manufacturas, incluidos los desperdicios y desechos', en: 'Bismuth and articles thereof, including waste and scrap' } },
  { code: '8107', description: { es: 'Cadmio y sus manufacturas, incluidos los desperdicios y desechos', en: 'Cadmium and articles thereof, including waste and scrap' } },
  { code: '8108', description: { es: 'Titanio y sus manufacturas, incluidos los desperdicios y desechos', en: 'Titanium and articles thereof, including waste and scrap' } },
  { code: '8109', description: { es: 'Circonio y sus manufacturas, incluidos los desperdicios y desechos', en: 'Zirconium and articles thereof, including waste and scrap' } },
  { code: '8110', description: { es: 'Antimonio y sus manufacturas, incluidos los desperdicios y desechos', en: 'Antimony and articles thereof, including waste and scrap' } },
  { code: '8111', description: { es: 'Manganeso y sus manufacturas, incluidos los desperdicios y desechos', en: 'Manganese and articles thereof, including waste and scrap' } },
  { code: '8112', description: { es: 'Berilio, cromo, germanio, vanadio, galio, hafnio, indio, niobio, renio y talio, y sus manufacturas', en: 'Beryllium, chromium, germanium, vanadium, gallium, hafnium, indium, niobium, rhenium, thallium and articles thereof' } },
  { code: '8113', description: { es: 'Cermet y sus manufacturas, incluidos los desperdicios y desechos', en: 'Cermets and articles thereof, including waste and scrap' } },

  // =========================================================================
  // CHAPTER 82 - HERRAMIENTAS / TOOLS, CUTLERY
  // =========================================================================
  { code: '8201', description: { es: 'Layas, palas, azadas, picos, binaderas, horcas de labranza, rastrillos y raederas; hachas, podaderas', en: 'Hand tools: spades, shovels, mattocks, picks, hoes, forks, rakes; axes, bill hooks, pruning shears' } },
  { code: '8202', description: { es: 'Sierras de mano; hojas de sierra de todas clases', en: 'Hand saws; blades for saws of all kinds' } },
  { code: '8203', description: { es: 'Limas, escofinas, alicates, tenazas, pinzas, cizallas para metales, cortatubos, cortapernos, sacabocados', en: 'Files, rasps, pliers, pincers, tweezers, metal cutting shears, pipe-cutters, bolt croppers' } },
  { code: '8204', description: { es: 'Llaves de ajuste de mano, incluidas las llaves dinamometricas; cubos de ajuste intercambiables', en: 'Hand-operated spanners and wrenches, including torque meter wrenches; interchangeable spanner sockets' } },
  { code: '8205', description: { es: 'Herramientas de mano no expresadas en otra parte; lamparas de soldar; tornillos de banco, sargentos', en: 'Hand tools not elsewhere specified; blow lamps; vices, clamps, anvils, portable forges' } },
  { code: '8206', description: { es: 'Herramientas de dos o mas de las partidas 8202 a 8205, presentadas en juegos para venta al por menor', en: 'Tools of two or more of headings 8202 to 8205, put up in sets for retail sale' } },
  { code: '8207', description: { es: 'Utiles intercambiables para herramientas de mano o para maquinas herramienta', en: 'Interchangeable tools for hand tools or for machine-tools' } },
  { code: '8208', description: { es: 'Cuchillas y hojas cortantes, para maquinas o aparatos mecanicos', en: 'Knives and cutting blades, for machines or for mechanical appliances' } },
  { code: '8209', description: { es: 'Plaquitas, varillas, puntas y articulos similares para utiles, sin montar, de cermet', en: 'Plates, sticks, tips and the like for tools, unmounted, of cermets' } },
  { code: '8210', description: { es: 'Aparatos mecanicos accionados a mano, de peso <= 10 kg, utilizados para preparar, acondicionar o servir alimentos', en: 'Hand-operated mechanical appliances, weighing <= 10 kg, used in the preparation or serving of food' } },
  { code: '8211', description: { es: 'Cuchillos con hoja cortante o dentada, incluidas las navajas de podar, y sus hojas', en: 'Knives with cutting blades, serrated or not, including pruning knives, and blades thereof' } },
  { code: '8212', description: { es: 'Navajas y maquinillas de afeitar y sus hojas', en: 'Razors and razor blades' } },
  { code: '8213', description: { es: 'Tijeras y sus hojas', en: 'Scissors, tailors shears and similar shears, and blades therefor' } },
  { code: '8214', description: { es: 'Los demas articulos de cuchilleria; herramientas y juegos de herramientas de manicura o pedicura', en: 'Other articles of cutlery; manicure or pedicure sets and instruments' } },
  { code: '8215', description: { es: 'Cucharas, tenedores, cucharones, espumaderas, palas para tartas, cuchillos para pescado o mantequilla', en: 'Spoons, forks, ladles, skimmers, cake-servers, fish-knives, butter-knives, sugar tongs' } },

  // =========================================================================
  // CHAPTER 83 - MANUFACTURAS DIVERSAS DE METAL COMUN
  // =========================================================================
  { code: '8301', description: { es: 'Candados, cerraduras y cerrojos, de metal comun; cierres y monturas con cerradura, de metal comun; llaves', en: 'Padlocks and locks, of base metal; clasps and frames with clasps, with locks; keys for these articles' } },
  { code: '8302', description: { es: 'Guarniciones, herrajes y articulos similares, de metal comun, para muebles, puertas, escaleras, ventanas', en: 'Base metal mountings, fittings and similar articles for furniture, doors, staircases, windows' } },
  { code: '8303', description: { es: 'Cajas de caudales, puertas blindadas y compartimentos para camaras acorazadas, cofres y cajas de seguridad', en: 'Armoured or reinforced safes, strong-boxes, doors and locker for strong-rooms, cash or deed boxes' } },
  { code: '8304', description: { es: 'Clasificadores, ficheros, cajas de clasificar, bandejas de correspondencia, plumeros, sellos y articulos similares para oficina, de metal comun', en: 'Filing cabinets, card-index cabinets, paper trays, pen trays, office-stamp stands, of base metal' } },
  { code: '8305', description: { es: 'Mecanismos para encuadernacion de hojas intercambiables o para clasificadores; sujetadores para correspondencia; grapas en tiras', en: 'Fittings for loose-leaf binders or files, letter clips, staples in strips' } },
  { code: '8306', description: { es: 'Campanas, campanillas, gongos y articulos similares, no electricos, de metal comun; estatuillas y demas objetos de adorno, de metal comun', en: 'Bells, gongs and the like, non-electric, of base metal; statuettes and other ornaments, of base metal' } },
  { code: '8307', description: { es: 'Tubos flexibles de metal comun, incluso con sus accesorios', en: 'Flexible tubing of base metal, with or without fittings' } },
  { code: '8308', description: { es: 'Cierres, monturas-cierre, hebillas, hebillas-cierre, corchetes, ganchos, anillos para ojetes y articulos similares, de metal comun', en: 'Clasps, frames with clasps, buckles, buckle-clasps, hooks, eyes, eyelets, of base metal' } },
  { code: '8309', description: { es: 'Tapones y tapas, incluidas las tapas corona, tapones roscados y tapones vertedores, capsulas para botellas, de metal comun', en: 'Stoppers, caps and lids, including crown corks, screw caps and pouring stoppers, of base metal' } },
  { code: '8310', description: { es: 'Placas indicadoras, placas rotulo, placas de direcciones y placas similares, cifras, letras y signos diversos, de metal comun', en: 'Sign-plates, name-plates, address-plates and similar plates, numbers, letters and other symbols, of base metal' } },
  { code: '8311', description: { es: 'Alambres, varillas, tubos, placas, electrodos y articulos similares, de metal comun o de carburo metalico, para soldadura', en: 'Wire, rods, tubes, plates, electrodes and similar products, of base metal or of metal carbides, for soldering' } },

  // =========================================================================
  // CHAPTER 84 - MAQUINAS Y APARATOS MECANICOS / MACHINERY
  // =========================================================================
  { code: '8401', description: { es: 'Reactores nucleares; elementos combustibles sin irradiar para reactores nucleares', en: 'Nuclear reactors; fuel elements (cartridges), non-irradiated, for nuclear reactors' } },
  { code: '8402', description: { es: 'Calderas de vapor; calderas denominadas de agua sobrecalentada', en: 'Steam or other vapour generating boilers; super-heated water boilers' } },
  { code: '8403', description: { es: 'Calderas para calefaccion central, excepto las de la partida 8402', en: 'Central heating boilers, other than those of heading 8402' } },
  { code: '8404', description: { es: 'Aparatos auxiliares para las calderas de las partidas 8402 u 8403', en: 'Auxiliary plant for use with boilers of heading 8402 or 8403' } },
  { code: '8405', description: { es: 'Generadores de gas pobre o de gas de agua; generadores de acetileno y generadores similares de gas', en: 'Producer gas or water gas generators; acetylene gas generators and similar water process gas generators' } },
  { code: '8406', description: { es: 'Turbinas de vapor', en: 'Steam turbines and other vapour turbines' } },
  { code: '8407', description: { es: 'Motores de embolo alternativo o rotativo, de encendido por chispa', en: 'Spark-ignition reciprocating or rotary internal combustion piston engines' } },
  { code: '8408', description: { es: 'Motores de embolo de encendido por compresion (motores diesel o semi-diesel)', en: 'Compression-ignition internal combustion piston engines (diesel or semi-diesel engines)' } },
  { code: '8409', description: { es: 'Partes identificables como destinadas a los motores de las partidas 8407 u 8408', en: 'Parts suitable for use solely or principally with the engines of heading 8407 or 8408' } },
  { code: '8410', description: { es: 'Turbinas hidraulicas, ruedas hidraulicas y sus reguladores', en: 'Hydraulic turbines, water wheels, and regulators therefor' } },
  { code: '8411', description: { es: 'Turborreactores, turbopropulsores y demas turbinas de gas', en: 'Turbo-jets, turbo-propellers and other gas turbines' } },
  { code: '8412', description: { es: 'Los demas motores y maquinas motrices', en: 'Other engines and motors' } },
  { code: '8413', description: { es: 'Bombas para liquidos, incluso con dispositivo medidor incorporado; elevadores de liquidos', en: 'Pumps for liquids, whether or not fitted with a measuring device; liquid elevators' } },
  { code: '8414', description: { es: 'Bombas de aire o de vacio, compresores y ventiladores; campanas aspirantes para extraccion o reciclado', en: 'Air or vacuum pumps, compressors and fans; ventilating or recycling hoods' } },
  { code: '8415', description: { es: 'Maquinas y aparatos para acondicionamiento de aire', en: 'Air conditioning machines' } },
  { code: '8416', description: { es: 'Quemadores para la alimentacion de hogares, de combustibles liquidos, pulverizados o de gas', en: 'Furnace burners for liquid fuel, pulverised solid fuel or gas' } },
  { code: '8417', description: { es: 'Hornos industriales o de laboratorio, incluidos los incineradores, que no sean electricos', en: 'Industrial or laboratory furnaces and ovens, including incinerators, non-electric' } },
  { code: '8418', description: { es: 'Refrigeradores, congeladores y demas material, maquinas y aparatos para produccion de frio', en: 'Refrigerators, freezers and other refrigerating or freezing equipment' } },
  { code: '8419', description: { es: 'Aparatos y dispositivos para tratamiento de materias mediante operaciones que impliquen un cambio de temperatura', en: 'Machinery, plant or equipment for the treatment of materials by a process involving a change of temperature' } },
  { code: '8420', description: { es: 'Calandrias y laminadores, excepto para metales o vidrio, y cilindros para estas maquinas', en: 'Calendering or other rolling machines, other than for metals or glass, and cylinders therefor' } },
  { code: '8421', description: { es: 'Centrifugadoras, incluidas las secadoras centrifugas; aparatos para filtrar o depurar liquidos o gases', en: 'Centrifuges, including centrifugal dryers; filtering or purifying machinery for liquids or gases' } },
  { code: '8422', description: { es: 'Maquinas para lavar vajilla; maquinas y aparatos para limpiar, secar, llenar, cerrar, etiquetar o capsular botellas', en: 'Dish washing machines; machinery for cleaning, drying, filling, closing, sealing, labelling bottles' } },
  { code: '8423', description: { es: 'Aparatos e instrumentos de pesar, incluidas las basculas y balanzas para verificar piezas fabricadas', en: 'Weighing machinery, including weight-operated counting or checking machines' } },
  { code: '8424', description: { es: 'Aparatos mecanicos para proyectar, dispersar o pulverizar materias liquidas o en polvo; extintores; pistolas aerograficas', en: 'Mechanical appliances for projecting, dispersing or spraying liquids or powders; fire extinguishers; spray guns' } },
  { code: '8425', description: { es: 'Polipastos; tornos y cabrestantes; gatos', en: 'Pulley tackle and hoists; winches and capstans; jacks' } },
  { code: '8426', description: { es: 'Gruas y aparatos de elevacion sobre cable aereo; puentes rodantes, porticos de descarga o manipulacion', en: 'Ships derricks; cranes; mobile lifting frames; straddle carriers; gantry cranes' } },
  { code: '8427', description: { es: 'Carretillas apiladoras; las demas carretillas de manipulacion con dispositivo de elevacion', en: 'Fork-lift trucks; other works trucks fitted with lifting or handling equipment' } },
  { code: '8428', description: { es: 'Las demas maquinas y aparatos de elevacion, carga, descarga o manipulacion', en: 'Other lifting, handling, loading or unloading machinery' } },
  { code: '8429', description: { es: 'Topadoras frontales, angulares, niveladoras, traillas, palas mecanicas, excavadoras, cargadoras y palas cargadoras, compactadoras y apisonadoras, autopropulsadas', en: 'Self-propelled bulldozers, angledozers, graders, levellers, scrapers, mechanical shovels, excavators, shovel loaders' } },
  { code: '8430', description: { es: 'Las demas maquinas y aparatos para explanar, nivelar, traillar, excavar, compactar, apisonar, extraer o perforar tierra o minerales', en: 'Other moving, grading, levelling, scraping, excavating, tamping, compacting, extracting or boring machinery' } },
  { code: '8431', description: { es: 'Partes identificables como destinadas a las maquinas o aparatos de las partidas 8425 a 8430', en: 'Parts suitable for use with the machinery of headings 8425 to 8430' } },
  { code: '8432', description: { es: 'Maquinas, aparatos y artefactos agricolas, horticolas o silvicolas, para la preparacion o el trabajo del suelo', en: 'Agricultural, horticultural or forestry machinery for soil preparation or cultivation' } },
  { code: '8433', description: { es: 'Maquinas, aparatos y artefactos de cosechar o trillar; cortadoras de cesped y guadañadoras', en: 'Harvesting or threshing machinery; straw or fodder balers; grass or hay mowers' } },
  { code: '8434', description: { es: 'Maquinas de ordeñar y maquinas y aparatos para la industria lechera', en: 'Milking machines and dairy machinery' } },
  { code: '8435', description: { es: 'Prensas, estrujadoras y maquinas y aparatos analogos para la produccion de vino, sidra, jugos de fruta o bebidas similares', en: 'Presses, crushers and similar machinery used in the manufacture of wine, cider, fruit juices' } },
  { code: '8436', description: { es: 'Las demas maquinas y aparatos para la agricultura, horticultura, silvicultura, avicultura o apicultura', en: 'Other agricultural, horticultural, forestry, poultry-keeping or bee-keeping machinery' } },
  { code: '8437', description: { es: 'Maquinas para limpieza, clasificacion o cribado de semillas, granos u hortalizas de vaina secas', en: 'Machines for cleaning, sorting or grading seed, grain or dried leguminous vegetables' } },
  { code: '8438', description: { es: 'Maquinas y aparatos para la preparacion o fabricacion industrial de alimentos o bebidas', en: 'Machinery for the industrial preparation or manufacture of food or drink' } },
  { code: '8439', description: { es: 'Maquinas y aparatos para la fabricacion de pasta de materias fibrosas celulosicas o para la fabricacion de papel o carton', en: 'Machinery for making pulp of fibrous cellulosic material or for making or finishing paper or paperboard' } },
  { code: '8440', description: { es: 'Maquinas y aparatos para encuadernacion, incluidas las maquinas para coser pliegos', en: 'Book-binding machinery, including book-sewing machines' } },
  { code: '8441', description: { es: 'Las demas maquinas y aparatos para el trabajo de la pasta de papel, del papel o del carton', en: 'Other machinery for making up paper pulp, paper or paperboard' } },
  { code: '8442', description: { es: 'Maquinas, aparatos y material para preparar o fabricar cliches, planchas, cilindros o demas elementos impresores', en: 'Machinery for preparing or making printing blocks, plates, cylinders or other printing components' } },
  { code: '8443', description: { es: 'Maquinas y aparatos para imprimir; maquinas y aparatos auxiliares de imprimir; impresoras, copiadoras y aparatos de fax', en: 'Printing machinery; printers, copying machines and facsimile machines' } },
  { code: '8444', description: { es: 'Maquinas para extrudir, estirar, texturar o cortar materias textiles sinteticas o artificiales', en: 'Machines for extruding, drawing, texturing or cutting man-made textile materials' } },
  { code: '8445', description: { es: 'Maquinas para la preparacion de materias textiles; maquinas para hilar, doblar o retorcer', en: 'Machines for preparing textile fibres; spinning, doubling or twisting machines' } },
  { code: '8446', description: { es: 'Telares', en: 'Weaving machines (looms)' } },
  { code: '8447', description: { es: 'Maquinas de tricotar, de coser por cadeneta, de entorchar, de fabricar tul, encaje, bordados, pasamaneria, trenzas', en: 'Knitting machines, stitch-bonding machines and machines for making gimped yarn, tulle, lace, embroidery' } },
  { code: '8448', description: { es: 'Maquinas y aparatos auxiliares para las maquinas de las partidas 8444 a 8447', en: 'Auxiliary machinery for use with machines of headings 8444 to 8447' } },
  { code: '8449', description: { es: 'Maquinas y aparatos para la fabricacion o acabado del fieltro o tela sin tejer', en: 'Machinery for the manufacture or finishing of felt or nonwovens' } },
  { code: '8450', description: { es: 'Maquinas para lavar ropa, incluso con dispositivo de secado', en: 'Household or laundry-type washing machines, including machines which both wash and dry' } },
  { code: '8451', description: { es: 'Maquinas y aparatos para lavar, limpiar, escurrir, secar, planchar, prensar o teñir materias textiles', en: 'Machinery for washing, cleaning, wringing, drying, ironing, pressing or dyeing textile fabrics' } },
  { code: '8452', description: { es: 'Maquinas de coser, excepto las de coser pliegos de la partida 8440; muebles, basamentos y tapas para maquinas de coser', en: 'Sewing machines, other than book-sewing machines of heading 8440; furniture, bases and covers for sewing machines' } },
  { code: '8453', description: { es: 'Maquinas y aparatos para la preparacion, curtido o trabajo de cueros o pieles o para la fabricacion o reparacion de calzado', en: 'Machinery for preparing, tanning or working hides, skins or leather or for making or repairing footwear' } },
  { code: '8454', description: { es: 'Convertidores, cucharas de colada, lingoteras y maquinas de colar para metalurgia, aceria o fundicion', en: 'Converters, ladles, ingot moulds and casting machines, for metallurgy, steelmaking or foundries' } },
  { code: '8455', description: { es: 'Laminadores para metales y sus cilindros', en: 'Metal-rolling mills and rolls therefor' } },
  { code: '8456', description: { es: 'Maquinas herramienta que trabajen por arranque de cualquier materia mediante laser u otros haces de luz o fotones, ultrasonido, electroerosion', en: 'Machine-tools for working any material by removal, by laser, ultrasonic, electro-discharge, electro-chemical' } },
  { code: '8457', description: { es: 'Centros de mecanizado, maquinas de puesto fijo y maquinas de puestos multiples, para trabajar metales', en: 'Machining centres, unit construction machines and multi-station transfer machines, for working metal' } },
  { code: '8458', description: { es: 'Tornos que trabajen por arranque de metal', en: 'Lathes for removing metal' } },
  { code: '8459', description: { es: 'Maquinas de taladrar, escariar, fresar o roscar, metal, excepto los tornos de la partida 8458', en: 'Machine-tools for drilling, boring, milling, threading or tapping metal' } },
  { code: '8460', description: { es: 'Maquinas de desbarbar, afilar, amolar, rectificar, lapear, pulir o hacer otras operaciones de acabado', en: 'Machine-tools for deburring, sharpening, grinding, honing, lapping, polishing, for working metal' } },
  { code: '8461', description: { es: 'Maquinas de cepillar, limar, mortajar, brochar, tallar engranajes, aserrar, trocear, para trabajar metales', en: 'Machine-tools for planing, shaping, slotting, broaching, gear cutting, sawing, for working metal' } },
  { code: '8462', description: { es: 'Maquinas herramienta de forjar o estampar, martillos pilon y martinetes; maquinas herramienta de curvar, plegar, enderezar, cizallar, punzonar', en: 'Machine-tools for forging, hammering, die-stamping; for bending, folding, straightening, shearing, punching metal' } },
  { code: '8463', description: { es: 'Las demas maquinas herramienta para trabajar metales o cermet, que no trabajen por arranque de materia', en: 'Other machine-tools for working metal or cermets, without removing material' } },
  { code: '8464', description: { es: 'Maquinas herramienta para trabajar piedra, productos ceramicos, hormigon, amiantocemento o materias minerales similares, o para trabajar el vidrio en frio', en: 'Machine-tools for working stone, ceramics, concrete, asbestos-cement, or for cold working glass' } },
  { code: '8465', description: { es: 'Maquinas herramienta para trabajar madera, corcho, hueso, caucho endurecido, plasticos duros o materias duras similares', en: 'Machine-tools for working wood, cork, bone, hard rubber, hard plastics or similar hard materials' } },
  { code: '8466', description: { es: 'Partes y accesorios identificables como destinados a las maquinas de las partidas 8456 a 8465', en: 'Parts and accessories for the machine-tools of headings 8456 to 8465' } },
  { code: '8467', description: { es: 'Herramientas neumaticas, hidraulicas o con motor incorporado, incluso electrico, de uso manual', en: 'Tools for working in the hand, pneumatic, hydraulic or with self-contained electric or non-electric motor' } },
  { code: '8468', description: { es: 'Maquinas y aparatos para soldar, aunque puedan cortar, excepto los de la partida 8515; maquinas y aparatos de gas', en: 'Machinery and apparatus for soldering, brazing or welding; gas-operated surface tempering machines' } },
  { code: '8469', description: { es: 'Maquinas de escribir, excepto las impresoras de la partida 8443; maquinas para tratamiento o procesamiento de textos', en: 'Typewriters other than printers of heading 8443; word-processing machines' } },
  { code: '8470', description: { es: 'Maquinas de calcular y maquinas de bolsillo registradoras, reproductoras y visualizadoras de datos, con funcion de calculo', en: 'Calculating machines and pocket-size data recording, reproducing and displaying machines with calculating functions' } },
  { code: '8471', description: { es: 'Maquinas automaticas para tratamiento o procesamiento de datos y sus unidades; lectores magneticos u opticos', en: 'Automatic data-processing machines and units thereof; magnetic or optical readers' } },
  { code: '8472', description: { es: 'Las demas maquinas y aparatos de oficina', en: 'Other office machines' } },
  { code: '8473', description: { es: 'Partes y accesorios de maquinas de las partidas 8470 a 8472', en: 'Parts and accessories of machines of headings 8470 to 8472' } },
  { code: '8474', description: { es: 'Maquinas y aparatos de clasificar, cribar, separar, lavar, quebrantar, triturar, mezclar materias minerales solidas', en: 'Machinery for sorting, screening, separating, washing, crushing, grinding, mixing mineral substances' } },
  { code: '8475', description: { es: 'Maquinas para montar lamparas, tubos o valvulas electricos o electronicos o lamparas de destello', en: 'Machines for assembling electric or electronic lamps, tubes or valves or flashbulbs' } },
  { code: '8476', description: { es: 'Maquinas automaticas para la venta de productos', en: 'Automatic goods-vending machines' } },
  { code: '8477', description: { es: 'Maquinas y aparatos para trabajar caucho o plastico o para fabricar productos de estas materias', en: 'Machinery for working rubber or plastics or for the manufacture of products from these materials' } },
  { code: '8478', description: { es: 'Maquinas y aparatos para preparar o elaborar tabaco', en: 'Machinery for preparing or making up tobacco' } },
  { code: '8479', description: { es: 'Maquinas y aparatos mecanicos con funcion propia, no expresados ni comprendidos en otra parte de este capitulo', en: 'Machines and mechanical appliances having individual functions, not elsewhere specified in this chapter' } },
  { code: '8480', description: { es: 'Cajas de fundicion; placas de fondo para moldes; modelos para moldes; moldes para metal, carburos metalicos, vidrio, materia mineral, caucho o plastico', en: 'Moulding boxes for metal foundry; mould bases; moulding patterns; moulds for metal, glass, mineral, rubber or plastics' } },
  { code: '8481', description: { es: 'Articulos de griferia y organos similares para tuberias, calderas, depositos, cubas o continentes analogos', en: 'Taps, cocks, valves and similar appliances for pipes, boiler shells, tanks, vats' } },
  { code: '8482', description: { es: 'Rodamientos de bolas, de rodillos o de agujas', en: 'Ball or roller bearings' } },
  { code: '8483', description: { es: 'Arboles de transmision, incluidos los de levas y los cigueñales, y manivelas; cajas de cojinetes y cojinetes; engranajes; husillos fileteados de bolas o rodillos; reductores, multiplicadores y variadores de velocidad', en: 'Transmission shafts, cranks; bearing housings; gears and gearing; ball or roller screws; gear boxes; flywheels' } },
  { code: '8484', description: { es: 'Juntas metaloplasticas; juegos o surtidos de juntas de distinta composicion', en: 'Gaskets and similar joints of metal sheeting; sets or assortments of gaskets' } },
  { code: '8486', description: { es: 'Maquinas y aparatos utilizados exclusiva o principalmente para la fabricacion de semiconductores', en: 'Machines and apparatus used solely or principally for the manufacture of semiconductor devices' } },
  { code: '8487', description: { es: 'Partes de maquinas o aparatos, no expresadas ni comprendidas en otra parte de este capitulo, sin conexiones electricas', en: 'Machinery parts, not elsewhere specified in this chapter, not containing electrical connectors' } },

  // =========================================================================
  // CHAPTER 85 - MAQUINAS Y APARATOS ELECTRICOS / ELECTRICAL MACHINERY
  // =========================================================================
  { code: '8501', description: { es: 'Motores y generadores electricos, excepto los grupos electrogenos', en: 'Electric motors and generators, excluding generating sets' } },
  { code: '8502', description: { es: 'Grupos electrogenos y convertidores rotativos electricos', en: 'Electric generating sets and rotary converters' } },
  { code: '8503', description: { es: 'Partes identificables como destinadas a las maquinas de las partidas 8501 u 8502', en: 'Parts suitable for use with the machines of heading 8501 or 8502' } },
  { code: '8504', description: { es: 'Transformadores electricos, convertidores electricos estaticos y bobinas de reactancia', en: 'Electrical transformers, static converters and inductors' } },
  { code: '8505', description: { es: 'Electroimanes; imanes permanentes y articulos destinados a ser imantados permanentemente; platos, mandriles y dispositivos magneticos similares de sujecion; acoplamientos, embragues, variadores de velocidad y frenos, electromagneticos; cabezas elevadoras electromagneticas', en: 'Electromagnets; permanent magnets; magnetic chucks; electromagnetic couplings, clutches and brakes; electromagnetic lifting heads' } },
  { code: '8506', description: { es: 'Pilas y baterias de pilas, electricas', en: 'Primary cells and primary batteries' } },
  { code: '8507', description: { es: 'Acumuladores electricos, incluidos sus separadores, aunque sean cuadrados o rectangulares', en: 'Electric accumulators, including separators therefor' } },
  { code: '8508', description: { es: 'Aspiradoras', en: 'Vacuum cleaners' } },
  { code: '8509', description: { es: 'Aparatos electromecanicos con motor electrico incorporado, de uso domestico, excepto las aspiradoras de la partida 8508', en: 'Electro-mechanical domestic appliances, with self-contained electric motor, other than vacuum cleaners' } },
  { code: '8510', description: { es: 'Afeitadoras, maquinas de cortar el pelo o esquilar y aparatos de depilar, con motor electrico incorporado', en: 'Shavers, hair clippers and hair-removing appliances, with self-contained electric motor' } },
  { code: '8511', description: { es: 'Aparatos y dispositivos electricos de encendido o de arranque para motores de encendido por chispa o por compresion; generadores y reguladores de conjuncion utilizados con estos motores', en: 'Electrical ignition or starting equipment for spark-ignition or compression-ignition engines; generators and cut-outs' } },
  { code: '8512', description: { es: 'Aparatos electricos de alumbrado o señalizacion, limpiaparabrisas, eliminadores de escarcha o vaho electricos, del tipo de los utilizados en velocipedos o vehiculos automoviles', en: 'Electrical lighting or signalling equipment, windscreen wipers, defrosters and demisters, for cycles or motor vehicles' } },
  { code: '8513', description: { es: 'Lamparas electricas portatiles concebidas para funcionar con su propia fuente de energia', en: 'Portable electric lamps designed to function by their own source of energy' } },
  { code: '8514', description: { es: 'Hornos electricos industriales o de laboratorio, incluidos los que funcionan por induccion o por perdidas dielectricas', en: 'Industrial or laboratory electric furnaces and ovens; induction or dielectric heating equipment' } },
  { code: '8515', description: { es: 'Maquinas y aparatos para soldar (aunque puedan cortar), electricos', en: 'Electric brazing or soldering machines and apparatus; electric machines for hot spraying of metals or cermets' } },
  { code: '8516', description: { es: 'Calentadores electricos de agua; aparatos electricos para calefaccion; aparatos electrotermos para el cuidado del cabello; planchas electricas; los demas aparatos electrotermos de uso domestico; resistencias calentadoras', en: 'Electric instantaneous or storage water heaters; electric space-heating apparatus; electro-thermic hair-dressing apparatus; electric smoothing irons; other electro-thermic domestic appliances; heating resistors' } },
  { code: '8517', description: { es: 'Telefonos, incluidos los telefonos moviles (celulares) y los de otras redes inalambricas; los demas aparatos de emision, transmision o recepcion de voz, imagen u otros datos', en: 'Telephone sets, including smartphones and other wireless network telephones; other apparatus for transmission or reception of voice, images or other data' } },
  { code: '8518', description: { es: 'Microfonos y sus soportes; altavoces; auriculares; amplificadores electricos de audiofrecuencia; equipos electricos para amplificacion de sonido', en: 'Microphones and stands therefor; loudspeakers; headphones, earphones; audio-frequency electric amplifiers; electric sound amplifier sets' } },
  { code: '8519', description: { es: 'Aparatos de grabacion de sonido; aparatos de reproduccion de sonido; aparatos de grabacion y reproduccion de sonido', en: 'Sound recording or sound reproducing apparatus' } },
  { code: '8521', description: { es: 'Aparatos de grabacion o reproduccion de imagen y sonido (videos), incluso con receptor de señales de imagen y sonido incorporado', en: 'Video recording or reproducing apparatus, whether or not incorporating a video tuner' } },
  { code: '8522', description: { es: 'Partes y accesorios identificables como destinados a los aparatos de las partidas 8519 u 8521', en: 'Parts and accessories suitable for use with the apparatus of headings 8519 or 8521' } },
  { code: '8523', description: { es: 'Discos, cintas, dispositivos de almacenamiento permanente de datos a base de semiconductores, tarjetas inteligentes y demas soportes para grabacion de sonido o grabaciones analogas', en: 'Discs, tapes, solid-state non-volatile storage devices, smart cards and other media for the recording of sound or of other phenomena' } },
  { code: '8524', description: { es: 'Modulos de visualizacion de pantalla plana, incluidos los que incorporen pantallas tactiles', en: 'Flat panel display modules, whether or not incorporating touch-sensitive screens' } },
  { code: '8525', description: { es: 'Aparatos emisores de radiodifusion o television, incluso con aparato receptor o de grabacion o reproduccion de sonido incorporado; camaras de television, camaras digitales y camaras de video', en: 'Transmission apparatus for radio-broadcasting or television; television cameras, digital cameras and video camera recorders' } },
  { code: '8526', description: { es: 'Aparatos de radar, radionavegacion o radiotelemando', en: 'Radar apparatus, radio navigational aid apparatus and radio remote control apparatus' } },
  { code: '8527', description: { es: 'Aparatos receptores de radiodifusion, incluso combinados con grabador o reproductor de sonido o con reloj', en: 'Reception apparatus for radio-broadcasting, whether or not combined with sound recording or reproducing apparatus or a clock' } },
  { code: '8528', description: { es: 'Monitores y proyectores que no incorporen aparato receptor de television; aparatos receptores de television', en: 'Monitors and projectors, not incorporating television reception apparatus; television receivers' } },
  { code: '8529', description: { es: 'Partes identificables como destinadas a los aparatos de las partidas 8524 a 8528', en: 'Parts suitable for use solely or principally with the apparatus of headings 8524 to 8528' } },
  { code: '8530', description: { es: 'Aparatos electricos de señalizacion, seguridad, control o mando, para vias ferreas o similares, carreteras, vias fluviales, areas o parques de estacionamiento, instalaciones portuarias o aeropuertos', en: 'Electrical signalling, safety or traffic control equipment for railways, tramways, roads, waterways, parking facilities, port installations or airfields' } },
  { code: '8531', description: { es: 'Aparatos electricos de señalizacion acustica o visual', en: 'Electric sound or visual signalling apparatus' } },
  { code: '8532', description: { es: 'Condensadores electricos, fijos, variables o ajustables', en: 'Electrical capacitors, fixed, variable or adjustable' } },
  { code: '8533', description: { es: 'Resistencias electricas, excepto las de calentamiento, incluidos los reostatos y los potenciometros', en: 'Electrical resistors, including rheostats and potentiometers, other than heating resistors' } },
  { code: '8534', description: { es: 'Circuitos impresos', en: 'Printed circuits' } },
  { code: '8535', description: { es: 'Aparatos para corte, seccionamiento, proteccion, derivacion, empalme o conexion de circuitos electricos para una tension > 1.000 V', en: 'Electrical apparatus for switching or protecting electrical circuits, for > 1,000 V' } },
  { code: '8536', description: { es: 'Aparatos para corte, seccionamiento, proteccion, derivacion, empalme o conexion de circuitos electricos para una tension <= 1.000 V; conectores para fibras opticas', en: 'Electrical apparatus for switching or protecting electrical circuits, for <= 1,000 V; connectors for optical fibres' } },
  { code: '8537', description: { es: 'Cuadros, paneles, consolas, armarios y demas soportes equipados con varios aparatos de las partidas 8535 u 8536', en: 'Boards, panels, consoles, desks, cabinets equipped with apparatus of heading 8535 or 8536' } },
  { code: '8538', description: { es: 'Partes identificables como destinadas a los aparatos de las partidas 8535, 8536 u 8537', en: 'Parts suitable for use with the apparatus of heading 8535, 8536 or 8537' } },
  { code: '8539', description: { es: 'Lamparas y tubos electricos de incandescencia o de descarga, incluidos los faros o unidades sellados y las lamparas y tubos de rayos ultravioletas o infrarrojos; lamparas de arco; fuentes luminosas de diodos emisores de luz (LED)', en: 'Electric filament or discharge lamps; arc-lamps; light-emitting diode (LED) light sources' } },
  { code: '8540', description: { es: 'Lamparas, tubos y valvulas electronicos, de catodo caliente, de catodo frio o de fotocatodo', en: 'Thermionic, cold cathode or photo-cathode valves and tubes' } },
  { code: '8541', description: { es: 'Dispositivos semiconductores; diodos emisores de luz; celulas fotovoltaicas', en: 'Semiconductor devices; light-emitting diodes; photovoltaic cells' } },
  { code: '8542', description: { es: 'Circuitos integrados electronicos', en: 'Electronic integrated circuits' } },
  { code: '8543', description: { es: 'Maquinas y aparatos electricos con funcion propia, no expresados ni comprendidos en otra parte de este capitulo', en: 'Electrical machines and apparatus, having individual functions, not elsewhere specified in this chapter' } },
  { code: '8544', description: { es: 'Hilos, cables, incluidos los coaxiales, y demas conductores aislados para electricidad; cables de fibras opticas', en: 'Insulated wire, cable and other insulated electric conductors; optical fibre cables' } },
  { code: '8545', description: { es: 'Electrodos y escobillas de carbon, carbones para lamparas o pilas y demas articulos de grafito u otros carbonos', en: 'Carbon electrodes, carbon brushes, lamp carbons, battery carbons and other articles of graphite or other carbon' } },
  { code: '8546', description: { es: 'Aisladores electricos de cualquier materia', en: 'Electrical insulators of any material' } },
  { code: '8547', description: { es: 'Piezas aislantes totalmente de materia aislante o con simples piezas metalicas de ensamblado embutidas en la masa', en: 'Insulating fittings for electrical machines, appliances or equipment' } },
  { code: '8548', description: { es: 'Desperdicios y desechos de pilas, de baterias de pilas o de acumuladores electricos; pilas, baterias de pilas y acumuladores electricos inservibles', en: 'Waste and scrap of primary cells, batteries and electric accumulators; spent primary cells and batteries' } },
  { code: '8549', description: { es: 'Desperdicios y desechos electricos y electronicos', en: 'Electrical and electronic waste and scrap' } },

  // =========================================================================
  // CHAPTER 86 - VEHICULOS Y MATERIAL PARA VIAS FERREAS / RAILWAY
  // =========================================================================
  { code: '8601', description: { es: 'Locomotoras y locotractores, de fuente externa de electricidad o de acumuladores electricos', en: 'Rail locomotives powered from an external source of electricity or by electric accumulators' } },
  { code: '8602', description: { es: 'Las demas locomotoras y locotractores; tenderes', en: 'Other rail locomotives; locomotive tenders' } },
  { code: '8603', description: { es: 'Automotores para vias ferreas y tranvias autopropulsados, excepto los de la partida 8604', en: 'Self-propelled railway or tramway coaches, vans and trucks, other than those of heading 8604' } },
  { code: '8604', description: { es: 'Vehiculos para mantenimiento o servicio de vias ferreas o similares, incluso autopropulsados', en: 'Railway or tramway maintenance or service vehicles, whether or not self-propelled' } },
  { code: '8605', description: { es: 'Coches de viajeros, furgones de equipajes, coches correo y demas coches especiales, para vias ferreas o similares', en: 'Railway or tramway passenger coaches; luggage vans, post office coaches and other special purpose coaches' } },
  { code: '8606', description: { es: 'Vagones para el transporte de mercancias por vias ferreas', en: 'Railway or tramway goods vans and wagons, not self-propelled' } },
  { code: '8607', description: { es: 'Partes de vehiculos para vias ferreas o similares', en: 'Parts of railway or tramway locomotives or rolling-stock' } },
  { code: '8608', description: { es: 'Material fijo de vias ferreas o similares; aparatos mecanicos de señalizacion, seguridad, control o mando para vias ferreas', en: 'Railway or tramway track fixtures and fittings; mechanical signalling, safety or traffic control equipment' } },
  { code: '8609', description: { es: 'Contenedores, incluidos los contenedores cisterna y los contenedores deposito, especialmente concebidos y equipados para uno o varios medios de transporte', en: 'Containers, including containers for the transport of fluids, specially designed for carriage by one or more modes of transport' } },

  // =========================================================================
  // CHAPTER 87 - VEHICULOS AUTOMOVILES / VEHICLES
  // =========================================================================
  { code: '8701', description: { es: 'Tractores, excepto las carretillas tractor de la partida 8709', en: 'Tractors, other than tractors of heading 8709' } },
  { code: '8702', description: { es: 'Vehiculos automoviles para el transporte de diez o mas personas, incluido el conductor', en: 'Motor vehicles for the transport of ten or more persons, including the driver' } },
  { code: '8703', description: { es: 'Automoviles de turismo y demas vehiculos automoviles concebidos principalmente para el transporte de personas', en: 'Motor cars and other motor vehicles principally designed for the transport of persons' } },
  { code: '8704', description: { es: 'Vehiculos automoviles para el transporte de mercancias', en: 'Motor vehicles for the transport of goods' } },
  { code: '8705', description: { es: 'Vehiculos automoviles para usos especiales, excepto los concebidos principalmente para el transporte de personas o mercancias', en: 'Special purpose motor vehicles, other than those principally designed for the transport of persons or goods' } },
  { code: '8706', description: { es: 'Chasis de vehiculos automoviles de las partidas 8701 a 8705, equipados con su motor', en: 'Chassis fitted with engines, for the motor vehicles of headings 8701 to 8705' } },
  { code: '8707', description: { es: 'Carrocerias de vehiculos automoviles de las partidas 8701 a 8705, incluidas las cabinas', en: 'Bodies, including cabs, for the motor vehicles of headings 8701 to 8705' } },
  { code: '8708', description: { es: 'Partes y accesorios de vehiculos automoviles de las partidas 8701 a 8705', en: 'Parts and accessories of the motor vehicles of headings 8701 to 8705' } },
  { code: '8709', description: { es: 'Carretillas automovil sin dispositivo de elevacion de los tipos utilizados en fabricas, almacenes, puertos o aeropuertos', en: 'Works trucks, self-propelled, not fitted with lifting or handling equipment, used in factories, warehouses' } },
  { code: '8710', description: { es: 'Tanques y demas vehiculos automoviles blindados de combate, incluso con armamento; sus partes', en: 'Tanks and other armoured fighting vehicles, motorised, whether or not fitted with weapons; parts thereof' } },
  { code: '8711', description: { es: 'Motocicletas, incluidos los ciclomotores, y velocipedos equipados con motor auxiliar, con sidecar o sin el; sidecares', en: 'Motorcycles, including mopeds, and cycles fitted with an auxiliary motor, with or without side-cars; side-cars' } },
  { code: '8712', description: { es: 'Bicicletas y demas velocipedos, incluidos los triciclos de reparto, sin motor', en: 'Bicycles and other cycles, including delivery tricycles, not motorised' } },
  { code: '8713', description: { es: 'Sillones de ruedas y demas vehiculos para invalidos, incluso con motor u otro mecanismo de propulsion', en: 'Carriages for disabled persons, whether or not motorised or otherwise mechanically propelled' } },
  { code: '8714', description: { es: 'Partes y accesorios de vehiculos de las partidas 8711 a 8713', en: 'Parts and accessories of vehicles of headings 8711 to 8713' } },
  { code: '8715', description: { es: 'Coches, sillas y vehiculos similares para el transporte de niños, y sus partes', en: 'Baby carriages and parts thereof' } },
  { code: '8716', description: { es: 'Remolques y semirremolques para cualquier vehiculo; los demas vehiculos no automoviles; sus partes', en: 'Trailers and semi-trailers; other vehicles, not mechanically propelled; parts thereof' } },

  // =========================================================================
  // CHAPTER 88 - AERONAVES / AIRCRAFT
  // =========================================================================
  { code: '8801', description: { es: 'Globos y dirigibles; planeadores, alas planeadoras y demas aeronaves, no propulsados con motor', en: 'Balloons and dirigibles; gliders, hang gliders and other non-powered aircraft' } },
  { code: '8802', description: { es: 'Las demas aeronaves (por ejemplo: helicopteros, aviones); vehiculos espaciales, incluidos los satelites, y sus vehiculos de lanzamiento y vehiculos suborbitales', en: 'Other aircraft; spacecraft, including satellites, and suborbital and spacecraft launch vehicles' } },
  { code: '8803', description: { es: 'Partes de los aparatos de las partidas 8801 u 8802', en: 'Parts of goods of heading 8801 or 8802' } },
  { code: '8804', description: { es: 'Paracaidas, incluidos los paracaidas dirigibles, parapentes y los rotochutes; sus partes y accesorios', en: 'Parachutes, including dirigible parachutes, paragliders and rotochutes; parts thereof and accessories thereto' } },
  { code: '8805', description: { es: 'Aparatos y dispositivos para lanzamiento de aeronaves; aparatos y dispositivos para aterrizaje en portaaviones; simuladores de vuelo en tierra; sus partes', en: 'Aircraft launching gear; deck-arrestor gear; ground flying trainers; parts thereof' } },
  { code: '8806', description: { es: 'Aeronaves no tripuladas', en: 'Unmanned aircraft' } },
  { code: '8807', description: { es: 'Partes de los aparatos de las partidas 8801, 8802 u 8806', en: 'Parts of goods of heading 8801, 8802 or 8806' } },

  // =========================================================================
  // CHAPTER 89 - BARCOS / SHIPS, BOATS
  // =========================================================================
  { code: '8901', description: { es: 'Transatlanticos, barcos para excursiones, transbordadores, cargueros, gabarras y barcos similares para el transporte de personas o mercancias', en: 'Cruise ships, excursion boats, ferry-boats, cargo ships, barges and similar vessels for the transport of persons or goods' } },
  { code: '8902', description: { es: 'Barcos de pesca; barcos factoria y demas barcos para el tratamiento o la preparacion de conservas de productos de la pesca', en: 'Fishing vessels; factory ships and other vessels for processing or preserving fishery products' } },
  { code: '8903', description: { es: 'Yates y demas barcos y embarcaciones de recreo o deporte; barcas de remo y canoas', en: 'Yachts and other vessels for pleasure or sports; rowing boats and canoes' } },
  { code: '8904', description: { es: 'Remolcadores y barcos empujadores', en: 'Tugs and pusher craft' } },
  { code: '8905', description: { es: 'Barcos faro, barcos bomba, dragas, pontones grua y demas barcos en los que la navegacion sea accesoria', en: 'Light-vessels, fire-floats, dredgers, floating cranes, and other vessels for which navigating is subsidiary' } },
  { code: '8906', description: { es: 'Los demas barcos, incluidos los navios de guerra y los barcos de salvamento, excepto los barcos de remo', en: 'Other vessels, including warships and lifeboats other than rowing boats' } },
  { code: '8907', description: { es: 'Las demas estructuras flotantes (por ejemplo: balsas, depositos, cajones, incluso de amarre, boyas y balizas)', en: 'Other floating structures, for example, rafts, tanks, coffer-dams, landing-stages, buoys and beacons' } },
  { code: '8908', description: { es: 'Barcos y demas artefactos flotantes para desguace', en: 'Vessels and other floating structures for breaking up' } },

  // =========================================================================
  // CHAPTER 90 - INSTRUMENTOS OPTICOS, MEDICOS / OPTICAL, MEDICAL INSTRUMENTS
  // =========================================================================
  { code: '9001', description: { es: 'Fibras opticas y haces de fibras opticas; cables de fibras opticas, excepto los de la partida 8544; hojas y placas de materia polarizante; lentes, prismas, espejos y demas elementos de optica, sin montar', en: 'Optical fibres and optical fibre bundles; optical fibre cables; sheets and plates of polarising material; lenses, prisms, mirrors and other optical elements, unmounted' } },
  { code: '9002', description: { es: 'Lentes, prismas, espejos y demas elementos de optica, de cualquier materia, montados, para instrumentos o aparatos', en: 'Lenses, prisms, mirrors and other optical elements, of any material, mounted, for instruments or apparatus' } },
  { code: '9003', description: { es: 'Monturas de gafas o de articulos similares y sus partes', en: 'Frames and mountings for spectacles, goggles or the like, and parts thereof' } },
  { code: '9004', description: { es: 'Gafas correctoras, protectoras u otras, y articulos similares', en: 'Spectacles, goggles and the like, corrective, protective or other' } },
  { code: '9005', description: { es: 'Binoculares (incluidos los prismaticos), catalejos, anteojos astronomicos, telescopios opticos y sus armazones', en: 'Binoculars, monoculars, other optical telescopes, and mountings therefor' } },
  { code: '9006', description: { es: 'Camaras fotograficas; aparatos y dispositivos, incluidos las lamparas y tubos, para la produccion de destellos en fotografia', en: 'Photographic cameras; photographic flashlight apparatus and flashbulbs' } },
  { code: '9007', description: { es: 'Camaras y proyectores cinematograficos, incluso con grabador o reproductor de sonido incorporado', en: 'Cinematographic cameras and projectors, whether or not incorporating sound recording or reproducing apparatus' } },
  { code: '9008', description: { es: 'Proyectores de imagen fija; aparatos fotograficos de ampliacion o reduccion', en: 'Image projectors, other than cinematographic; photographic enlargers and reducers' } },
  { code: '9010', description: { es: 'Aparatos y material para laboratorios fotograficos o cinematograficos; negatoscopios; pantallas de proyeccion', en: 'Apparatus and equipment for photographic or cinematographic laboratories; negatoscopes; projection screens' } },
  { code: '9011', description: { es: 'Microscopios opticos, incluidos los microscopios para fotomicrografia, cinefotomicrografia o microproyeccion', en: 'Compound optical microscopes, including those for photomicrography, cinephotomicrography or microprojection' } },
  { code: '9012', description: { es: 'Microscopios, excepto los microscopios opticos; difractografos', en: 'Microscopes other than optical microscopes; diffraction apparatus' } },
  { code: '9013', description: { es: 'Dispositivos de cristal liquido que no constituyan articulos comprendidos de forma mas especifica en otra partida; laseres, excepto los diodos laser; los demas aparatos e instrumentos de optica', en: 'Liquid crystal devices; lasers, other than laser diodes; other optical appliances and instruments' } },
  { code: '9014', description: { es: 'Brujulas, incluidos los compases de navegacion; los demas instrumentos y aparatos de navegacion', en: 'Direction finding compasses; other navigational instruments and appliances' } },
  { code: '9015', description: { es: 'Instrumentos y aparatos de geodesia, topografia, agrimensura, nivelacion, fotogrametria, hidrografia, oceanografia, hidrologia, meteorologia o geofisica; telemetros', en: 'Surveying, hydrographic, oceanographic, hydrological, meteorological or geophysical instruments; rangefinders' } },
  { code: '9016', description: { es: 'Balanzas sensibles a un peso <= 5 cg, incluso con sus pesas', en: 'Balances of a sensitivity of 5 cg or better, with or without weights' } },
  { code: '9017', description: { es: 'Instrumentos de dibujo, trazado o calculo; metros, micrometros, calibradores y galgas', en: 'Drawing, marking-out or mathematical calculating instruments; measuring rods, tapes, rules, micrometers, callipers and gauges' } },
  { code: '9018', description: { es: 'Instrumentos y aparatos de medicina, cirugia, odontologia o veterinaria', en: 'Instruments and appliances used in medical, surgical, dental or veterinary sciences' } },
  { code: '9019', description: { es: 'Aparatos de mecanoterapia; aparatos para masajes; aparatos de sicotecnia; aparatos de ozonoterapia, oxigenoterapia, aerosolterapia, aparatos respiratorios de reanimacion y demas aparatos de terapia respiratoria', en: 'Mechano-therapy appliances; massage apparatus; psychological aptitude-testing apparatus; ozone, oxygen, aerosol therapy, artificial respiration or other therapeutic respiration apparatus' } },
  { code: '9020', description: { es: 'Los demas aparatos respiratorios y mascaras antigas, excepto las mascaras de proteccion sin mecanismo ni elemento filtrante amovible', en: 'Other breathing appliances and gas masks, excluding protective masks having neither mechanical parts nor replaceable filters' } },
  { code: '9021', description: { es: 'Articulos y aparatos de ortopedia, incluidas las fajas y vendajes medicoquirurgicos y las muletas; tablillas, ferulas u otros articulos y aparatos para fracturas; articulos y aparatos de protesis; audifonos y demas aparatos que lleve la propia persona o se le implanten', en: 'Orthopaedic appliances, including crutches, surgical belts and trusses; splints and fracture appliances; artificial parts of the body; hearing aids' } },
  { code: '9022', description: { es: 'Aparatos de rayos X y aparatos que utilicen radiaciones alfa, beta, gamma o demas radiaciones ionizantes', en: 'Apparatus based on the use of X-rays or of alpha, beta, gamma or other ionising radiations' } },
  { code: '9023', description: { es: 'Instrumentos, aparatos y modelos concebidos para demostraciones, no susceptibles de otros usos', en: 'Instruments, apparatus and models, designed for demonstrational purposes, not suitable for other uses' } },
  { code: '9024', description: { es: 'Maquinas y aparatos para ensayos de dureza, traccion, compresion, elasticidad u otras propiedades mecanicas de materiales', en: 'Machines and appliances for testing the hardness, strength, compressibility, elasticity of materials' } },
  { code: '9025', description: { es: 'Densimetros, areometros, pesaliquidos e instrumentos flotantes analogos, termometros, pirometros, barometros, higrometros y sicrometros', en: 'Hydrometers and similar floating instruments, thermometers, pyrometers, barometers, hygrometers and psychrometers' } },
  { code: '9026', description: { es: 'Instrumentos y aparatos para la medida o control del caudal, nivel, presion u otras caracteristicas variables de liquidos o gases', en: 'Instruments and apparatus for measuring or checking the flow, level, pressure or other variables of liquids or gases' } },
  { code: '9027', description: { es: 'Instrumentos y aparatos para analisis fisicos o quimicos; instrumentos y aparatos para ensayos de viscosidad, porosidad, dilatacion, tension superficial', en: 'Instruments and apparatus for physical or chemical analysis; instruments for measuring viscosity, porosity, expansion, surface tension' } },
  { code: '9028', description: { es: 'Contadores de gas, de liquidos o de electricidad, incluidos los de calibracion', en: 'Gas, liquid or electricity supply or production meters, including calibrating meters' } },
  { code: '9029', description: { es: 'Los demas contadores; cuentarrevoluciones, contadores de produccion, taximetros, cuentakilometros, podometros; velocimetros y tacometros', en: 'Revolution counters, production counters, taximeters, mileometers, pedometers; speed indicators and tachometers' } },
  { code: '9030', description: { es: 'Osciloscopios, analizadores de espectro y demas instrumentos y aparatos para medida o control de magnitudes electricas; instrumentos y aparatos para medida o deteccion de radiaciones ionizantes', en: 'Oscilloscopes, spectrum analysers and other instruments for measuring electrical quantities; instruments for measuring ionising radiations' } },
  { code: '9031', description: { es: 'Instrumentos, aparatos y maquinas de medida o control, no expresados ni comprendidos en otra parte de este capitulo; proyectores de perfiles', en: 'Measuring or checking instruments, appliances and machines, not elsewhere specified in this chapter; profile projectors' } },
  { code: '9032', description: { es: 'Instrumentos y aparatos para regulacion o control automaticos', en: 'Automatic regulating or controlling instruments and apparatus' } },
  { code: '9033', description: { es: 'Partes y accesorios no expresados ni comprendidos en otra parte de este capitulo, para maquinas, aparatos, instrumentos o articulos del capitulo 90', en: 'Parts and accessories not elsewhere specified in this chapter, for machines, instruments or apparatus of chapter 90' } },

  // =========================================================================
  // CHAPTER 91 - RELOJERIA / CLOCKS AND WATCHES
  // =========================================================================
  { code: '9101', description: { es: 'Relojes de pulsera, bolsillo y similares, con caja de metal precioso o chapado', en: 'Wrist-watches, pocket-watches, with case of precious metal or clad with precious metal' } },
  { code: '9102', description: { es: 'Relojes de pulsera, bolsillo y similares, excepto los de la partida 9101', en: 'Wrist-watches, pocket-watches and other watches, other than those of heading 9101' } },
  { code: '9103', description: { es: 'Despertadores y demas relojes de pequeño mecanismo de relojeria', en: 'Clocks with watch movements, excluding clocks of heading 9104' } },
  { code: '9104', description: { es: 'Relojes de tablero de instrumentos y relojes similares, para vehiculos', en: 'Instrument panel clocks and clocks of a similar type for vehicles' } },
  { code: '9105', description: { es: 'Los demas relojes', en: 'Other clocks' } },
  { code: '9106', description: { es: 'Aparatos de control de tiempo y contadores de tiempo, con mecanismo de relojeria o con motor sincrono', en: 'Time of day recording apparatus and apparatus for measuring, recording or indicating intervals of time' } },
  { code: '9107', description: { es: 'Interruptores horarios y demas aparatos que accionen un mecanismo en un momento dado', en: 'Time switches with clock or watch movement or with synchronous motor' } },
  { code: '9108', description: { es: 'Pequeños mecanismos de relojeria completos y montados', en: 'Watch movements, complete and assembled' } },
  { code: '9109', description: { es: 'Los demas mecanismos de relojeria completos y montados', en: 'Clock movements, complete and assembled' } },
  { code: '9110', description: { es: 'Mecanismos de relojeria completos, sin montar o parcialmente montados; mecanismos de relojeria incompletos, montados; mecanismos de relojeria en tosco', en: 'Complete watch or clock movements, unassembled or partly assembled; incomplete movements; rough movements' } },
  { code: '9111', description: { es: 'Cajas de relojes de las partidas 9101 o 9102 y sus partes', en: 'Watch cases and parts thereof' } },
  { code: '9112', description: { es: 'Cajas y envolturas similares de los demas aparatos de relojeria, y sus partes', en: 'Clock cases and cases of a similar type, and parts thereof' } },
  { code: '9113', description: { es: 'Pulseras para reloj y sus partes', en: 'Watch straps, watch bands and watch bracelets, and parts thereof' } },
  { code: '9114', description: { es: 'Las demas partes de aparatos de relojeria', en: 'Other clock or watch parts' } },

  // =========================================================================
  // CHAPTER 92 - INSTRUMENTOS MUSICALES / MUSICAL INSTRUMENTS
  // =========================================================================
  { code: '9201', description: { es: 'Pianos, incluso automaticos; clavecines y demas instrumentos de cuerda con teclado', en: 'Pianos, including automatic pianos; harpsichords and other keyboard stringed instruments' } },
  { code: '9202', description: { es: 'Los demas instrumentos musicales de cuerda', en: 'Other string musical instruments' } },
  { code: '9205', description: { es: 'Instrumentos musicales de viento, excepto los de la partida 9208', en: 'Wind musical instruments, other than fairground organs and mechanical street organs' } },
  { code: '9206', description: { es: 'Instrumentos musicales de percusion', en: 'Percussion musical instruments' } },
  { code: '9207', description: { es: 'Instrumentos musicales en los que el sonido se produzca o deba amplificarse electricamente', en: 'Musical instruments, the sound of which is produced or must be amplified, electrically' } },
  { code: '9208', description: { es: 'Cajas de musica, orquestriones, organillos, pajaros cantores, sierras musicales y demas instrumentos musicales no comprendidos en otra partida; reclamos; silbatos, cuernos y demas instrumentos de boca, de llamada o de señales', en: 'Musical boxes, fairground organs, mechanical street organs, mechanical singing birds, musical saws, decoy calls, signal horns' } },
  { code: '9209', description: { es: 'Partes y accesorios de instrumentos musicales; metronomos y diapasones de cualquier tipo', en: 'Parts and accessories of musical instruments; metronomes, tuning forks and pitch pipes' } },

  // =========================================================================
  // CHAPTER 93 - ARMAS Y MUNICIONES / ARMS AND AMMUNITION
  // =========================================================================
  { code: '9301', description: { es: 'Armas de guerra, excepto los revolveres, pistolas y armas blancas', en: 'Military weapons, other than revolvers, pistols and the arms of heading 9307' } },
  { code: '9302', description: { es: 'Revolveres y pistolas, excepto los de las partidas 9303 o 9304', en: 'Revolvers and pistols, other than those of heading 9303 or 9304' } },
  { code: '9303', description: { es: 'Las demas armas de fuego y artefactos similares que utilicen la deflagracion de la polvora', en: 'Other firearms and similar devices which operate by the firing of an explosive charge' } },
  { code: '9304', description: { es: 'Las demas armas, excepto las de la partida 9307', en: 'Other arms, excluding those of heading 9307' } },
  { code: '9305', description: { es: 'Partes y accesorios de los articulos de las partidas 9301 a 9304', en: 'Parts and accessories of articles of headings 9301 to 9304' } },
  { code: '9306', description: { es: 'Bombas, granadas, torpedos, minas, misiles, cartuchos y demas municiones y proyectiles, y sus partes', en: 'Bombs, grenades, torpedoes, mines, missiles, cartridges and other ammunition and projectiles, and parts thereof' } },
  { code: '9307', description: { es: 'Sables, espadas, bayonetas, lanzas y demas armas blancas, sus partes y sus fundas', en: 'Swords, cutlasses, bayonets, lances and similar arms, parts thereof and scabbards and sheaths' } },

  // =========================================================================
  // CHAPTER 94 - MUEBLES / FURNITURE
  // =========================================================================
  { code: '9401', description: { es: 'Asientos, incluso los transformables en cama, y sus partes', en: 'Seats, whether or not convertible into beds, and parts thereof' } },
  { code: '9402', description: { es: 'Mobiliario para medicina, cirugia, odontologia o veterinaria; sillones de peluqueria y sillones similares', en: 'Medical, surgical, dental or veterinary furniture; barbers chairs and similar chairs' } },
  { code: '9403', description: { es: 'Los demas muebles y sus partes', en: 'Other furniture and parts thereof' } },
  { code: '9404', description: { es: 'Somieres; articulos de cama y articulos similares, con muelles, rellenos o guarnecidos interiormente', en: 'Mattress supports; articles of bedding, with springs, stuffed or internally fitted' } },
  { code: '9405', description: { es: 'Aparatos de alumbrado, incluidos los proyectores, y sus partes; anuncios, letreros y placas indicadoras luminosos', en: 'Luminaires and lighting fittings, including searchlights and spotlights; illuminated signs, name-plates' } },
  { code: '9406', description: { es: 'Construcciones prefabricadas', en: 'Prefabricated buildings' } },

  // =========================================================================
  // CHAPTER 95 - JUGUETES / TOYS, GAMES
  // =========================================================================
  { code: '9503', description: { es: 'Triciclos, patinetes, coches de pedales y juguetes similares con ruedas; coches y sillas de ruedas para muñecas; muñecas; los demas juguetes; modelos reducidos y modelos similares, recreativos, animados o no; rompecabezas de cualquier clase', en: 'Tricycles, scooters, pedal cars and similar wheeled toys; dolls carriages; dolls; other toys; reduced-size models; puzzles of all kinds' } },
  { code: '9504', description: { es: 'Consolas y maquinas de videojuegos, juegos de mesa, juegos de salon, incluidos los juegos con motor o mecanismo, billares, mesas especiales para juegos de casino y juegos de bolos automaticos', en: 'Video game consoles and machines, table or parlour games, billiards, special tables for casino games, bowling equipment' } },
  { code: '9505', description: { es: 'Articulos para fiestas, carnaval u otras diversiones, incluidos los de magia y articulos sorpresa', en: 'Festive, carnival or other entertainment articles, including conjuring tricks and novelty jokes' } },
  { code: '9506', description: { es: 'Articulos y material para cultura fisica, gimnasia, atletismo, demas deportes o juegos al aire libre; piscinas y chapoteaderos', en: 'Articles and equipment for general physical exercise, gymnastics, athletics, other sports or outdoor games; swimming pools' } },
  { code: '9507', description: { es: 'Cañas de pescar, anzuelos y demas articulos para la pesca con caña; salabardos, cazamariposas y redes similares; señuelos y articulos de caza similares', en: 'Fishing rods, fish-hooks and other line fishing tackle; fish landing nets, butterfly nets; decoy birds' } },
  { code: '9508', description: { es: 'Tiovivos, columpios, casetas de tiro y demas atracciones de feria; circos y zoologicos ambulantes; teatros ambulantes', en: 'Roundabouts, swings, shooting galleries and other fairground amusements; travelling circuses and theatres' } },

  // =========================================================================
  // CHAPTER 96 - MANUFACTURAS DIVERSAS / MISCELLANEOUS MANUFACTURED ARTICLES
  // =========================================================================
  { code: '9601', description: { es: 'Marfil, hueso, concha de tortuga, cuerno, astas, coral, nacar y demas materias animales para tallar, trabajados, y sus manufacturas', en: 'Worked ivory, bone, tortoise-shell, horn, antlers, coral, mother-of-pearl and other animal carving material' } },
  { code: '9602', description: { es: 'Materias vegetales o minerales para tallar, trabajadas, y manufacturas de estas materias; manufacturas moldeadas o talladas de cera, parafina, estearina, gomas o resinas naturales, pastas de modelar', en: 'Worked vegetable or mineral carving material; moulded articles of wax, stearin, natural gums or resins, modelling pastes' } },
  { code: '9603', description: { es: 'Escobas y escobillas, cepillos, brochas y pinceles, incluso si son partes de maquinas, aparatos o vehiculos; fregonas y plumeros; rodillos para pintar', en: 'Brooms, brushes, paint rollers, squeegees, mops' } },
  { code: '9604', description: { es: 'Tamices, cedazos y cribas, de mano', en: 'Hand sieves and hand riddles' } },
  { code: '9605', description: { es: 'Juegos de viaje para el aseo personal, la costura o la limpieza del calzado o de prendas de vestir', en: 'Travel sets for personal toilet, sewing or shoe or clothes cleaning' } },
  { code: '9606', description: { es: 'Botones y botones de presion; formas para botones y demas partes de botones o de botones de presion; esbozos de botones', en: 'Buttons, press-fasteners, snap-fasteners and press-studs, button moulds and other parts of these articles; button blanks' } },
  { code: '9607', description: { es: 'Cierres de cremallera y sus partes', en: 'Slide fasteners and parts thereof' } },
  { code: '9608', description: { es: 'Boligrafos; rotuladores y marcadores con punta de fieltro u otra punta porosa; estilograficas y demas plumas; estiletes para clises de multicopia; portaminas; portaplumas, portalapices y articulos similares', en: 'Ball point pens; felt tipped pens and markers; fountain pens; stylograph pens; propelling pencils; pen-holders' } },
  { code: '9609', description: { es: 'Lapices, minas, pasteles, carboncillos, tizas para escribir o dibujar y tizas de sastre', en: 'Pencils, crayons, pencil leads, pastels, drawing charcoals, writing or drawing chalks, tailors chalks' } },
  { code: '9610', description: { es: 'Pizarras y tableros para escribir o dibujar, incluso enmarcados', en: 'Slates and boards, with writing or drawing surfaces, whether or not framed' } },
  { code: '9611', description: { es: 'Fechadores, sellos, numeradores, timbradores y articulos similares, de mano; componedores e imprentillas con componedor', en: 'Date, sealing or numbering stamps, and the like, hand-operated; hand-operated composing sticks, and hand printing sets' } },
  { code: '9612', description: { es: 'Cintas para maquinas de escribir y cintas similares, entintadas o preparadas; tampones, incluso impregnados', en: 'Typewriter or similar ribbons, inked or otherwise prepared for giving impressions; ink-pads' } },
  { code: '9613', description: { es: 'Encendedores y mecheros, incluso mecanicos o electricos, y sus partes', en: 'Cigarette lighters and other lighters, whether or not mechanical or electrical, and parts thereof' } },
  { code: '9614', description: { es: 'Pipas, incluidas las cazoletas, boquillas para cigarros o cigarrillos, y sus partes', en: 'Smoking pipes, including pipe bowls, cigar or cigarette holders, and parts thereof' } },
  { code: '9615', description: { es: 'Peines, peinetas, pasadores y articulos similares; horquillas; rizadores, bigudies y articulos similares, excepto los de la partida 8516', en: 'Combs, hair-slides and the like; hairpins; curling pins, curling grips and the like' } },
  { code: '9616', description: { es: 'Pulverizadores de tocador, sus monturas y cabezas de monturas; borlas y similares para la aplicacion de polvos, cosmeticos', en: 'Scent sprays and similar toilet sprays, and mounts and heads therefor; powder-puffs for the application of cosmetics' } },
  { code: '9617', description: { es: 'Termos y demas recipientes isotermicos, montados y aislados por vacio, asi como sus partes', en: 'Vacuum flasks and other vacuum vessels, complete with cases; parts thereof other than glass inners' } },
  { code: '9618', description: { es: 'Maniquies y articulos similares; automatas y escenas animadas para escaparates', en: 'Tailors dummies and other lay figures; automata and other animated displays used for shop window dressing' } },
  { code: '9619', description: { es: 'Compresas y tampones higienicos, pañales y articulos similares, de cualquier materia', en: 'Sanitary towels and tampons, napkins and napkin liners for babies and similar articles, of any material' } },

  // =========================================================================
  // CHAPTER 97 - OBJETOS DE ARTE / WORKS OF ART, ANTIQUES
  // =========================================================================
  { code: '9701', description: { es: 'Pinturas y dibujos, hechos totalmente a mano, excepto los de la partida 4906; collages y cuadros murales similares', en: 'Paintings and drawings, executed entirely by hand; collages and similar decorative plaques' } },
  { code: '9702', description: { es: 'Grabados, estampas y litografias originales', en: 'Original engravings, prints and lithographs' } },
  { code: '9703', description: { es: 'Obras originales de estatuaria o escultura, de cualquier materia', en: 'Original sculptures and statuary, in any material' } },
  { code: '9704', description: { es: 'Sellos de correos, timbres fiscales, marcas postales, sobres primer dia, articulos franqueados y analogos, obliterados, o sin obliterar, distintos de los articulos de la partida 4907', en: 'Postage or revenue stamps, first-day covers, postal stationery, stamped or franked' } },
  { code: '9705', description: { es: 'Colecciones y especimenes para colecciones de zoologia, botanica, mineralogia, anatomia, o que tengan interes historico, arqueologico, paleontologico, etnografico o numismatico', en: 'Collections and specimens of zoological, botanical, mineralogical, anatomical, historical, archaeological interest' } },
  { code: '9706', description: { es: 'Antiguedades de mas de 100 años', en: 'Antiques of an age exceeding one hundred years' } },
];

// ============================================================================
// PRIORITY SUBHEADINGS (6-digit) for top 10 chapters
// ============================================================================

const PRIORITY_SUBHEADINGS = [

  // =========================================================================
  // CHAPTER 07 SUBHEADINGS
  // =========================================================================
  { code: '070110', description: { es: 'Patatas para siembra', en: 'Seed potatoes' } },
  { code: '070190', description: { es: 'Las demas patatas', en: 'Other potatoes' } },
  { code: '070200', description: { es: 'Tomates frescos o refrigerados', en: 'Tomatoes, fresh or chilled' } },
  { code: '070310', description: { es: 'Cebollas y chalotes', en: 'Onions and shallots' } },
  { code: '070320', description: { es: 'Ajos', en: 'Garlic' } },
  { code: '070390', description: { es: 'Puerros y demas hortalizas aliaceas', en: 'Leeks and other alliaceous vegetables' } },
  { code: '070410', description: { es: 'Coliflores y brecoles', en: 'Cauliflowers and headed broccoli' } },
  { code: '070490', description: { es: 'Las demas coles', en: 'Other cabbages, kohlrabi, kale' } },
  { code: '070511', description: { es: 'Lechugas repolladas', en: 'Cabbage lettuce (head lettuce)' } },
  { code: '070519', description: { es: 'Las demas lechugas', en: 'Other lettuce' } },
  { code: '070521', description: { es: 'Achicorias, incluida la escarola, de las variedades Witloof', en: 'Witloof chicory' } },
  { code: '070529', description: { es: 'Las demas achicorias', en: 'Other chicory' } },
  { code: '070610', description: { es: 'Zanahorias y nabos', en: 'Carrots and turnips' } },
  { code: '070690', description: { es: 'Las demas raices comestibles (remolachas, salsifies, apionabos, rabanos)', en: 'Other edible roots (beetroot, salsify, celeriac, radishes)' } },
  { code: '070700', description: { es: 'Pepinos y pepinillos', en: 'Cucumbers and gherkins' } },
  { code: '070810', description: { es: 'Guisantes', en: 'Peas' } },
  { code: '070820', description: { es: 'Judias', en: 'Beans' } },
  { code: '070890', description: { es: 'Las demas hortalizas de vaina', en: 'Other leguminous vegetables' } },
  { code: '070920', description: { es: 'Esparragos', en: 'Asparagus' } },
  { code: '070930', description: { es: 'Berenjenas', en: 'Aubergines (eggplants)' } },
  { code: '070940', description: { es: 'Apio, excepto el apionabo', en: 'Celery other than celeriac' } },
  { code: '070951', description: { es: 'Hongos del genero Agaricus', en: 'Mushrooms of the genus Agaricus' } },
  { code: '070959', description: { es: 'Los demas hongos y trufas', en: 'Other mushrooms and truffles' } },
  { code: '070960', description: { es: 'Pimientos del genero Capsicum o Pimenta', en: 'Fruits of the genus Capsicum or Pimenta' } },
  { code: '070970', description: { es: 'Espinacas, incluida la de Nueva Zelanda y la de huerta', en: 'Spinach, New Zealand spinach and orache spinach' } },
  { code: '070991', description: { es: 'Alcachofas', en: 'Globe artichokes' } },
  { code: '070992', description: { es: 'Aceitunas', en: 'Olives' } },
  { code: '070993', description: { es: 'Calabazas, calabacines y calabazas de cidra', en: 'Pumpkins, squash and gourds' } },
  { code: '070999', description: { es: 'Las demas hortalizas frescas o refrigeradas', en: 'Other vegetables, fresh or chilled' } },
  { code: '071010', description: { es: 'Patatas congeladas', en: 'Potatoes, frozen' } },
  { code: '071021', description: { es: 'Guisantes congelados', en: 'Peas, frozen' } },
  { code: '071022', description: { es: 'Judias congeladas', en: 'Beans, frozen' } },
  { code: '071029', description: { es: 'Las demas hortalizas de vaina congeladas', en: 'Other leguminous vegetables, frozen' } },
  { code: '071030', description: { es: 'Espinacas congeladas', en: 'Spinach, frozen' } },
  { code: '071040', description: { es: 'Maiz dulce congelado', en: 'Sweet corn, frozen' } },
  { code: '071080', description: { es: 'Las demas hortalizas congeladas', en: 'Other vegetables, frozen' } },
  { code: '071090', description: { es: 'Mezclas de hortalizas congeladas', en: 'Mixtures of vegetables, frozen' } },
  { code: '071120', description: { es: 'Aceitunas conservadas provisionalmente', en: 'Olives, provisionally preserved' } },
  { code: '071140', description: { es: 'Pepinos y pepinillos conservados provisionalmente', en: 'Cucumbers and gherkins, provisionally preserved' } },
  { code: '071151', description: { es: 'Hongos del genero Agaricus conservados provisionalmente', en: 'Mushrooms of the genus Agaricus, provisionally preserved' } },
  { code: '071190', description: { es: 'Las demas hortalizas y mezclas de hortalizas conservadas provisionalmente', en: 'Other vegetables and mixtures, provisionally preserved' } },
  { code: '071220', description: { es: 'Cebollas secas', en: 'Onions, dried' } },
  { code: '071231', description: { es: 'Hongos del genero Agaricus secos', en: 'Mushrooms of the genus Agaricus, dried' } },
  { code: '071239', description: { es: 'Los demas hongos secos', en: 'Other mushrooms, dried' } },
  { code: '071290', description: { es: 'Las demas hortalizas secas y mezclas de hortalizas', en: 'Other dried vegetables and mixtures' } },
  { code: '071310', description: { es: 'Guisantes secos desvainados', en: 'Peas, dried shelled' } },
  { code: '071320', description: { es: 'Garbanzos secos', en: 'Chickpeas (garbanzos), dried' } },
  { code: '071331', description: { es: 'Judias de las especies Vigna mungo o radiata, secas', en: 'Beans of the species Vigna mungo or radiata, dried' } },
  { code: '071332', description: { es: 'Judias adzuki secas', en: 'Small red (adzuki) beans, dried' } },
  { code: '071333', description: { es: 'Judias comunes (Phaseolus vulgaris) secas', en: 'Kidney beans, including white pea beans, dried' } },
  { code: '071334', description: { es: 'Judias bambara secas', en: 'Bambara beans, dried' } },
  { code: '071335', description: { es: 'Judias salvajes o caupis secas', en: 'Cow peas, dried' } },
  { code: '071339', description: { es: 'Las demas judias secas', en: 'Other beans, dried' } },
  { code: '071340', description: { es: 'Lentejas secas', en: 'Lentils, dried' } },
  { code: '071350', description: { es: 'Habas y haboncillos secos', en: 'Broad beans and horse beans, dried' } },
  { code: '071360', description: { es: 'Guandues secos', en: 'Pigeon peas, dried' } },
  { code: '071390', description: { es: 'Las demas hortalizas de vaina secas', en: 'Other dried leguminous vegetables' } },
  { code: '071410', description: { es: 'Raices de mandioca', en: 'Manioc (cassava)' } },
  { code: '071420', description: { es: 'Batatas (boniatos, camotes)', en: 'Sweet potatoes' } },
  { code: '071430', description: { es: 'Ñames', en: 'Yams' } },
  { code: '071440', description: { es: 'Taro (Colocasia spp.)', en: 'Taro (Colocasia spp.)' } },
  { code: '071450', description: { es: 'Yautia (Xanthosoma spp.)', en: 'Yautia (Xanthosoma spp.)' } },
  { code: '071490', description: { es: 'Las demas raices y tuberculos similares', en: 'Other similar roots and tubers' } },

  // =========================================================================
  // CHAPTER 08 SUBHEADINGS
  // =========================================================================
  { code: '080111', description: { es: 'Cocos desecados', en: 'Desiccated coconuts' } },
  { code: '080112', description: { es: 'Cocos con la cascara interna', en: 'Coconuts in the inner shell (endocarp)' } },
  { code: '080119', description: { es: 'Los demas cocos', en: 'Other coconuts' } },
  { code: '080121', description: { es: 'Nueces del Brasil con cascara', en: 'Brazil nuts, in shell' } },
  { code: '080122', description: { es: 'Nueces del Brasil sin cascara', en: 'Brazil nuts, shelled' } },
  { code: '080131', description: { es: 'Nueces de caju con cascara', en: 'Cashew nuts, in shell' } },
  { code: '080132', description: { es: 'Nueces de caju sin cascara', en: 'Cashew nuts, shelled' } },
  { code: '080211', description: { es: 'Almendras con cascara', en: 'Almonds in shell' } },
  { code: '080212', description: { es: 'Almendras sin cascara', en: 'Almonds, shelled' } },
  { code: '080221', description: { es: 'Avellanas con cascara', en: 'Hazelnuts or filberts, in shell' } },
  { code: '080222', description: { es: 'Avellanas sin cascara', en: 'Hazelnuts or filberts, shelled' } },
  { code: '080231', description: { es: 'Nueces de nogal con cascara', en: 'Walnuts, in shell' } },
  { code: '080232', description: { es: 'Nueces de nogal sin cascara', en: 'Walnuts, shelled' } },
  { code: '080241', description: { es: 'Castañas con cascara', en: 'Chestnuts, in shell' } },
  { code: '080242', description: { es: 'Castañas sin cascara', en: 'Chestnuts, shelled' } },
  { code: '080251', description: { es: 'Pistachos con cascara', en: 'Pistachios, in shell' } },
  { code: '080252', description: { es: 'Pistachos sin cascara', en: 'Pistachios, shelled' } },
  { code: '080261', description: { es: 'Nueces de macadamia con cascara', en: 'Macadamia nuts, in shell' } },
  { code: '080262', description: { es: 'Nueces de macadamia sin cascara', en: 'Macadamia nuts, shelled' } },
  { code: '080270', description: { es: 'Nueces de cola', en: 'Kola nuts' } },
  { code: '080280', description: { es: 'Nueces de areca', en: 'Areca nuts' } },
  { code: '080290', description: { es: 'Los demas frutos de cascara', en: 'Other nuts' } },
  { code: '080310', description: { es: 'Platanos', en: 'Plantains' } },
  { code: '080390', description: { es: 'Bananas, incluidos los platanos frescos o secos', en: 'Bananas, including plantains, fresh or dried' } },
  { code: '080410', description: { es: 'Datiles', en: 'Dates' } },
  { code: '080420', description: { es: 'Higos', en: 'Figs' } },
  { code: '080430', description: { es: 'Piñas tropicales', en: 'Pineapples' } },
  { code: '080440', description: { es: 'Aguacates', en: 'Avocados' } },
  { code: '080450', description: { es: 'Guayabas, mangos y mangostanes', en: 'Guavas, mangoes and mangosteens' } },
  { code: '080510', description: { es: 'Naranjas', en: 'Oranges' } },
  { code: '080521', description: { es: 'Mandarinas, incluidas las tangerinas y satsumas', en: 'Mandarins, including tangerines and satsumas' } },
  { code: '080522', description: { es: 'Clementinas', en: 'Clementines' } },
  { code: '080529', description: { es: 'Los demas hibridos de agrios', en: 'Other citrus hybrids' } },
  { code: '080540', description: { es: 'Toronjas o pomelos', en: 'Grapefruit, including pomelos' } },
  { code: '080550', description: { es: 'Limones y limas', en: 'Lemons and limes' } },
  { code: '080590', description: { es: 'Los demas agrios', en: 'Other citrus fruit' } },
  { code: '080610', description: { es: 'Uvas frescas', en: 'Fresh grapes' } },
  { code: '080620', description: { es: 'Uvas secas (pasas)', en: 'Dried grapes (raisins)' } },
  { code: '080711', description: { es: 'Sandias', en: 'Watermelons' } },
  { code: '080719', description: { es: 'Los demas melones', en: 'Other melons' } },
  { code: '080720', description: { es: 'Papayas', en: 'Papaws (papayas)' } },
  { code: '080810', description: { es: 'Manzanas', en: 'Apples' } },
  { code: '080830', description: { es: 'Peras', en: 'Pears' } },
  { code: '080840', description: { es: 'Membrillos', en: 'Quinces' } },
  { code: '080910', description: { es: 'Albaricoques', en: 'Apricots' } },
  { code: '080921', description: { es: 'Guindas (cerezas acidas)', en: 'Sour cherries' } },
  { code: '080929', description: { es: 'Las demas cerezas', en: 'Other cherries' } },
  { code: '080930', description: { es: 'Melocotones, incluidos los griñones y nectarinas', en: 'Peaches, including nectarines' } },
  { code: '080940', description: { es: 'Ciruelas y endrinas', en: 'Plums and sloes' } },
  { code: '081010', description: { es: 'Fresas', en: 'Strawberries' } },
  { code: '081020', description: { es: 'Frambuesas, zarzamoras, moras y moras-frambuesa', en: 'Raspberries, blackberries, mulberries and loganberries' } },
  { code: '081030', description: { es: 'Grosellas negras, blancas o rojas y grosellas espinosas', en: 'Black, white or red currants and gooseberries' } },
  { code: '081040', description: { es: 'Arandanos rojos, mirtilos y demas frutos del genero Vaccinium', en: 'Cranberries, bilberries and other fruits of the genus Vaccinium' } },
  { code: '081050', description: { es: 'Kiwis', en: 'Kiwifruit' } },
  { code: '081060', description: { es: 'Duriones', en: 'Durians' } },
  { code: '081070', description: { es: 'Caquis', en: 'Persimmons' } },
  { code: '081090', description: { es: 'Las demas frutas frescas', en: 'Other fresh fruit' } },
  { code: '081110', description: { es: 'Fresas congeladas', en: 'Strawberries, frozen' } },
  { code: '081120', description: { es: 'Frambuesas, zarzamoras, moras y moras-frambuesa congeladas', en: 'Raspberries, blackberries, mulberries and loganberries, frozen' } },
  { code: '081190', description: { es: 'Las demas frutas congeladas', en: 'Other fruit, frozen' } },
  { code: '081210', description: { es: 'Cerezas conservadas provisionalmente', en: 'Cherries, provisionally preserved' } },
  { code: '081290', description: { es: 'Las demas frutas conservadas provisionalmente', en: 'Other fruit, provisionally preserved' } },
  { code: '081310', description: { es: 'Albaricoques secos', en: 'Apricots, dried' } },
  { code: '081320', description: { es: 'Ciruelas secas', en: 'Prunes, dried' } },
  { code: '081330', description: { es: 'Manzanas secas', en: 'Apples, dried' } },
  { code: '081340', description: { es: 'Las demas frutas secas', en: 'Other dried fruit' } },
  { code: '081350', description: { es: 'Mezclas de frutas secas o frutos de cascara', en: 'Mixtures of nuts or dried fruits' } },
  { code: '081400', description: { es: 'Cortezas de agrios, de melones o de sandias', en: 'Peel of citrus fruit or melons' } },

  // =========================================================================
  // CHAPTER 61 SUBHEADINGS
  // =========================================================================
  { code: '610110', description: { es: 'Abrigos de punto para hombres, de lana o pelo fino', en: 'Mens overcoats, knitted, of wool or fine animal hair' } },
  { code: '610120', description: { es: 'Abrigos de punto para hombres, de algodon', en: 'Mens overcoats, knitted, of cotton' } },
  { code: '610130', description: { es: 'Abrigos de punto para hombres, de fibras sinteticas o artificiales', en: 'Mens overcoats, knitted, of man-made fibres' } },
  { code: '610190', description: { es: 'Abrigos de punto para hombres, de las demas materias textiles', en: 'Mens overcoats, knitted, of other textile materials' } },
  { code: '610210', description: { es: 'Abrigos de punto para mujeres, de lana o pelo fino', en: 'Womens overcoats, knitted, of wool or fine animal hair' } },
  { code: '610220', description: { es: 'Abrigos de punto para mujeres, de algodon', en: 'Womens overcoats, knitted, of cotton' } },
  { code: '610230', description: { es: 'Abrigos de punto para mujeres, de fibras sinteticas o artificiales', en: 'Womens overcoats, knitted, of man-made fibres' } },
  { code: '610290', description: { es: 'Abrigos de punto para mujeres, de las demas materias textiles', en: 'Womens overcoats, knitted, of other textile materials' } },
  { code: '610310', description: { es: 'Trajes de punto para hombres, de lana o pelo fino', en: 'Mens suits, knitted, of wool or fine animal hair' } },
  { code: '610322', description: { es: 'Conjuntos de punto para hombres, de algodon', en: 'Mens ensembles, knitted, of cotton' } },
  { code: '610323', description: { es: 'Conjuntos de punto para hombres, de fibras sinteticas', en: 'Mens ensembles, knitted, of synthetic fibres' } },
  { code: '610329', description: { es: 'Conjuntos de punto para hombres, de las demas materias textiles', en: 'Mens ensembles, knitted, of other textile materials' } },
  { code: '610331', description: { es: 'Chaquetas de punto para hombres, de lana o pelo fino', en: 'Mens jackets, knitted, of wool or fine animal hair' } },
  { code: '610332', description: { es: 'Chaquetas de punto para hombres, de algodon', en: 'Mens jackets, knitted, of cotton' } },
  { code: '610333', description: { es: 'Chaquetas de punto para hombres, de fibras sinteticas', en: 'Mens jackets, knitted, of synthetic fibres' } },
  { code: '610341', description: { es: 'Pantalones de punto para hombres, de lana o pelo fino', en: 'Mens trousers, knitted, of wool or fine animal hair' } },
  { code: '610342', description: { es: 'Pantalones de punto para hombres, de algodon', en: 'Mens trousers, knitted, of cotton' } },
  { code: '610343', description: { es: 'Pantalones de punto para hombres, de fibras sinteticas', en: 'Mens trousers, knitted, of synthetic fibres' } },
  { code: '610349', description: { es: 'Pantalones de punto para hombres, de las demas materias textiles', en: 'Mens trousers, knitted, of other textile materials' } },
  { code: '610410', description: { es: 'Trajes sastre de punto para mujeres, de lana o pelo fino', en: 'Womens suits, knitted, of wool or fine animal hair' } },
  { code: '610413', description: { es: 'Trajes sastre de punto para mujeres, de fibras sinteticas', en: 'Womens suits, knitted, of synthetic fibres' } },
  { code: '610419', description: { es: 'Trajes sastre de punto para mujeres, de las demas materias textiles', en: 'Womens suits, knitted, of other textile materials' } },
  { code: '610422', description: { es: 'Conjuntos de punto para mujeres, de algodon', en: 'Womens ensembles, knitted, of cotton' } },
  { code: '610423', description: { es: 'Conjuntos de punto para mujeres, de fibras sinteticas', en: 'Womens ensembles, knitted, of synthetic fibres' } },
  { code: '610431', description: { es: 'Chaquetas de punto para mujeres, de lana o pelo fino', en: 'Womens jackets, knitted, of wool or fine animal hair' } },
  { code: '610432', description: { es: 'Chaquetas de punto para mujeres, de algodon', en: 'Womens jackets, knitted, of cotton' } },
  { code: '610433', description: { es: 'Chaquetas de punto para mujeres, de fibras sinteticas', en: 'Womens jackets, knitted, of synthetic fibres' } },
  { code: '610441', description: { es: 'Vestidos de punto, de lana o pelo fino', en: 'Dresses, knitted, of wool or fine animal hair' } },
  { code: '610442', description: { es: 'Vestidos de punto, de algodon', en: 'Dresses, knitted, of cotton' } },
  { code: '610443', description: { es: 'Vestidos de punto, de fibras sinteticas', en: 'Dresses, knitted, of synthetic fibres' } },
  { code: '610444', description: { es: 'Vestidos de punto, de fibras artificiales', en: 'Dresses, knitted, of artificial fibres' } },
  { code: '610449', description: { es: 'Vestidos de punto, de las demas materias textiles', en: 'Dresses, knitted, of other textile materials' } },
  { code: '610451', description: { es: 'Faldas de punto, de lana o pelo fino', en: 'Skirts, knitted, of wool or fine animal hair' } },
  { code: '610452', description: { es: 'Faldas de punto, de algodon', en: 'Skirts, knitted, of cotton' } },
  { code: '610453', description: { es: 'Faldas de punto, de fibras sinteticas', en: 'Skirts, knitted, of synthetic fibres' } },
  { code: '610461', description: { es: 'Pantalones de punto para mujeres, de lana o pelo fino', en: 'Womens trousers, knitted, of wool or fine animal hair' } },
  { code: '610462', description: { es: 'Pantalones de punto para mujeres, de algodon', en: 'Womens trousers, knitted, of cotton' } },
  { code: '610463', description: { es: 'Pantalones de punto para mujeres, de fibras sinteticas', en: 'Womens trousers, knitted, of synthetic fibres' } },
  { code: '610469', description: { es: 'Pantalones de punto para mujeres, de las demas materias textiles', en: 'Womens trousers, knitted, of other textile materials' } },
  { code: '610510', description: { es: 'Camisas de punto para hombres, de algodon', en: 'Mens shirts, knitted, of cotton' } },
  { code: '610520', description: { es: 'Camisas de punto para hombres, de fibras sinteticas o artificiales', en: 'Mens shirts, knitted, of man-made fibres' } },
  { code: '610590', description: { es: 'Camisas de punto para hombres, de las demas materias textiles', en: 'Mens shirts, knitted, of other textile materials' } },
  { code: '610610', description: { es: 'Blusas de punto para mujeres, de algodon', en: 'Womens blouses, knitted, of cotton' } },
  { code: '610620', description: { es: 'Blusas de punto para mujeres, de fibras sinteticas o artificiales', en: 'Womens blouses, knitted, of man-made fibres' } },
  { code: '610690', description: { es: 'Blusas de punto para mujeres, de las demas materias textiles', en: 'Womens blouses, knitted, of other textile materials' } },
  { code: '610711', description: { es: 'Calzoncillos de punto para hombres, de algodon', en: 'Mens underpants and briefs, knitted, of cotton' } },
  { code: '610712', description: { es: 'Calzoncillos de punto para hombres, de fibras sinteticas o artificiales', en: 'Mens underpants and briefs, knitted, of man-made fibres' } },
  { code: '610721', description: { es: 'Camisones y pijamas de punto para hombres, de algodon', en: 'Mens nightshirts and pyjamas, knitted, of cotton' } },
  { code: '610791', description: { es: 'Albornoces de punto para hombres, de algodon', en: 'Mens bathrobes, knitted, of cotton' } },
  { code: '610811', description: { es: 'Combinaciones y enaguas de punto, de fibras sinteticas o artificiales', en: 'Slips and petticoats, knitted, of man-made fibres' } },
  { code: '610821', description: { es: 'Bragas de punto, de algodon', en: 'Briefs and panties, knitted, of cotton' } },
  { code: '610822', description: { es: 'Bragas de punto, de fibras sinteticas o artificiales', en: 'Briefs and panties, knitted, of man-made fibres' } },
  { code: '610831', description: { es: 'Camisones y pijamas de punto para mujeres, de algodon', en: 'Womens nightdresses and pyjamas, knitted, of cotton' } },
  { code: '610891', description: { es: 'Albornoces y saltos de cama de punto para mujeres, de algodon', en: 'Womens negligees, bathrobes, knitted, of cotton' } },
  { code: '610910', description: { es: 'Camisetas de punto, de algodon', en: 'T-shirts, knitted, of cotton' } },
  { code: '610990', description: { es: 'Camisetas de punto, de las demas materias textiles', en: 'T-shirts, knitted, of other textile materials' } },
  { code: '611011', description: { es: 'Sueteres de punto, de lana o pelo fino', en: 'Jerseys, pullovers, knitted, of wool or fine animal hair' } },
  { code: '611012', description: { es: 'Sueteres de punto, de fibras de cachemira', en: 'Jerseys, pullovers, knitted, of Kashmir (cashmere) goats' } },
  { code: '611019', description: { es: 'Sueteres de punto, de lana o pelo fino (otros)', en: 'Jerseys, pullovers, knitted, of other wool or fine animal hair' } },
  { code: '611020', description: { es: 'Sueteres de punto, de algodon', en: 'Jerseys, pullovers, knitted, of cotton' } },
  { code: '611030', description: { es: 'Sueteres de punto, de fibras sinteticas o artificiales', en: 'Jerseys, pullovers, knitted, of man-made fibres' } },
  { code: '611090', description: { es: 'Sueteres de punto, de las demas materias textiles', en: 'Jerseys, pullovers, knitted, of other textile materials' } },
  { code: '611110', description: { es: 'Prendas de punto para bebes, de lana o pelo fino', en: 'Babies garments, knitted, of wool or fine animal hair' } },
  { code: '611120', description: { es: 'Prendas de punto para bebes, de algodon', en: 'Babies garments, knitted, of cotton' } },
  { code: '611130', description: { es: 'Prendas de punto para bebes, de fibras sinteticas', en: 'Babies garments, knitted, of synthetic fibres' } },
  { code: '611190', description: { es: 'Prendas de punto para bebes, de las demas materias textiles', en: 'Babies garments, knitted, of other textile materials' } },
  { code: '611211', description: { es: 'Chandales de punto, de algodon', en: 'Track suits, knitted, of cotton' } },
  { code: '611212', description: { es: 'Chandales de punto, de fibras sinteticas', en: 'Track suits, knitted, of synthetic fibres' } },
  { code: '611219', description: { es: 'Chandales de punto, de las demas materias textiles', en: 'Track suits, knitted, of other textile materials' } },
  { code: '611231', description: { es: 'Bañadores de punto para hombres, de fibras sinteticas', en: 'Mens swimwear, knitted, of synthetic fibres' } },
  { code: '611241', description: { es: 'Bañadores de punto para mujeres, de fibras sinteticas', en: 'Womens swimwear, knitted, of synthetic fibres' } },
  { code: '611300', description: { es: 'Prendas de vestir de punto con tejidos impregnados, recubiertos o estratificados', en: 'Garments, knitted, of fabrics of heading 5903, 5906 or 5907' } },
  { code: '611410', description: { es: 'Las demas prendas de punto, de lana o pelo fino', en: 'Other garments, knitted, of wool or fine animal hair' } },
  { code: '611420', description: { es: 'Las demas prendas de punto, de algodon', en: 'Other garments, knitted, of cotton' } },
  { code: '611430', description: { es: 'Las demas prendas de punto, de fibras sinteticas o artificiales', en: 'Other garments, knitted, of man-made fibres' } },
  { code: '611490', description: { es: 'Las demas prendas de punto, de las demas materias textiles', en: 'Other garments, knitted, of other textile materials' } },
  { code: '611510', description: { es: 'Calzas y panties de punto, de fibras sinteticas de titulo < 67 decitex por hilo sencillo', en: 'Graduated compression hosiery, knitted, of synthetic fibres < 67 dtex' } },
  { code: '611521', description: { es: 'Las demas medias de punto, de fibras sinteticas de titulo < 67 decitex', en: 'Other hosiery, knitted, of synthetic fibres < 67 dtex' } },
  { code: '611522', description: { es: 'Las demas medias de punto, de fibras sinteticas de titulo >= 67 decitex', en: 'Other hosiery, knitted, of synthetic fibres >= 67 dtex' } },
  { code: '611529', description: { es: 'Las demas medias de punto, de las demas materias textiles', en: 'Other hosiery, knitted, of other textile materials' } },
  { code: '611530', description: { es: 'Las demas medias de mujer, de titulo < 67 decitex por hilo sencillo', en: 'Other womens full-length or knee-length stockings, < 67 dtex' } },
  { code: '611594', description: { es: 'Los demas calcetines de punto, de lana o pelo fino', en: 'Other socks, knitted, of wool or fine animal hair' } },
  { code: '611595', description: { es: 'Los demas calcetines de punto, de algodon', en: 'Other socks, knitted, of cotton' } },
  { code: '611596', description: { es: 'Los demas calcetines de punto, de fibras sinteticas', en: 'Other socks, knitted, of synthetic fibres' } },
  { code: '611599', description: { es: 'Los demas calcetines de punto, de las demas materias textiles', en: 'Other socks, knitted, of other textile materials' } },
  { code: '611610', description: { es: 'Guantes de punto impregnados o recubiertos de plastico o caucho', en: 'Gloves, knitted, impregnated or coated with plastics or rubber' } },
  { code: '611691', description: { es: 'Los demas guantes de punto, de lana o pelo fino', en: 'Other gloves, knitted, of wool or fine animal hair' } },
  { code: '611692', description: { es: 'Los demas guantes de punto, de algodon', en: 'Other gloves, knitted, of cotton' } },
  { code: '611693', description: { es: 'Los demas guantes de punto, de fibras sinteticas', en: 'Other gloves, knitted, of synthetic fibres' } },
  { code: '611699', description: { es: 'Los demas guantes de punto, de las demas materias textiles', en: 'Other gloves, knitted, of other textile materials' } },
  { code: '611710', description: { es: 'Chales, pañuelos de cuello, bufandas y articulos similares, de punto', en: 'Shawls, scarves, mufflers, knitted' } },
  { code: '611780', description: { es: 'Los demas complementos de vestir de punto', en: 'Other clothing accessories, knitted' } },
  { code: '611790', description: { es: 'Partes de prendas o de complementos de vestir, de punto', en: 'Parts of garments or of clothing accessories, knitted' } },

  // =========================================================================
  // CHAPTER 62 SUBHEADINGS
  // =========================================================================
  { code: '620111', description: { es: 'Abrigos para hombres, de lana o pelo fino', en: 'Mens overcoats, of wool or fine animal hair' } },
  { code: '620112', description: { es: 'Abrigos para hombres, de algodon', en: 'Mens overcoats, of cotton' } },
  { code: '620113', description: { es: 'Abrigos para hombres, de fibras sinteticas o artificiales', en: 'Mens overcoats, of man-made fibres' } },
  { code: '620119', description: { es: 'Abrigos para hombres, de las demas materias textiles', en: 'Mens overcoats, of other textile materials' } },
  { code: '620211', description: { es: 'Abrigos para mujeres, de lana o pelo fino', en: 'Womens overcoats, of wool or fine animal hair' } },
  { code: '620212', description: { es: 'Abrigos para mujeres, de algodon', en: 'Womens overcoats, of cotton' } },
  { code: '620213', description: { es: 'Abrigos para mujeres, de fibras sinteticas o artificiales', en: 'Womens overcoats, of man-made fibres' } },
  { code: '620219', description: { es: 'Abrigos para mujeres, de las demas materias textiles', en: 'Womens overcoats, of other textile materials' } },
  { code: '620311', description: { es: 'Trajes para hombres, de lana o pelo fino', en: 'Mens suits, of wool or fine animal hair' } },
  { code: '620312', description: { es: 'Trajes para hombres, de fibras sinteticas', en: 'Mens suits, of synthetic fibres' } },
  { code: '620319', description: { es: 'Trajes para hombres, de las demas materias textiles', en: 'Mens suits, of other textile materials' } },
  { code: '620322', description: { es: 'Conjuntos para hombres, de algodon', en: 'Mens ensembles, of cotton' } },
  { code: '620323', description: { es: 'Conjuntos para hombres, de fibras sinteticas', en: 'Mens ensembles, of synthetic fibres' } },
  { code: '620331', description: { es: 'Chaquetas para hombres, de lana o pelo fino', en: 'Mens jackets, of wool or fine animal hair' } },
  { code: '620332', description: { es: 'Chaquetas para hombres, de algodon', en: 'Mens jackets, of cotton' } },
  { code: '620333', description: { es: 'Chaquetas para hombres, de fibras sinteticas', en: 'Mens jackets, of synthetic fibres' } },
  { code: '620339', description: { es: 'Chaquetas para hombres, de las demas materias textiles', en: 'Mens jackets, of other textile materials' } },
  { code: '620341', description: { es: 'Pantalones para hombres, de lana o pelo fino', en: 'Mens trousers, of wool or fine animal hair' } },
  { code: '620342', description: { es: 'Pantalones para hombres, de algodon', en: 'Mens trousers, of cotton' } },
  { code: '620343', description: { es: 'Pantalones para hombres, de fibras sinteticas', en: 'Mens trousers, of synthetic fibres' } },
  { code: '620349', description: { es: 'Pantalones para hombres, de las demas materias textiles', en: 'Mens trousers, of other textile materials' } },
  { code: '620411', description: { es: 'Trajes sastre para mujeres, de lana o pelo fino', en: 'Womens suits, of wool or fine animal hair' } },
  { code: '620412', description: { es: 'Trajes sastre para mujeres, de algodon', en: 'Womens suits, of cotton' } },
  { code: '620413', description: { es: 'Trajes sastre para mujeres, de fibras sinteticas', en: 'Womens suits, of synthetic fibres' } },
  { code: '620419', description: { es: 'Trajes sastre para mujeres, de las demas materias textiles', en: 'Womens suits, of other textile materials' } },
  { code: '620421', description: { es: 'Conjuntos para mujeres, de lana o pelo fino', en: 'Womens ensembles, of wool or fine animal hair' } },
  { code: '620422', description: { es: 'Conjuntos para mujeres, de algodon', en: 'Womens ensembles, of cotton' } },
  { code: '620423', description: { es: 'Conjuntos para mujeres, de fibras sinteticas', en: 'Womens ensembles, of synthetic fibres' } },
  { code: '620431', description: { es: 'Chaquetas para mujeres, de lana o pelo fino', en: 'Womens jackets, of wool or fine animal hair' } },
  { code: '620432', description: { es: 'Chaquetas para mujeres, de algodon', en: 'Womens jackets, of cotton' } },
  { code: '620433', description: { es: 'Chaquetas para mujeres, de fibras sinteticas', en: 'Womens jackets, of synthetic fibres' } },
  { code: '620441', description: { es: 'Vestidos de lana o pelo fino', en: 'Dresses, of wool or fine animal hair' } },
  { code: '620442', description: { es: 'Vestidos de algodon', en: 'Dresses, of cotton' } },
  { code: '620443', description: { es: 'Vestidos de fibras sinteticas', en: 'Dresses, of synthetic fibres' } },
  { code: '620444', description: { es: 'Vestidos de fibras artificiales', en: 'Dresses, of artificial fibres' } },
  { code: '620449', description: { es: 'Vestidos de las demas materias textiles', en: 'Dresses, of other textile materials' } },
  { code: '620451', description: { es: 'Faldas de lana o pelo fino', en: 'Skirts, of wool or fine animal hair' } },
  { code: '620452', description: { es: 'Faldas de algodon', en: 'Skirts, of cotton' } },
  { code: '620453', description: { es: 'Faldas de fibras sinteticas', en: 'Skirts, of synthetic fibres' } },
  { code: '620459', description: { es: 'Faldas de las demas materias textiles', en: 'Skirts, of other textile materials' } },
  { code: '620461', description: { es: 'Pantalones para mujeres, de lana o pelo fino', en: 'Womens trousers, of wool or fine animal hair' } },
  { code: '620462', description: { es: 'Pantalones para mujeres, de algodon', en: 'Womens trousers, of cotton' } },
  { code: '620463', description: { es: 'Pantalones para mujeres, de fibras sinteticas', en: 'Womens trousers, of synthetic fibres' } },
  { code: '620469', description: { es: 'Pantalones para mujeres, de las demas materias textiles', en: 'Womens trousers, of other textile materials' } },
  { code: '620510', description: { es: 'Camisas para hombres, de algodon', en: 'Mens shirts, of cotton' } },
  { code: '620520', description: { es: 'Camisas para hombres, de fibras sinteticas o artificiales', en: 'Mens shirts, of man-made fibres' } },
  { code: '620530', description: { es: 'Camisas para hombres, de lana o pelo fino', en: 'Mens shirts, of wool or fine animal hair' } },
  { code: '620590', description: { es: 'Camisas para hombres, de las demas materias textiles', en: 'Mens shirts, of other textile materials' } },
  { code: '620610', description: { es: 'Blusas para mujeres, de seda o desperdicios de seda', en: 'Womens blouses, of silk or silk waste' } },
  { code: '620620', description: { es: 'Blusas para mujeres, de lana o pelo fino', en: 'Womens blouses, of wool or fine animal hair' } },
  { code: '620630', description: { es: 'Blusas para mujeres, de algodon', en: 'Womens blouses, of cotton' } },
  { code: '620640', description: { es: 'Blusas para mujeres, de fibras sinteticas o artificiales', en: 'Womens blouses, of man-made fibres' } },
  { code: '620690', description: { es: 'Blusas para mujeres, de las demas materias textiles', en: 'Womens blouses, of other textile materials' } },
  { code: '620711', description: { es: 'Calzoncillos para hombres, de algodon', en: 'Mens underpants and briefs, of cotton' } },
  { code: '620719', description: { es: 'Calzoncillos para hombres, de las demas materias textiles', en: 'Mens underpants and briefs, of other textile materials' } },
  { code: '620721', description: { es: 'Camisones y pijamas para hombres, de algodon', en: 'Mens nightshirts and pyjamas, of cotton' } },
  { code: '620791', description: { es: 'Albornoces para hombres, de algodon', en: 'Mens bathrobes, dressing gowns, of cotton' } },
  { code: '620811', description: { es: 'Combinaciones y enaguas de fibras sinteticas o artificiales', en: 'Slips and petticoats, of man-made fibres' } },
  { code: '620821', description: { es: 'Camisones y pijamas para mujeres, de algodon', en: 'Womens nightdresses and pyjamas, of cotton' } },
  { code: '620891', description: { es: 'Bragas para mujeres, de algodon', en: 'Womens briefs and panties, of cotton' } },
  { code: '620910', description: { es: 'Prendas y complementos de vestir para bebes, de lana o pelo fino', en: 'Babies garments, of wool or fine animal hair' } },
  { code: '620920', description: { es: 'Prendas y complementos de vestir para bebes, de algodon', en: 'Babies garments, of cotton' } },
  { code: '620930', description: { es: 'Prendas y complementos de vestir para bebes, de fibras sinteticas', en: 'Babies garments, of synthetic fibres' } },
  { code: '620990', description: { es: 'Prendas y complementos de vestir para bebes, de las demas materias textiles', en: 'Babies garments, of other textile materials' } },
  { code: '621010', description: { es: 'Prendas de vestir con productos de las partidas 5602 o 5603', en: 'Garments of fabrics of heading 5602 or 5603' } },
  { code: '621020', description: { es: 'Las demas prendas del tipo abrigos, impermeables', en: 'Other overcoats, raincoats, etc.' } },
  { code: '621030', description: { es: 'Las demas prendas del tipo gabardinas', en: 'Other garments of the type described in headings 6201 to 6202' } },
  { code: '621040', description: { es: 'Las demas prendas para hombres o niños', en: 'Other mens or boys garments' } },
  { code: '621050', description: { es: 'Las demas prendas para mujeres o niñas', en: 'Other womens or girls garments' } },
  { code: '621111', description: { es: 'Bañadores para hombres', en: 'Mens swimwear' } },
  { code: '621112', description: { es: 'Bañadores para mujeres', en: 'Womens swimwear' } },
  { code: '621120', description: { es: 'Monos y conjuntos de esqui', en: 'Ski suits' } },
  { code: '621132', description: { es: 'Las demas prendas para hombres, de algodon', en: 'Other mens garments, of cotton' } },
  { code: '621133', description: { es: 'Las demas prendas para hombres, de fibras sinteticas o artificiales', en: 'Other mens garments, of man-made fibres' } },
  { code: '621142', description: { es: 'Las demas prendas para mujeres, de algodon', en: 'Other womens garments, of cotton' } },
  { code: '621143', description: { es: 'Las demas prendas para mujeres, de fibras sinteticas o artificiales', en: 'Other womens garments, of man-made fibres' } },
  { code: '621210', description: { es: 'Sostenes y sus partes', en: 'Brassieres and parts thereof' } },
  { code: '621220', description: { es: 'Fajas y fajas-braga', en: 'Girdles and panty-girdles' } },
  { code: '621230', description: { es: 'Fajas-corses', en: 'Corselettes' } },
  { code: '621290', description: { es: 'Los demas (corses, tirantes, ligas y articulos similares)', en: 'Other (corsets, braces, garters and similar articles)' } },
  { code: '621310', description: { es: 'Pañuelos de bolsillo, de seda o desperdicios de seda', en: 'Handkerchiefs, of silk or silk waste' } },
  { code: '621320', description: { es: 'Pañuelos de bolsillo, de algodon', en: 'Handkerchiefs, of cotton' } },
  { code: '621390', description: { es: 'Pañuelos de bolsillo, de las demas materias textiles', en: 'Handkerchiefs, of other textile materials' } },
  { code: '621410', description: { es: 'Chales, pañuelos de cuello y similares, de seda o desperdicios de seda', en: 'Shawls, scarves, of silk or silk waste' } },
  { code: '621420', description: { es: 'Chales, pañuelos de cuello y similares, de lana o pelo fino', en: 'Shawls, scarves, of wool or fine animal hair' } },
  { code: '621430', description: { es: 'Chales, pañuelos de cuello y similares, de fibras sinteticas', en: 'Shawls, scarves, of synthetic fibres' } },
  { code: '621440', description: { es: 'Chales, pañuelos de cuello y similares, de fibras artificiales', en: 'Shawls, scarves, of artificial fibres' } },
  { code: '621490', description: { es: 'Chales, pañuelos de cuello y similares, de las demas materias textiles', en: 'Shawls, scarves, of other textile materials' } },
  { code: '621510', description: { es: 'Corbatas de seda o desperdicios de seda', en: 'Ties, of silk or silk waste' } },
  { code: '621520', description: { es: 'Corbatas de fibras sinteticas o artificiales', en: 'Ties, of man-made fibres' } },
  { code: '621590', description: { es: 'Corbatas de las demas materias textiles', en: 'Ties, of other textile materials' } },
  { code: '621600', description: { es: 'Guantes, mitones y manoplas', en: 'Gloves, mittens and mitts' } },
  { code: '621710', description: { es: 'Los demas complementos de vestir confeccionados', en: 'Other made-up clothing accessories' } },
  { code: '621790', description: { es: 'Partes de prendas o de complementos de vestir', en: 'Parts of garments or of clothing accessories' } },

  // =========================================================================
  // CHAPTER 64 SUBHEADINGS
  // =========================================================================
  { code: '640110', description: { es: 'Calzado impermeable con puntera metalica de proteccion', en: 'Waterproof footwear incorporating a protective metal toe-cap' } },
  { code: '640192', description: { es: 'Calzado impermeable que cubra la rodilla', en: 'Waterproof footwear covering the knee' } },
  { code: '640199', description: { es: 'Los demas calzados impermeables', en: 'Other waterproof footwear' } },
  { code: '640212', description: { es: 'Calzado de esqui y calzado para la practica del snowboard, de caucho o plastico', en: 'Ski-boots and cross-country ski footwear and snowboard boots, of rubber or plastics' } },
  { code: '640219', description: { es: 'Los demas calzados de deporte de caucho o plastico', en: 'Other sports footwear, of rubber or plastics' } },
  { code: '640220', description: { es: 'Calzado con la parte superior de tiras o bridas fijadas a la suela por tetones', en: 'Footwear with upper straps or thongs assembled to the sole by means of plugs' } },
  { code: '640291', description: { es: 'Los demas calzados de caucho o plastico que cubran el tobillo', en: 'Other footwear of rubber or plastics, covering the ankle' } },
  { code: '640299', description: { es: 'Los demas calzados de caucho o plastico', en: 'Other footwear of rubber or plastics' } },
  { code: '640312', description: { es: 'Calzado de esqui y calzado para snowboard, con suela de caucho, plastico o cuero y parte superior de cuero', en: 'Ski-boots, cross-country ski footwear and snowboard boots, uppers of leather' } },
  { code: '640319', description: { es: 'Los demas calzados de deporte con suela de caucho, plastico o cuero y parte superior de cuero', en: 'Other sports footwear with outer soles of rubber, plastics or leather and uppers of leather' } },
  { code: '640320', description: { es: 'Calzado con suela de cuero y parte superior de tiras de cuero que pasan por el empeine y rodean el dedo gordo', en: 'Footwear with outer soles of leather, uppers which consist of leather straps across the instep and around the big toe' } },
  { code: '640340', description: { es: 'Los demas calzados con puntera metalica de proteccion', en: 'Other footwear, incorporating a protective metal toe-cap' } },
  { code: '640351', description: { es: 'Los demas calzados con parte superior de cuero que cubran el tobillo', en: 'Other footwear with uppers of leather, covering the ankle' } },
  { code: '640359', description: { es: 'Los demas calzados con parte superior de cuero', en: 'Other footwear with uppers of leather' } },
  { code: '640391', description: { es: 'Los demas calzados que cubran el tobillo', en: 'Other footwear, covering the ankle' } },
  { code: '640399', description: { es: 'Los demas calzados con suela de caucho, plastico o cuero', en: 'Other footwear with outer soles of rubber, plastics or leather' } },
  { code: '640411', description: { es: 'Calzado de deporte, incluido el de tenis, baloncesto, gimnasia, entrenamiento y calzados similares, con suela de caucho o plastico y parte superior de materia textil', en: 'Sports footwear, tennis shoes, basketball shoes, gym shoes, training shoes, with outer soles of rubber or plastics and uppers of textile materials' } },
  { code: '640419', description: { es: 'Los demas calzados con suela de caucho o plastico y parte superior de materia textil', en: 'Other footwear with outer soles of rubber or plastics and uppers of textile materials' } },
  { code: '640420', description: { es: 'Calzado con suela de cuero natural o regenerado y parte superior de materia textil', en: 'Footwear with outer soles of leather and uppers of textile materials' } },
  { code: '640510', description: { es: 'Los demas calzados con parte superior de cuero natural o regenerado', en: 'Other footwear with uppers of leather or composition leather' } },
  { code: '640520', description: { es: 'Los demas calzados con parte superior de materia textil', en: 'Other footwear with uppers of textile materials' } },
  { code: '640590', description: { es: 'Los demas calzados', en: 'Other footwear' } },
  { code: '640610', description: { es: 'Partes superiores de calzado y sus partes, excepto los contrafuertes y punteras duras', en: 'Uppers and parts thereof, other than stiffeners' } },
  { code: '640620', description: { es: 'Suelas y tacones, de caucho o plastico', en: 'Outer soles and heels, of rubber or plastics' } },
  { code: '640690', description: { es: 'Las demas partes de calzado; plantillas amovibles, taloneras y articulos similares; polainas, botines y articulos similares, y sus partes', en: 'Other parts of footwear; removable in-soles, heel cushions; gaiters, leggings and similar articles, and parts thereof' } },

  // =========================================================================
  // CHAPTER 84 SUBHEADINGS (key headings)
  // =========================================================================
  { code: '841510', description: { es: 'Acondicionadores de aire de pared o de ventana, formando un solo cuerpo', en: 'Window or wall air conditioning machines, self-contained' } },
  { code: '841520', description: { es: 'Acondicionadores de aire del tipo de los utilizados en vehiculos automoviles', en: 'Air conditioning machines, of a kind used for persons, in motor vehicles' } },
  { code: '841581', description: { es: 'Los demas acondicionadores con dispositivo de enfriamiento y valvula de inversion del ciclo termico', en: 'Other air conditioning machines incorporating a refrigerating unit and a valve for reversal of the cooling/heat cycle' } },
  { code: '841582', description: { es: 'Los demas acondicionadores con dispositivo de enfriamiento', en: 'Other air conditioning machines incorporating a refrigerating unit' } },
  { code: '841583', description: { es: 'Los demas acondicionadores sin dispositivo de enfriamiento', en: 'Other air conditioning machines not incorporating a refrigerating unit' } },
  { code: '841590', description: { es: 'Partes de acondicionadores de aire', en: 'Parts of air conditioning machines' } },
  { code: '841810', description: { es: 'Combinaciones de refrigerador y congelador con puertas exteriores separadas', en: 'Combined refrigerator-freezers, fitted with separate external doors' } },
  { code: '841821', description: { es: 'Refrigeradores domesticos de compresion', en: 'Household type refrigerators, compression-type' } },
  { code: '841829', description: { es: 'Los demas refrigeradores domesticos', en: 'Other household type refrigerators' } },
  { code: '841830', description: { es: 'Congeladores horizontales del tipo arca, de capacidad <= 800 l', en: 'Chest type freezers, <= 800 l capacity' } },
  { code: '841840', description: { es: 'Congeladores verticales del tipo armario, de capacidad <= 900 l', en: 'Upright freezers, <= 900 l capacity' } },
  { code: '841850', description: { es: 'Los demas muebles (arcas, armarios, vitrinas, mostradores y similares) para la conservacion y exposicion de productos con equipo de frio', en: 'Other furniture for storage and display, incorporating refrigerating or freezing equipment' } },
  { code: '841861', description: { es: 'Bombas de calor, excepto las de acondicionamiento de aire de la partida 8415', en: 'Heat pumps other than air conditioning machines of heading 8415' } },
  { code: '841869', description: { es: 'Los demas aparatos de frio', en: 'Other refrigerating or freezing equipment' } },
  { code: '841891', description: { es: 'Muebles concebidos para incorporarles un equipo de produccion de frio', en: 'Furniture designed to receive refrigerating or freezing equipment' } },
  { code: '841899', description: { es: 'Las demas partes de equipos de frio', en: 'Other parts of refrigerating or freezing equipment' } },
  { code: '844311', description: { es: 'Maquinas y aparatos de impresion ofsset, alimentados con bobinas', en: 'Offset printing machinery, reel-fed' } },
  { code: '844312', description: { es: 'Maquinas y aparatos de impresion ofsset, alimentados con hojas de formato <= 22 x 36 cm', en: 'Offset printing machinery, sheet-fed, office type' } },
  { code: '844313', description: { es: 'Las demas maquinas y aparatos de impresion ofsset', en: 'Other offset printing machinery' } },
  { code: '844331', description: { es: 'Maquinas que efectuan dos o mas de las funciones de impresion, copia o fax, aptas para ser conectadas a una maquina de tratamiento de datos o a una red', en: 'Machines which perform two or more of the functions of printing, copying or facsimile transmission, capable of connecting to an ADP machine or to a network' } },
  { code: '844332', description: { es: 'Las demas impresoras, copiadoras y aparatos de fax, aptas para ser conectadas a una maquina de tratamiento de datos o a una red', en: 'Other, capable of connecting to an automatic data processing machine or to a network' } },
  { code: '844339', description: { es: 'Las demas impresoras, copiadoras y aparatos de fax', en: 'Other printers, copying machines and facsimile machines' } },
  { code: '845011', description: { es: 'Maquinas de lavar ropa totalmente automaticas de capacidad <= 10 kg', en: 'Fully-automatic household washing machines, capacity <= 10 kg' } },
  { code: '845012', description: { es: 'Las demas maquinas de lavar ropa con secadora centrifuga incorporada, de capacidad <= 10 kg', en: 'Other household washing machines, with built-in centrifugal drier, capacity <= 10 kg' } },
  { code: '845019', description: { es: 'Las demas maquinas de lavar ropa de capacidad <= 10 kg', en: 'Other household washing machines, capacity <= 10 kg' } },
  { code: '845020', description: { es: 'Maquinas de lavar ropa de capacidad > 10 kg', en: 'Washing machines, capacity > 10 kg' } },
  { code: '845090', description: { es: 'Partes de maquinas de lavar ropa', en: 'Parts of washing machines' } },
  { code: '847110', description: { es: 'Maquinas automaticas para tratamiento o procesamiento de datos, analogicas o hibridas', en: 'Analogue or hybrid automatic data-processing machines' } },
  { code: '847130', description: { es: 'Maquinas automaticas para tratamiento o procesamiento de datos, digitales, portatiles, de peso <= 10 kg, con al menos una CPU, un teclado y un visualizador', en: 'Portable digital automatic data-processing machines, weighing <= 10 kg, with CPU, keyboard and display' } },
  { code: '847141', description: { es: 'Las demas maquinas automaticas para tratamiento de datos digitales con en la misma envoltura al menos una CPU y una unidad de entrada y una de salida', en: 'Other digital ADP machines comprising in the same housing at least a CPU and an input and output unit' } },
  { code: '847149', description: { es: 'Las demas maquinas automaticas para tratamiento de datos digitales, presentadas en forma de sistemas', en: 'Other digital ADP machines, presented in the form of systems' } },
  { code: '847150', description: { es: 'Unidades de proceso digitales distintas de las de las subpartidas 847141 u 847149, aunque incluyan en la misma envoltura uno o dos de los tipos de unidades siguientes: unidad de memoria, unidad de entrada y unidad de salida', en: 'Digital processing units other than those of 847141 or 847149' } },
  { code: '847160', description: { es: 'Unidades de entrada o de salida, aunque incluyan unidades de memoria en la misma envoltura', en: 'Input or output units, whether or not containing storage units' } },
  { code: '847170', description: { es: 'Unidades de memoria', en: 'Storage units' } },
  { code: '847180', description: { es: 'Las demas unidades de maquinas automaticas para tratamiento o procesamiento de datos', en: 'Other units of automatic data-processing machines' } },
  { code: '847190', description: { es: 'Los demas aparatos de la partida 8471', en: 'Other apparatus of heading 8471' } },
  { code: '847910', description: { es: 'Maquinas y aparatos para obras publicas, la construccion o trabajos analogos', en: 'Machinery for public works, building or the like' } },
  { code: '847920', description: { es: 'Maquinas y aparatos para la extraccion o preparacion de grasas o aceites vegetales fijos o de origen animal', en: 'Machinery for the extraction or preparation of animal or fixed vegetable fats or oils' } },
  { code: '847930', description: { es: 'Prensas para la fabricacion de tableros de particulas, fibra de madera o de otras materias leñosas', en: 'Presses for the manufacture of particle board, fibre board, or similar boards of wood or other ligneous materials' } },
  { code: '847940', description: { es: 'Maquinas para fabricar corderia o cables', en: 'Rope or cable-making machines' } },
  { code: '847950', description: { es: 'Robots industriales, no expresados ni comprendidos en otra parte', en: 'Industrial robots, not elsewhere specified or included' } },
  { code: '847960', description: { es: 'Aparatos de evaporacion para refrigerar el aire', en: 'Evaporative air coolers' } },
  { code: '847971', description: { es: 'Pasarelas de embarque para pasajeros', en: 'Passenger boarding bridges' } },
  { code: '847979', description: { es: 'Las demas maquinas y aparatos mecanicos', en: 'Other machines and mechanical appliances' } },
  { code: '847981', description: { es: 'Maquinas para tratamiento de metales, incluidas las bobinadoras de hilos electricos', en: 'Machines for treating metal, including electric wire coil-winding machines' } },
  { code: '847982', description: { es: 'Maquinas de mezclar, amasar, quebrantar, triturar, cribar, tamizar, homogeneizar, emulsionar o agitar', en: 'Machines for mixing, kneading, crushing, grinding, screening, sifting, homogenising, emulsifying or stirring' } },
  { code: '847989', description: { es: 'Las demas maquinas y aparatos mecanicos con funcion propia', en: 'Other machines and mechanical appliances having individual functions' } },
  { code: '847990', description: { es: 'Partes de maquinas y aparatos de la partida 8479', en: 'Parts of machines and apparatus of heading 8479' } },

  // =========================================================================
  // CHAPTER 85 SUBHEADINGS (key headings)
  // =========================================================================
  { code: '850431', description: { es: 'Transformadores de potencia <= 1 kVA', en: 'Transformers having a power handling capacity <= 1 kVA' } },
  { code: '850432', description: { es: 'Transformadores de potencia > 1 kVA y <= 16 kVA', en: 'Transformers having a power handling capacity > 1 kVA but <= 16 kVA' } },
  { code: '850433', description: { es: 'Transformadores de potencia > 16 kVA y <= 500 kVA', en: 'Transformers having a power handling capacity > 16 kVA but <= 500 kVA' } },
  { code: '850434', description: { es: 'Transformadores de potencia > 500 kVA', en: 'Transformers having a power handling capacity > 500 kVA' } },
  { code: '850440', description: { es: 'Convertidores estaticos', en: 'Static converters' } },
  { code: '850450', description: { es: 'Las demas bobinas de reactancia (inductores)', en: 'Other inductors' } },
  { code: '850490', description: { es: 'Partes de transformadores, convertidores e inductores', en: 'Parts of transformers, static converters and inductors' } },
  { code: '850610', description: { es: 'Pilas de dioxido de manganeso', en: 'Manganese dioxide primary cells and batteries' } },
  { code: '850630', description: { es: 'Pilas de oxido de mercurio', en: 'Mercuric oxide primary cells and batteries' } },
  { code: '850650', description: { es: 'Pilas de litio', en: 'Lithium primary cells and batteries' } },
  { code: '850660', description: { es: 'Pilas de aire-cinc', en: 'Air-zinc primary cells and batteries' } },
  { code: '850690', description: { es: 'Las demas pilas y baterias de pilas', en: 'Other primary cells and primary batteries' } },
  { code: '850710', description: { es: 'Acumuladores electricos de plomo, del tipo de los utilizados para el arranque de motores de embolo', en: 'Lead-acid accumulators, for starting piston engines' } },
  { code: '850720', description: { es: 'Los demas acumuladores de plomo', en: 'Other lead-acid accumulators' } },
  { code: '850730', description: { es: 'Acumuladores de niquel-cadmio', en: 'Nickel-cadmium accumulators' } },
  { code: '850740', description: { es: 'Acumuladores de niquel-hierro', en: 'Nickel-iron accumulators' } },
  { code: '850750', description: { es: 'Acumuladores de niquel-hidruro metalico', en: 'Nickel-metal hydride accumulators' } },
  { code: '850760', description: { es: 'Acumuladores de iones de litio', en: 'Lithium-ion accumulators' } },
  { code: '850790', description: { es: 'Los demas acumuladores', en: 'Other accumulators' } },
  { code: '851711', description: { es: 'Telefonos fijos con auricular inalambrico', en: 'Line telephone sets with cordless handsets' } },
  { code: '851712', description: { es: 'Telefonos moviles (celulares) y los de otras redes inalambricas', en: 'Telephones for cellular networks or for other wireless networks' } },
  { code: '851713', description: { es: 'Telefonos inteligentes', en: 'Smartphones' } },
  { code: '851714', description: { es: 'Los demas telefonos moviles', en: 'Other telephones for cellular networks or other wireless networks' } },
  { code: '851718', description: { es: 'Los demas aparatos telefonicos', en: 'Other telephone sets' } },
  { code: '851761', description: { es: 'Estaciones base', en: 'Base stations' } },
  { code: '851762', description: { es: 'Maquinas para la recepcion, conversion y transmision o regeneracion de voz, imagenes u otros datos', en: 'Machines for the reception, conversion and transmission or regeneration of voice, images or other data' } },
  { code: '851769', description: { es: 'Los demas aparatos de telecomunicacion', en: 'Other telecommunication apparatus' } },
  { code: '851770', description: { es: 'Partes de aparatos telefonicos y de telecomunicacion', en: 'Parts of telephone sets and other telecommunication apparatus' } },
  { code: '852340', description: { es: 'Soportes opticos para grabacion de sonido u otras señales', en: 'Optical media for the recording of sound or of other phenomena' } },
  { code: '852351', description: { es: 'Dispositivos de almacenamiento permanente de datos a base de semiconductores (memorias flash)', en: 'Solid-state non-volatile storage devices (flash memory)' } },
  { code: '852352', description: { es: 'Tarjetas inteligentes', en: 'Smart cards' } },
  { code: '852380', description: { es: 'Los demas soportes para grabacion', en: 'Other recording media' } },
  { code: '852410', description: { es: 'Modulos de visualizacion de pantalla plana de cristal liquido', en: 'Flat panel display modules, LCD' } },
  { code: '852491', description: { es: 'Los demas modulos de visualizacion de pantalla plana, de diodos emisores de luz organicos (OLED)', en: 'Other flat panel display modules, OLED' } },
  { code: '852499', description: { es: 'Los demas modulos de visualizacion de pantalla plana', en: 'Other flat panel display modules' } },
  { code: '852580', description: { es: 'Camaras de television, camaras digitales y camaras de video', en: 'Television cameras, digital cameras and video camera recorders' } },
  { code: '852841', description: { es: 'Monitores con tubo de rayos catodicos', en: 'Cathode-ray tube monitors' } },
  { code: '852849', description: { es: 'Los demas monitores', en: 'Other monitors' } },
  { code: '852851', description: { es: 'Los demas monitores de pantalla plana capaces de visualizar señales de maquinas de tratamiento de datos', en: 'Other monitors capable of directly displaying signals from ADP machines' } },
  { code: '852852', description: { es: 'Los demas monitores, otros', en: 'Other monitors' } },
  { code: '852859', description: { es: 'Los demas proyectores', en: 'Other projectors' } },
  { code: '852871', description: { es: 'Aparatos receptores de television sin pantalla de visualizacion de video incorporada', en: 'Television reception apparatus, not incorporating a video display' } },
  { code: '852872', description: { es: 'Los demas aparatos receptores de television en colores', en: 'Other colour television receivers' } },
  { code: '852873', description: { es: 'Los demas aparatos receptores de television en blanco y negro u otros monocromo', en: 'Other monochrome television receivers' } },
  { code: '854110', description: { es: 'Diodos, excepto los fotodiodos y los diodos emisores de luz', en: 'Diodes, other than photosensitive or light-emitting diodes' } },
  { code: '854121', description: { es: 'Transistores, excepto los fototransistores, con una capacidad de disipacion < 1 W', en: 'Transistors, other than photosensitive, with a dissipation rate < 1 W' } },
  { code: '854129', description: { es: 'Los demas transistores', en: 'Other transistors' } },
  { code: '854130', description: { es: 'Tiristores, diacs y triacs, excepto los dispositivos fotosensibles', en: 'Thyristors, diacs and triacs, other than photosensitive devices' } },
  { code: '854140', description: { es: 'Dispositivos fotosensibles semiconductores; diodos emisores de luz; celulas fotovoltaicas', en: 'Photosensitive semiconductor devices; LEDs; photovoltaic cells' } },
  { code: '854150', description: { es: 'Los demas dispositivos semiconductores', en: 'Other semiconductor devices' } },
  { code: '854160', description: { es: 'Cristales piezoelectricos montados', en: 'Mounted piezo-electric crystals' } },
  { code: '854190', description: { es: 'Partes de dispositivos semiconductores', en: 'Parts of semiconductor devices' } },
  { code: '854231', description: { es: 'Procesadores y controladores', en: 'Processors and controllers' } },
  { code: '854232', description: { es: 'Memorias', en: 'Memories' } },
  { code: '854233', description: { es: 'Amplificadores', en: 'Amplifiers' } },
  { code: '854239', description: { es: 'Los demas circuitos integrados', en: 'Other electronic integrated circuits' } },
  { code: '854290', description: { es: 'Partes de circuitos integrados', en: 'Parts of electronic integrated circuits' } },
  { code: '854411', description: { es: 'Alambre para bobinar, de cobre', en: 'Winding wire, of copper' } },
  { code: '854419', description: { es: 'Los demas alambres para bobinar', en: 'Other winding wire' } },
  { code: '854420', description: { es: 'Cables coaxiales y demas conductores electricos coaxiales', en: 'Co-axial cable and other co-axial electric conductors' } },
  { code: '854430', description: { es: 'Juegos de cables para bujias de encendido y demas juegos de cables del tipo de los utilizados en los medios de transporte', en: 'Ignition wiring sets and other wiring sets used in vehicles, aircraft or ships' } },
  { code: '854442', description: { es: 'Los demas conductores electricos, para una tension <= 1000 V, provistos de piezas de conexion', en: 'Other electric conductors, for a voltage <= 1,000 V, fitted with connectors' } },
  { code: '854449', description: { es: 'Los demas conductores electricos, para una tension <= 1000 V', en: 'Other electric conductors, for a voltage <= 1,000 V' } },
  { code: '854460', description: { es: 'Los demas conductores electricos, para una tension > 1000 V', en: 'Other electric conductors, for a voltage > 1,000 V' } },
  { code: '854470', description: { es: 'Cables de fibras opticas', en: 'Optical fibre cables' } },

  // =========================================================================
  // CHAPTER 87 SUBHEADINGS
  // =========================================================================
  { code: '870110', description: { es: 'Tractores de un solo eje', en: 'Pedestrian controlled tractors' } },
  { code: '870120', description: { es: 'Tractores de carretera para semirremolques', en: 'Road tractors for semi-trailers' } },
  { code: '870130', description: { es: 'Tractores de orugas', en: 'Track-laying tractors' } },
  { code: '870191', description: { es: 'Los demas tractores, de potencia <= 18 kW', en: 'Other tractors, of an engine power <= 18 kW' } },
  { code: '870192', description: { es: 'Los demas tractores, de potencia > 18 kW pero <= 37 kW', en: 'Other tractors, of an engine power > 18 kW but <= 37 kW' } },
  { code: '870193', description: { es: 'Los demas tractores, de potencia > 37 kW pero <= 75 kW', en: 'Other tractors, of an engine power > 37 kW but <= 75 kW' } },
  { code: '870194', description: { es: 'Los demas tractores, de potencia > 75 kW pero <= 130 kW', en: 'Other tractors, of an engine power > 75 kW but <= 130 kW' } },
  { code: '870195', description: { es: 'Los demas tractores, de potencia > 130 kW', en: 'Other tractors, of an engine power > 130 kW' } },
  { code: '870210', description: { es: 'Vehiculos para 10+ personas, con motor de embolo de encendido por compresion (diesel)', en: 'Motor vehicles for 10+ persons, with diesel engine' } },
  { code: '870220', description: { es: 'Vehiculos para 10+ personas, con motor de embolo de encendido por chispa y motor electrico', en: 'Motor vehicles for 10+ persons, with both spark-ignition engine and electric motor' } },
  { code: '870230', description: { es: 'Vehiculos para 10+ personas, con motor de embolo de encendido por compresion y motor electrico', en: 'Motor vehicles for 10+ persons, with both diesel engine and electric motor' } },
  { code: '870240', description: { es: 'Vehiculos para 10+ personas, unicamente con motor electrico para la propulsion', en: 'Motor vehicles for 10+ persons, with only electric motor for propulsion' } },
  { code: '870290', description: { es: 'Los demas vehiculos para 10+ personas', en: 'Other motor vehicles for 10+ persons' } },
  { code: '870310', description: { es: 'Vehiculos especialmente concebidos para desplazarse sobre la nieve; vehiculos para el transporte de personas en los campos de golf', en: 'Vehicles specially designed for travelling on snow; golf cars and similar vehicles' } },
  { code: '870321', description: { es: 'Vehiculos con motor de encendido por chispa, de cilindrada <= 1000 cm3', en: 'Vehicles with spark-ignition engine, of a cylinder capacity <= 1,000 cc' } },
  { code: '870322', description: { es: 'Vehiculos con motor de encendido por chispa, de cilindrada > 1000 cm3 pero <= 1500 cm3', en: 'Vehicles with spark-ignition engine, of a cylinder capacity > 1,000 cc but <= 1,500 cc' } },
  { code: '870323', description: { es: 'Vehiculos con motor de encendido por chispa, de cilindrada > 1500 cm3 pero <= 3000 cm3', en: 'Vehicles with spark-ignition engine, of a cylinder capacity > 1,500 cc but <= 3,000 cc' } },
  { code: '870324', description: { es: 'Vehiculos con motor de encendido por chispa, de cilindrada > 3000 cm3', en: 'Vehicles with spark-ignition engine, of a cylinder capacity > 3,000 cc' } },
  { code: '870331', description: { es: 'Vehiculos con motor diesel, de cilindrada <= 1500 cm3', en: 'Vehicles with diesel engine, of a cylinder capacity <= 1,500 cc' } },
  { code: '870332', description: { es: 'Vehiculos con motor diesel, de cilindrada > 1500 cm3 pero <= 2500 cm3', en: 'Vehicles with diesel engine, of a cylinder capacity > 1,500 cc but <= 2,500 cc' } },
  { code: '870333', description: { es: 'Vehiculos con motor diesel, de cilindrada > 2500 cm3', en: 'Vehicles with diesel engine, of a cylinder capacity > 2,500 cc' } },
  { code: '870340', description: { es: 'Vehiculos con motor de encendido por chispa y motor electrico, excepto los que se puedan cargar por conexion a fuente externa', en: 'Vehicles with spark-ignition engine and electric motor, not capable of being charged from external source' } },
  { code: '870350', description: { es: 'Vehiculos con motor diesel y motor electrico, excepto los que se puedan cargar por conexion a fuente externa', en: 'Vehicles with diesel engine and electric motor, not capable of being charged from external source' } },
  { code: '870360', description: { es: 'Vehiculos con motor de encendido por chispa y motor electrico, que se puedan cargar por conexion a fuente externa de energia electrica', en: 'Vehicles with spark-ignition engine and electric motor, capable of being charged from external source (plug-in hybrid)' } },
  { code: '870370', description: { es: 'Vehiculos con motor diesel y motor electrico, que se puedan cargar por conexion a fuente externa de energia electrica', en: 'Vehicles with diesel engine and electric motor, capable of being charged from external source (plug-in hybrid)' } },
  { code: '870380', description: { es: 'Los demas vehiculos, con motor electrico unicamente para la propulsion', en: 'Other vehicles, with only electric motor for propulsion' } },
  { code: '870390', description: { es: 'Los demas vehiculos de turismo', en: 'Other motor cars' } },
  { code: '870410', description: { es: 'Volquetes automotores concebidos para utilizarlos fuera de la red de carreteras', en: 'Dumpers designed for off-highway use' } },
  { code: '870421', description: { es: 'Vehiculos para transporte de mercancias con motor diesel, de peso total con carga maxima <= 5 t', en: 'Motor vehicles for transport of goods, diesel engine, gross vehicle weight <= 5 tonnes' } },
  { code: '870422', description: { es: 'Vehiculos para transporte de mercancias con motor diesel, de peso total > 5 t pero <= 20 t', en: 'Motor vehicles for transport of goods, diesel engine, gross vehicle weight > 5 but <= 20 tonnes' } },
  { code: '870423', description: { es: 'Vehiculos para transporte de mercancias con motor diesel, de peso total > 20 t', en: 'Motor vehicles for transport of goods, diesel engine, gross vehicle weight > 20 tonnes' } },
  { code: '870431', description: { es: 'Vehiculos para transporte de mercancias con motor de encendido por chispa, de peso total <= 5 t', en: 'Motor vehicles for transport of goods, spark-ignition engine, gross vehicle weight <= 5 tonnes' } },
  { code: '870432', description: { es: 'Vehiculos para transporte de mercancias con motor de encendido por chispa, de peso total > 5 t', en: 'Motor vehicles for transport of goods, spark-ignition engine, gross vehicle weight > 5 tonnes' } },
  { code: '870441', description: { es: 'Vehiculos para transporte de mercancias con motor diesel y motor electrico, de peso total <= 5 t', en: 'Motor vehicles for transport of goods, diesel and electric motor, gross vehicle weight <= 5 tonnes' } },
  { code: '870442', description: { es: 'Vehiculos para transporte de mercancias con motor diesel y motor electrico, de peso total > 5 t pero <= 20 t', en: 'Motor vehicles for transport of goods, diesel and electric motor, gross vehicle weight > 5 but <= 20 tonnes' } },
  { code: '870443', description: { es: 'Vehiculos para transporte de mercancias con motor diesel y motor electrico, de peso total > 20 t', en: 'Motor vehicles for transport of goods, diesel and electric motor, gross vehicle weight > 20 tonnes' } },
  { code: '870451', description: { es: 'Vehiculos para transporte de mercancias con motor de encendido por chispa y motor electrico, de peso total <= 5 t', en: 'Motor vehicles for transport of goods, spark-ignition and electric motor, gross vehicle weight <= 5 tonnes' } },
  { code: '870460', description: { es: 'Vehiculos para transporte de mercancias propulsados unicamente con motor electrico', en: 'Motor vehicles for transport of goods, with only electric motor for propulsion' } },
  { code: '870490', description: { es: 'Los demas vehiculos para transporte de mercancias', en: 'Other motor vehicles for the transport of goods' } },
  { code: '870810', description: { es: 'Parachoques y sus partes', en: 'Bumpers and parts thereof' } },
  { code: '870821', description: { es: 'Cinturones de seguridad', en: 'Safety seat belts' } },
  { code: '870822', description: { es: 'Parabrisas, ventanillas y demas lunas', en: 'Windscreens, rear windows and other windows' } },
  { code: '870829', description: { es: 'Las demas partes y accesorios de carroceria', en: 'Other parts and accessories of bodies' } },
  { code: '870830', description: { es: 'Frenos y servofrenos, y sus partes', en: 'Brakes and servo-brakes, and parts thereof' } },
  { code: '870840', description: { es: 'Cajas de cambio y sus partes', en: 'Gear boxes and parts thereof' } },
  { code: '870850', description: { es: 'Ejes con diferencial y sus partes, y ejes portadores y sus partes', en: 'Drive-axles with differential, and parts thereof; non-driving axles and parts thereof' } },
  { code: '870870', description: { es: 'Ruedas, sus partes y accesorios', en: 'Road wheels and parts and accessories thereof' } },
  { code: '870880', description: { es: 'Amortiguadores de suspension', en: 'Suspension shock-absorbers' } },
  { code: '870891', description: { es: 'Radiadores y sus partes', en: 'Radiators and parts thereof' } },
  { code: '870892', description: { es: 'Silenciadores y tubos de escape; sus partes', en: 'Silencers (mufflers) and exhaust pipes; parts thereof' } },
  { code: '870893', description: { es: 'Embragues y sus partes', en: 'Clutches and parts thereof' } },
  { code: '870894', description: { es: 'Volantes, columnas y cajas de direccion; sus partes', en: 'Steering wheels, steering columns and steering boxes; parts thereof' } },
  { code: '870895', description: { es: 'Bolsas inflables de seguridad con sistema de inflado (airbag); sus partes', en: 'Safety airbags with inflater system; parts thereof' } },
  { code: '870899', description: { es: 'Las demas partes y accesorios', en: 'Other parts and accessories' } },
  { code: '871110', description: { es: 'Motocicletas con motor de embolo de cilindrada <= 50 cm3', en: 'Motorcycles, with reciprocating piston engine of a cylinder capacity <= 50 cc' } },
  { code: '871120', description: { es: 'Motocicletas con motor de embolo de cilindrada > 50 cm3 pero <= 250 cm3', en: 'Motorcycles, with reciprocating piston engine of a cylinder capacity > 50 cc but <= 250 cc' } },
  { code: '871130', description: { es: 'Motocicletas con motor de embolo de cilindrada > 250 cm3 pero <= 500 cm3', en: 'Motorcycles, with reciprocating piston engine of a cylinder capacity > 250 cc but <= 500 cc' } },
  { code: '871140', description: { es: 'Motocicletas con motor de embolo de cilindrada > 500 cm3 pero <= 800 cm3', en: 'Motorcycles, with reciprocating piston engine of a cylinder capacity > 500 cc but <= 800 cc' } },
  { code: '871150', description: { es: 'Motocicletas con motor de embolo de cilindrada > 800 cm3', en: 'Motorcycles, with reciprocating piston engine of a cylinder capacity > 800 cc' } },
  { code: '871160', description: { es: 'Motocicletas con motor electrico para la propulsion', en: 'Motorcycles, with electric motor for propulsion' } },
  { code: '871190', description: { es: 'Las demas motocicletas y velocipedos', en: 'Other motorcycles and cycles' } },
  { code: '871200', description: { es: 'Bicicletas y demas velocipedos sin motor', en: 'Bicycles and other cycles, not motorised' } },
  { code: '871610', description: { es: 'Remolques y semirremolques para vivienda o acampar, del tipo caravana', en: 'Trailers and semi-trailers of the caravan type, for housing or camping' } },
  { code: '871620', description: { es: 'Remolques y semirremolques autocargadores o autodescargadores, para uso agricola', en: 'Self-loading or self-unloading trailers and semi-trailers for agricultural purposes' } },
  { code: '871631', description: { es: 'Remolques cisterna y semirremolques cisterna', en: 'Tanker trailers and tanker semi-trailers' } },
  { code: '871639', description: { es: 'Los demas remolques y semirremolques para transporte de mercancias', en: 'Other trailers and semi-trailers for the transport of goods' } },
  { code: '871640', description: { es: 'Los demas remolques y semirremolques', en: 'Other trailers and semi-trailers' } },
  { code: '871680', description: { es: 'Los demas vehiculos no automoviles', en: 'Other vehicles, not mechanically propelled' } },
  { code: '871690', description: { es: 'Partes de remolques, semirremolques y demas vehiculos no automoviles', en: 'Parts of trailers, semi-trailers and other vehicles, not mechanically propelled' } },

  // =========================================================================
  // CHAPTER 90 SUBHEADINGS (key headings)
  // =========================================================================
  { code: '900110', description: { es: 'Fibras opticas, haces y cables de fibras opticas', en: 'Optical fibres, optical fibre bundles and cables' } },
  { code: '900120', description: { es: 'Hojas y placas de materia polarizante', en: 'Sheets and plates of polarising material' } },
  { code: '900130', description: { es: 'Lentes de contacto', en: 'Contact lenses' } },
  { code: '900140', description: { es: 'Lentes de vidrio para gafas', en: 'Spectacle lenses of glass' } },
  { code: '900150', description: { es: 'Lentes de otras materias para gafas', en: 'Spectacle lenses of other materials' } },
  { code: '900190', description: { es: 'Los demas elementos de optica (prismas, espejos, lentes, filtros)', en: 'Other optical elements (prisms, mirrors, lenses, filters)' } },
  { code: '900410', description: { es: 'Gafas de sol', en: 'Sunglasses' } },
  { code: '900490', description: { es: 'Las demas gafas correctoras, protectoras u otras', en: 'Other spectacles, goggles and the like' } },
  { code: '901811', description: { es: 'Electrocardiografos', en: 'Electro-cardiographs' } },
  { code: '901812', description: { es: 'Aparatos de diagnostico por exploracion ultrasonica', en: 'Ultrasonic scanning apparatus' } },
  { code: '901813', description: { es: 'Aparatos de diagnostico por visualizacion con resonancia magnetica', en: 'Magnetic resonance imaging apparatus' } },
  { code: '901814', description: { es: 'Aparatos de centelleografia', en: 'Scintigraphic apparatus' } },
  { code: '901819', description: { es: 'Los demas aparatos de electrodiagnostico', en: 'Other electro-diagnostic apparatus' } },
  { code: '901820', description: { es: 'Aparatos de rayos ultravioletas o infrarrojos', en: 'Ultraviolet or infra-red ray apparatus' } },
  { code: '901831', description: { es: 'Jeringas, con o sin agujas', en: 'Syringes, with or without needles' } },
  { code: '901832', description: { es: 'Agujas tubulares de metal y agujas de sutura', en: 'Tubular metal needles and needles for sutures' } },
  { code: '901839', description: { es: 'Las demas agujas, cateteres, canulas e instrumentos similares', en: 'Other needles, catheters, cannulae and the like' } },
  { code: '901841', description: { es: 'Tornos dentales', en: 'Dental drill engines' } },
  { code: '901849', description: { es: 'Los demas instrumentos y aparatos de odontologia', en: 'Other instruments and appliances used in dental sciences' } },
  { code: '901850', description: { es: 'Los demas instrumentos y aparatos de oftalmologia', en: 'Other ophthalmic instruments and appliances' } },
  { code: '901890', description: { es: 'Los demas instrumentos y aparatos de medicina, cirugia o veterinaria', en: 'Other instruments and appliances used in medical, surgical or veterinary sciences' } },
  { code: '902110', description: { es: 'Articulos y aparatos de ortopedia o para fracturas', en: 'Orthopaedic or fracture appliances' } },
  { code: '902121', description: { es: 'Dientes artificiales', en: 'Artificial teeth' } },
  { code: '902129', description: { es: 'Los demas articulos y aparatos de protesis dental', en: 'Other dental fittings' } },
  { code: '902131', description: { es: 'Protesis articulares', en: 'Artificial joints' } },
  { code: '902139', description: { es: 'Las demas partes artificiales del cuerpo', en: 'Other artificial parts of the body' } },
  { code: '902140', description: { es: 'Audifonos, excepto las partes y accesorios', en: 'Hearing aids, excluding parts and accessories' } },
  { code: '902150', description: { es: 'Estimuladores cardiacos, excepto las partes y accesorios', en: 'Pacemakers for stimulating heart muscles, excluding parts and accessories' } },
  { code: '902190', description: { es: 'Los demas articulos que lleve la propia persona o se le implanten para compensar un defecto o una incapacidad', en: 'Other articles and appliances which are worn or carried or implanted in the body' } },
  { code: '902212', description: { es: 'Aparatos de tomografia computarizada', en: 'Computed tomography apparatus' } },
  { code: '902213', description: { es: 'Los demas aparatos de diagnostico por rayos X para odontologia', en: 'Other X-ray apparatus, for dental uses' } },
  { code: '902214', description: { es: 'Los demas aparatos de diagnostico por rayos X para uso medico, quirurgico o veterinario', en: 'Other X-ray apparatus, for medical, surgical or veterinary uses' } },
  { code: '902219', description: { es: 'Los demas aparatos de rayos X', en: 'Other X-ray apparatus' } },
  { code: '902221', description: { es: 'Aparatos que utilicen radiaciones alfa, beta o gamma, para uso medico, quirurgico, odontologico o veterinario', en: 'Apparatus based on the use of alpha, beta or gamma radiations, for medical, surgical, dental or veterinary uses' } },
  { code: '902229', description: { es: 'Los demas aparatos que utilicen radiaciones alfa, beta o gamma', en: 'Other apparatus based on the use of alpha, beta or gamma radiations' } },
  { code: '902230', description: { es: 'Tubos de rayos X', en: 'X-ray tubes' } },
  { code: '902290', description: { es: 'Los demas, incluidas las partes y accesorios', en: 'Other, including parts and accessories' } },
  { code: '903010', description: { es: 'Instrumentos y aparatos para medida o deteccion de radiaciones ionizantes', en: 'Instruments and apparatus for measuring or detecting ionising radiations' } },
  { code: '903020', description: { es: 'Osciloscopios y oscilografos', en: 'Oscilloscopes and oscillographs' } },
  { code: '903031', description: { es: 'Multimetros sin dispositivo registrador', en: 'Multimeters without a recording device' } },
  { code: '903032', description: { es: 'Multimetros con dispositivo registrador', en: 'Multimeters with a recording device' } },
  { code: '903033', description: { es: 'Los demas instrumentos para medida o verificacion de tension, intensidad, resistencia o potencia, sin dispositivo registrador', en: 'Other instruments for measuring or checking voltage, current, resistance or power, without a recording device' } },
  { code: '903039', description: { es: 'Los demas instrumentos para medida o verificacion de tension, intensidad, resistencia o potencia, con dispositivo registrador', en: 'Other instruments for measuring or checking voltage, current, resistance or power, with a recording device' } },
  { code: '903040', description: { es: 'Los demas instrumentos y aparatos especialmente concebidos para telecomunicacion', en: 'Other instruments and apparatus, specially designed for telecommunications' } },
  { code: '903082', description: { es: 'Instrumentos y aparatos para la medida o verificacion de semiconductores', en: 'Instruments for measuring or checking semiconductor wafers or devices' } },
  { code: '903084', description: { es: 'Los demas instrumentos con dispositivo registrador', en: 'Other instruments, with a recording device' } },
  { code: '903089', description: { es: 'Los demas instrumentos sin dispositivo registrador', en: 'Other instruments, without a recording device' } },
  { code: '903090', description: { es: 'Partes y accesorios de los aparatos de la partida 9030', en: 'Parts and accessories of apparatus of heading 9030' } },

  // =========================================================================
  // CHAPTER 94 SUBHEADINGS
  // =========================================================================
  { code: '940110', description: { es: 'Asientos de los tipos utilizados en aeronaves', en: 'Seats of a kind used for aircraft' } },
  { code: '940120', description: { es: 'Asientos de los tipos utilizados en vehiculos automoviles', en: 'Seats of a kind used for motor vehicles' } },
  { code: '940131', description: { es: 'Asientos giratorios de altura ajustable, de madera', en: 'Swivel seats with variable height adjustment, of wood' } },
  { code: '940139', description: { es: 'Los demas asientos giratorios de altura ajustable', en: 'Other swivel seats with variable height adjustment' } },
  { code: '940140', description: { es: 'Asientos, excepto los de jardin o acampar, transformables en cama', en: 'Seats, other than garden seats or camping equipment, convertible into beds' } },
  { code: '940152', description: { es: 'Asientos de bambu', en: 'Seats, of bamboo' } },
  { code: '940153', description: { es: 'Asientos de roten', en: 'Seats, of rattan' } },
  { code: '940159', description: { es: 'Los demas asientos de mimbre, osier o materias similares', en: 'Other seats, of cane, osier, bamboo or similar materials' } },
  { code: '940161', description: { es: 'Los demas asientos con armazon de madera, tapizados', en: 'Other seats, with wooden frames, upholstered' } },
  { code: '940169', description: { es: 'Los demas asientos con armazon de madera', en: 'Other seats, with wooden frames' } },
  { code: '940171', description: { es: 'Los demas asientos con armazon de metal, tapizados', en: 'Other seats, with metal frames, upholstered' } },
  { code: '940179', description: { es: 'Los demas asientos con armazon de metal', en: 'Other seats, with metal frames' } },
  { code: '940180', description: { es: 'Los demas asientos', en: 'Other seats' } },
  { code: '940190', description: { es: 'Partes de asientos', en: 'Parts of seats' } },
  { code: '940210', description: { es: 'Sillones de dentista, de peluqueria y sillones similares, y sus partes', en: 'Dentists, barbers or similar chairs and parts thereof' } },
  { code: '940290', description: { es: 'Los demas muebles para medicina, cirugia, odontologia o veterinaria, y sus partes', en: 'Other medical, surgical, dental or veterinary furniture, and parts' } },
  { code: '940310', description: { es: 'Muebles de metal del tipo de los utilizados en oficinas', en: 'Metal furniture of a kind used in offices' } },
  { code: '940320', description: { es: 'Los demas muebles de metal', en: 'Other metal furniture' } },
  { code: '940330', description: { es: 'Muebles de madera del tipo de los utilizados en oficinas', en: 'Wooden furniture of a kind used in offices' } },
  { code: '940340', description: { es: 'Muebles de madera del tipo de los utilizados en cocinas', en: 'Wooden furniture of a kind used in the kitchen' } },
  { code: '940350', description: { es: 'Muebles de madera del tipo de los utilizados en dormitorios', en: 'Wooden furniture of a kind used in the bedroom' } },
  { code: '940360', description: { es: 'Los demas muebles de madera', en: 'Other wooden furniture' } },
  { code: '940370', description: { es: 'Muebles de plastico', en: 'Furniture of plastics' } },
  { code: '940380', description: { es: 'Muebles de otras materias, incluidos el roten, mimbre, bambu o materias similares', en: 'Furniture of other materials, including cane, osier, bamboo or similar materials' } },
  { code: '940391', description: { es: 'Partes de muebles de madera', en: 'Parts of wooden furniture' } },
  { code: '940399', description: { es: 'Partes de los demas muebles', en: 'Parts of other furniture' } },
  { code: '940410', description: { es: 'Somieres', en: 'Mattress supports' } },
  { code: '940421', description: { es: 'Colchones de caucho o plastico celulares, recubiertos o no', en: 'Mattresses of cellular rubber or plastics, whether or not covered' } },
  { code: '940429', description: { es: 'Colchones de las demas materias', en: 'Mattresses of other materials' } },
  { code: '940430', description: { es: 'Sacos de dormir', en: 'Sleeping bags' } },
  { code: '940490', description: { es: 'Los demas (edredones, cojines, pufs, almohadas)', en: 'Other (quilts, eiderdowns, cushions, pouffes, pillows)' } },
  { code: '940510', description: { es: 'Arañas y demas aparatos de alumbrado electrico de techo o pared', en: 'Chandeliers and other electric ceiling or wall lighting fittings' } },
  { code: '940520', description: { es: 'Lamparas electricas de cabecera, de escritorio, de oficina o de pie', en: 'Electric table, desk, bedside or floor-standing luminaires' } },
  { code: '940530', description: { es: 'Guirnaldas electricas del tipo de las utilizadas en arboles de Navidad', en: 'Lighting strings of a kind used for Christmas trees' } },
  { code: '940540', description: { es: 'Los demas aparatos de alumbrado electrico', en: 'Other electric luminaires and lighting fittings' } },
  { code: '940550', description: { es: 'Aparatos de alumbrado no electricos', en: 'Non-electrical luminaires and lighting fittings' } },
  { code: '940560', description: { es: 'Anuncios, letreros y placas indicadoras luminosos y articulos similares', en: 'Illuminated signs, illuminated name-plates and the like' } },
  { code: '940590', description: { es: 'Partes de aparatos de alumbrado', en: 'Parts of luminaires and lighting fittings' } },
  { code: '940610', description: { es: 'Construcciones prefabricadas de madera', en: 'Prefabricated buildings, of wood' } },
  { code: '940620', description: { es: 'Construcciones prefabricadas de metal', en: 'Prefabricated buildings, of metal' } },
  { code: '940690', description: { es: 'Las demas construcciones prefabricadas', en: 'Other prefabricated buildings' } },
];

// ============================================================================
// SCRIPT LOGIC - Connect to MongoDB, upsert all hierarchy data
// ============================================================================

async function main() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/luci-customs';

  console.log('=== TARIC Hierarchy Generator ===');
  console.log(`Headings (4-digit): ${ALL_HEADINGS.length}`);
  console.log(`Priority subheadings (6-digit): ${PRIORITY_SUBHEADINGS.length}`);
  console.log(`Total entries: ${ALL_HEADINGS.length + PRIORITY_SUBHEADINGS.length}`);
  console.log('');

  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    let upsertedHeadings = 0;
    let upsertedSubheadings = 0;
    let errors = 0;

    // Process headings (4-digit)
    console.log('\n--- Upserting headings (4-digit) ---');
    for (const h of ALL_HEADINGS) {
      try {
        const chapter = h.code.substring(0, 2);
        await TaricCode.findOneAndUpdate(
          { code: h.code },
          {
            $set: {
              code: h.code,
              description: h.description,
              level: 4,
              isLeaf: false,
              isActive: true,
              breakdown: {
                chapter: chapter,
                heading: h.code
              },
              parent: chapter,
              lastUpdated: new Date()
            }
          },
          { upsert: true, new: true }
        );
        upsertedHeadings++;
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.error(`  Error upserting heading ${h.code}: ${err.message}`);
        }
      }
    }
    console.log(`  Upserted ${upsertedHeadings} headings`);

    // Process subheadings (6-digit)
    console.log('\n--- Upserting priority subheadings (6-digit) ---');
    for (const s of PRIORITY_SUBHEADINGS) {
      try {
        const chapter = s.code.substring(0, 2);
        const heading = s.code.substring(0, 4);
        await TaricCode.findOneAndUpdate(
          { code: s.code },
          {
            $set: {
              code: s.code,
              description: s.description,
              level: 6,
              isLeaf: false,
              isActive: true,
              breakdown: {
                chapter: chapter,
                heading: heading,
                subheading: s.code
              },
              parent: heading,
              lastUpdated: new Date()
            }
          },
          { upsert: true, new: true }
        );
        upsertedSubheadings++;
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.error(`  Error upserting subheading ${s.code}: ${err.message}`);
        }
      }
    }
    console.log(`  Upserted ${upsertedSubheadings} subheadings`);

    // Print stats
    console.log('\n=== STATS ===');
    console.log(`Headings upserted: ${upsertedHeadings}`);
    console.log(`Subheadings upserted: ${upsertedSubheadings}`);
    console.log(`Total upserted: ${upsertedHeadings + upsertedSubheadings}`);
    console.log(`Errors: ${errors}`);

    // Count totals in DB
    const totalLevel2 = await TaricCode.countDocuments({ level: 2, isActive: true });
    const totalLevel4 = await TaricCode.countDocuments({ level: 4, isActive: true });
    const totalLevel6 = await TaricCode.countDocuments({ level: 6, isActive: true });
    const totalLevel10 = await TaricCode.countDocuments({ level: 10, isActive: true });
    const totalAll = await TaricCode.countDocuments({ isActive: true });

    console.log('\n=== DATABASE TOTALS ===');
    console.log(`Chapters (level 2):    ${totalLevel2}`);
    console.log(`Headings (level 4):    ${totalLevel4}`);
    console.log(`Subheadings (level 6): ${totalLevel6}`);
    console.log(`TARIC codes (level 10): ${totalLevel10}`);
    console.log(`Total active codes:    ${totalAll}`);

  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

main();
