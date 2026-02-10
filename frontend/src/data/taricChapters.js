/**
 * Nombres de los 98 capitulos del arancel TARIC/SA
 * Fuente: Arancel Integrado de las Comunidades Europeas (TARIC)
 */
const TARIC_CHAPTERS = {
  '01': 'Animales vivos',
  '02': 'Carne y despojos comestibles',
  '03': 'Pescados y crustaceos, moluscos y demas invertebrados acuaticos',
  '04': 'Leche y productos lacteos; huevos de ave; miel natural',
  '05': 'Los demas productos de origen animal',
  '06': 'Plantas vivas y productos de la floricultura',
  '07': 'Hortalizas, plantas, raices y tuberculos alimenticios',
  '08': 'Frutas y frutos comestibles; cortezas de agrios, melones o sandias',
  '09': 'Cafe, te, yerba mate y especias',
  '10': 'Cereales',
  '11': 'Productos de la molineria; malta; almidon y fecula; inulina; gluten de trigo',
  '12': 'Semillas y frutos oleaginosos; semillas y frutos diversos',
  '13': 'Gomas, resinas y demas jugos y extractos vegetales',
  '14': 'Materias trenzables y demas productos de origen vegetal',
  '15': 'Grasas y aceites animales o vegetales; grasas alimenticias elaboradas; ceras',
  '16': 'Preparaciones de carne, pescado o crustaceos',
  '17': 'Azucares y articulos de confiteria',
  '18': 'Cacao y sus preparaciones',
  '19': 'Preparaciones a base de cereales, harina, almidon, fecula o leche',
  '20': 'Preparaciones de hortalizas, frutas u otros frutos',
  '21': 'Preparaciones alimenticias diversas',
  '22': 'Bebidas, liquidos alcoholicos y vinagre',
  '23': 'Residuos y desperdicios de las industrias alimentarias',
  '24': 'Tabaco y sucedaneos del tabaco elaborados',
  '25': 'Sal; azufre; tierras y piedras; yesos, cales y cementos',
  '26': 'Minerales metaliferos, escorias y cenizas',
  '27': 'Combustibles minerales, aceites minerales',
  '28': 'Productos quimicos inorganicos',
  '29': 'Productos quimicos organicos',
  '30': 'Productos farmaceuticos',
  '31': 'Abonos',
  '32': 'Extractos curtientes o tintoreos; taninos y sus derivados',
  '33': 'Aceites esenciales y resinoides; preparaciones de perfumeria',
  '34': 'Jabones, agentes de superficie organicos',
  '35': 'Materias albuminoideas; productos a base de almidon o fecula modificados',
  '36': 'Polvoras y explosivos; articulos de pirotecnia',
  '37': 'Productos fotograficos o cinematograficos',
  '38': 'Productos diversos de las industrias quimicas',
  '39': 'Plastico y sus manufacturas',
  '40': 'Caucho y sus manufacturas',
  '41': 'Pieles (excepto la peleteria) y cueros',
  '42': 'Manufacturas de cuero; articulos de talabarteria o guarnicioneria',
  '43': 'Peleteria y confecciones de peleteria',
  '44': 'Madera, carbon vegetal y manufacturas de madera',
  '45': 'Corcho y sus manufacturas',
  '46': 'Manufacturas de esparteria o cesteria',
  '47': 'Pasta de madera o de las demas materias fibrosas celulosicas',
  '48': 'Papel y carton; manufacturas de pasta de celulosa',
  '49': 'Productos editoriales, de la prensa y de las demas industrias graficas',
  '50': 'Seda',
  '51': 'Lana y pelo fino u ordinario',
  '52': 'Algodon',
  '53': 'Las demas fibras textiles vegetales',
  '54': 'Filamentos sinteticos o artificiales',
  '55': 'Fibras sinteticas o artificiales discontinuas',
  '56': 'Guata, fieltro y telas sin tejer',
  '57': 'Alfombras y demas revestimientos para el suelo',
  '58': 'Tejidos especiales; superficies textiles con mechon insertado',
  '59': 'Telas impregnadas, recubiertas, revestidas o estratificadas',
  '60': 'Tejidos de punto',
  '61': 'Prendas y complementos de vestir, de punto',
  '62': 'Prendas y complementos de vestir, excepto los de punto',
  '63': 'Los demas articulos textiles confeccionados; juegos; prenderia',
  '64': 'Calzado, polainas y articulos analogos',
  '65': 'Sombreros, demas tocados, y sus partes',
  '66': 'Paraguas, sombrillas, quitasoles, bastones',
  '67': 'Plumas y plumon preparados; flores artificiales',
  '68': 'Manufacturas de piedra, yeso fraguable, cemento, amianto',
  '69': 'Productos ceramicos',
  '70': 'Vidrio y sus manufacturas',
  '71': 'Perlas finas o cultivadas, piedras preciosas, metales preciosos',
  '72': 'Fundicion, hierro y acero',
  '73': 'Manufacturas de fundicion, hierro o acero',
  '74': 'Cobre y sus manufacturas',
  '75': 'Niquel y sus manufacturas',
  '76': 'Aluminio y sus manufacturas',
  '78': 'Plomo y sus manufacturas',
  '79': 'Cinc y sus manufacturas',
  '80': 'Estano y sus manufacturas',
  '81': 'Los demas metales comunes; cermets',
  '82': 'Herramientas y utiles, articulos de cuchilleria',
  '83': 'Manufacturas diversas de metal comun',
  '84': 'Reactores nucleares, calderas, maquinas, aparatos y artefactos mecanicos',
  '85': 'Maquinas, aparatos y material electrico',
  '86': 'Vehiculos y material para vias ferreas',
  '87': 'Vehiculos automoviles, tractores, velocipedos',
  '88': 'Aeronaves, vehiculos espaciales',
  '89': 'Barcos y demas artefactos flotantes',
  '90': 'Instrumentos y aparatos de optica, fotografia, cinematografia',
  '91': 'Aparatos de relojeria y sus partes',
  '92': 'Instrumentos musicales; sus partes y accesorios',
  '93': 'Armas, municiones, y sus partes y accesorios',
  '94': 'Muebles; mobiliario medico-quirurgico; articulos de cama',
  '95': 'Juguetes, juegos y articulos para recreo o deporte',
  '96': 'Manufacturas diversas',
  '97': 'Objetos de arte o coleccion y antiguedades'
}

/**
 * Secciones del arancel TARIC
 */
export const TARIC_SECTIONS = [
  { num: 'I', name: 'Animales vivos y productos del reino animal', chapters: ['01','02','03','04','05'] },
  { num: 'II', name: 'Productos del reino vegetal', chapters: ['06','07','08','09','10','11','12','13','14'] },
  { num: 'III', name: 'Grasas y aceites animales o vegetales', chapters: ['15'] },
  { num: 'IV', name: 'Productos de las industrias alimentarias', chapters: ['16','17','18','19','20','21','22','23','24'] },
  { num: 'V', name: 'Productos minerales', chapters: ['25','26','27'] },
  { num: 'VI', name: 'Productos de las industrias quimicas', chapters: ['28','29','30','31','32','33','34','35','36','37','38'] },
  { num: 'VII', name: 'Plastico y caucho', chapters: ['39','40'] },
  { num: 'VIII', name: 'Pieles, cueros, peleteria', chapters: ['41','42','43'] },
  { num: 'IX', name: 'Madera, corcho, cesteria', chapters: ['44','45','46'] },
  { num: 'X', name: 'Pasta de madera, papel', chapters: ['47','48','49'] },
  { num: 'XI', name: 'Materias textiles y sus manufacturas', chapters: ['50','51','52','53','54','55','56','57','58','59','60','61','62','63'] },
  { num: 'XII', name: 'Calzado, sombreros, paraguas', chapters: ['64','65','66','67'] },
  { num: 'XIII', name: 'Manufacturas de piedra, ceramica, vidrio', chapters: ['68','69','70'] },
  { num: 'XIV', name: 'Perlas, piedras preciosas, metales preciosos', chapters: ['71'] },
  { num: 'XV', name: 'Metales comunes y sus manufacturas', chapters: ['72','73','74','75','76','78','79','80','81','82','83'] },
  { num: 'XVI', name: 'Maquinas y aparatos, material electrico', chapters: ['84','85'] },
  { num: 'XVII', name: 'Material de transporte', chapters: ['86','87','88','89'] },
  { num: 'XVIII', name: 'Instrumentos y aparatos de optica', chapters: ['90','91','92'] },
  { num: 'XIX', name: 'Armas y municiones', chapters: ['93'] },
  { num: 'XX', name: 'Mercancias y productos diversos', chapters: ['94','95','96'] },
  { num: 'XXI', name: 'Objetos de arte o coleccion y antiguedades', chapters: ['97'] }
]

/**
 * Obtener nombre de capitulo por codigo
 */
export function getChapterName(code) {
  const chapter = code?.substring(0, 2)
  return TARIC_CHAPTERS[chapter] || `Capitulo ${chapter}`
}

/**
 * Obtener seccion por codigo de capitulo
 */
export function getSectionByChapter(chapterCode) {
  return TARIC_SECTIONS.find(s => s.chapters.includes(chapterCode))
}

/**
 * Nombres de niveles TARIC
 */
export const LEVEL_NAMES = {
  2: 'Capitulo',
  4: 'Partida',
  6: 'Subpartida SA',
  8: 'Nomenclatura Combinada (NC)',
  10: 'Codigo TARIC'
}

export default TARIC_CHAPTERS
